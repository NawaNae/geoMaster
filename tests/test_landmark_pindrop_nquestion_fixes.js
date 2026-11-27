const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const ROOT = path.resolve(__dirname, "..");

let passed = 0;
let failed = 0;
function check(cond, name, msg = "") {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL [${name}]: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// 1. Issue 1: Landmark (data-accent="rose") CSS highlight rule
// ---------------------------------------------------------------------------
const cssText = fs.readFileSync(path.join(ROOT, "css", "styles.css"), "utf8");
const htmlText = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

check(
  htmlText.includes('data-topic="landmark"') && htmlText.includes('data-accent="rose"'),
  "1a.LandmarkHtmlAccent",
  "index.html landmark card should use data-accent='rose'"
);
check(
  cssText.includes('.geo-select-card[data-accent="rose"][data-state="on"]'),
  "1b.LandmarkRoseOnCss",
  "css/styles.css must define [data-accent='rose'][data-state='on']"
);
check(
  cssText.includes('.geo-select-card[data-accent="rose"][data-state="partial"]'),
  "1c.LandmarkRosePartialCss",
  "css/styles.css must define [data-accent='rose'][data-state='partial']"
);

// Ensure every data-accent used on .geo-select-card in index.html has a CSS [data-state="on"] rule
const accentMatches = [...htmlText.matchAll(/data-accent="([a-z]+)"/g)].map((m) => m[1]);
const uniqueAccents = [...new Set(accentMatches)];
uniqueAccents.forEach((acc) => {
  check(
    cssText.includes(`.geo-select-card[data-accent="${acc}"][data-state="on"]`),
    `1d.AllAccentsCovered.${acc}`,
    `Missing CSS [data-state="on"] for data-accent="${acc}"`
  );
});

// ---------------------------------------------------------------------------
// 2. Issue 2 & 3: HTML modal parity & JS runtime verification in VM
// ---------------------------------------------------------------------------
check(htmlText.includes('id="btn-reconfig-settlement"'), "2a.SettlementReconfigBtn", "Missing #btn-reconfig-settlement");
check(htmlText.includes('id="btn-pindrop-reconfig"'), "2b.PinDropReconfigBtn", "Missing #btn-pindrop-reconfig");
check(htmlText.includes('id="btn-pindrop-review-map"'), "2c.PinDropReviewMapBtn", "Missing #btn-pindrop-review-map");
check(htmlText.includes('id="btn-pindrop-share"'), "2d.PinDropShareBtn", "Missing #btn-pindrop-share");
check(htmlText.includes('id="pindrop-summary-grade"'), "2e.PinDropGradeEl", "Missing #pindrop-summary-grade");
check(htmlText.includes('id="pindrop-summary-pct"'), "2f.PinDropPctEl", "Missing #pindrop-summary-pct");
check(htmlText.includes('id="pindrop-summary-time"'), "2g.PinDropTimeEl", "Missing #pindrop-summary-time");
check(htmlText.includes('id="btn-pindrop-view-summary"'), "2h.PinDropDockSummaryBtn", "Missing #btn-pindrop-view-summary");
check(htmlText.includes('id="btn-pindrop-dock-replay"'), "2i.PinDropDockReplayBtn", "Missing #btn-pindrop-dock-replay");
check(htmlText.includes('id="btn-pindrop-dock-reconfig"'), "2j.PinDropDockReconfigBtn", "Missing #btn-pindrop-dock-reconfig");

function makeClassList(initial = []) {
  const s = new Set(initial);
  return {
    add: (...cls) => cls.forEach((c) => s.add(c)),
    remove: (...cls) => cls.forEach((c) => s.delete(c)),
    toggle: (c, force) => {
      if (force === undefined) {
        if (s.has(c)) s.delete(c);
        else s.add(c);
      } else if (force) s.add(c);
      else s.delete(c);
    },
    contains: (c) => s.has(c)
  };
}

function makeEl(id, initialClasses = []) {
  const attrs = {};
  const el = {
    id,
    textContent: "",
    title: "",
    value: "",
    disabled: false,
    className: "",
    style: {},
    children: [],
    classList: makeClassList(initialClasses),
    setAttribute: (k, v) => { attrs[k] = String(v); },
    getAttribute: (k) => attrs[k] || null,
    appendChild: (c) => { el.children.push(c); return c; },
    replaceChildren: (...nodes) => { el.children = [...nodes]; },
    addEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => []
  };
  return el;
}

const elements = {};
const ids = [
  "modal-settlement", "modal-pindrop-summary", "modal-opponent-finished", "modal-rematch-confirm",
  "btn-reopen-settlement", "btn-return-lobby-settlement", "btn-reconfig-settlement",
  "btn-rematch-settlement", "rematch-btn-text", "target-quiz-banner", "target-banner-title",
  "target-hint-badge", "target-banner-desc", "target-dir-group", "btn-target-pass",
  "btn-target-next", "btn-target-hint", "btn-target-reveal-outline", "btn-target-exit",
  "answer-form", "input-occludable-footer", "pindrop-dock-bar", "pindrop-coord-status",
  "btn-pindrop-confirm", "btn-pindrop-next", "btn-pindrop-finish-endless",
  "btn-pindrop-view-summary", "btn-pindrop-dock-replay", "btn-pindrop-dock-reconfig",
  "pindrop-summary-title", "pindrop-summary-mode-badge", "pindrop-summary-total-score",
  "pindrop-summary-max-score", "pindrop-summary-pct", "pindrop-summary-grade",
  "pindrop-summary-time", "pindrop-summary-avg-dist", "pindrop-summary-best-round",
  "pindrop-summary-list", "pindrop-target-outline-preview", "timer-display",
  "settlement-type-badge", "settlement-mode-badge", "settlement-title", "settlement-icon-box",
  "settlement-grade-box", "settlement-grade", "settlement-grade-title", "settlement-grade-desc",
  "settlement-vs-banner", "settlement-opp-ongoing-banner", "settlement-pct", "settlement-grand-score",
  "settlement-time", "settlement-speed", "settlement-acc", "settlement-wrong", "settlement-streak",
  "settlement-breakdown", "settlement-cleared-blocks"
];
ids.forEach((id) => {
  elements[id] = makeEl(id, id.startsWith("modal-") || id === "btn-reopen-settlement" ? ["hidden"] : []);
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
  RegExp,
  JSON,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  setTimeout: () => 1,
  clearTimeout: () => {},
  setInterval: () => 1,
  clearInterval: () => {},
  window: {},
  navigator: { userAgent: "node-test", language: "zh-TW" },
  screen: { width: 1920, height: 1080, colorDepth: 24 },
  Intl,
  localStorage: { getItem: () => null, setItem: () => {} },
  document: {
    getElementById: (id) => {
      if (!elements[id]) elements[id] = makeEl(id);
      return elements[id];
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => makeEl(tag),
    body: { classList: makeClassList() }
  },
  L: {
    layerGroup: () => ({ addTo: () => {}, clearLayers: () => {} }),
    divIcon: (opts) => opts,
    marker: () => ({ addTo: () => {}, bindTooltip: () => {} }),
    latLngBounds: () => ({ isValid: () => true, pad: () => ({}) })
  },
  map: {
    hasLayer: () => true,
    addLayer: () => {},
    fitBounds: () => {},
    setView: () => {},
    getZoom: () => 8,
    getSize: () => ({ x: 1000, y: 800 }),
    latLngToContainerPoint: () => ({ x: 500, y: 400 }),
    doubleClickZoom: { enable: () => {}, disable: () => {} }
  },
  updateRoadAndRailwayTileOverlays: () => {},
  refreshAllPolygonStyles: () => {},
  refreshPoiMapLayer: () => {},
  updatePrefixDropdownUI: () => {},
  updateScoreAndProgressUI: () => {},
  setFeedback: () => {},
  playTone: () => {},
  syncModalBodyScrollLock: () => {},
  syncConfigButtonsUI: () => {},
  updateModeBadgeText: () => {},
  renderRoomConciseSettingsSummary: () => {},
  broadcastP2PState: () => {},
  notifyP2PPlayerFinished: () => {},
  clearSatelliteTargetMarker: () => {},
  unlockMapViewportToPack: () => {},
  stopQuestionCountdown: () => {},
  startQuestionCountdown: () => {},
  getActiveQuizStations: () => [
    { key: "st:1", displayName: "台北", lat: 25.04, lng: 121.51, lineId: "thsr", lineIds: ["thsr"], lineName: "高鐵", sysTotal: "高鐵", color: "#ea580c" },
    { key: "st:2", displayName: "板橋", lat: 25.01, lng: 121.46, lineId: "thsr", lineIds: ["thsr"], lineName: "高鐵", sysTotal: "高鐵", color: "#ea580c" },
    { key: "st:3", displayName: "台中", lat: 24.11, lng: 120.61, lineId: "thsr", lineIds: ["thsr"], lineName: "高鐵", sysTotal: "高鐵", color: "#ea580c" },
    { key: "st:4", displayName: "左營", lat: 22.68, lng: 120.30, lineId: "thsr", lineIds: ["thsr"], lineName: "高鐵", sysTotal: "高鐵", color: "#ea580c" }
  ],
  getActiveQuizPois: () => [
    { id: "poi:1", name: "台北101", category: "landmark", categories: ["landmark"], lat: 25.03, lng: 121.56 },
    { id: "poi:2", name: "日月潭", category: "lake", categories: ["lake"], lat: 23.86, lng: 120.91 },
    { id: "poi:3", name: "阿里山", category: "landmark", categories: ["landmark"], lat: 23.51, lng: 120.80 }
  ],
  isPoiCategoryActive: () => false
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

function loadScript(rel) {
  const code = fs.readFileSync(path.join(ROOT, rel), "utf8");
  vm.runInContext(code, sandbox, { filename: rel });
}

loadScript("data/admin-data.js");
loadScript("data/transport-data.js");
loadScript("data/poi-data.js");
loadScript("js/map-pack-registry.js");
loadScript("js/state.js");
loadScript("js/pindrop-engine.js");
loadScript("js/game-logic.js");
loadScript("js/dashboard-ui.js");
vm.runInContext("globalThis.state = state; globalThis.TAIWAN_ADMIN_DATA = TAIWAN_ADMIN_DATA; globalThis.ALL_TOWNS = ALL_TOWNS;", sandbox);

// ---- Test Issue 2: Pin-Drop giveUp / exit / finish / replay ----
sandbox.state.playMode = "pin_drop";
sandbox.state.pinDropRounds = 5;
sandbox.state.elapsedSec = 42;
sandbox.state.isGameOver = false;
sandbox.state.finished = false;
sandbox.state.pinDrop = {
  active: true,
  totalRounds: 5,
  currentRound: 3,
  phase: "placing",
  queue: [
    { id: "town:4", rawId: "t4", kind: "town", shortLabel: "淡水區", lat: 25.17, lng: 121.44 },
    { id: "town:5", rawId: "t5", kind: "town", shortLabel: "板橋區", lat: 25.01, lng: 121.46 }
  ],
  currentTarget: { id: "town:3", rawId: "t3", kind: "town", shortLabel: "信義區", lat: 25.03, lng: 121.56 },
  guessLatLng: { lat: 25.0, lng: 121.5 },
  lastReveal: null,
  history: [
    { round: 1, targetId: "town:1", rawId: "臺北市|中正區", kind: "town", title: "臺北市中正區", nearestLat: 25.03, nearestLng: 121.51, inside: true, distanceKm: 0, baseScore: 5000, speedBonus: 0, score: 5000 },
    { round: 2, targetId: "town:2", rawId: "臺北市|大安區", kind: "town", title: "臺北市大安區", nearestLat: 25.02, nearestLng: 121.54, inside: false, distanceKm: 5.2, baseScore: 4100, speedBonus: 0, score: 4100 }
  ],
  totalScore: 9100
};

// Clicking exit button in Pin-Drop must NOT drop back to playMode="free"; it must settle!
sandbox.exitTargetQuizMode();
check(sandbox.state.playMode === "pin_drop", "2k.PinDropExitStaysInPinDrop", `Expected playMode='pin_drop', got '${sandbox.state.playMode}'`);
check(sandbox.state.pinDrop.phase === "finished", "2l.PinDropExitFinishes", `Expected phase='finished', got '${sandbox.state.pinDrop.phase}'`);
check(sandbox.state.isGameOver === true, "2m.PinDropFinishSetsGameOver", "Expected state.isGameOver === true");
check(!elements["modal-pindrop-summary"].classList.contains("hidden"), "2n.PinDropSummaryOpens", "#modal-pindrop-summary should open");
check(elements["modal-settlement"].classList.contains("hidden"), "2o.NormalSettlementStaysHidden", "#modal-settlement should stay hidden for pin_drop");
check(elements["pindrop-summary-mode-badge"].textContent.includes("2 / 5"), "2p.PinDropSummaryRoundCount", `Got: ${elements["pindrop-summary-mode-badge"].textContent}`);
check(elements["pindrop-summary-time"].textContent === "00:42", "2q.PinDropSummaryTime", `Got: ${elements["pindrop-summary-time"].textContent}`);
check(elements["pindrop-summary-list"].children.length === 2, "2r.PinDropSummaryOnlyGuessed", `Expected 2 guessed rows, got ${elements["pindrop-summary-list"].children.length}`);
check(!elements["btn-pindrop-view-summary"].classList.contains("hidden"), "2s.PinDropDockShowsViewSummary", "Finished dock must show #btn-pindrop-view-summary");
check(!elements["btn-pindrop-dock-replay"].classList.contains("hidden"), "2t.PinDropDockShowsReplay", "Finished dock must show #btn-pindrop-dock-replay");
check(!elements["btn-pindrop-dock-reconfig"].classList.contains("hidden"), "2u.PinDropDockShowsReconfig", "Finished dock must show #btn-pindrop-dock-reconfig");

// Pin-Drop guessed polygons must reveal when finished even if pinDropHideGuessed is true
sandbox.state.pinDropHideGuessed = true;
check(
  sandbox.isPinDropGuessedPolygon({ id: "臺北市|中正區", countyName: "臺北市" }) === true,
  "2v.PinDropFinishedRevealsGuessedPoly",
  "Guessed polygon should be visible on finished map review"
);
check(
  sandbox.isPinDropGuessedPolygon({ id: "臺北市|信義區", countyName: "臺北市" }) === false,
  "2w.PinDropFinishedHidesUnseenPoly",
  "Unseen polygon must NOT be marked guessed on finished map review"
);

// giveUpAndReveal() in Pin-Drop must route to finishPinDropGame, NOT 0/368 normal settlement!
sandbox.state.pinDrop.phase = "placing";
elements["modal-pindrop-summary"].classList.add("hidden");
elements["modal-settlement"].classList.add("hidden");
sandbox.giveUpAndReveal();
check(!elements["modal-pindrop-summary"].classList.contains("hidden"), "2x.PinDropGiveUpOpensPinDropModal", "giveUpAndReveal in pin_drop must open #modal-pindrop-summary");
check(elements["modal-settlement"].classList.contains("hidden"), "2y.PinDropGiveUpDoesNotOpenNormalModal", "giveUpAndReveal in pin_drop must NOT open #modal-settlement");
check(sandbox.state.missedTowns.size === 0, "2z.PinDropGiveUpDoesNotFloodMissedTowns", `Expected 0 missedTowns, got ${sandbox.state.missedTowns.size}`);

// ---- Test Issue 2 & 3: N-Question mode exit & giveUp only reveals encountered questions ----
sandbox.state.playMode = "target_random";
sandbox.state.difficulty = "hard_full";
sandbox.state.targetQuestionLimit = 5;
sandbox.state.regionQuizEnabled = true;
sandbox.state.stationQuizEnabled = true;
sandbox.state.quizStationLines = new Set(["thsr"]);
sandbox.state.selectedCounties = new Set(sandbox.TAIWAN_ADMIN_DATA.map((c) => c.name));
sandbox.state.selectedTownIds = new Set(sandbox.ALL_TOWNS.map((t) => t.id));
const taipeiTown = sandbox.ALL_TOWNS.find((t) => t.countyName === "臺北市");
const kaohsiungTown = sandbox.ALL_TOWNS.find((t) => t.countyName === "高雄市");
sandbox.state.unlockedTowns = new Set([taipeiTown.id]);
sandbox.state.unlockedCounties = new Set();
sandbox.state.unlockedStations = new Set();
sandbox.state.unlockedPois = new Set();
sandbox.state.missedTowns = new Set();
sandbox.state.missedStations = new Set();
sandbox.state.missedPois = new Set();
sandbox.state.passedTargetKeys = new Set();
sandbox.state.isGameOver = false;
sandbox.state.finished = false;
sandbox.state.roomCode = "";
sandbox.state.targetQueue = [
  { kind: "town", id: taipeiTown.id },     // Q1: unlocked
  { kind: "station", id: "st:2" },         // Q2: current active when giving up
  { kind: "town", id: kaohsiungTown.id },  // Q3: UNSEEN future
  { kind: "station", id: "st:4" },         // Q4: UNSEEN future
  { kind: "poi", id: "poi:3" }             // Q5: UNSEEN future
];
sandbox.state.targetQueueIndex = 1;
sandbox.state.targetId = null;
sandbox.state.targetStationKey = "st:2";
sandbox.state.targetPoiId = null;

// Clicking exit in N-question mode must settle instead of switching to "free"
sandbox.exitTargetQuizMode();
check(sandbox.state.playMode === "target_random", "3a.NQuestionExitStaysInMode", `Expected 'target_random', got '${sandbox.state.playMode}'`);
check(sandbox.state.isGameOver === true, "3b.NQuestionExitSettles", "Expected isGameOver === true");
check(!elements["modal-settlement"].classList.contains("hidden"), "3c.NQuestionSettlementOpens", "Expected #modal-settlement visible");
check(!elements["btn-reconfig-settlement"].classList.contains("hidden"), "3d.SoloSettlementShowsReconfig", "Solo settlement must show #btn-reconfig-settlement");
check(sandbox.state.targetStationKey === null, "3e.ActiveTargetCleared", "Expected active targetStationKey cleared on finish");

// Verify ONLY encountered items revealed: Q1 unlocked, Q2 (st:2) missed; Q3/Q4/Q5 UNSEEN must NOT be in missed*!
check(sandbox.state.missedStations.has("st:2"), "3f.CurrentStationRevealed", "Current station st:2 should be in missedStations");
check(!sandbox.state.missedStations.has("st:3") && !sandbox.state.missedStations.has("st:4"), "3g.UnseenStationsNotRevealed", "Unseen/scope stations must NOT be in missedStations");
check(sandbox.state.missedTowns.size === 0, "3h.UnseenTownsNotRevealed", `Expected 0 missedTowns, got ${sandbox.state.missedTowns.size}`);
check(sandbox.state.missedPois.size === 0, "3i.UnseenPoisNotRevealed", `Expected 0 missedPois, got ${sandbox.state.missedPois.size}`);
check(sandbox.isCountyRevealed("臺北市") === true, "3j.GuessedCountyRevealed", "County with guessed town should be revealed");
check(sandbox.isCountyRevealed("高雄市") === false, "3k.UnseenCountyNotRevealed", "Unseen county must NOT be revealed in N-question hard_full gameOver");

// Verify non-limited (normal free) mode STILL reveals all missed stations, towns, and counties on giveUp
sandbox.state.playMode = "free";
sandbox.state.targetQuestionLimit = 0;
sandbox.state.targetQueue = [];
sandbox.state.isGameOver = false;
sandbox.state.finished = false;
sandbox.state.missedTowns = new Set();
sandbox.state.missedStations = new Set();
sandbox.state.unlockedStations = new Set(["st:1"]);
sandbox.giveUpAndReveal();
check(sandbox.state.missedStations.has("st:2") && sandbox.state.missedStations.has("st:3") && sandbox.state.missedStations.has("st:4"), "3l.FreeModeRevealsAllMissedStations", "Free mode give-up must still add all non-unlocked stations to missedStations");
check(!sandbox.state.missedStations.has("st:1"), "3m.FreeModeKeepsUnlockedStationOutOfMissed", "Unlocked station must not be in missedStations");
check(sandbox.state.missedTowns.size > 300, "3n.FreeModeRevealsAllMissedTowns", `Expected >300 missedTowns in free mode, got ${sandbox.state.missedTowns.size}`);
check(sandbox.isCountyRevealed("高雄市") === true, "3o.FreeModeRevealsAllCounties", "Free mode gameOver must still reveal all counties");

if (failed > 0) {
  console.error(`\nFAILED: ${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\n✅ test_landmark_pindrop_nquestion_fixes.js PASSED: ${passed} / ${passed} checks succeeded!`);
