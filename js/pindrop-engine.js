// =========================================================================
// PIN-DROP ENGINE (TRACK-B: 給地名標座標模式 — Pure JS Geometry, Scoring & State Machine)
// Strictly zero .innerHTML, file:// compatible, zero external dependencies.
// =========================================================================

let pinDropLayerGroup = null;
let pinDropHistoryLayerGroup = null;
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
  let pLng = Number(px);
  const pLat = Number(py);
  const aLng = Number(ax);
  const aLat = Number(ay);
  const bLng = Number(bx);
  const bLat = Number(by);
  const segMidLng = (aLng + bLng) / 2;
  if (Number.isFinite(pLng) && Number.isFinite(segMidLng) && Math.abs(pLng - segMidLng) > 180) {
    pLng = segMidLng + (((((pLng - segMidLng + 180) % 360) + 360) % 360) - 180);
  }

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
  const rawLng = Number(lng);
  if (!Number.isFinite(qLat) || !Number.isFinite(rawLng) || !geometry) {
    return { inside: false, distanceKm: Infinity, nearestLat: qLat, nearestLng: rawLng };
  }
  const qLng = rawLng > 180 || rawLng < -180
    ? ((((rawLng + 180) % 360) + 360) % 360) - 180
    : rawLng;

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

function computePinDropCountdownBonus(baseScore, remainingMs, totalMs, enabled = true) {
  if (!enabled) return 0;
  const base = Number(baseScore);
  const rem = Number(remainingMs);
  const tot = Number(totalMs);
  if (!Number.isFinite(base) || base <= 0) return 0;
  if (!Number.isFinite(rem) || !Number.isFinite(tot) || tot <= 0 || rem <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, rem / tot));
  return Math.round(base * 0.2 * ratio);
}

function isPinDropCountdownBonusActive() {
  return Boolean(
    typeof state !== "undefined" &&
      state.questionCountdownEnabled &&
      state.pinDropCountdownBonus !== false
  );
}

function getPinDropMaxRoundScore(history = null) {
  if (isPinDropCountdownBonusActive()) return 6000;
  if (Array.isArray(history) && history.some((r) => Number(r && r.speedBonus) > 0)) return 6000;
  return 5000;
}

function cancelPinDropAutoNext() {
  if (typeof state !== "undefined" && state.questionTimer && state.questionTimer.autoNextTimerId) {
    clearTimeout(state.questionTimer.autoNextTimerId);
    state.questionTimer.autoNextTimerId = null;
  }
}

function schedulePinDropAutoNext(delayMs = 2000) {
  cancelPinDropAutoNext();
  if (typeof state === "undefined" || !state.questionCountdownEnabled || state.playMode !== "pin_drop") return;
  if (!state.pinDrop || state.pinDrop.phase !== "revealed") return;
  if (!state.questionTimer) return;
  state.questionTimer.autoNextTimerId = setTimeout(() => {
    if (state.questionTimer) state.questionTimer.autoNextTimerId = null;
    if (state.playMode === "pin_drop" && state.pinDrop && state.pinDrop.phase === "revealed") {
      nextPinDropRound();
    }
  }, delayMs);
}

function getPinDropScaleKm(target = null) {
  const itemScale = target && target.ref && Number.isFinite(target.ref._pinDropScaleKm)
    ? target.ref._pinDropScaleKm
    : null;
  const packScale =
    typeof getActiveMapPack === "function"
      ? getActiveMapPack()?.mapView?.pinDropScaleKm
      : null;
  const isCounty =
    (target && target.kind === "county") ||
    (!target && typeof state !== "undefined" && state.difficulty === "county_only");
  if (Number.isFinite(itemScale) && itemScale > 0) {
    return isCounty && itemScale === 25 ? 40 : itemScale;
  }
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
function getDuplicateTownNameSet() {
  const items =
    typeof getActiveItems === "function"
      ? getActiveItems()
      : typeof ALL_TOWNS !== "undefined" && Array.isArray(ALL_TOWNS)
      ? ALL_TOWNS
      : [];
  const counts = new Map();
  for (let i = 0; i < items.length; i++) {
    const n = String((items[i] && items[i].townName) || "").trim();
    if (!n) continue;
    counts.set(n, (counts.get(n) || 0) + 1);
  }
  const dups = new Set();
  counts.forEach((cnt, name) => {
    if (cnt > 1) dups.add(name);
  });
  return dups;
}

function getDuplicatePoiNameSet() {
  const twPois =
    typeof TAIWAN_POI_DATA !== "undefined" && Array.isArray(TAIWAN_POI_DATA)
      ? TAIWAN_POI_DATA
      : [];
  const capPois =
    typeof getActiveCapitalPois === "function"
      ? getActiveCapitalPois(false)
      : [];
  const pois = capPois.length > 0 ? twPois.concat(capPois) : twPois;
  const counts = new Map();
  for (let i = 0; i < pois.length; i++) {
    const n = String((pois[i] && pois[i].name) || "").trim();
    if (!n) continue;
    counts.set(n, (counts.get(n) || 0) + 1);
  }
  const dups = new Set();
  counts.forEach((cnt, name) => {
    if (cnt > 1) dups.add(name);
  });
  return dups;
}

function formatPinDropTownPrompt(countyName, townName, isSingle, hideCounty, dupTownNames) {
  if (isSingle || !countyName) return `📍 請在地圖上標出：${townName}`;
  if (hideCounty) {
    const isDup = dupTownNames instanceof Set && dupTownNames.has(townName);
    return isDup
      ? `📍 請在地圖上標出：${countyName} ${townName}（重名指定）`
      : `📍 請在地圖上標出：${townName}`;
  }
  return `📍 請在地圖上標出：${countyName} ${townName}`;
}

function getPinDropDisplayPromptTitle(target) {
  if (!target) return "📍 給地名標座標挑戰";
  if (target.kind === "town") {
    const isSubLayer = Boolean(target.ref && target.ref._isSubLayerItem);
    const isSingle = isSubLayer ? false : (typeof isActivePackSingleLayer === "function" && isActivePackSingleLayer());
    const hideCounty = typeof state !== "undefined" && Boolean(state.pinDropHideCounty);
    const dups = target._isDuplicateTownName ? new Set([target.townName]) : getDuplicateTownNameSet();
    return formatPinDropTownPrompt(target.countyName, target.townName, isSingle, hideCounty, dups);
  }
  return target.promptTitle || "📍 給地名標座標挑戰";
}

function buildPinDropTargetFromTown(t, dupTownNames = null) {
  if (!t) return null;
  const pt = t.mainPoint && Number.isFinite(t.mainPoint.lat) ? t.mainPoint : { lat: t.lat, lng: t.lng };
  const isSingle = t._isSubLayerItem ? false : (typeof isActivePackSingleLayer === "function" && isActivePackSingleLayer());
  const uLabels = typeof getActivePackUnitLabels === "function" ? getActivePackUnitLabels() : { item: "鄉鎮市區" };
  const dups = dupTownNames instanceof Set ? dupTownNames : getDuplicateTownNameSet();
  const hideCounty = typeof state !== "undefined" && Boolean(state.pinDropHideCounty);
  return {
    kind: "town",
    id: `town:${t.id}`,
    rawId: t.id,
    countyName: t.countyName,
    townName: t.townName,
    _isDuplicateTownName: dups.has(t.townName),
    promptTitle: formatPinDropTownPrompt(t.countyName, t.townName, isSingle, hideCounty, dups),
    shortLabel: isSingle ? t.townName : `${t.countyName}${t.townName}`,
    categoryLabel: uLabels.item || "鄉鎮市區",
    badgeText: t.countyName,
    lat: Number(pt.lat),
    lng: Number(pt.lng),
    ref: t
  };
}

function buildPinDropTargetFromCounty(c) {
  if (!c) return null;
  const pt = c.mainPoint && Number.isFinite(c.mainPoint.lat) ? c.mainPoint : { lat: c.lat, lng: c.lng };
  const pack = typeof getActiveMapPack === "function" ? getActiveMapPack() : null;
  const isTw = !pack || pack.id === "tw_modern";
  const uLabels = typeof getActivePackUnitLabels === "function" ? getActivePackUnitLabels() : { group: "縣市" };
  return {
    kind: "county",
    id: `county:${c.name}`,
    rawId: c.name,
    countyName: c.name,
    promptTitle: `📍 請在地圖上標出：${c.name}`,
    shortLabel: c.name,
    categoryLabel: isTw ? "縣市行政區" : (uLabels.group || "縣市行政區"),
    badgeText: c.province || (isTw ? "22縣市" : (uLabels.group || "分區")),
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

function buildPinDropTargetFromPoi(p, dupPoiNames = null) {
  if (!p) return null;
  const displayCat = typeof getPoiDisplayCategory === "function" ? getPoiDisplayCategory(p) : p.category;
  const catMeta =
    (typeof POI_CATEGORY_META !== "undefined" && POI_CATEGORY_META[displayCat]) || {
      icon: "📍",
      label: "地標"
    };
  const catLabel = typeof getPoiCategoryLabel === "function" ? getPoiCategoryLabel(displayCat) : catMeta.label;
  const dups = dupPoiNames instanceof Set ? dupPoiNames : getDuplicatePoiNameSet();
  const isDup = dups.has(String(p.name || "").trim());
  const locStr = typeof formatPoiLocationText === "function" ? formatPoiLocationText(p) : `${p.countyName || ""}${p.townName || ""}`;
  const locPrefix = isDup && locStr ? `${locStr} · ` : "";
  const displayName = `${locPrefix}${p.name}`;
  return {
    kind: "poi",
    poiCategory: displayCat,
    id: `poi:${p.id}`,
    rawId: p.id,
    promptTitle: `${catMeta.icon} 請在地圖上標出：${displayName}`,
    shortLabel: isDup ? displayName : (p.shortName || p.name),
    categoryLabel: catLabel,
    badgeText: `${catMeta.icon} ${catLabel}`,
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
      const dupTowns = getDuplicateTownNameSet();
      towns.forEach((t) => {
        const item = buildPinDropTargetFromTown(t, dupTowns);
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
    const dupPois = getDuplicatePoiNameSet();
    getActiveQuizPois().forEach((p) => {
      const item = buildPinDropTargetFromPoi(p, dupPois);
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

function ensurePinDropHistoryLayerGroup() {
  if (typeof map === "undefined" || !map || typeof L === "undefined") return null;
  if (!pinDropHistoryLayerGroup) {
    pinDropHistoryLayerGroup = L.layerGroup().addTo(map);
  } else if (typeof map.hasLayer === "function" && !map.hasLayer(pinDropHistoryLayerGroup)) {
    pinDropHistoryLayerGroup.addTo(map);
  }
  return pinDropHistoryLayerGroup;
}

function clearPinDropHistoryLayers() {
  if (pinDropHistoryLayerGroup && typeof pinDropHistoryLayerGroup.clearLayers === "function") {
    pinDropHistoryLayerGroup.clearLayers();
  }
}

function renderPinDropGuessedHistoryMarkers() {
  clearPinDropHistoryLayers();
  if (
    typeof state === "undefined" ||
    state.playMode !== "pin_drop" ||
    state.pinDropHideGuessed !== false ||
    !state.pinDrop ||
    !Array.isArray(state.pinDrop.history)
  ) {
    return;
  }
  const group = ensurePinDropHistoryLayerGroup();
  if (!group || typeof L === "undefined") return;
  const curTargetId =
    state.pinDrop.phase === "revealed" && state.pinDrop.currentTarget
      ? state.pinDrop.currentTarget.id
      : null;
  state.pinDrop.history.forEach((rec) => {
    if (!rec || (rec.kind !== "poi" && rec.kind !== "station")) return;
    if (curTargetId && rec.targetId === curTargetId) return;
    if (!Number.isFinite(rec.nearestLat) || !Number.isFinite(rec.nearestLng)) return;
    const dot = document.createElement("div");
    dot.className = "w-2.5 h-2.5 rounded-full bg-sky-400/80 border border-sky-200 shadow";
    dot.title = rec.title || "";
    const icon = L.divIcon({
      className: "pindrop-history-dot-wrapper",
      html: dot,
      iconSize: [10, 10],
      iconAnchor: [5, 5]
    });
    L.marker([rec.nearestLat, rec.nearestLng], {
      icon,
      interactive: false,
      keyboard: false,
      zIndexOffset: 900
    }).addTo(group);
  });
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

function isPinDropGuessedPolygon(townObj) {
  if (
    typeof state === "undefined" ||
    state.playMode !== "pin_drop" ||
    state.pinDropHideGuessed !== false ||
    !state.pinDrop ||
    !Array.isArray(state.pinDrop.history) ||
    !townObj
  ) {
    return false;
  }
  const curTargetId =
    state.pinDrop.phase === "revealed" && state.pinDrop.currentTarget
      ? state.pinDrop.currentTarget.id
      : null;
  for (let i = 0; i < state.pinDrop.history.length; i++) {
    const rec = state.pinDrop.history[i];
    if (!rec || (curTargetId && rec.targetId === curTargetId)) continue;
    if (rec.kind === "town" && rec.rawId === townObj.id) return true;
    if (rec.kind === "county" && rec.rawId === townObj.countyName) return true;
  }
  return false;
}

function renderPinDropTargetOutlinePreview(target) {
  const host = document.getElementById("pindrop-target-outline-preview");
  if (!host) return false;
  const shouldShow = Boolean(
    typeof state !== "undefined" &&
      state.playMode === "pin_drop" &&
      state.pinDropShowTargetOutline !== false &&
      target &&
      (target.kind === "town" || target.kind === "county") &&
      target.ref &&
      target.ref.geojsonGeometry
  );
  if (!shouldShow) {
    host.classList.add("hidden");
    host.replaceChildren();
    return false;
  }
  const rings = collectGeoJsonRings(target.ref.geojsonGeometry, []);
  if (!rings.length) {
    host.classList.add("hidden");
    host.replaceChildren();
    return false;
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let latSum = 0, latCnt = 0;
  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    for (let i = 0; i < ring.length; i++) {
      const x = Number(ring[i][0]);
      const y = Number(ring[i][1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      latSum += y;
      latCnt++;
    }
  }
  if (latCnt === 0) {
    host.classList.add("hidden");
    host.replaceChildren();
    return false;
  }
  const cosLat = Math.cos(((latSum / latCnt) * Math.PI) / 180);
  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    for (let i = 0; i < ring.length; i++) {
      const px = Number(ring[i][0]) * cosLat;
      const py = Number(ring[i][1]);
      if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
  }
  const spanX = Math.max(1e-6, maxX - minX);
  const spanY = Math.max(1e-6, maxY - minY);
  const pad = 4;
  const box = 48;
  const scale = (box - pad * 2) / Math.max(spanX, spanY);
  const offX = (box - spanX * scale) / 2;
  const offY = (box - spanY * scale) / 2;
  const pathParts = [];
  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    if (ring.length < 3) continue;
    let seg = "";
    for (let i = 0; i < ring.length; i++) {
      const sx = offX + (Number(ring[i][0]) * cosLat - minX) * scale;
      const sy = box - (offY + (Number(ring[i][1]) - minY) * scale);
      if (!Number.isFinite(sx) || !Number.isFinite(sy)) continue;
      seg += `${i === 0 ? "M" : "L"}${sx.toFixed(1)},${sy.toFixed(1)}`;
    }
    if (seg) pathParts.push(`${seg}Z`);
  }
  if (!pathParts.length) {
    host.classList.add("hidden");
    host.replaceChildren();
    return false;
  }
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${box} ${box}`);
  svg.setAttribute("class", "w-full h-full");
  svg.setAttribute("aria-hidden", "true");
  const pathEl = document.createElementNS(svgNS, "path");
  pathEl.setAttribute("d", pathParts.join(" "));
  pathEl.setAttribute("fill", "rgba(251, 191, 36, 0.22)");
  pathEl.setAttribute("stroke", "#fcd34d");
  pathEl.setAttribute("stroke-width", "1.6");
  pathEl.setAttribute("stroke-linejoin", "round");
  svg.appendChild(pathEl);
  host.replaceChildren(svg);
  host.classList.remove("hidden");
  return true;
}

function renderPinDropRevealLayers(target, record) {
  const group = ensurePinDropLayerGroup();
  if (!group || typeof L === "undefined" || !target || !record) return;

  const hasGuess = Number.isFinite(record.guessLat) && Number.isFinite(record.guessLng);
  const packMv = typeof getActivePackMapView === "function" ? getActivePackMapView() : null;
  const useWorldWrap = Boolean(packMv && packMv.worldCopyJump);
  const displayGuessLng = hasGuess ? record.guessLng : record.nearestLng;
  const displayNearestLng =
    useWorldWrap && hasGuess && typeof getClosestWrappedLng === "function"
      ? getClosestWrappedLng(record.nearestLng, displayGuessLng)
      : record.nearestLng;
  const targetLngShift = displayNearestLng - record.nearestLng;

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
    pinTargetRevealLayer = L.marker([target.lat, target.lng + targetLngShift], {
      icon: tIcon,
      interactive: false,
      keyboard: false,
      zIndexOffset: 940
    }).addTo(group);
  }

  // 2. Amber dashed polyline from player's guess to nearest boundary point / target point
  if (hasGuess) {
    pinDashPolyline = L.polyline(
      [
        [record.guessLat, displayGuessLng],
        [record.nearestLat, displayNearestLng]
      ],
      {
        renderer: typeof canvasRenderer !== "undefined" && canvasRenderer ? canvasRenderer : undefined,
        color: "#f59e0b",
        weight: 3,
        dashArray: "8, 6",
        opacity: 0.95,
        interactive: false
      }
    ).addTo(group);
  }

  // 3. Midpoint pill badge showing distance km & score (floated above midpoint so it never covers pins)
  const midLat = hasGuess ? (record.guessLat + record.nearestLat) / 2 : target.lat;
  const midLng = hasGuess ? (displayGuessLng + displayNearestLng) / 2 : target.lng + targetLngShift;
  const pill = document.createElement("div");
  pill.className = record.inside
    ? "pindrop-midpoint-pill pindrop-midpoint-perfect"
    : "pindrop-midpoint-pill";
  const bonusStr = Number(record.speedBonus) > 0 ? ` (含⚡+${Number(record.speedBonus).toLocaleString()})` : "";
  if (!hasGuess && record.timedOut) {
    pill.textContent = `⌛ 超時未標記 · +0 分`;
  } else if (record.inside && (target.kind === "town" || target.kind === "county")) {
    pill.textContent = `🎯 命中境內！0.0 km · +${record.score.toLocaleString()} 分${bonusStr}`;
  } else if (record.inside) {
    pill.textContent = `🎯 精準命中！${record.distanceKm.toFixed(2)} km · +${record.score.toLocaleString()} 分${bonusStr}`;
  } else {
    pill.textContent = `${record.distanceKm.toFixed(1)} km · +${record.score.toLocaleString()} 分${bonusStr}`;
  }

  const pillIcon = L.divIcon({
    className: "pindrop-midpoint-icon-wrapper",
    html: pill,
    iconSize: [210, 28],
    iconAnchor: [105, 38]
  });
  pinMidpointMarker = L.marker([midLat, midLng], {
    icon: pillIcon,
    interactive: false,
    keyboard: false,
    zIndexOffset: 960
  }).addTo(group);

  // 4. Auto fitBounds framing player pin + target (snappy 0.25s)
  if (typeof map !== "undefined" && map && typeof L.latLngBounds === "function") {
    const frameBounds = hasGuess
      ? L.latLngBounds([record.guessLat, displayGuessLng], [record.nearestLat, displayNearestLng])
      : L.latLngBounds([target.lat, target.lng + targetLngShift], [target.lat, target.lng + targetLngShift]);
    const refObj = target.ref;
    if (refObj) {
      const tb =
        refObj.mainBounds && typeof refObj.mainBounds.isValid === "function" && refObj.mainBounds.isValid()
          ? refObj.mainBounds
          : refObj.bounds && typeof refObj.bounds.isValid === "function" && refObj.bounds.isValid()
          ? refObj.bounds
          : null;
      if (tb) {
        if (targetLngShift !== 0) {
          const sw = tb.getSouthWest();
          const ne = tb.getNorthEast();
          frameBounds.extend([sw.lat, sw.lng + targetLngShift]);
          frameBounds.extend([ne.lat, ne.lng + targetLngShift]);
        } else {
          frameBounds.extend(tb);
        }
      } else if (Number.isFinite(target.lat) && Number.isFinite(target.lng)) {
        frameBounds.extend([target.lat, target.lng + targetLngShift]);
      }
    }
    if (frameBounds.isValid()) {
      const maxZ = target.kind === "county" ? 10 : 12;
      map.fitBounds(frameBounds.pad(0.18), { padding: [60, 60], maxZoom: maxZ, animate: true, duration: 0.25 });
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

function syncPinDropLayerLockUI() {
  const isPin = typeof state !== "undefined" && state.playMode === "pin_drop";
  const locked = Boolean(isPin && state.pinDropLockBaseLayer);
  const switcher = document.getElementById("layer-switcher-pill");
  const badge = document.getElementById("layer-lock-badge");

  if (switcher) {
    switcher.classList.toggle("opacity-60", locked);
  }
  if (badge) {
    if (locked) {
      const layerNames = { satellite: "衛星", terrain: "地形", vector: "純輪廓" };
      const lbl = layerNames[state.pinDropBaseLayer || "satellite"] || "底圖";
      badge.className = "apple-glass-pill px-2.5 py-1 rounded-xl text-[11px] font-bold text-rose-300 border border-rose-500/40 pointer-events-auto";
      badge.textContent = `🔒 強制${lbl}`;
      badge.classList.remove("hidden");
    } else if (state.p2pLayerRule !== "locked") {
      badge.classList.add("hidden");
    }
  }
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

  // 1. Force label-free basemap (default: satellite; preserves player's last chosen basemap across rounds)
  const desiredBase = ["vector", "terrain", "satellite"].includes(state.pinDropBaseLayer)
    ? state.pinDropBaseLayer
    : "satellite";
  state.pinDropBaseLayer = desiredBase;
  if (state.mapLayer !== desiredBase) {
    if (typeof setMapBaseLayer === "function") {
      setMapBaseLayer(desiredBase, true);
    } else {
      state.mapLayer = desiredBase;
    }
  }
  syncPinDropLayerLockUI();

  // 2. Show township district borders by default unless explicitly toggled off in Pin-Drop settings
  const showBorders = Boolean(state.pinDropShowBorders);
  if (typeof window !== "undefined" && typeof window.setDistrictBordersVisible === "function") {
    window.setDistrictBordersVisible(showBorders, true);
  } else {
    state.showDistrictBorders = showBorders;
  }
  if (typeof map !== "undefined" && map && map.doubleClickZoom && typeof map.doubleClickZoom.disable === "function") {
    map.doubleClickZoom.disable();
  }

  // 3. Hide floating hover tooltips & declutter non-applicable Free-Mode toolbar/dashboard controls
  const tipEl = document.getElementById("floating-tip-popover");
  if (tipEl) tipEl.classList.add("hidden");
  const hoverTip = document.getElementById("hover-tip");
  if (hoverTip) {
    hoverTip.classList.add("hidden");
    hoverTip.textContent = "";
  }
  document.getElementById("map-rail-control-pill")?.classList.add("hidden");
  document.getElementById("btn-leader-mode")?.classList.add("hidden");
  document.getElementById("multi-category-progress-bars")?.classList.add("hidden");
  document.getElementById("quick-zoom-counties-section")?.classList.add("hidden");

  // 4. Refresh overlays so labels, station dots, and POI pins are hidden during pin_drop
  if (typeof updateRoadAndRailwayTileOverlays === "function") {
    updateRoadAndRailwayTileOverlays();
  }
  if (typeof refreshPoiMapLayer === "function") {
    refreshPoiMapLayer();
  }
  renderPinDropGuessedHistoryMarkers();
  if (typeof refreshAllPolygonStyles === "function") {
    refreshAllPolygonStyles();
  }
}

function restorePinDropEnvironment() {
  cancelPinDropAutoNext();
  if (typeof stopQuestionCountdown === "function") stopQuestionCountdown();
  clearPinDropLayers();
  clearPinDropHistoryLayers();
  document.getElementById("pindrop-target-outline-preview")?.classList.add("hidden");
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
  document.getElementById("map-rail-control-pill")?.classList.remove("hidden");
  document.getElementById("btn-leader-mode")?.classList.remove("hidden");
  document.getElementById("multi-category-progress-bars")?.classList.remove("hidden");
  document.getElementById("quick-zoom-counties-section")?.classList.remove("hidden");
  if (state.p2pLayerRule !== "locked") {
    document.getElementById("layer-switcher-pill")?.classList.remove("opacity-60");
    document.getElementById("layer-lock-badge")?.classList.add("hidden");
  }

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

  resetPinDropViewportToFullView();
  if (typeof map !== "undefined" && map && map.doubleClickZoom && typeof map.doubleClickZoom.enable === "function") {
    map.doubleClickZoom.enable();
  }
  if (typeof updateRoadAndRailwayTileOverlays === "function") updateRoadAndRailwayTileOverlays();
  if (typeof refreshPoiMapLayer === "function") refreshPoiMapLayer();
  if (typeof refreshAllPolygonStyles === "function") refreshAllPolygonStyles();
  if (typeof updateScoreAndProgressUI === "function") updateScoreAndProgressUI();
  if (typeof setFeedback === "function") {
    setFeedback("已切回自由輸入模式，請開始作答！", "info");
  }
}

function resetPinDropViewportToFullView() {
  if (typeof map === "undefined" || !map) return;
  const pack = typeof getActiveMapPack === "function" ? getActiveMapPack() : null;
  const mv = pack && pack.mapView ? pack.mapView : null;
  const packBounds =
    mv && mv.fullViewBounds
      ? L.latLngBounds(mv.fullViewBounds)
      : (!pack || pack.id === "tw_modern") && typeof TAIWAN_FULL_VIEW_BOUNDS !== "undefined"
      ? TAIWAN_FULL_VIEW_BOUNDS
      : null;
  if (packBounds && typeof map.fitBounds === "function") {
    map.fitBounds(packBounds, { padding: [20, 20], animate: false });
  } else if (mv && Array.isArray(mv.center) && typeof map.setView === "function") {
    map.setView(mv.center, Number.isFinite(mv.defaultZoom) ? mv.defaultZoom : 3, { animate: false });
  }
}

function startPinDropGame() {
  if (typeof state === "undefined") return false;
  state.playMode = "pin_drop";
  document.getElementById("modal-pindrop-summary")?.classList.add("hidden");

  const pool = buildPinDropCandidatePool();
  if (pool.length === 0) {
    const activeGroups = typeof getActiveGroups === "function" ? getActiveGroups() : TAIWAN_ADMIN_DATA;
    const activeItems = typeof getActiveItems === "function" ? getActiveItems() : ALL_TOWNS;
    if (typeof setFeedback === "function") {
      setFeedback("⚠️ 目前未啟用任何題庫，已自動載入全部區域題庫！", "warn");
    }
    state.regionQuizEnabled = true;
    state.selectedCounties = new Set(activeGroups.map((c) => c.name));
    state.selectedTownIds = new Set(activeItems.map((t) => t.id));
  }

  const activePool = buildPinDropCandidatePool();
  const shuffled = shufflePinDropArray(activePool);
  const cfgRounds = Number.isFinite(Number(state.pinDropRounds)) ? Number(state.pinDropRounds) : 10;
  const totalRounds = cfgRounds === 0 ? 0 : Math.min(Math.max(1, cfgRounds), Math.max(1, shuffled.length));
  const queue = totalRounds > 0 ? shuffled.slice(0, totalRounds) : shuffled;

  clearPinDropHistoryLayers();
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

  cancelPinDropAutoNext();
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

  // Strictly reset viewport to full view at the start of every new round
  resetPinDropViewportToFullView();
  ensurePinDropEnvironment();
  updatePinDropBannerAndDockUI();
  if (typeof startQuestionCountdown === "function") {
    if (state.questionCountdownEnabled) startQuestionCountdown();
    else if (typeof stopQuestionCountdown === "function") stopQuestionCountdown();
  }
  if (typeof updateScoreAndProgressUI === "function") {
    updateScoreAndProgressUI();
  }
  if (typeof setFeedback === "function") {
    const rushNote = state.questionCountdownEnabled
      ? `（⚡ ${state.questionCountdownSec || 15}秒倒數搶答${state.pinDropCountdownBonus !== false ? " · 越快越多加成" : ""}）`
      : "";
    setFeedback(`📍 第 ${state.pinDrop.currentRound} 題：點擊地圖放預覽圖釘或雙擊直接送出${rushNote}`, "info");
  }
  return true;
}

function handlePinDropMapDoubleClick(latlng) {
  if (typeof state === "undefined" || state.playMode !== "pin_drop") return false;
  if (state.role === "spectator" || !state.pinDrop || state.pinDrop.phase !== "placing") return false;
  if (!handlePinDropMapClick(latlng)) return false;
  return confirmPinDropGuess();
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
    const dispLng =
      (lng > 180 || lng < -180) && typeof normalizeWorldLng === "function"
        ? normalizeWorldLng(lng)
        : lng;
    setFeedback(
      `📍 已放置預覽標記 (${lat.toFixed(4)}°N, ${dispLng.toFixed(4)}°E)，可微調或按「確認標記」送出！`,
      "info"
    );
  }
  return true;
}

function handlePinDropCountdownTimeout() {
  if (typeof state === "undefined" || state.playMode !== "pin_drop" || !state.pinDrop) return false;
  if (state.pinDrop.phase !== "placing" || !state.pinDrop.currentTarget) return false;

  if (state.pinDrop.guessLatLng) {
    return confirmPinDropGuess({ timedOut: true, remainingMs: 0 });
  }

  const target = state.pinDrop.currentTarget;
  if (typeof stopQuestionCountdown === "function") stopQuestionCountdown();
  const record = {
    round: state.pinDrop.currentRound,
    targetId: target.id,
    rawId: target.rawId,
    kind: target.kind,
    poiCategory: target.poiCategory || null,
    title: target.shortLabel,
    promptTitle: target.promptTitle,
    guessLat: null,
    guessLng: null,
    nearestLat: target.lat,
    nearestLng: target.lng,
    inside: false,
    distanceKm: null,
    baseScore: 0,
    speedBonus: 0,
    score: 0,
    timedOut: true
  };

  state.pinDrop.phase = "revealed";
  state.pinDrop.lastReveal = record;
  state.pinDrop.history.push(record);

  if (state.stats) {
    state.stats.totalAttempts++;
    state.stats.wrongAttempts++;
    state.stats.streak = 0;
  }
  if (typeof playTone === "function") playTone("error");

  renderPinDropRevealLayers(target, record);
  updatePinDropBannerAndDockUI();
  if (typeof updateScoreAndProgressUI === "function") updateScoreAndProgressUI();
  if (typeof setFeedback === "function") {
    setFeedback(`⌛ 搶答時間到！未標記座標 · +0 分（目標：【${target.shortLabel}】）`, "error");
  }
  schedulePinDropAutoNext(2000);
  return true;
}

function confirmPinDropGuess(opts = {}) {
  if (typeof state === "undefined" || state.playMode !== "pin_drop" || !state.pinDrop) return false;
  if (state.pinDrop.phase !== "placing" || !state.pinDrop.currentTarget || !state.pinDrop.guessLatLng) {
    return false;
  }

  const timedOut = Boolean(opts && opts.timedOut);
  const totalMs =
    (state.questionTimer && Number(state.questionTimer.totalMs)) ||
    (Math.max(5, parseInt(state.questionCountdownSec, 10) || 15) * 1000);
  const remainingMs = timedOut
    ? 0
    : typeof opts.remainingMs === "number"
    ? opts.remainingMs
    : typeof getQuestionCountdownRemainingMs === "function"
    ? getQuestionCountdownRemainingMs()
    : 0;
  if (typeof stopQuestionCountdown === "function") stopQuestionCountdown();

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

  const baseScore = distRes.inside
    ? 5000
    : computePinDropScore(distRes.distanceKm, scaleKm, perfectRadiusKm);
  const speedBonus =
    !timedOut && isPinDropCountdownBonusActive()
      ? computePinDropCountdownBonus(baseScore, remainingMs, totalMs, true)
      : 0;
  const score = baseScore + speedBonus;

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
    baseScore: Number(baseScore),
    speedBonus: Number(speedBonus),
    score: Number(score),
    timedOut
  };

  state.pinDrop.phase = "revealed";
  state.pinDrop.totalScore += record.score;
  state.pinDrop.lastReveal = record;
  state.pinDrop.history.push(record);

  if (state.stats) {
    state.stats.totalAttempts++;
    if (record.baseScore >= 2500) {
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
    playTone(record.baseScore >= 4500 ? "tier" : record.baseScore >= 2000 ? "unlock" : "error");
  }

  renderPinDropRevealLayers(target, record);
  updatePinDropBannerAndDockUI();
  if (typeof updateScoreAndProgressUI === "function") {
    updateScoreAndProgressUI();
  }

  if (typeof setFeedback === "function") {
    const isPolyTarget = target.kind === "town" || target.kind === "county";
    const bonusTxt = record.speedBonus > 0 ? `（含倒數加成 ⚡+${record.speedBonus.toLocaleString()}）` : "";
    const prefixTxt = timedOut ? "⌛ 時間到自動送出 · " : "";
    const msg = record.inside
      ? isPolyTarget
        ? `${prefixTxt}🎯 滿分命中【${target.shortLabel}】境內！距離 0.0 km · +${record.score.toLocaleString()} 分${bonusTxt}`
        : `${prefixTxt}🎯 精準命中【${target.shortLabel}】！距離 ${record.distanceKm.toFixed(2)} km · +${record.score.toLocaleString()} 分${bonusTxt}`
      : isPolyTarget
      ? `${prefixTxt}📏 揭曉【${target.shortLabel}】：距離最近邊界 ${record.distanceKm.toFixed(1)} km · +${record.score.toLocaleString()} 分${bonusTxt}`
      : `${prefixTxt}📏 揭曉【${target.shortLabel}】：距離 ${record.distanceKm.toFixed(1)} km · +${record.score.toLocaleString()} 分${bonusTxt}`;
    setFeedback(msg, record.baseScore >= 3500 ? "success" : "tier");
  }
  schedulePinDropAutoNext(2000);
  return true;
}

function nextPinDropRound() {
  cancelPinDropAutoNext();
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
  const totalSpeedBonus = history.reduce((acc, r) => acc + Number(r.speedBonus || 0), 0);
  const maxPerRound = getPinDropMaxRoundScore(history);
  const maxPossibleScore = (pd.totalRounds > 0 ? pd.totalRounds : Math.max(1, roundsPlayed)) * maxPerRound;
  const validDistRounds = history.filter((r) => Number.isFinite(Number(r.distanceKm)) && r.distanceKm !== null);
  const avgDist =
    validDistRounds.length > 0
      ? validDistRounds.reduce((acc, r) => acc + Number(r.distanceKm || 0), 0) / validDistRounds.length
      : 0;
  let bestRound = null;
  for (let i = 0; i < history.length; i++) {
    const r = history[i];
    if (
      !bestRound ||
      r.score > bestRound.score ||
      (r.score === bestRound.score &&
        Number.isFinite(r.distanceKm) &&
        (!Number.isFinite(bestRound.distanceKm) || r.distanceKm < bestRound.distanceKm))
    ) {
      bestRound = r;
    }
  }
  return {
    roundsPlayed,
    totalScore,
    totalSpeedBonus,
    maxPerRound,
    maxPossibleScore,
    averageDistanceKm: avgDist,
    bestRound,
    history
  };
}

function finishPinDropGame() {
  cancelPinDropAutoNext();
  if (typeof stopQuestionCountdown === "function") stopQuestionCountdown();
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
  if (maxEl) {
    const bonusNote = stats.totalSpeedBonus > 0 ? `（含⚡+${stats.totalSpeedBonus.toLocaleString()}）` : "";
    maxEl.textContent = `/ ${stats.maxPossibleScore.toLocaleString()} 分${bonusNote}`;
  }
  if (avgEl) avgEl.textContent = `${stats.averageDistanceKm.toFixed(1)} km`;
  if (bestEl) {
    bestEl.textContent = stats.bestRound
      ? `${stats.bestRound.title} (${stats.bestRound.distanceKm === null ? "超時" : `${Number(stats.bestRound.distanceKm).toFixed(1)} km`} · +${stats.bestRound.score.toLocaleString()} 分)`
      : "尚無紀錄";
  }

  if (listEl) {
    listEl.replaceChildren();
    const tpl = document.getElementById("tpl-pindrop-history-row");
    stats.history.forEach((item) => {
      const isPolyItem = item.kind === "town" || item.kind === "county";
      const distLabel =
        item.distanceKm === null
          ? "⌛ 超時"
          : item.inside
          ? isPolyItem
            ? "🎯 0.0 km (境內)"
            : `🎯 ${Number(item.distanceKm).toFixed(2)} km (精準)`
          : `${Number(item.distanceKm).toFixed(1)} km`;
      const scoreLabel =
        Number(item.speedBonus) > 0
          ? `+${item.score.toLocaleString()} (⚡+${item.speedBonus})`
          : `+${item.score.toLocaleString()} 分`;
      let row;
      if (tpl && tpl.content && tpl.content.firstElementChild) {
        row = tpl.content.firstElementChild.cloneNode(true);
        const rNum = row.querySelector(".pindrop-row-round");
        const rTitle = row.querySelector(".pindrop-row-title");
        const rDist = row.querySelector(".pindrop-row-dist");
        const rScore = row.querySelector(".pindrop-row-score");
        if (rNum) rNum.textContent = `#${item.round}`;
        if (rTitle) rTitle.textContent = item.title;
        if (rDist) rDist.textContent = distLabel;
        if (rScore) rScore.textContent = scoreLabel;
      } else {
        row = document.createElement("div");
        row.textContent = `#${item.round} ${item.title} · ${distLabel} · ${scoreLabel}`;
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
  if (state.playMode === "pin_drop") {
    if (typeof setMapBaseLayer === "function") {
      setMapBaseLayer(layerKey, true);
    }
    syncPinDropLayerLockUI();
  }
}

function setPinDropLockBaseLayer(locked) {
  state.pinDropLockBaseLayer = Boolean(locked);
  if (typeof syncConfigButtonsUI === "function") syncConfigButtonsUI();
  if (state.playMode === "pin_drop") {
    ensurePinDropEnvironment();
  }
}

function setPinDropShowTargetOutline(visible) {
  state.pinDropShowTargetOutline = Boolean(visible);
  if (typeof syncConfigButtonsUI === "function") syncConfigButtonsUI();
  if (state.playMode === "pin_drop") {
    updatePinDropBannerAndDockUI();
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

function setPinDropHideGuessed(hidden) {
  state.pinDropHideGuessed = Boolean(hidden);
  if (typeof syncConfigButtonsUI === "function") syncConfigButtonsUI();
  if (state.playMode === "pin_drop") {
    renderPinDropGuessedHistoryMarkers();
    if (typeof refreshAllPolygonStyles === "function") refreshAllPolygonStyles();
  }
}

function setPinDropHideCounty(hidden) {
  state.pinDropHideCounty = Boolean(hidden);
  if (typeof syncConfigButtonsUI === "function") syncConfigButtonsUI();
  if (state.playMode === "pin_drop") {
    updatePinDropBannerAndDockUI();
  }
}

function setPinDropCountdownBonus(enabled) {
  state.pinDropCountdownBonus = Boolean(enabled);
  if (typeof syncConfigButtonsUI === "function") syncConfigButtonsUI();
  if (state.playMode === "pin_drop") {
    updatePinDropBannerAndDockUI();
    if (typeof updateScoreAndProgressUI === "function") updateScoreAndProgressUI();
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
    renderPinDropTargetOutlinePreview(null);
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
    document.getElementById("btn-target-pass")?.classList.add("hidden");
    document.getElementById("btn-target-next")?.classList.add("hidden");
    document.getElementById("btn-target-hint")?.classList.add("hidden");
    document.getElementById("btn-target-reveal-outline")?.classList.add("hidden");
    document.getElementById("btn-target-exit")?.classList.remove("hidden");

    renderPinDropTargetOutlinePreview(target);
    if (titleEl) {
      titleEl.textContent = target ? getPinDropDisplayPromptTitle(target) : "📍 給地名標座標挑戰";
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
        const isPolyReveal = r.kind === "town" || r.kind === "county";
        const bonusTxt = Number(r.speedBonus) > 0 ? ` (含⚡+${r.speedBonus.toLocaleString()})` : "";
        descEl.textContent = r.distanceKm === null && r.timedOut
          ? `⌛ 搶答時間到！未標記【${r.title}】· +0 分`
          : r.inside
          ? isPolyReveal
            ? `🎯 命中【${r.title}】境內！距離 0.0 km · 本題獲得 +${r.score.toLocaleString()} 分${bonusTxt}`
            : `🎯 精準命中【${r.title}】！距離 ${r.distanceKm.toFixed(2)} km · 本題獲得 +${r.score.toLocaleString()} 分${bonusTxt}`
          : isPolyReveal
          ? `📏 距離【${r.title}】最近邊界 ${r.distanceKm.toFixed(1)} km · 本題獲得 +${r.score.toLocaleString()} 分${bonusTxt}`
          : `📏 距離【${r.title}】${r.distanceKm.toFixed(1)} km · 本題獲得 +${r.score.toLocaleString()} 分${bonusTxt}`;
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
        : "👆 點擊放預覽圖釘，或雙擊地圖直接送出";
    } else if (pd.phase === "revealed" && pd.lastReveal) {
      const r = pd.lastReveal;
      const isPolyReveal = r.kind === "town" || r.kind === "county";
      const bonusTxt = Number(r.speedBonus) > 0 ? ` (⚡+${r.speedBonus.toLocaleString()})` : "";
      statusEl.textContent = r.distanceKm === null && r.timedOut
        ? `⌛ 搶答超時 · +0 分`
        : r.inside
        ? isPolyReveal
          ? `🎯 命中境內！0.0 km · +${r.score.toLocaleString()} 分${bonusTxt}`
          : `🎯 精準命中！${Number(r.distanceKm).toFixed(2)} km · +${r.score.toLocaleString()} 分${bonusTxt}`
        : `📏 誤差 ${r.distanceKm.toFixed(1)} km · +${r.score.toLocaleString()} 分${bonusTxt}`;
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
  const maxPerRound = getPinDropMaxRoundScore(pd.history);
  const maxScore = (totalRounds > 0 ? totalRounds : Math.max(1, completed)) * maxPerRound;
  const scorePct = maxScore > 0 ? ((pd.totalScore / maxScore) * 100).toFixed(1) : "0.0";
  const roundPct = totalRounds > 0 ? ((completed / totalRounds) * 100).toFixed(1) : "100.0";
  const validDistHistory = Array.isArray(pd.history)
    ? pd.history.filter((r) => r.distanceKm !== null && Number.isFinite(Number(r.distanceKm)))
    : [];
  const avgDist =
    validDistHistory.length > 0
      ? (validDistHistory.reduce((s, r) => s + Number(r.distanceKm || 0), 0) / validDistHistory.length).toFixed(1)
      : "0.0";

  // Top Header
  const topLabel = document.getElementById("top-metric-label");
  const topScore = document.getElementById("top-score-display");
  const topPct = document.getElementById("top-percent-display");
  const topBar = document.getElementById("top-main-progress-bar");
  if (topLabel) topLabel.textContent = "標座標得分";
  if (topScore) {
    topScore.textContent = totalRounds > 0
      ? `${pd.totalScore.toLocaleString()} / ${(totalRounds * maxPerRound).toLocaleString()}`
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

  // Hide quick-jump county chips and multi-category bars during pin_drop so no Free-Mode clutter or county hints show
  const qBar = document.getElementById("quick-zoom-counties-bar");
  const mBar = document.getElementById("map-jump-counties-bar");
  if (qBar) qBar.replaceChildren();
  if (mBar) mBar.replaceChildren();
  document.getElementById("multi-category-progress-bars")?.classList.add("hidden");
  document.getElementById("quick-zoom-counties-section")?.classList.add("hidden");

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
          if (rDist) {
            const isPolyItem = item.kind === "town" || item.kind === "county";
            rDist.textContent = item.distanceKm === null
              ? "⌛ 超時"
              : item.inside
              ? isPolyItem ? "🎯 0.0 km" : `🎯 ${Number(item.distanceKm).toFixed(2)} km`
              : `${Number(item.distanceKm).toFixed(1)} km`;
          }
          if (rScore) {
            rScore.textContent = Number(item.speedBonus) > 0
              ? `+${item.score.toLocaleString()} (⚡+${item.speedBonus})`
              : `+${item.score.toLocaleString()} 分`;
          }
        } else {
          row = document.createElement("div");
          row.className = "flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs";
          const distStr = item.distanceKm === null ? "⌛ 超時" : `${Number(item.distanceKm).toFixed(1)} km`;
          row.textContent = `#${item.round} ${item.title} · ${distStr} · +${item.score} 分`;
        }
        container.appendChild(row);
      });
    }
  }
  return true;
}
