// =========================================================================
// 4. HARDWARE-ACCELERATED CANVAS LEAFLET MAP INITIALIZATION
// =========================================================================
if (typeof window.L === "undefined") {
  // Lightweight offline fallback shim when Leaflet CDN is unreachable (e.g., offline file:// mode)
  const noopLayer = () => ({
    addTo() { return this; },
    remove() { return this; },
    clearLayers() { return this; },
    setStyle() { return this; },
    on() { return this; },
    bindTooltip() { return this; },
    getBounds() { return { isValid: () => true, getNorthWest: () => [25, 121], getSouthEast: () => [22, 120] }; }
  });
  window.L = {
    latLngBounds: () => ({ isValid: () => true, pad: function() { return this; }, getNorthWest: () => [25, 121], getSouthEast: () => [22, 120] }),
    canvas: () => ({}),
    svg: () => ({}),
    layerGroup: () => noopLayer(),
    featureGroup: () => noopLayer(),
    tileLayer: () => noopLayer(),
    geoJSON: () => noopLayer(),
    polyline: () => noopLayer(),
    circleMarker: () => noopLayer(),
    marker: () => noopLayer(),
    divIcon: () => ({}),
    DomEvent: { stopPropagation() {} },
    map: () => ({
      on() { return this; },
      removeLayer() { return this; },
      hasLayer() { return false; },
      getSize: () => ({ x: 960, y: 600, divideBy: () => ({ x: 480, y: 300 }) }),
      getCenter: () => ({ lat: 23.75, lng: 120.95 }),
      getZoom: () => 8,
      getZoomScale: () => 1,
      project: () => ({ x: 480, y: 300 }),
      latLngToContainerPoint: () => ({ x: 480, y: 300 }),
      flyTo() {},
      flyToBounds() {},
      panTo() {},
      zoomIn() {},
      zoomOut() {},
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
  gis_roads_overlay: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
  gis_railway_overlay: "https://{s}.tiles.openrailwaymap.org/signals/{z}/{x}/{y}.png"
};

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
    maxZoom: 15,
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
    renderSmartLabelsAndLeaderLines();
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
  map.flyToBounds(TAIWAN_FULL_VIEW_BOUNDS, { padding: [20, 20], duration: 0.55 });
}

function zoomToCountyCenter(countyName) {
  const c = COUNTY_BY_NAME[countyName];
  if (!c || !map) return;
  if (c.bounds && c.bounds.isValid()) {
    map.flyToBounds(c.bounds, { padding: [45, 45], maxZoom: 12, duration: 0.55 });
  } else {
    map.flyTo([c.lat, c.lng], 11, { duration: 0.55 });
  }
}

// =========================================================================
// 4A-2. BASE LAYERS, TOPOJSON LOADER & POLYGON RENDERING
// =========================================================================
function setMapBaseLayer(layerKey, forceBypassLock = false) {
  if (state.p2pLayerRule === "locked" && !forceBypassLock && state.role !== "spectator") {
    setFeedback(`🔒 本場對戰已鎖定使用「${state.p2pForcedLayer}」圖層，無法自由切換！`, "warn");
    return;
  }

  state.mapLayer = layerKey;
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
  } else if (layerKey === "satellite") {
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
    const isCurrent = btn.getAttribute("data-layer") === layerKey;
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
  });
  TAIWAN_ADMIN_DATA.forEach((c) => {
    c.bounds = null;
  });

  if (loadedTopoData && loadedTopoData.townsGeo) {
    loadedTopoData.townsGeo.features.forEach((feat) => {
      const p = feat.properties || {};
      const townObj = matchFeatureToTownObj(p);
      if (!townObj) return;

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
        if (b && b.isValid()) {
          townObj.bounds = b;
          const center = b.getCenter();
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
  }

  renderSmartLabelsAndLeaderLines();
  updateScoreAndProgressUI();
}

function bindPolygonEvents(layer, townObj) {
  layer.on("click", () => {
    handlePolygonClick(townObj);
  });
}

function isTownInScope(townObj) {
  if (state.selectedTownIds instanceof Set) {
    return state.selectedTownIds.has(townObj.id);
  }
  return state.selectedCounties.has(townObj.countyName);
}

function computePolygonStyle(townObj) {
  const inScope = isTownInScope(townObj);
  if (!inScope) {
    return {
      stroke: state.showDistrictBorders,
      color: state.showDistrictBorders ? "rgba(148, 163, 184, 0.28)" : "transparent",
      weight: state.showDistrictBorders ? 0.55 : 0,
      fillColor: "#0f172a",
      fillOpacity: state.mapLayer === "vector" ? 0.22 : 0.06
    };
  }

  const vState = typeof getActiveViewState === "function" ? getActiveViewState() : state;
  const isTarget =
    (state.playMode === "target_random" || state.playMode === "target_click") &&
    (state.difficulty === "county_only"
      ? vState.targetId === townObj.countyName
      : vState.targetId === townObj.id);

  const isUnlocked =
    state.difficulty === "county_only"
      ? vState.unlockedCounties.has(townObj.countyName)
      : vState.unlockedTowns.has(townObj.id);

  const isMissed = vState.missedTowns.has(townObj.id);
  const countyUnlockedInMaster =
    state.difficulty === "master_hierarchy" && vState.unlockedCounties.has(townObj.countyName);
  const provinceUnlockedInMaster =
    state.difficulty === "master_hierarchy" &&
    vState.unlockedProvinces.has(townObj.isSpecial ? townObj.countyName : townObj.province);

  const baseCountyColor = COUNTY_COLORS[townObj.countyName] || "#38bdf8";

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
