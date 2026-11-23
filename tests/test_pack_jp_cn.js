#!/usr/bin/env node
"use strict";

/**
 * Deterministic Behavioral & Contract TDD Suite for TRACK-D:
 * Neighboring Country Map Packs (jp_pref: Japan 47 Prefectures, cn_prov: China 33 Provincial Units)
 *
 * Run with: node tests/test_pack_jp_cn.js
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

  getEl("mappack-selector-section");
  getEl("mappack-selector-grid");
  getEl("difficulty-selector-card");
  getEl("difficulty-buttons-grid");
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
  getEl("pack-options-bar").classList.add("hidden");
  getEl("pack-opt-world-micro-wrap").classList.add("hidden");
  getEl("pack-opt-cn-singlechar-wrap").classList.add("hidden");
  getEl("chk-pack-world-microstates");
  getEl("lbl-pack-world-microstates");
  getEl("chk-pack-cn-singlechar");
  getEl("simple-region-drawer-body").classList.add("hidden");
  getEl("btn-toggle-scope-drawer");
  getEl("scope-drawer-chevron");
  getEl("scope-drawer-summary-text");
  getEl("settings-help-popover").classList.add("hidden");
  getEl("btn-toggle-settings-help");
  getEl("settings-help-pack-note");
  getEl("wrap-allow-target-hints");
  getEl("timer-countdown-options").classList.add("hidden");
  getEl("btn-timer-mode-countdown");
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
    setTimeout: () => 0,
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
        if (sel === ".diff-btn" || sel === ".diff-btn[data-diff]") return diffButtons;
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
    "data/packs/jp-pref-pack.js",
    "data/packs/cn-prov-pack.js",
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

function inspectGeoJsonGeometry(geoCollection) {
  let featureCount = 0;
  let invalidRings = 0;
  let antimeridianJumps = 0;
  const features = (geoCollection && geoCollection.features) || [];
  for (const feat of features) {
    featureCount++;
    const geom = feat && feat.geometry;
    if (!geom) continue;
    const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
    for (const poly of polys) {
      for (const ring of poly) {
        if (!Array.isArray(ring) || ring.length < 4) {
          invalidRings++;
          continue;
        }
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (Math.abs(first[0] - last[0]) > 1e-6 || Math.abs(first[1] - last[1]) > 1e-6) {
          invalidRings++;
        }
        for (let i = 1; i < ring.length; i++) {
          if (Math.abs(ring[i][0] - ring[i - 1][0]) > 180) {
            antimeridianJumps++;
          }
        }
      }
    }
  }
  return { featureCount, invalidRings, antimeridianJumps };
}

async function main() {
  const { sandbox, elements, diffButtons, suffixGroup } = createFullSandbox();

  await runSection("1.StaticFileSizeAndSecurityInvariants", async () => {
    const jpPath = path.join(REPO_DIR, "data/packs/jp-pref-pack.js");
    const cnPath = path.join(REPO_DIR, "data/packs/cn-prov-pack.js");
    const jpSize = fs.statSync(jpPath).size;
    const cnSize = fs.statSync(cnPath).size;

    check(jpSize > 10000 && jpSize < 250 * 1024, "1.StaticInvariants", `jp-pref-pack.js size must be < 250 KB, got ${(jpSize / 1024).toFixed(1)} KB`);
    check(cnSize > 10000 && cnSize < 350 * 1024, "1.StaticInvariants", `cn-prov-pack.js size must be < 350 KB, got ${(cnSize / 1024).toFixed(1)} KB`);

    const jpSrc = readRepoFile("data/packs/jp-pref-pack.js");
    const cnSrc = readRepoFile("data/packs/cn-prov-pack.js");
    check(!/\.innerHTML\s*=/.test(jpSrc), "1.StaticInvariants", "jp-pref-pack.js must have zero .innerHTML");
    check(!/\.innerHTML\s*=/.test(cnSrc), "1.StaticInvariants", "cn-prov-pack.js must have zero .innerHTML");
    check(!/\bfetch\s*\(/.test(jpSrc), "1.StaticInvariants", "jp-pref-pack.js must have zero fetch() calls");
    check(!/\bfetch\s*\(/.test(cnSrc), "1.StaticInvariants", "cn-prov-pack.js must have zero fetch() calls");
    check(!/\bimport\s+|export\s+/.test(jpSrc), "1.StaticInvariants", "jp-pref-pack.js must be pure vanilla JS (no ESM)");
    check(!/\bimport\s+|export\s+/.test(cnSrc), "1.StaticInvariants", "cn-prov-pack.js must be pure vanilla JS (no ESM)");
  });

  await runSection("2.JapanPrefPackStructureAndTopology", async () => {
    const res = await vm.runInContext(`switchActiveMapPack("jp_pref")`, sandbox);
    check(res && res.ok === true, "2.JpStructure", "switchActiveMapPack('jp_pref') succeeded");

    const pack = vm.runInContext(`getActiveMapPack()`, sandbox);
    check(pack && pack.id === "jp_pref" && pack._isFullPack === true, "2.JpStructure", "jp_pref active and marked _isFullPack");
    check(pack.hierarchyDepth === 1, "2.JpStructure", "jp_pref hierarchyDepth === 1");

    const groups = pack.getGroups();
    const items = pack.getItems();
    check(groups.length === 8, "2.JpStructure", `jp_pref should have 8 region groups, got ${groups.length}`);
    check(items.length === 47, "2.JpStructure", `jp_pref should have 47 items, got ${items.length}`);

    const filters = pack.regionFilters || [];
    check(filters.length === 9, "2.JpStructure", `jp_pref should have 9 regionFilters (all + 8 regions), got ${filters.length}`);
    const allFilter = filters.find((f) => f.id === "all");
    check(allFilter && allFilter.itemIds.length === 47, "2.JpStructure", "jp_pref 'all' filter covers 47 prefectures");
    const subFilterSum = filters.filter((f) => f.id !== "all").reduce((acc, f) => acc + f.itemIds.length, 0);
    check(subFilterSum === 47, "2.JpStructure", `jp_pref 8 regional filters sum to 47, got ${subFilterSum}`);

    // Verify TopoJSON extraction & 47/47 feature match
    const bundle = vm.runInContext(`getCachedPackTopoData("jp_pref")`, sandbox);
    check(bundle && bundle.townsGeo && Array.isArray(bundle.townsGeo.features), "2.JpStructure", "jp_pref TopoJSON converted to GeoJSON");
    const geomStats = inspectGeoJsonGeometry(bundle.townsGeo);
    check(geomStats.featureCount === 47, "2.JpStructure", `jp_pref GeoJSON has 47 features, got ${geomStats.featureCount}`);
    check(geomStats.invalidRings === 0, "2.JpStructure", `jp_pref GeoJSON has 0 unclosed/invalid rings, got ${geomStats.invalidRings}`);
    check(geomStats.antimeridianJumps === 0, "2.JpStructure", `jp_pref GeoJSON has 0 antimeridian jumps, got ${geomStats.antimeridianJumps}`);

    const unmatched = items.filter((it) => !Array.isArray(it.layers) || it.layers.length === 0);
    check(unmatched.length === 0, "2.JpStructure", `All 47 JP prefectures matched to Leaflet layers, unmatched: ${unmatched.map((x) => x.townName).join(",")}`);

    // Verify Tokyo & Okinawa mainBounds focus on main islands (NOT Ogasawara ~27°N)
    const tokyo = items.find((it) => it.townName === "東京都");
    const okinawa = items.find((it) => it.townName === "沖繩縣");
    check(
      tokyo && tokyo.mainBounds && tokyo.mainBounds.getSouth() >= 35.0,
      "2.JpStructure",
      `東京都 mainBounds south must be >= 35.0 (Honshu mainland, excluding Ogasawara), got ${tokyo && tokyo.mainBounds ? tokyo.mainBounds.getSouth() : "null"}`
    );
    check(
      okinawa && okinawa.mainBounds && okinawa.mainBounds.getSouth() >= 25.5 && okinawa.mainBounds.getNorth() <= 27.5,
      "2.JpStructure",
      `沖繩縣 mainBounds focused on Okinawa main island`
    );
  });

  await runSection("3.JapanPrefAliasCollisionsAndGameplay", async () => {
    const pack = vm.runInContext(`getActiveMapPack()`, sandbox);
    const items = pack.getItems();
    const normFn = pack.normalizeInput;

    // Check 100% unique alias mapping across all 47 prefectures (0 collisions)
    const aliasOwners = new Map();
    const collisions = [];
    for (const it of items) {
      const forms = new Set([it.townName, it.baseName, ...(it.aliases || []), ...(it.exactAliases || [])]);
      for (const raw of forms) {
        const n = normFn(raw);
        if (!n) continue;
        if (aliasOwners.has(n) && aliasOwners.get(n) !== it.id) {
          collisions.push(`${raw} (${n}) -> ${aliasOwners.get(n)} vs ${it.id}`);
        } else {
          aliasOwners.set(n, it.id);
        }
      }
    }
    check(collisions.length === 0, "3.JpAliases", `Zero alias collisions across 47 JP prefectures, got: ${collisions.join("; ")}`);

    // Strict isolation of 埼玉 vs 長崎 vs 宮崎 (埼 !== 崎)
    check(normFn("埼玉") !== normFn("長崎") && normFn("埼") !== normFn("崎"), "3.JpAliases", "埼 and 崎 must never normalize to the same character");
    vm.runInContext(`resetGame(); setDifficulty("casual");`, sandbox);
    vm.runInContext(`evaluateGuess("埼玉")`, sandbox);
    const saitamaId = items.find((x) => x.townName === "埼玉縣").id;
    const nagasakiId = items.find((x) => x.townName === "長崎縣").id;
    const miyazakiId = items.find((x) => x.townName === "宮崎縣").id;
    check(vm.runInContext(`state.unlockedTowns.has(${JSON.stringify(saitamaId)})`, sandbox), "3.JpAliases", "'埼玉' unlocks 埼玉縣");
    check(!vm.runInContext(`state.unlockedTowns.has(${JSON.stringify(nagasakiId)})`, sandbox), "3.JpAliases", "'埼玉' does NOT unlock 長崎縣");
    check(!vm.runInContext(`state.unlockedTowns.has(${JSON.stringify(miyazakiId)})`, sandbox), "3.JpAliases", "'埼玉' does NOT unlock 宮崎縣");

    // 北海道 rejects bare '北海', accepts '北海道', 'ほっかいどう', 'hokkaido'
    const hokkaidoId = items.find((x) => x.townName === "北海道").id;
    vm.runInContext(`evaluateGuess("北海")`, sandbox);
    check(!vm.runInContext(`state.unlockedTowns.has(${JSON.stringify(hokkaidoId)})`, sandbox), "3.JpAliases", "'北海' must NOT unlock 北海道");
    vm.runInContext(`evaluateGuess("ほっかいどう")`, sandbox);
    check(vm.runInContext(`state.unlockedTowns.has(${JSON.stringify(hokkaidoId)})`, sandbox), "3.JpAliases", "Hiragana 'ほっかいどう' unlocks 北海道");

    // Test Kanji, Simplified, Hiragana, Romaji inputs
    const testCases = [
      ["東京都", "とうきょう"],
      ["大阪府", "osaka"],
      ["京都府", "きょうと"],
      ["神奈川縣", "神奈川県"],
      ["廣島縣", "広島県"],
      ["沖繩縣", "沖縄"],
      ["福岡縣", "福冈"],
      ["新潟縣", "にいがた"],
      ["愛知縣", "aichi"]
    ];
    for (const [townName, guess] of testCases) {
      vm.runInContext(`resetGame(); setDifficulty("casual"); evaluateGuess(${JSON.stringify(guess)});`, sandbox);
      const target = items.find((x) => x.townName === townName);
      check(
        target && vm.runInContext(`state.unlockedTowns.has(${JSON.stringify(target.id)})`, sandbox),
        "3.JpAliases",
        `Input '${guess}' should unlock ${townName}`
      );
    }

    // Hard Suffix Mode & Quick Suffixes
    const regionSuffixes = suffixGroup.children
      .filter((b) => b.getAttribute("data-suffix-topic") === "region")
      .map((b) => b.getAttribute("data-suffix"));
    check(
      JSON.stringify(regionSuffixes) === JSON.stringify(["都", "道", "府", "縣"]),
      "3.JpAliases",
      `JP quickSuffixes should be ["都","道","府","縣"], got ${JSON.stringify(regionSuffixes)}`
    );
    const visibleDiffs = diffButtons.filter((b) => !b.classList.contains("hidden")).map((b) => b.getAttribute("data-diff"));
    check(
      JSON.stringify(visibleDiffs) === JSON.stringify(["casual", "hard_suffix"]),
      "3.JpAliases",
      `JP visible difficulties should be ["casual","hard_suffix"], got ${JSON.stringify(visibleDiffs)}`
    );

    const tokyoId = items.find((x) => x.townName === "東京都").id;
    vm.runInContext(`setDifficulty("hard_suffix"); evaluateGuess("東京");`, sandbox);
    check(!vm.runInContext(`state.unlockedTowns.has(${JSON.stringify(tokyoId)})`, sandbox), "3.JpAliases", "Bare '東京' rejected in hard_suffix");
    vm.runInContext(`evaluateGuess("東京都");`, sandbox);
    check(vm.runInContext(`state.unlockedTowns.has(${JSON.stringify(tokyoId)})`, sandbox), "3.JpAliases", "Full '東京都' accepted in hard_suffix");

    // Pin-Drop & Satellite compatibility
    check(vm.runInContext(`getPinDropScaleKm({ kind: "town" })`, sandbox) === 150, "3.JpAliases", "jp_pref pinDropScaleKm === 150");
    check(vm.runInContext(`buildPinDropCandidatePool().length`, sandbox) === 47, "3.JpAliases", "jp_pref Pin-Drop candidate pool === 47");
    vm.runInContext(`setPlayMode("satellite_quiz")`, sandbox);
    check(Boolean(vm.runInContext(`state.targetId`, sandbox)), "3.JpAliases", "jp_pref satellite_quiz picks valid targetId");
    vm.runInContext(`setPlayMode("free")`, sandbox);
  });

  await runSection("4.ChinaProvPackStructureAndHotspots", async () => {
    const res = await vm.runInContext(`switchActiveMapPack("cn_prov")`, sandbox);
    check(res && res.ok === true, "4.CnStructure", "switchActiveMapPack('cn_prov') succeeded");

    const pack = vm.runInContext(`getActiveMapPack()`, sandbox);
    check(pack && pack.id === "cn_prov" && pack._isFullPack === true, "4.CnStructure", "cn_prov active and marked _isFullPack");
    check(
      pack.dataNote === "收錄 31 省市自治區 + 香港、澳門（共 33 區）",
      "4.CnStructure",
      `cn_prov dataNote matches specification: ${pack.dataNote}`
    );

    const groups = pack.getGroups();
    const items = pack.getItems();
    check(groups.length === 7, "4.CnStructure", `cn_prov should have 7 region groups, got ${groups.length}`);
    check(items.length === 33, "4.CnStructure", `cn_prov should have 33 items, got ${items.length}`);

    const suffixCounts = items.reduce((acc, it) => {
      acc[it.suffix] = (acc[it.suffix] || 0) + 1;
      return acc;
    }, {});
    check(
      suffixCounts["省"] === 22 && suffixCounts["自治區"] === 5 && suffixCounts["市"] === 4 && suffixCounts["特別行政區"] === 2,
      "4.CnStructure",
      `cn_prov administrative breakdown must be 22省 + 5自治區 + 4直轄市 + 2特別行政區, got ${JSON.stringify(suffixCounts)}`
    );

    const filters = pack.regionFilters || [];
    check(filters.length === 8, "4.CnStructure", `cn_prov should have 8 regionFilters, got ${filters.length}`);
    const subFilterSum = filters.filter((f) => f.id !== "all").reduce((acc, f) => acc + f.itemIds.length, 0);
    check(subFilterSum === 33, "4.CnStructure", `cn_prov 7 regional filters sum to 33, got ${subFilterSum}`);

    const bundle = vm.runInContext(`getCachedPackTopoData("cn_prov")`, sandbox);
    const geomStats = inspectGeoJsonGeometry(bundle.townsGeo);
    check(geomStats.featureCount === 33, "4.CnStructure", `cn_prov GeoJSON has 33 features, got ${geomStats.featureCount}`);
    check(geomStats.invalidRings === 0, "4.CnStructure", `cn_prov GeoJSON has 0 invalid rings, got ${geomStats.invalidRings}`);
    check(geomStats.antimeridianJumps === 0, "4.CnStructure", `cn_prov GeoJSON has 0 antimeridian jumps, got ${geomStats.antimeridianJumps}`);

    // Hong Kong & Macau microstate hotspot dot verification
    const hk = items.find((it) => it.townName === "香港特別行政區");
    const mo = items.find((it) => it.townName === "澳門特別行政區");
    for (const [label, item] of [["HK", hk], ["Macau", mo]]) {
      check(
        item && item.isMicrostate === true && item.useHotspotDot === true && item.hotspotRadius >= 6,
        "4.CnStructure",
        `${label} must have isMicrostate: true, useHotspotDot: true, hotspotRadius >= 6`
      );
      const hasCircleDot = item && Array.isArray(item.layers) && item.layers.some((l) => l && (l._isHotspotMarker === true || l._isMicrostateDot === true));
      check(hasCircleDot, "4.CnStructure", `${label} must have a rendered circleMarker hotspot layer (_isMicrostateDot)`);
    }

    const unmatched = items.filter((it) => !Array.isArray(it.layers) || it.layers.length === 0);
    check(unmatched.length === 0, "4.CnStructure", "All 33 CN units have >= 1 Leaflet layer");
  });

  await runSection("5.ChinaProvAliasesSingleCharToggleAndGameplay", async () => {
    const pack = vm.runInContext(`getActiveMapPack()`, sandbox);
    const items = pack.getItems();
    const normFn = pack.normalizeInput;

    // Check 0 alias collisions both with cnAllowSingleCharAlias = false AND true
    for (const allowSingle of [false, true]) {
      const aliasOwners = new Map();
      const collisions = [];
      for (const it of items) {
        const dynAliases = pack.getItemAliases(it, { packOptions: { cnAllowSingleCharAlias: allowSingle } });
        const forms = new Set([it.townName, it.baseName, ...dynAliases, ...(it.exactAliases || [])]);
        for (const raw of forms) {
          const n = normFn(raw);
          if (!n) continue;
          if (aliasOwners.has(n) && aliasOwners.get(n) !== it.id) {
            collisions.push(`[single=${allowSingle}] ${raw} (${n}) -> ${aliasOwners.get(n)} vs ${it.id}`);
          } else {
            aliasOwners.set(n, it.id);
          }
        }
      }
      check(
        collisions.length === 0,
        "5.CnAliases",
        `Zero alias collisions when cnAllowSingleCharAlias=${allowSingle}, got: ${collisions.join("; ")}`
      );
    }

    // Strict isolation: 陝西 vs 山西, 河南 vs 河北, 湖南 vs 湖北
    const pairs = [
      ["陝西省", "山西省", "陝西", "山西"],
      ["河南省", "河北省", "河南", "河北"],
      ["湖南省", "湖北省", "湖南", "湖北"]
    ];
    for (const [nameA, nameB, guessA, guessB] of pairs) {
      const itemA = items.find((x) => x.townName === nameA);
      const itemB = items.find((x) => x.townName === nameB);
      vm.runInContext(`resetGame(); setDifficulty("casual"); evaluateGuess(${JSON.stringify(guessA)});`, sandbox);
      check(
        vm.runInContext(`state.unlockedTowns.has(${JSON.stringify(itemA.id)})`, sandbox) &&
          !vm.runInContext(`state.unlockedTowns.has(${JSON.stringify(itemB.id)})`, sandbox),
        "5.CnAliases",
        `'${guessA}' unlocks ${nameA} and NEVER ${nameB}`
      );
      vm.runInContext(`resetGame(); setDifficulty("casual"); evaluateGuess(${JSON.stringify(guessB)});`, sandbox);
      check(
        vm.runInContext(`state.unlockedTowns.has(${JSON.stringify(itemB.id)})`, sandbox) &&
          !vm.runInContext(`state.unlockedTowns.has(${JSON.stringify(itemA.id)})`, sandbox),
        "5.CnAliases",
        `'${guessB}' unlocks ${nameB} and NEVER ${nameA}`
      );
    }

    // Simplified <-> Traditional inputs
    const simpCases = [
      ["黑龍江省", "黑龙江"],
      ["遼寧省", "辽宁"],
      ["陝西省", "陕西"],
      ["廣東省", "广东"],
      ["廣西壯族自治區", "广西"],
      ["重慶市", "重庆"],
      ["澳門特別行政區", "澳门"],
      ["內蒙古自治區", "内蒙古"],
      ["寧夏回族自治區", "宁夏"],
      ["新疆維吾爾自治區", "新疆维吾尔自治区"]
    ];
    for (const [townName, simpGuess] of simpCases) {
      const target = items.find((x) => x.townName === townName);
      vm.runInContext(`resetGame(); setDifficulty("casual"); evaluateGuess(${JSON.stringify(simpGuess)});`, sandbox);
      check(
        target && vm.runInContext(`state.unlockedTowns.has(${JSON.stringify(target.id)})`, sandbox),
        "5.CnAliases",
        `Simplified input '${simpGuess}' unlocks ${townName}`
      );
    }

    // Single-character abbreviation toggle (cnAllowSingleCharAlias: false by default -> rejected; true -> accepted)
    check(
      vm.runInContext(`Boolean(state.packOptions && state.packOptions.cnAllowSingleCharAlias)`, sandbox) === false,
      "5.CnAliases",
      "cnAllowSingleCharAlias defaults to false"
    );
    const singleCharCases = [
      ["北京市", "京"],
      ["上海市", "滬"],
      ["上海市", "沪"],
      ["廣東省", "粵"],
      ["廣東省", "粤"],
      ["四川省", "蜀"],
      ["香港特別行政區", "港"],
      ["澳門特別行政區", "澳"]
    ];
    vm.runInContext(`resetGame(); setDifficulty("casual");`, sandbox);
    for (const [townName, abbr] of singleCharCases) {
      const target = items.find((x) => x.townName === townName);
      vm.runInContext(`evaluateGuess(${JSON.stringify(abbr)});`, sandbox);
      check(
        !vm.runInContext(`state.unlockedTowns.has(${JSON.stringify(target.id)})`, sandbox),
        "5.CnAliases",
        `Single-char '${abbr}' must be REJECTED when cnAllowSingleCharAlias is false`
      );
    }

    // Enable cnAllowSingleCharAlias via UI toggle helper
    vm.runInContext(`applyPackOptionToggle("cnAllowSingleCharAlias", true);`, sandbox);
    for (const [townName, abbr] of singleCharCases) {
      const target = items.find((x) => x.townName === townName);
      vm.runInContext(`resetGame(); setDifficulty("casual"); evaluateGuess(${JSON.stringify(abbr)});`, sandbox);
      check(
        vm.runInContext(`state.unlockedTowns.has(${JSON.stringify(target.id)})`, sandbox),
        "5.CnAliases",
        `Single-char '${abbr}' must be ACCEPTED for ${townName} when cnAllowSingleCharAlias is true`
      );
    }
    vm.runInContext(`applyPackOptionToggle("cnAllowSingleCharAlias", false);`, sandbox);

    // Hard Suffix Mode & Quick Suffixes
    const regionSuffixes = suffixGroup.children
      .filter((b) => b.getAttribute("data-suffix-topic") === "region")
      .map((b) => b.getAttribute("data-suffix"));
    check(
      JSON.stringify(regionSuffixes) === JSON.stringify(["省", "市", "自治區", "特別行政區"]),
      "5.CnAliases",
      `CN quickSuffixes should be ["省","市","自治區","特別行政區"], got ${JSON.stringify(regionSuffixes)}`
    );

    const gdId = items.find((x) => x.townName === "廣東省").id;
    const xjId = items.find((x) => x.townName === "新疆維吾爾自治區").id;
    const hkId = items.find((x) => x.townName === "香港特別行政區").id;
    vm.runInContext(`resetGame(); setDifficulty("hard_suffix");`, sandbox);
    vm.runInContext(`evaluateGuess("廣東"); evaluateGuess("新疆"); evaluateGuess("香港");`, sandbox);
    check(
      !vm.runInContext(`state.unlockedTowns.has(${JSON.stringify(gdId)}) || state.unlockedTowns.has(${JSON.stringify(xjId)}) || state.unlockedTowns.has(${JSON.stringify(hkId)})`, sandbox),
      "5.CnAliases",
      "Bare '廣東', '新疆', '香港' rejected in hard_suffix mode"
    );
    vm.runInContext(`evaluateGuess("廣東省"); evaluateGuess("新疆自治區"); evaluateGuess("香港特別行政區");`, sandbox);
    check(
      vm.runInContext(`state.unlockedTowns.has(${JSON.stringify(gdId)}) && state.unlockedTowns.has(${JSON.stringify(xjId)}) && state.unlockedTowns.has(${JSON.stringify(hkId)})`, sandbox),
      "5.CnAliases",
      "Suffixed '廣東省', '新疆自治區', '香港特別行政區' accepted in hard_suffix mode"
    );

    // Pin-Drop & Satellite compatibility
    check(vm.runInContext(`getPinDropScaleKm({ kind: "town" })`, sandbox) === 400, "5.CnAliases", "cn_prov pinDropScaleKm === 400");
    check(vm.runInContext(`buildPinDropCandidatePool().length`, sandbox) === 33, "5.CnAliases", "cn_prov Pin-Drop candidate pool === 33");
  });

  await runSection("6.MultiplayerP2PSyncForJpAndCn", async () => {
    // Host room setup, switch to cn_prov + enable cnAllowSingleCharAlias
    await vm.runInContext(`switchActiveMapPack("tw_modern")`, sandbox);
    vm.runInContext(`
      state.isHost = true;
      state.role = "host";
      state.roomCode = "JPCN88";
      state.players = {
        host1: { id: "host1", name: "房主", role: "host", isReady: true },
        guest1: { id: "guest1", name: "客端", role: "player", isReady: true }
      };
      state.localInstanceId = "host1";
    `, sandbox);

    const proposed = vm.runInContext(`
      buildProposedConfigFromPatch({
        mapPackId: "cn_prov",
        packOptions: { worldIncludeMicrostates: true, cnAllowSingleCharAlias: true }
      })
    `, sandbox);
    check(proposed.mapPackId === "cn_prov" && proposed.packOptions.cnAllowSingleCharAlias === true, "6.P2PSync", "buildProposedConfigFromPatch carries cn_prov & cnAllowSingleCharAlias");

    await vm.runInContext(`applyRemoteSyncConfig(${JSON.stringify(proposed)}, false, true)`, sandbox);
    check(vm.runInContext(`state.activeMapPackId`, sandbox) === "cn_prov", "6.P2PSync", "applyRemoteSyncConfig switched pack to cn_prov");
    check(vm.runInContext(`getScopeTowns().length`, sandbox) === 33, "6.P2PSync", "cn_prov scope initialized to 33");
    check(vm.runInContext(`state.packOptions.cnAllowSingleCharAlias === true`, sandbox), "6.P2PSync", "packOptions.cnAllowSingleCharAlias synced");

    const hostCfg = vm.runInContext(`getHostSyncConfig()`, sandbox);
    check(hostCfg.mapPackId === "cn_prov" && hostCfg.packOptions.cnAllowSingleCharAlias === true, "6.P2PSync", "getHostSyncConfig serializes mapPackId & packOptions");

    // Verify room concise settings summary displays China + 允許一字簡稱
    vm.runInContext(`renderRoomConciseSettingsSummary()`, sandbox);
    const collectText = (n) => (n ? (n.textContent || "") + (Array.isArray(n.children) ? n.children.map(collectText).join(" ") : "") : "");
    const summaryText = collectText(elements["room-concise-settings-list"]);
    check(summaryText.includes("中國") && summaryText.includes("一字簡稱"), "6.P2PSync", `Room concise summary reflects cn_prov & single-char option: ${summaryText}`);

    // Ready reset on host setting change
    vm.runInContext(`onHostSettingChange("地圖包", "切換地圖為「🇨🇳 中國」")`, sandbox);
    check(vm.runInContext(`state.players.guest1.isReady === false`, sandbox), "6.P2PSync", "Guest Ready state resets when host changes map pack");

    // Non-host guest guard: cannot switch pack or toggle pack options
    vm.runInContext(`state.isHost = false; state.role = "player";`, sandbox);
    vm.runInContext(`handleMapPackSelection("jp_pref"); applyPackOptionToggle("cnAllowSingleCharAlias", false);`, sandbox);
    check(vm.runInContext(`state.activeMapPackId`, sandbox) === "cn_prov", "6.P2PSync", "Non-host guest blocked from switching map pack");
    check(vm.runInContext(`state.packOptions.cnAllowSingleCharAlias === true`, sandbox), "6.P2PSync", "Non-host guest blocked from toggling pack options");

    // Reset back to solo tw_modern
    vm.runInContext(`state.isHost = true; state.role = "host"; state.roomCode = "";`, sandbox);
    await vm.runInContext(`switchActiveMapPack("tw_modern")`, sandbox);
  });

  if (failures.length > 0) {
    console.error(`FAILED [RED]: ${failures.length} of ${totalChecks} TRACK-D (JP/CN MapPacks) checks failed:`);
    failures.forEach((f, idx) => {
      console.error(`  ${idx + 1}. [${f.category}] ${f.detail}`);
    });
    process.exit(1);
  }
  console.log(`PASS [GREEN]: All ${totalChecks} TRACK-D (Japan 47 & China 33 MapPacks) checks passed!`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
