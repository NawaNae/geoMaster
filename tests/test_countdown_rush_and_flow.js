#!/usr/bin/env node
"use strict";

/**
 * TDD Suite: Countdown Rush (Random + Pin-Drop), Pin-Drop Countdown Bonus,
 * Default Show Blocks, N-Question Default Hide Guessed, and Faster Game Flow.
 * Run with: node tests/test_countdown_rush_and_flow.js
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const readRepo = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

function createStubElement(id = "") {
  const classes = new Set();
  if (String(id).startsWith("modal-") || id === "p2p-countdown-overlay") {
    classes.add("hidden");
  }
  const attrs = {};
  const listeners = {};
  let focusCount = 0;
  const el = {
    id,
    tagName: "DIV",
    value: "",
    textContent: "",
    innerText: "",
    checked: false,
    disabled: false,
    options: [],
    selectedIndex: 0,
    style: {
      setProperty() {},
      getPropertyValue() { return ""; },
      width: ""
    },
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
    setAttribute: (k, v) => { attrs[k] = String(v); },
    getAttribute: (k) => (k in attrs ? attrs[k] : null),
    addEventListener: (ev, fn) => {
      listeners[ev] = listeners[ev] || [];
      listeners[ev].push(fn);
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    closest: () => null,
    appendChild: (node) => { el.children.push(node); return node; },
    replaceChildren: (...nodes) => { el.children = [...nodes]; },
    cloneNode: () => createStubElement(`${id}-clone`),
    remove: () => {},
    focus: () => { focusCount++; },
    get _focusCount() { return focusCount; },
    resetFocusCount: () => { focusCount = 0; },
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 40, width: 100, height: 40 })
  };
  el.content = {
    firstElementChild: el,
    cloneNode: () => createStubElement(`${id}-clone`)
  };
  return el;
}

const domCache = {};
function getEl(id) {
  if (!domCache[id]) domCache[id] = createStubElement(id);
  return domCache[id];
}

let fakeNow = 1_000_000;
class FakeDate extends Date {
  constructor(...args) {
    if (args.length === 0) super(fakeNow);
    else super(...args);
  }
  static now() { return fakeNow; }
}

const intervals = new Map();
let nextTimerId = 1;

const sandbox = {
  console,
  Math,
  Date: FakeDate,
  Set,
  Map,
  Array,
  Object,
  JSON,
  Number,
  String,
  Boolean,
  Promise,
  RegExp,
  Intl,
  URLSearchParams,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  setTimeout: (fn) => nextTimerId++,
  clearTimeout: () => {},
  setInterval: (fn, ms) => {
    const id = nextTimerId++;
    intervals.set(id, { fn, ms });
    return id;
  },
  clearInterval: (id) => {
    intervals.delete(id);
  },
  requestAnimationFrame: (cb) => { if (typeof cb === "function") cb(); return 1; },
  cancelAnimationFrame: () => {},
  navigator: { userAgent: "node-test", language: "zh-TW" },
  screen: { width: 1280, height: 800, colorDepth: 24 },
  addEventListener: () => {},
  removeEventListener: () => {},
  MutationObserver: class { observe() {} disconnect() {} },
  window: {},
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  document: {
    readyState: "loading",
    activeElement: null,
    body: createStubElement("body"),
    documentElement: createStubElement("html"),
    getElementById: (id) => getEl(id),
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => createStubElement(tag),
    createElementNS: (_ns, tag) => createStubElement(tag),
    createDocumentFragment: () => ({ children: [], appendChild(n) { this.children.push(n); return n; } }),
    addEventListener: () => {},
    removeEventListener: () => {}
  },
  location: { href: "file:///index.html", origin: "null", pathname: "/index.html", search: "" },
  history: { replaceState() {} },
  fetch: async () => ({ ok: false })
};
sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);

function loadScript(rel) {
  vm.runInContext(readRepo(rel), ctx, { filename: rel });
}

[
  "data/admin-data.js",
  "data/transport-data.js",
  "data/poi-data.js",
  "js/map-pack-registry.js",
  "js/state.js",
  "js/map-engine.js",
  "js/transport-engine.js",
  "js/poi-engine.js",
  "js/label-engine.js",
  "js/pindrop-engine.js",
  "js/game-logic.js",
  "js/dashboard-ui.js",
  "js/p2p-engine.js",
  "js/ui-controls.js"
].forEach(loadScript);

vm.runInContext(`
  initMap();
  if (typeof initPoiMapEngine === "function") initPoiMapEngine();
  if (typeof bindAllUIEvents === "function") bindAllUIEvents();
  window.state = state;
  window.ALL_TOWNS = ALL_TOWNS;
  window.COUNTY_BY_NAME = COUNTY_BY_NAME;
  window.map = map;
`, ctx);

let checks = 0;
const failures = [];
function check(cond, label) {
  checks++;
  if (!cond) failures.push(label);
}

// =========================================================================
// 1. DEFAULT STATES: Show blocks by default, countdown options, bonus default
// =========================================================================
check(sandbox.state.showDistrictBorders === true, "showDistrictBorders defaults to true");
check(sandbox.state.pinDropShowBorders === false, "pinDropShowBorders defaults to false (預設關閉顯示所有區塊)");
check(sandbox.state.questionCountdownEnabled === false, "questionCountdownEnabled defaults to false (選項)");
check(sandbox.state.questionCountdownSec === 15, "questionCountdownSec defaults to 15s");
check(sandbox.state.pinDropCountdownBonus === true, "pinDropCountdownBonus defaults to true (選項, 預設)");
check(sandbox.state.hideGuessedOthers === false, "hideGuessedOthers defaults to false when targetQuestionLimit=0");

// =========================================================================
// 2. N-QUESTION DEFAULT HIDE GUESSED BLOCKS (n題預設隱藏猜過的區塊)
// =========================================================================
sandbox.setTargetQuestionLimit(10);
check(sandbox.state.targetQuestionLimit === 10, "setTargetQuestionLimit(10) sets limit=10");
check(sandbox.state.hideGuessedOthers === true, "switching 0 -> 10 questions defaults hideGuessedOthers to true");

// Manual override while in N-question mode is preserved across N -> M changes
sandbox.setHideGuessedOthers(false);
check(sandbox.state.hideGuessedOthers === false, "user can manually uncheck hideGuessedOthers in N-question mode");
sandbox.setTargetQuestionLimit(20);
check(sandbox.state.targetQuestionLimit === 20, "setTargetQuestionLimit(20) sets limit=20");
check(sandbox.state.hideGuessedOthers === false, "changing 10 -> 20 preserves manual hideGuessedOthers=false");

// Returning to 0 (全部) resets hideGuessedOthers to false, then 0 -> 5 defaults back to true
sandbox.setTargetQuestionLimit(0);
check(sandbox.state.targetQuestionLimit === 0, "setTargetQuestionLimit(0) resets to unlimited");
check(sandbox.state.hideGuessedOthers === false, "switching N -> 0 resets hideGuessedOthers to false");
sandbox.setTargetQuestionLimit(5);
check(sandbox.state.hideGuessedOthers === true, "switching 0 -> 5 defaults hideGuessedOthers to true again");

// =========================================================================
// 3. RANDOM MODE COUNTDOWN RUSH (允許倒數搶答)
// =========================================================================
check(typeof sandbox.setQuestionCountdownEnabled === "function", "setQuestionCountdownEnabled exported");
check(typeof sandbox.setQuestionCountdownSec === "function", "setQuestionCountdownSec exported");
check(typeof sandbox.startQuestionCountdown === "function", "startQuestionCountdown exported");
check(typeof sandbox.stopQuestionCountdown === "function", "stopQuestionCountdown exported");
check(typeof sandbox.handleQuestionCountdownTimeout === "function", "handleQuestionCountdownTimeout exported");

sandbox.state.selectedCounties = new sandbox.Set(["臺北市"]);
sandbox.state.selectedTownIds = new sandbox.Set(
  sandbox.ALL_TOWNS.filter((t) => t.countyName === "臺北市").map((t) => t.id)
);
sandbox.state.playMode = "target_random";
sandbox.state.difficulty = "casual";
sandbox.setTargetQuestionLimit(3);
sandbox.setQuestionCountdownSec(10);
sandbox.setQuestionCountdownEnabled(true);
sandbox.resetGame();

check(sandbox.state.questionCountdownEnabled === true, "questionCountdownEnabled is true");
check(sandbox.state.questionCountdownSec === 10, "questionCountdownSec is 10");
check(sandbox.state.questionTimer && sandbox.state.questionTimer.active === true, "question countdown starts active on target_random resetGame");
check(!getEl("target-countdown-pill").classList.contains("hidden"), "#target-countdown-pill is visible during countdown rush");
check(!getEl("target-countdown-bar-wrap").classList.contains("hidden"), "#target-countdown-bar-wrap is visible during countdown rush");

const q1Id = sandbox.state.targetId;
check(Boolean(q1Id), "Q1 target selected");

// Simulate timeout on Q1
sandbox.handleQuestionCountdownTimeout();
check(sandbox.state.missedTowns.has(q1Id), "timeout marks Q1 in missedTowns");
check(sandbox.state.passedTargetKeys.size === 1, "timeout records Q1 in passedTargetKeys");
check(sandbox.state.targetId !== q1Id && Boolean(sandbox.state.targetId), "timeout advances to Q2");
check(sandbox.state.questionTimer.active === true, "countdown restarts for Q2");

// Pass Q2 -> clears input & refocuses input for fast flow
const ansInput = getEl("answer-input");
ansInput.value = "誤打字";
ansInput.resetFocusCount();
sandbox.passCurrentTarget();
check(ansInput.value === "", "passCurrentTarget clears leftover text in #answer-input");
check(ansInput._focusCount >= 1, "passCurrentTarget refocuses #answer-input for faster flow");

// Timeout Q3 -> finishes 3-question round and stops timer
sandbox.handleQuestionCountdownTimeout();
check(sandbox.state.isGameOver === true, "timeout on last question finishes round");
check(sandbox.state.questionTimer.active === false, "question countdown stops on gameOver");

// =========================================================================
// 4. P2P SYNC FOR COUNTDOWN RUSH & N-QUESTION HIDE GUESSED
// =========================================================================
sandbox.state.isHost = true;
sandbox.state.roomCode = "TW1234";
sandbox.state.playMode = "target_random";
sandbox.state.targetQuestionLimit = 0;
sandbox.state.hideGuessedOthers = false;
sandbox.state.questionCountdownEnabled = false;
sandbox.state.questionCountdownSec = 15;

// Host switches 0 -> 10 questions in room -> patch includes hideGuessedOthers: true
sandbox.setTargetQuestionLimit(10);
check(sandbox.state.targetQuestionLimit === 10, "host setTargetQuestionLimit(10) applies in room");
check(sandbox.state.hideGuessedOthers === true, "host setTargetQuestionLimit(10) auto-enables hideGuessedOthers in room");

sandbox.setQuestionCountdownEnabled(true);
sandbox.setQuestionCountdownSec(20);
const hostCfg = sandbox.getHostSyncConfig(false, "", "", true);
check(hostCfg.questionCountdownEnabled === true, "getHostSyncConfig includes questionCountdownEnabled");
check(hostCfg.questionCountdownSec === 20, "getHostSyncConfig includes questionCountdownSec");
check(hostCfg.targetQuestionLimit === 10, "getHostSyncConfig includes targetQuestionLimit=10");
check(hostCfg.hideGuessedOthers === true, "getHostSyncConfig includes hideGuessedOthers=true");

const summaryTxt = sandbox.getConciseDifficultySummaryText();
check(summaryTxt.includes("倒數搶答") && summaryTxt.includes("20"), `room summary mentions 倒數搶答 20s, got: ${summaryTxt}`);

// Client receives config
sandbox.state.isHost = false;
sandbox.state.questionCountdownEnabled = false;
sandbox.state.questionCountdownSec = 15;
sandbox.state.targetQuestionLimit = 0;
sandbox.state.hideGuessedOthers = false;
sandbox.applyRemoteSyncConfig(hostCfg, true, true);
check(sandbox.state.questionCountdownEnabled === true, "client applies questionCountdownEnabled");
check(sandbox.state.questionCountdownSec === 20, "client applies questionCountdownSec");
check(sandbox.state.targetQuestionLimit === 10, "client applies targetQuestionLimit");
check(sandbox.state.hideGuessedOthers === true, "client applies hideGuessedOthers");

sandbox.state.roomCode = "";
sandbox.state.isHost = false;

// =========================================================================
// 5. PIN-DROP: DEFAULT SHOW BORDERS, COUNTDOWN RUSH & COUNTDOWN SCORE BONUS
// =========================================================================
check(typeof sandbox.computePinDropCountdownBonus === "function", "computePinDropCountdownBonus exported");
check(typeof sandbox.setPinDropCountdownBonus === "function", "setPinDropCountdownBonus exported");
check(typeof sandbox.handlePinDropMapDoubleClick === "function", "handlePinDropMapDoubleClick exported");

// Pure formula checks
check(sandbox.computePinDropCountdownBonus(5000, 15000, 15000, true) === 1000, "full remaining time on 5000 gives +1000 bonus");
check(sandbox.computePinDropCountdownBonus(5000, 7500, 15000, true) === 500, "half remaining time on 5000 gives +500 bonus");
check(sandbox.computePinDropCountdownBonus(2500, 12000, 15000, true) === 400, "80% remaining time on 2500 gives +400 bonus");
check(sandbox.computePinDropCountdownBonus(5000, 15000, 15000, false) === 0, "disabled bonus returns 0");
check(sandbox.computePinDropCountdownBonus(0, 15000, 15000, true) === 0, "0 baseScore returns 0 bonus");
check(sandbox.computePinDropCountdownBonus(5000, 0, 15000, true) === 0, "0 remainingMs returns 0 bonus");

// Rebuild sample geometry for deterministic Pin-Drop tests
const makeRect = (x1, y1, x2, y2) => [[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]];
sandbox.rebuildMapLayers({
  townsGeo: {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: { COUNTYNAME: "彰化縣", TOWNNAME: "芳苑鄉" }, geometry: { type: "Polygon", coordinates: [makeRect(120.28, 23.88, 120.38, 23.98)] } },
      { type: "Feature", properties: { COUNTYNAME: "花蓮縣", TOWNNAME: "秀林鄉" }, geometry: { type: "Polygon", coordinates: [makeRect(121.30, 23.98, 121.65, 24.32)] } },
      { type: "Feature", properties: { COUNTYNAME: "彰化縣", TOWNNAME: "二林鎮" }, geometry: { type: "Polygon", coordinates: [makeRect(120.35, 23.86, 120.46, 23.95)] } }
    ]
  },
  countiesGeo: { type: "FeatureCollection", features: [] }
});

const fangyuan = sandbox.ALL_TOWNS.find((t) => t.countyName === "彰化縣" && t.townName === "芳苑鄉");
const xiulin = sandbox.ALL_TOWNS.find((t) => t.countyName === "花蓮縣" && t.townName === "秀林鄉");
const erlin = sandbox.ALL_TOWNS.find((t) => t.countyName === "彰化縣" && t.townName === "二林鎮");

sandbox.state.selectedCounties = new sandbox.Set(["彰化縣", "花蓮縣"]);
sandbox.state.selectedTownIds = new sandbox.Set([fangyuan.id, xiulin.id, erlin.id]);
sandbox.state.pinDropRounds = 5;
sandbox.state.questionCountdownEnabled = false;
sandbox.state.pinDropCountdownBonus = true;
sandbox.state.pinDropShowBorders = true;
sandbox.setPlayMode("pin_drop");

check(sandbox.state.showDistrictBorders === true, "entering pin_drop shows district blocks by default (showDistrictBorders === true)");
check(getEl("btn-target-pass").classList.contains("hidden"), "#btn-target-pass is hidden in pin_drop mode (Visual QA regression guard)");

// Without countdown enabled, inside hit scores exact 5000 (0 speedBonus)
sandbox.state.pinDrop.currentTarget = sandbox.buildPinDropTargetFromTown(fangyuan);
sandbox.handlePinDropMapClick({ lat: 23.93, lng: 120.33 });
sandbox.confirmPinDropGuess();
check(sandbox.state.pinDrop.lastReveal.baseScore === 5000, "non-countdown inside hit baseScore=5000");
check(sandbox.state.pinDrop.lastReveal.speedBonus === 0, "non-countdown speedBonus=0");
check(sandbox.state.pinDrop.lastReveal.score === 5000, "non-countdown total score=5000");

// Enable countdown rush (10s) with default countdown bonus ON
fakeNow = 2_000_000;
sandbox.setQuestionCountdownSec(10);
sandbox.setQuestionCountdownEnabled(true);
sandbox.startPinDropGame();
check(sandbox.state.questionTimer.active === true, "pin_drop starts per-question countdown when enabled");

// Round 1: answer after 2 seconds (8s / 10s left -> +800 bonus on 5000 = 5800)
sandbox.state.pinDrop.currentTarget = sandbox.buildPinDropTargetFromTown(fangyuan);
fakeNow += 2000;
sandbox.handlePinDropMapDoubleClick({ lat: 23.93, lng: 120.33 }); // double-click places & confirms immediately!
check(sandbox.state.pinDrop.phase === "revealed", "double-click places pin and confirms immediately for fast flow");
check(sandbox.state.pinDrop.lastReveal.baseScore === 5000, "R1 baseScore=5000");
check(sandbox.state.pinDrop.lastReveal.speedBonus === 800, `R1 speedBonus should be 800 (80% of 1000), got ${sandbox.state.pinDrop.lastReveal.speedBonus}`);
check(sandbox.state.pinDrop.lastReveal.score === 5800, `R1 total score should be 5800, got ${sandbox.state.pinDrop.lastReveal.score}`);
check(sandbox.state.questionTimer.active === false, "question countdown stops when pin is confirmed");

// Round 2: turn countdown bonus OFF -> fast answer gets 0 speedBonus
sandbox.setPinDropCountdownBonus(false);
sandbox.nextPinDropRound();
sandbox.state.pinDrop.currentTarget = sandbox.buildPinDropTargetFromTown(xiulin);
fakeNow += 1000;
sandbox.handlePinDropMapClick({ lat: 24.15, lng: 121.48 });
sandbox.confirmPinDropGuess();
check(sandbox.state.pinDrop.lastReveal.baseScore === 5000, "R2 bonus-off baseScore=5000");
check(sandbox.state.pinDrop.lastReveal.speedBonus === 0, "R2 bonus-off speedBonus=0");
check(sandbox.state.pinDrop.lastReveal.score === 5000, "R2 bonus-off score=5000");

// Round 3: timeout with NO pin placed -> 0 pts, timedOut=true, revealed
sandbox.setPinDropCountdownBonus(true);
sandbox.nextPinDropRound();
sandbox.state.pinDrop.currentTarget = sandbox.buildPinDropTargetFromTown(erlin);
fakeNow += 10000;
sandbox.handleQuestionCountdownTimeout();
check(sandbox.state.pinDrop.phase === "revealed", "Pin-Drop timeout without pin enters revealed phase");
check(sandbox.state.pinDrop.lastReveal.timedOut === true, "Pin-Drop timeout marks timedOut=true");
check(sandbox.state.pinDrop.lastReveal.score === 0, "Pin-Drop timeout without pin scores 0");

// Test timeout WITH preview pin placed -> auto-submits preview pin with 0 speedBonus
sandbox.startPinDropGame();
sandbox.state.pinDrop.currentTarget = sandbox.buildPinDropTargetFromTown(fangyuan);
sandbox.handlePinDropMapClick({ lat: 23.93, lng: 120.33 }); // inside Fangyuan
fakeNow += 10000;
sandbox.handleQuestionCountdownTimeout();
check(sandbox.state.pinDrop.phase === "revealed", "Pin-Drop timeout with preview pin enters revealed phase");
check(sandbox.state.pinDrop.lastReveal.timedOut === true, "auto-submitted preview pin marks timedOut=true");
check(sandbox.state.pinDrop.lastReveal.baseScore === 5000, "auto-submitted preview pin keeps accuracy score 5000");
check(sandbox.state.pinDrop.lastReveal.speedBonus === 0, "auto-submitted preview pin gets 0 speedBonus");

// =========================================================================
// 6. FASTER GAME FLOW & STATIC HYGIENE CHECKS
// =========================================================================
const gameLogicSrc = readRepo("js/game-logic.js");
const p2pSrc = readRepo("js/p2p-engine.js");
const focusDurMatch = gameLogicSrc.match(/function focusMapOnLatLng[\s\S]{0,900}duration:\s*([0-9.]+)/);
check(focusDurMatch && parseFloat(focusDurMatch[1]) <= 0.25, `focusMapOnLatLng flyTo duration should be <= 0.25s, got ${focusDurMatch && focusDurMatch[1]}`);
const p2pCdMatch = p2pSrc.match(/startSynchronizedP2PCountdown[\s\S]{0,4500}setInterval\([\s\S]*?,\s*(\d+)\)/);
check(p2pCdMatch && parseInt(p2pCdMatch[1], 10) <= 700, `P2P countdown interval should be <= 700ms, got ${p2pCdMatch && p2pCdMatch[1]}`);

// Zero .innerHTML contract
["index.html", "js/state.js", "js/pindrop-engine.js", "js/game-logic.js", "js/p2p-engine.js", "js/ui-controls.js"].forEach((rel) => {
  const lines = readRepo(rel).split(/\r?\n/);
  lines.forEach((line, idx) => {
    const t = line.trim();
    if (t.startsWith("//") || t.startsWith("/*") || t.startsWith("*")) return;
    check(!/\.innerHTML\b|\.outerHTML\b|\binsertAdjacentHTML\b/.test(t), `Zero innerHTML in ${rel}:${idx + 1}`);
  });
});

if (failures.length > 0) {
  console.error(`\n❌ test_countdown_rush_and_flow.js FAILED (${failures.length} / ${checks}):`);
  failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}`));
  process.exit(1);
}
console.log(`\n✅ test_countdown_rush_and_flow.js PASSED: ${checks} / ${checks} checks succeeded!`);
