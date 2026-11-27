// ============================================================================
// 8. SPOILER-FREE PROGRESS DASHBOARD & QUICK COUNTY ZOOM CHIPS
// ============================================================================
function _dashPack() {
  return typeof getActiveMapPack === "function" ? getActiveMapPack() : null;
}

function _dashPackId() {
  const p = _dashPack();
  return (p && p.id) || (typeof state !== "undefined" && state.activeMapPackId) || "tw_modern";
}

function _dashIsTwModern() {
  return _dashPackId() === "tw_modern";
}

function _dashItems() {
  if (typeof getActiveItems === "function") return getActiveItems();
  return typeof ALL_TOWNS !== "undefined" ? ALL_TOWNS : [];
}

function _dashGroups() {
  if (typeof getActiveGroups === "function") return getActiveGroups();
  return typeof TAIWAN_ADMIN_DATA !== "undefined" ? TAIWAN_ADMIN_DATA : [];
}

function _dashGroupColor(name) {
  if (typeof getActiveGroupColor === "function") return getActiveGroupColor(name);
  return typeof COUNTY_COLORS !== "undefined" && COUNTY_COLORS[name] ? COUNTY_COLORS[name] : "#38bdf8";
}

function _dashUnitLabels() {
  if (typeof getActivePackUnitLabels === "function") return getActivePackUnitLabels();
  return { group: "縣市", item: "鄉鎮市區", itemShort: "區", fullScopeLabel: "全台 368 區" };
}

function _dashFeatures() {
  if (typeof getActivePackFeatures === "function") return getActivePackFeatures();
  return {
    supportsTransportQuiz: true,
    supportsPoiQuiz: true,
    supportsMasterHierarchy: true,
    supportsSuffixDifficulty: true,
    quickSuffixes: ["區", "鄉", "鎮", "市"],
    supportedDifficulties: ["casual", "county_only", "hard_suffix", "hard_full", "master_hierarchy"]
  };
}

function _dashIsSingleLayer() {
  if (typeof isActivePackSingleLayer === "function") return isActivePackSingleLayer();
  return false;
}

function _dashUnlockViewport(opts) {
  if (typeof unlockMapViewportToPack === "function") {
    unlockMapViewportToPack(opts);
  } else if (typeof unlockMapViewportToTaiwan === "function") {
    unlockMapViewportToTaiwan(opts);
  }
}

function getLimitedRoundStats(vStateArg = null, fallbackRaw = null) {
  if (state.playMode !== "target_random" && state.playMode !== "satellite_quiz") {
    return null;
  }
  const limit = Math.max(0, parseInt(state.targetQuestionLimit, 10) || 0);
  if (limit <= 0) return null;

  const vState = vStateArg || (typeof getActiveViewState === "function" ? getActiveViewState() : state);
  const queue = Array.isArray(state.targetQueue) && state.targetQueue.length > 0 ? state.targetQueue : null;
  const emptyPoiBreakdown = {
    airport: { current: 0, total: 0 },
    port: { current: 0, total: 0 },
    reservoir: { current: 0, total: 0 },
    lake: { current: 0, total: 0 },
    settlement: { current: 0, total: 0 }
  };

  if (queue) {
    let regionTotal = 0;
    let regionCurrent = 0;
    let stationTotal = 0;
    let stationCurrent = 0;
    let poiTotal = 0;
    let poiCurrent = 0;

    const uCounties = vState.unlockedCounties || new Set();
    const uTowns = vState.unlockedTowns || new Set();
    const uStations = vState.unlockedStations || new Set();
    const uPois = vState.unlockedPois || state.unlockedPois || new Set();
    const activePois =
      (_dashFeatures().supportsPoiQuiz || _dashFeatures().supportsCapitalQuiz || _dashFeatures().supportsLandmarkQuiz) && typeof getActiveQuizPois === "function"
        ? getActiveQuizPois()
        : [];
    const poiById = activePois.length > 0 ? new Map(activePois.map((p) => [p.id, p])) : null;

    queue.forEach((entry) => {
      if (!entry) return;
      if (entry.kind === "station") {
        stationTotal++;
        if (uStations.has(entry.id)) stationCurrent++;
      } else if (entry.kind === "poi") {
        poiTotal++;
        const unlocked = uPois.has(entry.id);
        if (unlocked) poiCurrent++;
        const poiObj = poiById ? poiById.get(entry.id) : null;
        const cats = poiObj
          ? (Array.isArray(poiObj.categories) && poiObj.categories.length > 0 ? poiObj.categories : [poiObj.category])
          : [];
        cats.forEach((cat) => {
          if (emptyPoiBreakdown[cat]) {
            emptyPoiBreakdown[cat].total++;
            if (unlocked) emptyPoiBreakdown[cat].current++;
          }
        });
      } else if (entry.kind === "county") {
        regionTotal++;
        if (uCounties.has(entry.id)) regionCurrent++;
      } else {
        regionTotal++;
        if (uTowns.has(entry.id)) regionCurrent++;
      }
    });

    const grandTotal = queue.length;
    const grandCurrent = regionCurrent + stationCurrent + poiCurrent;
    const isSpectatingOther = Boolean(vState && vState.spectatingPlayer);
    const passedCount =
      !isSpectatingOther && state.passedTargetKeys instanceof Set
        ? queue.filter((entry) => state.passedTargetKeys.has(`${entry.kind}:${entry.id}`)).length
        : 0;

    return {
      isLimited: true,
      limit,
      grandTotal,
      grandCurrent,
      regionTotal,
      regionCurrent,
      stationTotal,
      stationCurrent,
      poiTotal,
      poiCurrent,
      poiBreakdown: emptyPoiBreakdown,
      passedCount,
      remainingCount: Math.max(0, grandTotal - grandCurrent - passedCount)
    };
  }

  const rawPool = fallbackRaw && Number.isFinite(fallbackRaw.grandTotal) ? fallbackRaw.grandTotal : 0;
  const rawCur = fallbackRaw && Number.isFinite(fallbackRaw.grandCurrent) ? fallbackRaw.grandCurrent : 0;
  const grandTotal = rawPool > 0 ? Math.min(limit, rawPool) : limit;
  const grandCurrent = Math.min(grandTotal, rawCur);
  return {
    isLimited: true,
    limit,
    grandTotal,
    grandCurrent,
    regionTotal: grandTotal,
    regionCurrent: grandCurrent,
    stationTotal: 0,
    stationCurrent: 0,
    poiTotal: 0,
    poiCurrent: 0,
    poiBreakdown: emptyPoiBreakdown,
    passedCount: 0,
    remainingCount: Math.max(0, grandTotal - grandCurrent)
  };
}

function updateScoreAndProgressUI() {
  if (state.playMode === "pin_drop" && typeof renderPinDropDashboardUI === "function") {
    renderPinDropDashboardUI();
    return;
  }
  const vState = typeof getActiveViewState === "function" ? getActiveViewState() : state;
  const allItems = _dashItems();
  const features = _dashFeatures();
  const unitLabels = _dashUnitLabels();
  const singleLayer = _dashIsSingleLayer();
  const isTw = _dashIsTwModern();
  const scopeCounties = getScopeCounties();
  const scopeTowns = getScopeTowns();
  const hasRegionScope = scopeTowns.length > 0 || (state.difficulty === "county_only" && scopeCounties.length > 0);

  const titleEl = document.getElementById("progress-card-title");
  if (titleEl) {
    if (vState.spectatingPlayer) {
      titleEl.textContent = `👁️ 觀戰視角：【${vState.spectatingPlayer.name}】的總進度`;
    } else {
      titleEl.textContent = "挑戰總進度與快速定位";
    }
  }

  const unlockedCountyCount = scopeCounties.filter((c) => {
    if (state.difficulty === "county_only" || state.difficulty === "master_hierarchy") {
      return vState.unlockedCounties.has(c.name);
    }
    const uTowns = allItems.filter((t) => t.countyName === c.name && vState.unlockedTowns.has(t.id)).length;
    return vState.unlockedCounties.has(c.name) || uTowns > 0;
  }).length;

  const countyPct =
    scopeCounties.length > 0
      ? ((unlockedCountyCount / scopeCounties.length) * 100).toFixed(1)
      : "0.0";

  const unlockedTownCount = scopeTowns.filter((t) => vState.unlockedTowns.has(t.id)).length;
  const townPct =
    scopeTowns.length > 0
      ? ((unlockedTownCount / scopeTowns.length) * 100).toFixed(1)
      : "0.0";

  const activeSt = features.supportsTransportQuiz && typeof getActiveQuizStations === "function" ? getActiveQuizStations() : [];
  const unlockedStCount = activeSt.filter((s) => vState.unlockedStations.has(s.key)).length;
  const activePois = (features.supportsPoiQuiz || features.supportsCapitalQuiz || features.supportsLandmarkQuiz) && typeof getActiveQuizPois === "function" ? getActiveQuizPois() : [];
  const vUnlockedPois = vState.unlockedPois || state.unlockedPois || new Set();
  const unlockedPoiCount = activePois.filter((p) => vUnlockedPois.has(p.id)).length;
  const stAndPoiCurrent = unlockedStCount + unlockedPoiCount;
  const stAndPoiTotal = activeSt.length + activePois.length;
  const stPct =
    stAndPoiTotal > 0
      ? ((stAndPoiCurrent / stAndPoiTotal) * 100).toFixed(1)
      : "0.0";

  const regionCurrent = state.difficulty === "county_only" ? unlockedCountyCount : unlockedTownCount;
  const regionTotal = state.difficulty === "county_only" ? scopeCounties.length : scopeTowns.length;
  const regionPct = state.difficulty === "county_only" ? countyPct : townPct;

  const rawGrandCurrent = regionCurrent + unlockedStCount + unlockedPoiCount;
  const rawGrandTotal = regionTotal + activeSt.length + activePois.length;
  const limitedStats = getLimitedRoundStats(vState, {
    grandCurrent: rawGrandCurrent,
    grandTotal: rawGrandTotal
  });

  const grandCurrent = limitedStats ? limitedStats.grandCurrent : rawGrandCurrent;
  const grandTotal = limitedStats ? limitedStats.grandTotal : rawGrandTotal;
  const grandPct = grandTotal > 0 ? ((grandCurrent / grandTotal) * 100).toFixed(1) : "0.0";

  // Update Top Dual Cards (Card 1: 地區進度 or 總進度; Card 2: 車站進度 or 鄉鎮進度)
  const cLabelEl = document.getElementById("stat-county-label");
  if (limitedStats) {
    const roundModeLbl = state.playMode === "satellite_quiz" ? "🛰️ 本輪衛星進度" : "🎯 本輪答對進度";
    if (cLabelEl) cLabelEl.textContent = roundModeLbl;
    document.getElementById("stat-county-count").textContent = `${limitedStats.grandCurrent} / ${limitedStats.grandTotal} 題`;
    document.getElementById("stat-county-pct").textContent = `${grandPct}%`;
    document.getElementById("stat-county-bar").style.width = `${Math.min(100, parseFloat(grandPct))}%`;

    const doneCount = Math.min(limitedStats.grandTotal, limitedStats.grandCurrent + limitedStats.passedCount);
    const donePct = limitedStats.grandTotal > 0 ? ((doneCount / limitedStats.grandTotal) * 100).toFixed(1) : "0.0";
    document.getElementById("stat-town-label").textContent = limitedStats.passedCount > 0 ? "📋 剩餘 / 略過" : "📋 剩餘題數";
    document.getElementById("stat-town-count").textContent =
      limitedStats.passedCount > 0
        ? `剩 ${limitedStats.remainingCount} 題 · 略過 ${limitedStats.passedCount}`
        : `${limitedStats.remainingCount} 題`;
    document.getElementById("stat-town-pct").textContent = `${donePct}%`;
    document.getElementById("stat-town-bar").style.width = `${Math.min(100, parseFloat(donePct))}%`;
  } else if (regionTotal > 0 && stAndPoiTotal > 0) {
    if (cLabelEl) cLabelEl.textContent = "🗺️ 地區完成度";
    document.getElementById("stat-county-count").textContent = `${regionCurrent} / ${regionTotal} ${state.difficulty === "county_only" ? unitLabels.group : unitLabels.itemShort}`;
    document.getElementById("stat-county-pct").textContent = `${regionPct}%`;
    document.getElementById("stat-county-bar").style.width = `${Math.min(100, parseFloat(regionPct))}%`;

    const onlyCap = activePois.length > 0 && activePois.every((p) => p.category === "capital");
    const capIcon = typeof getPoiCategoryIcon === "function" ? getPoiCategoryIcon("capital") : "◎";
    const capLbl = typeof getPoiCategoryLabel === "function" ? getPoiCategoryLabel("capital") : "首都／省會";
    const secLabel = activeSt.length > 0 && activePois.length > 0
      ? "🚉📍 車站與地標"
      : onlyCap
      ? `${capIcon} ${capLbl}完成度`
      : activePois.length > 0
      ? "📍 地標完成度"
      : "🚉 車站完成度";
    const secUnit = activeSt.length > 0 && activePois.length === 0 ? "站" : "處";
    document.getElementById("stat-town-label").textContent = secLabel;
    document.getElementById("stat-town-count").textContent = `${stAndPoiCurrent} / ${stAndPoiTotal} ${secUnit}`;
    document.getElementById("stat-town-pct").textContent = `${stPct}%`;
    document.getElementById("stat-town-bar").style.width = `${Math.min(100, parseFloat(stPct))}%`;
  } else if (regionTotal === 0 && activePois.length > 0 && activeSt.length === 0) {
    // Pure POI / Capital Mode
    const activeCats = ["airport", "port", "reservoir", "lake", "settlement", "capital", "landmark"]
      .map((cat) => ({ cat, items: typeof getActiveQuizPois === "function" ? getActiveQuizPois(cat) : [] }))
      .filter((entry) => entry.items.length > 0);
    const poiUnitFor = (cat) => (cat === "capital" || cat === "settlement" || cat === "landmark" ? "處" : "座");

    if (activeCats.length === 2) {
      const [c1, c2] = activeCats;
      const m1 = POI_CATEGORY_META[c1.cat] || { icon: "📍", label: c1.cat };
      const m2 = POI_CATEGORY_META[c2.cat] || { icon: "📍", label: c2.cat };
      const i1 = typeof getPoiCategoryIcon === "function" ? getPoiCategoryIcon(c1.cat) : m1.icon;
      const i2 = typeof getPoiCategoryIcon === "function" ? getPoiCategoryIcon(c2.cat) : m2.icon;
      const l1 = typeof getPoiCategoryLabel === "function" ? getPoiCategoryLabel(c1.cat) : m1.label;
      const l2 = typeof getPoiCategoryLabel === "function" ? getPoiCategoryLabel(c2.cat) : m2.label;
      const cur1 = c1.items.filter((p) => vUnlockedPois.has(p.id)).length;
      const cur2 = c2.items.filter((p) => vUnlockedPois.has(p.id)).length;
      const pct1 = ((cur1 / c1.items.length) * 100).toFixed(1);
      const pct2 = ((cur2 / c2.items.length) * 100).toFixed(1);

      if (cLabelEl) cLabelEl.textContent = `${i1} ${l1}進度`;
      document.getElementById("stat-county-count").textContent = `${cur1} / ${c1.items.length} ${poiUnitFor(c1.cat)}`;
      document.getElementById("stat-county-pct").textContent = `${pct1}%`;
      document.getElementById("stat-county-bar").style.width = `${Math.min(100, parseFloat(pct1))}%`;

      document.getElementById("stat-town-label").textContent = `${i2} ${l2}進度`;
      document.getElementById("stat-town-count").textContent = `${cur2} / ${c2.items.length} ${poiUnitFor(c2.cat)}`;
      document.getElementById("stat-town-pct").textContent = `${pct2}%`;
      document.getElementById("stat-town-bar").style.width = `${Math.min(100, parseFloat(pct2))}%`;
    } else {
      const singleCat = activeCats.length === 1 ? activeCats[0].cat : null;
      const singleMeta = singleCat ? POI_CATEGORY_META[singleCat] : null;
      const singleIcon = singleCat && typeof getPoiCategoryIcon === "function" ? getPoiCategoryIcon(singleCat) : (singleMeta ? singleMeta.icon : "");
      const singleLbl = singleCat && typeof getPoiCategoryLabel === "function" ? getPoiCategoryLabel(singleCat) : (singleMeta ? singleMeta.label : "");
      const unitStr = singleCat ? poiUnitFor(singleCat) : "處";
      if (cLabelEl) cLabelEl.textContent = singleMeta ? `${singleIcon} ${singleLbl}總進度` : "📍 地標總進度（去重）";
      document.getElementById("stat-county-count").textContent = `${unlockedPoiCount} / ${activePois.length} ${unitStr}`;
      document.getElementById("stat-county-pct").textContent = `${grandPct}%`;
      document.getElementById("stat-county-bar").style.width = `${Math.min(100, parseFloat(grandPct))}%`;

      document.getElementById("stat-town-label").textContent = "🎯 剩餘待猜";
      document.getElementById("stat-town-count").textContent = `${activePois.length - unlockedPoiCount} ${unitStr}`;
      document.getElementById("stat-town-pct").textContent = `${grandPct}%`;
      document.getElementById("stat-town-bar").style.width = `${Math.min(100, parseFloat(grandPct))}%`;
    }
  } else if (regionTotal === 0 && activeSt.length > 0) {
    // Pure Station Mode
    const activeLineCount = state.stationQuizEnabled && state.quizStationLines.size > 0
      ? state.quizStationLines.size
      : Array.from(state.selectedTransportLines).filter((id) => !id.startsWith("hw_")).length;
    if (cLabelEl) cLabelEl.textContent = "🗺️ 已選路線數";
    document.getElementById("stat-county-count").textContent = `${activeLineCount} 條路線`;
    document.getElementById("stat-county-pct").textContent = `${stPct}%`;
    document.getElementById("stat-county-bar").style.width = `${Math.min(100, parseFloat(stPct))}%`;

    document.getElementById("stat-town-label").textContent = "🚉 車站總進度";
    document.getElementById("stat-town-count").textContent = `${unlockedStCount} / ${activeSt.length} 站`;
    document.getElementById("stat-town-pct").textContent = `${stPct}%`;
    document.getElementById("stat-town-bar").style.width = `${Math.min(100, parseFloat(stPct))}%`;
  } else if (singleLayer) {
    // Single-Layer Map Pack (avoid redundant county-level unlock bar)
    if (cLabelEl) cLabelEl.textContent = `🗺️ ${unitLabels.item}進度`;
    document.getElementById("stat-county-count").textContent = `${unlockedTownCount} / ${scopeTowns.length} ${unitLabels.itemShort}`;
    document.getElementById("stat-county-pct").textContent = `${townPct}%`;
    document.getElementById("stat-county-bar").style.width = `${Math.min(100, parseFloat(townPct))}%`;

    const remainCount = Math.max(0, scopeTowns.length - unlockedTownCount);
    document.getElementById("stat-town-label").textContent = "🎯 剩餘待猜";
    document.getElementById("stat-town-count").textContent = `${remainCount} ${unitLabels.itemShort}`;
    document.getElementById("stat-town-pct").textContent = `${townPct}%`;
    document.getElementById("stat-town-bar").style.width = `${Math.min(100, parseFloat(townPct))}%`;
  } else {
    // Pure Region Mode (2-Layer Pack)
    if (cLabelEl) cLabelEl.textContent = isTw ? "縣市級直轄市進度" : `${unitLabels.group}進度`;
    document.getElementById("stat-county-count").textContent = `${unlockedCountyCount} / ${scopeCounties.length} ${unitLabels.group}`;
    document.getElementById("stat-county-pct").textContent = `${countyPct}%`;
    document.getElementById("stat-county-bar").style.width = `${Math.min(100, parseFloat(countyPct))}%`;

    document.getElementById("stat-town-label").textContent = isTw
      ? (state.difficulty === "county_only" ? "對應鄉鎮範圍" : "鄉鎮市區進度")
      : (state.difficulty === "county_only" ? `對應${unitLabels.item}範圍` : `${unitLabels.item}進度`);
    document.getElementById("stat-town-count").textContent = state.difficulty === "county_only"
      ? `${unitLabels.group}模式 (${scopeCounties.length}${unitLabels.group})`
      : `${unlockedTownCount} / ${scopeTowns.length} ${unitLabels.itemShort}`;
    document.getElementById("stat-town-pct").textContent = `${regionPct}%`;
    document.getElementById("stat-town-bar").style.width = `${Math.min(100, parseFloat(regionPct))}%`;
  }

  // Top Header Main Metric
  if (limitedStats) {
    document.getElementById("top-metric-label").textContent =
      state.playMode === "satellite_quiz" ? "衛星限題" : "本輪進度";
    document.getElementById("top-score-display").textContent = `${limitedStats.grandCurrent} / ${limitedStats.grandTotal} 題`;
    document.getElementById("top-percent-display").textContent = `${grandPct}%`;
  } else if (regionTotal === 0 && activeSt.length > 0) {
    document.getElementById("top-metric-label").textContent = "車站完成度";
    document.getElementById("top-score-display").textContent = `${unlockedStCount} / ${activeSt.length} 站`;
    document.getElementById("top-percent-display").textContent = `${stPct}%`;
  } else if (regionTotal > 0 && activeSt.length > 0) {
    document.getElementById("top-metric-label").textContent = "總進度 (地區+站)";
    document.getElementById("top-score-display").textContent = `${unitLabels.itemShort}${regionCurrent}/${regionTotal} (${regionPct}%) · 站${unlockedStCount}/${activeSt.length} (${stPct}%)`;
    document.getElementById("top-percent-display").textContent = `總 ${grandPct}%`;
  } else {
    document.getElementById("top-metric-label").textContent = isTw
      ? (state.difficulty === "county_only" ? "縣市完成度" : "鄉鎮完成度")
      : (state.difficulty === "county_only" ? `${unitLabels.group}完成度` : `${unitLabels.item}完成度`);
    document.getElementById("top-score-display").textContent = `${regionCurrent} / ${regionTotal}`;
    document.getElementById("top-percent-display").textContent = `${regionPct}%`;
  }

  document.getElementById("local-p2p-score").textContent = `${grandCurrent} / ${grandTotal}`;
  document.getElementById("local-p2p-pct").textContent = `${grandPct}%`;
  document.getElementById("local-p2p-bar").style.width = `${Math.min(100, parseFloat(grandPct))}%`;

  const topMainBar = document.getElementById("top-main-progress-bar");
  if (topMainBar) {
    topMainBar.style.width = `${Math.min(100, parseFloat(grandPct))}%`;
  }

  // Render Dynamic Multi-Category Progress Bars (總進度 / 地區 / 軌道各系統 - 有開才顯示!)
  const multiBarsEl = document.getElementById("multi-category-progress-bars");
  if (multiBarsEl) {
    const bars = [];
    // 1. 總進度
    bars.push({
      label: limitedStats ? `🏆 本輪進度 (限 ${limitedStats.grandTotal} 題)` : "🏆 總進度",
      cur: grandCurrent,
      tot: grandTotal,
      unit: limitedStats ? "題" : "項",
      color: "linear-gradient(90deg, #38bdf8, #10b981)"
    });
    if (limitedStats) {
      if (limitedStats.regionTotal > 0 && (limitedStats.stationTotal > 0 || limitedStats.poiTotal > 0)) {
        bars.push({
          label: isTw ? "🗺️ 本輪行政區" : `🗺️ 本輪${unitLabels.item}`,
          cur: limitedStats.regionCurrent,
          tot: limitedStats.regionTotal,
          unit: "題",
          color: "#38bdf8"
        });
      }
      if (limitedStats.stationTotal > 0 && (limitedStats.regionTotal > 0 || limitedStats.poiTotal > 0)) {
        bars.push({
          label: "🚉 本輪車站",
          cur: limitedStats.stationCurrent,
          tot: limitedStats.stationTotal,
          unit: "題",
          color: "#0ea5e9"
        });
      }
      if (limitedStats.poiTotal > 0 && (limitedStats.regionTotal > 0 || limitedStats.stationTotal > 0)) {
        bars.push({
          label: "📍 本輪地標",
          cur: limitedStats.poiCurrent,
          tot: limitedStats.poiTotal,
          unit: "題",
          color: "#a855f7"
        });
      }
    } else {
      // 2. 地區 (有開才顯示)
      if (regionTotal > 0) {
        bars.push({
          label: isTw ? "🗺️ 地區 (行政區)" : `🗺️ ${unitLabels.item}`,
          cur: regionCurrent,
          tot: regionTotal,
          unit: state.difficulty === "county_only" ? unitLabels.group : unitLabels.itemShort,
          color: "#38bdf8"
        });
      }
      // 3. 軌道各系統 (僅在支援軌道測驗的地圖包且有開啟時顯示)
      if (features.supportsTransportQuiz && activeSt.length > 0) {
        const macroOrder = [
          { key: "台鐵", label: "🚆 台鐵", color: "#0ea5e9" },
          { key: "高鐵", label: "🚄 高鐵", color: "#fb923c" },
          { key: "捷運", label: "🚇 捷運", color: "#f43f5e" },
          { key: "輕軌", label: "🚋 輕軌", color: "#2dd4bf" },
          { key: "纜車", label: "🚡 纜車", color: "#a855f7" },
          { key: "林鐵", label: "🌲 林鐵", color: "#10b981" },
          { key: "糖鐵", label: "🍬 糖鐵", color: "#f59e0b" }
        ];
        macroOrder.forEach((m) => {
          const mStations = activeSt.filter((s) => s.macro === m.key);
          if (mStations.length > 0) {
            const mUnlocked = mStations.filter((s) => vState.unlockedStations.has(s.key)).length;
            bars.push({
              label: m.label,
              cur: mUnlocked,
              tot: mStations.length,
              unit: "站",
              color: m.color
            });
          }
        });
      }
    }

    multiBarsEl.replaceChildren();
    const tpl = document.getElementById("tpl-progress-bar-row");
    bars.forEach((b) => {
      const pct = b.tot > 0 ? ((b.cur / b.tot) * 100).toFixed(1) : "0.0";
      if (tpl && tpl.content) {
        const frag = tpl.content.cloneNode(true);
        const lbl = frag.querySelector(".bar-label");
        const curEl = frag.querySelector(".bar-cur");
        const totEl = frag.querySelector(".bar-tot");
        const pctEl = frag.querySelector(".bar-pct");
        const fillEl = frag.querySelector(".bar-fill");
        if (lbl) lbl.textContent = b.label;
        if (curEl) curEl.textContent = b.cur;
        if (totEl) totEl.textContent = ` / ${b.tot} ${b.unit} · `;
        if (pctEl) pctEl.textContent = `${pct}%`;
        if (fillEl) {
          fillEl.style.width = `${Math.min(100, parseFloat(pct))}%`;
          fillEl.style.background = b.color;
        }
        multiBarsEl.appendChild(frag);
      }
    });
  }

  renderQuickZoomCountyChips();
  renderCountyProgressSidebar();
}

function selectAndZoomToCounty(c, autoCloseJumpMenu = false) {
  zoomToCountyCenter(c.name);
  if (state.difficulty !== "county_only" && state.difficulty !== "casual") {
    const prefixSelect = document.getElementById("prefix-select");
    const targetVal =
      state.difficulty === "master_hierarchy"
        ? c.isSpecial ? c.name : `${c.province}${c.name}`
        : c.name;
    if (prefixSelect) {
      prefixSelect.value = targetVal;
      updateLiveCombinedPreview();
    }
  }
  if (autoCloseJumpMenu) {
    const jList = document.getElementById("quick-jump-list");
    if (jList) {
      jList.classList.add("hidden");
      jList.classList.remove("flex");
    }
  }
  setFeedback(`📍 已快速放大至「${c.name}」中心！`, "info");
}

function createCountyChipElement(c, compact = false) {
  const color = _dashGroupColor(c.name);
  const tpl = document.getElementById("tpl-county-jump-chip");
  let btn;
  if (tpl && tpl.content) {
    btn = tpl.content.firstElementChild.cloneNode(true);
    const dot = btn.querySelector(".chip-dot");
    const lbl = btn.querySelector(".chip-label");
    if (dot) dot.style.background = color;
    if (lbl) lbl.textContent = c.name;
  } else {
    btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = c.name;
  }
  if (compact) {
    btn.className = "px-1.5 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-800 transition flex items-center gap-1 truncate";
  }
  btn.title = _dashIsSingleLayer() ? `跳轉至「${c.name}」` : `跳轉至「${c.name}」並套用前綴`;
  btn.addEventListener("click", () => selectAndZoomToCounty(c, compact));
  return btn;
}

function renderQuickZoomCountyChips() {
  const bar = document.getElementById("quick-zoom-counties-bar");
  const mapJumpBar = document.getElementById("map-jump-counties-bar");
  if (bar) bar.replaceChildren();
  if (mapJumpBar) mapJumpBar.replaceChildren();

  const visibleCounties = getScopeCounties().filter((c) => isCountyRevealed(c.name));
  const unitLabels = _dashUnitLabels();
  const isTw = _dashIsTwModern();

  if (visibleCounties.length === 0) {
    if (bar) {
      const sp = document.createElement("span");
      sp.className = "text-[11px] text-slate-500 italic";
      sp.textContent = isTw
        ? "目前為純車站模式或尚未解鎖縣市 (可點下方各路線卡片快速放大至該路線！)"
        : `尚未解鎖任何${unitLabels.group}`;
      bar.appendChild(sp);
    }
    if (mapJumpBar) {
      const sp2 = document.createElement("span");
      sp2.className = "col-span-3 text-[10px] text-slate-500 italic px-1";
      sp2.textContent = isTw ? "目前為純車站模式或尚未解鎖縣市" : `尚未解鎖${unitLabels.group}`;
      mapJumpBar.appendChild(sp2);
    }
    return;
  }

  visibleCounties.forEach((c) => {
    if (bar) bar.appendChild(createCountyChipElement(c, false));
    if (mapJumpBar) mapJumpBar.appendChild(createCountyChipElement(c, true));
  });
}

function createSidebarProgressCard({ title, subTitle, badgeText, badgeClass, statText, isDone, pct, color, borderClass, onClick }) {
  const tpl = document.getElementById("tpl-sidebar-progress-card");
  let card;
  if (tpl && tpl.content) {
    card = tpl.content.firstElementChild.cloneNode(true);
    if (borderClass) card.className = borderClass;
    const dot = card.querySelector(".card-dot");
    const titleEl = card.querySelector(".card-title");
    const subEl = card.querySelector(".card-sub");
    const badgeEl = card.querySelector(".card-badge");
    const statEl = card.querySelector(".card-stat");
    const fillEl = card.querySelector(".card-fill");
    if (dot) dot.style.background = color;
    if (titleEl) titleEl.textContent = title;
    if (subEl) {
      if (subTitle) {
        subEl.textContent = subTitle;
        subEl.classList.remove("hidden");
      } else {
        subEl.classList.add("hidden");
      }
    }
    if (badgeEl) {
      badgeEl.textContent = badgeText || "📍點擊放大";
      if (badgeClass) badgeEl.className = badgeClass;
    }
    if (statEl) {
      statEl.textContent = statText;
      statEl.className = `card-stat font-mono-num text-xs shrink-0 ${isDone ? "text-emerald-400 font-bold" : "text-slate-300"}`;
    }
    if (fillEl) {
      fillEl.style.width = `${Math.min(100, parseFloat(pct))}%`;
      fillEl.style.background = color;
    }
  } else {
    card = document.createElement("div");
    card.textContent = `${title}: ${statText}`;
  }
  if (onClick) card.addEventListener("click", onClick);
  return card;
}

function renderCountyProgressSidebar() {
  const vState = typeof getActiveViewState === "function" ? getActiveViewState() : state;
  const container = document.getElementById("county-progress-list");
  const spoilerBadge = document.getElementById("hidden-counties-badge");
  const titleEl = document.getElementById("breakdown-list-title");
  if (!container) return;
  container.replaceChildren();

  const allItems = _dashItems();
  const features = _dashFeatures();
  const unitLabels = _dashUnitLabels();
  const isTw = _dashIsTwModern();
  const singleLayer = _dashIsSingleLayer();
  const activeSt = features.supportsTransportQuiz && typeof getActiveQuizStations === "function" ? getActiveQuizStations() : [];
  const activePois = (features.supportsPoiQuiz || features.supportsCapitalQuiz || features.supportsLandmarkQuiz) && typeof getActiveQuizPois === "function" ? getActiveQuizPois() : [];
  const vUnlockedPois = vState.unlockedPois || state.unlockedPois || new Set();
  const scopeCounties = getScopeCounties();

  if (titleEl) {
    const parts = [];
    const onlyCap = activePois.length > 0 && activePois.every((p) => p.category === "capital");
    const capLbl = typeof getPoiCategoryLabel === "function" ? getPoiCategoryLabel("capital") : "首都／省會";
    if (activePois.length > 0) parts.push(onlyCap ? capLbl : "地標");
    if (activeSt.length > 0) parts.push("車站路線");
    if (scopeCounties.length > 0) parts.push(isTw ? "各縣市" : `各${unitLabels.group}`);
    titleEl.textContent = parts.length > 0 ? `${parts.join("與")}完成度明細` : "挑戰進度明細";
  }

  if ((features.supportsPoiQuiz || features.supportsCapitalQuiz || features.supportsLandmarkQuiz) && activePois.length > 0) {
    const onlyCap = activePois.every((p) => p.category === "capital");
    const capIcon = typeof getPoiCategoryIcon === "function" ? getPoiCategoryIcon("capital") : "◎";
    const capLbl = typeof getPoiCategoryLabel === "function" ? getPoiCategoryLabel("capital") : "首都／省會";
    const poiHeader = document.createElement("div");
    poiHeader.className = "text-[11px] font-extrabold text-sky-300 uppercase tracking-wider px-1 pt-0.5";
    poiHeader.textContent = onlyCap ? `${capIcon} ${capLbl}完成度` : "📍 地標完成度（自動去重統計）";
    container.appendChild(poiHeader);

    ["airport", "port", "reservoir", "lake", "settlement", "capital", "landmark"].forEach((cat) => {
      const catPois = typeof getActiveQuizPois === "function" ? getActiveQuizPois(cat) : activePois.filter((p) => p.category === cat);
      if (catPois.length === 0) return;
      const meta = POI_CATEGORY_META[cat];
      const icon = typeof getPoiCategoryIcon === "function" ? getPoiCategoryIcon(cat) : meta.icon;
      const lbl = typeof getPoiCategoryLabel === "function" ? getPoiCategoryLabel(cat) : meta.label;
      const unitStr = cat === "capital" || cat === "settlement" || cat === "landmark" ? "處" : "座";
      const unlockedCnt = catPois.filter((p) => vUnlockedPois.has(p.id)).length;
      const pctP = ((unlockedCnt / catPois.length) * 100).toFixed(1);
      const isDone = unlockedCnt === catPois.length;
      container.appendChild(
        createSidebarProgressCard({
          title: `${icon} ${lbl}總計`,
          subTitle: "",
          badgeText: isDone ? "✅ 制霸" : "📍縮放",
          badgeClass: isDone
            ? "card-badge text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 shrink-0"
            : "card-badge text-[10px] px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-300 shrink-0",
          statText: `${unlockedCnt} / ${catPois.length} ${unitStr} · ${pctP}%`,
          isDone,
          pct: pctP,
          color: meta.accent,
          borderClass: isDone ? "border-emerald-500/40" : "border-sky-500/30",
          onClick: () => {
            if (typeof map !== "undefined" && map && typeof L !== "undefined" && catPois.length > 0) {
              const b = L.latLngBounds(catPois.map((p) => [p.lat, p.lng]));
              if (b.isValid()) map.fitBounds(b, { padding: [36, 36], maxZoom: 10 });
            }
          }
        })
      );
    });
  }

  if (features.supportsTransportQuiz && activeSt.length > 0) {
    const activeLinesSet = state.stationQuizEnabled && state.quizStationLines.size > 0
      ? state.quizStationLines
      : state.selectedTransportLines;

    const sysGroups = new Map();
    activeSt.forEach((st) => {
      const sName = st.sysTotal || "軌道系統";
      if (!sysGroups.has(sName)) sysGroups.set(sName, []);
      sysGroups.get(sName).push(st);
    });

    if (sysGroups.size > 0) {
      const sysHeader = document.createElement("div");
      sysHeader.className = "text-[11px] font-extrabold text-pink-300 uppercase tracking-wider px-1 pt-0.5";
      sysHeader.textContent = "📊 軌道系統總百分比 (點擊放大該系統範圍)";
      container.appendChild(sysHeader);

      sysGroups.forEach((stArr, sysName) => {
        const totalS = stArr.length;
        const unlockedS = stArr.filter((s) => vState.unlockedStations.has(s.key)).length;
        const pctS = totalS > 0 ? ((unlockedS / totalS) * 100).toFixed(1) : "0.0";
        const isDone = unlockedS === totalS && totalS > 0;
        const barColor = (stArr[0] && stArr[0].color) || "#ec4899";

        container.appendChild(
          createSidebarProgressCard({
            title: `${sysName} 總計`,
            subTitle: "",
            badgeText: "📍點擊放大",
            badgeClass: "card-badge text-[10px] px-1.5 py-0.2 rounded bg-pink-500/15 text-pink-300 shrink-0",
            statText: `${unlockedS} / ${totalS} 站 · ${pctS}%`,
            isDone,
            pct: pctS,
            color: barColor,
            borderClass: "p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-pink-500/30 cursor-pointer transition flex flex-col gap-1",
            onClick: () => {
              if (!map || stArr.length === 0) return;
              const b = L.latLngBounds(stArr.map((x) => [x.lat, x.lng]));
              if (b.isValid()) map.flyToBounds(b.pad(0.18), { duration: 0.55, maxZoom: 13 });
              setFeedback(`📍 已放大至「${sysName}」全線範圍 (已完成 ${unlockedS}/${totalS} 站 · ${pctS}%)`, "info");
            }
          })
        );
      });
    }

    const lineHeader = document.createElement("div");
    lineHeader.className = "text-[11px] font-extrabold text-amber-300 uppercase tracking-wider px-1 pt-2";
    lineHeader.textContent = "🛤️ 各路線車站完成度 (系統.路線)";
    container.appendChild(lineHeader);

    TAIWAN_SELECTABLE_LINES.forEach((line) => {
      if (line.isHighway || !activeLinesSet.has(line.id)) return;
      const meta = LINE_DISPLAY_META[line.id] || { dotName: line.name };
      const lineStations = activeSt.filter((s) => s.lineIds && s.lineIds.includes(line.id));
      if (lineStations.length === 0) return;

      const totalL = lineStations.length;
      const unlockedL = lineStations.filter((s) => vState.unlockedStations.has(s.key)).length;
      const pctL = totalL > 0 ? ((unlockedL / totalL) * 100).toFixed(1) : "0.0";
      const isLineDone = unlockedL === totalL && totalL > 0;
      const lineTitle = typeof getLineDisplayName === "function" ? getLineDisplayName(meta.dotName || line.name) : (meta.dotName || line.name);

      container.appendChild(
        createSidebarProgressCard({
          title: lineTitle,
          subTitle: "",
          badgeText: "📍放大路線",
          badgeClass: "card-badge text-[10px] px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-300 shrink-0",
          statText: `${unlockedL} / ${totalL} 站 · ${pctL}%`,
          isDone: isLineDone,
          pct: pctL,
          color: line.color,
          borderClass: "p-2.5 rounded-xl bg-slate-900/75 hover:bg-slate-800/85 border border-slate-800 cursor-pointer transition flex flex-col gap-1",
          onClick: () => {
            if (!map || lineStations.length === 0) return;
            const b = L.latLngBounds(lineStations.map((x) => [x.lat, x.lng]));
            if (b.isValid()) map.flyToBounds(b.pad(0.2), { duration: 0.55, maxZoom: 13 });
            setFeedback(`📍 已放大至「${lineTitle}」(已完成 ${unlockedL}/${totalL} 站 · ${pctL}%)`, "info");
          }
        })
      );
    });
  }

  let hiddenCount = 0;
  if (scopeCounties.length > 0 && activeSt.length > 0) {
    const regHeader = document.createElement("div");
    regHeader.className = "text-[11px] font-extrabold text-sky-300 uppercase tracking-wider px-1 pt-2";
    regHeader.textContent = isTw ? "🗺️ 各縣市行政區完成度" : `🗺️ 各${unitLabels.group}${unitLabels.item}完成度`;
    container.appendChild(regHeader);
  }

  scopeCounties.forEach((c) => {
    const revealed = isCountyRevealed(c.name);
    if (!revealed) {
      hiddenCount++;
      return;
    }

    const countyItems = allItems.filter((t) => t.countyName === c.name);
    const totalInCounty = (Array.isArray(c.towns) && c.towns.length > 0) ? c.towns.length : countyItems.length;
    const unlockedInCounty = countyItems.filter((t) => vState.unlockedTowns.has(t.id)).length;
    const isCountyDone =
      state.difficulty === "county_only"
        ? vState.unlockedCounties.has(c.name)
        : totalInCounty > 0 && unlockedInCounty === totalInCounty;
    const pct =
      state.difficulty === "county_only"
        ? isCountyDone ? 100 : 0
        : totalInCounty > 0
        ? Math.round((unlockedInCounty / totalInCounty) * 100)
        : 0;

    const color = _dashGroupColor(c.name);

    container.appendChild(
      createSidebarProgressCard({
        title: c.name,
        subTitle: c.province ? `(${c.province})` : "",
        badgeText: "📍點擊放大",
        badgeClass: "card-badge text-[10px] px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-300 shrink-0",
        statText: state.difficulty === "county_only" ? (isCountyDone ? "✓ 已解鎖 · 100%" : "0%") : `${unlockedInCounty} / ${totalInCounty} · ${pct}%`,
        isDone: isCountyDone,
        pct,
        color,
        borderClass: "p-2.5 rounded-xl bg-slate-900/75 hover:bg-slate-800/80 border border-slate-800 cursor-pointer transition flex flex-col gap-1",
        onClick: () => {
          zoomToCountyCenter(c.name);
          if (!singleLayer && state.difficulty !== "county_only" && state.difficulty !== "casual" && state.role !== "spectator") {
            const prefixSelect = document.getElementById("prefix-select");
            const targetVal =
              state.difficulty === "master_hierarchy"
                ? c.isSpecial ? c.name : `${c.province || ""}${c.name}`
                : c.name;
            if (prefixSelect) {
              prefixSelect.value = targetVal;
              updateLiveCombinedPreview();
              setFeedback(`📍 已放大至「${c.name}」中心並套用前綴`, "info");
            }
          }
        }
      })
    );
  });

  if (hiddenCount > 0) {
    if (spoilerBadge) spoilerBadge.classList.remove("hidden");
    const tplLock = document.getElementById("tpl-spoiler-locked-card");
    if (tplLock && tplLock.content) {
      const frag = tplLock.content.cloneNode(true);
      const tEl = frag.querySelector(".locked-title");
      const dEl = frag.querySelector(".locked-desc");
      const groupUnit = isTw ? "縣市" : unitLabels.group;
      const modeName = state.difficulty === "county_only" ? `${groupUnit}挑戰` : state.difficulty === "master_hierarchy" ? "最難三階解鎖" : "困難全名";
      if (tEl) tEl.textContent = `🔒 尚有 ${hiddenCount} 個未解鎖${groupUnit}已隱藏名稱 (防止劇透)`;
      if (dEl) dEl.textContent = `在「${modeName}」模式下，未解鎖的${groupUnit}不會提前顯示於列表；當猜出該${groupUnit}後，即會自動顯示進度並開放點擊放大定位！`;
      container.appendChild(frag);
    }
  } else if (spoilerBadge) {
    spoilerBadge.classList.add("hidden");
  }
}

function checkVictoryCondition() {
  if (state.isGameOver || state.finished || state.role === "spectator") return;
  if (
    (state.playMode === "target_random" || state.playMode === "satellite_quiz") &&
    Math.max(0, parseInt(state.targetQuestionLimit, 10) || 0) > 0 &&
    Array.isArray(state.targetQueue) &&
    state.targetQueue.length > 0 &&
    typeof _isTargetEntryCompleted === "function" &&
    state.targetQueue.every((entry) => _isTargetEntryCompleted(entry))
  ) {
    finishGame(state.passedTargetKeys && state.passedTargetKeys.size > 0 ? "round_complete" : "victory");
    return;
  }
  const allItems = _dashItems();
  const features = _dashFeatures();
  const activeSt = features.supportsTransportQuiz && typeof getActiveQuizStations === "function" ? getActiveQuizStations() : [];
  const unlockedStCount = activeSt.filter((s) => state.unlockedStations.has(s.key)).length;
  const adminTotal =
    state.difficulty === "county_only"
      ? getScopeCounties().length
      : getScopeTowns().length;
  const adminCurrent =
    state.difficulty === "county_only"
      ? Array.from(state.unlockedCounties).filter((c) => state.selectedCounties.has(c)).length
      : Array.from(state.unlockedTowns).filter((id) => {
          const t = allItems.find((x) => x.id === id);
          return t && (typeof isTownInScope === "function" ? isTownInScope(t) : state.selectedCounties.has(t.countyName));
        }).length;

  const activePois = (features.supportsPoiQuiz || features.supportsCapitalQuiz || features.supportsLandmarkQuiz) && typeof getActiveQuizPois === "function" ? getActiveQuizPois() : [];
  const unlockedPoiCount = activePois.filter((p) => state.unlockedPois.has(p.id)).length;
  const total = adminTotal + activeSt.length + activePois.length;
  const current = adminCurrent + unlockedStCount + unlockedPoiCount;

  if (total > 0 && current >= total) {
    finishGame("victory");
  }
}

function giveUpAndReveal() {
  finishGame("giveup");
}

function finishGame(reason = "victory") {
  if (state.role === "spectator") return;
  stopTimer();
  state.isGameOver = true;
  state.finished = true;
  if (typeof clearSatelliteTargetMarker === "function") {
    clearSatelliteTargetMarker();
  }
  _dashUnlockViewport({ restoreLayers: false, clearMarker: true });

  const allItems = _dashItems();
  const features = _dashFeatures();
  const isLimitedQueueRound =
    (state.playMode === "target_random" || state.playMode === "satellite_quiz") &&
    Math.max(0, parseInt(state.targetQuestionLimit, 10) || 0) > 0 &&
    Array.isArray(state.targetQueue) &&
    state.targetQueue.length > 0;

  if (reason !== "victory") {
    if (isLimitedQueueRound) {
      // Only reveal unanswered targets from this N-question round instead of flooding the entire map in red
      state.targetQueue.forEach((entry) => {
        if (!entry) return;
        if (entry.kind === "poi") {
          if (!state.unlockedPois.has(entry.id) && state.missedPois) state.missedPois.add(entry.id);
        } else if (entry.kind === "station") {
          if (!state.unlockedStations.has(entry.id) && state.missedStations) state.missedStations.add(entry.id);
        } else if (entry.kind === "county") {
          if (!state.unlockedCounties.has(entry.id)) {
            allItems.filter((t) => t.countyName === entry.id).forEach((t) => state.missedTowns.add(t.id));
          }
        } else {
          if (!state.unlockedTowns.has(entry.id)) state.missedTowns.add(entry.id);
        }
      });
    } else {
      if (state.difficulty === "county_only") {
        getScopeCounties().forEach((c) => {
          if (!state.unlockedCounties.has(c.name)) {
            allItems.filter((t) => t.countyName === c.name).forEach((t) => state.missedTowns.add(t.id));
          }
        });
      } else {
        getScopeTowns().forEach((t) => {
          if (!state.unlockedTowns.has(t.id)) {
            state.missedTowns.add(t.id);
          }
        });
      }
      if ((features.supportsPoiQuiz || features.supportsCapitalQuiz || features.supportsLandmarkQuiz) && typeof getActiveQuizPois === "function") {
        getActiveQuizPois().forEach((p) => {
          if (!state.unlockedPois.has(p.id)) {
            state.missedPois.add(p.id);
          }
        });
      }
    }
  }

  updateRoadAndRailwayTileOverlays();
  refreshAllPolygonStyles();
  if (typeof refreshPoiMapLayer === "function") refreshPoiMapLayer();
  updateScoreAndProgressUI();

  const activeSt = features.supportsTransportQuiz && typeof getActiveQuizStations === "function" ? getActiveQuizStations() : [];
  const rawUnlockedStCount = activeSt.filter((s) => state.unlockedStations.has(s.key)).length;
  const activePois = (features.supportsPoiQuiz || features.supportsCapitalQuiz || features.supportsLandmarkQuiz) && typeof getActiveQuizPois === "function" ? getActiveQuizPois() : [];
  const rawUnlockedPoiCount = activePois.filter((p) => state.unlockedPois.has(p.id)).length;
  const scopeCounties = getScopeCounties();
  const scopeTowns = getScopeTowns();
  const rawAdminTotal = state.difficulty === "county_only" ? scopeCounties.length : scopeTowns.length;
  const rawAdminCurrent = state.difficulty === "county_only"
    ? Array.from(state.unlockedCounties).filter((c) => state.selectedCounties.has(c)).length
    : Array.from(state.unlockedTowns).filter((id) => {
        const t = allItems.find((x) => x.id === id);
        return t && (typeof isTownInScope === "function" ? isTownInScope(t) : state.selectedCounties.has(t.countyName));
      }).length;

  const rawGrandTotal = rawAdminTotal + activeSt.length + activePois.length;
  const rawGrandScore = rawAdminCurrent + rawUnlockedStCount + rawUnlockedPoiCount;
  const limitedStats = getLimitedRoundStats(state, {
    grandCurrent: rawGrandScore,
    grandTotal: rawGrandTotal
  });

  const adminTotal = limitedStats ? limitedStats.regionTotal : rawAdminTotal;
  const adminCurrent = limitedStats ? limitedStats.regionCurrent : rawAdminCurrent;
  const stationTotal = limitedStats ? limitedStats.stationTotal : activeSt.length;
  const unlockedStCount = limitedStats ? limitedStats.stationCurrent : rawUnlockedStCount;
  const poiTotal = limitedStats ? limitedStats.poiTotal : activePois.length;
  const unlockedPoiCount = limitedStats ? limitedStats.poiCurrent : rawUnlockedPoiCount;
  const grandTotal = limitedStats ? limitedStats.grandTotal : rawGrandTotal;
  const grandScore = limitedStats ? limitedStats.grandCurrent : rawGrandScore;

  const totalAttempts = (state.stats && state.stats.totalAttempts) || grandScore;
  const wrongAttempts = (state.stats && state.stats.wrongAttempts) || 0;
  const correctAttempts = (state.stats && state.stats.correctAttempts) || grandScore;
  const accuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : (limitedStats && limitedStats.passedCount > 0 && grandScore === 0 ? 0 : 100);
  const maxStreak = (state.stats && state.stats.maxStreak) || 0;
  const poiBreakdown = limitedStats ? limitedStats.poiBreakdown : {};
  if (!limitedStats) {
    ["airport", "port", "reservoir", "lake", "settlement", "capital", "landmark"].forEach((cat) => {
      if ((features.supportsPoiQuiz || features.supportsCapitalQuiz || features.supportsLandmarkQuiz) && typeof isPoiCategoryActive === "function" && isPoiCategoryActive(cat) && typeof getActiveQuizPois === "function") {
        const list = getActiveQuizPois(cat);
        const unlocked = list.filter((p) => state.unlockedPois.has(p.id)).length;
        poiBreakdown[cat] = { current: unlocked, total: list.length };
      } else {
        poiBreakdown[cat] = { current: 0, total: 0 };
      }
    });
  }
  const blockStats = computeClearedBlocksStats(scopeCounties, scopeTowns, activeSt);
  const limitedSummaryText = limitedStats
    ? (limitedStats.passedCount > 0
        ? `限題挑戰 ${grandScore}/${grandTotal} 題（略過 ${limitedStats.passedCount} 題）`
        : grandScore >= grandTotal && grandTotal > 0
        ? `限題挑戰 ${grandScore}/${grandTotal} 題（全數答對）`
        : `限題挑戰 ${grandScore}/${grandTotal} 題`)
    : blockStats.clearedSummaryText;

  state.finalStats = {
    name: (document.getElementById("p2p-nickname-input")?.value.trim()) || state.nickname || "玩家",
    grandScore,
    grandTotal,
    adminCurrent,
    adminTotal,
    unlockedStCount,
    stationTotal,
    poiCurrent: unlockedPoiCount,
    poiTotal,
    poiBreakdown,
    isLimitedRound: Boolean(limitedStats),
    targetQuestionLimit: limitedStats ? limitedStats.grandTotal : 0,
    passedCount: limitedStats ? limitedStats.passedCount : 0,
    fullPoolTotal: rawGrandTotal,
    elapsedSec: state.elapsedSec,
    timerMode: state.timerMode,
    countdownTotalSec: state.countdownTotalSec,
    difficulty: state.difficulty,
    completedCounties: blockStats.completedCounties,
    totalScopeCounties: blockStats.totalScopeCounties,
    completedLines: blockStats.completedLines,
    totalScopeLines: blockStats.totalScopeLines,
    completedBlocks: limitedStats ? 0 : blockStats.completedBlocks,
    totalBlocks: limitedStats ? 0 : blockStats.totalBlocks,
    clearedSummaryText: limitedSummaryText,
    accuracy,
    wrongAttempts,
    maxStreak,
    reason,
    date: new Date().toLocaleDateString("zh-TW")
  };

  playTone(reason === "victory" ? "tier" : "unlock");

  if (state.opponent.connected || state.aiRivalTimer || state.roomCode) {
    notifyP2PPlayerFinished(state.finalStats);
  }

  showSettlementModal();

  if (reason === "victory") {
    setFeedback(`🎉 恭喜全數通關！共完成 ${grandScore}/${grandTotal} 題，耗時 ${formatTime(state.elapsedSec)}！`, "tier");
  } else if (reason === "round_complete") {
    const pctDone = grandTotal > 0 ? ((grandScore / grandTotal) * 100).toFixed(1) : "0.0";
    setFeedback(`🏁 本輪 ${grandTotal} 題挑戰完成！答對 ${grandScore}/${grandTotal} 題 (${pctDone}%)，已生成挑戰成績單！`, "tier");
  } else if (reason === "timeout") {
    setFeedback("⏰ 時間到！已依答題速率與破關區塊數生成挑戰成績單。", "error");
  } else {
    setFeedback("已提早結束本局，揭曉未完成地名並生成挑戰成績單！", "warn");
  }
}

function computeClearedBlocksStats(scopeCountiesArg, scopeTownsArg, activeStArg) {
  const features = _dashFeatures();
  const unitLabels = _dashUnitLabels();
  const isTw = _dashIsTwModern();
  const scopeCounties = scopeCountiesArg || getScopeCounties();
  const scopeTowns = scopeTownsArg || getScopeTowns();
  const activeSt = features.supportsTransportQuiz
    ? (activeStArg || (typeof getActiveQuizStations === "function" ? getActiveQuizStations() : []))
    : [];
  const hasRegionScope = Boolean(state.regionQuizEnabled) && state.quizTargetMode !== "station" && (scopeTowns.length > 0 || scopeCounties.length > 0);

  let completedCounties = 0;
  let totalScopeCounties = 0;
  if (hasRegionScope) {
    if (state.difficulty === "county_only") {
      totalScopeCounties = scopeCounties.length;
      completedCounties = scopeCounties.filter((c) => state.unlockedCounties.has(c.name)).length;
    } else {
      const townsByCounty = new Map();
      scopeTowns.forEach((t) => {
        if (!townsByCounty.has(t.countyName)) townsByCounty.set(t.countyName, []);
        townsByCounty.get(t.countyName).push(t);
      });
      totalScopeCounties = townsByCounty.size;
      townsByCounty.forEach((tList) => {
        if (tList.length > 0 && tList.every((t) => state.unlockedTowns.has(t.id))) {
          completedCounties++;
        }
      });
    }
  }

  let completedLines = 0;
  let totalScopeLines = 0;
  if (features.supportsTransportQuiz && activeSt.length > 0 && state.quizStationLines instanceof Set && state.quizStationLines.size > 0) {
    const selectableLines =
      typeof getSelectableLinesForActivePack === "function"
        ? getSelectableLinesForActivePack()
        : TAIWAN_SELECTABLE_LINES;
    selectableLines.forEach((line) => {
      if (line.isHighway || !state.quizStationLines.has(line.id)) return;
      const lineSt = activeSt.filter((s) => s.lineIds && s.lineIds.includes(line.id));
      if (lineSt.length > 0) {
        totalScopeLines++;
        if (lineSt.every((s) => state.unlockedStations.has(s.key))) {
          completedLines++;
        }
      }
    });
  }

  let completedPoiCats = 0;
  let totalScopePoiCats = 0;
  const clearedPoiLabels = [];
  const capCatName = typeof getPoiCategoryLabel === "function" ? getPoiCategoryLabel("capital") : "首都／省會";
  const lmCatName = typeof getPoiCategoryLabel === "function" ? getPoiCategoryLabel("landmark") : "著名地標";
  const poiCatNames = { airport: "機場", port: "港口", reservoir: "水庫", lake: "湖泊", settlement: "傳統聚落", capital: capCatName, landmark: lmCatName };
  if ((features.supportsPoiQuiz || features.supportsCapitalQuiz || features.supportsLandmarkQuiz) && typeof isPoiCategoryActive === "function" && typeof getActiveQuizPois === "function") {
    ["airport", "port", "reservoir", "lake", "settlement", "capital", "landmark"].forEach((cat) => {
      if (!isPoiCategoryActive(cat)) return;
      const list = getActiveQuizPois(cat);
      if (list.length > 0) {
        totalScopePoiCats++;
        if (list.every((p) => state.unlockedPois.has(p.id))) {
          completedPoiCats++;
          clearedPoiLabels.push(poiCatNames[cat]);
        }
      }
    });
  }

  const completedBlocks = completedCounties + completedLines + completedPoiCats;
  const totalBlocks = totalScopeCounties + totalScopeLines + totalScopePoiCats;
  const parts = [];
  if (totalScopeCounties > 0) parts.push(`破關 ${completedCounties}/${totalScopeCounties} ${isTw ? "縣市" : unitLabels.group}`);
  if (totalScopeLines > 0) parts.push(`${completedLines}/${totalScopeLines} 路線`);
  if (totalScopePoiCats > 0) {
    parts.push(
      clearedPoiLabels.length > 0
        ? `制霸${clearedPoiLabels.join("/")} (${completedPoiCats}/${totalScopePoiCats}類)`
        : `${completedPoiCats}/${totalScopePoiCats} 類地標`
    );
  }
  const clearedSummaryText = parts.length > 0 ? parts.join(" · ") : `破關 ${completedBlocks} 區塊`;

  return {
    completedCounties,
    totalScopeCounties,
    completedLines,
    totalScopeLines,
    completedPoiCats,
    totalScopePoiCats,
    completedBlocks,
    totalBlocks,
    clearedSummaryText
  };
}

const COUNTY_MAYOR_TITLES = {
  "臺北市": { mayor: "台北市長", god: "首都天龍制霸神", expert: "台北首都專家", master: "台北街區達人" },
  "新北市": { mayor: "新北市長", god: "新北29區山海大霸主", expert: "新北山海專家", master: "新北都會達人" },
  "桃園市": { mayor: "桃園市長", god: "國門之都制霸神", expert: "桃園台地專家", master: "桃園生活圈達人" },
  "臺中市": { mayor: "台中市長", god: "中台灣山海屯霸主", expert: "台中山海屯專家", master: "大台中地理達人" },
  "臺南市": { mayor: "台南市長", god: "府城南瀛37區霸主", expert: "台南府城專家", master: "古都南瀛達人" },
  "高雄市": { mayor: "高雄市長", god: "港都山海38區大霸主", expert: "高雄港都專家", master: "南霸天港都達人" },
  "基隆市": { mayor: "基隆市長", god: "雨都港灣制霸王", expert: "基隆山海港專家", master: "雨都探索達人" },
  "新竹市": { mayor: "新竹市長", god: "竹塹風城科技霸主", expert: "新竹風城專家", master: "竹市科技達人" },
  "新竹縣": { mayor: "新竹縣長", god: "竹縣山海客庄霸主", expert: "新竹縣地理專家", master: "竹縣客庄達人" },
  "苗栗縣": { mayor: "苗栗縣長", god: "苗栗山城聖王 · 苗栗國王", expert: "苗栗山海線專家", master: "苗栗山城達人" },
  "彰化縣": { mayor: "彰化縣長", god: "半線26鄉鎮平原霸主", expert: "彰化平原專家", master: "半線古都達人" },
  "南投縣": { mayor: "南投縣長", god: "台灣內地百岳山神", expert: "南投山城專家", master: "南投百岳達人" },
  "雲林縣": { mayor: "雲林縣長", god: "雲嘉南農業首都霸主", expert: "雲林平原海口專家", master: "雲林鄉土達人" },
  "嘉義市": { mayor: "嘉義市長", god: "諸羅桃城制霸王", expert: "嘉義桃城專家", master: "諸羅城市達人" },
  "嘉義縣": { mayor: "嘉義縣長", god: "阿里山與嘉南山海霸主", expert: "嘉義山海平原專家", master: "嘉縣山海達人" },
  "屏東縣": { mayor: "屏東縣長", god: "國境之南33鄉鎮霸主", expert: "屏東山海半島專家", master: "南國半島達人" },
  "宜蘭縣": { mayor: "宜蘭縣長", god: "蘭陽平原山海霸主", expert: "宜蘭噶瑪蘭專家", master: "蘭陽山海達人" },
  "花蓮縣": { mayor: "花蓮縣長", god: "洄瀾縱谷太魯閣霸主", expert: "花蓮後山專家", master: "洄瀾山海達人" },
  "臺東縣": { mayor: "台東縣長", god: "日昇之都山海離島霸主", expert: "台東縱谷海岸專家", master: "台東山海達人" },
  "澎湖縣": { mayor: "澎湖縣長", god: "菊島群島航海霸主", expert: "澎湖菊島專家", master: "澎湖跳島達人" },
  "金門縣": { mayor: "金門縣長", god: "浯江戰地最高司令", expert: "金門戰地專家", master: "金門列島達人" },
  "連江縣": { mayor: "連江縣長", god: "馬祖列島藍眼淚霸主", expert: "馬祖列島專家", master: "馬祖跳島達人" }
};

function makeTierTitles(scopeLabel, sssTitle, ssTitle, spTitle, sTitle, aTitle, bTitle, cTitle) {
  return {
    scopeLabel,
    titles: {
      SSS: sssTitle,
      SS: ssTitle,
      "S+": spTitle,
      S: sTitle,
      A: aTitle,
      B: bTitle || `${scopeLabel}見習挑戰者`,
      C: cTitle || `${scopeLabel}啟程旅人`
    }
  };
}

function detectRegionThemeProfile() {
  const allItems = _dashItems();
  const allGroups = _dashGroups();
  const pack = _dashPack();
  const unitLabels = _dashUnitLabels();
  const townIds = state.selectedTownIds instanceof Set
    ? state.selectedTownIds
    : new Set(allItems.filter((t) => state.selectedCounties.has(t.countyName)).map((t) => t.id));
  if (!state.regionQuizEnabled || state.quizTargetMode === "station" || townIds.size === 0) return null;

  // Non-tw_modern Map Packs: clean generic pack-based theme profile
  if (!_dashIsTwModern()) {
    const packName = (pack && (pack.displayName || pack.shortLabel)) || unitLabels.fullScopeLabel || "地圖全境";
    if (
      (state.difficulty === "county_only" && state.selectedCounties.size === allGroups.length && allGroups.length > 0) ||
      (townIds.size === allItems.length && allItems.length > 0)
    ) {
      return makeTierTitles(
        packName,
        `👑 ${packName}制霸地理神`,
        `⚡ ${packName}極速宗師`,
        `🏆 ${packName}通關大師`,
        `🗺️ ${packName}地理專家`,
        `🧭 ${packName}探索達人`
      );
    }

    if (typeof getActiveRegionFilters === "function") {
      const filters = getActiveRegionFilters();
      for (const f of filters) {
        if (!f || f.id === "all") continue;
        const fIds = typeof resolveRegionFilterItemIds === "function"
          ? resolveRegionFilterItemIds(f, allItems)
          : (Array.isArray(f.itemIds) ? f.itemIds : []);
        if (fIds.length > 0 && fIds.length === townIds.size && fIds.every((id) => townIds.has(id))) {
          const fLabel = f.label || f.shortLabel || f.id;
          return makeTierTitles(
            fLabel,
            `👑 ${fLabel}制霸王者`,
            `⚡ ${fLabel}極速宗師`,
            `🏆 ${fLabel}通關大師`,
            `🗺️ ${fLabel}地理專家`,
            `🧭 ${fLabel}探索達人`
          );
        }
      }
    }

    const activeGroups = allGroups.filter((g) =>
      allItems.some((it) => it.countyName === g.name && townIds.has(it.id))
    );
    if (activeGroups.length === 1) {
      const gLabel = activeGroups[0].name;
      return makeTierTitles(
        gLabel,
        `👑 ${gLabel}制霸王者`,
        `⚡ ${gLabel}極速宗師`,
        `🏆 ${gLabel}通關大師`,
        `🗺️ ${gLabel}地理專家`,
        `🧭 ${gLabel}探索達人`
      );
    }
    const shortNames = activeGroups.slice(0, 3).map((g) => g.short || g.name).join("・");
    const label = activeGroups.length > 3
      ? `${shortNames}等${activeGroups.length}${unitLabels.group}`
      : (shortNames || packName);
    return makeTierTitles(
      label,
      `👑 ${label}制霸王者`,
      `⚡ ${label}極速宗師`,
      `🏆 ${label}通關大師`,
      `🗺️ ${label}地理專家`,
      `🧭 ${label}探索達人`
    );
  }

  if (state.difficulty === "county_only" && state.selectedCounties.size === allGroups.length && allGroups.length > 0) {
    return makeTierTitles(
      `台灣${allGroups.length}縣市`,
      `👑 台灣${allGroups.length}縣市總督 · 全島霸主`,
      `🗺️ ${allGroups.length}縣市極速制霸宗師`,
      "🗺️ 台灣縣市通關大師",
      "🗺️ 台灣縣市地理專家",
      "🧭 台灣行政區達人"
    );
  }

  if (townIds.size === allItems.length) {
    return makeTierTitles(
      "台灣全島",
      "👑 台灣全島制霸地理神",
      "🚄 環島特急神速宗師",
      "🏆 台灣全島通關大師",
      "🗺️ 台灣全島地理專家",
      "🧭 在地鄉土探索達人",
      "🌱 環島地理見習生",
      "🚶 認識台灣啟程旅人"
    );
  }

  const checkExact = (arr) => arr.length === townIds.size && arr.every((id) => townIds.has(id));

  const westCoastIds = allItems.filter((t) => TAIWAN_WEST_COAST_SET.has(t.fullCountyTown)).map((t) => t.id);
  const eastCoastIds = allItems.filter((t) => TAIWAN_EAST_COAST_SET.has(t.fullCountyTown)).map((t) => t.id);
  const bothCoastIds = Array.from(new Set([...westCoastIds, ...eastCoastIds]));
  const mountainIds = allItems.filter((t) => TAIWAN_MOUNTAIN_SET.has(t.fullCountyTown)).map((t) => t.id);
  const westPlainIds = allItems.filter((t) => TAIWAN_WEST_PLAIN_SET.has(t.fullCountyTown)).map((t) => t.id);
  const eastPlainIds = allItems.filter((t) => typeof TAIWAN_EAST_PLAIN_SET !== "undefined" && TAIWAN_EAST_PLAIN_SET.has(t.fullCountyTown)).map((t) => t.id);
  const bothPlainIds = Array.from(new Set([...westPlainIds, ...eastPlainIds]));
  const northIds = allItems.filter((t) => ["臺北市", "新北市", "基隆市", "新竹市", "桃園市", "新竹縣", "宜蘭縣"].includes(t.countyName)).map((t) => t.id);
  const centralIds = allItems.filter((t) => ["苗栗縣", "臺中市", "彰化縣", "南投縣", "雲林縣"].includes(t.countyName)).map((t) => t.id);
  const southIds = allItems.filter((t) => ["嘉義市", "嘉義縣", "臺南市", "高雄市", "屏東縣", "澎湖縣"].includes(t.countyName)).map((t) => t.id);
  const eastIds = allItems.filter((t) => ["花蓮縣", "臺東縣"].includes(t.countyName)).map((t) => t.id);
  const islandIds = allItems.filter((t) => ["澎湖縣", "金門縣", "連江縣"].includes(t.countyName)).map((t) => t.id);
  const sixIds = allItems.filter((t) => t.isSpecial).map((t) => t.id);
  const westIds = allItems.filter((t) => TAIWAN_WEST_COUNTY_SET.has(t.countyName)).map((t) => t.id);

  if (checkExact(westCoastIds)) {
    return makeTierTitles(
      "西部濱海",
      "👑 西濱王者 · 台61破風霸主",
      "🌊 西濱極速領航宗師",
      "🌅 西海岸全線通關大師",
      "🌊 西部濱海專家",
      "🦀 西濱海口探索達人",
      "🚲 西濱追風見習騎士",
      "🏖️ 西海岸踏浪旅人"
    );
  }
  if (checkExact(eastCoastIds)) {
    return makeTierTitles(
      "東部濱海",
      "👑 東濱王者 · 太平洋黑潮海神",
      "🌊 台11線東海岸制霸宗師",
      "🌅 蘇花東海岸通關大師",
      "🌊 東部濱海專家",
      "🐬 東海岸山海探索達人",
      "🚲 東濱太平洋見習生",
      "🏖️ 東海岸看海旅人"
    );
  }
  if (checkExact(bothCoastIds)) {
    return makeTierTitles(
      "全台濱海",
      "🔱 台灣環島海神 · 雙濱王者",
      "🌊 環島海岸線制霸宗師",
      "⚓ 全台濱海通關大師",
      "🌊 台灣環島濱海專家",
      "🐚 環島海岸線達人"
    );
  }
  if (checkExact(mountainIds)) {
    return makeTierTitles(
      "台灣山區",
      "⛰️ 台灣護國山神",
      "🦅 中央山脈縱走霸主",
      "🌲 百岳山林通關宗師",
      "⛰️ 台灣山區專家",
      "🥾 高山原鄉探索達人",
      "🌿 山林步道見習山友",
      "🏕️ 初入山林登山客"
    );
  }
  if (checkExact(westPlainIds)) {
    return makeTierTitles(
      "西部平原",
      "🌾 西部平原王者 · 沃野之神",
      "🏙️ 西半部平原台地宗師",
      "🌾 西部平原通關大師",
      "🌾 西部平原專家",
      "🚜 西部平原探索達人"
    );
  }
  if (checkExact(eastPlainIds)) {
    return makeTierTitles(
      "東部平原",
      "🌾 蘭陽花東縱谷之神",
      "🏞️ 東部平原縱谷霸主",
      "🌾 東部平原通關大師",
      "🌾 東部平原專家",
      "🚲 蘭陽縱谷探索達人"
    );
  }
  if (checkExact(bothPlainIds)) {
    return makeTierTitles(
      "全台平地",
      "🌾 台灣全境平原大霸主",
      "🏙️ 全台平原盆地宗師",
      "🌾 全台平地通關大師",
      "🌾 台灣平地地理專家",
      "🚜 平原城鄉探索達人"
    );
  }
  if (checkExact(northIds)) {
    return makeTierTitles(
      "北部地區",
      "👑 北台灣總督 · 北部王者",
      "🏙️ 北北基桃竹宜制霸宗師",
      "⬆️ 北部全境通關大師",
      "⬆️ 北部專家",
      "🧭 北台灣生活圈達人"
    );
  }
  if (checkExact(centralIds)) {
    return makeTierTitles(
      "中部地區",
      "👑 中台灣霸主 · 中部王者",
      "⛰️ 苗中彰投雲制霸宗師",
      "⛰️ 中部全境通關大師",
      "⛰️ 中部專家",
      "🧭 中台灣生活圈達人"
    );
  }
  if (checkExact(southIds)) {
    return makeTierTitles(
      "南部地區",
      "👑 南台灣霸主 · 南霸天王者",
      "☀️ 嘉南高屏澎制霸宗師",
      "☀️ 南部全境通關大師",
      "☀️ 南部專家",
      "🧭 南台灣生活圈達人"
    );
  }
  if (checkExact(eastIds)) {
    return makeTierTitles(
      "東部地區",
      "👑 後山山海霸主 · 花東王者",
      "🌊 花東縱谷海岸制霸宗師",
      "🌊 東部全境通關大師",
      "🌊 東部專家",
      "🧭 花東山海探索達人"
    );
  }
  if (checkExact(islandIds)) {
    return makeTierTitles(
      "外島澎金馬",
      "👑 台海跳島霸主 · 離島航海王",
      "🏝️ 澎金馬外島制霸宗師",
      "🏝️ 外島全境通關大師",
      "🏝️ 外島專家",
      "⛴️ 澎金馬跳島達人"
    );
  }
  if (checkExact(sixIds)) {
    return makeTierTitles(
      "六都直轄市",
      "👑 六都聯合總督 · 都會王者",
      "🏙️ 六大直轄市制霸宗師",
      "🏙️ 六都全境通關大師",
      "🏙️ 六都專家",
      "🚇 六都都會生活達人"
    );
  }
  if (checkExact(westIds)) {
    return makeTierTitles(
      "西部16縣市",
      "👑 西台灣大霸主 · 西部王者",
      "🚄 西半部16縣市制霸宗師",
      "🗺️ 西部全境通關大師",
      "🗺️ 西部地理專家",
      "🧭 西台灣走廊達人"
    );
  }

  // Single County Selected (e.g. 台北市長、新北市長、桃園市長、苗栗縣長...)
  const activeCounties = allGroups.filter((c) =>
    allItems.some((t) => t.countyName === c.name && townIds.has(t.id))
  );
  if (activeCounties.length === 1) {
    const c = activeCounties[0];
    const allCountyTowns = allItems.filter((t) => t.countyName === c.name);
    const isFullCounty = allCountyTowns.every((t) => townIds.has(t.id));
    const m = COUNTY_MAYOR_TITLES[c.name] || {
      mayor: `${c.short || c.name}首長`,
      god: `${c.name}制霸王者`,
      expert: `${c.name}地理專家`,
      master: `${c.name}在地達人`
    };
    if (isFullCounty) {
      return makeTierTitles(
        c.name,
        `👑 榮譽${m.mayor} · ${m.god}`,
        `🏛️ 榮譽${m.mayor}`,
        `🎖️ 準${m.mayor} · ${c.short}通關大師`,
        `🗺️ ${m.expert}`,
        `🧭 ${m.master}`,
        `🌱 ${c.short}見習市民`,
        `🚶 ${c.short}觀光旅人`
      );
    }
  }

  // Famous Multi-County Metropolitan / Regional Combos
  const cSet = new Set(activeCounties.map((c) => c.name));
  const hasOnly = (names) => names.length === cSet.size && names.every((n) => cSet.has(n));
  if (hasOnly(["臺北市", "新北市"])) {
    return makeTierTitles("雙北都會", "👑 雙北聯合總督 · 首都圈霸主", "🏙️ 雙北41區制霸宗師", "🏙️ 雙北通關大師", "🏙️ 雙北專家", "🚇 雙北生活圈達人");
  }
  if (hasOnly(["臺北市", "新北市", "基隆市"])) {
    return makeTierTitles("北北基", "👑 北北基首都圈大霸主", "🏙️ 北北基山海制霸宗師", "🏙️ 北北基通關大師", "🏙️ 北北基專家", "🧭 北北基生活圈達人");
  }
  if (hasOnly(["臺北市", "新北市", "基隆市", "桃園市"])) {
    return makeTierTitles("北北基桃", "👑 北北基桃千萬都會總督", "🏙️ 北北基桃制霸宗師", "🏙️ 北北基桃通關大師", "🏙️ 北北基桃專家", "🚇 北北基桃通勤達人");
  }
  if (hasOnly(["新竹市", "新竹縣"]) || hasOnly(["新竹市", "新竹縣", "苗栗縣"])) {
    const lbl = cSet.has("苗栗縣") ? "竹竹苗" : "大新竹";
    return makeTierTitles(lbl, `👑 ${lbl}矽谷山城大霸主`, `🔬 ${lbl}科技走廊宗師`, `🗺️ ${lbl}通關大師`, `🗺️ ${lbl}專家`, `🧭 ${lbl}生活圈達人`);
  }
  if (hasOnly(["臺中市", "彰化縣", "南投縣"])) {
    return makeTierTitles("中彰投", "👑 中彰投山海平原總督", "⛰️ 中彰投制霸宗師", "🗺️ 中彰投通關大師", "🗺️ 中彰投專家", "🧭 中彰投生活圈達人");
  }
  if (hasOnly(["嘉義市", "嘉義縣"])) {
    return makeTierTitles("大嘉義", "👑 大嘉義諸羅山海霸主", "🌲 嘉市嘉縣制霸宗師", "🗺️ 大嘉義通關大師", "🗺️ 嘉義專家", "🧭 諸羅山海達人");
  }
  if (hasOnly(["雲林縣", "嘉義市", "嘉義縣", "臺南市"])) {
    return makeTierTitles("雲嘉南", "👑 雲嘉南平原大霸主", "🌾 嘉南平原制霸宗師", "🌾 雲嘉南通關大師", "🌾 雲嘉南專家", "🧭 雲嘉南生活圈達人");
  }
  if (hasOnly(["高雄市", "屏東縣"])) {
    return makeTierTitles("高屏地區", "👑 高屏南霸天聯合總督", "☀️ 高屏山海制霸宗師", "☀️ 高屏通關大師", "☀️ 高屏專家", "🧭 高屏生活圈達人");
  }
  if (hasOnly(["宜蘭縣", "花蓮縣", "臺東縣"])) {
    return makeTierTitles("宜花東", "👑 宜花東太平洋縱谷總督", "🌊 宜花東山海制霸宗師", "🌊 宜花東通關大師", "🌊 宜花東專家", "🧭 東台灣山海達人");
  }

  // Check if user selected a subset of a terrain (e.g. 東部山區, 北部濱海, etc.)
  const allInMountain = Array.from(townIds).every((id) => {
    const t = allItems.find((x) => x.id === id);
    return t && TAIWAN_MOUNTAIN_SET.has(t.fullCountyTown);
  });
  if (allInMountain) {
    return makeTierTitles("山區部落", "⛰️ 山岳領域護國山神", "🦅 高山縱走制霸宗師", "🌲 山區通關大師", "⛰️ 山區地理專家", "🥾 山林探索達人");
  }
  const allInCoast = Array.from(townIds).every((id) => {
    const t = allItems.find((x) => x.id === id);
    return t && (TAIWAN_WEST_COAST_SET.has(t.fullCountyTown) || TAIWAN_EAST_COAST_SET.has(t.fullCountyTown));
  });
  if (allInCoast) {
    return makeTierTitles("濱海地區", "🌊 海岸線破風王者", "🌊 濱海極速領航宗師", "🌅 濱海通關大師", "🌊 濱海地理專家", "🦀 海岸探索達人");
  }

  const shortNames = activeCounties.slice(0, 3).map((c) => c.short || c.name).join("");
  const label = activeCounties.length > 3 ? `${shortNames}等${activeCounties.length}縣市` : (shortNames || "自選區域");
  return makeTierTitles(
    label,
    `👑 ${label}制霸王者`,
    `⚡ ${label}極速宗師`,
    `🏆 ${label}通關大師`,
    `🗺️ ${label}地理專家`,
    `🧭 ${label}探索達人`
  );
}

function detectStationThemeProfile() {
  if (!_dashFeatures().supportsTransportQuiz) return null;
  if (state.quizTargetMode === "region" || !state.stationQuizEnabled || !(state.quizStationLines instanceof Set) || state.quizStationLines.size === 0) {
    return null;
  }
  const sel = state.quizStationLines;
  const hasExactLines = (arr) => arr.length === sel.size && arr.every((id) => sel.has(id));

  // Single Line Special Titles
  if (sel.size === 1) {
    const lid = Array.from(sel)[0];
    const singleLineMap = {
      tra_coast: makeTierTitles("台鐵海線", "🌊 台鐵海線王者 · 海風木造站宗師", "🚆 海岸線鐵道制霸霸主", "🚆 台鐵海線通關大師", "🚆 台鐵海線專家", "🚆 海線五寶鐵道達人"),
      tra_mountain: makeTierTitles("台鐵山線", "⛰️ 台鐵山線王者 · 舊山線勝興宗師", "🚆 臺中線山岳鐵道霸主", "🚆 台鐵山線通關大師", "🚆 台鐵山線專家", "🚆 山線鐵道探索達人"),
      tra_west_n: makeTierTitles("台鐵縱貫線北段", "👑 縱貫線北段王者 · 北台鐵道霸主", "🚆 縱貫北段極速宗師", "🚆 縱貫線北段通關大師", "🚆 台鐵縱貫北段專家", "🚆 縱貫北段通勤達人"),
      tra_west_s: makeTierTitles("台鐵縱貫線南段", "👑 縱貫線南段王者 · 嘉南鐵道霸主", "🚆 縱貫南段極速宗師", "🚆 縱貫線南段通關大師", "🚆 台鐵縱貫南段專家", "🚆 縱貫南段鐵道達人"),
      tra_pingtung: makeTierTitles("台鐵屏東線", "👑 台鐵屏東線王者 · 南國鐵道霸主", "🚆 屏東線制霸宗師", "🚆 台鐵屏東線通關大師", "🚆 台鐵屏東線專家", "🚆 屏東線鐵道達人"),
      tra_yilan: makeTierTitles("台鐵宜蘭線", "👑 台鐵宜蘭線王者 · 東北角鐵道霸主", "🚆 宜蘭線山海鐵道宗師", "🚆 台鐵宜蘭線通關大師", "🚆 台鐵宜蘭線專家", "🚆 宜蘭線鐵道達人"),
      tra_north_link: makeTierTitles("台鐵北迴線", "👑 北迴線王者 · 清水斷崖鐵道神", "🚆 北迴線山海隧道宗師", "🚆 台鐵北迴線通關大師", "🚆 台鐵北迴線專家", "🚆 北迴線鐵道達人"),
      tra_taitung: makeTierTitles("台鐵花東線", "👑 花東線王者 · 縱谷稻浪鐵道神", "🚆 花東線極速制霸宗師", "🚆 台鐵花東線通關大師", "🚆 台鐵花東線專家", "🚆 花東縱谷鐵道達人"),
      tra_south_link: makeTierTitles("台鐵南迴線", "👑 南迴線王者 · 藍皮解憂鐵道神", "🚆 南迴線穿山越海宗師", "🚆 台鐵南迴線通關大師", "🚆 台鐵南迴線專家", "🚆 南迴山海鐵道達人"),
      tra_pingxi: makeTierTitles("平溪深澳支線", "🏮 平溪線天燈鐵道王者", "🚆 平溪深澳支線宗師", "🚆 平溪支線通關大師", "🚆 平溪支線專家", "🚆 平溪鐵道漫遊達人"),
      tra_neiwan: makeTierTitles("內灣六家支線", "🌸 內灣線客庄鐵道王者", "🚆 內灣六家支線宗師", "🚆 內灣支線通關大師", "🚆 內灣支線專家", "🚆 內灣鐵道漫遊達人"),
      tra_jiji: makeTierTitles("集集支線", "🌲 集集線綠色隧道鐵道王", "🚆 集集支線制霸宗師", "🚆 集集支線通關大師", "🚆 集集支線專家", "🚆 集集鐵道漫遊達人"),
      tra_shalun: makeTierTitles("沙崙支線", "🚄 沙崙支線雙鐵轉乘王者", "🚆 沙崙支線制霸宗師", "🚆 沙崙支線通關大師", "🚆 沙崙支線專家", "🚆 沙崙線達人"),
      tra_chengzhui: makeTierTitles("成追線", "🎫 成追線追分成功金榜王者", "🚆 成追線鐵道宗師", "🚆 成追線通關大師", "🚆 成追線專家", "🚆 追分成功達人"),
      thsr_main: makeTierTitles("台灣高鐵", "🚄 台灣高鐵時速300極速王者", "🚄 高鐵一日生活圈宗師", "🚄 台灣高鐵通關大師", "🚄 台灣高鐵專家", "🚄 高鐵商務旅運達人"),
      mrt_tpe_r: makeTierTitles("北捷淡水信義線", "🚇 淡水信義紅線制霸王者", "🚇 北捷紅線極速宗師", "🚇 淡水信義線通關大師", "🚇 北捷紅線專家", "🚇 紅線通勤達人"),
      mrt_tpe_bl: makeTierTitles("北捷板南線", "🚇 板南藍線黃金動脈王者", "🚇 北捷藍線極速宗師", "🚇 板南線通關大師", "🚇 北捷板南線專家", "🚇 藍線通勤達人"),
      mrt_tpe_g: makeTierTitles("北捷松山新店線", "🚇 松山新店綠線制霸王者", "🚇 北捷綠線極速宗師", "🚇 松山新店線通關大師", "🚇 北捷綠線專家", "🚇 綠線通勤達人"),
      mrt_tpe_o: makeTierTitles("北捷中和新蘆線", "🚇 中和新蘆橘線雙支線王者", "🚇 北捷橘線極速宗師", "🚇 中和新蘆線通關大師", "🚇 北捷橘線專家", "🚇 橘線大橋頭達人"),
      mrt_tpe_br: makeTierTitles("北捷文湖線", "🚇 文湖棕線高架制霸王者", "🚇 北捷文湖線極速宗師", "🚇 文湖線通關大師", "🚇 北捷文湖線專家", "🚇 文湖線通勤達人"),
      mrt_ntpc_y: makeTierTitles("新北環狀線", "🚇 新北環狀線跨區制霸王者", "🚇 環狀黃線極速宗師", "🚇 新北環狀線通關大師", "🚇 新北環狀線專家", "🚇 環狀線轉乘達人"),
      mrt_ntpc_lb: makeTierTitles("新北三鶯線", "🚇 新北三鶯線陶瓷走廊王者", "🚇 三鶯線極速宗師", "🚇 三鶯線通關大師", "🚇 新北三鶯線專家", "🚇 三鶯線達人"),
      mrt_ty_a: makeTierTitles("桃園機場捷運", "✈️ 機場捷運國門飛翔王者", "🚇 桃捷紫線極速宗師", "🚇 機場捷運通關大師", "🚇 桃園機捷專家", "🚇 國門機捷達人"),
      mrt_tc_g: makeTierTitles("台中捷運綠線", "🚇 台中捷運綠線制霸王者", "🚇 中捷烏日文心宗師", "🚇 台中捷運通關大師", "🚇 台中捷運專家", "🚇 中捷綠線達人"),
      mrt_kh_r: makeTierTitles("高雄捷運紅線", "🚇 高捷紅線港都南北王者", "🚇 高捷紅線極速宗師", "🚇 高捷紅線通關大師", "🚇 高捷紅線專家", "🚇 高捷紅線達人"),
      mrt_kh_o: makeTierTitles("高雄捷運橘線", "🚇 高捷橘線美麗島制霸王者", "🚇 高捷橘線極速宗師", "🚇 高捷橘線通關大師", "🚇 高捷橘線專家", "🚇 高捷橘線達人"),
      lrt_danhai: makeTierTitles("淡海輕軌", "🚋 淡海輕軌山海藍綠王者", "🚋 淡海輕軌極速宗師", "🚋 淡海輕軌通關大師", "🚋 淡海輕軌專家", "🚋 淡海追風達人"),
      lrt_ankeng: makeTierTitles("安坑輕軌", "🚋 安坑輕軌安心橋制霸王者", "🚋 安坑輕軌極速宗師", "🚋 安坑輕軌通關大師", "🚋 安坑輕軌專家", "🚋 安坑輕軌達人"),
      lrt_kaohsiung: makeTierTitles("高雄環狀輕軌", "🚋 高雄輕軌龍貓隧道大王者", "🚋 高雄環狀輕軌宗師", "🚋 高雄輕軌通關大師", "🚋 高雄輕軌專家", "🚋 港都輕軌漫遊達人"),
      for_alishan: makeTierTitles("阿里山林鐵", "🌲 阿里山森林鐵路神木霸主", "🚂 獨立山螺旋登山鐵道宗師", "🌲 阿里山林鐵通關大師", "🌲 阿里山林鐵專家", "🌲 阿里山小火車達人")
    };
    if (singleLineMap[lid]) return singleLineMap[lid];
  }

  // Multi-Line Presets & Combinations
  if (hasExactLines(["tra_mountain", "tra_coast"]) || hasExactLines(["tra_mountain", "tra_coast", "tra_chengzhui"])) {
    return makeTierTitles("台鐵山海線", "👑 台鐵山海雙線王者 · 追分成功宗師", "🚆 中部山海鐵道制霸霸主", "🚆 台鐵山海線通關大師", "🚆 台鐵山海線專家", "🚆 山海線鐵道達人");
  }
  if (hasExactLines(["tra_west_n", "tra_mountain", "tra_coast", "tra_chengzhui", "tra_west_s", "tra_pingtung"])) {
    return makeTierTitles("台鐵西部主線", "👑 西部幹線鐵道王者 · 縱貫山海霸主", "🚆 台鐵西部主線極速宗師", "🚆 台鐵西部主線通關大師", "🚆 台鐵西部主線專家", "🚆 西部幹線鐵道達人");
  }
  if (hasExactLines(["tra_yilan", "tra_north_link", "tra_taitung", "tra_south_link"])) {
    return makeTierTitles("台鐵東部主線", "👑 東部幹線鐵道王者 · 山海環線霸主", "🚆 台鐵東部主線極速宗師", "🚆 台鐵東部主線通關大師", "🚆 台鐵東部主線專家", "🚆 東部幹線鐵道達人");
  }
  if (Array.from(sel).every((id) => id.startsWith("tra_"))) {
    if (sel.size >= 10) {
      return makeTierTitles("台鐵全線", "👑 台鐵環島全線大宗師 · 榮譽鐵道局長", "🚆 台鐵環島路網極速霸主", "🚆 台鐵全線通關大師", "🚆 台鐵全線鐵道專家", "🚆 環島鐵道旅行達人");
    }
    if (Array.from(sel).every((id) => ["tra_pingxi", "tra_neiwan", "tra_jiji", "tra_shalun", "tra_chengzhui"].includes(id))) {
      return makeTierTitles("台鐵觀光支線", "👑 台鐵觀光支線大滿貫王者", "🚆 台鐵支線制霸宗師", "🚆 台鐵支線通關大師", "🚆 台鐵支線專家", "🚆 支線鐵道漫遊達人");
    }
    return makeTierTitles("台鐵路網", "👑 台鐵鐵道制霸王者", "🚆 台鐵路網極速宗師", "🚆 台鐵路網通關大師", "🚆 台鐵鐵道專家", "🚆 台鐵鐵道達人");
  }

  if (Array.from(sel).every((id) => id.startsWith("mrt_tpe_") || id === "mrt_ntpc_y" || id === "mrt_ntpc_lb")) {
    return makeTierTitles("雙北捷運", "👑 雙北捷運路網總工程師 · 北捷王者", "🚇 雙北捷運極速制霸宗師", "🚇 台北捷運全網通關大師", "🚇 台北捷運專家", "🚇 北捷轉乘通勤達人");
  }
  if (Array.from(sel).every((id) => id.startsWith("mrt_kh_") || id === "lrt_kaohsiung")) {
    return makeTierTitles("高雄捷運與輕軌", "👑 高雄捷運港都路網霸主", "🚇 高捷紅橘輕軌制霸宗師", "🚇 高雄捷運通關大師", "🚇 高雄捷運專家", "🚇 港都捷運達人");
  }
  if (Array.from(sel).every((id) => id.startsWith("mrt_"))) {
    return makeTierTitles("全台捷運", "👑 全台五大都會捷運總霸主", "🚇 全台捷運路網極速宗師", "🚇 全台捷運通關大師", "🚇 全台捷運專家", "🚇 都會捷運路網達人");
  }
  if (Array.from(sel).every((id) => id.startsWith("lrt_"))) {
    return makeTierTitles("全台輕軌", "👑 全台輕軌系統制霸王者", "🚋 淡海安坑高雄輕軌宗師", "🚋 全台輕軌通關大師", "🚋 台灣輕軌專家", "🚋 輕軌漫遊達人");
  }
  if (Array.from(sel).every((id) => id.startsWith("for_") || id.startsWith("sug_") || id.startsWith("gon_"))) {
    return makeTierTitles("林鐵糖鐵纜車", "👑 台灣林鐵糖鐵五分車文化大宗師", "🌲 觀光鐵道與纜車制霸霸主", "🍬 林鐵糖鐵纜車通關大師", "🌲 台灣觀光鐵道專家", "🚂 懷舊鐵道探索達人");
  }

  return makeTierTitles("台灣軌道全網", "👑 台灣鐵道與捷運全網大宗師", "🚄 全台軌道交通極速霸主", "🚆 台灣軌道全網通關大師", "🚆 台灣軌道交通專家", "🚉 台灣鐵道捷運達人");
}

function formatBreakdownSummary(stats, verbose = false) {
  const unitLabels = _dashUnitLabels();
  const isTw = _dashIsTwModern();
  const adminLabel = isTw ? "行政區" : unitLabels.item;
  const adminShort = isTw ? "區" : unitLabels.itemShort;
  if (!stats) return `0${adminShort}`;
  const parts = [];
  if ((stats.adminTotal || 0) > 0 || (stats.adminCurrent || 0) > 0) {
    parts.push(verbose ? `${adminLabel} ${stats.adminCurrent || 0}/${stats.adminTotal || 0}` : `${stats.adminCurrent || 0}${adminShort}`);
  }
  if ((stats.stationTotal || 0) > 0 || (stats.unlockedStCount || 0) > 0) {
    parts.push(verbose ? `車站 ${stats.unlockedStCount || 0}/${stats.stationTotal || 0}` : `${stats.unlockedStCount || 0}站`);
  }
  const pb = stats.poiBreakdown || {};
  const catMeta = [
    ["airport", "機場", "機場"],
    ["port", "港口", "港"],
    ["reservoir", "水庫", "水庫"],
    ["lake", "湖泊", "湖"],
    ["settlement", "傳統聚落", "聚落"]
  ];
  catMeta.forEach(([key, fullLbl, shortLbl]) => {
    const item = pb[key];
    if (item && (item.total > 0 || item.current > 0)) {
      parts.push(verbose ? `${fullLbl} ${item.current}/${item.total}` : `${item.current}${shortLbl}`);
    }
  });
  if (parts.length === 0) return verbose ? `${adminLabel} 0/0` : `0${adminShort}`;
  return parts.join(verbose ? "  ·  " : " · ");
}

function detectPoiThemeProfile() {
  const feats = _dashFeatures();
  if (!feats.supportsPoiQuiz && !feats.supportsCapitalQuiz && !feats.supportsLandmarkQuiz) return null;
  if (typeof isPoiCategoryActive !== "function") return null;
  const activeCats = ["airport", "port", "reservoir", "lake", "settlement", "capital", "landmark"].filter((c) => isPoiCategoryActive(c));
  if (activeCats.length === 0) return null;

  if (activeCats.length === 1 && activeCats[0] === "landmark") {
    const lmTitle = typeof getPoiCategoryLabel === "function" ? getPoiCategoryLabel("landmark") : "著名地標";
    return makeTierTitles(lmTitle, `🏛️ ${lmTitle}最高大宗師`, `🏛️ ${lmTitle}極速巡禮王`, `🏛️ ${lmTitle}通關大師`, `🏛️ ${lmTitle}地理專家`, `🏛️ ${lmTitle}達人`, "🏛️ 地標見習旅人", "🏛️ 巡禮啟程旅人");
  }

  if (activeCats.length === 1 && activeCats[0] === "capital") {
    const pack = typeof getActiveMapPack === "function" ? getActiveMapPack() : null;
    const pid = pack ? pack.id : "";
    if (pid === "world_countries") {
      return makeTierTitles("世界各國首都", "🏛️ 世界首都最高大宗師", "🏛️ 全球首都極速制霸王", "🏛️ 世界首都通關大師", "🏛️ 世界首都地理專家", "🏛️ 世界首都達人", "🏛️ 首都見習外交官", "🏛️ 世界啟程旅人");
    }
    if (pid === "jp_pref") {
      return makeTierTitles("日本47縣廳所在地", "🏛️ 日本縣廳最高大宗師", "🏛️ 全日本縣治極速制霸王", "🏛️ 日本縣廳通關大師", "🏛️ 日本縣廳地理專家", "🏛️ 日本縣廳達人", "🏛️ 縣廳見習旅人", "🏛️ 日本啟程旅人");
    }
    if (pid === "roc_1949") {
      return makeTierTitles("中華民國1945省會", "🏛️ 民國省會最高大宗師", "🏛️ 秋海棠省會極速制霸王", "🏛️ 民國省會通關大師", "🏛️ 民國歷史省會專家", "🏛️ 民國省會達人", "🏛️ 史地見習學人", "🏛️ 省會啟程旅人");
    }
    return makeTierTitles("中國省會與首府", "🏛️ 中國省會最高大宗師", "🏛️ 神州省會極速制霸王", "🏛️ 中國省會通關大師", "🏛️ 中國省會地理專家", "🏛️ 中國省會達人", "🏛️ 省會見習學人", "🏛️ 神州啟程旅人");
  }

  if (activeCats.length === 1) {
    const cat = activeCats[0];
    if (cat === "airport") {
      const subs = state.airportSubTypes instanceof Set ? state.airportSubTypes : new Set();
      if (subs.size === 1 && subs.has("intl")) {
        return makeTierTitles("台灣國際機場", "✈️ 國門塔台極速王者", "✈️ 國際航站制霸宗師", "✈️ 國際機場通關大師", "✈️ 國際航空專家", "✈️ 國際機場達人", "✈️ 航廈見習航迷", "✈️ 機場啟程旅人");
      }
      if (subs.size === 1 && subs.has("military")) {
        return makeTierTitles("台灣軍用機場", "🎖️ 空軍基地最高指揮官", "🎖️ 戰備跑道制霸宗師", "🎖️ 軍用機場通關大師", "🎖️ 空防基地專家", "🎖️ 軍機場達人", "🎖️ 空防見習飛官", "🎖️ 基地巡禮旅人");
      }
      return makeTierTitles("台灣機場", "✈️ 台灣航空塔台最高王者", "✈️ 全台機場極速制霸宗師", "✈️ 台灣機場通關大師", "✈️ 台灣航空機場專家", "✈️ 台灣機場達人", "✈️ 機場見習航迷", "✈️ 航站啟程旅人");
    }
    if (cat === "port") {
      const subs = state.portSubTypes instanceof Set ? state.portSubTypes : new Set();
      const onlyFishery = subs.size > 0 && Array.from(subs).every((s) => s === "fishery_cat1" || s === "fishery_cat2" || s === "fishery_cat2_other");
      const onlyCommercial = subs.size > 0 && Array.from(subs).every((s) => s === "intl_commercial" || s === "intl_aux");
      if (onlyFishery) {
        return makeTierTitles("台灣漁港", "🐟 台灣漁港討海大霸主", "🐟 全台漁港制霸宗師", "🐟 台灣漁港通關大師", "🐟 台灣漁港專家", "🐟 台灣漁港達人", "🐟 漁港見習釣客", "🐟 漁村尋訪旅人");
      }
      if (onlyCommercial) {
        return makeTierTitles("台灣商港", "🚢 台灣港務總司令 · 商港霸主", "🚢 國際商港制霸宗師", "🚢 台灣商港通關大師", "🚢 台灣航運商港專家", "🚢 台灣商港達人", "🚢 港務見習水手", "🚢 港灣啟程旅人");
      }
      return makeTierTitles("台灣港口", "⚓ 台灣港灣總司令 · 航海王者", "⚓ 全台港口極速制霸宗師", "⚓ 台灣港口通關大師", "⚓ 台灣港口航運專家", "⚓ 台灣港口達人", "⚓ 港口見習航海士", "⚓ 港灣啟程旅人");
    }
    if (cat === "reservoir") {
      return makeTierTitles("台灣水庫", "💧 台灣水利最高總工程師", "💧 全台水庫極速制霸宗師", "💧 台灣水庫通關大師", "💧 台灣水利水庫專家", "💧 台灣水庫達人", "💧 水庫見習巡檢員", "💧 水源探索旅人");
    }
    if (cat === "lake") {
      const subs = state.lakeSubTypes instanceof Set ? state.lakeSubTypes : new Set();
      if (subs.size === 1 && subs.has("lake_alpine")) {
        return makeTierTitles("台灣高山秘境湖泊", "⛰️ 台灣百岳秘境湖神", "⛰️ 高山秘境湖泊宗師", "⛰️ 高山湖泊通關大師", "⛰️ 高山秘境湖泊專家", "⛰️ 高山湖泊達人", "⛰️ 秘境見習山友", "⛰️ 山湖尋幽旅人");
      }
      return makeTierTitles("台灣湖泊", "🏞️ 台灣山海湖光制霸神", "🏞️ 全台湖泊極速制霸宗師", "🏞️ 台灣湖泊通關大師", "🏞️ 台灣湖泊地理專家", "🏞️ 台灣湖泊達人", "🏞️ 湖畔見習旅人", "🏞️ 尋湖啟程旅人");
    }
    if (cat === "settlement") {
      const subs = state.settlementSubTypes instanceof Set ? state.settlementSubTypes : new Set();
      if (subs.size === 1 && subs.has("historic_oaza")) {
        return makeTierTitles("台灣歷史大字與傳統部落", "🏘️ 台灣古地名與部落宗師", "🏘️ 歷史大字極速制霸神", "🏘️ 台灣歷史聚落通關大師", "🏘️ 台灣古地名專家", "🏘️ 在地文史達人", "🏘️ 聚落見習旅人", "🏘️ 古道啟程旅人");
      }
      return makeTierTitles("台灣幹線路牌聚落", "🪧 台灣幹線路牌最高神人", "🪧 台灣路牌通 · 聚落制霸宗師", "🪧 台灣路牌聚落通關大師", "🪧 台灣幹線路牌專家", "🪧 台灣路牌通", "🪧 公路見習旅人", "🪧 聚落啟程旅人");
    }
  }

  const catSet = new Set(activeCats);
  if (activeCats.length === 2 && catSet.has("airport") && catSet.has("port")) {
    return makeTierTitles("台灣海空門戶", "✈️ 台灣海空雙門戶大霸主", "⚓ 海空樞紐極速制霸宗師", "✈️ 海空門戶通關大師", "⚓ 台灣海空交通專家", "✈️ 海空門戶達人");
  }
  if (activeCats.length === 2 && catSet.has("reservoir") && catSet.has("lake")) {
    return makeTierTitles("台灣水庫與湖泊", "💧 台灣山川湖庫水神", "🏞️ 全台湖庫極速制霸宗師", "💧 水庫湖泊通關大師", "🏞️ 台灣湖庫地理專家", "💧 台灣湖庫水景達人");
  }
  const names = { airport: "機場", port: "港口", reservoir: "水庫", lake: "湖泊", settlement: "傳統聚落" };
  const label = activeCats.map((c) => names[c]).join("・");
  return makeTierTitles(label, "🏆 台灣海陸空地標大宗師", "🧭 全台地標極速制霸霸主", `🏆 ${label}通關大師`, `🧭 ${label}地理專家`, `🧭 ${label}探索達人`);
}

function getGradeFromStats(stats) {
  const grandScore = Number(stats.grandScore || 0);
  const grandTotal = Math.max(1, Number(stats.grandTotal || 1));
  const pct = (grandScore / grandTotal) * 100;
  const elapsedSec = Math.max(1, Number(stats.elapsedSec || state.elapsedSec || 1));
  const qPerSec = grandScore / elapsedSec;
  const secPerQ = grandScore > 0 ? elapsedSec / grandScore : 999;

  const isCountdown = (stats.timerMode || state.timerMode) === "down";
  const countdownLimitSec = Number(stats.countdownTotalSec || state.countdownTotalSec || 300);
  const diff = stats.difficulty || state.difficulty || "casual";
  const diffMult =
    diff === "master_hierarchy"
      ? 1.65
      : diff === "hard_full"
      ? 1.45
      : diff === "hard_suffix"
      ? 1.2
      : 1.0;

  const completedBlocks = Number(
    stats.completedBlocks ??
      computeClearedBlocksStats().completedBlocks ??
      0
  );
  const clearedText = stats.clearedSummaryText || computeClearedBlocksStats().clearedSummaryText;

  // 1. Determine Grade Tier (SSS / SS / S+ / S / A / B / C)
  //    - Scales dynamically by question speed (qPerSec / secPerQ) & cleared blocks (completedBlocks)
  //    - In Countdown Mode, never penalizes the player when grandTotal is too large to finish in time!
  let grade = "C";
  if (grandScore <= 0) {
    grade = "C";
  } else if (pct >= 100) {
    // 100% Full Clear: Judge SSS / SS / S+ by average seconds per question (scaled by difficulty)
    if (secPerQ <= 2.4 * diffMult || (grandTotal <= 20 && elapsedSec <= 45 * diffMult)) {
      grade = "SSS";
    } else if (secPerQ <= 4.2 * diffMult || (grandTotal <= 20 && elapsedSec <= 80 * diffMult)) {
      grade = "SS";
    } else {
      grade = "S+";
    }
  } else if (isCountdown) {
    // Countdown Mode (< 100% total pool):
    // Evaluate by answering pace (questions per second) + expected capacity in countdown window + cleared blocks bonus!
    const benchmarkSecPerQ = 3.0 * diffMult;
    const expectedTargetCount = Math.min(grandTotal, Math.max(10, Math.round(countdownLimitSec / benchmarkSecPerQ)));
    const paceRatio = grandScore / expectedTargetCount;
    const adjQPerSec = qPerSec * diffMult;
    const speedRatio = adjQPerSec / 0.33; // 0.33 q/s (3.0s/q) = 1.0 baseline S/SS pace
    const blockBonus = completedBlocks * 0.035;
    const countdownScore = Math.max(paceRatio, speedRatio * 0.85 + paceRatio * 0.15) + blockBonus;

    if (countdownScore >= 1.15 || (grandScore >= 25 && adjQPerSec >= 0.42)) {
      grade = "SSS";
    } else if (countdownScore >= 0.95 || (grandScore >= 20 && adjQPerSec >= 0.33)) {
      grade = "SS";
    } else if (countdownScore >= 0.80 || (grandScore >= 16 && adjQPerSec >= 0.26)) {
      grade = "S+";
    } else if (countdownScore >= 0.65 || pct >= 88) {
      grade = "S";
    } else if (countdownScore >= 0.45 || pct >= 70) {
      grade = "A";
    } else if (countdownScore >= 0.24 || pct >= 45) {
      grade = "B";
    } else {
      grade = "C";
    }
  } else {
    // Count-Up Mode (< 100%, early give-up):
    // Combine completion percentage with high-volume speed & cleared block bonus
    const adjQPerSec = qPerSec * diffMult;
    const speedBonus = grandScore >= 60 && adjQPerSec >= 0.30 ? 12 : grandScore >= 35 && adjQPerSec >= 0.25 ? 6 : 0;
    const effectivePct = Math.min(99, pct + completedBlocks * 1.8 + speedBonus);
    if (effectivePct >= 90) grade = "S";
    else if (effectivePct >= 75) grade = "A";
    else if (effectivePct >= 50) grade = "B";
    else grade = "C";
  }

  // 2. Determine Scope-Specific Title & Slogan
  const regTheme = detectRegionThemeProfile();
  const stTheme = detectStationThemeProfile();
  const poiTheme = detectPoiThemeProfile();
  const activeThemes = [regTheme, stTheme, poiTheme].filter(Boolean);
  const stripEmoji = (s) => String(s || "").replace(/^[👑🌊⛰️🌾🏙️⬆️☀️🏝️🔱🚄🚆🚇🚋🌲🏮🌸✈️🎫🏆⚡🧭🌱🚶🎖️⚓🚢🐟💧🏞️]+\s*/, "");

  let title = "";
  const isTw = _dashIsTwModern();
  const pack = _dashPack();
  let scopeLabel = isTw ? "台灣地理" : ((pack && (pack.displayName || pack.shortLabel)) || "地理挑戰");
  if (activeThemes.length === 1) {
    title = activeThemes[0].titles[grade] || activeThemes[0].titles.S;
    scopeLabel = activeThemes[0].scopeLabel;
  } else if (activeThemes.length === 2) {
    const t1Short = stripEmoji(activeThemes[0].titles[grade] || activeThemes[0].scopeLabel).split(" · ")[0];
    const t2Short = stripEmoji(activeThemes[1].titles[grade] || activeThemes[1].scopeLabel).split(" · ")[0];
    const filterTag = regTheme && state.filterStationsByRegion ? " (區域內)" : "";
    title = `${t1Short} × ${t2Short}`;
    scopeLabel = `${activeThemes[0].scopeLabel}＋${activeThemes[1].scopeLabel}${filterTag}`;
  } else if (activeThemes.length >= 3) {
    const multiAll = makeTierTitles(
      activeThemes.map((t) => t.scopeLabel).join("＋"),
      "👑 台灣海陸空全領域制霸神",
      "⚡ 台灣全領域極速大宗師",
      "🏆 海陸空全能通關大師",
      "🧭 台灣全領域地理專家",
      "🧭 海陸空全能探索達人"
    );
    title = multiAll.titles[grade] || multiAll.titles.S;
    scopeLabel = multiAll.scopeLabel + (regTheme && state.filterStationsByRegion ? " (區域內)" : "");
  } else {
    title = isTw ? "台灣地理探索旅人" : `${scopeLabel}探索旅人`;
  }

  const qPerSecStr = qPerSec.toFixed(2);
  const secPerQStr = grandScore > 0 ? secPerQ.toFixed(1) : "0.0";
  const isLimitedRound = Boolean(stats.isLimitedRound);
  const displayScopeLabel = isLimitedRound ? `${scopeLabel} · 限 ${grandTotal} 題` : scopeLabel;
  let desc = "";
  if (pct >= 100) {
    desc = isLimitedRound
      ? `100% 滿分通關【${displayScopeLabel}】！平均 ${secPerQStr} 秒/題 (${qPerSecStr} 題/秒)`
      : `100% 完美制霸【${scopeLabel}】！平均 ${secPerQStr} 秒/題 (${qPerSecStr} 題/秒) · ${clearedText}`;
  } else if (isCountdown) {
    const mins = Math.round(countdownLimitSec / 60);
    desc = `限時 ${mins} 分鐘極限衝刺【${displayScopeLabel}】！速率 ${qPerSecStr} 題/秒 (${secPerQStr} 秒/題) · ${clearedText}`;
  } else {
    desc = `挑戰【${displayScopeLabel}】完成 ${grandScore}/${grandTotal} 題 (${pct.toFixed(1)}%) · 速率 ${qPerSecStr} 題/秒 · ${clearedText}`;
  }

  const victoryHeadline = pct >= 100
    ? (isLimitedRound ? `🎉 滿分通關！【${displayScopeLabel}】` : `🎉 恭喜通關！【${scopeLabel}】完全制霸`)
    : isCountdown
    ? `⏱️ 限時挑戰完成！【${displayScopeLabel}】結算`
    : `🏁 挑戰結算完成！【${displayScopeLabel}】`;

  return { grade, title, desc, scopeLabel, victoryHeadline, qPerSecStr, secPerQStr, clearedText };
}

function getBattleOutcome(myStats, oppStats) {
  if (!oppStats) return { outcome: "solo", isWin: false, isDraw: false, isLoss: false };

  const myScore = Number(myStats?.grandScore ?? myStats?.score ?? 0);
  const myTotal = Number(myStats?.grandTotal ?? myStats?.total ?? 0);
  const myPct = myTotal > 0 ? (myScore / myTotal) * 100 : 0;
  const myTime = typeof myStats?.elapsedSec === "number" && !isNaN(myStats.elapsedSec) ? myStats.elapsedSec : 999999;

  const oppScore = Number(oppStats?.grandScore ?? oppStats?.score ?? 0);
  const oppTotal = Number(oppStats?.grandTotal ?? oppStats?.total ?? myTotal);
  const oppPct = oppTotal > 0 ? (oppScore / oppTotal) * 100 : 0;
  const oppTime = typeof oppStats?.elapsedSec === "number" && !isNaN(oppStats.elapsedSec) ? oppStats.elapsedSec : 999999;

  // 1. 雙方皆 0 題（或 0%）：一律為平手
  if (myScore === 0 && oppScore === 0) {
    return {
      outcome: "draw",
      isDraw: true,
      isWin: false,
      isLoss: false,
      reason: "zero_scores",
      myScore, oppScore, myTotal, oppTotal, myPct, oppPct, myTime, oppTime
    };
  }

  // 2. 完成度或題數不同：分數高者勝
  if (Math.abs(myPct - oppPct) > 0.0001) {
    if (myPct > oppPct) {
      return {
        outcome: "win",
        isWin: true,
        isDraw: false,
        isLoss: false,
        reason: "score",
        diffScore: myScore - oppScore,
        myScore, oppScore, myTotal, oppTotal, myPct, oppPct, myTime, oppTime
      };
    } else {
      return {
        outcome: "loss",
        isLoss: true,
        isWin: false,
        isDraw: false,
        reason: "score",
        diffScore: oppScore - myScore,
        myScore, oppScore, myTotal, oppTotal, myPct, oppPct, myTime, oppTime
      };
    }
  }

  // 3. 同分且都大於 0：才以耗時決勝 (耗時少者勝)
  if (myScore > 0 && oppScore > 0) {
    if (myTime < oppTime) {
      return {
        outcome: "win",
        isWin: true,
        isDraw: false,
        isLoss: false,
        reason: "time",
        diffTime: oppTime - myTime,
        myScore, oppScore, myTotal, oppTotal, myPct, oppPct, myTime, oppTime
      };
    } else if (myTime > oppTime) {
      return {
        outcome: "loss",
        isLoss: true,
        isWin: false,
        isDraw: false,
        reason: "time",
        diffTime: myTime - oppTime,
        myScore, oppScore, myTotal, oppTotal, myPct, oppPct, myTime, oppTime
      };
    }
  }

  // 耗時也完全相同或無法分出：平手
  return {
    outcome: "draw",
    isDraw: true,
    isWin: false,
    isLoss: false,
    reason: "tie_time",
    myScore, oppScore, myTotal, oppTotal, myPct, oppPct, myTime, oppTime
  };
}

function sortBattlePlayers(players) {
  return [...players].sort((a, b) => {
    const aCur = (a.grandScore ?? ((a.score || 0) + (a.stationScore || 0))) || 0;
    const aTot = (a.grandTotal ?? ((a.total || 0) + (a.stationTotal || 0))) || 0;
    const bCur = (b.grandScore ?? ((b.score || 0) + (b.stationScore || 0))) || 0;
    const bTot = (b.grandTotal ?? ((b.total || 0) + (b.stationTotal || 0))) || 0;
    const aPct = aTot > 0 ? aCur / aTot : 0;
    const bPct = bTot > 0 ? bCur / bTot : 0;

    if (Math.abs(aPct - bPct) > 0.0001) {
      return bPct - aPct;
    }
    if (bCur !== aCur) {
      return bCur - aCur;
    }

    if (aCur > 0 && bCur > 0) {
      const aTime = typeof a.finalStats?.elapsedSec === "number" && !isNaN(a.finalStats.elapsedSec)
        ? a.finalStats.elapsedSec
        : (typeof a.elapsedSec === "number" && !isNaN(a.elapsedSec) ? a.elapsedSec : 999999);
      const bTime = typeof b.finalStats?.elapsedSec === "number" && !isNaN(b.finalStats.elapsedSec)
        ? b.finalStats.elapsedSec
        : (typeof b.elapsedSec === "number" && !isNaN(b.elapsedSec) ? b.elapsedSec : 999999);
      if (aTime !== bTime) {
        return aTime - bTime;
      }
    }

    return (a.name || "").localeCompare(b.name || "");
  });
}

function showSettlementModal() {
  const stats = state.finalStats;
  if (!stats) return;

  const modal = document.getElementById("modal-settlement");
  if (!modal) return;

  const activeBattlePlayers = typeof getActiveBattlePlayers === "function" ? getActiveBattlePlayers() : [];
  const isMultiplayer = Boolean(activeBattlePlayers.length >= 2 || state.aiRivalActive || state.aiRivalTimer);
  const isInRoomSession = Boolean(state.roomCode || isMultiplayer);
  const oppStats = state.opponent.finalStats;

  const typeBadge = document.getElementById("settlement-type-badge");
  const modeBadge = document.getElementById("settlement-mode-badge");
  const titleEl = document.getElementById("settlement-title");
  const iconBox = document.getElementById("settlement-icon-box");
  const gradeBox = document.getElementById("settlement-grade-box");
  const vsBanner = document.getElementById("settlement-vs-banner");
  const oppOngoingBanner = document.getElementById("settlement-opp-ongoing-banner");
  const rematchBtnText = document.getElementById("rematch-btn-text");
  const returnLobbyBtn = document.getElementById("btn-return-lobby-settlement");

  if (returnLobbyBtn) {
    returnLobbyBtn.classList.toggle("hidden", !isInRoomSession);
  }

  const allGroups = _dashGroups();
  const allItems = _dashItems();
  const pack = _dashPack();
  const unitLabels = _dashUnitLabels();
  const features = _dashFeatures();
  const isTw = _dashIsTwModern();
  const singleLayer = _dashIsSingleLayer();
  const defaultScopeName = isTw ? "台灣地理" : ((pack && (pack.displayName || pack.shortLabel)) || "地理挑戰");

  const diffNames = {
    casual: "休閒提示",
    county_only: isTw ? "縣市挑戰" : `${unitLabels.group}挑戰`,
    hard_suffix: "進階後綴",
    hard_full: "困難全名",
    master_hierarchy: "三階宗師"
  };
  const diffLabel = diffNames[state.difficulty] || state.difficulty;
  const scopeTownCount = getScopeTowns().length;
  const activeSt = features.supportsTransportQuiz && typeof getActiveQuizStations === "function" ? getActiveQuizStations() : [];
  const scopeParts = [];
  if (state.regionQuizEnabled && scopeTownCount > 0) {
    if (isTw) {
      scopeParts.push(
        state.selectedCounties.size === allGroups.length && scopeTownCount === allItems.length
          ? `全台 ${allItems.length} 區`
          : `${state.selectedCounties.size} 縣市 (${scopeTownCount}區)`
      );
    } else {
      const fullLbl = unitLabels.fullScopeLabel || `${(pack && pack.shortLabel) || "全境"} (${allItems.length}${unitLabels.itemShort})`;
      scopeParts.push(
        scopeTownCount === allItems.length && allItems.length > 0
          ? fullLbl
          : singleLayer
          ? `${scopeTownCount} ${unitLabels.itemShort}`
          : `${state.selectedCounties.size} ${unitLabels.group} (${scopeTownCount}${unitLabels.itemShort})`
      );
    }
  }
  if (activeSt.length > 0) scopeParts.push(`${activeSt.length}站`);
  if ((features.supportsPoiQuiz || features.supportsCapitalQuiz || features.supportsLandmarkQuiz) && typeof isPoiCategoryActive === "function" && typeof getActiveQuizPois === "function") {
    const capShortLbl = typeof getPoiCategoryLabel === "function" ? getPoiCategoryLabel("capital") : "首都";
    const lmShortLbl = typeof getPoiCategoryLabel === "function" ? getPoiCategoryLabel("landmark") : "地標";
    [["airport", "機場"], ["port", "港"], ["reservoir", "水庫"], ["lake", "湖"], ["settlement", "聚落"], ["capital", capShortLbl], ["landmark", lmShortLbl]].forEach(([cat, lbl]) => {
      if (isPoiCategoryActive(cat)) {
        const cnt = getActiveQuizPois(cat).length;
        if (cnt > 0) scopeParts.push(`${cnt}${lbl}`);
      }
    });
  }
  const scopeSummary = scopeParts.length > 0 ? scopeParts.join(" + ") : defaultScopeName;

  if (modeBadge) {
    modeBadge.textContent = stats.isLimitedRound
      ? `${diffLabel} · ${scopeSummary} · 限 ${stats.grandTotal} 題`
      : `${diffLabel} · ${scopeSummary}`;
  }
  if (rematchBtnText) rematchBtnText.textContent = isMultiplayer ? "發起重開對戰" : "再玩一局";

  const pctNum = stats.grandTotal > 0 ? ((stats.grandScore / stats.grandTotal) * 100) : 0;
  const pctStr = pctNum.toFixed(1) + "%";

  if (!isMultiplayer) {
    if (typeBadge) {
      const specCount = typeof getSpectators === "function" ? getSpectators().length : 0;
      typeBadge.textContent = state.roomCode && specCount > 0 ? `🎬 單人展演成績單 (${specCount}人觀戰)` : "單人挑戰成績單";
      typeBadge.className = "text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30";
    }
    if (gradeBox) gradeBox.classList.remove("hidden");
    if (vsBanner) vsBanner.classList.add("hidden");
    if (oppOngoingBanner) oppOngoingBanner.classList.add("hidden");

    const gradeInfo = getGradeFromStats(stats);
    document.getElementById("settlement-grade").textContent = gradeInfo.grade;
    document.getElementById("settlement-grade-title").textContent = gradeInfo.title;
    const gradeDescEl = document.getElementById("settlement-grade-desc");
    if (gradeDescEl) gradeDescEl.textContent = gradeInfo.desc;

    if (titleEl) {
      titleEl.textContent = gradeInfo.victoryHeadline || (pctNum >= 100 ? (isTw ? "🎉 恭喜通關！台灣全島制霸" : `🎉 恭喜通關！${defaultScopeName}制霸`) : "挑戰結算完成！");
    }
    if (iconBox) iconBox.textContent = pctNum >= 100 ? "👑" : "🏆";
  } else {
    if (typeBadge) {
      typeBadge.textContent = "⚔️ MULTIPLAYER 即時連線對戰";
      typeBadge.className = "text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30";
    }
    if (gradeBox) gradeBox.classList.add("hidden");

    const activeList = typeof getActiveBattlePlayers === "function" ? getActiveBattlePlayers() : [];
    const isThreePlus = activeList.length >= 3;
    const vsColsEl = document.getElementById("settlement-vs-cols");
    const multiBoard = document.getElementById("settlement-multiplayer-board");
    const rankListEl = document.getElementById("settlement-rank-list");
    const vsResultEl = document.getElementById("settlement-vs-result");
    const vsReasonEl = document.getElementById("settlement-vs-reason");
    const myCol = document.getElementById("settlement-my-col");
    const oppCol = document.getElementById("settlement-opp-col");
    const myCrown = document.getElementById("vs-my-crown");
    const oppCrown = document.getElementById("vs-opp-crown");

    if (isThreePlus) {
      // 3人以上只顯示完整排行，隱藏2欄雙卡
      if (vsColsEl) vsColsEl.classList.add("hidden");
      if (multiBoard) multiBoard.classList.remove("hidden");
      if (vsBanner) vsBanner.classList.remove("hidden");

      const ranked = sortBattlePlayers(activeList);
      const myRank = Math.max(1, ranked.findIndex((p) => p.id === state.localInstanceId) + 1);
      const winner = ranked[0] || { name: "對手", score: 0, stationScore: 0, total: stats.grandTotal, stationTotal: 0 };
      const winnerCur = (winner.score || 0) + (winner.stationScore || 0);
      const winnerTot = (winner.total || 0) + (winner.stationTotal || 0) || stats.grandTotal;
      const winnerPct = winnerTot > 0 ? ((winnerCur / winnerTot) * 100).toFixed(1) + "%" : "0.0%";

      if (myRank === 1) {
        if (titleEl) titleEl.textContent = "👑 榮登第 1 名 · 勇奪冠軍！";
        if (iconBox) iconBox.textContent = "👑";
        if (vsResultEl) {
          vsResultEl.textContent = "👑 榮獲第 1 名 · 勇奪冠軍！";
          vsResultEl.className = "text-2xl sm:text-3xl font-black text-amber-400 tracking-tight";
        }
        if (vsReasonEl) {
          vsReasonEl.textContent = `在 ${activeList.length} 人對決中拔得頭籌！完成度 ${pctStr} (${stats.grandScore}/${stats.grandTotal} 題)，奪下全場第一！`;
        }
      } else {
        const medal = myRank === 2 ? "🥈" : myRank === 3 ? "🥉" : "🎖️";
        if (titleEl) titleEl.textContent = `挑戰完成！獲得第 ${myRank} 名`;
        if (iconBox) iconBox.textContent = medal;
        if (vsResultEl) {
          vsResultEl.textContent = `${medal} 第 ${myRank} 名 / 共 ${activeList.length} 人`;
          vsResultEl.className = "text-2xl sm:text-3xl font-black text-sky-400 tracking-tight";
        }
        if (vsReasonEl) {
          vsReasonEl.textContent = `本局冠軍為【${winner.name}】(${winnerCur}/${winnerTot} 題，${winnerPct})；我方完成度 ${pctStr} (${stats.grandScore}/${stats.grandTotal} 題)！`;
        }
      }

      // 檢查是否尚有選手作答中
      const unfinished = activeList.filter((p) => !p.finished && p.id !== state.localInstanceId);
      if (unfinished.length > 0) {
        if (oppOngoingBanner) oppOngoingBanner.classList.remove("hidden");
        const liveText = document.getElementById("settlement-opp-live-text");
        if (liveText) liveText.textContent = `尚有 ${unfinished.length} 位選手作答中，全體完賽後將自動更新最終排行榜！`;
      } else {
        if (oppOngoingBanner) oppOngoingBanner.classList.add("hidden");
      }

      if (rankListEl) {
        const medals = ["🥇", "🥈", "🥉"];
        rankListEl.replaceChildren();
        const tplRow = document.getElementById("tpl-settlement-rank-row");
        ranked.forEach((p, idx) => {
          const tot = (p.total || 0) + (p.stationTotal || 0);
          const cur = (p.score || 0) + (p.stationScore || 0);
          const pPct = tot > 0 ? ((cur / tot) * 100).toFixed(1) : "0.0";
          const tStr = p.finalStats && typeof p.finalStats.elapsedSec === "number"
            ? formatTime(p.finalStats.elapsedSec)
            : (typeof p.elapsedSec === "number" ? formatTime(p.elapsedSec) : "作答中");
          const stTag = p.finished ? (p.finishReason === "victory" ? "👑 通關" : "🏁 已結束") : "⏳ 作答中";
          if (tplRow && tplRow.content) {
            const row = tplRow.content.firstElementChild.cloneNode(true);
            if (p.id === state.localInstanceId) {
              row.className = "flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-950/70 border border-sky-500/60 text-xs";
            }
            const nameEl = row.querySelector(".rank-name");
            const metaEl = row.querySelector(".rank-meta");
            if (nameEl) nameEl.textContent = `${medals[idx] || `#${idx + 1}`} ${p.name}${p.id === state.localInstanceId ? " (你)" : ""}`;
            if (metaEl) metaEl.textContent = `${cur}/${tot} (${pPct}%) · 耗時 ${tStr} · ${stTag}`;
            rankListEl.appendChild(row);
          }
        });
      }
    } else if (oppStats) {
      // 2 人時只保留 2 欄雙卡對比
      if (vsColsEl) vsColsEl.classList.remove("hidden");
      if (multiBoard) multiBoard.classList.add("hidden");
      if (oppOngoingBanner) oppOngoingBanner.classList.add("hidden");
      if (vsBanner) vsBanner.classList.remove("hidden");

      const oppGrandScore = oppStats.grandScore || oppStats.score || 0;
      const oppGrandTotal = oppStats.grandTotal || oppStats.total || stats.grandTotal;
      const oppPctNum = oppGrandTotal > 0 ? (oppGrandScore / oppGrandTotal) * 100 : 0;
      const oppPctStr = oppPctNum.toFixed(1) + "%";

      const outcome = getBattleOutcome(stats, oppStats);

      if (outcome.isDraw) {
        if (titleEl) titleEl.textContent = "勢均力敵！雙方平手";
        if (vsResultEl) {
          vsResultEl.textContent = "⚖️ 勢均力敵 · 平手！";
          vsResultEl.className = "text-2xl sm:text-3xl font-black text-sky-400 tracking-tight";
        }
        if (vsReasonEl) {
          vsReasonEl.textContent = outcome.reason === "zero_scores"
            ? "雙方皆為 0 題，勢均力敵平手！"
            : `雙方完成度皆為 ${pctStr}，耗時速度不分軒輊！`;
        }
        if (myCrown) myCrown.textContent = "⚖️ TIE";
        if (oppCrown) oppCrown.textContent = "⚖️ TIE";
        if (iconBox) iconBox.textContent = "⚖️";
        if (myCol) myCol.className = "p-2.5 sm:p-3 rounded-xl bg-slate-900/90 border border-slate-700/80 space-y-1";
        if (oppCol) oppCol.className = "p-2.5 sm:p-3 rounded-xl bg-slate-900/90 border border-slate-700/80 space-y-1";
      } else if (outcome.isWin) {
        if (titleEl) titleEl.textContent = "👑 恭喜獲得勝利！";
        if (vsResultEl) {
          vsResultEl.textContent = "👑 獲得勝利！VICTORY";
          vsResultEl.className = "text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight";
        }
        if (vsReasonEl) {
          vsReasonEl.textContent = outcome.reason === "score"
            ? `我方完成度 ${pctStr}，以 ${outcome.diffScore} 題領先優勢擊敗對手【${oppStats.name || "對手"}】！`
            : `雙方完成度相同 (${pctStr})，我方以更快的耗時 (${formatTime(stats.elapsedSec)}) 險勝！`;
        }
        if (myCrown) myCrown.textContent = "👑 WIN";
        if (oppCrown) oppCrown.textContent = "💔 LOSS";
        if (myCol) myCol.className = "p-2.5 sm:p-3 rounded-xl bg-slate-900/90 border-2 border-emerald-500/80 shadow-lg shadow-emerald-500/20 space-y-1";
        if (oppCol) oppCol.className = "p-2.5 sm:p-3 rounded-xl bg-slate-900/90 border border-slate-700/80 space-y-1 opacity-80";
        if (iconBox) iconBox.textContent = "👑";
      } else {
        if (titleEl) titleEl.textContent = "💔 惜敗！再接再厲";
        if (vsResultEl) {
          vsResultEl.textContent = "💔 遺憾惜敗 · DEFEAT";
          vsResultEl.className = "text-2xl sm:text-3xl font-black text-rose-400 tracking-tight";
        }
        if (vsReasonEl) {
          vsReasonEl.textContent = outcome.reason === "score"
            ? `對手【${oppStats.name || "對手"}】以 ${outcome.diffScore} 題領先優勢獲勝，下次討回來！`
            : `雙方完成度相同 (${pctStr})，對手以更快的耗時速度獲勝！`;
        }
        if (myCrown) myCrown.textContent = "💔 LOSS";
        if (oppCrown) oppCrown.textContent = "👑 WIN";
        if (myCol) myCol.className = "p-2.5 sm:p-3 rounded-xl bg-slate-900/90 border border-slate-700/80 space-y-1 opacity-80";
        if (oppCol) oppCol.className = "p-2.5 sm:p-3 rounded-xl bg-slate-900/90 border-2 border-indigo-500/80 shadow-lg shadow-indigo-500/20 space-y-1";
        if (iconBox) iconBox.textContent = "⚔️";
      }

      document.getElementById("vs-my-name").textContent = stats.name;
      document.getElementById("vs-my-score").textContent = `${stats.grandScore} / ${stats.grandTotal} (${pctStr})`;
      document.getElementById("vs-my-time").textContent = formatTime(stats.elapsedSec);
      document.getElementById("vs-my-acc").textContent = `${stats.accuracy}%`;

      document.getElementById("vs-opp-name").textContent = oppStats.name || state.opponent.name;
      document.getElementById("vs-opp-score").textContent = `${oppGrandScore} / ${oppGrandTotal} (${oppPctStr})`;
      document.getElementById("vs-opp-time").textContent = formatTime(oppStats.elapsedSec || 0);
      document.getElementById("vs-opp-acc").textContent = `${oppStats.accuracy || 90}%`;
    } else {
      if (vsColsEl) vsColsEl.classList.remove("hidden");
      if (multiBoard) multiBoard.classList.add("hidden");
      if (vsBanner) vsBanner.classList.add("hidden");
      if (oppOngoingBanner) {
        oppOngoingBanner.classList.remove("hidden");
        const liveText = document.getElementById("settlement-opp-live-text");
        if (liveText) {
          const oppCur = state.opponent.score + (state.opponent.stationScore || 0);
          const oppTot = state.opponent.total + (state.opponent.stationTotal || 0);
          liveText.textContent = `對手【${state.opponent.name}】作答中 (目前 ${oppCur}/${oppTot})，對手結束後將自動更新勝負結算！`;
        }
      }
      if (titleEl) titleEl.textContent = "我方已完成！等待對手作答";
      if (iconBox) iconBox.textContent = "⏳";
    }
  }

  document.getElementById("settlement-pct").textContent = pctStr;
  document.getElementById("settlement-grand-score").textContent = `${stats.grandScore} / ${stats.grandTotal} 題`;
  document.getElementById("settlement-time").textContent = formatTime(stats.elapsedSec);
  const avgSec = stats.grandScore > 0 ? (stats.elapsedSec / stats.grandScore).toFixed(1) : "0.0";
  const qPerSecVal = stats.elapsedSec > 0 ? (stats.grandScore / stats.elapsedSec).toFixed(2) : "0.00";
  document.getElementById("settlement-speed").textContent = `${qPerSecVal} 題/秒 (${avgSec}秒/題)`;
  document.getElementById("settlement-acc").textContent = `${stats.accuracy}%`;
  document.getElementById("settlement-wrong").textContent = `答錯 ${stats.wrongAttempts} 次`;
  document.getElementById("settlement-streak").textContent = `${stats.maxStreak} 題`;
  document.getElementById("settlement-breakdown").textContent = formatBreakdownSummary(stats, false);
  const clearedEl = document.getElementById("settlement-cleared-blocks");
  if (clearedEl) {
    clearedEl.textContent = stats.clearedSummaryText || computeClearedBlocksStats().clearedSummaryText;
  }

  modal.classList.remove("hidden");
  document.getElementById("btn-reopen-settlement")?.classList.add("hidden");
  if (window.lucide) lucide.createIcons();
}

function drawRoundedRect(ctx, x, y, width, height, radius, fillStyle, strokeStyle) {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
  }
  ctx.closePath();
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.stroke();
  }
}

function downloadSettlementCard() {
  const stats = state.finalStats;
  if (!stats) return;

  const cvs = document.createElement("canvas");
  cvs.width = 1200;
  cvs.height = 675;
  const ctx = cvs.getContext("2d");

  // 1. Background Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 1200, 675);
  bgGrad.addColorStop(0, "#070d18");
  bgGrad.addColorStop(0.5, "#0f172a");
  bgGrad.addColorStop(1, "#050811");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1200, 675);

  // Ambient Radial Glows
  const glow1 = ctx.createRadialGradient(200, 120, 10, 200, 120, 350);
  glow1.addColorStop(0, "rgba(56, 189, 248, 0.15)");
  glow1.addColorStop(1, "rgba(56, 189, 248, 0)");
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, 600, 400);

  const glow2 = ctx.createRadialGradient(1000, 520, 10, 1000, 520, 350);
  glow2.addColorStop(0, "rgba(129, 140, 248, 0.14)");
  glow2.addColorStop(1, "rgba(129, 140, 248, 0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(600, 200, 600, 475);

  // Outer Border
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 24, 24, 1152, 627, 24, null, "rgba(148, 163, 184, 0.25)");

  const isTw = _dashIsTwModern();
  const pack = _dashPack();
  const allGroups = _dashGroups();
  const allItems = _dashItems();
  const unitLabels = _dashUnitLabels();
  const packDisplayName = (pack && (pack.displayName || pack.shortLabel)) || "台灣地理";

  // 2. Header
  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(isTw ? "TAIWAN GEOMASTER TW · 挑戰成績單" : "GEOMASTER PRO · 挑戰成績單", 64, 76);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 32px 'Noto Sans TC', -apple-system, sans-serif";
  ctx.fillText(isTw ? "台灣行政區記憶大挑戰" : `${packDisplayName}記憶大挑戰`, 64, 118);

  ctx.textAlign = "right";
  ctx.fillStyle = "#94a3b8";
  ctx.font = "bold 16px 'Noto Sans TC', sans-serif";
  ctx.fillText(`挑戰者：${stats.name}`, 1136, 76);

  ctx.fillStyle = "#64748b";
  ctx.font = "14px -apple-system, sans-serif";
  ctx.fillText(`${stats.date || new Date().toLocaleDateString("zh-TW")}`, 1136, 106);
  ctx.textAlign = "left";

  // Divider
  ctx.strokeStyle = "rgba(51, 65, 85, 0.8)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(64, 138);
  ctx.lineTo(1136, 138);
  ctx.stroke();

  // 3. Banner (Single Player Grade or Multiplayer Win/Loss)
  const activeBattleForCard = typeof getActiveBattlePlayers === "function" ? getActiveBattlePlayers() : [];
  const isMultiplayer = Boolean(activeBattleForCard.length >= 2 || state.aiRivalActive || state.aiRivalTimer);
  const oppStats = state.opponent.finalStats;
  const pctNum = stats.grandTotal > 0 ? ((stats.grandScore / stats.grandTotal) * 100) : 0;
  const pctStr = pctNum.toFixed(1) + "%";

  const activeList = typeof getActiveBattlePlayers === "function" ? getActiveBattlePlayers() : [];
  const isThreePlus = activeList.length >= 3;

  if (isMultiplayer && (isThreePlus || oppStats)) {
    if (isThreePlus) {
      const ranked = sortBattlePlayers(activeList);
      const myRank = Math.max(1, ranked.findIndex((p) => p.id === state.localInstanceId) + 1);
      const winner = ranked[0] || { name: "對手", score: 0, stationScore: 0, total: stats.grandTotal, stationTotal: 0 };
      const winnerCur = (winner.score || 0) + (winner.stationScore || 0);
      const winnerTot = (winner.total || 0) + (winner.stationTotal || 0) || stats.grandTotal;
      const winnerPct = winnerTot > 0 ? ((winnerCur / winnerTot) * 100).toFixed(1) + "%" : "0.0%";

      const isFirst = myRank === 1;
      const bannerBg = isFirst ? "rgba(245, 158, 11, 0.16)" : "rgba(56, 189, 248, 0.15)";
      const bannerBorder = isFirst ? "#f59e0b" : "#38bdf8";
      drawRoundedRect(ctx, 64, 156, 1072, 72, 16, bannerBg, bannerBorder);

      ctx.fillStyle = isFirst ? "#fbbf24" : "#38bdf8";
      ctx.font = "bold 26px 'Noto Sans TC', sans-serif";
      const titleText = isFirst
        ? `👑 榮獲第 1 名 · 勇奪冠軍 (共 ${activeList.length} 人)`
        : `🎖️ 第 ${myRank} 名 / 共 ${activeList.length} 人`;
      ctx.fillText(titleText, 88, 198);

      ctx.fillStyle = "#cbd5e1";
      ctx.font = "14px 'Noto Sans TC', sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`我方: ${stats.grandScore}/${stats.grandTotal} (${pctStr})  ·  冠軍【${winner.name}】: ${winnerCur}/${winnerTot} (${winnerPct})`, 1112, 198);
      ctx.textAlign = "left";
    } else {
      const outcome = getBattleOutcome(stats, oppStats);
      const isWin = outcome.isWin;
      const isDraw = outcome.isDraw;

      const bannerBg = isDraw ? "rgba(56, 189, 248, 0.15)" : isWin ? "rgba(16, 185, 129, 0.16)" : "rgba(244, 63, 94, 0.16)";
      const bannerBorder = isDraw ? "#38bdf8" : isWin ? "#10b981" : "#f43f5e";
      drawRoundedRect(ctx, 64, 156, 1072, 72, 16, bannerBg, bannerBorder);

      ctx.fillStyle = isDraw ? "#38bdf8" : isWin ? "#34d399" : "#fb7185";
      ctx.font = "bold 26px 'Noto Sans TC', sans-serif";
      const titleText = isDraw ? "⚖️ 勢均力敵 · 平手 (DRAW)" : isWin ? "👑 獲得勝利 · VICTORY" : "💔 遺憾惜敗 · DEFEAT";
      ctx.fillText(titleText, 88, 198);

      ctx.fillStyle = "#cbd5e1";
      ctx.font = "14px 'Noto Sans TC', sans-serif";
      ctx.textAlign = "right";
      const oppScore = oppStats.grandScore || oppStats.score || 0;
      const oppTotal = oppStats.grandTotal || oppStats.total || stats.grandTotal;
      const oppPct = oppTotal > 0 ? ((oppScore / oppTotal) * 100).toFixed(1) + "%" : "0%";
      ctx.fillText(`我方: ${stats.grandScore}/${stats.grandTotal} (${pctStr})  vs  對手【${oppStats.name || "對手"}】: ${oppScore}/${oppTotal} (${oppPct})`, 1112, 198);
      ctx.textAlign = "left";
    }
  } else {
    const gradeInfo = getGradeFromStats(stats);
    drawRoundedRect(ctx, 64, 156, 1072, 72, 16, "rgba(245, 158, 11, 0.14)", "#f59e0b");
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 26px 'Noto Sans TC', sans-serif";
    ctx.fillText(`🏆 挑戰評級：【${gradeInfo.grade}】· ${gradeInfo.title}`, 88, 198);

    ctx.fillStyle = "#fef3c7";
    ctx.font = "14px 'Noto Sans TC', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(gradeInfo.desc, 1112, 198);
    ctx.textAlign = "left";
  }

  // 4. Hero Score Box
  drawRoundedRect(ctx, 64, 248, 480, 280, 20, "rgba(15, 23, 42, 0.75)", "#334155");
  ctx.fillStyle = "#94a3b8";
  ctx.font = "bold 15px 'Noto Sans TC', sans-serif";
  ctx.fillText("最終挑戰完成率", 96, 288);

  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 76px 'JetBrains Mono', sans-serif";
  ctx.fillText(pctStr, 96, 375);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px 'Noto Sans TC', sans-serif";
  ctx.fillText(`總計完成：${stats.grandScore} / ${stats.grandTotal} 題`, 96, 428);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "14px 'Noto Sans TC', sans-serif";
  ctx.fillText(formatBreakdownSummary(stats, true), 96, 465);

  const pBarW = 416;
  drawRoundedRect(ctx, 96, 486, pBarW, 10, 5, "#1e293b", null);
  const fillW = Math.max(8, Math.min(pBarW, (stats.grandScore / Math.max(1, stats.grandTotal)) * pBarW));
  drawRoundedRect(ctx, 96, 486, fillW, 10, 5, "#38bdf8", null);

  // 5. 2x2 Metric Cards
  const diffNames = {
    casual: "休閒提示",
    county_only: isTw ? "縣市挑戰" : `${unitLabels.group}挑戰`,
    hard_suffix: "進階後綴",
    hard_full: "困難全名",
    master_hierarchy: "三階宗師"
  };
  const diffLabel = diffNames[state.difficulty] || state.difficulty;
  const avgSec = stats.grandScore > 0 ? (stats.elapsedSec / stats.grandScore).toFixed(1) : "0.0";
  const qPerSecVal = stats.elapsedSec > 0 ? (stats.grandScore / stats.elapsedSec).toFixed(2) : "0.00";
  const gInfoForCard = getGradeFromStats(stats);
  const clearedTextForCard = stats.clearedSummaryText || gInfoForCard.clearedText || "";
  const fullScopeFallback = isTw
    ? `全台 ${allItems.length} 行政區`
    : (unitLabels.fullScopeLabel || `${packDisplayName} (${allItems.length}${unitLabels.itemShort})`);
  const customScopeFallback = isTw
    ? `自選 ${state.selectedCounties.size} 縣市`
    : (_dashIsSingleLayer() ? `自選 ${getScopeTowns().length} ${unitLabels.itemShort}` : `自選 ${state.selectedCounties.size} ${unitLabels.group}`);

  const cards = [
    { title: "⏱️ 總耗時與速率", val: formatTime(stats.elapsedSec), sub: `${qPerSecVal} 題/秒 (每題 ${avgSec} 秒)`, x: 568, y: 248, color: "#ffffff" },
    { title: "🎯 答題正確率", val: `${stats.accuracy}%`, sub: `答對 ${stats.grandScore} · 答錯 ${stats.wrongAttempts} 次`, x: 864, y: 248, color: "#34d399" },
    { title: "🔥 最高連對", val: `${stats.maxStreak} 題`, sub: clearedTextForCard || "無間斷連續答對紀錄", x: 568, y: 396, color: "#f59e0b" },
    { title: "🗺️ 挑戰範圍與難度", val: diffLabel, sub: gInfoForCard.scopeLabel || (state.selectedCounties.size === allGroups.length ? fullScopeFallback : customScopeFallback), x: 864, y: 396, color: "#38bdf8" }
  ];

  cards.forEach((c) => {
    drawRoundedRect(ctx, c.x, c.y, 272, 132, 18, "rgba(15, 23, 42, 0.75)", "#334155");
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 13px 'Noto Sans TC', sans-serif";
    ctx.fillText(c.title, c.x + 22, c.y + 36);

    ctx.fillStyle = c.color;
    ctx.font = "bold 26px 'JetBrains Mono', 'Noto Sans TC', sans-serif";
    ctx.fillText(c.val, c.x + 22, c.y + 78);

    ctx.fillStyle = "#64748b";
    ctx.font = "12px 'Noto Sans TC', sans-serif";
    ctx.fillText(c.sub, c.x + 22, c.y + 108);
  });

  // 6. Footer Watermark
  ctx.strokeStyle = "rgba(51, 65, 85, 0.8)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(64, 550);
  ctx.lineTo(1136, 550);
  ctx.stroke();

  ctx.fillStyle = "#64748b";
  ctx.font = "14px 'Noto Sans TC', sans-serif";
  ctx.fillText(isTw ? "TAIWAN GEOMASTER TW · 探索台灣每一寸土地" : `GEOMASTER PRO · ${packDisplayName}`, 64, 588);

  ctx.textAlign = "right";
  ctx.fillStyle = "#475569";
  ctx.font = "12px -apple-system, sans-serif";
  ctx.fillText(window.location.href || "Taiwan GeoMaster Pro", 1136, 588);
  ctx.textAlign = "left";

  // Trigger Download
  const link = document.createElement("a");
  link.download = isTw ? `Taiwan-GeoMaster-Scorecard-${Date.now()}.png` : `GeoMaster-${_dashPackId()}-Scorecard-${Date.now()}.png`;
  link.href = cvs.toDataURL("image/png");
  link.click();
  setFeedback("📥 已成功生成並下載高解析度挑戰成績單圖片！", "success");
}

function formatSettlementShareText(stats, isMultiplayer, oppStats) {
  const isTw = _dashIsTwModern();
  const pack = _dashPack();
  const unitLabels = _dashUnitLabels();
  const packDisplayName = (pack && (pack.displayName || pack.shortLabel)) || "地理";
  const diffNames = {
    casual: "休閒提示",
    county_only: isTw ? "縣市挑戰" : `${unitLabels.group}挑戰`,
    hard_suffix: "進階後綴",
    hard_full: "困難全名",
    master_hierarchy: "三階宗師"
  };
  const diffLabel = diffNames[state.difficulty] || state.difficulty;
  const pctStr = stats.grandTotal > 0 ? ((stats.grandScore / stats.grandTotal) * 100).toFixed(1) + "%" : "0%";

  let resultLine = "";
  const activeList = typeof getActiveBattlePlayers === "function" ? getActiveBattlePlayers() : [];
  const isThreePlus = activeList.length >= 3;

  if (isMultiplayer && (isThreePlus || oppStats)) {
    if (isThreePlus) {
      const ranked = sortBattlePlayers(activeList);
      const myRank = Math.max(1, ranked.findIndex((p) => p.id === state.localInstanceId) + 1);
      const winner = ranked[0] || { name: "對手" };
      resultLine = myRank === 1
        ? `🏆 對戰結果：👑 榮獲第 1 名冠軍！(共 ${activeList.length} 人)`
        : `🏆 對戰結果：第 ${myRank} 名 / 共 ${activeList.length} 人 (冠軍：${winner.name})`;
    } else {
      const outcome = getBattleOutcome(stats, oppStats);
      if (outcome.isDraw) {
        resultLine = `🏆 對戰結果：⚖️ 勢均力敵 · 平手 (vs ${oppStats.name || "對手"})`;
      } else if (outcome.isWin) {
        resultLine = `🏆 對戰結果：👑 獲得勝利！(vs ${oppStats.name || "對手"})`;
      } else {
        resultLine = `🏆 對戰結果：💔 遺憾惜敗 (vs ${oppStats.name || "對手"})`;
      }
    }
  } else {
    const grade = getGradeFromStats(stats);
    resultLine = `🏆 評級稱號：【${grade.grade}】· ${grade.title}\n💬 評語標語：${grade.desc}`;
  }
  const avgSec = stats.grandScore > 0 ? (stats.elapsedSec / stats.grandScore).toFixed(1) : "0.0";
  const qPerSecVal = stats.elapsedSec > 0 ? (stats.grandScore / stats.elapsedSec).toFixed(2) : "0.00";
  const clearedText = stats.clearedSummaryText || computeClearedBlocksStats().clearedSummaryText;

  return [
    isTw ? `🗺️ 【Taiwan GeoMaster Pro · 台灣地理挑戰成績單】` : `🗺️ 【GeoMaster Pro · ${packDisplayName}挑戰成績單】`,
    `👤 挑戰者：${stats.name}`,
    resultLine,
    `📊 總完成度：${pctStr} (${stats.grandScore} / ${stats.grandTotal} 題 · ${formatBreakdownSummary(stats, false)})`,
    `🏅 破關區塊：${clearedText}`,
    `⏱️ 耗時與速率：${formatTime(stats.elapsedSec)} (${qPerSecVal} 題/秒 · 平均 ${avgSec} 秒/題)`,
    `🎯 答題正確率：${stats.accuracy}% (答錯 ${stats.wrongAttempts} 次)`,
    `🔥 最高連擊：${stats.maxStreak} 連對`,
    `🎮 難度模式：${diffLabel}`,
    `--------------------------`,
    isTw
      ? `挑戰你的台灣地理極限：${window.location.origin}${window.location.pathname}`
      : `挑戰你的地理極限：${window.location.origin}${window.location.pathname}`
  ].join("\n");
}

function shareSettlementCard() {
  const stats = state.finalStats;
  if (!stats) return;

  const isTw = _dashIsTwModern();
  const pack = _dashPack();
  const activeBattleForShare = typeof getActiveBattlePlayers === "function" ? getActiveBattlePlayers() : [];
  const isMultiplayer = Boolean(activeBattleForShare.length >= 2 || state.aiRivalActive || state.aiRivalTimer);
  const oppStats = state.opponent.finalStats;
  const text = formatSettlementShareText(stats, isMultiplayer, oppStats);

  if (navigator.share) {
    navigator.share({
      title: isTw ? "Taiwan GeoMaster Pro · 台灣地理挑戰成績單" : `GeoMaster Pro · ${(pack && (pack.displayName || pack.shortLabel)) || "地理"}挑戰成績單`,
      text: text,
      url: window.location.href
    }).catch(() => {
      copyToClipboard(text);
    });
  } else {
    copyToClipboard(text);
  }
}

function copyToClipboard(text) {
  try {
    navigator.clipboard.writeText(text).then(() => {
      setFeedback("📋 已成功複製挑戰成績單至剪貼簿！", "success");
    }).catch(() => {
      fallbackCopy(text);
    });
  } catch (_) {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
  setFeedback("📋 已成功複製挑戰成績單至剪貼簿！", "success");
}

function resetGame(options = {}) {
  stopTimer();
  if (state.passedTargetKeys) state.passedTargetKeys.clear();
  state.targetQueueIndex = 0;
  if (!options || !options.preserveTargetQueue) {
    state.targetQueue =
      (state.playMode === "target_random" || state.playMode === "satellite_quiz") &&
      typeof buildTargetQuizQueue === "function"
        ? buildTargetQuizQueue(state.targetQuestionLimit)
        : [];
  }
  state.unlockedTowns.clear();
  state.unlockedCounties.clear();
  state.unlockedProvinces.clear();
  state.missedTowns.clear();
  state.unlockedStations.clear();
  state.missedStations.clear();
  state.targetStationKey = null;
  if (state.unlockedPois) state.unlockedPois.clear();
  if (state.missedPois) state.missedPois.clear();
  state.targetPoiId = null;
  state.isGameOver = false;
  state.finished = false;
  state.promptedLastPlayer = false;
  state.finalStats = null;
  state.elapsedSec = 0;
  state.targetId = null;
  state.hintLevel = 0;
  state.satelliteOutlineRevealed = false;
  state.rushScore = 0;
  state.rushQuestionHistory = [];
  if (typeof resetMpQuestionSync === "function") {
    resetMpQuestionSync(0, "");
  }
  if (typeof clearSatelliteTargetMarker === "function") {
    clearSatelliteTargetMarker();
  }

  if (state.opponent) {
    state.opponent.finished = false;
    state.opponent.finalStats = null;
  }

  state.stats = {
    totalAttempts: 0,
    correctAttempts: 0,
    wrongAttempts: 0,
    streak: 0,
    maxStreak: 0
  };

  document.getElementById("modal-settlement")?.classList.add("hidden");
  document.getElementById("modal-opponent-finished")?.classList.add("hidden");
  document.getElementById("modal-rematch-confirm")?.classList.add("hidden");
  document.getElementById("btn-reopen-settlement")?.classList.add("hidden");

  const rematchBtn = document.getElementById("btn-rematch-settlement");
  const rematchText = document.getElementById("rematch-btn-text");
  if (rematchBtn) rematchBtn.disabled = false;
  if (rematchText) rematchText.textContent = state.opponent.connected ? "發起重開對戰" : "再玩一局";
  const returnLobbyBtn = document.getElementById("btn-return-lobby-settlement");
  if (returnLobbyBtn) returnLobbyBtn.disabled = false;

  updateRoadAndRailwayTileOverlays();
  if (typeof refreshPoiMapLayer === "function") refreshPoiMapLayer();

  document.getElementById("timer-display").textContent =
    state.timerMode === "down" ? formatTime(state.countdownTotalSec) : "00:00";

  updatePrefixDropdownUI();
  updateScoreAndProgressUI();
  if (state.playMode === "pin_drop" && typeof startPinDropGame === "function") {
    startPinDropGame();
    return;
  }
  if (state.playMode === "target_random" || state.playMode === "satellite_quiz") {
    pickNextTargetRegion();
  } else {
    _dashUnlockViewport({ restoreLayers: true });
    updateTargetBannerUI();
    refreshAllPolygonStyles();
  }
  const unitLabels = _dashUnitLabels();
  setFeedback(
    _dashIsTwModern()
      ? "新的一局已準備就緒，輸入第一個行政區即開始計時！"
      : `新的一局已準備就緒，輸入第一個${unitLabels.item}即開始計時！`,
    "info"
  );
  if (state.roomCode || state.aiRivalActive) broadcastP2PState("重新開局");
}

// ============================================================================
// 9. TIMER & COUNTDOWN ENGINE
// ============================================================================
function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function startTimer() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerRunning = true;
  state.timerInterval = setInterval(() => {
    state.elapsedSec++;
    const disp = document.getElementById("timer-display");
    if (state.timerMode === "up") {
      disp.textContent = formatTime(state.elapsedSec);
      disp.className = "font-mono-num text-sm sm:text-base font-bold text-white tracking-wider";
    } else {
      const left = state.countdownTotalSec - state.elapsedSec;
      disp.textContent = formatTime(left);
      if (left <= 30) {
        disp.className = "font-mono-num text-sm sm:text-base font-bold text-rose-400 animate-pulse tracking-wider";
      } else {
        disp.className = "font-mono-num text-sm sm:text-base font-bold text-amber-300 tracking-wider";
      }
      if (left <= 0) {
        finishGame("timeout");
      }
    }
  }, 1000);
}

function stopTimer() {
  state.timerRunning = false;
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
  if (typeof stopQuestionCountdown === "function") {
    stopQuestionCountdown();
  }
}
