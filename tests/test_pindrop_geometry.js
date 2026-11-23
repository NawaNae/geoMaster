#!/usr/bin/env node
"use strict";

/**
 * Deterministic Geometry, Behavioral & Anti-Spoiler TDD Suite for TRACK-B: Pin-Drop Mode
 * Run with: node tests/test_pindrop_geometry.js
 * Zero external dependencies (pure Node.js: assert, fs, path, vm).
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
      click() {
        const list = this.listeners.click || [];
        list.forEach((fn) => fn({ target: this, currentTarget: this, preventDefault() {}, stopPropagation() {} }));
      },
      focus() {},
      contains() { return false; },
      closest() { return null; },
      addEventListener(type, handler) {
        if (!this.listeners[type]) this.listeners[type] = [];
        this.listeners[type].push(handler);
      },
      querySelector(sel) {
        if (!this._qCache) this._qCache = {};
        if (!this._qCache[sel]) this._qCache[sel] = makeEl(`${id}-qs:${sel}`);
        return this._qCache[sel];
      },
      querySelectorAll() { return [makeEl(`${id}-sub0`), makeEl(`${id}-sub1`)]; },
      setAttribute(k, v) { this.attributes[k] = String(v); },
      getAttribute(k) { return this.attributes[k] || ""; },
      cloneNode() { return makeEl(`${id}-clone-${Math.random().toString(36).slice(2, 6)}`); },
      offsetWidth: 960,
      offsetHeight: 600
    };
    el.content = {
      firstElementChild: el,
      cloneNode: () => makeEl(`${id}-tpl-clone-${Math.random().toString(36).slice(2, 6)}`)
    };
    return el;
  };

  const getEl = (id) => {
    if (!elements[id]) {
      const created = makeEl(id);
      if (String(id).startsWith("modal-")) {
        created.classList.add("hidden");
      }
      elements[id] = created;
    }
    return elements[id];
  };

  const tileLayerCalls = [];
  const markerCalls = [];
  const polylineCalls = [];
  const divIconCalls = [];
  const windowListeners = {};

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
      userAgent: "node-tdd-pindrop",
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
      title: "GeoMaster TW PinDrop TDD",
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
    addEventListener(type, fn) {
      if (!windowListeners[type]) windowListeners[type] = [];
      windowListeners[type].push(fn);
    },
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
    __markerCalls: markerCalls,
    __polylineCalls: polylineCalls,
    __divIconCalls: divIconCalls,
    __windowListeners: windowListeners,
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
    "js/pindrop-engine.js",
    "js/game-logic.js",
    "js/dashboard-ui.js",
    "js/p2p-engine.js",
    "js/ui-controls.js"
  ];

  for (const rel of loadOrder) {
    const code = readRepoFile(rel);
    vm.runInContext(code, sandbox, { filename: rel });
  }

  vm.runInContext(`
    if (typeof L !== "undefined" && typeof L.tileLayer === "function") {
      const _origTileLayer = L.tileLayer;
      L.tileLayer = function(url, options) {
        window.__tileLayerCalls.push({ url, options: options || {} });
        return _origTileLayer.apply(this, arguments);
      };
    }
    if (typeof L !== "undefined" && typeof L.marker === "function") {
      const _origMarker = L.marker;
      L.marker = function(latlng, options) {
        const inst = _origMarker.apply(this, arguments);
        inst._latlng = latlng;
        inst._options = options || {};
        window.__markerCalls.push({ latlng, options: options || {}, instance: inst });
        return inst;
      };
    }
    if (typeof L !== "undefined" && typeof L.polyline === "function") {
      const _origPolyline = L.polyline;
      L.polyline = function(latlngs, options) {
        const inst = _origPolyline.apply(this, arguments);
        inst._latlngs = latlngs;
        inst._options = options || {};
        window.__polylineCalls.push({ latlngs, options: options || {}, instance: inst });
        return inst;
      };
    }
    if (typeof L !== "undefined" && typeof L.divIcon === "function") {
      const _origDivIcon = L.divIcon;
      L.divIcon = function(options) {
        const inst = _origDivIcon.apply(this, arguments);
        window.__divIconCalls.push(options || {});
        return inst;
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
    if (typeof initPoiMapEngine === "function") initPoiMapEngine();
    if (typeof bindAllUIEvents === "function") bindAllUIEvents();
    window.state = state;
    window.ALL_TOWNS = ALL_TOWNS;
    window.TAIWAN_ADMIN_DATA = TAIWAN_ADMIN_DATA;
    window.COUNTY_BY_NAME = COUNTY_BY_NAME;
    window.TAIWAN_FULL_VIEW_BOUNDS = TAIWAN_FULL_VIEW_BOUNDS;
    window.map = map;
  `, sandbox);

  return { sandbox, elements, tileLayerCalls, markerCalls, polylineCalls, divIconCalls, windowListeners };
}

const { sandbox: sb, elements, tileLayerCalls, markerCalls, polylineCalls, windowListeners } = createSandbox();

function makeRectRing(minLng, minLat, maxLng, maxLat) {
  return [
    [minLng, minLat],
    [maxLng, minLat],
    [maxLng, maxLat],
    [minLng, maxLat],
    [minLng, minLat]
  ];
}

function makePolygonFeature(countyName, townName, ring, holes = []) {
  return {
    type: "Feature",
    properties: { COUNTYNAME: countyName, TOWNNAME: townName },
    geometry: {
      type: "Polygon",
      coordinates: [ring, ...holes]
    }
  };
}

function makeMultiPolygonFeature(countyName, townName, rings) {
  return {
    type: "Feature",
    properties: { COUNTYNAME: countyName, TOWNNAME: townName },
    geometry: {
      type: "MultiPolygon",
      coordinates: rings.map((r) => [r])
    }
  };
}

// ============================================================================
// 1. PURE GEOMETRY ENGINE & SCORING MATH (js/pindrop-engine.js)
// ============================================================================
runSection("1.GeometryAndScoringMath", () => {
  check(typeof sb.haversineDistanceKm === "function", "1.Exports", "haversineDistanceKm must be exported globally");
  check(typeof sb.isPointInRing === "function", "1.Exports", "isPointInRing must be exported globally");
  check(typeof sb.isPointInGeoJsonGeometry === "function", "1.Exports", "isPointInGeoJsonGeometry must be exported globally");
  check(typeof sb.nearestPointOnSegment === "function", "1.Exports", "nearestPointOnSegment must be exported globally");
  check(typeof sb.computeDistanceToGeoJson === "function", "1.Exports", "computeDistanceToGeoJson must be exported globally");
  check(typeof sb.computePinDropScore === "function", "1.Exports", "computePinDropScore must be exported globally");

  // 1a. Haversine accuracy on real Taiwan coordinates (Taipei Main Station to Banqiao Station ~7.3 km)
  const dTpeBq = sb.haversineDistanceKm(25.0478, 121.5170, 25.0142, 121.4637);
  check(dTpeBq > 6.4 && dTpeBq < 6.8, "1a.Haversine.TaipeiToBanqiao", `Expected ~6.56 km between Taipei & Banqiao, got ${dTpeBq}`);
  const dZero = sb.haversineDistanceKm(23.9739, 120.9820, 23.9739, 120.9820);
  check(dZero === 0, "1a.Haversine.ZeroDistance", `Expected 0 km for identical points, got ${dZero}`);
  // 1 deg latitude is ~111.195 km (with R=6371.0088 => 6371.0088 * pi / 180 = 111.19508 km)
  const d1DegLat = sb.haversineDistanceKm(23.0, 121.0, 24.0, 121.0);
  check(Math.abs(d1DegLat - 111.195) < 0.01, "1a.Haversine.OneDegLat", `Expected 111.195 km for 1 deg latitude, got ${d1DegLat}`);

  // 1b. Point inside Polygon => 0 km & 5000 pts (including large townships like Hualien Xiulin)
  const xiulinPoly = {
    type: "Polygon",
    coordinates: [makeRectRing(121.30, 23.98, 121.65, 24.32)]
  };
  check(sb.isPointInGeoJsonGeometry(121.48, 24.15, xiulinPoly) === true, "1b.InsidePolygon", "Center point must be inside Xiulin polygon");
  check(sb.isPointInGeoJsonGeometry(121.10, 24.15, xiulinPoly) === false, "1b.OutsidePolygon", "West point must be outside Xiulin polygon");
  const insideRes = sb.computeDistanceToGeoJson(24.28, 121.60, xiulinPoly);
  check(insideRes.inside === true && insideRes.distanceKm === 0, "1b.InsideDistanceZero", `Expected inside=true, distanceKm=0 anywhere inside polygon, got ${JSON.stringify(insideRes)}`);
  check(sb.computePinDropScore(insideRes.distanceKm, 25, 0) === 5000, "1b.InsideScore5000", "Inside polygon must score 5000");

  // 1c. Polygon with Hole (enclave): point inside hole MUST be treated as outside!
  // E.g. Chiayi County surrounding Chiayi City enclave hole
  const outerRing = makeRectRing(120.20, 23.30, 120.70, 23.60);
  const holeRing = makeRectRing(120.40, 23.45, 120.48, 23.50);
  const polyWithHole = {
    type: "Polygon",
    coordinates: [outerRing, holeRing]
  };
  check(sb.isPointInGeoJsonGeometry(120.30, 23.40, polyWithHole) === true, "1c.PolygonHole.OuterBody", "Point in outer ring outside hole must be inside");
  check(sb.isPointInGeoJsonGeometry(120.44, 23.47, polyWithHole) === false, "1c.PolygonHole.InsideHoleIsOutside", "Point inside hole must be treated as OUTSIDE polygon");
  const holeDistRes = sb.computeDistanceToGeoJson(23.47, 120.44, polyWithHole);
  check(holeDistRes.inside === false && holeDistRes.distanceKm > 0, "1c.PolygonHole.PositiveDistanceToHoleEdge", `Point inside hole must have distanceKm > 0 to hole boundary, got ${JSON.stringify(holeDistRes)}`);
  // Nearest boundary from (23.47, 120.44) to hole [120.40..120.48, 23.45..23.50] is lat=23.45 (0.02 deg lat ~ 2.2239 km)
  const expectedHoleEdgeKm = sb.haversineDistanceKm(23.47, 120.44, 23.45, 120.44);
  check(Math.abs(holeDistRes.distanceKm - expectedHoleEdgeKm) < 0.05, "1c.PolygonHole.NearestEdgeAccuracy", `Expected distance ~${expectedHoleEdgeKm.toFixed(3)} km, got ${holeDistRes.distanceKm}`);

  // 1d. MultiPolygon offshore islands (e.g. Taitung or Penghu islands)
  const multiPoly = {
    type: "MultiPolygon",
    coordinates: [
      [makeRectRing(121.00, 22.70, 121.18, 22.85)], // Mainland
      [makeRectRing(121.46, 22.63, 121.52, 22.69)], // Green Island
      [makeRectRing(121.50, 21.94, 121.62, 22.09)]  // Orchid Island
    ]
  };
  check(sb.isPointInGeoJsonGeometry(121.49, 22.66, multiPoly) === true, "1d.MultiPolygon.GreenIslandInside", "Point on Green Island must be inside MultiPolygon");
  check(sb.isPointInGeoJsonGeometry(121.55, 22.00, multiPoly) === true, "1d.MultiPolygon.OrchidIslandInside", "Point on Orchid Island must be inside MultiPolygon");
  check(sb.isPointInGeoJsonGeometry(121.30, 22.66, multiPoly) === false, "1d.MultiPolygon.OceanChannelOutside", "Point in ocean channel between mainland and Green Island must be outside");

  // 1e. Nearest point on segment & boundary accuracy (< 0.05 km error)
  // Segment along lat=23.5 from lng=120.0 to lng=121.0; query point at (lat=23.6, lng=120.4)
  const segRes = sb.nearestPointOnSegment(120.4, 23.6, 120.0, 23.5, 121.0, 23.5);
  const exactMeridianKm = sb.haversineDistanceKm(23.6, 120.4, 23.5, 120.4);
  check(Math.abs(segRes.nearestLat - 23.5) < 1e-6 && Math.abs(segRes.nearestLng - 120.4) < 1e-6, "1e.NearestPointOnSegment.Coords", `Expected nearest=(23.5, 120.4), got (${segRes.nearestLat}, ${segRes.nearestLng})`);
  check(Math.abs(segRes.distanceKm - exactMeridianKm) < 0.05, "1e.NearestPointOnSegment.Accuracy", `Expected distance within 0.05 km of ${exactMeridianKm}, got ${segRes.distanceKm}`);

  const polyDistRes = sb.computeDistanceToGeoJson(24.42, 121.48, xiulinPoly);
  const exactNorthEdgeKm = sb.haversineDistanceKm(24.42, 121.48, 24.32, 121.48);
  check(polyDistRes.inside === false, "1e.ComputeDistanceToGeoJson.Outside", "Point north of Xiulin must be outside");
  check(Math.abs(polyDistRes.nearestLat - 24.32) < 1e-5 && Math.abs(polyDistRes.nearestLng - 121.48) < 1e-5, "1e.ComputeDistanceToGeoJson.NearestPoint", `Expected nearest=(24.32, 121.48), got (${polyDistRes.nearestLat}, ${polyDistRes.nearestLng})`);
  check(Math.abs(polyDistRes.distanceKm - exactNorthEdgeKm) < 0.05, "1e.ComputeDistanceToGeoJson.AccuracySub50m", `Expected error < 0.05 km, got |${polyDistRes.distanceKm} - ${exactNorthEdgeKm}|`);

  // 1f. Exponential scoring formula & perfect radii (0 km, 0.5 km for station/POI, 1.5 km for airport)
  check(sb.computePinDropScore(0, 25, 0) === 5000, "1f.Score.0km", "0 km must score 5000");
  check(sb.computePinDropScore(5, 25, 0) === Math.round(5000 * Math.exp(-5 / 25)), "1f.Score.5km_Scale25", "5 km at scale=25 must match formula (4094)");
  check(sb.computePinDropScore(25, 25, 0) === Math.round(5000 * Math.exp(-1)), "1f.Score.25km_Scale25", "25 km at scale=25 must match formula (1839)");
  check(sb.computePinDropScore(80, 25, 0) === Math.round(5000 * Math.exp(-80 / 25)), "1f.Score.80km_Scale25", "80 km at scale=25 must match formula (204)");
  check(sb.computePinDropScore(0.45, 25, 0.5) === 5000, "1f.Score.StationPerfectRadius", "0.45 km within 0.5 km station/POI radius must score 5000");
  check(sb.computePinDropScore(0.6, 25, 0.5) < 5000, "1f.Score.StationBeyondPerfectRadius", "0.6 km beyond 0.5 km station/POI radius must score < 5000");
  check(sb.computePinDropScore(1.4, 25, 1.5) === 5000, "1f.Score.AirportPerfectRadius", "1.4 km within 1.5 km airport radius must score 5000");
  check(sb.computePinDropScore(2.0, 25, 1.5) < 5000, "1f.Score.AirportBeyondPerfectRadius", "2.0 km beyond 1.5 km airport radius must score < 5000");

  // Strict monotonicity check across distances 0..200 km
  let prevScore = 5000;
  let monotonic = true;
  for (let d = 1; d <= 200; d += 2) {
    const sc = sb.computePinDropScore(d, 25, 0);
    if (sc > prevScore || sc < 0 || sc > 5000) {
      monotonic = false;
      break;
    }
    prevScore = sc;
  }
  check(monotonic, "1f.Score.Monotonicity", "Score must be monotonically non-increasing in [0, 5000]");
});

// ============================================================================
// 2. GEOJSON CACHING IN rebuildMapLayers() (js/map-engine.js)
// ============================================================================
runSection("2.GeoJsonCaching", () => {
  const sampleFeatures = [
    makePolygonFeature("彰化縣", "芳苑鄉", makeRectRing(120.28, 23.88, 120.38, 23.98)),
    makePolygonFeature("彰化縣", "二林鎮", makeRectRing(120.35, 23.86, 120.46, 23.95)),
    makePolygonFeature("花蓮縣", "秀林鄉", makeRectRing(121.30, 23.98, 121.65, 24.32)),
    makeMultiPolygonFeature("臺東縣", "綠島鄉", [
      makeRectRing(121.46, 22.63, 121.52, 22.69)
    ])
  ];
  const countiesGeo = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { COUNTYNAME: "彰化縣" },
        geometry: {
          type: "Polygon",
          coordinates: [makeRectRing(120.25, 23.80, 120.68, 24.18)]
        }
      }
    ]
  };

  sb.rebuildMapLayers({
    townsGeo: { type: "FeatureCollection", features: sampleFeatures },
    countiesGeo
  });

  const fangyuan = sb.ALL_TOWNS.find((t) => t.countyName === "彰化縣" && t.townName === "芳苑鄉");
  const xiulin = sb.ALL_TOWNS.find((t) => t.countyName === "花蓮縣" && t.townName === "秀林鄉");
  const changhuaCounty = sb.COUNTY_BY_NAME["彰化縣"];
  const hualienCounty = sb.COUNTY_BY_NAME["花蓮縣"];

  check(Boolean(fangyuan && fangyuan.geojsonGeometry && fangyuan.geojsonGeometry.type === "Polygon"), "2a.TownGeoJsonCached", "rebuildMapLayers must cache townObj.geojsonGeometry");
  check(Boolean(xiulin && xiulin.geojsonGeometry && xiulin.geojsonGeometry.type === "Polygon"), "2a.XiulinGeoJsonCached", "Xiulin townObj.geojsonGeometry must be cached");
  check(Boolean(changhuaCounty && changhuaCounty.geojsonGeometry), "2b.CountyGeoJsonCachedFromCountiesGeo", "countyObj.geojsonGeometry must be cached from countiesGeo");
  check(Boolean(hualienCounty && hualienCounty.geojsonGeometry), "2c.CountyGeoJsonFallbackFromMemberTowns", "countyObj.geojsonGeometry must fallback to combining member town geometries when missing from countiesGeo");
});

// ============================================================================
// 3. STATE SCHEMA, TWO-STEP INTERACTION, ANTI-SPOILER & ROUND LIFECYCLE
// ============================================================================
runSection("3.PinDropGameplayAndAntiSpoiler", () => {
  const s = sb.state;
  check(Boolean(s.pinDrop && typeof s.pinDrop === "object"), "3a.StateSchema", "state.pinDrop must exist");
  check(s.pinDropRounds === 10, "3a.DefaultRounds", `Expected state.pinDropRounds === 10, got ${s.pinDropRounds}`);

  // Set up deterministic scope: 2 townships (芳苑鄉, 秀林鄉)
  const fangyuan = sb.ALL_TOWNS.find((t) => t.countyName === "彰化縣" && t.townName === "芳苑鄉");
  const xiulin = sb.ALL_TOWNS.find((t) => t.countyName === "花蓮縣" && t.townName === "秀林鄉");
  s.regionQuizEnabled = true;
  s.stationQuizEnabled = false;
  s.airportQuizEnabled = false;
  s.portQuizEnabled = false;
  s.reservoirQuizEnabled = false;
  s.lakeQuizEnabled = false;
  s.settlementQuizEnabled = false;
  s.difficulty = "casual";
  s.selectedCounties = new Set(["彰化縣", "花蓮縣"]);
  s.selectedTownIds = new Set([fangyuan.id, xiulin.id]);
  s.pinDropRounds = 5;
  s.mapLayer = "terrain";
  s.showDistrictBorders = true;
  s.showRawOpenRailwayTile = true;
  s.showStationNames = true;

  // Enter pin_drop mode
  sb.setPlayMode("pin_drop");

  check(s.playMode === "pin_drop", "3b.EnterPinDrop.PlayMode", `Expected playMode === "pin_drop", got ${s.playMode}`);
  check(s.pinDrop.active === true, "3b.EnterPinDrop.Active", "state.pinDrop.active must be true");
  check(s.pinDrop.phase === "placing", "3b.EnterPinDrop.PhasePlacing", `Expected phase === "placing", got ${s.pinDrop.phase}`);
  check(s.pinDrop.currentRound === 1, "3b.EnterPinDrop.Round1", `Expected currentRound === 1, got ${s.pinDrop.currentRound}`);
  check(Boolean(s.pinDrop.currentTarget), "3b.EnterPinDrop.HasCurrentTarget", "state.pinDrop.currentTarget must be populated");

  // ANTI-SPOILER CHECKS DURING PLACING PHASE:
  // 1. Label-free basemap only (vector, terrain, or satellite) and no OpenRailwayMap / road tiles
  check(["vector", "terrain", "satellite"].includes(s.mapLayer), "3c.AntiSpoiler.LabelFreeBasemap", `Expected label-free basemap, got ${s.mapLayer}`);
  // Try switching to street layer during pin_drop -> must be blocked
  sb.setMapBaseLayer("street");
  check(s.mapLayer !== "street", "3c.AntiSpoiler.BlockStreetBasemap", "setMapBaseLayer('street') must be blocked during pin_drop");

  // 2. District borders hidden by default
  check(s.showDistrictBorders === false, "3c.AntiSpoiler.DistrictBordersHiddenByDefault", `Expected showDistrictBorders === false by default in pin_drop, got ${s.showDistrictBorders}`);

  // 3. Map labels & leader lines hidden
  sb.renderSmartLabelsAndLeaderLines();
  const domLabels = elements["labels-overlay-dom"];
  const svgLeaders = elements["leader-overlay-svg"];
  check(domLabels.children.length === 0 && svgLeaders.children.length === 0, "3c.AntiSpoiler.ZeroMapLabels", "Zero map labels or leader lines may render during pin_drop");

  // 4. Polygon styles during placing must NOT leak target, unlocked, or missed colors
  s.unlockedTowns.add(fangyuan.id);
  s.missedTowns.add(xiulin.id);
  const stFangyuanPlacing = sb.computePolygonStyle(fangyuan);
  const stXiulinPlacing = sb.computePolygonStyle(xiulin);
  check(stFangyuanPlacing.stroke === false && stXiulinPlacing.stroke === false, "3c.AntiSpoiler.PolygonStrokeHidden", "Polygon strokes must be hidden when showDistrictBorders is false in pin_drop");
  check(stFangyuanPlacing.fillColor === stXiulinPlacing.fillColor, "3c.AntiSpoiler.NoUnlockedOrMissedFillLeak", "Unlocked/missed polygon fills must be suppressed during pin_drop placing");
  check(stFangyuanPlacing.fillColor === "#253e63" && stFangyuanPlacing.fillOpacity === 0.96, "3c.VectorSilhouetteContrast", `Expected high-contrast vector fill #253e63 @ 0.96, got ${stFangyuanPlacing.fillColor} @ ${stFangyuanPlacing.fillOpacity}`);
  check(elements["map-rail-control-pill"].classList.contains("hidden") && elements["btn-leader-mode"].classList.contains("hidden"), "3c.Declutter.MapToolbarControlsHidden", "Non-applicable Free-Mode toolbar controls must be hidden during pin_drop");

  // 5. Answer text input dock hidden, Pin-Drop control bar visible, Confirm button disabled before click
  const ansForm = elements["answer-form"];
  const pinBar = elements["pindrop-dock-bar"];
  const confirmBtn = elements["btn-pindrop-confirm"];
  check(ansForm.classList.contains("hidden"), "3d.UI.AnswerFormHidden", "#answer-form must be hidden in pin_drop mode");
  check(!pinBar.classList.contains("hidden"), "3d.UI.PinDropBarVisible", "#pindrop-dock-bar must be visible in pin_drop mode");
  check(confirmBtn.disabled === true, "3d.UI.ConfirmDisabledInitially", "#btn-pindrop-confirm must be disabled before placing a pin");

  // 6. Dashboard / sidebar must NOT leak upcoming queue items
  sb.updateScoreAndProgressUI();
  const progressList = elements["county-progress-list"];
  const dumpText = (node) => {
    if (!node) return "";
    return (node.textContent || "") + (Array.isArray(node.children) ? node.children.map(dumpText).join(" ") : "");
  };
  const sidebarTextDuringPlacing = dumpText(progressList);
  check(!sidebarTextDuringPlacing.includes("芳苑") && !sidebarTextDuringPlacing.includes("秀林"), "3c.AntiSpoiler.SidebarNoTargetLeak", `Sidebar must not leak target or queue names during round 1 placing, got: ${sidebarTextDuringPlacing}`);

  // Force currentTarget to Fangyuan for deterministic inside-polygon scoring test
  s.pinDrop.currentTarget = sb.buildPinDropTargetFromTown(fangyuan);

  // TWO-STEP INTERACTION: First click places/moves preview pin, does NOT submit!
  sb.handlePinDropMapClick({ lat: 23.93, lng: 120.33 }); // Inside Fangyuan [120.28..120.38, 23.88..23.98]
  check(s.pinDrop.phase === "placing", "3e.TwoStep.FirstClickDoesNotSubmit", "First map click must only place preview pin and keep phase === 'placing'");
  check(Boolean(s.pinDrop.guessLatLng && s.pinDrop.guessLatLng.lat === 23.93 && s.pinDrop.guessLatLng.lng === 120.33), "3e.TwoStep.PreviewLatLngSet", "First click must record guessLatLng");
  check(confirmBtn.disabled === false, "3e.TwoStep.ConfirmEnabledAfterClick", "Confirm button must be enabled after placing preview pin");

  // Second click moves the preview pin without submitting
  sb.handlePolygonClick(fangyuan, { latlng: { lat: 23.94, lng: 120.34 } });
  check(s.pinDrop.phase === "placing", "3e.TwoStep.PolygonClickMovesPinOnly", "handlePolygonClick in pin_drop must move preview pin without submitting");
  check(s.pinDrop.guessLatLng.lat === 23.94 && s.pinDrop.guessLatLng.lng === 120.34, "3e.TwoStep.MovedLatLngUpdated", "Preview pin coordinates must update on second click");

  // Step 2: Confirm guess (inside Fangyuan polygon -> 0.0 km, +5000 pts)
  const polyCountBefore = polylineCalls.length;
  sb.confirmPinDropGuess();
  check(s.pinDrop.phase === "revealed", "3f.Reveal.PhaseRevealed", `Expected phase === "revealed", got ${s.pinDrop.phase}`);
  check(s.pinDrop.totalScore === 5000, "3f.Reveal.InsideScore5000", `Expected totalScore === 5000 for inside-polygon hit, got ${s.pinDrop.totalScore}`);
  check(s.pinDrop.history.length === 1 && s.pinDrop.history[0].inside === true && s.pinDrop.history[0].distanceKm === 0, "3f.Reveal.HistoryRecorded", "Round 1 history must record inside=true, distanceKm=0, score=5000");
  check(polylineCalls.length > polyCountBefore, "3f.Reveal.DashedLineDrawn", "Reveal phase must draw L.polyline connecting guess to nearest point");

  // During revealed phase, target polygon must highlight in emerald
  const stFangyuanRevealed = sb.computePolygonStyle(fangyuan);
  check(stFangyuanRevealed.stroke === true && stFangyuanRevealed.fillOpacity >= 0.35, "3f.Reveal.TargetPolygonHighlighted", "Target polygon must be highlighted during revealed phase");

  // Advance to Round 2 via keyboard Space / Enter or nextPinDropRound()
  sb.nextPinDropRound();
  check(s.pinDrop.phase === "placing", "3g.NextRound.PhasePlacing", "nextPinDropRound must enter placing phase");
  check(s.pinDrop.currentRound === 2, "3g.NextRound.RoundIncremented", `Expected currentRound === 2, got ${s.pinDrop.currentRound}`);
  check(s.pinDrop.guessLatLng === null, "3g.NextRound.GuessCleared", "guessLatLng must be cleared at start of new round");
  check(confirmBtn.disabled === true, "3g.NextRound.ConfirmDisabledAgain", "Confirm button must be disabled at start of new round");

  // Verify viewport reset to TAIWAN_FULL_VIEW_BOUNDS at start of new round
  const mapCenter = sb.map.getCenter();
  const fullCenter = sb.TAIWAN_FULL_VIEW_BOUNDS.getCenter();
  check(Math.abs(mapCenter.lat - fullCenter.lat) < 0.05 && Math.abs(mapCenter.lng - fullCenter.lng) < 0.05, "3g.NextRound.ViewportResetToFullTaiwan", `Expected map center reset to Taiwan full view (${fullCenter.lat}, ${fullCenter.lng}), got (${mapCenter.lat}, ${mapCenter.lng})`);

  // Force Round 2 target to Xiulin and place pin outside (10 km north of 24.32N at 24.41N, 121.48E)
  s.pinDrop.currentTarget = sb.buildPinDropTargetFromTown(xiulin);
  sb.handlePinDropMapClick({ lat: 24.41, lng: 121.48 });
  // Trigger keyboard Enter to confirm guess
  const kdHandlers = windowListeners.keydown || [];
  kdHandlers.forEach((fn) => fn({ key: "Enter", preventDefault() {}, stopPropagation() {} }));
  check(s.pinDrop.phase === "revealed", "3h.Keyboard.EnterConfirmsGuess", "Pressing Enter during placing with pin set must confirm guess");
  check(s.pinDrop.history.length === 2, "3h.Keyboard.HistoryLen2", "History must have 2 rounds after Round 2 confirm");
  check(s.pinDrop.history[1].inside === false && s.pinDrop.history[1].distanceKm > 9.5 && s.pinDrop.history[1].distanceKm < 10.5, "3h.OutsideGuess.Distance", `Expected ~10.0 km outside Xiulin, got ${s.pinDrop.history[1].distanceKm}`);
  const expectedR2Score = sb.computePinDropScore(s.pinDrop.history[1].distanceKm, 25, 0);
  check(s.pinDrop.history[1].score === expectedR2Score, "3h.OutsideGuess.Score", `Expected score ${expectedR2Score}, got ${s.pinDrop.history[1].score}`);
  check(Boolean(sb.lastFeedback && String(sb.lastFeedback.text).includes("最近邊界")), "3h.PolygonRevealWording", `Polygon reveal must say '最近邊界', got ${JSON.stringify(sb.lastFeedback)}`);

  // Trigger keyboard Space to advance to finish (since only 2 towns in pool, totalRounds capped to 2)
  kdHandlers.forEach((fn) => fn({ key: " ", preventDefault() {}, stopPropagation() {} }));
  check(s.pinDrop.phase === "finished", "3i.Summary.FinishedPhase", `Expected phase === "finished" after all rounds, got ${s.pinDrop.phase}`);
  const summaryModal = elements["modal-pindrop-summary"];
  check(!summaryModal.classList.contains("hidden"), "3i.Summary.ModalOpened", "#modal-pindrop-summary must open when rounds finish");
  const summaryStats = sb.computePinDropSummaryStats();
  check(summaryStats.roundsPlayed === 2, "3i.Summary.RoundsPlayed", `Expected 2 rounds played, got ${summaryStats.roundsPlayed}`);
  check(summaryStats.totalScore === 5000 + expectedR2Score, "3i.Summary.TotalScore", `Expected totalScore ${5000 + expectedR2Score}, got ${summaryStats.totalScore}`);
  check(summaryStats.bestRound && summaryStats.bestRound.score === 5000, "3i.Summary.BestRound", "Best round must be the 5000-pt round");
});

// ============================================================================
// 4. COUNTY, STATION, POI & ENDLESS POOLS + CLEAN EXIT & P2P GUARD
// ============================================================================
runSection("4.PoolsCleanExitAndP2PGuard", () => {
  const s = sb.state;

  // 4a. County-only pool (scaleKm = 40)
  s.difficulty = "county_only";
  s.regionQuizEnabled = true;
  s.selectedCounties = new Set(["彰化縣", "花蓮縣"]);
  s.pinDropRounds = 0; // Endless mode!
  sb.startPinDropGame();
  check(s.pinDrop.totalRounds === 0, "4a.EndlessCounty.TotalRoundsZero", "Endless mode must have totalRounds === 0");
  check(s.pinDrop.currentTarget && s.pinDrop.currentTarget.kind === "county", "4a.EndlessCounty.TargetKindCounty", `Expected county target, got ${JSON.stringify(s.pinDrop.currentTarget?.kind)}`);
  check(sb.getPinDropScaleKm(s.pinDrop.currentTarget) === 40, "4a.EndlessCounty.Scale40", "County targets must use scaleKm = 40");

  // 4b. Station & POI (Airport + Reservoir) mixed pool
  s.difficulty = "casual";
  s.regionQuizEnabled = false;
  s.stationQuizEnabled = true;
  s.quizStationLines = new Set(["thsr_main"]);
  s.airportQuizEnabled = true;
  s.airportSubTypes = new Set(["intl"]);
  s.pinDropRounds = 10;
  const mixedPool = sb.buildPinDropCandidatePool();
  const hasStation = mixedPool.some((item) => item.kind === "station");
  const hasAirport = mixedPool.some((item) => item.kind === "poi" && item.poiCategory === "airport");
  check(hasStation && hasAirport, "4b.MixedStationAndPoiPool", `Expected both stations and airports in pool, got count=${mixedPool.length}`);

  const airportTarget = mixedPool.find((item) => item.kind === "poi" && item.poiCategory === "airport");
  const stationTarget = mixedPool.find((item) => item.kind === "station");
  check(sb.getPinDropPerfectRadiusKm(airportTarget) === 1.5, "4b.AirportPerfectRadius1_5km", "Airport POI target must have perfectRadiusKm = 1.5");
  check(sb.getPinDropPerfectRadiusKm(stationTarget) === 0.5, "4b.StationPerfectRadius0_5km", "Station target must have perfectRadiusKm = 0.5");

  // Verify station & POI markers on map are hidden during pin_drop placing
  sb.startPinDropGame();
  sb.updateRoadAndRailwayTileOverlays();
  sb.refreshPoiMapLayer();
  const hasOpenRailTile = tileLayerCalls.some((c) => String(c.url).includes("openrailwaymap") && sb.map.hasLayer(c));
  check(!hasOpenRailTile, "4b.AntiSpoiler.NoOpenRailwayTile", "OpenRailwayMap tiles must never be active during pin_drop");

  // Verify point-target (POI/station) reveal wording omits '最近邊界'
  s.pinDrop.currentTarget = airportTarget;
  sb.handlePinDropMapClick({ lat: 23.0, lng: 120.5 });
  sb.confirmPinDropGuess();
  check(Boolean(sb.lastFeedback && !String(sb.lastFeedback.text).includes("最近邊界") && String(sb.lastFeedback.text).includes("距離")), "4b.PointTargetRevealWording", `Point target reveal must NOT say '最近邊界', got ${JSON.stringify(sb.lastFeedback)}`);
  check(!elements["target-banner-desc"].textContent.includes("最近邊界"), "4b.PointTargetBannerWording", `Point target banner desc must NOT say '最近邊界', got ${elements["target-banner-desc"].textContent}`);

  // 4c. Clean exit back to free mode restores basemap, borders, viewport, feedback, and input dock
  sb.setPlayMode("free");
  check(s.playMode === "free", "4c.CleanExit.PlayModeFree", "PlayMode must return to 'free'");
  check(s.pinDrop.active === false && s.pinDrop.phase === "idle", "4c.CleanExit.PinDropStateReset", "state.pinDrop must reset to active=false, phase='idle'");
  check(!elements["answer-form"].classList.contains("hidden"), "4c.CleanExit.AnswerFormRestored", "#answer-form must be visible after exiting pin_drop");
  check(elements["pindrop-dock-bar"].classList.contains("hidden"), "4c.CleanExit.PinDropBarHidden", "#pindrop-dock-bar must be hidden after exiting pin_drop");
  check(!elements["map-rail-control-pill"].classList.contains("hidden") && !elements["btn-leader-mode"].classList.contains("hidden"), "4c.CleanExit.ToolbarRestored", "Map toolbar controls must be restored on exit");
  check(Boolean(sb.lastFeedback && String(sb.lastFeedback.text).includes("已切回自由輸入模式")), "4c.CleanExit.FeedbackCleared", `Expected exit feedback message, got ${JSON.stringify(sb.lastFeedback)}`);
  const exitCenter = sb.map.getCenter();
  const fullCenterExit = sb.TAIWAN_FULL_VIEW_BOUNDS.getCenter();
  check(Math.abs(exitCenter.lat - fullCenterExit.lat) < 0.05 && Math.abs(exitCenter.lng - fullCenterExit.lng) < 0.05, "4c.CleanExit.ViewportReset", "Viewport must reset to TAIWAN_FULL_VIEW_BOUNDS on exit");
  check(s.mapLayer === "terrain", "4c.CleanExit.BasemapRestored", `Expected saved basemap 'terrain' restored, got ${s.mapLayer}`);
  check(s.showDistrictBorders === true, "4c.CleanExit.DistrictBordersRestored", `Expected saved showDistrictBorders=true restored, got ${s.showDistrictBorders}`);

  // 4d. P2P Phase 1 Multiplayer Guard
  s.roomCode = "TW9999";
  s.isHost = true;
  sb.lastFeedback = null;
  sb.setPlayMode("pin_drop");
  check(s.playMode === "free", "4d.P2PGuard.BlockedInRoomCode", "setPlayMode('pin_drop') must be blocked when state.roomCode is active");
  check(Boolean(sb.lastFeedback && String(sb.lastFeedback.text).includes("標座標模式目前僅支援單人遊玩")), "4d.P2PGuard.FeedbackMessage", `Expected solo-only notice, got ${JSON.stringify(sb.lastFeedback)}`);

  s.roomCode = "";
  s.roomId = "ROOM123";
  sb.lastFeedback = null;
  sb.setPlayMode("pin_drop");
  check(s.playMode === "free", "4d.P2PGuard.BlockedInRoomId", "setPlayMode('pin_drop') must be blocked when state.roomId is active");
  s.roomId = "";
});

// ============================================================================
// 5. STATIC SECURITY & ARCHITECTURE CONTRACT (Zero .innerHTML)
// ============================================================================
runSection("5.ZeroInnerHtmlContract", () => {
  const filesToScan = [
    "js/pindrop-engine.js",
    "js/state.js",
    "js/map-engine.js",
    "js/game-logic.js",
    "js/dashboard-ui.js",
    "js/ui-controls.js",
    "js/p2p-engine.js",
    "js/label-engine.js",
    "js/transport-engine.js",
    "js/poi-engine.js",
    "index.html"
  ];
  for (const rel of filesToScan) {
    const src = readRepoFile(rel);
    const lines = src.split(/\r?\n/);
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) return;
      if (/\.innerHTML\b/.test(trimmed) || /\.outerHTML\b/.test(trimmed) || /\binsertAdjacentHTML\b/.test(trimmed)) {
        check(false, "5.ZeroInnerHtml", `Forbidden HTML injection API in ${rel}:${idx + 1}: ${trimmed}`);
      }
    });
  }
  check(true, "5.ZeroInnerHtml", "All scanned files passed zero .innerHTML static check");
});

if (failures.length > 0) {
  console.error(`\n❌ test_pindrop_geometry.js FAILED (${failures.length} of ${totalChecks} checks failed):`);
  failures.forEach((f, i) => {
    console.error(`  ${i + 1}. [${f.category}] ${f.detail}`);
  });
  process.exit(1);
} else {
  console.log(`\n✅ test_pindrop_geometry.js PASSED: ${totalChecks} / ${totalChecks} checks succeeded!`);
}
