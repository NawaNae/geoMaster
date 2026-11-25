const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");

function createStubElement(id = "") {
  const classes = new Set();
  const attrs = {};
  const listeners = {};
  return {
    id,
    value: "",
    textContent: "",
    innerText: "",
    checked: false,
    disabled: false,
    options: [],
    selectedIndex: 0,
    style: {},
    children: [],
    dataset: {},
    classList: {
      add: (...c) => c.forEach((x) => classes.add(x)),
      remove: (...c) => c.forEach((x) => classes.delete(x)),
      toggle: (c, force) => {
        if (force === true) classes.add(c);
        else if (force === false) classes.delete(c);
        else if (classes.has(c)) classes.delete(c);
        else classes.add(c);
      },
      contains: (c) => classes.has(c)
    },
    setAttribute: (k, v) => {
      attrs[k] = String(v);
    },
    getAttribute: (k) => (k in attrs ? attrs[k] : null),
    addEventListener: (ev, fn) => {
      listeners[ev] = listeners[ev] || [];
      listeners[ev].push(fn);
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    closest: () => null,
    appendChild: () => {},
    replaceChildren: () => {},
    focus: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 40, width: 100, height: 40 })
  };
}

const domCache = {};
function getEl(id) {
  if (!domCache[id]) domCache[id] = createStubElement(id);
  return domCache[id];
}

const sandbox = {
  console,
  Math,
  Date,
  Set,
  Map,
  Array,
  Object,
  JSON,
  Number,
  String,
  Boolean,
  Promise,
  setTimeout,
  clearTimeout,
  navigator: { userAgent: "node-test", language: "zh-TW" },
  screen: { width: 390, height: 844, colorDepth: 24 },
  addEventListener: () => {},
  MutationObserver: class { observe() {} },
  window: {},
  localStorage: { getItem: () => null, setItem: () => {} },
  sessionStorage: { getItem: () => null, setItem: () => {} },
  document: {
    readyState: "loading",
    body: createStubElement("body"),
    getElementById: (id) => getEl(id),
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => createStubElement(tag),
    addEventListener: () => {}
  },
  L: {
    divIcon: (opts) => opts,
    marker: () => ({ addTo: () => ({}), setLatLng: () => {}, remove: () => {} }),
    circleMarker: () => ({ addTo: () => ({}), setStyle: () => {}, bindTooltip: () => {} }),
    polygon: () => ({}),
    latLngBounds: () => ({ isValid: () => true, extend: () => {} })
  }
};
sandbox.window = sandbox;

const ctx = vm.createContext(sandbox);
function loadScript(relPath) {
  const code = fs.readFileSync(path.join(ROOT, relPath), "utf8");
  vm.runInContext(code, ctx, { filename: relPath });
}

loadScript("data/admin-data.js");
loadScript("data/transport-data.js");
loadScript("data/poi-data.js");
loadScript("js/map-pack-registry.js");
loadScript("js/state.js");
loadScript("js/map-engine.js");
loadScript("js/transport-engine.js");
loadScript("js/poi-engine.js");
loadScript("js/label-engine.js");
loadScript("js/game-logic.js");
loadScript("js/dashboard-ui.js");
loadScript("js/p2p-engine.js");
loadScript("js/ui-controls.js");
vm.runInContext("this.state = state; this.ALL_TOWNS = ALL_TOWNS;", ctx);

let checks = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  checks++;
}

// 1. Mobile touch fix checks in source
const uiCode = fs.readFileSync(path.join(ROOT, "js/ui-controls.js"), "utf8");
const cssCode = fs.readFileSync(path.join(ROOT, "css/styles.css"), "utf8");
check(
  /lastTouchTime/.test(uiCode) && /450/.test(uiCode) && /touchmove/.test(uiCode),
  "initHoverAndTouchTipSystem should use long-press (450ms) and suppress synthetic mouseover after touch"
);
check(
  /#modal-scope button/.test(cssCode) && /touch-action:\s*manipulation/.test(cssCode),
  "css/styles.css should enforce touch-action: manipulation on #modal-scope buttons"
);
check(
  /#floating-tip-popover\s*\{[^}]*pointer-events:\s*none\s*!important/.test(cssCode),
  "css/styles.css should enforce pointer-events: none !important on #floating-tip-popover"
);

// 2. State defaults & setters
check(sandbox.state.targetQuestionLimit === 0, "state.targetQuestionLimit defaults to 0");
check(sandbox.state.allowPass === true, "state.allowPass defaults to true");
check(sandbox.state.hideGuessedOthers === false, "state.hideGuessedOthers defaults to false");
check(Array.isArray(sandbox.state.targetQueue), "state.targetQueue is an array");
check(sandbox.state.passedTargetKeys instanceof sandbox.Set, "state.passedTargetKeys is a Set");

sandbox.setTargetQuestionLimit(10);
check(sandbox.state.targetQuestionLimit === 10, "setTargetQuestionLimit(10) sets limit to 10");
sandbox.setTargetQuestionLimit(-5);
check(sandbox.state.targetQuestionLimit === 0, "setTargetQuestionLimit(-5) clamps to 0");
sandbox.setAllowPass(false);
check(sandbox.state.allowPass === false, "setAllowPass(false) sets allowPass to false");
sandbox.setAllowPass(true);
check(sandbox.state.allowPass === true, "setAllowPass(true) sets allowPass to true");
sandbox.setHideGuessedOthers(true);
check(sandbox.state.hideGuessedOthers === true, "setHideGuessedOthers(true) sets hideGuessedOthers to true");

// 3. buildTargetQuizQueue & N-question random + Pass
sandbox.state.playMode = "target_random";
sandbox.state.difficulty = "casual";
sandbox.state.regionQuizEnabled = true;
sandbox.state.stationQuizEnabled = false;
sandbox.state.airportQuizEnabled = false;
sandbox.state.portQuizEnabled = false;
sandbox.state.reservoirQuizEnabled = false;
sandbox.state.lakeQuizEnabled = false;
sandbox.state.settlementQuizEnabled = false;
sandbox.state.selectedCounties = new sandbox.Set(["臺北市"]);
sandbox.state.selectedTownIds = new sandbox.Set(
  sandbox.ALL_TOWNS.filter((t) => t.countyName === "臺北市").map((t) => t.id)
);
sandbox.state.targetQuestionLimit = 5;
sandbox.state.allowPass = true;
sandbox.state.hideGuessedOthers = false;

sandbox.resetGame();
check(sandbox.state.targetQueue.length === 5, "resetGame builds a 5-question targetQueue when targetQuestionLimit=5");
const firstTargetId = sandbox.state.targetId;
check(Boolean(firstTargetId), "first targetId is selected from targetQueue");

// Pass when allowPass = false should fail
sandbox.state.allowPass = false;
const passBlocked = sandbox.passCurrentTarget();
check(passBlocked && passBlocked.ok === false, "passCurrentTarget is blocked when allowPass=false");
check(sandbox.state.targetId === firstTargetId, "targetId unchanged when pass is blocked");

// Pass when allowPass = true should mark missed, increment passedTargetKeys, advance to next
sandbox.state.allowPass = true;
const passRes = sandbox.passCurrentTarget();
check(passRes && passRes.ok === true, "passCurrentTarget succeeds when allowPass=true");
check(sandbox.state.passedTargetKeys.size === 1, "passedTargetKeys records 1 skipped target");
check(sandbox.state.missedTowns.has(firstTargetId), "passed town is added to missedTowns");
check(sandbox.state.targetId !== firstTargetId, "targetId advances to next question after pass");

// Pass remaining 4 questions -> game finishes
for (let i = 0; i < 4; i++) {
  sandbox.passCurrentTarget();
}
check(sandbox.state.isGameOver === true, "finishing all 5 questions (via pass/answer) ends the round");
check(sandbox.state.unlockedTowns.size === 0 && sandbox.state.passedTargetKeys.size === 5, "0 unlocked, 5 passed");

// 4. Random mode disables directional arrows & free map clicking
sandbox.state.targetQuestionLimit = 5;
sandbox.resetGame();
sandbox.updateTargetBannerUI();
check(getEl("target-dir-group").classList.contains("hidden"), "#target-dir-group is hidden in target_random");
const prevTargetInRandom = sandbox.state.targetId;
const anotherTown = sandbox.ALL_TOWNS.find((t) => t.countyName === "臺北市" && t.id !== prevTargetInRandom);
sandbox.handlePolygonClick(anotherTown);
check(sandbox.state.targetId === prevTargetInRandom, "clicking another town in target_random does not switch target");

// In target_click, dirGroup IS visible and clicking another town DOES switch target
sandbox.state.playMode = "target_click";
sandbox.updateTargetBannerUI();
check(!getEl("target-dir-group").classList.contains("hidden"), "#target-dir-group is visible in target_click");
sandbox.handlePolygonClick(anotherTown);
check(sandbox.state.targetId === anotherTown.id, "clicking another town in target_click switches target");

// 5. Multiplayer synchronized random queue
sandbox.state.playMode = "target_random";
sandbox.state.targetQuestionLimit = 6;
sandbox.state.allowPass = true;
sandbox.state.hideGuessedOthers = true;
sandbox.state.isHost = true;
const syncCfg = sandbox.getHostSyncConfig(false, "", "", true);
check(syncCfg.targetQuestionLimit === 6, "getHostSyncConfig includes targetQuestionLimit");
check(syncCfg.allowPass === true, "getHostSyncConfig includes allowPass");
check(syncCfg.hideGuessedOthers === true, "getHostSyncConfig includes hideGuessedOthers");
check(Array.isArray(syncCfg.sharedTargetQueue) && syncCfg.sharedTargetQueue.length === 6, "getHostSyncConfig includes 6-item sharedTargetQueue on start");

// Client receives syncCfg
sandbox.state.isHost = false;
sandbox.state.targetQuestionLimit = 0;
sandbox.state.allowPass = false;
sandbox.state.hideGuessedOthers = false;
sandbox.state.targetQueue = [];
sandbox.applyRemoteSyncConfig(syncCfg, true, true);
check(sandbox.state.targetQuestionLimit === 6, "client applies targetQuestionLimit from syncCfg");
check(sandbox.state.allowPass === true, "client applies allowPass from syncCfg");
check(sandbox.state.hideGuessedOthers === true, "client applies hideGuessedOthers from syncCfg");
check(
  JSON.stringify(sandbox.state.targetQueue) === JSON.stringify(syncCfg.sharedTargetQueue),
  "client receives identical sharedTargetQueue order from host"
);

// 6. hideGuessedOthers hides unlocked/missed polygons & labels during play, reveals on gameOver
sandbox.state.playMode = "target_random";
sandbox.state.hideGuessedOthers = true;
sandbox.state.isGameOver = false;
const unlockedTown = sandbox.ALL_TOWNS.find((t) => t.countyName === "臺北市" && t.id !== sandbox.state.targetId);
sandbox.state.unlockedTowns.add(unlockedTown.id);
const hiddenStyle = sandbox.computePolygonStyle(unlockedTown);
check(hiddenStyle.fillColor === "#162238" || hiddenStyle.fillColor === "#0f172a", "computePolygonStyle hides unlocked town fill when hideGuessedOthers=true");
sandbox.state.isGameOver = true;
const revealedStyle = sandbox.computePolygonStyle(unlockedTown);
check(revealedStyle.fillOpacity >= 0.6, "computePolygonStyle reveals unlocked town fill after gameOver");

// 7. Limited N-question round scoring, 1/N live progress, grading & P2P counts
sandbox.state.playMode = "target_random";
sandbox.state.difficulty = "casual";
sandbox.state.timerMode = "up";
sandbox.state.regionQuizEnabled = true;
sandbox.state.stationQuizEnabled = false;
sandbox.state.airportQuizEnabled = false;
sandbox.state.portQuizEnabled = false;
sandbox.state.reservoirQuizEnabled = false;
sandbox.state.lakeQuizEnabled = false;
sandbox.state.settlementQuizEnabled = false;
sandbox.state.selectedCounties = new sandbox.Set(sandbox.ALL_TOWNS.map((t) => t.countyName));
sandbox.state.selectedTownIds = new sandbox.Set(sandbox.ALL_TOWNS.map((t) => t.id));
sandbox.state.targetQuestionLimit = 20;
sandbox.state.allowPass = true;
sandbox.state.hideGuessedOthers = true;

sandbox.resetGame();
check(sandbox.state.targetQueue.length === 20, "368-town scope with limit=20 builds 20-question targetQueue");
check(getEl("top-score-display").textContent === "0 / 20 題", `initial top-score-display shows 0 / 20 題, got ${getEl("top-score-display").textContent}`);
check(getEl("top-percent-display").textContent === "0.0%", `initial top-percent-display shows 0.0%, got ${getEl("top-percent-display").textContent}`);

// Answer 1st question -> should show 1 / 20 (5.0%), NOT 1 / 368 (0.3%)
const firstQ = sandbox.ALL_TOWNS.find((t) => t.id === sandbox.state.targetId);
sandbox.state.elapsedSec = 2;
sandbox.evaluateGuess(firstQ.baseName);
check(getEl("top-score-display").textContent === "1 / 20 題", `after 1st answer top-score-display shows 1 / 20 題, got ${getEl("top-score-display").textContent}`);
check(getEl("top-percent-display").textContent === "5.0%", `after 1st answer top-percent-display shows 5.0%, got ${getEl("top-percent-display").textContent}`);
check(getEl("local-p2p-score").textContent === "1 / 20", `local-p2p-score shows 1 / 20, got ${getEl("local-p2p-score").textContent}`);
const p2pLimitedCounts = sandbox.getLocalGrandCounts();
check(p2pLimitedCounts.grandCurrent === 1 && p2pLimitedCounts.grandTotal === 20, `getLocalGrandCounts returns 1/20, got ${p2pLimitedCounts.grandCurrent}/${p2pLimitedCounts.grandTotal}`);

// Answer remaining 19 questions -> 20/20 perfect score in 40s should get SSS/SS/S+ (NOT C!)
sandbox.state.elapsedSec = 40;
for (let i = 1; i < 20; i++) {
  const curT = sandbox.ALL_TOWNS.find((t) => t.id === sandbox.state.targetId);
  sandbox.evaluateGuess(curT.baseName);
}
check(sandbox.state.isGameOver === true, "20/20 ends the round");
check(sandbox.state.finalStats.grandScore === 20 && sandbox.state.finalStats.grandTotal === 20, `20/20 finalStats must be 20/20, got ${sandbox.state.finalStats.grandScore}/${sandbox.state.finalStats.grandTotal}`);
check(sandbox.state.finalStats.isLimitedRound === true, "finalStats.isLimitedRound is true");
const perfectGrade = sandbox.getGradeFromStats(sandbox.state.finalStats);
check(["SSS", "SS", "S+"].includes(perfectGrade.grade), `20/20 perfect score must earn SSS/SS/S+, got ${perfectGrade.grade}`);
check(getEl("settlement-pct").textContent === "100.0%", `settlement-pct shows 100.0%, got ${getEl("settlement-pct").textContent}`);
check(getEl("settlement-grand-score").textContent === "20 / 20 題", `settlement-grand-score shows 20 / 20 題, got ${getEl("settlement-grand-score").textContent}`);

// 18/20 with 2 passes -> 90% S grade, and ONLY 2 missedTowns (not 350!)
sandbox.resetGame();
sandbox.state.elapsedSec = 50;
for (let i = 0; i < 18; i++) {
  const curT = sandbox.ALL_TOWNS.find((t) => t.id === sandbox.state.targetId);
  sandbox.evaluateGuess(curT.baseName);
}
sandbox.passCurrentTarget();
sandbox.passCurrentTarget();
check(sandbox.state.isGameOver === true, "18 answered + 2 passed finishes 20-question round");
check(sandbox.state.finalStats.grandScore === 18 && sandbox.state.finalStats.grandTotal === 20, `18/20 finalStats must be 18/20, got ${sandbox.state.finalStats.grandScore}/${sandbox.state.finalStats.grandTotal}`);
check(sandbox.state.finalStats.reason === "round_complete", `18/20 with 2 passes reason is round_complete, got ${sandbox.state.finalStats.reason}`);
check(sandbox.state.missedTowns.size === 2, `18/20 limited round must mark ONLY the 2 missed towns (not 350), got ${sandbox.state.missedTowns.size}`);
const ninetyGrade = sandbox.getGradeFromStats(sandbox.state.finalStats);
check(ninetyGrade.grade === "S", `18/20 (90%) must earn S grade, got ${ninetyGrade.grade}`);

// Limit > pool size (limit=50 on Taipei 12 districts) -> denominator caps at 12
sandbox.state.selectedCounties = new sandbox.Set(["臺北市"]);
sandbox.state.selectedTownIds = new sandbox.Set(
  sandbox.ALL_TOWNS.filter((t) => t.countyName === "臺北市").map((t) => t.id)
);
sandbox.state.targetQuestionLimit = 50;
sandbox.resetGame();
check(getEl("top-score-display").textContent === "0 / 12 題", `limit=50 on 12-district scope caps at 0 / 12 題, got ${getEl("top-score-display").textContent}`);

// Unlimited mode (targetQuestionLimit=0) still uses full pool total
sandbox.state.targetQuestionLimit = 0;
sandbox.state.selectedCounties = new sandbox.Set(sandbox.ALL_TOWNS.map((t) => t.countyName));
sandbox.state.selectedTownIds = new sandbox.Set(sandbox.ALL_TOWNS.map((t) => t.id));
sandbox.resetGame();
check(sandbox.getLocalGrandCounts().grandTotal === 368, "unlimited mode restores full 368 grandTotal");

console.log(`PASS: All ${checks} checks passed for mobile touch fix, N-question limit, Pass, synced PK queue, and hideGuessedOthers!`);
