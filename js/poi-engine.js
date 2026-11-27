// ================================================================
// POI ENGINE — Airports, Ports, Reservoirs & Lakes Quiz & Markers
// ================================================================
// Strictly zero innerHTML, file:// compatible, MVC separated.

let poiLayerGroup = null;
const poiMarkersById = new Map();
const poiMarkerStatusById = new Map();
let activePoiListCache = [];

function normalizePoiText(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/台/g, "臺")
    .replace(/[（()）\[\]【】\-_.·・]/g, "");
}

function normalizeCapitalText(raw) {
  let s = String(raw || "").trim();
  if (!s) return "";
  try {
    s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  } catch (_) {}
  try {
    const pack = typeof getActiveMapPack === "function" ? getActiveMapPack() : null;
    if (pack && typeof pack.normalizeInput === "function") {
      s = pack.normalizeInput(s);
    }
  } catch (_) {}
  return normalizePoiText(s).replace(/['’‘,，]/g, "");
}

function getPoiById(poiId) {
  if (!poiId) return null;
  if (typeof TAIWAN_POI_BY_ID !== "undefined" && TAIWAN_POI_BY_ID.has(poiId)) {
    return TAIWAN_POI_BY_ID.get(poiId);
  }
  if (typeof CAPITAL_POI_BY_ID !== "undefined" && CAPITAL_POI_BY_ID.has(poiId)) {
    return CAPITAL_POI_BY_ID.get(poiId);
  }
  if (typeof LANDMARK_POI_BY_ID !== "undefined" && LANDMARK_POI_BY_ID.has(poiId)) {
    return LANDMARK_POI_BY_ID.get(poiId);
  }
  return null;
}

function getPoiCategoryIcon(category, poi = null) {
  if (category === "capital") {
    if (poi && Array.isArray(poi.subTypes)) {
      return poi.subTypes.includes("national_capital") ? "◎" : "●";
    }
    if (typeof getCapitalTopicIconForPack === "function" && typeof getActiveMapPack === "function") {
      return getCapitalTopicIconForPack(getActiveMapPack());
    }
    return "◎";
  }
  if (category === "landmark") {
    return "🏛️";
  }
  if (typeof POI_CATEGORY_META !== "undefined" && POI_CATEGORY_META[category]) {
    return POI_CATEGORY_META[category].icon;
  }
  return "📍";
}

function getPoiCategoryLabel(category) {
  if (category === "capital") {
    if (typeof getCapitalTopicLabelForPack === "function" && typeof getActiveMapPack === "function") {
      return getCapitalTopicLabelForPack(getActiveMapPack());
    }
    return "首都／省會";
  }
  if (category === "landmark") {
    if (typeof getLandmarkTopicLabelForPack === "function" && typeof getActiveMapPack === "function") {
      return getLandmarkTopicLabelForPack(getActiveMapPack());
    }
    return "著名地標";
  }
  if (typeof POI_CATEGORY_META !== "undefined" && POI_CATEGORY_META[category]) {
    return POI_CATEGORY_META[category].label;
  }
  return "地標";
}

function formatPoiLocationText(poi) {
  if (!poi) return "";
  if (poi.category === "capital" || poi.category === "landmark") {
    return poi.townName || poi.countyName || "";
  }
  return `${poi.countyName || ""}${poi.townName || ""}`;
}

function shouldFilterPoisByRegion() {
  return Boolean(
    state.filterStationsByRegion &&
    state.regionQuizEnabled &&
    state.selectedTownIds &&
    state.selectedTownIds.size > 0
  );
}

function isPoiInSelectedRegion(poi) {
  if (!poi) return false;
  if ((poi.category === "capital" || poi.category === "landmark") && poi.parentItemId) {
    if (state.selectedTownIds && state.selectedTownIds.has(poi.parentItemId)) return true;
    return false;
  }
  const townId = resolvePoiTownId(poi);
  if (townId && state.selectedTownIds && state.selectedTownIds.has(townId)) {
    return true;
  }
  if (state.selectedCounties && state.selectedCounties.has(poi.countyName)) {
    // Only fallback to county match if townId wasn't resolved
    return !townId;
  }
  return false;
}

function getEnabledSubTypesForCategory(category) {
  if (category === "airport") {
    return state.airportSubTypes && typeof state.airportSubTypes.has === "function" ? state.airportSubTypes : new Set();
  }
  if (category === "port") {
    return state.portSubTypes && typeof state.portSubTypes.has === "function" ? state.portSubTypes : new Set();
  }
  if (category === "reservoir") {
    return state.reservoirSubTypes && typeof state.reservoirSubTypes.has === "function" ? state.reservoirSubTypes : new Set();
  }
  if (category === "lake") {
    return state.lakeSubTypes && typeof state.lakeSubTypes.has === "function" ? state.lakeSubTypes : new Set();
  }
  if (category === "settlement") {
    return state.settlementSubTypes && typeof state.settlementSubTypes.has === "function" ? state.settlementSubTypes : new Set();
  }
  return new Set();
}

function isPoiCategoryActive(category) {
  if (category === "airport") {
    return Boolean(state.airportQuizEnabled && getEnabledSubTypesForCategory("airport").size > 0);
  }
  if (category === "port") {
    return Boolean(state.portQuizEnabled && getEnabledSubTypesForCategory("port").size > 0);
  }
  if (category === "reservoir") {
    return Boolean(state.reservoirQuizEnabled && getEnabledSubTypesForCategory("reservoir").size > 0);
  }
  if (category === "lake") {
    return Boolean(state.lakeQuizEnabled && getEnabledSubTypesForCategory("lake").size > 0);
  }
  if (category === "settlement") {
    return Boolean(state.settlementQuizEnabled && getEnabledSubTypesForCategory("settlement").size > 0);
  }
  if (category === "capital") {
    const feats = typeof getActivePackFeatures === "function" ? getActivePackFeatures() : null;
    if (feats && !feats.supportsCapitalQuiz) return false;
    return Boolean(state.capitalQuizEnabled);
  }
  if (category === "landmark") {
    const feats = typeof getActivePackFeatures === "function" ? getActivePackFeatures() : null;
    if (feats && !feats.supportsLandmarkQuiz) return false;
    return Boolean(state.landmarkQuizEnabled);
  }
  return false;
}

function hasAnyPoiQuizActive() {
  return (
    isPoiCategoryActive("airport") ||
    isPoiCategoryActive("port") ||
    isPoiCategoryActive("reservoir") ||
    isPoiCategoryActive("lake") ||
    isPoiCategoryActive("settlement") ||
    isPoiCategoryActive("capital") ||
    isPoiCategoryActive("landmark")
  );
}

function getPoiDisplayCategory(poi) {
  if (!poi) return "airport";
  const cats = typeof getPoiCategories === "function" ? getPoiCategories(poi) : [poi.category];
  if (cats.length <= 1) return poi.category;
  // Prefer the primary category if active; otherwise fall back to whichever matching category is active
  if (isPoiCategoryActive(poi.category)) {
    const subs = getEnabledSubTypesForCategory(poi.category);
    if (poi.subTypes.some((st) => subs.has(st))) return poi.category;
  }
  for (const c of cats) {
    if (isPoiCategoryActive(c)) {
      const subs = getEnabledSubTypesForCategory(c);
      if (poi.subTypes.some((st) => subs.has(st))) return c;
    }
  }
  return poi.category;
}

// Counts items matching a single subType (overlapping multi-tag items increment EACH subType by +1)
function countPoisBySubType(category, subTypeId, applyRegionFilter = false) {
  const useRegion = applyRegionFilter && shouldFilterPoisByRegion();
  let count = 0;
  for (const poi of TAIWAN_POI_DATA) {
    if (!poiMatchesCategory(poi, category)) continue;
    if (!poi.subTypes.includes(subTypeId)) continue;
    if (useRegion && !isPoiInSelectedRegion(poi)) continue;
    count++;
  }
  return count;
}

// Counts UNIQUE (deduplicated) items across a Set of subTypes (overlapping items add only +1 to total)
function countUniquePoisForSubTypes(category, subTypeSet, applyRegionFilter = false) {
  if (!subTypeSet || subTypeSet.size === 0) return 0;
  const useRegion = applyRegionFilter && shouldFilterPoisByRegion();
  const seen = new Set();
  for (const poi of TAIWAN_POI_DATA) {
    if (!poiMatchesCategory(poi, category)) continue;
    if (!poi.subTypes.some((st) => subTypeSet.has(st))) continue;
    if (useRegion && !isPoiInSelectedRegion(poi)) continue;
    seen.add(poi.id);
  }
  return seen.size;
}

function getActiveCapitalPois(applyRegionFilter = true) {
  if (typeof getCapitalPoisForPack !== "function") return [];
  const activePack = typeof getActiveMapPack === "function" ? getActiveMapPack() : null;
  if (!activePack) return [];
  const memberIds =
    Array.isArray(activePack.memberPackIds) && activePack.memberPackIds.length > 0
      ? activePack.memberPackIds
      : [activePack.id];
  const eligibleItems =
    typeof getPackEligibleItems === "function"
      ? getPackEligibleItems(activePack, typeof state !== "undefined" ? state : null)
      : (typeof activePack.getItems === "function" ? activePack.getItems() : []);
  const eligibleIdSet = new Set(eligibleItems.map((it) => it && it.id).filter(Boolean));
  const useRegion = applyRegionFilter && shouldFilterPoisByRegion();
  const out = [];
  const seen = new Set();
  for (let i = 0; i < memberIds.length; i++) {
    const list = getCapitalPoisForPack(memberIds[i]);
    for (let j = 0; j < list.length; j++) {
      const poi = list[j];
      if (!poi || seen.has(poi.id)) continue;
      if (eligibleIdSet.size > 0 && poi.parentItemId && !eligibleIdSet.has(poi.parentItemId)) continue;
      if (useRegion && !isPoiInSelectedRegion(poi)) continue;
      seen.add(poi.id);
      out.push(poi);
    }
  }
  return out;
}

function getActiveLandmarkPois(applyRegionFilter = true) {
  if (typeof getLandmarkPoisForPack !== "function") return [];
  const activePack = typeof getActiveMapPack === "function" ? getActiveMapPack() : null;
  if (!activePack) return [];
  const memberIds =
    Array.isArray(activePack.memberPackIds) && activePack.memberPackIds.length > 0
      ? activePack.memberPackIds
      : [activePack.id];
  const eligibleItems =
    typeof getPackEligibleItems === "function"
      ? getPackEligibleItems(activePack, typeof state !== "undefined" ? state : null)
      : (typeof activePack.getItems === "function" ? activePack.getItems() : []);
  const eligibleIdSet = new Set(eligibleItems.map((it) => it && it.id).filter(Boolean));
  const useRegion = applyRegionFilter && shouldFilterPoisByRegion();
  const out = [];
  const seen = new Set();
  for (let i = 0; i < memberIds.length; i++) {
    const list = getLandmarkPoisForPack(memberIds[i]);
    for (let j = 0; j < list.length; j++) {
      const poi = list[j];
      if (!poi || seen.has(poi.id)) continue;
      if (eligibleIdSet.size > 0 && poi.parentItemId && !eligibleIdSet.has(poi.parentItemId)) continue;
      if (useRegion && !isPoiInSelectedRegion(poi)) continue;
      seen.add(poi.id);
      out.push(poi);
    }
  }
  return out;
}

// Returns deduplicated array of active quiz POIs (optionally filtered to one category)
function getActiveQuizPois(categoryFilter = null) {
  const feats = typeof getActivePackFeatures === "function"
    ? getActivePackFeatures()
    : { supportsPoiQuiz: true, supportsCapitalQuiz: false, supportsLandmarkQuiz: false };
  if (!feats.supportsPoiQuiz && !feats.supportsCapitalQuiz && !feats.supportsLandmarkQuiz) {
    return [];
  }
  const result = [];
  const seen = new Set();
  const useRegion = shouldFilterPoisByRegion();

  if (feats.supportsPoiQuiz && (!categoryFilter || (categoryFilter !== "capital" && categoryFilter !== "landmark"))) {
    for (const poi of TAIWAN_POI_DATA) {
      const cats = typeof getPoiCategories === "function" ? getPoiCategories(poi) : [poi.category];
      if (categoryFilter && !cats.includes(categoryFilter)) continue;

      const targetCats = categoryFilter ? [categoryFilter] : cats;
      let matchedActive = false;
      for (const c of targetCats) {
        if (!isPoiCategoryActive(c)) continue;
        const enabledSubs = getEnabledSubTypesForCategory(c);
        if (poi.subTypes.some((st) => enabledSubs.has(st))) {
          matchedActive = true;
          break;
        }
      }
      if (!matchedActive) continue;
      if (useRegion && !isPoiInSelectedRegion(poi)) continue;
      if (seen.has(poi.id)) continue;
      seen.add(poi.id);
      result.push(poi);
    }
  }

  if (feats.supportsCapitalQuiz && isPoiCategoryActive("capital") && (!categoryFilter || categoryFilter === "capital")) {
    const capList = getActiveCapitalPois(true);
    for (let i = 0; i < capList.length; i++) {
      const poi = capList[i];
      if (seen.has(poi.id)) continue;
      seen.add(poi.id);
      result.push(poi);
    }
  }

  if (feats.supportsLandmarkQuiz && isPoiCategoryActive("landmark") && (!categoryFilter || categoryFilter === "landmark")) {
    const lmList = getActiveLandmarkPois(true);
    for (let i = 0; i < lmList.length; i++) {
      const poi = lmList[i];
      if (seen.has(poi.id)) continue;
      seen.add(poi.id);
      result.push(poi);
    }
  }
  return result;
}

const POI_SUFFIXED_ALIAS_RE = /(機場|基地|航空站|桃機|松機|港|碼頭|一接|二接|三接|接收站|水庫|壩|堰|湖|潭|池|埤|窟|森林|眼淚|公園|洞庫|營區|水沙連|埤尾|大水堀|池端)$/;
const EXACT_PORT_SHORT_NAMES = new Set(
  (typeof TAIWAN_POI_DATA !== "undefined" ? TAIWAN_POI_DATA : [])
    .filter((p) => (p.categories ? p.categories.includes("port") : p.category === "port"))
    .map((p) => normalizePoiText(p.shortName))
);
const EXACT_TOWN_BASE_NAMES = new Set(
  (typeof ALL_TOWNS !== "undefined" ? ALL_TOWNS : []).map((t) => normalizePoiText(t.baseName))
);

function buildPoiMatchKeys(poi, allowBareStem, requireSuffix = false) {
  const keys = new Set();
  if (poi && (poi.category === "capital" || poi.category === "landmark")) {
    const minLen = poi.allowSingleChar ? 1 : 2;
    const addCapKey = (s) => {
      const n = normalizeCapitalText(s);
      if (n && n.length >= minLen) keys.add(n);
    };
    addCapKey(poi.name);
    addCapKey(poi.shortName);
    if (Array.isArray(poi.aliases)) {
      poi.aliases.forEach((a) => addCapKey(a));
    }
    if (poi.category === "capital") {
      const normName = normalizeCapitalText(poi.name);
      if (normName.endsWith("市") || normName.endsWith("城")) {
        const stem = normName.slice(0, -1);
        if (stem.length >= minLen) keys.add(stem);
      } else if (Array.isArray(poi.subTypes) && (poi.subTypes.includes("prov_capital") || poi.subTypes.includes("pref_capital"))) {
        keys.add(`${normName}市`);
      }
    }
    return keys;
  }
  const addKey = (s) => {
    const n = normalizePoiText(s);
    if (n && n.length >= 2) keys.add(n);
  };
  addKey(poi.name);
  addKey(poi.shortName);
  if (poi.code) addKey(poi.code);
  const isSettlement = poiMatchesCategory(poi, "settlement");
  if (Array.isArray(poi.aliases)) {
    poi.aliases.forEach((a) => {
      if (!isSettlement && requireSuffix && !POI_SUFFIXED_ALIAS_RE.test(a) && !/^[A-Za-z]{3,4}$/.test(a)) {
        return;
      }
      addKey(a);
    });
  }

  // Settlement disambiguation prefixes: support County / Town prefixes (e.g. 楊梅富岡, 桃園富岡, 臺東富岡, 新竹南寮, 湖西南寮)
  if (isSettlement) {
    const baseLabels = new Set();
    [poi.name, poi.shortName, ...(Array.isArray(poi.aliases) ? poi.aliases : [])].forEach((s) => {
      const n = normalizePoiText(s);
      if (n && n.length >= 2) baseLabels.add(n);
    });
    const cFull = normalizePoiText(poi.countyName || "");
    const cShort = cFull.replace(/[縣市]$/, "");
    const tFull = normalizePoiText(poi.townName || "");
    const tBase = tFull.replace(/[鄉鎮市區]$/, "");
    const safeTBase = tBase.length >= 2 ? tBase : "";
    const prefixes = new Set([cFull, cShort, tFull, safeTBase, cFull + tFull, cShort + tFull, ...(safeTBase ? [cShort + safeTBase, cFull + safeTBase] : [])]);
    prefixes.delete("");
    for (const lbl of baseLabels) {
      for (const pre of prefixes) {
        if (!lbl.startsWith(pre)) {
          keys.add(pre + lbl);
        }
      }
    }
  }

  const normShort = normalizePoiText(poi.shortName);
  const stem = normShort
    .replace(/(國際機場|國內機場|空軍基地|陸軍航空基地|航空基地|航空站|機場|基地)$/g, "")
    .replace(/(液化天然氣接收港|液化天然氣接收站|工業專用港|國際商港|天然氣港|工業港|觀光漁港|漁港|商港|港)$/g, "");

  // Flexible suffixed matching so users don't get stuck on rigid sub-suffixes (e.g. 新竹機場 for 新竹基地, 正濱港 for 正濱漁港)
  if (stem && stem.length >= 2 && stem !== normShort) {
    if (poiMatchesCategory(poi, "airport")) {
      keys.add(`${stem}機場`);
    }
    if (poiMatchesCategory(poi, "port")) {
      const genericPort = stem.endsWith("港") ? stem : `${stem}港`;
      const collidesWithTownInCasual = !requireSuffix && state.regionQuizEnabled && EXACT_TOWN_BASE_NAMES.has(genericPort);
      if ((genericPort === normShort || !EXACT_PORT_SHORT_NAMES.has(genericPort)) && !collidesWithTownInCasual) {
        keys.add(genericPort);
      }
    }
  }

  // Allow bare stems (e.g., "桃園" -> 桃園機場, "石門" -> 石門水庫, "澄清" -> 澄清湖) ONLY in non-suffix difficulties and when region quiz is OFF
  if (allowBareStem && !requireSuffix) {
    if (poiMatchesCategory(poi, "reservoir")) {
      const resStem = normShort.replace(/(第二水庫|水庫|攔河堰|人工湖|大壩|壩)$/g, "");
      const collidesWithLake = resStem === "鯉魚潭" && isPoiCategoryActive("lake");
      if (resStem && resStem.length >= 2 && !collidesWithLake) {
        keys.add(resStem);
      }
    }
    if (poiMatchesCategory(poi, "lake") && normShort.endsWith("湖")) {
      const lakeStem = normShort.slice(0, -1);
      if (lakeStem.length >= 2) {
        keys.add(lakeStem);
      }
    }
    if (stem && stem.length >= 2 && stem !== normShort) {
      keys.add(stem);
    }
  }
  return keys;
}

function matchSinglePoi(poi, normInput, allowBareStem, requireSuffix = false, normCapInput = null) {
  const keys = buildPoiMatchKeys(poi, allowBareStem, requireSuffix);
  if (poi && (poi.category === "capital" || poi.category === "landmark")) {
    return keys.has(normCapInput !== null ? normCapInput : normalizeCapitalText(normInput));
  }
  return keys.has(normInput);
}

function isActiveCapitalInput(rawInput) {
  const hasCap = isPoiCategoryActive("capital");
  const hasLm = isPoiCategoryActive("landmark");
  if (!hasCap && !hasLm) return false;
  const normCap = normalizeCapitalText(rawInput);
  if (!normCap || normCap.length < 1) return false;
  if (hasCap) {
    const activeCaps = getActiveQuizPois("capital");
    for (let i = 0; i < activeCaps.length; i++) {
      if (normCap.length < 2 && !activeCaps[i].allowSingleChar) continue;
      if (matchSinglePoi(activeCaps[i], normCap, true, false, normCap)) return true;
    }
  }
  if (hasLm && normCap.length >= 2) {
    const activeLms = getActiveQuizPois("landmark");
    for (let i = 0; i < activeLms.length; i++) {
      if (matchSinglePoi(activeLms[i], normCap, true, false, normCap)) return true;
    }
  }
  return false;
}

// Attempt to match & unlock an active POI from user input.
// Returns { matched: boolean, alreadyUnlocked?: boolean, poi?: object, unlockedList?: array, wrongTarget?: boolean }
function tryMatchAndUnlockPoi(rawInput, isAutoCheck = false) {
  const activePois = getActiveQuizPois();
  if (activePois.length === 0) return { matched: false };

  const normInput = normalizePoiText(rawInput);
  const normCapInput = normalizeCapitalText(rawInput);
  const allowShortCap = normCapInput && normCapInput.length === 1 && isActiveCapitalInput(rawInput);
  if ((!normInput || normInput.length < 2) && (!normCapInput || normCapInput.length < 2) && !allowShortCap) {
    return { matched: false };
  }

  const requireSuffix = typeof isSuffixRequiredDifficulty === "function" ? isSuffixRequiredDifficulty() : false;
  const allowBareStem = !requireSuffix && !state.regionQuizEnabled;

  // Target mode: check ONLY the currently targeted POI first
  if ((state.playMode === "target_random" || state.playMode === "target_click" || state.playMode === "satellite_quiz") && state.targetPoiId) {
    const targetPoi = getPoiById(state.targetPoiId);
    if (targetPoi && activePois.some((p) => p.id === targetPoi.id)) {
      if (matchSinglePoi(targetPoi, normInput, !requireSuffix, requireSuffix, normCapInput)) {
        if (targetPoi.category !== "capital" && targetPoi.category !== "landmark" && typeof isPoiOrStationCountyUnlocked === "function" && !isPoiOrStationCountyUnlocked(targetPoi.countyName)) {
          return { matched: false, lockedCounty: true, poi: targetPoi };
        }
        if (state.unlockedPois.has(targetPoi.id)) {
          return { matched: true, alreadyUnlocked: true, poi: targetPoi };
        }
        state.unlockedPois.add(targetPoi.id);
        state.missedPois.delete(targetPoi.id);
        return { matched: true, alreadyUnlocked: false, poi: targetPoi, unlockedList: [targetPoi] };
      }
      return { matched: false, wrongTarget: true };
    }
  }

  // Free recall mode (or no POI target locked)
  const allMatched = activePois.filter((p) => matchSinglePoi(p, normInput, allowBareStem, requireSuffix, normCapInput));
  if (allMatched.length === 0) return { matched: false };
  const candidates = allMatched.filter((p) =>
    p.category === "capital" || p.category === "landmark"
      ? true
      : (typeof isPoiOrStationCountyUnlocked === "function" ? isPoiOrStationCountyUnlocked(p.countyName) : true)
  );
  if (candidates.length === 0) {
    return { matched: false, lockedCounty: true, poi: allMatched[0] };
  }

  // Duplicate settlement name disambiguation guard (e.g. 桃園楊梅「富岡」 vs 臺東市「富岡」)
  // Never mis-lock a unique settlement when >=2 active settlements share the exact same bare name.
  const stlCandidates = candidates.filter((p) => poiMatchesCategory(p, "settlement"));
  const nonStlCandidates = candidates.filter((p) => !poiMatchesCategory(p, "settlement"));
  let effectiveCandidates = candidates;
  if (stlCandidates.length >= 2) {
    if (nonStlCandidates.length === 0) {
      return {
        matched: false,
        ambiguousSettlement: true,
        ambiguousCandidates: stlCandidates
      };
    }
    effectiveCandidates = nonStlCandidates;
  }

  const unlockedNew = [];
  let alreadyCount = 0;
  for (const poi of effectiveCandidates) {
    if (state.unlockedPois.has(poi.id)) {
      alreadyCount++;
    } else {
      state.unlockedPois.add(poi.id);
      state.missedPois.delete(poi.id);
      unlockedNew.push(poi);
    }
  }

  if (unlockedNew.length > 0) {
    return { matched: true, alreadyUnlocked: false, poi: unlockedNew[0], unlockedList: unlockedNew };
  }
  if (alreadyCount > 0) {
    return { matched: true, alreadyUnlocked: true, poi: effectiveCandidates[0] };
  }
  return { matched: false };
}

function getPoiSubTypeLabelList(poi) {
  const cats = typeof getPoiCategories === "function" ? getPoiCategories(poi) : [poi.category];
  return poi.subTypes
    .map((st) => {
      for (const c of cats) {
        const meta = getPoiSubTypeMeta(c, st);
        if (meta) return meta.shortLabel;
      }
      return st;
    })
    .join(" / ");
}

function getPoiGlyphForCategory(cat) {
  if (cat === "airport") return "✈";
  if (cat === "port") return "⚓";
  if (cat === "reservoir") return "💧";
  if (cat === "lake") return "🏞";
  if (cat === "settlement") return "🪧";
  if (cat === "capital") return "◎";
  if (cat === "landmark") return "🏛";
  return "📍";
}

function createPoiPinElement(poi, status) {
  const displayCat = getPoiDisplayCategory(poi);
  const wrap = document.createElement("div");
  if (displayCat === "capital") {
    const isNational = Array.isArray(poi.subTypes) && poi.subTypes.includes("national_capital");
    const capSubClass = isNational ? "tw-poi-cap-national" : "tw-poi-cap-prov";
    wrap.className = `tw-poi-pin tw-poi-capital ${capSubClass} tw-poi-state-${status}`;
    const sym = document.createElement("span");
    sym.className = "tw-poi-cap-symbol";
    sym.setAttribute("aria-hidden", "true");
    wrap.appendChild(sym);
  } else {
    wrap.className = `tw-poi-pin tw-poi-${displayCat} tw-poi-state-${status}`;
    const glyph = document.createElement("span");
    glyph.className = "tw-poi-glyph";
    glyph.textContent = getPoiGlyphForCategory(displayCat);
    wrap.appendChild(glyph);
  }

  if (status === "unlocked" || status === "missed") {
    const lbl = document.createElement("span");
    lbl.className = "tw-poi-tag";
    lbl.textContent = poi.shortName;
    wrap.appendChild(lbl);
  }
  return wrap;
}

function initPoiMapEngine() {
  if (typeof map === "undefined" || !map || typeof L === "undefined") return;
  if (!map.getPane("poiMarkerPane")) {
    const p = map.createPane("poiMarkerPane");
    p.style.zIndex = "465";
  }
  if (typeof applyMapZoomVisualVars === "function") {
    applyMapZoomVisualVars(map.getZoom());
  }
  if (!poiLayerGroup) {
    poiLayerGroup = L.layerGroup().addTo(map);
  }
  refreshPoiMapLayer();
}

function getPoiViewportBounds() {
  if (typeof map === "undefined" || !map || typeof map.getBounds !== "function") return null;
  try {
    const b = map.getBounds();
    if (!b || (typeof b.isValid === "function" && !b.isValid())) return null;
    return typeof b.pad === "function" ? b.pad(0.25) : b;
  } catch (_) {
    return null;
  }
}

function isPoiInsideViewport(poi, bounds) {
  if (!bounds || typeof bounds.contains !== "function") return true;
  return bounds.contains([poi.lat, poi.lng]);
}

function resolvePoiMarkerStatus(poi, unlockedSet, missedSet, activeTargetId) {
  if (unlockedSet && unlockedSet.has(poi.id)) return "unlocked";
  if (missedSet && missedSet.has(poi.id)) return "missed";
  if (activeTargetId === poi.id && (state.playMode === "target_random" || state.playMode === "target_click" || state.playMode === "satellite_quiz")) {
    return "target";
  }
  return "locked";
}

function buildPoiLeafletMarker(poi, status) {
  const pinEl = createPoiPinElement(poi, status);
  const icon = L.divIcon({
    className: "tw-poi-icon-host",
    html: pinEl,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  const marker = L.marker([poi.lat, poi.lng], {
    pane: "poiMarkerPane",
    icon: icon,
    keyboard: false,
    riseOnHover: true
  });

  marker.on("click", (e) => {
    if (e && e.originalEvent) e.originalEvent.stopPropagation();
    handlePoiMarkerClick(poi);
  });
  return marker;
}

function syncPoiViewportMarkers(forceRebuild = false) {
  if (!poiLayerGroup || typeof L === "undefined") return;
  if (state.playMode === "pin_drop") {
    if (poiMarkersById.size > 0) {
      poiLayerGroup.clearLayers();
      poiMarkersById.clear();
      poiMarkerStatusById.clear();
    }
    return;
  }

  if (activePoiListCache.length === 0) {
    if (poiMarkersById.size > 0) {
      poiLayerGroup.clearLayers();
      poiMarkersById.clear();
      poiMarkerStatusById.clear();
    }
    return;
  }

  const viewState = typeof getActiveViewState === "function" ? getActiveViewState() : state;
  const hideGuessed = typeof isHideGuessedOthersActive === "function" && isHideGuessedOthersActive(viewState);
  const unlockedSet = hideGuessed ? new Set() : (viewState.unlockedPois || state.unlockedPois);
  const missedSet = hideGuessed ? new Set() : (viewState.missedPois || state.missedPois);
  const activeTargetId = viewState.targetPoiId !== undefined ? viewState.targetPoiId : state.targetPoiId;
  const viewportBounds = getPoiViewportBounds();
  const visibleIds = new Set();

  for (const poi of activePoiListCache) {
    const status = resolvePoiMarkerStatus(poi, unlockedSet, missedSet, activeTargetId);
    const inView = status === "target" || isPoiInsideViewport(poi, viewportBounds);
    if (!inView) continue;

    visibleIds.add(poi.id);
    const existing = poiMarkersById.get(poi.id);
    const prevStatus = poiMarkerStatusById.get(poi.id);
    const statusKey = `${getPoiDisplayCategory(poi)}:${status}`;

    if (existing && !forceRebuild && prevStatus === statusKey) {
      continue;
    }
    if (existing) {
      poiLayerGroup.removeLayer(existing);
    }

    const marker = buildPoiLeafletMarker(poi, status);
    marker.addTo(poiLayerGroup);
    poiMarkersById.set(poi.id, marker);
    poiMarkerStatusById.set(poi.id, statusKey);
  }

  for (const [id, marker] of poiMarkersById.entries()) {
    if (!visibleIds.has(id)) {
      poiLayerGroup.removeLayer(marker);
      poiMarkersById.delete(id);
      poiMarkerStatusById.delete(id);
    }
  }
}

function refreshPoiMapLayer() {
  if (!poiLayerGroup || typeof L === "undefined") return;
  activePoiListCache = getActiveQuizPois();
  syncPoiViewportMarkers(false);
}

function handlePoiMarkerClick(poi) {
  if (!poi) return;
  const viewState = typeof getActiveViewState === "function" ? getActiveViewState() : state;
  const unlockedSet = viewState.unlockedPois || state.unlockedPois;
  const displayCat = getPoiDisplayCategory(poi);
  const catMeta = POI_CATEGORY_META[displayCat] || { icon: "📍", label: "地標" };
  const catIcon = getPoiCategoryIcon(displayCat, poi);
  const catLabel = getPoiCategoryLabel(displayCat);
  const locText = formatPoiLocationText(poi);

  if (state.role === "spectator" || state.isGameOver) {
    const isLimitedRound = typeof isLimitedQuestionRoundActive === "function" && isLimitedQuestionRoundActive();
    const missedSet = viewState.missedPois || state.missedPois;
    const canRevealName =
      !isLimitedRound ||
      state.role === "spectator" ||
      (unlockedSet && unlockedSet.has(poi.id)) ||
      (missedSet && missedSet.has(poi.id));
    if (typeof setFeedback === "function") {
      if (canRevealName) {
        const subTxt = poi.category === "capital" ? catLabel : getPoiSubTypeLabelList(poi);
        setFeedback(`${catIcon} ${poi.name}（${locText} · ${subTxt}）`, "info");
      } else {
        setFeedback("🔒 此地標不在本輪已作答題目中", "info");
      }
    }
    return;
  }

  if (state.playMode === "target_click") {
    if (unlockedSet && unlockedSet.has(poi.id)) {
      if (typeof setFeedback === "function") {
        setFeedback(`✅ 已解鎖：${poi.name}（${getPoiSubTypeLabelList(poi)}）`, "success");
      }
      return;
    }
    state.targetId = null;
    state.targetStationKey = null;
    state.targetPoiId = poi.id;
    state.hintLevel = 0;
    state.lastTargetLat = poi.lat;
    state.lastTargetLng = poi.lng;
    if (typeof refreshAllPolygonStyles === "function") refreshAllPolygonStyles();
    if (typeof updateTransportVisualStyles === "function") updateTransportVisualStyles();
    refreshPoiMapLayer();
    if (typeof updateTargetBannerUI === "function") updateTargetBannerUI();
    if (typeof focusMapOnLatLng === "function") {
      const pack = typeof getActiveMapPack === "function" ? getActiveMapPack() : null;
      const focusZoom = poi.category === "capital" && pack && pack.mapView && Number.isFinite(pack.mapView.targetFocusZoom) ? pack.mapView.targetFocusZoom : 10;
      focusMapOnLatLng(poi.lat, poi.lng, focusZoom);
    }
    const inp = document.getElementById("guess-input");
    if (inp) inp.focus();
    return;
  }

  // Free recall or target_random: show non-spoiler info
  if (typeof setFeedback === "function") {
    if (unlockedSet && unlockedSet.has(poi.id)) {
      const hideLoc = poi.category !== "capital" && typeof shouldHidePoiAdminLocationHint === "function" && shouldHidePoiAdminLocationHint();
      const locPrefix = hideLoc ? "" : `${locText} · `;
      const subTxt = poi.category === "capital" ? catLabel : getPoiSubTypeLabelList(poi);
      setFeedback(`${catIcon} ${poi.name}（${locPrefix}${subTxt}）`, "info");
    } else {
      const subTxt = poi.category === "capital" ? catLabel : getPoiSubTypeLabelList(poi);
      setFeedback(`${catIcon} 尚未解鎖的${catLabel}（分類：${subTxt}）`, "info");
    }
  }
}

function getConcisePoiSummaryParts() {
  const parts = [];
  if (isPoiCategoryActive("airport")) {
    const labels = AIRPORT_SUBTYPES.filter((s) => state.airportSubTypes.has(s.id)).map((s) => s.shortLabel);
    const cnt = getActiveQuizPois("airport").length;
    parts.push(`✈️ 機場(${labels.join("/")} ${cnt}座)`);
  }
  if (isPoiCategoryActive("port")) {
    const labels = PORT_SUBTYPES.filter((s) => state.portSubTypes.has(s.id)).map((s) => s.shortLabel);
    const cnt = getActiveQuizPois("port").length;
    parts.push(`⚓ 港口(${labels.join("/")} ${cnt}座)`);
  }
  if (isPoiCategoryActive("reservoir")) {
    const labels = RESERVOIR_SUBTYPES.filter((s) => state.reservoirSubTypes.has(s.id)).map((s) => s.shortLabel);
    const cnt = getActiveQuizPois("reservoir").length;
    parts.push(`💧 水庫(${labels.join("/")} ${cnt}座)`);
  }
  if (isPoiCategoryActive("lake")) {
    const labels = LAKE_SUBTYPES.filter((s) => state.lakeSubTypes.has(s.id)).map((s) => s.shortLabel);
    const cnt = getActiveQuizPois("lake").length;
    parts.push(`🏞️ 湖泊(${labels.join("/")} ${cnt}座)`);
  }
  if (isPoiCategoryActive("settlement")) {
    const labels = SETTLEMENT_SUBTYPES.filter((s) => state.settlementSubTypes.has(s.id)).map((s) => s.shortLabel);
    const cnt = getActiveQuizPois("settlement").length;
    parts.push(`🪧 傳統聚落(${labels.join("/")} ${cnt}處)`);
  }
  if (isPoiCategoryActive("capital")) {
    const cnt = getActiveQuizPois("capital").length;
    const capIcon = getPoiCategoryIcon("capital");
    const capLbl = getPoiCategoryLabel("capital");
    parts.push(`${capIcon} ${capLbl}(${cnt}處)`);
  }
  if (isPoiCategoryActive("landmark")) {
    const cnt = getActiveQuizPois("landmark").length;
    const lmIcon = getPoiCategoryIcon("landmark");
    const lmLbl = getPoiCategoryLabel("landmark");
    parts.push(`${lmIcon} ${lmLbl}(${cnt}處)`);
  }
  return parts;
}
