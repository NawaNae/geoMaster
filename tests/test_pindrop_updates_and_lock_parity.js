#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = path.resolve(__dirname, "..");

function makeClassList(initial = []) {
  const set = new Set(initial);
  return {
    add: (...c) => c.forEach((x) => set.add(x)),
    remove: (...c) => c.forEach((x) => set.delete(x)),
    toggle: (c, force) => {
      if (typeof force === "boolean") {
        if (force) set.add(c);
        else set.delete(c);
        return force;
      }
      if (set.has(c)) { set.delete(c); return false; }
      set.add(c);
      return true;
    },
    contains: (c) => set.has(c)
  };
}

function makeEl(id, tag = "div", initialClasses = []) {
  return {
    id,
    tagName: tag.toUpperCase(),
    className: "",
    textContent: "",
    value: "",
    checked: false,
    disabled: false,
    style: { setProperty() {} },
    attributes: {},
    children: [],
    classList: makeClassList(initialClasses),
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return this.attributes[k] ?? null; },
    appendChild(child) { this.children.push(child); return child; },
    replaceChildren(...nodes) { this.children = nodes.slice(); },
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { width: 400, height: 400, top: 0, left: 0 }; }
  };
}

const elements = {};
const ids = [
  "target-quiz-banner",
  "target-banner-title",
  "target-hint-badge",
  "target-banner-desc",
  "pindrop-target-outline-preview",
  "pindrop-dock-bar",
  "pindrop-coord-status",
  "btn-pindrop-confirm",
  "btn-pindrop-next",
  "btn-pindrop-finish-endless",
  "answer-form",
  "input-occludable-footer",
  "modal-pindrop-summary",
  "pindrop-summary-total-score",
  "pindrop-summary-max-score",
  "pindrop-summary-avg-dist",
  "pindrop-summary-best-round",
  "pindrop-summary-list",
  "chk-pindrop-show-target-outline",
  "chk-pindrop-show-borders",
  "chk-pindrop-hide-guessed",
  "chk-pindrop-hide-county",
  "chk-pindrop-lock-layer",
  "chk-pindrop-countdown-rush",
  "chk-pindrop-countdown-bonus",
  "pindrop-countdown-sec-row",
  "pindrop-quiz-options-panel",
  "layer-switcher-pill",
  "layer-lock-badge"
];
ids.forEach((id) => {
  elements[id] = makeEl(id, id.startsWith("chk-") ? "input" : "div", id === "pindrop-target-outline-preview" ? ["hidden"] : []);
});

const sandbox = {
  console,
  Math,
  Date,
  Set,
  Map,
  Array,
  Object,
  Number,
  String,
  Boolean,
  JSON,
  parseInt,
  parseFloat,
  isFinite,
  isNaN,
  setTimeout: (fn) => 1,
  clearTimeout: () => {},
  setInterval: () => 1,
  clearInterval: () => {},
  requestAnimationFrame: (fn) => fn(),
  renderSmartLabelsAndLeaderLines: () => {},
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  navigator: { userAgent: "node", language: "zh-TW" },
  screen: { width: 1280, height: 800, colorDepth: 24 },
  Intl: Intl,
  window: {},
  document: {
    getElementById: (id) => elements[id] || null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => makeEl("", tag),
    createElementNS: (_ns, tag) => makeEl("", tag),
    documentElement: { style: { setProperty() {} } },
    body: makeEl("body", "body"),
    addEventListener: () => {}
  }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

function loadScript(relPath) {
  const full = path.join(repoRoot, relPath);
  vm.runInContext(fs.readFileSync(full, "utf8"), sandbox, { filename: relPath });
}

loadScript("data/admin-data.js");
loadScript("data/poi-data.js");
loadScript("data/transport-data.js");
loadScript("js/state.js");
loadScript("js/map-pack-registry.js");
loadScript("js/poi-engine.js");
loadScript("js/map-engine.js");
loadScript("js/pindrop-engine.js");

// Initialize minimal Leaflet stub map via map-engine's L stub
vm.runInContext(`
  if (typeof initMap === "function") {
    try { initMap(); } catch (_) {}
  }
  if (!map && typeof L !== "undefined" && typeof L.map === "function") {
    map = L.map("leaflet-map", { minZoom: 7, maxZoom: 18, maxBounds: [[20.2, 116.5], [27.4, 123.8]], maxBoundsViscosity: 0.9 });
  }
  if (map && !map.options) map.options = { bounceAtZoomLimits: true, maxBoundsViscosity: 0.9 };
  this.state = state; this.ALL_TOWNS = ALL_TOWNS; this.TAIWAN_POI_DATA = TAIWAN_POI_DATA; this.map = map; this.L = L;
`, sandbox);

let passed = 0;
let failed = 0;
function check(cond, name, detail = "") {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL [${name}] ${detail}`);
  }
}

// =========================================================================
// 1. NEW PIN-DROP DEFAULTS
// =========================================================================
check(sandbox.state.pinDropShowTargetOutline === true, "1.Default.TargetOutlineON", `got ${sandbox.state.pinDropShowTargetOutline}`);
check(sandbox.state.pinDropShowBorders === false, "1.Default.ShowBordersOFF", `got ${sandbox.state.pinDropShowBorders}`);
check(sandbox.state.pinDropHideGuessed === true, "1.Default.HideGuessedON", `got ${sandbox.state.pinDropHideGuessed}`);
check(sandbox.state.pinDropHideCounty === false, "1.Default.HideCountyOFF", `got ${sandbox.state.pinDropHideCounty}`);

// =========================================================================
// 2. TARGET-ONLY OUTLINE PREVIEW (SVG)
// =========================================================================
const samplePoly = {
  type: "Polygon",
  coordinates: [[[120.30, 23.90], [120.40, 23.90], [120.40, 24.00], [120.30, 24.00], [120.30, 23.90]]]
};
const fangyuan = sandbox.ALL_TOWNS.find((t) => t.fullCountyTown === "彰化縣芳苑鄉");
fangyuan.geojsonGeometry = samplePoly;
sandbox.state.playMode = "pin_drop";
const fyTarget = sandbox.buildPinDropTargetFromTown(fangyuan);

// 2a. Default ON -> renders SVG path inside #pindrop-target-outline-preview
sandbox.state.pinDropShowTargetOutline = true;
const shown = sandbox.renderPinDropTargetOutlinePreview(fyTarget);
const previewEl = elements["pindrop-target-outline-preview"];
check(shown === true && !previewEl.classList.contains("hidden"), "2a.OutlineShownByDefault", "Expected preview visible");
check(previewEl.children.length === 1 && previewEl.children[0].tagName === "SVG", "2a.OutlineSvgElement", "Expected SVG child");
check(previewEl.children[0].children[0].attributes.d.includes("M") && previewEl.children[0].children[0].attributes.d.includes("Z"), "2a.OutlineSvgPath", "Expected closed SVG path");

// 2b. Toggle OFF -> hides preview
sandbox.setPinDropShowTargetOutline(false);
check(sandbox.state.pinDropShowTargetOutline === false && previewEl.classList.contains("hidden"), "2b.OutlineToggleOff", "Expected preview hidden when disabled");
sandbox.setPinDropShowTargetOutline(true);

// 2c. Point target (POI) -> preview stays hidden (no polygon outline)
const airportPoi = sandbox.TAIWAN_POI_DATA.find((p) => p.category === "airport");
const poiTarget = sandbox.buildPinDropTargetFromPoi(airportPoi);
const poiShown = sandbox.renderPinDropTargetOutlinePreview(poiTarget);
check(poiShown === false && previewEl.classList.contains("hidden"), "2c.OutlineHiddenForPointTarget", "POI point target must not render polygon outline");

// =========================================================================
// 3. HIDE COUNTY (HARD MODE) + DUPLICATE TOWN DISAMBIGUATION
// =========================================================================
const dupSet = sandbox.getDuplicateTownNameSet();
const expectedDups = ["中正區", "中山區", "大安區", "信義區", "東區", "南區", "西區", "北區"];
check(dupSet.size === 8 && expectedDups.every((n) => dupSet.has(n)), "3a.DuplicateTownSet", `Expected 8 duplicate town names, got ${[...dupSet].join(",")}`);

// Normal mode (hideCounty = false): always shows county + town
sandbox.state.pinDropHideCounty = false;
const fyNormal = sandbox.getPinDropDisplayPromptTitle(sandbox.buildPinDropTargetFromTown(fangyuan, dupSet));
check(fyNormal.includes("彰化縣") && fyNormal.includes("芳苑鄉"), "3b.NormalShowsCounty", `got ${fyNormal}`);

// Hard mode (hideCounty = true): unique town hides county
sandbox.state.pinDropHideCounty = true;
const fyHard = sandbox.getPinDropDisplayPromptTitle(sandbox.buildPinDropTargetFromTown(fangyuan, dupSet));
check(!fyHard.includes("彰化縣") && fyHard.includes("芳苑鄉"), "3c.HardHidesCountyForUniqueTown", `got ${fyHard}`);

// Hard mode (hideCounty = true): ALL 19 duplicate-named towns MUST specify their county
const dupTownObjs = sandbox.ALL_TOWNS.filter((t) => dupSet.has(t.townName));
check(dupTownObjs.length === 19, "3d.DuplicateTownInstanceCount", `Expected 19 duplicate town instances, got ${dupTownObjs.length}`);
const allDupsSpecified = dupTownObjs.every((t) => {
  const title = sandbox.getPinDropDisplayPromptTitle(sandbox.buildPinDropTargetFromTown(t, dupSet));
  return title.includes(t.countyName) && title.includes(t.townName);
});
check(allDupsSpecified, "3e.HardRetainsCountyForAllDuplicates", "Every duplicate town name must specify its county when pinDropHideCounty=true");

// Hard mode: ALL 349 unique-named towns MUST omit county
const uniqueTownObjs = sandbox.ALL_TOWNS.filter((t) => !dupSet.has(t.townName));
const allUniqueHidden = uniqueTownObjs.every((t) => {
  const title = sandbox.getPinDropDisplayPromptTitle(sandbox.buildPinDropTargetFromTown(t, dupSet));
  return !title.includes(t.countyName) && title.includes(t.townName);
});
check(allUniqueHidden, "3f.HardHidesCountyForAll349UniqueTowns", "Every unique town name must hide its county when pinDropHideCounty=true");
sandbox.state.pinDropHideCounty = false;

// =========================================================================
// 4. HIDE GUESSED REGIONS (DEFAULT ON vs TOGGLE OFF)
// =========================================================================
const meinong = sandbox.ALL_TOWNS.find((t) => t.fullCountyTown === "高雄市美濃區");
meinong.geojsonGeometry = samplePoly;
sandbox.state.pinDrop = {
  active: true,
  totalRounds: 5,
  currentRound: 2,
  phase: "placing",
  queue: [],
  currentTarget: sandbox.buildPinDropTargetFromTown(meinong, dupSet),
  guessLatLng: null,
  lastReveal: null,
  history: [{
    round: 1,
    targetId: `town:${fangyuan.id}`,
    rawId: fangyuan.id,
    kind: "town",
    title: "彰化縣芳苑鄉",
    guessLat: 23.95,
    guessLng: 120.35,
    nearestLat: 23.95,
    nearestLng: 120.35,
    inside: true,
    distanceKm: 0,
    baseScore: 5000,
    speedBonus: 0,
    score: 5000,
    timedOut: false
  }],
  totalScore: 5000
};

// Default pinDropHideGuessed = true -> previously guessed town is NOT highlighted
sandbox.state.pinDropHideGuessed = true;
check(sandbox.isPinDropGuessedPolygon(fangyuan) === false, "4a.HideGuessedDefaultHidesHistory", "Previously guessed town must be hidden when pinDropHideGuessed=true");

// Toggle pinDropHideGuessed = false -> previously guessed town IS highlighted
sandbox.setPinDropHideGuessed(false);
check(sandbox.isPinDropGuessedPolygon(fangyuan) === true, "4b.ShowGuessedRevealsHistory", "Previously guessed town must show when pinDropHideGuessed=false");
const guessedStyle = sandbox.computePolygonStyle(fangyuan);
check(guessedStyle.fillColor === "#38bdf8" && guessedStyle.stroke === true, "4c.GuessedPolygonStyle", `got ${JSON.stringify(guessedStyle)}`);
sandbox.setPinDropHideGuessed(true);

// =========================================================================
// 5. POINT-BASED POI & STATION PIN-DROP + DUPLICATE POI DISAMBIGUATION
// =========================================================================
const dupPois = sandbox.getDuplicatePoiNameSet();
check(dupPois.has("富岡") && dupPois.has("南寮") && dupPois.has("成功漁港"), "5a.DuplicatePoiDetected", `got ${[...dupPois].join(",")}`);
const fugangPois = sandbox.TAIWAN_POI_DATA.filter((p) => p.name === "富岡");
const fugangTargets = fugangPois.map((p) => sandbox.buildPinDropTargetFromPoi(p, dupPois));
check(
  fugangTargets.length === 2 &&
    fugangTargets[0].promptTitle !== fugangTargets[1].promptTitle &&
    fugangTargets.every((t) => t.promptTitle.includes("富岡") && (t.promptTitle.includes("桃園市") || t.promptTitle.includes("臺東縣"))),
  "5b.DuplicatePoiDisambiguated",
  `got ${JSON.stringify(fugangTargets.map((t) => t.promptTitle))}`
);

// Point-based POI scoring via confirmPinDropGuess
const samplePoi = fugangPois[0];
const samplePoiTarget = sandbox.buildPinDropTargetFromPoi(samplePoi, dupPois);
sandbox.state.pinDrop = {
  active: true,
  totalRounds: 5,
  currentRound: 1,
  phase: "placing",
  queue: [],
  currentTarget: samplePoiTarget,
  guessLatLng: { lat: samplePoi.lat + 0.001, lng: samplePoi.lng }, // ~0.11 km -> within 0.5 km perfect radius
  lastReveal: null,
  history: [],
  totalScore: 0
};
const okConfirm = sandbox.confirmPinDropGuess();
const lastRec = sandbox.state.pinDrop.lastReveal;
check(okConfirm === true && lastRec && lastRec.inside === true && lastRec.baseScore === 5000, "5c.PoiPointExactHit", `got ${JSON.stringify(lastRec)}`);
check(lastRec.distanceKm > 0.05 && lastRec.distanceKm < 0.2, "5d.PoiPointHaversineKm", `got distanceKm=${lastRec.distanceKm}`);
check(elements["pindrop-coord-status"].textContent.includes("精準命中") && !elements["pindrop-coord-status"].textContent.includes("境內"), "5e.PoiPointWordingNoJingNei", `got ${elements["pindrop-coord-status"].textContent}`);

// =========================================================================
// 6. VIEWPORT LOCK MOBILE/DESKTOP FAIRNESS (bounceAtZoomLimits & viscosity)
// =========================================================================
sandbox.state.role = "solo";
sandbox.state.satelliteLockViewport = true;
const testBounds = sandbox.L.latLngBounds([22.54, 120.26], [22.64, 120.36]);
sandbox.lockMapViewportToBounds(testBounds);
check(sandbox.map.options.bounceAtZoomLimits === false, "6a.LockDisablesBounceAtZoomLimits", `got ${sandbox.map.options.bounceAtZoomLimits}`);
check(sandbox.map.options.maxBoundsViscosity === 1.0, "6b.LockSetsHardViscosity1.0", `got ${sandbox.map.options.maxBoundsViscosity}`);

sandbox.unlockMapViewportToPack({ restoreLayers: false });
check(sandbox.map.options.bounceAtZoomLimits === true, "6c.UnlockRestoresBounceAtZoomLimits", `got ${sandbox.map.options.bounceAtZoomLimits}`);
check(sandbox.map.options.maxBoundsViscosity === 0.9, "6d.UnlockRestoresViscosity", `got ${sandbox.map.options.maxBoundsViscosity}`);

console.log(`\nResult: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
console.log("ALL PIN-DROP UPDATES & LOCK PARITY TESTS PASSED!");
