// =========================================================================
// PIN-DROP ENGINE (TRACK-B: 給地名標座標模式 — Pure JS Geometry, Scoring & State Machine)
// Strictly zero .innerHTML, file:// compatible, zero external dependencies.
// =========================================================================

let pinDropLayerGroup = null;
let pinPreviewMarker = null;
let pinTargetRevealLayer = null;
let pinDashPolyline = null;
let pinMidpointMarker = null;

// -------------------------------------------------------------------------
// 1. PURE JS GEOMETRY & SCORING ENGINE (Exported Globally for Unit Tests)
// -------------------------------------------------------------------------
function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371.0088;
  const toRad = Math.PI / 180;
  const p1 = Number(lat1) * toRad;
  const p2 = Number(lat2) * toRad;
  const dp = (Number(lat2) - Number(lat1)) * toRad;
  const dl = (Number(lng2) - Number(lng1)) * toRad;
  const sinDp = Math.sin(dp / 2);
  const sinDl = Math.sin(dl / 2);
  const a = sinDp * sinDp + Math.cos(p1) * Math.cos(p2) * sinDl * sinDl;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return R * c;
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
    const intersects =
      ((yi > lat) !== (yj > lat)) &&
      (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function isPointInPolygonRings(lng, lat, rings) {
  if (!Array.isArray(rings) || rings.length === 0) return false;
  if (!isPointInRing(lng, lat, rings[0])) return false;
  // Must NOT be inside any interior hole ring (rings[1..])
  for (let k = 1; k < rings.length; k++) {
    if (isPointInRing(lng, lat, rings[k])) {
      return false;
    }
  }
  return true;
}

function isPointInGeoJsonGeometry(lng, lat, geometry) {
  if (!geometry || !Number.isFinite(lng) || !Number.isFinite(lat)) return false;
  const geom = geometry.type === "Feature" ? geometry.geometry : geometry;
  if (!geom) return false;

  if (geom.type === "Polygon" && Array.isArray(geom.coordinates)) {
    return isPointInPolygonRings(lng, lat, geom.coordinates);
  }
  if (geom.type === "MultiPolygon" && Array.isArray(geom.coordinates)) {
    for (let i = 0; i < geom.coordinates.length; i++) {
      if (isPointInPolygonRings(lng, lat, geom.coordinates[i])) {
        return true;
      }
    }
    return false;
  }
  if (geom.type === "GeometryCollection" && Array.isArray(geom.geometries)) {
    return geom.geometries.some((g) => isPointInGeoJsonGeometry(lng, lat, g));
  }
  return false;
}

function nearestPointOnSegment(px, py, ax, ay, bx, by) {
  const pLng = Number(px);
  const pLat = Number(py);
  const aLng = Number(ax);
  const aLat = Number(ay);
  const bLng = Number(bx);
  const bLat = Number(by);

  const cosLat = Math.cos((pLat * Math.PI) / 180);
  const dx = (bLng - aLng) * cosLat;
  const dy = bLat - aLat;
  const lenSq = dx * dx + dy * dy;
  let t = 0;
  if (lenSq > 1e-16) {
    const pdx = (pLng - aLng) * cosLat;
    const pdy = pLat - aLat;
    t = (pdx * dx + pdy * dy) / lenSq;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
  }
  const nearestLng = aLng + t * (bLng - aLng);
  const nearestLat = aLat + t * (bLat - aLat);
  const distanceKm = haversineDistanceKm(pLat, pLng, nearestLat, nearestLng);
  return {
    lat: nearestLat,
    lng: nearestLng,
    nearestLat,
    nearestLng,
    distanceKm,
    t
  };
}

function collectGeoJsonRings(geometry, outRings = []) {
  if (!geometry) return outRings;
  const geom = geometry.type === "Feature" ? geometry.geometry : geometry;
  if (!geom) return outRings;

  if (geom.type === "Polygon" && Array.isArray(geom.coordinates)) {
    geom.coordinates.forEach((ring) => {
      if (Array.isArray(ring) && ring.length >= 2) outRings.push(ring);
    });
  } else if (geom.type === "MultiPolygon" && Array.isArray(geom.coordinates)) {
    geom.coordinates.forEach((poly) => {
      if (Array.isArray(poly)) {
        poly.forEach((ring) => {
          if (Array.isArray(ring) && ring.length >= 2) outRings.push(ring);
        });
      }
    });
  } else if (geom.type === "GeometryCollection" && Array.isArray(geom.geometries)) {
    geom.geometries.forEach((g) => collectGeoJsonRings(g, outRings));
  }
  return outRings;
}

function computeDistanceToGeoJson(lat, lng, geometry) {
  const qLat = Number(lat);
  const qLng = Number(lng);
  if (!Number.isFinite(qLat) || !Number.isFinite(qLng) || !geometry) {
    return { inside: false, distanceKm: Infinity, nearestLat: qLat, nearestLng: qLng };
  }

  if (isPointInGeoJsonGeometry(qLng, qLat, geometry)) {
    return {
      inside: true,
      distanceKm: 0,
      nearestLat: qLat,
      nearestLng: qLng
    };
  }

  const rings = collectGeoJsonRings(geometry, []);
  let minDistanceKm = Infinity;
  let bestLat = qLat;
  let bestLng = qLng;

  for (let rIdx = 0; rIdx < rings.length; rIdx++) {
    const ring = rings[rIdx];
    const len = ring.length;
    if (len < 2) continue;
    for (let i = 0; i < len; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % len];
      if (!Array.isArray(a) || !Array.isArray(b) || a.length < 2 || b.length < 2) continue;
      if (i === len - 1 && a[0] === b[0] && a[1] === b[1]) continue;
      const cand = nearestPointOnSegment(qLng, qLat, a[0], a[1], b[0], b[1]);
      if (cand.distanceKm < minDistanceKm) {
        minDistanceKm = cand.distanceKm;
        bestLat = cand.nearestLat;
        bestLng = cand.nearestLng;
      }
    }
  }

  return {
    inside: false,
    distanceKm: Number.isFinite(minDistanceKm) ? minDistanceKm : 0,
    nearestLat: bestLat,
    nearestLng: bestLng
  };
}

function computePinDropScore(distanceKm, scaleKm = 25, perfectRadiusKm = 0) {
  const d = Number(distanceKm);
  if (!Number.isFinite(d) || d < 0) return 0;
  const pRad = Number.isFinite(Number(perfectRadiusKm)) && Number(perfectRadiusKm) >= 0 ? Number(perfectRadiusKm) : 0;
  if (d <= pRad) return 5000;
  const s = Number.isFinite(Number(scaleKm)) && Number(scaleKm) > 0 ? Number(scaleKm) : 25;
  const raw = 5000 * Math.exp(-(d - pRad) / s);
  return Math.max(0, Math.min(5000, Math.round(raw)));
}

function getPinDropScaleKm(target = null) {
  const packScale =
    typeof getActiveMapPack === "function"
      ? getActiveMapPack()?.mapView?.pinDropScaleKm
      : null;
  const isCounty =
    (target && target.kind === "county") ||
    (!target && typeof state !== "undefined" && state.difficulty === "county_only");
  if (Number.isFinite(packScale) && packScale > 0) {
    return isCounty && packScale === 25 ? 40 : packScale;
  }
  return isCounty ? 40 : 25;
}

function getPinDropPerfectRadiusKm(target) {
  if (!target) return 0;
  if (target.kind === "town" || target.kind === "county") return 0;
  if (target.kind === "poi") {
    const isAirport =
      target.poiCategory === "airport" ||
      target.ref?.category === "airport" ||
      (Array.isArray(target.ref?.categories) && target.ref.categories.includes("airport"));
    return isAirport ? 1.5 : 0.5;
  }
  if (target.kind === "station") {
    return 0.5;
  }
  return 0.5;
}

// -------------------------------------------------------------------------
// 2. CANDIDATE POOL & QUEUE GENERATION
// -------------------------------------------------------------------------
function buildPinDropTargetFromTown(t) {
  if (!t) return null;
  const pt = t.mainPoint && Number.isFinite(t.mainPoint.lat) ? t.mainPoint : { lat: t.lat, lng: t.lng };
  return {
    kind: "town",
    id: `town:${t.id}`,
    rawId: t.id,
    countyName: t.countyName,
    townName: t.townName,
    promptTitle: `📍 請在地圖上標出：${t.countyName} ${t.townName}`,
    shortLabel: `${t.countyName}${t.townName}`,
    categoryLabel: "鄉鎮市區",
    badgeText: t.countyName,
    lat: Number(pt.lat),
    lng: Number(pt.lng),
    ref: t
  };
}

function buildPinDropTargetFromCounty(c) {
  if (!c) return null;
  const pt = c.mainPoint && Number.isFinite(c.mainPoint.lat) ? c.mainPoint : { lat: c.lat, lng: c.lng };
  return {
    kind: "county",
    id: `county:${c.name}`,
    rawId: c.name,
    countyName: c.name,
    promptTitle: `📍 請在地圖上標出：${c.name}`,
    shortLabel: c.name,
    categoryLabel: "縣市行政區",
    badgeText: c.province || "22縣市",
    lat: Number(pt.lat),
    lng: Number(pt.lng),
    ref: c
  };
}

function buildPinDropTargetFromStation(st) {
  if (!st) return null;
  const disp = String(st.displayName || "");
  const stWithSuffix = disp.endsWith("站") ? disp : `${disp}站`;
  return {
    kind: "station",
    id: `station:${st.key}`,
    rawId: st.key,
    promptTitle: `🚉 請在地圖上標出：${st.lineName} ${stWithSuffix}`,
    shortLabel: `${st.lineName} · ${stWithSuffix}`,
    categoryLabel: "軌道車站",
    badgeText: `🚉 ${st.lineName}`,
    lat: Number(st.lat),
    lng: Number(st.lng),
    ref: st
  };
}

function buildPinDropTargetFromPoi(p) {
  if (!p) return null;
  const displayCat = typeof getPoiDisplayCategory === "function" ? getPoiDisplayCategory(p) : p.category;
  const catMeta =
    (typeof POI_CATEGORY_META !== "undefined" && POI_CATEGORY_META[displayCat]) || {
      icon: "📍",
      label: "地標"
    };
  return {
    kind: "poi",
    poiCategory: displayCat,
    id: `poi:${p.id}`,
    rawId: p.id,
    promptTitle: `${catMeta.icon} 請在地圖上標出：${p.name}`,
    shortLabel: p.shortName || p.name,
    categoryLabel: catMeta.label,
    badgeText: `${catMeta.icon} ${catMeta.label}`,
    lat: Number(p.lat),
    lng: Number(p.lng),
    ref: p
  };
}

function buildPinDropCandidatePool() {
  if (typeof syncLegacyQuizTargetMode === "function") {
    syncLegacyQuizTargetMode();
  }
  const pool = [];
  if (state.regionQuizEnabled) {
    if (state.difficulty === "county_only") {
      const counties = typeof getScopeCounties === "function" ? getScopeCounties() : [];
      counties.forEach((c) => {
        const item = buildPinDropTargetFromCounty(c);
        if (item) pool.push(item);
      });
    } else {
      const towns = typeof getScopeTowns === "function" ? getScopeTowns() : [];
      towns.forEach((t) => {
        const item = buildPinDropTargetFromTown(t);
        if (item) pool.push(item);
      });
    }
  }

  if (state.stationQuizEnabled && state.quizStationLines && state.quizStationLines.size > 0 && typeof getActiveQuizStations === "function") {
    getActiveQuizStations().forEach((st) => {
      const item = buildPinDropTargetFromStation(st);
      if (item) pool.push(item);
    });
  }

  if (typeof hasAnyPoiQuizActive === "function" && hasAnyPoiQuizActive() && typeof getActiveQuizPois === "function") {
    getActiveQuizPois().forEach((p) => {
      const item = buildPinDropTargetFromPoi(p);
      if (item) pool.push(item);
    });
  }

  return pool;
}

function shufflePinDropArray(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

// -------------------------------------------------------------------------
// 3. LEAFLET OVERLAY MANAGEMENT (pinDropLayerGroup)
// -------------------------------------------------------------------------
function ensurePinDropLayerGroup() {
  if (typeof map === "undefined" || !map || typeof L === "undefined") return null;
  if (!pinDropLayerGroup) {
    pinDropLayerGroup = L.layerGroup().addTo(map);
  } else if (typeof map.hasLayer === "function" && !map.hasLayer(pinDropLayerGroup)) {
    pinDropLayerGroup.addTo(map);
  }
  return pinDropLayerGroup;
}

function clearPinDropLayers() {
  if (pinPreviewMarker) {
    try { pinPreviewMarker.remove(); } catch (_) {}
    pinPreviewMarker = null;
  }
  if (pinTargetRevealLayer) {
    try { pinTargetRevealLayer.remove(); } catch (_) {}
    pinTargetRevealLayer = null;
  }
  if (pinDashPolyline) {
    try { pinDashPolyline.remove(); } catch (_) {}
    pinDashPolyline = null;
  }
  if (pinMidpointMarker) {
    try { pinMidpointMarker.remove(); } catch (_) {}
    pinMidpointMarker = null;
  }
  if (pinDropLayerGroup && typeof pinDropLayerGroup.clearLayers === "function") {
    pinDropLayerGroup.clearLayers();
  }
}

function renderPinDropPreviewPin(lat, lng) {
  const group = ensurePinDropLayerGroup();
  if (!group || typeof L === "undefined") return null;

  if (pinPreviewMarker && typeof pinPreviewMarker.setLatLng === "function") {
    pinPreviewMarker.setLatLng([lat, lng]);
    return pinPreviewMarker;
  }

  const wrap = document.createElement("div");
  wrap.className = "pindrop-preview-pin";
  const pulse = document.createElement("span");
  pulse.className = "pindrop-preview-pin-pulse";
  const head = document.createElement("span");
  head.className = "pindrop-preview-pin-head";
  head.textContent = "📍";
  wrap.appendChild(pulse);
  wrap.appendChild(head);

  const icon = L.divIcon({
    className: "pindrop-pin-icon-wrapper",
    html: wrap,
    iconSize: [34, 34],
    iconAnchor: [17, 30]
  });

  pinPreviewMarker = L.marker([lat, lng], {
    icon,
    interactive: false,
    keyboard: false,
    zIndexOffset: 950
  }).addTo(group);

  return pinPreviewMarker;
}

function isPinDropTargetPolygon(townObj) {
  if (
    typeof state === "undefined" ||
    state.playMode !== "pin_drop" ||
    !state.pinDrop ||
    state.pinDrop.phase !== "revealed" ||
    !state.pinDrop.currentTarget ||
    !townObj
  ) {
    return false;
  }
  const target = state.pinDrop.currentTarget;
  if (target.kind === "town") {
    return townObj.id === target.rawId;
  }
  if (target.kind === "county") {
    return townObj.countyName === target.rawId;
  }
  return false;
}

function renderPinDropRevealLayers(target, record) {
  const group = ensurePinDropLayerGroup();
  if (!group || typeof L === "undefined" || !target || !record) return;

  // 1. Target highlight (polygon style refresh for admin areas; glowing emerald marker for point targets)
  if (target.kind === "town" || target.kind === "county") {
    if (typeof refreshAllPolygonStyles === "function") {
      refreshAllPolygonStyles();
    }
  } else {
    const tWrap = document.createElement("div");
    tWrap.className = "pindrop-target-reveal-pin";
    const tCore = document.createElement("span");
    tCore.className = "pindrop-target-reveal-core";
    tCore.textContent = "🎯";
    const tLbl = document.createElement("span");
    tLbl.className = "pindrop-target-reveal-label";
    tLbl.textContent = target.shortLabel;
    tWrap.appendChild(tCore);
    tWrap.appendChild(tLbl);

    const tIcon = L.divIcon({
      className: "pindrop-pin-icon-wrapper",
      html: tWrap,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
    pinTargetRevealLayer = L.marker([target.lat, target.lng], {
      icon: tIcon,
      interactive: false,
      keyboard: false,
      zIndexOffset: 940
    }).addTo(group);
  }

  // 2. Amber dashed polyline from player's guess to nearest boundary point / target point
  pinDashPolyline = L.polyline(
    [
      [record.guessLat, record.guessLng],
      [record.nearestLat, record.nearestLng]
    ],
    {
      color: "#f59e0b",
      weight: 3,
      dashArray: "8, 6",
      opacity: 0.95,
      interactive: false
    }
  ).addTo(group);

  // 3. Midpoint pill badge showing distance km & score
  const midLat = (record.guessLat + record.nearestLat) / 2;
  const midLng = (record.guessLng + record.nearestLng) / 2;
  const pill = document.createElement("div");
  pill.className = record.inside
    ? "pindrop-midpoint-pill pindrop-midpoint-perfect"
    : "pindrop-midpoint-pill";
  if (record.inside && (target.kind === "town" || target.kind === "county")) {
    pill.textContent = "🎯 命中境內！0.0 km · +5,000 分";
  } else if (record.inside) {
    pill.textContent = `🎯 精準命中！${record.distanceKm.toFixed(2)} km · +5,000 分`;
  } else {
    pill.textContent = `${record.distanceKm.toFixed(1)} km · +${record.score.toLocaleString()} 分`;
  }

  const pillIcon = L.divIcon({
    className: "pindrop-midpoint-icon-wrapper",
    html: pill,
    iconSize: [180, 28],
    iconAnchor: [90, 14]
  });
  pinMidpointMarker = L.marker([midLat, midLng], {
    icon: pillIcon,
    interactive: false,
    keyboard: false,
    zIndexOffset: 960
  }).addTo(group);

  // 4. Auto fitBounds framing player pin + target
  if (typeof map !== "undefined" && map && typeof L.latLngBounds === "function") {
    const frameBounds = L.latLngBounds(
      [record.guessLat, record.guessLng],
      [record.nearestLat, record.nearestLng]
    );
    const refObj = target.ref;
    if (refObj) {
      const tb =
        refObj.mainBounds && typeof refObj.mainBounds.isValid === "function" && refObj.mainBounds.isValid()
          ? refObj.mainBounds
          : refObj.bounds && typeof refObj.bounds.isValid === "function" && refObj.bounds.isValid()
          ? refObj.bounds
          : null;
      if (tb) {
        frameBounds.extend(tb);
      } else if (Number.isFinite(target.lat) && Number.isFinite(target.lng)) {
        frameBounds.extend([target.lat, target.lng]);
      }
    }
    if (frameBounds.isValid()) {
      const maxZ = target.kind === "county" ? 10 : 12;
      map.fitBounds(frameBounds.pad(0.18), { padding: [60, 60], maxZoom: maxZ });
    }
  }
}

// -------------------------------------------------------------------------
// 4. ANTI-SPOILER ENVIRONMENT & STATE MACHINE
// -------------------------------------------------------------------------
function isPinDropPlayMode(pm = typeof state !== "undefined" ? state.playMode : "free") {
  return pm === "pin_drop";
}

function isPinDropPlacing() {
  return Boolean(
    typeof state !== "undefined" &&
      state.playMode === "pin_drop" &&
      state.pinDrop &&
      state.pinDrop.phase === "placing"
  );
}

function ensurePinDropEnvironment() {
  if (typeof state === "undefined" || state.playMode !== "pin_drop") return;

  if (state.pinDropSavedBaseLayer === null) {
    const cur = state.mapLayer || "vector";
    state.pinDropSavedBaseLayer = ["vector", "terrain", "satellite"].includes(cur) ? cur : "vector";
  }
  if (state.pinDropSavedDistrictBorders === null) {
    state.pinDropSavedDistrictBorders = Boolean(state.showDistrictBorders);
  }

  // 1. Force label-free basemap (vector | terrain | satellite)
  const desiredBase = ["vector", "terrain", "satellite"].includes(state.pinDropBaseLayer)
    ? state.pinDropBaseLayer
    : ["vector", "terrain", "satellite"].includes(state.mapLayer)
    ? state.mapLayer
    : "vector";
  state.pinDropBaseLayer = desiredBase;
  if (typeof setMapBaseLayer === "function") {
    setMapBaseLayer(desiredBase, true);
  } else {
    state.mapLayer = desiredBase;
  }

  // 2. Hide township district borders by default unless explicitly toggled on in Pin-Drop settings
  const showBorders = Boolean(state.pinDropShowBorders);
  if (typeof window !== "undefined" && typeof window.setDistrictBordersVisible === "function") {
    window.setDistrictBordersVisible(showBorders, true);
  } else {
    state.showDistrictBorders = showBorders;
  }

  // 3. Hide floating hover tooltips
  const tipEl = document.getElementById("floating-tip-popover");
  if (tipEl) tipEl.classList.add("hidden");
  const hoverTip = document.getElementById("hover-tip");
  if (hoverTip) {
    hoverTip.classList.add("hidden");
    hoverTip.textContent = "";
  }

  // 4. Refresh overlays so labels, station dots, and POI pins are hidden during pin_drop
  if (typeof updateRoadAndRailwayTileOverlays === "function") {
    updateRoadAndRailwayTileOverlays();
  }
  if (typeof refreshPoiMapLayer === "function") {
    refreshPoiMapLayer();
  }
  if (typeof refreshAllPolygonStyles === "function") {
    refreshAllPolygonStyles();
  }
}

function restorePinDropEnvironment() {
  clearPinDropLayers();
  if (typeof state === "undefined") return;

  if (state.pinDrop) {
    state.pinDrop.active = false;
    state.pinDrop.phase = "idle";
    state.pinDrop.currentTarget = null;
    state.pinDrop.guessLatLng = null;
    state.pinDrop.lastReveal = null;
  }

  document.getElementById("modal-pindrop-summary")?.classList.add("hidden");
  document.getElementById("pindrop-dock-bar")?.classList.add("hidden");
  document.getElementById("answer-form")?.classList.remove("hidden");
  document.getElementById("input-occludable-footer")?.classList.remove("hidden");

  if (state.pinDropSavedBaseLayer !== null) {
    const prevBase = state.pinDropSavedBaseLayer;
    state.pinDropSavedBaseLayer = null;
    if (typeof setMapBaseLayer === "function") {
      setMapBaseLayer(prevBase, true);
    } else {
      state.mapLayer = prevBase;
    }
  }

  if (state.pinDropSavedDistrictBorders !== null) {
    const prevBorders = Boolean(state.pinDropSavedDistrictBorders);
    state.pinDropSavedDistrictBorders = null;
    if (typeof window !== "undefined" && typeof window.setDistrictBordersVisible === "function") {
      window.setDistrictBordersVisible(prevBorders, true);
    } else {
      state.showDistrictBorders = prevBorders;
    }
  }

  if (typeof updateRoadAndRailwayTileOverlays === "function") updateRoadAndRailwayTileOverlays();
  if (typeof refreshPoiMapLayer === "function") refreshPoiMapLayer();
  if (typeof refreshAllPolygonStyles === "function") refreshAllPolygonStyles();
  if (typeof updateScoreAndProgressUI === "function") updateScoreAndProgressUI();
}

function resetPinDropViewportToFullView() {
  if (typeof map === "undefined" || !map) return;
  const packBounds =
    typeof getActiveMapPack === "function" && getActiveMapPack()?.mapView?.fullViewBounds
      ? L.latLngBounds(getActiveMapPack().mapView.fullViewBounds)
      : typeof TAIWAN_FULL_VIEW_BOUNDS !== "undefined"
      ? TAIWAN_FULL_VIEW_BOUNDS
      : null;
  if (packBounds && typeof map.fitBounds === "function") {
    map.fitBounds(packBounds, { padding: [20, 20], animate: false });
  }
}

function startPinDropGame() {
  if (typeof state === "undefined") return false;
  state.playMode = "pin_drop";
  document.getElementById("modal-pindrop-summary")?.classList.add("hidden");

  const pool = buildPinDropCandidatePool();
  if (pool.length === 0) {
    if (typeof setFeedback === "function") {
      setFeedback("⚠️ 目前未啟用任何題庫，已自動載入全台行政區題庫！", "warn");
    }
    state.regionQuizEnabled = true;
    state.selectedCounties = new Set(TAIWAN_ADMIN_DATA.map((c) => c.name));
    state.selectedTownIds = new Set(ALL_TOWNS.map((t) => t.id));
  }

  const activePool = buildPinDropCandidatePool();
  const shuffled = shufflePinDropArray(activePool);
  const cfgRounds = Number.isFinite(Number(state.pinDropRounds)) ? Number(state.pinDropRounds) : 10;
  const totalRounds = cfgRounds === 0 ? 0 : Math.min(Math.max(1, cfgRounds), Math.max(1, shuffled.length));
  const queue = totalRounds > 0 ? shuffled.slice(0, totalRounds) : shuffled;

  state.pinDrop = {
    active: true,
    totalRounds,
    currentRound: 0,
    phase: "idle",
    queue,
    currentTarget: null,
    guessLatLng: null,
    lastReveal: null,
    history: [],
    totalScore: 0
  };

  ensurePinDropEnvironment();
  beginPinDropRound();
  return true;
}

function beginPinDropRound() {
  if (!state.pinDrop || !state.pinDrop.active) return false;

  clearPinDropLayers();
  state.pinDrop.guessLatLng = null;
  state.pinDrop.lastReveal = null;

  if (state.pinDrop.queue.length === 0) {
    if (state.pinDrop.totalRounds === 0) {
      const refilled = shufflePinDropArray(buildPinDropCandidatePool());
      if (refilled.length === 0) {
        finishPinDropGame();
        return false;
      }
      state.pinDrop.queue.push(...refilled);
    } else {
      finishPinDropGame();
      return false;
    }
  }

  const nextTarget = state.pinDrop.queue.shift();
  state.pinDrop.currentRound += 1;
  state.pinDrop.currentTarget = nextTarget;
  state.pinDrop.phase = "placing";

  // Strictly reset viewport to full Taiwan view at the start of every new round
  resetPinDropViewportToFullView();
  ensurePinDropEnvironment();
  updatePinDropBannerAndDockUI();
  if (typeof updateScoreAndProgressUI === "function") {
    updateScoreAndProgressUI();
  }
  if (typeof setFeedback === "function") {
    setFeedback(`📍 第 ${state.pinDrop.currentRound} 題：請點擊地圖放置藍色預覽圖釘，確認後送出！`, "info");
  }
  return true;
}

function handlePinDropMapClick(latlng) {
  if (typeof state === "undefined" || state.playMode !== "pin_drop") return false;
  if (state.role === "spectator" || !state.pinDrop || state.pinDrop.phase !== "placing") return false;
  if (!latlng) return false;

  const lat = Number(latlng.lat ?? (Array.isArray(latlng) ? latlng[0] : NaN));
  const lng = Number(latlng.lng ?? (Array.isArray(latlng) ? latlng[1] : NaN));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

  if (!state.timerRunning && state.elapsedSec === 0 && typeof startTimer === "function") {
    startTimer();
  }

  state.pinDrop.guessLatLng = { lat, lng };
  renderPinDropPreviewPin(lat, lng);
  updatePinDropBannerAndDockUI();
  if (typeof setFeedback === "function") {
    setFeedback(
      `📍 已放置預覽標記 (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)，可再次點擊微調或按「確認標記」送出！`,
      "info"
    );
  }
  return true;
}

function confirmPinDropGuess() {
  if (typeof state === "undefined" || state.playMode !== "pin_drop" || !state.pinDrop) return false;
  if (state.pinDrop.phase !== "placing" || !state.pinDrop.currentTarget || !state.pinDrop.guessLatLng) {
    return false;
  }

  const target = state.pinDrop.currentTarget;
  const guess = state.pinDrop.guessLatLng;
  const scaleKm = getPinDropScaleKm(target);
  const perfectRadiusKm = getPinDropPerfectRadiusKm(target);

  let distRes;
  if ((target.kind === "town" || target.kind === "county") && target.ref && target.ref.geojsonGeometry) {
    distRes = computeDistanceToGeoJson(guess.lat, guess.lng, target.ref.geojsonGeometry);
  } else {
    const dKm = haversineDistanceKm(guess.lat, guess.lng, target.lat, target.lng);
    distRes = {
      inside: dKm <= perfectRadiusKm,
      distanceKm: dKm,
      nearestLat: target.lat,
      nearestLng: target.lng
    };
  }

  const score = distRes.inside
    ? 5000
    : computePinDropScore(distRes.distanceKm, scaleKm, perfectRadiusKm);

  const record = {
    round: state.pinDrop.currentRound,
    targetId: target.id,
    rawId: target.rawId,
    kind: target.kind,
    poiCategory: target.poiCategory || null,
    title: target.shortLabel,
    promptTitle: target.promptTitle,
    guessLat: guess.lat,
    guessLng: guess.lng,
    nearestLat: distRes.nearestLat,
    nearestLng: distRes.nearestLng,
    inside: Boolean(distRes.inside),
    distanceKm: Number(distRes.distanceKm),
    score: Number(score)
  };

  state.pinDrop.phase = "revealed";
  state.pinDrop.totalScore += record.score;
  state.pinDrop.lastReveal = record;
  state.pinDrop.history.push(record);

  if (state.stats) {
    state.stats.totalAttempts++;
    if (record.score >= 2500) {
      state.stats.correctAttempts++;
      state.stats.streak++;
      if (state.stats.streak > state.stats.maxStreak) {
        state.stats.maxStreak = state.stats.streak;
      }
    } else {
      state.stats.streak = 0;
    }
  }

  if (typeof playTone === "function") {
    playTone(record.score >= 4500 ? "tier" : record.score >= 2000 ? "unlock" : "error");
  }

  renderPinDropRevealLayers(target, record);
  updatePinDropBannerAndDockUI();
  if (typeof updateScoreAndProgressUI === "function") {
    updateScoreAndProgressUI();
  }

  if (typeof setFeedback === "function") {
    const msg = record.inside
      ? `🎯 滿分命中【${target.shortLabel}】！距離 0.0 km · +5,000 分`
      : `📏 揭曉【${target.shortLabel}】：距離最近邊界 ${record.distanceKm.toFixed(1)} km · +${record.score.toLocaleString()} 分`;
    setFeedback(msg, record.score >= 3500 ? "success" : "tier");
  }
  return true;
}

function nextPinDropRound() {
  if (typeof state === "undefined" || state.playMode !== "pin_drop" || !state.pinDrop) return false;
  if (state.pinDrop.phase !== "revealed") return false;

  const isLastFixedRound =
    state.pinDrop.totalRounds > 0 && state.pinDrop.currentRound >= state.pinDrop.totalRounds;
  if (isLastFixedRound) {
    return finishPinDropGame();
  }
  return beginPinDropRound();
}

function computePinDropSummaryStats() {
  const pd = (typeof state !== "undefined" && state.pinDrop) || { history: [], totalScore: 0, totalRounds: 10 };
  const history = Array.isArray(pd.history) ? pd.history : [];
  const roundsPlayed = history.length;
  const totalScore = Number(pd.totalScore || 0);
  const maxPossibleScore = (pd.totalRounds > 0 ? pd.totalRounds : Math.max(1, roundsPlayed)) * 5000;
  const avgDist =
    roundsPlayed > 0
      ? history.reduce((acc, r) => acc + Number(r.distanceKm || 0), 0) / roundsPlayed
      : 0;
  let bestRound = null;
  for (let i = 0; i < history.length; i++) {
    const r = history[i];
    if (
      !bestRound ||
      r.score > bestRound.score ||
      (r.score === bestRound.score && r.distanceKm < bestRound.distanceKm)
    ) {
      bestRound = r;
    }
  }
  return {
    roundsPlayed,
    totalScore,
    maxPossibleScore,
    averageDistanceKm: avgDist,
    bestRound,
    history
  };
}

function finishPinDropGame() {
  if (typeof state === "undefined" || !state.pinDrop) return false;
  if (typeof stopTimer === "function") stopTimer();
  state.pinDrop.phase = "finished";

  const stats = computePinDropSummaryStats();
  const modal = document.getElementById("modal-pindrop-summary");
  const scoreEl = document.getElementById("pindrop-summary-total-score");
  const maxEl = document.getElementById("pindrop-summary-max-score");
  const avgEl = document.getElementById("pindrop-summary-avg-dist");
  const bestEl = document.getElementById("pindrop-summary-best-round");
  const listEl = document.getElementById("pindrop-summary-list");

  if (scoreEl) scoreEl.textContent = stats.totalScore.toLocaleString();
  if (maxEl) maxEl.textContent = `/ ${stats.maxPossibleScore.toLocaleString()} 分`;
  if (avgEl) avgEl.textContent = `${stats.averageDistanceKm.toFixed(1)} km`;
  if (bestEl) {
    bestEl.textContent = stats.bestRound
      ? `${stats.bestRound.title} (${stats.bestRound.distanceKm.toFixed(1)} km · +${stats.bestRound.score.toLocaleString()} 分)`
      : "尚無紀錄";
  }

  if (listEl) {
    listEl.replaceChildren();
    const tpl = document.getElementById("tpl-pindrop-history-row");
    stats.history.forEach((item) => {
      let row;
      if (tpl && tpl.content && tpl.content.firstElementChild) {
        row = tpl.content.firstElementChild.cloneNode(true);
        const rNum = row.querySelector(".pindrop-row-round");
        const rTitle = row.querySelector(".pindrop-row-title");
        const rDist = row.querySelector(".pindrop-row-dist");
        const rScore = row.querySelector(".pindrop-row-score");
        if (rNum) rNum.textContent = `#${item.round}`;
        if (rTitle) rTitle.textContent = item.title;
        if (rDist) rDist.textContent = item.inside ? "🎯 0.0 km (境內)" : `${item.distanceKm.toFixed(1)} km`;
        if (rScore) rScore.textContent = `+${item.score.toLocaleString()} 分`;
      } else {
        row = document.createElement("div");
        row.textContent = `#${item.round} ${item.title} · ${item.distanceKm.toFixed(1)} km · +${item.score} 分`;
      }
      listEl.appendChild(row);
    });
  }

  if (modal) {
    modal.classList.remove("hidden");
  }
  if (typeof syncModalBodyScrollLock === "function") {
    syncModalBodyScrollLock();
  }
  updatePinDropBannerAndDockUI();
  if (typeof updateScoreAndProgressUI === "function") {
    updateScoreAndProgressUI();
  }
  return true;
}

function exitPinDropMode() {
  if (typeof setPlayMode === "function") {
    setPlayMode("free");
  } else {
    state.playMode = "free";
    restorePinDropEnvironment();
  }
}

function setPinDropRounds(rounds) {
  const r = parseInt(rounds, 10);
  if (![0, 5, 10, 20].includes(r)) return;
  if (typeof canLocalModifyGameConfig === "function" && !canLocalModifyGameConfig()) return;
  state.pinDropRounds = r;
  if (typeof syncConfigButtonsUI === "function") syncConfigButtonsUI();
  if (state.playMode === "pin_drop") {
    startPinDropGame();
  }
}

function setPinDropBaseLayer(layerKey) {
  if (!["vector", "terrain", "satellite"].includes(layerKey)) return;
  state.pinDropBaseLayer = layerKey;
  if (typeof syncConfigButtonsUI === "function") syncConfigButtonsUI();
  if (state.playMode === "pin_drop" && typeof setMapBaseLayer === "function") {
    setMapBaseLayer(layerKey, true);
  }
}

function setPinDropShowBorders(visible) {
  const nextVal = Boolean(visible);
  state.pinDropShowBorders = nextVal;
  if (typeof syncConfigButtonsUI === "function") syncConfigButtonsUI();
  if (state.playMode === "pin_drop") {
    if (typeof window !== "undefined" && typeof window.setDistrictBordersVisible === "function") {
      window.setDistrictBordersVisible(nextVal, true);
    } else {
      state.showDistrictBorders = nextVal;
      if (typeof refreshAllPolygonStyles === "function") refreshAllPolygonStyles();
    }
  }
}

// -------------------------------------------------------------------------
// 5. UI SYNCHRONIZATION (Target Banner, Bottom Control Bar & Dashboard)
// -------------------------------------------------------------------------
function updatePinDropBannerAndDockUI() {
  if (typeof state === "undefined") return;
  const isPin = state.playMode === "pin_drop";
  const ansForm = document.getElementById("answer-form");
  const footerEl = document.getElementById("input-occludable-footer");
  const pinBar = document.getElementById("pindrop-dock-bar");

  if (!isPin) {
    if (pinBar) pinBar.classList.add("hidden");
    if (ansForm) ansForm.classList.remove("hidden");
    if (footerEl) footerEl.classList.remove("hidden");
    return;
  }

  if (ansForm) ansForm.classList.add("hidden");
  if (footerEl) footerEl.classList.add("hidden");
  if (pinBar) pinBar.classList.remove("hidden");

  const pd = state.pinDrop || {};
  const target = pd.currentTarget;
  const roundLabel =
    pd.totalRounds > 0
      ? `第 ${pd.currentRound} / ${pd.totalRounds} 題`
      : `第 ${pd.currentRound} 題 (無盡模式)`;

  // Update top target banner (#target-quiz-banner)
  const banner = document.getElementById("target-quiz-banner");
  const titleEl = document.getElementById("target-banner-title");
  const badgeEl = document.getElementById("target-hint-badge");
  const descEl = document.getElementById("target-banner-desc");

  if (banner) {
    banner.classList.remove("hidden");
    document.getElementById("target-dir-group")?.classList.add("hidden");
    document.getElementById("btn-target-next")?.classList.add("hidden");
    document.getElementById("btn-target-hint")?.classList.add("hidden");
    document.getElementById("btn-target-reveal-outline")?.classList.add("hidden");
    document.getElementById("btn-target-exit")?.classList.remove("hidden");

    if (titleEl) {
      titleEl.textContent = target ? target.promptTitle : "📍 給地名標座標挑戰";
    }
    if (badgeEl) {
      badgeEl.textContent = `${roundLabel} · 總分 ${(pd.totalScore || 0).toLocaleString()}`;
    }
    if (descEl) {
      if (pd.phase === "placing") {
        descEl.textContent = pd.guessLatLng
          ? `已標記預覽位置 (${pd.guessLatLng.lat.toFixed(3)}°N, ${pd.guessLatLng.lng.toFixed(3)}°E)，確認無誤請點下方「📍 確認標記」或按空白鍵 / Enter 送出`
          : "請在地圖上點擊目標所在位置放置藍色預覽圖釘（手機可點擊多次微調位置，不會直接送出）";
      } else if (pd.phase === "revealed" && pd.lastReveal) {
        const r = pd.lastReveal;
        descEl.textContent = r.inside
          ? `🎯 命中【${r.title}】境內！距離 0.0 km · 本題獲得滿分 +5,000 分`
          : `📏 距離【${r.title}】最近邊界 ${r.distanceKm.toFixed(1)} km · 本題獲得 +${r.score.toLocaleString()} 分`;
      } else {
        descEl.textContent = "本局標座標挑戰已結束，可查看結算明細或再玩一局！";
      }
    }
  }

  // Update bottom dock bar (#pindrop-dock-bar)
  const statusEl = document.getElementById("pindrop-coord-status");
  const confirmBtn = document.getElementById("btn-pindrop-confirm");
  const nextBtn = document.getElementById("btn-pindrop-next");
  const finishEndlessBtn = document.getElementById("btn-pindrop-finish-endless");

  if (statusEl) {
    if (pd.phase === "placing") {
      statusEl.textContent = pd.guessLatLng
        ? `📍 預覽座標：${pd.guessLatLng.lat.toFixed(4)}°N, ${pd.guessLatLng.lng.toFixed(4)}°E`
        : "👆 請先在地圖上點擊放置預覽圖釘";
    } else if (pd.phase === "revealed" && pd.lastReveal) {
      const r = pd.lastReveal;
      statusEl.textContent = r.inside
        ? `🎯 命中境內！0.0 km · +5,000 分`
        : `📏 誤差 ${r.distanceKm.toFixed(1)} km · +${r.score.toLocaleString()} 分`;
    } else {
      statusEl.textContent = `🏁 挑戰結束 · 總分 ${(pd.totalScore || 0).toLocaleString()} 分`;
    }
  }

  if (confirmBtn) {
    const showConfirm = pd.phase === "placing";
    confirmBtn.classList.toggle("hidden", !showConfirm);
    confirmBtn.disabled = !pd.guessLatLng;
  }

  if (nextBtn) {
    const showNext = pd.phase === "revealed";
    nextBtn.classList.toggle("hidden", !showNext);
    const isLastRound = pd.totalRounds > 0 && pd.currentRound >= pd.totalRounds;
    nextBtn.textContent = isLastRound ? "🏁 查看結算 (Space / Enter)" : "➡️ 下一題 (Space / Enter)";
  }

  if (finishEndlessBtn) {
    const showEndlessFinish = pd.totalRounds === 0 && pd.history && pd.history.length > 0 && pd.phase !== "finished";
    finishEndlessBtn.classList.toggle("hidden", !showEndlessFinish);
  }
}

function renderPinDropDashboardUI() {
  if (typeof state === "undefined" || state.playMode !== "pin_drop" || !state.pinDrop) return false;
  const pd = state.pinDrop;
  const completed = Array.isArray(pd.history) ? pd.history.length : 0;
  const totalRounds = pd.totalRounds || 0;
  const maxScore = (totalRounds > 0 ? totalRounds : Math.max(1, completed)) * 5000;
  const scorePct = maxScore > 0 ? ((pd.totalScore / maxScore) * 100).toFixed(1) : "0.0";
  const roundPct = totalRounds > 0 ? ((completed / totalRounds) * 100).toFixed(1) : "100.0";
  const avgDist =
    completed > 0
      ? (pd.history.reduce((s, r) => s + r.distanceKm, 0) / completed).toFixed(1)
      : "0.0";

  // Top Header
  const topLabel = document.getElementById("top-metric-label");
  const topScore = document.getElementById("top-score-display");
  const topPct = document.getElementById("top-percent-display");
  const topBar = document.getElementById("top-main-progress-bar");
  if (topLabel) topLabel.textContent = "標座標得分";
  if (topScore) {
    topScore.textContent = totalRounds > 0
      ? `${pd.totalScore.toLocaleString()} / ${(totalRounds * 5000).toLocaleString()}`
      : `${pd.totalScore.toLocaleString()} 分`;
  }
  if (topPct) {
    topPct.textContent = totalRounds > 0
      ? `第 ${pd.currentRound} / ${totalRounds} 題`
      : `第 ${pd.currentRound} 題 (無盡)`;
  }
  if (topBar) {
    topBar.style.width = `${Math.min(100, parseFloat(roundPct))}%`;
  }

  // Dual Cards
  const cLabel = document.getElementById("stat-county-label");
  const cCount = document.getElementById("stat-county-count");
  const cPct = document.getElementById("stat-county-pct");
  const cBar = document.getElementById("stat-county-bar");
  if (cLabel) cLabel.textContent = "🎯 回合進度";
  if (cCount) {
    cCount.textContent = totalRounds > 0
      ? `第 ${pd.currentRound} / ${totalRounds} 題`
      : `第 ${pd.currentRound} 題 · 無盡`;
  }
  if (cPct) cPct.textContent = `${roundPct}%`;
  if (cBar) cBar.style.width = `${Math.min(100, parseFloat(roundPct))}%`;

  const tLabel = document.getElementById("stat-town-label");
  const tCount = document.getElementById("stat-town-count");
  const tPct = document.getElementById("stat-town-pct");
  const tBar = document.getElementById("stat-town-bar");
  if (tLabel) tLabel.textContent = "🏆 累積總分";
  if (tCount) tCount.textContent = `${pd.totalScore.toLocaleString()} 分`;
  if (tPct) tPct.textContent = `均誤 ${avgDist} km`;
  if (tBar) tBar.style.width = `${Math.min(100, parseFloat(scorePct))}%`;

  // Hide quick-jump county chips during pin_drop so no county hints leak
  const qBar = document.getElementById("quick-zoom-counties-bar");
  const mBar = document.getElementById("map-jump-counties-bar");
  if (qBar) qBar.replaceChildren();
  if (mBar) mBar.replaceChildren();

  // Sidebar breakdown list: ONLY show already-revealed round history (NEVER upcoming queue items!)
  const listTitle = document.getElementById("breakdown-list-title");
  const container = document.getElementById("county-progress-list");
  if (listTitle) listTitle.textContent = "📍 已揭曉回合紀錄";
  if (container) {
    container.replaceChildren();
    const tpl = document.getElementById("tpl-pindrop-history-row");
    if (completed === 0) {
      const emptyEl = document.createElement("div");
      emptyEl.className = "text-xs text-slate-400 italic p-3 text-center";
      emptyEl.textContent = "尚無已揭曉題目（確認標記送出後將顯示每題誤差距離與得分）";
      container.appendChild(emptyEl);
    } else {
      pd.history.slice().reverse().forEach((item) => {
        let row;
        if (tpl && tpl.content && tpl.content.firstElementChild) {
          row = tpl.content.firstElementChild.cloneNode(true);
          const rNum = row.querySelector(".pindrop-row-round");
          const rTitle = row.querySelector(".pindrop-row-title");
          const rDist = row.querySelector(".pindrop-row-dist");
          const rScore = row.querySelector(".pindrop-row-score");
          if (rNum) rNum.textContent = `#${item.round}`;
          if (rTitle) rTitle.textContent = item.title;
          if (rDist) rDist.textContent = item.inside ? "🎯 0.0 km" : `${item.distanceKm.toFixed(1)} km`;
          if (rScore) rScore.textContent = `+${item.score.toLocaleString()} 分`;
        } else {
          row = document.createElement("div");
          row.className = "flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs";
          row.textContent = `#${item.round} ${item.title} · ${item.distanceKm.toFixed(1)} km · +${item.score} 分`;
        }
        container.appendChild(row);
      });
    }
  }
  return true;
}
