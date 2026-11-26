// =========================================================================
// TDD SUITE: China, ROC 1949 & World Capitals Quiz (data/capital-data.js)
// Verifies dataset completeness, matching (TC/SC/EN/historical aliases),
// pack option filtering (microstates, Mongolia, composite tw+roc),
// region filtering, play modes (free, target_random, satellite, pin_drop),
// UI topic chip visibility/labeling, dashboard stats/grading, and P2P sync.
// =========================================================================
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

let passed = 0;
let failed = 0;
const failures = [];

function check(cond, group, msg) {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(`[${group}] ${msg}`);
  }
}

function createMockElement(id = "", tag = "div") {
  const classes = new Set();
  const attrs = new Map();
  const children = [];
  const el = {
    id,
    tagName: tag.toUpperCase(),
    textContent: "",
    value: "",
    checked: false,
    disabled: false,
    style: {},
    children,
    classList: {
      add: (...cs) => cs.forEach((c) => classes.add(c)),
      remove: (...cs) => cs.forEach((c) => classes.delete(c)),
      contains: (c) => classes.has(c),
      toggle: (c, force) => {
        if (force === undefined) {
          if (classes.has(c)) classes.delete(c);
          else classes.add(c);
        } else if (force) classes.add(c);
        else classes.delete(c);
      }
    },
    setAttribute: (k, v) => attrs.set(k, String(v)),
    getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
    appendChild: (ch) => {
      children.push(ch);
      return ch;
    },
    replaceChildren: (...chs) => {
      children.length = 0;
      children.push(...chs);
    },
    MutationObserver: class { observe() {} disconnect() {} },
  ResizeObserver: class { observe() {} disconnect() {} },
  addEventListener: () => {},
    focus: () => {},
    querySelector: (sel) => {
      for (const ch of children) {
        if (sel === ".capital-topic-label" && ch.classList.contains("capital-topic-label")) return ch;
        if (sel === ".geo-solo-btn" && ch.classList.contains("geo-solo-btn")) return ch;
        if (sel === ".geo-union-btn" && ch.classList.contains("geo-union-btn")) return ch;
        if (sel === ".topic-check" && ch.classList.contains("topic-check")) return ch;
        if (sel === ".geo-solo-btn span" && ch.classList.contains("geo-solo-btn")) return ch.children[0] || null;
        if (sel === "span" && ch.tagName === "SPAN") return ch;
        const deep = ch.querySelector ? ch.querySelector(sel) : null;
        if (deep) return deep;
      }
      return null;
    },
    querySelectorAll: () => [],
    remove: () => {}
  };
  return el;
}

const elements = {};
function getEl(id) {
  if (!elements[id]) elements[id] = createMockElement(id);
  return elements[id];
}

// Create topic chip mock elements
const topicChips = {};
["region", "station", "airport", "port", "reservoir", "lake", "settlement", "capital"].forEach((topic) => {
  const card = createMockElement(`topic-${topic}`);
  card.classList.add("topic-chip-btn");
  card.setAttribute("data-topic", topic);
  const soloBtn = createMockElement("", "button");
  soloBtn.classList.add("geo-solo-btn");
  const lbl = createMockElement("", "span");
  if (topic === "capital") lbl.classList.add("capital-topic-label");
  soloBtn.appendChild(lbl);
  const unionBtn = createMockElement("", "button");
  unionBtn.classList.add("geo-union-btn");
  const chk = createMockElement("", "span");
  chk.classList.add("topic-check");
  unionBtn.appendChild(chk);
  card.appendChild(soloBtn);
  card.appendChild(unionBtn);
  topicChips[topic] = card;
});

const sandbox = {
  console,
  MutationObserver: class { observe() {} disconnect() {} },
  ResizeObserver: class { observe() {} disconnect() {} },
  Math,
  Date,
  Set,
  Map,
  Array,
  Object,
  JSON,
  Promise,
  RegExp,
  Number,
  String,
  Boolean,
  Error,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  setTimeout: (fn) => 0,
  clearTimeout: () => {},
  setInterval: () => 0,
  clearInterval: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  matchMedia: () => ({ matches: false, addEventListener: () => {} }),
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  screen: { width: 1920, height: 1080, colorDepth: 24 },
  Intl,
  navigator: { userAgent: "node", language: "zh-TW" },
  location: { href: "file:///index.html", search: "", protocol: "file:" },
  L: {
    latLngBounds: (pts) => ({ isValid: () => Array.isArray(pts) && pts.length > 0, pad: function () { return this; } }),
    layerGroup: () => ({ addTo: () => ({ clearLayers: () => {}, removeLayer: () => {} }) }),
    divIcon: (opts) => opts,
    marker: () => ({ on: () => {}, addTo: () => {} })
  },
  document: {
    readyState: "loading",
    addEventListener: () => {},
    removeEventListener: () => {},
    getElementById: (id) => getEl(id),
    createElement: (tag) => createMockElement("", tag),
    querySelectorAll: (sel) => {
      if (sel === ".topic-chip-btn") return Object.values(topicChips);
      const m = sel.match(/\.topic-chip-btn\[data-topic="([^"]+)"\]/);
      if (m && topicChips[m[1]]) return [topicChips[m[1]]];
      return [];
    },
    querySelector: () => null,
    head: { appendChild: () => {} },
    body: { classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false } }
  }
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;

const rootDir = path.resolve(__dirname, "..");
const loadOrder = [
  "data/admin-data.js",
  "data/railisland-shapes.js",
  "data/transport-data.js",
  "data/poi-data.js",
  "data/capital-data.js",
  "js/map-pack-registry.js",
  "data/packs/jp-pref-pack.js",
  "data/packs/cn-prov-pack.js",
  "data/packs/roc-1949-pack.js",
  "data/packs/world-countries-pack.js",
  "js/state.js",
  "js/poi-engine.js",
  "js/pindrop-engine.js",
  "js/game-logic.js",
  "js/dashboard-ui.js",
  "js/p2p-engine.js",
  "js/ui-controls.js"
];

const ctx = vm.createContext(sandbox);
for (const rel of loadOrder) {
  const code = fs.readFileSync(path.join(rootDir, rel), "utf8");
  vm.runInContext(code, ctx, { filename: rel });
}
vm.runInContext("window.TAIWAN_POI_DATA = TAIWAN_POI_DATA; window.CAPITAL_POI_DATA = CAPITAL_POI_DATA; window.state = state;", ctx);

// Stub map-dependent functions for headless testing
sandbox.refreshAllPolygonStyles = () => {};
sandbox.updateRoadAndRailwayTileOverlays = () => {};
sandbox.focusMapOnLatLng = () => {};
sandbox.applySatelliteTargetViewport = () => {};
sandbox.clearSatelliteTargetMarker = () => {};
sandbox.setFeedback = (msg, type) => {
  sandbox.__lastFeedback = { msg, type };
};
sandbox.triggerWrongFeedback = (msg) => {
  sandbox.__lastWrong = msg;
};
sandbox.playTone = () => {};
sandbox.renderSmartLabelsAndLeaderLines = () => {};

(async () => {
  // =========================================================================
  // 1. DATASET INTEGRITY
  // =========================================================================
  const allCaps = sandbox.CAPITAL_POI_DATA;
  check(Array.isArray(allCaps) && allCaps.length === 308, "1.Data", `Expected 308 capitals, got ${allCaps && allCaps.length}`);
  check(sandbox.getCapitalPoisForPack("jp_pref").length === 47, "1.Data", "jp_pref has 47 prefectural capitals");
  check(sandbox.getCapitalPoisForPack("cn_prov").length === 27, "1.Data", "cn_prov has 27 provincial/AR capitals");
  check(sandbox.getCapitalPoisForPack("roc_1949").length === 38, "1.Data", "roc_1949 has 38 provincial/area/SAR capitals");
  check(sandbox.getCapitalPoisForPack("world_countries").length === 196, "1.Data", "world_countries has 196 national capitals");

  // Unique IDs across TAIWAN_POI_DATA + CAPITAL_POI_DATA
  const allIds = new Set(sandbox.TAIWAN_POI_DATA.map((p) => p.id));
  let idDupes = 0;
  allCaps.forEach((c) => {
    if (allIds.has(c.id)) idDupes++;
    allIds.add(c.id);
  });
  check(idDupes === 0, "1.Data", "Zero ID collisions between Taiwan POIs and Capital POIs");

  // =========================================================================
  // 2. CHINA PROVINCIAL CAPITALS (cn_prov)
  // =========================================================================
  await sandbox.switchActiveMapPack("cn_prov", { skipPaintYield: true });
  check(sandbox.getActivePackFeatures().supportsCapitalQuiz === true, "2.CN", "cn_prov supportsCapitalQuiz is true");
  check(sandbox.getActivePackFeatures().supportsPoiQuiz === false, "2.CN", "cn_prov supportsPoiQuiz stays false");
  sandbox.applyActivePackFeatureGatingUI();
  check(!getEl("topic-selector-card").classList.contains("hidden"), "2.CN", "#topic-selector-card visible on cn_prov");
  check(!topicChips.capital.classList.contains("hidden"), "2.CN", "capital chip visible on cn_prov");
  check(topicChips.airport.classList.contains("hidden"), "2.CN", "Taiwan airport chip hidden on cn_prov");
  check(topicChips.capital.querySelector(".capital-topic-label").textContent === "🏛️ 省會", "2.CN", "capital chip labeled 🏛️ 省會 on cn_prov");

  // Enable pure capital quiz on cn_prov
  sandbox.state.regionQuizEnabled = false;
  sandbox.state.capitalQuizEnabled = true;
  sandbox.state.unlockedPois.clear();
  check(sandbox.getActiveQuizPois().length === 27, "2.CN", "Active CN capital pool has 27 items");
  check(sandbox.getActiveQuizPois("capital").length === 27, "2.CN", "Category filter 'capital' returns 27 items");

  // Test Traditional, Simplified, English, and '市' suffix matching
  const cnTests = [
    ["石家莊", "cap_cn_prov_cn_130000"],
    ["石家庄市", "cap_cn_prov_cn_130000"], // already unlocked check next
    ["乌鲁木齐", "cap_cn_prov_cn_650000"],
    ["呼和浩特市", "cap_cn_prov_cn_150000"],
    ["Hangzhou", "cap_cn_prov_cn_330000"],
    ["沈阳", "cap_cn_prov_cn_210000"],
    ["哈尔滨", "cap_cn_prov_cn_230000"],
    ["拉萨", "cap_cn_prov_cn_540000"]
  ];
  for (const [inp, expectedId] of cnTests) {
    sandbox.state.unlockedPois.clear();
    const res = sandbox.tryMatchAndUnlockPoi(inp, false);
    check(res.matched && res.poi && res.poi.id === expectedId, "2.CN.Match", `Input "${inp}" -> ${expectedId} (got ${res.poi && res.poi.id})`);
  }

  // Test regional filtering (only 華東 provinces -> 6 provincial capitals: 南京/杭州/合肥/福州/南昌/濟南)
  sandbox.state.regionQuizEnabled = true;
  sandbox.state.filterStationsByRegion = true;
  const huadongIds = sandbox.getActiveItems().filter((it) => it.countyName === "華東").map((it) => it.id);
  sandbox.state.selectedTownIds = new Set(huadongIds);
  sandbox.state.selectedCounties = new Set(["華東"]);
  const huadongCaps = sandbox.getActiveQuizPois("capital");
  check(huadongCaps.length === 6, "2.CN.RegionFilter", `華東 should have 6 provincial capitals, got ${huadongCaps.length}`);

  // Test grading title on CN capital mode
  sandbox.state.regionQuizEnabled = false;
  sandbox.state.filterStationsByRegion = false;
  const cnTheme = sandbox.detectPoiThemeProfile();
  check(cnTheme && cnTheme.scopeLabel === "中國省會與首府", "2.CN.Grading", `Expected 中國省會與首府, got ${cnTheme && cnTheme.scopeLabel}`);

  // =========================================================================
  // 3. ROC 1949 PROVINCIAL CAPITALS (roc_1949)
  // =========================================================================
  await sandbox.switchActiveMapPack("roc_1949", { skipPaintYield: true });
  sandbox.state.packOptions.rocTerritoryVariant = "full_50";
  sandbox.state.regionQuizEnabled = false;
  sandbox.state.capitalQuizEnabled = true;
  sandbox.state.unlockedPois.clear();
  check(sandbox.getActiveQuizPois("capital").length === 38, "3.ROC", "ROC 1949 with Mongolia has 38 capitals");

  // Historical capital matching checks
  const rocTests = [
    ["鎮江", "cap_roc_1949_roc_jiangsu"],
    ["武昌", "cap_roc_1949_roc_hubei"],
    ["清苑", "cap_roc_1949_roc_hebei"],
    ["保定", "cap_roc_1949_roc_hebei"],
    ["歸綏", "cap_roc_1949_roc_suiyuan"],
    ["張垣", "cap_roc_1949_roc_chahar"],
    ["张家口", "cap_roc_1949_roc_chahar"],
    ["迪化", "cap_roc_1949_roc_xinjiang"],
    ["庫倫", "cap_roc_1949_roc_mongolia"],
    ["海拉爾", "cap_roc_1949_roc_xingan"],
    ["齊齊哈爾", "cap_roc_1949_roc_nenjiang"],
    ["北安", "cap_roc_1949_roc_heilongjiang"],
    ["佳木斯", "cap_roc_1949_roc_hejiang"],
    ["牡丹江", "cap_roc_1949_roc_songjiang"],
    ["遼源", "cap_roc_1949_roc_liaobei"],
    ["通化", "cap_roc_1949_roc_andong"],
    ["康定", "cap_roc_1949_roc_xikang"],
    ["開封", "cap_roc_1949_roc_henan"],
    ["桂林", "cap_roc_1949_roc_guangxi"],
    ["台北", "cap_roc_1949_roc_taiwan"]
  ];
  for (const [inp, expectedId] of rocTests) {
    sandbox.state.unlockedPois.clear();
    const res = sandbox.tryMatchAndUnlockPoi(inp, false);
    check(res.matched && res.poi && res.poi.id === expectedId, "3.ROC.Match", `Input "${inp}" -> ${expectedId} (got ${res.poi && res.poi.id})`);
  }

  // Excluding Mongolia removes 庫倫 (38 -> 37)
  sandbox.state.packOptions.rocTerritoryVariant = "no_mongolia";
  const rocNoMng = sandbox.getActiveQuizPois("capital");
  check(rocNoMng.length === 37 && !rocNoMng.some((p) => p.parentItemId === "roc_mongolia"), "3.ROC.Option", "rocTerritoryVariant=no_mongolia excludes 庫倫 (37 left)");
  sandbox.state.packOptions.rocTerritoryVariant = "full_50";

  // Composite tw_modern + roc_1949 excludes roc_taiwan -> excludes 臺北 (37 left)
  await sandbox.switchActiveMapPack(["tw_modern", "roc_1949"], { skipPaintYield: true });
  sandbox.state.capitalQuizEnabled = true;
  const comboRocCaps = sandbox.getActiveQuizPois("capital");
  check(comboRocCaps.length === 37 && !comboRocCaps.some((p) => p.parentItemId === "roc_taiwan"), "3.ROC.Composite", "tw_modern+roc_1949 excludes roc_taiwan capital (37 left)");

  // =========================================================================
  // 4. WORLD CAPITALS (world_countries)
  // =========================================================================
  await sandbox.switchActiveMapPack("world_countries", { skipPaintYield: true });
  sandbox.state.packOptions.worldIncludeMicrostates = true;
  sandbox.applyActivePackFeatureGatingUI();
  check(!getEl("topic-selector-card").classList.contains("hidden"), "4.World", "#topic-selector-card visible on world_countries");
  check(!topicChips.capital.classList.contains("hidden"), "4.World", "capital chip visible on world_countries");
  check(topicChips.capital.querySelector(".capital-topic-label").textContent === "🏛️ 首都", "4.World", "capital chip labeled 🏛️ 首都 on world_countries");
  check(topicChips.region.querySelector(".geo-solo-btn span").textContent === "🌍 國家", "4.World", "region chip labeled 🌍 國家 on world_countries");

  sandbox.state.regionQuizEnabled = false;
  sandbox.state.capitalQuizEnabled = true;
  sandbox.state.unlockedPois.clear();
  check(sandbox.getActiveQuizPois("capital").length === 196, "4.World", "Full world capital pool has 196 items");

  // World capital matching (TC, SC, EN, diacritics, multi-capitals)
  const worldTests = [
    ["台北", "cap_world_countries_TWN"],
    ["東京", "cap_world_countries_JPN"],
    ["东京", "cap_world_countries_JPN"],
    ["Tokyo", "cap_world_countries_JPN"],
    ["首爾", "cap_world_countries_KOR"],
    ["華盛頓", "cap_world_countries_USA"],
    ["Washington, D.C.", "cap_world_countries_USA"],
    ["坎培拉", "cap_world_countries_AUS"],
    ["堪培拉", "cap_world_countries_AUS"],
    ["威靈頓", "cap_world_countries_NZL"],
    ["惠灵顿", "cap_world_countries_NZL"],
    ["雷克雅維克", "cap_world_countries_ISL"],
    ["Reykjavík", "cap_world_countries_ISL"],
    ["開普敦", "cap_world_countries_ZAF"],
    ["普勒托利亞", "cap_world_countries_ZAF"],
    ["拉巴斯", "cap_world_countries_BOL"],
    ["蘇克雷", "cap_world_countries_BOL"],
    ["海牙", "cap_world_countries_NLD"],
    ["阿姆斯特丹", "cap_world_countries_NLD"],
    ["巴黎", "cap_world_countries_FRA"]
  ];
  for (const [inp, expectedId] of worldTests) {
    sandbox.state.unlockedPois.clear();
    const res = sandbox.tryMatchAndUnlockPoi(inp, false);
    check(res.matched && res.poi && res.poi.id === expectedId, "4.World.Match", `Input "${inp}" -> ${expectedId} (got ${res.poi && res.poi.id})`);
  }

  // Excluding microstates filters out microstate capitals (196 - microstates)
  sandbox.state.packOptions.worldIncludeMicrostates = false;
  const stdWorldCaps = sandbox.getActiveQuizPois("capital");
  const expectedStdCount = sandbox.getActiveItems().filter((it) => !it.isMicrostate).length;
  check(stdWorldCaps.length === expectedStdCount, "4.World.Microstates", `Standard world capitals=${stdWorldCaps.length}, expected ${expectedStdCount}`);
  check(!stdWorldCaps.some((p) => p.parentItemId === "VAT"), "4.World.Microstates", "Vatican City excluded when microstates OFF");
  sandbox.state.packOptions.worldIncludeMicrostates = true;

  // Continent filtering (Europe = 44 capitals)
  sandbox.state.regionQuizEnabled = true;
  sandbox.state.filterStationsByRegion = true;
  const europeIds = sandbox.getActiveItems().filter((it) => it.countyName === "歐洲").map((it) => it.id);
  sandbox.state.selectedTownIds = new Set(europeIds);
  sandbox.state.selectedCounties = new Set(["歐洲"]);
  check(sandbox.getActiveQuizPois("capital").length === 44, "4.World.ContinentFilter", `Europe capitals should be 44, got ${sandbox.getActiveQuizPois("capital").length}`);

  // =========================================================================
  // 5. PLAY MODES (Free Mixed, Target Random, Pin Drop) & P2P SYNC
  // =========================================================================
  // Mixed free recall: typing 巴黎 unlocks France's capital cleanly
  sandbox.state.playMode = "free";
  sandbox.state.unlockedPois.clear();
  sandbox.state.unlockedTowns.clear();
  const evalOk = sandbox.evaluateGuess("巴黎", false);
  check(evalOk === true && sandbox.state.unlockedPois.has("cap_world_countries_FRA"), "5.Modes.FreeMixed", "evaluateGuess('巴黎') unlocks cap_world_countries_FRA in mixed mode");

  // Pin Drop: duplicate capital name '達卡' (BGD & SEN) is disambiguated with country name
  sandbox.state.regionQuizEnabled = false;
  sandbox.state.filterStationsByRegion = false;
  const pinPool = sandbox.buildPinDropCandidatePool();
  check(pinPool.length === 196, "5.Modes.PinDrop", `Pin Drop pure world capital pool has 196 targets (got ${pinPool.length})`);
  const bgdPin = pinPool.find((x) => x.rawId === "cap_world_countries_BGD");
  const senPin = pinPool.find((x) => x.rawId === "cap_world_countries_SEN");
  check(bgdPin && bgdPin.promptTitle.includes("孟加拉") && bgdPin.promptTitle.includes("達卡"), "5.Modes.PinDrop", `BGD Dhaka disambiguated: ${bgdPin && bgdPin.promptTitle}`);
  check(senPin && senPin.promptTitle.includes("塞內加爾") && senPin.promptTitle.includes("達卡"), "5.Modes.PinDrop", `SEN Dakar disambiguated: ${senPin && senPin.promptTitle}`);

  // Target random queue includes capital POIs
  sandbox.state.playMode = "target_random";
  const q = sandbox.buildTargetQuizQueue(10);
  check(q.length === 10 && q.every((e) => e.kind === "poi" && e.id.startsWith("cap_world_countries_")), "5.Modes.TargetRandom", "Shuffled target pool contains 10 world capital POIs");

  // =========================================================================
  // 5b. JAPAN 47 PREFECTURAL CAPITALS (jp_pref)
  // =========================================================================
  const snap = sandbox.getHostSyncConfig();
  check(snap.capitalQuizEnabled === true, "5.P2P", "getHostSyncConfig includes capitalQuizEnabled=true");

  await sandbox.switchActiveMapPack("jp_pref", { skipPaintYield: true });
  sandbox.applyActivePackFeatureGatingUI();
  check(sandbox.getActivePackFeatures().supportsCapitalQuiz === true, "5b.JP", "jp_pref supportsCapitalQuiz is true");
  check(!topicChips.capital.classList.contains("hidden"), "5b.JP", "capital chip visible on jp_pref");
  check(topicChips.capital.querySelector(".capital-topic-label").textContent === "🏛️ 縣廳", "5b.JP", "capital chip labeled 🏛️ 縣廳 on jp_pref");

  sandbox.state.playMode = "free";
  sandbox.state.targetPoiId = null;
  sandbox.state.regionQuizEnabled = false;
  sandbox.state.capitalQuizEnabled = true;
  sandbox.state.unlockedPois.clear();
  check(sandbox.getActiveQuizPois("capital").length === 47, "5b.JP", "Active JP prefectural capital pool has 47 items");

  const jpTests = [
    ["札幌", "cap_jp_pref_jp_01"],
    ["さっぽろ", "cap_jp_pref_jp_01"],
    ["盛岡", "cap_jp_pref_jp_03"],
    ["仙台", "cap_jp_pref_jp_04"],
    ["水戸", "cap_jp_pref_jp_08"],
    ["宇都宮", "cap_jp_pref_jp_09"],
    ["新宿", "cap_jp_pref_jp_13"],
    ["東京", "cap_jp_pref_jp_13"],
    ["横浜", "cap_jp_pref_jp_14"],
    ["橫濱市", "cap_jp_pref_jp_14"],
    ["金沢", "cap_jp_pref_jp_17"],
    ["名古屋", "cap_jp_pref_jp_23"],
    ["津", "cap_jp_pref_jp_24"],
    ["津市", "cap_jp_pref_jp_24"],
    ["Tsu", "cap_jp_pref_jp_24"],
    ["神戸", "cap_jp_pref_jp_28"],
    ["那覇", "cap_jp_pref_jp_47"],
    ["那霸", "cap_jp_pref_jp_47"]
  ];
  for (const [inp, expectedId] of jpTests) {
    sandbox.state.unlockedPois.clear();
    const res = sandbox.tryMatchAndUnlockPoi(inp, false);
    check(res.matched && res.poi && res.poi.id === expectedId, "5b.JP.Match", `Input "${inp}" -> ${expectedId} (got ${res.poi && res.poi.id})`);
  }

  // Regional filter on 四國 (4 prefectural capitals: 德島/高松/松山/高知)
  sandbox.state.regionQuizEnabled = true;
  sandbox.state.filterStationsByRegion = true;
  const shikokuIds = sandbox.getActiveItems().filter((it) => it.countyName === "四國").map((it) => it.id);
  sandbox.state.selectedTownIds = new Set(shikokuIds);
  sandbox.state.selectedCounties = new Set(["四國"]);
  check(sandbox.getActiveQuizPois("capital").length === 4, "5b.JP.RegionFilter", `四國 should have 4 prefectural capitals, got ${sandbox.getActiveQuizPois("capital").length}`);

  // Grading title on JP capital mode
  sandbox.state.regionQuizEnabled = false;
  sandbox.state.filterStationsByRegion = false;
  const jpTheme = sandbox.detectPoiThemeProfile();
  check(jpTheme && jpTheme.scopeLabel === "日本47縣廳所在地", "5b.JP.Grading", `Expected 日本47縣廳所在地, got ${jpTheme && jpTheme.scopeLabel}`);

  // Switching to unsupported solo pack (tw_modern) resets capitalQuizEnabled to false
  await sandbox.switchActiveMapPack("tw_modern", { skipPaintYield: true });
  check(sandbox.state.capitalQuizEnabled === false, "5c.Switch.TW", "Switching to tw_modern resets capitalQuizEnabled to false");
  check(sandbox.state.regionQuizEnabled === true, "5c.Switch.TW", "Switching to tw_modern restores regionQuizEnabled to true");

  // Security check: zero .innerHTML in data/capital-data.js or newly added lines
  const capSrc = fs.readFileSync(path.join(rootDir, "data/capital-data.js"), "utf8");
  check(!capSrc.includes(".innerHTML"), "6.Security", "data/capital-data.js has zero .innerHTML");

  if (failed > 0) {
    console.error(`\n❌ test_capital_quiz.js FAILED (${failed} failures, ${passed} passed):`);
    failures.forEach((f) => console.error("  -", f));
    process.exit(1);
  }
  console.log(`\nPASS [GREEN]: All ${passed} Capital Quiz (CN / ROC 1949 / World) checks passed!`);
})();
