// ============================================================================
// 12. UI CONTROLS, SIMPLE/ADVANCED SETTINGS TABS, ROOM MODAL & IME LISTENERS
// ============================================================================
function _getActivePack() {
  return typeof getActiveMapPack === "function" ? getActiveMapPack() : null;
}

function _getRegisteredPacks() {
  return typeof getRegisteredMapPacks === "function" ? getRegisteredMapPacks() : [];
}

function _getActivePackGroups() {
  return typeof getActiveGroups === "function"
    ? getActiveGroups()
    : (typeof TAIWAN_ADMIN_DATA !== "undefined" ? TAIWAN_ADMIN_DATA : []);
}

function _getActivePackItems() {
  return typeof getActiveItems === "function"
    ? getActiveItems()
    : (typeof ALL_TOWNS !== "undefined" ? ALL_TOWNS : []);
}

function _getActivePackGroupByName(name) {
  if (typeof getActiveGroupByName === "function") return getActiveGroupByName(name);
  return typeof COUNTY_BY_NAME !== "undefined" ? COUNTY_BY_NAME[name] || null : null;
}

function _getActivePackFeatures() {
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

function _getActivePackUnitLabels() {
  if (typeof getActivePackUnitLabels === "function") return getActivePackUnitLabels();
  return {
    group: "縣市",
    item: "鄉鎮市區",
    itemShort: "區",
    fullScopeLabel: "全台 368 區"
  };
}

function _uiIsTaiwanModernPack() {
  const pack = _getActivePack();
  return !pack || pack.id === "tw_modern";
}

function _resetToFullPackView() {
  if (typeof resetToFullPackView === "function") {
    resetToFullPackView();
  } else if (typeof resetToFullTaiwanView === "function") {
    resetToFullTaiwanView();
  }
}

function _unlockMapViewportToPack(opts) {
  if (typeof unlockMapViewportToPack === "function") {
    unlockMapViewportToPack(opts);
  } else if (typeof unlockMapViewportToTaiwan === "function") {
    unlockMapViewportToTaiwan(opts);
  }
}

let _mapOverlayShownByPackSwitch = false;

function setMapPackLoadingUI(packId, pack = null) {
  const statusEl = document.getElementById("mappack-loading-status");
  const statusTextEl = document.getElementById("mappack-loading-text");
  const panelEl = document.getElementById("unified-settings-panel");
  const overlayEl = document.getElementById("map-loading-overlay");
  const overlayTextEl = document.getElementById("map-loading-text");
  const isLoading = Boolean(packId);

  if (isLoading) {
    const resolvedPack = pack || (typeof getMapPackById === "function" ? getMapPackById(packId) : null);
    const label = (resolvedPack && (resolvedPack.shortLabel || resolvedPack.displayName)) || packId;
    if (statusTextEl) statusTextEl.textContent = `載入「${label}」中…`;
    if (statusEl) statusEl.classList.remove("hidden");
    if (panelEl) {
      panelEl.classList.add("is-switching-pack");
      panelEl.setAttribute("aria-busy", "true");
    }
    if (overlayTextEl) overlayTextEl.textContent = `正在切換至「${label}」地圖…`;
    if (overlayEl) {
      overlayEl.classList.remove("hidden");
      _mapOverlayShownByPackSwitch = true;
    }
  } else {
    if (statusEl) statusEl.classList.add("hidden");
    if (panelEl) {
      panelEl.classList.remove("is-switching-pack");
      if (typeof panelEl.removeAttribute === "function") panelEl.removeAttribute("aria-busy"); else if (typeof panelEl.setAttribute === "function") panelEl.setAttribute("aria-busy", "false");
    }
    if (_mapOverlayShownByPackSwitch && overlayEl) {
      overlayEl.classList.add("hidden");
      _mapOverlayShownByPackSwitch = false;
    }
  }
}

function handleMapPackSelection(packId) {
  if (!packId) return;
  if (typeof canLocalModifyGameConfig === "function" && !canLocalModifyGameConfig()) {
    setFeedback("🔒 僅房主可切換地圖包！", "warn");
    if (typeof playTone === "function") playTone("error");
    renderMapPackSwitcherUI();
    return;
  }
  const normalizedId =
    typeof isCompositeMapPackId === "function" && isCompositeMapPackId(packId) && typeof formatCompositeMapPackId === "function"
      ? formatCompositeMapPackId(packId)
      : packId;
  const loadingId = typeof getLoadingMapPackId === "function" ? getLoadingMapPackId() : null;
  if (loadingId && normalizedId === loadingId) return;
  const activeId = state.activeMapPackId || ((_getActivePack() || {}).id) || "tw_modern";
  if (!loadingId && normalizedId === activeId) return;
  if (state.isHost && state.roomCode && typeof requestOrApplyConfigChange === "function") {
    requestOrApplyConfigChange({ mapPackId: normalizedId }, "地圖包");
    return;
  }
  if (typeof switchActiveMapPack === "function") {
    Promise.resolve(switchActiveMapPack(normalizedId)).catch(() => {
      setFeedback("❌ 切換地圖包失敗，請稍後再試", "error");
      renderMapPackSwitcherUI();
    });
  }
}

function handleMapPackToggle(packId) {
  if (!packId) return;
  const curIds =
    typeof getActiveMapPackIds === "function"
      ? getActiveMapPackIds()
      : [state.activeMapPackId || "tw_modern"];
  const nextIds =
    typeof resolveToggleMapPackIds === "function"
      ? resolveToggleMapPackIds(curIds, packId)
      : [packId];
  const nextId =
    typeof formatCompositeMapPackId === "function"
      ? formatCompositeMapPackId(nextIds)
      : nextIds[0];
  handleMapPackSelection(nextId);
}

function _getActivePackEligibleItems() {
  if (typeof getPackEligibleItems === "function") {
    return getPackEligibleItems(_getActivePack(), state);
  }
  return _getActivePackItems();
}

let _scopeDrawerExpanded = false;
let _roomRestrictionsExpanded = false;

function setScopeDrawerExpanded(expanded) {
  _scopeDrawerExpanded = Boolean(expanded);
  const body = document.getElementById("simple-region-drawer-body");
  const btn = document.getElementById("btn-toggle-scope-drawer");
  const chev = document.getElementById("scope-drawer-chevron");
  if (body) body.classList.toggle("hidden", !_scopeDrawerExpanded);
  if (btn) btn.setAttribute("aria-expanded", _scopeDrawerExpanded ? "true" : "false");
  if (chev) chev.textContent = _scopeDrawerExpanded ? "收合 ▴" : "調整 ▾";
}

function updateSettingsHelpPopoverContent() {
  const noteEl = document.getElementById("settings-help-pack-note");
  if (!noteEl) return;
  const pack = _getActivePack();
  if (pack && pack.dataNote) {
    noteEl.textContent = `資料範圍：${pack.dataNote}`;
    noteEl.classList.remove("hidden");
  } else {
    noteEl.textContent = "";
    noteEl.classList.add("hidden");
  }
}

function syncPackOptionsUI() {
  const pack = _getActivePack();
  const packId = (pack && pack.id) || state.activeMapPackId || "tw_modern";
  const bar = document.getElementById("pack-options-bar");
  const worldWrap = document.getElementById("pack-opt-world-micro-wrap");
  const cnWrap = document.getElementById("pack-opt-cn-singlechar-wrap");
  const rocMngWrap = document.getElementById("pack-opt-roc-mongolia-wrap");
  const rocMuniWrap = document.getElementById("pack-opt-roc-municipalities-wrap");
  const rocDispWrap = document.getElementById("pack-opt-roc-disputed-wrap");
  const histLayerBtn = document.getElementById("btn-layer-historical");
  const hasPack = (id) => (typeof hasActiveMapPack === "function" ? hasActiveMapPack(id) : packId === id);
  const isWorld = hasPack("world_countries");
  const isCn = hasPack("cn_prov");
  const isRoc = hasPack("roc_1949");

  if (bar) bar.classList.toggle("hidden", !isWorld && !isCn && !isRoc);
  if (worldWrap) worldWrap.classList.toggle("hidden", !isWorld);
  if (cnWrap) cnWrap.classList.toggle("hidden", !isCn);
  if (rocMngWrap) rocMngWrap.classList.toggle("hidden", !isRoc);
  if (rocMuniWrap) rocMuniWrap.classList.toggle("hidden", !isRoc);
  if (rocDispWrap) rocDispWrap.classList.toggle("hidden", !isRoc);
  if (histLayerBtn) {
    const hasHist = Boolean(pack && pack.features && pack.features.supportsHistoricalBasemap);
    histLayerBtn.classList.toggle("hidden", !hasHist);
  }

  const chkWorld = document.getElementById("chk-pack-world-microstates");
  const lblWorld = document.getElementById("lbl-pack-world-microstates");
  const includeMicro = !state.packOptions || state.packOptions.worldIncludeMicrostates !== false;
  if (chkWorld) chkWorld.checked = includeMicro;
  if (lblWorld && isWorld) {
    const eligCount = _getActivePackEligibleItems().length;
    lblWorld.textContent = includeMicro
      ? `🏝️ 含微型國（完整 ${eligCount || 196} 國）`
      : `🏝️ 含微型國（標準版 ${eligCount || 169} 國）`;
  }

  const chkCn = document.getElementById("chk-pack-cn-singlechar");
  if (chkCn) chkCn.checked = Boolean(state.packOptions && state.packOptions.cnAllowSingleCharAlias);

  const chkRocMng = document.getElementById("chk-pack-roc-mongolia");
  const lblRocMng = document.getElementById("lbl-pack-roc-mongolia");
  const chkRocMuni = document.getElementById("chk-pack-roc-municipalities");
  const lblRocMuni = document.getElementById("lbl-pack-roc-municipalities");
  const chkRocDisp = document.getElementById("chk-pack-roc-disputed");
  const includeMongolia = !state.packOptions || state.packOptions.rocTerritoryVariant !== "no_mongolia";
  const includeMuni = !state.packOptions || state.packOptions.includeMunicipalities !== false;
  const showDisp = !state.packOptions || state.packOptions.showDisputedBorders !== false;
  if (chkRocMng) chkRocMng.checked = includeMongolia;
  if (chkRocMuni) chkRocMuni.checked = includeMuni;
  if (chkRocDisp) chkRocDisp.checked = showDisp;
  if (isRoc) {
    const eligCount = _getActivePackEligibleItems().length;
    if (lblRocMng) {
      lblRocMng.textContent = includeMongolia
        ? `🇹🇼 含蒙古地方（目前 ${eligCount || 50} 區）`
        : `🇹🇼 不含蒙古地方（目前 ${eligCount || 49} 區）`;
    }
    if (lblRocMuni) {
      lblRocMuni.textContent = includeMuni ? "🏙️ 含 12 院轄市" : "🏙️ 僅 38 省／地方／特區";
    }
  }
}

function syncScopeDrawerSummaryUI() {
  const textEl = document.getElementById("scope-drawer-summary-text");
  if (!textEl) return;
  const pack = _getActivePack();
  const unitLabels = _getActivePackUnitLabels();
  const eligibleItems = _getActivePackEligibleItems();
  const scopeTowns = typeof getScopeTowns === "function" ? getScopeTowns() : [];
  const count = scopeTowns.length;

  let summary = "";
  if (count === 0) {
    summary = "未選取任何區域";
  } else if (count === eligibleItems.length && eligibleItems.length > 0) {
    if (pack && pack.id === "world_countries" && state.packOptions && state.packOptions.worldIncludeMicrostates === false) {
      summary = `標準版 ${count} ${unitLabels.itemShort}`;
    } else if (pack && pack.id === "roc_1949") {
      const noMng = state.packOptions && state.packOptions.rocTerritoryVariant === "no_mongolia";
      const noMuni = state.packOptions && state.packOptions.includeMunicipalities === false;
      if (!noMng && !noMuni) {
        summary = `中華民國1945 全境 ${count} ${unitLabels.itemShort}`;
      } else {
        const tag = `${noMng ? "不含蒙古" : "含蒙古"}${noMuni ? " · 不含院轄市" : ""}`;
        summary = `${tag}（${count} ${unitLabels.itemShort}）`;
      }
    } else {
      summary = unitLabels.fullScopeLabel || `全部 ${count} ${unitLabels.itemShort}`;
    }
  } else if (typeof getConciseRegionSummaryText === "function") {
    const regDesc = getConciseRegionSummaryText();
    summary = regDesc ? `${regDesc}（${count} ${unitLabels.itemShort}）` : `${count} ${unitLabels.itemShort}`;
  } else {
    summary = `${count} ${unitLabels.itemShort}`;
  }
  textEl.textContent = `📍 範圍：${summary}`;
}

function applyPackOptionToggle(optionKey, value) {
  if (!canLocalModifyGameConfig()) {
    setFeedback("🔒 僅房主可調整地圖包選項！", "warn");
    if (typeof playTone === "function") playTone("error");
    syncPackOptionsUI();
    return;
  }
  const nextVal = optionKey === "rocTerritoryVariant"
    ? (value === "no_mongolia" || value === false ? "no_mongolia" : "begonia_full")
    : Boolean(value);
  const cur = state.packOptions || {};
  const nextOpts = {
    worldIncludeMicrostates: cur.worldIncludeMicrostates !== false,
    cnAllowSingleCharAlias: Boolean(cur.cnAllowSingleCharAlias),
    rocTerritoryVariant: cur.rocTerritoryVariant === "no_mongolia" ? "no_mongolia" : "begonia_full",
    includeMunicipalities: cur.includeMunicipalities !== false,
    showDisputedBorders: cur.showDisputedBorders !== false,
    [optionKey]: nextVal
  };
  const labelMap = {
    worldIncludeMicrostates: "世界微型國開關",
    cnAllowSingleCharAlias: "中國一字簡稱",
    rocTerritoryVariant: "中華民國1945 疆域版本",
    includeMunicipalities: "12 院轄市開關",
    showDisputedBorders: "爭議邊界線顯示"
  };
  const label = labelMap[optionKey] || "地圖包選項";

  if (state.isHost && state.roomCode && typeof requestOrApplyConfigChange === "function") {
    requestOrApplyConfigChange({ packOptions: nextOpts }, label);
    return;
  }

  const prevWorldMicro = cur.worldIncludeMicrostates !== false;
  const prevRocMng = cur.rocTerritoryVariant !== "no_mongolia";
  const prevRocMuni = cur.includeMunicipalities !== false;
  state.packOptions = nextOpts;

  if (typeof syncScopeWithPackOptions === "function") {
    if (optionKey === "worldIncludeMicrostates") {
      syncScopeWithPackOptions(!prevWorldMicro && nextVal);
    } else if (optionKey === "rocTerritoryVariant") {
      syncScopeWithPackOptions(!prevRocMng && nextVal === "begonia_full");
    } else if (optionKey === "includeMunicipalities") {
      syncScopeWithPackOptions(!prevRocMuni && nextVal);
    }
  }
  if (typeof rebuildActivePackLookupSets === "function") {
    rebuildActivePackLookupSets();
  }
  if (typeof renderDisputedBordersLayer === "function") {
    renderDisputedBordersLayer();
  }
  if (typeof refreshAllPolygonStyles === "function") {
    refreshAllPolygonStyles();
  }
  renderScopeModalGrid();
  if (typeof updateScoreAndProgressUI === "function") {
    updateScoreAndProgressUI();
  }
  if (typeof renderRoomConciseSettingsSummary === "function") {
    renderRoomConciseSettingsSummary();
  }
}

function syncRoomRestrictionsDrawerUI(explicitExpanded = null) {
  const hasNonDefault = Boolean(
    (state.p2pLayerRule && state.p2pLayerRule !== "free") ||
      (state.p2pRailRule && state.p2pRailRule !== "free") ||
      (state.p2pBorderRule && state.p2pBorderRule !== "free") ||
      state.allowTargetHints
  );
  if (typeof explicitExpanded === "boolean") {
    _roomRestrictionsExpanded = explicitExpanded;
  } else if (hasNonDefault) {
    _roomRestrictionsExpanded = true;
  }

  const body = document.getElementById("host-room-restrictions-body");
  const btn = document.getElementById("btn-toggle-room-restrictions");
  const chev = document.getElementById("room-restrictions-chevron");
  const badge = document.getElementById("room-restrictions-active-badge");
  if (body) body.classList.toggle("hidden", !_roomRestrictionsExpanded);
  if (btn) btn.setAttribute("aria-expanded", _roomRestrictionsExpanded ? "true" : "false");
  if (chev) chev.textContent = _roomRestrictionsExpanded ? "收合 ▴" : "展開 ▾";
  if (badge) badge.classList.toggle("hidden", !hasNonDefault);
}

function renderMapPackSwitcherUI() {
  const section = document.getElementById("mappack-selector-section");
  const grid = document.getElementById("mappack-selector-grid");
  if (!section || !grid) return;

  const packs = _getRegisteredPacks();
  if (packs.length <= 1) {
    section.classList.add("hidden");
    grid.replaceChildren();
    return;
  }

  section.classList.remove("hidden");
  const activeId = state.activeMapPackId || ((_getActivePack() || {}).id) || "tw_modern";
  const activeIds =
    typeof getActiveMapPackIds === "function" ? getActiveMapPackIds() : [activeId];
  const loadingId = typeof getLoadingMapPackId === "function" ? getLoadingMapPackId() : null;
  const loadingIds =
    loadingId && typeof isCompositeMapPackId === "function" && isCompositeMapPackId(loadingId) && typeof parseMapPackIds === "function"
      ? parseMapPackIds(loadingId)
      : (loadingId ? [loadingId] : []);

  const nodes = packs.map((pack) => {
    const isCombinable = typeof isMapPackCombinable === "function" && isMapPackCombinable(pack.id);
    const isLoading = Boolean(
      loadingId &&
        (pack.id === loadingId || (loadingIds.includes(pack.id) && !activeIds.includes(pack.id)))
    );
    const isActive = !loadingId && activeIds.includes(pack.id);

    const buildBadgeOrSpinner = () => {
      if (isLoading) {
        const loadingBadge = document.createElement("span");
        loadingBadge.className = "inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-sky-400/25 text-sky-100 shrink-0";
        const spinner = document.createElement("span");
        spinner.className = "mappack-spinner";
        spinner.setAttribute("aria-hidden", "true");
        const txt = document.createElement("span");
        txt.textContent = "載入中";
        loadingBadge.appendChild(spinner);
        loadingBadge.appendChild(txt);
        return loadingBadge;
      }
      const badgeEl = document.createElement("span");
      badgeEl.className = isActive
        ? "text-[10px] font-mono-num font-bold px-1.5 py-0.5 rounded-md bg-indigo-400/25 text-indigo-100 shrink-0"
        : "text-[10px] font-mono-num font-bold px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-400 shrink-0";
      let badgeStr = pack.badgeText || "";
      if (!badgeStr) {
        const pItems = typeof pack.getItems === "function" ? pack.getItems() : [];
        const uShort = (pack.unitLabels && pack.unitLabels.itemShort) || "區";
        badgeStr = pItems.length > 0 ? `${pItems.length}${uShort}` : "";
      }
      badgeEl.textContent = badgeStr;
      return badgeStr ? badgeEl : null;
    };

    if (isCombinable) {
      const card = document.createElement("div");
      card.setAttribute("data-mappack-id", pack.id);
      if (isLoading) card.setAttribute("aria-busy", "true");
      if (pack.displayName) {
        const mutexNote =
          pack.id === "cn_prov"
            ? "（與中華民國1945、世界互斥）"
            : pack.id === "roc_1949"
            ? "（與中國、世界互斥）"
            : "（可點右側 + 與日／中／民國組合）";
        card.setAttribute("data-tip", `${pack.displayName}${mutexNote}`);
      }
      card.className = isLoading
        ? "rounded-xl border border-sky-400 bg-sky-500/20 text-white transition shadow flex items-stretch overflow-hidden mappack-card-loading"
        : isActive
        ? "rounded-xl border border-indigo-400 bg-indigo-500/25 text-white transition shadow flex items-stretch overflow-hidden"
        : "rounded-xl border border-slate-700/80 bg-slate-950/70 hover:bg-slate-800 text-slate-300 transition flex items-stretch overflow-hidden";

      const soloBtn = document.createElement("button");
      soloBtn.type = "button";
      soloBtn.className = "flex-1 min-w-0 px-2 py-2 text-left flex items-center justify-between gap-1 hover:bg-white/5 transition";
      const titleEl = document.createElement("span");
      titleEl.className = isLoading || isActive
        ? "text-xs font-extrabold text-white truncate"
        : "text-xs font-extrabold text-slate-200 truncate";
      titleEl.textContent = pack.shortLabel || pack.displayName || pack.id;
      soloBtn.appendChild(titleEl);
      const badgeNode = buildBadgeOrSpinner();
      if (badgeNode) soloBtn.appendChild(badgeNode);
      soloBtn.addEventListener("click", () => handleMapPackSelection(pack.id));

      const unionBtn = document.createElement("button");
      unionBtn.type = "button";
      unionBtn.setAttribute("data-mappack-toggle-id", pack.id);
      unionBtn.setAttribute("role", "checkbox");
      unionBtn.setAttribute("aria-checked", isActive ? "true" : "false");
      unionBtn.setAttribute("aria-label", `複選切換 ${pack.shortLabel || pack.id}`);
      unionBtn.className = isActive
        ? "px-2 border-l border-indigo-400/40 bg-indigo-500/30 hover:bg-indigo-500/45 text-indigo-100 text-xs font-black flex items-center justify-center shrink-0 transition"
        : "px-2 border-l border-slate-700/80 bg-slate-900/80 hover:bg-indigo-500/30 text-slate-400 hover:text-white text-xs font-black flex items-center justify-center shrink-0 transition";
      unionBtn.textContent = isActive ? "✓" : "+";
      unionBtn.addEventListener("click", (ev) => {
        if (ev && typeof ev.stopPropagation === "function") ev.stopPropagation();
        handleMapPackToggle(pack.id);
      });

      card.appendChild(soloBtn);
      card.appendChild(unionBtn);
      return card;
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("data-mappack-id", pack.id);
    if (isLoading) btn.setAttribute("aria-busy", "true");
    if (pack.displayName) {
      const tip = pack.id === "world_countries" ? `${pack.displayName}（單獨模式，與其他地圖互斥）` : pack.displayName;
      btn.setAttribute("data-tip", tip);
    }
    btn.className = isLoading
      ? "px-2.5 py-2 rounded-xl border border-sky-400 bg-sky-500/20 text-white text-left transition shadow flex items-center justify-between gap-1.5 mappack-card-loading"
      : isActive
      ? "px-2.5 py-2 rounded-xl border border-indigo-400 bg-indigo-500/25 text-white text-left transition shadow flex items-center justify-between gap-1.5"
      : "px-2.5 py-2 rounded-xl border border-slate-700/80 bg-slate-950/70 hover:bg-slate-800 text-slate-300 text-left transition flex items-center justify-between gap-1.5";

    const titleEl = document.createElement("span");
    titleEl.className = isLoading || isActive
      ? "text-xs font-extrabold text-white truncate"
      : "text-xs font-extrabold text-slate-200 truncate";
    titleEl.textContent = pack.shortLabel || pack.displayName || pack.id;

    btn.appendChild(titleEl);
    const badgeNode = buildBadgeOrSpinner();
    if (badgeNode) btn.appendChild(badgeNode);
    btn.addEventListener("click", () => handleMapPackSelection(pack.id));
    return btn;
  });

  grid.replaceChildren(...nodes);

  // Sync 1-tap East Asia combo shortcut pills (台日中 / 台日民國)
  const hasTwJpCn = Boolean(
    typeof getMapPackById === "function" &&
      getMapPackById("tw_modern") &&
      getMapPackById("jp_pref") &&
      getMapPackById("cn_prov")
  );
  const hasTwJpRoc = Boolean(
    typeof getMapPackById === "function" &&
      getMapPackById("tw_modern") &&
      getMapPackById("jp_pref") &&
      getMapPackById("roc_1949")
  );
  const btnTwJpCn = document.getElementById("mappack-combo-twjpcn");
  if (btnTwJpCn) {
    btnTwJpCn.classList.toggle("hidden", !hasTwJpCn);
    const on = !loadingId && activeId === "tw_modern+jp_pref+cn_prov";
    btnTwJpCn.className = on
      ? "px-2 py-0.5 rounded-lg text-[10px] font-extrabold border border-indigo-400 bg-indigo-500/30 text-white transition"
      : "px-2 py-0.5 rounded-lg text-[10px] font-bold border border-slate-700 bg-slate-950/80 hover:bg-slate-800 text-slate-300 transition";
  }
  const btnTwJpRoc = document.getElementById("mappack-combo-twjproc");
  if (btnTwJpRoc) {
    btnTwJpRoc.classList.toggle("hidden", !hasTwJpRoc);
    const on = !loadingId && activeId === "tw_modern+jp_pref+roc_1949";
    btnTwJpRoc.className = on
      ? "px-2 py-0.5 rounded-lg text-[10px] font-extrabold border border-indigo-400 bg-indigo-500/30 text-white transition"
      : "px-2 py-0.5 rounded-lg text-[10px] font-bold border border-slate-700 bg-slate-950/80 hover:bg-slate-800 text-slate-300 transition";
  }
}

function applyActivePackFeatureGatingUI() {
  const pack = _getActivePack();
  const features = _getActivePackFeatures();
  const groups = _getActivePackGroups();
  const items = _getActivePackItems();
  const unitLabels = _getActivePackUnitLabels();
  const isTw = _uiIsTaiwanModernPack();

  const supportedDiffs = new Set(
    Array.isArray(features.supportedDifficulties) && features.supportedDifficulties.length > 0
      ? features.supportedDifficulties
      : ["casual"]
  );
  const diffCard = document.getElementById("difficulty-selector-card");
  if (diffCard) {
    diffCard.classList.toggle("hidden", supportedDiffs.size <= 1);
  }
  const diffGrid = document.getElementById("difficulty-buttons-grid");
  if (diffGrid) {
    diffGrid.className =
      supportedDiffs.size === 2
        ? "grid grid-cols-2 gap-1.5"
        : "grid grid-cols-2 sm:grid-cols-5 gap-1.5";
  }
  document.querySelectorAll(".diff-btn[data-diff]").forEach((btn) => {
    const d = btn.getAttribute("data-diff");
    btn.classList.toggle("hidden", !supportedDiffs.has(d));
    if (d === "county_only") {
      const inner = btn.firstElementChild || btn;
      inner.textContent = `🔵 ${groups.length}${unitLabels.group}`;
    }
  });
  syncPackOptionsUI();
  updateSettingsHelpPopoverContent();

  const hierBar = document.getElementById("hierarchy-guide-bar");
  if (hierBar && !features.supportsMasterHierarchy) {
    hierBar.classList.add("hidden");
  }

  const supportsTransport = Boolean(features.supportsTransportQuiz);
  const supportsPoi = Boolean(features.supportsPoiQuiz);
  const supportsCapital = Boolean(features.supportsCapitalQuiz);
  const capTopicLabel = typeof getCapitalTopicLabelForPack === "function" ? getCapitalTopicLabelForPack(pack) : (features.capitalLabel || "首都／省會");

  document.querySelectorAll('.topic-chip-btn[data-topic="station"]').forEach((el) => {
    el.classList.toggle("hidden", !supportsTransport);
  });
  document.getElementById("map-rail-control-pill")?.classList.toggle("hidden", !supportsTransport);
  document.getElementById("p2p-rail-rule-wrap")?.classList.toggle("hidden", !supportsTransport);

  ["airport", "port", "reservoir", "lake", "settlement"].forEach((topic) => {
    document.querySelectorAll(`.topic-chip-btn[data-topic="${topic}"]`).forEach((el) => {
      el.classList.toggle("hidden", !supportsPoi);
    });
  });

  document.querySelectorAll('.topic-chip-btn[data-topic="capital"]').forEach((el) => {
    el.classList.toggle("hidden", !supportsCapital);
    const lblSpan = el.querySelector(".capital-topic-label");
    if (lblSpan) lblSpan.textContent = `🏛️ ${capTopicLabel}`;
    const soloBtn = el.querySelector(".geo-solo-btn");
    if (soloBtn) soloBtn.setAttribute("aria-label", `單選🏛️ ${capTopicLabel}`);
    const unionBtn = el.querySelector(".geo-union-btn");
    if (unionBtn) unionBtn.setAttribute("aria-label", `複選切換🏛️ ${capTopicLabel}`);
    const tipText =
      pack && pack.id === "world_countries"
        ? "猜世界各國首都（點左單選純猜首都 / 點右複選搭配國家）"
        : pack && pack.id === "roc_1949"
        ? "猜中華民國1945各省省會與蒙藏特區首府（點左單選 / 點右複選）"
        : "猜中國各省省會與自治區首府（點左單選 / 點右複選）";
    el.setAttribute("data-tip", tipText);
  });

  document.querySelectorAll('.topic-chip-btn[data-topic="region"]').forEach((el) => {
    const regionLblSpan = el.querySelector(".geo-solo-btn span");
    if (regionLblSpan) {
      regionLblSpan.textContent = pack && pack.id === "world_countries" ? "🌍 國家" : "🗺️ 行政區";
    }
  });

  document.getElementById("topic-selector-card")?.classList.toggle("hidden", !supportsTransport && !supportsPoi && !supportsCapital);

  const topicRegionMeta = document.getElementById("topic-region-meta");
  if (topicRegionMeta) {
    topicRegionMeta.textContent = `${groups.length} ${unitLabels.group} / ${items.length} ${unitLabels.itemShort}`;
  }

  document.getElementById("map-quick-jump-tw-group")?.classList.toggle("hidden", !isTw);

  const btnViewAll = document.getElementById("btn-view-all");
  if (btnViewAll) {
    const sp = btnViewAll.querySelector("span") || btnViewAll;
    sp.textContent = isTw ? "🔄 縮回全台灣" : "🔄 縮回全圖";
  }
  const btnViewAllTw = document.getElementById("btn-view-all-taiwan");
  if (btnViewAllTw) {
    const sp = btnViewAllTw.querySelector("span") || btnViewAllTw;
    sp.textContent = isTw ? "縮回全台灣" : "縮回全圖";
  }
  const btnResetSide = document.getElementById("btn-reset-view-side");
  if (btnResetSide) {
    btnResetSide.textContent = isTw ? "🔄 全台灣" : "🔄 全圖";
  }
  const quickZoomGroupLbl = document.getElementById("quick-zoom-group-label");
  if (quickZoomGroupLbl) {
    quickZoomGroupLbl.textContent = isTw ? "📍 點選已解鎖縣市定位：" : `📍 點選${unitLabels.group}定位：`;
  }
  const btnRandomOne = document.getElementById("btn-scope-random-one");
  if (btnRandomOne) {
    btnRandomOne.textContent = `🎲 隨機單一${unitLabels.group}`;
  }

  const scopeSummaryEl = document.getElementById("scope-summary-label");
  if (scopeSummaryEl && state.regionQuizEnabled && !state.stationQuizEnabled) {
    const scopeCount = typeof getScopeTowns === "function" ? getScopeTowns().length : items.length;
    if (scopeCount === items.length && items.length > 0) {
      scopeSummaryEl.textContent = unitLabels.fullScopeLabel || `全部 ${items.length} ${unitLabels.itemShort}`;
    }
  }

  // Dynamically rebuild region suffix quick buttons when pack.features.quickSuffixes differs
  const suffixGroup = document.getElementById("suffix-quick-group");
  if (suffixGroup && typeof suffixGroup.querySelectorAll === "function") {
    const desiredSuffixes = Array.isArray(features.quickSuffixes) ? features.quickSuffixes : [];
    const existingRegionBtns = Array.from(suffixGroup.querySelectorAll('.suffix-quick-btn[data-suffix-topic="region"]'));
    const currentSuffixes = existingRegionBtns.map((b) => b.getAttribute("data-suffix"));
    const isSame =
      currentSuffixes.length === desiredSuffixes.length &&
      currentSuffixes.every((val, idx) => val === desiredSuffixes[idx]);
    if (!isSame) {
      const alwaysBtns = Array.from(suffixGroup.querySelectorAll('.suffix-quick-btn[data-suffix-topic="always"]'));
      const otherTopicBtns = Array.from(suffixGroup.querySelectorAll(".suffix-quick-btn")).filter((b) => {
        const t = b.getAttribute("data-suffix-topic");
        return t && t !== "always" && t !== "region";
      });
      const newRegionBtns = desiredSuffixes.map((suf) => {
        const b = document.createElement("button");
        b.type = "button";
        b.setAttribute("data-suffix", suf);
        b.setAttribute("data-suffix-topic", "region");
        b.className = "suffix-quick-btn px-1.5 py-1 rounded-lg text-[11px] font-bold text-slate-300 hover:text-white";
        b.textContent = suf;
        return b;
      });
      if (alwaysBtns.length > 0 || otherTopicBtns.length > 0) {
        suffixGroup.replaceChildren(...alwaysBtns, ...newRegionBtns, ...otherTopicBtns);
      } else {
        existingRegionBtns.forEach((b) => {
          if (typeof b.remove === "function") b.remove();
        });
        newRegionBtns.forEach((b) => suffixGroup.appendChild(b));
      }
    }
  }
}

function setSettingsTab(tabKey) {
  state.settingsTab = tabKey === "advanced" ? "advanced" : "simple";
  const isAdv = state.settingsTab === "advanced";

  const simplePane = document.getElementById("settings-pane-simple");
  const advPane = document.getElementById("settings-pane-advanced");
  if (simplePane) simplePane.classList.toggle("hidden", isAdv);
  if (advPane) advPane.classList.toggle("hidden", !isAdv);

  document.querySelectorAll(".settings-tab-btn").forEach((btn) => {
    const isCur = btn.getAttribute("data-settings-tab") === state.settingsTab;
    btn.className = isCur
      ? "settings-tab-btn px-3 sm:px-4 py-1 rounded-xl text-xs font-extrabold transition bg-sky-500 text-slate-950 shadow"
      : "settings-tab-btn px-3 sm:px-4 py-1 rounded-xl text-xs font-extrabold transition text-slate-300 hover:text-white";
  });

  syncConfigButtonsUI();
  syncPresetButtonsUI();
}

function syncConfigButtonsUI() {
  if (typeof syncLegacyQuizTargetMode === "function") syncLegacyQuizTargetMode();
  const features = _getActivePackFeatures();
  const supportsTransport = Boolean(features.supportsTransportQuiz);
  const supportsPoi = Boolean(features.supportsPoiQuiz);
  const supportsCapital = Boolean(features.supportsCapitalQuiz);
  const hasR = Boolean(state.regionQuizEnabled);
  const hasS = supportsTransport && Boolean(state.stationQuizEnabled);
  const hasA = supportsPoi && Boolean(state.airportQuizEnabled);
  const hasP = supportsPoi && Boolean(state.portQuizEnabled);
  const hasRes = supportsPoi && Boolean(state.reservoirQuizEnabled);
  const hasLk = supportsPoi && Boolean(state.lakeQuizEnabled);
  const hasStl = supportsPoi && Boolean(state.settlementQuizEnabled);
  const hasCap = supportsCapital && Boolean(state.capitalQuizEnabled);

  const topicMap = { region: hasR, station: hasS, airport: hasA, port: hasP, reservoir: hasRes, lake: hasLk, settlement: hasStl, capital: hasCap };

  document.querySelectorAll(".topic-chip-btn").forEach((card) => {
    const t = card.getAttribute("data-topic");
    const isOn = Boolean(topicMap[t]);
    card.setAttribute("data-state", isOn ? "on" : "off");
    const unionBtn = card.querySelector(".geo-union-btn");
    if (unionBtn) unionBtn.setAttribute("aria-checked", isOn ? "true" : "false");
    const chk = card.querySelector(".topic-check");
    if (chk) chk.textContent = isOn ? "✓" : "+";
  });

  const regSec = document.getElementById("scope-region-section");
  const stSec = document.getElementById("scope-station-section");
  const apSec = document.getElementById("scope-airport-section");
  const ptSec = document.getElementById("scope-port-section");
  const resSec = document.getElementById("scope-reservoir-section");
  const lkSec = document.getElementById("scope-lake-section");
  const stlSec = document.getElementById("scope-settlement-section");
  const simpleRegBox = document.getElementById("simple-region-box");
  const simpleStBox = document.getElementById("simple-station-box");
  const simpleApBox = document.getElementById("simple-airport-box");
  const simplePtBox = document.getElementById("simple-port-box");
  const simpleResBox = document.getElementById("simple-reservoir-box");
  const simpleLkBox = document.getElementById("simple-lake-box");
  const simpleStlBox = document.getElementById("simple-settlement-box");

  if (regSec) regSec.classList.toggle("hidden", !hasR);
  if (stSec) stSec.classList.toggle("hidden", !hasS);
  if (apSec) apSec.classList.toggle("hidden", !hasA);
  if (ptSec) ptSec.classList.toggle("hidden", !hasP);
  if (resSec) resSec.classList.toggle("hidden", !hasRes);
  if (lkSec) lkSec.classList.toggle("hidden", !hasLk);
  if (stlSec) stlSec.classList.toggle("hidden", !hasStl);
  if (simpleRegBox) simpleRegBox.classList.toggle("hidden", !hasR);
  if (simpleStBox) simpleStBox.classList.toggle("hidden", !hasS);
  if (simpleApBox) simpleApBox.classList.toggle("hidden", !hasA);
  if (simplePtBox) simplePtBox.classList.toggle("hidden", !hasP);
  if (simpleResBox) simpleResBox.classList.toggle("hidden", !hasRes);
  if (simpleLkBox) simpleLkBox.classList.toggle("hidden", !hasLk);
  if (simpleStlBox) simpleStlBox.classList.toggle("hidden", !hasStl);

  const showRegionFilterSwitch = hasR && (hasS || hasA || hasP || hasRes || hasLk || hasStl || hasCap);
  const mixedSwitchBar = document.getElementById("mixed-region-rail-switch-bar");
  const wrapSimpleFilter = document.getElementById("wrap-simple-filter-st-region");
  const wrapAdvFilter = document.getElementById("wrap-adv-filter-st-region");
  if (mixedSwitchBar) mixedSwitchBar.classList.toggle("hidden", !showRegionFilterSwitch);
  if (wrapSimpleFilter) wrapSimpleFilter.classList.toggle("hidden", !hasR);
  if (wrapAdvFilter) wrapAdvFilter.classList.toggle("hidden", !hasR);

  // Sync Airport, Port, Reservoir & Lake Subtype Pills (counts + active visual state + deduplicated totals)
  if (typeof countPoisBySubType === "function" && typeof countUniquePoisForSubTypes === "function") {
    const applyReg = Boolean(state.filterStationsByRegion && hasR);
    document.querySelectorAll(".poi-subtype-btn").forEach((card) => {
      const cat = card.getAttribute("data-poi-cat");
      const sub = card.getAttribute("data-poi-sub");
      const activeSet = typeof getEnabledSubTypesForCategory === "function" ? getEnabledSubTypesForCategory(cat) : null;
      const isOn = Boolean(activeSet && activeSet.has(sub));
      const cnt = countPoisBySubType(cat, sub, applyReg);
      card.setAttribute("data-state", isOn ? "on" : "off");
      const unionBtn = card.querySelector(".geo-union-btn");
      if (unionBtn) unionBtn.setAttribute("aria-checked", isOn ? "true" : "false");
      const stateEl = card.querySelector(".poi-sub-state");
      if (stateEl) stateEl.textContent = isOn ? "✓" : "+";
      const cntEl = card.querySelector(".poi-sub-count");
      if (cntEl) cntEl.textContent = String(cnt);
    });

    const apUnique = countUniquePoisForSubTypes("airport", state.airportSubTypes, applyReg);
    const ptUnique = countUniquePoisForSubTypes("port", state.portSubTypes, applyReg);
    const resUnique = countUniquePoisForSubTypes("reservoir", state.reservoirSubTypes, applyReg);
    const lkUnique = countUniquePoisForSubTypes("lake", state.lakeSubTypes, applyReg);
    const stlUnique = countUniquePoisForSubTypes("settlement", state.settlementSubTypes, applyReg);
    ["simple-airport-total-badge", "adv-airport-total-badge"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = `去重總計：${apUnique} 座`;
    });
    ["simple-port-total-badge", "adv-port-total-badge"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = `去重總計：${ptUnique} 座`;
    });
    ["simple-reservoir-total-badge", "adv-reservoir-total-badge"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = `已選：${resUnique} 座`;
    });
    ["simple-lake-total-badge", "adv-lake-total-badge"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = `已選：${lkUnique} 座`;
    });
    ["simple-settlement-total-badge", "adv-settlement-total-badge"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = `已選：${stlUnique} 處`;
    });

    const advHint = document.getElementById("simple-port-adv-hint");
    if (advHint) {
      const advOn = ["fishery_cat2", "fishery_cat2_other", "industrial", "petro_lng"]
        .filter((k) => state.portSubTypes && state.portSubTypes.has(k))
        .map((k) => (getPoiSubTypeMeta("port", k) || {}).shortLabel || k);
      advHint.textContent = advOn.length > 0 ? `已含進階港類：${advOn.join("、")}` : "";
      advHint.classList.toggle("hidden", advOn.length === 0);
    }
    const resAdvHint = document.getElementById("simple-reservoir-adv-hint");
    if (resAdvHint) {
      const advOn = ["res_other", "res_offshore"]
        .filter((k) => state.reservoirSubTypes && state.reservoirSubTypes.has(k))
        .map((k) => (getPoiSubTypeMeta("reservoir", k) || {}).shortLabel || k);
      resAdvHint.textContent = advOn.length > 0 ? `已含進階水庫：${advOn.join("、")}` : "";
      resAdvHint.classList.toggle("hidden", advOn.length === 0);
    }
    const lkAdvHint = document.getElementById("simple-lake-adv-hint");
    if (lkAdvHint) {
      const hasAlpine = Boolean(state.lakeSubTypes && state.lakeSubTypes.has("lake_alpine"));
      lkAdvHint.textContent = hasAlpine ? "已含高山秘境湖泊" : "";
      lkAdvHint.classList.toggle("hidden", !hasAlpine);
    }
    const stlAdvHint = document.getElementById("simple-settlement-adv-hint");
    if (stlAdvHint) {
      const hasHist = Boolean(state.settlementSubTypes && state.settlementSubTypes.has("historic_oaza"));
      stlAdvHint.textContent = hasHist ? "已含歷史大字與傳統部落" : "";
      stlAdvHint.classList.toggle("hidden", !hasHist);
    }
  }

  ["chk-mixed-filter-station-region", "chk-simple-filter-station-region", "chk-adv-filter-station-region"].forEach((cid) => {
    const el = document.getElementById(cid);
    if (el) el.checked = Boolean(state.filterStationsByRegion);
  });

  const supportedDiffs = new Set(
    Array.isArray(features.supportedDifficulties) && features.supportedDifficulties.length > 0
      ? features.supportedDifficulties
      : ["casual"]
  );
  const diffCard = document.getElementById("difficulty-selector-card");
  if (diffCard) {
    diffCard.classList.toggle("hidden", supportedDiffs.size <= 1);
  }
  const diffGrid = document.getElementById("difficulty-buttons-grid");
  if (diffGrid) {
    diffGrid.className =
      supportedDiffs.size === 2
        ? "grid grid-cols-2 gap-1.5"
        : "grid grid-cols-2 sm:grid-cols-5 gap-1.5";
  }
  document.querySelectorAll(".diff-btn").forEach((btn) => {
    const d = btn.getAttribute("data-diff");
    const isCurrent = d === state.difficulty;
    const isHidden = !supportedDiffs.has(d);
    const spanClass = d === "master_hierarchy" && supportedDiffs.size > 2 ? " col-span-2 sm:col-span-1" : "";
    const hiddenClass = isHidden ? " hidden" : "";
    btn.className = isCurrent
      ? `diff-btn p-2 rounded-xl border transition bg-sky-500/25 border-sky-400 text-white text-center shadow${spanClass}${hiddenClass}`
      : `diff-btn p-2 rounded-xl border border-slate-700/80 bg-slate-900/60 hover:bg-slate-800 text-slate-300 transition text-center${spanClass}${hiddenClass}`;
  });

  document.querySelectorAll(".playmode-btn").forEach((btn) => {
    const isCurrent = btn.getAttribute("data-playmode") === state.playMode;
    btn.className = isCurrent
      ? "playmode-btn px-2.5 py-1 rounded-xl text-[11px] font-bold border transition bg-emerald-500/20 border-emerald-400 text-emerald-200"
      : "playmode-btn px-2.5 py-1 rounded-xl text-[11px] font-bold border border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800";
  });

  const satPanel = document.getElementById("satellite-quiz-options-panel");
  if (satPanel) {
    satPanel.classList.toggle("hidden", state.playMode !== "satellite_quiz");
  }
  document.querySelectorAll(".satellite-style-btn").forEach((btn) => {
    const st = btn.getAttribute("data-sat-style");
    const isCur = st === (state.satelliteStyle || "day");
    btn.className = isCur
      ? "satellite-style-btn px-2 py-0.5 rounded-lg text-[11px] font-bold border transition bg-sky-500/25 border-sky-400 text-sky-200 shadow"
      : "satellite-style-btn px-2 py-0.5 rounded-lg text-[11px] font-bold border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 transition";
  });
  const chkSatLock = document.getElementById("chk-satellite-lock-viewport");
  if (chkSatLock) {
    chkSatLock.checked = Boolean(state.satelliteLockViewport);
  }
  const satNightNotice = document.getElementById("satellite-night-town-notice");
  if (satNightNotice) {
    const showNotice =
      state.playMode === "satellite_quiz" &&
      state.difficulty !== "county_only" &&
      (state.satelliteStyle === "night" || state.satelliteStyle === "hybrid");
    satNightNotice.classList.toggle("hidden", !showNotice);
  }

  const pinPanel = document.getElementById("pindrop-quiz-options-panel");
  if (pinPanel) {
    pinPanel.classList.toggle("hidden", state.playMode !== "pin_drop");
  }
  document.querySelectorAll(".pindrop-rounds-btn").forEach((btn) => {
    const r = parseInt(btn.getAttribute("data-pindrop-rounds"), 10);
    const isCur = r === (Number.isFinite(Number(state.pinDropRounds)) ? Number(state.pinDropRounds) : 10);
    btn.className = isCur
      ? "pindrop-rounds-btn px-2 py-0.5 rounded-lg text-[11px] font-bold border transition bg-amber-500/25 border-amber-400 text-amber-200 shadow"
      : "pindrop-rounds-btn px-2 py-0.5 rounded-lg text-[11px] font-bold border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 transition";
  });
  document.querySelectorAll(".pindrop-layer-btn").forEach((btn) => {
    const lk = btn.getAttribute("data-pindrop-layer");
    const isCur = lk === (state.pinDropBaseLayer || "satellite");
    btn.className = isCur
      ? "pindrop-layer-btn px-2 py-0.5 rounded-lg text-[11px] font-bold border transition bg-sky-500/25 border-sky-400 text-sky-200 shadow"
      : "pindrop-layer-btn px-2 py-0.5 rounded-lg text-[11px] font-bold border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 transition";
  });
  const chkPinLockLayer = document.getElementById("chk-pindrop-lock-layer");
  if (chkPinLockLayer) {
    chkPinLockLayer.checked = Boolean(state.pinDropLockBaseLayer);
  }
  const chkPinTargetOutline = document.getElementById("chk-pindrop-show-target-outline");
  if (chkPinTargetOutline) {
    chkPinTargetOutline.checked = state.pinDropShowTargetOutline !== false;
  }
  const chkPinBorders = document.getElementById("chk-pindrop-show-borders");
  if (chkPinBorders) {
    chkPinBorders.checked = Boolean(state.pinDropShowBorders);
  }
  const chkPinHide = document.getElementById("chk-pindrop-hide-guessed");
  if (chkPinHide) {
    chkPinHide.checked = state.pinDropHideGuessed !== false;
  }
  const chkPinHideCounty = document.getElementById("chk-pindrop-hide-county");
  if (chkPinHideCounty) {
    chkPinHideCounty.checked = Boolean(state.pinDropHideCounty);
  }
  const chkPinRush = document.getElementById("chk-pindrop-countdown-rush");
  if (chkPinRush) {
    chkPinRush.checked = Boolean(state.questionCountdownEnabled);
  }
  const chkPinBonus = document.getElementById("chk-pindrop-countdown-bonus");
  if (chkPinBonus) {
    chkPinBonus.checked = state.pinDropCountdownBonus !== false;
  }
  const pinSecRow = document.getElementById("pindrop-countdown-sec-row");
  if (pinSecRow) {
    pinSecRow.classList.toggle("hidden", !state.questionCountdownEnabled);
  }

  const targetOptPanel = document.getElementById("target-quiz-options-panel");
  const isTargetQuizMode = state.playMode === "target_random" || state.playMode === "satellite_quiz";
  if (targetOptPanel) {
    targetOptPanel.classList.toggle("hidden", !isTargetQuizMode);
  }
  const curLimit = Math.max(0, parseInt(state.targetQuestionLimit, 10) || 0);
  document.querySelectorAll(".target-limit-btn").forEach((btn) => {
    const lim = parseInt(btn.getAttribute("data-target-limit"), 10);
    const isCur = lim === curLimit;
    btn.className = isCur
      ? "target-limit-btn px-2 py-0.5 rounded-lg text-[11px] font-bold border transition bg-emerald-500/25 border-emerald-400 text-emerald-200 shadow"
      : "target-limit-btn px-2 py-0.5 rounded-lg text-[11px] font-bold border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 transition";
  });
  const limitInput = document.getElementById("input-target-question-limit");
  if (limitInput && document.activeElement !== limitInput) {
    limitInput.value = String(curLimit);
  }
  const chkAllowPass = document.getElementById("chk-allow-pass");
  if (chkAllowPass) {
    chkAllowPass.checked = state.allowPass !== false;
  }
  const chkTargetHide = document.getElementById("chk-target-hide-guessed");
  if (chkTargetHide) {
    chkTargetHide.checked = Boolean(state.hideGuessedOthers);
  }
  const chkTargetRush = document.getElementById("chk-target-countdown-rush");
  if (chkTargetRush) {
    chkTargetRush.checked = Boolean(state.questionCountdownEnabled);
  }
  const targetSecRow = document.getElementById("target-countdown-sec-row");
  if (targetSecRow) {
    targetSecRow.classList.toggle("hidden", !state.questionCountdownEnabled);
  }
  const curQcdSec = Math.max(3, parseInt(state.questionCountdownSec, 10) || 15);
  document.querySelectorAll(".question-countdown-sec-btn").forEach((btn) => {
    const sec = parseInt(btn.getAttribute("data-qcd-sec"), 10);
    const isCur = sec === curQcdSec;
    btn.className = isCur
      ? "question-countdown-sec-btn px-2 py-0.5 rounded-lg text-[11px] font-bold border transition bg-emerald-500/25 border-emerald-400 text-emerald-200 shadow"
      : "question-countdown-sec-btn px-2 py-0.5 rounded-lg text-[11px] font-bold border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 transition";
  });

  // Target hints toggle is ONLY relevant in target_random / target_click / satellite_quiz!
  const showTargetHintsToggle =
    state.playMode === "target_random" ||
    state.playMode === "target_click" ||
    state.playMode === "satellite_quiz";
  const wrapTargetHints = document.getElementById("wrap-allow-target-hints");
  if (wrapTargetHints) {
    wrapTargetHints.classList.toggle("hidden", !showTargetHintsToggle);
  }
  ["chk-allow-target-hints", "chk-room-allow-target-hints"].forEach((cid) => {
    const el = document.getElementById(cid);
    if (el) el.checked = Boolean(state.allowTargetHints);
  });

  if (typeof updateSuffixControlsUI === "function") updateSuffixControlsUI();

  // Compact 2-pill Timer Toggle + expandable countdown duration pills
  const isCountdown = state.timerMode === "down";
  const countdownOpts = document.getElementById("timer-countdown-options");
  if (countdownOpts) {
    countdownOpts.classList.toggle("hidden", !isCountdown);
  }
  const countdownToggleBtn = document.getElementById("btn-timer-mode-countdown");
  if (countdownToggleBtn) {
    countdownToggleBtn.className = isCountdown
      ? "py-1 px-2.5 rounded-lg text-[11px] font-bold border border-sky-400 bg-sky-500/20 text-white text-center transition"
      : "py-1 px-2.5 rounded-lg text-[11px] font-bold border border-transparent text-slate-300 hover:text-white text-center transition";
  }
  document.querySelectorAll(".hub-timer-btn").forEach((btn) => {
    const tMode = btn.getAttribute("data-timermode");
    const tSec = parseInt(btn.getAttribute("data-sec"), 10) || 0;
    const isCurrent =
      (state.timerMode === "up" && tMode === "up") ||
      (state.timerMode === "down" && tMode === "down" && state.countdownTotalSec === tSec);
    if (tMode === "up") {
      btn.className = isCurrent
        ? "hub-timer-btn py-1 px-2.5 rounded-lg text-[11px] font-bold border border-sky-400 bg-sky-500/20 text-white text-center transition"
        : "hub-timer-btn py-1 px-2.5 rounded-lg text-[11px] font-bold border border-transparent text-slate-300 hover:text-white text-center transition";
    } else {
      btn.className = isCurrent
        ? "hub-timer-btn py-1 px-2 rounded-lg text-[11px] font-bold border border-sky-400 bg-sky-500/20 text-white text-center transition"
        : "hub-timer-btn py-1 px-2 rounded-lg text-[11px] font-bold border border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800 text-center transition";
    }
  });

  syncPackOptionsUI();
  syncScopeDrawerSummaryUI();
  updateSettingsHelpPopoverContent();
}

function setDifficulty(diff) {
  const features = _getActivePackFeatures();
  if (
    Array.isArray(features.supportedDifficulties) &&
    features.supportedDifficulties.length > 0 &&
    !features.supportedDifficulties.includes(diff)
  ) {
    syncConfigButtonsUI();
    return;
  }
  if (!canLocalModifyGameConfig()) {
    setFeedback("🔒 僅房主可調整難度！", "error");
    playTone("error");
    syncConfigButtonsUI();
    return;
  }
  if (state.isHost && state.roomCode) {
    if (diff === state.difficulty) return;
    requestOrApplyConfigChange({ difficulty: diff }, "挑戰難度");
    return;
  }
  state.difficulty = diff;
  syncConfigButtonsUI();
  updateModeBadgeText();
  resetGame();
  if (typeof renderRoomConciseSettingsSummary === "function") renderRoomConciseSettingsSummary();
  if (state.isHost && state.roomCode) {
    onHostSettingChange("挑戰難度");
  }
}

function setPlayMode(pm) {
  if (pm === "pin_drop" && (state.roomCode || state.roomId)) {
    setFeedback("📍 標座標模式目前僅支援單人遊玩！", "warn");
    playTone("error");
    syncConfigButtonsUI();
    return;
  }
  if (!canLocalModifyGameConfig()) {
    setFeedback("🔒 僅房主可調整出題方式！", "error");
    playTone("error");
    syncConfigButtonsUI();
    return;
  }
  if (state.isHost && state.roomCode) {
    if (pm === state.playMode) return;
    requestOrApplyConfigChange({ playMode: pm }, "出題方式");
    return;
  }
  const prevPlayMode = state.playMode;
  state.playMode = pm;
  state.targetId = null;
  state.targetStationKey = null;
  state.targetPoiId = null;
  state.hintLevel = 0;
  state.satelliteOutlineRevealed = false;
  if (prevPlayMode === "pin_drop" && pm !== "pin_drop" && typeof restorePinDropEnvironment === "function") {
    restorePinDropEnvironment();
  }
  if (pm !== "satellite_quiz" && typeof clearSatelliteTargetMarker === "function") {
    clearSatelliteTargetMarker();
  }
  if (prevPlayMode === "satellite_quiz" && pm !== "satellite_quiz") {
    _unlockMapViewportToPack({ restoreLayers: true, clearMarker: true });
  }
  syncConfigButtonsUI();
  updateModeBadgeText();
  if (pm === "pin_drop" && typeof startPinDropGame === "function") {
    startPinDropGame();
  } else if (pm === "target_random" || pm === "satellite_quiz") {
    pickNextTargetRegion();
  } else {
    if (typeof updateRoadAndRailwayTileOverlays === "function") updateRoadAndRailwayTileOverlays();
    updateTargetBannerUI();
    refreshAllPolygonStyles();
  }
  if (typeof renderRoomConciseSettingsSummary === "function") renderRoomConciseSettingsSummary();
  if (state.isHost && state.roomCode) {
    onHostSettingChange("出題方式");
  }
}

function setTargetQuestionLimit(val) {
  const parsed = Math.max(0, Math.min(999, parseInt(val, 10) || 0));
  if (!canLocalModifyGameConfig()) {
    setFeedback("🔒 僅房主可調整題數限制！", "error");
    playTone("error");
    syncConfigButtonsUI();
    return;
  }
  const prevLimit = Math.max(0, parseInt(state.targetQuestionLimit, 10) || 0);
  // N-question mode defaults to hiding already-guessed blocks; returning to 0 (全部) defaults to showing them
  let nextHideGuessed = Boolean(state.hideGuessedOthers);
  if (prevLimit === 0 && parsed > 0) {
    nextHideGuessed = true;
  } else if (prevLimit > 0 && parsed === 0) {
    nextHideGuessed = false;
  }

  if (state.isHost && state.roomCode) {
    if (parsed === prevLimit && nextHideGuessed === Boolean(state.hideGuessedOthers)) return;
    requestOrApplyConfigChange(
      { targetQuestionLimit: parsed, hideGuessedOthers: nextHideGuessed },
      "題數限制"
    );
    return;
  }
  state.targetQuestionLimit = parsed;
  state.hideGuessedOthers = nextHideGuessed;
  syncConfigButtonsUI();
  if (state.playMode === "target_random" || state.playMode === "satellite_quiz") {
    resetGame();
  } else {
    if (typeof refreshAllPolygonStyles === "function") refreshAllPolygonStyles();
    if (typeof renderSmartLabelsAndLeaderLines === "function") renderSmartLabelsAndLeaderLines();
  }
  if (typeof renderRoomConciseSettingsSummary === "function") renderRoomConciseSettingsSummary();
}

function setQuestionCountdownEnabled(enabled) {
  const nextVal = Boolean(enabled);
  if (!canLocalModifyGameConfig()) {
    setFeedback("🔒 僅房主可調整倒數搶答設定！", "error");
    playTone("error");
    syncConfigButtonsUI();
    return;
  }
  if (state.isHost && state.roomCode) {
    if (nextVal === Boolean(state.questionCountdownEnabled)) return;
    requestOrApplyConfigChange({ questionCountdownEnabled: nextVal }, "倒數搶答");
    return;
  }
  state.questionCountdownEnabled = nextVal;
  syncConfigButtonsUI();
  if (nextVal) {
    if (typeof startQuestionCountdown === "function") startQuestionCountdown();
  } else {
    if (typeof stopQuestionCountdown === "function") stopQuestionCountdown();
  }
  if (state.playMode === "pin_drop" && typeof updatePinDropBannerAndDockUI === "function") {
    updatePinDropBannerAndDockUI();
    if (typeof updateScoreAndProgressUI === "function") updateScoreAndProgressUI();
  }
  if (typeof renderRoomConciseSettingsSummary === "function") renderRoomConciseSettingsSummary();
}

function setQuestionCountdownSec(sec) {
  const parsed = Math.max(3, Math.min(120, parseInt(sec, 10) || 15));
  if (!canLocalModifyGameConfig()) {
    setFeedback("🔒 僅房主可調整倒數搶答秒數！", "error");
    playTone("error");
    syncConfigButtonsUI();
    return;
  }
  if (state.isHost && state.roomCode) {
    if (parsed === (parseInt(state.questionCountdownSec, 10) || 15)) return;
    requestOrApplyConfigChange({ questionCountdownSec: parsed }, "搶答秒數");
    return;
  }
  state.questionCountdownSec = parsed;
  syncConfigButtonsUI();
  if (state.questionCountdownEnabled && typeof startQuestionCountdown === "function") {
    startQuestionCountdown();
  }
  if (typeof renderRoomConciseSettingsSummary === "function") renderRoomConciseSettingsSummary();
}

function setAllowPass(allowed) {
  const nextVal = Boolean(allowed);
  if (!canLocalModifyGameConfig()) {
    setFeedback("🔒 僅房主可調整略過 (Pass) 設定！", "error");
    playTone("error");
    syncConfigButtonsUI();
    return;
  }
  if (state.isHost && state.roomCode) {
    if (nextVal === Boolean(state.allowPass)) return;
    requestOrApplyConfigChange({ allowPass: nextVal }, "略過開關");
    return;
  }
  state.allowPass = nextVal;
  syncConfigButtonsUI();
  if (typeof updateTargetBannerUI === "function") updateTargetBannerUI();
  if (typeof renderRoomConciseSettingsSummary === "function") renderRoomConciseSettingsSummary();
}

function setHideGuessedOthers(hidden) {
  const nextVal = Boolean(hidden);
  if (!canLocalModifyGameConfig()) {
    setFeedback("🔒 僅房主可調整隱藏已猜地區設定！", "error");
    playTone("error");
    syncConfigButtonsUI();
    return;
  }
  if (state.isHost && state.roomCode) {
    if (nextVal === Boolean(state.hideGuessedOthers)) return;
    requestOrApplyConfigChange({ hideGuessedOthers: nextVal }, "隱藏已猜地區");
    return;
  }
  state.hideGuessedOthers = nextVal;
  syncConfigButtonsUI();
  if (typeof refreshAllPolygonStyles === "function") refreshAllPolygonStyles();
  if (typeof refreshPoiMapLayer === "function") refreshPoiMapLayer();
  if (typeof updateRoadAndRailwayTileOverlays === "function") updateRoadAndRailwayTileOverlays();
  if (typeof renderSmartLabelsAndLeaderLines === "function") renderSmartLabelsAndLeaderLines();
  if (typeof renderRoomConciseSettingsSummary === "function") renderRoomConciseSettingsSummary();
}

function setSatelliteStyle(styleKey) {
  if (!["day", "night", "hybrid"].includes(styleKey)) return;
  if (!canLocalModifyGameConfig()) {
    setFeedback("🔒 僅房主可調整衛星影像風格！", "error");
    playTone("error");
    syncConfigButtonsUI();
    return;
  }
  if (state.isHost && state.roomCode) {
    if (styleKey === state.satelliteStyle) return;
    requestOrApplyConfigChange({ satelliteStyle: styleKey }, "衛星影像風格");
    return;
  }
  state.satelliteStyle = styleKey;
  syncConfigButtonsUI();
  if (state.playMode === "satellite_quiz") {
    state.satelliteActiveQuestionStyle =
      typeof resolveSatelliteQuestionStyle === "function"
        ? resolveSatelliteQuestionStyle(state.difficulty, state.satelliteStyle)
        : styleKey === "night"
        ? "night"
        : "day";
    if (typeof setMapBaseLayer === "function") {
      setMapBaseLayer(state.satelliteActiveQuestionStyle === "night" ? "satellite_night" : "satellite", true);
    }
    updateTargetBannerUI();
  }
  if (typeof renderRoomConciseSettingsSummary === "function") renderRoomConciseSettingsSummary();
}

function setSatelliteLockViewport(locked) {
  if (!canLocalModifyGameConfig()) {
    setFeedback("🔒 僅房主可調整衛星視野鎖定！", "error");
    playTone("error");
    syncConfigButtonsUI();
    return;
  }
  const nextVal = Boolean(locked);
  if (state.isHost && state.roomCode) {
    if (nextVal === state.satelliteLockViewport) return;
    requestOrApplyConfigChange({ satelliteLockViewport: nextVal }, "衛星視野鎖定");
    return;
  }
  state.satelliteLockViewport = nextVal;
  syncConfigButtonsUI();
  if (state.playMode === "satellite_quiz" && !state.isGameOver) {
    if (!nextVal) {
      _unlockMapViewportToPack({ restoreLayers: false });
    } else if (state.targetId) {
      const pickObj = state.difficulty === "county_only"
        ? _getActivePackGroupByName(state.targetId)
        : _getActivePackItems().find((t) => t.id === state.targetId);
      if (pickObj && typeof applySatelliteTargetViewport === "function") {
        applySatelliteTargetViewport(pickObj);
      }
    }
    updateTargetBannerUI();
  }
  if (typeof renderRoomConciseSettingsSummary === "function") renderRoomConciseSettingsSummary();
}

function updateModeBadgeText() {
  const groups = _getActivePackGroups();
  const unitLabels = _getActivePackUnitLabels();
  const diffNames = {
    casual: "休閒",
    county_only: `${groups.length}${unitLabels.group}`,
    hard_suffix: "後綴",
    hard_full: "困難全名",
    master_hierarchy: "三階困難"
  };
  const pill = document.getElementById("current-mode-pill");
  if (pill) {
    pill.textContent = diffNames[state.difficulty] || "休閒";
  }
}

function countUniqueStationsForLines(lineIdSet, applyRegionFilter = true) {
  if (typeof buildStationsFromLineSet === "function") {
    return buildStationsFromLineSet(lineIdSet, applyRegionFilter).length;
  }
  const seen = new Set();
  TAIWAN_SELECTABLE_LINES.forEach((line) => {
    if (line.isHighway || !lineIdSet.has(line.id)) return;
    line.stations.forEach((st) => {
      const base = cleanStationBaseName(st[0]);
      seen.add(`${line.stKind}_${base}_${st[1].toFixed(2)}_${st[2].toFixed(2)}`);
    });
  });
  return seen.size;
}

// Shared MVC Line Checklist Renderer
function renderLineChecklistView(containerEl, selectedSet, includeHighways, accentTheme, onChangeCallback) {
  if (!containerEl) return;
  containerEl.replaceChildren();

  const groups = new Map();
  TAIWAN_SELECTABLE_LINES.forEach((l) => {
    if (!includeHighways && l.isHighway) return;
    if (!groups.has(l.group)) groups.set(l.group, []);
    groups.get(l.group).push(l);
  });

  const tplGroup = document.getElementById("tpl-line-group-card");
  const tplItem = document.getElementById("tpl-line-check-item");

  groups.forEach((lines, groupTitle) => {
    if (!tplGroup || !tplGroup.content) return;
    const card = tplGroup.content.firstElementChild.cloneNode(true);
    const allChecked = lines.every((l) => selectedSet.has(l.id));

    const gTitleEl = card.querySelector(".group-title");
    const gBtnEl = card.querySelector(".group-toggle-btn");
    const itemsGrid = card.querySelector(".group-items-grid");

    if (gTitleEl) gTitleEl.textContent = `${groupTitle} (${lines.length}線)`;
    if (gBtnEl) {
      gBtnEl.textContent = allChecked ? "取消本類" : "全選本類";
      gBtnEl.className =
        accentTheme === "pink"
          ? "group-toggle-btn text-[11px] text-pink-400 hover:text-pink-300 font-semibold"
          : "group-toggle-btn text-[11px] text-sky-400 hover:text-sky-300 font-semibold";
      gBtnEl.addEventListener("click", () => {
        onChangeCallback(lines.map((l) => l.id), !allChecked);
      });
    }

    if (itemsGrid && tplItem && tplItem.content) {
      lines.forEach((l) => {
        const checked = selectedSet.has(l.id);
        const item = tplItem.content.firstElementChild.cloneNode(true);
        item.className = `flex items-center gap-2 p-1.5 rounded-xl border cursor-pointer transition ${
          checked
            ? accentTheme === "pink"
              ? "bg-pink-500/15 border-pink-400/60 text-white"
              : "bg-slate-800/90 border-sky-500/40 text-white"
            : "bg-slate-950/60 border-slate-800 text-slate-400"
        }`;
        const chk = item.querySelector(".line-chk");
        const dot = item.querySelector(".line-dot");
        const nameSpan = item.querySelector(".line-name");
        const lineTitle = typeof getLineDisplayName === "function" ? getLineDisplayName(l) : l.name;

        if (chk) {
          chk.checked = checked;
          chk.addEventListener("change", (ev) => {
            onChangeCallback([l.id], ev.target.checked);
          });
        }
        if (dot) dot.style.background = l.color;
        if (nameSpan) {
          if (l.isHighway) {
            nameSpan.textContent = lineTitle;
          } else if (
            !includeHighways &&
            typeof shouldFilterStationsByRegion === "function" &&
            shouldFilterStationsByRegion()
          ) {
            const inReg = countUniqueStationsForLines(new Set([l.id]), true);
            nameSpan.textContent = `${lineTitle} (區域內 ${inReg}/${l.stations.length}站)`;
            if (inReg === 0) item.classList.add("opacity-50");
          } else {
            nameSpan.textContent = `${lineTitle} (${l.stations.length}站)`;
          }
        }
        itemsGrid.appendChild(item);
      });
    }
    containerEl.appendChild(card);
  });
}

// ============================================================================
// SIMPLE & ADVANCED PRESET DEFINITIONS
// ============================================================================
const SIMPLE_REGION_MAP = {
  all: () => ALL_TOWNS.map((t) => t.id),
  north: () => ALL_TOWNS.filter((t) => ["臺北市", "新北市", "基隆市", "新竹市", "桃園市", "新竹縣", "宜蘭縣"].includes(t.countyName)).map((t) => t.id),
  central: () => ALL_TOWNS.filter((t) => ["苗栗縣", "臺中市", "彰化縣", "南投縣", "雲林縣"].includes(t.countyName)).map((t) => t.id),
  south: () => ALL_TOWNS.filter((t) => ["嘉義市", "嘉義縣", "臺南市", "高雄市", "屏東縣", "澎湖縣"].includes(t.countyName)).map((t) => t.id),
  east: () => ALL_TOWNS.filter((t) => ["花蓮縣", "臺東縣"].includes(t.countyName)).map((t) => t.id),
  islands: () => ALL_TOWNS.filter((t) => ["澎湖縣", "金門縣", "連江縣"].includes(t.countyName)).map((t) => t.id),
  mountain: () => ALL_TOWNS.filter((t) => TAIWAN_MOUNTAIN_SET.has(t.fullCountyTown)).map((t) => t.id),
  west_plain: () => ALL_TOWNS.filter((t) => TAIWAN_WEST_PLAIN_SET.has(t.fullCountyTown)).map((t) => t.id),
  east_plain: () => ALL_TOWNS.filter((t) => typeof TAIWAN_EAST_PLAIN_SET !== "undefined" && TAIWAN_EAST_PLAIN_SET.has(t.fullCountyTown)).map((t) => t.id),
  west_coast: () => ALL_TOWNS.filter((t) => TAIWAN_WEST_COAST_SET.has(t.fullCountyTown)).map((t) => t.id),
  east_coast: () => ALL_TOWNS.filter((t) => TAIWAN_EAST_COAST_SET.has(t.fullCountyTown)).map((t) => t.id)
};

const SIMPLE_STATION_MAP = {
  tpemrt: () => TAIWAN_SELECTABLE_LINES.filter((l) => !l.isHighway && (l.id.startsWith("mrt_tpe_") || l.id === "mrt_ntpc_y")).map((l) => l.id),
  khmrt: () => TAIWAN_SELECTABLE_LINES.filter((l) => !l.isHighway && l.id.startsWith("mrt_kh_")).map((l) => l.id),
  tcmrt: () => TAIWAN_SELECTABLE_LINES.filter((l) => !l.isHighway && l.id === "mrt_tc_g").map((l) => l.id),
  thsr: () => TAIWAN_SELECTABLE_LINES.filter((l) => !l.isHighway && l.id === "thsr_main").map((l) => l.id),
  tra_coast: () => ["tra_coast"],
  tra_mountain: () => ["tra_mountain"],
  tra_west_main: () => ["tra_west_n", "tra_mountain", "tra_coast", "tra_chengzhui", "tra_west_s", "tra_pingtung"],
  tra_east_main: () => ["tra_yilan", "tra_north_link", "tra_taitung", "tra_south_link"],
  all_main: () =>
    TAIWAN_SELECTABLE_LINES.filter(
      (l) => !l.isHighway && !l.id.startsWith("gon_") && !l.id.startsWith("for_") && !l.id.startsWith("sug_")
    ).map((l) => l.id)
};

function getDefaultStationQuizLines() {
  const traMain = [...SIMPLE_STATION_MAP.tra_west_main(), ...SIMPLE_STATION_MAP.tra_east_main()];
  const allMrt = TAIWAN_SELECTABLE_LINES
    .filter((l) => !l.isHighway && l.id.startsWith("mrt_"))
    .map((l) => l.id);
  return Array.from(new Set([...traMain, ...allMrt]));
}

const REGION_PRESETS = [
  { id: "btn-scope-all", getTownIds: SIMPLE_REGION_MAP.all },
  { id: "btn-scope-west", getTownIds: () => ALL_TOWNS.filter((t) => TAIWAN_WEST_COUNTY_SET.has(t.countyName)).map((t) => t.id) },
  { id: "btn-scope-six", getTownIds: () => ALL_TOWNS.filter((t) => t.isSpecial).map((t) => t.id) },
  { id: "btn-scope-north", getTownIds: SIMPLE_REGION_MAP.north },
  { id: "btn-scope-central", getTownIds: SIMPLE_REGION_MAP.central },
  { id: "btn-scope-south", getTownIds: SIMPLE_REGION_MAP.south },
  { id: "btn-scope-east", getTownIds: SIMPLE_REGION_MAP.east },
  { id: "btn-scope-mountain", getTownIds: SIMPLE_REGION_MAP.mountain },
  { id: "btn-scope-west-plain", getTownIds: SIMPLE_REGION_MAP.west_plain },
  { id: "btn-scope-east-plain", getTownIds: SIMPLE_REGION_MAP.east_plain },
  { id: "btn-scope-west-coast", getTownIds: () => ALL_TOWNS.filter((t) => TAIWAN_WEST_COAST_SET.has(t.fullCountyTown)).map((t) => t.id) },
  { id: "btn-scope-east-coast", getTownIds: () => ALL_TOWNS.filter((t) => TAIWAN_EAST_COAST_SET.has(t.fullCountyTown)).map((t) => t.id) },
  { id: "btn-scope-islands", getTownIds: SIMPLE_REGION_MAP.islands }
];

const STATION_PRESETS = [
  { id: "btn-qst-tpemrt", getLineIds: SIMPLE_STATION_MAP.tpemrt },
  { id: "btn-qst-khmrt", getLineIds: SIMPLE_STATION_MAP.khmrt },
  { id: "btn-qst-tcmrt", getLineIds: SIMPLE_STATION_MAP.tcmrt },
  { id: "btn-qst-tymrt", getLineIds: () => TAIWAN_SELECTABLE_LINES.filter((l) => !l.isHighway && l.id === "mrt_ty_a").map((l) => l.id) },
  { id: "btn-qst-allmrt", getLineIds: () => TAIWAN_SELECTABLE_LINES.filter((l) => !l.isHighway && l.id.startsWith("mrt_")).map((l) => l.id) },
  { id: "btn-qst-lrt", getLineIds: () => TAIWAN_SELECTABLE_LINES.filter((l) => !l.isHighway && l.id.startsWith("lrt_")).map((l) => l.id) },
  { id: "btn-qst-tra-coast", getLineIds: SIMPLE_STATION_MAP.tra_coast },
  { id: "btn-qst-tra-mountain", getLineIds: SIMPLE_STATION_MAP.tra_mountain },
  { id: "btn-qst-tra-west", getLineIds: SIMPLE_STATION_MAP.tra_west_main },
  { id: "btn-qst-tra-east", getLineIds: SIMPLE_STATION_MAP.tra_east_main },
  { id: "btn-qst-tra-branch", getLineIds: () => TAIWAN_SELECTABLE_LINES.filter((l) => !l.isHighway && ["tra_pingxi", "tra_neiwan", "tra_jiji", "tra_shalun", "tra_chengzhui"].includes(l.id)).map((l) => l.id) },
  { id: "btn-qst-tra-all", getLineIds: () => TAIWAN_SELECTABLE_LINES.filter((l) => !l.isHighway && l.id.startsWith("tra_")).map((l) => l.id) },
  { id: "btn-qst-thsr", getLineIds: SIMPLE_STATION_MAP.thsr },
  { id: "btn-qst-main-all", getLineIds: SIMPLE_STATION_MAP.all_main },
  { id: "btn-qst-heritage", getLineIds: () => TAIWAN_SELECTABLE_LINES.filter((l) => !l.isHighway && (l.id.startsWith("for_") || l.id.startsWith("sug_") || l.id.startsWith("gon_"))).map((l) => l.id) },
  { id: "btn-qst-all", getLineIds: () => TAIWAN_SELECTABLE_LINES.filter((l) => !l.isHighway).map((l) => l.id) }
];

function applyRegionScopeSelection(targetTownIds, isMultiSelect = false) {
  if (!canLocalModifyGameConfig()) return;
  const activeItems = _getActivePackEligibleItems();
  if (!(state.selectedTownIds instanceof Set)) {
    state.selectedTownIds = new Set(activeItems.filter((t) => state.selectedCounties.has(t.countyName)).map((t) => t.id));
  }

  let nextTowns;
  if (isMultiSelect) {
    nextTowns = new Set(state.selectedTownIds);
    const allSelected = targetTownIds.length > 0 && targetTownIds.every((id) => nextTowns.has(id));
    if (allSelected) {
      targetTownIds.forEach((id) => nextTowns.delete(id));
    } else {
      targetTownIds.forEach((id) => nextTowns.add(id));
    }
  } else {
    nextTowns = new Set(targetTownIds);
  }

  const nextCounties = new Set(
    activeItems.filter((t) => nextTowns.has(t.id)).map((t) => t.countyName)
  );

  if (state.isHost && state.roomCode) {
    requestOrApplyConfigChange(
      {
        selectedTownIds: Array.from(nextTowns),
        selectedCounties: Array.from(nextCounties)
      },
      "行政區範圍"
    );
    return;
  }

  state.selectedTownIds = nextTowns;
  state.selectedCounties = nextCounties;
  renderScopeModalGrid();
  if (state.isHost && state.roomCode) onHostSettingChange("行政區範圍");
}

function buildDynamicRegionFilterCard(filter, items, isCompact) {
  const card = document.createElement("div");
  card.setAttribute("data-dynamic-region-id", filter.id || "");
  card.setAttribute("data-accent", "sky");
  card.setAttribute("data-state", "off");
  card.className = isCompact
    ? "dynamic-region-preset-btn geo-select-card geo-compact"
    : "dynamic-region-preset-btn geo-select-card";
  if (filter.tip) card.setAttribute("data-tip", filter.tip);

  const soloBtn = document.createElement("button");
  soloBtn.type = "button";
  soloBtn.className = "geo-solo-btn";
  const labelSpan = document.createElement("span");
  if (!isCompact) labelSpan.className = "text-xs font-bold";
  const prefix = filter.emoji ? `${filter.emoji} ` : "";
  labelSpan.textContent = isCompact
    ? (filter.shortLabel || filter.label || filter.id || "")
    : `${prefix}${filter.shortLabel || filter.label || filter.id || ""}`;
  soloBtn.appendChild(labelSpan);

  const unionBtn = document.createElement("button");
  unionBtn.type = "button";
  unionBtn.className = "geo-union-btn";
  unionBtn.setAttribute("role", "checkbox");
  unionBtn.setAttribute("aria-checked", "false");
  const pill = document.createElement("span");
  pill.className = "geo-union-pill";
  pill.textContent = "+";
  unionBtn.appendChild(pill);

  const resolveIds = () =>
    typeof resolveRegionFilterItemIds === "function"
      ? resolveRegionFilterItemIds(filter, items)
      : (Array.isArray(filter.itemIds) ? filter.itemIds : []);

  soloBtn.addEventListener("click", () => applyRegionScopeSelection(resolveIds(), false));
  unionBtn.addEventListener("click", () => applyRegionScopeSelection(resolveIds(), true));

  card.appendChild(soloBtn);
  card.appendChild(unionBtn);
  return card;
}

function renderDynamicRegionFiltersUI() {
  const isTw = _uiIsTaiwanModernPack();
  const simpleTw = document.getElementById("simple-region-tw-grid");
  const simpleDyn = document.getElementById("simple-region-dynamic-grid");
  const advTw = document.getElementById("advanced-region-tw-presets");
  const advDyn = document.getElementById("advanced-region-dynamic-presets");

  if (simpleTw) simpleTw.classList.toggle("hidden", !isTw);
  if (simpleDyn) simpleDyn.classList.toggle("hidden", isTw);
  if (advTw) advTw.classList.toggle("hidden", !isTw);
  if (advDyn) advDyn.classList.toggle("hidden", isTw);

  if (isTw) return;

  const filters = typeof getActiveRegionFilters === "function" ? getActiveRegionFilters() : [];
  const items = _getActivePackEligibleItems();

  if (simpleDyn) {
    const simpleCards = filters.map((f) => buildDynamicRegionFilterCard(f, items, false));
    simpleDyn.replaceChildren(...simpleCards);
  }
  if (advDyn) {
    const advCards = filters.map((f) => buildDynamicRegionFilterCard(f, items, true));
    advDyn.replaceChildren(...advCards);
  }
}

function syncPresetButtonsUI() {
  const activeItems = _getActivePackEligibleItems();
  if (!(state.selectedTownIds instanceof Set)) {
    state.selectedTownIds = new Set(activeItems.filter((t) => state.selectedCounties.has(t.countyName)).map((t) => t.id));
  }

  const syncDualCard = (card, allIn, someIn) => {
    const st = allIn ? "on" : someIn ? "partial" : "off";
    card.setAttribute("data-state", st);
    const unionBtn = card.querySelector(".geo-union-btn");
    if (unionBtn) {
      unionBtn.setAttribute("aria-checked", allIn ? "true" : someIn ? "mixed" : "false");
    }
    const pill = card.querySelector(".geo-union-pill");
    if (pill) {
      pill.textContent = allIn ? "✓" : someIn ? "−" : "+";
    }
  };

  if (_uiIsTaiwanModernPack()) {
    // 1. Sync Simple Region Cards (Taiwan)
    document.querySelectorAll(".simple-region-btn").forEach((card) => {
      const key = card.getAttribute("data-simple-region");
      const fn = SIMPLE_REGION_MAP[key];
      if (!fn) return;
      const townIds = fn();
      const allIn = townIds.length > 0 && townIds.every((id) => state.selectedTownIds.has(id));
      const someIn = townIds.some((id) => state.selectedTownIds.has(id));
      syncDualCard(card, allIn, someIn);
    });

    // 3. Sync Advanced Region Presets (Taiwan)
    REGION_PRESETS.forEach((p) => {
      const card = document.getElementById(p.id);
      if (!card) return;
      const townIds = p.getTownIds();
      const allIn = townIds.length > 0 && townIds.every((id) => state.selectedTownIds.has(id));
      const someIn = townIds.some((id) => state.selectedTownIds.has(id));
      syncDualCard(card, allIn, someIn);
    });
  } else {
    const filters = typeof getActiveRegionFilters === "function" ? getActiveRegionFilters() : [];
    const filterMap = new Map(filters.map((f) => [String(f.id || ""), f]));
    document.querySelectorAll(".dynamic-region-preset-btn[data-dynamic-region-id]").forEach((card) => {
      const f = filterMap.get(card.getAttribute("data-dynamic-region-id") || "");
      if (!f) return;
      const townIds =
        typeof resolveRegionFilterItemIds === "function"
          ? resolveRegionFilterItemIds(f, activeItems)
          : (Array.isArray(f.itemIds) ? f.itemIds : []);
      const allIn = townIds.length > 0 && townIds.every((id) => state.selectedTownIds.has(id));
      const someIn = townIds.some((id) => state.selectedTownIds.has(id));
      syncDualCard(card, allIn, someIn);
    });
  }

  // 2. Sync Simple Station Cards
  if (_getActivePackFeatures().supportsTransportQuiz) {
    document.querySelectorAll(".simple-station-btn").forEach((card) => {
      const key = card.getAttribute("data-simple-station");
      const fn = SIMPLE_STATION_MAP[key];
      if (!fn) return;
      const lineIds = fn();
      const allIn = lineIds.length > 0 && lineIds.every((id) => state.quizStationLines.has(id));
      const someIn = lineIds.some((id) => state.quizStationLines.has(id));
      syncDualCard(card, allIn, someIn);
    });

    // 4. Sync Advanced Station Presets
    STATION_PRESETS.forEach((p) => {
      const card = document.getElementById(p.id);
      if (!card) return;
      const lineIds = p.getLineIds();
      const allIn = lineIds.length > 0 && lineIds.every((id) => state.quizStationLines.has(id));
      const someIn = lineIds.some((id) => state.quizStationLines.has(id));
      syncDualCard(card, allIn, someIn);
    });
  }

  const btnClear = document.getElementById("btn-scope-clear");
  if (btnClear) {
    btnClear.classList.toggle("scope-preset-active", state.selectedTownIds.size === 0);
  }

  const btnQstNone = document.getElementById("btn-qst-none");
  if (btnQstNone) {
    btnQstNone.classList.toggle("scope-preset-active", state.quizStationLines.size === 0);
  }
}

function renderScopeModalGrid() {
  syncConfigButtonsUI();
  renderDynamicRegionFiltersUI();

  const activeGroups = _getActivePackGroups();
  const activeItems = _getActivePackEligibleItems();
  const unitLabels = _getActivePackUnitLabels();
  const features = _getActivePackFeatures();

  const grid = document.getElementById("scope-counties-grid");
  const tplCounty = document.getElementById("tpl-scope-county-btn");
  if (grid && tplCounty && tplCounty.content) {
    grid.replaceChildren();
    if (!(state.selectedTownIds instanceof Set)) {
      state.selectedTownIds = new Set(activeItems.filter((t) => state.selectedCounties.has(t.countyName)).map((t) => t.id));
    }
    activeGroups.forEach((c) => {
      const countyTowns = activeItems.filter((t) => t.countyName === c.name);
      const selectedCount = countyTowns.filter((t) => state.selectedTownIds.has(t.id)).length;
      const allSelected = countyTowns.length > 0 && selectedCount === countyTowns.length;
      const someSelected = selectedCount > 0;

      const btn = tplCounty.content.firstElementChild.cloneNode(true);
      btn.className = allSelected
        ? "p-2 rounded-2xl border border-sky-400 bg-sky-500/20 text-left transition flex items-center justify-between"
        : someSelected
        ? "p-2 rounded-2xl border border-sky-500/50 bg-sky-500/10 text-left transition flex items-center justify-between"
        : "p-2 rounded-2xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-left transition flex items-center justify-between opacity-70";
      const nameEl = btn.querySelector(".county-name");
      const metaEl = btn.querySelector(".county-meta");
      const chkEl = btn.querySelector(".county-check");
      if (nameEl) nameEl.textContent = c.name;
      if (metaEl) {
        const countStr =
          someSelected && !allSelected
            ? `${selectedCount}/${countyTowns.length} ${unitLabels.itemShort}`
            : `${countyTowns.length} ${unitLabels.itemShort}`;
        metaEl.textContent = c.province ? `${c.province} · ${countStr}` : countStr;
      }
      if (chkEl) {
        chkEl.className = `county-check w-4 h-4 rounded-md flex items-center justify-center text-xs ${
          allSelected
            ? "bg-sky-500 text-white"
            : someSelected
            ? "bg-sky-500/60 text-white"
            : "bg-slate-800 text-transparent"
        }`;
        chkEl.textContent = allSelected ? "✓" : someSelected ? "−" : "";
      }
      btn.addEventListener("click", () => {
        if (!canLocalModifyGameConfig()) {
          setFeedback("🔒 僅房主可調整行政區範圍！", "warn");
          return;
        }
        const nextTowns = new Set(state.selectedTownIds);
        if (allSelected) {
          countyTowns.forEach((t) => nextTowns.delete(t.id));
        } else {
          countyTowns.forEach((t) => nextTowns.add(t.id));
        }
        const nextCounties = new Set(activeItems.filter((t) => nextTowns.has(t.id)).map((t) => t.countyName));

        if (state.isHost && state.roomCode) {
          requestOrApplyConfigChange(
            {
              selectedTownIds: Array.from(nextTowns),
              selectedCounties: Array.from(nextCounties)
            },
            "行政區範圍"
          );
          return;
        }
        state.selectedTownIds = nextTowns;
        state.selectedCounties = nextCounties;
        renderScopeModalGrid();
        if (state.isHost && state.roomCode) onHostSettingChange("行政區範圍");
      });
      grid.appendChild(btn);
    });
  }

  const stGrid = document.getElementById("scope-stations-grid");
  const chkTerminusScope = document.getElementById("chk-station-terminus-hints");
  if (chkTerminusScope) chkTerminusScope.checked = Boolean(state.showStationTerminusHints);

  if (features.supportsTransportQuiz) {
    renderLineChecklistView(stGrid, state.quizStationLines, false, "pink", (lineIds, shouldAdd) => {
      if (!canLocalModifyGameConfig()) {
        setFeedback("🔒 僅房主可調整車站題庫路線！", "warn");
        return;
      }
      const nextLines = new Set(state.quizStationLines);
      lineIds.forEach((id) => {
        if (shouldAdd) nextLines.add(id);
        else nextLines.delete(id);
      });
      if (state.isHost && state.roomCode) {
        requestOrApplyConfigChange({ quizStationLines: Array.from(nextLines) }, "車站題庫路線");
        return;
      }
      state.quizStationLines = nextLines;
      state.stationQuizEnabled = state.quizStationLines.size > 0;
      renderScopeModalGrid();
      if (state.isHost && state.roomCode) onHostSettingChange("車站題庫路線");
    });
  }

  const totalTowns = getScopeTowns().length;
  const totalStations = features.supportsTransportQuiz ? countUniqueStationsForLines(state.quizStationLines, true) : 0;
  const unFilteredStations = features.supportsTransportQuiz ? countUniqueStationsForLines(state.quizStationLines, false) : 0;
  const isRegFilterOn = features.supportsTransportQuiz && typeof shouldFilterStationsByRegion === "function" && shouldFilterStationsByRegion();
  const stBadge = document.getElementById("scope-station-status-badge");
  if (stBadge) {
    if (state.quizStationLines.size === 0) {
      stBadge.textContent = "🚫 不猜車站 (0站)";
      stBadge.className = "text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-800 text-slate-400";
    } else if (isRegFilterOn) {
      stBadge.textContent = `🚉 區域內 ${totalStations} / ${unFilteredStations} 站 (${state.quizStationLines.size}線)`;
      stBadge.className = totalStations > 0
        ? "text-[11px] font-bold px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-500/40"
        : "text-[11px] font-bold px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40";
    } else {
      stBadge.textContent = `🚉 已選 ${state.quizStationLines.size} 線 · 共 ${totalStations} 站`;
      stBadge.className = "text-[11px] font-bold px-2 py-0.5 rounded-lg bg-pink-500/20 text-pink-300 border border-pink-500/40";
    }
  }
  const mixedFilterBadge = document.getElementById("mixed-filter-station-badge");
  if (mixedFilterBadge) {
    if (state.filterStationsByRegion) {
      mixedFilterBadge.textContent = totalStations > 0
        ? `📍 已過濾：僅出題所選區域內 ${totalStations} 座車站 (原 ${unFilteredStations} 站)`
        : `⚠️ 所選區域內無已選路線之車站 (0 / ${unFilteredStations} 站)`;
      mixedFilterBadge.className = totalStations > 0
        ? "text-[11px] font-bold px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-400/50"
        : "text-[11px] font-bold px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-200 border border-rose-400/50";
    } else {
      mixedFilterBadge.textContent = `目前：出題所選路線全線車站 (${unFilteredStations} 站)`;
      mixedFilterBadge.className = "text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700";
    }
  }

  const counterEl = document.getElementById("scope-modal-counter");
  const counterParts = [];
  if (state.regionQuizEnabled && state.selectedCounties.size > 0) {
    const singleLayer = typeof isActivePackSingleLayer === "function" && isActivePackSingleLayer();
    counterParts.push(
      singleLayer
        ? `🗺️ ${totalTowns} ${unitLabels.itemShort}`
        : `🗺️ ${state.selectedCounties.size} ${unitLabels.group} (${totalTowns} ${unitLabels.itemShort})`
    );
  }
  if (features.supportsTransportQuiz && state.stationQuizEnabled && state.quizStationLines.size > 0) {
    counterParts.push(`🚉 ${state.quizStationLines.size} 線 (${totalStations} 站)`);
  }
  if (features.supportsPoiQuiz) {
    if (typeof isPoiCategoryActive === "function" && isPoiCategoryActive("airport")) {
      const apCnt = getActiveQuizPois("airport").length;
      counterParts.push(`✈️ 機場 (${apCnt} 座)`);
    }
    if (typeof isPoiCategoryActive === "function" && isPoiCategoryActive("port")) {
      const ptCnt = getActiveQuizPois("port").length;
      counterParts.push(`⚓ 港口 (${ptCnt} 座)`);
    }
    if (typeof isPoiCategoryActive === "function" && isPoiCategoryActive("reservoir")) {
      const resCnt = getActiveQuizPois("reservoir").length;
      counterParts.push(`💧 水庫 (${resCnt} 座)`);
    }
    if (typeof isPoiCategoryActive === "function" && isPoiCategoryActive("lake")) {
      const lkCnt = getActiveQuizPois("lake").length;
      counterParts.push(`🏞️ 湖泊 (${lkCnt} 座)`);
    }
    if (typeof isPoiCategoryActive === "function" && isPoiCategoryActive("settlement")) {
      const stlCnt = getActiveQuizPois("settlement").length;
      counterParts.push(`🪧 傳統聚落 (${stlCnt} 處)`);
    }
  }
  if (features.supportsCapitalQuiz && typeof isPoiCategoryActive === "function" && isPoiCategoryActive("capital")) {
    const capCnt = getActiveQuizPois("capital").length;
    const capLbl = typeof getPoiCategoryLabel === "function" ? getPoiCategoryLabel("capital") : "首都／省會";
    counterParts.push(`🏛️ ${capLbl} (${capCnt} 處)`);
  }
  const fullCounterText = counterParts.length > 0 ? `題庫：${counterParts.join(" ＋ ")}` : "請至少選擇一項題庫";
  if (counterEl) {
    counterEl.textContent = fullCounterText;
  }
  syncPresetButtonsUI();
  if (typeof renderRoomConciseSettingsSummary === "function") {
    renderRoomConciseSettingsSummary();
  }
}

const MODAL_IDS = [
  "modal-join-entry",
  "modal-room",
  "modal-scope",
  "modal-transport",
  "modal-perf",
  "modal-timer",
  "modal-info",
  "modal-settlement",
  "modal-pindrop-summary",
  "modal-opponent-finished",
  "modal-rematch-confirm"
];

function syncModalBodyScrollLock() {
  const anyOpen = MODAL_IDS.some((id) => {
    const el = document.getElementById(id);
    return el && !el.classList.contains("hidden");
  });
  document.body.classList.toggle("modal-open", anyOpen);
}

// Opens the simplified Room Lobby / Create-Join Modal (#modal-room)
function openRoomModal() {
  document.getElementById("modal-scope")?.classList.add("hidden");
  updateP2PLobbyUI();
  syncRoomRestrictionsDrawerUI();
  const modal = document.getElementById("modal-room");
  if (modal) modal.classList.remove("hidden");
  syncModalBodyScrollLock();
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

// Opens the Shared Top-Level Mode & Scope Settings Modal (#modal-scope)
// Defaults to Simple Settings Tab with scope drawer collapsed for a calm progressive-disclosure view!
function openModeSettingsModal(defaultTab = "simple") {
  if (typeof syncLegacyQuizTargetMode === "function") {
    syncLegacyQuizTargetMode();
  }

  setScopeDrawerExpanded(false);
  const helpPop = document.getElementById("settings-help-popover");
  if (helpPop) helpPop.classList.add("hidden");
  const helpBtn = document.getElementById("btn-toggle-settings-help");
  if (helpBtn) helpBtn.setAttribute("aria-expanded", "false");

  setSettingsTab(defaultTab || state.settingsTab || "simple");
  renderScopeModalGrid();
  updateP2PLobbyUI();

  const modal = document.getElementById("modal-scope");
  if (modal) modal.classList.remove("hidden");
  syncModalBodyScrollLock();
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

// Backward-compatible dispatcher: routes "host" / "join" to #modal-room and "solo" to #modal-scope
function openGameHubModal(target = null) {
  if (target === "host" || target === "join") {
    openRoomModal();
    return;
  }
  openModeSettingsModal("simple");
}

function syncP2PRoomAccordionUI() {
  // Maintained as no-op for legacy caller compatibility
}

function toggleP2PRoomPanel() {
  openRoomModal();
}

function openUnlockedAndHelpModal(mode) {
  const modal = document.getElementById("modal-info");
  const title = document.getElementById("modal-info-title");
  const paneList = document.getElementById("info-pane-list");
  const paneHelp = document.getElementById("info-pane-help");
  if (!modal) return;
  modal.classList.remove("hidden");

  if (mode === "list") {
    const vState = typeof getActiveViewState === "function" ? getActiveViewState() : state;
    const unitLabels = _getActivePackUnitLabels();
    const isTw = _uiIsTaiwanModernPack();
    const itemNoun = isTw ? "行政區" : unitLabels.item;
    if (title) {
      title.textContent = vState.spectatingPlayer
        ? `👁️ 【${vState.spectatingPlayer.name}】已解鎖${itemNoun}一覽表`
        : `已解鎖${itemNoun}一覽表 (未解鎖名稱自動隱藏防劇透)`;
    }
    if (paneHelp) paneHelp.classList.add("hidden");
    if (paneList) paneList.classList.remove("hidden");

    const unlockedList = getScopeTowns().filter((t) => vState.unlockedTowns.has(t.id));
    const remainingList = getScopeTowns().filter((t) => !vState.unlockedTowns.has(t.id));

    const uTitle = document.getElementById("unlocked-list-title");
    const uChips = document.getElementById("unlocked-list-chips");
    const rTitle = document.getElementById("remaining-list-title");
    const rChips = document.getElementById("remaining-list-chips");

    if (uTitle) uTitle.textContent = `✅ 已答對 (${unlockedList.length})`;
    if (uChips) {
      uChips.replaceChildren();
      if (unlockedList.length === 0) {
        const sp = document.createElement("span");
        sp.className = "text-slate-400 text-xs";
        sp.textContent = `尚無已解鎖${itemNoun}`;
        uChips.appendChild(sp);
      } else {
        unlockedList.forEach((t) => {
          const sp = document.createElement("span");
          sp.className = "px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-200 text-xs";
          sp.textContent = t.fullHierarchyName || t.fullCountyTown || t.townName;
          uChips.appendChild(sp);
        });
      }
    }

    if (rTitle) rTitle.textContent = `🔒 尚未解鎖剩餘數量：${remainingList.length} ${unitLabels.itemShort}`;
    if (rChips) {
      rChips.replaceChildren();
      if (vState.isGameOver) {
        remainingList.forEach((t) => {
          const sp = document.createElement("span");
          sp.className = "inline-block m-0.5 px-2 py-0.5 rounded bg-rose-500/20 text-rose-200 text-xs";
          sp.textContent = t.fullHierarchyName || t.fullCountyTown || t.townName;
          rChips.appendChild(sp);
        });
      } else {
        rChips.textContent = isTw
          ? "為避免洩漏未解鎖的縣市與鄉鎮答案，遊戲進行中不顯示未解鎖清單；點擊上方「結束看答案」即可全數揭曉。"
          : `為避免洩漏未解鎖的${unitLabels.group}與${unitLabels.item}答案，遊戲進行中不顯示未解鎖清單；點擊上方「結束看答案」即可全數揭曉。`;
      }
    }
  } else {
    if (title) title.textContent = "規則說明、多人房間與操作指南";
    if (paneList) paneList.classList.add("hidden");
    if (paneHelp) paneHelp.classList.remove("hidden");
  }
}

// ============================================================================
// HOVER & TOUCH POPOVER TIP CONTROLLER ([data-tip])
// ============================================================================
function initHoverAndTouchTipSystem() {
  const tipEl = document.getElementById("floating-tip-popover");
  if (!tipEl) return;
  let hideTimer = null;
  let longPressTimer = null;
  let lastTouchTime = 0;

  const showTipForTarget = (target) => {
    if (typeof isPinDropPlacing === "function" && isPinDropPlacing()) return;
    const msg = target.getAttribute("data-tip");
    if (!msg) return;
    if (hideTimer) clearTimeout(hideTimer);
    tipEl.textContent = msg;
    tipEl.classList.remove("hidden");

    const rect = target.getBoundingClientRect();
    const tipRect = tipEl.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - tipRect.width / 2;
    left = Math.max(8, Math.min(window.innerWidth - tipRect.width - 8, left));
    let top = rect.bottom + 8;
    if (top + tipRect.height > window.innerHeight - 8) {
      top = Math.max(8, rect.top - tipRect.height - 8);
    }
    tipEl.style.left = `${Math.round(left)}px`;
    tipEl.style.top = `${Math.round(top)}px`;
  };

  const hideTip = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    tipEl.classList.add("hidden");
  };

  document.addEventListener("mouseover", (e) => {
    if (Date.now() - lastTouchTime < 650) return;
    const el = e.target && e.target.closest ? e.target.closest("[data-tip]") : null;
    if (el) showTipForTarget(el);
  });

  document.addEventListener("mouseout", (e) => {
    if (Date.now() - lastTouchTime < 650) return;
    const el = e.target && e.target.closest ? e.target.closest("[data-tip]") : null;
    if (el) hideTip();
  });

  document.addEventListener(
    "touchstart",
    (e) => {
      lastTouchTime = Date.now();
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      const el = e.target && e.target.closest ? e.target.closest("[data-tip]") : null;
      if (el) {
        longPressTimer = setTimeout(() => {
          showTipForTarget(el);
          hideTimer = setTimeout(hideTip, 2200);
        }, 450);
      } else {
        hideTip();
      }
    },
    { passive: true }
  );

  const cancelLongPress = () => {
    lastTouchTime = Date.now();
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };
  document.addEventListener("touchend", cancelLongPress, { passive: true });
  document.addEventListener("touchmove", cancelLongPress, { passive: true });
  document.addEventListener("touchcancel", cancelLongPress, { passive: true });
}

function bindAllUIEvents() {
  initHoverAndTouchTipSystem();

  // Simple vs Advanced Settings Tab Buttons
  document.querySelectorAll(".settings-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setSettingsTab(btn.getAttribute("data-settings-tab"));
    });
  });

  document.querySelectorAll(".layer-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setMapBaseLayer(btn.getAttribute("data-layer"));
    });
  });

  function setDistrictBordersVisible(visible, forceBypassLock = false) {
    if (
      !forceBypassLock &&
      state.playMode === "satellite_quiz" &&
      !state.isGameOver &&
      state.role !== "spectator" &&
      visible
    ) {
      setFeedback("🛰️ 衛星影像猜題中已隱藏區界，請點擊「👁️ 顯示輪廓」提示！", "warn");
      const chkModalSat = document.getElementById("chk-modal-borders");
      if (chkModalSat) chkModalSat.checked = false;
      return;
    }
    if (!forceBypassLock && state.p2pBorderRule === "force_off" && state.role !== "spectator" && visible) {
      setFeedback("🔒 本場對戰房主已指定「關閉區界」模式，無法開啟區界！", "warn");
      const chkModalLock = document.getElementById("chk-modal-borders");
      if (chkModalLock) chkModalLock.checked = false;
      return;
    }
    state.showDistrictBorders = visible;
    if (state.playMode === "pin_drop" && !forceBypassLock) {
      state.pinDropShowBorders = Boolean(visible);
      if (typeof syncConfigButtonsUI === "function") syncConfigButtonsUI();
    }
    const bBtn = document.getElementById("btn-toggle-borders");
    if (bBtn) {
      const sp = bBtn.querySelector("span") || bBtn;
      sp.textContent = `🗺️ 區界: ${visible ? "開" : "關"}`;
      bBtn.className = visible
        ? "apple-glass-pill px-2 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold text-emerald-300 border border-emerald-500/35 bg-emerald-500/15 hover:bg-emerald-500/25 transition flex items-center gap-1 whitespace-nowrap"
        : "apple-glass-pill px-2 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-medium text-slate-400 border border-slate-700 hover:bg-slate-800 transition flex items-center gap-1 whitespace-nowrap";
    }
    const chkModal = document.getElementById("chk-modal-borders");
    if (chkModal) chkModal.checked = visible;
    if (countyBorderLayerGroup && map) {
      if (visible) {
        if (!map.hasLayer(countyBorderLayerGroup)) countyBorderLayerGroup.addTo(map);
      } else {
        if (map.hasLayer(countyBorderLayerGroup)) map.removeLayer(countyBorderLayerGroup);
      }
    }
    refreshAllPolygonStyles();
  }
  window.setDistrictBordersVisible = setDistrictBordersVisible;

  function renderTransportModalChecklist() {
    const container = document.getElementById("transport-lines-checklist");
    if (!container) return;

    document.querySelectorAll(".tmode-btn").forEach((btn) => {
      const isCur = btn.getAttribute("data-tmode") === state.transportMode;
      btn.className = isCur
        ? "tmode-btn p-2 rounded-xl border border-amber-400 bg-amber-500/20 text-left transition"
        : "tmode-btn p-2 rounded-xl border border-slate-700 bg-slate-900/70 hover:bg-slate-800 text-left transition";
    });

    const chkLegacySt = document.getElementById("chk-enable-legacy-stations-only");
    const btnLegacySt = document.getElementById("btn-tmode-stations-only");
    const tmodeGrid = document.getElementById("transport-mode-grid");
    if (chkLegacySt) chkLegacySt.checked = Boolean(state.enableLegacyStationOnlyMode);
    if (btnLegacySt) btnLegacySt.classList.toggle("hidden", !state.enableLegacyStationOnlyMode);
    if (tmodeGrid) {
      tmodeGrid.className = state.enableLegacyStationOnlyMode
        ? "grid grid-cols-1 sm:grid-cols-4 gap-2"
        : "grid grid-cols-1 sm:grid-cols-3 gap-2";
    }

    const chkHideMrt = document.getElementById("chk-hide-mrt-lines-openrail");
    if (chkHideMrt) chkHideMrt.checked = Boolean(state.hideMrtLinesOnOpenRail);
    const chkRawRail = document.getElementById("chk-raw-rail-tile");
    if (chkRawRail) chkRawRail.checked = Boolean(state.showRawOpenRailwayTile);
    const chkTerminusTrans = document.getElementById("chk-transport-terminus-hints");
    if (chkTerminusTrans) chkTerminusTrans.checked = Boolean(state.showStationTerminusHints);

    renderLineChecklistView(container, state.selectedTransportLines, true, "sky", (lineIds, shouldAdd) => {
      lineIds.forEach((id) => {
        if (shouldAdd) state.selectedTransportLines.add(id);
        else state.selectedTransportLines.delete(id);
      });
      renderTransportModalChecklist();
    });

    const sumEl = document.getElementById("transport-selected-summary");
    if (sumEl) {
      sumEl.textContent = `已勾選 ${state.selectedTransportLines.size} / ${TAIWAN_SELECTABLE_LINES.length} 條路線與系統`;
    }
  }

  document.getElementById("btn-toggle-rail").addEventListener("click", () => {
    const effectiveRailRule = state.role === "spectator" ? "free" : state.p2pRailRule;

    if (effectiveRailRule === "ban_rail") {
      const hasStations = Boolean(state.stationQuizEnabled && state.quizStationLines.size > 0);
      if (hasStations) {
        state.transportMode = state.transportMode === "stations_only" ? "off" : "stations_only";
        updateRoadAndRailwayTileOverlays();
        refreshAllPolygonStyles();
        setFeedback(
          state.transportMode === "stations_only"
            ? "🚉 已開啟「僅車站」模式 (軌道與公路路網已禁用)"
            : "🚫 已關閉路網與車站疊圖",
          "info"
        );
        return;
      }
      setFeedback("🔒 本場對戰房主已禁用 (Ban) 所有路網與車站！", "warn");
      return;
    }
    if (effectiveRailRule === "force_lines" || effectiveRailRule === "force_rail_only") {
      setFeedback("🔒 本場對戰房主已強制鎖定路網模式！", "warn");
      return;
    }
    if (effectiveRailRule === "ban_roads_only") {
      state.transportMode = state.transportMode === "rail_only" ? "off" : "rail_only";
      updateRoadAndRailwayTileOverlays();
      refreshAllPolygonStyles();
      setFeedback(
        state.transportMode === "rail_only"
          ? "🚄 已開啟「純軌道路網」模式 (線路+車站，公路已禁用)"
          : "🚫 已關閉路網與車站疊圖",
        "info"
      );
      return;
    }

    const order = state.enableLegacyStationOnlyMode
      ? ["off", "rail_only", "lines_and_stations", "stations_only"]
      : ["off", "rail_only", "lines_and_stations"];
    const curIdx = order.indexOf(state.transportMode);
    const nextMode = curIdx >= 0 ? order[(curIdx + 1) % order.length] : "off";
    state.transportMode = nextMode;
    updateRoadAndRailwayTileOverlays();
    refreshAllPolygonStyles();
    const modeDesc =
      nextMode === "rail_only"
        ? "🚄 已開啟「純軌道路網」模式 (軌道線路+車站點位)"
        : nextMode === "lines_and_stations"
        ? "🛣️ 已開啟「完整路網」模式 (軌道+車站+公路盾牌)"
        : nextMode === "stations_only"
        ? "📍 已開啟舊版「僅車站」模式"
        : "🚫 已關閉路網與車站疊圖";
    setFeedback(modeDesc, "info");
  });

  const chkLegacySt = document.getElementById("chk-enable-legacy-stations-only");
  const btnLegacySt = document.getElementById("btn-tmode-stations-only");
  const tmodeGrid = document.getElementById("transport-mode-grid");
  if (chkLegacySt) {
    chkLegacySt.addEventListener("change", (e) => {
      state.enableLegacyStationOnlyMode = e.target.checked;
      if (btnLegacySt) btnLegacySt.classList.toggle("hidden", !state.enableLegacyStationOnlyMode);
      if (tmodeGrid) {
        tmodeGrid.className = state.enableLegacyStationOnlyMode
          ? "grid grid-cols-1 sm:grid-cols-4 gap-2"
          : "grid grid-cols-1 sm:grid-cols-3 gap-2";
      }
      if (!state.enableLegacyStationOnlyMode && state.transportMode === "stations_only") {
        state.transportMode = "rail_only";
        renderTransportModalChecklist();
        updateRoadAndRailwayTileOverlays();
        refreshAllPolygonStyles();
      }
    });
  }

  document.getElementById("btn-open-transport-cfg").addEventListener("click", () => {
    const effectiveRailRule = state.role === "spectator" ? "free" : state.p2pRailRule;
    if (effectiveRailRule === "ban_rail") {
      const hasStations = Boolean(state.stationQuizEnabled && state.quizStationLines.size > 0);
      if (!hasStations) {
        setFeedback("🚫 本場對戰已禁用 (Ban) 路網與車站模式！", "warn");
        return;
      }
    }
    renderTransportModalChecklist();
    document.getElementById("modal-transport").classList.remove("hidden");
  });

  document.getElementById("btn-close-transport").addEventListener("click", () => {
    document.getElementById("modal-transport").classList.add("hidden");
  });

  document.getElementById("btn-apply-transport").addEventListener("click", () => {
    document.getElementById("modal-transport").classList.add("hidden");
    if (state.quizTargetMode !== "region" && canLocalModifyGameConfig()) {
      const railSelected = Array.from(state.selectedTransportLines).filter((id) => !id.startsWith("hw_"));
      if (state.transportMode !== "off" && railSelected.length > 0) {
        state.quizStationLines = new Set(railSelected);
        state.stationQuizEnabled = true;
      } else if (state.transportMode === "off") {
        state.stationQuizEnabled = false;
      }
    }
    updateRoadAndRailwayTileOverlays();
    refreshAllPolygonStyles();
    updateScoreAndProgressUI();
  });

  document.querySelectorAll(".tmode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.transportMode = btn.getAttribute("data-tmode");
      renderTransportModalChecklist();
      updateRoadAndRailwayTileOverlays();
      refreshAllPolygonStyles();
    });
  });

  document.getElementById("btn-toggle-borders").addEventListener("click", () => {
    setDistrictBordersVisible(!state.showDistrictBorders);
  });

  document.getElementById("chk-modal-borders").addEventListener("change", (e) => {
    setDistrictBordersVisible(e.target.checked);
  });

  document.getElementById("chk-show-station-names").addEventListener("change", (e) => {
    state.showStationNames = e.target.checked;
    updateRoadAndRailwayTileOverlays();
  });

  const chkHideMrt = document.getElementById("chk-hide-mrt-lines-openrail");
  if (chkHideMrt) {
    chkHideMrt.addEventListener("change", (e) => {
      state.hideMrtLinesOnOpenRail = e.target.checked;
      updateRoadAndRailwayTileOverlays();
    });
  }

  const handleTerminusToggle = (checked) => {
    if (!canLocalModifyGameConfig()) return;
    if (state.isHost && state.roomCode) {
      requestOrApplyConfigChange({ showStationTerminusHints: checked }, "頭尾端點站提示");
      return;
    }
    state.showStationTerminusHints = checked;
    const c1 = document.getElementById("chk-station-terminus-hints");
    const c2 = document.getElementById("chk-transport-terminus-hints");
    if (c1) c1.checked = checked;
    if (c2) c2.checked = checked;
    renderScopeModalGrid();
    renderTransportModalChecklist();
    if (typeof updateRoadAndRailwayTileOverlays === "function") updateRoadAndRailwayTileOverlays();
    if (state.targetStationKey && typeof updateTargetBannerUI === "function") updateTargetBannerUI();
    if (state.isHost && state.roomCode) onHostSettingChange("頭尾端點站提示");
  };

  document.getElementById("chk-station-terminus-hints")?.addEventListener("change", (e) => handleTerminusToggle(e.target.checked));
  document.getElementById("chk-transport-terminus-hints")?.addEventListener("change", (e) => handleTerminusToggle(e.target.checked));

  const handleFilterStationsByRegionToggle = (checked) => {
    if (!canLocalModifyGameConfig()) {
      setFeedback("🔒 僅房主可調整區域鐵道過濾設定！", "warn");
      syncConfigButtonsUI();
      return;
    }
    if (state.isHost && state.roomCode) {
      requestOrApplyConfigChange({ filterStationsByRegion: checked }, "區域鐵道過濾");
      return;
    }
    state.filterStationsByRegion = Boolean(checked);
    ["chk-mixed-filter-station-region", "chk-simple-filter-station-region", "chk-adv-filter-station-region"].forEach((cid) => {
      const el = document.getElementById(cid);
      if (el) el.checked = state.filterStationsByRegion;
    });
    renderScopeModalGrid();
    if (typeof updateRoadAndRailwayTileOverlays === "function") updateRoadAndRailwayTileOverlays();
    if (typeof updateScoreAndProgressUI === "function") updateScoreAndProgressUI();
    if (state.isHost && state.roomCode) onHostSettingChange("區域鐵道過濾");
  };

  ["chk-mixed-filter-station-region", "chk-simple-filter-station-region", "chk-adv-filter-station-region"].forEach((cid) => {
    document.getElementById(cid)?.addEventListener("change", (e) => handleFilterStationsByRegionToggle(e.target.checked));
  });

  // Transport Preset Buttons
  document.getElementById("btn-tpreset-all").addEventListener("click", () => {
    state.selectedTransportLines = new Set(TAIWAN_SELECTABLE_LINES.map((l) => l.id));
    if (state.transportMode === "off") state.transportMode = "lines_and_stations";
    renderTransportModalChecklist();
  });
  document.getElementById("btn-tpreset-pure-rail")?.addEventListener("click", () => {
    state.selectedTransportLines = new Set(TAIWAN_SELECTABLE_LINES.filter((l) => !l.isHighway).map((l) => l.id));
    state.transportMode = "rail_only";
    renderTransportModalChecklist();
    updateRoadAndRailwayTileOverlays();
    refreshAllPolygonStyles();
    setFeedback("🚄 已套用「純軌道路網」預設組合", "info");
  });
  document.getElementById("btn-tpreset-rail-all").addEventListener("click", () => {
    state.selectedTransportLines = new Set(TAIWAN_SELECTABLE_LINES.filter((l) => !l.isHighway).map((l) => l.id));
    if (state.transportMode === "off") state.transportMode = "lines_and_stations";
    renderTransportModalChecklist();
  });
  document.getElementById("btn-tpreset-tra").addEventListener("click", () => {
    state.selectedTransportLines = new Set(TAIWAN_SELECTABLE_LINES.filter((l) => l.id.startsWith("tra_")).map((l) => l.id));
    if (state.transportMode === "off") state.transportMode = "lines_and_stations";
    renderTransportModalChecklist();
  });
  document.getElementById("btn-tpreset-mrt-lrt").addEventListener("click", () => {
    state.selectedTransportLines = new Set(
      TAIWAN_SELECTABLE_LINES.filter((l) => l.id.startsWith("mrt_") || l.id.startsWith("lrt_") || l.id.startsWith("gon_")).map((l) => l.id)
    );
    if (state.transportMode === "off") state.transportMode = "lines_and_stations";
    renderTransportModalChecklist();
  });
  document.getElementById("btn-tpreset-heritage").addEventListener("click", () => {
    state.selectedTransportLines = new Set(
      TAIWAN_SELECTABLE_LINES.filter((l) => l.id.startsWith("for_") || l.id.startsWith("sug_") || l.id.startsWith("gon_")).map((l) => l.id)
    );
    if (state.transportMode === "off") state.transportMode = "lines_and_stations";
    renderTransportModalChecklist();
  });
  document.getElementById("btn-tpreset-highway").addEventListener("click", () => {
    state.selectedTransportLines = new Set(TAIWAN_SELECTABLE_LINES.filter((l) => l.isHighway).map((l) => l.id));
    if (state.transportMode === "off") state.transportMode = "lines_and_stations";
    renderTransportModalChecklist();
  });
  document.getElementById("btn-tpreset-none").addEventListener("click", () => {
    state.selectedTransportLines.clear();
    renderTransportModalChecklist();
  });

  document.getElementById("btn-leader-mode").addEventListener("click", () => {
    const modes = ["smart", "all_callout", "inline_only"];
    const labels = {
      smart: "標註: 智慧內嵌+拉線",
      all_callout: "標註: 強制外圍拉線",
      inline_only: "標註: 僅內嵌文字"
    };
    const nextIdx = (modes.indexOf(state.leaderLineMode) + 1) % modes.length;
    state.leaderLineMode = modes[nextIdx];
    document.getElementById("leader-mode-label").textContent = labels[state.leaderLineMode];
    renderSmartLabelsAndLeaderLines();
  });

  document.getElementById("btn-view-all")?.addEventListener("click", () => _resetToFullPackView());
  document.getElementById("btn-view-all-taiwan")?.addEventListener("click", () => _resetToFullPackView());
  document.getElementById("btn-mobile-jump-toggle")?.addEventListener("click", () => {
    const list = document.getElementById("quick-jump-list");
    if (list) {
      list.classList.toggle("hidden");
      list.classList.toggle("flex");
    }
  });
  document.getElementById("btn-reset-view-side")?.addEventListener("click", () => _resetToFullPackView());
  document.getElementById("btn-view-north").addEventListener("click", () => map.flyTo([25.04, 121.52], 11, { duration: 0.28 }));
  document.getElementById("btn-view-kinmen").addEventListener("click", () => map.flyTo([24.44, 118.36], 11, { duration: 0.28 }));
  document.getElementById("btn-view-matsu").addEventListener("click", () => map.flyTo([26.16, 119.95], 11, { duration: 0.28 }));
  document.getElementById("btn-view-penghu").addEventListener("click", () => map.flyTo([23.57, 119.61], 11, { duration: 0.28 }));

  document.getElementById("btn-zoom-in").addEventListener("click", () => map && map.zoomIn());
  document.getElementById("btn-zoom-out").addEventListener("click", () => map && map.zoomOut());

  document.querySelectorAll(".diff-btn").forEach((btn) => {
    btn.addEventListener("click", () => setDifficulty(btn.getAttribute("data-diff")));
  });
  document.querySelectorAll(".playmode-btn").forEach((btn) => {
    btn.addEventListener("click", () => setPlayMode(btn.getAttribute("data-playmode")));
  });
  document.querySelectorAll(".satellite-style-btn").forEach((btn) => {
    btn.addEventListener("click", () => setSatelliteStyle(btn.getAttribute("data-sat-style")));
  });
  document.getElementById("chk-satellite-lock-viewport")?.addEventListener("change", (e) => {
    setSatelliteLockViewport(e.target.checked);
  });
  document.querySelectorAll(".pindrop-rounds-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (typeof setPinDropRounds === "function") {
        setPinDropRounds(btn.getAttribute("data-pindrop-rounds"));
      }
    });
  });
  document.querySelectorAll(".pindrop-layer-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (typeof setPinDropBaseLayer === "function") {
        setPinDropBaseLayer(btn.getAttribute("data-pindrop-layer"));
      }
    });
  });
  document.getElementById("chk-pindrop-lock-layer")?.addEventListener("change", (e) => {
    if (typeof setPinDropLockBaseLayer === "function") {
      setPinDropLockBaseLayer(e.target.checked);
    }
  });
  document.getElementById("chk-pindrop-show-target-outline")?.addEventListener("change", (e) => {
    if (typeof setPinDropShowTargetOutline === "function") {
      setPinDropShowTargetOutline(e.target.checked);
    }
  });
  document.getElementById("chk-pindrop-show-borders")?.addEventListener("change", (e) => {
    if (typeof setPinDropShowBorders === "function") {
      setPinDropShowBorders(e.target.checked);
    }
  });
  document.getElementById("chk-pindrop-hide-county")?.addEventListener("change", (e) => {
    if (typeof setPinDropHideCounty === "function") {
      setPinDropHideCounty(e.target.checked);
    }
  });
  document.getElementById("btn-pindrop-confirm")?.addEventListener("click", () => {
    if (typeof confirmPinDropGuess === "function") confirmPinDropGuess();
  });
  document.getElementById("btn-pindrop-next")?.addEventListener("click", () => {
    if (typeof nextPinDropRound === "function") nextPinDropRound();
  });
  document.getElementById("btn-pindrop-finish-endless")?.addEventListener("click", () => {
    if (typeof finishPinDropGame === "function") finishPinDropGame();
  });
  document.getElementById("btn-pindrop-play-again")?.addEventListener("click", () => {
    document.getElementById("modal-pindrop-summary")?.classList.add("hidden");
    if (typeof startPinDropGame === "function") startPinDropGame();
  });
  document.getElementById("btn-pindrop-close-summary")?.addEventListener("click", () => {
    document.getElementById("modal-pindrop-summary")?.classList.add("hidden");
    if (typeof syncModalBodyScrollLock === "function") syncModalBodyScrollLock();
  });
  document.getElementById("btn-pindrop-exit-mode")?.addEventListener("click", () => {
    document.getElementById("modal-pindrop-summary")?.classList.add("hidden");
    if (typeof exitPinDropMode === "function") exitPinDropMode();
  });

  document.querySelectorAll(".hub-timer-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!canLocalModifyGameConfig()) return;
      const mode = btn.getAttribute("data-timermode") || "up";
      const sec = parseInt(btn.getAttribute("data-sec"), 10) || 300;
      if (state.isHost && state.roomCode) {
        requestOrApplyConfigChange({ timerMode: mode, countdownTotalSec: sec }, "計時模式");
        return;
      }
      state.timerMode = mode;
      state.countdownTotalSec = sec;
      document.getElementById("btn-timer-mode").textContent =
        mode === "up" ? "正計時" : `倒數 ${Math.round(sec / 60)}m`;
      syncConfigButtonsUI();
      resetGame();
      if (typeof renderRoomConciseSettingsSummary === "function") renderRoomConciseSettingsSummary();
      if (state.isHost && state.roomCode) onHostSettingChange("計時模式");
    });
  });

  document.querySelectorAll(".target-limit-btn").forEach((btn) => {
    btn.addEventListener("click", () => setTargetQuestionLimit(btn.getAttribute("data-target-limit")));
  });
  document.getElementById("input-target-question-limit")?.addEventListener("change", (e) => {
    setTargetQuestionLimit(e.target.value);
  });
  document.getElementById("chk-allow-pass")?.addEventListener("change", (e) => {
    setAllowPass(e.target.checked);
  });
  document.getElementById("chk-target-hide-guessed")?.addEventListener("change", (e) => {
    setHideGuessedOthers(e.target.checked);
  });
  document.getElementById("chk-pindrop-hide-guessed")?.addEventListener("change", (e) => {
    if (typeof setPinDropHideGuessed === "function") {
      setPinDropHideGuessed(e.target.checked);
    }
  });
  document.getElementById("chk-target-countdown-rush")?.addEventListener("change", (e) => {
    setQuestionCountdownEnabled(e.target.checked);
  });
  document.getElementById("chk-pindrop-countdown-rush")?.addEventListener("change", (e) => {
    setQuestionCountdownEnabled(e.target.checked);
  });
  document.getElementById("chk-pindrop-countdown-bonus")?.addEventListener("change", (e) => {
    if (typeof setPinDropCountdownBonus === "function") {
      setPinDropCountdownBonus(e.target.checked);
    }
  });
  document.querySelectorAll(".question-countdown-sec-btn").forEach((btn) => {
    btn.addEventListener("click", () => setQuestionCountdownSec(btn.getAttribute("data-qcd-sec")));
  });
  document.getElementById("btn-target-pass")?.addEventListener("click", () => {
    if (typeof passCurrentTarget === "function") passCurrentTarget();
  });
  document.getElementById("btn-target-next")?.addEventListener("click", () => pickNextTargetRegion());
  document.getElementById("btn-target-hint")?.addEventListener("click", () => giveTargetHint());
  document.getElementById("btn-target-reveal-outline")?.addEventListener("click", () => {
    if (typeof revealSatelliteOutline === "function") revealSatelliteOutline();
    else giveTargetHint();
  });
  document.getElementById("btn-target-exit")?.addEventListener("click", () => exitTargetQuizMode());
  document.getElementById("btn-dir-n")?.addEventListener("click", () => moveTargetByDirection("N"));
  document.getElementById("btn-dir-s")?.addEventListener("click", () => moveTargetByDirection("S"));
  document.getElementById("btn-dir-w")?.addEventListener("click", () => moveTargetByDirection("W"));
  document.getElementById("btn-dir-e")?.addEventListener("click", () => moveTargetByDirection("E"));

  const handleAllowTargetHintsToggle = (checked) => {
    if (!canLocalModifyGameConfig()) {
      setFeedback("🔒 僅房主可調整目標提示開關！", "warn");
      syncConfigButtonsUI();
      return;
    }
    if (state.isHost && state.roomCode) {
      requestOrApplyConfigChange({ allowTargetHints: Boolean(checked) }, "目標提示權限");
      return;
    }
    state.allowTargetHints = Boolean(checked);
    ["chk-allow-target-hints", "chk-room-allow-target-hints"].forEach((cid) => {
      const el = document.getElementById(cid);
      if (el) el.checked = state.allowTargetHints;
    });
    updateTargetBannerUI();
    if (typeof renderRoomConciseSettingsSummary === "function") renderRoomConciseSettingsSummary();
    if (state.isHost && state.roomCode) onHostSettingChange("目標提示權限");
  };
  ["chk-allow-target-hints", "chk-room-allow-target-hints"].forEach((cid) => {
    document.getElementById(cid)?.addEventListener("change", (e) => handleAllowTargetHintsToggle(e.target.checked));
  });

  window.addEventListener("keydown", (e) => {
    if (e.isComposing || state.isImeComposing) return;
    const tag = document.activeElement ? document.activeElement.tagName : "";
    const activeId = document.activeElement ? document.activeElement.id : "";

    if (state.playMode === "pin_drop" && (e.key === " " || e.key === "Spacebar" || e.key === "Enter")) {
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const anyModalOpen = MODAL_IDS.some((id) => {
        const m = document.getElementById(id);
        return m && !m.classList.contains("hidden");
      });
      if (anyModalOpen) return;
      if (state.pinDrop && state.pinDrop.phase === "placing" && state.pinDrop.guessLatLng) {
        if (typeof e.preventDefault === "function") e.preventDefault();
        if (typeof confirmPinDropGuess === "function") confirmPinDropGuess();
        return;
      }
      if (state.pinDrop && state.pinDrop.phase === "revealed") {
        if (typeof e.preventDefault === "function") e.preventDefault();
        if (typeof nextPinDropRound === "function") nextPinDropRound();
        return;
      }
    }

    if (tag === "INPUT" && activeId !== "answer-input") return;

    const inputEl = document.getElementById("answer-input");
    if (!inputEl || inputEl.value.length > 0) return;

    const suffixContainerEl = document.getElementById("suffix-container");
    const suffixInputEl = document.getElementById("suffix-input");
    const prefixSelectEl = document.getElementById("prefix-select");

    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const suffixList = typeof getActiveQuickSuffixes === "function" ? getActiveQuickSuffixes() : [];
      if (!suffixContainerEl || suffixContainerEl.classList.contains("hidden") || suffixList.length <= 1) return;
      e.preventDefault();
      const curSuffix = suffixInputEl ? suffixInputEl.value : "";
      let idx = suffixList.indexOf(curSuffix);
      if (idx < 0) idx = 0;
      const step = e.key === "ArrowRight" ? 1 : -1;
      const nextIdx = (idx + step + suffixList.length) % suffixList.length;
      const nextSuffix = suffixList[nextIdx];
      if (suffixInputEl) suffixInputEl.value = nextSuffix;
      if (typeof updateSuffixControlsUI === "function") updateSuffixControlsUI();
      setFeedback(`🏷️ 左右鍵快速切換後綴：「${nextSuffix || "無後綴"}」`, "info");
      inputEl.focus({ preventScroll: true });
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const prefixContainerEl = document.getElementById("prefix-container");
      if (!prefixSelectEl || (prefixContainerEl && prefixContainerEl.classList.contains("hidden")) || prefixSelectEl.options.length <= 1) return;
      e.preventDefault();
      const totalOpts = prefixSelectEl.options.length;
      const curIdx = prefixSelectEl.selectedIndex >= 0 ? prefixSelectEl.selectedIndex : 0;
      const step = e.key === "ArrowDown" ? 1 : -1;
      const nextIdx = (curIdx + step + totalOpts) % totalOpts;
      prefixSelectEl.selectedIndex = nextIdx;
      updateLiveCombinedPreview();
      const opt = prefixSelectEl.options[nextIdx];
      const chosenText = (opt && opt.value) || "無固定前綴";
      setFeedback(`📍 上下鍵快速切換縣市前綴：「${chosenText}」`, "info");
      inputEl.focus({ preventScroll: true });
    }
  });

  // ============================================================================
  // WINDOWS IME COMPOSITION-SAFE INPUT HANDLING
  // ============================================================================
  const answerInput = document.getElementById("answer-input");
  const prefixSelect = document.getElementById("prefix-select");
  const suffixInput = document.getElementById("suffix-input");

  answerInput.addEventListener("compositionstart", () => {
    state.isImeComposing = true;
  });

  answerInput.addEventListener("compositionend", () => {
    state.isImeComposing = false;
    updateLiveCombinedPreview();
    if (document.getElementById("chk-auto-submit").checked) {
      setTimeout(() => {
        if (!state.isImeComposing && answerInput.value.trim()) {
          evaluateGuess(answerInput.value, true);
        }
      }, 0);
    }
  });

  answerInput.addEventListener("input", (e) => {
    if (e.isComposing || state.isImeComposing) return;
    updateLiveCombinedPreview();
    if (document.getElementById("chk-auto-submit").checked) {
      evaluateGuess(answerInput.value, true);
    }
  });

  document.getElementById("answer-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (state.isImeComposing || state.role === "spectator") return;
    evaluateGuess(answerInput.value, false);
  });

  // Clicking non-interactive space in the input dock (e.g. gap before input) focuses #answer-input
  const inputDockCard = document.getElementById("input-dock-card");
  if (inputDockCard) {
    inputDockCard.addEventListener("mousedown", (e) => {
      if (state.role === "spectator" || state.isGameOver) return;
      if (e.target.closest("input, select, button, label, a, option")) return;
      e.preventDefault();
      answerInput.focus({ preventScroll: true });
    });
  }

  prefixSelect.addEventListener("change", () => {
    updateLiveCombinedPreview();
    answerInput.focus({ preventScroll: true });
  });

  suffixInput.addEventListener("input", () => {
    updateLiveCombinedPreview();
  });

  const suffixQuickGroup = document.getElementById("suffix-quick-group");
  if (suffixQuickGroup) {
    suffixQuickGroup._delegatedSuffixClick = true;
    suffixQuickGroup.addEventListener("click", (e) => {
      const btn = e.target && typeof e.target.closest === "function" ? e.target.closest(".suffix-quick-btn") : null;
      if (!btn) return;
      const s = btn.getAttribute("data-suffix") || "";
      if (suffixInput) suffixInput.value = s;
      if (typeof updateSuffixControlsUI === "function") updateSuffixControlsUI();
      else updateLiveCombinedPreview();
      if (answerInput) answerInput.focus({ preventScroll: true });
    });
  }

  // Give up & Reveal Answers (Both Top Bar button and Bottom Dock button)
  const triggerGiveUp = () => {
    if (state.role === "spectator") return;
    giveUpAndReveal();
  };
  document.getElementById("btn-give-up")?.addEventListener("click", triggerGiveUp);
  document.getElementById("btn-top-give-up")?.addEventListener("click", triggerGiveUp);

  document.getElementById("btn-restart").addEventListener("click", () => {
    if (state.role === "spectator") return;
    resetGame();
  });

  // Performance Settings Modal
  document.getElementById("btn-open-perf").addEventListener("click", () => {
    document.getElementById("modal-perf").classList.remove("hidden");
  });
  document.getElementById("btn-close-perf").addEventListener("click", () => {
    document.getElementById("modal-perf").classList.add("hidden");
  });
  document.getElementById("btn-apply-perf").addEventListener("click", () => {
    document.getElementById("modal-perf").classList.add("hidden");
    renderSmartLabelsAndLeaderLines();
  });
  document.getElementById("perf-drag-mode-select").addEventListener("change", (e) => {
    state.dragSyncMode = e.target.value;
  });
  document.getElementById("perf-max-labels-range").addEventListener("input", (e) => {
    state.maxVisibleCallouts = parseInt(e.target.value, 10) || 0;
    document.getElementById("perf-max-labels-val").textContent = `${state.maxVisibleCallouts} 個`;
    renderSmartLabelsAndLeaderLines();
  });
  document.getElementById("perf-min-px-range").addEventListener("input", (e) => {
    state.minPolygonPixelSize = parseInt(e.target.value, 10) || 20;
    document.getElementById("perf-min-px-val").textContent = `${state.minPolygonPixelSize} px`;
    renderSmartLabelsAndLeaderLines();
  });
  document.getElementById("chk-perf-lite").addEventListener("change", (e) => {
    state.perfLiteMode = e.target.checked;
    document.body.classList.toggle("perf-lite", state.perfLiteMode);
  });

  // Observe all modal overlays to keep body.modal-open scroll lock 100% synchronized
  const modalObserver = new MutationObserver(() => syncModalBodyScrollLock());
  MODAL_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    modalObserver.observe(el, { attributes: true, attributeFilter: ["class"] });
    el.addEventListener(
      "wheel",
      (ev) => {
        if (ev.target === el) {
          ev.preventDefault();
        }
      },
      { passive: false }
    );
  });
  syncModalBodyScrollLock();

  document.getElementById("btn-restore-session")?.addEventListener("click", () => {
    const saved = loadSavedSessionFromStorage();
    if (saved) resumeSavedRoomSession(saved);
  });
  document.getElementById("btn-dismiss-session")?.addEventListener("click", () => {
    clearSavedSessionFromStorage();
    document.getElementById("session-restore-banner")?.classList.add("hidden");
  });

  // Unified Dual-Action Topic Cards (Left = Exclusive Solo Select; Right = Union Multi-Select)
  const applyTopicSelection = (topic, isUnion) => {
    const features = _getActivePackFeatures();
    if (topic === "station" && !features.supportsTransportQuiz) return;
    if (["airport", "port", "reservoir", "lake", "settlement"].includes(topic) && !features.supportsPoiQuiz) return;
    if (topic === "capital" && !features.supportsCapitalQuiz) return;
    if (!canLocalModifyGameConfig()) {
      setFeedback("僅房主可調整挑戰題庫！", "warn");
      return;
    }
    const prevR = Boolean(state.regionQuizEnabled);
    const prevS = Boolean(state.stationQuizEnabled);
    let nextR = prevR;
    let nextS = prevS;
    let nextA = Boolean(state.airportQuizEnabled);
    let nextP = Boolean(state.portQuizEnabled);
    let nextRes = Boolean(state.reservoirQuizEnabled);
    let nextLk = Boolean(state.lakeQuizEnabled);
    let nextStl = Boolean(state.settlementQuizEnabled);
    let nextCap = Boolean(state.capitalQuizEnabled);
    let nextCounties = new Set(state.selectedCounties);
    let nextTownIds = new Set(state.selectedTownIds);
    let nextLines = new Set(state.quizStationLines);
    let nextApSubs = new Set(state.airportSubTypes);
    let nextPtSubs = new Set(state.portSubTypes);
    let nextResSubs = new Set(state.reservoirSubTypes);
    let nextLkSubs = new Set(state.lakeSubTypes);
    let nextStlSubs = new Set(state.settlementSubTypes);
    let nextFilterByRegion = Boolean(state.filterStationsByRegion);

    if (isUnion) {
      if (topic === "region") nextR = !nextR;
      else if (topic === "station") nextS = !nextS;
      else if (topic === "airport") nextA = !nextA;
      else if (topic === "port") nextP = !nextP;
      else if (topic === "reservoir") nextRes = !nextRes;
      else if (topic === "lake") nextLk = !nextLk;
      else if (topic === "settlement") nextStl = !nextStl;
      else if (topic === "capital") nextCap = !nextCap;
    } else {
      nextR = topic === "region";
      nextS = topic === "station";
      nextA = topic === "airport";
      nextP = topic === "port";
      nextRes = topic === "reservoir";
      nextLk = topic === "lake";
      nextStl = topic === "settlement";
      nextCap = topic === "capital";
    }

    if (!nextR && !nextS && !nextA && !nextP && !nextRes && !nextLk && !nextStl && !nextCap) {
      setFeedback("至少需保留 1 種挑戰題庫！", "warn");
      return;
    }

    if (nextR && (nextCounties.size === 0 || nextTownIds.size === 0)) {
      const activeGroups = _getActivePackGroups();
      const activeItems = _getActivePackItems();
      nextCounties = new Set(activeGroups.map((c) => c.name));
      nextTownIds = new Set(activeItems.map((t) => t.id));
    }
    if (nextS && nextLines.size === 0) {
      nextLines = new Set(getDefaultStationQuizLines());
    }
    // When turning Station ON while Region is ON (or Region ON while Station is ON), default-enable regional filtering
    if ((nextS && !prevS && nextR) || (nextR && !prevR && nextS)) {
      nextFilterByRegion = true;
    }
    if (nextA && nextApSubs.size === 0) {
      nextApSubs = new Set(["intl", "domestic", "military"]);
    }
    if (nextP && nextPtSubs.size === 0) {
      nextPtSubs = new Set(["intl_commercial", "intl_aux", "fishery_cat1"]);
    }
    if (nextRes && nextResSubs.size === 0) {
      nextResSubs = new Set(["res_major"]);
    }
    if (nextLk && nextLkSubs.size === 0) {
      nextLkSubs = new Set(["lake_scenic"]);
    }
    if (nextStl && nextStlSubs.size === 0) {
      nextStlSubs = new Set(["signage_major"]);
    }

    if (state.isHost && state.roomCode) {
      requestOrApplyConfigChange(
        {
          regionQuizEnabled: nextR,
          stationQuizEnabled: nextS,
          airportQuizEnabled: nextA,
          portQuizEnabled: nextP,
          reservoirQuizEnabled: nextRes,
          lakeQuizEnabled: nextLk,
          settlementQuizEnabled: nextStl,
          capitalQuizEnabled: nextCap,
          filterStationsByRegion: nextFilterByRegion,
          selectedCounties: nextR ? Array.from(nextCounties) : [],
          selectedTownIds: nextR ? Array.from(nextTownIds) : [],
          quizStationLines: nextS ? Array.from(nextLines) : [],
          airportSubTypes: Array.from(nextApSubs),
          portSubTypes: Array.from(nextPtSubs),
          reservoirSubTypes: Array.from(nextResSubs),
          lakeSubTypes: Array.from(nextLkSubs),
          settlementSubTypes: Array.from(nextStlSubs)
        },
        "挑戰題庫"
      );
      return;
    }

    state.regionQuizEnabled = nextR;
    state.stationQuizEnabled = nextS;
    state.airportQuizEnabled = nextA;
    state.portQuizEnabled = nextP;
    state.reservoirQuizEnabled = nextRes;
    state.lakeQuizEnabled = nextLk;
    state.settlementQuizEnabled = nextStl;
    state.capitalQuizEnabled = nextCap;
    state.filterStationsByRegion = nextFilterByRegion;
    state.selectedCounties = nextCounties;
    state.selectedTownIds = nextTownIds;
    state.quizStationLines = nextLines;
    state.airportSubTypes = nextApSubs;
    state.portSubTypes = nextPtSubs;
    state.reservoirSubTypes = nextResSubs;
    state.lakeSubTypes = nextLkSubs;
    state.settlementSubTypes = nextStlSubs;
    if (typeof syncLegacyQuizTargetMode === "function") syncLegacyQuizTargetMode();
    renderScopeModalGrid();
    if (typeof refreshPoiMapLayer === "function") refreshPoiMapLayer();
  };

  document.querySelectorAll(".topic-chip-btn").forEach((card) => {
    const topic = card.getAttribute("data-topic");
    const soloBtn = card.querySelector(".geo-solo-btn");
    const unionBtn = card.querySelector(".geo-union-btn");
    if (soloBtn) soloBtn.addEventListener("click", () => applyTopicSelection(topic, false));
    if (unionBtn) unionBtn.addEventListener("click", () => applyTopicSelection(topic, true));
  });

  // Unified Dual-Action POI Subtype Cards (Left = Exclusive Solo; Right = Union Toggle)
  const applyPoiSubTypeSelection = (cat, sub, isUnion) => {
    if (!canLocalModifyGameConfig()) {
      setFeedback("僅房主可調整地標分類！", "warn");
      return;
    }
    const curSet = typeof getEnabledSubTypesForCategory === "function" ? getEnabledSubTypesForCategory(cat) : new Set();
    const catLabel = (POI_CATEGORY_META[cat] && POI_CATEGORY_META[cat].label) || "地標";
    let targetSet;
    if (isUnion) {
      targetSet = new Set(curSet);
      if (targetSet.has(sub)) {
        if (targetSet.size <= 1) {
          setFeedback(`至少需保留 1 項${catLabel}子分類！`, "warn");
          return;
        }
        targetSet.delete(sub);
      } else {
        targetSet.add(sub);
      }
    } else {
      targetSet = new Set([sub]);
    }

    if (state.isHost && state.roomCode) {
      const patch =
        cat === "airport"
          ? { airportQuizEnabled: true, airportSubTypes: Array.from(targetSet) }
          : cat === "port"
          ? { portQuizEnabled: true, portSubTypes: Array.from(targetSet) }
          : cat === "reservoir"
          ? { reservoirQuizEnabled: true, reservoirSubTypes: Array.from(targetSet) }
          : cat === "lake"
          ? { lakeQuizEnabled: true, lakeSubTypes: Array.from(targetSet) }
          : { settlementQuizEnabled: true, settlementSubTypes: Array.from(targetSet) };
      requestOrApplyConfigChange(patch, `${catLabel}分類`);
      return;
    }

    if (cat === "airport") state.airportSubTypes = targetSet;
    else if (cat === "port") state.portSubTypes = targetSet;
    else if (cat === "reservoir") state.reservoirSubTypes = targetSet;
    else if (cat === "lake") state.lakeSubTypes = targetSet;
    else if (cat === "settlement") state.settlementSubTypes = targetSet;
    renderScopeModalGrid();
    if (typeof refreshPoiMapLayer === "function") refreshPoiMapLayer();
  };

  document.querySelectorAll(".poi-subtype-btn").forEach((card) => {
    const cat = card.getAttribute("data-poi-cat");
    const sub = card.getAttribute("data-poi-sub");
    const soloBtn = card.querySelector(".geo-solo-btn");
    const unionBtn = card.querySelector(".geo-union-btn");
    if (soloBtn) soloBtn.addEventListener("click", () => applyPoiSubTypeSelection(cat, sub, false));
    if (unionBtn) unionBtn.addEventListener("click", () => applyPoiSubTypeSelection(cat, sub, true));
  });

  [
    ["btn-jump-port-advanced", "scope-port-section"],
    ["btn-jump-reservoir-advanced", "scope-reservoir-section"],
    ["btn-jump-lake-advanced", "scope-lake-section"],
    ["btn-jump-settlement-advanced", "scope-settlement-section"]
  ].forEach(([btnId, secId]) => {
    document.getElementById(btnId)?.addEventListener("click", () => {
      setSettingsTab("advanced");
      const sec = document.getElementById(secId);
      if (sec) sec.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });

  // ============================================================================
  // SEPARATE ROOM MODAL (#modal-room) & MODE SETTINGS MODAL (#modal-scope) EVENTS
  // ============================================================================
  document.getElementById("btn-open-scope")?.addEventListener("click", () => openModeSettingsModal("simple"));
  document.getElementById("btn-room-open-mode-settings")?.addEventListener("click", () => openModeSettingsModal("simple"));
  document.getElementById("btn-close-scope")?.addEventListener("click", () => {
    document.getElementById("modal-scope")?.classList.add("hidden");
  });

  // Progressive-disclosure controls for the minimalist settings sheet
  document.getElementById("btn-toggle-scope-drawer")?.addEventListener("click", () => {
    setScopeDrawerExpanded(!_scopeDrawerExpanded);
  });
  document.getElementById("btn-toggle-settings-help")?.addEventListener("click", () => {
    const pop = document.getElementById("settings-help-popover");
    const btn = document.getElementById("btn-toggle-settings-help");
    if (!pop) return;
    updateSettingsHelpPopoverContent();
    const nowHidden = !pop.classList.contains("hidden");
    pop.classList.toggle("hidden", nowHidden);
    if (btn) btn.setAttribute("aria-expanded", nowHidden ? "false" : "true");
  });
  document.getElementById("chk-pack-world-microstates")?.addEventListener("change", (e) => {
    applyPackOptionToggle("worldIncludeMicrostates", e.target.checked);
  });
  document.getElementById("chk-pack-cn-singlechar")?.addEventListener("change", (e) => {
    applyPackOptionToggle("cnAllowSingleCharAlias", e.target.checked);
  });
  document.getElementById("chk-pack-roc-mongolia")?.addEventListener("change", (e) => {
    applyPackOptionToggle("rocTerritoryVariant", e.target.checked ? "begonia_full" : "no_mongolia");
  });
  document.getElementById("chk-pack-roc-municipalities")?.addEventListener("change", (e) => {
    applyPackOptionToggle("includeMunicipalities", e.target.checked);
  });
  document.getElementById("chk-pack-roc-disputed")?.addEventListener("change", (e) => {
    applyPackOptionToggle("showDisputedBorders", e.target.checked);
  });
  document.getElementById("mappack-combo-twjpcn")?.addEventListener("click", () => {
    handleMapPackSelection("tw_modern+jp_pref+cn_prov");
  });
  document.getElementById("mappack-combo-twjproc")?.addEventListener("click", () => {
    handleMapPackSelection("tw_modern+jp_pref+roc_1949");
  });
  document.getElementById("btn-timer-mode-countdown")?.addEventListener("click", () => {
    if (!canLocalModifyGameConfig()) return;
    const secs = state.timerMode === "down" && state.countdownTotalSec > 0 ? state.countdownTotalSec : 300;
    if (state.isHost && state.roomCode) {
      requestOrApplyConfigChange({ timerMode: "down", countdownTotalSec: secs }, "計時模式");
      return;
    }
    state.timerMode = "down";
    state.countdownTotalSec = secs;
    const tBtn = document.getElementById("btn-timer-mode");
    if (tBtn) tBtn.textContent = `倒數 ${Math.round(secs / 60)}m`;
    syncConfigButtonsUI();
    resetGame();
    if (typeof renderRoomConciseSettingsSummary === "function") renderRoomConciseSettingsSummary();
  });
  document.getElementById("btn-toggle-room-restrictions")?.addEventListener("click", () => {
    syncRoomRestrictionsDrawerUI(!_roomRestrictionsExpanded);
  });

  document.getElementById("btn-top-create-room")?.addEventListener("click", () => openRoomModal());
  document.getElementById("btn-top-open-room")?.addEventListener("click", () => openRoomModal());
  document.getElementById("btn-top-leave-room")?.addEventListener("click", () => leaveP2PRoom());
  document.getElementById("btn-spectator-open-hub")?.addEventListener("click", () => openRoomModal());
  document.getElementById("btn-close-room")?.addEventListener("click", () => {
    document.getElementById("modal-room")?.classList.add("hidden");
  });

  // Top-Level URL Client Entry Modal (#modal-join-entry) Events
  document.getElementById("btn-join-entry-submit")?.addEventListener("click", () => submitUrlClientJoinEntry());
  document.getElementById("btn-close-join-entry")?.addEventListener("click", () => {
    state.pendingJoinRoomCode = "";
    document.getElementById("modal-join-entry")?.classList.add("hidden");
    try {
      if (window.location.search.includes("room=")) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (_) {}
  });
  document.getElementById("join-entry-nickname-input")?.addEventListener("keydown", (e) => {
    if (e.isComposing || state.isImeComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      submitUrlClientJoinEntry();
    }
  });
  document.getElementById("join-entry-password-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitUrlClientJoinEntry();
    }
  });
  document.getElementById("join-entry-password-input")?.addEventListener("input", (e) => {
    e.target.classList.remove("border-rose-500");
    document.getElementById("join-entry-error")?.classList.add("hidden");
  });

  // Station Quiz Quick Presets
  const applyStationScopeSelection = (targetLineIds, isMultiSelect = false) => {
    if (!canLocalModifyGameConfig()) return;

    let nextLines;
    if (!targetLineIds || targetLineIds.length === 0) {
      nextLines = new Set();
    } else if (isMultiSelect) {
      nextLines = new Set(state.quizStationLines);
      const allSelected = targetLineIds.length > 0 && targetLineIds.every((id) => nextLines.has(id));
      if (allSelected) {
        targetLineIds.forEach((id) => nextLines.delete(id));
      } else {
        targetLineIds.forEach((id) => nextLines.add(id));
      }
    } else {
      nextLines = new Set(targetLineIds);
    }

    if (state.isHost && state.roomCode) {
      requestOrApplyConfigChange({ quizStationLines: Array.from(nextLines) }, "車站題庫");
      return;
    }

    state.quizStationLines = nextLines;
    state.stationQuizEnabled = state.quizStationLines.size > 0;
    renderScopeModalGrid();
    if (state.isHost && state.roomCode) onHostSettingChange("車站題庫");
  };

  // Bind Simple Region Cards (Solo left / Union right)
  document.querySelectorAll(".simple-region-btn").forEach((card) => {
    const key = card.getAttribute("data-simple-region");
    const fn = SIMPLE_REGION_MAP[key];
    if (!fn) return;
    card.querySelector(".geo-solo-btn")?.addEventListener("click", () => applyRegionScopeSelection(fn(), false));
    card.querySelector(".geo-union-btn")?.addEventListener("click", () => applyRegionScopeSelection(fn(), true));
  });

  // Bind Simple Station Cards (Solo left / Union right)
  document.querySelectorAll(".simple-station-btn").forEach((card) => {
    const key = card.getAttribute("data-simple-station");
    const fn = SIMPLE_STATION_MAP[key];
    if (!fn) return;
    card.querySelector(".geo-solo-btn")?.addEventListener("click", () => applyStationScopeSelection(fn(), false));
    card.querySelector(".geo-union-btn")?.addEventListener("click", () => applyStationScopeSelection(fn(), true));
  });

  // Bind Advanced Region Preset Cards
  REGION_PRESETS.forEach((p) => {
    const card = document.getElementById(p.id);
    if (!card) return;
    card.querySelector(".geo-solo-btn")?.addEventListener("click", () => applyRegionScopeSelection(p.getTownIds(), false));
    card.querySelector(".geo-union-btn")?.addEventListener("click", () => applyRegionScopeSelection(p.getTownIds(), true));
  });

  document.getElementById("btn-scope-random-one")?.addEventListener("click", () => {
    const activeGroups = _getActivePackGroups();
    const activeItems = _getActivePackEligibleItems();
    if (!activeGroups.length) return;
    const pick = activeGroups[Math.floor(Math.random() * activeGroups.length)];
    const pickTownIds = activeItems.filter((t) => t.countyName === pick.name).map((t) => t.id);
    applyRegionScopeSelection(pickTownIds, false);
  });

  document.getElementById("btn-scope-clear")?.addEventListener("click", () => {
    applyRegionScopeSelection([], false);
  });

  // Bind Advanced Station Preset Cards
  STATION_PRESETS.forEach((p) => {
    const card = document.getElementById(p.id);
    if (!card) return;
    card.querySelector(".geo-solo-btn")?.addEventListener("click", () => applyStationScopeSelection(p.getLineIds(), false));
    card.querySelector(".geo-union-btn")?.addEventListener("click", () => applyStationScopeSelection(p.getLineIds(), true));
  });

  document.getElementById("btn-qst-none")?.addEventListener("click", () => {
    applyStationScopeSelection([], false);
  });

  // Unified Select All / Clear buttons for Region, Station, Airport, Port, Reservoir & Lake
  document.querySelectorAll(".scope-bulk-btn[data-scope-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!canLocalModifyGameConfig()) {
        setFeedback("⚠️ 目前由房主統一管理題庫範圍", "warn");
        return;
      }
      const action = btn.getAttribute("data-scope-action");
      const target = btn.getAttribute("data-scope-target");
      const mode = btn.getAttribute("data-scope-mode") || "all";

      if (target === "region") {
        const allIds = action === "select-all" ? _getActivePackEligibleItems().map((t) => t.id) : [];
        applyRegionScopeSelection(allIds, false);
        return;
      }
      if (target === "station") {
        const allLines = action === "select-all"
          ? TAIWAN_SELECTABLE_LINES.filter((l) => !l.isHighway).map((l) => l.id)
          : [];
        applyStationScopeSelection(allLines, false);
        return;
      }
      if (["airport", "port", "reservoir", "lake", "settlement"].includes(target)) {
        const subMetaMap = {
          airport: typeof AIRPORT_SUBTYPES !== "undefined" ? AIRPORT_SUBTYPES.map((s) => s.id) : [],
          port: mode === "simple"
            ? ["intl_commercial", "intl_aux", "fishery_cat1"]
            : (typeof PORT_SUBTYPES !== "undefined" ? PORT_SUBTYPES.map((s) => s.id) : []),
          reservoir: typeof RESERVOIR_SUBTYPES !== "undefined" ? RESERVOIR_SUBTYPES.map((s) => s.id) : [],
          lake: typeof LAKE_SUBTYPES !== "undefined" ? LAKE_SUBTYPES.map((s) => s.id) : [],
          settlement: typeof SETTLEMENT_SUBTYPES !== "undefined" ? SETTLEMENT_SUBTYPES.map((s) => s.id) : []
        };
        const nextSet = action === "select-all" ? new Set(subMetaMap[target] || []) : new Set();
        const catLabel = (typeof POI_CATEGORY_META !== "undefined" && POI_CATEGORY_META[target] && POI_CATEGORY_META[target].label) || "地標";
        if (state.roomCode && !state.isHost) {
          const patch =
            target === "airport" ? { airportSubTypes: Array.from(nextSet) } :
            target === "port" ? { portSubTypes: Array.from(nextSet) } :
            target === "reservoir" ? { reservoirSubTypes: Array.from(nextSet) } :
            target === "lake" ? { lakeSubTypes: Array.from(nextSet) } :
            { settlementSubTypes: Array.from(nextSet) };
          requestOrApplyConfigChange(patch, `${catLabel}分類`);
          return;
        }
        if (target === "airport") state.airportSubTypes = nextSet;
        else if (target === "port") state.portSubTypes = nextSet;
        else if (target === "reservoir") state.reservoirSubTypes = nextSet;
        else if (target === "lake") state.lakeSubTypes = nextSet;
        else state.settlementSubTypes = nextSet;
        renderScopeModalGrid();
        if (typeof refreshPoiMapLayer === "function") refreshPoiMapLayer();
        if (state.isHost && state.roomCode) onHostSettingChange(`${catLabel}分類`);
      }
    });
  });

  document.getElementById("chk-raw-rail-tile")?.addEventListener("change", (e) => {
    state.showRawOpenRailwayTile = e.target.checked;
    updateRoadAndRailwayTileOverlays();
  });

  document.getElementById("btn-apply-scope").addEventListener("click", () => {
    if (state.roomCode && !state.isHost) {
      document.getElementById("modal-scope").classList.add("hidden");
      return;
    }

    if (!state.stationQuizEnabled) {
      state.quizStationLines.clear();
    }
    if (typeof syncLegacyQuizTargetMode === "function") syncLegacyQuizTargetMode();

    const activeGroups = _getActivePackGroups();
    const activeItems = _getActivePackEligibleItems();
    const unitLabels = _getActivePackUnitLabels();
    const features = _getActivePackFeatures();
    const pack = _getActivePack();
    const firstGroupName = activeGroups.length > 0 ? activeGroups[0].name : "臺北市";

    const hasActivePoi = (features.supportsPoiQuiz || features.supportsCapitalQuiz) && typeof hasAnyPoiQuizActive === "function" && hasAnyPoiQuizActive();
    const hasActiveStation = features.supportsTransportQuiz && Boolean(state.stationQuizEnabled && state.quizStationLines.size > 0);
    const hasAnyRegionSelected = Boolean(state.regionQuizEnabled && state.selectedTownIds && state.selectedTownIds.size > 0);
    if (!hasAnyRegionSelected && !hasActiveStation && !hasActivePoi) {
      setFeedback("⚠️ 請至少選擇 1 項挑戰題庫！", "warn");
      state.regionQuizEnabled = true;
      state.selectedCounties = new Set([firstGroupName]);
      state.selectedTownIds = new Set(activeItems.filter((t) => t.countyName === firstGroupName).map((t) => t.id));
    }

    if (features.supportsTransportQuiz && state.stationQuizEnabled && state.quizStationLines.size > 0) {
      state.stationQuizEnabled = true;
      // Default to pure rail overlay (no hw_freeway / highway tiles that spoil airports & ports)
      state.selectedTransportLines = new Set(state.quizStationLines);
      if (
        (state.transportMode === "off" || state.transportMode === "lines_and_stations") &&
        state.p2pRailRule !== "ban_rail" &&
        state.p2pRailRule !== "force_lines"
      ) {
        state.transportMode = "rail_only";
      }
    } else {
      state.stationQuizEnabled = false;
      if (!state.roomCode || state.p2pRailRule === "free") {
        state.transportMode = "off";
      }
    }

    const totalTowns = getScopeTowns().length;
    const totalPackItems = activeItems.length;
    const activeSt = features.supportsTransportQuiz && typeof getActiveQuizStations === "function" ? getActiveQuizStations() : [];
    const sumParts = [];
    if (state.regionQuizEnabled && totalTowns > 0) {
      const isWorldStd =
        pack &&
        pack.id === "world_countries" &&
        state.packOptions &&
        state.packOptions.worldIncludeMicrostates === false;
      const fullLabel = isWorldStd
        ? `標準版 ${totalPackItems} ${unitLabels.itemShort}`
        : (unitLabels.fullScopeLabel || `全部 ${totalPackItems} ${unitLabels.itemShort}`);
      sumParts.push(
        totalTowns === totalPackItems
          ? fullLabel
          : state.selectedCounties.size === 1
          ? `${Array.from(state.selectedCounties)[0]} (${totalTowns}${unitLabels.itemShort})`
          : `${totalTowns} ${unitLabels.itemShort}`
      );
    }
    if (activeSt.length > 0) sumParts.push(`${activeSt.length}站`);
    if ((features.supportsPoiQuiz || features.supportsCapitalQuiz) && typeof isPoiCategoryActive === "function" && typeof getActiveQuizPois === "function") {
      const capShortLbl = typeof getPoiCategoryLabel === "function" ? getPoiCategoryLabel("capital") : "首都";
      [["airport", "機場"], ["port", "港"], ["reservoir", "水庫"], ["lake", "湖"], ["settlement", "聚落"], ["capital", capShortLbl]].forEach(([cat, lbl]) => {
        if (isPoiCategoryActive(cat)) {
          const cnt = getActiveQuizPois(cat).length;
          if (cnt > 0) sumParts.push(`${cnt}${lbl}`);
        }
      });
    }
    const fallbackSummary = _uiIsTaiwanModernPack() ? "台灣地理" : ((pack && (pack.shortLabel || pack.displayName)) || "地圖挑戰");
    const summaryLabel = sumParts.length > 0 ? sumParts.join(" + ") : fallbackSummary;
    document.getElementById("scope-summary-label").textContent = summaryLabel;
    document.getElementById("modal-scope").classList.add("hidden");
    resetGame();
    if (typeof renderRoomConciseSettingsSummary === "function") renderRoomConciseSettingsSummary();

    if (state.selectedCounties.size === 0 && activeSt.length > 0 && map) {
      const bounds = L.latLngBounds(activeSt.map((s) => [s.lat, s.lng]));
      if (bounds.isValid()) {
        map.flyToBounds(bounds.pad(0.18), { duration: 0.28, maxZoom: 13 });
      }
      setFeedback(`🚉 已開啟車站挑戰 (共 ${state.quizStationLines.size} 條路線、${activeSt.length} 座車站)！`, "tier");
    }

    if (typeof syncModalBodyScrollLock === "function") syncModalBodyScrollLock();
    if (state.playMode !== "pin_drop" && state.role !== "spectator") {
      const inp = document.getElementById("answer-input");
      if (inp && typeof inp.focus === "function") inp.focus({ preventScroll: true });
    }

    // Only broadcast if local user is Host in an active room and config changed on apply! Solo mode never broadcasts!
    if (state.isHost && state.roomCode) {
      const currentSig = JSON.stringify(getHostSyncConfig(false));
      if (state._lastBroadcastConfigJson !== currentSig) {
        onHostSettingChange("題庫範圍", summaryLabel);
      }
    }
  });

  // ============================================================================
  // P2P LOBBY, DUAL INVITE LINKS, NICKNAME SYNC & VOTE CONTROLS
  // ============================================================================
  document.getElementById("btn-p2p-host").addEventListener("click", () => hostP2PRoom());
  document.getElementById("btn-p2p-join").addEventListener("click", () => joinP2PRoom());
  document.getElementById("btn-p2p-leave")?.addEventListener("click", () => leaveP2PRoom());

  document.getElementById("btn-p2p-switch-role")?.addEventListener("click", () => toggleSpectatorRole());
  document.getElementById("btn-spectator-join-next")?.addEventListener("click", () => toggleSpectatorRole());
  document.getElementById("spectator-player-select")?.addEventListener("change", (e) => {
    setSpectatingTarget(e.target.value);
  });

  const onHostPasswordInput = (e) => {
    e.target.classList.remove("border-rose-500");
    if (state.isHost && state.roomCode) {
      state.roomPassword = e.target.value.trim();
      const roomTag = document.getElementById("p2p-room-tag");
      if (roomTag) roomTag.textContent = `房號: ${state.roomCode} (Host${state.roomPassword ? " 🔒" : ""})`;
      updateRoomShareLinksUI();
      saveActiveSessionToStorage();
    }
  };
  document.getElementById("p2p-password-input")?.addEventListener("input", onHostPasswordInput);
  document.getElementById("p2p-host-password-input")?.addEventListener("input", onHostPasswordInput);

  document.getElementById("p2p-room-code-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") joinP2PRoom();
  });
  document.getElementById("p2p-password-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") joinP2PRoom();
  });
  document.getElementById("p2p-host-password-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") hostP2PRoom();
  });

  const bindShareCopyButton = (btnId, inputId, labelText) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener("click", () => {
      const input = document.getElementById(inputId);
      if (!input || !input.value || input.value.includes("尚未建立")) {
        setFeedback("⚠️ 請先建立或加入房間後再複製邀請連結！", "warn");
        return;
      }
      const origText = btn.textContent;
      const done = () => {
        btn.textContent = "✓ 已複製!";
        setTimeout(() => { btn.textContent = origText; }, 1400);
      };
      try {
        navigator.clipboard.writeText(input.value).then(done).catch(() => {
          done();
        });
      } catch (_) {
        done();
      }
      const statusEl = document.getElementById("p2p-modal-status");
      if (statusEl) statusEl.textContent = `已複製「${labelText}」！發送給好友即可進入`;
      setFeedback(`🔗 已複製「${labelText}」至剪貼簿！`, "success");
    });
  };

  bindShareCopyButton("btn-copy-p2p-url-spectate", "p2p-share-url-spectate", "👁️ 觀戰邀請連結");
  bindShareCopyButton("btn-copy-p2p-url-play", "p2p-share-url-play", "🎮 參賽邀請連結");
  bindShareCopyButton("btn-copy-p2p-url", "p2p-share-url", "房間邀請連結");

  document.getElementById("btn-p2p-toggle-ready").addEventListener("click", () => {
    toggleP2PReady();
  });

  // Live Synced Nickname Inputs (Top Bar & Room Connect Box)
  ["top-nickname-input", "p2p-nickname-input"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("compositionstart", () => { state.isImeComposing = true; });
    el.addEventListener("compositionend", (e) => {
      state.isImeComposing = false;
      updateLocalNicknameAndSync(e.target.value);
    });
    el.addEventListener("input", (e) => {
      if (e.isComposing || state.isImeComposing) return;
      updateLocalNicknameAndSync(e.target.value);
    });
    el.addEventListener("change", (e) => {
      updateLocalNicknameAndSync(e.target.value);
    });
  });

  // Fair Rules Change Listeners (Host Room Window)
  const handleLayerRuleChange = (label, autoLock = false) => {
    if (!canLocalModifyGameConfig()) return;
    const lruleEl = document.getElementById("p2p-layer-rule-select");
    const flayerEl = document.getElementById("p2p-forced-layer-select");
    const rruleEl = document.getElementById("p2p-rail-rule-select");
    const bruleEl = document.getElementById("p2p-border-rule-select");
    // Picking a specific basemap implies locking to it so both host and guests actually switch.
    if (autoLock && lruleEl && lruleEl.value !== "locked") {
      lruleEl.value = "locked";
    }
    const lrule = lruleEl ? lruleEl.value : state.p2pLayerRule;
    const flayer = flayerEl ? flayerEl.value : state.p2pForcedLayer;
    const rrule = rruleEl ? rruleEl.value : state.p2pRailRule;
    const brule = bruleEl ? bruleEl.value : state.p2pBorderRule;
    if (state.isHost && state.roomCode) {
      requestOrApplyConfigChange({ layerRule: lrule, forcedLayer: flayer, railRule: rrule, borderRule: brule }, label);
      return;
    }
    applyP2PLayerRule(lrule, flayer, rrule, brule);
    if (typeof renderRoomConciseSettingsSummary === "function") renderRoomConciseSettingsSummary();
  };
  document.getElementById("p2p-layer-rule-select")?.addEventListener("change", () => handleLayerRuleChange("底圖限制", false));
  document.getElementById("p2p-forced-layer-select")?.addEventListener("change", () => handleLayerRuleChange("指定底圖", true));
  document.getElementById("p2p-rail-rule-select")?.addEventListener("change", () => handleLayerRuleChange("路網規則", false));
  document.getElementById("p2p-border-rule-select")?.addEventListener("change", () => handleLayerRuleChange("區界限制", false));


  // Host Start Battle
  document.getElementById("btn-p2p-sync-start").addEventListener("click", () => {
    if (!state.isHost) return;
    const nonHostPlayers = typeof getNonHostBattlePlayers === "function" ? getNonHostBattlePlayers() : [];
    const spectators = typeof getSpectators === "function" ? getSpectators() : [];
    const hasOpponents = nonHostPlayers.length > 0 || state.aiRivalActive;
    const isSpectatedSolo = !hasOpponents && spectators.length > 0;
    if (!hasOpponents && !isSpectatedSolo) {
      setFeedback("⚠️ 請等待至少一位參賽選手或觀戰者加入房間！", "warn");
      return;
    }
    const allReady =
      isSpectatedSolo ||
      (nonHostPlayers.length > 0 && nonHostPlayers.every((p) => p.isReady)) ||
      (state.aiRivalActive && state.opponent.isReady);
    if (!allReady) {
      setFeedback("⚠️ 請等待所有參賽選手點擊「準備」，再開始對戰！", "warn");
      return;
    }
    const payload = getHostSyncConfig(false, "", "", true);
    startSynchronizedP2PCountdown(payload, true);
  });
  document.getElementById("btn-quick-sim-rival").addEventListener("click", () => toggleAiRivalSimulation());

  // Settlement & Report Card Modal Events
  document.getElementById("btn-download-settlement")?.addEventListener("click", () => downloadSettlementCard());
  document.getElementById("btn-share-settlement")?.addEventListener("click", () => shareSettlementCard());
  document.getElementById("btn-return-lobby-settlement")?.addEventListener("click", () => {
    if (typeof requestReturnToLobby === "function") {
      requestReturnToLobby();
    }
  });
  document.getElementById("btn-rematch-settlement")?.addEventListener("click", () => requestP2PRematch());
  document.getElementById("btn-close-settlement")?.addEventListener("click", () => {
    document.getElementById("modal-settlement")?.classList.add("hidden");
    if (state.isGameOver) document.getElementById("btn-reopen-settlement")?.classList.remove("hidden");
  });
  document.getElementById("btn-review-map")?.addEventListener("click", () => {
    document.getElementById("modal-settlement")?.classList.add("hidden");
    if (state.isGameOver) document.getElementById("btn-reopen-settlement")?.classList.remove("hidden");
  });
  document.getElementById("btn-reopen-settlement")?.addEventListener("click", () => {
    showSettlementModal();
  });

  // Opponent Finished Choice Dialog
  document.getElementById("btn-opp-finish-continue")?.addEventListener("click", () => {
    document.getElementById("modal-opponent-finished")?.classList.add("hidden");
    setFeedback("⚔️ 其他選手已結束，你可繼續作答衝刺高分，或隨時點擊上方【結束看答案】結算勝負！", "info");
  });
  document.getElementById("btn-opp-finish-settle")?.addEventListener("click", () => {
    document.getElementById("modal-opponent-finished")?.classList.add("hidden");
    finishGame("giveup");
  });

  // Rematch Confirmation Dialog
  document.getElementById("btn-rematch-accept")?.addEventListener("click", () => respondP2PRematch(true));
  document.getElementById("btn-rematch-decline")?.addEventListener("click", () => respondP2PRematch(false));

  // Timer Modal
  document.getElementById("btn-timer-mode").addEventListener("click", () => {
    if (!canLocalModifyGameConfig()) {
      setFeedback("🔒 多人連線模式下，僅房主可調整計時模式！", "warn");
      return;
    }
    document.getElementById("modal-timer").classList.remove("hidden");
  });
  document.getElementById("btn-close-timer").addEventListener("click", () => {
    document.getElementById("modal-timer").classList.add("hidden");
  });
  document.querySelectorAll(".timer-preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!canLocalModifyGameConfig()) return;
      const mode = btn.getAttribute("data-timermode");
      const sec = parseInt(btn.getAttribute("data-sec"), 10) || 300;
      document.getElementById("modal-timer").classList.add("hidden");
      if (state.isHost && state.roomCode) {
        requestOrApplyConfigChange({ timerMode: mode, countdownTotalSec: sec }, "計時模式");
        return;
      }
      state.timerMode = mode;
      state.countdownTotalSec = sec;
      document.getElementById("btn-timer-mode").textContent =
        mode === "up" ? "正計時" : `倒數 ${Math.round(sec / 60)}m`;
      syncConfigButtonsUI();
      resetGame();
      if (typeof renderRoomConciseSettingsSummary === "function") renderRoomConciseSettingsSummary();
      if (state.isHost && state.roomCode) onHostSettingChange("計時模式");
    });
  });
  document.getElementById("btn-apply-custom-timer").addEventListener("click", () => {
    if (!canLocalModifyGameConfig()) return;
    const mins = Math.max(1, parseInt(document.getElementById("custom-countdown-min").value, 10) || 5);
    document.getElementById("modal-timer").classList.add("hidden");
    if (state.isHost && state.roomCode) {
      requestOrApplyConfigChange({ timerMode: "down", countdownTotalSec: mins * 60 }, "自訂倒數時間");
      return;
    }
    state.timerMode = "down";
    state.countdownTotalSec = mins * 60;
    document.getElementById("btn-timer-mode").textContent = `倒數 ${mins}m`;
    syncConfigButtonsUI();
    resetGame();
    if (typeof renderRoomConciseSettingsSummary === "function") renderRoomConciseSettingsSummary();
    if (state.isHost && state.roomCode) onHostSettingChange("自訂倒數時間");
  });

  // Audio & Info Modals
  document.getElementById("btn-audio-toggle").addEventListener("click", (e) => {
    state.soundEnabled = !state.soundEnabled;
    const icon = document.getElementById("audio-toggle-icon");
    if (icon) {
      icon.textContent = state.soundEnabled ? "🔊" : "🔇";
    }
    e.currentTarget.className = state.soundEnabled
      ? "p-1 sm:p-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-sky-400 border border-sky-500/40 transition"
      : "p-1 sm:p-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-400 border border-slate-700 transition";
    setFeedback(state.soundEnabled ? "🔊 已開啟音效" : "🔇 已靜音關閉音效", "info");
    if (window.lucide) lucide.createIcons();
  });
  document.getElementById("btn-toggle-unlocked-list").addEventListener("click", () => openUnlockedAndHelpModal("list"));
  document.getElementById("btn-open-help").addEventListener("click", () => openUnlockedAndHelpModal("help"));
  document.getElementById("btn-close-info").addEventListener("click", () => {
    document.getElementById("modal-info").classList.add("hidden");
  });
}

let _appBootstrapped = false;
function bootstrapGeoMasterApp() {
  if (_appBootstrapped) return;
  _appBootstrapped = true;
  if (window.lucide) lucide.createIcons();
  bindAllUIEvents();
  initMap();
  initPrecisionRailAndStationEngine();
  if (typeof initPoiMapEngine === "function") initPoiMapEngine();
  initP2PEngine();
  applyActivePackFeatureGatingUI();
  renderMapPackSwitcherUI();
  renderScopeModalGrid();
  updatePrefixDropdownUI();
  updateScoreAndProgressUI();
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", bootstrapGeoMasterApp);
} else {
  bootstrapGeoMasterApp();
}
