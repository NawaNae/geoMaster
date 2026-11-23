#!/usr/bin/env node
"use strict";

/**
 * Deterministic Behavioral & Contract TDD Suite for TRACK-M0: MapPack Core Refactor
 * Tests: tw_modern <-> mock_pack <-> tw_modern round-trip switching, single-layer &
 * two-layer packs, bounds/zoom, question counts, scoring, alias matching, microstate
 * hotspots, difficulty/suffix/POI/station feature gating & restoration, P2P mapPackId
 * sync, and static zero-.innerHTML / file:// invariants.
 *
 * Run with: node tests/test_mappack_switch.js
 * Zero external dependencies (pure Node.js: fs, path, vm).
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const REPO_DIR = path.resolve(__dirname, "..");
const readRepoFile = (rel) => fs.readFileSync(path.join(REPO_DIR, rel), "utf8");

const failures = [];
let totalChecks = 0;

function check(cond, category, detail) {
  totalChecks++;
  if (!cond) {
    failures.push({ category, detail });
  }
}

async function runSection(category, fn) {
  try {
    await fn();
  } catch (err) {
    failures.push({
      category,
      detail: `Uncaught exception: ${err && err.stack ? err.stack : String(err)}`
    });
  }
}

function createFullSandbox() {
  const elements = {};
  const makeEl = (id, tagName = "DIV") => {
    const classSet = new Set();
    const el = {
      id: id || "",
      tagName: String(tagName || "DIV").toUpperCase(),
      value: "",
      checked: false,
      disabled: false,
      textContent: "",
      get className() {
        return Array.from(classSet).join(" ");
      },
      set className(val) {
        classSet.clear();
        String(val || "").split(/\s+/).filter(Boolean).forEach((c) => classSet.add(c));
      },
      title: "",
      options: [],
      children: [],
      dataset: {},
      attributes: {},
      listeners: {},
      style: {
        _props: {},
        setProperty(k, v) { this._props[k] = v; },
        getPropertyValue(k) { return this._props[k] || ""; },
        transition: "",
        transform: "",
        height: "",
        width: "",
        left: "",
        top: "",
        fontSize: "",
        color: "",
        background: "",
        textShadow: ""
      },
      classList: {
        _set: classSet,
        add(...cls) { cls.forEach((c) => { if (c) classSet.add(c); }); },
        remove(...cls) { cls.forEach((c) => classSet.delete(c)); },
        toggle(c, force) {
          if (force === undefined) {
            if (classSet.has(c)) classSet.delete(c);
            else classSet.add(c);
          } else if (force) classSet.add(c);
          else classSet.delete(c);
        },
        contains(c) { return classSet.has(c); }
      },
      replaceChildren(...nodes) {
        this.children = [];
        nodes.forEach((n) => this.appendChild(n));
      },
      appendChild(node) {
        if (!node) return node;
        if (node._isFragment && Array.isArray(node.children)) {
          node.children.forEach((c) => {
            c.parentNode = this;
            this.children.push(c);
          });
        } else {
          node.parentNode = this;
          this.children.push(node);
        }
        return node;
      },
      remove() {
        if (this.parentNode && Array.isArray(this.parentNode.children)) {
          this.parentNode.children = this.parentNode.children.filter((c) => c !== this);
        }
      },
      select() {},
      click() {
        const handlers = this.listeners.click || [];
        handlers.forEach((h) => h({ target: this, currentTarget: this, preventDefault() {}, stopPropagation() {} }));
      },
      focus() {},
      contains(target) {
        if (target === this) return true;
        return this.children.some((c) => c === target || (typeof c.contains === "function" && c.contains(target)));
      },
      addEventListener(type, handler) {
        if (!this.listeners[type]) this.listeners[type] = [];
        this.listeners[type].push(handler);
      },
      setAttribute(k, v) {
        this.attributes[k] = String(v);
        if (k.startsWith("data-")) {
          const camel = k.slice(5).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
          this.dataset[camel] = String(v);
        }
        if (k === "class") {
          this.className = String(v);
          this.classList._set = new Set(String(v).split(/\s+/).filter(Boolean));
        }
      },
      getAttribute(k) {
        if (k === "class") return this.className;
        return this.attributes[k] != null ? this.attributes[k] : "";
      },
      cloneNode() {
        const c = makeEl(`${this.id}-clone`, this.tagName);
        c.className = this.className;
        c.attributes = { ...this.attributes };
        c.dataset = { ...this.dataset };
        return c;
      },
      querySelector(sel) {
        const all = this.querySelectorAll(sel);
        return all[0] || null;
      },
      querySelectorAll(sel) {
        const matches = [];
        const walk = (node) => {
          if (!node || !Array.isArray(node.children)) return;
          for (const ch of node.children) {
            if (matchesSelector(ch, sel)) matches.push(ch);
            walk(ch);
          }
        };
        walk(this);
        return matches;
      },
      offsetWidth: 960,
      offsetHeight: 600
    };
    el.content = {
      firstElementChild: el,
      cloneNode: () => {
        const clone = makeEl(`${id}-tpl-clone`, "DIV");
        clone.querySelector = () => makeEl(`${id}-tpl-sub`, "SPAN");
        return clone;
      }
    };
    return el;
  };

  function matchesSelector(el, sel) {
    if (!el || !sel) return false;
    const parts = sel.split(",").map((s) => s.trim()).filter(Boolean);
    return parts.some((p) => {
      if (p.startsWith("#")) return el.id === p.slice(1);
      if (p.startsWith(".")) {
        const [cls, ...attrs] = p.slice(1).split("[");
        const hasCls =
          el.classList.contains(cls) ||
          String(el.className || "").split(/\s+/).includes(cls);
        if (!hasCls) return false;
        return attrs.every((a) => matchAttrExpr(el, a.replace(/\]$/, "")));
      }
      if (p.startsWith("[")) {
        return matchAttrExpr(el, p.slice(1, -1));
      }
      return el.tagName === p.toUpperCase();
    });
  }

  function matchAttrExpr(el, expr) {
    if (!expr) return true;
    const m = expr.match(/^([^=\]]+)(?:=["']?([^"'\]]+)["']?)?$/);
    if (!m) return false;
    const key = m[1].trim();
    const val = m[2];
    const actual = el.getAttribute(key);
    if (val === undefined) return actual !== "";
    return actual === val;
  }

  const getEl = (id) => {
    if (!elements[id]) elements[id] = makeEl(id);
    return elements[id];
  };

  // Seed key interactive DOM elements so gating/suffix/switcher/difficulty assertions are real
  const diffButtons = ["casual", "county_only", "hard_suffix", "hard_full", "master_hierarchy"].map((d) => {
    const btn = makeEl(`diff-btn-${d}`, "BUTTON");
    btn.className = "diff-btn";
    btn.classList.add("diff-btn");
    btn.setAttribute("data-diff", d);
    const labelDiv = makeEl(`diff-btn-lbl-${d}`, "DIV");
    labelDiv.textContent = d === "county_only" ? "🔵 22縣市" : d;
    btn.appendChild(labelDiv);
    return btn;
  });

  const topicChips = ["region", "station", "airport", "port", "reservoir", "lake", "settlement"].map((t) => {
    const card = makeEl(`topic-chip-${t}`, "DIV");
    card.className = "topic-chip-btn geo-select-card";
    card.classList.add("topic-chip-btn", "geo-select-card");
    card.setAttribute("data-topic", t);
    const unionBtn = makeEl(`topic-union-${t}`, "BUTTON");
    unionBtn.classList.add("geo-union-btn");
    const pill = makeEl(`topic-pill-${t}`, "SPAN");
    pill.classList.add("topic-check");
    unionBtn.appendChild(pill);
    card.appendChild(unionBtn);
    return card;
  });

  const suffixGroup = getEl("suffix-quick-group");
  const initialSuffixes = [
    { suffix: "", topic: "always", label: "無" },
    { suffix: "區", topic: "region", label: "區" },
    { suffix: "鄉", topic: "region", label: "鄉" },
    { suffix: "鎮", topic: "region", label: "鎮" },
    { suffix: "市", topic: "region", label: "市" },
    { suffix: "站", topic: "station", label: "站" },
    { suffix: "機場", topic: "airport", label: "機場" },
    { suffix: "港", topic: "port", label: "港" },
    { suffix: "水庫", topic: "reservoir", label: "水庫" },
    { suffix: "湖", topic: "lake", label: "湖" }
  ];
  initialSuffixes.forEach((s, i) => {
    const btn = makeEl(`suffix-btn-${i}`, "BUTTON");
    btn.className = "suffix-quick-btn";
    btn.classList.add("suffix-quick-btn");
    btn.setAttribute("data-suffix", s.suffix);
    btn.setAttribute("data-suffix-topic", s.topic);
    btn.textContent = s.label;
    suffixGroup.appendChild(btn);
  });

  // Pre-seed switcher & key wrappers
  getEl("mappack-selector-section").classList.add("hidden");
  getEl("mappack-selector-grid");
  getEl("topic-selector-card");
  getEl("topic-region-meta");
  getEl("map-rail-control-pill");
  getEl("p2p-rail-rule-wrap");
  getEl("map-quick-jump-tw-group");
  getEl("hierarchy-guide-bar");
  getEl("simple-region-tw-grid");
  getEl("simple-region-dynamic-grid").classList.add("hidden");
  getEl("advanced-region-tw-presets");
  getEl("advanced-region-dynamic-presets").classList.add("hidden");
  const geoBadge = getEl("geo-data-badge");
  geoBadge.appendChild(makeEl("geo-badge-dot", "SPAN"));
  geoBadge.appendChild(makeEl("geo-badge-text", "SPAN"));

  const storageMap = new Map();
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
    Promise,
    Error,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    setTimeout: (fn) => { return 0; },
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    requestAnimationFrame: (fn) => { fn(); return 0; },
    navigator: { userAgent: "node-test", language: "zh-TW", hardwareConcurrency: 4, platform: "Win32" },
    screen: { width: 1920, height: 1080, colorDepth: 24 },
    location: { search: "", hash: "", pathname: "/index.html", href: "file:///index.html", origin: "null" },
    history: { replaceState() {} },
    addEventListener: () => {},
    removeEventListener: () => {},
    innerWidth: 1280,
    innerHeight: 800,
    localStorage: {
      getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
      setItem: (k, v) => storageMap.set(k, String(v)),
      removeItem: (k) => storageMap.delete(k)
    },
    sessionStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    },
    document: {
      body: makeEl("body", "BODY"),
      head: makeEl("head", "HEAD"),
      documentElement: makeEl("html", "HTML"),
      getElementById: getEl,
      querySelector(sel) {
        const list = this.querySelectorAll(sel);
        return list[0] || null;
      },
      querySelectorAll(sel) {
        if (sel === ".diff-btn") return diffButtons;
        if (sel === ".topic-chip-btn") return topicChips;
        if (sel.startsWith(".topic-chip-btn[data-topic=")) {
          const m = sel.match(/data-topic=["']([^"']+)["']/);
          return m ? topicChips.filter((c) => c.getAttribute("data-topic") === m[1]) : [];
        }
        if (sel === ".suffix-quick-btn" || sel === "#suffix-quick-group .suffix-quick-btn") {
          return suffixGroup.children.filter((c) => c.classList.contains("suffix-quick-btn"));
        }
        if (sel === ".layer-btn" || sel === ".playmode-btn" || sel === ".simple-region-btn" || sel === ".scope-preset-btn") {
          return [];
        }
        return Object.values(elements).filter((el) => matchesSelector(el, sel));
      },
      createElement: (tag) => makeEl("", tag),
      createElementNS: (_ns, tag) => makeEl("", tag),
      createDocumentFragment: () => ({ _isFragment: true, children: [], appendChild(n) { this.children.push(n); return n; } }),
      addEventListener: () => {}
    },
    window: {},
    URLSearchParams,
    MutationObserver: class { observe() {} disconnect() {} },
    fetch: () => Promise.reject(new Error("offline-in-test")),
    ResizeObserver: undefined
  };

  sandbox.window = sandbox;
  vm.createContext(sandbox);

  const loadFiles = [
    "data/admin-data.js",
    "data/transport-data.js",
    "data/poi-data.js",
    "js/map-pack-registry.js",
    "js/state.js",
    "js/map-engine.js",
    "js/transport-engine.js",
    "js/poi-engine.js",
    "js/label-engine.js",
    "js/game-logic.js",
    "js/pindrop-engine.js",
    "js/dashboard-ui.js",
    "js/p2p-engine.js",
    "js/ui-controls.js"
  ];

  for (const rel of loadFiles) {
    const code = readRepoFile(rel);
    vm.runInContext(code, sandbox, { filename: rel });
  }

  // Initialize Leaflet map (offline shim in Node) without hitting live CDN
  vm.runInContext(`
    loadRealTaiwanTopoJSON = async function() {
      const bundle = {
        townsGeo: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: { COUNTYNAME: "臺北市", TOWNNAME: "大安區", TOWNCODE: "63000050" },
              geometry: { type: "Polygon", coordinates: [[[121.52, 25.01], [121.56, 25.01], [121.56, 25.04], [121.52, 25.04], [121.52, 25.01]]] }
            }
          ]
        },
        countiesGeo: null
      };
      setCachedPackTopoData("tw_modern", bundle);
      rebuildMapLayers(bundle);
      return bundle;
    };
    initMap();
    applyActivePackFeatureGatingUI();
    renderMapPackSwitcherUI();
  `, sandbox);

  return { sandbox, elements, diffButtons, topicChips, suffixGroup };
}

function buildMockPackScript() {
  return `
    const MOCK_GROUPS = [
      { code: "G1", name: "北域", short: "北域", lat: 12, lng: 12 },
      { code: "G2", name: "南域", short: "南域", lat: -12, lng: -12 }
    ];
    const MOCK_ITEMS = [
      {
        id: "mk_alpha",
        code: "ALPHA",
        countyCode: "G1",
        countyName: "北域",
        countyShort: "北域",
        townName: "阿爾法",
        baseName: "阿爾法",
        suffix: "",
        fullCountyTown: "北域阿爾法",
        fullHierarchyName: "阿爾法",
        aliases: ["Alpha", "USA", "美利堅"],
        lat: 12,
        lng: 12,
        bounds: null,
        layers: []
      },
      {
        id: "mk_beta",
        code: "BETA",
        countyCode: "G1",
        countyName: "北域",
        countyShort: "北域",
        townName: "貝塔",
        baseName: "貝塔",
        suffix: "",
        fullCountyTown: "北域貝塔",
        fullHierarchyName: "貝塔",
        aliases: ["Beta", "Cuba"],
        lat: 14,
        lng: 15,
        bounds: null,
        layers: []
      },
      {
        id: "mk_micro",
        code: "MICRO",
        countyCode: "G2",
        countyName: "南域",
        countyShort: "南域",
        townName: "微星城",
        baseName: "微星城",
        suffix: "",
        fullCountyTown: "南域微星城",
        fullHierarchyName: "微星城",
        aliases: ["Micro", "Vatican"],
        isMicrostate: true,
        lat: -12,
        lng: -12,
        bounds: null,
        layers: []
      }
    ];
    const MOCK_TOPO = {
      townsGeo: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: "mk_alpha",
            properties: { id: "mk_alpha", name: "阿爾法" },
            geometry: { type: "Polygon", coordinates: [[[10, 10], [14, 10], [14, 14], [10, 14], [10, 10]]] }
          },
          {
            type: "Feature",
            id: "mk_beta",
            properties: { id: "mk_beta", name: "貝塔" },
            geometry: { type: "Polygon", coordinates: [[[14, 12], [17, 12], [17, 16], [14, 16], [14, 12]]] }
          }
        ]
      },
      countiesGeo: null
    };

    window._mockEnsureLoadedCount = 0;

    registerMapPack({
      id: "mock_pack",
      displayName: "虛擬測試世界（3 區塊）",
      shortLabel: "🌐 虛擬測試",
      version: "1.0",
      hierarchyDepth: 1,
      unitLabels: {
        group: "大洲",
        item: "國家",
        itemShort: "國",
        fullScopeLabel: "全部 3 國"
      },
      mapView: {
        center: [0, 0],
        defaultZoom: 3,
        minZoom: 2,
        maxZoom: 12,
        maxBounds: null,
        fullViewBounds: [[-25, -30], [25, 30]],
        pinDropScaleKm: 500,
        targetFocusZoom: 5,
        groupFocusZoom: 4,
        targetMaxZoom: 7,
        worldCopyJump: true
      },
      features: {
        supportsTransportQuiz: false,
        supportsPoiQuiz: false,
        supportsMasterHierarchy: false,
        supportsSuffixDifficulty: false,
        quickSuffixes: [],
        supportedDifficulties: ["casual"]
      },
      regionFilters: [
        { id: "all", label: "全部區域", itemIds: ["mk_alpha", "mk_beta", "mk_micro"] },
        { id: "north_zone", label: "北域", itemIds: ["mk_alpha", "mk_beta"] },
        { id: "south_zone", label: "南域", itemIds: ["mk_micro"] }
      ],
      topoData: MOCK_TOPO,
      async ensureLoaded() {
        window._mockEnsureLoadedCount++;
        return window.GEOMASTER_PACKS["mock_pack"];
      },
      getGroups() { return MOCK_GROUPS; },
      getItems() { return MOCK_ITEMS; }
    });

    // Secondary suffix-capable single-layer pack (models Japan 47 prefectures pattern)
    const JP_MOCK_GROUPS = [{ code: "K", name: "關東", short: "關東", lat: 35.68, lng: 139.76 }];
    const JP_MOCK_ITEMS = [
      {
        id: "jp_tokyo",
        code: "13",
        countyCode: "K",
        countyName: "關東",
        countyShort: "關東",
        townName: "東京都",
        baseName: "東京",
        suffix: "都",
        fullCountyTown: "關東東京都",
        fullHierarchyName: "東京都",
        aliases: ["Tokyo"],
        lat: 35.68,
        lng: 139.76,
        bounds: null,
        layers: []
      },
      {
        id: "jp_hokkaido",
        code: "01",
        countyCode: "K",
        countyName: "關東",
        countyShort: "關東",
        townName: "北海道",
        baseName: "北海道",
        suffix: "道",
        fullCountyTown: "關東北海道",
        fullHierarchyName: "北海道",
        aliases: ["Hokkaido"],
        lat: 43.06,
        lng: 141.35,
        bounds: null,
        layers: []
      }
    ];
    registerMapPack({
      id: "mock_jp",
      displayName: "模擬日本（2 都道）",
      shortLabel: "🗾 模擬日本",
      hierarchyDepth: 1,
      unitLabels: { group: "地方", item: "都道府縣", itemShort: "都道" },
      mapView: { center: [36.2, 138.2], defaultZoom: 5, minZoom: 4, maxZoom: 14, maxBounds: [[20, 120], [48, 155]], fullViewBounds: [[24, 123], [46, 146]] },
      features: {
        supportsTransportQuiz: false,
        supportsPoiQuiz: false,
        supportsMasterHierarchy: false,
        supportsSuffixDifficulty: true,
        quickSuffixes: ["都", "道", "府", "縣"],
        supportedDifficulties: ["casual", "hard_suffix"]
      },
      regionFilters: [{ id: "all", label: "全日本", itemIds: ["jp_tokyo", "jp_hokkaido"] }],
      getGroups() { return JP_MOCK_GROUPS; },
      getItems() { return JP_MOCK_ITEMS; }
    });
  `;
}

async function main() {
  const { sandbox, elements, diffButtons, topicChips, suffixGroup } = createFullSandbox();

  await runSection("1.DefaultTwModernState", async () => {
    const pack = vm.runInContext("getActiveMapPack()", sandbox);
    check(pack && pack.id === "tw_modern", "1.DefaultTwModernState", "Default active pack should be tw_modern");
    check(vm.runInContext("getActiveGroups().length", sandbox) === 22, "1.DefaultTwModernState", "tw_modern should have 22 groups");
    check(vm.runInContext("getActiveItems().length", sandbox) === 368, "1.DefaultTwModernState", "tw_modern should have 368 items");
    check(vm.runInContext("state.selectedCounties.size", sandbox) === 22, "1.DefaultTwModernState", "Initial selectedCounties = 22");
    check(vm.runInContext("state.selectedTownIds.size", sandbox) === 368, "1.DefaultTwModernState", "Initial selectedTownIds = 368");
    check(vm.runInContext("getRegisteredMapPacks().length", sandbox) === 4, "1.DefaultTwModernState", "4 built-in packs registered by default (tw_modern, jp_pref, cn_prov, world_countries)");
    check(
      !elements["mappack-selector-section"].classList.contains("hidden"),
      "1.DefaultTwModernState",
      "Switcher UI is visible by default when 4 built-in packs are registered"
    );
    // Verify switcher hides whenever getRegisteredMapPacks().length <= 1
    vm.runInContext(`
      window._savedBuiltInStubs = ["jp_pref", "cn_prov", "world_countries"].map(id => [id, window.GEOMASTER_PACKS[id]]);
      ["jp_pref", "cn_prov", "world_countries"].forEach(id => delete window.GEOMASTER_PACKS[id]);
      renderMapPackSwitcherUI();
    `, sandbox);
    check(
      elements["mappack-selector-section"].classList.contains("hidden"),
      "1.DefaultTwModernState",
      "Switcher UI must hide when <= 1 pack (only tw_modern) is registered"
    );
    vm.runInContext(`
      window._savedBuiltInStubs.forEach(([id, p]) => { window.GEOMASTER_PACKS[id] = p; });
      renderMapPackSwitcherUI();
    `, sandbox);
    check(
      diffButtons.every((b) => !b.classList.contains("hidden")),
      "1.DefaultTwModernState",
      "All 5 difficulty buttons should be visible in tw_modern"
    );
    check(
      topicChips.every((c) => !c.classList.contains("hidden")),
      "1.DefaultTwModernState",
      "All 7 topic chips (region + station + 5 POIs) should be visible in tw_modern"
    );
  });

  await runSection("2.RegisterMockPacksAndSwitcherVisibility", async () => {
    vm.runInContext(buildMockPackScript(), sandbox);
    check(vm.runInContext("getRegisteredMapPacks().length", sandbox) === 6, "2.RegisterMockPacks", "6 packs registered (4 built-in + 2 mock)");
    check(
      !elements["mappack-selector-section"].classList.contains("hidden"),
      "2.RegisterMockPacks",
      "Switcher UI should unhide when >1 pack is registered"
    );
    check(
      elements["mappack-selector-grid"].children.length === 6,
      "2.RegisterMockPacks",
      "Switcher grid should render 6 pack buttons"
    );
  });

  await runSection("3.SwitchTwModernToMockPack", async () => {
    // Enable Taiwan-only features and master_hierarchy before switching to verify clean shutdown
    vm.runInContext(`
      state.difficulty = "master_hierarchy";
      state.stationQuizEnabled = true;
      state.quizStationLines = new Set(["thsr_main"]);
      state.transportMode = "lines_and_stations";
      state.airportQuizEnabled = true;
      state.portQuizEnabled = true;
      syncLegacyQuizTargetMode();
      state.unlockedTowns.add("63000_大安區");
      state.unlockedCounties.add("臺北市");
    `, sandbox);

    check(vm.runInContext("getActiveQuizStations().length > 0", sandbox), "3.SwitchToMock", "Pre-switch Taiwan stations active");
    check(vm.runInContext("getActiveQuizPois().length > 0", sandbox), "3.SwitchToMock", "Pre-switch Taiwan POIs active");

    const res = await vm.runInContext(`switchActiveMapPack("mock_pack")`, sandbox);
    check(res && res.ok === true, "3.SwitchToMock", "switchActiveMapPack('mock_pack') should succeed");
    check(vm.runInContext("window._mockEnsureLoadedCount", sandbox) === 1, "3.SwitchToMock", "ensureLoaded() invoked once");
    check(vm.runInContext("state.activeMapPackId", sandbox) === "mock_pack", "3.SwitchToMock", "activeMapPackId updated");

    // Bounds & Zoom
    check(vm.runInContext("map.getMinZoom()", sandbox) === 2, "3.SwitchToMock", "map minZoom updated to 2");
    check(vm.runInContext("map.getMaxZoom()", sandbox) === 12, "3.SwitchToMock", "map maxZoom updated to 12");
    check(vm.runInContext("map.getMaxBounds()", sandbox) === null, "3.SwitchToMock", "map maxBounds cleared to null for unbounded world-style pack");

    // Scope & Progress reset
    check(vm.runInContext("getScopeTowns().length", sandbox) === 3, "3.SwitchToMock", "Scope has 3 mock items");
    check(vm.runInContext("state.selectedCounties.size", sandbox) === 2, "3.SwitchToMock", "Scope has 2 mock groups");
    check(vm.runInContext("state.unlockedTowns.size", sandbox) === 0, "3.SwitchToMock", "unlockedTowns cleared");
    check(vm.runInContext("state.unlockedCounties.size", sandbox) === 0, "3.SwitchToMock", "unlockedCounties cleared");
    check(
      vm.runInContext("ALL_TOWNS.every(t => Array.isArray(t.layers) && t.layers.length === 0)", sandbox),
      "3.SwitchToMock",
      "Previous tw_modern item.layers detached cleanly (zero leak)"
    );

    // Microstate circleMarker & Polygon layers
    const mockLayersCounts = vm.runInContext(`getActiveItems().map(i => ({ id: i.id, n: i.layers.length }))`, sandbox);
    check(
      mockLayersCounts.every((x) => x.n === 1),
      "3.SwitchToMock",
      `All 3 mock items (2 polygons + 1 microstate circleMarker) must have 1 layer: ${JSON.stringify(mockLayersCounts)}`
    );

    // Difficulty fallback & gating
    check(vm.runInContext("state.difficulty", sandbox) === "casual", "3.SwitchToMock", "Unsupported master_hierarchy auto-fell back to casual");
    const visibleDiffs = diffButtons.filter((b) => !b.classList.contains("hidden")).map((b) => b.getAttribute("data-diff"));
    check(
      visibleDiffs.length === 1 && visibleDiffs[0] === "casual",
      "3.SwitchToMock",
      `Only casual diff button should be visible, got: ${JSON.stringify(visibleDiffs)}`
    );
    check(elements["hierarchy-guide-bar"].classList.contains("hidden"), "3.SwitchToMock", "hierarchy-guide-bar hidden");

    // Taiwan POI & Station auto-disabled
    check(vm.runInContext("state.stationQuizEnabled", sandbox) === false, "3.SwitchToMock", "stationQuizEnabled disabled");
    check(vm.runInContext("state.airportQuizEnabled", sandbox) === false, "3.SwitchToMock", "airportQuizEnabled disabled");
    check(vm.runInContext("state.portQuizEnabled", sandbox) === false, "3.SwitchToMock", "portQuizEnabled disabled");
    check(vm.runInContext("state.transportMode", sandbox) === "off", "3.SwitchToMock", "transportMode turned off");
    check(vm.runInContext("getActiveQuizStations().length", sandbox) === 0, "3.SwitchToMock", "getActiveQuizStations returns []");
    check(vm.runInContext("getActiveQuizPois().length", sandbox) === 0, "3.SwitchToMock", "getActiveQuizPois returns []");
    check(elements["topic-selector-card"].classList.contains("hidden"), "3.SwitchToMock", "Topic selector hidden when only region exists");
    check(elements["map-rail-control-pill"].classList.contains("hidden"), "3.SwitchToMock", "Map rail pill hidden");
    check(elements["map-quick-jump-tw-group"].classList.contains("hidden"), "3.SwitchToMock", "TW quick jumps hidden");
    check(elements["simple-region-tw-grid"].classList.contains("hidden"), "3.SwitchToMock", "TW simple region grid hidden");
    check(!elements["simple-region-dynamic-grid"].classList.contains("hidden"), "3.SwitchToMock", "Dynamic region filter grid shown");
    check(elements["simple-region-dynamic-grid"].children.length === 3, "3.SwitchToMock", "Dynamic grid rendered 3 mock regionFilters");
  });

  await runSection("4.GameplayAndScoringInMockPack", async () => {
    // 3-letter English alias 'USA' must unlock mk_alpha (NOT hijacked as airport IATA code!)
    vm.runInContext(`evaluateGuess("USA")`, sandbox);
    check(vm.runInContext(`state.unlockedTowns.has("mk_alpha")`, sandbox), "4.GameplayMock", "Alias 'USA' unlocked mk_alpha");
    check(vm.runInContext(`state.stats.correctAttempts`, sandbox) === 1, "4.GameplayMock", "correctAttempts incremented to 1");

    // 4-letter English alias 'Cuba' unlocks mk_beta
    vm.runInContext(`evaluateGuess("Cuba")`, sandbox);
    check(vm.runInContext(`state.unlockedTowns.has("mk_beta")`, sandbox), "4.GameplayMock", "Alias 'Cuba' unlocked mk_beta");

    // Microstate alias 'Vatican' unlocks mk_micro and completes 3/3
    vm.runInContext(`evaluateGuess("Vatican")`, sandbox);
    check(vm.runInContext(`state.unlockedTowns.has("mk_micro")`, sandbox), "4.GameplayMock", "Microstate 'Vatican' unlocked mk_micro");

    const stats = vm.runInContext(`computeClearedBlocksStats()`, sandbox);
    check(
      stats.completedCounties === 2 && stats.totalScopeCounties === 2 && vm.runInContext("state.unlockedTowns.size", sandbox) === 3,
      "4.GameplayMock",
      `Expected 2/2 groups and 3 unlocked items, got ${stats.completedCounties}/${stats.totalScopeCounties}`
    );
    check(vm.runInContext("state.isGameOver", sandbox) === true, "4.GameplayMock", "Victory triggered at 3/3 in mock_pack");

    // Pin-Drop + MapPack integration: scaleKm, single-layer prompt & candidate pool
    check(vm.runInContext(`getPinDropScaleKm({ kind: "town" })`, sandbox) === 500, "4.GameplayMock", "Pin-Drop uses mock_pack.mapView.pinDropScaleKm (500)");
    const pdTarget = vm.runInContext(`buildPinDropTargetFromTown(getActiveItems()[0])`, sandbox);
    check(
      pdTarget && pdTarget.promptTitle === "📍 請在地圖上標出：阿爾法" && pdTarget.categoryLabel === "國家",
      "4.GameplayMock",
      `Single-layer Pin-Drop target should omit group prefix & use unitLabels.item: ${JSON.stringify(pdTarget)}`
    );
    check(vm.runInContext(`buildPinDropCandidatePool().length`, sandbox) === 3, "4.GameplayMock", "Pin-Drop candidate pool matches 3 mock items");
  });

  await runSection("5.SuffixCapableSingleLayerPack", async () => {
    const res = await vm.runInContext(`switchActiveMapPack("mock_jp")`, sandbox);
    check(res && res.ok === true, "5.SuffixPack", "Switched to mock_jp");
    const visibleDiffs = diffButtons.filter((b) => !b.classList.contains("hidden")).map((b) => b.getAttribute("data-diff"));
    check(
      visibleDiffs.includes("casual") && visibleDiffs.includes("hard_suffix") && !visibleDiffs.includes("master_hierarchy"),
      "5.SuffixPack",
      `Expected casual + hard_suffix only, got ${JSON.stringify(visibleDiffs)}`
    );
    const regionSuffixes = suffixGroup.children
      .filter((b) => b.getAttribute("data-suffix-topic") === "region")
      .map((b) => b.getAttribute("data-suffix"));
    check(
      JSON.stringify(regionSuffixes) === JSON.stringify(["都", "道", "府", "縣"]),
      "5.SuffixPack",
      `Expected JP quick suffixes [都,道,府,縣], got ${JSON.stringify(regionSuffixes)}`
    );

    // In hard_suffix mode, bare "東京" should be rejected while "東京都" unlocks jp_tokyo
    vm.runInContext(`setDifficulty("hard_suffix"); evaluateGuess("東京");`, sandbox);
    check(!vm.runInContext(`state.unlockedTowns.has("jp_tokyo")`, sandbox), "5.SuffixPack", "Bare '東京' rejected in hard_suffix");
    vm.runInContext(`evaluateGuess("東京都");`, sandbox);
    check(vm.runInContext(`state.unlockedTowns.has("jp_tokyo")`, sandbox), "5.SuffixPack", "Full '東京都' accepted in hard_suffix");
  });

  await runSection("6.RoundTripRestoreToTwModern", async () => {
    const res = await vm.runInContext(`switchActiveMapPack("tw_modern")`, sandbox);
    check(res && res.ok === true, "6.RestoreTwModern", "Switched back to tw_modern");
    check(vm.runInContext("state.activeMapPackId", sandbox) === "tw_modern", "6.RestoreTwModern", "activeMapPackId restored");

    // Bounds & Zoom restored
    check(vm.runInContext("map.getMinZoom()", sandbox) === 7, "6.RestoreTwModern", "minZoom restored to 7");
    check(vm.runInContext("map.getMaxZoom()", sandbox) === 18, "6.RestoreTwModern", "maxZoom restored to 18");
    const maxB = vm.runInContext("map.getMaxBounds()", sandbox);
    check(maxB && typeof maxB.isValid === "function" && maxB.isValid(), "6.RestoreTwModern", "Taiwan maxBounds restored");

    // Counts & clean reset
    check(vm.runInContext("getScopeTowns().length", sandbox) === 368, "6.RestoreTwModern", "Scope restored to 368 towns");
    check(vm.runInContext("state.selectedCounties.size", sandbox) === 22, "6.RestoreTwModern", "Scope restored to 22 counties");
    check(vm.runInContext("state.unlockedTowns.size", sandbox) === 0, "6.RestoreTwModern", "Zero stale mock unlocks in tw_modern");
    check(vm.runInContext("state.isGameOver", sandbox) === false, "6.RestoreTwModern", "isGameOver reset");

    // All 5 difficulties & Taiwan quick suffixes restored
    check(
      diffButtons.every((b) => !b.classList.contains("hidden")),
      "6.RestoreTwModern",
      "All 5 difficulty buttons restored"
    );
    const regionSuffixes = suffixGroup.children
      .filter((b) => b.getAttribute("data-suffix-topic") === "region")
      .map((b) => b.getAttribute("data-suffix"));
    check(
      JSON.stringify(regionSuffixes) === JSON.stringify(["區", "鄉", "鎮", "市"]),
      "6.RestoreTwModern",
      `Expected TW quick suffixes [區,鄉,鎮,市], got ${JSON.stringify(regionSuffixes)}`
    );

    // Taiwan UI panels restored & POI/Station can be re-enabled cleanly
    check(!elements["topic-selector-card"].classList.contains("hidden"), "6.RestoreTwModern", "Topic selector restored");
    check(!elements["map-rail-control-pill"].classList.contains("hidden"), "6.RestoreTwModern", "Map rail pill restored");
    check(!elements["map-quick-jump-tw-group"].classList.contains("hidden"), "6.RestoreTwModern", "TW quick jumps restored");
    check(!elements["simple-region-tw-grid"].classList.contains("hidden"), "6.RestoreTwModern", "TW simple region grid restored");
    check(elements["simple-region-dynamic-grid"].classList.contains("hidden"), "6.RestoreTwModern", "Dynamic region grid hidden again");

    vm.runInContext(`
      state.stationQuizEnabled = true;
      state.quizStationLines = new Set(["thsr_main"]);
      state.airportQuizEnabled = true;
      syncLegacyQuizTargetMode();
    `, sandbox);
    check(vm.runInContext("getActiveQuizStations().length > 0", sandbox), "6.RestoreTwModern", "Taiwan stations re-enabled cleanly");
    check(vm.runInContext("getActiveQuizPois().length > 0", sandbox), "6.RestoreTwModern", "Taiwan POIs re-enabled cleanly");

    // Normal Taiwan guess works again (both hard_suffix & casual)
    vm.runInContext(`setDifficulty("casual"); evaluateGuess("大安");`, sandbox);
    check(vm.runInContext(`state.unlockedTowns.has("63000_大安區")`, sandbox), "6.RestoreTwModern", "Taiwan matching works after round-trip");
  });

  await runSection("7.P2PSyncConfigAndErrorSafety", async () => {
    // Unknown pack must fail gracefully without mutating activeMapPackId
    const bad = await vm.runInContext(`switchActiveMapPack("nonexistent_pack")`, sandbox);
    check(bad && bad.ok === false && bad.reason === "pack_not_found", "7.P2PAndSafety", "Unknown pack returns pack_not_found");
    check(vm.runInContext("state.activeMapPackId", sandbox) === "tw_modern", "7.P2PAndSafety", "State unchanged on invalid packId");

    // Host config serialization includes mapPackId
    const hostCfg = vm.runInContext(`getHostSyncConfig()`, sandbox);
    check(hostCfg && hostCfg.mapPackId === "tw_modern", "7.P2PAndSafety", "getHostSyncConfig includes mapPackId");

    // Diff description detects pack change
    const diff = vm.runInContext(`describeConfigDiff({ mapPackId: "mock_pack" })`, sandbox);
    check(
      Array.isArray(diff) && diff.some((line) => /地圖/.test(String(line))),
      "7.P2PAndSafety",
      `describeConfigDiff should mention map switch: ${JSON.stringify(diff)}`
    );

    // Incoming remote host config automatically switches pack & applies remote scope
    await vm.runInContext(`
      applyRemoteSyncConfig({
        mapPackId: "mock_pack",
        difficulty: "master_hierarchy",
        regionQuizEnabled: true,
        selectedCounties: ["北域"],
        selectedTownIds: ["mk_alpha", "mk_beta"]
      }, false, true)
    `, sandbox);
    check(vm.runInContext("state.activeMapPackId", sandbox) === "mock_pack", "7.P2PAndSafety", "applyRemoteSyncConfig switched activeMapPackId to mock_pack");
    check(vm.runInContext("state.difficulty", sandbox) === "casual", "7.P2PAndSafety", "applyRemoteSyncConfig clamped unsupported difficulty to casual");
    check(vm.runInContext("state.selectedTownIds.size", sandbox) === 2, "7.P2PAndSafety", "applyRemoteSyncConfig applied remote selectedTownIds (2)");

    // Concise summary shows map row when >1 pack registered
    vm.runInContext(`renderRoomConciseSettingsSummary()`, sandbox);
    const summaryEl = elements["room-concise-settings-list"];
    const collectText = (n) => (n ? (n.textContent || "") + (Array.isArray(n.children) ? n.children.map(collectText).join(" ") : "") : "");
    const summaryText = collectText(summaryEl);
    check(summaryText.includes("虛擬測試"), "7.P2PAndSafety", `Room concise settings summary displays active map pack, got: ${summaryText}`);

    // Restore back to tw_modern via remote sync without explicit selectedTownIds -> must restore full 368 towns!
    await vm.runInContext(`applyRemoteSyncConfig({ mapPackId: "tw_modern", difficulty: "casual", regionQuizEnabled: true }, false, true)`, sandbox);
    check(vm.runInContext("state.activeMapPackId", sandbox) === "tw_modern", "7.P2PAndSafety", "Remote sync restored tw_modern");
    check(vm.runInContext("getScopeTowns().length", sandbox) === 368, "7.P2PAndSafety", "Remote sync to tw_modern without selectedTownIds restored full 368 scope");

    // Host switching from pure-station tw_modern to non-transport mock_pack via buildProposedConfigFromPatch must keep 3/3 scope & regionQuizEnabled=true
    vm.runInContext(`
      state.regionQuizEnabled = false;
      state.stationQuizEnabled = true;
      state.quizStationLines = new Set(["thsr_main"]);
      syncLegacyQuizTargetMode();
    `, sandbox);
    const hostPatchCfg = vm.runInContext(`buildProposedConfigFromPatch({ mapPackId: "mock_pack" })`, sandbox);
    check(hostPatchCfg.regionQuizEnabled === true, "7.P2PAndSafety", "buildProposedConfigFromPatch re-enables regionQuizEnabled for non-transport pack");
    check(!hostPatchCfg.selectedTownIds, "7.P2PAndSafety", "buildProposedConfigFromPatch drops stale previous-pack selectedTownIds");
    await vm.runInContext(`applyRemoteSyncConfig(buildProposedConfigFromPatch({ mapPackId: "mock_pack" }), false, true)`, sandbox);
    check(vm.runInContext("getScopeTowns().length", sandbox) === 3, "7.P2PAndSafety", "Host pack switch from pure-station yields full 3-item mock scope");
    check(vm.runInContext("state.regionQuizEnabled", sandbox) === true, "7.P2PAndSafety", "regionQuizEnabled active after host pack switch");
    await vm.runInContext(`switchActiveMapPack("tw_modern")`, sandbox);
    check(elements["btn-reopen-settlement"].classList.contains("hidden"), "7.P2PAndSafety", "Settlement reopen button hidden after solo pack switch");
    check(elements["timer-display"].textContent === "00:00", "7.P2PAndSafety", "Timer display reset to 00:00 after solo pack switch");
  });

  await runSection("8.StaticSecurityAndArchitectureContracts", async () => {
    const jsFiles = [
      "js/map-pack-registry.js",
      "js/state.js",
      "js/map-engine.js",
      "js/label-engine.js",
      "js/game-logic.js",
      "js/dashboard-ui.js",
      "js/p2p-engine.js",
      "js/ui-controls.js"
    ];
    for (const rel of jsFiles) {
      const src = readRepoFile(rel);
      check(!/\.innerHTML\s*=/.test(src), "8.StaticContracts", `${rel} must have zero .innerHTML assignments`);
    }
    const html = readRepoFile("index.html");
    const regIdx = html.indexOf('src="js/map-pack-registry.js"');
    const stateIdx = html.indexOf('src="js/state.js"');
    const poiDataIdx = html.indexOf('src="data/poi-data.js"');
    check(
      poiDataIdx > 0 && regIdx > poiDataIdx && stateIdx > regIdx,
      "8.StaticContracts",
      "index.html must load js/map-pack-registry.js after data/*.js and before js/state.js"
    );
    check(
      !/type=["']module["']/.test(html),
      "8.StaticContracts",
      "index.html must remain classic <script> (no type='module') for file:// compatibility"
    );
  });

  if (failures.length > 0) {
    console.error(`FAILED [RED]: ${failures.length} of ${totalChecks} TRACK-M0 MapPack checks failed:`);
    failures.forEach((f, idx) => {
      console.error(`  ${idx + 1}. [${f.category}] ${f.detail}`);
    });
    process.exit(1);
  }
  console.log(`PASS [GREEN]: All ${totalChecks} TRACK-M0 MapPack Core checks passed!`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
