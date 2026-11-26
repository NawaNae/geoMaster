// =========================================================================
// TDD TEST SUITE: Multi-Pack East Asia Combinations
// (台日中 tw_modern+jp_pref+cn_prov & 台日中華民國 tw_modern+jp_pref+roc_1949)
// Mutual exclusion: World exclusive; ROC 1945 <-> China exclusive.
// Run: node tests/test_multipack_combo.js
// =========================================================================
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");

let passed = 0;
let failed = 0;
const failures = [];

function check(cond, name, msg) {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(`[FAIL] ${name}: ${msg}`);
    console.error(`  ✗ ${name}: ${msg}`);
  }
}

class MockClassList {
  constructor(initial = []) {
    this._set = new Set(initial);
  }
  add(...cls) { cls.forEach((c) => c && this._set.add(c)); }
  remove(...cls) { cls.forEach((c) => this._set.delete(c)); }
  toggle(c, force) {
    if (force === undefined) {
      if (this._set.has(c)) { this._set.delete(c); return false; }
      this._set.add(c); return true;
    }
    if (force) this._set.add(c); else this._set.delete(c);
    return Boolean(force);
  }
  contains(c) { return this._set.has(c); }
}

class MockElement {
  constructor(tag = "div", id = "", classes = []) {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.classList = new MockClassList(classes);
    this.attributes = {};
    this.children = [];
    this.style = {};
    this.textContent = "";
    this.value = "";
    this.checked = false;
    this.disabled = false;
    this.listeners = {};
    this.className = classes.join(" ");
  }
  set className(v) {
    this._className = String(v || "");
    this.classList = new MockClassList(this._className.split(/\s+/).filter(Boolean));
  }
  get className() { return this._className || ""; }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] !== undefined ? this.attributes[k] : null; }
  removeAttribute(k) { delete this.attributes[k]; }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  addEventListener(ev, fn) {
    if (!this.listeners[ev]) this.listeners[ev] = [];
    this.listeners[ev].push(fn);
  }
  click() {
    (this.listeners.click || []).forEach((fn) => fn({ stopPropagation() {}, preventDefault() {} }));
  }
  querySelector(sel) {
    const all = this.querySelectorAll(sel);
    return all[0] || null;
  }
  querySelectorAll(sel) {
    const results = [];
    const matches = (el) => {
      if (sel.startsWith(".")) {
        const cls = sel.slice(1).split("[")[0];
        if (!el.classList.contains(cls)) return false;
      }
      const attrMatch = sel.match(/\[([^\]=]+)(?:="([^"]*)")?\]/);
      if (attrMatch) {
        const val = el.getAttribute(attrMatch[1]);
        if (val === null) return false;
        if (attrMatch[2] !== undefined && val !== attrMatch[2]) return false;
      }
      return true;
    };
    const walk = (node) => {
      for (const ch of node.children || []) {
        if (matches(ch)) results.push(ch);
        walk(ch);
      }
    };
    walk(this);
    return results;
  }
}

function buildSandbox() {
  const elements = {};
  const getEl = (id) => {
    if (!elements[id]) elements[id] = new MockElement("div", id);
    return elements[id];
  };
  [
    "mappack-selector-section",
    "mappack-selector-grid",
    "mappack-loading-status",
    "mappack-loading-text",
    "mappack-combo-twjpcn",
    "mappack-combo-twjproc",
    "unified-settings-panel",
    "map-loading-overlay",
    "map-loading-text",
    "pack-options-bar",
    "pack-opt-world-micro-wrap",
    "pack-opt-cn-singlechar-wrap",
    "pack-opt-roc-mongolia-wrap",
    "pack-opt-roc-municipalities-wrap",
    "pack-opt-roc-disputed-wrap",
    "btn-layer-historical",
    "chk-pack-world-microstates",
    "lbl-pack-world-microstates",
    "chk-pack-cn-singlechar",
    "chk-pack-roc-mongolia",
    "lbl-pack-roc-mongolia",
    "chk-pack-roc-municipalities",
    "lbl-pack-roc-municipalities",
    "chk-pack-roc-disputed",
    "scope-drawer-summary-text",
    "settings-help-pack-note",
    "difficulty-selector-card",
    "difficulty-buttons-grid",
    "simple-region-tw-grid",
    "simple-region-dynamic-grid",
    "advanced-region-tw-presets",
    "advanced-region-dynamic-presets",
    "suffix-quick-group",
    "prefix-select",
    "suffix-input",
    "answer-input",
    "live-preview-combined",
    "timer-display",
    "geo-data-badge",
    "room-concise-settings-list"
  ].forEach(getEl);

  const mockLayers = [];
  const makeLayerGroup = () => ({
    _layers: [],
    clearLayers() { this._layers = []; },
    addLayer(l) { this._layers.push(l); },
    addTo() { return this; }
  });

  const makeLatLngBounds = (a, b) => {
    let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity;
    const ext = (pt) => {
      if (!pt) return;
      if (Array.isArray(pt) && Array.isArray(pt[0])) {
        pt.forEach(ext);
      } else if (Array.isArray(pt) && pt.length >= 2) {
        minLat = Math.min(minLat, Number(pt[0]));
        minLng = Math.min(minLng, Number(pt[1]));
        maxLat = Math.max(maxLat, Number(pt[0]));
        maxLng = Math.max(maxLng, Number(pt[1]));
      } else if (typeof pt.getSouthWest === "function") {
        ext(pt.getSouthWest());
        ext(pt.getNorthEast());
      } else if (typeof pt.lat === "number") {
        minLat = Math.min(minLat, pt.lat);
        minLng = Math.min(minLng, pt.lng);
        maxLat = Math.max(maxLat, pt.lat);
        maxLng = Math.max(maxLng, pt.lng);
      }
    };
    if (a) ext(a);
    if (b) ext(b);
    return {
      isValid() { return Number.isFinite(minLat) && Number.isFinite(maxLat); },
      extend(x) { ext(x); return this; },
      getSouthWest() { return { lat: minLat, lng: minLng }; },
      getNorthEast() { return { lat: maxLat, lng: maxLng }; },
      getNorthWest() { return { lat: maxLat, lng: minLng }; },
      getSouthEast() { return { lat: minLat, lng: maxLng }; },
      getCenter() { return { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 }; },
      contains(pt) {
        const lat = Array.isArray(pt) ? pt[0] : pt.lat;
        const lng = Array.isArray(pt) ? pt[1] : pt.lng;
        return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
      }
    };
  };

  const L = {
    latLngBounds: makeLatLngBounds,
    canvas: () => ({}),
    layerGroup: makeLayerGroup,
    geoJSON(feat) {
      const bounds = makeLatLngBounds();
      const walkCoords = (c) => {
        if (!Array.isArray(c)) return;
        if (typeof c[0] === "number" && typeof c[1] === "number") {
          bounds.extend([c[1], c[0]]);
        } else {
          c.forEach(walkCoords);
        }
      };
      if (feat && feat.type === "FeatureCollection") {
        (feat.features || []).forEach((f) => f && f.geometry && walkCoords(f.geometry.coordinates));
      } else if (feat && feat.geometry) {
        walkCoords(feat.geometry.coordinates);
      }
      const layer = {
        _feat: feat,
        eachLayer(fn) { fn({ on() {}, setStyle() {} }); },
        addTo(grp) { if (grp && grp.addLayer) grp.addLayer(this); mockLayers.push(this); return this; },
        getBounds() { return bounds; },
        setStyle() {}
      };
      return layer;
    },
    circleMarker(ll) {
      return {
        _ll: ll,
        on() {},
        setStyle() {},
        setRadius() {},
        addTo(grp) { if (grp && grp.addLayer) grp.addLayer(this); return this; }
      };
    }
  };

  const sandbox = {
    window: { GEOMASTER_PACKS: {}, location: { search: "", origin: "file://", pathname: "/index.html" } },
    document: {
      readyState: "loading",
      addEventListener() {},
      getElementById: (id) => elements[id] || null,
      createElement: (tag) => new MockElement(tag),
      querySelectorAll: () => [],
      querySelector: () => null,
      head: { appendChild() {} },
      body: { classList: new MockClassList() }
    },
    navigator: { userAgent: "node-test", language: "zh-TW" },
    screen: { width: 1440, height: 900, colorDepth: 24 },
    localStorage: { getItem: () => null, setItem() {} },
    sessionStorage: { getItem: () => null, setItem() {} },
    L,
    console,
    setTimeout,
    clearTimeout,
    setInterval: () => 1,
    clearInterval: () => {},
    Math, Date, JSON, Set, Map, Array, Object, String, Number, Boolean, RegExp, Promise, Error,
    elements,
    mockLayers,
    feedbackLog: [],
    setFeedback(text, type) { sandbox.feedbackLog.push({ text, type }); },
    playTone() {},
    startTimer() {},
    stopTimer() {},
    updateScoreAndProgressUI() {},
    renderSmartLabelsAndLeaderLines() {},
    updateModeBadgeText() {},
    syncConfigButtonsUI() {},
    updatePrefixDropdownUI() {},
    updateSuffixControlsUI() {},
    updateTargetBannerUI() {},
    updateRoadAndRailwayTileOverlays() {},
    updateTransportVisualStyles() {},
    refreshPoiMapLayer() {},
    setMapLayer() {},
    renderScopeModalGrid() {},
    checkVictoryCondition() {},
    broadcastProgress() {},
    resetGame() {},
    formatTime: (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.window.addEventListener = () => {};
  vm.createContext(sandbox);

  const loadScript = (relPath) => {
    const code = fs.readFileSync(path.join(ROOT, relPath), "utf8");
    vm.runInContext(code, sandbox, { filename: relPath });
  };

  loadScript("data/admin-data.js");
  loadScript("data/transport-data.js");
  loadScript("data/poi-data.js");
  loadScript("js/map-pack-registry.js");
  loadScript("data/packs/jp-pref-pack.js");
  loadScript("data/packs/cn-prov-pack.js");
  loadScript("data/packs/roc-1949-pack.js");
  loadScript("data/packs/world-countries-pack.js");
  loadScript("js/state.js");
  loadScript("js/map-engine.js");
  loadScript("js/game-logic.js");
  loadScript("js/pindrop-engine.js");
  loadScript("js/ui-controls.js");
  loadScript("js/p2p-engine.js");

  // Seed mock tw_modern TopoJSON (368 synthetic tiny square features matching ALL_TOWNS) + initialize map globals
  vm.runInContext(`
    globalThis.state = state;
    map = {
      options: {},
      setMinZoom(z) { this._minZoom = z; },
      setMaxZoom(z) { this._maxZoom = z; },
      setMaxBounds(b) { this._maxBounds = b; },
      flyToBounds(b) { this._lastFlyBounds = b; },
      fitBounds(b) { this._lastFlyBounds = b; },
      setView(c, z) { this._center = c; this._zoom = z; },
      flyTo(c, z) { this._center = c; this._zoom = z; },
      getZoom() { return this._zoom || 8; },
      getCenter() { return { lat: 23.75, lng: 120.95 }; },
      hasLayer() { return false; },
      removeLayer() {},
      attributionControl: {
        _list: [],
        addAttribution(t) { this._list.push(t); },
        removeAttribution(t) { this._list = this._list.filter((x) => x !== t); }
      }
    };
    canvasRenderer = L.canvas();
    geoLayerGroup = L.layerGroup();
    countyBorderLayerGroup = L.layerGroup();
    microstateLayerGroup = L.layerGroup();
    disputedBorderLayerGroup = L.layerGroup();

    const twFeatures = ALL_TOWNS.map((t) => ({
      type: "Feature",
      properties: { COUNTYNAME: t.countyName, TOWNNAME: t.townName, TOWNCODE: t.countyCode + "001" },
      geometry: {
        type: "Polygon",
        coordinates: [[[t.lng - 0.02, t.lat - 0.02], [t.lng + 0.02, t.lat - 0.02], [t.lng + 0.02, t.lat + 0.02], [t.lng - 0.02, t.lat + 0.02], [t.lng - 0.02, t.lat - 0.02]]]
      }
    }));
    setCachedPackTopoData("tw_modern", {
      townsGeo: { type: "FeatureCollection", features: twFeatures },
      countiesGeo: null
    });
  `, sandbox);

  return sandbox;
}

async function runTests() {
  console.log("=== Running Multi-Pack East Asia Combination TDD Suite ===");
  const sb = buildSandbox();

  // -----------------------------------------------------------------------
  // 1. PURE RULES: Mutual Exclusion, Canonical Ordering, Toggle Semantics
  // -----------------------------------------------------------------------
  check(
    typeof sb.parseMapPackIds === "function" &&
      typeof sb.resolveToggleMapPackIds === "function" &&
      typeof sb.formatCompositeMapPackId === "function" &&
      typeof sb.getActiveMapPackIds === "function" &&
      typeof sb.hasActiveMapPack === "function",
    "1.Exports",
    "Multi-pack helper functions must be exported on global scope"
  );

  if (typeof sb.resolveToggleMapPackIds === "function") {
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

    // TW + JP
    const twJp = sb.resolveToggleMapPackIds(["tw_modern"], "jp_pref");
    check(eq(twJp, ["tw_modern", "jp_pref"]), "1.Toggle.TwPlusJp", `Got ${JSON.stringify(twJp)}`);

    // TW + JP + CN (台日中)
    const twJpCn = sb.resolveToggleMapPackIds(twJp, "cn_prov");
    check(eq(twJpCn, ["tw_modern", "jp_pref", "cn_prov"]), "1.Toggle.TwJpCn", `Got ${JSON.stringify(twJpCn)}`);

    // Adding ROC while CN is active -> auto-removes CN (中華民國與中國互斥!)
    const twJpRoc = sb.resolveToggleMapPackIds(twJpCn, "roc_1949");
    check(eq(twJpRoc, ["tw_modern", "jp_pref", "roc_1949"]), "1.Mutex.RocReplacesCn", `Got ${JSON.stringify(twJpRoc)}`);

    // Adding CN while ROC is active -> auto-removes ROC
    const backToCn = sb.resolveToggleMapPackIds(twJpRoc, "cn_prov");
    check(eq(backToCn, ["tw_modern", "jp_pref", "cn_prov"]), "1.Mutex.CnReplacesRoc", `Got ${JSON.stringify(backToCn)}`);

    // Toggling World -> exclusive solo (跟世界互斥!)
    const toWorld = sb.resolveToggleMapPackIds(twJpCn, "world_countries");
    check(eq(toWorld, ["world_countries"]), "1.Mutex.WorldExclusive", `Got ${JSON.stringify(toWorld)}`);

    // Toggling TW while on World -> replaces World with TW
    const worldToTw = sb.resolveToggleMapPackIds(["world_countries"], "tw_modern");
    check(eq(worldToTw, ["tw_modern"]), "1.Mutex.CombinableClearsWorld", `Got ${JSON.stringify(worldToTw)}`);

    // Cannot uncheck last active pack
    const keepLast = sb.resolveToggleMapPackIds(["tw_modern"], "tw_modern");
    check(eq(keepLast, ["tw_modern"]), "1.Toggle.CannotUncheckLast", `Got ${JSON.stringify(keepLast)}`);

    // Unchecking one from combo removes only that pack
    const removeJp = sb.resolveToggleMapPackIds(["tw_modern", "jp_pref", "cn_prov"], "jp_pref");
    check(eq(removeJp, ["tw_modern", "cn_prov"]), "1.Toggle.RemoveMiddle", `Got ${JSON.stringify(removeJp)}`);

    // Canonical order regardless of input order
    const canonical = sb.parseMapPackIds(["cn_prov", "jp_pref", "tw_modern"]);
    check(eq(canonical, ["tw_modern", "jp_pref", "cn_prov"]), "1.Parse.CanonicalOrder", `Got ${JSON.stringify(canonical)}`);

    // Conflicting parse strings resolve safely
    const conflictCnRoc = sb.parseMapPackIds("cn_prov+roc_1949");
    check(
      !(conflictCnRoc.includes("cn_prov") && conflictCnRoc.includes("roc_1949")) && conflictCnRoc.length === 1,
      "1.Parse.CnRocConflict",
      `Got ${JSON.stringify(conflictCnRoc)}`
    );
    const conflictWorld = sb.parseMapPackIds("tw_modern+world_countries");
    check(
      !(conflictWorld.includes("tw_modern") && conflictWorld.includes("world_countries")),
      "1.Parse.WorldConflict",
      `Got ${JSON.stringify(conflictWorld)}`
    );
  }

  // -----------------------------------------------------------------------
  // 2. COMPOSITE PACK: 台日中 (tw_modern+jp_pref+cn_prov)
  // -----------------------------------------------------------------------
  const origJpTohoku = sb.getMapPackById("jp_pref").getGroups().find((g) => g.name === "東北");
  const origCnTohoku = sb.getMapPackById("cn_prov").getGroups().find((g) => g.name === "東北");

  const resCnCombo = await sb.switchActiveMapPack("tw_modern+jp_pref+cn_prov", { skipPaintYield: true });
  check(Boolean(resCnCombo && resCnCombo.ok), "2.TwJpCn.SwitchOk", `Expected ok=true, got ${JSON.stringify(resCnCombo)}`);
  check(sb.state.activeMapPackId === "tw_modern+jp_pref+cn_prov", "2.TwJpCn.ActiveId", `Got ${sb.state.activeMapPackId}`);
  check(
    Array.isArray(sb.state.activeMapPackIds) && sb.state.activeMapPackIds.join("+") === "tw_modern+jp_pref+cn_prov",
    "2.TwJpCn.ActiveIds",
    `Got ${JSON.stringify(sb.state.activeMapPackIds)}`
  );

  const cnComboPack = sb.getActiveMapPack();
  const cnComboItems = sb.getActiveItems();
  const cnComboGroups = sb.getActiveGroups();
  check(cnComboItems.length === 368 + 47 + 33, "2.TwJpCn.ItemCount", `Expected 448, got ${cnComboItems.length}`);
  check(new Set(cnComboItems.map((i) => i.id)).size === 448, "2.TwJpCn.UniqueIds", "All 448 item IDs must be unique");
  check(cnComboGroups.length === 22 + 8 + 7, "2.TwJpCn.GroupCount", `Expected 37, got ${cnComboGroups.length}`);
  check(new Set(cnComboGroups.map((g) => g.name)).size === 37, "2.TwJpCn.UniqueGroupNames", "All 37 group names must be unique (東北 disambiguated)");

  // Source packs MUST NOT be mutated
  check(origJpTohoku.name === "東北" && origCnTohoku.name === "東北", "2.TwJpCn.NoSourceMutation", "Original pack group names must remain untouched");

  // Features & MapView
  const cnFeats = sb.getActivePackFeatures();
  const cnView = sb.getActivePackMapView();
  check(cnFeats.supportsTransportQuiz === true, "2.TwJpCn.SupportsTransport", "TW present -> transport quiz supported");
  check(cnFeats.supportsPoiQuiz === true, "2.TwJpCn.SupportsPoi", "TW present -> POI quiz supported");
  check(cnFeats.supportsHistoricalBasemap !== true, "2.TwJpCn.NoHistoricalBasemap", "No ROC -> no historical basemap");
  check(
    JSON.stringify(cnFeats.supportedDifficulties) === JSON.stringify(["casual", "hard_suffix"]),
    "2.TwJpCn.Difficulties",
    `Got ${JSON.stringify(cnFeats.supportedDifficulties)}`
  );
  check(cnView.minZoom === 3 && cnView.maxZoom === 18, "2.TwJpCn.ZoomRange", `min=${cnView.minZoom}, max=${cnView.maxZoom}`);
  check(cnView.worldCopyJump === false, "2.TwJpCn.NoWorldWrap", "East Asia combo must not enable worldCopyJump");

  // Geometry loaded for all 448 items and Taiwan drawn on top (last in features)
  const itemsWithLayers = cnComboItems.filter((it) => Array.isArray(it.layers) && it.layers.length > 0);
  check(itemsWithLayers.length === 448, "2.TwJpCn.AllPolygonsBound", `Expected 448 items with layers, got ${itemsWithLayers.length}`);

  // Answer matching across all 3 packs in casual mode
  sb.state.difficulty = "casual";
  sb.state.playMode = "free";
  check(sb.evaluateGuess("大安") && sb.state.unlockedTowns.has("63000_大安區"), "2.TwJpCn.MatchTw", "Should unlock TW 大安區");
  check(sb.evaluateGuess("tokyo") && sb.state.unlockedTowns.has("jp_13"), "2.TwJpCn.MatchJpRomaji", "Should unlock JP 東京都 via romaji");
  check(sb.evaluateGuess("おおさか") && sb.state.unlockedTowns.has("jp_27"), "2.TwJpCn.MatchJpKana", "Should unlock JP 大阪府 via hiragana");
  check(sb.evaluateGuess("广东") && sb.state.unlockedTowns.has("cn_440000"), "2.TwJpCn.MatchCnSimp", "Should unlock CN 廣東省 via simplified Chinese");
  check(sb.evaluateGuess("三重"), "2.TwJpCn.MatchAmbiguousCasual", "Typing 三重 in casual should match");
  check(
    sb.state.unlockedTowns.has("65000_三重區") && sb.state.unlockedTowns.has("jp_24"),
    "2.TwJpCn.AmbiguousUnlocksBothInCasual",
    "Casual 三重 should unlock both 新北市三重區 & 日本三重縣"
  );

  // Hard suffix disambiguates 岡山區 vs 岡山縣
  sb.state.unlockedTowns.clear();
  sb.state.difficulty = "hard_suffix";
  check(sb.evaluateGuess("岡山區"), "2.TwJpCn.HardSuffixTwOkayama", "Should unlock 高雄市岡山區");
  check(
    sb.state.unlockedTowns.has("64000_岡山區") && !sb.state.unlockedTowns.has("jp_33"),
    "2.TwJpCn.HardSuffixTwOnly",
    "岡山區 must ONLY unlock TW 岡山區, not JP 岡山縣"
  );
  check(sb.evaluateGuess("岡山縣") && sb.state.unlockedTowns.has("jp_33"), "2.TwJpCn.HardSuffixJpOkayama", "岡山縣 should unlock JP 岡山縣");

  // CN single-char alias option works inside composite pack!
  sb.state.difficulty = "casual";
  sb.state.unlockedTowns.clear();
  sb.applyPackOptionToggle("cnAllowSingleCharAlias", true);
  check(sb.evaluateGuess("粵") && sb.state.unlockedTowns.has("cn_440000"), "2.TwJpCn.CnSingleCharAlias", "粵 should unlock 廣東省 when cnAllowSingleCharAlias is ON");

  // Pack options UI shows CN option in 台日中
  sb.syncPackOptionsUI();
  check(!sb.elements["pack-options-bar"].classList.contains("hidden"), "2.TwJpCn.PackOptsVisible", "Pack options bar visible");
  check(!sb.elements["pack-opt-cn-singlechar-wrap"].classList.contains("hidden"), "2.TwJpCn.CnOptVisible", "CN single-char toggle visible");
  check(sb.elements["pack-opt-roc-mongolia-wrap"].classList.contains("hidden"), "2.TwJpCn.RocOptHidden", "ROC options hidden in CN combo");

  // Pin-Drop per-item scale & prompt parity
  const twItem = cnComboItems.find((i) => i.id === "63000_中正區");
  const jpItem = cnComboItems.find((i) => i.id === "jp_13");
  const cnItem = cnComboItems.find((i) => i.id === "cn_440000");
  const twPdTarget = sb.buildPinDropTargetFromTown(twItem);
  const jpPdTarget = sb.buildPinDropTargetFromTown(jpItem);
  const cnPdTarget = sb.buildPinDropTargetFromTown(cnItem);
  check(sb.getPinDropScaleKm(twPdTarget) === 25, "2.PinDrop.TwScale", `Got ${sb.getPinDropScaleKm(twPdTarget)}`);
  check(sb.getPinDropScaleKm(jpPdTarget) === 150, "2.PinDrop.JpScale", `Got ${sb.getPinDropScaleKm(jpPdTarget)}`);
  check(sb.getPinDropScaleKm(cnPdTarget) === 400, "2.PinDrop.CnScale", `Got ${sb.getPinDropScaleKm(cnPdTarget)}`);
  check(twPdTarget.promptTitle.includes("臺北市") && twPdTarget.promptTitle.includes("中正區"), "2.PinDrop.TwPrompt", `Got ${twPdTarget.promptTitle}`);
  check(jpPdTarget.promptTitle.includes("東京都") && !jpPdTarget.promptTitle.includes("關東"), "2.PinDrop.JpPrompt", `Got ${jpPdTarget.promptTitle}`);
  check(cnPdTarget.promptTitle.includes("廣東省") && !cnPdTarget.promptTitle.includes("華南"), "2.PinDrop.CnPrompt", `Got ${cnPdTarget.promptTitle}`);

  // -----------------------------------------------------------------------
  // 3. COMPOSITE PACK: 台日中華民國 (tw_modern+jp_pref+roc_1949)
  // -----------------------------------------------------------------------
  const resRocCombo = await sb.switchActiveMapPack("tw_modern+jp_pref+roc_1949", { skipPaintYield: true });
  check(Boolean(resRocCombo && resRocCombo.ok), "3.TwJpRoc.SwitchOk", `Expected ok=true, got ${JSON.stringify(resRocCombo)}`);

  const rocComboPack = sb.getActiveMapPack();
  const rocComboItems = sb.getActiveItems();
  const rocComboGroups = sb.getActiveGroups();
  check(rocComboItems.length === 368 + 47 + 49, "3.TwJpRoc.ItemCountExclRocTaiwan", `Expected 464 (roc_taiwan auto-excluded), got ${rocComboItems.length}`);
  check(!rocComboItems.some((i) => i.id === "roc_taiwan"), "3.TwJpRoc.NoRocTaiwanOverlap", "roc_taiwan must be auto-excluded when tw_modern is active");
  check(rocComboGroups.length === 22 + 8 + 6, "3.TwJpRoc.GroupCount", `Expected 36, got ${rocComboGroups.length}`);
  check(new Set(rocComboGroups.map((g) => g.name)).size === 36, "3.TwJpRoc.UniqueGroupNames", "All 36 group names unique");
  check(Boolean(rocComboPack.disputedBordersGeo && rocComboPack.disputedBordersGeo.features.length > 0), "3.TwJpRoc.DisputedBordersForwarded", "ROC disputed borders must be present");
  check(Boolean(rocComboPack.features.supportsHistoricalBasemap), "3.TwJpRoc.HistoricalBasemap", "ROC combo must support historical basemap");
  check(rocComboPack.mapView.maxZoom === 18, "3.TwJpRoc.MaxZoom18", `Expected maxZoom 18 (not 10), got ${rocComboPack.mapView.maxZoom}`);

  // ROC options work dynamically inside 台日中華民國
  sb.syncPackOptionsUI();
  check(!sb.elements["pack-opt-roc-mongolia-wrap"].classList.contains("hidden"), "3.TwJpRoc.RocMongoliaOptVisible", "ROC Mongolia toggle visible");
  check(!sb.elements["btn-layer-historical"].classList.contains("hidden"), "3.TwJpRoc.HistoricalBtnVisible", "Historical layer button visible");
  sb.applyPackOptionToggle("rocTerritoryVariant", "no_mongolia");
  check(sb.getPackEligibleItems().length === 463, "3.TwJpRoc.NoMongoliaCount", `Expected 463, got ${sb.getPackEligibleItems().length}`);
  sb.applyPackOptionToggle("includeMunicipalities", false);
  check(sb.getPackEligibleItems().length === 451, "3.TwJpRoc.NoMuniCount", `Expected 451, got ${sb.getPackEligibleItems().length}`);
  // Restore defaults
  sb.applyPackOptionToggle("rocTerritoryVariant", "begonia_full");
  sb.applyPackOptionToggle("includeMunicipalities", true);

  // Answer matching in 台日中華民國
  sb.state.difficulty = "casual";
  sb.state.playMode = "free";
  check(sb.evaluateGuess("北平") && sb.state.unlockedTowns.has("roc_beiping"), "3.TwJpRoc.MatchBeiping", "Should unlock ROC 北平市");
  check(sb.evaluateGuess("察哈爾") && sb.state.unlockedTowns.has("roc_chahar"), "3.TwJpRoc.MatchChahar", "Should unlock ROC 察哈爾省");
  check(sb.evaluateGuess("京都") && sb.state.unlockedTowns.has("jp_26"), "3.TwJpRoc.MatchKyoto", "Should unlock JP 京都府");
  check(sb.evaluateGuess("板橋") && sb.state.unlockedTowns.has("65000_板橋區"), "3.TwJpRoc.MatchBanqiao", "Should unlock TW 板橋區");

  // JP + ROC (WITHOUT TW) must KEEP roc_taiwan -> 47 + 50 = 97 items!
  const resJpRoc = await sb.switchActiveMapPack("jp_pref+roc_1949", { skipPaintYield: true });
  check(Boolean(resJpRoc && resJpRoc.ok), "3.JpRoc.SwitchOk", "jp_pref+roc_1949 switch should succeed");
  check(sb.getActiveItems().length === 47 + 50, "3.JpRoc.KeepsRocTaiwan", `Expected 97 items, got ${sb.getActiveItems().length}`);
  check(sb.getActiveItems().some((i) => i.id === "roc_taiwan"), "3.JpRoc.HasRocTaiwan", "jp_pref+roc_1949 without tw_modern must keep roc_taiwan");

  // -----------------------------------------------------------------------
  // 4. UI SWITCHER & P2P REMOTE CONFIG SYNC
  // -----------------------------------------------------------------------
  await sb.switchActiveMapPack("tw_modern+jp_pref+cn_prov", { skipPaintYield: true });
  sb.renderMapPackSwitcherUI();
  const gridChildren = sb.elements["mappack-selector-grid"].children;
  check(gridChildren.length === 5, "4.UI.FiveRegisteredCards", `Expected 5 cards (virtual composite not leaked into registry), got ${gridChildren.length}`);
  const twCard = gridChildren.find((c) => c.getAttribute("data-mappack-id") === "tw_modern");
  const jpCard = gridChildren.find((c) => c.getAttribute("data-mappack-id") === "jp_pref");
  const cnCard = gridChildren.find((c) => c.getAttribute("data-mappack-id") === "cn_prov");
  const rocCard = gridChildren.find((c) => c.getAttribute("data-mappack-id") === "roc_1949");
  const worldCard = gridChildren.find((c) => c.getAttribute("data-mappack-id") === "world_countries");
  check(Boolean(twCard && twCard.querySelector('[data-mappack-toggle-id="tw_modern"]')), "4.UI.TwHasToggleBtn", "TW card has + toggle button");
  check(Boolean(jpCard && jpCard.querySelector('[data-mappack-toggle-id="jp_pref"]')), "4.UI.JpHasToggleBtn", "JP card has + toggle button");
  check(Boolean(cnCard && cnCard.querySelector('[data-mappack-toggle-id="cn_prov"]')), "4.UI.CnHasToggleBtn", "CN card has + toggle button");
  check(Boolean(rocCard && rocCard.querySelector('[data-mappack-toggle-id="roc_1949"]')), "4.UI.RocHasToggleBtn", "ROC card has + toggle button");
  check(Boolean(worldCard && !worldCard.querySelector('[data-mappack-toggle-id="world_countries"]')), "4.UI.WorldNoToggleBtn", "World card must NOT have + toggle button (exclusive)");

  // P2P remote sync switches to composite pack seamlessly
  await sb.switchActiveMapPack("tw_modern", { skipPaintYield: true });
  check(sb.state.activeMapPackId === "tw_modern" && sb.getActiveItems().length === 368, "4.RestoreTw", "Switching back to tw_modern restores 368 items");
  const p2pRes = await sb.applyRemoteSyncConfig({ mapPackId: "tw_modern+jp_pref+roc_1949" }, false, true);
  check(Boolean(p2pRes && sb.state.activeMapPackId === "tw_modern+jp_pref+roc_1949"), "4.P2P.RemoteSyncComposite", `Got activeMapPackId=${sb.state.activeMapPackId}`);

  // Switching to World clears combo cleanly
  await sb.switchActiveMapPack("world_countries", { skipPaintYield: true });
  check(
    sb.state.activeMapPackId === "world_countries" && sb.getActiveMapPackIds().join(",") === "world_countries",
    "4.SwitchToWorldClearsCombo",
    `Got ${sb.state.activeMapPackId} / ${sb.getActiveMapPackIds()}`
  );

  // -----------------------------------------------------------------------
  // 5. EXHAUSTIVE MATCHING & LAYER-ORDER QA
  // -----------------------------------------------------------------------
  // Verify ALL 448 items in 台日中 unlock cleanly in hard_suffix (and TW features are drawn last / on top)
  await sb.switchActiveMapPack("tw_modern+jp_pref+cn_prov", { skipPaintYield: true });
  const mergedCnTopo = await sb.getActiveMapPack().loadTopoData();
  const lastFeat = mergedCnTopo.townsGeo.features[mergedCnTopo.townsGeo.features.length - 1];
  const firstFeat = mergedCnTopo.townsGeo.features[0];
  check(
    firstFeat.properties.__sourcePackId === "cn_prov" && lastFeat.properties.__sourcePackId === "tw_modern",
    "5.QA.TwDrawnOnTopOfCn",
    `first=${firstFeat.properties.__sourcePackId}, last=${lastFeat.properties.__sourcePackId}`
  );
  sb.state.difficulty = "hard_suffix";
  sb.state.playMode = "free";
  sb.state.unlockedTowns.clear();
  const cnAllItems = sb.getActiveItems();
  for (const it of cnAllItems) {
    sb.evaluateGuess(it.townName);
  }
  check(
    sb.state.unlockedTowns.size === cnAllItems.length,
    "5.QA.ExhaustiveTwJpCn448",
    `Expected 448 unlocked, got ${sb.state.unlockedTowns.size}`
  );

  // Verify ALL 464 items in 台日中華民國 unlock cleanly in hard_suffix (and roc_taiwan absent from topo)
  await sb.switchActiveMapPack("tw_modern+jp_pref+roc_1949", { skipPaintYield: true });
  const mergedRocTopo = await sb.getActiveMapPack().loadTopoData();
  const hasRocTwFeat = mergedRocTopo.townsGeo.features.some(
    (f) => f && f.properties && (f.properties.id === "roc_taiwan" || f.id === "roc_taiwan")
  );
  check(!hasRocTwFeat, "5.QA.NoRocTaiwanInMergedTopo", "roc_taiwan geometry must be excluded when tw_modern is present");
  sb.state.difficulty = "hard_suffix";
  sb.state.playMode = "free";
  sb.state.unlockedTowns.clear();
  const rocAllItems = sb.getActiveItems();
  for (const it of rocAllItems) {
    sb.evaluateGuess(it.townName);
  }
  check(
    sb.state.unlockedTowns.size === rocAllItems.length,
    "5.QA.ExhaustiveTwJpRoc464",
    `Expected 464 unlocked, got ${sb.state.unlockedTowns.size}`
  );

  console.log(`\nResult: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
  console.log("PASS [GREEN]: All Multi-Pack East Asia combination checks passed!");
}

runTests().catch((err) => {
  console.error("UNCAUGHT ERROR:", err);
  process.exit(1);
});
