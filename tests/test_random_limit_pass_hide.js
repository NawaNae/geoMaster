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

console.log(`PASS: All ${checks} checks passed for mobile touch fix, N-question limit, Pass, synced PK queue, and hideGuessedOthers!`);
