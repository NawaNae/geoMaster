// ============================================================================
// 10. P2P WEBRTC ENGINE (Multiplayer >2, Spectator View, Session, Host Handover & Kick/Ban)
// ============================================================================
function _p2pPack() {
  return typeof getActiveMapPack === "function" ? getActiveMapPack() : null;
}

function _p2pPackId() {
  const p = _p2pPack();
  return (p && p.id) || (typeof state !== "undefined" && state.activeMapPackId) || "tw_modern";
}

function _p2pIsTwModern() {
  return _p2pPackId() === "tw_modern";
}

function _p2pItems() {
  if (typeof getActiveItems === "function") return getActiveItems();
  return typeof ALL_TOWNS !== "undefined" ? ALL_TOWNS : [];
}

function _p2pGroups() {
  if (typeof getActiveGroups === "function") return getActiveGroups();
  return typeof TAIWAN_ADMIN_DATA !== "undefined" ? TAIWAN_ADMIN_DATA : [];
}

function _p2pFeatures() {
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

function _p2pUnitLabels() {
  if (typeof getActivePackUnitLabels === "function") return getActivePackUnitLabels();
  return { group: "縣市", item: "鄉鎮市區", itemShort: "區", fullScopeLabel: "全台 368 區" };
}

function _p2pIsSingleLayer() {
  if (typeof isActivePackSingleLayer === "function") return isActivePackSingleLayer();
  return false;
}

function _p2pUnlockViewport(opts) {
  if (typeof unlockMapViewportToPack === "function") {
    unlockMapViewportToPack(opts);
  } else if (typeof unlockMapViewportToTaiwan === "function") {
    unlockMapViewportToTaiwan(opts);
  }
}

function isMultiplayerActive() {
  return Boolean(
    state.roomCode ||
    state.opponent.connected ||
    state.aiRivalTimer ||
    state.aiRivalActive
  );
}

function getParticipantList() {
  return Object.values(state.players || {});
}

function getActiveBattlePlayers() {
  return getParticipantList().filter((p) => (p.role === "host" || p.role === "player") && !p.disconnected);
}

function getNonHostBattlePlayers() {
  return getParticipantList().filter((p) => p.role === "player" && !p.disconnected);
}

function getSpectators() {
  return getParticipantList().filter((p) => p.role === "spectator" && !p.disconnected);
}

function getLocalGrandCounts() {
  const allItems = _p2pItems();
  const features = _p2pFeatures();
  const scopeCounties = getScopeCounties();
  const scopeTowns = getScopeTowns();
  const regionTotal = state.difficulty === "county_only" ? scopeCounties.length : scopeTowns.length;
  const regionCurrent =
    state.difficulty === "county_only"
      ? Array.from(state.unlockedCounties).filter((c) => state.selectedCounties.has(c)).length
      : Array.from(state.unlockedTowns).filter((id) => {
          const t = allItems.find((x) => x.id === id);
          return t && (typeof isTownInScope === "function" ? isTownInScope(t) : state.selectedCounties.has(t.countyName));
        }).length;

  const activeSt = features.supportsTransportQuiz && typeof getActiveQuizStations === "function" ? getActiveQuizStations() : [];
  const stationTotal = activeSt.length;
  const stationCurrent = activeSt.filter((s) => state.unlockedStations.has(s.key)).length;
  const activePois = (features.supportsPoiQuiz || features.supportsCapitalQuiz) && typeof getActiveQuizPois === "function" ? getActiveQuizPois() : [];
  const poiTotal = activePois.length;
  const poiCurrent = activePois.filter((p) => state.unlockedPois.has(p.id)).length;
  const macroProgress = {};
  if (regionTotal > 0) {
    macroProgress["地區"] = { cur: regionCurrent, tot: regionTotal };
  }
  if (features.supportsTransportQuiz && activeSt.length > 0) {
    ["台鐵", "高鐵", "捷運", "輕軌", "纜車", "林鐵", "糖鐵"].forEach((k) => {
      const mStations = activeSt.filter((s) => s.macro === k);
      if (mStations.length > 0) {
        macroProgress[k] = {
          cur: mStations.filter((s) => state.unlockedStations.has(s.key)).length,
          tot: mStations.length
        };
      }
    });
  }
  if ((features.supportsPoiQuiz || features.supportsCapitalQuiz) && activePois.length > 0) {
    const capMacroLbl = typeof getPoiCategoryLabel === "function" ? getPoiCategoryLabel("capital") : "首都";
    [
      ["airport", "機場"],
      ["port", "港口"],
      ["reservoir", "水庫"],
      ["lake", "湖泊"],
      ["settlement", "傳統聚落"],
      ["capital", capMacroLbl]
    ].forEach(([catKey, label]) => {
      const catList = typeof getActiveQuizPois === "function" ? getActiveQuizPois(catKey) : activePois.filter((p) => p.category === catKey);
      if (catList.length > 0) {
        macroProgress[label] = {
          cur: catList.filter((p) => state.unlockedPois.has(p.id)).length,
          tot: catList.length
        };
      }
    });
  }

  const rawGrandCurrent = regionCurrent + stationCurrent + poiCurrent;
  const rawGrandTotal = regionTotal + stationTotal + poiTotal;
  const limitedStats =
    typeof getLimitedRoundStats === "function"
      ? getLimitedRoundStats(state, { grandCurrent: rawGrandCurrent, grandTotal: rawGrandTotal })
      : null;

  if (limitedStats) {
    const limitedMacro = {};
    if (limitedStats.regionTotal > 0) {
      limitedMacro["地區"] = { cur: limitedStats.regionCurrent, tot: limitedStats.regionTotal };
    }
    if (limitedStats.stationTotal > 0) {
      limitedMacro["車站"] = { cur: limitedStats.stationCurrent, tot: limitedStats.stationTotal };
    }
    if (limitedStats.poiTotal > 0) {
      limitedMacro["地標"] = { cur: limitedStats.poiCurrent, tot: limitedStats.poiTotal };
    }
    return {
      regionCurrent: limitedStats.regionCurrent,
      regionTotal: limitedStats.regionTotal,
      stationCurrent: limitedStats.stationCurrent,
      stationTotal: limitedStats.stationTotal,
      poiCurrent: limitedStats.poiCurrent,
      poiTotal: limitedStats.poiTotal,
      grandCurrent: limitedStats.grandCurrent,
      grandTotal: limitedStats.grandTotal,
      macroProgress: limitedMacro
    };
  }

  return {
    regionCurrent,
    regionTotal,
    stationCurrent,
    stationTotal,
    poiCurrent,
    poiTotal,
    grandCurrent: rawGrandCurrent,
    grandTotal: rawGrandTotal,
    macroProgress
  };
}

function syncAllNicknameInputs(newName) {
  const clean = (newName || "").trim() || state.nickname || "GeoMasterTW";
  state.nickname = clean;
  try {
    localStorage.setItem("tw_geomaster_nickname", clean);
  } catch (_) {}
  ["top-nickname-input", "p2p-nickname-input", "join-entry-nickname-input"].forEach((id) => {
    const el = document.getElementById(id);
    if (el && document.activeElement !== el) {
      el.value = clean;
    }
  });
}

function updateLocalNicknameAndSync(newName) {
  const clean = (newName || "").trim() || "玩家";
  syncAllNicknameInputs(clean);
  if (state.roomCode || state.aiRivalActive) {
    ensureLocalPlayerInRoster();
    if (state.isHost) {
      broadcastRosterFromHost();
    } else if (state.roomCode) {
      sendP2PMessage("SYNC_READY_STATUS", { ready: state.isReady, name: state.nickname });
    }
    updateP2PLobbyUI();
    updateOpponentUI();
  }
}

function ensureLocalPlayerInRoster() {
  if (!state.roomCode && !state.aiRivalActive) return;
  const counts = getLocalGrandCounts();
  const myName =
    state.nickname ||
    document.getElementById("top-nickname-input")?.value.trim() ||
    document.getElementById("p2p-nickname-input")?.value.trim() ||
    (state.isHost ? "房主" : "玩家");
  syncAllNicknameInputs(myName);

  const existing = state.players[state.localInstanceId] || {};
  state.players[state.localInstanceId] = {
    ...existing,
    id: state.localInstanceId,
    deviceId: state.deviceId,
    name: myName,
    role: state.isHost ? "host" : state.role === "spectator" ? "spectator" : "player",
    isReady: state.isHost ? true : Boolean(state.isReady),
    disconnected: false,
    finished: Boolean(state.finished),
    finishReason: state.finalStats?.reason || existing.finishReason || null,
    score: counts.regionCurrent,
    total: counts.regionTotal,
    stationScore: counts.stationCurrent,
    stationTotal: counts.stationTotal,
    macroProgress: counts.macroProgress,
    finalStats: state.finalStats || existing.finalStats || null,
    unlockedTowns: Array.from(state.unlockedTowns),
    unlockedCounties: Array.from(state.unlockedCounties),
    unlockedProvinces: Array.from(state.unlockedProvinces),
    missedTowns: Array.from(state.missedTowns),
    unlockedStations: Array.from(state.unlockedStations),
    missedStations: Array.from(state.missedStations),
    unlockedPois: Array.from(state.unlockedPois || []),
    missedPois: Array.from(state.missedPois || []),
    targetId: state.targetId,
    targetStationKey: state.targetStationKey,
    targetPoiId: state.targetPoiId,
    elapsedSec: state.elapsedSec || 0,
    stats: { ...state.stats },
    _viewSets: null
  };
  saveActiveSessionToStorage();
}

function getSortedActiveBattlePlayers() {
  const active = getActiveBattlePlayers();
  if (typeof sortBattlePlayers === "function") {
    return sortBattlePlayers(active);
  }
  return [...active].sort((a, b) => {
    const aTot = (a.total || 0) + (a.stationTotal || 0);
    const bTot = (b.total || 0) + (b.stationTotal || 0);
    const aCur = (a.score || 0) + (a.stationScore || 0);
    const bCur = (b.score || 0) + (b.stationScore || 0);
    const aPct = aTot > 0 ? aCur / aTot : 0;
    const bPct = bTot > 0 ? bCur / bTot : 0;
    return bPct - aPct || bCur - aCur;
  });
}

function syncPrimaryOpponentFromRoster() {
  const sorted = getSortedActiveBattlePlayers();

  if (state.role === "spectator") {
    if (
      !state.spectatingPlayerId ||
      !state.players[state.spectatingPlayerId] ||
      state.players[state.spectatingPlayerId].role === "spectator"
    ) {
      state.spectatingPlayerId = sorted[0]?.id || null;
    }
  }

  const referencePlayerId = state.role === "spectator" ? state.spectatingPlayerId : state.localInstanceId;
  const others = sorted.filter((p) => p.id !== referencePlayerId);

  if (others.length === 0) {
    if (!state.aiRivalActive) {
      state.opponent.connected = false;
      state.opponent.name = "尚無對手";
      state.opponent.isReady = false;
      state.opponent.score = 0;
      state.opponent.total = 0;
      state.opponent.stationScore = 0;
      state.opponent.stationTotal = 0;
      state.opponent.macroProgress = {};
      state.opponent.finished = false;
      state.opponent.finalStats = null;
    }
    return;
  }

  const primary = others[0];
  state.opponent.connected = true;
  state.opponent.name = primary.name || "對手";
  state.opponent.isReady = Boolean(primary.isReady);
  state.opponent.score = primary.score || 0;
  state.opponent.total = primary.total || 0;
  state.opponent.stationScore = primary.stationScore || 0;
  state.opponent.stationTotal = primary.stationTotal || 0;
  state.opponent.macroProgress = primary.macroProgress || {};
  state.opponent.finished = Boolean(primary.finished);
  state.opponent.finalStats = primary.finalStats || null;
}

function getHostSyncConfig(isSettingChange = false, changeLabel = "", changeDetail = "", includeTargetQueue = false) {
  const lruleEl = document.getElementById("p2p-layer-rule-select");
  const flayerEl = document.getElementById("p2p-forced-layer-select");
  const rruleEl = document.getElementById("p2p-rail-rule-select");
  const bruleEl = document.getElementById("p2p-border-rule-select");
  const allItems = _p2pItems();
  return {
    mapPackId: state.activeMapPackId || "tw_modern",
    packOptions: {
      worldIncludeMicrostates: state.packOptions ? state.packOptions.worldIncludeMicrostates !== false : true,
      cnAllowSingleCharAlias: Boolean(state.packOptions && state.packOptions.cnAllowSingleCharAlias),
      rocTerritoryVariant: state.packOptions && state.packOptions.rocTerritoryVariant === "no_mongolia" ? "no_mongolia" : "begonia_full",
      includeMunicipalities: state.packOptions ? state.packOptions.includeMunicipalities !== false : true,
      showDisputedBorders: state.packOptions ? state.packOptions.showDisputedBorders !== false : true
    },
    quizTargetMode: typeof syncLegacyQuizTargetMode === "function" ? syncLegacyQuizTargetMode() : (state.quizTargetMode || "region"),
    regionQuizEnabled: Boolean(state.regionQuizEnabled),
    stationQuizEnabled: Boolean(state.stationQuizEnabled),
    airportQuizEnabled: Boolean(state.airportQuizEnabled),
    portQuizEnabled: Boolean(state.portQuizEnabled),
    reservoirQuizEnabled: Boolean(state.reservoirQuizEnabled),
    lakeQuizEnabled: Boolean(state.lakeQuizEnabled),
    settlementQuizEnabled: Boolean(state.settlementQuizEnabled),
    capitalQuizEnabled: Boolean(state.capitalQuizEnabled),
    landmarkQuizEnabled: Boolean(state.landmarkQuizEnabled),
    airportSubTypes: Array.from(state.airportSubTypes || []),
    portSubTypes: Array.from(state.portSubTypes || []),
    reservoirSubTypes: Array.from(state.reservoirSubTypes || []),
    lakeSubTypes: Array.from(state.lakeSubTypes || []),
    settlementSubTypes: Array.from(state.settlementSubTypes || []),
    showStationTerminusHints: Boolean(state.showStationTerminusHints),
    filterStationsByRegion: Boolean(state.filterStationsByRegion),
    allowTargetHints: Boolean(state.allowTargetHints),
    selectedCounties: state.regionQuizEnabled ? Array.from(state.selectedCounties) : [],
    selectedTownIds: state.regionQuizEnabled
      ? (state.selectedTownIds
          ? Array.from(state.selectedTownIds)
          : allItems.filter((t) => state.selectedCounties.has(t.countyName)).map((t) => t.id))
      : [],
    quizStationLines: state.stationQuizEnabled ? Array.from(state.quizStationLines) : [],
    difficulty: state.difficulty,
    playMode: state.playMode === "pin_drop" ? "free" : state.playMode,
    targetQuestionLimit: Math.max(0, parseInt(state.targetQuestionLimit, 10) || 0),
    allowPass: state.allowPass !== false,
    hideGuessedOthers: Boolean(state.hideGuessedOthers),
    questionCountdownEnabled: Boolean(state.questionCountdownEnabled),
    questionCountdownMode: state.questionCountdownMode === "normal" ? "normal" : "rush",
    questionCountdownSec: Math.max(3, parseInt(state.questionCountdownSec, 10) || 15),
    rushGraceSec: Math.max(2, parseInt(state.rushGraceSec, 10) || 5),
    sharedTargetQueue:
      includeTargetQueue &&
      (state.playMode === "target_random" || state.playMode === "satellite_quiz") &&
      typeof buildTargetQuizQueue === "function"
        ? buildTargetQuizQueue(state.targetQuestionLimit)
        : undefined,
    satelliteStyle: state.satelliteStyle || "day",
    satelliteLockViewport: Boolean(state.satelliteLockViewport),
    timerMode: state.timerMode,
    countdownTotalSec: state.countdownTotalSec,
    layerRule: lruleEl ? lruleEl.value : state.p2pLayerRule,
    forcedLayer: flayerEl ? flayerEl.value : state.p2pForcedLayer,
    railRule: rruleEl ? rruleEl.value : state.p2pRailRule,
    borderRule: bruleEl ? bruleEl.value : state.p2pBorderRule,
    isSettingChange: Boolean(isSettingChange),
    changeLabel: changeLabel || "",
    changeDetail: changeDetail || ""
  };
}

// ============================================================================
// CONCISE ROOM SETTINGS SUMMARY GENERATOR (Only shows selected items!)
// ============================================================================
function getConciseDifficultySummaryText() {
  const isTw = _p2pIsTwModern();
  const unitLabels = _p2pUnitLabels();
  const allGroups = _p2pGroups();
  const features = _p2pFeatures();
  const diffMap = isTw
    ? {
        casual: "一般模式（免輸入鄉鎮市區後綴，同名一次解鎖）",
        county_only: `縣市模式（僅猜 ${allGroups.length} 縣市與直轄市，未解鎖隱藏）`,
        hard_suffix: "進階後綴模式（免縣市前綴，需輸入鄉鎮市區單位）",
        hard_full: "困難全名模式（需輸入完整縣市＋鄉鎮市區單位）",
        master_hierarchy: "困難模式（需先輸入省、直轄市，精確輸入鄉鎮市區單位）"
      }
    : {
        casual: features.supportsSuffixDifficulty
          ? `一般模式（免輸入${unitLabels.item}後綴，同名一次解鎖）`
          : `一般模式（輸入${unitLabels.item}名稱即可解鎖）`,
        county_only: `${unitLabels.group}模式（僅猜 ${allGroups.length} ${unitLabels.group}，未解鎖隱藏）`,
        hard_suffix: `進階後綴模式（免${unitLabels.group}前綴，需輸入${unitLabels.item}單位）`,
        hard_full: `困難全名模式（需輸入完整${unitLabels.group}＋${unitLabels.item}名稱）`,
        master_hierarchy: `困難模式（需依階層完整輸入${unitLabels.item}名稱）`
      };
  const satStyleMap = {
    day: "日間衛星",
    night: "夜間燈火",
    hybrid: "日夜混合"
  };
  const satLockStr = state.satelliteLockViewport ? "鎖定視野" : "自由視野";
  const pmMap = {
    free: "",
    target_random: " · 隨機指定區塊",
    target_click: " · 點選指定區塊",
    satellite_quiz: ` · 🛰️ 衛星影像猜題（${satStyleMap[state.satelliteStyle] || "日間衛星"} · ${satLockStr}）`
  };
  const isRnd = state.playMode === "target_random" || state.playMode === "satellite_quiz";
  const qLimit = Math.max(0, parseInt(state.targetQuestionLimit, 10) || 0);
  const limitStr = isRnd && qLimit > 0 ? ` · 限 ${qLimit} 題` : "";
  const passStr = isRnd && state.allowPass === false ? " · 禁略過" : "";
  const hideStr = state.hideGuessedOthers ? " · 隱藏已猜區塊" : "";
  const rushStr =
    isRnd && state.questionCountdownEnabled
      ? state.questionCountdownMode === "normal"
        ? ` · ⏳ 每題倒數 ${Math.max(3, parseInt(state.questionCountdownSec, 10) || 15)}秒`
        : ` · ⚡ 倒數搶答 ${Math.max(3, parseInt(state.questionCountdownSec, 10) || 15)}秒`
      : "";
  const timerStr =
    state.timerMode === "down"
      ? ` · 限時 ${Math.round((state.countdownTotalSec || 300) / 60)} 分鐘`
      : "";
  return `${diffMap[state.difficulty] || diffMap.casual}${pmMap[state.playMode] || ""}${limitStr}${passStr}${hideStr}${rushStr}${timerStr}`;
}

function getConciseRegionSummaryText() {
  if (state.quizTargetMode === "station" || state.selectedCounties.size === 0) return "";
  const allItems = _p2pItems();
  const allGroups = _p2pGroups();
  const unitLabels = _p2pUnitLabels();
  const pack = _p2pPack();
  const townIds =
    state.selectedTownIds instanceof Set
      ? state.selectedTownIds
      : new Set(allItems.filter((t) => state.selectedCounties.has(t.countyName)).map((t) => t.id));
  if (townIds.size === 0) return "";

  if (!_p2pIsTwModern()) {
    const eligibleItems = typeof getPackEligibleItems === "function" ? getPackEligibleItems(pack, state) : allItems;
    const eligibleCount = eligibleItems.length;
    if (eligibleCount > 0 && townIds.size === eligibleCount && eligibleItems.every((it) => townIds.has(it.id))) {
      if (pack && pack.id === "world_countries" && state.packOptions && state.packOptions.worldIncludeMicrostates === false) {
        return `標準版全境（共 ${eligibleCount} ${unitLabels.itemShort}）`;
      }
      return unitLabels.fullScopeLabel || (pack && (pack.displayName || pack.shortLabel)) || `全境（共 ${eligibleCount} ${unitLabels.itemShort}）`;
    }
    const filters = typeof getActiveRegionFilters === "function" ? getActiveRegionFilters() : [];
    const nonAllFilters = filters
      .filter((f) => f && f.id !== "all")
      .map((f) => ({
        label: f.shortLabel || f.label || f.id,
        ids: typeof resolveRegionFilterItemIds === "function"
          ? resolveRegionFilterItemIds(f, eligibleItems, state)
          : (Array.isArray(f.itemIds) ? f.itemIds : [])
      }))
      .filter((f) => f.ids.length > 0);

    for (const f of nonAllFilters) {
      if (f.ids.length === townIds.size && f.ids.every((id) => townIds.has(id))) {
        return f.label;
      }
    }

    const matchedLabels = [];
    const covered = new Set();
    nonAllFilters.forEach((f) => {
      if (f.ids.every((id) => townIds.has(id))) {
        matchedLabels.push(f.label);
        f.ids.forEach((id) => covered.add(id));
      }
    });
    if (matchedLabels.length > 0 && covered.size === townIds.size) {
      return matchedLabels.join("、");
    }

    if (_p2pIsSingleLayer()) {
      const selGroups = allGroups.filter((g) => state.selectedCounties.has(g.name)).map((g) => g.short || g.name);
      if (allGroups.length > 1 && selGroups.length > 0 && selGroups.length < allGroups.length) {
        return `${selGroups.join("、")}（共 ${townIds.size} ${unitLabels.itemShort}）`;
      }
      return `自選 ${townIds.size} ${unitLabels.itemShort}`;
    }

    const groupNames = allGroups.filter((c) => state.selectedCounties.has(c.name)).map((c) => c.short || c.name);
    return `${groupNames.join("、")}（共 ${townIds.size} ${unitLabels.itemShort}）`;
  }

  if (townIds.size === allItems.length) return "全臺";

  const checkExact = (arr) => arr.length === townIds.size && arr.every((id) => townIds.has(id));

  const northIds = allItems.filter((t) => ["臺北市", "新北市", "基隆市", "新竹市", "桃園市", "新竹縣", "宜蘭縣"].includes(t.countyName)).map((t) => t.id);
  const centralIds = allItems.filter((t) => ["苗栗縣", "臺中市", "彰化縣", "南投縣", "雲林縣"].includes(t.countyName)).map((t) => t.id);
  const southIds = allItems.filter((t) => ["嘉義市", "嘉義縣", "臺南市", "高雄市", "屏東縣", "澎湖縣"].includes(t.countyName)).map((t) => t.id);
  const eastIds = allItems.filter((t) => ["花蓮縣", "臺東縣"].includes(t.countyName)).map((t) => t.id);
  const islandIds = allItems.filter((t) => ["澎湖縣", "金門縣", "連江縣"].includes(t.countyName)).map((t) => t.id);
  const mountainIds = allItems.filter((t) => TAIWAN_MOUNTAIN_SET.has(t.fullCountyTown)).map((t) => t.id);
  const westPlainIds = allItems.filter((t) => TAIWAN_WEST_PLAIN_SET.has(t.fullCountyTown)).map((t) => t.id);
  const eastPlainIds = allItems.filter((t) => typeof TAIWAN_EAST_PLAIN_SET !== "undefined" && TAIWAN_EAST_PLAIN_SET.has(t.fullCountyTown)).map((t) => t.id);
  const westCoastIds = allItems.filter((t) => TAIWAN_WEST_COAST_SET.has(t.fullCountyTown)).map((t) => t.id);
  const eastCoastIds = allItems.filter((t) => TAIWAN_EAST_COAST_SET.has(t.fullCountyTown)).map((t) => t.id);
  const sixIds = allItems.filter((t) => t.isSpecial).map((t) => t.id);
  const westIds = allItems.filter((t) => TAIWAN_WEST_COUNTY_SET.has(t.countyName)).map((t) => t.id);

  if (checkExact(northIds)) return "北部全";
  if (checkExact(centralIds)) return "中部全";
  if (checkExact(southIds)) return "南部全";
  if (checkExact(eastIds)) return "東部全";
  if (checkExact(islandIds)) return "外島全";
  if (checkExact(mountainIds)) return "山區鄉鎮";
  if (checkExact(westPlainIds)) return "西部平原";
  if (checkExact(eastPlainIds)) return "東部平原";
  if (checkExact(westCoastIds)) return "西部濱海";
  if (checkExact(eastCoastIds)) return "東部濱海";
  if (checkExact(sixIds)) return "六都直轄市";
  if (checkExact(westIds)) return "西部地區";

  // Check combinations of major regions
  const matchedLabels = [];
  const covered = new Set();
  const groups = [
    { label: "北部全", ids: northIds },
    { label: "中部全", ids: centralIds },
    { label: "南部全", ids: southIds },
    { label: "東部全", ids: eastIds },
    { label: "外島", ids: islandIds },
    { label: "山區", ids: mountainIds },
    { label: "西部平原", ids: westPlainIds },
    { label: "東部平原", ids: eastPlainIds }
  ];
  groups.forEach((g) => {
    if (g.ids.length > 0 && g.ids.every((id) => townIds.has(id))) {
      matchedLabels.push(g.label);
      g.ids.forEach((id) => covered.add(id));
    }
  });
  if (matchedLabels.length > 0 && covered.size === townIds.size) {
    return matchedLabels.join("、");
  }

  // Otherwise list selected county short names
  const countyNames = allGroups.filter((c) => state.selectedCounties.has(c.name)).map((c) => c.short || c.name);
  return `${countyNames.join("、")}（共 ${townIds.size} 區）`;
}

function getConciseStationSummaryText() {
  if (!_p2pFeatures().supportsTransportQuiz) return "";
  if (state.quizTargetMode === "region" || !state.quizStationLines || state.quizStationLines.size === 0) return "";
  const sel = state.quizStationLines;
  const allNonHw = TAIWAN_SELECTABLE_LINES.filter((l) => !l.isHighway).map((l) => l.id);
  const allMainIds = TAIWAN_SELECTABLE_LINES.filter(
    (l) => !l.isHighway && !l.id.startsWith("gon_") && !l.id.startsWith("for_") && !l.id.startsWith("sug_")
  ).map((l) => l.id);

  if (allNonHw.every((id) => sel.has(id))) return "全臺所有車站（含鐵道、捷運、輕軌與觀光鐵道）";
  if (allMainIds.length === sel.size && allMainIds.every((id) => sel.has(id))) {
    return "全（不含休閒設施 纜車台車）";
  }

  const remaining = new Set(sel);
  const labels = [];

  const groupDefs = [
    { label: "北捷", ids: ["mrt_tpe_r", "mrt_tpe_bl", "mrt_tpe_g", "mrt_tpe_o", "mrt_tpe_br", "mrt_ntpc_y"] },
    { label: "高捷", ids: ["mrt_kh_r", "mrt_kh_o"] },
    { label: "中捷綠線", ids: ["mrt_tc_g"] },
    { label: "桃捷", ids: ["mrt_ty_a"] },
    { label: "三鶯線", ids: ["mrt_ntpc_lb"] },
    { label: "高鐵", ids: ["thsr_main"] },
    { label: "台鐵西部主線（山海）", ids: ["tra_west_n", "tra_mountain", "tra_coast", "tra_chengzhui", "tra_west_s", "tra_pingtung"] },
    { label: "台鐵東部主線", ids: ["tra_yilan", "tra_north_link", "tra_taitung", "tra_south_link"] },
    { label: "台鐵支線", ids: ["tra_pingxi", "tra_neiwan", "tra_jiji", "tra_shalun"] }
  ];

  groupDefs.forEach((g) => {
    if (g.ids.every((id) => remaining.has(id))) {
      labels.push(g.label);
      g.ids.forEach((id) => remaining.delete(id));
    }
  });

  const lineShortMap = {
    thsr_main: "高鐵",
    tra_west_n: "台鐵縱貫北段",
    tra_mountain: "台鐵山線",
    tra_coast: "台鐵海線",
    tra_chengzhui: "成追線",
    tra_west_s: "台鐵縱貫南段",
    tra_pingtung: "屏東線",
    tra_south_link: "南迴線",
    tra_taitung: "花東線",
    tra_north_link: "北迴線",
    tra_yilan: "宜蘭線",
    tra_pingxi: "平溪支線",
    tra_neiwan: "內灣支線",
    tra_jiji: "集集支線",
    tra_shalun: "沙崙支線",
    mrt_tpe_r: "北捷紅線",
    mrt_tpe_bl: "北捷藍線",
    mrt_tpe_g: "北捷綠線",
    mrt_tpe_o: "北捷橘線",
    mrt_tpe_br: "北捷文湖線",
    mrt_ntpc_y: "新北環狀線",
    mrt_ntpc_lb: "新北三鶯線",
    mrt_ty_a: "桃捷機場線",
    mrt_tc_g: "中捷綠線",
    mrt_kh_r: "高捷紅線",
    mrt_kh_o: "高捷橘線",
    lrt_danhai: "淡海輕軌",
    lrt_ankeng: "安坑輕軌",
    lrt_kaohsiung: "高雄輕軌",
    gon_maokong: "貓空纜車",
    gon_sunmoon: "日月潭纜車",
    gon_wulai: "烏來纜車",
    for_alishan: "阿里山林鐵",
    for_taipingshan: "太平山蹦蹦車",
    for_wulai_cart: "烏來台車",
    sug_suantou: "蒜頭糖鐵",
    sug_xihu: "溪湖糖鐵",
    sug_xinying: "新營糖鐵",
    sug_wushulin: "烏樹林糖鐵",
    sug_qiaotou: "橋頭糖鐵",
    sug_huwei: "虎尾糖鐵"
  };

  remaining.forEach((id) => {
    labels.push(lineShortMap[id] || id);
  });

  return labels.join("、");
}

function renderRoomConciseSettingsSummary() {
  const container = document.getElementById("room-concise-settings-list");
  if (!container) return;
  container.replaceChildren();

  const features = _p2pFeatures();
  const pack = _p2pPack();
  const packId = _p2pPackId();
  const registeredCount = typeof getRegisteredMapPacks === "function" ? getRegisteredMapPacks().length : 1;

  const rows = [];
  // 0. Map Pack Line (when multiple packs registered or non-tw_modern)
  if (registeredCount > 1 || packId !== "tw_modern") {
    const hasPack = (id) =>
      typeof hasActiveMapPack === "function" ? hasActiveMapPack(id) : packId === id;
    let packLabel = (pack && (pack.displayName || pack.shortLabel)) || packId;
    if (hasPack("world_countries")) {
      const includeMicro = !state.packOptions || state.packOptions.worldIncludeMicrostates !== false;
      const eligLen = typeof getPackEligibleItems === "function" ? getPackEligibleItems(pack, state).length : _p2pItems().length;
      packLabel = includeMicro
        ? `${packLabel} · 含微型國 (${eligLen || 196} 國)`
        : `${packLabel} · 標準版 (排除微型國${eligLen ? ` · ${eligLen} 國` : ""})`;
    } else if (hasPack("cn_prov") && state.packOptions && state.packOptions.cnAllowSingleCharAlias) {
      packLabel = `${packLabel} · 含一字簡稱`;
    } else if (hasPack("roc_1949")) {
      const noMng = state.packOptions && state.packOptions.rocTerritoryVariant === "no_mongolia";
      const noMuni = state.packOptions && state.packOptions.includeMunicipalities === false;
      const noDisp = state.packOptions && state.packOptions.showDisputedBorders === false;
      const eligLen = typeof getPackEligibleItems === "function" ? getPackEligibleItems(pack, state).length : _p2pItems().length;
      const tags = [noMng ? "不含蒙古" : "含蒙古", noMuni ? "不含院轄市" : "含12院轄市"];
      if (noDisp) tags.push("隱藏爭議界");
      packLabel = `${packLabel} · ${tags.join(" / ")} (${eligLen} 區)`;
    }
    rows.push({ label: "🗺️ 地圖：", text: packLabel, highlight: "text-cyan-200 font-bold" });
  }

  // 1. Difficulty & Mode Line
  rows.push({ label: null, text: getConciseDifficultySummaryText(), highlight: "text-amber-200 font-bold" });

  // 2. Region Line (Only if selected!)
  const regText = getConciseRegionSummaryText();
  if (regText) {
    rows.push({ label: "區域：", text: regText, highlight: "text-sky-200" });
  }

  // 3. Station Line (Only if supported and selected!)
  const stText = features.supportsTransportQuiz ? getConciseStationSummaryText() : "";
  if (stText) {
    const filterSuffix = state.filterStationsByRegion && state.regionQuizEnabled && state.selectedCounties.size > 0
      ? `（📍僅限所選區域內 ${typeof getActiveQuizStations === "function" ? getActiveQuizStations().length : ""} 站）`
      : "";
    rows.push({ label: "車站：", text: `${stText}${filterSuffix}`, highlight: "text-pink-200" });
  }

  // 3b. POI & Capital Lines (Only if supported and selected!)
  if ((features.supportsPoiQuiz || features.supportsCapitalQuiz) && typeof getConcisePoiSummaryParts === "function") {
    const poiParts = getConcisePoiSummaryParts();
    if (poiParts.length > 0) {
      const regNote = state.filterStationsByRegion && state.regionQuizEnabled && state.selectedCounties.size > 0
        ? "（📍僅限所選區域內）"
        : "";
      rows.push({ label: "地標：", text: `${poiParts.join(" · ")}${regNote}`, highlight: "text-teal-200" });
    }
  }

  // 4. Interface Restriction Line (Only if restricted / non-default!)
  const uiLimits = [];
  if (features.supportsTransportQuiz && state.showStationTerminusHints) uiLimits.push("顯示路線頭尾端點提示");
  if (state.allowTargetHints) uiLimits.push("開放指定/隨機模式提示");
  else if (state.playMode !== "free") uiLimits.push("禁用目標提示 (Ban)");
  if (features.supportsTransportQuiz) {
    if (state.p2pRailRule === "ban_roads_only") uiLimits.push("禁用公路路網");
    else if (state.p2pRailRule === "ban_rail") uiLimits.push("禁用軌道與公路路網");
    else if (state.p2pRailRule === "force_lines") uiLimits.push("強制開啟完整路網＋車站");
    else if (state.p2pRailRule === "force_rail_only") uiLimits.push("強制開啟純軌道路網");
  }
  if (uiLimits.length > 0) {
    rows.push({ label: "介面限制：", text: uiLimits.join("、"), highlight: "text-emerald-200" });
  }

  // 5. Layer Restriction Line (Only if locked!)
  if (state.p2pLayerRule === "locked") {
    const layerNames = {
      vector: "強制純淨向量底圖",
      terrain: "強制無字山地地形",
      satellite: "強制無字衛星影像"
    };
    rows.push({
      label: "圖層限制：",
      text: layerNames[state.p2pForcedLayer] || "強制鎖定底圖",
      highlight: "text-rose-200"
    });
  }

  rows.forEach((r) => {
    const div = document.createElement("div");
    div.className = "flex items-start gap-1";
    if (r.label) {
      const lbl = document.createElement("span");
      lbl.className = "text-slate-400 font-bold shrink-0";
      lbl.textContent = r.label;
      const val = document.createElement("span");
      val.className = `${r.highlight || "text-white"} font-semibold break-words`;
      val.textContent = r.text;
      div.appendChild(lbl);
      div.appendChild(val);
    } else {
      const val = document.createElement("span");
      val.className = `${r.highlight || "text-white"}`;
      val.textContent = r.text;
      div.appendChild(val);
    }
    container.appendChild(div);
  });
}

// ============================================================================
// SESSION PERSISTENCE BY DEVICE ID (重開網頁自動回到同一個 Session 與進度)
// ============================================================================
const SESSION_STORAGE_KEY_PREFIX = "tw_geomaster_session_";

function getSessionStorageKey() {
  return SESSION_STORAGE_KEY_PREFIX + (state.deviceId || state.localInstanceId);
}

function saveActiveSessionToStorage() {
  if (!state.roomCode) return;
  try {
    const snap = {
      deviceId: state.deviceId,
      instanceId: state.localInstanceId,
      roomCode: state.roomCode,
      roomPassword: state.roomPassword || "",
      isHost: Boolean(state.isHost),
      role: state.role,
      nickname: state.nickname,
      matchInProgress: Boolean(state.matchInProgress),
      isReady: Boolean(state.isReady),
      finished: Boolean(state.finished),
      finalStats: state.finalStats || null,
      elapsedSec: state.elapsedSec || 0,
      unlockedTowns: Array.from(state.unlockedTowns),
      unlockedCounties: Array.from(state.unlockedCounties),
      unlockedProvinces: Array.from(state.unlockedProvinces),
      missedTowns: Array.from(state.missedTowns),
      unlockedStations: Array.from(state.unlockedStations),
      missedStations: Array.from(state.missedStations),
      targetId: state.targetId || null,
      targetStationKey: state.targetStationKey || null,
      stats: { ...state.stats },
      config: getHostSyncConfig(false),
      bannedDevices: Array.from(state.bannedDevices || []),
      playersSnapshot: state.isHost ? state.players : null,
      savedAt: Date.now()
    };
    localStorage.setItem(getSessionStorageKey(), JSON.stringify(snap));
  } catch (_) {}
}

function loadSavedSessionFromStorage() {
  try {
    const raw = localStorage.getItem(getSessionStorageKey());
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.roomCode) return null;
    if (Date.now() - (data.savedAt || 0) > 6 * 3600 * 1000) {
      localStorage.removeItem(getSessionStorageKey());
      return null;
    }
    return data;
  } catch (_) {
    return null;
  }
}

function clearSavedSessionFromStorage() {
  try {
    localStorage.removeItem(getSessionStorageKey());
  } catch (_) {}
}

function restoreLocalSessionProgress(snap) {
  if (!snap) return;
  if (Array.isArray(snap.unlockedTowns)) state.unlockedTowns = new Set(snap.unlockedTowns);
  if (Array.isArray(snap.unlockedCounties)) state.unlockedCounties = new Set(snap.unlockedCounties);
  if (Array.isArray(snap.unlockedProvinces)) state.unlockedProvinces = new Set(snap.unlockedProvinces);
  if (Array.isArray(snap.missedTowns)) state.missedTowns = new Set(snap.missedTowns);
  if (Array.isArray(snap.unlockedStations)) state.unlockedStations = new Set(snap.unlockedStations);
  if (Array.isArray(snap.missedStations)) state.missedStations = new Set(snap.missedStations);
  if (snap.targetId !== undefined) state.targetId = snap.targetId;
  if (snap.targetStationKey !== undefined) state.targetStationKey = snap.targetStationKey;
  if (typeof snap.elapsedSec === "number") state.elapsedSec = snap.elapsedSec;
  if (snap.stats) state.stats = { ...state.stats, ...snap.stats };
  state.finished = Boolean(snap.finished);
  state.isGameOver = Boolean(snap.finished);
  state.finalStats = snap.finalStats || null;

  updatePrefixDropdownUI();
  updateRoadAndRailwayTileOverlays();
  refreshAllPolygonStyles();
  renderSmartLabelsAndLeaderLines();
  updateScoreAndProgressUI();
  updateTargetBannerUI();

  if (state.matchInProgress && !state.finished && state.role !== "spectator") {
    startTimer();
  }
}

function resumeSavedRoomSession(saved) {
  if (!saved || !saved.roomCode) return;
  document.getElementById("session-restore-banner")?.classList.add("hidden");
  if (saved.nickname) {
    syncAllNicknameInputs(saved.nickname);
  }
  const passInput = document.getElementById("p2p-password-input");
  if (passInput && saved.roomPassword) passInput.value = saved.roomPassword;
  const hostPassInput = document.getElementById("p2p-host-password-input");
  if (hostPassInput && saved.roomPassword) hostPassInput.value = saved.roomPassword;
  if (Array.isArray(saved.bannedDevices)) {
    state.bannedDevices = new Set(saved.bannedDevices);
  }

  if (saved.isHost) {
    const finishHostResume = () => {
      hostP2PRoom(saved.roomCode, saved.roomPassword || "", saved.playersSnapshot || null);
      state.matchInProgress = Boolean(saved.matchInProgress);
      restoreLocalSessionProgress(saved);
      broadcastRosterFromHost();
      setFeedback(`🔄 已恢復房主房間【${saved.roomCode}】與答題進度！`, "tier");
    };
    const cfgRes = saved.config ? applyRemoteSyncConfig(saved.config, true, true) : null;
    if (cfgRes && typeof cfgRes.then === "function") {
      cfgRes.then(finishHostResume, finishHostResume);
    } else {
      finishHostResume();
    }
  } else {
    const chkSpec = document.getElementById("chk-p2p-join-spectate");
    if (chkSpec) chkSpec.checked = saved.role === "spectator";
    joinP2PRoom(saved.roomCode, {
      password: saved.roomPassword || "",
      preferredRole: saved.role || "spectator",
      isReconnect: true
    });
  }
}

// ============================================================================
// HOST HANDOVER, KICK & BAN DEVICE MANAGEMENT
// ============================================================================
function kickPlayerFromRoom(targetPlayerId) {
  if (!state.isHost || !state.roomCode || !targetPlayerId || targetPlayerId === state.localInstanceId) return;
  const target = state.players[targetPlayerId];
  const targetName = target ? target.name : "成員";
  sendP2PMessage("PLAYER_KICKED", { targetId: targetPlayerId, reason: "KICKED" }, targetPlayerId);
  const conn = state.peers && state.peers.get(targetPlayerId);
  if (conn) {
    setTimeout(() => {
      try { conn.close(); } catch (_) {}
    }, 180);
    state.peers.delete(targetPlayerId);
  }
  delete state.players[targetPlayerId];
  syncPrimaryOpponentFromRoster();
  broadcastRosterFromHost();
  updateP2PLobbyUI();
  updateOpponentUI();
  setFeedback(`🚪 已將【${targetName}】移出房間`, "warn");
}

function banDeviceFromRoom(targetPlayerId) {
  if (!state.isHost || !state.roomCode || !targetPlayerId || targetPlayerId === state.localInstanceId) return;
  const target = state.players[targetPlayerId];
  if (!target) return;
  const devId = target.deviceId || targetPlayerId;
  state.bannedDevices.add(devId);
  const targetName = target.name || "成員";
  sendP2PMessage("PLAYER_BANNED", { targetId: targetPlayerId, deviceId: devId, reason: "BANNED" }, targetPlayerId);
  const conn = state.peers && state.peers.get(targetPlayerId);
  if (conn) {
    setTimeout(() => {
      try { conn.close(); } catch (_) {}
    }, 180);
    state.peers.delete(targetPlayerId);
  }
  // Remove all entries sharing this banned deviceId
  Object.keys(state.players).forEach((pid) => {
    if (pid !== state.localInstanceId && (state.players[pid]?.deviceId === devId || pid === targetPlayerId)) {
      delete state.players[pid];
    }
  });
  saveActiveSessionToStorage();
  syncPrimaryOpponentFromRoster();
  broadcastRosterFromHost();
  updateP2PLobbyUI();
  updateOpponentUI();
  setFeedback(`🚫 已封鎖【${targetName}】的裝置 (${devId.slice(-6)})，本房間禁止再次加入！`, "error");
}

function promoteLocalClientToNewHost(handoverPayload) {
  const code = state.roomCode;
  if (!code) return;
  state.isHost = true;
  state.role = "host";
  state.isReady = true;
  if (handoverPayload?.roomPassword !== undefined) {
    state.roomPassword = handoverPayload.roomPassword;
  }
  if (Array.isArray(handoverPayload?.bannedDevices)) {
    state.bannedDevices = new Set(handoverPayload.bannedDevices);
  }
  if (handoverPayload?.players) {
    state.players = handoverPayload.players;
  }
  if (handoverPayload?.oldHostId && state.players[handoverPayload.oldHostId]) {
    delete state.players[handoverPayload.oldHostId];
  }
  if (state.players[state.localInstanceId]) {
    state.players[state.localInstanceId].role = "host";
    state.players[state.localInstanceId].isReady = true;
  }

  ensureLocalPlayerInRoster();
  syncPrimaryOpponentFromRoster();

  // Re-bind PeerJS host ID so WebRTC peers can connect to the new host
  try {
    if (typeof Peer !== "undefined") {
      if (state.peer) {
        try { state.peer.destroy(); } catch (_) {}
      }
      state.peers = new Map();
      setTimeout(() => {
        if (!state.isHost || !state.roomCode) return;
        try {
          state.peer = new Peer(`tw-geomaster-${code}`);
          state.peer.on("connection", (conn) => {
            setupPeerConnectionHandlers(conn);
          });
        } catch (_) {}
      }, 300);
    }
  } catch (_) {}

  broadcastRosterFromHost();
  updateP2PPanelVisibility();
  updateP2PLobbyUI();
  updateOpponentUI();
  setFeedback(`👑 原房主已離開，你已接任房間【${code}】的新房主！`, "tier");
  playTone("tier");
}

function leaveP2PRoom(silentReason = null) {
  const wasInRoom = Boolean(state.roomCode || state.aiRivalActive);
  if (state.roomCode && !silentReason) {
    if (state.isHost) {
      // Find remaining connected human members to hand over host role!
      const remainingClients = getParticipantList().filter(
        (p) => p.id !== state.localInstanceId && p.id !== "ai_rival" && !p.disconnected
      );
      if (remainingClients.length > 0) {
        // Prefer an active player over a spectator when handing over host
        const nextHost = remainingClients.find((p) => p.role === "player") || remainingClients[0];
        const nextPlayers = { ...state.players };
        delete nextPlayers[state.localInstanceId];
        if (nextPlayers[nextHost.id]) {
          nextPlayers[nextHost.id].role = "host";
          nextPlayers[nextHost.id].isReady = true;
        }
        sendP2PMessage("HOST_HANDOVER", {
          oldHostId: state.localInstanceId,
          oldHostName: state.nickname,
          newHostId: nextHost.id,
          newHostName: nextHost.name,
          roomPassword: state.roomPassword || "",
          bannedDevices: Array.from(state.bannedDevices || []),
          players: nextPlayers,
          config: getHostSyncConfig(false)
        });
      } else {
        // Everyone left -> close room completely
        sendP2PMessage("ROOM_CLOSED", { reason: "ALL_LEFT" });
      }
    } else {
      sendP2PMessage("LOBBY_LEAVE", { name: state.nickname });
    }
  }

  if (state.aiRivalTimer) {
    clearInterval(state.aiRivalTimer);
    state.aiRivalTimer = null;
  }
  state.aiRivalActive = false;

  if (state.peer) {
    try { state.peer.destroy(); } catch (_) {}
    state.peer = null;
  }
  state.conn = null;
  state.peers = new Map();
  state.players = {};
  state.roomCode = "";
  state.roomPassword = "";
  state.roomHasPassword = false;
  state.bannedDevices = new Set();
  state.isHost = false;
  state.role = "solo";
  state.spectatingPlayerId = null;
  state.spectatorLayerInitialized = false;
  hideRoomConfigChangeToast();
  state.matchInProgress = false;
  state.isReady = false;
  state.opponent.connected = false;
  state.opponent.isReady = false;
  clearSavedSessionFromStorage();

  // Clear ?room= query parameter from address bar so refreshing doesn't re-trigger link join
  try {
    if (window.location.search.includes("room=")) {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  } catch (_) {}

  document.getElementById("modal-room")?.classList.add("hidden");
  document.getElementById("modal-join-entry")?.classList.add("hidden");

  applyP2PLayerRule("free", state.mapLayer || "vector", "free", "free");
  updateP2PPanelVisibility();
  updateP2PLobbyUI();
  refreshAllPolygonStyles();
  updateRoadAndRailwayTileOverlays();
  updateScoreAndProgressUI();
  if (typeof syncModalBodyScrollLock === "function") syncModalBodyScrollLock();

  if (silentReason) {
    setFeedback(silentReason, "error");
  } else if (wasInRoom) {
    setFeedback("🚪 已退出房間，回到單人模式", "info");
  }
}

// ============================================================================
// SPECTATOR VIEW SWITCHING & LAYER FREEDOM
// ============================================================================
function setSpectatingTarget(playerId) {
  if (!playerId || !state.players[playerId]) {
    state.spectatingPlayerId = null;
  } else {
    state.spectatingPlayerId = playerId;
    state.players[playerId]._viewSets = null;
  }
  const sel = document.getElementById("spectator-player-select");
  if (sel && sel.value !== (state.spectatingPlayerId || "")) {
    sel.value = state.spectatingPlayerId || "";
  }
  syncPrimaryOpponentFromRoster();
  refreshAllPolygonStyles();
  updateRoadAndRailwayTileOverlays();
  renderSmartLabelsAndLeaderLines();
  updateScoreAndProgressUI();
  updateTargetBannerUI();
  updateOpponentUI();

  const watched = state.spectatingPlayerId ? state.players[state.spectatingPlayerId] : null;
  if (watched) {
    setFeedback(`👁️ 已切換觀戰視角至選手【${watched.name}】的地圖與即時進度！`, "info");
  }
}

function updateSpectatorPlayerSelectUI() {
  const sel = document.getElementById("spectator-player-select");
  if (!sel) return;
  const activePlayers = getSortedActiveBattlePlayers();
  sel.replaceChildren();

  if (activePlayers.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "尚無參賽選手";
    sel.appendChild(opt);
    return;
  }

  activePlayers.forEach((p, idx) => {
    const tot = (p.total || 0) + (p.stationTotal || 0);
    const cur = (p.score || 0) + (p.stationScore || 0);
    const pct = tot > 0 ? ((cur / tot) * 100).toFixed(1) : "0.0";
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `#${idx + 1} ${p.name} (${cur}/${tot} · ${pct}%)`;
    sel.appendChild(opt);
  });

  if (state.spectatingPlayerId && state.players[state.spectatingPlayerId]) {
    sel.value = state.spectatingPlayerId;
  } else if (activePlayers[0]) {
    state.spectatingPlayerId = activePlayers[0].id;
    sel.value = activePlayers[0].id;
  }
}

function applySpectatorInputLock() {
  const isSpectator = state.role === "spectator" && Boolean(state.roomCode);
  const answerForm = document.getElementById("answer-form");
  const footerActions = document.getElementById("input-footer-actions");
  const answerInput = document.getElementById("answer-input");
  const banner = document.getElementById("spectator-mode-banner");
  const bannerText = document.getElementById("spectator-banner-text");
  const joinBtn = document.getElementById("btn-spectator-join-next");

  if (banner) {
    if (isSpectator || (state.roomCode && state.finished && getActiveBattlePlayers().length > 1)) {
      banner.classList.remove("hidden");
      updateSpectatorPlayerSelectUI();
      if (bannerText) {
        const watched = state.spectatingPlayerId ? state.players[state.spectatingPlayerId] : null;
        const wName = watched ? `觀看【${watched.name}】` : "觀戰模式中";
        bannerText.textContent = isSpectator
          ? `👁️ ${wName}：可自由切換圖層`
          : `🏁 已完賽（${wName}）：可切換觀看其他選手`;
      }
      if (joinBtn) {
        joinBtn.classList.toggle("hidden", !isSpectator);
        joinBtn.disabled = state.matchInProgress;
        joinBtn.textContent = state.matchInProgress ? "⏳ 下局可參賽" : "🎮 切換參賽";
        joinBtn.classList.toggle("opacity-50", state.matchInProgress);
        joinBtn.classList.toggle("cursor-not-allowed", state.matchInProgress);
      }
    } else {
      banner.classList.add("hidden");
    }
  }

  if (answerForm) {
    answerForm.classList.toggle("hidden", isSpectator);
  }
  if (footerActions) {
    footerActions.classList.toggle("hidden", isSpectator);
  }
  if (answerInput) {
    answerInput.disabled = isSpectator;
    if (isSpectator) {
      answerInput.value = "";
      answerInput.placeholder = "👁️ 觀戰模式中（點擊「切換參賽」即可作答）";
    } else if (answerInput.placeholder.includes("觀戰模式")) {
      answerInput.placeholder = "輸入行政區或車站名稱（注音選字Enter完成後自動判定）";
    }
  }
}

function toggleSpectatorRole() {
  if (!state.roomCode || state.isHost) return;
  if (state.matchInProgress && state.role === "spectator") {
    setFeedback("⏳ 目前比賽進行中，本局結束後即可切換為參賽選手！", "warn");
    return;
  }
  const nextRole = state.role === "spectator" ? "player" : "spectator";
  state.role = nextRole;
  state.isReady = false;
  ensureLocalPlayerInRoster();
  if (nextRole === "player") {
    state.spectatingPlayerId = null;
    applyP2PLayerRule(state.p2pLayerRule, state.p2pForcedLayer, state.p2pRailRule, state.p2pBorderRule);
  } else {
    const sorted = getSortedActiveBattlePlayers();
    state.spectatingPlayerId = sorted[0]?.id || null;
    applyP2PLayerRule(state.p2pLayerRule, state.p2pForcedLayer, state.p2pRailRule, state.p2pBorderRule);
  }
  syncPrimaryOpponentFromRoster();
  sendP2PMessage("SYNC_ROLE_CHANGE", {
    role: nextRole,
    name: state.nickname,
    isReady: false
  });
  applySpectatorInputLock();
  updateP2PLobbyUI();
  refreshAllPolygonStyles();
  updateRoadAndRailwayTileOverlays();
  updateScoreAndProgressUI();
  updateOpponentUI();
  setFeedback(
    nextRole === "spectator"
      ? "👁️ 已切換為觀戰模式（可自由切換圖層與檢視各選手地圖）"
      : "🎮 已切換為參賽選手！請確認設定後點擊「準備 (Ready)」",
    "info"
  );
}

function updateTopBarRoomControlsUI() {
  const inRoom = Boolean(state.roomCode || state.aiRivalActive);
  const btnCreate = document.getElementById("btn-top-create-room");
  const btnOpenRoom = document.getElementById("btn-top-open-room");
  const btnLeaveRoom = document.getElementById("btn-top-leave-room");
  const roomLabel = document.getElementById("top-room-btn-label");
  const dot = document.getElementById("p2p-status-dot");

  // Strict Rule: Must exit room before showing Create Room; when in room, show Room Status + Leave Room!
  if (btnCreate) btnCreate.classList.toggle("hidden", inRoom);
  if (btnOpenRoom) btnOpenRoom.classList.toggle("hidden", !inRoom);
  if (btnLeaveRoom) btnLeaveRoom.classList.toggle("hidden", !inRoom);

  if (inRoom && roomLabel) {
    const count = Math.max(1, getParticipantList().filter((p) => !p.disconnected).length);
    const codeStr = state.roomCode || "AI對戰";
    roomLabel.textContent = `${codeStr} (${count}人)`;
  }
  if (dot) {
    dot.className = inRoom
      ? "w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"
      : "w-2 h-2 rounded-full bg-slate-500 shrink-0";
  }
}

function updateP2PPanelVisibility() {
  const panel = document.getElementById("p2p-live-panel");
  const shouldShow = Boolean(state.roomCode || state.aiRivalActive || state.opponent.connected);
  if (panel) panel.classList.toggle("hidden", !shouldShow);
  updateTopBarRoomControlsUI();
  applySpectatorInputLock();
}

function syncSpectatorInitialLayers(rule, forcedLayer, railRule, borderRule) {
  const defaultBase = forcedLayer || "vector";
  setMapBaseLayer(defaultBase, true);
  if (railRule === "ban_rail") {
    state.transportMode = state.stationQuizEnabled && state.quizStationLines.size > 0 ? "stations_only" : "off";
  } else if (railRule === "force_lines") {
    state.transportMode = "lines_and_stations";
  } else if (railRule === "force_rail_only" || railRule === "ban_roads_only") {
    state.transportMode = "rail_only";
  }
  if (borderRule === "force_off" && typeof setDistrictBordersVisible === "function") {
    setDistrictBordersVisible(false, true);
  }
  state.spectatorLayerInitialized = true;
  updateRoadAndRailwayTileOverlays();
}

function applyP2PLayerRule(rule, forcedLayer, railRule, borderRule) {
  state.p2pLayerRule = rule || "free";
  state.p2pForcedLayer = forcedLayer || "vector";
  if (railRule) state.p2pRailRule = railRule;
  if (borderRule) state.p2pBorderRule = borderRule;

  const badge = document.getElementById("layer-lock-badge");
  const switcher = document.getElementById("layer-switcher-pill");
  const railBtn = document.getElementById("btn-toggle-rail");
  const cfgBtn = document.getElementById("btn-open-transport-cfg");
  const borderBtn = document.getElementById("btn-toggle-borders");
  const chkModalBorders = document.getElementById("chk-modal-borders");

  if (state.role === "spectator" && state.roomCode) {
    if (!state.spectatorLayerInitialized) {
      syncSpectatorInitialLayers(state.p2pLayerRule, state.p2pForcedLayer, state.p2pRailRule, state.p2pBorderRule);
    }
    if (badge) {
      badge.classList.remove("hidden");
      badge.className = "apple-glass-pill px-2.5 py-1 rounded-xl text-[11px] font-bold text-amber-300 border border-amber-500/40 pointer-events-auto";
      badge.textContent = "👁️ 觀戰自由圖層";
    }
    if (switcher) switcher.classList.remove("opacity-60", "pointer-events-none");
    if (railBtn) railBtn.classList.remove("pointer-events-none", "opacity-50", "opacity-60");
    if (cfgBtn) cfgBtn.classList.remove("pointer-events-none", "opacity-50");
    if (borderBtn) borderBtn.classList.remove("opacity-60");
    if (chkModalBorders) chkModalBorders.disabled = false;
    updateRoadAndRailwayTileOverlays();
    return;
  }

  if (badge) {
    badge.className = "hidden apple-glass-pill px-2.5 py-1 rounded-xl text-[11px] font-bold text-rose-300 border border-rose-500/40 pointer-events-auto";
  }

  const lockParts = [];
  if (state.p2pLayerRule === "locked") {
    setMapBaseLayer(state.p2pForcedLayer, true);
    lockParts.push("🔒 已鎖定圖層");
    if (switcher) switcher.classList.add("opacity-60");
  } else {
    if (switcher) switcher.classList.remove("opacity-60");
  }

  if (_p2pFeatures().supportsTransportQuiz && state.p2pRailRule && state.p2pRailRule !== "free") {
    const hasStations = state.stationQuizEnabled && state.quizStationLines.size > 0;
    lockParts.push(
      state.p2pRailRule === "ban_rail"
        ? hasStations
          ? "🚫 禁路網(僅車站點)"
          : "🚫 禁用路網"
        : state.p2pRailRule === "ban_roads_only"
        ? "🛑 禁用公路網"
        : state.p2pRailRule === "force_rail_only"
        ? "🚄 強制純軌道"
        : "🛣️ 強制完整路網"
    );
    updateRoadAndRailwayTileOverlays();
    if (railBtn) {
      if (
        (state.p2pRailRule === "ban_rail" && !hasStations) ||
        state.p2pRailRule === "force_lines" ||
        state.p2pRailRule === "force_rail_only"
      ) {
        railBtn.classList.add("opacity-60");
      } else {
        railBtn.classList.remove("opacity-60", "pointer-events-none");
      }
    }
    if (cfgBtn) {
      if (state.p2pRailRule === "ban_rail") cfgBtn.classList.add("pointer-events-none", "opacity-50");
      else cfgBtn.classList.remove("pointer-events-none", "opacity-50");
    }
  } else {
    if (railBtn) railBtn.classList.remove("pointer-events-none", "opacity-50", "opacity-60");
    if (cfgBtn) cfgBtn.classList.remove("pointer-events-none", "opacity-50");
  }

  if (state.p2pBorderRule === "force_off") {
    if (typeof setDistrictBordersVisible === "function") {
      setDistrictBordersVisible(false, true);
    } else {
      state.showDistrictBorders = false;
      refreshAllPolygonStyles();
    }
    lockParts.push("🚫 強制關閉區界");
    if (borderBtn) borderBtn.classList.add("opacity-60");
    if (chkModalBorders) chkModalBorders.disabled = true;
  } else {
    if (borderBtn) borderBtn.classList.remove("opacity-60");
    if (chkModalBorders) chkModalBorders.disabled = false;
  }

  if (badge) {
    if (lockParts.length > 0) {
      badge.classList.remove("hidden");
      badge.textContent = lockParts.join(" · ");
    } else {
      badge.classList.add("hidden");
    }
  }
}

// ============================================================================
// HOST CONFIG CHANGE DIFF & LIGHTWEIGHT AUTO-DISMISSING TOAST ENGINE
// (No voting required: Ready button serves as confirmation; changes reset Ready)
// ============================================================================
function hideRoomConfigChangeToast() {
  if (state._configToastTimer) {
    clearTimeout(state._configToastTimer);
    state._configToastTimer = null;
  }
  document.getElementById("room-config-toast")?.classList.add("hidden");
  document.getElementById("p2p-re-ready-warning")?.classList.add("hidden");
}

function showRoomConfigChangeToast(message, tone = "warn", alsoShowInRoomFooter = false) {
  if (state._configToastTimer) {
    clearTimeout(state._configToastTimer);
    state._configToastTimer = null;
  }

  const toastEl = document.getElementById("room-config-toast");
  const iconEl = document.getElementById("room-config-toast-icon");
  const textEl = document.getElementById("room-config-toast-text");

  if (toastEl && textEl) {
    const cleanMsg = String(message || "").replace(/^(?:🔔|⚙️|⚠️)\s*/u, "");
    textEl.textContent = cleanMsg;
    if (iconEl) {
      iconEl.textContent = tone === "warn" ? "🔔" : "⚙️";
    }
    toastEl.className =
      tone === "warn"
        ? "fixed top-3 sm:top-3.5 left-1/2 -translate-x-1/2 z-[820] max-w-[94vw] sm:max-w-2xl px-3.5 py-2 rounded-2xl apple-glass bg-slate-900/95 border border-amber-400/50 text-amber-100 text-xs font-bold shadow-2xl pointer-events-none flex items-center gap-2 transition-all duration-300"
        : "fixed top-3 sm:top-3.5 left-1/2 -translate-x-1/2 z-[820] max-w-[94vw] sm:max-w-2xl px-3.5 py-2 rounded-2xl apple-glass bg-slate-900/95 border border-sky-400/50 text-sky-100 text-xs font-bold shadow-2xl pointer-events-none flex items-center gap-2 transition-all duration-300";
    toastEl.classList.remove("hidden");
  }

  const warningBanner = document.getElementById("p2p-re-ready-warning");
  if (warningBanner) {
    warningBanner.classList.add("hidden");
  }

  const durationMs =
    typeof window.CONFIG_TOAST_DURATION_MS === "number" ? window.CONFIG_TOAST_DURATION_MS : 2400;
  state._configToastTimer = setTimeout(() => {
    hideRoomConfigChangeToast();
  }, durationMs);
}

function describeConfigDiff(patch) {
  const isTw = _p2pIsTwModern();
  const allGroups = _p2pGroups();
  const unitLabels = _p2pUnitLabels();
  const diffNames = {
    casual: "🟢 休閒難度",
    county_only: isTw ? `🔵 ${allGroups.length}縣市模式` : `🔵 ${allGroups.length}${unitLabels.group}模式`,
    hard_suffix: "🟡 進階後綴模式",
    hard_full: "🟠 困難全名模式",
    master_hierarchy: "🔥 三階困難模式"
  };
  const pmNames = {
    free: "✍️ 自由默寫",
    target_random: "🎯 隨機指定區塊",
    target_click: "👆 點選指定區塊",
    satellite_quiz: "🛰️ 衛星影像猜題"
  };
  const satStyleNames = {
    day: "☀️ 日間衛星",
    night: "🌙 夜間燈火",
    hybrid: "🌓 日夜混合"
  };
  const qmNames = {
    region: "🗺️ 猜行政區",
    station: "🚉 猜車站",
    mixed: "🔀 區域＋車站混合"
  };

  const lines = [];
  const curPackId = state.activeMapPackId || "tw_modern";
  if (patch.mapPackId && patch.mapPackId !== curPackId) {
    const nextPack = typeof getMapPackById === "function" ? getMapPackById(patch.mapPackId) : null;
    const nextLabel = (nextPack && nextPack.shortLabel) || patch.mapPackId;
    const curPack = _p2pPack();
    const curLabel = (curPack && curPack.shortLabel) || curPackId;
    lines.push(`🗺️ 地圖：${curLabel} ➔ ${nextLabel}`);
  }
  if (patch.packOptions && typeof patch.packOptions === "object") {
    const curOpts = state.packOptions || {};
    if (
      typeof patch.packOptions.worldIncludeMicrostates === "boolean" &&
      patch.packOptions.worldIncludeMicrostates !== (curOpts.worldIncludeMicrostates !== false)
    ) {
      lines.push(
        patch.packOptions.worldIncludeMicrostates
          ? "🏝️ 含微型國（完整 196 國）"
          : "🌍 標準版（排除微型國）"
      );
    }
    if (
      typeof patch.packOptions.cnAllowSingleCharAlias === "boolean" &&
      patch.packOptions.cnAllowSingleCharAlias !== Boolean(curOpts.cnAllowSingleCharAlias)
    ) {
      lines.push(
        patch.packOptions.cnAllowSingleCharAlias
          ? "🔤 開啟一字簡稱（京/滬/粵）"
          : "🔤 關閉一字簡稱"
      );
    }
    if (
      typeof patch.packOptions.rocTerritoryVariant === "string" &&
      patch.packOptions.rocTerritoryVariant !== (curOpts.rocTerritoryVariant === "no_mongolia" ? "no_mongolia" : "begonia_full")
    ) {
      lines.push(
        patch.packOptions.rocTerritoryVariant === "no_mongolia"
          ? "🇹🇼 切換為不含蒙古地方"
          : "🇹🇼 切換為中華民國1945 全境（含蒙古地方）"
      );
    }
    if (
      typeof patch.packOptions.includeMunicipalities === "boolean" &&
      patch.packOptions.includeMunicipalities !== (curOpts.includeMunicipalities !== false)
    ) {
      lines.push(
        patch.packOptions.includeMunicipalities
          ? "🏙️ 開啟 12 院轄市"
          : "🏙️ 關閉 12 院轄市（僅 38 省／地方／特區）"
      );
    }
    if (
      typeof patch.packOptions.showDisputedBorders === "boolean" &&
      patch.packOptions.showDisputedBorders !== (curOpts.showDisputedBorders !== false)
    ) {
      lines.push(
        patch.packOptions.showDisputedBorders
          ? "〰️ 顯示爭議邊界線"
          : "〰️ 隱藏爭議邊界線"
      );
    }
  }
  if (patch.difficulty && patch.difficulty !== state.difficulty) {
    lines.push(`${diffNames[state.difficulty] || state.difficulty} ➔ ${diffNames[patch.difficulty] || patch.difficulty}`);
  }
  if (patch.quizTargetMode && patch.quizTargetMode !== state.quizTargetMode) {
    lines.push(`${qmNames[state.quizTargetMode] || state.quizTargetMode} ➔ ${qmNames[patch.quizTargetMode] || patch.quizTargetMode}`);
  }
  if (patch.playMode && patch.playMode !== state.playMode) {
    lines.push(`${pmNames[state.playMode] || state.playMode} ➔ ${pmNames[patch.playMode] || patch.playMode}`);
  }
  if (patch.satelliteStyle && patch.satelliteStyle !== state.satelliteStyle) {
    lines.push(`衛星影像風格：${satStyleNames[state.satelliteStyle] || state.satelliteStyle} ➔ ${satStyleNames[patch.satelliteStyle] || patch.satelliteStyle}`);
  }
  if (typeof patch.satelliteLockViewport === "boolean" && patch.satelliteLockViewport !== state.satelliteLockViewport) {
    lines.push(patch.satelliteLockViewport ? "開啟衛星防作弊視野鎖定" : "關閉衛星視野鎖定");
  }
  if (patch.selectedCounties) {
    const newSet = new Set(patch.selectedCounties);
    const townCountStr = patch.selectedTownIds ? ` (${patch.selectedTownIds.length} ${unitLabels.itemShort})` : "";
    lines.push(`${newSet.size} ${unitLabels.group}${townCountStr}`);
  }
  if (patch.quizStationLines) {
    const newLines = new Set(patch.quizStationLines);
    lines.push(`${newLines.size} 條路線`);
  }
  if (typeof patch.showStationTerminusHints === "boolean" && patch.showStationTerminusHints !== state.showStationTerminusHints) {
    lines.push(patch.showStationTerminusHints ? "開啟頭尾端點站提示" : "關閉頭尾端點站提示");
  }
  if (typeof patch.filterStationsByRegion === "boolean" && patch.filterStationsByRegion !== state.filterStationsByRegion) {
    lines.push(patch.filterStationsByRegion ? "開啟僅猜所選區域內鐵道車站" : "關閉區域鐵道過濾（猜全線車站）");
  }
  if (typeof patch.allowTargetHints === "boolean" && patch.allowTargetHints !== state.allowTargetHints) {
    lines.push(patch.allowTargetHints ? "開放指定/隨機模式提示按鈕" : "禁用 (Ban) 指定/隨機模式提示按鈕");
  }
  if (typeof patch.targetQuestionLimit === "number" && patch.targetQuestionLimit !== (parseInt(state.targetQuestionLimit, 10) || 0)) {
    lines.push(patch.targetQuestionLimit > 0 ? `限 ${patch.targetQuestionLimit} 題` : "全部題庫");
  }
  if (typeof patch.allowPass === "boolean" && patch.allowPass !== (state.allowPass !== false)) {
    lines.push(patch.allowPass ? "允許略過 (Pass)" : "關閉略過 (Pass)");
  }
  if (typeof patch.hideGuessedOthers === "boolean" && patch.hideGuessedOthers !== Boolean(state.hideGuessedOthers)) {
    lines.push(patch.hideGuessedOthers ? "隱藏已猜區塊" : "顯示已猜區塊");
  }
  if (typeof patch.questionCountdownEnabled === "boolean" && patch.questionCountdownEnabled !== Boolean(state.questionCountdownEnabled)) {
    const modeLbl = (patch.questionCountdownMode || state.questionCountdownMode) === "normal" ? "每題倒數" : "倒數搶答";
    lines.push(patch.questionCountdownEnabled ? `開啟${modeLbl} (${patch.questionCountdownSec || state.questionCountdownSec || 15}秒)` : `關閉${modeLbl}`);
  } else if (typeof patch.questionCountdownMode === "string" && patch.questionCountdownMode !== state.questionCountdownMode) {
    lines.push(patch.questionCountdownMode === "normal" ? "切換為一般每題倒數" : "切換為多人搶答倒數");
  } else if (typeof patch.questionCountdownSec === "number" && patch.questionCountdownSec !== (parseInt(state.questionCountdownSec, 10) || 15)) {
    const modeLbl = state.questionCountdownMode === "normal" ? "每題倒數" : "倒數搶答";
    lines.push(`${modeLbl} ${patch.questionCountdownSec} 秒`);
  }
  if (patch.timerMode) {
    const newTimerDesc = patch.timerMode === "up" ? "正計時" : `倒數 ${Math.round((patch.countdownTotalSec || state.countdownTotalSec) / 60)} 分鐘`;
    lines.push(newTimerDesc);
  }
  if (patch.borderRule && patch.borderRule !== state.p2pBorderRule) {
    lines.push(patch.borderRule === "force_off" ? "強制關閉行政區界" : "開放自由開關區界");
  }
  if (patch.layerRule || patch.forcedLayer || patch.railRule) {
    lines.push("已更新圖層/路網限制");
  }
  if (lines.length === 0) {
    lines.push("更新房間題庫與比賽設定");
  }
  return lines;
}

function buildProposedConfigFromPatch(patch) {
  const base = getHostSyncConfig(true);
  const curPackId = state.activeMapPackId || "tw_modern";
  const isSwitchingPack = Boolean(patch.mapPackId && patch.mapPackId !== curPackId);
  if (patch.mapPackId) base.mapPackId = patch.mapPackId;
  if (patch.packOptions && typeof patch.packOptions === "object") {
    base.packOptions = {
      ...(base.packOptions || {
        worldIncludeMicrostates: true,
        cnAllowSingleCharAlias: false,
        rocTerritoryVariant: "begonia_full",
        includeMunicipalities: true,
        showDisputedBorders: true
      }),
      ...patch.packOptions
    };
  }
  if (isSwitchingPack) {
    // Drop previous pack's scope IDs so target pack initializes its full scope cleanly unless patch supplies new IDs
    delete base.selectedCounties;
    delete base.selectedTownIds;
    const targetPack = typeof getMapPackById === "function" ? getMapPackById(patch.mapPackId) : null;
    const tf = targetPack && targetPack.features ? targetPack.features : null;
    if (tf) {
      if (!tf.supportsTransportQuiz) {
        base.stationQuizEnabled = false;
        base.quizStationLines = [];
      }
      if (!tf.supportsPoiQuiz) {
        base.airportQuizEnabled = false;
        base.portQuizEnabled = false;
        base.reservoirQuizEnabled = false;
        base.lakeQuizEnabled = false;
        base.settlementQuizEnabled = false;
      }
      if (!tf.supportsCapitalQuiz) {
        base.capitalQuizEnabled = false;
      }
      if (!tf.supportsLandmarkQuiz) {
        base.landmarkQuizEnabled = false;
      }
      if (!tf.supportsTransportQuiz && !tf.supportsPoiQuiz && !tf.supportsCapitalQuiz && !tf.supportsLandmarkQuiz) {
        base.regionQuizEnabled = true;
        base.quizTargetMode = "region";
      }
    }
  }
  if (patch.quizTargetMode) base.quizTargetMode = patch.quizTargetMode;
  if (typeof patch.regionQuizEnabled === "boolean") base.regionQuizEnabled = patch.regionQuizEnabled;
  if (typeof patch.stationQuizEnabled === "boolean") base.stationQuizEnabled = patch.stationQuizEnabled;
  if (typeof patch.airportQuizEnabled === "boolean") base.airportQuizEnabled = patch.airportQuizEnabled;
  if (typeof patch.portQuizEnabled === "boolean") base.portQuizEnabled = patch.portQuizEnabled;
  if (typeof patch.reservoirQuizEnabled === "boolean") base.reservoirQuizEnabled = patch.reservoirQuizEnabled;
  if (typeof patch.lakeQuizEnabled === "boolean") base.lakeQuizEnabled = patch.lakeQuizEnabled;
  if (typeof patch.settlementQuizEnabled === "boolean") base.settlementQuizEnabled = patch.settlementQuizEnabled;
  if (typeof patch.capitalQuizEnabled === "boolean") base.capitalQuizEnabled = patch.capitalQuizEnabled;
  if (typeof patch.landmarkQuizEnabled === "boolean") base.landmarkQuizEnabled = patch.landmarkQuizEnabled;
  if (Array.isArray(patch.airportSubTypes)) base.airportSubTypes = patch.airportSubTypes.slice();
  if (Array.isArray(patch.portSubTypes)) base.portSubTypes = patch.portSubTypes.slice();
  if (Array.isArray(patch.reservoirSubTypes)) base.reservoirSubTypes = patch.reservoirSubTypes.slice();
  if (Array.isArray(patch.lakeSubTypes)) base.lakeSubTypes = patch.lakeSubTypes.slice();
  if (Array.isArray(patch.settlementSubTypes)) base.settlementSubTypes = patch.settlementSubTypes.slice();
  if (patch.difficulty) base.difficulty = patch.difficulty;
  if (patch.playMode) base.playMode = patch.playMode;
  if (typeof patch.targetQuestionLimit === "number") base.targetQuestionLimit = patch.targetQuestionLimit;
  if (typeof patch.allowPass === "boolean") base.allowPass = patch.allowPass;
  if (typeof patch.hideGuessedOthers === "boolean") base.hideGuessedOthers = patch.hideGuessedOthers;
  if (typeof patch.questionCountdownEnabled === "boolean") base.questionCountdownEnabled = patch.questionCountdownEnabled;
  if (typeof patch.questionCountdownMode === "string") base.questionCountdownMode = patch.questionCountdownMode === "normal" ? "normal" : "rush";
  if (typeof patch.questionCountdownSec === "number") base.questionCountdownSec = patch.questionCountdownSec;
  if (typeof patch.rushGraceSec === "number") base.rushGraceSec = patch.rushGraceSec;
  if (patch.satelliteStyle) base.satelliteStyle = patch.satelliteStyle;
  if (typeof patch.satelliteLockViewport === "boolean") {
    base.satelliteLockViewport = patch.satelliteLockViewport;
  }
  if (patch.selectedCounties) base.selectedCounties = Array.from(patch.selectedCounties);
  if (patch.selectedTownIds) base.selectedTownIds = Array.from(patch.selectedTownIds);
  if (patch.quizStationLines) base.quizStationLines = Array.from(patch.quizStationLines);
  if (typeof patch.showStationTerminusHints === "boolean") {
    base.showStationTerminusHints = patch.showStationTerminusHints;
  }
  if (typeof patch.filterStationsByRegion === "boolean") {
    base.filterStationsByRegion = patch.filterStationsByRegion;
  }
  if (typeof patch.allowTargetHints === "boolean") {
    base.allowTargetHints = patch.allowTargetHints;
  }
  if (patch.timerMode) base.timerMode = patch.timerMode;
  if (patch.countdownTotalSec !== undefined) base.countdownTotalSec = patch.countdownTotalSec;
  if (patch.layerRule) base.layerRule = patch.layerRule;
  if (patch.forcedLayer) base.forcedLayer = patch.forcedLayer;
  if (patch.railRule) base.railRule = patch.railRule;
  if (patch.borderRule) base.borderRule = patch.borderRule;

  if (!patch.quizTargetMode) {
    if (patch.quizStationLines && patch.quizStationLines.length > 0 && base.quizTargetMode === "region") {
      base.quizTargetMode = base.selectedCounties.length > 0 ? "mixed" : "station";
    } else if (patch.selectedCounties && patch.selectedCounties.length > 0 && base.quizTargetMode === "station") {
      base.quizTargetMode = base.quizStationLines.length > 0 ? "mixed" : "region";
    }
  }

  if (base.quizTargetMode === "region") {
    base.quizStationLines = [];
  } else if (base.quizTargetMode === "station") {
    base.selectedCounties = [];
    base.selectedTownIds = [];
  }
  return base;
}

function requestOrApplyConfigChange(patch, changeLabel = "比賽設定") {
  if (patch && patch.playMode === "pin_drop" && (state.roomCode || state.roomId)) {
    setFeedback("📍 標座標模式目前僅支援單人遊玩！", "warn");
    return false;
  }
  // Security Guard: Non-host in a multiplayer room CANNOT change difficulty or rules or broadcast!
  if (!canLocalModifyGameConfig()) {
    setFeedback("🔒 僅房主可調整房間題目設定！", "error");
    playTone("error");
    renderScopeModalGrid();
    return false;
  }

  const diffDescriptions = describeConfigDiff(patch);
  const diffSummary = diffDescriptions.join(" · ");
  const proposedCfg = buildProposedConfigFromPatch(patch);

  // Apply immediately without voting; if Host in room, reset players' Ready & broadcast lightweight notice!
  const applyRes = applyRemoteSyncConfig(proposedCfg, false, true);
  if (state.isHost && state.roomCode) {
    if (applyRes && typeof applyRes.then === "function") {
      applyRes
        .then((res) => {
          if (!res || res.ok !== false) {
            onHostSettingChange(changeLabel, diffSummary);
          }
        })
        .catch(() => {});
    } else if (!applyRes || applyRes.ok !== false) {
      onHostSettingChange(changeLabel, diffSummary);
    }
  }
  return true;
}

// ============================================================================
// P2P MESSAGE TRANSPORT & DISPATCHER (Strict Solo Isolation!)
// ============================================================================
function sendP2PMessage(type, payload, targetId = null, excludeSenderId = null, explicitRoomCode = null) {
  const activeRoom = explicitRoomCode || state.roomCode;
  // Strict Guard: Individual / Solo mode NEVER broadcasts anything!
  if (!activeRoom && !state.aiRivalActive) return;

  const envelope = {
    type,
    payload,
    targetId: targetId || null,
    roomCode: activeRoom || "",
    senderId: state.localInstanceId
  };

  if (state.isHost) {
    if (state.peers && state.peers.size > 0) {
      state.peers.forEach((conn, peerSenderId) => {
        if (targetId && peerSenderId !== targetId) return;
        if (excludeSenderId && peerSenderId === excludeSenderId) return;
        if (conn && conn.open) {
          try { conn.send(envelope); } catch (e) {}
        }
      });
    } else if (state.conn && state.conn.open) {
      try { state.conn.send(envelope); } catch (e) {}
    }
  } else {
    if (state.conn && state.conn.open) {
      try { state.conn.send(envelope); } catch (e) {}
    }
  }

  if (state.bcChannel && activeRoom) {
    try { state.bcChannel.postMessage(envelope); } catch (e) {}
  }
}

function broadcastRosterFromHost() {
  if (!state.isHost || !state.roomCode) return;
  ensureLocalPlayerInRoster();
  sendP2PMessage("ROOM_ROSTER", {
    players: state.players,
    matchInProgress: state.matchInProgress
  });
}

function dispatchP2PMessage(msg, sourceConn = null) {
  if (!msg || !msg.type) return;
  if (msg.senderId && msg.senderId === state.localInstanceId) return;

  // Handle ROOM_PROBE & ROOM_INFO before joining room (so client entry modal knows if password is required)
  if (msg.type === "ROOM_PROBE") {
    if (!state.isHost || !state.roomCode || msg.roomCode !== state.roomCode) return;
    const isBanned = Boolean(msg.payload?.deviceId && state.bannedDevices && state.bannedDevices.has(msg.payload.deviceId));
    const infoPayload = {
      roomCode: state.roomCode,
      hasPassword: Boolean(state.roomPassword),
      hostName: state.nickname || "房主",
      memberCount: getParticipantList().filter((p) => !p.disconnected).length,
      mapPackId: state.activeMapPackId || "tw_modern",
      isBanned
    };
    if (sourceConn && sourceConn.open) {
      try {
        sourceConn.send({
          type: "ROOM_INFO",
          payload: infoPayload,
          targetId: msg.senderId,
          roomCode: state.roomCode,
          senderId: state.localInstanceId
        });
      } catch (_) {}
    }
    sendP2PMessage("ROOM_INFO", infoPayload, msg.senderId, null, state.roomCode);
    return;
  }

  if (msg.type === "ROOM_INFO") {
    if (msg.targetId && msg.targetId !== state.localInstanceId) return;
    if (!state.pendingJoinRoomCode || msg.roomCode !== state.pendingJoinRoomCode) return;
    state.roomHasPassword = Boolean(msg.payload?.hasPassword);
    const pwWrap = document.getElementById("join-entry-password-wrap");
    if (pwWrap) {
      pwWrap.classList.toggle("hidden", !state.roomHasPassword);
    }
    const errBox = document.getElementById("join-entry-error");
    const errTxt = document.getElementById("join-entry-error-text");
    const submitBtn = document.getElementById("btn-join-entry-submit");
    if (msg.payload?.isBanned) {
      if (errBox && errTxt) {
        errTxt.textContent = "🚫 你的裝置已被房主封鎖，無法加入此房間！";
        errBox.classList.remove("hidden");
      }
      if (submitBtn) submitBtn.disabled = true;
    }
    return;
  }

  // Strict guard for all in-room messages
  const activeOrPendingRoom = state.roomCode || state.pendingJoinRoomCode;
  if (!activeOrPendingRoom || !msg.roomCode || msg.roomCode !== activeOrPendingRoom) return;
  if (msg.targetId && msg.targetId !== state.localInstanceId) return;

  if (state.isHost && sourceConn && msg.senderId && msg.type !== "LOBBY_JOIN") {
    state.peers.set(msg.senderId, sourceConn);
  }

  if (msg.type === "LOBBY_JOIN") {
    if (!state.isHost) return;
    const clientDevId = msg.payload?.deviceId || msg.senderId;

    // 1. Check Device Ban List
    if (state.bannedDevices && state.bannedDevices.has(clientDevId)) {
      const rejectPayload = { reason: "DEVICE_BANNED" };
      if (sourceConn && sourceConn.open) {
        try {
          sourceConn.send({
            type: "JOIN_REJECTED",
            payload: rejectPayload,
            targetId: msg.senderId,
            roomCode: state.roomCode,
            senderId: state.localInstanceId
          });
          setTimeout(() => { try { sourceConn.close(); } catch (_) {} }, 250);
        } catch (e) {}
      } else {
        sendP2PMessage("JOIN_REJECTED", rejectPayload, msg.senderId);
      }
      return;
    }

    // 2. Check Room Password
    const reqPass = msg.payload?.password || "";
    if (state.roomPassword && reqPass !== state.roomPassword) {
      const rejectPayload = { reason: reqPass ? "WRONG_PASSWORD" : "PASSWORD_REQUIRED" };
      if (sourceConn && sourceConn.open) {
        try {
          sourceConn.send({
            type: "JOIN_REJECTED",
            payload: rejectPayload,
            targetId: msg.senderId,
            roomCode: state.roomCode,
            senderId: state.localInstanceId
          });
          setTimeout(() => { try { sourceConn.close(); } catch (_) {} }, 250);
        } catch (e) {}
      } else {
        sendP2PMessage("JOIN_REJECTED", rejectPayload, msg.senderId);
      }
      return;
    }

    if (sourceConn && msg.senderId) state.peers.set(msg.senderId, sourceConn);
    let existing = state.players[msg.senderId];
    if (!existing && msg.payload?.deviceId) {
      const prevDisconnected = Object.values(state.players).find(
        (p) =>
          p.deviceId === msg.payload.deviceId &&
          (p.disconnected || msg.payload?.isReconnect) &&
          p.role !== "host" &&
          p.id !== state.localInstanceId
      );
      if (prevDisconnected) {
        existing = prevDisconnected;
        if (prevDisconnected.id !== msg.senderId) {
          delete state.players[prevDisconnected.id];
          if (state.peers) state.peers.delete(prevDisconnected.id);
        }
      }
    }
    const isReturningSession = Boolean(existing && existing.role !== "host");

    let assignedRole = "spectator";
    if (msg.payload?.isReconnect && isReturningSession && existing.role) {
      assignedRole = existing.role;
    } else if (state.matchInProgress) {
      assignedRole = isReturningSession && existing.role === "player" && msg.payload?.wantSpectate === false ? "player" : "spectator";
    } else if (msg.payload?.wantSpectate === false) {
      assignedRole = "player";
    } else {
      assignedRole = "spectator";
    }

    const cfg = getHostSyncConfig(false);
    const counts = getLocalGrandCounts();

    state.players[msg.senderId] = {
      id: msg.senderId,
      deviceId: clientDevId,
      name: msg.payload?.name || existing?.name || "玩家",
      role: assignedRole,
      isReady: isReturningSession && assignedRole === existing?.role ? Boolean(existing.isReady) : false,
      disconnected: false,
      finished: isReturningSession ? Boolean(existing.finished) : false,
      finishReason: isReturningSession ? existing.finishReason || null : null,
      score: isReturningSession ? existing.score || 0 : 0,
      total: counts.regionTotal,
      stationScore: isReturningSession ? existing.stationScore || 0 : 0,
      stationTotal: counts.stationTotal,
      macroProgress: isReturningSession ? existing.macroProgress || {} : {},
      finalStats: isReturningSession ? existing.finalStats || null : null,
      unlockedTowns: isReturningSession && Array.isArray(existing.unlockedTowns) ? existing.unlockedTowns : [],
      unlockedCounties: isReturningSession && Array.isArray(existing.unlockedCounties) ? existing.unlockedCounties : [],
      unlockedProvinces: isReturningSession && Array.isArray(existing.unlockedProvinces) ? existing.unlockedProvinces : [],
      missedTowns: isReturningSession && Array.isArray(existing.missedTowns) ? existing.missedTowns : [],
      unlockedStations: isReturningSession && Array.isArray(existing.unlockedStations) ? existing.unlockedStations : [],
      missedStations: isReturningSession && Array.isArray(existing.missedStations) ? existing.missedStations : [],
      targetId: isReturningSession ? existing.targetId || null : null,
      targetStationKey: isReturningSession ? existing.targetStationKey || null : null,
      elapsedSec: isReturningSession ? existing.elapsedSec || 0 : 0,
      stats: isReturningSession ? existing.stats || null : null,
      _viewSets: null
    };

    ensureLocalPlayerInRoster();
    syncPrimaryOpponentFromRoster();

    const welcomePayload = {
      name: state.nickname || "房主",
      assignedRole,
      isReconnected: isReturningSession,
      restoredSession: isReturningSession ? state.players[msg.senderId] : null,
      matchInProgress: state.matchInProgress,
      config: cfg,
      players: state.players
    };
    sendP2PMessage("LOBBY_WELCOME", welcomePayload, msg.senderId);
    broadcastRosterFromHost();
    updateP2PPanelVisibility();
    updateP2PLobbyUI();
    updateOpponentUI();

    const roleLabel = assignedRole === "spectator" ? "觀戰者" : "參賽選手";
    setFeedback(
      isReturningSession
        ? `🔄 ${roleLabel}【${state.players[msg.senderId].name}】已重新連回房間！`
        : `🎮 ${roleLabel}【${state.players[msg.senderId].name}】已進入房間！`,
      "tier"
    );
    playTone("tier");
  } else if (msg.type === "LOBBY_LEAVE") {
    if (state.players[msg.senderId]) {
      const leftName = state.players[msg.senderId].name;
      delete state.players[msg.senderId];
      if (state.peers) state.peers.delete(msg.senderId);
      setFeedback(`🚪 成員【${leftName}】已離開房間`, "warn");
      syncPrimaryOpponentFromRoster();
      if (state.isHost) broadcastRosterFromHost();
      updateP2PPanelVisibility();
      updateP2PLobbyUI();
      updateOpponentUI();
      checkIfLocalIsLastPlayer();
    }
  } else if (msg.type === "HOST_HANDOVER") {
    if (msg.payload?.newHostId === state.localInstanceId) {
      promoteLocalClientToNewHost(msg.payload);
    } else {
      if (msg.payload?.players) {
        state.players = msg.payload.players;
        Object.values(state.players).forEach((p) => { p._viewSets = null; });
      }
      syncPrimaryOpponentFromRoster();
      updateP2PLobbyUI();
      updateOpponentUI();
      setFeedback(`👑 原房主已離開，房主權限已移交給【${msg.payload?.newHostName || "新房主"}】！`, "info");
    }
  } else if (msg.type === "ROOM_CLOSED") {
    leaveP2PRoom("🚪 所有成員皆已退出，房間已關閉");
  } else if (msg.type === "PLAYER_KICKED") {
    if (!msg.payload?.targetId || msg.payload.targetId === state.localInstanceId) {
      leaveP2PRoom("🚪 你已被房主移出房間");
      playTone("error");
    }
  } else if (msg.type === "PLAYER_BANNED") {
    if (
      msg.payload?.targetId === state.localInstanceId ||
      (msg.payload?.deviceId && msg.payload.deviceId === state.deviceId)
    ) {
      leaveP2PRoom("🚫 你的裝置已被房主封鎖，無法待在此房間！");
      playTone("error");
    }
  } else if (msg.type === "JOIN_REJECTED") {
    const reason = msg.payload?.reason;
    const entryModal = document.getElementById("modal-join-entry");
    const isEntryModalOpen = entryModal && !entryModal.classList.contains("hidden");

    const errMsg =
      reason === "DEVICE_BANNED"
        ? "🚫 此裝置已被房主封鎖，禁止加入本房間！"
        : reason === "PASSWORD_REQUIRED"
        ? "🔒 此房間設有密碼，請輸入房間密碼後再點加入！"
        : "❌ 密碼輸入錯誤，請確認房間密碼後再試！";

    if (isEntryModalOpen) {
      const pwWrap = document.getElementById("join-entry-password-wrap");
      const pwInput = document.getElementById("join-entry-password-input");
      const errBox = document.getElementById("join-entry-error");
      const errTxt = document.getElementById("join-entry-error-text");
      if (reason === "PASSWORD_REQUIRED" || reason === "WRONG_PASSWORD") {
        state.roomHasPassword = true;
        if (pwWrap) pwWrap.classList.remove("hidden");
        if (pwInput) {
          pwInput.classList.add("border-rose-500", "animate-shake");
          setTimeout(() => pwInput.classList.remove("animate-shake"), 350);
          pwInput.focus();
        }
      }
      if (errBox && errTxt) {
        errTxt.textContent = errMsg;
        errBox.classList.remove("hidden");
      }
    } else {
      const statusEl = document.getElementById("p2p-modal-status");
      const passInput = document.getElementById("p2p-password-input");
      if (typeof openRoomModal === "function") openRoomModal();
      if (statusEl) {
        statusEl.textContent = errMsg;
        statusEl.className = "text-[11px] text-rose-400 font-bold block px-1";
      }
      if (passInput) {
        passInput.classList.add("border-rose-500", "animate-shake");
        setTimeout(() => passInput.classList.remove("animate-shake"), 350);
        passInput.focus();
      }
    }

    state.roomCode = "";
    state.role = "solo";
    state.opponent.connected = false;
    updateP2PPanelVisibility();
    updateP2PLobbyUI();
    setFeedback(errMsg, "error");
    playTone("error");
  } else if (msg.type === "LOBBY_WELCOME") {
    if (state.isHost) return;
    if (state._joinTimeoutTimer) {
      clearTimeout(state._joinTimeoutTimer);
      state._joinTimeoutTimer = null;
    }
    state.pendingJoinRoomCode = "";
    state.role = msg.payload?.assignedRole || "spectator";
    state.matchInProgress = Boolean(msg.payload?.matchInProgress);
    state.spectatorLayerInitialized = false;

    if (msg.payload?.players) {
      state.players = msg.payload.players;
      Object.values(state.players).forEach((p) => { p._viewSets = null; });
    }
    const finishWelcomeUI = () => {
      if (msg.payload?.restoredSession) {
        restoreLocalSessionProgress(msg.payload.restoredSession);
      }

      // Close URL Client Entry Modal and open the simplified Room Lobby Modal!
      document.getElementById("modal-join-entry")?.classList.add("hidden");
      document.getElementById("join-entry-error")?.classList.add("hidden");
      if (!state.matchInProgress && typeof openRoomModal === "function") {
        openRoomModal();
      }

      ensureLocalPlayerInRoster();
      syncPrimaryOpponentFromRoster();
      updateP2PPanelVisibility();
      updateP2PLobbyUI();
      updateOpponentUI();
      refreshAllPolygonStyles();
      updateRoadAndRailwayTileOverlays();
      updateScoreAndProgressUI();
    };

    const welcomeSyncRes = msg.payload?.config ? applyRemoteSyncConfig(msg.payload.config, true, true) : null;
    if (welcomeSyncRes && typeof welcomeSyncRes.then === "function") {
      welcomeSyncRes.then(finishWelcomeUI, finishWelcomeUI);
    } else {
      finishWelcomeUI();
    }

    const msgText = msg.payload?.isReconnected
      ? `🔄 已恢復你在房間 ${state.roomCode} 的連線與進度！`
      : state.role === "spectator"
      ? `👁️ 已以「觀戰模式」進入房間 ${state.roomCode}！`
      : `🎮 已以「參賽選手」加入房間 ${state.roomCode}！請確認設定並點擊準備`;
    const statusEl = document.getElementById("p2p-modal-status");
    if (statusEl) {
      statusEl.textContent = msgText;
      statusEl.className = "text-[11px] text-emerald-400 font-medium block px-1";
    }
    setFeedback(msgText, "info");
    playTone("unlock");
  } else if (msg.type === "ROOM_ROSTER") {
    if (state.isHost) return;
    if (msg.payload?.players) {
      state.players = msg.payload.players;
      Object.values(state.players).forEach((p) => { p._viewSets = null; });
      if (state.players[state.localInstanceId]) {
        state.role = state.players[state.localInstanceId].role;
        if (!state.isHost && state.role !== "spectator" && state.isReady && !state.players[state.localInstanceId].isReady) {
          state._readyJustClearedByHost = true;
          state.isReady = false;
        }
      }
    }
    if (typeof msg.payload?.matchInProgress === "boolean") {
      state.matchInProgress = msg.payload.matchInProgress;
    }
    syncPrimaryOpponentFromRoster();
    updateP2PPanelVisibility();
    updateP2PLobbyUI();
    updateOpponentUI();
    if (state.role === "spectator" || state.finished) {
      refreshAllPolygonStyles();
      updateRoadAndRailwayTileOverlays();
      renderSmartLabelsAndLeaderLines();
      updateScoreAndProgressUI();
    }
    checkIfLocalIsLastPlayer();
  } else if (msg.type === "SYNC_ROLE_CHANGE") {
    if (!state.isHost) return;
    const p = state.players[msg.senderId];
    if (!p) return;
    if (state.matchInProgress && msg.payload?.role === "player") return;
    p.role = msg.payload?.role === "spectator" ? "spectator" : "player";
    p.isReady = false;
    if (msg.payload?.name) p.name = msg.payload.name;
    syncPrimaryOpponentFromRoster();
    broadcastRosterFromHost();
    updateP2PLobbyUI();
    updateOpponentUI();
  } else if (msg.type === "SYNC_Q_SOLVED") {
    if (typeof handleRemoteQuestionSolved === "function") {
      handleRemoteQuestionSolved(msg.payload, msg.senderId);
    }
    if (state.isHost) {
      sendP2PMessage("SYNC_Q_SOLVED", { ...msg.payload, senderId: msg.senderId }, null, msg.senderId);
    }
  } else if (msg.type === "SYNC_Q_ADVANCE") {
    if (!state.isHost && typeof handleRemoteQuestionAdvance === "function") {
      handleRemoteQuestionAdvance(msg.payload);
    }
  } else if (msg.type === "SYNC_STATE") {
    handleIncomingP2PData(msg.payload, msg.senderId);
    if (state.isHost) {
      sendP2PMessage("SYNC_STATE", { ...msg.payload, senderId: msg.senderId }, null, msg.senderId);
    }
  } else if (msg.type === "SYNC_START") {
    if (state.isHost) return;
    startSynchronizedP2PCountdown(msg.payload, false);
  } else if (msg.type === "SYNC_CONFIG" || msg.type === "HOST_CONFIG_UPDATE") {
    if (state.isHost) return;
    const cfgRes = applyRemoteSyncConfig(msg.payload, false, true);
    if (cfgRes && typeof cfgRes.then === "function") {
      cfgRes.catch(() => {});
    }
  } else if (msg.type === "SYNC_READY_STATUS") {
    const targetId = msg.senderId;
    if (state.players[targetId]) {
      const prevReady = state.players[targetId].isReady;
      if (msg.payload?.name) state.players[targetId].name = msg.payload.name;
      state.players[targetId].isReady = Boolean(msg.payload?.ready);
      if (state.isHost && prevReady !== state.players[targetId].isReady && msg.payload?.reason !== "config_reset") {
        playTone(msg.payload?.ready ? "unlock" : "error");
        setFeedback(
          `玩家【${msg.payload?.name || "對手"}】${msg.payload?.ready ? "已準備完成！" : "取消了準備"}`,
          msg.payload?.ready ? "tier" : "warn"
        );
      }
    }
    syncPrimaryOpponentFromRoster();
    if (state.isHost) {
      broadcastRosterFromHost();
    }
    updateP2PLobbyUI();
    updateOpponentUI();
  } else if (msg.type === "SYNC_PLAYER_FINISHED") {
    handleOpponentFinished(msg.payload, msg.senderId);
    if (state.isHost) {
      sendP2PMessage("SYNC_PLAYER_FINISHED", { ...msg.payload, senderId: msg.senderId }, null, msg.senderId);
      broadcastRosterFromHost();
    }
  } else if (msg.type === "REMATCH_REQUEST") {
    handleRematchRequest(msg.payload);
  } else if (msg.type === "REMATCH_ACCEPT") {
    handleRematchAccepted(msg.senderId);
  } else if (msg.type === "REMATCH_DECLINE") {
    handleRematchDeclined(msg.payload);
  } else if (msg.type === "RETURN_TO_LOBBY_REQUEST") {
    if (state.isHost) {
      setFeedback(`玩家【${msg.payload?.sender || "對手"}】請求回到房間重新設定`, "info");
      executeReturnToLobby();
    }
  } else if (msg.type === "RETURN_TO_LOBBY") {
    executeReturnToLobby();
  }
}

// ============================================================================
// MVC LOBBY & ROSTER RENDERING (With Host Kick ✕ and Ban 🚫 Buttons)
// ============================================================================
function renderMultiplayerLobbyRoster() {
  const rosterWrap = document.getElementById("p2p-multiplayer-roster");
  const rosterTitle = document.getElementById("p2p-roster-title");
  const rosterList = document.getElementById("p2p-roster-list");
  if (!rosterWrap || !rosterList) return;

  const list = getParticipantList();
  if (!state.roomCode && !state.aiRivalActive) {
    rosterList.replaceChildren();
    return;
  }

  const activeCount = getActiveBattlePlayers().length;
  const specCount = getSpectators().length;
  if (rosterTitle) {
    rosterTitle.textContent = `👥 房間成員 (${list.length}人：參賽 ${activeCount}${specCount > 0 ? ` · 觀戰 ${specCount}` : ""})`;
  }

  rosterList.replaceChildren();
  const tpl = document.getElementById("tpl-p2p-roster-item");
  list.forEach((p) => {
    if (!tpl || !tpl.content) return;
    const row = tpl.content.firstElementChild.cloneNode(true);
    const isMe = p.id === state.localInstanceId;
    const roleIconEl = row.querySelector(".roster-role-icon");
    const nameEl = row.querySelector(".roster-name");
    const devEl = row.querySelector(".roster-dev");
    const badgeEl = row.querySelector(".roster-badge");
    const kickBtn = row.querySelector(".roster-kick-btn");
    const banBtn = row.querySelector(".roster-ban-btn");

    if (roleIconEl) {
      roleIconEl.textContent = p.role === "host" ? "👑" : p.role === "spectator" ? "👁️" : "🎮";
    }
    if (nameEl) nameEl.textContent = `${p.name}${isMe ? " (你)" : ""}`;
    if (devEl) devEl.textContent = p.disconnected ? "[斷線]" : `#${(p.deviceId || p.id || "").slice(-4)}`;
    if (badgeEl) {
      if (p.disconnected) {
        badgeEl.className = "roster-badge px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 text-[11px] font-bold shrink-0";
        badgeEl.textContent = "🔌 斷線";
      } else if (p.role === "host") {
        badgeEl.className = "roster-badge px-2 py-0.5 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[11px] font-bold shrink-0";
        badgeEl.textContent = "房主 · 已準備";
      } else if (p.role === "spectator") {
        badgeEl.className = "roster-badge px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold shrink-0";
        badgeEl.textContent = "觀戰中";
      } else if (p.isReady) {
        badgeEl.className = "roster-badge px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold shrink-0";
        badgeEl.textContent = "✓ 已準備";
      } else {
        badgeEl.className = "roster-badge px-2 py-0.5 rounded-lg bg-slate-800 text-amber-300 border border-slate-700 text-[11px] font-bold shrink-0";
        badgeEl.textContent = "⏳ 未準備";
      }
    }

    // Host Kick (✕) and Ban (Ban) buttons for non-host members
    if (state.isHost && !isMe && p.id !== "ai_rival") {
      if (kickBtn) {
        kickBtn.classList.remove("hidden");
        kickBtn.addEventListener("click", () => kickPlayerFromRoom(p.id));
      }
      if (banBtn) {
        banBtn.classList.remove("hidden");
        banBtn.addEventListener("click", () => banDeviceFromRoom(p.id));
      }
    }

    rosterList.appendChild(row);
  });
}

function updateRoomShareLinksUI() {
  const specInput = document.getElementById("p2p-share-url-spectate");
  const playInput = document.getElementById("p2p-share-url-play");
  const legacyInput = document.getElementById("p2p-share-url");
  const lockHint = document.getElementById("p2p-password-lock-hint");

  if (!state.roomCode) {
    if (specInput) specInput.value = "尚未建立或加入房間";
    if (playInput) playInput.value = "尚未建立或加入房間";
    if (legacyInput) legacyInput.value = "尚未建立房間";
    if (lockHint) lockHint.classList.add("hidden");
    return;
  }

  const rawBase = window.location.href.split("?")[0].split("#")[0];
  const baseUrl = (!window.location.origin || window.location.origin === "null") ? rawBase : `${window.location.origin}${window.location.pathname}`;
  const specUrl = `${baseUrl}?room=${state.roomCode}&mode=spectate`;
  const playUrl = `${baseUrl}?room=${state.roomCode}&mode=player`;

  if (specInput) specInput.value = specUrl;
  if (playInput) playInput.value = playUrl;
  if (legacyInput) legacyInput.value = specUrl;
  if (lockHint) lockHint.classList.toggle("hidden", !state.roomPassword);
}

function updateP2PLobbyUI() {
  const devBadge = document.getElementById("device-id-badge");
  if (devBadge) {
    devBadge.textContent = `ID:${state.deviceId.slice(-6)}`;
  }

  ensureLocalPlayerInRoster();
  updateRoomShareLinksUI();
  updateTopBarRoomControlsUI();
  renderRoomConciseSettingsSummary();

  const inRoom = Boolean(state.roomCode || state.aiRivalActive);
  const connectView = document.getElementById("room-connect-view");
  const activeView = document.getElementById("room-active-view");
  const roomFooter = document.getElementById("room-modal-footer");
  const roomModalTitle = document.getElementById("room-modal-title");
  const hostRestrictPanel = document.getElementById("host-room-restrictions-panel");
  const openModeBtnText = document.getElementById("room-open-mode-btn-text");

  if (connectView) connectView.classList.toggle("hidden", inRoom);
  if (activeView) activeView.classList.toggle("hidden", !inRoom);
  if (roomFooter) roomFooter.classList.toggle("hidden", !inRoom);
  if (hostRestrictPanel) hostRestrictPanel.classList.toggle("hidden", !state.isHost);
  if (typeof syncRoomRestrictionsDrawerUI === "function") syncRoomRestrictionsDrawerUI();

  const roleIndicator = document.getElementById("p2p-role-indicator");
  const myReadyBtn = document.getElementById("btn-p2p-toggle-ready");
  const myReadyIcon = document.getElementById("p2p-ready-btn-icon");
  const myReadyText = document.getElementById("p2p-ready-btn-text");

  const lobbyCountEl = document.getElementById("p2p-lobby-count");
  const startBtn = document.getElementById("btn-p2p-sync-start");
  const startBtnIcon = document.getElementById("p2p-start-btn-icon");
  const startBtnText = document.getElementById("p2p-start-btn-text");
  const warningBanner = document.getElementById("p2p-re-ready-warning");
  const leaveBtn = document.getElementById("btn-p2p-leave");

  const layerRuleSelect = document.getElementById("p2p-layer-rule-select");
  const forcedLayerSelect = document.getElementById("p2p-forced-layer-select");
  const railRuleSelect = document.getElementById("p2p-rail-rule-select");
  const borderRuleSelect = document.getElementById("p2p-border-rule-select");
  const roleSwitchBar = document.getElementById("p2p-role-switch-bar");
  const roleSwitchBtn = document.getElementById("btn-p2p-switch-role");
  const specStatusText = document.getElementById("p2p-spectator-status-text");

  const settingsFieldset = document.getElementById("unified-settings-fieldset");
  const guestReadonlyBanner = document.getElementById("guest-readonly-banner");
  const applyScopeBtn = document.getElementById("btn-apply-scope");

  if (leaveBtn) leaveBtn.classList.toggle("hidden", !inRoom);

  // =========================================================================
  // CASE 1: NOT IN ANY ROOM YET (Solo Mode)
  // =========================================================================
  if (!inRoom) {
    if (roomModalTitle) roomModalTitle.textContent = "建立或加入多人房間";
    if (roleIndicator) {
      roleIndicator.textContent = "👤 單人未入房";
      roleIndicator.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700";
    }
    if (roleSwitchBar) roleSwitchBar.classList.add("hidden");
    if (myReadyBtn) myReadyBtn.classList.add("hidden");
    if (startBtn) startBtn.classList.add("hidden");
    if (warningBanner) warningBanner.classList.add("hidden");
    if (guestReadonlyBanner) guestReadonlyBanner.classList.add("hidden");
    if (settingsFieldset) settingsFieldset.disabled = false;
    if (applyScopeBtn) applyScopeBtn.textContent = "🚀 確認套用設定";
    renderMultiplayerLobbyRoster();
    return;
  }

  // =========================================================================
  // CASE 2: HOST IN ACTIVE ROOM
  // =========================================================================
  const nonHostPlayers = getNonHostBattlePlayers();
  const spectators = getSpectators();
  const totalConnected = getParticipantList().filter((p) => !p.disconnected).length;
  const readyCount = nonHostPlayers.filter((p) => p.isReady).length;
  const hasOpponents = nonHostPlayers.length > 0 || state.aiRivalActive;
  const allNonHostReady =
    (nonHostPlayers.length > 0 && nonHostPlayers.every((p) => p.isReady)) ||
    (state.aiRivalActive && state.opponent.isReady);

  if (roomModalTitle) {
    roomModalTitle.textContent = `房間 ${state.roomCode || "AI陪練"}`;
  }

  if (state.isHost) {
    if (roleSwitchBar) roleSwitchBar.classList.add("hidden");
    if (guestReadonlyBanner) guestReadonlyBanner.classList.add("hidden");
    if (settingsFieldset) settingsFieldset.disabled = false;
    if (openModeBtnText) openModeBtnText.textContent = "⚙️ 修改模式與題庫設定（簡易 / 進階）";

    if (roleIndicator) {
      roleIndicator.textContent = `👑 房主`;
      roleIndicator.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30";
    }
    if (myReadyBtn) myReadyBtn.classList.add("hidden");
    if (warningBanner) warningBanner.classList.add("hidden");

    if (lobbyCountEl) {
      if (!hasOpponents) {
        lobbyCountEl.textContent = spectators.length > 0 ? `${totalConnected}人在房 (觀戰 ${spectators.length})` : `${totalConnected}人在房 · 等待加入`;
      } else if (allNonHostReady) {
        lobbyCountEl.textContent = `${totalConnected}人在房 · 全員已準備！`;
      } else {
        lobbyCountEl.textContent = `${totalConnected}人在房 · 準備 ${readyCount}/${nonHostPlayers.length}`;
      }
    }

    if (layerRuleSelect) layerRuleSelect.disabled = false;
    if (forcedLayerSelect) forcedLayerSelect.disabled = false;
    if (railRuleSelect) railRuleSelect.disabled = false;
    if (borderRuleSelect) borderRuleSelect.disabled = false;

    if (startBtn) {
      startBtn.classList.remove("hidden");
      if (allNonHostReady) {
        startBtn.disabled = false;
        if (startBtnIcon) startBtnIcon.textContent = "🚀";
        if (startBtnText) startBtnText.textContent = "全員已準備，立即開始對戰 (Start)！";
        startBtn.className = "w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm sm:text-base transition shadow-lg shadow-emerald-500/25 cursor-pointer flex items-center justify-center gap-2";
      } else if (!hasOpponents && spectators.length > 0) {
        startBtn.disabled = false;
        if (startBtnIcon) startBtnIcon.textContent = "🎬";
        if (startBtnText) startBtnText.textContent = `開始單人展演 (${spectators.length} 人觀戰中)`;
        startBtn.className = "w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-sky-400 to-indigo-500 hover:from-sky-300 hover:to-indigo-400 text-slate-950 font-black text-sm sm:text-base transition shadow-lg shadow-sky-500/25 cursor-pointer flex items-center justify-center gap-2";
      } else if (!hasOpponents) {
        startBtn.disabled = true;
        if (startBtnIcon) startBtnIcon.textContent = "⏳";
        if (startBtnText) startBtnText.textContent = "等待其他玩家加入並準備...";
        startBtn.className = "w-full py-3 px-4 rounded-2xl bg-slate-800 text-slate-500 font-black text-sm sm:text-base transition cursor-not-allowed border border-slate-700 flex items-center justify-center gap-2";
      } else {
        startBtn.disabled = true;
        if (startBtnIcon) startBtnIcon.textContent = "⏳";
        if (startBtnText) startBtnText.textContent = `等待參賽玩家準備 (${readyCount}/${nonHostPlayers.length})...`;
        startBtn.className = "w-full py-3 px-4 rounded-2xl bg-slate-800 text-amber-300/90 font-black text-sm sm:text-base transition cursor-not-allowed border border-amber-500/30 flex items-center justify-center gap-2";
      }
    }
    if (applyScopeBtn) {
      applyScopeBtn.textContent = "✅ 確認設定並返回房間";
    }
  } else {
    // =========================================================================
    // CASE 3: CLIENT PLAYER OR SPECTATOR IN ACTIVE ROOM
    // =========================================================================
    const isSpec = state.role === "spectator";
    if (settingsFieldset) settingsFieldset.disabled = true;
    if (guestReadonlyBanner) guestReadonlyBanner.classList.remove("hidden");
    if (openModeBtnText) openModeBtnText.textContent = "🔍 檢視詳細題庫設定";

    if (roleSwitchBar && state.roomCode) {
      roleSwitchBar.classList.remove("hidden");
      if (specStatusText) {
        specStatusText.textContent = isSpec ? "👁️ 觀戰模式 (免準備)" : "🎮 參賽選手模式";
      }
      if (roleSwitchBtn) {
        roleSwitchBtn.textContent = isSpec ? "🎮 切換為參賽選手" : "👁️ 切換為觀戰";
        roleSwitchBtn.disabled = state.matchInProgress && isSpec;
      }
    }

    if (roleIndicator) {
      roleIndicator.textContent = isSpec ? `👁️ 觀戰者` : `🎮 參賽選手`;
      roleIndicator.className = isSpec
        ? "text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30"
        : "text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30";
    }

    if (myReadyBtn) {
      if (isSpec) {
        myReadyBtn.classList.add("hidden");
      } else {
        myReadyBtn.classList.remove("hidden");
        if (state.isReady) {
          if (myReadyIcon) myReadyIcon.textContent = "✅";
          if (myReadyText) myReadyText.textContent = "已準備完成！等待房主開始 (點擊取消)";
          myReadyBtn.className = "w-full py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 font-black text-sm sm:text-base transition cursor-pointer flex items-center justify-center gap-2";
        } else {
          if (myReadyIcon) myReadyIcon.textContent = "⚡";
          if (myReadyText) myReadyText.textContent = "準備 (Ready)";
          myReadyBtn.className = "w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm sm:text-base shadow-lg shadow-amber-500/25 transition cursor-pointer animate-pulse flex items-center justify-center gap-2";
        }
      }
    }

    if (startBtn) startBtn.classList.add("hidden");

    if (lobbyCountEl) {
      lobbyCountEl.textContent = isSpec
        ? `${totalConnected}人在房 · 👁️ 觀戰中`
        : state.isReady
        ? `${totalConnected}人在房 · ✓ 已準備`
        : `${totalConnected}人在房 · ⏳ 請點準備`;
    }

    if (applyScopeBtn) {
      applyScopeBtn.textContent = "關閉設定視窗";
    }
  }

  renderMultiplayerLobbyRoster();

  if (layerRuleSelect) layerRuleSelect.value = state.p2pLayerRule || "free";
  if (forcedLayerSelect) forcedLayerSelect.value = state.p2pForcedLayer || "vector";
  if (railRuleSelect) railRuleSelect.value = state.p2pRailRule || "free";
  if (borderRuleSelect) borderRuleSelect.value = state.p2pBorderRule || "free";
}

function toggleP2PReady() {
  if (!state.roomCode || state.isHost || state.role === "spectator") return;
  state.isReady = !state.isReady;
  hideRoomConfigChangeToast();
  ensureLocalPlayerInRoster();
  sendP2PMessage("SYNC_READY_STATUS", { ready: state.isReady, name: state.nickname });
  updateP2PLobbyUI();
}

function notifyP2PPlayerFinished(finalStats) {
  state.finished = true;
  state.finalStats = finalStats;
  ensureLocalPlayerInRoster();
  if (state.isHost) {
    const allDone = getActiveBattlePlayers().every((p) => p.finished);
    if (allDone) state.matchInProgress = false;
    broadcastRosterFromHost();
  }
  sendP2PMessage("SYNC_PLAYER_FINISHED", finalStats);
  updateOpponentUI();
}

function checkIfLocalIsLastPlayer() {
  if (state.role === "spectator" || state.finished || !state.matchInProgress || state.promptedLastPlayer) return;
  const otherPlayers = getActiveBattlePlayers().filter((p) => p.id !== state.localInstanceId);
  if (otherPlayers.length === 0) return;
  if (otherPlayers.every((p) => p.finished)) {
    state.promptedLastPlayer = true;
    const modal = document.getElementById("modal-opponent-finished");
    const desc = document.getElementById("opp-finish-desc");
    if (modal && desc) {
      desc.textContent = `其他對戰玩家（共 ${otherPlayers.length} 位）都已完賽！要繼續作答還是立即結算？`;
      modal.classList.remove("hidden");
      playTone("tier");
    }
  }
}

function handleOpponentFinished(payload, senderIdFromMsg = null) {
  if (!payload) return;
  const senderId = payload.senderId || senderIdFromMsg;
  const authCounts = getLocalGrandCounts();

  if (senderId && state.players[senderId]) {
    state.players[senderId].finished = true;
    state.players[senderId].finishReason = payload.reason || "giveup";
    state.players[senderId].finalStats = payload;
    state.players[senderId].score = payload.adminCurrent ?? payload.grandScore ?? state.players[senderId].score;
    state.players[senderId].total = authCounts.regionTotal || payload.adminTotal || state.players[senderId].total;
    state.players[senderId].stationScore = payload.unlockedStCount ?? state.players[senderId].stationScore;
    state.players[senderId].stationTotal = authCounts.stationTotal || payload.stationTotal || state.players[senderId].stationTotal;
    state.players[senderId]._viewSets = null;
  }

  syncPrimaryOpponentFromRoster();
  if (!senderId || !state.players[senderId]) {
    state.opponent.finished = true;
    state.opponent.finalStats = payload;
    state.opponent.score = payload.grandScore || payload.score || 0;
    state.opponent.total = authCounts.grandTotal || payload.grandTotal || _p2pItems().length || 368;
  }

  if (state.isHost) {
    const allDone = getActiveBattlePlayers().every((p) => p.finished);
    if (allDone) {
      state.matchInProgress = false;
      broadcastRosterFromHost();
    }
  }

  updateOpponentUI();
  if (state.role === "spectator" && senderId === state.spectatingPlayerId) {
    refreshAllPolygonStyles();
    updateRoadAndRailwayTileOverlays();
    updateScoreAndProgressUI();
  }

  const oppPct = payload.grandTotal > 0 ? ((payload.grandScore / payload.grandTotal) * 100).toFixed(1) : "0.0";
  const reasonText = payload.reason === "victory" ? "100% 通關" : payload.reason === "timeout" ? "時間到" : "提早結束";

  if (state.finished) {
    showSettlementModal();
  } else if (state.role === "spectator") {
    setFeedback(`👁️ 觀戰通知：選手【${payload.name || "選手"}】已完賽（${reasonText} · ${oppPct}%）`, "tier");
  } else {
    setFeedback(`🏁 玩家【${payload.name || "對手"}】已結束（${reasonText} · ${oppPct}%）`, "info");
    if (state.aiRivalTimer || (getActiveBattlePlayers().length <= 2 && !state.matchInProgress)) {
      const modal = document.getElementById("modal-opponent-finished");
      const desc = document.getElementById("opp-finish-desc");
      if (modal && desc) {
        desc.textContent = `對手【${payload.name || "對手"}】已結束本局（${payload.grandScore} / ${payload.grandTotal} · ${oppPct}%），要繼續作答嗎？`;
        modal.classList.remove("hidden");
        playTone("tier");
      }
    } else {
      checkIfLocalIsLastPlayer();
    }
  }
}

function requestP2PRematch() {
  const hasBattleOpponent = Boolean(getActiveBattlePlayers().length >= 2 || state.aiRivalTimer || state.aiRivalActive);
  if (!hasBattleOpponent) {
    document.getElementById("modal-settlement")?.classList.add("hidden");
    if (state.isHost && state.roomCode && getSpectators().length > 0) {
      startSynchronizedP2PCountdown(getHostSyncConfig(false), true);
    } else {
      resetGame();
    }
    return;
  }

  const rematchBtn = document.getElementById("btn-rematch-settlement");
  const rematchText = document.getElementById("rematch-btn-text");
  if (rematchBtn) rematchBtn.disabled = true;
  if (rematchText) rematchText.textContent = "⏳ 等待同意...";

  if (state.aiRivalTimer || state.aiRivalActive) {
    setTimeout(() => {
      document.getElementById("modal-settlement")?.classList.add("hidden");
      startSynchronizedP2PCountdown(getHostSyncConfig(false), true);
    }, 250);
    return;
  }

  sendP2PMessage("REMATCH_REQUEST", { sender: state.nickname });
  setFeedback("⏳ 已發送重新對戰邀請，等待回應...", "info");
}

function handleRematchRequest(payload) {
  if (state.role === "spectator") return;
  const modal = document.getElementById("modal-rematch-confirm");
  const desc = document.getElementById("rematch-confirm-desc");
  if (modal && desc) {
    desc.textContent = `玩家【${payload?.sender || state.opponent.name || "對手"}】邀請以相同設定重新開局對戰，是否同意？`;
    modal.classList.remove("hidden");
    playTone("tier");
  }
}

function respondP2PRematch(accepted) {
  const modal = document.getElementById("modal-rematch-confirm");
  if (modal) modal.classList.add("hidden");

  sendP2PMessage(accepted ? "REMATCH_ACCEPT" : "REMATCH_DECLINE", { sender: state.nickname });

  if (accepted) {
    document.getElementById("modal-settlement")?.classList.add("hidden");
    if (state.isHost) {
      startSynchronizedP2PCountdown(getHostSyncConfig(false), true);
    }
  } else {
    setFeedback("已婉拒重新開局邀請", "info");
  }
}

function handleRematchAccepted() {
  document.getElementById("modal-settlement")?.classList.add("hidden");
  if (state.isHost) {
    startSynchronizedP2PCountdown(getHostSyncConfig(false), true);
  }
}

function handleRematchDeclined(payload) {
  const rematchBtn = document.getElementById("btn-rematch-settlement");
  const rematchText = document.getElementById("rematch-btn-text");
  if (rematchBtn) rematchBtn.disabled = false;
  if (rematchText) rematchText.textContent = "再玩一局";
  setFeedback(`玩家【${payload?.sender || "對手"}】婉拒了重新開局邀請`, "warn");
}

function requestReturnToLobby() {
  const isMultiplayer = Boolean(state.roomCode || state.aiRivalTimer || state.aiRivalActive || getActiveBattlePlayers().length > 1);

  if (!isMultiplayer) {
    resetGame();
    document.getElementById("modal-settlement")?.classList.add("hidden");
    if (typeof openGameHubModal === "function") openGameHubModal();
    return;
  }

  const returnBtn = document.getElementById("btn-return-lobby-settlement");
  const returnText = document.getElementById("return-lobby-btn-text");
  if (returnBtn) returnBtn.disabled = true;
  if (returnText) returnText.textContent = "⏳ 返回中...";

  if (state.aiRivalTimer || state.aiRivalActive) {
    executeReturnToLobby();
    return;
  }

  if (state.isHost) {
    executeReturnToLobby();
  } else {
    sendP2PMessage("RETURN_TO_LOBBY_REQUEST", { sender: state.nickname });
    setFeedback("⏳ 已向房主發送回到房間設定請求...", "info");
  }
}

function executeReturnToLobby() {
  state.matchInProgress = false;
  state.finished = false;
  state.isGameOver = false;

  resetGame();

  getParticipantList().forEach((p) => {
    p.finished = false;
    p.finishReason = null;
    p.finalStats = null;
    p.score = 0;
    p.stationScore = 0;
    p.unlockedTowns = [];
    p.unlockedCounties = [];
    p.unlockedProvinces = [];
    p.missedTowns = [];
    p.unlockedStations = [];
    p.missedStations = [];
    p._viewSets = null;
    p.isReady = false;
  });

  state.isReady = false;
  if (state.opponent) {
    state.opponent.isReady = false;
    state.opponent.finished = false;
    state.opponent.finalStats = null;
    state.opponent.score = 0;
    state.opponent.stationScore = 0;
  }

  if (state.isHost) {
    sendP2PMessage("RETURN_TO_LOBBY", { sender: state.nickname });
    broadcastRosterFromHost();
  }

  document.getElementById("modal-settlement")?.classList.add("hidden");
  document.getElementById("modal-opponent-finished")?.classList.add("hidden");
  document.getElementById("modal-rematch-confirm")?.classList.add("hidden");
  document.getElementById("btn-reopen-settlement")?.classList.add("hidden");

  const returnBtn = document.getElementById("btn-return-lobby-settlement");
  const returnText = document.getElementById("return-lobby-btn-text");
  if (returnBtn) returnBtn.disabled = false;
  if (returnText) returnText.textContent = "回到房間設定";

  updateP2PLobbyUI();
  updateOpponentUI();
  if (typeof openRoomModal === "function") {
    openRoomModal();
  }

  setFeedback("🔄 全體回到房間準備畫面，準備狀態已歸零！", "tier");
  playTone("tier");
}

// ============================================================================
// URL CLIENT ENTRY MODAL (#modal-join-entry) & ROOM PROBING
// ============================================================================
function openUrlClientJoinEntryModal(roomCode, preferredRole = "spectator") {
  const code = (roomCode || "").trim().toUpperCase();
  if (!code) return;
  state.pendingJoinRoomCode = code;
  state.pendingJoinRole = preferredRole;
  state.roomHasPassword = false;

  syncAllNicknameInputs(state.nickname);

  const roomLbl = document.getElementById("join-entry-room-label");
  if (roomLbl) {
    roomLbl.textContent = `房號：${code}（${preferredRole === "player" ? "參賽連結" : "觀戰連結"}）`;
  }
  const pwWrap = document.getElementById("join-entry-password-wrap");
  if (pwWrap) pwWrap.classList.add("hidden");
  const pwInput = document.getElementById("join-entry-password-input");
  if (pwInput) {
    pwInput.value = "";
    pwInput.classList.remove("border-rose-500");
  }
  const errBox = document.getElementById("join-entry-error");
  if (errBox) errBox.classList.add("hidden");
  const submitBtn = document.getElementById("btn-join-entry-submit");
  if (submitBtn) submitBtn.disabled = false;

  // Hide other modals so #modal-join-entry is cleanly on top
  document.getElementById("modal-scope")?.classList.add("hidden");
  document.getElementById("modal-room")?.classList.add("hidden");
  const entryModal = document.getElementById("modal-join-entry");
  if (entryModal) entryModal.classList.remove("hidden");
  if (typeof syncModalBodyScrollLock === "function") syncModalBodyScrollLock();

  // Probe host via BroadcastChannel and PeerJS to check if room requires a password
  sendP2PMessage("ROOM_PROBE", { deviceId: state.deviceId }, null, null, code);
  try {
    if (typeof Peer !== "undefined") {
      if (state.peer) state.peer.destroy();
      state.peer = new Peer();
      state.peer.on("open", () => {
        if (!state.pendingJoinRoomCode || state.roomCode) return;
        const probeConn = state.peer.connect(`tw-geomaster-${code}`);
        probeConn.on("open", () => {
          try {
            probeConn.send({
              type: "ROOM_PROBE",
              payload: { deviceId: state.deviceId },
              roomCode: code,
              senderId: state.localInstanceId
            });
          } catch (_) {}
        });
        probeConn.on("data", (msg) => dispatchP2PMessage(msg, probeConn));
      });
    }
  } catch (_) {}

  setTimeout(() => {
    document.getElementById("join-entry-nickname-input")?.focus();
  }, 60);
}

function submitUrlClientJoinEntry() {
  const code = state.pendingJoinRoomCode || document.getElementById("p2p-room-code-input")?.value.trim().toUpperCase();
  if (!code) return;
  const nickEl = document.getElementById("join-entry-nickname-input");
  const pwEl = document.getElementById("join-entry-password-input");
  const errBox = document.getElementById("join-entry-error");
  const errTxt = document.getElementById("join-entry-error-text");

  const nick = (nickEl?.value || "").trim() || "玩家";
  syncAllNicknameInputs(nick);
  const pwd = (pwEl?.value || "").trim();

  if (state.roomHasPassword && !pwd) {
    if (errBox && errTxt) {
      errTxt.textContent = "🔒 此房間設有密碼，請先輸入密碼再按加入！";
      errBox.classList.remove("hidden");
    }
    if (pwEl) {
      pwEl.classList.add("border-rose-500", "animate-shake");
      setTimeout(() => pwEl.classList.remove("animate-shake"), 350);
      pwEl.focus();
    }
    playTone("error");
    return;
  }

  if (errBox) errBox.classList.add("hidden");
  joinP2PRoom(code, {
    password: pwd,
    preferredRole: state.pendingJoinRole || "spectator"
  });
}

// ============================================================================
// P2P INITIALIZATION, ROOM HOSTING & ROOM JOINING
// ============================================================================
function initP2PEngine() {
  syncAllNicknameInputs(state.nickname);

  try {
    state.bcChannel = new BroadcastChannel("taiwan_geomaster_p2p_sync");
    state.bcChannel.onmessage = (ev) => {
      if (ev.data) dispatchP2PMessage(ev.data);
    };
  } catch (e) {}

  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const urlRoom = (params.get("room") || hashParams.get("room") || hashParams.get("p2p") || "").trim().toUpperCase();
  const urlMode = (params.get("mode") || hashParams.get("mode") || params.get("role") || "").trim().toLowerCase();

  const savedSession = loadSavedSessionFromStorage();

  // Case A: Opened via a Room Link (?room=XXXXXX) -> Confirmed Client Entry!
  // Show Top-Level Nickname + Password Modal (#modal-join-entry) first!
  if (urlRoom) {
    const roomInput = document.getElementById("p2p-room-code-input");
    if (roomInput) roomInput.value = urlRoom;

    const joinAsSpectator = urlMode !== "player" && urlMode !== "play" && urlMode !== "client";
    const chkSpec = document.getElementById("chk-p2p-join-spectate");
    if (chkSpec) chkSpec.checked = joinAsSpectator;

    openUrlClientJoinEntryModal(urlRoom, joinAsSpectator ? "spectator" : "player");
    updateP2PLobbyUI();
    return;
  }

  // Case B: Normal Solo Entry (No ?room= in URL) -> Open Mode Settings Modal in Simple Tab!
  state.roomCode = "";
  state.isHost = false;
  state.role = "solo";
  state.opponent.connected = false;

  if (savedSession && savedSession.roomCode) {
    const banner = document.getElementById("session-restore-banner");
    const txt = document.getElementById("session-restore-text");
    if (banner && txt) {
      const roleName = savedSession.isHost ? "👑 房主" : savedSession.role === "spectator" ? "👁️ 觀戰者" : "🎮 參賽選手";
      txt.textContent = `偵測到在房間【${savedSession.roomCode}】有未結束紀錄（${roleName}），是否恢復連線？`;
      banner.classList.remove("hidden");
    }
  }

  if (typeof openGameHubModal === "function") {
    openGameHubModal("solo");
  }
  updateP2PLobbyUI();
}

function hostP2PRoom(existingCode = "", existingPassword = null, restoredPlayers = null) {
  if (state.roomCode && !existingCode) {
    setFeedback("⚠️ 你已經在房間內，請先退出房間才能建立新房間！", "warn");
    return;
  }
  const code = existingCode || "TW" + Math.random().toString(36).substring(2, 6).toUpperCase();
  const hostPassInput = document.getElementById("p2p-host-password-input");
  const pwd =
    existingPassword !== null
      ? existingPassword
      : (hostPassInput?.value.trim() || "");
  if (hostPassInput && pwd) hostPassInput.value = pwd;

  const nickInput = document.getElementById("p2p-nickname-input");
  if (nickInput && nickInput.value.trim()) {
    syncAllNicknameInputs(nickInput.value.trim());
  }

  state.roomCode = code;
  state.roomPassword = pwd;
  state.isHost = true;
  state.role = "host";
  state.hubEntryTab = "host";
  state.spectatingPlayerId = null;
  hideRoomConfigChangeToast();
  state.matchInProgress = false;
  state.promptedLastPlayer = false;
  state.isReady = true;
  if (!existingCode) state.bannedDevices = new Set();
  state.peers = new Map();
  state.players = restoredPlayers && typeof restoredPlayers === "object" ? restoredPlayers : {};
  state.opponent.connected = false;
  state.opponent.isReady = false;
  state.opponent.name = "對手";

  ensureLocalPlayerInRoster();

  const lrule = document.getElementById("p2p-layer-rule-select")?.value || "free";
  const flayer = document.getElementById("p2p-forced-layer-select")?.value || "vector";
  const rrule = document.getElementById("p2p-rail-rule-select")?.value || "free";
  const brule = document.getElementById("p2p-border-rule-select")?.value || "free";
  applyP2PLayerRule(lrule, flayer, rrule, brule);

  const roomInput = document.getElementById("p2p-room-code-input");
  if (roomInput) roomInput.value = code;
  const roomTag = document.getElementById("p2p-room-tag");
  if (roomTag) roomTag.textContent = `房號: ${code} (Host${pwd ? " 🔒" : ""})`;

  const statusEl = document.getElementById("p2p-modal-status");
  if (statusEl) {
    statusEl.textContent = `已建立房間 ${code}${pwd ? "（密碼保護）" : ""}！可複製上方連結邀請好友`;
    statusEl.className = "text-[11px] text-emerald-400 font-medium block px-1";
  }

  updateP2PPanelVisibility();
  updateP2PLobbyUI();
  updateOpponentUI();

  try {
    if (typeof Peer !== "undefined") {
      if (state.peer) state.peer.destroy();
      state.peer = new Peer(`tw-geomaster-${code}`);
      state.peer.on("connection", (conn) => {
        setupPeerConnectionHandlers(conn);
      });
    }
  } catch (e) {}
}

function joinP2PRoom(codeInput, opts = {}) {
  const code = (codeInput || document.getElementById("p2p-room-code-input")?.value || "").trim().toUpperCase();
  if (!code) {
    setFeedback("⚠️ 請先輸入 6 碼房間代碼！", "warn");
    return;
  }
  const pwd =
    opts.password !== undefined
      ? opts.password
      : document.getElementById("p2p-password-input")?.value.trim() || "";
  const chkSpec = document.getElementById("chk-p2p-join-spectate");
  const wantSpectate =
    opts.preferredRole !== undefined
      ? opts.preferredRole === "spectator"
      : chkSpec
      ? Boolean(chkSpec.checked)
      : true;

  const nickInput = document.getElementById("p2p-nickname-input");
  if (nickInput && nickInput.value.trim()) {
    syncAllNicknameInputs(nickInput.value.trim());
  }

  state.roomCode = code;
  state.roomPassword = pwd;
  state.isHost = false;
  state.role = wantSpectate ? "spectator" : "player";
  state.hubEntryTab = "join";
  state.isReady = false;
  state.promptedLastPlayer = false;
  state.spectatorLayerInitialized = false;
  state.players = {};
  state.opponent.connected = false;

  const roomTag = document.getElementById("p2p-room-tag");
  if (roomTag) roomTag.textContent = `房號: ${code} (連線中...)`;
  const statusEl = document.getElementById("p2p-modal-status");
  if (statusEl) {
    statusEl.textContent = `正在連線至房間 ${code}...`;
    statusEl.className = "text-[11px] text-amber-300 font-medium block px-1";
  }

  updateP2PPanelVisibility();
  updateP2PLobbyUI();

  const joinPayload = {
    name: state.nickname,
    deviceId: state.deviceId,
    password: pwd,
    wantSpectate,
    isReconnect: Boolean(opts.isReconnect)
  };

  try {
    if (typeof Peer !== "undefined") {
      if (state.peer) state.peer.destroy();
      state.peer = new Peer();
      state.peer.on("open", () => {
        const conn = state.peer.connect(`tw-geomaster-${code}`);
        state.conn = conn;
        setupPeerConnectionHandlers(conn, joinPayload);
      });
    }
  } catch (e) {}

  sendP2PMessage("LOBBY_JOIN", joinPayload);
}

function setupPeerConnectionHandlers(conn, customJoinPayload = null) {
  conn.on("open", () => {
    if (!state.isHost) {
      const pwd = state.roomPassword || document.getElementById("p2p-password-input")?.value.trim() || "";
      const wantSpectate = state.role === "spectator";
      const payload = customJoinPayload || {
        name: state.nickname,
        deviceId: state.deviceId,
        password: pwd,
        wantSpectate
      };
      try {
        conn.send({
          type: "LOBBY_JOIN",
          payload,
          roomCode: state.roomCode || "",
          senderId: state.localInstanceId
        });
      } catch (e) {}
    }
    updateP2PLobbyUI();
  });

  conn.on("data", (msg) => {
    dispatchP2PMessage(msg, conn);
  });

  conn.on("close", () => {
    if (state.isHost && state.peers) {
      for (const [sid, c] of state.peers.entries()) {
        if (c === conn) {
          state.peers.delete(sid);
          if (state.players[sid]) {
            state.players[sid].disconnected = true;
            state.players[sid].disconnectedAt = Date.now();
            setFeedback(`🔌 成員【${state.players[sid].name}】連線中斷，已保留其裝置紀錄`, "warn");
          }
        }
      }
      syncPrimaryOpponentFromRoster();
      broadcastRosterFromHost();
      updateP2PLobbyUI();
      updateOpponentUI();
      checkIfLocalIsLastPlayer();
    }
  });
}

// ============================================================================
// REAL-TIME STATE BROADCAST & LIVE LEADERBOARD
// ============================================================================
function broadcastP2PState(lastItemName) {
  // Strict Guard: Never broadcast in Solo mode!
  if (!state.roomCode && !state.aiRivalActive) return;
  if (state.role === "spectator") return;

  const counts = getLocalGrandCounts();
  ensureLocalPlayerInRoster();

  const payload = {
    senderId: state.localInstanceId,
    deviceId: state.deviceId,
    name: state.nickname || "玩家",
    role: state.isHost ? "host" : "player",
    score: counts.regionCurrent,
    total: counts.regionTotal,
    stationScore: counts.stationCurrent,
    stationTotal: counts.stationTotal,
    macroProgress: counts.macroProgress,
    finished: Boolean(state.finished),
    finishReason: state.finalStats?.reason || null,
    elapsedSec: state.elapsedSec,
    lastItemName: lastItemName || "",
    unlockedTowns: Array.from(state.unlockedTowns),
    unlockedCounties: Array.from(state.unlockedCounties),
    unlockedProvinces: Array.from(state.unlockedProvinces),
    missedTowns: Array.from(state.missedTowns),
    unlockedStations: Array.from(state.unlockedStations),
    missedStations: Array.from(state.missedStations),
    unlockedPois: Array.from(state.unlockedPois || []),
    missedPois: Array.from(state.missedPois || []),
    targetId: state.targetId,
    targetStationKey: state.targetStationKey,
    targetPoiId: state.targetPoiId,
    stats: { ...state.stats }
  };

  sendP2PMessage("SYNC_STATE", payload);
  updateOpponentUI();
}

function handleIncomingP2PData(payload, senderIdFromMsg = null) {
  if (!payload || (!state.roomCode && !state.aiRivalActive)) return;
  const sid = payload.senderId || senderIdFromMsg;
  if (sid && sid === state.localInstanceId) return;

  const authCounts = getLocalGrandCounts();

  if (sid) {
    const existing = state.players[sid] || { id: sid, role: payload.role || "player" };
    const uTowns = Array.isArray(payload.unlockedTowns) ? payload.unlockedTowns : existing.unlockedTowns || [];
    const uCounties = Array.isArray(payload.unlockedCounties) ? payload.unlockedCounties : existing.unlockedCounties || [];
    const uStations = Array.isArray(payload.unlockedStations) ? payload.unlockedStations : existing.unlockedStations || [];

    const allItems = _p2pItems();
    const verifiedScore =
      Array.isArray(payload.unlockedTowns) || Array.isArray(payload.unlockedCounties)
        ? state.difficulty === "county_only"
          ? uCounties.filter((c) => state.selectedCounties.has(c)).length
          : uTowns.filter((id) => {
              const t = allItems.find((x) => x.id === id);
              return t && (typeof isTownInScope === "function" ? isTownInScope(t) : state.selectedCounties.has(t.countyName));
            }).length
        : payload.score || 0;

    const resolvedRole =
      existing && existing.role
        ? existing.role
        : payload.role === "spectator"
        ? "spectator"
        : payload.role === "host"
        ? "host"
        : "player";
    const validStationScore =
      authCounts.stationTotal > 0
        ? Array.isArray(payload.unlockedStations)
          ? uStations.length
          : payload.stationScore || 0
        : 0;
    const rawMacro = payload.macroProgress || existing.macroProgress || {};
    const validMacro =
      authCounts.stationTotal > 0
        ? rawMacro
        : rawMacro["地區"]
        ? { "地區": rawMacro["地區"] }
        : {};

    state.players[sid] = {
      ...existing,
      id: sid,
      deviceId: payload.deviceId || existing.deviceId || sid,
      name: payload.name || existing.name || "對手",
      role: resolvedRole,
      disconnected: false,
      score: verifiedScore,
      total: authCounts.regionTotal,
      stationScore: validStationScore,
      stationTotal: authCounts.stationTotal,
      macroProgress: validMacro,
      finished: Boolean(payload.finished || existing.finished),
      finishReason: payload.finishReason || existing.finishReason || null,
      unlockedTowns: uTowns,
      unlockedCounties: uCounties,
      unlockedProvinces: Array.isArray(payload.unlockedProvinces) ? payload.unlockedProvinces : existing.unlockedProvinces || [],
      missedTowns: Array.isArray(payload.missedTowns) ? payload.missedTowns : existing.missedTowns || [],
      unlockedStations: uStations,
      missedStations: Array.isArray(payload.missedStations) ? payload.missedStations : existing.missedStations || [],
      unlockedPois: Array.isArray(payload.unlockedPois) ? payload.unlockedPois : existing.unlockedPois || [],
      missedPois: Array.isArray(payload.missedPois) ? payload.missedPois : existing.missedPois || [],
      targetId: payload.targetId !== undefined ? payload.targetId : existing.targetId || null,
      targetStationKey: payload.targetStationKey !== undefined ? payload.targetStationKey : existing.targetStationKey || null,
      targetPoiId: payload.targetPoiId !== undefined ? payload.targetPoiId : existing.targetPoiId || null,
      elapsedSec: payload.elapsedSec ?? existing.elapsedSec ?? 0,
      stats: payload.stats || existing.stats || null,
      _viewSets: null
    };
  }

  syncPrimaryOpponentFromRoster();
  updateP2PPanelVisibility();
  updateOpponentUI();

  if ((state.role === "spectator" || state.finished) && sid === state.spectatingPlayerId) {
    refreshAllPolygonStyles();
    updateRoadAndRailwayTileOverlays();
    renderSmartLabelsAndLeaderLines();
    updateScoreAndProgressUI();
    updateTargetBannerUI();
  }
}

function updateOpponentUI() {
  if (!state.roomCode && !state.aiRivalActive) return;
  ensureLocalPlayerInRoster();

  const vState = typeof getActiveViewState === "function" ? getActiveViewState() : state;
  const watchedPlayer = vState.spectatingPlayer || state.players[state.localInstanceId];

  const localNameEl = document.getElementById("local-player-name");
  const localScoreEl = document.getElementById("local-p2p-score");
  const localPctEl = document.getElementById("local-p2p-pct");
  const localBarEl = document.getElementById("local-p2p-bar");

  const counts = getLocalGrandCounts();
  let leftCur = counts.grandCurrent;
  let leftTot = counts.grandTotal;
  if (vState.spectatingPlayer) {
    leftCur = (watchedPlayer.score || 0) + (watchedPlayer.stationScore || 0);
    leftTot = (watchedPlayer.total || 0) + (watchedPlayer.stationTotal || 0);
    if (localNameEl) localNameEl.textContent = `👁️ ${watchedPlayer.name}`;
  } else {
    if (localNameEl) localNameEl.textContent = `${state.nickname || "我方"} (我)`;
  }
  const leftPct = leftTot > 0 ? ((leftCur / leftTot) * 100).toFixed(1) : "0.0";
  if (localScoreEl) localScoreEl.textContent = `${leftCur} / ${leftTot}`;
  if (localPctEl) localPctEl.textContent = `${leftPct}%`;
  if (localBarEl) localBarEl.style.width = `${Math.min(100, parseFloat(leftPct))}%`;

  const sorted = getSortedActiveBattlePlayers();
  const spectators = getSpectators();
  const hasBattleOpponent = sorted.length >= 2 || Boolean(state.aiRivalActive);
  const isThreePlus = sorted.length >= 3;

  const livePanelEl = document.getElementById("p2p-live-panel");
  const livePanelTitle = livePanelEl ? livePanelEl.querySelector("h3") : null;
  const roomTagEl = document.getElementById("p2p-room-tag");
  if (livePanelTitle) {
    livePanelTitle.textContent = hasBattleOpponent
      ? "⚔️ 即時對戰進度看板"
      : spectators.length > 0
      ? "👁️ 單人展演 · 即時觀戰看板"
      : "🏠 多人房間 · 等待選手加入";
  }
  if (roomTagEl && state.roomCode) {
    roomTagEl.textContent = hasBattleOpponent
      ? `房號: ${state.roomCode} (${sorted.length}人對戰${spectators.length > 0 ? ` · ${spectators.length}觀戰` : ""})`
      : spectators.length > 0
      ? `房號: ${state.roomCode} (1人展演 · ${spectators.length}人觀戰)`
      : `房號: ${state.roomCode} (等待加入)`;
  }

  const remoteNameEl = document.getElementById("remote-player-name");
  const remoteScoreEl = document.getElementById("remote-p2p-score");
  const remotePctEl = document.getElementById("remote-p2p-pct");
  const remoteBarEl = document.getElementById("remote-p2p-bar");
  const lastEl = document.getElementById("remote-p2p-last");

  if (!hasBattleOpponent) {
    if (spectators.length > 0) {
      if (remoteNameEl) remoteNameEl.textContent = "👁️ 觀戰席";
      if (remotePctEl) remotePctEl.textContent = `${spectators.length} 人觀戰`;
      if (remoteScoreEl) remoteScoreEl.textContent = spectators.map((s) => s.name).join("、");
      if (remoteBarEl) remoteBarEl.style.width = "0%";
      if (lastEl) {
        lastEl.textContent = "純觀戰模式";
        lastEl.className = "text-[10px] text-amber-300 font-bold truncate";
      }
    } else {
      if (remoteNameEl) remoteNameEl.textContent = "⏳ 等待加入";
      if (remotePctEl) remotePctEl.textContent = "尚無對手";
      if (remoteScoreEl) remoteScoreEl.textContent = "等待連線";
      if (remoteBarEl) remoteBarEl.style.width = "0%";
      if (lastEl) {
        lastEl.textContent = "可邀請好友加入";
        lastEl.className = "text-[10px] text-slate-400 truncate";
      }
    }
  } else {
    const regionScore = state.opponent.score || 0;
    const regionTotal = state.opponent.total || 0;
    const stScore = state.opponent.stationScore || 0;
    const stTotal = state.opponent.stationTotal || 0;
    const grandCur = regionScore + stScore;
    const grandTot = regionTotal + stTotal;
    const grandPct = grandTot > 0 ? ((grandCur / grandTot) * 100).toFixed(1) : "0.0";

    if (remoteNameEl) remoteNameEl.textContent = state.opponent.name + (state.opponent.finished ? " (已結束)" : "");
    if (remoteScoreEl) remoteScoreEl.textContent = `${grandCur} / ${grandTot}`;
    if (remotePctEl) remotePctEl.textContent = `${grandPct}%`;
    if (remoteBarEl) remoteBarEl.style.width = `${Math.min(100, parseFloat(grandPct))}%`;

    const diff = leftCur - grandCur;
    if (lastEl) {
      if (state.opponent.finished) {
        const rText = state.opponent.finalStats?.reason === "victory" ? "👑 已100%通關" : "🏁 已結束";
        lastEl.textContent = `${rText} (${grandCur}/${grandTot})`;
        lastEl.className = "text-[10px] text-amber-300 font-bold truncate";
      } else if (diff > 0) {
        lastEl.textContent = `🔥 領先 ${diff} 題！`;
        lastEl.className = "text-[10px] text-emerald-400 font-bold truncate";
      } else if (diff < 0) {
        lastEl.textContent = `⚠️ 落後 ${Math.abs(diff)} 題！`;
        lastEl.className = "text-[10px] text-amber-400 font-bold truncate";
      } else {
        lastEl.textContent = `⚖️ 雙方平手！`;
        lastEl.className = "text-[10px] text-sky-400 font-bold truncate";
      }
    }
  }

  const multiList = document.getElementById("p2p-multiplayer-live-list");
  const rankTitle = document.getElementById("p2p-live-rank-title");
  const specCountEl = document.getElementById("p2p-live-spectator-count");
  const rowsContainer = document.getElementById("p2p-live-rank-rows");
  const dualCards = document.getElementById("p2p-dual-cards");

  if (dualCards) {
    dualCards.classList.toggle("hidden", isThreePlus);
  }

  if (multiList && rowsContainer) {
    if (isThreePlus) {
      multiList.classList.remove("hidden");
      const canClickToSpectate = state.role === "spectator" || state.finished;
      if (rankTitle) {
        rankTitle.textContent = canClickToSpectate
          ? `⚔️ 即時排行 (${sorted.length}人 · 點擊切換觀看)`
          : `⚔️ 即時排行 (${sorted.length} 人參賽)`;
      }
      if (specCountEl) {
        specCountEl.textContent = spectators.length > 0 ? `👁️ 觀戰 ${spectators.length} 人` : "";
      }

      rowsContainer.replaceChildren();
      const tplRow = document.getElementById("tpl-p2p-live-rank-row");
      sorted.forEach((p, idx) => {
        if (!tplRow || !tplRow.content) return;
        const row = tplRow.content.firstElementChild.cloneNode(true);
        const tot = (p.total || 0) + (p.stationTotal || 0);
        const cur = (p.score || 0) + (p.stationScore || 0);
        const pct = tot > 0 ? ((cur / tot) * 100).toFixed(1) : "0.0";
        const isMe = p.id === state.localInstanceId;
        const isWatched = canClickToSpectate && state.spectatingPlayerId === p.id;

        if (isWatched) {
          row.className = "p-2 rounded-xl bg-amber-500/15 border border-amber-400 space-y-1 cursor-pointer transition shadow-md";
        } else if (isMe) {
          row.className = "p-2 rounded-xl bg-slate-900/90 border border-sky-500/50 space-y-1 cursor-pointer transition";
        }

        const numEl = row.querySelector(".rank-num");
        const nameEl = row.querySelector(".rank-name");
        const statusEl = row.querySelector(".rank-status");
        const watchBadge = row.querySelector(".rank-watching");
        const scoreEl = row.querySelector(".rank-score");
        const barEl = row.querySelector(".rank-bar");

        if (numEl) numEl.textContent = `#${idx + 1}`;
        if (nameEl) nameEl.textContent = `${p.role === "host" ? "👑 " : ""}${p.name}${isMe ? " (我)" : ""}`;
        if (statusEl) {
          if (p.finished) {
            statusEl.className = "rank-status px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold shrink-0";
            statusEl.textContent = p.finishReason === "victory" ? "👑 通關" : "🏁 已結束";
          } else {
            statusEl.className = "rank-status text-[9px] text-slate-400 shrink-0";
            statusEl.textContent = "作答中";
          }
        }
        if (watchBadge) watchBadge.classList.toggle("hidden", !isWatched);
        if (scoreEl) scoreEl.textContent = `${cur}/${tot} (${pct}%)`;
        if (barEl) {
          barEl.className = `rank-bar h-full ${p.finished ? "bg-amber-400" : isWatched ? "bg-emerald-400" : "bg-sky-400"} transition-all duration-300`;
          barEl.style.width = `${Math.min(100, parseFloat(pct))}%`;
        }

        row.addEventListener("click", () => {
          if (state.role === "spectator" || state.finished) {
            setSpectatingTarget(p.id);
          } else {
            setFeedback(`⚔️ 比賽進行中僅觀戰者或已完賽選手可切換觀看他人地圖！`, "info");
          }
        });
        rowsContainer.appendChild(row);
      });
    } else {
      multiList.classList.add("hidden");
    }
  }

  updateSpectatorPlayerSelectUI();

  const compWrap = document.getElementById("p2p-macro-bars-container");
  const barsEl = document.getElementById("p2p-macro-bars");
  if (compWrap && barsEl) {
    const features = _p2pFeatures();
    const unitLabels = _p2pUnitLabels();
    const isTw = _p2pIsTwModern();
    const stationMacroKeys = new Set(["台鐵", "高鐵", "捷運", "輕軌", "纜車", "林鐵", "糖鐵"]);
    const poiMacroKeys = new Set(["機場", "港口", "水庫", "湖泊", "傳統聚落"]);
    const capMacroKeys = new Set(["首都", "省會", "縣廳", "首都／省會", "省會／縣廳", "縣廳／省會"]);
    const mp = state.opponent.macroProgress || {};
    const macroKeys = Object.keys(mp).filter((k) => {
      if (stationMacroKeys.has(k) && !features.supportsTransportQuiz) return false;
      if (poiMacroKeys.has(k) && !features.supportsPoiQuiz) return false;
      if (capMacroKeys.has(k) && !features.supportsCapitalQuiz) return false;
      return true;
    });
    if (!isThreePlus && hasBattleOpponent && macroKeys.length > 0) {
      compWrap.classList.remove("hidden");
      const macroLabels = {
        "地區": isTw ? "🗺️ 行政區" : `🗺️ ${unitLabels.item}`,
        "台鐵": "🚆 台鐵",
        "高鐵": "🚄 高鐵",
        "捷運": "🚇 捷運",
        "輕軌": "🚊 輕軌",
        "纜車": "🚡 纜車",
        "林鐵": "🌲 林鐵",
        "糖鐵": "🍬 糖鐵"
      };
      barsEl.replaceChildren();
      const tplMacro = document.getElementById("tpl-p2p-macro-bar");
      macroKeys.forEach((k) => {
        if (!tplMacro || !tplMacro.content) return;
        const oppData = mp[k] || { cur: 0, tot: 1 };
        const oppPct = oppData.tot > 0 ? Math.round((oppData.cur / oppData.tot) * 100) : 0;
        let myPct = 0;
        if (k === "地區") {
          myPct = leftTot > 0 ? Math.round((leftCur / Math.max(1, counts.regionTotal)) * 100) : 0;
        } else if (poiMacroKeys.has(k)) {
          const myPoi = counts.macroProgress && counts.macroProgress[k];
          myPct = myPoi && myPoi.tot > 0 ? Math.round((myPoi.cur / myPoi.tot) * 100) : 0;
        } else {
          const activeSt = features.supportsTransportQuiz && typeof getActiveQuizStations === "function" ? getActiveQuizStations() : [];
          const myStations = activeSt.filter((s) => s.macro === k);
          const myUnlocked = myStations.filter((s) => vState.unlockedStations.has(s.key)).length;
          myPct = myStations.length > 0 ? Math.round((myUnlocked / myStations.length) * 100) : 0;
        }
        const row = tplMacro.content.firstElementChild.cloneNode(true);
        const lbl = row.querySelector(".macro-label");
        const st = row.querySelector(".macro-stat");
        const myBar = row.querySelector(".macro-my-bar");
        const oppBar = row.querySelector(".macro-opp-bar");
        if (lbl) lbl.textContent = macroLabels[k] || k;
        if (st) st.textContent = `${vState.spectatingPlayer ? watchedPlayer.name : "我"} ${myPct}% vs ${state.opponent.name} ${oppPct}%`;
        if (myBar) myBar.style.width = `${Math.min(100, myPct)}%`;
        if (oppBar) oppBar.style.width = `${Math.min(100, oppPct)}%`;
        barsEl.appendChild(row);
      });
    } else {
      compWrap.classList.add("hidden");
    }
  }
}

function playCountdownBeep(freq = 440, duration = 0.14, type = "sine") {
  if (!state.soundEnabled) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (_) {}
}

function startSynchronizedP2PCountdown(cfg, isHost) {
  state.matchInProgress = true;
  state.promptedLastPlayer = false;
  state.spectatorLayerInitialized = false;

  getParticipantList().forEach((p) => {
    p.finished = false;
    p.finishReason = null;
    p.finalStats = null;
    p.score = 0;
    p.stationScore = 0;
    p.unlockedTowns = [];
    p.unlockedCounties = [];
    p.unlockedProvinces = [];
    p.missedTowns = [];
    p.unlockedStations = [];
    p.missedStations = [];
    p._viewSets = null;
  });

  if (isHost) {
    sendP2PMessage("SYNC_START", cfg);
    broadcastRosterFromHost();
  }

  document.getElementById("modal-scope")?.classList.add("hidden");
  document.getElementById("modal-room")?.classList.add("hidden");
  document.getElementById("modal-join-entry")?.classList.add("hidden");
  hideRoomConfigChangeToast();

  const beginCountdown = () => {
    applySpectatorInputLock();

    const isSpec = state.role === "spectator";
    const isSoloShowcase = getActiveBattlePlayers().length <= 1 && !state.aiRivalActive;
    const overlay = document.getElementById("p2p-countdown-overlay");
    const badgeEl = document.getElementById("p2p-cd-badge");
    const numEl = document.getElementById("p2p-cd-number");
    const statusEl = document.getElementById("p2p-cd-status");

    if (overlay) {
      if (badgeEl) {
        badgeEl.textContent = isSpec
          ? "👁️ SPECTATOR MODE · 觀戰模式"
          : isSoloShowcase
          ? "🎬 SOLO SHOWCASE · 單人展演（觀戰同步）"
          : "⚔️ MULTIPLAYER BATTLE · 即時連線對戰";
      }
      if (numEl) {
        numEl.textContent = "3";
        numEl.className = "text-9xl font-black text-white tracking-tighter";
        numEl.style.textShadow = "0 0 60px rgba(56, 189, 248, 0.85)";
        numEl.style.transform = "scale(1.0)";
      }
      if (statusEl) {
        statusEl.textContent = isSpec ? "觀戰視角準備中，對戰即將開始！" : "全員已就緒，準備開局！";
        statusEl.className = "text-sm font-semibold text-slate-300 tracking-wider";
      }
      overlay.classList.remove("hidden");
    }

    playCountdownBeep(440, 0.18);

    let count = 3;
    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        if (numEl) {
          numEl.textContent = String(count);
          numEl.style.transform = "scale(1.35)";
          setTimeout(() => { if (numEl) numEl.style.transform = "scale(1.0)"; }, 180);
        }
        playCountdownBeep(440, 0.18);
      } else if (count === 0) {
        if (numEl) {
          numEl.textContent = "GO!";
          numEl.className = "text-9xl font-black text-emerald-400 tracking-tight";
          numEl.style.textShadow = "0 0 70px rgba(52, 211, 153, 0.95)";
          numEl.style.transform = "scale(1.45)";
        }
        if (statusEl) {
          statusEl.textContent = isSpec ? "👁️ 對戰已開始，點擊排行可自由切換觀看任意選手地圖！" : "🔥 比賽開始！輸入第一個地名即刻進攻！";
          statusEl.className = "text-base font-bold text-emerald-300 tracking-wider";
        }
        playCountdownBeep(880, 0.25, "triangle");
        clearInterval(interval);
        setTimeout(() => {
          if (overlay) overlay.classList.add("hidden");
          startTimer();
          if (state.questionCountdownEnabled && typeof startQuestionCountdown === "function") {
            startQuestionCountdown();
          }
          setFeedback(
            isSpec
              ? "👁️ 觀戰開始！正在即時同步觀看選手作答"
              : isSoloShowcase
              ? "🎬 單人展演開始！觀戰者正在即時觀看你的地圖與進度！"
              : "⚔️ 對戰正式開始！全員同步計時，衝向 100% 吧！",
            "tier"
          );
          if (typeof startAiRivalLoop === "function") {
            startAiRivalLoop();
          }
          if (!isSpec) {
            const inp = document.getElementById("answer-input");
            if (inp) inp.focus({ preventScroll: true });
          }
          if (window.scrollY > 0) window.scrollTo(0, 0);
        }, 320);
      }
    }, 600);
  };

  if (cfg) {
    const syncRes = applyRemoteSyncConfig(cfg, true, true);
    if (syncRes && typeof syncRes.then === "function") {
      syncRes.then(beginCountdown, beginCountdown);
      return;
    }
  } else {
    resetGame();
  }
  beginCountdown();
}

function applyRemoteSyncConfig(cfg, fromCountdown = false, isAuthorized = false) {
  if (!cfg) return { ok: false, reason: "empty_config" };
  if (!isAuthorized && !canLocalModifyGameConfig() && state.isHost) {
    return { ok: false, reason: "unauthorized" };
  }

  const curPackId = state.activeMapPackId || "tw_modern";
  const targetPack =
    cfg.mapPackId && typeof getMapPackById === "function" ? getMapPackById(cfg.mapPackId) : null;
  const needsPackSwitch = Boolean(
    targetPack &&
      typeof switchActiveMapPack === "function" &&
      (cfg.mapPackId !== curPackId || (targetPack._isLazyStub && !targetPack._isFullPack))
  );

  if (needsPackSwitch) {
    if (cfg.packOptions && typeof cfg.packOptions === "object") {
      state.packOptions = {
        worldIncludeMicrostates: true,
        cnAllowSingleCharAlias: false,
        rocTerritoryVariant: "begonia_full",
        includeMunicipalities: true,
        showDisputedBorders: true,
        ...(state.packOptions || {}),
        ...cfg.packOptions
      };
    }
    return Promise.resolve(
      switchActiveMapPack(cfg.mapPackId, {
        skipReset: true,
        skipScopeReset: false,
        flyToFullView: true
      })
    ).then((res) => {
      if (!res || !res.ok) return res || { ok: false, reason: "switch_failed" };
      return _applyRemoteSyncConfigAfterPack(cfg, fromCountdown);
    });
  }

  return _applyRemoteSyncConfigAfterPack(cfg, fromCountdown);
}

function _applyRemoteSyncConfigAfterPack(cfg, fromCountdown = false) {
  const prevWorldMicro = state.packOptions ? state.packOptions.worldIncludeMicrostates !== false : true;
  if (cfg.packOptions && typeof cfg.packOptions === "object") {
    state.packOptions = {
      worldIncludeMicrostates: true,
      cnAllowSingleCharAlias: false,
      rocTerritoryVariant: "begonia_full",
      includeMunicipalities: true,
      showDisputedBorders: true,
      ...(state.packOptions || {}),
      ...cfg.packOptions
    };
    if (typeof rebuildActivePackLookupSets === "function") {
      rebuildActivePackLookupSets();
    }
    if (typeof renderDisputedBordersLayer === "function") {
      renderDisputedBordersLayer();
    }
  }
  const nextWorldMicro = state.packOptions ? state.packOptions.worldIncludeMicrostates !== false : true;
  const worldMicroTurnedOn = !prevWorldMicro && nextWorldMicro;

  const pack = _p2pPack();
  const allItems = _p2pItems();
  const eligibleItems =
    typeof getPackEligibleItems === "function" ? getPackEligibleItems(pack, state) : allItems;
  const allGroups = _p2pGroups();
  const validItemIdSet = new Set(eligibleItems.map((t) => t.id));
  const validGroupNameSet = new Set(allGroups.map((g) => g.name));
  const features = _p2pFeatures();
  const unitLabels = _p2pUnitLabels();
  const isTw = _p2pIsTwModern();

  const wasReadyBeforeConfig = Boolean(
    state.isReady || state._readyJustClearedByHost || state.players?.[state.localInstanceId]?.isReady
  );
  state._readyJustClearedByHost = false;

  if (cfg.quizTargetMode) {
    state.quizTargetMode = cfg.quizTargetMode;
  }
  if (typeof cfg.targetQuestionLimit !== "undefined") {
    state.targetQuestionLimit = Math.max(0, Math.min(999, parseInt(cfg.targetQuestionLimit, 10) || 0));
  }
  if (typeof cfg.allowPass === "boolean") {
    state.allowPass = cfg.allowPass;
  }
  if (typeof cfg.hideGuessedOthers === "boolean") {
    state.hideGuessedOthers = cfg.hideGuessedOthers;
  }
  if (typeof cfg.questionCountdownEnabled === "boolean") {
    state.questionCountdownEnabled = cfg.questionCountdownEnabled;
  }
  if (cfg.questionCountdownMode === "normal" || cfg.questionCountdownMode === "rush") {
    state.questionCountdownMode = cfg.questionCountdownMode;
  }
  if (typeof cfg.questionCountdownSec !== "undefined") {
    state.questionCountdownSec = Math.max(3, Math.min(120, parseInt(cfg.questionCountdownSec, 10) || 15));
  }
  if (typeof cfg.rushGraceSec !== "undefined") {
    state.rushGraceSec = Math.max(2, Math.min(30, parseInt(cfg.rushGraceSec, 10) || 5));
  }
  const hasSharedQueue = Array.isArray(cfg.sharedTargetQueue) && cfg.sharedTargetQueue.length > 0;
  if (hasSharedQueue) {
    state.targetQueue = cfg.sharedTargetQueue.slice();
    state.targetQueueIndex = 0;
    if (state.passedTargetKeys) state.passedTargetKeys.clear();
  }
  if (typeof cfg.showStationTerminusHints !== "undefined") {
    state.showStationTerminusHints = Boolean(cfg.showStationTerminusHints);
    const c1 = document.getElementById("chk-station-terminus-hints");
    const c2 = document.getElementById("chk-transport-terminus-hints");
    if (c1) c1.checked = state.showStationTerminusHints;
    if (c2) c2.checked = state.showStationTerminusHints;
  }
  if (typeof cfg.filterStationsByRegion !== "undefined") {
    state.filterStationsByRegion = Boolean(cfg.filterStationsByRegion);
    ["chk-mixed-filter-station-region", "chk-simple-filter-station-region", "chk-adv-filter-station-region"].forEach((cid) => {
      const el = document.getElementById(cid);
      if (el) el.checked = state.filterStationsByRegion;
    });
  }
  if (typeof cfg.allowTargetHints !== "undefined") {
    state.allowTargetHints = Boolean(cfg.allowTargetHints);
    ["chk-allow-target-hints", "chk-room-allow-target-hints"].forEach((cid) => {
      const el = document.getElementById(cid);
      if (el) el.checked = state.allowTargetHints;
    });
    if (typeof updateTargetBannerUI === "function") updateTargetBannerUI();
  }
  if (Array.isArray(cfg.selectedCounties)) {
    const filteredGroups = cfg.selectedCounties.filter((n) => validGroupNameSet.has(n));
    if (filteredGroups.length > 0 || cfg.selectedCounties.length === 0) {
      state.selectedCounties = new Set(filteredGroups);
    } else {
      state.selectedCounties = new Set(validGroupNameSet);
    }
  }
  if (Array.isArray(cfg.selectedTownIds)) {
    const filteredItems = cfg.selectedTownIds.filter((id) => validItemIdSet.has(id));
    if (filteredItems.length > 0 || cfg.selectedTownIds.length === 0) {
      state.selectedTownIds = new Set(filteredItems);
    } else {
      state.selectedTownIds = new Set(validItemIdSet);
    }
  } else if (Array.isArray(cfg.selectedCounties)) {
    state.selectedTownIds = new Set(eligibleItems.filter((t) => state.selectedCounties.has(t.countyName)).map((t) => t.id));
  }
  if (typeof syncScopeWithPackOptions === "function") {
    syncScopeWithPackOptions(worldMicroTurnedOn);
  }
  if (Array.isArray(cfg.quizStationLines)) {
    state.quizStationLines = new Set(cfg.quizStationLines);
  }
  if (typeof cfg.regionQuizEnabled === "boolean") {
    state.regionQuizEnabled = cfg.regionQuizEnabled;
  } else if (cfg.quizTargetMode) {
    state.regionQuizEnabled = cfg.quizTargetMode !== "station";
  }
  if (typeof cfg.airportQuizEnabled === "boolean") {
    state.airportQuizEnabled = features.supportsPoiQuiz && cfg.airportQuizEnabled;
  } else if (!features.supportsPoiQuiz) {
    state.airportQuizEnabled = false;
  }
  if (typeof cfg.portQuizEnabled === "boolean") {
    state.portQuizEnabled = features.supportsPoiQuiz && cfg.portQuizEnabled;
  } else if (!features.supportsPoiQuiz) {
    state.portQuizEnabled = false;
  }
  if (typeof cfg.reservoirQuizEnabled === "boolean") {
    state.reservoirQuizEnabled = features.supportsPoiQuiz && cfg.reservoirQuizEnabled;
  } else if (!features.supportsPoiQuiz) {
    state.reservoirQuizEnabled = false;
  }
  if (typeof cfg.lakeQuizEnabled === "boolean") {
    state.lakeQuizEnabled = features.supportsPoiQuiz && cfg.lakeQuizEnabled;
  } else if (!features.supportsPoiQuiz) {
    state.lakeQuizEnabled = false;
  }
  if (typeof cfg.settlementQuizEnabled === "boolean") {
    state.settlementQuizEnabled = features.supportsPoiQuiz && cfg.settlementQuizEnabled;
  } else if (!features.supportsPoiQuiz) {
    state.settlementQuizEnabled = false;
  }
  if (typeof cfg.capitalQuizEnabled === "boolean") {
    state.capitalQuizEnabled = features.supportsCapitalQuiz && cfg.capitalQuizEnabled;
  } else if (!features.supportsCapitalQuiz) {
    state.capitalQuizEnabled = false;
  }
  if (typeof cfg.landmarkQuizEnabled === "boolean") {
    state.landmarkQuizEnabled = features.supportsLandmarkQuiz && cfg.landmarkQuizEnabled;
  } else if (!features.supportsLandmarkQuiz) {
    state.landmarkQuizEnabled = false;
  }
  if (Array.isArray(cfg.airportSubTypes)) {
    state.airportSubTypes = new Set(cfg.airportSubTypes);
  }
  if (Array.isArray(cfg.portSubTypes)) {
    state.portSubTypes = new Set(cfg.portSubTypes);
  }
  if (Array.isArray(cfg.reservoirSubTypes)) {
    state.reservoirSubTypes = new Set(cfg.reservoirSubTypes);
  }
  if (Array.isArray(cfg.lakeSubTypes)) {
    state.lakeSubTypes = new Set(cfg.lakeSubTypes);
  }
  if (Array.isArray(cfg.settlementSubTypes)) {
    state.settlementSubTypes = new Set(cfg.settlementSubTypes);
  }

  if (!features.supportsTransportQuiz) {
    state.stationQuizEnabled = false;
    state.quizStationLines.clear();
  } else if (typeof cfg.stationQuizEnabled === "boolean") {
    state.stationQuizEnabled = cfg.stationQuizEnabled && state.quizStationLines.size > 0;
  } else {
    state.stationQuizEnabled = state.quizTargetMode !== "region" && state.quizStationLines.size > 0;
  }
  if (!state.stationQuizEnabled) {
    state.quizStationLines.clear();
  }
  const hasAnyActiveTopic =
    Boolean(state.regionQuizEnabled) ||
    Boolean(features.supportsTransportQuiz && state.stationQuizEnabled && state.quizStationLines.size > 0) ||
    Boolean(
      features.supportsPoiQuiz &&
        (state.airportQuizEnabled ||
          state.portQuizEnabled ||
          state.reservoirQuizEnabled ||
          state.lakeQuizEnabled ||
          state.settlementQuizEnabled)
    ) ||
    Boolean(features.supportsCapitalQuiz && state.capitalQuizEnabled) ||
    Boolean(features.supportsLandmarkQuiz && state.landmarkQuizEnabled);
  if (!hasAnyActiveTopic) {
    state.regionQuizEnabled = true;
    if (state.selectedTownIds.size === 0 && validItemIdSet.size > 0) {
      state.selectedCounties = new Set(validGroupNameSet);
      state.selectedTownIds = new Set(validItemIdSet);
    }
  }
  if (typeof syncLegacyQuizTargetMode === "function") {
    syncLegacyQuizTargetMode();
  }

  if (state.stationQuizEnabled && state.quizStationLines.size > 0) {
    state.selectedTransportLines = new Set(state.quizStationLines);
    if (
      (state.transportMode === "off" || state.transportMode === "lines_and_stations") &&
      state.p2pRailRule !== "ban_rail" &&
      state.p2pRailRule !== "force_lines"
    ) {
      state.transportMode = "rail_only";
    }
  } else if (!state.stationQuizEnabled && state.p2pRailRule === "free") {
    state.transportMode = "off";
  }

  const supportedDiffs =
    Array.isArray(features.supportedDifficulties) && features.supportedDifficulties.length > 0
      ? features.supportedDifficulties
      : ["casual", "county_only", "hard_suffix", "hard_full", "master_hierarchy"];
  if (cfg.difficulty && supportedDiffs.includes(cfg.difficulty)) {
    state.difficulty = cfg.difficulty;
  } else if (!supportedDiffs.includes(state.difficulty)) {
    state.difficulty = supportedDiffs[0];
  }
  const prevPlayMode = state.playMode;
  if (cfg.playMode) {
    state.playMode = cfg.playMode;
  }
  if (cfg.satelliteStyle && ["day", "night", "hybrid"].includes(cfg.satelliteStyle)) {
    state.satelliteStyle = cfg.satelliteStyle;
  }
  if (typeof cfg.satelliteLockViewport === "boolean") {
    state.satelliteLockViewport = cfg.satelliteLockViewport;
  }
  if (prevPlayMode === "satellite_quiz" && state.playMode !== "satellite_quiz") {
    _p2pUnlockViewport({ restoreLayers: true });
  }
  if (cfg.timerMode) state.timerMode = cfg.timerMode;
  if (cfg.countdownTotalSec) state.countdownTotalSec = cfg.countdownTotalSec;

  const timerBtn = document.getElementById("btn-timer-mode");
  if (timerBtn) {
    timerBtn.textContent = state.timerMode === "up" ? "正計時" : `倒數 ${Math.round(state.countdownTotalSec / 60)}m`;
  }

  updateModeBadgeText();

  const totalTowns = getScopeTowns().length;
  const activeSt = features.supportsTransportQuiz && typeof getActiveQuizStations === "function" ? getActiveQuizStations() : [];
  let summaryLabel = "";
  if (state.selectedCounties.size === 0 && activeSt.length > 0) {
    summaryLabel = `純車站 (${activeSt.length}站)`;
  } else {
    const fullLabel = isTw
      ? `全台 ${allItems.length} 區`
      : pack && pack.id === "world_countries" && !nextWorldMicro
      ? `標準版 (${eligibleItems.length}${unitLabels.itemShort})`
      : (unitLabels.fullScopeLabel || `${(pack && pack.shortLabel) || "全境"} (${eligibleItems.length}${unitLabels.itemShort})`);
    const adminStr =
      totalTowns === eligibleItems.length && eligibleItems.length > 0
        ? fullLabel
        : !_p2pIsSingleLayer() && state.selectedCounties.size === 1
        ? `${Array.from(state.selectedCounties)[0]} (${totalTowns}${unitLabels.itemShort})`
        : `${totalTowns} ${unitLabels.itemShort}`;
    summaryLabel = activeSt.length > 0 ? `${adminStr} + ${activeSt.length}站` : adminStr;
  }
  const summaryEl = document.getElementById("scope-summary-label");
  if (summaryEl) summaryEl.textContent = summaryLabel;

  if (cfg.layerRule || cfg.railRule || cfg.forcedLayer || cfg.borderRule) {
    state.spectatorLayerInitialized = false;
    applyP2PLayerRule(
      cfg.layerRule || state.p2pLayerRule,
      cfg.forcedLayer || state.p2pForcedLayer,
      cfg.railRule || state.p2pRailRule,
      cfg.borderRule || state.p2pBorderRule
    );
  }

  resetGame({ preserveTargetQueue: hasSharedQueue });
  if (typeof refreshPoiMapLayer === "function") refreshPoiMapLayer();
  renderScopeModalGrid();

  if (!fromCountdown && !state.isHost && cfg.isSettingChange) {
    const changeLabel = cfg.changeLabel || "房間設定";
    const detailText =
      cfg.changeDetail && cfg.changeDetail !== "更新房間題庫與比賽設定"
        ? cfg.changeDetail
        : summaryLabel;
    if (state.role !== "spectator") {
      state.isReady = false;
      if (state.players && state.players[state.localInstanceId]) {
        state.players[state.localInstanceId].isReady = false;
      }
      sendP2PMessage("SYNC_READY_STATUS", {
        ready: false,
        name: state.nickname,
        reason: "config_reset"
      });
      const toastMsg = wasReadyBeforeConfig
        ? `🔔 房主已變更「${changeLabel}」(${detailText})，準備已取消，請重新準備`
        : `🔔 房主已變更「${changeLabel}」(${detailText})`;
      setFeedback(toastMsg, "warn");
      showRoomConfigChangeToast(toastMsg, "warn", true);
    } else {
      const toastMsg = `🔔 房主已變更「${changeLabel}」(${detailText})`;
      setFeedback(toastMsg, "info");
      showRoomConfigChangeToast(toastMsg, "info", false);
    }
  }

  updateP2PLobbyUI();
  return { ok: true };
}

function broadcastP2PConfig(isSettingChange = false, changeLabel = "", changeDetail = "") {
  if (!state.isHost || !state.roomCode) return;
  const payload = getHostSyncConfig(isSettingChange, changeLabel, changeDetail);
  state._lastBroadcastConfigJson = JSON.stringify(getHostSyncConfig(false));
  sendP2PMessage("SYNC_CONFIG", payload);
}

function onHostSettingChange(name = "", detail = "") {
  if (!state.isHost || !state.roomCode) return;
  const humanPlayers = getNonHostBattlePlayers().filter((p) => p.id !== "ai_rival");
  const hadReadyPlayers = humanPlayers.some((p) => p.isReady);
  humanPlayers.forEach((p) => {
    p.isReady = false;
  });
  if (!state.aiRivalActive) {
    state.opponent.isReady = false;
  }
  syncPrimaryOpponentFromRoster();
  broadcastP2PConfig(true, name || "比賽設定", detail || "");
  broadcastRosterFromHost();
  updateP2PLobbyUI();

  const labelText = name ? `「${name}」` : "房間設定";
  const detailPart = detail && detail !== "更新房間題庫與比賽設定" ? ` (${detail})` : "";
  const readyNote = hadReadyPlayers ? " · 已重設玩家準備狀態" : "";
  const msg = `🔔 已變更${labelText}${detailPart}${readyNote}`;
  setFeedback(msg, "info");
  showRoomConfigChangeToast(msg, hadReadyPlayers ? "warn" : "info", false);
}

function toggleAiRivalSimulation() {
  const btn = document.getElementById("btn-quick-sim-rival");
  if (state.aiRivalTimer || state.aiRivalActive) {
    if (state.aiRivalTimer) clearInterval(state.aiRivalTimer);
    state.aiRivalTimer = null;
    state.aiRivalActive = false;
    if (!state.roomCode) {
      state.isHost = false;
      state.role = "solo";
      state.opponent.connected = false;
      state.opponent.isReady = false;
    }
    delete state.players["ai_rival"];
    if (btn) btn.textContent = "🤖 開啟 AI 對手陪練";
    updateP2PPanelVisibility();
    updateP2PLobbyUI();
    setFeedback("已關閉 AI 虛擬對手陪練", "info");
    return;
  }

  const scopeTowns = getScopeTowns();
  const features = _p2pFeatures();
  state.isHost = true;
  state.role = "host";
  state.aiRivalActive = true;
  state.opponent.name = "🤖 AI 對手";
  state.opponent.connected = true;
  state.opponent.isReady = true;
  state.opponent.finished = false;
  state.opponent.score = 0;
  state.opponent.total = state.difficulty === "county_only" ? getScopeCounties().length : scopeTowns.length;
  state.opponent.stationScore = 0;
  state.opponent.stationTotal = features.supportsTransportQuiz && typeof getActiveQuizStations === "function" ? getActiveQuizStations().length : 0;
  state.opponent.macroProgress = { "地區": { cur: 0, tot: state.opponent.total } };
  state.players["ai_rival"] = {
    id: "ai_rival",
    name: "🤖 AI 對手",
    role: "player",
    isReady: true,
    disconnected: false,
    finished: false,
    score: 0,
    total: state.opponent.total,
    stationScore: 0,
    stationTotal: state.opponent.stationTotal,
    unlockedTowns: [],
    unlockedCounties: [],
    unlockedStations: []
  };
  if (btn) btn.textContent = "⏹️ 停止 AI 對手陪練";

  updateP2PPanelVisibility();
  updateP2PLobbyUI();
  updateOpponentUI();
  setFeedback("🤖 AI 虛擬對手已就緒！點擊下方「立即開始對戰」即可開局！", "tier");
}

function startAiRivalLoop() {
  if (!state.aiRivalActive) return;
  if (state.aiRivalTimer) clearInterval(state.aiRivalTimer);
  state.aiRivalTimer = setInterval(() => {
    if (state.isGameOver) {
      clearInterval(state.aiRivalTimer);
      state.aiRivalTimer = null;
      return;
    }
    if (state.opponent.score >= state.opponent.total && state.opponent.stationScore >= state.opponent.stationTotal) {
      clearInterval(state.aiRivalTimer);
      state.aiRivalTimer = null;
      const finalStats = {
        senderId: "ai_rival",
        name: "🤖 AI 對手",
        grandScore: state.opponent.score + state.opponent.stationScore,
        grandTotal: state.opponent.total + state.opponent.stationTotal,
        elapsedSec: state.elapsedSec,
        accuracy: 94,
        wrongAttempts: 4,
        reason: "victory"
      };
      handleOpponentFinished(finalStats, "ai_rival");
      return;
    }
    if (state.opponent.score < state.opponent.total) {
      state.opponent.score++;
      state.opponent.macroProgress = state.opponent.macroProgress || {};
      state.opponent.macroProgress["地區"] = { cur: state.opponent.score, tot: state.opponent.total };
    }

    const activeSt = _p2pFeatures().supportsTransportQuiz && typeof getActiveQuizStations === "function" ? getActiveQuizStations() : [];
    if (activeSt.length > 0 && state.opponent.stationScore < state.opponent.stationTotal && Math.random() > 0.4) {
      state.opponent.stationScore = (state.opponent.stationScore || 0) + 1;
      const randomSt = activeSt[Math.floor(Math.random() * activeSt.length)];
      if (randomSt && randomSt.macro) {
        const totMacro = activeSt.filter((s) => s.macro === randomSt.macro).length;
        const m = state.opponent.macroProgress[randomSt.macro] || { cur: 0, tot: totMacro };
        m.cur = Math.min(m.tot, m.cur + 1);
        state.opponent.macroProgress[randomSt.macro] = m;
      }
    }
    if (state.players["ai_rival"]) {
      state.players["ai_rival"].score = state.opponent.score;
      state.players["ai_rival"].stationScore = state.opponent.stationScore;
    }
    updateOpponentUI();
  }, 3200);
}
