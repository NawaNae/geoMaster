// =========================================================================
// 5. OPTIMIZED VIEWPORT-CULLED, ZOOM-SCALED LABELS & LEADER LINES ENGINE
//    - Strictly culls out-of-viewport regions (地圖外區域不顯示名稱)
//    - Hides tiny regions when zoomed out (縮小到一定程度小的區域不顯示)
//    - Scales font size down smoothly at lower zoom levels
// =========================================================================
let lastRenderCenter = null;
let lastRenderZoom = null;

function renderSmartLabelsAndLeaderLines() {
  const svgEl = document.getElementById("leader-overlay-svg");
  const domEl = document.getElementById("labels-overlay-dom");
  if (!svgEl || !domEl || !map) return;

  // Reset GPU transform before laying out crisp labels at the current zoom & center
  svgEl.style.transition = "none";
  domEl.style.transition = "none";
  svgEl.style.transform = "translate3d(0px, 0px, 0) scale(1)";
  domEl.style.transform = "translate3d(0px, 0px, 0) scale(1)";

  lastRenderCenter = map.getCenter();
  lastRenderZoom = map.getZoom();

  svgEl.replaceChildren();
  domEl.replaceChildren();
  if (state.playMode === "pin_drop") return;

  const mapSize = map.getSize();
  const zoom = lastRenderZoom;

  // Margin inside viewport so labels near the edges or outside map never render
  const padX = 16;
  const padY = 48;

  const itemsToLabel = [];
  const vState = typeof getActiveViewState === "function" ? getActiveViewState() : state;
  const activePack = typeof getActiveMapPack === "function" ? getActiveMapPack() : null;
  const activeGroups = typeof getActiveGroups === "function" ? getActiveGroups() : TAIWAN_ADMIN_DATA;
  const activeItems = typeof getActiveItems === "function" ? getActiveItems() : ALL_TOWNS;
  const mv = typeof getActivePackMapView === "function" ? getActivePackMapView() : { defaultZoom: 8, targetFocusZoom: 11, center: [23.75, 120.95] };
  const baseZoom = Number.isFinite(mv.defaultZoom) ? mv.defaultZoom : 8;
  const isSingleLayer = typeof isActivePackSingleLayer === "function" ? isActivePackSingleLayer() : false;

  if (state.difficulty === "county_only") {
    activeGroups.forEach((c) => {
      if (!state.selectedCounties.has(c.name)) return;
      if (!vState.unlockedCounties.has(c.name) && !vState.isGameOver) return;
      const pt = map.latLngToContainerPoint([c.lat, c.lng]);
      // Strict Viewport Culling (地圖外不顯示)
      if (pt.x < padX || pt.y < padY || pt.x > mapSize.x - padX || pt.y > mapSize.y - padY) return;
      itemsToLabel.push({
        id: c.name,
        label: c.name,
        fullTitle: c.province ? `${c.province} · ${c.name}` : c.name,
        pt,
        pxWidth: zoom >= baseZoom ? 68 : 38,
        pxHeight: zoom >= baseZoom ? 30 : 18,
        isMissed: !vState.unlockedCounties.has(c.name),
        lat: c.lat,
        lng: c.lng
      });
    });
  } else {
    activeItems.forEach((t) => {
      if (!isTownInScope(t)) return;
      const unlocked = vState.unlockedTowns.has(t.id);
      const missed = vState.missedTowns.has(t.id);
      if (!unlocked && !missed) return;

      const pt = map.latLngToContainerPoint([t.lat, t.lng]);
      // Strict Viewport Culling (地圖外區域不顯示名稱)
      if (pt.x < padX || pt.y < padY || pt.x > mapSize.x - padX || pt.y > mapSize.y - 90) return;

      let pxWidth = 20;
      let pxHeight = 14;
      if (t.bounds && t.bounds.isValid()) {
        const nw = map.latLngToContainerPoint(t.bounds.getNorthWest());
        const se = map.latLngToContainerPoint(t.bounds.getSouthEast());
        pxWidth = Math.abs(se.x - nw.x);
        pxHeight = Math.abs(se.y - nw.y);
      }

      // When zoomed out relative to pack default zoom, hide tiny polygons below threshold
      const minPx = zoom <= baseZoom - 1 ? state.minPolygonPixelSize + 8 : zoom <= baseZoom ? state.minPolygonPixelSize : zoom <= baseZoom + 1 ? Math.max(12, state.minPolygonPixelSize - 6) : 0;
      if (zoom <= baseZoom + 1 && pxWidth < minPx && pxHeight < minPx && state.leaderLineMode !== "all_callout") {
        return;
      }

      const displayLabel = isSingleLayer
        ? t.townName
        : (zoom >= baseZoom + 4 && t.countyShort
            ? `${t.countyShort}·${t.townName}`
            : zoom <= baseZoom
            ? (t.baseName || t.townName)
            : t.townName);

      itemsToLabel.push({
        id: t.id,
        label: displayLabel,
        fullTitle: t.fullHierarchyName || t.fullCountyTown || t.townName,
        pt,
        pxWidth,
        pxHeight,
        isMissed: missed,
        lat: t.lat,
        lng: t.lng
      });
    });
  }

  // Dynamic Font Size based on Zoom Level (先稍微縮小字，隨放大變大)
  const fontSizePx = typeof computeMapZoomScaleMetrics === "function" ? computeMapZoomScaleMetrics(zoom).labelFontPx : (zoom >= 12 ? 12.5 : zoom === 11 ? 11.5 : zoom === 10 ? 10.5 : zoom === 9 ? 9.5 : 8.5);
  const charPx = fontSizePx * 0.92;

  const calloutQueue = [];
  const docFrag = document.createDocumentFragment();

  itemsToLabel.forEach((item) => {
    const requiredWidth = item.label.length * charPx + 4;
    const fitsInside =
      state.leaderLineMode === "inline_only" ||
      (state.leaderLineMode === "smart" && item.pxWidth >= requiredWidth && item.pxHeight >= fontSizePx + 2);

    if (fitsInside) {
      const div = document.createElement("div");
      div.className = "map-inline-label";
      div.style.left = `${Math.round(item.pt.x)}px`;
      div.style.top = `${Math.round(item.pt.y)}px`;
      div.style.fontSize = `${fontSizePx}px`;
      if (item.isMissed) {
        div.style.color = "#fda4af";
      }
      div.textContent = item.label;
      docFrag.appendChild(div);
    } else if (state.leaderLineMode !== "inline_only") {
      calloutQueue.push(item);
    }
  });

  // Respect user's Max Visible Callouts setting for smooth performance
  const maxCallouts = Math.min(state.maxVisibleCallouts, zoom <= baseZoom - 1 ? 12 : zoom <= baseZoom ? 24 : state.maxVisibleCallouts);
  const placedBoxes = [];

  // Sort callouts by polygon size descending so larger/more prominent ones get labeled first
  calloutQueue.sort((a, b) => b.pxWidth - a.pxWidth);

  const calloutFocusZoom = Number.isFinite(mv.targetFocusZoom) ? mv.targetFocusZoom : 11;
  calloutQueue.slice(0, maxCallouts).forEach((item, idx) => {
    const isEastSide = !activePack || activePack.id === "tw_modern"
      ? item.lng >= 121.15
      : item.pt.x >= mapSize.x / 2;
    const dirX = isEastSide ? 1 : -1;
    const baseOffsetX = dirX * (34 + (idx % 3) * 22);
    let targetX = Math.max(46, Math.min(mapSize.x - 46, Math.round(item.pt.x + baseOffsetX)));
    let targetY = Math.round(item.pt.y + ((idx % 5) - 2) * 13);

    for (let pass = 0; pass < 6; pass++) {
      const hit = placedBoxes.find(
        (b) => Math.abs(b.x - targetX) < 58 && Math.abs(b.y - targetY) < 19
      );
      if (!hit) break;
      targetY += pass % 2 === 0 ? 20 : -20;
    }
    targetY = Math.max(58, Math.min(mapSize.y - 108, targetY));
    placedBoxes.push({ x: targetX, y: targetY });

    const elbowX = Math.round(item.pt.x + dirX * 12);
    const strokeColor = item.isMissed ? "rgba(251, 113, 133, 0.72)" : "rgba(56, 189, 248, 0.72)";

    const path = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    path.setAttribute("points", `${Math.round(item.pt.x)},${Math.round(item.pt.y)} ${elbowX},${targetY} ${targetX},${targetY}`);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", strokeColor);
    path.setAttribute("stroke-width", "1.2");
    svgEl.appendChild(path);

    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", Math.round(item.pt.x));
    dot.setAttribute("cy", Math.round(item.pt.y));
    dot.setAttribute("r", "2.2");
    dot.setAttribute("fill", item.isMissed ? "#fb7185" : "#38bdf8");
    svgEl.appendChild(dot);

    const pill = document.createElement("div");
    pill.className = `map-callout-label ${item.isMissed ? "missed" : ""}`;
    pill.style.left = `${targetX}px`;
    pill.style.top = `${targetY}px`;
    pill.textContent = item.label;
    pill.title = `${item.fullTitle} (點擊放大定位)`;
    pill.addEventListener("click", () => {
      map.flyTo([item.lat, item.lng], Math.max(map.getZoom(), calloutFocusZoom), { duration: 0.5 });
    });
    docFrag.appendChild(pill);
  });

  domEl.appendChild(docFrag);
}
