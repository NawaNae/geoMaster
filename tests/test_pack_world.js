#!/usr/bin/env node
"use strict";

/**
 * Deterministic Behavioral & Contract TDD Suite for TRACK-C:
 * World Countries Map Pack (world_countries: 196 Countries) & Progressive-Disclosure Minimalist Settings UI
 *
 * Run with: node tests/test_pack_world.js
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
  getEl("wrap-allow-target-hints").classList.add("hidden");
  getEl("timer-countdown-options").classList.add("hidden");
  getEl("btn-timer-mode-countdown");
  getEl("modal-scope").classList.add("hidden");
  getEl("modal-room").classList.add("hidden");
  getEl("host-room-restrictions-body").classList.add("hidden");
  getEl("btn-toggle-room-restrictions");
  getEl("room-restrictions-chevron");
  getEl("room-restrictions-active-badge").classList.add("hidden");
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
    "data/packs/world-countries-pack.js",
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

async function main() {
  const { sandbox, elements } = createFullSandbox();

  await runSection("1.StaticFileSizeAndSecurityInvariants", async () => {
    const worldPath = path.join(REPO_DIR, "data/packs/world-countries-pack.js");
    const worldSize = fs.statSync(worldPath).size;
    check(
      worldSize > 50000 && worldSize < 450 * 1024,
      "1.StaticInvariants",
      `world-countries-pack.js size must be < 450 KB, got ${(worldSize / 1024).toFixed(1)} KB`
    );

    const worldSrc = readRepoFile("data/packs/world-countries-pack.js");
    check(!/\.innerHTML\s*=/.test(worldSrc), "1.StaticInvariants", "world-countries-pack.js must have zero .innerHTML");
    check(!/\bfetch\s*\(/.test(worldSrc), "1.StaticInvariants", "world-countries-pack.js must have zero fetch() calls");
    check(!/\bimport\s+|export\s+/.test(worldSrc), "1.StaticInvariants", "world-countries-pack.js must be pure vanilla JS (no ESM)");
  });

  await runSection("2.WorldCountries196StructureAndAntimeridianCheck", async () => {
    const res = await vm.runInContext(`switchActiveMapPack("world_countries")`, sandbox);
    check(res && res.ok === true, "2.WorldStructure", "switchActiveMapPack('world_countries') succeeded");

    const pack = vm.runInContext(`getActiveMapPack()`, sandbox);
    check(pack && pack.id === "world_countries" && pack._isFullPack === true, "2.WorldStructure", "world_countries active and marked _isFullPack");
    check(pack.hierarchyDepth === 1, "2.WorldStructure", "world_countries hierarchyDepth === 1");
    check(
      pack.dataNote.includes("193 UN") && pack.dataNote.includes("梵蒂岡") && pack.dataNote.includes("巴勒斯坦") && pack.dataNote.includes("台灣"),
      "2.WorldStructure",
      `world_countries dataNote explains 196 scope: ${pack.dataNote}`
    );

    const groups = pack.getGroups();
    const items = pack.getItems();
    check(groups.length === 6, "2.WorldStructure", `world_countries should have 6 continent groups, got ${groups.length}`);
    check(items.length === 196, "2.WorldStructure", `world_countries should have exact 196 countries, got ${items.length}`);

    // Verify Antarctica is excluded and 梵蒂岡, 巴勒斯坦, 台灣 are present
    check(!items.some((x) => /南極|Antarctica/i.test(x.townName) || x.code === "ATA"), "2.WorldStructure", "Antarctica must be excluded");
    check(items.some((x) => x.townName === "台灣" && x.code === "TWN"), "2.WorldStructure", "台灣 (TWN) present");
    check(items.some((x) => x.townName === "梵蒂岡" && x.code === "VAT"), "2.WorldStructure", "梵蒂岡 (VAT) present");
    check(items.some((x) => x.townName === "巴勒斯坦" && x.code === "PSE"), "2.WorldStructure", "巴勒斯坦 (PSE) present");

    const filters = pack.regionFilters || [];
    check(filters.length === 7, "2.WorldStructure", `world_countries should have 7 regionFilters (all + 6 continents), got ${filters.length}`);
    const allFilter = filters.find((f) => f.id === "all");
    check(allFilter && allFilter.itemIds.length === 196, "2.WorldStructure", "world_countries 'all' filter covers 196 countries");
    const subFilterSum = filters.filter((f) => f.id !== "all").reduce((acc, f) => acc + f.itemIds.length, 0);
    check(subFilterSum === 196, "2.WorldStructure", `world_countries 6 continent filters sum to 196, got ${subFilterSum}`);

    // Antimeridian check: EVERY ring of EVERY polygon in decoded GeoJSON has 0 edges with |Δlng| > 180°
    const bundle = vm.runInContext(`getCachedPackTopoData("world_countries")`, sandbox);
    check(bundle && bundle.townsGeo && Array.isArray(bundle.townsGeo.features), "2.WorldStructure", "world_countries TopoJSON decoded to GeoJSON");

    let antimeridianJumps = 0;
    let unclosedRings = 0;
    const jumpCountries = [];
    for (const feat of bundle.townsGeo.features) {
      const geom = feat && feat.geometry;
      if (!geom) continue;
      const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
      for (const poly of polys) {
        for (const ring of poly) {
          if (!Array.isArray(ring) || ring.length < 4) {
            unclosedRings++;
            continue;
          }
          for (let i = 1; i < ring.length; i++) {
            const dLng = Math.abs(ring[i][0] - ring[i - 1][0]);
            if (dLng > 180) {
              antimeridianJumps++;
              jumpCountries.push(`${feat.id}:${dLng.toFixed(1)}`);
            }
          }
        }
      }
    }
    check(unclosedRings === 0, "2.WorldStructure", `world_countries has 0 invalid rings, got ${unclosedRings}`);
    check(
      antimeridianJumps === 0,
      "2.WorldStructure",
      `world_countries has ZERO antimeridian jump edges (|Δlng| > 180°), got ${antimeridianJumps} (${jumpCountries.join(",")})`
    );

    // Mainland mainBounds verification for France, USA, Netherlands, Denmark, Russia, Fiji
    const byCode = Object.fromEntries(items.map((it) => [it.code, it]));
    check(
      byCode.FRA.mainBounds.getSouth() >= 40 && byCode.FRA.mainBounds.getWest() >= -6,
      "2.WorldStructure",
      `France mainBounds focused on European mainland, not French Guiana/Polynesia`
    );
    check(
      byCode.USA.mainBounds.getSouth() >= 24 && byCode.USA.mainBounds.getNorth() <= 50 && byCode.USA.mainBounds.getWest() >= -126,
      "2.WorldStructure",
      `USA mainBounds focused on contiguous US`
    );
    check(
      byCode.NLD.mainBounds.getSouth() >= 50 && byCode.NLD.mainBounds.getWest() >= 3,
      "2.WorldStructure",
      `Netherlands mainBounds focused on European mainland`
    );
    check(
      byCode.DNK.mainBounds.getSouth() >= 54 && byCode.DNK.mainBounds.getNorth() <= 58.5,
      "2.WorldStructure",
      `Denmark mainBounds focused on Jutland/Danish archipelago`
    );
    check(
      byCode.RUS.mainBounds.getWest() >= 19 && byCode.RUS.mainBounds.getEast() <= 180,
      "2.WorldStructure",
      `Russia mainBounds has clean [19.6..179.5] longitude span without antimeridian wrap`
    );
    check(
      byCode.FJI.mainBounds.getWest() >= 176 && byCode.FJI.mainBounds.getEast() <= 180,
      "2.WorldStructure",
      `Fiji mainBounds focused on main islands [177..179.9]`
    );
  });

  await runSection("3.MicrostatesAndStandardVsFull196Toggle", async () => {
    const pack = vm.runInContext(`getActiveMapPack()`, sandbox);
    const items = pack.getItems();

    // Every single one of the 196 countries must have >= 1 Leaflet layer (polygon or circleMarker hotspot)
    const zeroLayerItems = items.filter((it) => !Array.isArray(it.layers) || it.layers.length === 0);
    check(
      zeroLayerItems.length === 0,
      "3.MicrostatesToggle",
      `All 196 countries must have >= 1 Leaflet layer, missing: ${zeroLayerItems.map((x) => x.townName).join(",")}`
    );

    const microstates = items.filter((it) => it.isMicrostate === true);
    check(microstates.length === 27, "3.MicrostatesToggle", `Expected 27 microstates (196 - 169 = 27), got ${microstates.length}`);

    for (const msName of ["梵蒂岡", "摩納哥", "新加坡", "聖馬利諾", "列支敦斯登", "安道爾", "馬爾他", "馬爾地夫", "巴林", "吐瓦魯", "諾魯", "帛琉"]) {
      const ms = items.find((x) => x.townName === msName);
      check(
        ms && ms.isMicrostate === true && ms.layers.some((l) => l && l._isHotspotMarker === true),
        "3.MicrostatesToggle",
        `Microstate ${msName} has isMicrostate: true and circleMarker hotspot dot`
      );
    }

    // Default: worldIncludeMicrostates = true -> 196 in scope
    check(vm.runInContext(`getScopeTowns().length`, sandbox) === 196, "3.MicrostatesToggle", "Full edition scope has 196 countries");

    // Toggle worldIncludeMicrostates = false -> Standard edition (169 countries in scope)
    vm.runInContext(`applyPackOptionToggle("worldIncludeMicrostates", false)`, sandbox);
    check(vm.runInContext(`getScopeTowns().length`, sandbox) === 169, "3.MicrostatesToggle", "Standard edition scope has 169 countries");
    check(
      !vm.runInContext(`getScopeTowns().some(t => t.isMicrostate)`, sandbox),
      "3.MicrostatesToggle",
      "Microstates excluded from getScopeTowns() when worldIncludeMicrostates is false"
    );
    check(
      elements["lbl-pack-world-microstates"].textContent.includes("標準版 169 國"),
      "3.MicrostatesToggle",
      `Label updated to 標準版 169 國, got: ${elements["lbl-pack-world-microstates"].textContent}`
    );

    // Toggle back to true -> restores all 196 countries
    vm.runInContext(`applyPackOptionToggle("worldIncludeMicrostates", true)`, sandbox);
    check(vm.runInContext(`getScopeTowns().length`, sandbox) === 196, "3.MicrostatesToggle", "Toggling worldIncludeMicrostates back to true restores 196 countries");
  });

  await runSection("4.ExhaustiveWorldAliasCoverageAndZeroCollisions", async () => {
    const pack = vm.runInContext(`getActiveMapPack()`, sandbox);
    const items = pack.getItems();
    const normFn = pack.normalizeInput;

    // 1. Check 100% unique normalized alias mapping across all 196 countries (0 collisions!)
    const aliasOwners = new Map();
    const collisions = [];
    for (const it of items) {
      const forms = new Set([it.townName, it.baseName, ...(it.aliases || [])]);
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
    check(collisions.length === 0, "4.WorldAliases", `Zero alias collisions across all 196 countries, got: ${collisions.join("; ")}`);

    // 2. Test all HANDOFF_C examples & tricky country pairs
    const aliasPairs = [
      ["NZL", ["紐西蘭", "新西蘭", "New Zealand", "NZ"]],
      ["KOR", ["南韓", "韓國", "大韓民國", "South Korea", "Korea"]],
      ["PRK", ["北韓", "朝鮮", "北朝鮮", "North Korea", "DPRK"]],
      ["SAU", ["沙烏地阿拉伯", "沙特阿拉伯", "沙特", "Saudi Arabia"]],
      ["ARE", ["阿拉伯聯合大公國", "阿拉伯聯合酋長國", "阿聯酋", "阿聯", "UAE"]],
      ["NLD", ["荷蘭", "尼德蘭", "Netherlands", "Holland"]],
      ["CHE", ["瑞士", "Switzerland"]],
      ["SWE", ["瑞典", "Sweden"]],
      ["AUS", ["澳洲", "澳大利亞", "Australia"]],
      ["AUT", ["奧地利", "Austria"]],
      ["GBR", ["英國", "聯合王國", "大不列顛", "UK", "United Kingdom"]],
      ["USA", ["美國", "美利堅", "美利堅合眾國", "USA", "US", "United States"]],
      ["SWZ", ["史瓦帝尼", "史瓦濟蘭", "斯威士蘭", "Eswatini"]],
      ["MKD", ["北馬其頓", "馬其頓", "North Macedonia"]],
      ["CZE", ["捷克", "捷克共和國", "Czechia", "Czech Republic"]],
      ["LAO", ["寮國", "老撾", "Laos"]],
      ["BRN", ["汶萊", "文萊", "Brunei"]],
      ["HRV", ["克羅埃西亞", "克羅地亞", "Croatia"]],
      ["BIH", ["波士尼亞與赫塞哥維納", "波斯尼亞和黑塞哥維那", "波士尼亞", "波黑", "波赫", "Bosnia"]],
      ["COD", ["剛果民主共和國", "民主剛果", "剛果(金)", "剛果金", "DR Congo", "DRC"]],
      ["COG", ["剛果共和國", "剛果(布)", "剛果布", "Republic of the Congo"]],
      ["GIN", ["幾內亞", "Guinea"]],
      ["GNB", ["幾內亞比索", "幾內亞比紹", "Guinea-Bissau"]],
      ["GNQ", ["赤道幾內亞", "Equatorial Guinea"]],
      ["PNG", ["巴布亞紐幾內亞", "巴布亞新幾內亞", "巴紐", "Papua New Guinea", "PNG"]],
      ["DOM", ["多明尼加", "多米尼加", "Dominican Republic"]],
      ["DMA", ["多米尼克", "多明尼克", "Dominica"]],
      ["NER", ["尼日", "尼日爾", "Niger"]],
      ["NGA", ["奈及利亞", "尼日利亞", "Nigeria"]],
      ["SDN", ["蘇丹", "Sudan"]],
      ["SSD", ["南蘇丹", "South Sudan"]],
      ["SVK", ["斯洛伐克", "Slovakia"]],
      ["SVN", ["斯洛維尼亞", "斯洛文尼亞", "Slovenia"]],
      ["TWN", ["台灣", "臺灣", "中華民國", "Taiwan", "ROC"]],
      ["VAT", ["梵蒂岡", "教廷", "Vatican"]]
    ];

    for (const [code, inputs] of aliasPairs) {
      for (const rawInput of inputs) {
        vm.runInContext(`resetGame(); evaluateGuess(${JSON.stringify(rawInput)});`, sandbox);
        const unlocked = vm.runInContext(`Array.from(state.unlockedTowns)`, sandbox);
        check(
          unlocked.length === 1 && unlocked[0] === code,
          "4.WorldAliases",
          `Input '${rawInput}' must unlock ONLY ${code}, got ${JSON.stringify(unlocked)}`
        );
      }
    }
  });

  await runSection("5.ProgressiveDisclosureMinimalistSettingsUI", async () => {
    // 1. On world_countries:
    // - #difficulty-selector-card hidden (only 1 difficulty: casual)
    // - #topic-selector-card hidden (only region topic)
    // - #pack-options-bar visible with #pack-opt-world-micro-wrap visible & #pack-opt-cn-singlechar-wrap hidden
    await vm.runInContext(`switchActiveMapPack("world_countries")`, sandbox);
    check(elements["difficulty-selector-card"].classList.contains("hidden"), "5.MinimalistUI", "#difficulty-selector-card hidden on world_countries");
    check(elements["topic-selector-card"].classList.contains("hidden"), "5.MinimalistUI", "#topic-selector-card hidden on world_countries");
    check(!elements["pack-options-bar"].classList.contains("hidden"), "5.MinimalistUI", "#pack-options-bar visible on world_countries");
    check(!elements["pack-opt-world-micro-wrap"].classList.contains("hidden"), "5.MinimalistUI", "#pack-opt-world-micro-wrap visible on world_countries");
    check(elements["pack-opt-cn-singlechar-wrap"].classList.contains("hidden"), "5.MinimalistUI", "#pack-opt-cn-singlechar-wrap hidden on world_countries");

    // 2. On jp_pref:
    // - #difficulty-selector-card visible (2 difficulties: casual + hard_suffix), grid-cols-2
    // - #topic-selector-card hidden
    // - #pack-options-bar hidden
    await vm.runInContext(`switchActiveMapPack("jp_pref")`, sandbox);
    check(!elements["difficulty-selector-card"].classList.contains("hidden"), "5.MinimalistUI", "#difficulty-selector-card visible on jp_pref");
    check(elements["difficulty-buttons-grid"].className.includes("grid-cols-2"), "5.MinimalistUI", "jp_pref difficulty grid uses 2 columns");
    check(elements["topic-selector-card"].classList.contains("hidden"), "5.MinimalistUI", "#topic-selector-card hidden on jp_pref");
    check(elements["pack-options-bar"].classList.contains("hidden"), "5.MinimalistUI", "#pack-options-bar hidden on jp_pref");

    // 3. On cn_prov:
    // - #difficulty-selector-card visible (2 difficulties)
    // - #topic-selector-card hidden
    // - #pack-options-bar visible with #pack-opt-cn-singlechar-wrap visible & #pack-opt-world-micro-wrap hidden
    await vm.runInContext(`switchActiveMapPack("cn_prov")`, sandbox);
    check(!elements["difficulty-selector-card"].classList.contains("hidden"), "5.MinimalistUI", "#difficulty-selector-card visible on cn_prov");
    check(elements["topic-selector-card"].classList.contains("hidden"), "5.MinimalistUI", "#topic-selector-card hidden on cn_prov");
    check(!elements["pack-options-bar"].classList.contains("hidden"), "5.MinimalistUI", "#pack-options-bar visible on cn_prov");
    check(!elements["pack-opt-cn-singlechar-wrap"].classList.contains("hidden"), "5.MinimalistUI", "#pack-opt-cn-singlechar-wrap visible on cn_prov");
    check(elements["pack-opt-world-micro-wrap"].classList.contains("hidden"), "5.MinimalistUI", "#pack-opt-world-micro-wrap hidden on cn_prov");

    // 4. On tw_modern:
    // - #difficulty-selector-card visible (5 difficulties)
    // - #topic-selector-card visible
    // - #pack-options-bar hidden
    await vm.runInContext(`switchActiveMapPack("tw_modern")`, sandbox);
    check(!elements["difficulty-selector-card"].classList.contains("hidden"), "5.MinimalistUI", "#difficulty-selector-card visible on tw_modern");
    check(!elements["topic-selector-card"].classList.contains("hidden"), "5.MinimalistUI", "#topic-selector-card visible on tw_modern");
    check(elements["pack-options-bar"].classList.contains("hidden"), "5.MinimalistUI", "#pack-options-bar hidden on tw_modern");

    // 5. Target hints toggle visibility (#wrap-allow-target-hints): hidden in free/pin_drop, visible in target_random/target_click/satellite_quiz
    for (const [pm, shouldShow] of [
      ["free", false],
      ["pin_drop", false],
      ["target_random", true],
      ["target_click", true],
      ["satellite_quiz", true]
    ]) {
      vm.runInContext(`setPlayMode(${JSON.stringify(pm)})`, sandbox);
      const isHidden = elements["wrap-allow-target-hints"].classList.contains("hidden");
      check(
        isHidden === !shouldShow,
        "5.MinimalistUI",
        `#wrap-allow-target-hints in playMode='${pm}' should have hidden=${!shouldShow}, got hidden=${isHidden}`
      );
    }
    vm.runInContext(`setPlayMode("free")`, sandbox);

    // 6. Timer countdown duration options (#timer-countdown-options): hidden in 'up', visible in 'down'
    vm.runInContext(`state.timerMode = "up"; syncConfigButtonsUI();`, sandbox);
    check(elements["timer-countdown-options"].classList.contains("hidden"), "5.MinimalistUI", "#timer-countdown-options hidden when timerMode='up'");
    vm.runInContext(`state.timerMode = "down"; syncConfigButtonsUI();`, sandbox);
    check(!elements["timer-countdown-options"].classList.contains("hidden"), "5.MinimalistUI", "#timer-countdown-options visible when timerMode='down'");
    vm.runInContext(`state.timerMode = "up"; syncConfigButtonsUI();`, sandbox);

    // 7. Collapsible scope drawer (#simple-region-drawer-body) & help popover (#settings-help-popover)
    await vm.runInContext(`switchActiveMapPack("world_countries")`, sandbox);
    vm.runInContext(`openModeSettingsModal("simple")`, sandbox);
    check(
      elements["simple-region-drawer-body"].classList.contains("hidden"),
      "5.MinimalistUI",
      "#simple-region-drawer-body collapsed by default when opening #modal-scope"
    );
    vm.runInContext(`setScopeDrawerExpanded(true)`, sandbox);
    check(
      !elements["simple-region-drawer-body"].classList.contains("hidden"),
      "5.MinimalistUI",
      "#simple-region-drawer-body expands when toggled"
    );
    check(
      elements["settings-help-popover"].classList.contains("hidden"),
      "5.MinimalistUI",
      "#settings-help-popover hidden by default on opening #modal-scope"
    );
    check(
      elements["settings-help-pack-note"].textContent.includes("193 UN"),
      "5.MinimalistUI",
      `#settings-help-pack-note populated with active pack dataNote: ${elements["settings-help-pack-note"].textContent}`
    );
  });

  await runSection("6.MultiplayerP2PSyncForWorldCountries", async () => {
    await vm.runInContext(`switchActiveMapPack("tw_modern")`, sandbox);
    vm.runInContext(`
      state.isHost = true;
      state.role = "host";
      state.roomCode = "WLD196";
      state.players = {
        host1: { id: "host1", name: "房主", role: "host", isReady: true },
        guest1: { id: "guest1", name: "選手B", role: "player", isReady: true }
      };
      state.localInstanceId = "host1";
    `, sandbox);

    const proposed = vm.runInContext(`
      buildProposedConfigFromPatch({
        mapPackId: "world_countries",
        packOptions: { worldIncludeMicrostates: false, cnAllowSingleCharAlias: false }
      })
    `, sandbox);
    check(
      proposed.mapPackId === "world_countries" && proposed.packOptions.worldIncludeMicrostates === false,
      "6.WorldP2P",
      "buildProposedConfigFromPatch carries world_countries & worldIncludeMicrostates=false"
    );

    await vm.runInContext(`applyRemoteSyncConfig(${JSON.stringify(proposed)}, false, true)`, sandbox);
    check(vm.runInContext(`state.activeMapPackId`, sandbox) === "world_countries", "6.WorldP2P", "Remote sync switched pack to world_countries");
    check(vm.runInContext(`getScopeTowns().length`, sandbox) === 169, "6.WorldP2P", "Remote sync with worldIncludeMicrostates=false synced scope to 169 standard countries");

    vm.runInContext(`renderRoomConciseSettingsSummary()`, sandbox);
    const collectText = (n) => (n ? (n.textContent || "") + (Array.isArray(n.children) ? n.children.map(collectText).join(" ") : "") : "");
    const summaryText = collectText(elements["room-concise-settings-list"]);
    check(
      summaryText.includes("世界") && summaryText.includes("標準版"),
      "6.WorldP2P",
      `Room concise summary reflects World + 標準版: ${summaryText}`
    );

    vm.runInContext(`state.isHost = true; state.role = "host"; state.roomCode = "";`, sandbox);
    await vm.runInContext(`switchActiveMapPack("tw_modern")`, sandbox);
  });

  if (failures.length > 0) {
    console.error(`FAILED [RED]: ${failures.length} of ${totalChecks} TRACK-C (World 196 MapPack & Minimalist UI) checks failed:`);
    failures.forEach((f, idx) => {
      console.error(`  ${idx + 1}. [${f.category}] ${f.detail}`);
    });
    process.exit(1);
  }
  console.log(`PASS [GREEN]: All ${totalChecks} TRACK-C (World 196 Countries & Minimalist Settings UI) checks passed!`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
