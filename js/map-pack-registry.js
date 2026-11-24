// =========================================================================
// MAP PACK REGISTRY & LIFECYCLE CORE (TRACK-M0)
// Standard MapPack contract, tw_modern default adapter, lazy <script> loader,
// and switchActiveMapPack() lifecycle. Compatible with file:// and Node VM.
// =========================================================================

window.GEOMASTER_PACKS = window.GEOMASTER_PACKS || {};

const DEFAULT_MAP_PACK_ID = "tw_modern";

const DEFAULT_PACK_COLORS = [
  "#38bdf8", "#60a5fa", "#818cf8", "#fb923c", "#f472b6", "#34d399",
  "#2dd4bf", "#a78bfa", "#c084fc", "#e879f9", "#facc15", "#4ade80",
  "#a3e635", "#fb7185", "#f87171", "#22d3ee", "#6ee7b7", "#fbbf24",
  "#93c5fd", "#fca5a5", "#fdba74"
];

const _loadedPackScripts = new Map();
let _mapPackSwitchSeq = 0;
let _pendingMapPackId = null;

function getLoadingMapPackId() {
  return _pendingMapPackId;
}

function _yieldToBrowserPaint(options) {
  if (options && options.skipPaintYield) return Promise.resolve();
  if (typeof window === "undefined" || typeof requestAnimationFrame !== "function") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    requestAnimationFrame(() => requestAnimationFrame(done));
    // Fallback ensures background tabs (or headless test mocks with no-op rAF) never stall
    setTimeout(done, 48);
  });
}

function loadMapPackScript(src) {
  if (!src) return Promise.resolve();
  if (_loadedPackScripts.has(src)) return _loadedPackScripts.get(src);
  if (typeof document === "undefined" || !document.createElement) {
    return Promise.resolve();
  }
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.onload = () => resolve();
    script.onerror = (err) => {
      _loadedPackScripts.delete(src);
      reject(new Error(`Failed to load map pack script: ${src}${err ? "" : ""}`));
    };
    const parent = document.head || document.body || document.documentElement;
    if (parent && typeof parent.appendChild === "function") {
      parent.appendChild(script);
    } else {
      resolve();
    }
  });
  _loadedPackScripts.set(src, promise);
  return promise;
}

function defaultNormalizePackInput(rawStr) {
  if (!rawStr) return "";
  return String(rawStr)
    .trim()
    .toLowerCase()
    .replace(/[\s\-_.'’·・,，()（）[\]【】]+/g, "");
}

function normalizeMapPackDefinition(raw) {
  if (!raw || !raw.id) {
    throw new Error("MapPack must define a non-empty string 'id'");
  }
  const hierarchyDepth = Number.isFinite(raw.hierarchyDepth) ? raw.hierarchyDepth : 2;
  const rawFeatures = raw.features || {};
  const defaultDiffs =
    hierarchyDepth <= 1
      ? (rawFeatures.supportsSuffixDifficulty ? ["casual", "hard_suffix"] : ["casual"])
      : ["casual", "county_only", "hard_suffix", "hard_full"];

  const features = {
    supportsTransportQuiz: Boolean(rawFeatures.supportsTransportQuiz),
    supportsPoiQuiz: Boolean(rawFeatures.supportsPoiQuiz),
    supportsMasterHierarchy: Boolean(rawFeatures.supportsMasterHierarchy),
    supportsSuffixDifficulty: Boolean(rawFeatures.supportsSuffixDifficulty),
    quickSuffixes: Array.isArray(rawFeatures.quickSuffixes) ? [...rawFeatures.quickSuffixes] : [],
    supportedDifficulties:
      Array.isArray(rawFeatures.supportedDifficulties) && rawFeatures.supportedDifficulties.length > 0
        ? [...rawFeatures.supportedDifficulties]
        : defaultDiffs
  };

  const rawView = raw.mapView || {};
  const mapView = {
    center: Array.isArray(rawView.center) ? rawView.center : [23.75, 120.95],
    defaultZoom: Number.isFinite(rawView.defaultZoom) ? rawView.defaultZoom : 8,
    minZoom: Number.isFinite(rawView.minZoom) ? rawView.minZoom : 2,
    maxZoom: Number.isFinite(rawView.maxZoom) ? rawView.maxZoom : 18,
    maxBounds: rawView.maxBounds === undefined ? null : rawView.maxBounds,
    fullViewBounds: rawView.fullViewBounds || null,
    pinDropScaleKm: Number.isFinite(rawView.pinDropScaleKm) ? rawView.pinDropScaleKm : 25,
    targetFocusZoom: Number.isFinite(rawView.targetFocusZoom) ? rawView.targetFocusZoom : Math.max(4, (rawView.defaultZoom || 8) + 2),
    groupFocusZoom: Number.isFinite(rawView.groupFocusZoom) ? rawView.groupFocusZoom : Math.max(3, (rawView.defaultZoom || 8) + 1),
    targetMaxZoom: Number.isFinite(rawView.targetMaxZoom) ? rawView.targetMaxZoom : Math.min(14, (rawView.defaultZoom || 8) + 4),
    satelliteFallbackDelta: rawView.satelliteFallbackDelta || { group: 0.5, item: 0.25 },
    mainPolygonDistThresholdDeg: Number.isFinite(rawView.mainPolygonDistThresholdDeg) ? rawView.mainPolygonDistThresholdDeg : 0.35,
    groupMainDistThresholdDeg: Number.isFinite(rawView.groupMainDistThresholdDeg) ? rawView.groupMainDistThresholdDeg : 0.45,
    pureIslandGroups: Array.isArray(rawView.pureIslandGroups) ? rawView.pureIslandGroups : [],
    offshoreExclusionSet: rawView.offshoreExclusionSet || null,
    worldCopyJump: Boolean(rawView.worldCopyJump),
    quickJumps: Array.isArray(rawView.quickJumps) ? rawView.quickJumps : []
  };

  const rawLabels = raw.unitLabels || {};
  const unitLabels = {
    group: rawLabels.group || (hierarchyDepth <= 1 ? "分區" : "縣市"),
    item: rawLabels.item || (hierarchyDepth <= 1 ? "地區" : "行政區"),
    itemShort: rawLabels.itemShort || "區",
    fullScopeLabel: rawLabels.fullScopeLabel || ""
  };

  const getGroups = typeof raw.getGroups === "function" ? raw.getGroups : () => (Array.isArray(raw.groups) ? raw.groups : []);
  const getItems = typeof raw.getItems === "function" ? raw.getItems : () => (Array.isArray(raw.items) ? raw.items : []);
  const normalizeInput = typeof raw.normalizeInput === "function" ? raw.normalizeInput : defaultNormalizePackInput;

  const getGroupByName =
    typeof raw.getGroupByName === "function"
      ? raw.getGroupByName
      : (name) => {
          const groups = getGroups();
          return groups.find((g) => g.name === name) || null;
        };

  const getGroupColor =
    typeof raw.getGroupColor === "function"
      ? raw.getGroupColor
      : (groupName) => {
          if (raw.groupColors && raw.groupColors[groupName]) return raw.groupColors[groupName];
          const groups = getGroups();
          const idx = groups.findIndex((g) => g.name === groupName);
          return DEFAULT_PACK_COLORS[(idx >= 0 ? idx : 0) % DEFAULT_PACK_COLORS.length];
        };

  const ensureLoaded =
    typeof raw.ensureLoaded === "function"
      ? raw.ensureLoaded
      : async () => {
          const existing = window.GEOMASTER_PACKS[raw.id];
          if (existing && existing._isFullPack) {
            return existing;
          }
          if (raw.scriptUrl && !raw._scriptLoaded) {
            await loadMapPackScript(raw.scriptUrl);
            raw._scriptLoaded = true;
          }
          return window.GEOMASTER_PACKS[raw.id] || pack;
        };

  const matchFeatureToItem =
    typeof raw.matchFeatureToItem === "function"
      ? raw.matchFeatureToItem
      : (props, feat) => {
          const items = getItems();
          const p = props || (feat && feat.properties) || {};
          const featId = feat && feat.id != null ? String(feat.id) : "";
          const propId = p.id != null ? String(p.id) : (p.code != null ? String(p.code) : "");
          if (propId) {
            const byPropId = items.find((it) => String(it.id) === propId || String(it.code || "") === propId);
            if (byPropId) return byPropId;
          }
          if (featId) {
            const byFeatId = items.find((it) => String(it.id) === featId || String(it.isoNumeric || "") === featId || String(it.code || "") === featId);
            if (byFeatId) return byFeatId;
          }
          const rawName = p.name || p.townName || p.NAME || "";
          if (rawName) {
            const norm = normalizeInput(rawName);
            const byName = items.find(
              (it) =>
                normalizeInput(it.townName) === norm ||
                normalizeInput(it.baseName) === norm ||
                (Array.isArray(it.aliases) && it.aliases.some((al) => normalizeInput(al) === norm))
            );
            if (byName) return byName;
          }
          return null;
        };

  const pack = {
    ...raw,
    id: String(raw.id),
    displayName: raw.displayName || String(raw.id),
    shortLabel: raw.shortLabel || raw.displayName || String(raw.id),
    version: raw.version || "1.0",
    hierarchyDepth,
    unitLabels,
    mapView,
    features,
    regionFilters: Array.isArray(raw.regionFilters) ? raw.regionFilters : [],
    normalizeInput,
    ensureLoaded,
    getGroups,
    getItems,
    getGroupByName,
    getGroupColor,
    matchFeatureToItem
  };

  return pack;
}

function registerMapPack(rawPack) {
  const prev = rawPack && rawPack.id ? window.GEOMASTER_PACKS[rawPack.id] : null;
  const mergedRaw =
    prev && prev._isLazyStub && rawPack && !rawPack._isLazyStub
      ? {
          badgeText: prev.badgeText,
          dataNote: prev.dataNote,
          ...rawPack
        }
      : rawPack;
  const pack = normalizeMapPackDefinition(mergedRaw);
  window.GEOMASTER_PACKS[pack.id] = pack;
  if (typeof renderMapPackSwitcherUI === "function") {
    try {
      renderMapPackSwitcherUI();
    } catch (_) {}
  }
  return pack;
}

function unregisterMapPack(packId) {
  if (!packId || packId === DEFAULT_MAP_PACK_ID) return false;
  if (!window.GEOMASTER_PACKS[packId]) return false;
  delete window.GEOMASTER_PACKS[packId];
  if (typeof renderMapPackSwitcherUI === "function") {
    try {
      renderMapPackSwitcherUI();
    } catch (_) {}
  }
  return true;
}

function getRegisteredMapPacks() {
  return Object.values(window.GEOMASTER_PACKS);
}

function getMapPackById(packId) {
  if (!packId) return null;
  return window.GEOMASTER_PACKS[packId] || null;
}

function _getSafeActiveMapPackId() {
  try {
    if (typeof state !== "undefined" && state && state.activeMapPackId) {
      return state.activeMapPackId;
    }
  } catch (_) {}
  return DEFAULT_MAP_PACK_ID;
}

function getActiveMapPack() {
  const activeId = _getSafeActiveMapPackId();
  return window.GEOMASTER_PACKS[activeId] || window.GEOMASTER_PACKS[DEFAULT_MAP_PACK_ID] || getRegisteredMapPacks()[0] || null;
}

function getActiveGroups() {
  const pack = getActiveMapPack();
  if (pack && typeof pack.getGroups === "function") return pack.getGroups();
  return typeof TAIWAN_ADMIN_DATA !== "undefined" ? TAIWAN_ADMIN_DATA : [];
}

function getActiveItems() {
  const pack = getActiveMapPack();
  if (pack && typeof pack.getItems === "function") return pack.getItems();
  return typeof ALL_TOWNS !== "undefined" ? ALL_TOWNS : [];
}

function getActiveGroupByName(name) {
  const pack = getActiveMapPack();
  if (pack && typeof pack.getGroupByName === "function") return pack.getGroupByName(name);
  return typeof COUNTY_BY_NAME !== "undefined" ? COUNTY_BY_NAME[name] || null : null;
}

function getActiveGroupColor(groupName) {
  const pack = getActiveMapPack();
  if (pack && typeof pack.getGroupColor === "function") return pack.getGroupColor(groupName);
  return typeof COUNTY_COLORS !== "undefined" && COUNTY_COLORS[groupName] ? COUNTY_COLORS[groupName] : "#38bdf8";
}

function normalizeActiveInput(rawStr) {
  const pack = getActiveMapPack();
  if (pack && typeof pack.normalizeInput === "function") return pack.normalizeInput(rawStr);
  return typeof normTw === "function" ? normTw(rawStr) : defaultNormalizePackInput(rawStr);
}

function getActiveRegionFilters() {
  const pack = getActiveMapPack();
  return pack && Array.isArray(pack.regionFilters) ? pack.regionFilters : [];
}

function getActivePackFeatures() {
  const pack = getActiveMapPack();
  return (
    (pack && pack.features) || {
      supportsTransportQuiz: true,
      supportsPoiQuiz: true,
      supportsMasterHierarchy: true,
      supportsSuffixDifficulty: true,
      quickSuffixes: ["區", "鄉", "鎮", "市"],
      supportedDifficulties: ["casual", "county_only", "hard_suffix", "hard_full", "master_hierarchy"]
    }
  );
}

function getActivePackMapView() {
  const pack = getActiveMapPack();
  return (
    (pack && pack.mapView) || {
      center: [23.75, 120.95],
      defaultZoom: 8,
      minZoom: 7,
      maxZoom: 18,
      maxBounds: [[20.2, 116.5], [27.4, 123.8]],
      fullViewBounds: [[21.82, 119.25], [25.38, 122.08]],
      pinDropScaleKm: 25,
      targetFocusZoom: 10,
      groupFocusZoom: 9,
      targetMaxZoom: 12,
      satelliteFallbackDelta: { group: 0.18, item: 0.06 },
      mainPolygonDistThresholdDeg: 0.35,
      groupMainDistThresholdDeg: 0.45,
      pureIslandGroups: ["澎湖縣", "金門縣", "連江縣"],
      offshoreExclusionSet: typeof TAIWAN_MAINLAND_OFFSHORE_SET !== "undefined" ? TAIWAN_MAINLAND_OFFSHORE_SET : null,
      worldCopyJump: false,
      quickJumps: []
    }
  );
}

function getActivePackUnitLabels() {
  const pack = getActiveMapPack();
  return (
    (pack && pack.unitLabels) || {
      group: "縣市",
      item: "鄉鎮市區",
      itemShort: "區",
      fullScopeLabel: "全台 368 區"
    }
  );
}

function isActivePackSingleLayer() {
  const pack = getActiveMapPack();
  return Boolean(pack && pack.hierarchyDepth === 1);
}

function getPackEligibleItems(pack = null, st = null) {
  const p = pack || getActiveMapPack();
  const items = p && typeof p.getItems === "function" ? p.getItems() : getActiveItems();
  if (!Array.isArray(items)) return [];
  const targetState = st || (typeof state !== "undefined" ? state : null);
  if (p && typeof p.isItemEnabledByOptions === "function") {
    return items.filter((it) => Boolean(p.isItemEnabledByOptions(it, targetState)));
  }
  return items;
}

function resolveRegionFilterItemIds(filter, items, st = null) {
  if (!filter) return [];
  const pack = getActiveMapPack();
  const targetState = st || (typeof state !== "undefined" ? state : null);
  const rawItems = Array.isArray(items) ? items : getActiveItems();
  const eligibleItems =
    pack && typeof pack.isItemEnabledByOptions === "function"
      ? rawItems.filter((it) => Boolean(pack.isItemEnabledByOptions(it, targetState)))
      : rawItems;
  const eligibleIdSet = new Set(eligibleItems.map((it) => it.id));

  let resolvedIds;
  if (typeof filter.getItemIds === "function") {
    resolvedIds = Array.from(filter.getItemIds(eligibleItems) || []);
  } else if (Array.isArray(filter.itemIds)) {
    resolvedIds = filter.itemIds;
  } else if (filter.itemIds instanceof Set) {
    resolvedIds = Array.from(filter.itemIds);
  } else if (Array.isArray(filter.groupNames)) {
    const gSet = new Set(filter.groupNames);
    resolvedIds = eligibleItems.filter((it) => gSet.has(it.countyName)).map((it) => it.id);
  } else {
    resolvedIds = eligibleItems.map((it) => it.id);
  }
  return resolvedIds.filter((id) => eligibleIdSet.has(id));
}

// =========================================================================
// DEFAULT PACK: tw_modern (Wraps existing Taiwan globals with zero mutation)
// =========================================================================
function buildTaiwanModernRegionFilters() {
  if (typeof ALL_TOWNS === "undefined") return [];
  const byCounties = (names) => ALL_TOWNS.filter((t) => names.includes(t.countyName)).map((t) => t.id);
  const byFullSet = (setObj) =>
    setObj ? ALL_TOWNS.filter((t) => setObj.has(t.fullCountyTown)).map((t) => t.id) : [];

  return [
    { id: "all", label: "全台灣", shortLabel: "全臺", emoji: "🇹🇼", itemIds: ALL_TOWNS.map((t) => t.id) },
    { id: "north", label: "北部", emoji: "🏙️", itemIds: byCounties(["臺北市", "新北市", "基隆市", "桃園市", "新竹市", "新竹縣", "宜蘭縣"]) },
    { id: "central", label: "中部", emoji: "⛰️", itemIds: byCounties(["苗栗縣", "臺中市", "彰化縣", "南投縣", "雲林縣"]) },
    { id: "south", label: "南部", emoji: "☀️", itemIds: byCounties(["嘉義市", "嘉義縣", "臺南市", "高雄市", "屏東縣", "澎湖縣"]) },
    { id: "east", label: "東部", emoji: "🌊", itemIds: byCounties(["花蓮縣", "臺東縣"]) },
    { id: "islands", label: "離島", emoji: "🏝️", itemIds: byCounties(["澎湖縣", "金門縣", "連江縣"]) },
    { id: "mountain", label: "山區鄉鎮", shortLabel: "山區", emoji: "🏔️", itemIds: byFullSet(typeof TAIWAN_MOUNTAIN_SET !== "undefined" ? TAIWAN_MOUNTAIN_SET : null) },
    { id: "west_plain", label: "西部平原", emoji: "🌾", itemIds: byFullSet(typeof TAIWAN_WEST_PLAIN_SET !== "undefined" ? TAIWAN_WEST_PLAIN_SET : null) },
    { id: "east_plain", label: "東部平原", emoji: "🌿", itemIds: byFullSet(typeof TAIWAN_EAST_PLAIN_SET !== "undefined" ? TAIWAN_EAST_PLAIN_SET : null) },
    { id: "west_coast", label: "西部濱海", emoji: "🏖️", itemIds: byFullSet(typeof TAIWAN_WEST_COAST_SET !== "undefined" ? TAIWAN_WEST_COAST_SET : null) },
    { id: "east_coast", label: "東部濱海", emoji: "🌅", itemIds: byFullSet(typeof TAIWAN_EAST_COAST_SET !== "undefined" ? TAIWAN_EAST_COAST_SET : null) }
  ];
}

function matchTaiwanModernFeature(props) {
  if (!props || typeof ALL_TOWNS === "undefined") return null;
  const cRaw = props.COUNTYNAME || props.county || props.COUNTY || props.C_Name || "";
  const tRaw = props.TOWNNAME || props.town || props.TOWN || props.T_Name || props.name || "";
  const tCode = String(props.TOWNCODE || props.TOWNID || "");
  const cCode = String(props.COUNTYCODE || props.COUNTYID || "");

  const cNorm = typeof normTw === "function" ? normTw(cRaw) : String(cRaw).trim();
  const tNorm = typeof normTw === "function" ? normTw(tRaw) : String(tRaw).trim();

  if (cNorm && tNorm) {
    let found = ALL_TOWNS.find((t) => normTw(t.countyName) === cNorm && normTw(t.townName) === tNorm);
    if (found) return found;
    found = ALL_TOWNS.find((t) => normTw(t.countyName) === cNorm && t.townName.slice(0, -1) === tNorm.slice(0, -1));
    if (found) return found;
  }

  if (tCode && tNorm) {
    const found = ALL_TOWNS.find(
      (t) => (tCode.startsWith(t.countyCode) || cCode === t.countyCode) && normTw(t.townName) === tNorm
    );
    if (found) return found;
  }

  if (tNorm) {
    const matches = ALL_TOWNS.filter((t) => normTw(t.townName) === tNorm);
    if (matches.length === 1) return matches[0];
    if (cCode && matches.length > 1) {
      const byCode = matches.find((t) => t.countyCode === cCode || cCode.startsWith(t.countyCode));
      if (byCode) return byCode;
    }
  }
  return null;
}

if (typeof TAIWAN_ADMIN_DATA !== "undefined" && typeof ALL_TOWNS !== "undefined") {
  registerMapPack({
    id: DEFAULT_MAP_PACK_ID,
    _isFullPack: true,
    displayName: "現代臺灣（22縣市 / 368鄉鎮）",
    shortLabel: "🇹🇼 台灣",
    badgeText: "368區",
    dataNote: "收錄臺灣 22 縣市、368 鄉鎮市區，支援鐵道車站與機場/港口/水庫/湖泊/傳統聚落地標。",
    version: "1.0",
    hierarchyDepth: 2,
    unitLabels: {
      group: "縣市",
      item: "鄉鎮市區",
      itemShort: "區",
      fullScopeLabel: "全台 368 區"
    },
    mapView: {
      center: [23.75, 120.95],
      defaultZoom: 8,
      minZoom: 7,
      maxZoom: 18,
      maxBounds: [[20.2, 116.5], [27.4, 123.8]],
      fullViewBounds: [[21.82, 119.25], [25.38, 122.08]],
      pinDropScaleKm: 25,
      targetFocusZoom: 10,
      groupFocusZoom: 9,
      targetMaxZoom: 12,
      satelliteFallbackDelta: { group: 0.18, item: 0.06 },
      mainPolygonDistThresholdDeg: 0.35,
      groupMainDistThresholdDeg: 0.45,
      pureIslandGroups: ["澎湖縣", "金門縣", "連江縣"],
      offshoreExclusionSet: typeof TAIWAN_MAINLAND_OFFSHORE_SET !== "undefined" ? TAIWAN_MAINLAND_OFFSHORE_SET : null,
      worldCopyJump: false,
      quickJumps: [
        { id: "north", label: "北北基桃", center: [25.03, 121.48], zoom: 11 },
        { id: "kinmen", label: "金門 / 烏坵", center: [24.44, 118.37], zoom: 11 },
        { id: "matsu", label: "馬祖列島", center: [26.15, 119.95], zoom: 11 },
        { id: "penghu", label: "澎湖群島", center: [23.56, 119.58], zoom: 11 }
      ]
    },
    features: {
      supportsTransportQuiz: true,
      supportsPoiQuiz: true,
      supportsMasterHierarchy: true,
      supportsSuffixDifficulty: true,
      quickSuffixes: ["區", "鄉", "鎮", "市"],
      supportedDifficulties: ["casual", "county_only", "hard_suffix", "hard_full", "master_hierarchy"]
    },
    regionFilters: buildTaiwanModernRegionFilters(),
    normalizeInput(rawStr) {
      return typeof normTw === "function" ? normTw(rawStr) : defaultNormalizePackInput(rawStr);
    },
    async ensureLoaded() {
      return window.GEOMASTER_PACKS[DEFAULT_MAP_PACK_ID];
    },
    getGroups() {
      return TAIWAN_ADMIN_DATA;
    },
    getItems() {
      return ALL_TOWNS;
    },
    getGroupByName(name) {
      return typeof COUNTY_BY_NAME !== "undefined" ? COUNTY_BY_NAME[name] || null : null;
    },
    getGroupColor(groupName) {
      return typeof COUNTY_COLORS !== "undefined" && COUNTY_COLORS[groupName] ? COUNTY_COLORS[groupName] : "#38bdf8";
    },
    matchFeatureToItem(props) {
      return typeof matchFeatureToTownObj === "function" ? matchFeatureToTownObj(props) : matchTaiwanModernFeature(props);
    },
    async loadTopoData() {
      if (typeof getCachedPackTopoData === "function") {
        const cached = getCachedPackTopoData(DEFAULT_MAP_PACK_ID);
        if (cached) return cached;
      }
      if (typeof loadRealTaiwanTopoJSON === "function") {
        return await loadRealTaiwanTopoJSON({ skipRebuild: true });
      }
      return null;
    }
  });
}

// =========================================================================
// LAZY METADATA STUBS: TRACK-D (jp_pref, cn_prov) & TRACK-C (world_countries)
// Full pack files self-register over these stubs via registerMapPack({ _isFullPack: true })
// =========================================================================
const BUILT_IN_LAZY_MAP_PACK_STUBS = [
  {
    id: "jp_pref",
    _isLazyStub: true,
    scriptUrl: "data/packs/jp-pref-pack.js",
    displayName: "日本（47 都道府縣）",
    shortLabel: "🇯🇵 日本",
    badgeText: "47區",
    dataNote: "收錄日本全國 47 都道府縣（8 大地方），支援繁體中文、日文漢字、平假名與羅馬拼音作答。",
    version: "1.0",
    hierarchyDepth: 1,
    unitLabels: {
      group: "地方",
      item: "都道府縣",
      itemShort: "區",
      fullScopeLabel: "全日本 47 都道府縣"
    },
    mapView: {
      center: [36.2, 138.0],
      defaultZoom: 5,
      minZoom: 4,
      maxZoom: 18,
      maxBounds: [[20.0, 118.0], [49.0, 152.0]],
      fullViewBounds: [[24.2, 123.0], [45.6, 145.9]],
      pinDropScaleKm: 150,
      targetFocusZoom: 8,
      groupFocusZoom: 7,
      targetMaxZoom: 10,
      mainPolygonDistThresholdDeg: 0.6,
      worldCopyJump: false
    },
    features: {
      supportsTransportQuiz: false,
      supportsPoiQuiz: false,
      supportsMasterHierarchy: false,
      supportsSuffixDifficulty: true,
      quickSuffixes: ["都", "道", "府", "縣"],
      supportedDifficulties: ["casual", "hard_suffix"]
    }
  },
  {
    id: "cn_prov",
    _isLazyStub: true,
    scriptUrl: "data/packs/cn-prov-pack.js",
    displayName: "中國（33 省級行政區）",
    shortLabel: "🇨🇳 中國",
    badgeText: "33區",
    dataNote: "收錄 31 省市自治區 + 香港、澳門（共 33 區）",
    version: "1.0",
    hierarchyDepth: 1,
    unitLabels: {
      group: "大區",
      item: "省級行政區",
      itemShort: "區",
      fullScopeLabel: "全部 33 省級區"
    },
    mapView: {
      center: [35.5, 104.0],
      defaultZoom: 4,
      minZoom: 3,
      maxZoom: 18,
      maxBounds: [[10.0, 65.0], [58.0, 145.0]],
      fullViewBounds: [[18.0, 73.5], [53.6, 135.1]],
      pinDropScaleKm: 400,
      targetFocusZoom: 6,
      groupFocusZoom: 5,
      targetMaxZoom: 9,
      mainPolygonDistThresholdDeg: 1.5,
      worldCopyJump: false
    },
    features: {
      supportsTransportQuiz: false,
      supportsPoiQuiz: false,
      supportsMasterHierarchy: false,
      supportsSuffixDifficulty: true,
      quickSuffixes: ["省", "市", "自治區", "特別行政區"],
      supportedDifficulties: ["casual", "hard_suffix"]
    }
  },
  {
    id: "roc_1949",
    _isLazyStub: true,
    scriptUrl: "data/packs/roc-1949-pack.js",
    displayName: "中華民國1945（50 區）",
    shortLabel: "🇹🇼 中華民國1945",
    badgeText: "50區",
    attribution: "歷史公告疆域學習測驗用途 · 圖資改作自 Wikimedia Commons (Lilauid, CC BY-SA 4.0)",
    dataNote: "依歷史公告疆域收錄 35 省 + 1 特別行政區 + 2 地方 + 12 院轄市（共 50 區；遷臺後升格之臺北、高雄直轄市併於臺灣省）。圖資改作自 Wikimedia Commons（Lilauid, CC BY-SA 4.0），僅供歷史公告疆域學習測驗用途。",
    version: "1.0",
    hierarchyDepth: 1,
    unitLabels: {
      group: "地理大區",
      item: "省／市／地方／特區",
      itemShort: "區",
      fullScopeLabel: "中華民國1945 全境 50 區"
    },
    mapView: {
      center: [36.5, 104.0],
      defaultZoom: 4,
      minZoom: 3,
      maxZoom: 10,
      maxBounds: [[2.0, 65.0], [60.0, 145.0]],
      fullViewBounds: [[18.0, 71.0], [54.2, 135.5]],
      pinDropScaleKm: 150,
      targetFocusZoom: 6,
      groupFocusZoom: 5,
      targetMaxZoom: 9,
      mainPolygonDistThresholdDeg: 1.5,
      worldCopyJump: false
    },
    features: {
      supportsTransportQuiz: false,
      supportsPoiQuiz: false,
      supportsMasterHierarchy: false,
      supportsSuffixDifficulty: true,
      supportsHistoricalBasemap: true,
      quickSuffixes: ["省", "市", "地方", "特別行政區"],
      supportedDifficulties: ["casual", "hard_suffix"]
    }
  },
  {
    id: "world_countries",
    _isLazyStub: true,
    scriptUrl: "data/packs/world-countries-pack.js",
    displayName: "世界各國（196 國）",
    shortLabel: "🌍 世界",
    badgeText: "196國",
    dataNote: "193 UN 會員國 + 梵蒂岡 + 巴勒斯坦 + 台灣（共 196 國；不含南極洲，格陵蘭歸屬丹麥標註）",
    version: "1.0",
    hierarchyDepth: 1,
    unitLabels: {
      group: "大洲",
      item: "國家",
      itemShort: "國",
      fullScopeLabel: "全部 196 國"
    },
    mapView: {
      center: [20, 15],
      defaultZoom: 2,
      minZoom: 2,
      maxZoom: 18,
      maxBounds: [[-85, -195], [85, 195]],
      fullViewBounds: [[-55, -165], [72, 175]],
      pinDropScaleKm: 1500,
      targetFocusZoom: 5,
      groupFocusZoom: 4,
      targetMaxZoom: 8,
      mainPolygonDistThresholdDeg: 3.0,
      worldCopyJump: true
    },
    features: {
      supportsTransportQuiz: false,
      supportsPoiQuiz: false,
      supportsMasterHierarchy: false,
      supportsSuffixDifficulty: false,
      quickSuffixes: [],
      supportedDifficulties: ["casual"]
    }
  }
];

BUILT_IN_LAZY_MAP_PACK_STUBS.forEach((stub) => {
  const existing = window.GEOMASTER_PACKS[stub.id];
  if (!existing || !existing._isFullPack) {
    registerMapPack(stub);
  }
});

// =========================================================================
// LIFECYCLE: switchActiveMapPack(packId, options)
// =========================================================================
async function switchActiveMapPack(packId, options = {}) {
  const initialPack = getMapPackById(packId);
  if (!initialPack) {
    return { ok: false, reason: "pack_not_found", packId };
  }

  const seq = ++_mapPackSwitchSeq;
  const prevPack = getActiveMapPack();
  let switchFailed = false;

  _pendingMapPackId = packId;
  if (typeof setMapPackLoadingUI === "function") {
    setMapPackLoadingUI(packId, initialPack);
  }
  if (typeof renderMapPackSwitcherUI === "function") {
    renderMapPackSwitcherUI();
  }

  try {
    // 1. Lazy-load script / assets immediately while yielding 1 paint frame in browsers so the spinner renders before heavy work
    const loadPromise =
      typeof initialPack.ensureLoaded === "function"
        ? Promise.resolve(initialPack.ensureLoaded())
        : null;
    const needsPaintYield =
      !(options && options.skipPaintYield) &&
      typeof window !== "undefined" &&
      typeof requestAnimationFrame === "function";

    if (loadPromise && needsPaintYield) {
      await Promise.all([loadPromise, _yieldToBrowserPaint(options)]);
    } else if (loadPromise) {
      await loadPromise;
    } else if (needsPaintYield) {
      await _yieldToBrowserPaint(options);
    }
    if (seq !== _mapPackSwitchSeq) {
      return { ok: false, reason: "superseded", packId };
    }

  // Re-fetch in case ensureLoaded() registered the full pack over a stub
  const nextPack = getMapPackById(packId) || initialPack;

  // 2. Detach previous pack's Leaflet layers & item.layers references before swap
  if (typeof clearActiveMapLayers === "function") {
    clearActiveMapLayers(prevPack);
  }

  // 3. Switch active pack ID
  if (typeof state !== "undefined" && state) {
    state.activeMapPackId = nextPack.id;
  }

  // 4. Rebuild dynamic lookup tables in game-logic
  if (typeof rebuildActivePackLookupSets === "function") {
    rebuildActivePackLookupSets();
  }

  const groups = nextPack.getGroups() || [];
  const items = nextPack.getItems() || [];
  const eligibleItems = getPackEligibleItems(nextPack, typeof state !== "undefined" ? state : null);
  const features = nextPack.features || {};
  const mapView = nextPack.mapView || {};

  // 5. Apply feature gating & validate difficulty/quiz toggles on state
  if (typeof state !== "undefined" && state) {
    if (!features.supportsTransportQuiz) {
      state.stationQuizEnabled = false;
      if (state.quizStationLines && typeof state.quizStationLines.clear === "function") {
        state.quizStationLines.clear();
      }
      state.transportMode = "off";
      state.showRailOverlay = false;
      state.filterStationsByRegion = false;
    }
    if (!features.supportsPoiQuiz) {
      state.airportQuizEnabled = false;
      state.portQuizEnabled = false;
      state.reservoirQuizEnabled = false;
      state.lakeQuizEnabled = false;
      state.settlementQuizEnabled = false;
    }

    const hasAnyTopic =
      state.regionQuizEnabled ||
      (features.supportsTransportQuiz && state.stationQuizEnabled && state.quizStationLines && state.quizStationLines.size > 0) ||
      (features.supportsPoiQuiz &&
        (state.airportQuizEnabled ||
          state.portQuizEnabled ||
          state.reservoirQuizEnabled ||
          state.lakeQuizEnabled ||
          state.settlementQuizEnabled));
    if (!hasAnyTopic) {
      state.regionQuizEnabled = true;
    }

    if (typeof syncLegacyQuizTargetMode === "function") {
      syncLegacyQuizTargetMode();
    }

    const supportedDiffs =
      Array.isArray(features.supportedDifficulties) && features.supportedDifficulties.length > 0
        ? features.supportedDifficulties
        : ["casual"];
    if (!supportedDiffs.includes(state.difficulty)) {
      state.difficulty = supportedDiffs[0];
    }
    if (state.mapLayer === "historical" && !features.supportsHistoricalBasemap && typeof setMapLayer === "function") {
      setMapLayer("vector", true);
    }

    // 6. Re-initialize scope to the new pack's eligible groups & items (respects isItemEnabledByOptions)
    if (!options.skipScopeReset) {
      const eligibleGroupNames = new Set(eligibleItems.map((it) => it.countyName).filter(Boolean));
      state.selectedCounties = new Set(
        groups
          .filter((g) => eligibleGroupNames.size === 0 || eligibleGroupNames.has(g.name))
          .map((g) => g.name)
      );
      state.selectedTownIds = new Set(eligibleItems.map((it) => it.id));
    }

    // 7. Reset match progress unless explicitly skipped
    if (!options.skipReset) {
      if (typeof stopTimer === "function") stopTimer();
      state.unlockedTowns.clear();
      state.unlockedCounties.clear();
      state.unlockedProvinces.clear();
      state.missedTowns.clear();
      state.unlockedStations.clear();
      state.missedStations.clear();
      state.unlockedPois.clear();
      state.missedPois.clear();
      state.isGameOver = false;
      state.finished = false;
      state.promptedLastPlayer = false;
      state.finalStats = null;
      state.elapsedSec = 0;
      state.targetId = null;
      state.targetStationKey = null;
      state.targetPoiId = null;
      state.hintLevel = 0;
      state.satelliteOutlineRevealed = false;
      if (typeof clearSatelliteTargetMarker === "function") {
        clearSatelliteTargetMarker();
      }
      state.stats = {
        totalAttempts: 0,
        correctAttempts: 0,
        wrongAttempts: 0,
        streak: 0,
        maxStreak: 0
      };
      if (state.opponent) {
        state.opponent.total = eligibleItems.length;
        state.opponent.finished = false;
        state.opponent.finalStats = null;
      }
      if (typeof document !== "undefined") {
        document.getElementById("modal-settlement")?.classList.add("hidden");
        document.getElementById("modal-opponent-finished")?.classList.add("hidden");
        document.getElementById("modal-rematch-confirm")?.classList.add("hidden");
        document.getElementById("btn-reopen-settlement")?.classList.add("hidden");
        const timerEl = document.getElementById("timer-display");
        if (timerEl) {
          timerEl.textContent =
            state.timerMode === "down" && typeof formatTime === "function"
              ? formatTime(state.countdownTotalSec)
              : "00:00";
        }
      }
    }

    if (Array.isArray(mapView.center) && mapView.center.length >= 2) {
      state.lastTargetLat = mapView.center[0];
      state.lastTargetLng = mapView.center[1];
    }
  }

  // Clear prefix/suffix inputs cleanly on pack switch
  if (typeof document !== "undefined") {
    const pSel = document.getElementById("prefix-select");
    if (pSel) pSel.value = "";
    const sInp = document.getElementById("suffix-input");
    if (sInp) sInp.value = "";
  }

  // 8. Update Leaflet viewport bounds & zoom limits
  if (typeof applyMapPackViewport === "function") {
    applyMapPackViewport(nextPack, { fly: options.flyToFullView !== false });
  }

  // 9. Load / retrieve TopoJSON or GeoJSON data and rebuild map layers
  let topoData = nextPack.topoData || null;
  if (!topoData && typeof getCachedPackTopoData === "function") {
    topoData = getCachedPackTopoData(nextPack.id);
  }
  if (!topoData && typeof nextPack.loadTopoData === "function") {
    try {
      topoData = await nextPack.loadTopoData();
    } catch (_) {
      topoData = null;
    }
    if (seq !== _mapPackSwitchSeq) {
      return { ok: false, reason: "superseded", packId };
    }
  }
  if (typeof rebuildMapLayers === "function") {
    rebuildMapLayers(topoData);
  }

  // 10. Sync transport / POI map layers (auto-clears on non-TW packs, restores on tw_modern)
  if (typeof updateRoadAndRailwayTileOverlays === "function") {
    updateRoadAndRailwayTileOverlays();
  }
  if (typeof updateTransportVisualStyles === "function") {
    updateTransportVisualStyles();
  }
  if (typeof refreshPoiMapLayer === "function") {
    refreshPoiMapLayer();
  }

  // 11. Refresh all UI surfaces for the new pack
  if (typeof applyActivePackFeatureGatingUI === "function") {
    applyActivePackFeatureGatingUI();
  }
  if (typeof updatePrefixDropdownUI === "function") {
    updatePrefixDropdownUI();
  }
  if (typeof updateSuffixControlsUI === "function") {
    updateSuffixControlsUI();
  }
  if (typeof renderScopeModalGrid === "function") {
    renderScopeModalGrid();
  }
  if (typeof syncConfigButtonsUI === "function") {
    syncConfigButtonsUI();
  }
  if (typeof updateModeBadgeText === "function") {
    updateModeBadgeText();
  }
  if (typeof updateScoreAndProgressUI === "function") {
    updateScoreAndProgressUI();
  }
  if (typeof renderSmartLabelsAndLeaderLines === "function") {
    renderSmartLabelsAndLeaderLines();
  }
    if (seq === _mapPackSwitchSeq) {
      _pendingMapPackId = null;
      if (typeof setMapPackLoadingUI === "function") {
        setMapPackLoadingUI(null, null);
      }
    }
    if (typeof renderMapPackSwitcherUI === "function") {
      renderMapPackSwitcherUI();
    }

    // 12. Pick target or restart Pin-Drop if currently in an active guided/pin-drop mode
    if (!options.skipReset && typeof state !== "undefined" && state) {
      if (state.playMode === "pin_drop") {
        if (typeof clearPinDropLayers === "function") clearPinDropLayers();
        if (typeof startPinDropGame === "function") startPinDropGame();
      } else if (state.playMode === "target_random" || state.playMode === "satellite_quiz") {
        if (typeof pickNextTargetRegion === "function") {
          pickNextTargetRegion();
        }
      } else if (typeof updateTargetBannerUI === "function") {
        updateTargetBannerUI();
      }
    }

    return {
      ok: true,
      pack: nextPack,
      prevPackId: prevPack ? prevPack.id : null
    };
  } catch (err) {
    switchFailed = true;
    throw err;
  } finally {
    if (seq === _mapPackSwitchSeq && _pendingMapPackId !== null) {
      _pendingMapPackId = null;
      if (typeof setMapPackLoadingUI === "function") {
        setMapPackLoadingUI(null, null);
      }
      if (switchFailed && typeof renderMapPackSwitcherUI === "function") {
        renderMapPackSwitcherUI();
      }
    }
  }
}
