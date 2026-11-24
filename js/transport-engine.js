// =========================================================================
// 4B. STATION QUIZ & MULTI-SYSTEM RAIL / METRO / LRT / GONDOLA / FOREST / SUGAR ENGINE
//     1. Native high-res road & railway tiles (maxZoom: 18, no artificial maxNativeZoom cap so zooming in is 100% sharp!)
//     2. Uses native map API road shields (no duplicate/misaligned custom shields)
//     3. TRA & THSR draw station dots ONLY (no weird station-to-station straight lines; OpenRailwayMap draws the curved tracks)
//     4. Properly branched MRT/LRT lines (fixing 中和新蘆線 Y-branch at 大橋頭: 迴龍—台北橋—大橋頭 & 蘆洲—大橋頭—南勢角)
//     5. Full Station Guessing Mode: locked stations show dot only; guessed stations light up & show station name pill beside the dot!
// =========================================================================
function updateTransportZoomClass() {
  const mapEl = document.getElementById("leaflet-map");
  if (!mapEl || !map) return;
  const z = map.getZoom();
  const nextClass = z < 8.5 ? "z-low" : z < 10 ? "z-mid" : "z-high";
  if (mapEl.classList.contains(nextClass)) return;
  mapEl.classList.remove("z-low", "z-mid", "z-high");
  mapEl.classList.add(nextClass);
}
function ensureExactOsmForCurrentView() {}
function renderTransportLayerNow() {
  updateRoadAndRailwayTileOverlays();
}

// =========================================================================
// PRECISION STATION COORDINATE SNAP & OSM VECTOR TRACK REUSE ENGINE
//  - Reuses OpenStreetMap's exact railway/THSR/MRT/LRT track geometries
//    WITHOUT displaying OpenRailwayMap's baked-in station name labels!
//  - Snaps all station coordinates to official GeoJSON & OSM station nodes
// =========================================================================
const osmWaysByLineId = new Map(); // lineId -> Array of Array<[lat, lng]>
let osmTracksLoaded = false;
let osmTracksLoading = false;

// Normalize a station name into a canonical base name (e.g. "台北車站A1" -> "臺北", "岡山車站RK1" -> "岡山", "高鐵桃園站" -> "桃園")
function cleanStationBaseName(rawName) {
  let s = normTw(String(rawName || ""))
    .replace(/\(.*?\)|（.*?）/g, "")
    .replace(/[A-Z]+[0-9]+[A-Za-z]*/g, "")
    .replace(/^(高鐵|臺鐵|台鐵|台北捷運|新北捷運|桃園捷運|台中捷運|高雄捷運|捷運|淡海輕軌|安坑輕軌|高雄輕軌|輕軌|貓空纜車|纜車)/, "")
    .replace(/(五分車站|台車站|纜車站|火車站|車站|總站|站)$/, "");
  return s || normTw(String(rawName || ""));
}

function getDisplayStationName(rawName) {
  return String(rawName || "").replace(/[A-Z]+[0-9]+[A-Za-z]*/g, "");
}

// Apply coordinate corrections to both line.stations and line.branches in-place
function applyStationCoordCandidates(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) return 0;
  let updatedCount = 0;

  const snapTuple = (stTuple, lineKind) => {
    const rawName = stTuple[0];
    const curLat = stTuple[1];
    const curLng = stTuple[2];
    const base = cleanStationBaseName(rawName);
    if (!base) return;

    let best = null;
    let bestDist = Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (c.base !== base && !(c.altBases && c.altBases.includes(base))) continue;
      if (lineKind === "thsr" && c.kind && c.kind !== "thsr" && c.kind !== "any") continue;
      const d = Math.hypot(c.lat - curLat, c.lng - curLng);
      // Must be within ~3.8km of approximate location so same-name stations in other counties never collide
      if (d < 0.038 && d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    if (best) {
      stTuple[1] = Number(best.lat.toFixed(6));
      stTuple[2] = Number(best.lng.toFixed(6));
      updatedCount++;
    }
  };

  TAIWAN_SELECTABLE_LINES.forEach((line) => {
    if (line.isHighway) return;
    line.stations.forEach((st) => snapTuple(st, line.stKind));
    if (Array.isArray(line.branches)) {
      line.branches.forEach((br) => br.forEach((st) => snapTuple(st, line.stKind)));
    }
  });
  return updatedCount;
}

// Point-to-segment squared distance in degree space
function distToSegmentSq(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return (px - x1) * (px - x1) + (py - y1) * (py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return (px - projX) * (px - projX) + (py - projY) * (py - projY);
}

function minDistanceToLineCorridor(lat, lng, line) {
  const segs = line.branches ? line.branches : [line.stations];
  let minSq = Infinity;
  for (let b = 0; b < segs.length; b++) {
    const pts = segs[b];
    for (let i = 0; i < pts.length - 1; i++) {
      const dSq = distToSegmentSq(lat, lng, pts[i][1], pts[i][2], pts[i + 1][1], pts[i + 1][2]);
      if (dSq < minSq) minSq = dSq;
    }
  }
  return Math.sqrt(minSq);
}

function assignOsmWayToLineId(way) {
  if (!way || !Array.isArray(way.geometry) || way.geometry.length < 2) return null;
  const tags = way.tags || {};
  const rType = tags.railway || "";
  const aType = tags.aerialway || "";
  const nameStr = `${tags.name || ""} ${tags["name:zh"] || ""} ${tags.network || ""} ${tags.operator || ""}`;

  const midPt = way.geometry[Math.floor(way.geometry.length / 2)];
  const mLat = midPt.lat;
  const mLng = midPt.lon;

  // 1. High Speed Rail
  if (tags.highspeed === "yes" || /高速鐵路|台灣高鐵|臺灣高鐵/.test(nameStr)) {
    return "thsr_main";
  }

  // 2. Kaohsiung MRT Red / Orange disambiguation by latitude (< 23.0)
  if (mLat < 23.0 && rType === "subway") {
    if (/橘線/.test(nameStr)) return "mrt_kh_o";
    if (/紅線/.test(nameStr)) return "mrt_kh_r";
  }

  // 3. Explicit name matchers (also verifying corridor proximity so e.g. "環狀線" in Kaohsiung vs New Taipei doesn't cross)
  for (let i = 0; i < LINE_NAME_MATCHERS.length; i++) {
    const m = LINE_NAME_MATCHERS[i];
    if (m.rx.test(nameStr)) {
      const lineObj = TAIWAN_SELECTABLE_LINES.find((l) => l.id === m.id);
      if (lineObj && minDistanceToLineCorridor(mLat, mLng, lineObj) < 0.08) {
        return m.id;
      }
    }
  }

  // 4. TRA Western Trunk Line North vs South split at Zhunan (24.686) / Changhua (24.081)
  if (/縱貫線/.test(nameStr) && rType === "rail") {
    if (mLat >= 24.67) return "tra_west_n";
    if (mLat <= 24.10) return "tra_west_s";
  }

  // 5. Corridor proximity match within compatible railway types
  let candidates = [];
  if (aType) {
    candidates = TAIWAN_SELECTABLE_LINES.filter((l) => l.id.startsWith("gon_"));
  } else if (rType === "subway" || rType === "monorail") {
    candidates = TAIWAN_SELECTABLE_LINES.filter((l) => l.id.startsWith("mrt_"));
  } else if (rType === "light_rail" || rType === "tram") {
    candidates = TAIWAN_SELECTABLE_LINES.filter((l) => l.id.startsWith("lrt_") || l.id === "mrt_ty_a");
  } else if (rType === "narrow_gauge" || rType === "funicular") {
    candidates = TAIWAN_SELECTABLE_LINES.filter((l) => l.id.startsWith("for_") || l.id.startsWith("sug_"));
  } else if (rType === "rail") {
    candidates = TAIWAN_SELECTABLE_LINES.filter((l) => l.id.startsWith("tra_"));
  }

  let bestId = null;
  let bestDist = aType || rType === "subway" || rType === "light_rail" ? 0.015 : 0.036;
  for (let i = 0; i < candidates.length; i++) {
    const d = minDistanceToLineCorridor(mLat, mLng, candidates[i]);
    if (d < bestDist) {
      bestDist = d;
      bestId = candidates[i].id;
    }
  }
  return bestId;
}

async function fetchOverpassJson(query) {
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
  ];
  const body = "data=" + encodeURIComponent(query);
  const tasks = endpoints.map((url) =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body
    }).then((r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
  );
  return Promise.any(tasks);
}

async function initPrecisionRailAndStationEngine() {
  // Step 1: Apply cached station coordinate snaps immediately if present
  try {
    const cachedSt = localStorage.getItem("tw_geomaster_osm_stations_v5");
    if (cachedSt) {
      const parsed = JSON.parse(cachedSt);
      if (Array.isArray(parsed) && parsed.length > 0) {
        applyStationCoordCandidates(parsed);
        if (state.transportMode !== "off") updateRoadAndRailwayTileOverlays();
      }
    }
  } catch (_) {}

  // Step 2: Fetch official THSR & Metro stations + OSM station nodes in parallel (No address geocoding)
  (async () => {
    const collected = [];
    const addNode = (name, lat, lng, kind = "any") => {
      if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const base = cleanStationBaseName(name);
      if (!base) return;
      const altBases = base.includes("/") ? base.split("/").map((s) => cleanStationBaseName(s)) : [];
      collected.push({ base, altBases, lat, lng, kind });
    };

    await Promise.allSettled([
      // Official THSR stations GeoJSON
      fetch("https://cdn.jsdelivr.net/gh/repeat/taiwan-high-speed-rail-stations@master/taiwan-high-speed-rail.geojson")
        .then((r) => r.json())
        .then((fc) => {
          (fc.features || []).forEach((f) => {
            const coords = f.geometry && f.geometry.coordinates;
            const name = (f.properties && f.properties["站名"]) || (f.properties && f.properties.name);
            if (coords && name) addNode(name, Number(coords[1]), Number(coords[0]), "thsr");
          });
        }),
      // Official Northern Taiwan Metro & LRT stations GeoJSON
      fetch("https://cdn.jsdelivr.net/gh/repeat/northern-taiwan-metro-stations@main/output/northern-taiwan.geojson")
        .then((r) => r.json())
        .then((fc) => {
          (fc.features || []).forEach((f) => {
            const coords = f.geometry && f.geometry.coordinates;
            const name = (f.properties && f.properties["站名"]) || (f.properties && f.properties.name);
            if (coords && name) addNode(name, Number(coords[1]), Number(coords[0]), "mrt");
          });
        }),
      // OpenStreetMap railway & aerialway station nodes across Taiwan (~50KB)
      fetchOverpassJson(
        `[out:json][timeout:15];(node["railway"~"^(station|halt|tram_stop)$"](21.8,120.0,25.35,122.05);node["aerialway"="station"](21.8,120.0,25.35,122.05););out body qt;`
      ).then((data) => {
        (data.elements || []).forEach((el) => {
          const tags = el.tags || {};
          const name = tags["name:zh-Hant"] || tags["name:zh"] || tags.name;
          if (name && el.lat && el.lon) {
            const isHsr = /高鐵/.test(name) || (tags.network && tags.network.includes("高鐵"));
            addNode(name, el.lat, el.lon, isHsr ? "thsr" : "any");
          }
        });
      })
    ]);

    if (collected.length > 0) {
      applyStationCoordCandidates(collected);
      try {
        localStorage.setItem("tw_geomaster_osm_stations_v5", JSON.stringify(collected.slice(0, 1500)));
      } catch (_) {}
      if (state.transportMode !== "off") {
        updateRoadAndRailwayTileOverlays();
      }
    }
  })();

  // Step 3: Fetch & Reuse OpenStreetMap Exact Curved Track Geometries (No station name spoilers!)
  loadOsmExactRailwayVectors();
}

async function loadOsmExactRailwayVectors() {
  if (osmTracksLoaded || osmTracksLoading) return;
  osmTracksLoading = true;
  try {
    // Step 1: Try loading from localStorage cache first (avoids Overpass API on every reload!)
    try {
      const cached = localStorage.getItem("tw_geomaster_osm_tracks_v2");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 10) {
          Object.entries(parsed).forEach(([lid, segs]) => {
            if (!osmWaysByLineId.has(lid)) osmWaysByLineId.set(lid, []);
            segs.forEach((s) => osmWaysByLineId.get(lid).push(s));
          });
          osmTracksLoaded = true;
          snapStationsOntoOsmTracks();
          if (state.transportMode !== "off") updateRoadAndRailwayTileOverlays();
          osmTracksLoading = false;
          return;
        }
      }
    } catch (_) {}

    // Step 2: Fetch from Overpass API (first load or cache miss)
    const qMrtLrtHsr = `[out:json][timeout:20];(way["railway"~"^(subway|light_rail|monorail|funicular)$"][!"service"](22.5,120.2,25.3,121.85);way["railway"="rail"]["highspeed"="yes"][!"service"](22.5,120.1,25.2,121.75);way["aerialway"~"^(gondola|cable_car)$"](22.5,120.2,25.2,121.75););out geom qt;`;
    const qTraNarrow = `[out:json][timeout:25];(way["railway"~"^(rail|narrow_gauge)$"][!"service"]["highspeed"!="yes"]["usage"!~"^(industrial|military)$"](21.8,120.0,25.3,122.05););out geom qt;`;

    const processElements = (elements) => {
      let added = 0;
      (elements || []).forEach((el) => {
        if (el.type !== "way" || !Array.isArray(el.geometry)) return;
        const lid = assignOsmWayToLineId(el);
        if (!lid) return;
        const latlngs = el.geometry.map((pt) => [Number(pt.lat.toFixed(5)), Number(pt.lon.toFixed(5))]);
        if (latlngs.length >= 2) {
          if (!osmWaysByLineId.has(lid)) osmWaysByLineId.set(lid, []);
          osmWaysByLineId.get(lid).push(latlngs);
          added++;
        }
      });
      return added;
    };

    const [res1, res2] = await Promise.allSettled([
      fetchOverpassJson(qMrtLrtHsr),
      fetchOverpassJson(qTraNarrow)
    ]);

    let totalSegs = 0;
    if (res1.status === "fulfilled" && res1.value) totalSegs += processElements(res1.value.elements);
    if (res2.status === "fulfilled" && res2.value) totalSegs += processElements(res2.value.elements);

    if (totalSegs > 0) {
      osmTracksLoaded = true;
      snapStationsOntoOsmTracks();
      if (state.transportMode !== "off") {
        updateRoadAndRailwayTileOverlays();
      }
      // Cache to localStorage for instant reload next time
      try {
        const cacheObj = {};
        osmWaysByLineId.forEach((segs, lid) => { cacheObj[lid] = segs; });
        localStorage.setItem("tw_geomaster_osm_tracks_v2", JSON.stringify(cacheObj));
      } catch (_) {}
    }
  } catch (_) {
  } finally {
    osmTracksLoading = false;
  }
}

let railCanvasRenderer = null;

// Build a smooth Catmull-Rom railway spline that passes 100.000% through every control vertex (every station!)
function buildSmoothRailwaySpline(rawVertices, subdivisions = 4) {
  if (!rawVertices || rawVertices.length < 2) return rawVertices || [];
  // First expand any known mountain/coastal curve waypoints between consecutive stations
  const expanded = [rawVertices[0]];
  for (let i = 0; i < rawVertices.length - 1; i++) {
    const a = rawVertices[i];
    const b = rawVertices[i + 1];
    if (a[2] && b[2]) {
      const k1 = `${a[2]}_${b[2]}`;
      const k2 = `${b[2]}_${a[2]}`;
      if (INTER_STATION_CURVE_WAYPOINTS[k1]) {
        INTER_STATION_CURVE_WAYPOINTS[k1].forEach((wp) => expanded.push([wp[0], wp[1]]));
      } else if (INTER_STATION_CURVE_WAYPOINTS[k2]) {
        [...INTER_STATION_CURVE_WAYPOINTS[k2]].reverse().forEach((wp) => expanded.push([wp[0], wp[1]]));
      }
    }
    expanded.push(b);
  }

  if (expanded.length === 2 || subdivisions <= 1) {
    return expanded.map((p) => [p[0], p[1]]);
  }

  const out = [];
  const n = expanded.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = expanded[Math.max(0, i - 1)];
    const p1 = expanded[i];
    const p2 = expanded[i + 1];
    const p3 = expanded[Math.min(n - 1, i + 2)];

    // Always include the exact station/waypoint vertex p1!
    out.push([p1[0], p1[1]]);

    const segLen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    // Only subdivide segments that are > ~1.2km so closely spaced urban MRT stations stay crisp
    const steps = segLen > 0.03 ? subdivisions + 2 : segLen > 0.01 ? subdivisions : 2;
    const tension = 0.35; // Tight railway curve tension so it never overshoots

    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;

      const m1x = (p2[0] - p0[0]) * tension;
      const m1y = (p2[1] - p0[1]) * tension;
      const m2x = (p3[0] - p1[0]) * tension;
      const m2y = (p3[1] - p1[1]) * tension;

      const h00 = 2 * t3 - 3 * t2 + 1;
      const h10 = t3 - 2 * t2 + t;
      const h01 = -2 * t3 + 3 * t2;
      const h11 = t3 - t2;

      const lat = h00 * p1[0] + h10 * m1x + h01 * p2[0] + h11 * m2x;
      const lng = h00 * p1[1] + h10 * m1y + h01 * p2[1] + h11 * m2y;
      out.push([Number(lat.toFixed(6)), Number(lng.toFixed(6))]);
    }
  }
  const last = expanded[n - 1];
  out.push([last[0], last[1]]);
  return out;
}

// Build spliced vector track for a branch:
// Uses OSM intermediate track vertices between consecutive stations when available,
// and ALWAYS anchors start & end of every inter-station span to the exact station coordinate [st.lat, st.lng]!
function buildStationAnchoredVectorPolylines(line) {
  const osmSegs = osmWaysByLineId.get(line.id);
  const branches = line.branches ? line.branches : [line.stations];
  const resultPolylines = [];

  // Flatten OSM vertices for this line if loaded
  const osmPts = [];
  if (osmSegs && osmSegs.length > 0) {
    osmSegs.forEach((seg) => {
      for (let i = 0; i < seg.length; i++) osmPts.push(seg[i]);
    });
  }

  branches.forEach((branch) => {
    if (!branch || branch.length < 2) return;

    // If OSM vertices are available for this line, splice intermediate OSM points between each station pair (A -> B)
    if (osmPts.length >= 4) {
      const anchored = [];
      for (let i = 0; i < branch.length - 1; i++) {
        const stA = branch[i];
        const stB = branch[i + 1];
        const aLat = stA[1], aLng = stA[2];
        const bLat = stB[1], bLng = stB[2];
        anchored.push([aLat, aLng, cleanStationBaseName(stA[0])]);

        const abDist = Math.hypot(bLat - aLat, bLng - aLng);
        if (abDist > 0.008) {
          const ux = (bLat - aLat) / abDist;
          const uy = (bLng - aLng) / abDist;
          // Collect OSM points that project monotonically between A and B and lie within tight lateral corridor
          const between = [];
          for (let k = 0; k < osmPts.length; k += 2) {
            const p = osmPts[k];
            const dx = p[0] - aLat;
            const dy = p[1] - aLng;
            const proj = dx * ux + dy * uy;
            if (proj <= abDist * 0.12 || proj >= abDist * 0.88) continue;
            const perp = Math.abs(dx * (-uy) + dy * ux);
            if (perp < Math.min(0.018, abDist * 0.28)) {
              between.push({ proj, lat: p[0], lng: p[1] });
            }
          }
          if (between.length >= 2) {
            between.sort((x, y) => x.proj - y.proj);
            // Downsample to 4-8 clean guide points between A and B so line is smooth and never jagged
            const step = Math.max(1, Math.floor(between.length / 5));
            for (let bIdx = 0; bIdx < between.length; bIdx += step) {
              anchored.push([between[bIdx].lat, between[bIdx].lng]);
            }
          }
        }
      }
      const lastSt = branch[branch.length - 1];
      anchored.push([lastSt[1], lastSt[2], cleanStationBaseName(lastSt[0])]);
      resultPolylines.push(buildSmoothRailwaySpline(anchored, 3));
    } else {
      // Pure station-anchored spline with coastal/mountain curve waypoints
      const raw = branch.map((st) => [st[1], st[2], cleanStationBaseName(st[0])]);
      resultPolylines.push(buildSmoothRailwaySpline(raw, 4));
    }
  });

  return resultPolylines;
}

function projectPointOntoSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return { lat: x1, lng: y1, distSq: (px - x1) ** 2 + (py - y1) ** 2 };
  let t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  const projLat = x1 + t * dx;
  const projLng = y1 + t * dy;
  const distSq = (px - projLat) ** 2 + (py - projLng) ** 2;
  return { lat: projLat, lng: projLng, distSq };
}

function snapStationsOntoOsmTracks() {
  if (!osmTracksLoaded || osmWaysByLineId.size === 0) return;
  let snappedCount = 0;

  const snapStationTuple = (st, ways) => {
    if (!st || st.length < 3) return;
    const curLat = st[1];
    const curLng = st[2];
    let best = null;
    let minSq = Infinity;

    for (let w = 0; w < ways.length; w++) {
      const seg = ways[w];
      for (let i = 0; i < seg.length - 1; i++) {
        const proj = projectPointOntoSegment(curLat, curLng, seg[i][0], seg[i][1], seg[i + 1][0], seg[i + 1][1]);
        if (proj.distSq < minSq) {
          minSq = proj.distSq;
          best = proj;
        }
      }
    }

    // Snap if within ~800m (0.008 deg) of actual vector track
    if (best && minSq < 0.000064) {
      st[1] = Number(best.lat.toFixed(5));
      st[2] = Number(best.lng.toFixed(5));
      snappedCount++;
    }
  };

  TAIWAN_SELECTABLE_LINES.forEach((line) => {
    const ways = osmWaysByLineId.get(line.id);
    if (!ways || ways.length === 0) return;
    line.stations.forEach((st) => snapStationTuple(st, ways));
    if (Array.isArray(line.branches)) {
      line.branches.forEach((br) => br.forEach((st) => snapStationTuple(st, ways)));
    }
  });

  return snappedCount;
}

function shouldFilterStationsByRegion() {
  if (!state.filterStationsByRegion) return false;
  if (state.quizTargetMode === "station") return false;
  const hasTownScope = state.selectedTownIds instanceof Set && state.selectedTownIds.size > 0;
  const hasCountyScope = state.selectedCounties instanceof Set && state.selectedCounties.size > 0;
  return hasTownScope || hasCountyScope;
}

function isStationInSelectedRegion(st) {
  if (!shouldFilterStationsByRegion()) return true;
  if (!st) return false;
  if (state.difficulty === "county_only") {
    if (Array.isArray(st.countyNames) && st.countyNames.length > 0) {
      return st.countyNames.some((cn) => state.selectedCounties.has(cn));
    }
    return Boolean(st.countyName && state.selectedCounties.has(st.countyName));
  }
  if (state.selectedTownIds instanceof Set && state.selectedTownIds.size > 0) {
    if (Array.isArray(st.townIds) && st.townIds.length > 0) {
      return st.townIds.some((tid) => state.selectedTownIds.has(tid));
    }
    if (st.townId) return state.selectedTownIds.has(st.townId);
  }
  if (st.countyName && state.selectedCounties instanceof Set) {
    return state.selectedCounties.has(st.countyName);
  }
  return true;
}

function buildStationsFromLineSet(activeSet, applyRegionFilter = false) {
  if (!activeSet || activeSet.size === 0) return [];
  const list = [];
  const byNearKey = [];

  TAIWAN_SELECTABLE_LINES.forEach((line) => {
    if (line.isHighway || !activeSet.has(line.id)) return;
    const meta = LINE_DISPLAY_META[line.id] || { dotName: line.name, sysTotal: line.group, macro: "鐵道" };
    const cleanLineName = typeof getLineDisplayName === "function" ? getLineDisplayName(meta.dotName || line.name) : (meta.dotName || line.name);
    line.stations.forEach((st, idx) => {
      const [rawName, lat, lng] = st;
      const base = cleanStationBaseName(rawName);
      const display = getDisplayStationName(rawName);
      const isTerminus = idx === 0 || idx === line.stations.length - 1;
      const townInfo = typeof resolveStationTownInfo === "function"
        ? resolveStationTownInfo(line.id, rawName, base, lat, lng)
        : { townId: null, countyName: null, fullCountyTown: null, townIds: [], countyNames: [] };

      // Deduplicate same station shared by lines of the same system (e.g. 竹南, 彰化, 八堵, 大橋頭, 中正紀念堂) within ~1.8km
      let existing = byNearKey.find(
        (x) => x.stKind === line.stKind && x.baseName === base && Math.hypot(x.lat - lat, x.lng - lng) < 0.018
      );
      if (existing) {
        if (!existing.lineIds.includes(line.id)) existing.lineIds.push(line.id);
        if (isTerminus) existing.isTerminus = true;
        if (Array.isArray(townInfo.townIds)) {
          townInfo.townIds.forEach((tid) => {
            if (!existing.townIds.includes(tid)) existing.townIds.push(tid);
          });
        }
        if (Array.isArray(townInfo.countyNames)) {
          townInfo.countyNames.forEach((cn) => {
            if (!existing.countyNames.includes(cn)) existing.countyNames.push(cn);
          });
        }
      } else {
        const stableKey = `${line.stKind}_${base}_${Math.round(lat * 5)}_${Math.round(lng * 5)}`;
        const obj = {
          key: stableKey,
          rawName,
          displayName: display,
          baseName: base,
          lineName: cleanLineName,
          isTerminus,
          lineId: line.id,
          lineIds: [line.id],
          sysTotal: meta.sysTotal,
          macro: meta.macro,
          color: line.color,
          stKind: line.stKind,
          lat,
          lng,
          townId: townInfo.townId,
          countyName: townInfo.countyName,
          fullCountyTown: townInfo.fullCountyTown,
          townIds: Array.isArray(townInfo.townIds) ? [...townInfo.townIds] : [],
          countyNames: Array.isArray(townInfo.countyNames) ? [...townInfo.countyNames] : []
        };
        byNearKey.push(obj);
        list.push(obj);
      }
    });
  });

  if (applyRegionFilter && shouldFilterStationsByRegion()) {
    return list.filter((st) => isStationInSelectedRegion(st));
  }
  return list;
}

function getActiveQuizStations() {
  if (typeof getActivePackFeatures === "function" && !getActivePackFeatures().supportsTransportQuiz) {
    return [];
  }
  if (
    state.quizTargetMode === "region" ||
    !state.stationQuizEnabled ||
    !(state.quizStationLines instanceof Set) ||
    state.quizStationLines.size === 0
  ) {
    return [];
  }
  return buildStationsFromLineSet(state.quizStationLines, true);
}

function getVisualOverlayStations() {
  if (typeof getActivePackFeatures === "function" && !getActivePackFeatures().supportsTransportQuiz) {
    return [];
  }
  if (state.transportMode === "off") return [];
  const isStationQuizActive =
    state.quizTargetMode !== "region" &&
    state.stationQuizEnabled &&
    state.quizStationLines instanceof Set &&
    state.quizStationLines.size > 0;
  const activeSet = isStationQuizActive ? state.quizStationLines : state.selectedTransportLines;
  return buildStationsFromLineSet(activeSet, isStationQuizActive);
}

// Common station aliases (e.g. Kaohsiung Metro 2024 renamings & legacy station names)
const STATION_NAME_ALIASES = {
  "苓雅運動園區": ["技擊館"],
  "技擊館": ["苓雅運動園區"],
  "楠梓科技園區": ["楠梓加工區"],
  "楠梓加工區": ["楠梓科技園區"],
  "前金": ["市議會"],
  "市議會": ["前金"],
  "哈瑪星": ["西子灣"],
  "西子灣": ["哈瑪星"],
  "岡山高醫": ["南岡山"],
  "南岡山": ["岡山高醫"]
};

function isStationMatch(st, core, comb, cNorm, combNorm, cStripped, combStripped) {
  if (!st || !st.baseName) return false;
  const requireSuffix = typeof isSuffixRequiredDifficulty === "function" ? isSuffixRequiredDifficulty() : false;

  if (requireSuffix) {
    const suffixedInputs = [];
    if (cNorm && cNorm.endsWith("站")) suffixedInputs.push({ raw: cNorm, stripped: cStripped });
    if (combNorm && combNorm.endsWith("站")) suffixedInputs.push({ raw: combNorm, stripped: combStripped });
    if (suffixedInputs.length === 0) return false;

    const aliases = STATION_NAME_ALIASES[st.baseName] || [];
    const slashParts = st.baseName.includes("/") ? [st.baseName.replace(/\//g, ""), ...st.baseName.split("/").filter(Boolean)] : [];
    const dispNorm = normTw(st.displayName);

    return suffixedInputs.some(({ raw, stripped }) => {
      if (stripped === st.baseName) return true;
      if (raw === dispNorm) return true;
      if (raw === normTw(`${st.baseName}站`) || raw === normTw(`${st.baseName}車站`)) return true;
      if (slashParts.some((part) => part === stripped)) return true;
      if (aliases.some((a) => a === stripped || normTw(`${a}站`) === raw || normTw(`${a}車站`) === raw)) return true;
      return false;
    });
  }

  if (cStripped === st.baseName || combStripped === st.baseName) return true;
  if (cNorm === normTw(st.displayName) || combNorm === normTw(st.displayName)) return true;
  if (cNorm === normTw(`${st.baseName}站`) || combNorm === normTw(`${st.baseName}站`)) return true;
  if (cNorm === normTw(`${st.baseName}車站`) || combNorm === normTw(`${st.baseName}車站`)) return true;
  if (st.baseName.includes("/")) {
    const noSlash = st.baseName.replace(/\//g, "");
    if (noSlash === cStripped || noSlash === combStripped) return true;
    if (st.baseName.split("/").some((part) => part && (part === cStripped || part === combStripped))) return true;
  }
  const aliases = STATION_NAME_ALIASES[st.baseName];
  if (aliases && aliases.some((a) => a === cStripped || a === combStripped || normTw(a) === cNorm || normTw(a) === combNorm)) {
    return true;
  }
  return false;
}

// Try matching user input against active stations!
function tryMatchAndUnlockStation(core, combined, isAutoCheck) {
  state._lastStationLockedCounty = false;
  const activeStations = getActiveQuizStations();
  if (activeStations.length === 0) return false;

  const cNorm = normTw(core);
  const combNorm = normTw(combined);
  const cStripped = cleanStationBaseName(core);
  const combStripped = cleanStationBaseName(combined);

  if (state.playMode === "free") {
    state.targetStationKey = null;
  }

  if ((state.playMode === "target_click" || state.playMode === "target_random" || state.playMode === "satellite_quiz") && state.targetStationKey) {
    const targetSt = activeStations.find((s) => s.key === state.targetStationKey);
    if (!targetSt) {
      state.targetStationKey = null;
    } else if (isStationMatch(targetSt, core, combined, cNorm, combNorm, cStripped, combStripped)) {
      if (typeof isPoiOrStationCountyUnlocked === "function" && !isPoiOrStationCountyUnlocked(targetSt.countyName, targetSt.countyNames)) {
        state._lastStationLockedCounty = true;
        return false;
      }
      state.unlockedStations.add(targetSt.key);
      state.lastTargetLat = targetSt.lat;
      state.lastTargetLng = targetSt.lng;
      state.targetStationKey = null;
      updateRoadAndRailwayTileOverlays();
      onSuccessfulUnlock(`🚉 答對指定車站：${targetSt.displayName}（${targetSt.lineName}）！`, targetSt.displayName, true);
      if (state.playMode === "target_random" || state.playMode === "satellite_quiz") {
        pickNextTargetRegion();
      } else {
        updateTargetBannerUI();
      }
      return true;
    } else {
      return false;
    }
  }

  const allMatched = activeStations.filter((st) => {
    if (state.unlockedStations.has(st.key)) return false;
    return isStationMatch(st, core, combined, cNorm, combNorm, cStripped, combStripped);
  });
  const matched = allMatched.filter((st) =>
    typeof isPoiOrStationCountyUnlocked === "function"
      ? isPoiOrStationCountyUnlocked(st.countyName, st.countyNames)
      : true
  );
  if (allMatched.length > 0 && matched.length === 0) {
    state._lastStationLockedCounty = true;
    return false;
  }

  if (matched.length > 0) {
    matched.forEach((st) => state.unlockedStations.add(st.key));
    updateRoadAndRailwayTileOverlays();
    const names = Array.from(new Set(matched.map((m) => m.displayName))).join("、");
    onSuccessfulUnlock(`🚉 解鎖車站：${names}（已於地圖車站旁顯示站名！）`, matched[0].displayName, false);
    return true;
  }
  return false;
}

function updateRoadAndRailwayTileOverlays() {
  railTileLayers.forEach((tl) => {
    try {
      tl.clearLayers && tl.clearLayers();
      map.removeLayer(tl);
    } catch (_) {}
  });
  railTileLayers = [];

  if (!map) return;
  if (state.playMode === "pin_drop") return;

  const effectiveRailRule = state.role === "spectator" ? "free" : state.p2pRailRule;
  if (effectiveRailRule === "ban_rail") {
    const hasStations = Boolean(state.stationQuizEnabled && state.quizStationLines.size > 0);
    if (hasStations) {
      // If stations are enabled, allow "stations_only" or "off" (never rail_only or lines_and_stations)
      if (state.transportMode !== "stations_only" && state.transportMode !== "off") {
        state.transportMode = "stations_only";
      }
    } else {
      state.transportMode = "off";
    }
    state.showRailOverlay = state.transportMode !== "off";
  } else if (effectiveRailRule === "ban_roads_only") {
    // 🛑 僅 Ban 公路網：若目前為 lines_and_stations 強制轉為 rail_only (保留軌道線路+車站)
    if (state.transportMode === "lines_and_stations") {
      state.transportMode = "rail_only";
    } else if (state.transportMode === "off" && (state.stationQuizEnabled || state.quizStationLines.size > 0)) {
      state.transportMode = "rail_only";
    }
    state.showRailOverlay = state.transportMode !== "off";
  } else if (effectiveRailRule === "force_lines") {
    state.transportMode = "lines_and_stations";
    state.showRailOverlay = true;
  } else if (effectiveRailRule === "force_rail_only") {
    state.transportMode = "rail_only";
    state.showRailOverlay = true;
  }

  // Safety fallback for legacy stations_only mode
  if (state.transportMode === "stations_only" && !state.enableLegacyStationOnlyMode && effectiveRailRule !== "ban_rail") {
    state.transportMode = "rail_only";
  }

  const supportsTransport =
    typeof getActivePackFeatures === "function" ? Boolean(getActivePackFeatures().supportsTransportQuiz) : true;
  if (!supportsTransport) {
    state.transportMode = "off";
    state.showRailOverlay = false;
    return;
  }

  const mode = state.transportMode; // 'off' | 'rail_only' | 'lines_and_stations' | 'stations_only'
  state.showRailOverlay = mode !== "off";

  const btn = document.getElementById("btn-toggle-rail");
  if (btn) {
    const span = btn.querySelector("span");
    if (span) {
      span.textContent =
        mode === "rail_only"
          ? "路網: 純軌道"
          : mode === "lines_and_stations"
          ? "路網: 完整路網"
          : mode === "stations_only"
          ? "路網: 僅車站"
          : "路網: 關";
    }
    btn.className =
      mode !== "off"
        ? "px-2 py-1 rounded-lg text-[11px] sm:text-xs font-semibold text-amber-300 bg-amber-500/20 transition flex items-center gap-1 whitespace-nowrap"
        : "px-2 py-1 rounded-lg text-[11px] sm:text-xs font-medium text-slate-300 hover:bg-slate-800 transition flex items-center gap-1 whitespace-nowrap";
  }

  if (mode === "off") return;

  // Dedicated Leaflet Canvas Renderer inside roadRailVectorPane (z-index 415, above administrative polygons!)
  // Both vector tracks (L.polyline) and station dots (L.circleMarker) are rendered on this exact same Canvas,
  // guaranteeing 0.0px zoom drift and 100% station-to-line alignment!
  if (!map.getPane("roadRailVectorPane")) {
    const p = map.createPane("roadRailVectorPane");
    p.style.zIndex = "415";
  }
  if (!railCanvasRenderer) {
    railCanvasRenderer = L.canvas({ pane: "roadRailVectorPane", padding: 0.5, tolerance: 6 });
  }
  updateTransportZoomClass();

  const anyHighwaySelected =
    state.selectedTransportLines.has("hw_freeway") ||
    state.selectedTransportLines.has("hw_express") ||
    state.selectedTransportLines.has("hw_prov") ||
    state.selectedTransportLines.has("hw_county");
  const anyRailSelected = TAIWAN_SELECTABLE_LINES.some(
    (l) => !l.isHighway && (state.selectedTransportLines.has(l.id) || state.quizStationLines.has(l.id))
  );

  if (anyRailSelected && !osmTracksLoaded && !osmTracksLoading) {
    loadOsmExactRailwayVectors();
  }

  // 1. Tile Overlays (In rail_only mode or ban_roads_only rule, highway overlay is strictly suppressed!)
  if (mode === "lines_and_stations" && anyHighwaySelected && effectiveRailRule !== "ban_roads_only") {
    const roadsTile = L.tileLayer(GIS_TILES.gis_roads_overlay, {
      maxZoom: 18,
      opacity: 0.85,
      attribution: "Roads &copy; Esri"
    }).addTo(map);
    railTileLayers.push(roadsTile);
  }

  if ((mode === "lines_and_stations" || mode === "rail_only") && anyRailSelected && state.showRawOpenRailwayTile) {
    const railTile = L.tileLayer(GIS_TILES.gis_railway_overlay, {
      subdomains: ["a", "b", "c"],
      maxZoom: 18,
      opacity: 0.85,
      attribution: "Rail &copy; OpenRailwayMap"
    });

    railTile.on("tileload", () => {
      if (!state.openRailLoaded) {
        state.openRailLoaded = true;
        if (state.hideMrtLinesOnOpenRail) {
          updateRoadAndRailwayTileOverlays();
        }
      }
    });

    railTile.addTo(map);
    railTileLayers.push(railTile);
  }

  const customGroup = L.layerGroup().addTo(map);
  railTileLayers.push(customGroup);

  // 2. Draw Vector Railway / THSR / MRT / LRT Polylines
  // Dynamic rules:
  // - High-speed rail & TRA: If GIS base or OpenRail is active, do NOT draw duplicate custom vector lines; draw if neither is active!
  // - MRT/LRT: Only hidden if OpenRail is active AND successfully loaded AND user enabled hideMrtLinesOnOpenRail!
  if (mode === "lines_and_stations" || mode === "rail_only") {
    const activeLineSet = state.stationQuizEnabled && state.quizStationLines.size > 0
      ? state.quizStationLines
      : state.selectedTransportLines;

    const isOpenRailActive = state.showRawOpenRailwayTile && (mode === "lines_and_stations" || mode === "rail_only");
    const isOpenRailReady = isOpenRailActive && state.openRailLoaded;
    const hasGisBase = state.mapLayer === "vector";
    const filterLineByReg = state.quizTargetMode !== "region" && state.stationQuizEnabled && state.quizStationLines.size > 0 && shouldFilterStationsByRegion();
    const regionStationLineIds = filterLineByReg
      ? new Set(getVisualOverlayStations().flatMap((s) => s.lineIds || [s.lineId]))
      : null;

    TAIWAN_SELECTABLE_LINES.forEach((line) => {
      if (line.isHighway || !activeLineSet.has(line.id)) return;
      if (regionStationLineIds && !regionStationLineIds.has(line.id)) return;

      if (line.stKind === "mrt" || line.stKind === "lrt") {
        if (isOpenRailReady && state.hideMrtLinesOnOpenRail) return;
      } else if (line.drawCustomLine === false) {
        return;
      }

      const vectorPolylines = buildStationAnchoredVectorPolylines(line);

      vectorPolylines.forEach((pts) => {
        if (!pts || pts.length < 2) return;
        L.polyline(pts, {
          renderer: railCanvasRenderer,
          pane: "roadRailVectorPane",
          color: "#020617",
          weight: 4.4,
          opacity: 0.78,
          interactive: false
        }).addTo(customGroup);

        const isHl = typeof state !== "undefined" && state.highlightedLineId === line.id;
        const fgLine = L.polyline(pts, {
          renderer: railCanvasRenderer,
          pane: "roadRailVectorPane",
          color: line.color || (line.stKind === "tra" ? "#003b73" : "#38bdf8"),
          weight: 2.6,
          opacity: 0.96,
          dashArray: line.dash || null,
          interactive: true
        }).addTo(customGroup);
        if (isHl) fgLine.setStyle({ weight: 4.4, opacity: 1 });
        if (typeof window.bindRailIslandLineInteraction === "function") window.bindRailIslandLineInteraction(fgLine, line);
      });
    });
  }

  // 3. Draw Station Dots as Native Geographic L.circleMarker on railCanvasRenderer (ZERO zoom drift, 100% on the vector line!)
  const vState = typeof getActiveViewState === "function" ? getActiveViewState() : state;
  const isStationQuizActive =
    state.quizTargetMode !== "region" &&
    state.stationQuizEnabled &&
    state.quizStationLines instanceof Set &&
    state.quizStationLines.size > 0;
  const activeStations = getVisualOverlayStations();
  activeStations.forEach((st) => {
    const hideGuessed = typeof isHideGuessedOthersActive === "function" && isHideGuessedOthersActive(vState);
    const isUnlocked = !hideGuessed && isStationQuizActive && vState.unlockedStations.has(st.key);
    const isMissed =
      !hideGuessed &&
      isStationQuizActive &&
      ((vState.isGameOver && !isUnlocked) || (vState.missedStations && vState.missedStations.has(st.key)));
    const isTarget = isStationQuizActive && vState.targetStationKey === st.key;

    let radius = st.stKind === "thsr" ? 4.8 : 3.8;
    let strokeColor = st.color || (st.stKind === "tra" ? "#003b73" : "#38bdf8");
    let fillColor = "#f8fafc";
    let strokeWeight = 2.0;

    if (isTarget) {
      radius = 7.0;
      strokeColor = "#ea580c";
      fillColor = "#fde047";
      strokeWeight = 2.6;
    } else if (isUnlocked) {
      radius = 5.2;
      strokeColor = "#ffffff";
      fillColor = "#10b981";
      strokeWeight = 2.0;
    } else if (isMissed) {
      radius = 4.6;
      strokeColor = "#fecdd3";
      fillColor = "#f43f5e";
      strokeWeight = 1.8;
    } else if (st.stKind === "thsr") {
      strokeColor = "#ea580c";
      fillColor = "#fff7ed";
      strokeWeight = 2.2;
    }

    const circleMarker = L.circleMarker([st.lat, st.lng], {
      renderer: railCanvasRenderer,
      pane: "roadRailVectorPane",
      radius,
      color: strokeColor,
      weight: strokeWeight,
      fillColor,
      fillOpacity: 1.0,
      interactive: true
    });

    circleMarker.on("click", (ev) => {
      L.DomEvent.stopPropagation(ev);
      const stLineIds = Array.isArray(st.lineIds) && st.lineIds.length > 0 ? st.lineIds : [st.lineId];
      const lineSummaries = stLineIds.map((lid) => {
        const lineObj = TAIWAN_SELECTABLE_LINES.find((l) => l.id === lid);
        const lName = lineObj
          ? (typeof getLineDisplayName === "function" ? getLineDisplayName(lineObj) : lineObj.name)
          : st.lineName;
        const lineStations = activeStations.filter((s) => (s.lineIds && s.lineIds.includes(lid)) || s.lineId === lid);
        const uCount = lineStations.filter((s) => vState.unlockedStations.has(s.key)).length;
        return lineStations.length > 0 ? `${lName} (${uCount}/${lineStations.length}站)` : lName;
      });
      const lineInfoText = lineSummaries.join("、") || st.lineName;

      if (state.role === "spectator") {
        setFeedback(
          isUnlocked
            ? `👁️ 觀戰檢視：選手已解鎖車站「${st.displayName}」（所屬路線：${lineInfoText}）`
            : `👁️ 觀戰檢視：尚未解鎖車站（所屬路線：${lineInfoText}）`,
          "info"
        );
        return;
      }

      // 一般自由模式 (playMode === "free") 或未啟用車站猜謎：點擊車站僅顯示所屬路線資訊，絕不鎖定目標或彈出指定視窗！
      if (!isStationQuizActive || state.playMode === "free") {
        state.targetStationKey = null;
        state.highlightedLineId = state.highlightedLineId === st.lineId ? null : st.lineId;
        updateRoadAndRailwayTileOverlays();
        if (isUnlocked) {
          setFeedback(`🚉 車站資訊：【${st.displayName}】· 所屬路線：${lineInfoText}`, "info");
        } else if (state.showStationNames || (state.showStationTerminusHints && st.isTerminus)) {
          setFeedback(`🛤️ 路線資訊：【${lineInfoText}】· 車站：${st.displayName}`, "info");
        } else {
          setFeedback(`🛤️ 路線資訊：此車站隸屬【${lineInfoText}】`, "info");
        }
        return;
      }

      if (state.playMode !== "target_click") {
        setFeedback(`🛤️ 路線資訊：此車站隸屬【${lineInfoText}】`, "info");
        return;
      }
      // 指定點選模式 (target_click)
      if (isUnlocked) {
        setFeedback(`🚉 已解鎖車站：【${st.displayName}】· 所屬路線：${lineInfoText}`, "info");
        return;
      }
      state.targetStationKey = st.key;
      state.targetId = null;
      state.lastTargetLat = st.lat;
      state.lastTargetLng = st.lng;
      state.hintLevel = 0;
      updateRoadAndRailwayTileOverlays();
      refreshAllPolygonStyles();
      updateTargetBannerUI();
      setFeedback(`🎯 已指定目標車站（所屬路線：${lineInfoText}），請在下方輸入站名作答！`, "warn");
      const inp = document.getElementById("answer-input");
      if (inp) inp.focus({ preventScroll: true });
    });

    if (isUnlocked) {
      circleMarker.bindTooltip(st.displayName, {
        permanent: true,
        direction: "right",
        offset: [6, 0],
        className: "tw-st-tip-unlocked"
      });
    } else if (isMissed) {
      circleMarker.bindTooltip(st.displayName, {
        permanent: true,
        direction: "right",
        offset: [6, 0],
        className: "tw-st-tip-missed"
      });
    } else if (state.showStationNames) {
      circleMarker.bindTooltip(`${st.lineName} · ${st.displayName}`, {
        direction: "top",
        offset: [0, -6],
        className: "tw-st-tip-hover"
      });
    } else if (state.showStationTerminusHints && st.isTerminus) {
      circleMarker.bindTooltip(`🚩 端點站提示：${st.displayName}（${st.lineName}）`, {
        direction: "top",
        offset: [0, -6],
        className: "tw-st-tip-hover"
      });
    }

    circleMarker.addTo(customGroup);
  });
}


// === [Open-Data High-Precision Rail Vector & Interactive Line Upgrade v3] ===
(function applyRailIslandVectorUpgrade() {
  function snapPointToSegments(lat, lng, segments, maxDistDeg = 0.008) {
    if (!Array.isArray(segments) || !segments.length) return [lat, lng];
    let bestLat = lat, bestLng = lng, minD2 = maxDistDeg * maxDistDeg;
    const cosLat = Math.cos((lat * Math.PI) / 180);
    for (const seg of segments) {
      for (let i = 0; i < seg.length - 1; i++) {
        const [y1, x1] = seg[i];
        const [y2, x2] = seg[i + 1];
        const dx = (x2 - x1) * cosLat;
        const dy = y2 - y1;
        const len2 = dx * dx + dy * dy;
        let t = 0;
        if (len2 > 1e-12) {
          t = (((lng - x1) * cosLat) * dx + (lat - y1) * dy) / len2;
          t = Math.max(0, Math.min(1, t));
        }
        const projLat = y1 + t * (y2 - y1);
        const projLng = x1 + t * (x2 - x1);
        const d2 = Math.pow((lng - projLng) * cosLat, 2) + Math.pow(lat - projLat, 2);
        if (d2 < minD2) {
          minD2 = d2;
          bestLat = Number(projLat.toFixed(6));
          bestLng = Number(projLng.toFixed(6));
        }
      }
    }
    return [bestLat, bestLng];
  }

  if (typeof TAIWAN_SELECTABLE_LINES !== 'undefined' && window.RAILISLAND_SHAPES) {
    TAIWAN_SELECTABLE_LINES.forEach(line => {
      if (window.RAILISLAND_LINE_COLORS && window.RAILISLAND_LINE_COLORS[line.id]) {
        line.color = window.RAILISLAND_LINE_COLORS[line.id];
      }
      if (line.id !== 'hw_freeway') {
        line.drawCustomLine = true;
      }
      const segs = window.RAILISLAND_SHAPES[line.id];
      if (Array.isArray(segs) && segs.length > 0 && Array.isArray(line.stations)) {
        line.stations.forEach(st => {
          if (Array.isArray(st) && st.length >= 3) {
            const [snappedLat, snappedLng] = snapPointToSegments(st[1], st[2], segs);
            st[1] = snappedLat;
            st[2] = snappedLng;
          }
        });
      }
    });
  }

  const origBuildPolylines = typeof buildStationAnchoredVectorPolylines === 'function'
    ? buildStationAnchoredVectorPolylines
    : null;

  window.buildStationAnchoredVectorPolylines = function(line) {
    if (line && window.RAILISLAND_SHAPES && Array.isArray(window.RAILISLAND_SHAPES[line.id]) && window.RAILISLAND_SHAPES[line.id].length > 0) {
      return window.RAILISLAND_SHAPES[line.id];
    }
    return origBuildPolylines ? origBuildPolylines(line) : [];
  };
  if (typeof buildStationAnchoredVectorPolylines !== 'undefined') {
    buildStationAnchoredVectorPolylines = window.buildStationAnchoredVectorPolylines;
  }

  window.bindRailIslandLineInteraction = function(poly, line) {
    if (!poly || !line) return;
    const displayName = typeof getLineDisplayName === 'function' ? getLineDisplayName(line) : line.name;
    poly.on('click', function(ev) {
      if (window.L && L.DomEvent) L.DomEvent.stopPropagation(ev);
      if (typeof state !== 'undefined') {
        state.highlightedLineId = (state.highlightedLineId === line.id) ? null : line.id;
      }
      if (typeof setFeedback === 'function') {
        const stCount = Array.isArray(line.stations) ? line.stations.length : 0;
        setFeedback(`🛤️ 已選取路線：【${displayName}】（共 ${stCount} 站）`, 'ok');
      }
      if (typeof updateRoadAndRailwayTileOverlays === 'function') {
        updateRoadAndRailwayTileOverlays();
      }
    });
    poly.bindTooltip(`<b>${displayName}</b>`, {
      sticky: true,
      direction: 'top',
      offset: [0, -6],
      className: 'tw-st-tip-hover'
    });
  };
})();
