"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const REPO_DIR = path.resolve(__dirname, "..");

function createSandbox() {
  const elements = {};
  const makeEl = (id) => ({
    id,
    value: "",
    textContent: "",
    className: "",
    options: [],
    classList: {
      _set: new Set(),
      add(...cls) { cls.forEach((c) => this._set.add(c)); },
      remove(...cls) { cls.forEach((c) => this._set.delete(c)); },
      toggle(c, force) {
        if (force === undefined) {
          if (this._set.has(c)) this._set.delete(c);
          else this._set.add(c);
        } else if (force) this._set.add(c);
        else this._set.delete(c);
      },
      contains(c) { return this._set.has(c); }
    },
    replaceChildren() {},
    appendChild() {},
    focus() {},
    addEventListener() {},
    querySelector() { return null; },
    getAttribute() { return ""; },
    offsetWidth: 0
  });

  const getEl = (id) => {
    if (!elements[id]) elements[id] = makeEl(id);
    return elements[id];
  };

  const sandbox = {
    console,
    Math,
    Set,
    Map,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    JSON,
    Date,
    Intl,
    parseInt,
    parseFloat,
    isNaN,
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    navigator: { userAgent: "node-test", language: "zh-TW", hardwareConcurrency: 4, platform: "Linux" },
    screen: { width: 1920, height: 1080, colorDepth: 24 },
    localStorage: { getItem: () => null, setItem: () => {} },
    document: {
      getElementById: getEl,
      querySelectorAll: () => [],
      createElement: () => makeEl("dyn")
    },
    window: {},
    startTimer: () => {},
    playTone: () => {},
    refreshAllPolygonStyles: () => {},
    updateScoreAndProgressUI: () => {},
    broadcastP2PState: () => {},
    checkVictoryCondition: () => {},
    updateTargetBannerUI: () => {},
    pickNextTargetRegion: () => {},
    updateTransportVisualStyles: () => {},
    updateRoadAndRailwayTileOverlays: () => {},
    focusMapOnLatLng: () => {},
    railTileLayers: [],
    map: null,
    lastFeedback: null
  };

  sandbox.window = sandbox;
  vm.createContext(sandbox);

  const loadFiles = [
    "data/admin-data.js",
    "data/transport-data.js",
    "data/poi-data.js",
    "js/state.js",
    "js/transport-engine.js",
    "js/poi-engine.js",
    "js/game-logic.js"
  ];

  for (const rel of loadFiles) {
    const code = fs.readFileSync(path.join(REPO_DIR, rel), "utf8");
    vm.runInContext(code, sandbox, { filename: rel });
  }

  vm.runInContext(`
    const _origSetFeedback = setFeedback;
    setFeedback = function(text, level) {
      window.lastFeedback = { text, level };
      return _origSetFeedback(text, level);
    };
  `, sandbox);

  return sandbox;
}

const sb = createSandbox();

function resetState(opts = {}) {
  const {
    difficulty = "hard_suffix",
    playMode = "free",
    regionQuizEnabled = true,
    stationQuizEnabled = false,
    airportQuizEnabled = false,
    portQuizEnabled = false,
    reservoirQuizEnabled = false,
    lakeQuizEnabled = false,
    settlementQuizEnabled = false,
    prefix = "",
    suffix = "",
    unlockAllHierarchy = false
  } = opts;

  const qtm = regionQuizEnabled && stationQuizEnabled ? "both" : stationQuizEnabled ? "station" : "region";

  vm.runInContext(`
    state.difficulty = ${JSON.stringify(difficulty)};
    state.playMode = ${JSON.stringify(playMode)};
    state.quizTargetMode = ${JSON.stringify(qtm)};
    state.isGameOver = false;
    state.isImeComposing = false;
    state.timerRunning = true;
    state.elapsedSec = 1;
    state.regionQuizEnabled = ${JSON.stringify(regionQuizEnabled)};
    state.selectedCounties = new Set(TAIWAN_ADMIN_DATA.map(c => c.name));
    state.selectedTownIds = new Set(ALL_TOWNS.map(t => t.id));
    state.unlockedTowns = new Set();
    state.unlockedCounties = ${unlockAllHierarchy ? "new Set(TAIWAN_ADMIN_DATA.map(c => c.name))" : "new Set()"};
    state.unlockedProvinces = ${unlockAllHierarchy ? 'new Set(["臺灣省", "福建省", ...TAIWAN_ADMIN_DATA.filter(c => c.isSpecial).map(c => c.name)])' : "new Set()"};
    state.stationQuizEnabled = ${JSON.stringify(stationQuizEnabled)};
    state.quizStationLines = ${stationQuizEnabled ? "new Set(TAIWAN_SELECTABLE_LINES.filter(l => !l.isHighway).map(l => l.id))" : "new Set()"};
    state.filterStationsByRegion = false;
    state.unlockedStations = new Set();
    state.airportQuizEnabled = ${JSON.stringify(airportQuizEnabled)};
    state.airportSubTypes = new Set(AIRPORT_SUBTYPES.map(s => s.id));
    state.portQuizEnabled = ${JSON.stringify(portQuizEnabled)};
    state.portSubTypes = new Set(PORT_SUBTYPES.map(s => s.id));
    state.reservoirQuizEnabled = ${JSON.stringify(reservoirQuizEnabled)};
    state.reservoirSubTypes = new Set(RESERVOIR_SUBTYPES.map(s => s.id));
    state.lakeQuizEnabled = ${JSON.stringify(lakeQuizEnabled)};
    state.lakeSubTypes = new Set(LAKE_SUBTYPES.map(s => s.id));
    state.settlementQuizEnabled = ${JSON.stringify(settlementQuizEnabled)};
    state.settlementSubTypes = new Set(SETTLEMENT_SUBTYPES.map(s => s.id));
    state.unlockedPois = new Set();
    state.missedPois = new Set();
    state.targetId = null;
    state.targetStationKey = null;
    state.targetPoiId = null;
    document.getElementById("prefix-select").value = ${JSON.stringify(prefix)};
    document.getElementById("suffix-input").value = ${JSON.stringify(suffix)};
    document.getElementById("answer-input").value = "";
    window.lastFeedback = null;
  `, sb);
}

const ALL_TOWNS = vm.runInContext("ALL_TOWNS", sb);
const TAIWAN_POI_DATA = vm.runInContext("TAIWAN_POI_DATA", sb);
const EXACT_PORT_SHORT_NAMES = vm.runInContext("EXACT_PORT_SHORT_NAMES", sb);
const STATION_NAME_ALIASES = vm.runInContext("STATION_NAME_ALIASES", sb);
const SETTLEMENT_SUBTYPES = vm.runInContext("SETTLEMENT_SUBTYPES", sb);

// Build map of duplicate settlement shortNames so generic loops use disambiguated prefix when both homonyms are active
const settlementShortNameCounts = new Map();
for (const p of TAIWAN_POI_DATA) {
  if (p.category === "settlement") {
    const k = p.shortName.replace(/台/g, "臺");
    settlementShortNameCounts.set(k, (settlementShortNameCounts.get(k) || 0) + 1);
  }
}
function getCanonicalPoiInput(poi) {
  if (poi.category === "settlement") {
    const k = poi.shortName.replace(/台/g, "臺");
    // Check if another active settlement has the same name/shortName/alias
    const dup = TAIWAN_POI_DATA.filter(
      (o) => o.category === "settlement" && o.id !== poi.id && [o.name, o.shortName, ...(o.aliases || [])].some((a) => a.replace(/台/g, "臺") === k)
    );
    if (dup.length > 0) {
      const tBase = poi.townName.replace(/[鄉鎮市區]$/, "");
      const cShort = poi.countyName.replace(/[縣市]$/, "");
      const pre = (tBase.length >= 2 && tBase !== cShort) ? tBase : cShort;
      return pre + poi.shortName;
    }
  }
  return poi.shortName;
}

const failures = [];
let totalChecks = 0;

function check(cond, category, detail) {
  totalChecks++;
  if (!cond) failures.push({ category, detail });
}

const t0 = Date.now();

// =========================================================================
// 1. ALL 368 TOWNS — hard_suffix, hard_full, master_hierarchy, casual (mixed)
// =========================================================================
resetState({
  difficulty: "hard_suffix",
  regionQuizEnabled: true,
  stationQuizEnabled: true,
  airportQuizEnabled: true,
  portQuizEnabled: true,
  reservoirQuizEnabled: true,
  lakeQuizEnabled: true,
  settlementQuizEnabled: true
});
for (const t of ALL_TOWNS) {
  const suffixChar = t.townName.slice(-1);
  // 1a. Quick suffix + baseName
  vm.runInContext(`state.unlockedTowns.delete(${JSON.stringify(t.id)})`, sb);
  sb.document.getElementById("prefix-select").value = "";
  sb.document.getElementById("suffix-input").value = suffixChar;
  const comb = sb.buildCombinedInput("", t.baseName, suffixChar);
  const ok = sb.evaluateGuess(t.baseName, false);
  const unlocked = vm.runInContext(`state.unlockedTowns.has(${JSON.stringify(t.id)})`, sb);
  check(ok && unlocked, "1a.Town+QuickSuffix(hard_suffix)", `${t.fullCountyTown}: combined="${comb}", fb="${sb.lastFeedback?.text}"`);

  // 1b. Direct townName with wrong quick suffix (smart override)
  const wrongSuffix = suffixChar === "區" ? "鄉" : "區";
  vm.runInContext(`state.unlockedTowns.delete(${JSON.stringify(t.id)})`, sb);
  sb.document.getElementById("suffix-input").value = wrongSuffix;
  const ok2 = sb.evaluateGuess(t.townName, false);
  const unlocked2 = vm.runInContext(`state.unlockedTowns.has(${JSON.stringify(t.id)})`, sb);
  check(ok2 && unlocked2, "1b.TownDirect+WrongSuffix(smartOverride)", `${t.fullCountyTown}: suffix="${wrongSuffix}", fb="${sb.lastFeedback?.text}"`);
}

// 1c. hard_full: county prefix + quick suffix + baseName
resetState({
  difficulty: "hard_full",
  regionQuizEnabled: true,
  stationQuizEnabled: true,
  airportQuizEnabled: true,
  portQuizEnabled: true,
  reservoirQuizEnabled: true,
  lakeQuizEnabled: true,
  settlementQuizEnabled: true
});
for (const t of ALL_TOWNS) {
  const suffixChar = t.townName.slice(-1);
  sb.document.getElementById("prefix-select").value = t.countyName;
  sb.document.getElementById("suffix-input").value = suffixChar;
  const ok = sb.evaluateGuess(t.baseName, false);
  const unlocked = vm.runInContext(`state.unlockedTowns.has(${JSON.stringify(t.id)})`, sb);
  check(ok && unlocked, "1c.Town+Prefix+QuickSuffix(hard_full)", `${t.fullCountyTown}: fb="${sb.lastFeedback?.text}"`);
}

// 1d. master_hierarchy: province+county prefix + quick suffix + baseName
resetState({
  difficulty: "master_hierarchy",
  regionQuizEnabled: true,
  stationQuizEnabled: true,
  airportQuizEnabled: true,
  portQuizEnabled: true,
  reservoirQuizEnabled: true,
  lakeQuizEnabled: true,
  settlementQuizEnabled: true,
  unlockAllHierarchy: true
});
for (const t of ALL_TOWNS) {
  const suffixChar = t.townName.slice(-1);
  const hierPrefix = t.isSpecial ? t.countyName : `${t.province}${t.countyName}`;
  sb.document.getElementById("prefix-select").value = hierPrefix;
  sb.document.getElementById("suffix-input").value = suffixChar;
  const ok = sb.evaluateGuess(t.baseName, false);
  const unlocked = vm.runInContext(`state.unlockedTowns.has(${JSON.stringify(t.id)})`, sb);
  check(ok && unlocked, "1d.Town+Prefix+QuickSuffix(master_hierarchy)", `${t.fullHierarchyName}: fb="${sb.lastFeedback?.text}"`);
}

// 1e. hard_suffix negative: bare baseName with empty suffix must NOT unlock town
resetState({ difficulty: "hard_suffix", regionQuizEnabled: true });
for (const t of ALL_TOWNS) {
  sb.document.getElementById("suffix-input").value = "";
  const ok = sb.evaluateGuess(t.baseName, false);
  check(!ok, "1e.TownBareNegative(hard_suffix)", `${t.fullCountyTown}: bare "${t.baseName}" unexpectedly matched`);
}

// 1f. casual: bare baseName unlocks every town
resetState({ difficulty: "casual", regionQuizEnabled: true, stationQuizEnabled: true, airportQuizEnabled: true, portQuizEnabled: true });
for (const t of ALL_TOWNS) {
  vm.runInContext(`state.unlockedTowns.delete(${JSON.stringify(t.id)})`, sb);
  const ok = sb.evaluateGuess(t.baseName, false);
  const unlocked = vm.runInContext(`state.unlockedTowns.has(${JSON.stringify(t.id)})`, sb);
  check(ok && unlocked, "1f.TownBare(casual+mixed)", `${t.fullCountyTown}: fb="${sb.lastFeedback?.text}"`);
}

// =========================================================================
// 2. ALL 561 STATIONS — hard_suffix, hard_full, master_hierarchy, casual, aliases
// =========================================================================
resetState({
  difficulty: "hard_suffix",
  regionQuizEnabled: true,
  stationQuizEnabled: true,
  airportQuizEnabled: true,
  portQuizEnabled: true,
  reservoirQuizEnabled: true,
  lakeQuizEnabled: true,
  settlementQuizEnabled: true
});
const allStations = vm.runInContext("getActiveQuizStations()", sb);
assert.ok(allStations.length > 500, `Expected >500 stations, got ${allStations.length}`);

for (const st of allStations) {
  // 2a. Quick suffix "站" + baseName
  vm.runInContext(`state.unlockedStations.delete(${JSON.stringify(st.key)})`, sb);
  sb.document.getElementById("prefix-select").value = "";
  sb.document.getElementById("suffix-input").value = "站";
  const ok = sb.evaluateGuess(st.baseName, false);
  const unlocked = vm.runInContext(`state.unlockedStations.has(${JSON.stringify(st.key)})`, sb);
  check(ok && unlocked, "2a.Station+QuickSuffix(站)", `${st.displayName}: fb="${sb.lastFeedback?.text}"`);

  // 2b. Direct "baseName+站" while quick suffix="區" is active (smart override)
  vm.runInContext(`state.unlockedStations.delete(${JSON.stringify(st.key)})`, sb);
  sb.document.getElementById("suffix-input").value = "區";
  const direct = st.baseName.endsWith("站") ? st.baseName : `${st.baseName}站`;
  const ok2 = sb.evaluateGuess(direct, false);
  const unlocked2 = vm.runInContext(`state.unlockedStations.has(${JSON.stringify(st.key)})`, sb);
  check(ok2 && unlocked2, "2b.StationDirect+WrongSuffix(區)", `${st.displayName}: fb="${sb.lastFeedback?.text}"`);
}

// 2c. hard_full & master_hierarchy with county prefix + quick suffix "站"
for (const diff of ["hard_full", "master_hierarchy"]) {
  resetState({
    difficulty: diff,
    regionQuizEnabled: true,
    stationQuizEnabled: true,
    airportQuizEnabled: true,
    portQuizEnabled: true,
    reservoirQuizEnabled: true,
    lakeQuizEnabled: true,
    unlockAllHierarchy: true
  });
  for (const st of allStations) {
    vm.runInContext(`state.unlockedStations.delete(${JSON.stringify(st.key)})`, sb);
    sb.document.getElementById("prefix-select").value = diff === "master_hierarchy" ? "臺灣省新竹縣" : "臺北市";
    sb.document.getElementById("suffix-input").value = "站";
    const ok = sb.evaluateGuess(st.baseName, false);
    const unlocked = vm.runInContext(`state.unlockedStations.has(${JSON.stringify(st.key)})`, sb);
    check(ok && unlocked, `2c.Station+Prefix+QuickSuffix(${diff})`, `${st.displayName}: fb="${sb.lastFeedback?.text}"`);
  }
}

// 2d. Station aliases with quick suffix "站" in hard_suffix
resetState({ difficulty: "hard_suffix", regionQuizEnabled: true, stationQuizEnabled: true });
for (const alias of Object.keys(STATION_NAME_ALIASES)) {
  vm.runInContext("state.unlockedStations.clear()", sb);
  sb.document.getElementById("suffix-input").value = "站";
  const ok = sb.evaluateGuess(alias, false);
  check(ok, "2d.StationAlias+QuickSuffix(站)", `alias="${alias}", fb="${sb.lastFeedback?.text}"`);
}

// =========================================================================
// 3. ALL 138 POIS (Airports, Ports, Fishery Ports, Reservoirs, Lakes)
// =========================================================================
resetState({
  difficulty: "hard_suffix",
  regionQuizEnabled: true,
  stationQuizEnabled: true,
  airportQuizEnabled: true,
  portQuizEnabled: true,
  reservoirQuizEnabled: true,
  lakeQuizEnabled: true,
  settlementQuizEnabled: true
});
for (const poi of TAIWAN_POI_DATA) {
  // 3a. Direct shortName (suffix="")
  vm.runInContext(`state.unlockedPois.delete(${JSON.stringify(poi.id)})`, sb);
  sb.document.getElementById("prefix-select").value = "";
  sb.document.getElementById("suffix-input").value = "";
  let ok = sb.evaluateGuess(getCanonicalPoiInput(poi), false);
  let unlocked = vm.runInContext(`state.unlockedPois.has(${JSON.stringify(poi.id)})`, sb);
  check(ok && unlocked, "3a.PoiDirectShortName(hard_suffix+mixed)", `${poi.id} (${poi.shortName}): fb="${sb.lastFeedback?.text}"`);

  // 3b. Direct shortName with wrong suffix="區" (smart override)
  vm.runInContext(`state.unlockedPois.delete(${JSON.stringify(poi.id)})`, sb);
  sb.document.getElementById("suffix-input").value = "區";
  ok = sb.evaluateGuess(getCanonicalPoiInput(poi), false);
  unlocked = vm.runInContext(`state.unlockedPois.has(${JSON.stringify(poi.id)})`, sb);
  check(ok && unlocked, "3b.PoiDirect+WrongSuffix(區)", `${poi.id} (${poi.shortName}): fb="${sb.lastFeedback?.text}"`);

  // 3c. Matching quick suffix + stem
  const quickCases = [];
  const cats = poi.categories || [poi.category];
  if (cats.includes("airport")) {
    const stem = poi.shortName.replace(/(國際機場|國內機場|空軍基地|陸軍航空基地|航空基地|航空站|機場|基地)$/g, "");
    if (stem.length >= 2) quickCases.push({ suffix: "機場", core: stem });
  }
  if (cats.includes("port")) {
    if (poi.shortName.endsWith("漁港")) {
      const stem = poi.shortName.slice(0, -2);
      if (stem.length >= 2) {
        quickCases.push({ suffix: "漁港", core: stem });
        // Also test flexible "港" suffix unless `${stem}港` collides with a distinct exact port (e.g. 安平港)
        if (!EXACT_PORT_SHORT_NAMES.has(sb.normalizePoiText(`${stem}港`))) {
          quickCases.push({ suffix: "港", core: stem });
        }
      }
    } else if (poi.shortName.endsWith("港")) {
      const stem = poi.shortName.replace(/(天然氣港|工業港|商港|港)$/g, "");
      if (stem.length >= 2 && (`${stem}港` === poi.shortName || !EXACT_PORT_SHORT_NAMES.has(sb.normalizePoiText(`${stem}港`)))) {
        quickCases.push({ suffix: "港", core: stem });
      }
    }
  }
  if (cats.includes("reservoir") && poi.shortName.endsWith("水庫")) {
    const stem = poi.shortName.slice(0, -2);
    if (stem.length >= 2) quickCases.push({ suffix: "水庫", core: stem });
  }
  if (cats.includes("lake") && poi.shortName.endsWith("湖")) {
    const stem = poi.shortName.slice(0, -1);
    if (stem.length >= 2) quickCases.push({ suffix: "湖", core: stem });
  }

  for (const qc of quickCases) {
    vm.runInContext(`state.unlockedPois.delete(${JSON.stringify(poi.id)})`, sb);
    sb.document.getElementById("suffix-input").value = qc.suffix;
    const comb = sb.buildCombinedInput("", qc.core, qc.suffix);
    ok = sb.evaluateGuess(qc.core, false);
    unlocked = vm.runInContext(`state.unlockedPois.has(${JSON.stringify(poi.id)})`, sb);
    check(ok && unlocked, "3c.Poi+QuickSuffix(hard_suffix+mixed)", `${poi.id} (${poi.shortName}): core="${qc.core}" suffix="${qc.suffix}" -> "${comb}", fb="${sb.lastFeedback?.text}"`);
  }

  // 3d. IATA code with suffix="機場" and suffix="區"
  if (poi.code && /^[A-Za-z]{3,4}$/.test(poi.code)) {
    for (const sfx of ["機場", "區"]) {
      vm.runInContext(`state.unlockedPois.delete(${JSON.stringify(poi.id)})`, sb);
      sb.document.getElementById("suffix-input").value = sfx;
      ok = sb.evaluateGuess(poi.code, false);
      unlocked = vm.runInContext(`state.unlockedPois.has(${JSON.stringify(poi.id)})`, sb);
      check(ok && unlocked, "3d.PoiCode+QuickSuffix", `${poi.id} code="${poi.code}" suffix="${sfx}": fb="${sb.lastFeedback?.text}"`);
    }
  }
}

// =========================================================================
// 4. TARGET CLICK MODE & CROSS-CATEGORY ISOLATION
// =========================================================================
resetState({
  difficulty: "hard_suffix",
  playMode: "target_click",
  regionQuizEnabled: true,
  stationQuizEnabled: true,
  airportQuizEnabled: true,
  portQuizEnabled: true,
  reservoirQuizEnabled: true,
  lakeQuizEnabled: true,
  settlementQuizEnabled: true
});

// 4a. Target town: 內湖區 / 南港區 / 大湖鄉 / 大埤鄉 with quick suffix
for (const [fullName, core, sfx] of [
  ["臺北市內湖區", "內湖", "區"],
  ["臺北市南港區", "南港", "區"],
  ["苗栗縣大湖鄉", "大湖", "鄉"],
  ["雲林縣大埤鄉", "大埤", "鄉"]
]) {
  const tid = ALL_TOWNS.find((x) => x.fullCountyTown === fullName).id;
  vm.runInContext(`state.targetId = ${JSON.stringify(tid)}; state.targetStationKey = null; state.targetPoiId = null;`, sb);
  sb.document.getElementById("suffix-input").value = sfx;
  const ok = sb.evaluateGuess(core, false);
  const unlocked = vm.runInContext(`state.unlockedTowns.has(${JSON.stringify(tid)})`, sb);
  check(ok && unlocked, "4a.TargetTown+QuickSuffix", `${tid}: core="${core}" suffix="${sfx}", fb="${sb.lastFeedback?.text}"`);
}

// 4b. Cross-category isolation: targeting a town must NOT unlock a POI or station
const neihuId = ALL_TOWNS.find((x) => x.fullCountyTown === "臺北市內湖區").id;
vm.runInContext(`state.targetId = ${JSON.stringify(neihuId)}; state.targetStationKey = null; state.targetPoiId = null; state.unlockedTowns.clear(); state.unlockedPois.clear(); state.unlockedStations.clear();`, sb);
sb.document.getElementById("suffix-input").value = "";
const hijackPoi = sb.evaluateGuess("松山機場", false);
const hijackSt = sb.evaluateGuess("板橋站", false);
check(!hijackPoi && vm.runInContext("state.unlockedPois.size === 0", sb), "4b.TargetIsolation(POI)", "Typing 松山機場 while targeting a town should not unlock POI");
check(!hijackSt && vm.runInContext("state.unlockedStations.size === 0", sb), "4b.TargetIsolation(Station)", "Typing 板橋站 while targeting a town should not unlock Station");

// =========================================================================
// 5. 台/臺 NORMALIZATION & QUICK SUFFIX BAR VISIBILITY
// =========================================================================
resetState({
  difficulty: "hard_suffix",
  regionQuizEnabled: true,
  stationQuizEnabled: true,
  airportQuizEnabled: true,
  portQuizEnabled: true,
  reservoirQuizEnabled: true,
  lakeQuizEnabled: true,
  settlementQuizEnabled: true
});
for (const [core, sfx, expected] of [
  ["台西", "鄉", "臺西鄉"],
  ["台東", "市", "臺東市"],
  ["台北", "站", "臺北站"],
  ["台中", "港", "臺中港"],
  ["台南", "機場", "臺南機場"]
]) {
  const comb = sb.buildCombinedInput("", core, sfx);
  check(comb === expected, "5a.TaiNormalization", `${core}+${sfx} -> "${comb}" (expected "${expected}")`);
}

// Quick suffix bar visibility
for (const diff of ["casual", "county_only"]) {
  resetState({ difficulty: diff, regionQuizEnabled: true, stationQuizEnabled: true, portQuizEnabled: true });
  const list = sb.getActiveQuickSuffixes();
  check(list.length === 0, "5b.QuickSuffixHidden", `${diff} should have 0 quick suffixes, got ${JSON.stringify(list)}`);
}
resetState({
  difficulty: "hard_suffix",
  regionQuizEnabled: true,
  stationQuizEnabled: true,
  airportQuizEnabled: true,
  portQuizEnabled: true,
  reservoirQuizEnabled: true,
  lakeQuizEnabled: true,
  settlementQuizEnabled: true
});
const activeSuffixes = sb.getActiveQuickSuffixes();
for (const needed of ["", "區", "鄉", "鎮", "市", "站", "機場", "港", "水庫", "湖"]) {
  check(activeSuffixes.includes(needed), "5c.QuickSuffixVisible", `Missing quick suffix "${needed}" in ${JSON.stringify(activeSuffixes)}`);
}

// =========================================================================
// 6. ALL CASUAL (簡單模式) WITHOUT SUFFIX — TOWNS, STATIONS, POIS & PREFIX UI
// =========================================================================
// 6a. All 368 towns in casual + ALL 6 categories mixed (no suffix, no prefix)
resetState({
  difficulty: "casual",
  regionQuizEnabled: true,
  stationQuizEnabled: true,
  airportQuizEnabled: true,
  portQuizEnabled: true,
  reservoirQuizEnabled: true,
  lakeQuizEnabled: true,
  settlementQuizEnabled: true
});
for (const t of ALL_TOWNS) {
  vm.runInContext(`state.unlockedTowns.delete(${JSON.stringify(t.id)})`, sb);
  const ok = sb.evaluateGuess(t.baseName, false);
  const unlocked = vm.runInContext(`state.unlockedTowns.has(${JSON.stringify(t.id)})`, sb);
  check(ok && unlocked, "6a.CasualAllMixed.TownBare", `${t.fullCountyTown}: bare="${t.baseName}", fb="${sb.lastFeedback?.text}"`);
}

// 6b. All 561 stations in casual pure station mode (no suffix, no prefix)
resetState({
  difficulty: "casual",
  regionQuizEnabled: false,
  stationQuizEnabled: true
});
for (const st of allStations) {
  vm.runInContext(`state.unlockedStations.delete(${JSON.stringify(st.key)})`, sb);
  const ok = sb.evaluateGuess(st.baseName, false);
  const unlocked = vm.runInContext(`state.unlockedStations.has(${JSON.stringify(st.key)})`, sb);
  check(ok && unlocked, "6b.CasualPureStation.Bare", `${st.displayName}: bare="${st.baseName}", fb="${sb.lastFeedback?.text}"`);
}

// 6c. All 561 stations in casual + ALL 6 categories mixed (no suffix, no prefix)
resetState({
  difficulty: "casual",
  regionQuizEnabled: true,
  stationQuizEnabled: true,
  airportQuizEnabled: true,
  portQuizEnabled: true,
  reservoirQuizEnabled: true,
  lakeQuizEnabled: true,
  settlementQuizEnabled: true
});
for (const st of allStations) {
  vm.runInContext(`state.unlockedStations.delete(${JSON.stringify(st.key)}); state.unlockedTowns.clear();`, sb);
  const ok = sb.evaluateGuess(st.baseName, false);
  const unlocked = vm.runInContext(`state.unlockedStations.has(${JSON.stringify(st.key)})`, sb);
  check(ok && unlocked, "6c.CasualAllMixed.StationBare", `${st.displayName}: bare="${st.baseName}", fb="${sb.lastFeedback?.text}"`);
}

// 6d. All 326 POIs in casual + ALL 6 categories mixed (no suffix, no prefix)
resetState({
  difficulty: "casual",
  regionQuizEnabled: true,
  stationQuizEnabled: true,
  airportQuizEnabled: true,
  portQuizEnabled: true,
  reservoirQuizEnabled: true,
  lakeQuizEnabled: true,
  settlementQuizEnabled: true
});
for (const poi of TAIWAN_POI_DATA) {
  vm.runInContext(`state.unlockedPois.delete(${JSON.stringify(poi.id)})`, sb);
  const ok = sb.evaluateGuess(getCanonicalPoiInput(poi), false);
  const unlocked = vm.runInContext(`state.unlockedPois.has(${JSON.stringify(poi.id)})`, sb);
  check(ok && unlocked, "6d.CasualAllMixed.PoiDirect", `${poi.id} (${poi.shortName}): fb="${sb.lastFeedback?.text}"`);
}

// 6e. All 326 POIs in casual pure POI mode (no suffix, bare stems + direct)
resetState({
  difficulty: "casual",
  regionQuizEnabled: false,
  stationQuizEnabled: false,
  airportQuizEnabled: true,
  portQuizEnabled: true,
  reservoirQuizEnabled: true,
  lakeQuizEnabled: true,
  settlementQuizEnabled: true
});
for (const poi of TAIWAN_POI_DATA) {
  vm.runInContext(`state.unlockedPois.delete(${JSON.stringify(poi.id)})`, sb);
  const okDirect = sb.evaluateGuess(getCanonicalPoiInput(poi), false);
  const unlockedDirect = vm.runInContext(`state.unlockedPois.has(${JSON.stringify(poi.id)})`, sb);
  check(okDirect && unlockedDirect, "6e.CasualPurePoi.Direct", `${poi.id} (${poi.shortName}): fb="${sb.lastFeedback?.text}"`);

  const cats = poi.categories || [poi.category];
  let bareStem = null;
  if (cats.includes("airport")) {
    bareStem = poi.shortName.replace(/(國際機場|國內機場|空軍基地|陸軍航空基地|航空基地|航空站|機場|基地)$/g, "");
  } else if (cats.includes("port")) {
    bareStem = poi.shortName.replace(/(液化天然氣接收港|液化天然氣接收站|工業專用港|國際商港|天然氣港|工業港|觀光漁港|漁港|商港|港)$/g, "");
  } else if (cats.includes("reservoir")) {
    const s = poi.shortName.replace(/(第二水庫|水庫|攔河堰|人工湖|大壩|壩)$/g, "");
    if (s !== "鯉魚潭") bareStem = s;
  } else if (cats.includes("lake") && poi.shortName.endsWith("湖")) {
    bareStem = poi.shortName.slice(0, -1);
  }
  if (bareStem && bareStem.length >= 2 && bareStem !== poi.shortName) {
    vm.runInContext(`state.unlockedPois.delete(${JSON.stringify(poi.id)})`, sb);
    const okBare = sb.evaluateGuess(bareStem, false);
    const unlockedBare = vm.runInContext(`state.unlockedPois.has(${JSON.stringify(poi.id)})`, sb);
    check(okBare && unlockedBare, "6e.CasualPurePoi.BareStem", `${poi.id} (${poi.shortName}): bare="${bareStem}", fb="${sb.lastFeedback?.text}"`);
  }
}

// 6f. Prefix dropdown hidden & cleared in non-prefix modes (casual, county_only, hard_suffix), visible in prefix-required modes (hard_full, master_hierarchy)
for (const diff of ["casual", "county_only", "hard_suffix"]) {
  resetState({ difficulty: diff, regionQuizEnabled: true, prefix: "臺北市" });
  sb.updatePrefixDropdownUI();
  check(
    sb.document.getElementById("prefix-container").classList.contains("hidden") &&
      sb.document.getElementById("prefix-select").value === "",
    "6f.CasualPrefixHidden",
    `Expected #prefix-container hidden and #prefix-select cleared in ${diff} mode`
  );
}
for (const diff of ["hard_full", "master_hierarchy"]) {
  resetState({ difficulty: diff, regionQuizEnabled: true });
  sb.updatePrefixDropdownUI();
  check(
    !sb.document.getElementById("prefix-container").classList.contains("hidden"),
    "6f.NonCasualPrefixVisible",
    `Expected #prefix-container visible in ${diff} mode`
  );
}

// =========================================================================
// SUMMARY
// =========================================================================

// =========================================================================
// 7. SETTLEMENT (傳統聚落 / 路牌地名) EXHAUSTIVE DETERMINISTIC SUITE
// =========================================================================
const ALL_SETTLEMENTS = TAIWAN_POI_DATA.filter((p) => p.category === "settlement");
const TOWN_BASE_SET = new Set(ALL_TOWNS.map((t) => t.baseName.replace(/台/g, "臺")));
const TOWN_FULL_SET = new Set(ALL_TOWNS.map((t) => t.townName.replace(/台/g, "臺")));

// 7a. Coordinate bounds, subtype distribution & 100% ALL_TOWNS alignment
const signageMajorList = ALL_SETTLEMENTS.filter((p) => p.subTypes.includes("signage_major"));
const historicOazaList = ALL_SETTLEMENTS.filter((p) => p.subTypes.includes("historic_oaza"));
check(
  signageMajorList.length >= 100 && signageMajorList.length <= 120,
  "7a.Settlement.SubTypeCounts",
  `Expected signage_major 100..120, got ${signageMajorList.length}`
);
check(
  historicOazaList.length >= 80 && historicOazaList.length <= 130,
  "7a.Settlement.SubTypeCounts",
  `Expected historic_oaza 80..130, got ${historicOazaList.length}`
);
const seenStlIds = new Set();
for (const stl of ALL_SETTLEMENTS) {
  check(!seenStlIds.has(stl.id), "7a.Settlement.UniqueId", `Duplicate id: ${stl.id}`);
  seenStlIds.add(stl.id);
  check(
    typeof stl.lat === "number" && stl.lat >= 21.8 && stl.lat <= 26.5 &&
      typeof stl.lng === "number" && stl.lng >= 118.0 && stl.lng <= 122.2,
    "7a.Settlement.CoordBounds",
    `${stl.id} (${stl.name}) out of Taiwan bounds: (${stl.lat}, ${stl.lng})`
  );
  const resolvedTownId = sb.resolvePoiTownId(stl);
  check(
    Boolean(resolvedTownId),
    "7a.Settlement.AdminAlignment",
    `${stl.id} (${stl.name}) countyName+townName not found in ALL_TOWNS: ${stl.countyName}${stl.townName}`
  );
}

// 7b. Strict zero-collision with 368 town baseName / townName
for (const stl of ALL_SETTLEMENTS) {
  const namesToCheck = [stl.name, stl.shortName, ...(stl.aliases || [])];
  for (const nm of namesToCheck) {
    const norm = nm.replace(/台/g, "臺");
    check(
      !TOWN_BASE_SET.has(norm) && !TOWN_FULL_SET.has(norm),
      "7b.Settlement.NoTownCollision",
      `${stl.id} alias "${nm}" collides with a 368 town baseName/townName`
    );
  }
}

// 7c. Signage shortName <-> Historic Oaza fullName dual-alias matching across difficulties
const aliasPairs = [
  ["stl_lushang", "路上", "路上厝"],
  ["stl_shifen", "十分", "十分寮"],
  ["stl_laohukou", "老湖口", "大窩口"],
  ["stl_tianxiang", "天祥", "塔比多"],
  ["stl_zhiben", "知本", "卡大地布"],
  ["stl_sankeng", "三坑", "三坑子"],
  ["stl_itathao", "伊達邵", "德化社"]
];
for (const diff of ["casual", "hard_suffix", "hard_full"]) {
  resetState({ difficulty: diff, regionQuizEnabled: false, settlementQuizEnabled: true });
  for (const [id, a1, a2] of aliasPairs) {
    vm.runInContext(`state.unlockedPois.delete(${JSON.stringify(id)})`, sb);
    const ok1 = sb.evaluateGuess(a1, false);
    const u1 = vm.runInContext(`state.unlockedPois.has(${JSON.stringify(id)})`, sb);
    check(ok1 && u1, `7c.Settlement.DualAlias(${diff})`, `${id} alias1="${a1}", fb="${sb.lastFeedback?.text}"`);

    vm.runInContext(`state.unlockedPois.delete(${JSON.stringify(id)})`, sb);
    const ok2 = sb.evaluateGuess(a2, false);
    const u2 = vm.runInContext(`state.unlockedPois.has(${JSON.stringify(id)})`, sb);
    check(ok2 && u2, `7c.Settlement.DualAlias(${diff})`, `${id} alias2="${a2}", fb="${sb.lastFeedback?.text}"`);
  }
}

// 7d. Duplicate settlement name disambiguation (楊梅富岡 vs 臺東富岡, 新竹南寮 vs 湖西南寮)
for (const diff of ["casual", "hard_suffix", "hard_full"]) {
  resetState({ difficulty: diff, regionQuizEnabled: false, settlementQuizEnabled: true });

  // Bare "富岡" must NOT unlock either stl_fugang_ty or stl_fugang_tt
  const bareFugang = sb.evaluateGuess("富岡", false);
  const tyAfterBare = vm.runInContext('state.unlockedPois.has("stl_fugang_ty")', sb);
  const ttAfterBare = vm.runInContext('state.unlockedPois.has("stl_fugang_tt")', sb);
  check(
    !bareFugang && !tyAfterBare && !ttAfterBare,
    `7d.Settlement.DisambigBare(${diff})`,
    `Bare "富岡" should not lock either settlement (ty=${tyAfterBare}, tt=${ttAfterBare})`
  );

  // Prefixed "楊梅富岡" unlocks ONLY stl_fugang_ty
  const okTy = sb.evaluateGuess("楊梅富岡", false);
  const tyNow = vm.runInContext('state.unlockedPois.has("stl_fugang_ty")', sb);
  const ttStillFalse = !vm.runInContext('state.unlockedPois.has("stl_fugang_tt")', sb);
  check(okTy && tyNow && ttStillFalse, `7d.Settlement.DisambigPrefix(${diff})`, `"楊梅富岡" failed: fb="${sb.lastFeedback?.text}"`);

  // Prefixed "臺東富岡" unlocks ONLY stl_fugang_tt
  const okTt = sb.evaluateGuess("臺東富岡", false);
  const ttNow = vm.runInContext('state.unlockedPois.has("stl_fugang_tt")', sb);
  check(okTt && ttNow, `7d.Settlement.DisambigPrefix(${diff})`, `"臺東富岡" failed: fb="${sb.lastFeedback?.text}"`);

  // Same for "南寮" (新竹南寮 vs 湖西南寮)
  const bareNanliao = sb.evaluateGuess("南寮", false);
  const hcAfterBare = vm.runInContext('state.unlockedPois.has("stl_nanliao")', sb);
  const phAfterBare = vm.runInContext('state.unlockedPois.has("stl_nanliao_ph")', sb);
  check(!bareNanliao && !hcAfterBare && !phAfterBare, `7d.Settlement.DisambigBare(${diff})`, `Bare "南寮" should not lock either`);

  const okHc = sb.evaluateGuess("新竹南寮", false);
  const okPh = sb.evaluateGuess("湖西南寮", false);
  check(
    okHc && okPh &&
      vm.runInContext('state.unlockedPois.has("stl_nanliao")', sb) &&
      vm.runInContext('state.unlockedPois.has("stl_nanliao_ph")', sb),
    `7d.Settlement.DisambigPrefix(${diff})`,
    `"新竹南寮" / "湖西南寮" failed`
  );
}

// 7e. Cross-category mixed-mode collision guard (Settlement + Station + Port + Airport + Town all ON)
resetState({
  difficulty: "hard_suffix",
  regionQuizEnabled: true,
  stationQuizEnabled: true,
  airportQuizEnabled: true,
  portQuizEnabled: true,
  reservoirQuizEnabled: true,
  lakeQuizEnabled: true,
  settlementQuizEnabled: true
});
const mixedChecks = [
  { input: "知本", expectPoi: "stl_zhiben" },
  { input: "知本站", expectStationBase: "知本" },
  { input: "內壢", expectPoi: "stl_neili" },
  { input: "內壢站", expectStationBase: "內壢" },
  { input: "福隆", expectPoi: "stl_fulong" },
  { input: "福隆站", expectStationBase: "福隆" },
  { input: "福隆漁港", expectPoi: "pt_c2_44" },
  { input: "王功", expectPoi: "stl_wanggong" },
  { input: "王功漁港", expectPoi: "pt_wanggong" },
  { input: "楊梅富岡", expectPoi: "stl_fugang_ty" },
  { input: "臺東富岡", expectPoi: "stl_fugang_tt" },
  { input: "富岡站", expectStationBase: "富岡" },
  { input: "富岡漁港", expectPoi: "pt_fugang" },
  { input: "清泉崗", expectPoi: "stl_qingquangang" },
  { input: "清泉崗機場", expectPoi: "ap_rmq" }
];
for (const mc of mixedChecks) {
  const ok = sb.evaluateGuess(mc.input, false);
  if (mc.expectPoi) {
    const u = vm.runInContext(`state.unlockedPois.has(${JSON.stringify(mc.expectPoi)})`, sb);
    check(ok && u, "7e.Settlement.MixedCollision(hard_suffix)", `input="${mc.input}" expected POI ${mc.expectPoi}, fb="${sb.lastFeedback?.text}"`);
  } else if (mc.expectStationBase) {
    const u = vm.runInContext(
      `Array.from(state.unlockedStations).some(k => k.includes(${JSON.stringify(mc.expectStationBase)}))`,
      sb
    );
    check(ok && u, "7e.Settlement.MixedCollision(hard_suffix)", `input="${mc.input}" expected Station ${mc.expectStationBase}, fb="${sb.lastFeedback?.text}"`);
  }
}

// 7f. Pure settlement mode does NOT force administrative quick suffixes
resetState({ difficulty: "hard_suffix", regionQuizEnabled: false, settlementQuizEnabled: true });
const stlQuickSuffixes = sb.getActiveQuickSuffixes();
check(
  stlQuickSuffixes.length === 1 && stlQuickSuffixes[0] === "",
  "7f.Settlement.NoForcedAdminSuffix",
  `Expected [""], got ${JSON.stringify(stlQuickSuffixes)}`
);

// =========================================================================
// SECTION 8: Port Quick Suffix Consolidation, Anti-Spoiler & County Lock
// =========================================================================

// 8a. Quick suffix bar keeps only "港" (not "漁港"), while fishery ports & Anping/Hualien exceptions still work
resetState({ difficulty: "hard_suffix", regionQuizEnabled: false, portQuizEnabled: true });
const portQuickSuffixes = sb.getActiveQuickSuffixes();
check(
  portQuickSuffixes.includes("港") && !portQuickSuffixes.includes("漁港"),
  "8a.Port.SingleQuickSuffix",
  `Expected ["", "港"], got ${JSON.stringify(portQuickSuffixes)}`
);
sb.document.getElementById("suffix-input").value = "港";
const okZhengbin = sb.evaluateGuess("正濱", false);
const okAnpingPort = sb.evaluateGuess("安平", false);
const okAnpingFishery = sb.evaluateGuess("安平漁港", false);
check(
  okZhengbin && okAnpingPort && okAnpingFishery &&
    vm.runInContext("state.unlockedPois.has(\"pt_zhengbin\") && state.unlockedPois.has(\"pt_anping\") && state.unlockedPois.has(\"pt_anping_fish\")", sb),
  "8a.Port.QuickSuffixAndExceptions",
  `zhengbin=${okZhengbin}, anping=${okAnpingPort}, anpingFish=${okAnpingFishery}`
);

// 8b. Anti-spoiler: hard modes with regionQuizEnabled hide county/town in unlock & click feedback; casual/pure-POI still show it
resetState({ difficulty: "hard_suffix", regionQuizEnabled: true, lakeQuizEnabled: true });
const okLakeHard = sb.evaluateGuess("日月潭", false);
const lakeHardFb = sb.lastFeedback?.text || "";
check(
  okLakeHard && !lakeHardFb.includes("南投縣") && !lakeHardFb.includes("魚池鄉"),
  "8b.Poi.AntiSpoilerUnlock(hard_suffix)",
  `fb="${lakeHardFb}"`
);
const sunMoonPoi = TAIWAN_POI_DATA.find((p) => p.id === "lk_sunmoon");
sb.handlePoiMarkerClick(sunMoonPoi);
const lakeClickHardFb = sb.lastFeedback?.text || "";
check(
  !lakeClickHardFb.includes("南投縣") && !lakeClickHardFb.includes("魚池鄉"),
  "8b.Poi.AntiSpoilerClick(hard_suffix)",
  `fb="${lakeClickHardFb}"`
);

resetState({ difficulty: "hard_suffix", regionQuizEnabled: false, lakeQuizEnabled: true });
const okLakePure = sb.evaluateGuess("日月潭", false);
const lakePureFb = sb.lastFeedback?.text || "";
check(
  okLakePure && lakePureFb.includes("南投縣") && lakePureFb.includes("魚池鄉"),
  "8b.Poi.ShowLocationInPurePoiMode",
  `fb="${lakePureFb}"`
);

// 8c. County unlock prerequisite for POI & Station in hard_full & master_hierarchy (when regionQuizEnabled is true)
for (const diff of ["hard_full", "master_hierarchy"]) {
  resetState({
    difficulty: diff,
    regionQuizEnabled: true,
    stationQuizEnabled: true,
    quizStationLines: new Set(["tra_west"]),
    lakeQuizEnabled: true,
    airportQuizEnabled: true
  });

  // Before unlocking 桃園市 / 南投縣: both POI and Station should be blocked without leaking county name
  const lockedPoiTry = sb.evaluateGuess("桃園機場", false);
  const lockedPoiFb = sb.lastFeedback?.text || "";
  const lockedStTry = sb.evaluateGuess("桃園站", false);
  const lockedStFb = sb.lastFeedback?.text || "";
  check(
    !lockedPoiTry && lockedPoiFb.includes("縣市未解鎖") && !lockedPoiFb.includes("桃園市"),
    `8c.CountyLock.PoiBlocked(${diff})`,
    `ok=${lockedPoiTry}, fb="${lockedPoiFb}"`
  );
  check(
    !lockedStTry && lockedStFb.includes("縣市未解鎖") && !lockedStFb.includes("桃園市"),
    `8c.CountyLock.StationBlocked(${diff})`,
    `ok=${lockedStTry}, fb="${lockedStFb}"`
  );

  // Unlock 桃園市 (via hierarchy in master_hierarchy or direct county in hard_full)
  if (diff === "master_hierarchy") {
    sb.evaluateGuess("桃園市", false);
  } else {
    sb.evaluateGuess("桃園市", false);
  }
  const unlockedPoiTry = sb.evaluateGuess("桃園機場", false);
  const unlockedPoiFb = sb.lastFeedback?.text || "";
  const unlockedStTry = sb.evaluateGuess("桃園站", false);
  check(
    unlockedPoiTry && !unlockedPoiFb.includes("桃園市") && !unlockedPoiFb.includes("大園區"),
    `8c.CountyLock.PoiUnlockedAfterCounty(${diff})`,
    `ok=${unlockedPoiTry}, fb="${unlockedPoiFb}"`
  );
  check(
    unlockedStTry && vm.runInContext("Array.from(state.unlockedStations).some(k => k.includes(\"桃園\"))", sb),
    `8c.CountyLock.StationUnlockedAfterCounty(${diff})`,
    `ok=${unlockedStTry}, fb="${sb.lastFeedback?.text}"`
  );
}

const elapsedMs = Date.now() - t0;
console.log(`Ran ${totalChecks} exhaustive checks in ${elapsedMs}ms (${ALL_TOWNS.length} towns, ${allStations.length} stations, ${TAIWAN_POI_DATA.length} POIs).`);
if (failures.length > 0) {
  const byCat = {};
  for (const f of failures) {
    if (!byCat[f.category]) byCat[f.category] = [];
    byCat[f.category].push(f.detail);
  }
  console.error(`FAILED: ${failures.length} failures.`);
  for (const [cat, list] of Object.entries(byCat)) {
    console.error(`\n[${cat}] (${list.length}):`);
    list.slice(0, 20).forEach((d) => console.error("  - " + d));
  }
  process.exit(1);
}
console.log("ALL EXHAUSTIVE TESTS PASSED!");
