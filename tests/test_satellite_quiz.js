#!/usr/bin/env node
"use strict";

/**
 * Deterministic Behavioral & Contract TDD Suite for TRACK-A: Satellite Quiz Mode
 * Run with: node tests/test_satellite_quiz.js
 * Zero external dependencies (pure Node.js: assert, fs, path, vm).
 */

const assert = require("assert");
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

function runSection(category, fn) {
  try {
    fn();
  } catch (err) {
    failures.push({
      category,
      detail: `Uncaught exception: ${err && err.stack ? err.stack : String(err)}`
    });
  }
}

function createSandbox() {
  const elements = {};
  const makeEl = (id) => {
    const el = {
      id,
      tagName: "DIV",
      value: "",
      checked: false,
      disabled: false,
      textContent: "",
      className: "",
      title: "",
      options: [],
      children: [],
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
        _set: new Set(),
        add(...cls) { cls.forEach((c) => this._set.add(c)); },
        remove(...cls) { cls.forEach((c) => this._set.delete(c)); },
        toggle(c, force) {
          if (force === undefined) {
            if (this._set.has(c)) this._set.delete(c);
            else this._set.add(c);
          } else if (force) this._set.add(c);
          else this._set.delete(c);
        },
        contains(c) { return this._set.has(c); }
      },
      replaceChildren(...nodes) {
        this.children = [...nodes];
      },
      appendChild(node) {
        if (node && node._isFragment && Array.isArray(node.children)) {
          this.children.push(...node.children);
        } else {
          this.children.push(node);
        }
        return node;
      },
      remove() {},
      select() {},
      click() {},
      focus() {},
      contains() { return false; },
      addEventListener(type, handler) {
        if (!this.listeners[type]) this.listeners[type] = [];
        this.listeners[type].push(handler);
      },
      querySelector() { return makeEl(`${id}-sub`); },
      querySelectorAll() { return [makeEl(`${id}-sub0`), makeEl(`${id}-sub1`)]; },
      setAttribute(k, v) { this.attributes[k] = String(v); },
      getAttribute(k) { return this.attributes[k] || ""; },
      cloneNode() { return makeEl(`${id}-clone`); },
      offsetWidth: 960,
      offsetHeight: 600
    };
    el.content = {
      firstElementChild: el,
      cloneNode: () => makeEl(`${id}-tpl-clone`)
    };
    return el;
  };

  const getEl = (id) => {
    if (!elements[id]) elements[id] = makeEl(id);
    return elements[id];
  };

  const tileLayerCalls = [];

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
    URLSearchParams,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    requestAnimationFrame: (cb) => {
      if (typeof cb === "function") cb();
      return 1;
    },
    cancelAnimationFrame: () => {},
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    navigator: {
      userAgent: "node-tdd-satellite",
      language: "zh-TW",
      hardwareConcurrency: 4,
      platform: "Linux"
    },
    screen: { width: 1920, height: 1080, colorDepth: 24 },
    localStorage: {
      _store: new Map(),
      getItem(k) { return this._store.has(k) ? this._store.get(k) : null; },
      setItem(k, v) { this._store.set(k, String(v)); },
      removeItem(k) { this._store.delete(k); }
    },
    sessionStorage: {
      _store: new Map(),
      getItem(k) { return this._store.has(k) ? this._store.get(k) : null; },
      setItem(k, v) { this._store.set(k, String(v)); },
      removeItem(k) { this._store.delete(k); }
    },
    document: {
      readyState: "loading",
      activeElement: null,
      title: "GeoMaster TW Test",
      body: makeEl("body"),
      documentElement: makeEl("html"),
      addEventListener: () => {},
      removeEventListener: () => {},
      getElementById: getEl,
      querySelector: (sel) => getEl(`qs:${sel}`),
      querySelectorAll: () => [],
      createElement: (tag) => {
        const el = makeEl(`dyn:${tag}`);
        el.tagName = String(tag || "DIV").toUpperCase();
        return el;
      },
      createElementNS: (_ns, tag) => makeEl(`svg:${tag}`),
      createDocumentFragment: () => ({
        _isFragment: true,
        children: [],
        appendChild(node) {
          this.children.push(node);
          return node;
        }
      }),
      execCommand: () => true
    },
    window: null,
    innerWidth: 1280,
    innerHeight: 800,
    scrollY: 0,
    scrollTo: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    location: {
      href: "file:///C:/geoMaster/index.html",
      origin: "null",
      pathname: "/C:/geoMaster/index.html",
      search: ""
    },
    history: {
      replaceState() {}
    },
    fetch: async () => ({ ok: false }),
    __tileLayerCalls: tileLayerCalls,
    lastFeedback: null
  };

  sandbox.window = sandbox;
  vm.createContext(sandbox);

  const loadOrder = [
    "data/admin-data.js",
    "data/transport-data.js",
    "data/poi-data.js",
    "js/state.js",
    "js/map-engine.js",
    "js/transport-engine.js",
    "js/poi-engine.js",
    "js/label-engine.js",
    "js/game-logic.js",
    "js/dashboard-ui.js",
    "js/p2p-engine.js",
    "js/ui-controls.js"
  ];

  for (const rel of loadOrder) {
    const code = readRepoFile(rel);
    vm.runInContext(code, sandbox, { filename: rel });
  }

  // Wrap L.tileLayer and setFeedback to record calls for deterministic assertions
  vm.runInContext(`
    if (typeof L !== "undefined" && typeof L.tileLayer === "function") {
      const _origTileLayer = L.tileLayer;
      L.tileLayer = function(url, options) {
        window.__tileLayerCalls.push({ url, options: options || {} });
        return _origTileLayer.apply(this, arguments);
      };
    }
    if (typeof setFeedback === "function") {
      const _origSetFeedback = setFeedback;
      setFeedback = function(text, level) {
        window.lastFeedback = { text, level };
        return _origSetFeedback(text, level);
      };
    }
    initMap();
    if (typeof bindAllUIEvents === "function") bindAllUIEvents();
  `, sandbox);

  return { sandbox, elements, tileLayerCalls };
}

const { sandbox: sb, elements, tileLayerCalls } = createSandbox();

// Helper to create a closed GeoJSON rectangle ring: [[minLng, minLat], [maxLng, minLat], [maxLng, maxLat], [minLng, maxLat], [minLng, minLat]]
function makeRectRing(minLng, minLat, maxLng, maxLat) {
  return [
    [minLng, minLat],
    [maxLng, minLat],
    [maxLng, maxLat],
    [minLng, maxLat],
    [minLng, minLat]
  ];
}

function makeMultiPolygonFeature(countyName, townName, rings) {
  return {
    type: "Feature",
    properties: {
      COUNTYNAME: countyName,
      TOWNNAME: townName
    },
    geometry: {
      type: "MultiPolygon",
      coordinates: rings.map((r) => [r])
    }
  };
}

function makePolygonFeature(countyName, townName, ring) {
  return {
    type: "Feature",
    properties: {
      COUNTYNAME: countyName,
      TOWNNAME: townName
    },
    geometry: {
      type: "Polygon",
      coordinates: [ring]
    }
  };
}

// ============================================================================
// 1. STATE SCHEMA & HELPERS (js/state.js)
// ============================================================================
runSection("1.StateSchema", () => {
  const s = vm.runInContext("state", sb);
  check(s.satelliteStyle === "day", "1.StateSchema", `Expected state.satelliteStyle === "day", got ${JSON.stringify(s.satelliteStyle)}`);
  check(s.satelliteLockViewport === true, "1.StateSchema", `Expected state.satelliteLockViewport === true, got ${JSON.stringify(s.satelliteLockViewport)}`);
  check(s.satelliteOutlineRevealed === false, "1.StateSchema", `Expected state.satelliteOutlineRevealed === false, got ${JSON.stringify(s.satelliteOutlineRevealed)}`);
  check(s.satelliteActiveQuestionStyle === "day", "1.StateSchema", `Expected state.satelliteActiveQuestionStyle === "day", got ${JSON.stringify(s.satelliteActiveQuestionStyle)}`);
  check(s.satelliteSavedBaseLayer === null, "1.StateSchema", `Expected state.satelliteSavedBaseLayer === null, got ${JSON.stringify(s.satelliteSavedBaseLayer)}`);
  check(s.satelliteSavedDistrictBorders === null, "1.StateSchema", `Expected state.satelliteSavedDistrictBorders === null, got ${JSON.stringify(s.satelliteSavedDistrictBorders)}`);
  check(s.satelliteViewportLocked === false, "1.StateSchema", `Expected state.satelliteViewportLocked === false, got ${JSON.stringify(s.satelliteViewportLocked)}`);

  const hasIsTargetQuiz = vm.runInContext('typeof isTargetQuizPlayMode === "function"', sb);
  const hasIsRandomTarget = vm.runInContext('typeof isRandomTargetPlayMode === "function"', sb);
  check(hasIsTargetQuiz, "1.StateSchema.Helpers", "isTargetQuizPlayMode must be defined in js/state.js");
  check(hasIsRandomTarget, "1.StateSchema.Helpers", "isRandomTargetPlayMode must be defined in js/state.js");

  if (hasIsTargetQuiz) {
    check(sb.isTargetQuizPlayMode("free") === false, "1.StateSchema.Helpers", 'isTargetQuizPlayMode("free") must be false');
    check(sb.isTargetQuizPlayMode("target_random") === true, "1.StateSchema.Helpers", 'isTargetQuizPlayMode("target_random") must be true');
    check(sb.isTargetQuizPlayMode("target_click") === true, "1.StateSchema.Helpers", 'isTargetQuizPlayMode("target_click") must be true');
    check(sb.isTargetQuizPlayMode("satellite_quiz") === true, "1.StateSchema.Helpers", 'isTargetQuizPlayMode("satellite_quiz") must be true');
  }
  if (hasIsRandomTarget) {
    check(sb.isRandomTargetPlayMode("free") === false, "1.StateSchema.Helpers", 'isRandomTargetPlayMode("free") must be false');
    check(sb.isRandomTargetPlayMode("target_click") === false, "1.StateSchema.Helpers", 'isRandomTargetPlayMode("target_click") must be false');
    check(sb.isRandomTargetPlayMode("target_random") === true, "1.StateSchema.Helpers", 'isRandomTargetPlayMode("target_random") must be true');
    check(sb.isRandomTargetPlayMode("satellite_quiz") === true, "1.StateSchema.Helpers", 'isRandomTargetPlayMode("satellite_quiz") must be true');
  }
});

// ============================================================================
// 2. computeMainPolygonBounds & County mainBounds ALGORITHM (js/map-engine.js)
// ============================================================================
runSection("2.MainPolygonBounds", () => {
  const hasComputeMain = vm.runInContext('typeof computeMainPolygonBounds === "function"', sb);
  const hasComputeCounty = vm.runInContext('typeof computeCountyMainBounds === "function"', sb);
  check(hasComputeMain, "2.MainPolygonBounds", "computeMainPolygonBounds(geojsonFeature, options) must be defined in js/map-engine.js");
  check(hasComputeCounty, "2.MainPolygonBounds", "computeCountyMainBounds(countyName, townList, options) must be defined in js/map-engine.js");
  if (!hasComputeMain) return;

  // 2a. Kaohsiung City / Qijin District (main island + Dongsha at ~20.7N + Taiping at ~10.37N)
  const qijinFeat = makeMultiPolygonFeature("高雄市", "旗津區", [
    makeRectRing(120.26, 22.54, 120.31, 22.62), // Qijin main body
    makeRectRing(116.71, 20.69, 116.73, 20.71), // Dongsha Island (South China Sea)
    makeRectRing(114.35, 10.37, 114.37, 10.38)  // Taiping Island (Spratly Islands)
  ]);
  const qijinBounds = sb.computeMainPolygonBounds(qijinFeat);
  const qSw = qijinBounds && typeof qijinBounds.getSouthWest === "function" ? qijinBounds.getSouthWest() : null;
  const qNe = qijinBounds && typeof qijinBounds.getNorthEast === "function" ? qijinBounds.getNorthEast() : null;
  check(
    Boolean(qSw && qNe && qSw.lat >= 22.4 && qNe.lat <= 22.7 && qSw.lng >= 120.2 && qNe.lng <= 120.4),
    "2a.KaohsiungQijin.ExcludesSouthChinaSea",
    `Expected Qijin mainBounds around [22.54..22.62N, 120.26..120.31E], got SW=${JSON.stringify(qSw)} NE=${JSON.stringify(qNe)}`
  );

  // 2b. Yilan County / Toucheng Township (main body + nearby Guishan + far Diaoyutai outlier)
  const touchengFeat = makeMultiPolygonFeature("宜蘭縣", "頭城鎮", [
    makeRectRing(121.75, 24.83, 121.90, 24.98), // Toucheng mainland
    makeRectRing(121.93, 24.83, 121.96, 24.85), // Guishan Island (~0.12 deg away)
    makeRectRing(123.46, 25.74, 123.49, 25.76)  // Diaoyutai (~1.8 deg away)
  ]);
  const touchengBounds = sb.computeMainPolygonBounds(touchengFeat);
  const tcSw = touchengBounds?.getSouthWest?.();
  const tcNe = touchengBounds?.getNorthEast?.();
  check(
    Boolean(tcSw && tcNe && tcSw.lat >= 24.8 && tcNe.lat <= 25.05 && tcSw.lng >= 121.7 && tcNe.lng <= 122.05),
    "2b.YilanToucheng.ExcludesDiaoyutai",
    `Expected Toucheng mainBounds to exclude Diaoyutai (123.49E, 25.76N), got SW=${JSON.stringify(tcSw)} NE=${JSON.stringify(tcNe)}`
  );

  // 2c. Keelung City / Zhongzheng District (main body + nearby Peace/Keelung Islet + far Pengjia/Mianhua/Huaping Northern Three Islets)
  const zhongzhengFeat = makeMultiPolygonFeature("基隆市", "中正區", [
    makeRectRing(121.75, 25.13, 121.81, 25.17), // Zhongzheng mainland
    makeRectRing(121.78, 25.18, 121.79, 25.20), // Keelung Islet (~0.04 deg away)
    makeRectRing(122.07, 25.62, 122.08, 25.63), // Pengjia Islet (~0.55 deg away)
    makeRectRing(122.10, 25.48, 122.11, 25.49)  // Mianhua Islet (~0.47 deg away)
  ]);
  const zzBounds = sb.computeMainPolygonBounds(zhongzhengFeat);
  const zzSw = zzBounds?.getSouthWest?.();
  const zzNe = zzBounds?.getNorthEast?.();
  check(
    Boolean(zzSw && zzNe && zzSw.lat >= 25.1 && zzNe.lat <= 25.25 && zzSw.lng >= 121.7 && zzNe.lng <= 121.85),
    "2c.KeelungZhongzheng.ExcludesPengjia",
    `Expected Keelung Zhongzheng mainBounds to exclude Pengjia/Mianhua (25.63N, 122.11E), got SW=${JSON.stringify(zzSw)} NE=${JSON.stringify(zzNe)}`
  );

  // 2d. Penghu / Kinmen / Lienchiang Archipelagos: nearby islands within 0.35° MUST BE PRESERVED!
  const magongArchipelagoFeat = makeMultiPolygonFeature("澎湖縣", "馬公市", [
    makeRectRing(119.55, 23.54, 119.63, 23.60), // Magong main island
    makeRectRing(119.50, 23.47, 119.53, 23.49), // Hujing Islet 虎井嶼 (~0.10 deg away)
    makeRectRing(119.51, 23.42, 119.53, 23.44)  // Tongpan Islet 桶盤嶼 (~0.14 deg away)
  ]);
  const phTownBounds = sb.computeMainPolygonBounds(magongArchipelagoFeat);
  const phSw = phTownBounds?.getSouthWest?.();
  const phNe = phTownBounds?.getNorthEast?.();
  check(
    Boolean(phSw && phNe && phSw.lat <= 23.43 && phNe.lat >= 23.59 && phSw.lng <= 119.51 && phNe.lng >= 119.62),
    "2d.PenghuArchipelago.PreservesNearbyIslands",
    `Expected Magong mainBounds to preserve nearby Hujing/Tongpan islets within 0.35°, got SW=${JSON.stringify(phSw)} NE=${JSON.stringify(phNe)}`
  );

  // 2e. RebuildMapLayers & County-level mainBounds (Kaohsiung, Taitung, Pingtung, Penghu, Kinmen, Lienchiang)
  const sampleFeatures = [
    qijinFeat,
    makePolygonFeature("高雄市", "苓雅區", makeRectRing(120.29, 22.61, 120.34, 22.64)),
    makePolygonFeature("高雄市", "美濃區", makeRectRing(120.51, 22.85, 120.62, 22.95)),
    touchengFeat,
    makePolygonFeature("宜蘭縣", "宜蘭市", makeRectRing(121.72, 24.73, 121.79, 24.78)),
    zhongzhengFeat,
    makePolygonFeature("基隆市", "仁愛區", makeRectRing(121.73, 25.12, 121.76, 25.14)),
    // Taitung mainland + Green Island + Orchid Island
    makePolygonFeature("臺東縣", "臺東市", makeRectRing(121.05, 22.72, 121.18, 22.82)),
    makePolygonFeature("臺東縣", "卑南鄉", makeRectRing(121.00, 22.75, 121.16, 22.92)),
    makePolygonFeature("臺東縣", "綠島鄉", makeRectRing(121.46, 22.63, 121.52, 22.69)),
    makePolygonFeature("臺東縣", "蘭嶼鄉", makeRectRing(121.50, 21.94, 121.62, 22.09)),
    // Pingtung mainland + Xiaoliuqiu
    makePolygonFeature("屏東縣", "屏東市", makeRectRing(120.45, 22.63, 120.53, 22.71)),
    makePolygonFeature("屏東縣", "東港鎮", makeRectRing(120.43, 22.44, 120.49, 22.49)),
    makePolygonFeature("屏東縣", "琉球鄉", makeRectRing(120.35, 22.32, 120.39, 22.36)),
    // Penghu archipelago towns
    magongArchipelagoFeat,
    makePolygonFeature("澎湖縣", "白沙鄉", makeRectRing(119.56, 23.63, 119.63, 23.75)),
    makePolygonFeature("澎湖縣", "望安鄉", makeRectRing(119.48, 23.34, 119.53, 23.40)),
    makePolygonFeature("澎湖縣", "七美鄉", makeRectRing(119.41, 23.19, 119.45, 23.23)),
    // Kinmen archipelago towns (Big Kinmen + Lieyu + distant Wuqiu)
    makePolygonFeature("金門縣", "金城鎮", makeRectRing(118.29, 24.40, 118.35, 24.45)),
    makePolygonFeature("金門縣", "烈嶼鄉", makeRectRing(118.22, 24.41, 118.27, 24.45)),
    makePolygonFeature("金門縣", "烏坵鄉", makeRectRing(119.44, 24.98, 119.47, 25.00)),
    // Lienchiang archipelago towns
    makePolygonFeature("連江縣", "南竿鄉", makeRectRing(119.90, 26.13, 119.96, 26.18)),
    makePolygonFeature("連江縣", "北竿鄉", makeRectRing(119.96, 26.20, 120.02, 26.24))
  ];

  sb.rebuildMapLayers({
    townsGeo: { type: "FeatureCollection", features: sampleFeatures },
    countiesGeo: null
  });

  const khCounty = vm.runInContext('COUNTY_BY_NAME["高雄市"]', sb);
  const khSw = khCounty?.mainBounds?.getSouthWest?.();
  const khNe = khCounty?.mainBounds?.getNorthEast?.();
  check(
    Boolean(khSw && khNe && khSw.lat >= 22.4 && khNe.lat <= 23.5 && khSw.lng >= 120.1 && khNe.lng <= 121.0),
    "2e.CountyMainBounds.Kaohsiung",
    `Expected Kaohsiung county mainBounds around mainland [22.54..22.95N, 120.26..120.62E], got SW=${JSON.stringify(khSw)} NE=${JSON.stringify(khNe)}`
  );

  const ttCounty = vm.runInContext('COUNTY_BY_NAME["臺東縣"]', sb);
  const ttSw = ttCounty?.mainBounds?.getSouthWest?.();
  const ttNe = ttCounty?.mainBounds?.getNorthEast?.();
  check(
    Boolean(ttSw && ttNe && ttSw.lat >= 22.6 && ttNe.lng <= 121.25),
    "2e.CountyMainBounds.TaitungExcludesGreenOrchidIslands",
    `Expected Taitung county mainBounds to exclude Green/Orchid Islands (lng <= 121.25, lat >= 22.6), got SW=${JSON.stringify(ttSw)} NE=${JSON.stringify(ttNe)}`
  );

  const ptCounty = vm.runInContext('COUNTY_BY_NAME["屏東縣"]', sb);
  const ptSw = ptCounty?.mainBounds?.getSouthWest?.();
  check(
    Boolean(ptSw && ptSw.lng >= 120.42),
    "2e.CountyMainBounds.PingtungExcludesXiaoliuqiu",
    `Expected Pingtung county mainBounds to exclude Xiaoliuqiu (lng >= 120.42), got SW=${JSON.stringify(ptSw)}`
  );

  const phCounty = vm.runInContext('COUNTY_BY_NAME["澎湖縣"]', sb);
  const phcSw = phCounty?.mainBounds?.getSouthWest?.();
  const phcNe = phCounty?.mainBounds?.getNorthEast?.();
  check(
    Boolean(phcSw && phcNe && phcSw.lat <= 23.22 && phcNe.lat >= 23.70),
    "2e.CountyMainBounds.PenghuPreservesArchipelago",
    `Expected Penghu county mainBounds to span Qimei (23.19N) to Baisha (23.75N), got SW=${JSON.stringify(phcSw)} NE=${JSON.stringify(phcNe)}`
  );

  const kmCounty = vm.runInContext('COUNTY_BY_NAME["金門縣"]', sb);
  const kmSw = kmCounty?.mainBounds?.getSouthWest?.();
  const kmNe = kmCounty?.mainBounds?.getNorthEast?.();
  check(
    Boolean(kmSw && kmNe && kmSw.lng <= 118.23 && kmNe.lng <= 118.50),
    "2e.CountyMainBounds.KinmenPreservesLieyuExcludesDistantWuqiu",
    `Expected Kinmen county mainBounds to include Big Kinmen + Lieyu (118.22..118.35E) without stretching to Wuqiu (119.47E), got SW=${JSON.stringify(kmSw)} NE=${JSON.stringify(kmNe)}`
  );

  const lcCounty = vm.runInContext('COUNTY_BY_NAME["連江縣"]', sb);
  const lcSw = lcCounty?.mainBounds?.getSouthWest?.();
  const lcNe = lcCounty?.mainBounds?.getNorthEast?.();
  check(
    Boolean(lcSw && lcNe && lcSw.lat <= 26.14 && lcNe.lat >= 26.23),
    "2e.CountyMainBounds.LienchiangPreservesArchipelago",
    `Expected Lienchiang county mainBounds to include Nangan & Beigan, got SW=${JSON.stringify(lcSw)} NE=${JSON.stringify(lcNe)}`
  );
});

// ============================================================================
// 3. NASA GIBS VIIRS BLACK MARBLE TILE CONFIG & HYBRID SWITCHING (js/map-engine.js)
// ============================================================================
runSection("3.NasaGibsTiles", () => {
  const nightUrl = vm.runInContext("GIS_TILES && GIS_TILES.satellite_night", sb);
  check(
    typeof nightUrl === "string" &&
      nightUrl.includes("VIIRS_Black_Marble") &&
      nightUrl.includes("GoogleMapsCompatible_Level8/{z}/{y}/{x}.png"),
    "3a.NasaGibsUrl",
    `Expected GIS_TILES.satellite_night with GoogleMapsCompatible_Level8/{z}/{y}/{x}.png, got ${JSON.stringify(nightUrl)}`
  );

  tileLayerCalls.length = 0;
  sb.setMapBaseLayer("satellite_night", true);
  const nightCall = tileLayerCalls.find((c) => c.url === nightUrl);
  check(Boolean(nightCall), "3b.SetMapBaseLayerNight", "setMapBaseLayer('satellite_night', true) must instantiate L.tileLayer(GIS_TILES.satellite_night, ...)");
  check(
    Boolean(nightCall && nightCall.options.maxNativeZoom === 8 && nightCall.options.maxZoom >= 15 && nightCall.options.opacity === 0.95),
    "3b.NasaGibsOptions",
    `Expected maxNativeZoom: 8, maxZoom >= 15, opacity: 0.95, got ${JSON.stringify(nightCall ? nightCall.options : null)}`
  );
  check(
    elements["leaflet-map"].classList.contains("basemap-no-spoiler"),
    "3b.NoSpoilerClass",
    "#leaflet-map must have class 'basemap-no-spoiler' in satellite_night layer"
  );

  const hasResolveStyle = vm.runInContext('typeof resolveSatelliteQuestionStyle === "function"', sb);
  check(hasResolveStyle, "3c.ResolveSatelliteStyle", "resolveSatelliteQuestionStyle(difficulty, style, rng) must be defined");
  if (hasResolveStyle) {
    check(sb.resolveSatelliteQuestionStyle("casual", "day", () => 0.1) === "day", "3c.ResolveDay", 'style="day" must resolve to "day"');
    check(sb.resolveSatelliteQuestionStyle("casual", "night", () => 0.9) === "night", "3c.ResolveNight", 'style="night" must resolve to "night"');
    check(sb.resolveSatelliteQuestionStyle("county_only", "hybrid", () => 0.5) === "night", "3c.ResolveHybridCountyNight", 'county_only + hybrid with rng=0.5 (<0.7) must resolve to "night"');
    check(sb.resolveSatelliteQuestionStyle("county_only", "hybrid", () => 0.85) === "day", "3c.ResolveHybridCountyDay", 'county_only + hybrid with rng=0.85 (>=0.7) must resolve to "day"');
    check(sb.resolveSatelliteQuestionStyle("casual", "hybrid", () => 0.2) === "night", "3c.ResolveHybridTownNight", 'town + hybrid with rng=0.2 (<0.3) must resolve to "night"');
    check(sb.resolveSatelliteQuestionStyle("casual", "hybrid", () => 0.5) === "day", "3c.ResolveHybridTownDay", 'town + hybrid with rng=0.5 (>=0.3) must resolve to "day"');
  }

  // Test satellite_hybrid baseLayer switching
  tileLayerCalls.length = 0;
  vm.runInContext('state.satelliteActiveQuestionStyle = "night";', sb);
  sb.setMapBaseLayer("satellite_hybrid", true);
  check(
    tileLayerCalls.some((c) => c.url === nightUrl && c.options.maxNativeZoom === 8),
    "3d.SetMapBaseLayerHybridNight",
    "setMapBaseLayer('satellite_hybrid') with satelliteActiveQuestionStyle='night' must load NASA night tiles with maxNativeZoom: 8"
  );
});

// ============================================================================
// 4. VIEWPORT LOCKING, 100% RESTORATION & SPECTATOR ISOLATION (js/map-engine.js)
// ============================================================================
runSection("4.ViewportLocking", () => {
  const hasLockFn = vm.runInContext('typeof lockMapViewportToBounds === "function"', sb);
  const hasUnlockFn = vm.runInContext('typeof unlockMapViewportToTaiwan === "function"', sb);
  check(hasLockFn, "4.ViewportLocking", "lockMapViewportToBounds(bounds, options) must be defined in js/map-engine.js");
  check(hasUnlockFn, "4.ViewportLocking", "unlockMapViewportToTaiwan(options) must be defined in js/map-engine.js");
  if (!hasLockFn || !hasUnlockFn) return;

  const targetBounds = vm.runInContext("L.latLngBounds([22.54, 120.26], [22.62, 120.31])", sb);

  // 4a. Normal player with satelliteLockViewport === true locks maxBounds and raises minZoom
  vm.runInContext('state.role = "solo"; state.satelliteLockViewport = true;', sb);
  sb.unlockMapViewportToTaiwan({ restoreLayers: false });
  const lockedOk = sb.lockMapViewportToBounds(targetBounds);
  const lockedMaxB = vm.runInContext("map.getMaxBounds && map.getMaxBounds()", sb);
  const lockedMinZ = vm.runInContext("map.getMinZoom && map.getMinZoom()", sb);
  check(
    lockedOk === true && vm.runInContext("state.satelliteViewportLocked === true", sb),
    "4a.LockActivePlayer",
    "lockMapViewportToBounds must return true and set state.satelliteViewportLocked = true for non-spectator"
  );
  check(
    Boolean(lockedMaxB && lockedMaxB.getNorthEast().lat < 24.0 && lockedMaxB.getSouthWest().lat > 21.5 && lockedMinZ >= 8),
    "4a.LockBoundsAndMinZoom",
    `Expected padded maxBounds around target and minZoom >= 8, got maxBounds=${JSON.stringify(lockedMaxB)} minZoom=${lockedMinZ}`
  );

  // 4b. Spectator guard: state.role === "spectator" MUST NOT lock viewport!
  sb.unlockMapViewportToTaiwan({ restoreLayers: false });
  vm.runInContext('state.role = "spectator"; state.satelliteLockViewport = true;', sb);
  const specLockRes = sb.lockMapViewportToBounds(targetBounds);
  const specMaxB = vm.runInContext("map.getMaxBounds && map.getMaxBounds()", sb);
  const specMinZ = vm.runInContext("map.getMinZoom && map.getMinZoom()", sb);
  check(
    specLockRes === false &&
      vm.runInContext("state.satelliteViewportLocked === false", sb) &&
      Boolean(specMaxB && specMaxB.getNorthEast().lat >= 27.0 && specMinZ === 7),
    "4b.SpectatorIsolation",
    `Spectator MUST NOT have viewport locked! got res=${specLockRes}, maxBounds=${JSON.stringify(specMaxB)}, minZoom=${specMinZ}`
  );

  // 4c. When satelliteLockViewport === false, viewport is NOT locked
  vm.runInContext('state.role = "player"; state.satelliteLockViewport = false;', sb);
  const unlockedToggleRes = sb.lockMapViewportToBounds(targetBounds);
  check(
    unlockedToggleRes === false && vm.runInContext("state.satelliteViewportLocked === false", sb),
    "4c.LockToggleOff",
    "When state.satelliteLockViewport === false, lockMapViewportToBounds must not lock viewport"
  );

  // 4d. unlockMapViewportToTaiwan() 100% restores TAIWAN_MAX_BOUNDS, minZoom: 7, baseLayer & showDistrictBorders
  vm.runInContext(`
    state.role = "solo";
    state.satelliteLockViewport = true;
    state.satelliteSavedBaseLayer = "vector";
    state.satelliteSavedDistrictBorders = true;
    state.mapLayer = "satellite_night";
    state.showDistrictBorders = false;
  `, sb);
  sb.lockMapViewportToBounds(targetBounds);
  sb.unlockMapViewportToTaiwan({ restoreLayers: true });

  const restoredMaxB = vm.runInContext("map.getMaxBounds && map.getMaxBounds()", sb);
  const restoredMinZ = vm.runInContext("map.getMinZoom && map.getMinZoom()", sb);
  check(
    Boolean(
      restoredMaxB &&
        Math.abs(restoredMaxB.getSouthWest().lat - 20.2) < 0.01 &&
        Math.abs(restoredMaxB.getNorthEast().lat - 27.4) < 0.01 &&
        restoredMinZ === 7 &&
        vm.runInContext('state.satelliteViewportLocked === false && state.mapLayer === "vector" && state.showDistrictBorders === true && state.satelliteSavedBaseLayer === null && state.satelliteSavedDistrictBorders === null', sb)
    ),
    "4d.Unlock100PercentRestoration",
    `unlockMapViewportToTaiwan must restore TAIWAN_MAX_BOUNDS, minZoom:7, mapLayer:"vector", showDistrictBorders:true`
  );
});

// ============================================================================
// 5. POLYGON STYLE, LABELS & HINT LEVEL PROGRESSION (js/map-engine.js, js/game-logic.js)
// ============================================================================
runSection("5.PolygonStyleAndHints", () => {
  // 5a. Ensure tests/test_4fixes.js L26 regex still passes!
  const mapJs = readRepoFile("js/map-engine.js");
  const targetMatch = mapJs.match(/if\s*\(isTarget\)\s*\{[\s\S]*?return\s*\{([\s\S]*?)\};/);
  check(
    Boolean(targetMatch && /stroke:\s*true/.test(targetMatch[1])),
    "5a.Test4FixesCompatibility",
    "js/map-engine.js must keep `if (isTarget) { return { stroke: true, ... }; }` intact for tests/test_4fixes.js L26"
  );

  const qijinTown = vm.runInContext('ALL_TOWNS.find(t => t.fullCountyTown === "高雄市旗津區")', sb);
  const lingyaTown = vm.runInContext('ALL_TOWNS.find(t => t.fullCountyTown === "高雄市苓雅區")', sb);

  vm.runInContext(`
    state.playMode = "satellite_quiz";
    state.difficulty = "hard_suffix";
    state.regionQuizEnabled = true;
    state.selectedCounties = new Set(TAIWAN_ADMIN_DATA.map(c => c.name));
    state.selectedTownIds = new Set(ALL_TOWNS.map(t => t.id));
    state.unlockedTowns.clear();
    state.unlockedCounties.clear();
    state.missedTowns.clear();
    state.isGameOver = false;
    state.showDistrictBorders = false;
    state.satelliteOutlineRevealed = false;
    state.hintLevel = 0;
    state.allowTargetHints = false;
    state.targetId = ${JSON.stringify(qijinTown.id)};
  `, sb);

  // 5b. Unrevealed target & locked non-target both hide fill (fillOpacity === 0) and hide outline
  const styleUnrevealedTarget = sb.computePolygonStyle(qijinTown);
  const styleLockedNonTarget = sb.computePolygonStyle(lingyaTown);
  check(
    styleUnrevealedTarget.fillOpacity === 0 && (!styleUnrevealedTarget.stroke || styleUnrevealedTarget.weight === 0),
    "5b.UnrevealedTargetStyle",
    `Expected unrevealed target in satellite_quiz to have fillOpacity:0 and hidden stroke, got ${JSON.stringify(styleUnrevealedTarget)}`
  );
  check(
    styleLockedNonTarget.fillOpacity === 0 && (!styleLockedNonTarget.stroke || styleLockedNonTarget.weight === 0),
    "5b.LockedNonTargetZeroSilhouetteLeak",
    `Expected locked non-target in satellite_quiz to also have fillOpacity:0 (zero silhouette contrast), got ${JSON.stringify(styleLockedNonTarget)}`
  );

  // 5c. Label Engine: locked target & locked towns must NOT render labels in satellite_quiz
  sb.renderSmartLabelsAndLeaderLines();
  const labelCountBefore = elements["labels-overlay-dom"] ? elements["labels-overlay-dom"].children.length : 0;
  check(
    labelCountBefore === 0,
    "5c.LabelsHiddenWhileLocked",
    `Expected 0 map labels while all towns are locked in satellite_quiz, got ${labelCountBefore}`
  );

  // 5d. Hint Level 1 reveals outline stroke while keeping fillOpacity === 0 (even when allowTargetHints === false)
  sb.giveTargetHint();
  const revealedAfterH1 = vm.runInContext("state.satelliteOutlineRevealed === true && state.hintLevel === 1", sb);
  const styleRevealedTarget = sb.computePolygonStyle(qijinTown);
  check(
    revealedAfterH1 && styleRevealedTarget.stroke === true && styleRevealedTarget.weight >= 2 && styleRevealedTarget.fillOpacity === 0,
    "5d.HintLevel1RevealsOutlineOnly",
    `Expected Hint L1 to set satelliteOutlineRevealed=true with stroke:true and fillOpacity:0, got state.satelliteOutlineRevealed=${vm.runInContext("state.satelliteOutlineRevealed", sb)}, style=${JSON.stringify(styleRevealedTarget)}`
  );

  // 5e. Hint Level 2 gives county hint (for town mode)
  sb.giveTargetHint();
  const h2Fb = sb.lastFeedback ? sb.lastFeedback.text : "";
  check(
    vm.runInContext("state.hintLevel === 2 && state.satelliteOutlineRevealed === true", sb) && h2Fb.includes("高雄市"),
    "5e.HintLevel2CountyHint",
    `Expected Hint L2 feedback to include county "高雄市", got "${h2Fb}"`
  );

  // 5f. Hint Level 3 gives first-character hint
  sb.giveTargetHint();
  const h3Fb = sb.lastFeedback ? sb.lastFeedback.text : "";
  check(
    vm.runInContext("state.hintLevel === 3 && state.satelliteOutlineRevealed === true", sb) && h3Fb.includes("旗"),
    "5f.HintLevel3FirstCharHint",
    `Expected Hint L3 feedback to include first character "旗", got "${h3Fb}"`
  );

  // 5g. After unlocking target, polygon highlights normally with fillOpacity > 0.5
  vm.runInContext(`state.unlockedTowns.add(${JSON.stringify(qijinTown.id)});`, sb);
  const styleUnlocked = sb.computePolygonStyle(qijinTown);
  check(
    styleUnlocked.stroke === true && styleUnlocked.fillOpacity >= 0.5,
    "5g.UnlockedTargetHighlightsNormally",
    `Expected unlocked target to render with stroke:true and fillOpacity >= 0.5, got ${JSON.stringify(styleUnlocked)}`
  );
});

// ============================================================================
// 6. LIFECYCLE, MODE TRANSITIONS & ANSWER EVALUATION (js/game-logic.js, js/dashboard-ui.js)
// ============================================================================
runSection("6.LifecycleAndTransitions", () => {
  const qijinTown = vm.runInContext('ALL_TOWNS.find(t => t.fullCountyTown === "高雄市旗津區")', sb);
  const lingyaTown = vm.runInContext('ALL_TOWNS.find(t => t.fullCountyTown === "高雄市苓雅區")', sb);

  vm.runInContext(`
    state.role = "solo";
    state.mapLayer = "vector";
    state.showDistrictBorders = true;
    state.satelliteSavedBaseLayer = null;
    state.satelliteSavedDistrictBorders = null;
    state.playMode = "satellite_quiz";
    state.satelliteStyle = "night";
    state.satelliteLockViewport = true;
    state.satelliteOutlineRevealed = true;
    state.difficulty = "casual";
    state.regionQuizEnabled = true;
    state.stationQuizEnabled = false;
    state.airportQuizEnabled = false;
    state.portQuizEnabled = false;
    state.reservoirQuizEnabled = false;
    state.lakeQuizEnabled = false;
    state.settlementQuizEnabled = false;
    state.selectedCounties = new Set(["高雄市"]);
    state.selectedTownIds = new Set([${JSON.stringify(qijinTown.id)}, ${JSON.stringify(lingyaTown.id)}]);
    state.unlockedTowns.clear();
    state.unlockedCounties.clear();
    state.isGameOver = false;
  `, sb);

  // 6a. pickNextTargetRegion() in satellite_quiz
  sb.pickNextTargetRegion();
  const pickedId = vm.runInContext("state.targetId", sb);
  check(
    pickedId === qijinTown.id || pickedId === lingyaTown.id,
    "6a.PickNextTargetInSatelliteQuiz",
    `Expected targetId to be picked from scope towns, got ${JSON.stringify(pickedId)}`
  );
  check(
    vm.runInContext('state.satelliteOutlineRevealed === false && state.hintLevel === 0 && state.showDistrictBorders === false && state.mapLayer === "satellite_night" && state.satelliteSavedBaseLayer === "vector" && state.satelliteSavedDistrictBorders === true && state.satelliteViewportLocked === true', sb),
    "6a.PickNextTargetSavesAndLocksState",
    `Expected pickNextTargetRegion in satellite_quiz to save pre-satellite state, hide borders, switch to satellite_night, reset outlineRevealed=false, and lock viewport`
  );

  // 6b. Clicking another polygon on the map in satellite_quiz MUST NOT hijack state.targetId
  const otherTown = pickedId === qijinTown.id ? lingyaTown : qijinTown;
  sb.handlePolygonClick(otherTown);
  check(
    vm.runInContext("state.targetId", sb) === pickedId,
    "6b.PolygonClickDoesNotHijackTarget",
    "handlePolygonClick in satellite_quiz must not overwrite state.targetId"
  );

  // 6c. Answering current target in satellite_quiz unlocks it and automatically picks the next target
  vm.runInContext("state.satelliteOutlineRevealed = true;", sb);
  const currentTown = pickedId === qijinTown.id ? qijinTown : lingyaTown;
  const guessOk = sb.evaluateGuess(currentTown.baseName, false);
  const nextPickedId = vm.runInContext("state.targetId", sb);
  check(
    guessOk === true &&
      vm.runInContext(`state.unlockedTowns.has(${JSON.stringify(currentTown.id)})`, sb) &&
      nextPickedId === otherTown.id &&
      vm.runInContext("state.satelliteOutlineRevealed === false", sb),
    "6c.EvaluateGuessAdvancesToNextTarget",
    `Expected answering "${currentTown.baseName}" in satellite_quiz to unlock and advance to next target "${otherTown.id}" with satelliteOutlineRevealed=false, got guessOk=${guessOk}, nextPickedId=${nextPickedId}`
  );

  // 6d. finishGame("giveup") unlocks viewport to full Taiwan
  sb.finishGame("giveup");
  const postGiveupMaxB = vm.runInContext("map.getMaxBounds && map.getMaxBounds()", sb);
  const postGiveupMinZ = vm.runInContext("map.getMinZoom && map.getMinZoom()", sb);
  check(
    Boolean(postGiveupMaxB && postGiveupMaxB.getNorthEast().lat >= 27.0 && postGiveupMinZ === 7 && vm.runInContext("state.satelliteViewportLocked === false", sb)),
    "6d.FinishGameUnlocksViewport",
    "finishGame('giveup') must unlock viewport back to TAIWAN_MAX_BOUNDS and minZoom: 7"
  );

  // 6e. exitTargetQuizMode() restores playMode="free", baseLayer="vector", showDistrictBorders=true, and unlocks viewport
  vm.runInContext('state.isGameOver = false; state.finished = false; state.playMode = "satellite_quiz";', sb);
  sb.pickNextTargetRegion();
  sb.exitTargetQuizMode();
  check(
    vm.runInContext('state.playMode === "free" && state.targetId === null && state.satelliteOutlineRevealed === false && state.satelliteViewportLocked === false && state.mapLayer === "vector" && state.showDistrictBorders === true', sb),
    "6e.ExitTargetQuizModeRestoresAll",
    `exitTargetQuizMode must restore playMode="free", mapLayer="vector", showDistrictBorders=true, satelliteViewportLocked=false`
  );
});

// ============================================================================
// 7. P2P SYNC, DOM CONTRACT & ZERO .innerHTML / file:// COMPLIANCE
// ============================================================================
runSection("7.P2PAndDomContract", () => {
  // 7a. P2P getHostSyncConfig / buildProposedConfigFromPatch / describeConfigDiff / applyRemoteSyncConfig / renderRoomConciseSettingsSummary
  vm.runInContext(`
    state.playMode = "satellite_quiz";
    state.satelliteStyle = "hybrid";
    state.satelliteLockViewport = false;
  `, sb);
  const hostCfg = sb.getHostSyncConfig(false);
  check(
    hostCfg.playMode === "satellite_quiz" && hostCfg.satelliteStyle === "hybrid" && hostCfg.satelliteLockViewport === false,
    "7a.GetHostSyncConfig",
    `Expected getHostSyncConfig to include playMode:"satellite_quiz", satelliteStyle:"hybrid", satelliteLockViewport:false, got ${JSON.stringify({ playMode: hostCfg.playMode, satelliteStyle: hostCfg.satelliteStyle, satelliteLockViewport: hostCfg.satelliteLockViewport })}`
  );

  vm.runInContext('state.playMode = "free"; state.satelliteStyle = "day"; state.satelliteLockViewport = true;', sb);
  const diffLines = sb.describeConfigDiff({
    playMode: "satellite_quiz",
    satelliteStyle: "night",
    satelliteLockViewport: false
  });
  check(
    Array.isArray(diffLines) && diffLines.some((l) => l.includes("衛星")),
    "7b.DescribeConfigDiff",
    `Expected describeConfigDiff to describe satellite_quiz / satelliteStyle changes, got ${JSON.stringify(diffLines)}`
  );

  const proposed = sb.buildProposedConfigFromPatch({
    playMode: "satellite_quiz",
    satelliteStyle: "night",
    satelliteLockViewport: false
  });
  check(
    proposed.playMode === "satellite_quiz" && proposed.satelliteStyle === "night" && proposed.satelliteLockViewport === false,
    "7c.BuildProposedConfigFromPatch",
    `Expected buildProposedConfigFromPatch to preserve satellite fields, got ${JSON.stringify({ playMode: proposed.playMode, satelliteStyle: proposed.satelliteStyle, satelliteLockViewport: proposed.satelliteLockViewport })}`
  );

  sb.applyRemoteSyncConfig(proposed, false, true);
  check(
    vm.runInContext('state.playMode === "satellite_quiz" && state.satelliteStyle === "night" && state.satelliteLockViewport === false', sb),
    "7d.ApplyRemoteSyncConfig",
    `Expected applyRemoteSyncConfig to apply playMode="satellite_quiz", satelliteStyle="night", satelliteLockViewport=false`
  );

  const conciseText = sb.getConciseDifficultySummaryText();
  check(
    typeof conciseText === "string" && conciseText.includes("衛星"),
    "7e.ConciseSettingsSummary",
    `Expected getConciseDifficultySummaryText() in satellite_quiz to mention "衛星", got "${conciseText}"`
  );

  // 7f. index.html required DOM IDs & attributes from Integration Contract
  const html = readRepoFile("index.html");
  const requiredDomMarkers = [
    'id="btn-playmode-satellite"',
    'data-playmode="satellite_quiz"',
    'id="satellite-quiz-options-panel"',
    'id="btn-sat-style-day"',
    'id="btn-sat-style-night"',
    'id="btn-sat-style-hybrid"',
    'id="chk-satellite-lock-viewport"',
    'id="satellite-night-town-notice"',
    "夜間解析度較低，鄉鎮模式屬高難度趣味挑戰",
    'id="btn-target-reveal-outline"',
    "顯示輪廓"
  ];
  for (const marker of requiredDomMarkers) {
    check(
      html.includes(marker),
      "7f.IndexHtmlDomContract",
      `index.html is missing required TRACK-A DOM contract marker: ${marker}`
    );
  }

  // 7g. Strict ZERO .innerHTML, no <script type="module">, no fetch("./data/...")
  check(
    !/<script[^>]+type\s*=\s*["']module["']/i.test(html),
    "7g.FileProtocolNoEsModule",
    "index.html must not use <script type=\"module\"> (breaks file:// compatibility)"
  );

  const jsFilesToAudit = [
    "js/state.js",
    "js/map-engine.js",
    "js/transport-engine.js",
    "js/poi-engine.js",
    "js/label-engine.js",
    "js/game-logic.js",
    "js/dashboard-ui.js",
    "js/p2p-engine.js",
    "js/ui-controls.js"
  ];
  for (const rel of jsFilesToAudit) {
    const src = readRepoFile(rel);
    check(
      !/\.innerHTML\b/.test(src),
      "7g.StrictZeroInnerHTML",
      `${rel} must not use .innerHTML`
    );
    check(
      !/fetch\s*\(\s*["']\.?\/?data\//.test(src),
      "7g.NoLocalDataFetch",
      `${rel} must not use fetch("./data/...") (breaks file:// CORS)`
    );
  }
});

// ============================================================================
// 8. ANTI-CHEAT & HARDENING GUARDS (Review #8 Regression Suite)
// ============================================================================
runSection("8.AntiCheatAndHardeningGuards", () => {
  const qijinTown = vm.runInContext('ALL_TOWNS.find(t => t.fullCountyTown === "高雄市旗津區")', sb);
  const lingyaTown = vm.runInContext('ALL_TOWNS.find(t => t.fullCountyTown === "高雄市苓雅區")', sb);

  vm.runInContext(`
    state.role = "solo";
    state.isGameOver = false;
    state.finished = false;
    state.playMode = "satellite_quiz";
    state.satelliteStyle = "day";
    state.satelliteLockViewport = true;
    state.difficulty = "casual";
    state.regionQuizEnabled = true;
    state.selectedCounties = new Set(["高雄市"]);
    state.selectedTownIds = new Set([${JSON.stringify(qijinTown.id)}, ${JSON.stringify(lingyaTown.id)}]);
    state.unlockedTowns.clear();
  `, sb);
  sb.pickNextTargetRegion();

  // 8a. District borders toggle blocked for active player in satellite_quiz
  elements["chk-modal-borders"] = elements["chk-modal-borders"] || sb.document.getElementById("chk-modal-borders");
  elements["chk-modal-borders"].checked = true;
  sb.setDistrictBordersVisible(true, false);
  check(
    vm.runInContext("state.showDistrictBorders === false", sb) &&
      elements["chk-modal-borders"].checked === false &&
      Boolean(sb.lastFeedback && sb.lastFeedback.text.includes("衛星影像猜題")),
    "8a.BlockBordersToggleInSatelliteQuiz",
    `Expected setDistrictBordersVisible(true, false) to be blocked in satellite_quiz, got showDistrictBorders=${vm.runInContext("state.showDistrictBorders", sb)}, fb="${sb.lastFeedback?.text}"`
  );

  // 8b. Switching to non-satellite base layer (vector/terrain) blocked for active player in satellite_quiz
  sb.setMapBaseLayer("vector", false);
  check(
    vm.runInContext('state.mapLayer === "satellite"', sb) &&
      Boolean(sb.lastFeedback && sb.lastFeedback.text.includes("鎖定衛星圖層")),
    "8b.BlockNonSatelliteBaseLayerInSatelliteQuiz",
    `Expected setMapBaseLayer("vector", false) to be blocked in satellite_quiz, got mapLayer=${vm.runInContext("state.mapLayer", sb)}, fb="${sb.lastFeedback?.text}"`
  );

  // 8c. resetToFullTaiwanView() blocked when satelliteViewportLocked === true for active player
  sb.lastFeedback = null;
  sb.resetToFullTaiwanView();
  check(
    Boolean(sb.lastFeedback && sb.lastFeedback.text.includes("衛星視野鎖定中")),
    "8c.BlockResetToFullTaiwanViewWhenLocked",
    `Expected resetToFullTaiwanView() to be blocked when satelliteViewportLocked=true, got fb="${sb.lastFeedback?.text}"`
  );

  // 8d. Spectator is NOT blocked by satellite_quiz layer/border/resetToFullTaiwanView guards
  vm.runInContext('state.role = "spectator";', sb);
  sb.setMapBaseLayer("vector", false);
  sb.setDistrictBordersVisible(true, false);
  check(
    vm.runInContext('state.mapLayer === "vector" && state.showDistrictBorders === true', sb),
    "8d.SpectatorLayerAndBorderFreedom",
    `Expected spectator to freely switch layer and borders in satellite_quiz, got mapLayer=${vm.runInContext("state.mapLayer", sb)}, showDistrictBorders=${vm.runInContext("state.showDistrictBorders", sb)}`
  );

  // 8e. moveTargetByDirection is a no-op in satellite_quiz
  vm.runInContext('state.role = "solo"; state.showDistrictBorders = false;', sb);
  const lockedTargetBeforeDir = vm.runInContext("state.targetId", sb);
  sb.moveTargetByDirection("N");
  sb.moveTargetByDirection("S");
  check(
    vm.runInContext("state.targetId", sb) === lockedTargetBeforeDir,
    "8e.MoveTargetByDirectionNoOpInSatelliteQuiz",
    `Expected moveTargetByDirection to be a no-op in satellite_quiz, targetId before=${lockedTargetBeforeDir}, after=${vm.runInContext("state.targetId", sb)}`
  );

  // 8f. giveTargetHint() fallback for targetPoiId in satellite_quiz at L2/L3
  const samplePoi = vm.runInContext("TAIWAN_POI_DATA[0]", sb);
  vm.runInContext(`
    state.targetId = null;
    state.targetStationKey = null;
    state.targetPoiId = ${JSON.stringify(samplePoi.id)};
    state.hintLevel = 1;
  `, sb);
  sb.lastFeedback = null;
  sb.giveTargetHint();
  check(
    vm.runInContext("state.hintLevel === 2", sb) &&
      Boolean(sb.lastFeedback && sb.lastFeedback.text.includes("衛星提示 2")),
    "8f.PoiHintFallbackInSatelliteQuiz",
    `Expected giveTargetHint() L2 for targetPoiId in satellite_quiz to provide hint feedback, got "${sb.lastFeedback?.text}"`
  );

  sb.exitTargetQuizMode();
});

// ============================================================================
// REPORT SUMMARY
// ============================================================================
if (failures.length > 0) {
  console.error(`FAIL [RED]: ${failures.length} of ${totalChecks} checks failed in tests/test_satellite_quiz.js:`);
  failures.forEach((f, idx) => {
    console.error(`  ${idx + 1}. [${f.category}] ${f.detail}`);
  });
  process.exit(1);
} else {
  console.log(`PASS [GREEN]: All ${totalChecks} TRACK-A Satellite Quiz checks passed!`);
}
