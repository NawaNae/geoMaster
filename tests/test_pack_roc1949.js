/**
 * TRACK-F Deterministic Unit Tests: Republic of China 1949 MapPack (roc_1949)
 * Verifies:
 *  - Lazy loading (0 KB on initial load, file:// compatible, < 380 KB)
 *  - 50 first-level divisions (35 provinces + 1 SAR + 2 areas + 12 municipalities)
 *  - 6 geographic regions disjoint & union == 50
 *  - 3 exclusive toggles & exact counts (50 / 49 / 38 / 37) + disputed border overlay
 *  - 12 municipality hotspots + 8 control point coordinates + Guangdong/Hainan mainBounds
 *  - Hard suffix quickSuffixes, S2T normalization, 100% zero-collision aliases
 *  - P2P config sync, zero .innerHTML, Wikimedia Commons (Lilauid, CC BY-SA 4.0) attribution
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
}

// =========================================================================
// 1. Static Source & Packaging Checks
// =========================================================================
const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const packJsPath = path.join(ROOT, "data/packs/roc-1949-pack.js");
const packJsSrc = fs.readFileSync(packJsPath, "utf8");
const registrySrc = fs.readFileSync(path.join(ROOT, "js/map-pack-registry.js"), "utf8");
const mapEngineSrc = fs.readFileSync(path.join(ROOT, "js/map-engine.js"), "utf8");
const uiControlsSrc = fs.readFileSync(path.join(ROOT, "js/ui-controls.js"), "utf8");
const p2pEngineSrc = fs.readFileSync(path.join(ROOT, "js/p2p-engine.js"), "utf8");
const stateSrc = fs.readFileSync(path.join(ROOT, "js/state.js"), "utf8");
const gameLogicSrc = fs.readFileSync(path.join(ROOT, "js/game-logic.js"), "utf8");

check("index.html does NOT statically load roc-1949-pack.js (0 KB on initial load)", () => {
  assert.strictEqual(indexHtml.includes("roc-1949-pack.js"), false);
});

check("roc-1949-pack.js exists, < 380 KB, and has zero fetch() calls", () => {
  const sizeKb = fs.statSync(packJsPath).size / 1024;
  assert(sizeKb > 20 && sizeKb < 380, `Expected 20..380 KB, got ${sizeKb.toFixed(1)} KB`);
  assert.strictEqual(/\bfetch\s*\(/.test(packJsSrc), false);
});

check("Zero .innerHTML in roc-1949-pack.js and modified core JS modules", () => {
  for (const [fname, src] of [
    ["data/packs/roc-1949-pack.js", packJsSrc],
    ["js/map-pack-registry.js", registrySrc],
    ["js/map-engine.js", mapEngineSrc],
    ["js/ui-controls.js", uiControlsSrc],
    ["js/p2p-engine.js", p2pEngineSrc],
    ["js/state.js", stateSrc],
    ["js/game-logic.js", gameLogicSrc]
  ]) {
    assert.strictEqual(/\.innerHTML\b/.test(src), false, `Found forbidden .innerHTML in ${fname}`);
  }
});

check("index.html contains all 3 ROC-1949 toggles and optional historical basemap button", () => {
  assert(indexHtml.includes('id="chk-pack-roc-mongolia"'));
  assert(indexHtml.includes('id="chk-pack-roc-municipalities"'));
  assert(indexHtml.includes('id="chk-pack-roc-disputed"'));
  assert(indexHtml.includes('id="btn-layer-historical"'));
});

check("Attribution includes Wikimedia Commons, Lilauid, and CC BY-SA 4.0", () => {
  assert(packJsSrc.includes("Wikimedia Commons"));
  assert(packJsSrc.includes("Lilauid"));
  assert(packJsSrc.includes("CC BY-SA 4.0"));
  assert(registrySrc.includes("Lilauid") && registrySrc.includes("CC BY-SA 4.0"));
});

// =========================================================================
// 2. Runtime Sandbox Verification (Lazy Stub -> Full Pack Load)
// =========================================================================
function createSandbox() {
  const elements = {};
  const makeEl = (id) => {
    if (!elements[id]) {
      elements[id] = {
        id,
        checked: true,
        textContent: "",
        value: "",
        style: { setProperty() {} },
        classList: {
          _set: new Set(),
          add(...c) { c.forEach((x) => this._set.add(x)); },
          remove(...c) { c.forEach((x) => this._set.delete(x)); },
          toggle(c, force) {
            if (force === undefined) this._set.has(c) ? this._set.delete(c) : this._set.add(c);
            else if (force) this._set.add(c);
            else this._set.delete(c);
          },
          contains(c) { return this._set.has(c); }
        },
        setAttribute() {},
        getAttribute() { return ""; },
        addEventListener() {},
        replaceChildren() {},
        appendChild() {},
        querySelectorAll() { return []; }
      };
    }
    return elements[id];
  };

  const sandbox = {
    console,
    Math,
    Date,
    Set,
    Map,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    JSON,
    Promise,
    Error,
    setTimeout,
    clearTimeout,
    navigator: { userAgent: "node-test", language: "zh-TW" },
    screen: { width: 1440, height: 900, colorDepth: 24 },
    location: { search: "" },
    localStorage: { getItem: () => null, setItem: () => {} },
    sessionStorage: { getItem: () => null, setItem: () => {} },
    document: {
      getElementById: (id) => makeEl(id),
      querySelectorAll: () => [],
      createElement: () => makeEl("_tmp"),
      createDocumentFragment: () => ({ appendChild() {} }),
      head: { appendChild() {} }
    },
    TAIWAN_ADMIN_DATA: [],
    ALL_TOWNS: [],
    TAIWAN_SELECTABLE_LINES: [],
    COUNTY_BY_NAME: {},
    COUNTY_COLORS: {}
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);

  vm.runInContext(registrySrc, sandbox, { filename: "js/map-pack-registry.js" });
  vm.runInContext(stateSrc, sandbox, { filename: "js/state.js" });
  return { sandbox, elements };
}

const { sandbox } = createSandbox();

check("Lazy stub for roc_1949 is registered before loading roc-1949-pack.js", () => {
  const stub = sandbox.getMapPackById("roc_1949");
  assert(stub, "roc_1949 stub not found");
  assert.strictEqual(stub._isLazyStub, true);
  assert.strictEqual(stub.scriptUrl, "data/packs/roc-1949-pack.js");
  assert.deepStrictEqual(Array.from(stub.features.quickSuffixes), ["省", "市", "地方", "特別行政區"]);
});

// Now load full roc-1949-pack.js into sandbox
vm.runInContext(packJsSrc, sandbox, { filename: "data/packs/roc-1949-pack.js" });
const pack = sandbox.getMapPackById("roc_1949");
const items = pack.getItems();
const groups = pack.getGroups();

check("Full roc_1949 pack replaces stub with 50 exact divisions (35+1+2+12)", () => {
  assert.strictEqual(pack._isFullPack, true);
  assert.strictEqual(items.length, 50);
  const provs = items.filter((i) => i.category === "province");
  const sars = items.filter((i) => i.category === "sar");
  const areas = items.filter((i) => i.category === "area");
  const munis = items.filter((i) => i.category === "municipality");
  assert.strictEqual(provs.length, 35, `provinces=${provs.length}`);
  assert.strictEqual(sars.length, 1, `sars=${sars.length}`);
  assert.strictEqual(areas.length, 2, `areas=${areas.length}`);
  assert.strictEqual(munis.length, 12, `munis=${munis.length}`);
});

check("Six geographic regions are disjoint and their union equals all 50 divisions", () => {
  assert.strictEqual(groups.length, 6);
  const expectedCounts = { "華中": 11, "華南": 8, "華北": 10, "塞北": 5, "東北": 12, "西部": 4 };
  const union = new Set();
  for (const [gName, expCnt] of Object.entries(expectedCounts)) {
    const f = pack.regionFilters.find((rf) => rf.label === gName);
    assert(f, `Missing regionFilter for ${gName}`);
    assert.strictEqual(f.itemIds.length, expCnt, `${gName} expected ${expCnt}, got ${f.itemIds.length}`);
    for (const id of f.itemIds) {
      assert.strictEqual(union.has(id), false, `Duplicate item ${id} across regions`);
      union.add(id);
    }
  }
  assert.strictEqual(union.size, 50);
});

check("Territory & municipality toggles switch eligible item count cleanly: 50 / 49 / 38 / 37", () => {
  const countFor = (variant, includeMuni) =>
    sandbox.getPackEligibleItems(pack, {
      packOptions: { rocTerritoryVariant: variant, includeMunicipalities: includeMuni }
    }).length;

  assert.strictEqual(countFor("begonia_full", true), 50);
  assert.strictEqual(countFor("no_mongolia", true), 49);
  assert.strictEqual(countFor("begonia_full", false), 38);
  assert.strictEqual(countFor("no_mongolia", false), 37);
});

check("12 municipalities all have hotspot metadata and valid WGS84 coordinates", () => {
  const munis = items.filter((i) => i.category === "municipality");
  assert.strictEqual(munis.length, 12);
  for (const m of munis) {
    assert.strictEqual(m.isMunicipality, true);
    assert.strictEqual(m.isMunicipalityHotspot, true);
    assert.strictEqual(m.isMicrostate, true);
    assert(m.hotspotRadius >= 6 && m.hotspotRadius <= 7, `hotspotRadius out of range for ${m.id}`);
    assert(m.lat >= 20 && m.lat <= 50 && m.lng >= 100 && m.lng <= 130, `Coords out of range for ${m.id}`);
  }
});

check("Guangdong & Hainan define mainland presetMainBounds excluding Spratlys", () => {
  const gd = items.find((i) => i.id === "roc_guangdong");
  const hi = items.find((i) => i.id === "roc_hainan");
  assert(Array.isArray(gd.presetMainBounds) && gd.presetMainBounds[0][0] >= 20);
  assert(Array.isArray(hi.presetMainBounds) && hi.presetMainBounds[0][0] >= 18);
});

check("MapView parameters match TRACK-F specification", () => {
  assert.deepStrictEqual(Array.from(pack.mapView.center), [36.5, 104.0]);
  assert.strictEqual(pack.mapView.defaultZoom, 4);
  assert.strictEqual(pack.mapView.minZoom, 3);
  assert.strictEqual(pack.mapView.maxZoom, 10);
  assert.strictEqual(pack.mapView.pinDropScaleKm, 150);
  assert.deepStrictEqual(Array.from(pack.features.quickSuffixes), ["省", "市", "地方", "特別行政區"]);
});

check("TopoJSON contains all 50 geometries and matches every item", () => {
  const geoms = pack.topoData.objects.regions.geometries;
  assert.strictEqual(geoms.length, 50);
  const matchedIds = new Set();
  for (const g of geoms) {
    const item = pack.matchFeatureToItem(g.properties, g);
    assert(item, `Unmatched geometry ${g.id}`);
    matchedIds.add(item.id);
  }
  assert.strictEqual(matchedIds.size, 50);
  // Verify valid TopoJSON ring nesting (Polygon arcs: [[int,...]], MultiPolygon arcs: [[[int,...]]])
  for (const g of geoms) {
    if (g.type === "Polygon") {
      assert(Array.isArray(g.arcs[0]) && typeof g.arcs[0][0] === "number", `Invalid Polygon arcs in ${g.id}`);
    } else if (g.type === "MultiPolygon") {
      assert(Array.isArray(g.arcs[0]) && Array.isArray(g.arcs[0][0]) && typeof g.arcs[0][0][0] === "number", `Invalid MultiPolygon arcs in ${g.id}`);
    }
  }
});

check("Disputed borders decorative GeoJSON contains all core historical border lines", () => {
  const feats = pack.disputedBordersGeo && pack.disputedBordersGeo.features;
  assert(Array.isArray(feats) && feats.length >= 6);
  const ids = new Set(feats.map((f) => f.properties.id));
  for (const req of ["pamir", "aksai_chin", "south_tibet", "jiangxinpo", "tannu_uriankhai", "heixiazi"]) {
    assert(ids.has(req), `Missing disputed border ${req}`);
  }
});

check("100% unique alias mapping with zero collisions across all 50 divisions", () => {
  const mapNorm = new Map();
  for (const it of items) {
    const all = new Set([...(it.aliases || []), ...(it.exactAliases || []), it.townName, it.baseName]);
    for (const raw of all) {
      const n = pack.normalizeInput(raw);
      assert(n.length > 0, `Empty normalized alias for ${it.id}`);
      if (mapNorm.has(n) && mapNorm.get(n) !== it.id) {
        throw new Error(`Alias collision '${raw}' (norm='${n}') between ${mapNorm.get(n)} and ${it.id}`);
      }
      mapNorm.set(n, it.id);
    }
  }
  // Verify required casual aliases & S2T normalization
  const lookup = (q) => mapNorm.get(pack.normalizeInput(q));
  assert.strictEqual(lookup("北平"), "roc_beiping");
  assert.strictEqual(lookup("北京"), "roc_beiping");
  assert.strictEqual(lookup("北平市"), "roc_beiping");
  assert.strictEqual(lookup("外蒙古"), "roc_mongolia");
  assert.strictEqual(lookup("外蒙"), "roc_mongolia");
  assert.strictEqual(lookup("蒙古"), "roc_mongolia");
  assert.strictEqual(lookup("蒙古地方"), "roc_mongolia");
  assert.strictEqual(lookup("西藏"), "roc_tibet");
  assert.strictEqual(lookup("海南特區"), "roc_hainan");
  assert.strictEqual(lookup("海南"), "roc_hainan");
  assert.strictEqual(lookup("台灣"), "roc_taiwan");
  assert.strictEqual(lookup("臺灣"), "roc_taiwan");
  assert.strictEqual(lookup("察哈尔"), "roc_chahar");
  assert.strictEqual(lookup("绥远"), "roc_suiyuan");
  assert.strictEqual(lookup("辽宁"), "roc_liaoning");
  assert.strictEqual(lookup("陕西"), "roc_shaanxi");
  assert.strictEqual(lookup("沈阳"), "roc_shenyang");

  // Guard against confusable pairs
  assert.notStrictEqual(lookup("遼寧"), lookup("遼北"));
  assert.notStrictEqual(lookup("黑龍江"), lookup("嫩江"));
  assert.notStrictEqual(lookup("松江"), lookup("合江"));
  assert.notStrictEqual(lookup("陝西"), lookup("山西"));
  assert.notStrictEqual(lookup("河南"), lookup("河北"));
  assert.notStrictEqual(lookup("湖南"), lookup("湖北"));
  assert.notStrictEqual(lookup("廣東"), lookup("廣西"));
});

check("hard_suffix mode requires exact administrative suffix", () => {
  const mngExact = pack.getItemAliases(items.find((i) => i.id === "roc_mongolia"), "hard_suffix").map(pack.normalizeInput);
  assert(mngExact.includes(pack.normalizeInput("蒙古地方")));
  assert.strictEqual(mngExact.includes(pack.normalizeInput("蒙古")), false);

  const xkExact = pack.getItemAliases(items.find((i) => i.id === "roc_xikang"), "hard_suffix").map(pack.normalizeInput);
  assert(xkExact.includes(pack.normalizeInput("西康省")));
  assert.strictEqual(xkExact.includes(pack.normalizeInput("西康")), false);
});

check("state.packOptions includes rocTerritoryVariant, includeMunicipalities, showDisputedBorders defaults", () => {
  const stOpts = vm.runInContext("state.packOptions", sandbox);
  assert.strictEqual(stOpts.rocTerritoryVariant, "begonia_full");
  assert.strictEqual(stOpts.includeMunicipalities, true);
  assert.strictEqual(stOpts.showDisputedBorders, true);
});

check("P2P getHostSyncConfig includes TRACK-F packOptions fields", () => {
  assert(p2pEngineSrc.includes("rocTerritoryVariant:"));
  assert(p2pEngineSrc.includes("includeMunicipalities:"));
  assert(p2pEngineSrc.includes("showDisputedBorders:"));
});

console.log(`PASS [GREEN]: All ${passed} TRACK-F (ROC 1949 50-Region MapPack) checks passed!`);
