#!/usr/bin/env node
"use strict";

/**
 * Comprehensive TDD Suite for:
 *  1. ROC Historical Wall Map (歷史掛圖) fix across solo roc_1949 & composite packs + zoom > 10 + tileerror fallback
 *  2. Normal per-question countdown vs Multiplayer Rush countdown (grace window, slower-player scoring, timeout=0 Pass)
 *     + Official GeoGuessr distance scoring algorithm
 *  3. Railways & Landmarks for ROC 1945 (roc_1949), Japan (jp_pref), China Modern (cn_prov), and World (world_countries)
 * Run: node tests/test_hist_countdown_rail_landmarks.js
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const readRepo = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

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

// =========================================================================
// 1. STATIC SECURITY & PACKAGING CONTRACTS
// =========================================================================
const indexHtml = readRepo("index.html");
const packRailSrc = readRepo("data/pack-rail-data.js");
const landmarkSrc = readRepo("data/landmark-data.js");

check(!/\.innerHTML\b/.test(packRailSrc), "1.Static", "Zero .innerHTML in data/pack-rail-data.js");
check(!/\.innerHTML\b/.test(landmarkSrc), "1.Static", "Zero .innerHTML in data/landmark-data.js");
check(!/\bfetch\s*\(/.test(packRailSrc), "1.Static", "Zero fetch() in data/pack-rail-data.js");
check(!/\bfetch\s*\(/.test(landmarkSrc), "1.Static", "Zero fetch() in data/landmark-data.js");
check(indexHtml.includes('<script src="data/pack-rail-data.js"></script>'), "1.Static", "index.html loads data/pack-rail-data.js");
check(indexHtml.includes('<script src="data/landmark-data.js"></script>'), "1.Static", "index.html loads data/landmark-data.js");
check(indexHtml.includes('data-topic="landmark"'), "1.Static", "index.html has landmark topic chip");
check(indexHtml.includes('data-qcd-mode="normal"') && indexHtml.includes('data-qcd-mode="rush"'), "1.Static", "index.html has normal & rush countdown mode pills");

// =========================================================================
// 2. RUNTIME SANDBOX SETUP
// =========================================================================
function createMockEl(id = "", tag = "div") {
  const classes = new Set();
  if (String(id).startsWith("modal-") || id === "p2p-countdown-overlay") classes.add("hidden");
  const attrs = new Map();
  const children = [];
  const el = {
    id,
    tagName: tag.toUpperCase(),
    textContent: "",
    innerText: "",
    value: "",
    checked: false,
    disabled: false,
    options: [],
    selectedIndex: 0,
    style: { setProperty() {}, getPropertyValue: () => "", width: "" },
    dataset: {},
    children,
    classList: {
      add: (...cs) => cs.forEach((c) => classes.add(c)),
      remove: (...cs) => cs.forEach((c) => classes.delete(c)),
      contains: (c) => classes.has(c),
      toggle: (c, force) => {
        if (force === undefined) classes.has(c) ? classes.delete(c) : classes.add(c);
        else if (force) classes.add(c);
        else classes.delete(c);
      }
    },
    setAttribute: (k, v) => attrs.set(k, String(v)),
    getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
    addEventListener: () => {},
    appendChild: (ch) => { children.push(ch); return ch; },
    replaceChildren: (...chs) => { children.length = 0; children.push(...chs); },
    cloneNode: () => createMockEl(`${id}-clone`, tag),
    querySelector: (sel) => {
      for (const ch of children) {
        if (sel === ".capital-topic-label" && ch.classList.contains("capital-topic-label")) return ch;
        if (sel === ".landmark-topic-label" && ch.classList.contains("landmark-topic-label")) return ch;
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
    closest: () => null,
    focus: () => {},
    remove: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 40, width: 100, height: 40 })
  };
  el.content = { firstElementChild: el, cloneNode: () => createMockEl(`${id}-clone`, tag) };
  return el;
}

const domCache = {};
function getEl(id) {
  if (!domCache[id]) domCache[id] = createMockEl(id);
  return domCache[id];
}

const topicChips = {};
["region", "station", "airport", "port", "reservoir", "lake", "settlement", "capital", "landmark"].forEach((topic) => {
  const card = createMockEl(`topic-${topic}`);
  card.classList.add("topic-chip-btn");
  card.setAttribute("data-topic", topic);
  const soloBtn = createMockEl("", "button");
  soloBtn.classList.add("geo-solo-btn");
  const lbl = createMockEl("", "span");
  if (topic === "capital") lbl.classList.add("capital-topic-label");
  if (topic === "landmark") lbl.classList.add("landmark-topic-label");
  soloBtn.appendChild(lbl);
  const unionBtn = createMockEl("", "button");
  unionBtn.classList.add("geo-union-btn");
  const chk = createMockEl("", "span");
  chk.classList.add("topic-check");
  unionBtn.appendChild(chk);
  card.appendChild(soloBtn);
  card.appendChild(unionBtn);
  topicChips[topic] = card;
});

const createdTileLayers = [];
let fakeNow = 5_000_000;
class FakeDate extends Date {
  constructor(...args) {
    if (args.length === 0) super(fakeNow);
    else super(...args);
  }
  static now() { return fakeNow; }
}

const sentP2PMessages = [];
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
  Error,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  setTimeout: () => 1,
  clearTimeout: () => {},
  setInterval: () => 1,
  clearInterval: () => {},
  requestAnimationFrame: (cb) => { if (typeof cb === "function") cb(); return 1; },
  cancelAnimationFrame: () => {},
  MutationObserver: class { observe() {} disconnect() {} },
  ResizeObserver: class { observe() {} disconnect() {} },
  navigator: { userAgent: "node-test", language: "zh-TW" },
  screen: { width: 1440, height: 900, colorDepth: 24 },
  addEventListener: () => {},
  removeEventListener: () => {},
  matchMedia: () => ({ matches: false, addEventListener: () => {} }),
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  location: { href: "file:///index.html", origin: "null", pathname: "/index.html", search: "", protocol: "file:" },
  history: { replaceState() {} },
  fetch: async () => ({ ok: false }),
  L: {
    canvas: () => ({}),
    map: () => ({
      getZoom: () => 5,
      setView() {},
      flyTo() {},
      flyToBounds() {},
      panTo() {},
      fitBounds() {},
      setMinZoom() {},
      setMaxZoom() {},
      setMaxBounds() {},
      getSize: () => ({ divideBy: () => ({ x: 400, y: 300 }) }),
      getCenter: () => ({ lat: 35, lng: 105 }),
      getBounds: () => ({
        isValid: () => true,
        pad: function () { return this; },
        contains: () => true,
        intersects: () => true,
        getCenter: () => ({ lat: 35, lng: 105 }),
        getSouthWest: () => ({ lat: 15, lng: 70 }),
        getNorthEast: () => ({ lat: 55, lng: 150 }),
        getNorthWest: () => ({ lat: 55, lng: 70 }),
        getSouthEast: () => ({ lat: 15, lng: 150 })
      }),
      latLngToContainerPoint: () => ({ x: 200, y: 200 }),
      project: () => ({ x: 0, y: 0 }),
      getZoomScale: () => 1,
      getPane: () => null,
      createPane: () => ({ style: {} }),
      addLayer() {},
      removeLayer() {},
      hasLayer: () => false,
      on() {},
      options: {},
      doubleClickZoom: { disable() {}, enable() {} }
    }),
    layerGroup: () => ({
      addTo: function () { return this; },
      clearLayers() {},
      removeLayer() {},
      addLayer() {}
    }),
    tileLayer: (url, opts) => {
      const handlers = {};
      const tl = {
        url,
        opts,
        on: (ev, fn) => { handlers[ev] = fn; return tl; },
        fire: (ev, payload) => { if (handlers[ev]) handlers[ev](payload); },
        addTo: function () { return this; }
      };
      createdTileLayers.push(tl);
      return tl;
    },
    polyline: (pts, opts) => ({
      pts,
      opts,
      addTo: function () { return this; },
      on() {},
      setStyle() {},
      bindTooltip() {}
    }),
    circleMarker: (ll, opts) => ({
      ll,
      opts,
      addTo: function () { return this; },
      setStyle() {},
      bringToFront() {},
      on() {},
      bindTooltip() {}
    }),
    marker: (ll, opts) => ({
      ll,
      opts,
      addTo: function () { return this; },
      on() {},
      setLatLng() {}
    }),
    divIcon: (opts) => opts,
    latLngBounds: (pts) => ({
      isValid: () => Array.isArray(pts) && pts.length > 0,
      pad: function () { return this; },
      getCenter: () => ({ lat: 35, lng: 105 }),
      getSouthWest: () => ({ lat: 30, lng: 100 }),
      getNorthEast: () => ({ lat: 40, lng: 110 }),
      getNorthWest: () => ({ lat: 40, lng: 100 }),
      getSouthEast: () => ({ lat: 30, lng: 110 }),
      intersects: () => true,
      contains: () => true,
      extend: function () { return this; }
    }),
    geoJSON: (geo, opts) => ({
      addTo: function () { return this; },
      setStyle() {},
      getBounds: () => ({
        isValid: () => true,
        getCenter: () => ({ lat: 35, lng: 105 }),
        getSouthWest: () => ({ lat: 30, lng: 100 }),
        getNorthEast: () => ({ lat: 40, lng: 110 }),
        getNorthWest: () => ({ lat: 40, lng: 100 }),
        getSouthEast: () => ({ lat: 30, lng: 110 }),
        intersects: () => true,
        pad: function () { return this; }
      }),
      eachLayer() {},
      on() {}
    }),
    DomEvent: { stopPropagation() {} }
  },
  document: {
    readyState: "loading",
    activeElement: null,
    body: createMockEl("body"),
    head: createMockEl("head"),
    documentElement: createMockEl("html"),
    getElementById: (id) => getEl(id),
    createElement: (tag) => createMockEl("", tag),
    createElementNS: (_ns, tag) => createMockEl("", tag),
    createDocumentFragment: () => ({ children: [], appendChild(n) { this.children.push(n); return n; } }),
    querySelector: () => null,
    querySelectorAll: (sel) => {
      if (sel === ".topic-chip-btn") return Object.values(topicChips);
      const m = sel.match(/\.topic-chip-btn\[data-topic="([^"]+)"\]/);
      if (m && topicChips[m[1]]) return [topicChips[m[1]]];
      return [];
    },
    addEventListener: () => {},
    removeEventListener: () => {}
  }
};
sandbox.window = sandbox;
sandbox.self = sandbox;
const ctx = vm.createContext(sandbox);

[
  "data/admin-data.js",
  "data/transport-data.js",
  "data/pack-rail-data.js",
  "data/poi-data.js",
  "data/capital-data.js",
  "data/landmark-data.js",
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
  "js/ui-controls.js",
  "data/packs/jp-pref-pack.js",
  "data/packs/cn-prov-pack.js",
  "data/packs/roc-1949-pack.js",
  "data/packs/world-countries-pack.js"
].forEach((rel) => vm.runInContext(readRepo(rel), ctx, { filename: rel }));

vm.runInContext(`
  initMap();
  if (typeof initPoiMapEngine === "function") initPoiMapEngine();
  window.state = state;
  window.map = map;
  const _origSendP2P = sendP2PMessage;
  sendP2PMessage = function(type, payload, target, exclude) {
    window.__sentP2PMessages.push({ type, payload });
    return _origSendP2P.apply(this, arguments);
  };
`, ctx);
sandbox.__sentP2PMessages = sentP2PMessages;

async function runTests() {
  // =========================================================================
  // SECTION A: ROC HISTORICAL WALL MAP FIX (Solo + Composite + Fallback + Switch Away)
  // =========================================================================
  const rocPack = sandbox.getMapPackById("roc_1949");
  check(Boolean(rocPack.historicalBasemap && rocPack.historicalBasemap.url), "2.HistMap", "roc_1949 full pack defines historicalBasemap.url");
  check(Boolean(rocPack.historicalBasemap && rocPack.historicalBasemap.fallbackUrl && rocPack.historicalBasemap.fallbackUrl.includes("CM300M_1959")), "2.HistMap", "roc_1949 historicalBasemap defines CM300M_1959 fallbackUrl");

  // Solo roc_1949
  await sandbox.switchActiveMapPack("roc_1949", { skipPaintYield: true });
  createdTileLayers.length = 0;
  sandbox.setMapBaseLayer("historical", true);
  check(createdTileLayers.length === 1, "2.HistMap", `Solo roc_1949 creates 1 historical tileLayer, got ${createdTileLayers.length}`);
  check(createdTileLayers[0].opts.maxNativeZoom === 10 && createdTileLayers[0].opts.maxZoom === 18, "2.HistMap", "Historical tileLayer uses maxNativeZoom:10 + maxZoom:18 so zoom > 10 never blanks");
  // Simulate tileerror -> falls back to CM300M_1959
  const fakeTile = { src: "https://gis.sinica.edu.tw/ccts/file-exists.php?img=China_Map_1947-png-5-26-12", dataset: {} };
  createdTileLayers[0].fire("tileerror", { tile: fakeTile, coords: { z: 5, x: 26, y: 12 } });
  check(fakeTile.src.includes("CM300M_1959-png-5-26-12"), "2.HistMap", `tileerror swaps tile src to CM300M_1959 fallback, got ${fakeTile.src}`);

  // Composite tw_modern+jp_pref+roc_1949 (was previously broken: 0 tiles!)
  await sandbox.switchActiveMapPack("tw_modern+jp_pref+roc_1949", { skipPaintYield: true });
  const comboPack = sandbox.getActiveMapPack();
  check(Boolean(comboPack.features.supportsHistoricalBasemap), "2.HistMap", "Composite tw+jp+roc supports historicalBasemap");
  check(Boolean(comboPack.historicalBasemap && comboPack.historicalBasemap.url), "2.HistMap", "Composite tw+jp+roc copies historicalBasemap from roc_1949");
  createdTileLayers.length = 0;
  sandbox.setMapBaseLayer("historical", true);
  check(createdTileLayers.length === 1 && createdTileLayers[0].url.includes("China_Map_1947"), "2.HistMap", "Composite tw+jp+roc renders historical wall map tileLayer");

  // Switching away to cn_prov resets mapLayer from historical -> vector (fixes setMapLayer typo!)
  await sandbox.switchActiveMapPack("cn_prov", { skipPaintYield: true });
  check(sandbox.state.mapLayer === "vector", "2.HistMap", `Switching away from roc_1949 resets historical layer to vector, got ${sandbox.state.mapLayer}`);

  // =========================================================================
  // SECTION B: NORMAL COUNTDOWN vs MULTIPLAYER RUSH + GEOGUESSR DISTANCE ALGORITHM
  // =========================================================================
  // B1. Official GeoGuessr Distance Algorithm
  const diag = sandbox.computeGeoGuessrMapDiagonalKm([[21.9, 120.0], [25.3, 122.0]]);
  check(diag > 350 && diag < 500, "3.GeoGuessr", `Taiwan diagonal ~430km, got ${diag.toFixed(1)}`);
  check(sandbox.computeGeoGuessrDistanceScore(0, 1000, 0) === 5000, "3.GeoGuessr", "0 km distance scores exact 5000");
  const expectedOneTenth = Math.round(5000 * Math.exp(-1)); // 1839
  check(sandbox.computeGeoGuessrDistanceScore(100, 1000, 0) === expectedOneTenth, "3.GeoGuessr", `d = D/10 scores exact GeoGuessr 5000*e^-1 = ${expectedOneTenth}`);

  // B2. Multiplayer Pin-Drop distance-aware scoring (closer slower pin vs sloppy fast pin!)
  const fastSloppy = sandbox.computeMultiplayerPinDropRoundScore({
    distanceKm: 180, mapDiagonalKm: 1000, remainingMs: 14000, totalMs: 15000,
    isFirstPlacer: true, countdownMode: "rush", bonusEnabled: true, timedOut: false, hasPin: true
  });
  const slowAccurate = sandbox.computeMultiplayerPinDropRoundScore({
    distanceKm: 5, mapDiagonalKm: 1000, remainingMs: 3000, totalMs: 15000,
    isFirstPlacer: false, countdownMode: "rush", bonusEnabled: true, timedOut: false, hasPin: true
  });
  check(slowAccurate.score > fastSloppy.score, "3.GeoGuessr", `Accurate slower guess (${slowAccurate.score}) beats sloppy fast guess (${fastSloppy.score})`);
  const fastAccurate = sandbox.computeMultiplayerPinDropRoundScore({
    distanceKm: 5, mapDiagonalKm: 1000, remainingMs: 12000, totalMs: 15000,
    isFirstPlacer: true, countdownMode: "rush", bonusEnabled: true, timedOut: false, hasPin: true
  });
  check(fastAccurate.score > slowAccurate.score, "3.GeoGuessr", `Equally accurate fast first guess (${fastAccurate.score}) beats slower guess (${slowAccurate.score})`);
  const normalAccurate = sandbox.computeMultiplayerPinDropRoundScore({
    distanceKm: 5, mapDiagonalKm: 1000, remainingMs: 12000, totalMs: 15000,
    isFirstPlacer: true, countdownMode: "normal", bonusEnabled: true, timedOut: false, hasPin: true
  });
  check(normalAccurate.speedBonus === 0 && normalAccurate.score === normalAccurate.baseScore, "3.GeoGuessr", "Normal countdown Pin-Drop uses pure GeoGuessr distance score (0 speedBonus)");
  const pinTimeout = sandbox.computeMultiplayerPinDropRoundScore({
    timedOut: true, hasPin: false, countdownMode: "normal"
  });
  check(pinTimeout.score === 0 && pinTimeout.passed === true, "3.GeoGuessr", "Pin-Drop timeout without pin scores 0 and marks passed=true");

  // B3. Name-Quiz Normal Countdown vs Multiplayer Rush Scoring
  check(sandbox.computeQuestionRushScore({ mode: "normal", isMultiplayer: true, isFirstSolver: false, remainingMs: 1000, totalMs: 15000 }) === 1000, "3.Countdown", "Normal countdown awards full 1000 pts even if slower");
  check(sandbox.computeQuestionRushScore({ mode: "rush", isMultiplayer: true, isFirstSolver: true, remainingMs: 12000, totalMs: 15000 }) === 1000, "3.Countdown", "Multiplayer rush first solver earns full 1000 pts");
  const slowerScore = sandbox.computeQuestionRushScore({ mode: "rush", isMultiplayer: true, isFirstSolver: false, remainingMs: 3000, totalMs: 15000 });
  check(slowerScore >= 400 && slowerScore < 1000, "3.Countdown", `Multiplayer rush slower solver still earns points (400..900), got ${slowerScore}`);
  check(sandbox.computeQuestionRushScore({ mode: "rush", timedOut: true, passed: true }) === 0, "3.Countdown", "Timeout / Pass scores 0 pts");

  // B4. Live Multiplayer Rush Sync (Opponent solves first -> grace countdown triggers -> slower local player guesses right & still scores!)
  await sandbox.switchActiveMapPack("jp_pref", { skipPaintYield: true });
  sandbox.state.roomCode = "JP7777";
  sandbox.state.isHost = false;
  sandbox.state.role = "player";
  sandbox.state.localInstanceId = "player_B";
  sandbox.state.players = {
    player_A: { id: "player_A", name: "Alice", role: "host", finished: false },
    player_B: { id: "player_B", name: "Bob", role: "player", finished: false }
  };
  sandbox.state.playMode = "target_random";
  sandbox.state.difficulty = "casual";
  sandbox.state.questionCountdownEnabled = true;
  sandbox.state.questionCountdownMode = "rush";
  sandbox.state.questionCountdownSec = 20;
  sandbox.state.rushGraceSec = 5;
  sandbox.state.targetQuestionLimit = 2;
  sandbox.state.targetQueue = [
    { kind: "town", id: "jp_13" }, // 東京都
    { kind: "town", id: "jp_27" }  // 大阪府
  ];
  sandbox.state.targetQueueIndex = 0;
  sandbox.state.rushScore = 0;
  sandbox.state.rushQuestionHistory = [];
  sandbox.state.unlockedTowns.clear();
  sandbox.state.passedTargetKeys.clear();
  sandbox.pickNextTargetRegion();
  check(sandbox.state.targetId === "jp_13", "3.MpRush", "Q1 starts on 東京都 (jp_13)");
  check(sandbox.isMultiplayerRushSyncActive() === true, "3.MpRush", "Multiplayer rush sync is active with 2 players");

  // 2 seconds pass (18s left); Opponent Alice solves Q1 first!
  fakeNow += 2000;
  sandbox.handleRemoteQuestionSolved({ questionIndex: 0, targetKey: "town:jp_13", name: "Alice", score: 1000, passed: false, isFirstSolver: true, graceSec: 5 }, "player_A");
  const remAfterGrace = sandbox.getQuestionCountdownRemainingMs();
  check(remAfterGrace > 0 && remAfterGrace <= 5000, "3.MpRush", `Opponent first-solve clamps local timer to <=5s grace window (got ${remAfterGrace}ms)`);
  check(sandbox.state.targetId === "jp_13", "3.MpRush", "Local slower player stays on Q1 during grace window to still earn points");

  // Local slower player Bob answers "東京" 1.5s into the grace window -> STILL SCORES points and advances to Q2!
  fakeNow += 1500;
  sentP2PMessages.length = 0;
  const okSlow = sandbox.evaluateGuess("東京", false);
  check(okSlow === true, "3.MpRush", "Slower player Bob successfully answers 東京 during grace window");
  check(sandbox.state.rushScore > 0 && sandbox.state.rushScore < 1000, "3.MpRush", `Slower player Bob earned positive partial rush score (${sandbox.state.rushScore})`);
  check(sentP2PMessages.some((m) => m.type === "SYNC_Q_SOLVED" && m.payload.score === sandbox.state.rushScore && m.payload.passed === false), "3.MpRush", "Bob broadcasts SYNC_Q_SOLVED with his slower score");
  check(sandbox.state.targetId === "jp_27", "3.MpRush", "Once both players answered Q1, advances cleanly to Q2 (大阪府)");

  // On Q2, Bob times out -> 0 pts, marked as Pass!
  const scoreBeforeTimeout = sandbox.state.rushScore;
  sandbox.handleQuestionCountdownTimeout();
  check(sandbox.state.rushScore === scoreBeforeTimeout, "3.MpRush", "Timeout adds 0 pts");
  check(sandbox.state.passedTargetKeys.has("town:jp_27") && sandbox.state.missedTowns.has("jp_27"), "3.MpRush", "Timeout marks Q2 as Pass + missed");

  // B5. P2P Config Sync for questionCountdownMode (normal vs rush)
  sandbox.state.isHost = true;
  sandbox.state.questionCountdownMode = "normal";
  sandbox.state.questionCountdownSec = 15;
  const normalSummary = sandbox.getConciseDifficultySummaryText();
  check(normalSummary.includes("每題倒數") && normalSummary.includes("15"), "3.P2PConfig", `Normal mode summary says 每題倒數 15秒, got: ${normalSummary}`);
  const cfgNormal = sandbox.getHostSyncConfig(false, "", "", false);
  check(cfgNormal.questionCountdownMode === "normal", "3.P2PConfig", "getHostSyncConfig includes questionCountdownMode='normal'");
  sandbox.state.isHost = false;
  sandbox.state.questionCountdownMode = "rush";
  sandbox.applyRemoteSyncConfig(cfgNormal, false, true);
  check(sandbox.state.questionCountdownMode === "normal", "3.P2PConfig", "applyRemoteSyncConfig applies questionCountdownMode='normal'");
  sandbox.state.roomCode = "";
  sandbox.state.players = {};
  sandbox.state.questionCountdownEnabled = false;
  sandbox.state.playMode = "free";

  // =========================================================================
  // SECTION C: JAPAN (jp_pref) RAILWAYS & LANDMARKS
  // =========================================================================
  await sandbox.switchActiveMapPack("jp_pref", { skipPaintYield: true });
  const jpLines = sandbox.getSelectableLinesForActivePack();
  check(jpLines.length === 9, "4.JP", `JP has 9 railway lines, got ${jpLines.length}`);
  sandbox.state.regionQuizEnabled = false;
  sandbox.state.stationQuizEnabled = true;
  sandbox.state.quizStationLines = new sandbox.Set(jpLines.map((l) => l.id));
  sandbox.state.landmarkQuizEnabled = true;
  sandbox.syncLegacyQuizTargetMode();
  const jpStations = sandbox.getActiveQuizStations();
  const jpLandmarks = sandbox.getActiveQuizPois("landmark");
  check(jpStations.length >= 80, "4.JP", `JP has >=80 unique stations, got ${jpStations.length}`);
  check(jpLandmarks.length === 40, "4.JP", `JP has 40 landmarks, got ${jpLandmarks.length}`);
  check(sandbox.evaluateGuess("新大阪", false) === true, "4.JP", "Matches Shinkansen station 新大阪");
  check(sandbox.evaluateGuess("とうきょう", false) === true, "4.JP", "Matches Tokyo station via hiragana とうきょう");
  check(sandbox.evaluateGuess("富士山", false) === true, "4.JP", "Matches Japanese landmark 富士山");
  check(sandbox.evaluateGuess("Kiyomizu-dera", false) === true, "4.JP", "Matches landmark 清水寺 via English alias");

  // =========================================================================
  // SECTION D: CHINA MODERN (cn_prov) RAILWAYS & LANDMARKS
  // =========================================================================
  await sandbox.switchActiveMapPack("cn_prov", { skipPaintYield: true });
  const cnLines = sandbox.getSelectableLinesForActivePack();
  check(cnLines.length === 10, "5.CN", `CN Modern has 10 HSR/railway lines, got ${cnLines.length}`);
  sandbox.state.regionQuizEnabled = false;
  sandbox.state.stationQuizEnabled = true;
  sandbox.state.quizStationLines = new sandbox.Set(cnLines.map((l) => l.id));
  sandbox.state.landmarkQuizEnabled = true;
  sandbox.syncLegacyQuizTargetMode();
  const cnStations = sandbox.getActiveQuizStations();
  const cnLandmarks = sandbox.getActiveQuizPois("landmark");
  check(cnStations.length >= 95, "5.CN", `CN Modern has >=95 unique stations, got ${cnStations.length}`);
  check(cnLandmarks.length === 44, "5.CN", `CN Modern has 44 landmarks, got ${cnLandmarks.length}`);
  check(sandbox.evaluateGuess("北京南", false) === true, "5.CN", "Matches CN HSR station 北京南");
  check(sandbox.evaluateGuess("上海虹桥", false) === true, "5.CN", "Matches CN HSR station 上海虹橋 via Simplified Chinese");
  check(sandbox.evaluateGuess("拉薩", false) === true, "5.CN", "Matches Qinghai-Tibet station 拉薩");
  check(sandbox.evaluateGuess("東方明珠塔", false) === true, "5.CN", "Matches CN modern landmark 東方明珠塔");
  check(sandbox.evaluateGuess("三峡大坝", false) === true, "5.CN", "Matches CN modern landmark 三峽大壩 via Simplified Chinese");
  check(sandbox.evaluateGuess("港珠澳大橋", false) === true, "5.CN", "Matches CN modern landmark 港珠澳大橋");

  // Region filter check on CN (only Guangdong)
  const gdItem = sandbox.getActiveMapPack().getItems().find((i) => i.baseName === "廣東");
  sandbox.state.regionQuizEnabled = true;
  sandbox.state.filterStationsByRegion = true;
  sandbox.state.selectedCounties = new sandbox.Set([gdItem.countyName]);
  sandbox.state.selectedTownIds = new sandbox.Set([gdItem.id]);
  const gdStations = sandbox.getActiveQuizStations();
  const gdLandmarks = sandbox.getActiveQuizPois("landmark");
  check(gdStations.length > 0 && gdStations.every((s) => s.townIds.includes(gdItem.id)), "5.CN", `Region filter limits CN stations strictly to Guangdong (${gdStations.length})`);
  check(gdLandmarks.length > 0 && gdLandmarks.every((p) => p.parentItemId === gdItem.id), "5.CN", `Region filter limits CN landmarks strictly to Guangdong (${gdLandmarks.length})`);
  sandbox.state.filterStationsByRegion = false;

  // =========================================================================
  // SECTION E: ROC 1945 (roc_1949) HISTORIC RAILWAYS & LANDMARKS
  // =========================================================================
  await sandbox.switchActiveMapPack("roc_1949", { skipPaintYield: true });
  const rocLines = sandbox.getSelectableLinesForActivePack();
  check(rocLines.length === 10, "6.ROC", `ROC 1945 has 10 historic railway lines, got ${rocLines.length}`);
  sandbox.state.regionQuizEnabled = false;
  sandbox.state.stationQuizEnabled = true;
  sandbox.state.quizStationLines = new sandbox.Set(rocLines.map((l) => l.id));
  sandbox.state.landmarkQuizEnabled = true;
  sandbox.syncLegacyQuizTargetMode();
  const rocStations = sandbox.getActiveQuizStations();
  const rocLandmarks = sandbox.getActiveQuizPois("landmark");
  check(rocStations.length >= 85, "6.ROC", `ROC 1945 has >=85 unique historic stations, got ${rocStations.length}`);
  check(rocLandmarks.length === 36, "6.ROC", `ROC 1945 has 36 historical landmarks, got ${rocLandmarks.length}`);
  check(sandbox.evaluateGuess("北平前門", false) === true, "6.ROC", "Matches ROC historic station 北平前門");
  check(sandbox.evaluateGuess("石門", false) === true, "6.ROC", "Matches ROC historic station 石門 (石家莊)");
  check(sandbox.evaluateGuess("呼和浩特", false) === true, "6.ROC", "Matches ROC historic station 歸綏 via modern alias 呼和浩特");
  check(sandbox.evaluateGuess("中山陵", false) === true, "6.ROC", "Matches ROC historical landmark 中山陵");
  check(sandbox.evaluateGuess("黃鶴樓", false) === true, "6.ROC", "Matches ROC historical landmark 黃鶴樓");

  // ROC option toggle: no_mongolia excludes Mongolian landmark
  sandbox.state.packOptions.rocTerritoryVariant = "no_mongolia";
  const rocLmNoMng = sandbox.getActiveQuizPois("landmark");
  check(!rocLmNoMng.some((p) => p.parentItemId === "roc_mongolia"), "6.ROC", "no_mongolia excludes Mongolian landmark automatically");
  sandbox.state.packOptions.rocTerritoryVariant = "begonia_full";

  // =========================================================================
  // SECTION F: WORLD (world_countries) LANDMARKS & MICROSTATE FILTER
  // =========================================================================
  await sandbox.switchActiveMapPack("world_countries", { skipPaintYield: true });
  check(sandbox.getActivePackFeatures().supportsTransportQuiz === false, "7.World", "World pack keeps supportsTransportQuiz=false");
  check(sandbox.getActivePackFeatures().supportsLandmarkQuiz === true, "7.World", "World pack enables supportsLandmarkQuiz=true");
  sandbox.state.regionQuizEnabled = false;
  sandbox.state.landmarkQuizEnabled = true;
  sandbox.syncLegacyQuizTargetMode();
  const worldLmAll = sandbox.getActiveQuizPois("landmark");
  check(worldLmAll.length === 46, "7.World", `World has 46 landmarks with microstates ON, got ${worldLmAll.length}`);
  check(sandbox.evaluateGuess("艾菲爾鐵塔", false) === true, "7.World", "Matches World landmark 艾菲爾鐵塔");
  check(sandbox.evaluateGuess("Machu Picchu", false) === true, "7.World", "Matches World landmark 馬丘比丘 via English");
  sandbox.state.packOptions.worldIncludeMicrostates = false;
  const worldLmStd = sandbox.getActiveQuizPois("landmark");
  check(worldLmStd.length < worldLmAll.length, "7.World", `Disabling microstates excludes VAT/SGP landmarks (${worldLmStd.length} < ${worldLmAll.length})`);
  sandbox.state.packOptions.worldIncludeMicrostates = true;

  // =========================================================================
  // SECTION G: COMPOSITE PACK (台日民國) COMBINED RAIL & LANDMARK DEDUP
  // =========================================================================
  await sandbox.switchActiveMapPack("tw_modern+jp_pref+roc_1949", { skipPaintYield: true });
  const comboFeats = sandbox.getActivePackFeatures();
  check(comboFeats.supportsTransportQuiz && comboFeats.supportsLandmarkQuiz && comboFeats.supportsHistoricalBasemap, "8.Combo", "Composite tw+jp+roc supports transport, landmarks, and historical basemap");
  const comboLines = sandbox.getSelectableLinesForActivePack();
  check(comboLines.some((l) => l.id === "thsr_main") && comboLines.some((l) => l.id === "jp_shinkansen_tokaido") && comboLines.some((l) => l.id === "roc_rail_pinghan"), "8.Combo", "Composite tw+jp+roc merges TW + JP + ROC rail lines");
  sandbox.state.landmarkQuizEnabled = true;
  const comboLms = sandbox.getActiveQuizPois("landmark");
  check(!comboLms.some((p) => p.parentItemId === "roc_taiwan"), "8.Combo", "Composite tw+roc auto-excludes roc_taiwan landmark (玉山) to avoid TW overlap");

  // Summary
  if (failed > 0) {
    console.error(`FAIL: ${failed} / ${passed + failed} checks failed:`);
    failures.forEach((f) => console.error("  - " + f));
    process.exit(1);
  }
  console.log(`PASS [GREEN]: All ${passed} checks passed (Historical Map + Normal/Rush Countdown + GeoGuessr + Multi-Pack Rail & Landmarks)!`);
}

runTests().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
