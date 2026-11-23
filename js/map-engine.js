// =========================================================================
// 4. HARDWARE-ACCELERATED CANVAS LEAFLET MAP INITIALIZATION
// =========================================================================
if (typeof window.L === "undefined") {
  // Lightweight offline fallback shim when Leaflet CDN is unreachable (e.g., offline file:// mode or Node VM tests)
  const toLatLngObj = (pt) => {
    if (!pt) return null;
    if (Array.isArray(pt) && pt.length >= 2) {
      return { lat: Number(pt[0]), lng: Number(pt[1]) };
    }
    if (typeof pt === "object" && Number.isFinite(Number(pt.lat)) && Number.isFinite(Number(pt.lng))) {
      return { lat: Number(pt.lat), lng: Number(pt.lng) };
    }
    return null;
  };

  const makeLatLngBounds = (a, b) => {
    const bounds = {
      _sw: { lat: Infinity, lng: Infinity },
      _ne: { lat: -Infinity, lng: -Infinity },
      isValid() {
        return (
          Number.isFinite(this._sw.lat) &&
          Number.isFinite(this._sw.lng) &&
          Number.isFinite(this._ne.lat) &&
          Number.isFinite(this._ne.lng) &&
          this._sw.lat <= this._ne.lat &&
          this._sw.lng <= this._ne.lng
        );
      },
      extend(target) {
        if (!target) return this;
        if (typeof target.getSouthWest === "function" && typeof target.getNorthEast === "function") {
          if (typeof target.isValid === "function" && !target.isValid()) return this;
          this.extend(target.getSouthWest());
          this.extend(target.getNorthEast());
          return this;
        }
        if (Array.isArray(target) && target.length > 0 && (Array.isArray(target[0]) || (typeof target[0] === "object" && target[0] !== null))) {
          target.forEach((item) => this.extend(item));
          return this;
        }
        const pt = toLatLngObj(target);
        if (pt && Number.isFinite(pt.lat) && Number.isFinite(pt.lng)) {
          if (pt.lat < this._sw.lat) this._sw.lat = pt.lat;
          if (pt.lng < this._sw.lng) this._sw.lng = pt.lng;
          if (pt.lat > this._ne.lat) this._ne.lat = pt.lat;
          if (pt.lng > this._ne.lng) this._ne.lng = pt.lng;
        }
        return this;
      },
      pad(bufferRatio = 0) {
        if (!this.isValid()) return makeLatLngBounds();
        const r = Number.isFinite(bufferRatio) ? bufferRatio : 0;
        const hBuffer = Math.max(0.005, (this._ne.lat - this._sw.lat) * r);
        const wBuffer = Math.max(0.005, (this._ne.lng - this._sw.lng) * r);
        return makeLatLngBounds(
          [this._sw.lat - hBuffer, this._sw.lng - wBuffer],
          [this._ne.lat + hBuffer, this._ne.lng + wBuffer]
        );
      },
      getSouthWest() { return { lat: this._sw.lat, lng: this._sw.lng }; },
      getNorthEast() { return { lat: this._ne.lat, lng: this._ne.lng }; },
      getNorthWest() { return { lat: this._ne.lat, lng: this._sw.lng }; },
      getSouthEast() { return { lat: this._sw.lat, lng: this._ne.lng }; },
      getCenter() {
        if (!this.isValid()) return { lat: 23.75, lng: 120.95 };
        return {
          lat: (this._sw.lat + this._ne.lat) / 2,
          lng: (this._sw.lng + this._ne.lng) / 2
        };
      },
      contains(target) {
        if (!this.isValid()) return false;
        const pt = toLatLngObj(target);
        if (!pt) return false;
        return (
          pt.lat >= this._sw.lat &&
          pt.lat <= this._ne.lat &&
          pt.lng >= this._sw.lng &&
          pt.lng <= this._ne.lng
        );
      }
    };
    if (a !== undefined && b !== undefined) {
      bounds.extend(a);
      bounds.extend(b);
    } else if (a !== undefined) {
      bounds.extend(a);
    }
    return bounds;
  };

  const extractGeoJsonBounds = (geojson) => {
    const b = makeLatLngBounds();
    const walkCoords = (coords) => {
      if (!Array.isArray(coords)) return;
      if (coords.length >= 2 && typeof coords[0] === "number" && typeof coords[1] === "number") {
        b.extend([coords[1], coords[0]]);
        return;
      }
      coords.forEach(walkCoords);
    };
    const walkObj = (obj) => {
      if (!obj) return;
      if (obj.type === "FeatureCollection" && Array.isArray(obj.features)) {
        obj.features.forEach(walkObj);
      } else if (obj.type === "Feature" && obj.geometry) {
        walkObj(obj.geometry);
      } else if (obj.coordinates) {
        walkCoords(obj.coordinates);
      }
    };
    walkObj(geojson);
    if (!b.isValid()) {
      return makeLatLngBounds([22, 120], [25, 121]);
    }
    return b;
  };

  const noopLayer = (customBounds = null) => ({
    _bounds: customBounds || makeLatLngBounds([22, 120], [25, 121]),
    addTo() { return this; },
    remove() { return this; },
    clearLayers() { return this; },
    setStyle() { return this; },
    eachLayer(fn) { if (typeof fn === "function") fn(this); return this; },
    on() { return this; },
    bindTooltip() { return this; },
    getBounds() { return this._bounds; }
  });
  window.L = {
    latLngBounds: (a, b) => makeLatLngBounds(a, b),
    canvas: () => ({}),
    svg: () => ({}),
    layerGroup: () => noopLayer(),
    featureGroup: () => noopLayer(),
    tileLayer: () => noopLayer(),
    geoJSON: (feat) => noopLayer(extractGeoJsonBounds(feat)),
    polyline: () => noopLayer(),
    circleMarker: () => noopLayer(),
    marker: (latlng, opts = {}) => {
      let curLatLng = toLatLngObj(latlng) || { lat: 23.75, lng: 120.95 };
      let attachedMap = null;
      return {
        options: opts,
        _latlng: curLatLng,
        addTo(m) {
          attachedMap = m || null;
          if (m && typeof m.addLayer === "function") m.addLayer(this);
          return this;
        },
        remove() {
          if (attachedMap && typeof attachedMap.removeLayer === "function") {
            attachedMap.removeLayer(this);
          }
          attachedMap = null;
          return this;
        },
        getLatLng() { return curLatLng; },
        setLatLng(ll) {
          const parsed = toLatLngObj(ll);
          if (parsed) curLatLng = parsed;
          return this;
        },
        on() { return this; },
        bindTooltip() { return this; }
      };
    },
    divIcon: (opts = {}) => ({ options: opts }),
    DomEvent: { stopPropagation() {} },
    map: (_id, opts = {}) => ({
      _zoom: typeof opts.zoom === "number" ? opts.zoom : 8,
      _minZoom: typeof opts.minZoom === "number" ? opts.minZoom : 7,
      _maxZoom: typeof opts.maxZoom === "number" ? opts.maxZoom : 18,
      _center: Array.isArray(opts.center) ? { lat: opts.center[0], lng: opts.center[1] } : { lat: 23.75, lng: 120.95 },
      _maxBounds: opts.maxBounds || null,
      _layers: new Set(),
      on() { return this; },
      addLayer(l) { this._layers.add(l); return this; },
      removeLayer(l) { this._layers.delete(l); return this; },
      hasLayer(l) { return this._layers.has(l); },
      getSize: () => ({ x: 960, y: 600, divideBy: () => ({ x: 480, y: 300 }) }),
      getCenter() { return this._center; },
      getZoom() { return this._zoom; },
      setZoom(z) { if (Number.isFinite(z)) this._zoom = z; return this; },
      getMinZoom() { return this._minZoom; },
      setMinZoom(z) { if (Number.isFinite(z)) this._minZoom = z; return this; },
      getMaxZoom() { return this._maxZoom; },
      setMaxZoom(z) { if (Number.isFinite(z)) this._maxZoom = z; return this; },
      getMaxBounds() { return this._maxBounds; },
      setMaxBounds(b) { this._maxBounds = b || null; return this; },
      getBounds() { return this._maxBounds || makeLatLngBounds([20.2, 116.5], [27.4, 123.8]); },
      getBoundsZoom(b) {
        if (!b || typeof b.isValid !== "function" || !b.isValid()) return this._zoom || 10;
        const sw = b.getSouthWest();
        const ne = b.getNorthEast();
        const span = Math.max(Math.abs(ne.lat - sw.lat), Math.abs(ne.lng - sw.lng));
        if (span <= 0.12) return 13;
        if (span <= 0.25) return 12;
        if (span <= 0.5) return 11;
        if (span <= 1.0) return 10;
        if (span <= 2.0) return 9;
        return 8;
      },
      getZoomScale: () => 1,
      project: () => ({ x: 480, y: 300 }),
      latLngToContainerPoint: () => ({ x: 480, y: 300 }),
      fitBounds(b, fitOpts = {}) {
        if (b && typeof b.isValid === "function" && b.isValid()) {
          this._center = b.getCenter();
          const maxZ = typeof fitOpts.maxZoom === "number" ? fitOpts.maxZoom : this._maxZoom;
          this._zoom = Math.min(maxZ, this.getBoundsZoom(b));
        }
        return this;
      },
      flyToBounds(b, fitOpts = {}) { return this.fitBounds(b, fitOpts); },
      flyTo(c, z) {
        const pt = toLatLngObj(c);
        if (pt) this._center = pt;
        if (typeof z === "number") this._zoom = z;
        return this;
      },
      panTo(c) {
        const pt = toLatLngObj(c);
        if (pt) this._center = pt;
        return this;
      },
      zoomIn() { this._zoom = Math.min(this._maxZoom, this._zoom + 1); },
      zoomOut() { this._zoom = Math.max(this._minZoom, this._zoom - 1); },
      invalidateSize() {},
      createPane: () => ({ style: {} }),
      getPane: () => ({ style: {} })
    })
  };
}
let map = null;
let canvasRenderer = null;
let activeTileLayers = [];
let railTileLayers = [];
let geoLayerGroup = null;
let countyBorderLayerGroup = null;
let rafMovePending = false;

const TAIWAN_MAX_BOUNDS = L.latLngBounds([20.2, 116.5], [27.4, 123.8]);
const TAIWAN_FULL_VIEW_BOUNDS = L.latLngBounds([21.82, 119.25], [25.38, 122.08]);

const GIS_TILES = {
  terrain_relief: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}",
  terrain_base: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}",
  street_dark_base: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
  satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  satellite_night: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png",
  gis_roads_overlay: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
  gis_railway_overlay: "https://{s}.tiles.openrailwaymap.org/signals/{z}/{x}/{y}.png"
};

function resolveSatelliteQuestionStyle(difficulty = state.difficulty, style = state.satelliteStyle, rng = Math.random) {
  if (style === "night") return "night";
  if (style === "day") return "day";
  if (style === "hybrid") {
    const r = typeof rng === "function" ? rng() : Math.random();
    const nightProb = difficulty === "county_only" ? 0.7 : 0.3;
    return r < nightProb ? "night" : "day";
  }
  return "day";
}

// Unified zoom-responsive typography & POI marker scale (shared by townships, stations, and POIs)
function computeMapZoomScaleMetrics(zoom) {
  const z = Number.isFinite(zoom) ? zoom : 8;
  if (z >= 12) {
    return { labelFontPx: 12.5, poiGlyphPx: 18, poiHaloPx: 25, poiTagOffsetPx: 15, stTipPadYPx: 1.5, stTipPadXPx: 6 };
  }
  if (z >= 11) {
    return { labelFontPx: 11.5, poiGlyphPx: 16, poiHaloPx: 22, poiTagOffsetPx: 13.5, stTipPadYPx: 1, stTipPadXPx: 5.5 };
  }
  if (z >= 10) {
    return { labelFontPx: 10.5, poiGlyphPx: 14, poiHaloPx: 19, poiTagOffsetPx: 12, stTipPadYPx: 1, stTipPadXPx: 5 };
  }
  if (z >= 9) {
    return { labelFontPx: 9.5, poiGlyphPx: 12, poiHaloPx: 16.5, poiTagOffsetPx: 10.5, stTipPadYPx: 0.5, stTipPadXPx: 4.5 };
  }
  if (z >= 8) {
    return { labelFontPx: 8.5, poiGlyphPx: 10.5, poiHaloPx: 14.5, poiTagOffsetPx: 9.5, stTipPadYPx: 0.5, stTipPadXPx: 4 };
  }
  return { labelFontPx: 8, poiGlyphPx: 9.5, poiHaloPx: 13, poiTagOffsetPx: 8.5, stTipPadYPx: 0.5, stTipPadXPx: 3.5 };
}

function applyMapZoomVisualVars(zoom) {
  const host = document.getElementById("map-container") || document.getElementById("leaflet-map");
  if (!host || !host.style) return;
  const m = computeMapZoomScaleMetrics(zoom);
  const key = `${m.labelFontPx}|${m.poiGlyphPx}|${m.poiHaloPx}|${m.poiTagOffsetPx}|${m.stTipPadYPx}|${m.stTipPadXPx}`;
  if (applyMapZoomVisualVars._lastMetricsKey === key) return;
  applyMapZoomVisualVars._lastMetricsKey = key;
  host.style.setProperty("--map-label-size", `${m.labelFontPx}px`);
  host.style.setProperty("--poi-glyph-size", `${m.poiGlyphPx}px`);
  host.style.setProperty("--poi-halo-size", `${m.poiHaloPx}px`);
  host.style.setProperty("--poi-tag-offset", `${m.poiTagOffsetPx}px`);
  host.style.setProperty("--st-tip-pad-y", `${m.stTipPadYPx}px`);
  host.style.setProperty("--st-tip-pad-x", `${m.stTipPadXPx}px`);
}

function initMap() {
  // Use HTML5 Canvas Renderer instead of 368 separate SVG DOM nodes for 60FPS performance!
  canvasRenderer = L.canvas({ padding: 0.4 });

  map = L.map("leaflet-map", {
    center: [23.75, 120.95],
    zoom: 8,
    minZoom: 7,
    maxZoom: 18,
    maxBounds: TAIWAN_MAX_BOUNDS,
    maxBoundsViscosity: 0.9,
    preferCanvas: true,
    renderer: canvasRenderer,
    zoomControl: false,
    attributionControl: true
  });

  applyMapZoomVisualVars(map.getZoom());
  geoLayerGroup = L.layerGroup().addTo(map);
  countyBorderLayerGroup = L.layerGroup().addTo(map);

  updateRoadAndRailwayTileOverlays();
  loadRealTaiwanTopoJSON();

  const svgEl = document.getElementById("leader-overlay-svg");
  const domEl = document.getElementById("labels-overlay-dom");
  let isCssZoomAnimActive = false;

  // Apply exact sub-pixel Web Mercator affine transform (translate3d + scale) on GPU during zoom & pan!
  function applyOverlayAffineTransform(targetCenter, targetZoom, useCssTransition) {
    if (!svgEl || !domEl || !lastRenderCenter || lastRenderZoom === null) return;
    const half = map.getSize().divideBy(2);
    const scale = map.getZoomScale(targetZoom, lastRenderZoom);
    const cOld = map.project(lastRenderCenter, lastRenderZoom);
    const cNew = map.project(targetCenter, targetZoom);
    const tx = scale * (cOld.x - half.x) - cNew.x + half.x;
    const ty = scale * (cOld.y - half.y) - cNew.y + half.y;

    const transCss = useCssTransition
      ? "transform 0.25s cubic-bezier(0, 0, 0.25, 1)"
      : "none";
    const xformCss = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${scale.toFixed(5)})`;

    svgEl.style.transition = transCss;
    domEl.style.transition = transCss;
    svgEl.style.transform = xformCss;
    domEl.style.transform = xformCss;
  }

  map.on("movestart zoomstart", () => {
    if (state.dragSyncMode === "hide_on_move") {
      if (svgEl) svgEl.classList.add("overlay-moving-hidden");
      if (domEl) domEl.classList.add("overlay-moving-hidden");
    }
  });

  // Leaflet wheel / button / double-click CSS3D zoom animation hook (0.25s cubic-bezier(0,0,0.25,1))
  map.on("zoomanim", (ev) => {
    if (state.dragSyncMode === "hide_on_move") return;
    isCssZoomAnimActive = true;
    applyOverlayAffineTransform(ev.center, ev.zoom, true);
  });

  // Continuous pan / pinch-zoom / flyTo frame-by-frame hook
  map.on("move zoom", () => {
    if (state.dragSyncMode === "hide_on_move") return;
    if (isCssZoomAnimActive) return; // Let CSS transition handle standard zoomanim smoothly
    applyOverlayAffineTransform(map.getCenter(), map.getZoom(), false);
  });

  map.on("moveend zoomend", () => {
    isCssZoomAnimActive = false;
    if (svgEl) svgEl.classList.remove("overlay-moving-hidden");
    if (domEl) domEl.classList.remove("overlay-moving-hidden");
    applyMapZoomVisualVars(map.getZoom());
    updateTransportZoomClass();
    if (typeof syncPoiViewportMarkers === "function") syncPoiViewportMarkers(false);
    renderSmartLabelsAndLeaderLines();
  });

  map.on("click", (ev) => {
    if (state.playMode === "pin_drop" && typeof handlePinDropMapClick === "function" && ev && ev.latlng) {
      handlePinDropMapClick(ev.latlng);
    }
  });

  // Mobile Virtual Keyboard Detection & Dynamic Full-Bleed Viewport Controller
  // Automatically detects when mobile virtual keyboard pops up via visualViewport API:
  // - When keyboard is OPEN: hides the reservable bottom status strip, shrinks #map-container to fit 100% between header and input dock right above the keyboard, and locks scroll at top so map & buttons never drift off-screen!
  // - When keyboard is CLOSED: restores full-screen 100% map + input dock height!
  let maxMobileUnkeyboardedH = window.innerHeight;
  let lastOrientationWidth = window.innerWidth;
  let kbSyncRaf = null;
  let wasMobileKbOpen = false;
  let kbSettleTimers = [];

  function refreshMapViewportAndOverlays() {
    if (!map) return;
    map.invalidateSize({ pan: false, animate: false });
    if (canvasRenderer && typeof canvasRenderer._update === "function") {
      try { canvasRenderer._update(); } catch (_) {}
    }
    renderSmartLabelsAndLeaderLines();
  }

  function scheduleKbSettleResync() {
    kbSettleTimers.forEach((id) => clearTimeout(id));
    kbSettleTimers = [120, 360].map((ms) =>
      setTimeout(() => {
        syncMobileKeyboardViewport(false);
      }, ms)
    );
  }

  function syncMobileKeyboardViewport(allowScheduleSettle = true) {
    if (kbSyncRaf) cancelAnimationFrame(kbSyncRaf);
    kbSyncRaf = requestAnimationFrame(() => {
      const mapContainerEl = document.getElementById("map-container");
      const headerEl = document.querySelector("header");
      const dockEl = document.getElementById("input-dock-card");
      const mainStageEl = document.querySelector("main");
      if (!mapContainerEl || !headerEl || !dockEl) return;

      // Desktop / Tablet (>= 640px): clear mobile inline height overrides
      if (window.innerWidth >= 640) {
        wasMobileKbOpen = false;
        document.body.classList.remove("mobile-kb-open");
        mapContainerEl.style.height = "";
        if (mainStageEl) mainStageEl.style.transform = "";
        refreshMapViewportAndOverlays();
        return;
      }

      if (Math.abs(window.innerWidth - lastOrientationWidth) > 60) {
        lastOrientationWidth = window.innerWidth;
        maxMobileUnkeyboardedH = window.innerHeight;
      }

      const vv = window.visualViewport;
      const vHeight = vv ? vv.height : window.innerHeight;
      const vOffsetTop = vv ? vv.offsetTop : 0;

      if (vHeight > maxMobileUnkeyboardedH) {
        maxMobileUnkeyboardedH = vHeight;
      }

      const activeEl = document.activeElement;
      const isDockInputFocused =
        activeEl &&
        dockEl.contains(activeEl) &&
        (activeEl.tagName === "INPUT" || activeEl.tagName === "SELECT");

      const heightDrop = maxMobileUnkeyboardedH - vHeight;
      const isKbOpen = heightDrop > 105 || (isDockInputFocused && vHeight < maxMobileUnkeyboardedH * 0.78);

      document.documentElement.style.setProperty("--vvh", `${Math.round(vHeight)}px`);
      document.body.classList.toggle("mobile-kb-open", isKbOpen);

      // Measure actual header & dock height after class toggle and set exact remaining map height
      const headerH = headerEl.offsetHeight || 44;
      const dockH = dockEl.offsetHeight || 78;
      const minMapH = isKbOpen ? 150 : 320;
      const targetMapH = Math.max(minMapH, Math.floor(vHeight - headerH - dockH));
      mapContainerEl.style.height = `${targetMapH}px`;

      if (isKbOpen || isDockInputFocused) {
        if (window.scrollY > 0) {
          window.scrollTo(0, 0);
        }
        if (mainStageEl) {
          mainStageEl.style.transform = vOffsetTop > 1 ? `translateY(${Math.round(vOffsetTop)}px)` : "";
        }
      } else {
        if (wasMobileKbOpen && window.scrollY > 0) {
          window.scrollTo(0, 0);
        }
        if (mainStageEl) {
          mainStageEl.style.transform = "";
        }
      }

      // Force synchronous layout flush before Leaflet reads container size
      void mapContainerEl.offsetHeight;
      refreshMapViewportAndOverlays();

      const kbJustClosed = wasMobileKbOpen && !isKbOpen;
      wasMobileKbOpen = isKbOpen;
      if (kbJustClosed && allowScheduleSettle) {
        scheduleKbSettleResync();
      }
    });
  }

  // Observe real container size changes (handles Android back-button keyboard close without blur)
  const mapContainerForObs = document.getElementById("map-container");
  if (mapContainerForObs && typeof ResizeObserver !== "undefined") {
    let obsRaf = null;
    const mapResizeObserver = new ResizeObserver(() => {
      if (obsRaf) cancelAnimationFrame(obsRaf);
      obsRaf = requestAnimationFrame(refreshMapViewportAndOverlays);
    });
    mapResizeObserver.observe(mapContainerForObs);
  }

  window.addEventListener("resize", syncMobileKeyboardViewport);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncMobileKeyboardViewport);
    window.visualViewport.addEventListener("scroll", syncMobileKeyboardViewport);
  }

  const dockInputs = [
    document.getElementById("answer-input"),
    document.getElementById("suffix-input"),
    document.getElementById("prefix-select")
  ];
  dockInputs.forEach((inp) => {
    if (!inp) return;
    inp.addEventListener("focus", () => {
      syncMobileKeyboardViewport();
      setTimeout(syncMobileKeyboardViewport, 120);
      setTimeout(syncMobileKeyboardViewport, 300);
    });
    inp.addEventListener("blur", () => {
      setTimeout(syncMobileKeyboardViewport, 100);
      setTimeout(syncMobileKeyboardViewport, 280);
    });
  });

  // Initial first-screen full-bleed sizing on mobile
  setTimeout(syncMobileKeyboardViewport, 60);
}

function resetToFullTaiwanView() {
  if (!map) return;
  if (state.satelliteViewportLocked && state.role !== "spectator") {
    if (typeof setFeedback === "function") {
      setFeedback("🔒 衛星視野鎖定中，無法拉遠檢視全台灣！", "warn");
    }
    return;
  }
  map.flyToBounds(TAIWAN_FULL_VIEW_BOUNDS, { padding: [20, 20], duration: 0.55 });
}

function zoomToCountyCenter(countyName) {
  const c = COUNTY_BY_NAME[countyName];
  if (!c || !map) return;
  const targetB = (c.mainBounds && typeof c.mainBounds.isValid === "function" && c.mainBounds.isValid())
    ? c.mainBounds
    : c.bounds;
  if (targetB && targetB.isValid()) {
    map.flyToBounds(targetB, { padding: [45, 45], maxZoom: 12, duration: 0.55 });
  } else {
    map.flyTo([c.lat, c.lng], 11, { duration: 0.55 });
  }
}

function computeMainPolygonBounds(geojsonFeature, options = {}) {
  const distThresholdDeg = typeof options.distThresholdDeg === "number" ? options.distThresholdDeg : 0.35;
  const geom = geojsonFeature && geojsonFeature.type === "Feature" ? geojsonFeature.geometry : geojsonFeature;
  if (!geom || !geom.coordinates) return L.latLngBounds();

  const outerRings = [];
  if (geom.type === "Polygon" && Array.isArray(geom.coordinates[0])) {
    outerRings.push(geom.coordinates[0]);
  } else if (geom.type === "MultiPolygon" && Array.isArray(geom.coordinates)) {
    geom.coordinates.forEach((poly) => {
      if (Array.isArray(poly) && Array.isArray(poly[0])) {
        outerRings.push(poly[0]);
      }
    });
  }
  if (outerRings.length === 0) return L.latLngBounds();

  const ringInfos = [];
  outerRings.forEach((ring) => {
    if (!Array.isArray(ring) || ring.length === 0) return;
    let area2 = 0;
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;
    for (let i = 0; i < ring.length; i++) {
      const pt = ring[i];
      if (!Array.isArray(pt) || pt.length < 2) continue;
      const lng = Number(pt[0]);
      const lat = Number(pt[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      const next = ring[(i + 1) % ring.length];
      if (Array.isArray(next) && next.length >= 2) {
        const nLng = Number(next[0]);
        const nLat = Number(next[1]);
        if (Number.isFinite(nLng) && Number.isFinite(nLat)) {
          area2 += lng * nLat - nLng * lat;
        }
      }
    }
    if (!Number.isFinite(minLat) || !Number.isFinite(minLng)) return;
    ringInfos.push({
      area: 0.5 * Math.abs(area2),
      minLat,
      maxLat,
      minLng,
      maxLng,
      centerLat: (minLat + maxLat) / 2,
      centerLng: (minLng + maxLng) / 2
    });
  });

  if (ringInfos.length === 0) return L.latLngBounds();

  let mainRing = ringInfos[0];
  for (let i = 1; i < ringInfos.length; i++) {
    if (ringInfos[i].area > mainRing.area) {
      mainRing = ringInfos[i];
    }
  }

  let outMinLat = mainRing.minLat;
  let outMaxLat = mainRing.maxLat;
  let outMinLng = mainRing.minLng;
  let outMaxLng = mainRing.maxLng;

  ringInfos.forEach((info) => {
    const dist = Math.hypot(info.centerLat - mainRing.centerLat, info.centerLng - mainRing.centerLng);
    if (dist <= distThresholdDeg) {
      if (info.minLat < outMinLat) outMinLat = info.minLat;
      if (info.maxLat > outMaxLat) outMaxLat = info.maxLat;
      if (info.minLng < outMinLng) outMinLng = info.minLng;
      if (info.maxLng > outMaxLng) outMaxLng = info.maxLng;
    }
  });

  return L.latLngBounds([outMinLat, outMinLng], [outMaxLat, outMaxLng]);
}

function computeCountyMainBounds(countyName, townList = null, options = {}) {
  const distThresholdDeg = typeof options.distThresholdDeg === "number" ? options.distThresholdDeg : 0.45;
  const isPureIslandCounty = countyName === "澎湖縣" || countyName === "金門縣" || countyName === "連江縣";
  const allCountyTowns = Array.isArray(townList)
    ? townList
    : ALL_TOWNS.filter((t) => t.countyName === countyName);

  const townsWithBounds = allCountyTowns.filter((t) => {
    const b = (t.mainBounds && typeof t.mainBounds.isValid === "function" && t.mainBounds.isValid())
      ? t.mainBounds
      : t.bounds;
    return Boolean(b && typeof b.isValid === "function" && b.isValid());
  });
  if (townsWithBounds.length === 0) return null;

  let candidates = townsWithBounds;
  if (!isPureIslandCounty && typeof TAIWAN_MAINLAND_OFFSHORE_SET !== "undefined") {
    const mainlandOnly = townsWithBounds.filter((t) => !TAIWAN_MAINLAND_OFFSHORE_SET.has(t.fullCountyTown));
    if (mainlandOnly.length > 0) {
      candidates = mainlandOnly;
    }
  }

  const items = candidates.map((t) => {
    const b = (t.mainBounds && typeof t.mainBounds.isValid === "function" && t.mainBounds.isValid())
      ? t.mainBounds
      : t.bounds;
    const sw = b.getSouthWest();
    const ne = b.getNorthEast();
    const area = Math.max(1e-9, Math.abs(ne.lat - sw.lat) * Math.abs(ne.lng - sw.lng));
    return {
      town: t,
      bounds: b,
      centerLat: (sw.lat + ne.lat) / 2,
      centerLng: (sw.lng + ne.lng) / 2,
      area
    };
  });

  let primary = items[0];
  for (let i = 1; i < items.length; i++) {
    if (items[i].area > primary.area) {
      primary = items[i];
    }
  }

  // Connected cluster BFS from primary town using distThresholdDeg (0.45 deg)
  const kept = [primary];
  const visited = new Set([primary]);
  let idx = 0;
  while (idx < kept.length) {
    const cur = kept[idx++];
    for (let i = 0; i < items.length; i++) {
      const other = items[i];
      if (visited.has(other)) continue;
      const dist = Math.hypot(other.centerLat - cur.centerLat, other.centerLng - cur.centerLng);
      if (dist <= distThresholdDeg) {
        visited.add(other);
        kept.push(other);
      }
    }
  }

  const outBounds = L.latLngBounds(
    kept[0].bounds.getSouthWest(),
    kept[0].bounds.getNorthEast()
  );
  for (let i = 1; i < kept.length; i++) {
    outBounds.extend(kept[i].bounds);
  }
  return outBounds;
}

function isPointInRing(lng, lat, ring) {
  if (!Array.isArray(ring) || ring.length < 3 || !Number.isFinite(lng) || !Number.isFinite(lat)) {
    return false;
  }
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const pi = ring[i];
    const pj = ring[j];
    if (!Array.isArray(pi) || !Array.isArray(pj) || pi.length < 2 || pj.length < 2) continue;
    const xi = Number(pi[0]);
    const yi = Number(pi[1]);
    const xj = Number(pj[0]);
    const yj = Number(pj[1]);
    if (!Number.isFinite(xi) || !Number.isFinite(yi) || !Number.isFinite(xj) || !Number.isFinite(yj)) continue;
    const intersects = ((yi > lat) !== (yj > lat)) &&
      (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function computeMainPolygonPoint(geojsonFeature, _options = {}) {
  const geom = geojsonFeature && geojsonFeature.type === "Feature" ? geojsonFeature.geometry : geojsonFeature;
  if (!geom || !geom.coordinates) return null;

  const outerRings = [];
  if (geom.type === "Polygon" && Array.isArray(geom.coordinates[0])) {
    outerRings.push(geom.coordinates[0]);
  } else if (geom.type === "MultiPolygon" && Array.isArray(geom.coordinates)) {
    geom.coordinates.forEach((poly) => {
      if (Array.isArray(poly) && Array.isArray(poly[0])) {
        outerRings.push(poly[0]);
      }
    });
  }
  if (outerRings.length === 0) return null;

  let mainRingInfo = null;
  outerRings.forEach((ring) => {
    if (!Array.isArray(ring) || ring.length < 3) return;
    let area2 = 0;
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;
    for (let i = 0; i < ring.length; i++) {
      const pt = ring[i];
      if (!Array.isArray(pt) || pt.length < 2) continue;
      const lng = Number(pt[0]);
      const lat = Number(pt[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      const next = ring[(i + 1) % ring.length];
      if (Array.isArray(next) && next.length >= 2) {
        const nLng = Number(next[0]);
        const nLat = Number(next[1]);
        if (Number.isFinite(nLng) && Number.isFinite(nLat)) {
          area2 += lng * nLat - nLng * lat;
        }
      }
    }
    if (!Number.isFinite(minLat) || !Number.isFinite(minLng)) return;
    const area = 0.5 * Math.abs(area2);
    if (!mainRingInfo || area > mainRingInfo.area) {
      mainRingInfo = { ring, area, minLat, maxLat, minLng, maxLng };
    }
  });

  if (!mainRingInfo) return null;
  const { ring, minLat, maxLat, minLng, maxLng } = mainRingInfo;
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  if (isPointInRing(centerLng, centerLat, ring)) {
    return { lat: centerLat, lng: centerLng };
  }

  const latSpan = maxLat - minLat;
  if (latSpan > 1e-9) {
    const scanRatios = [0.5, 0.35, 0.65, 0.2, 0.8];
    for (let rIdx = 0; rIdx < scanRatios.length; rIdx++) {
      const scanLat = minLat + latSpan * scanRatios[rIdx];
      const xs = [];
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const pi = ring[i];
        const pj = ring[j];
        if (!Array.isArray(pi) || !Array.isArray(pj) || pi.length < 2 || pj.length < 2) continue;
        const xi = Number(pi[0]);
        const yi = Number(pi[1]);
        const xj = Number(pj[0]);
        const yj = Number(pj[1]);
        if (!Number.isFinite(xi) || !Number.isFinite(yi) || !Number.isFinite(xj) || !Number.isFinite(yj)) continue;
        if ((yi > scanLat) !== (yj > scanLat)) {
          const xInt = xi + ((scanLat - yi) * (xj - xi)) / (yj - yi);
          if (Number.isFinite(xInt)) xs.push(xInt);
        }
      }
      xs.sort((a, b) => a - b);
      let bestMidLng = null;
      let bestSegLen = -1;
      for (let k = 0; k + 1 < xs.length; k++) {
        const segLen = xs[k + 1] - xs[k];
        if (segLen <= 1e-9) continue;
        const midLng = (xs[k] + xs[k + 1]) / 2;
        if (segLen > bestSegLen && isPointInRing(midLng, scanLat, ring)) {
          bestSegLen = segLen;
          bestMidLng = midLng;
        }
      }
      if (bestMidLng !== null) {
        return { lat: scanLat, lng: bestMidLng };
      }
    }
  }

  return { lat: centerLat, lng: centerLng };
}

function computeCountyMainPoint(countyName, townList = null) {
  const isPureIslandCounty = countyName === "澎湖縣" || countyName === "金門縣" || countyName === "連江縣";
  const allCountyTowns = Array.isArray(townList)
    ? townList
    : ALL_TOWNS.filter((t) => t.countyName === countyName);

  const townsWithGeo = allCountyTowns.filter((t) => {
    if (t.mainPoint && Number.isFinite(t.mainPoint.lat) && Number.isFinite(t.mainPoint.lng)) return true;
    const b = (t.mainBounds && typeof t.mainBounds.isValid === "function" && t.mainBounds.isValid())
      ? t.mainBounds
      : t.bounds;
    return Boolean(b && typeof b.isValid === "function" && b.isValid());
  });

  if (townsWithGeo.length === 0) {
    const cObj = typeof COUNTY_BY_NAME !== "undefined" ? COUNTY_BY_NAME[countyName] : null;
    if (cObj && Number.isFinite(cObj.lat) && Number.isFinite(cObj.lng)) {
      return { lat: cObj.lat, lng: cObj.lng };
    }
    return null;
  }

  let candidates = townsWithGeo;
  if (!isPureIslandCounty && typeof TAIWAN_MAINLAND_OFFSHORE_SET !== "undefined") {
    const mainlandOnly = townsWithGeo.filter((t) => !TAIWAN_MAINLAND_OFFSHORE_SET.has(t.fullCountyTown));
    if (mainlandOnly.length > 0) {
      candidates = mainlandOnly;
    }
  }

  const cObj = typeof COUNTY_BY_NAME !== "undefined" ? COUNTY_BY_NAME[countyName] : null;
  const cBounds = (cObj && cObj.mainBounds && typeof cObj.mainBounds.isValid === "function" && cObj.mainBounds.isValid())
    ? cObj.mainBounds
    : computeCountyMainBounds(countyName, candidates);
  const targetCenter = (cBounds && typeof cBounds.getCenter === "function")
    ? cBounds.getCenter()
    : { lat: cObj?.lat || 23.75, lng: cObj?.lng || 120.95 };

  let bestPt = null;
  let bestDist = Infinity;
  candidates.forEach((t) => {
    let pt = null;
    if (t.mainPoint && Number.isFinite(t.mainPoint.lat) && Number.isFinite(t.mainPoint.lng)) {
      pt = t.mainPoint;
    } else if (t.mainBounds && typeof t.mainBounds.isValid === "function" && t.mainBounds.isValid()) {
      pt = t.mainBounds.getCenter();
    } else if (t.bounds && typeof t.bounds.isValid === "function" && t.bounds.isValid()) {
      pt = t.bounds.getCenter();
    } else if (Number.isFinite(t.lat) && Number.isFinite(t.lng)) {
      pt = { lat: t.lat, lng: t.lng };
    }
    if (!pt || !Number.isFinite(pt.lat) || !Number.isFinite(pt.lng)) return;
    const d = Math.hypot(pt.lat - targetCenter.lat, pt.lng - targetCenter.lng);
    if (d < bestDist) {
      bestDist = d;
      bestPt = { lat: pt.lat, lng: pt.lng };
    }
  });

  return bestPt || { lat: targetCenter.lat, lng: targetCenter.lng };
}

let satelliteTargetMarker = null;

function getSatelliteTargetMarker() {
  return satelliteTargetMarker;
}

function clearSatelliteTargetMarker() {
  if (satelliteTargetMarker) {
    if (typeof satelliteTargetMarker.remove === "function") {
      satelliteTargetMarker.remove();
    } else if (map && typeof map.removeLayer === "function") {
      map.removeLayer(satelliteTargetMarker);
    }
    satelliteTargetMarker = null;
  }
  state.satelliteTargetPoint = null;
}

function updateSatelliteTargetMarker(pickObj) {
  clearSatelliteTargetMarker();
  if (!pickObj || !map || typeof L === "undefined" || typeof L.marker !== "function" || typeof L.divIcon !== "function") {
    return null;
  }

  let pt = null;
  if (pickObj.mainPoint && Number.isFinite(pickObj.mainPoint.lat) && Number.isFinite(pickObj.mainPoint.lng)) {
    pt = { lat: pickObj.mainPoint.lat, lng: pickObj.mainPoint.lng };
  } else if (state.difficulty === "county_only" && pickObj.name) {
    pt = computeCountyMainPoint(pickObj.name);
  }
  if (!pt && pickObj.mainBounds && typeof pickObj.mainBounds.isValid === "function" && pickObj.mainBounds.isValid()) {
    pt = pickObj.mainBounds.getCenter();
  }
  if (!pt && pickObj.bounds && typeof pickObj.bounds.isValid === "function" && pickObj.bounds.isValid()) {
    pt = pickObj.bounds.getCenter();
  }
  if (!pt && Number.isFinite(pickObj.lat) && Number.isFinite(pickObj.lng)) {
    pt = { lat: Number(pickObj.lat), lng: Number(pickObj.lng) };
  }
  if (!pt || !Number.isFinite(pt.lat) || !Number.isFinite(pt.lng)) {
    return null;
  }

  state.satelliteTargetPoint = { lat: pt.lat, lng: pt.lng };

  const pinEl = document.createElement("div");
  pinEl.className = "satellite-target-pin";
  const pulseEl = document.createElement("span");
  pulseEl.className = "satellite-target-pin-pulse";
  const coreEl = document.createElement("span");
  coreEl.className = "satellite-target-pin-core";
  coreEl.textContent = "?";
  pinEl.appendChild(pulseEl);
  pinEl.appendChild(coreEl);

  const icon = L.divIcon({
    className: "satellite-target-pin-wrapper",
    html: pinEl,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });

  satelliteTargetMarker = L.marker([pt.lat, pt.lng], {
    icon,
    interactive: false,
    keyboard: false,
    zIndexOffset: 900
  }).addTo(map);

  return satelliteTargetMarker;
}

function lockMapViewportToBounds(bounds, options = {}) {
  if (state.role === "spectator") {
    state.satelliteViewportLocked = false;
    return false;
  }
  if (!state.satelliteLockViewport && !options.force) {
    state.satelliteViewportLocked = false;
    return false;
  }
  if (!map || !bounds || (typeof bounds.isValid === "function" && !bounds.isValid())) {
    return false;
  }

  const padRatio = typeof options.padRatio === "number" ? options.padRatio : 0.22;
  const padded = typeof bounds.pad === "function" ? bounds.pad(padRatio) : bounds;
  if (typeof map.setMaxBounds === "function") {
    map.setMaxBounds(padded);
  }

  const maxFitZoom = typeof options.maxFitZoom === "number"
    ? options.maxFitZoom
    : (state.difficulty === "county_only" ? 10 : 12);
  let fittedZoom = typeof map.getZoom === "function" && Number.isFinite(map.getZoom())
    ? Math.floor(map.getZoom())
    : 10;
  if (typeof options.maxFitZoom !== "number" && typeof map.getBoundsZoom === "function") {
    try {
      const padPt = typeof L !== "undefined" && typeof L.point === "function" ? L.point(32, 32) : [32, 32];
      const bz = map.getBoundsZoom(padded, false, padPt);
      if (Number.isFinite(bz) && bz > 0) {
        fittedZoom = Math.min(maxFitZoom, Math.floor(bz));
      }
    } catch (_) {}
  }
  const minCap = state.difficulty === "county_only" ? 11 : 12;
  const computedMinZoom = Math.max(8, Math.min(minCap, fittedZoom));
  const targetMinZoom = typeof options.minZoom === "number" ? options.minZoom : computedMinZoom;
  if (typeof map.setMinZoom === "function") {
    map.setMinZoom(targetMinZoom);
  }

  const maxCap = state.difficulty === "county_only" ? 12 : 13;
  const computedMaxZoom = Math.max(targetMinZoom + 1, Math.min(maxCap, targetMinZoom + 1));
  const targetMaxZoom = typeof options.maxZoom === "number" ? options.maxZoom : computedMaxZoom;
  if (typeof map.setMaxZoom === "function") {
    map.setMaxZoom(targetMaxZoom);
  }

  state.satelliteViewportLocked = true;
  return true;
}

function unlockMapViewportToTaiwan(options = {}) {
  const restoreLayers = options.restoreLayers !== false;
  if (map) {
    if (typeof map.setMaxBounds === "function") {
      map.setMaxBounds(TAIWAN_MAX_BOUNDS);
    }
    if (typeof map.setMinZoom === "function") {
      map.setMinZoom(7);
    }
    if (typeof map.setMaxZoom === "function") {
      map.setMaxZoom(18);
    }
  }
  state.satelliteViewportLocked = false;
  if (restoreLayers || options.clearMarker === true) {
    clearSatelliteTargetMarker();
  }

  if (restoreLayers) {
    if (state.satelliteSavedBaseLayer) {
      const prevLayer = state.satelliteSavedBaseLayer;
      state.satelliteSavedBaseLayer = null;
      setMapBaseLayer(prevLayer, true);
    }
    if (state.satelliteSavedDistrictBorders !== null) {
      const prevBorders = Boolean(state.satelliteSavedDistrictBorders);
      state.satelliteSavedDistrictBorders = null;
      if (typeof window.setDistrictBordersVisible === "function") {
        window.setDistrictBordersVisible(prevBorders, true);
      } else {
        state.showDistrictBorders = prevBorders;
        if (countyBorderLayerGroup && map) {
          if (prevBorders) {
            if (!map.hasLayer(countyBorderLayerGroup)) countyBorderLayerGroup.addTo(map);
          } else if (map.hasLayer(countyBorderLayerGroup)) {
            map.removeLayer(countyBorderLayerGroup);
          }
        }
        refreshAllPolygonStyles();
      }
    }
  }
  return true;
}

// =========================================================================
// 4A-2. BASE LAYERS, TOPOJSON LOADER & POLYGON RENDERING
// =========================================================================
function setMapBaseLayer(layerKey, forceBypassLock = false) {
  if (
    !forceBypassLock &&
    state.playMode === "pin_drop" &&
    !["vector", "terrain", "satellite"].includes(layerKey)
  ) {
    if (typeof setFeedback === "function") {
      setFeedback("📍 標座標模式僅支援無字底圖（純淨向量、無字地形或無字衛星）！", "warn");
    }
    return;
  }
  if (
    !forceBypassLock &&
    state.playMode === "pin_drop" &&
    state.pinDropLockBaseLayer &&
    layerKey !== (state.pinDropBaseLayer || "satellite")
  ) {
    if (typeof setFeedback === "function") {
      const layerNames = { satellite: "無字衛星影像", terrain: "無字山地地形", vector: "純淨向量底圖" };
      const lockedName = layerNames[state.pinDropBaseLayer || "satellite"] || state.pinDropBaseLayer;
      setFeedback(`🔒 標座標模式已強制鎖定使用「${lockedName}」，無法自由切換！`, "warn");
    }
    return;
  }
  if (
    !forceBypassLock &&
    state.playMode === "satellite_quiz" &&
    !state.isGameOver &&
    state.role !== "spectator" &&
    !["satellite", "satellite_night", "satellite_hybrid"].includes(layerKey)
  ) {
    if (typeof setFeedback === "function") {
      setFeedback("🛰️ 衛星影像猜題中已鎖定衛星圖層，退出或結束後將自動恢復！", "warn");
    }
    return;
  }
  if (state.p2pLayerRule === "locked" && !forceBypassLock && state.role !== "spectator") {
    setFeedback(`🔒 本場對戰已鎖定使用「${state.p2pForcedLayer}」圖層，無法自由切換！`, "warn");
    return;
  }

  state.mapLayer = layerKey;
  if (
    state.playMode === "pin_drop" &&
    ["vector", "terrain", "satellite"].includes(layerKey) &&
    (!state.pinDropLockBaseLayer || forceBypassLock)
  ) {
    state.pinDropBaseLayer = layerKey;
    if (typeof syncConfigButtonsUI === "function") {
      syncConfigButtonsUI();
    }
  }
  activeTileLayers.forEach((tl) => map.removeLayer(tl));
  activeTileLayers = [];

  const mapEl = document.getElementById("leaflet-map");
  mapEl.classList.remove("basemap-no-spoiler", "basemap-dark-canvas");

  if (layerKey === "terrain") {
    const tBase = L.tileLayer(GIS_TILES.terrain_base, {
      maxZoom: 13,
      opacity: 0.78,
      attribution: "Terrain &copy; Esri (No-Label Base)"
    }).addTo(map);
    const tRelief = L.tileLayer(GIS_TILES.terrain_relief, {
      maxZoom: 13,
      opacity: 0.52,
      attribution: "Shaded Relief &copy; Esri"
    }).addTo(map);
    activeTileLayers.push(tBase, tRelief);
    mapEl.classList.add("basemap-no-spoiler");
  } else if (
    layerKey === "satellite_night" ||
    (layerKey === "satellite_hybrid" && state.satelliteActiveQuestionStyle === "night")
  ) {
    const satDarkBase = L.tileLayer(GIS_TILES.satellite, {
      maxZoom: 18,
      opacity: 1,
      className: "satellite-night-dark-base",
      attribution: "Imagery &copy; Esri"
    }).addTo(map);
    const satNight = L.tileLayer(GIS_TILES.satellite_night, {
      maxNativeZoom: 8,
      maxZoom: 15,
      opacity: 0.95,
      className: "satellite-night-lights-overlay",
      attribution: "Night Lights &copy; NASA GIBS VIIRS Black Marble"
    }).addTo(map);
    activeTileLayers.push(satDarkBase, satNight);
    mapEl.classList.add("basemap-no-spoiler");
  } else if (layerKey === "satellite" || layerKey === "satellite_hybrid") {
    const sat = L.tileLayer(GIS_TILES.satellite, {
      maxZoom: 18,
      opacity: 0.82,
      attribution: "Imagery &copy; Esri"
    }).addTo(map);
    activeTileLayers.push(sat);
    mapEl.classList.add("basemap-no-spoiler");
  }

  updateRoadAndRailwayTileOverlays();

  document.querySelectorAll(".layer-btn").forEach((btn) => {
    if (btn.classList.contains("hidden")) return;
    const btnLayer = btn.getAttribute("data-layer");
    const isCurrent =
      btnLayer === layerKey ||
      (btnLayer === "satellite" && (layerKey === "satellite_night" || layerKey === "satellite_hybrid"));
    btn.className = isCurrent
      ? "layer-btn px-2 sm:px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-semibold transition bg-sky-500 text-white shadow whitespace-nowrap"
      : "layer-btn px-2 sm:px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-semibold transition text-slate-300 hover:text-white whitespace-nowrap";
  });

  refreshAllPolygonStyles();
}

async function loadRealTaiwanTopoJSON() {
  const urls = [
    "https://cdn.jsdelivr.net/npm/taiwan-atlas@2021.9.20/towns-10t.json",
    "https://cdn.jsdelivr.net/npm/taiwan-atlas/towns-10t.json",
    "https://unpkg.com/taiwan-atlas@2021.9.20/towns-10t.json",
    "https://unpkg.com/taiwan-atlas/towns-10t.json"
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const topo = await res.json();
      if (topo && topo.objects && topo.objects.towns) {
        const townsGeo = topojson.feature(topo, topo.objects.towns);
        const countiesGeo = topo.objects.counties
          ? topojson.feature(topo, topo.objects.counties)
          : null;
        rebuildMapLayers({ townsGeo, countiesGeo });
        const badge = document.getElementById("geo-data-badge");
        if (badge) {
          badge.className = "text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1";
          const spans = badge.querySelectorAll("span"); if (spans[0]) spans[0].className = "w-1.5 h-1.5 rounded-full bg-emerald-400"; if (spans[1]) spans[1].textContent = "368 鄉鎮真實邊界就緒";
        }
        const loader = document.getElementById("map-loading-overlay");
        if (loader) loader.classList.add("hidden");
        return;
      }
    } catch (err) {}
  }

  try {
    const features = [];
    await Promise.all(
      TAIWAN_ADMIN_DATA.map(async (c) => {
        try {
          const r = await fetch(`https://taiwan.md/assets/geo/taiwan-towns-${c.code}.topo.json`);
          if (!r.ok) return;
          const t = await r.json();
          const objKey = Object.keys(t.objects)[0];
          if (objKey) {
            const geo = topojson.feature(t, t.objects[objKey]);
            geo.features.forEach((f) => {
              f.properties = f.properties || {};
              if (!f.properties.COUNTYNAME) f.properties.COUNTYNAME = c.name;
              features.push(f);
            });
          }
        } catch (e) {}
      })
    );
    if (features.length > 0) {
      rebuildMapLayers({ townsGeo: { type: "FeatureCollection", features }, countiesGeo: null });
    }
  } catch (e) {}
  const loader = document.getElementById("map-loading-overlay");
  if (loader) loader.classList.add("hidden");
}

function matchFeatureToTownObj(props) {
  const rawC = props.COUNTYNAME || props.county || props.COUNTY || "";
  const rawT = props.TOWNNAME || props.name || props.TOWN || "";
  const rawCode = String(props.TOWNCODE || props.COUNTYCODE || "");

  let cName = normTw(rawC);
  let tName = normTw(rawT);

  let found = ALL_TOWNS.find(
    (t) => normTw(t.countyName) === cName && normTw(t.townName) === tName
  );
  if (found) return found;

  if (rawCode.length >= 5) {
    const cCode5 = rawCode.slice(0, 5);
    found = ALL_TOWNS.find(
      (t) => t.countyCode === cCode5 && normTw(t.townName) === tName
    );
    if (found) return found;
  }

  const baseT = tName.length > 1 ? tName.slice(0, -1) : tName;
  found = ALL_TOWNS.find(
    (t) =>
      (normTw(t.countyName) === cName || (rawCode.length >= 5 && t.countyCode === rawCode.slice(0, 5))) &&
      normTw(t.baseName) === baseT
  );
  if (found) return found;

  const byTownOnly = ALL_TOWNS.filter((t) => normTw(t.townName) === tName || normTw(t.baseName) === baseT);
  if (byTownOnly.length === 1) return byTownOnly[0];

  return null;
}

let loadedTopoData = null;

function rebuildMapLayers(topoData) {
  if (topoData) loadedTopoData = topoData;
  geoLayerGroup.clearLayers();
  countyBorderLayerGroup.clearLayers();
  ALL_TOWNS.forEach((t) => {
    t.layers = [];
    t.bounds = null;
    t.mainBounds = null;
    t.mainPoint = null;
    t.geojsonGeometry = null;
  });
  TAIWAN_ADMIN_DATA.forEach((c) => {
    c.bounds = null;
    c.mainBounds = null;
    c.mainPoint = null;
    c.geojsonGeometry = null;
  });

  if (loadedTopoData && loadedTopoData.townsGeo) {
    loadedTopoData.townsGeo.features.forEach((feat) => {
      const p = feat.properties || {};
      const townObj = matchFeatureToTownObj(p);
      if (!townObj) return;
      if (feat.geometry) {
        if (!townObj.geojsonGeometry) {
          townObj.geojsonGeometry = feat.geometry;
        } else {
          const prev = townObj.geojsonGeometry;
          const prevPolys = prev.type === "MultiPolygon" ? prev.coordinates : prev.type === "Polygon" ? [prev.coordinates] : [];
          const nextPolys = feat.geometry.type === "MultiPolygon" ? feat.geometry.coordinates : feat.geometry.type === "Polygon" ? [feat.geometry.coordinates] : [];
          townObj.geojsonGeometry = { type: "MultiPolygon", coordinates: [...prevPolys, ...nextPolys] };
        }
      }

      const polyLayer = L.geoJSON(feat, {
        renderer: canvasRenderer,
        style: () => computePolygonStyle(townObj)
      });

      polyLayer.eachLayer((subLayer) => {
        bindPolygonEvents(subLayer, townObj);
      });

      polyLayer.addTo(geoLayerGroup);
      townObj.layers.push(polyLayer);
      try {
        const b = polyLayer.getBounds();
        const mainB = computeMainPolygonBounds(feat);
        const mainPt = computeMainPolygonPoint(feat);
        if (b && b.isValid()) {
          townObj.bounds = b;
          townObj.mainBounds = mainB && mainB.isValid() ? mainB : b;
          const center = mainPt || townObj.mainBounds.getCenter();
          townObj.mainPoint = { lat: center.lat, lng: center.lng };
          townObj.lat = center.lat;
          townObj.lng = center.lng;

          const cObj = COUNTY_BY_NAME[townObj.countyName];
          if (cObj) {
            if (!cObj.bounds) {
              cObj.bounds = L.latLngBounds(b.getSouthWest(), b.getNorthEast());
            } else {
              cObj.bounds.extend(b);
            }
          }
        }
      } catch (e) {}
    });

    TAIWAN_ADMIN_DATA.forEach((cObj) => {
      const cMain = computeCountyMainBounds(cObj.name);
      if (cMain && cMain.isValid()) {
        cObj.mainBounds = cMain;
      } else if (cObj.bounds && cObj.bounds.isValid()) {
        cObj.mainBounds = cObj.bounds;
      }
      const cPt = computeCountyMainPoint(cObj.name);
      if (cPt && Number.isFinite(cPt.lat) && Number.isFinite(cPt.lng)) {
        cObj.mainPoint = cPt;
      }
    });

    if (loadedTopoData.countiesGeo && Array.isArray(loadedTopoData.countiesGeo.features)) {
      loadedTopoData.countiesGeo.features.forEach((cFeat) => {
        const cp = cFeat.properties || {};
        const rawC = cp.COUNTYNAME || cp.county || cp.name || cp.COUNTY || "";
        const cNorm = normTw(rawC);
        const cObj = TAIWAN_ADMIN_DATA.find((c) => normTw(c.name) === cNorm);
        if (cObj && cFeat.geometry) {
          cObj.geojsonGeometry = cFeat.geometry;
        }
      });
    }
    TAIWAN_ADMIN_DATA.forEach((cObj) => {
      if (cObj.geojsonGeometry) return;
      const polyCoords = [];
      ALL_TOWNS.forEach((t) => {
        if (t.countyName !== cObj.name || !t.geojsonGeometry) return;
        if (t.geojsonGeometry.type === "Polygon" && Array.isArray(t.geojsonGeometry.coordinates)) {
          polyCoords.push(t.geojsonGeometry.coordinates);
        } else if (t.geojsonGeometry.type === "MultiPolygon" && Array.isArray(t.geojsonGeometry.coordinates)) {
          polyCoords.push(...t.geojsonGeometry.coordinates);
        }
      });
      if (polyCoords.length > 0) {
        cObj.geojsonGeometry = { type: "MultiPolygon", coordinates: polyCoords };
      }
    });

    if (loadedTopoData.countiesGeo) {
      L.geoJSON(loadedTopoData.countiesGeo, {
        renderer: canvasRenderer,
        interactive: false,
        style: () => ({
          color: "rgba(226, 232, 240, 0.45)",
          weight: 1.4,
          fill: false,
          opacity: 0.78
        })
      }).addTo(countyBorderLayerGroup);
    }
    if (countyBorderLayerGroup && map) {
      if (state.showDistrictBorders && state.playMode !== "satellite_quiz") {
        if (!map.hasLayer(countyBorderLayerGroup)) countyBorderLayerGroup.addTo(map);
      } else if (map.hasLayer(countyBorderLayerGroup)) {
        map.removeLayer(countyBorderLayerGroup);
      }
    }
  }

  renderSmartLabelsAndLeaderLines();
  updateScoreAndProgressUI();
}

function bindPolygonEvents(layer, townObj) {
  layer.on("click", (ev) => {
    handlePolygonClick(townObj, ev);
  });
}

function isTownInScope(townObj) {
  if (state.selectedTownIds instanceof Set) {
    return state.selectedTownIds.has(townObj.id);
  }
  return state.selectedCounties.has(townObj.countyName);
}

function computePolygonStyle(townObj) {
  if (state.playMode === "pin_drop") {
    if (typeof isPinDropTargetPolygon === "function" && isPinDropTargetPolygon(townObj)) {
      return {
        stroke: true,
        color: "#6ee7b7",
        weight: 2.8,
        fillColor: "#10b981",
        fillOpacity: 0.48
      };
    }
    const isTile = state.mapLayer !== "vector";
    if (!state.showDistrictBorders && !isTile) {
      // Seal sub-pixel HTML5 Canvas seams between adjacent townships with matching stroke+fill so zero district shapes leak at any zoom
      return {
        stroke: true,
        color: "#253e63",
        opacity: 1,
        weight: 1.1,
        fillColor: "#253e63",
        fillOpacity: 1
      };
    }
    return {
      stroke: state.showDistrictBorders,
      color: state.showDistrictBorders
        ? (isTile ? "rgba(255, 255, 255, 0.52)" : "rgba(148, 163, 184, 0.42)")
        : "transparent",
      weight: state.showDistrictBorders ? 0.75 : 0,
      fillColor: isTile ? "#0f172a" : "#253e63",
      fillOpacity: isTile ? 0.08 : 0.96
    };
  }
  const vState = typeof getActiveViewState === "function" ? getActiveViewState() : state;
  const inScope = isTownInScope(townObj);
  if (!inScope) {
    if (state.playMode === "satellite_quiz" && !vState.isGameOver) {
      return {
        stroke: state.showDistrictBorders,
        color: state.showDistrictBorders ? "rgba(148, 163, 184, 0.28)" : "transparent",
        weight: state.showDistrictBorders ? 0.55 : 0,
        fillColor: "#0f172a",
        fillOpacity: 0
      };
    }
    return {
      stroke: state.showDistrictBorders,
      color: state.showDistrictBorders ? "rgba(148, 163, 184, 0.28)" : "transparent",
      weight: state.showDistrictBorders ? 0.55 : 0,
      fillColor: "#0f172a",
      fillOpacity: state.mapLayer === "vector" ? 0.22 : 0.06
    };
  }

  const isUnlocked =
    state.difficulty === "county_only"
      ? vState.unlockedCounties.has(townObj.countyName)
      : vState.unlockedTowns.has(townObj.id);

  const isMissed = vState.missedTowns.has(townObj.id);
  const isTarget =
    (state.playMode === "target_random" || state.playMode === "target_click" || state.playMode === "satellite_quiz") &&
    !isUnlocked &&
    !isMissed &&
    (state.difficulty === "county_only"
      ? vState.targetId === townObj.countyName
      : vState.targetId === townObj.id);

  const countyUnlockedInMaster =
    state.difficulty === "master_hierarchy" && vState.unlockedCounties.has(townObj.countyName);
  const provinceUnlockedInMaster =
    state.difficulty === "master_hierarchy" &&
    vState.unlockedProvinces.has(townObj.isSpecial ? townObj.countyName : townObj.province);

  const baseCountyColor = COUNTY_COLORS[townObj.countyName] || "#38bdf8";

  if (state.playMode === "satellite_quiz" && !isUnlocked && !isMissed && !vState.isGameOver) {
    if (isTarget && state.satelliteOutlineRevealed) {
      return {
        stroke: true,
        color: "#fef08a",
        weight: 2.6,
        fillColor: "#f59e0b",
        fillOpacity: 0
      };
    }
    return {
      stroke: state.showDistrictBorders,
      color: state.showDistrictBorders ? "rgba(255, 255, 255, 0.45)" : "transparent",
      weight: state.showDistrictBorders ? 0.75 : 0,
      fillColor: "#0f172a",
      fillOpacity: 0
    };
  }

  if (isTarget) {
    return {
      stroke: true,
      color: "#fef08a",
      weight: 2.6,
      fillColor: "#f59e0b",
      fillOpacity: 0.85
    };
  }

  if (isUnlocked) {
    return {
      stroke: true,
      color: "#ffffff",
      weight: 1.15,
      fillColor: baseCountyColor,
      fillOpacity: state.mapLayer === "vector" ? 0.78 : 0.65
    };
  }

  if (isMissed) {
    return {
      stroke: true,
      color: "#fda4af",
      weight: 1.1,
      fillColor: "#e11d48",
      fillOpacity: 0.62
    };
  }

  if (state.difficulty === "master_hierarchy") {
    if (countyUnlockedInMaster) {
      return {
        stroke: true,
        color: baseCountyColor,
        weight: 1.1,
        fillColor: baseCountyColor,
        fillOpacity: 0.22
      };
    }
    if (provinceUnlockedInMaster) {
      return {
        stroke: true,
        color: "rgba(148, 163, 184, 0.55)",
        weight: 0.8,
        fillColor: "#1e293b",
        fillOpacity: 0.38
      };
    }
  }

  const isTileLayer = state.mapLayer !== "vector" || state.showRailOverlay;
  const borderWeight = state.showDistrictBorders ? 0.75 : 0;
  const borderColor = state.showDistrictBorders
    ? (isTileLayer ? "rgba(255, 255, 255, 0.52)" : "rgba(148, 163, 184, 0.42)")
    : "transparent";
  return {
    stroke: state.showDistrictBorders,
    color: borderColor,
    weight: borderWeight,
    fillColor: isTileLayer ? "#0f172a" : "#162238",
    fillOpacity: isTileLayer ? 0.14 : (state.showDistrictBorders ? 0.72 : 0.18)
  };
}

function refreshAllPolygonStyles() {
  ALL_TOWNS.forEach((t) => {
    t.layers.forEach((l) => l.setStyle(computePolygonStyle(t)));
  });
  renderSmartLabelsAndLeaderLines();
}
