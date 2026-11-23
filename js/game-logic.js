// =========================================================================
// 6. GAME LOGIC: SPOILER-FREE PREFIXES, SMART SUFFIX OVERRIDE & WINDOWS IME FIX
// =========================================================================
function getScopeTowns() {
  if (!state.regionQuizEnabled) return [];
  if (state.selectedTownIds instanceof Set) {
    return ALL_TOWNS.filter((t) => state.selectedTownIds.has(t.id));
  }
  return ALL_TOWNS.filter((t) => state.selectedCounties.has(t.countyName));
}

function getScopeCounties() {
  if (!state.regionQuizEnabled) return [];
  return TAIWAN_ADMIN_DATA.filter((c) => state.selectedCounties.has(c.name));
}

function isCountyRevealed(countyName) {
  const vState = typeof getActiveViewState === "function" ? getActiveViewState() : state;
  if (vState.isGameOver || state.difficulty === "casual" || state.difficulty === "hard_suffix") return true;
  if (vState.unlockedCounties.has(countyName)) return true;
  if (state.difficulty === "hard_full") {
    return ALL_TOWNS.some((t) => t.countyName === countyName && vState.unlockedTowns.has(t.id));
  }
  return false;
}

function isPrefixRequiredMode() {
  return Boolean(
    state.regionQuizEnabled &&
    (state.difficulty === "hard_full" || state.difficulty === "master_hierarchy")
  );
}

function updatePrefixDropdownUI() {
  const select = document.getElementById("prefix-select");
  const prefixContainer = document.getElementById("prefix-container");
  const pillsWrap = document.getElementById("unlocked-prefix-pills");
  const guideBar = document.getElementById("hierarchy-guide-bar");
  if (!select) return;

  const hidePrefix = !isPrefixRequiredMode();
  if (prefixContainer) prefixContainer.classList.toggle("hidden", hidePrefix);
  if (hidePrefix) {
    select.replaceChildren();
    const defaultOpt = document.createElement("option");
    defaultOpt.value = "";
    defaultOpt.textContent = "無固定前綴 (自由打)";
    select.appendChild(defaultOpt);
    select.value = "";
    if (guideBar) guideBar.classList.add("hidden");
    updateLiveCombinedPreview();
    return;
  }

  const currentVal = select.value;
  select.replaceChildren();
  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = "無固定前綴 (自由打)";
  select.appendChild(defaultOpt);

  const prefixOptions = [];

  if (state.difficulty === "master_hierarchy") {
    guideBar.classList.remove("hidden");
    const twUnlocked = state.unlockedProvinces.has("臺灣省");
    const fjUnlocked = state.unlockedProvinces.has("福建省");
    const twBadge = document.getElementById("prov-tw-badge");
    const fjBadge = document.getElementById("prov-fj-badge");
    if (twBadge) {
      twBadge.textContent = twUnlocked ? "臺灣省: ✓已解鎖" : "臺灣省: 未解鎖";
      twBadge.className = twUnlocked
        ? "px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold"
        : "px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700";
    }
    if (fjBadge) {
      fjBadge.textContent = fjUnlocked ? "福建省: ✓已解鎖" : "福建省: 未解鎖";
      fjBadge.className = fjUnlocked
        ? "px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold"
        : "px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700";
    }

    if (twUnlocked) prefixOptions.push({ val: "臺灣省", label: "省前綴：臺灣省" });
    if (fjUnlocked) prefixOptions.push({ val: "福建省", label: "省前綴：福建省" });

    TAIWAN_ADMIN_DATA.forEach((c) => {
      if (!state.selectedCounties.has(c.name)) return;
      if (state.unlockedCounties.has(c.name)) {
        const fullPrefix = c.isSpecial ? c.name : `${c.province}${c.name}`;
        prefixOptions.push({ val: fullPrefix, label: `${fullPrefix}` });
      }
    });

    if (pillsWrap) {
      const labelEl = document.getElementById("prefix-pills-label");
      const emptyEl = document.getElementById("prefix-pills-empty");
      const listEl = document.getElementById("prefix-pills-list");
      if (labelEl) labelEl.textContent = prefixOptions.length === 0 ? "已解鎖前綴：" : "點選套用前綴：";
      if (emptyEl) emptyEl.classList.toggle("hidden", prefixOptions.length > 0);
      if (listEl) {
        listEl.replaceChildren();
        prefixOptions.forEach((opt) => {
          const btn = document.createElement("button");
          btn.type = "button";
          const isSelected = currentVal === opt.val;
          btn.className = isSelected
            ? "px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-500 text-white shrink-0 transition"
            : "px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 shrink-0 transition";
          btn.textContent = opt.val;
          btn.addEventListener("click", () => {
            select.value = select.value === opt.val ? "" : opt.val;
            updatePrefixDropdownUI();
            updateLiveCombinedPreview();
            document.getElementById("answer-input").focus({ preventScroll: true });
          });
          listEl.appendChild(btn);
        });
      }
    }
  } else if (state.difficulty === "hard_full") {
    guideBar.classList.add("hidden");
    TAIWAN_ADMIN_DATA.forEach((c) => {
      if (!state.selectedCounties.has(c.name)) return;
      if (isCountyRevealed(c.name)) {
        prefixOptions.push({ val: c.name, label: c.name });
      }
    });
  } else if (state.difficulty === "county_only") {
    guideBar.classList.add("hidden");
    prefixOptions.push({ val: "臺灣省", label: "臺灣省" });
    prefixOptions.push({ val: "福建省", label: "福建省" });
  } else {
    guideBar.classList.add("hidden");
    TAIWAN_ADMIN_DATA.forEach((c) => {
      if (!state.selectedCounties.has(c.name)) return;
      prefixOptions.push({ val: c.name, label: c.name });
    });
  }

  prefixOptions.forEach((opt) => {
    const o = document.createElement("option");
    o.value = opt.val;
    o.textContent = opt.label;
    select.appendChild(o);
  });

  if (prefixOptions.some((o) => o.val === currentVal)) {
    select.value = currentVal;
  }
  if (typeof updateSuffixControlsUI === "function") updateSuffixControlsUI();
}

const VALID_TOWN_SUFFIXES = new Set(["區", "鄉", "鎮", "市"]);
const EXACT_TOWN_NAMES_SET = new Set(ALL_TOWNS.map((t) => normTw(t.townName)));
const EXACT_COUNTY_NAMES_SET = new Set(TAIWAN_ADMIN_DATA.map((c) => normTw(c.name)));
const EXACT_STATION_BASES_SET = (() => {
  const set = new Set();
  if (typeof TAIWAN_SELECTABLE_LINES !== "undefined" && typeof cleanStationBaseName === "function") {
    TAIWAN_SELECTABLE_LINES.forEach((line) => {
      if (line.isHighway || !Array.isArray(line.stations)) return;
      line.stations.forEach((st) => {
        const base = cleanStationBaseName(st[0]);
        if (!base) return;
        set.add(base);
        if (base.includes("/")) {
          set.add(base.replace(/\//g, ""));
          base.split("/").forEach((part) => { if (part) set.add(part); });
        }
      });
    });
  }
  if (typeof STATION_NAME_ALIASES !== "undefined") {
    Object.keys(STATION_NAME_ALIASES).forEach((k) => set.add(normTw(k)));
  }
  return set;
})();

const EXACT_POI_SUFFIXED_KEYS_SET = (() => {
  const set = new Set();
  if (typeof TAIWAN_POI_DATA !== "undefined" && typeof buildPoiMatchKeys === "function") {
    TAIWAN_POI_DATA.forEach((poi) => {
      buildPoiMatchKeys(poi, false, true).forEach((k) => set.add(k));
    });
  }
  return set;
})();

function isSuffixRequiredDifficulty(diff = state.difficulty) {
  return diff === "hard_suffix" || diff === "hard_full" || diff === "master_hierarchy";
}

function requiresCountyUnlockForPoiOrStation() {
  return Boolean(
    state.playMode === "free" &&
    state.regionQuizEnabled &&
    (state.difficulty === "hard_full" || state.difficulty === "master_hierarchy")
  );
}

function isPoiOrStationCountyUnlocked(countyName, countyNames = null) {
  if (!requiresCountyUnlockForPoiOrStation()) return true;
  if (Array.isArray(countyNames) && countyNames.length > 0) {
    return countyNames.some((cn) => state.unlockedCounties.has(cn));
  }
  if (!countyName) return true;
  return state.unlockedCounties.has(countyName);
}

function shouldHidePoiAdminLocationHint() {
  return Boolean(
    state.regionQuizEnabled &&
    isSuffixRequiredDifficulty() &&
    !state.isGameOver &&
    state.role !== "spectator"
  );
}

function getActiveQuickSuffixes() {
  if (!isSuffixRequiredDifficulty()) return [];
  const list = [""];
  if (state.regionQuizEnabled) list.push("區", "鄉", "鎮", "市");
  if (state.stationQuizEnabled && state.quizStationLines && state.quizStationLines.size > 0) list.push("站");
  if (typeof isPoiCategoryActive === "function") {
    if (isPoiCategoryActive("airport")) list.push("機場");
    if (isPoiCategoryActive("port")) list.push("港");
    if (isPoiCategoryActive("reservoir")) list.push("水庫");
    if (isPoiCategoryActive("lake")) list.push("湖");
  }
  return list;
}

function updateSuffixControlsUI() {
  const container = document.getElementById("suffix-container");
  const suffixInput = document.getElementById("suffix-input");
  if (!container) return;

  const activeList = getActiveQuickSuffixes();
  const shouldShow = activeList.length > 1;
  container.classList.toggle("hidden", !shouldShow);

  if (!shouldShow) {
    if (suffixInput && suffixInput.value) suffixInput.value = "";
    document.querySelectorAll(".suffix-quick-btn").forEach((b) => {
      const isNone = b.getAttribute("data-suffix") === "";
      b.className = isNone
        ? "suffix-quick-btn px-1.5 py-1 rounded-lg text-[11px] font-bold bg-sky-500 text-white"
        : "suffix-quick-btn hidden px-1.5 py-1 rounded-lg text-[11px] font-bold text-slate-300 hover:text-white";
    });
    if (typeof updateLiveCombinedPreview === "function") updateLiveCombinedPreview();
    return;
  }

  const activeSet = new Set(activeList);
  if (suffixInput && suffixInput.value && !activeSet.has(suffixInput.value)) {
    suffixInput.value = "";
  }
  const curVal = suffixInput ? suffixInput.value : "";

  document.querySelectorAll(".suffix-quick-btn").forEach((b) => {
    const val = b.getAttribute("data-suffix");
    const visible = activeSet.has(val);
    b.classList.toggle("hidden", !visible);
    if (!visible) return;
    const isSel = val === curVal;
    const topic = b.getAttribute("data-suffix-topic") || "";
    const inactiveColor =
      topic === "station" ? "text-amber-300" :
      topic === "airport" ? "text-sky-300" :
      topic === "port" ? "text-teal-300" :
      topic === "reservoir" ? "text-blue-300" :
      topic === "lake" ? "text-emerald-300" :
      "text-slate-300";
    b.className = isSel
      ? "suffix-quick-btn px-1.5 py-1 rounded-lg text-[11px] font-bold bg-sky-500 text-white"
      : `suffix-quick-btn px-1.5 py-1 rounded-lg text-[11px] font-bold ${inactiveColor} hover:text-white`;
  });
  if (typeof updateLiveCombinedPreview === "function") updateLiveCombinedPreview();
}

function buildCombinedInput(prefix, core, suffix) {
  let c = normTw(core);
  if (!c) return "";
  const p = normTw(prefix);
  const s = normTw(suffix);

  // 1. Resolve Suffix first (before prepending prefix)
  // Do not append suffix if user is typing a Province or County name directly (e.g. 臺灣省, 花蓮縣)
  const isProvOrCountyOnly =
    c === "臺灣省" || c === "福建省" || EXACT_COUNTY_NAMES_SET.has(c);

  if (s && !isProvOrCountyOnly && !c.endsWith(s)) {
    // Check if c (or its town part after any county prefix) is ALREADY a complete valid townName (e.g. 虎尾鎮, 花蓮市)
    let townPart = c;
    for (const county of TAIWAN_ADMIN_DATA) {
      const cn = normTw(county.name);
      const pn = normTw(county.province + county.name);
      if (townPart.startsWith(pn) && townPart.length > pn.length) {
        townPart = townPart.slice(pn.length);
        break;
      } else if (townPart.startsWith(cn) && townPart.length > cn.length) {
        townPart = townPart.slice(cn.length);
        break;
      }
    }
    const candidateTown = townPart + s;
    const normPoiCore = typeof normalizePoiText === "function" ? normalizePoiText(c) : c;
    const candidatePoi = typeof normalizePoiText === "function" ? normalizePoiText(c + s) : c + s;
    // Append suffix whenever (core + suffix) forms a real target (e.g. 內湖+區, 南港+區, 大湖+鄉, 內湖+站, 松山機場+站, 鯉魚潭+水庫, 澎湖+機場)
    const appendsToValidTarget =
      (VALID_TOWN_SUFFIXES.has(s) && EXACT_TOWN_NAMES_SET.has(candidateTown)) ||
      (s === "站" && EXACT_STATION_BASES_SET.has(c)) ||
      EXACT_POI_SUFFIXED_KEYS_SET.has(candidatePoi);

    const isAlreadyComplete =
      EXACT_TOWN_NAMES_SET.has(townPart) ||
      c.endsWith("站") ||
      EXACT_POI_SUFFIXED_KEYS_SET.has(normPoiCore) ||
      /^[A-Za-z]{3,4}$/.test(c);

    if (appendsToValidTarget || !isAlreadyComplete) {
      c = c + s;
    }
  }

  // 2. Resolve Prefix without false-positive matching on county.short (so 花蓮市 / 宜蘭市 / 苗栗市 / 彰化市 / 南投市 / 屏東市 / 臺東市 / 桃園區 work!)
  if (p) {
    if (c.startsWith(p)) {
      // Already starts with exact prefix
    } else if ((p === "臺灣省" || p === "福建省") && !c.startsWith("臺灣省") && !c.startsWith("福建省")) {
      c = p + c;
    } else {
      // Check if c already starts with a full County Name (e.g. 花蓮縣花蓮市) or Province+County Name
      const startsWithFullCounty =
        c.startsWith("臺灣省") ||
        c.startsWith("福建省") ||
        TAIWAN_ADMIN_DATA.some((county) => c.startsWith(normTw(county.name)));

      if (!startsWithFullCounty) {
        c = p + c;
      } else if (p.startsWith("臺灣省") && c.startsWith(p.slice(3))) {
        // e.g. p is "臺灣省花蓮縣" and user typed "花蓮縣花蓮市" -> combine cleanly into "臺灣省花蓮縣花蓮市"
        c = "臺灣省" + c;
      } else if (p.startsWith("福建省") && c.startsWith(p.slice(3))) {
        c = "福建省" + c;
      }
    }
  }
  return c;
}

function updateLiveCombinedPreview() {
  const prefix = isPrefixRequiredMode() ? (document.getElementById("prefix-select")?.value || "") : "";
  const core = document.getElementById("answer-input").value.trim();
  const suffix = document.getElementById("suffix-input").value.trim();
  const badge = document.getElementById("live-preview-combined");
  if (!badge) return;

  if ((prefix || suffix) && core) {
    const combined = buildCombinedInput(prefix, core, suffix);
    badge.textContent = `識別: ${combined}`;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

// Windows IME-safe input clearing:
// Never clear during active composition; if called on Enter/Submit, reset value cleanly after composition flushes.
function clearCoreInput() {
  const input = document.getElementById("answer-input");
  if (!input) return;
  input.value = "";
  updateLiveCombinedPreview();
}

function evaluateGuess(rawInput, isAutoCheck = false) {
  // CRITICAL WINDOWS IME FIX: Never auto-evaluate or clear input while IME composition (dotted underline) is active!
  if (isAutoCheck && state.isImeComposing) return false;
  if (state.isGameOver) return false;

  const prefix = isPrefixRequiredMode() ? (document.getElementById("prefix-select")?.value || "") : "";
  const suffix = document.getElementById("suffix-input").value.trim();
  const core = rawInput.trim();
  if (!core) return false;

  const combined = buildCombinedInput(prefix, core, suffix);
  const coreWithSuffix = buildCombinedInput("", core, suffix);
  const cleanCore = normTw(core);

  if (!state.timerRunning && state.elapsedSec === 0) {
    startTimer();
  }

  if (state.playMode === "free") {
    state.targetStationKey = null;
    state.targetId = null;
    state.targetPoiId = null;
  }

  // CASE -1: POI QUIZ (Airports & Ports) — Targeted POI, Pure POI Mode, or explicit Airport/Port suffix/alias
  const isPoiQuizActive = typeof hasAnyPoiQuizActive === "function" && hasAnyPoiQuizActive();
  const isStationQuizActive = Boolean(state.stationQuizEnabled && state.quizStationLines && state.quizStationLines.size > 0);
  const isPurePoiQuiz = isPoiQuizActive && !state.regionQuizEnabled && !isStationQuizActive;
  const isTargetingPoi = (state.playMode === "target_click" || state.playMode === "target_random") && Boolean(state.targetPoiId);
  const isTargetingOtherFromPoi = (state.playMode === "target_click" || state.playMode === "target_random") && Boolean(state.targetId || state.targetStationKey);
  const poiSuffixRe = /(機場|基地|航空站|桃機|松機|清泉崗|漁港|商港|工業港|天然氣港|接收港|接收站|港|碼頭|一接|二接|三接|水庫|攔河堰|人工湖|大壩|壩|湖|潭|池|埤|窟|水漾森林|天使的眼淚)$/;
  const normPoiWithSuffix = typeof normalizePoiText === "function" ? normalizePoiText(coreWithSuffix) : normTw(coreWithSuffix);
  const normPoiCombined = typeof normalizePoiText === "function" ? normalizePoiText(combined) : normTw(combined);
  const looksLikePoiInput =
    EXACT_POI_SUFFIXED_KEYS_SET.has(normPoiWithSuffix) ||
    EXACT_POI_SUFFIXED_KEYS_SET.has(normPoiCombined) ||
    poiSuffixRe.test(coreWithSuffix) ||
    /^[A-Za-z]{3,4}$/.test(core);

  if (isPoiQuizActive && !isTargetingOtherFromPoi && (isTargetingPoi || isPurePoiQuiz || looksLikePoiInput)) {
    let poiRes = tryMatchAndUnlockPoi(coreWithSuffix, isAutoCheck);
    if ((!poiRes || !poiRes.matched) && combined && combined !== coreWithSuffix) {
      const combinedRes = tryMatchAndUnlockPoi(combined, isAutoCheck);
      if (combinedRes && (combinedRes.matched || !poiRes || !poiRes.ambiguousSettlement)) {
        poiRes = combinedRes;
      }
    }
    if (poiRes && poiRes.ambiguousSettlement) {
      const canFallbackStationInCasual = !isTargetingPoi && !isPurePoiQuiz && state.difficulty === "casual" && isStationQuizActive;
      if (canFallbackStationInCasual && tryMatchAndUnlockStation(core, coreWithSuffix, isAutoCheck)) {
        return true;
      }
      if (!isAutoCheck) {
        const examples = (poiRes.ambiguousCandidates || [])
          .map((c) => {
            const tBase = String(c.townName || "").replace(/[鄉鎮市區]$/, "");
            const cShort = String(c.countyName || "").replace(/[縣市]$/, "");
            const pre = (tBase.length >= 2 && tBase !== cShort) ? tBase : cShort;
            return `${pre}${c.name}`;
          })
          .join("、");
        triggerWrongFeedback(`⚠️ 全臺有多處同名聚落「${coreWithSuffix}」，請加上縣市或鄉鎮前綴區分（如：${examples}）`);
      }
      return false;
    }
    if (poiRes && poiRes.matched) {
      const canFallbackInCasual = !isTargetingPoi && !isPurePoiQuiz && state.difficulty === "casual";
      if (poiRes.alreadyUnlocked) {
        if (canFallbackInCasual) {
          // Let casual mixed mode fall through so同名行政區或車站仍可解鎖（例如「大湖公園」站）
        } else {
          if (!isAutoCheck) setFeedback(`已經解鎖過「${poiRes.poi.name}」囉！`, "warn");
          return false;
        }
      } else {
        const p = poiRes.poi;
        const displayCat = typeof getPoiDisplayCategory === "function" ? getPoiDisplayCategory(p) : p.category;
        const catMeta = POI_CATEGORY_META[displayCat] || { icon: "📍", label: "地標" };
        state.lastTargetLat = p.lat;
        state.lastTargetLng = p.lng;
        if (typeof refreshPoiMapLayer === "function") refreshPoiMapLayer();

        let bonusText = "";
        if (canFallbackInCasual) {
          if (state.regionQuizEnabled) {
            const bonusTowns = getScopeTowns().filter(
              (t) => !state.unlockedTowns.has(t.id) && (cleanCore === normTw(t.baseName) || cleanCore === normTw(t.townName))
            );
            if (bonusTowns.length > 0) {
              bonusTowns.forEach((t) => {
                state.unlockedTowns.add(t.id);
                state.unlockedCounties.add(t.countyName);
              });
              bonusText += ` ＋ 🗺️ ${bonusTowns.map((t) => t.fullCountyTown).join("、")}`;
            }
          }
          if (isStationQuizActive) {
            const cStripped = cleanStationBaseName(core);
            const bonusSt = getActiveQuizStations().filter((st) => !state.unlockedStations.has(st.key) && st.baseName === cStripped);
            if (bonusSt.length > 0) {
              bonusSt.forEach((st) => state.unlockedStations.add(st.key));
              updateRoadAndRailwayTileOverlays();
              bonusText += ` ＋ 🚉 車站「${bonusSt[0].displayName}」`;
            }
          }
        }

        const unlockedList = Array.isArray(poiRes.unlockedList) && poiRes.unlockedList.length > 1 ? poiRes.unlockedList : null;
        const locHint = shouldHidePoiAdminLocationHint() ? "" : `（${p.countyName}${p.townName}）`;
        const unlockMsg = unlockedList
          ? `${catMeta.icon} 同時解鎖 ${unlockedList.length} 處${catMeta.label}：${unlockedList.map((x) => x.name).join("、")}${bonusText}`
          : `${catMeta.icon} 解鎖${catMeta.label}：${p.name}${locHint}${bonusText}`;
        onSuccessfulUnlock(unlockMsg, p.shortName, Boolean(isTargetingPoi));
      if (isTargetingPoi) {
        if (state.playMode === "target_random") {
          pickNextTargetRegion();
        } else {
          state.targetPoiId = null;
          updateTargetBannerUI();
          if (typeof refreshPoiMapLayer === "function") refreshPoiMapLayer();
        }
      }
        return true;
      }
    }
    if (poiRes && poiRes.lockedCounty) {
      if (!isAutoCheck) {
        triggerWrongFeedback("🔒 縣市未解鎖：困難模式下，須先解鎖所屬縣市才能猜此地標！");
      }
      return false;
    }
    if (isTargetingPoi || isPurePoiQuiz) {
      if (!isAutoCheck) {
        triggerWrongFeedback(
          isTargetingPoi
            ? `與指定目標地標不符：「${combined}」`
            : `找不到或已解鎖地標：「${combined}」`
        );
      }
      return false;
    }
  }

  // CASE 0: PURE STATION QUIZ MODE (0 counties selected) OR TARGETED STATION DOT (only in target modes) OR "站" SUFFIX
  const isPureStationQuiz = !state.regionQuizEnabled && !isPoiQuizActive && isStationQuizActive;
  const isTargetingStation = (state.playMode === "target_click" || state.playMode === "target_random") && Boolean(state.targetStationKey);
  const looksLikeStationInput = core.endsWith("站") || coreWithSuffix.endsWith("站") || suffix === "站";
  const isTargetingOtherFromStation = (state.playMode === "target_click" || state.playMode === "target_random") && Boolean(state.targetId || state.targetPoiId);
  if (
    isStationQuizActive &&
    !isTargetingOtherFromStation &&
    (isPureStationQuiz || isTargetingStation || looksLikeStationInput)
  ) {
    if (tryMatchAndUnlockStation(core, coreWithSuffix, isAutoCheck)) {
      return true;
    }
    if (state._lastStationLockedCounty) {
      if (!isAutoCheck) {
        triggerWrongFeedback("🔒 縣市未解鎖：困難模式下，須先解鎖所屬縣市才能猜此車站！");
      }
      return false;
    }
    if (isPureStationQuiz || isTargetingStation || looksLikeStationInput) {
      if (!isAutoCheck) {
        triggerWrongFeedback(
          isTargetingStation
            ? `與指定目標車站不符：「${combined}」`
            : `找不到或已解鎖車站：「${combined}」`
        );
      }
      return false;
    }
  }

  // CASE A: TARGET QUIZ MODE
  if (state.playMode === "target_random" || state.playMode === "target_click") {
    if (!state.targetId && !state.targetStationKey && !state.targetPoiId) {
      if (!isAutoCheck) setFeedback("請先在地圖上點選一個目標區塊、車站或地標，或使用上方目標控制按鈕！", "warn");
      return false;
    }

    if (state.difficulty === "county_only") {
      const targetCounty = COUNTY_BY_NAME[state.targetId];
      if (!targetCounty) return false;
      const ok =
        combined === normTw(targetCounty.name) ||
        cleanCore === normTw(targetCounty.name) ||
        cleanCore === normTw(targetCounty.short);
      if (ok) {
        state.unlockedCounties.add(targetCounty.name);
        state.lastTargetLat = targetCounty.lat;
        state.lastTargetLng = targetCounty.lng;
        onSuccessfulUnlock(`🎯 答對指定縣市：${targetCounty.name}！（可按方向鍵 ↑↓←→ 移至相鄰縣市或點選下一個）`, targetCounty.name, true);
        if (state.playMode === "target_random") {
          pickNextTargetRegion();
        } else {
          state.targetId = null;
          updateTargetBannerUI();
          refreshAllPolygonStyles();
        }
        return true;
      }
      if (!isAutoCheck) triggerWrongFeedback(`答案不是「${combined}」，再仔細看看位置！`);
      return false;
    }

    const targetTown = ALL_TOWNS.find((t) => t.id === state.targetId);
    if (!targetTown) return false;

    let isMatch = false;
    if (state.difficulty === "casual") {
      isMatch =
        cleanCore === normTw(targetTown.baseName) ||
        cleanCore === normTw(targetTown.townName) ||
        combined === normTw(targetTown.townName) ||
        combined === normTw(targetTown.fullCountyTown) ||
        combined === normTw(targetTown.fullHierarchyName);
    } else if (state.difficulty === "hard_suffix") {
      isMatch =
        combined === normTw(targetTown.townName) ||
        cleanCore === normTw(targetTown.townName) ||
        combined === normTw(targetTown.fullCountyTown) ||
        cleanCore === normTw(targetTown.fullCountyTown) ||
        combined === normTw(targetTown.fullHierarchyName);
    } else {
      isMatch =
        combined === normTw(targetTown.fullHierarchyName) ||
        cleanCore === normTw(targetTown.fullHierarchyName) ||
        combined === normTw(targetTown.fullCountyTown) ||
        cleanCore === normTw(targetTown.fullCountyTown);
    }

    if (isMatch) {
      state.unlockedTowns.add(targetTown.id);
      state.unlockedCounties.add(targetTown.countyName);
      state.unlockedProvinces.add(targetTown.isSpecial ? targetTown.countyName : targetTown.province);
      state.lastTargetLat = targetTown.lat;
      state.lastTargetLng = targetTown.lng;
      updatePrefixDropdownUI();
      onSuccessfulUnlock(`🎯 精準命中：${targetTown.fullHierarchyName}！（按方向鍵 ↑↓←→ 可移至相鄰區塊，或直接點選地圖）`, targetTown.fullCountyTown, true);
      if (state.playMode === "target_random") {
        pickNextTargetRegion();
      } else {
        // In target_click mode: stay at original position! Do not jump randomly!
        state.targetId = null;
        updateTargetBannerUI();
        refreshAllPolygonStyles();
      }
      return true;
    } else {
      if (!isAutoCheck) {
        const reqHint =
          state.difficulty === "casual"
            ? "（普通難度只需輸入鄉鎮名稱）"
            : state.difficulty === "hard_suffix"
            ? "（進階後綴模式需含正確鄉/鎮/市/區後綴）"
            : "（困難全名模式需含完整縣市+鄉鎮市區全名）";
        triggerWrongFeedback(`與指定區塊不符 ${reqHint}`);
      }
      return false;
    }
  }

  // CASE B: FREE RECALL - COUNTY ONLY MODE
  if (state.difficulty === "county_only") {
    const matchedCounty = getScopeCounties().find(
      (c) =>
        !state.unlockedCounties.has(c.name) &&
        (combined === normTw(c.name) ||
          cleanCore === normTw(c.name) ||
          cleanCore === normTw(c.short) ||
          combined === normTw(`${c.province}${c.name}`))
    );
    if (matchedCounty) {
      state.unlockedCounties.add(matchedCounty.name);
      onSuccessfulUnlock(`🎉 解鎖縣市：${matchedCounty.name}（可點右側標籤直接放大定位）`, matchedCounty.name, true);
      return true;
    }
    if (!isAutoCheck) triggerWrongFeedback(`找不到未解鎖的縣市「${combined}」`);
    return false;
  }

  // CASE C: FREE RECALL - MASTER HIERARCHY MODE
  if (state.difficulty === "master_hierarchy") {
    if (cleanCore === "臺灣省" || cleanCore === "福建省") {
      if (!state.unlockedProvinces.has(cleanCore)) {
        state.unlockedProvinces.add(cleanCore);
        playTone("tier");
        updatePrefixDropdownUI();
        document.getElementById("prefix-select").value = cleanCore;
        clearCoreInput();
        refreshAllPolygonStyles();
        setFeedback(`👑 第一階突破！已解鎖「${cleanCore}」，並已自動設為前綴，現在可猜其下轄縣市！`, "tier");
        return true;
      } else if (!isAutoCheck) {
        setFeedback(`「${cleanCore}」已經解鎖過囉！已為你切換前綴為 ${cleanCore}`, "info");
        document.getElementById("prefix-select").value = cleanCore;
        clearCoreInput();
        return true;
      }
    }

    const specialMatch = getScopeCounties().find(
      (c) => c.isSpecial && (cleanCore === normTw(c.name) || combined === normTw(c.name))
    );
    if (specialMatch) {
      if (!state.unlockedCounties.has(specialMatch.name)) {
        state.unlockedProvinces.add(specialMatch.name);
        state.unlockedCounties.add(specialMatch.name);
        playTone("tier");
        updatePrefixDropdownUI();
        document.getElementById("prefix-select").value = specialMatch.name;
        document.getElementById("suffix-input").value = "區";
        clearCoreInput();
        refreshAllPolygonStyles();
        updateScoreAndProgressUI();
        setFeedback(`🏙️ 解鎖直轄市「${specialMatch.name}」！已自動鎖定前綴「${specialMatch.name}」與後綴「區」！`, "tier");
        return true;
      } else if (!isAutoCheck) {
        document.getElementById("prefix-select").value = specialMatch.name;
        clearCoreInput();
        setFeedback(`已切換前綴為「${specialMatch.name}」`, "info");
        return true;
      }
    }

    const countyMatch = getScopeCounties().find(
      (c) =>
        !c.isSpecial &&
        (combined === normTw(`${c.province}${c.name}`) ||
          (state.unlockedProvinces.has(c.province) && cleanCore === normTw(c.name)))
    );
    if (countyMatch) {
      if (!state.unlockedProvinces.has(countyMatch.province)) {
        if (!isAutoCheck) {
          triggerWrongFeedback(`🔒 階層鎖定：必須先猜出頂層「${countyMatch.province}」，才能解鎖「${countyMatch.name}」喔！`);
        }
        return false;
      }
      if (!state.unlockedCounties.has(countyMatch.name)) {
        state.unlockedCounties.add(countyMatch.name);
        playTone("tier");
        const fullPrefix = `${countyMatch.province}${countyMatch.name}`;
        updatePrefixDropdownUI();
        document.getElementById("prefix-select").value = fullPrefix;
        clearCoreInput();
        refreshAllPolygonStyles();
        updateScoreAndProgressUI();
        setFeedback(`🗺️ 第二階突破！已解鎖「${fullPrefix}」並設為前綴，現在可輸入該縣市的鄉鎮市區！`, "tier");
        return true;
      } else if (!isAutoCheck) {
        document.getElementById("prefix-select").value = `${countyMatch.province}${countyMatch.name}`;
        clearCoreInput();
        setFeedback(`已切換前綴為「${countyMatch.province}${countyMatch.name}」`, "info");
        return true;
      }
    }

    const candidateTowns = getScopeTowns().filter(
      (t) =>
        normTw(t.fullHierarchyName) === combined ||
        (state.unlockedCounties.has(t.countyName) &&
          normTw(t.fullCountyTown) === combined)
    );
    if (candidateTowns.length > 0) {
      const t = candidateTowns[0];
      if (!state.unlockedCounties.has(t.countyName)) {
        if (!isAutoCheck) {
          const needed = t.isSpecial ? t.countyName : `${t.province} ➔ ${t.countyName}`;
          triggerWrongFeedback(`🔒 階層鎖定：請先依序解鎖「${needed}」，才能猜「${t.townName}」！`);
        }
        return false;
      }
      if (state.unlockedTowns.has(t.id)) {
        if (!isAutoCheck) setFeedback(`「${t.fullHierarchyName}」已經答對過囉！`, "info");
        return false;
      }
      state.unlockedTowns.add(t.id);
      onSuccessfulUnlock(`✨ 解鎖：${t.fullHierarchyName}`, t.fullCountyTown, false);
      return true;
    }

    if (!isAutoCheck) {
      triggerWrongFeedback(`無法匹配「${combined}」（請確認省/縣市是否已解鎖，且包含正確鄉鎮市區後綴）`);
    }
    return false;
  }

  // CASE D1: FREE RECALL - HARD SUFFIX MODE (較簡單的困難：免縣市前綴，僅需正確鄉鎮市區+後綴，如「信義區」、「虎尾鎮」)
  if (state.difficulty === "hard_suffix") {
    const normPrefix = normTw(prefix);
    const matched = getScopeTowns().filter((t) => {
      if (state.unlockedTowns.has(t.id)) return false;
      // If user explicitly selected a county prefix in dropdown and didn't type a different full county name, scope to that county
      if (normPrefix && combined === normTw(`${normPrefix}${t.townName}`)) {
        return normTw(t.countyName) === normPrefix;
      }
      return (
        combined === normTw(t.fullCountyTown) ||
        combined === normTw(t.fullHierarchyName) ||
        cleanCore === normTw(t.fullCountyTown) ||
        combined === normTw(t.townName) ||
        (!normPrefix && cleanCore === normTw(t.townName))
      );
    });
    if (matched.length > 0) {
      matched.forEach((t) => {
        state.unlockedTowns.add(t.id);
        state.unlockedCounties.add(t.countyName);
      });
      updatePrefixDropdownUI();
      const labelStr =
        matched.length > 1
          ? `一次解鎖 ${matched.length} 個同名行政區：${matched.map((m) => m.fullCountyTown).join("、")}`
          : `解鎖：${matched[0].fullCountyTown}`;
      onSuccessfulUnlock(labelStr, matched[0].fullCountyTown, false);
      return true;
    }
    if (isStationQuizActive && tryMatchAndUnlockStation(core, combined, isAutoCheck)) {
      return true;
    }
    if (state._lastStationLockedCounty) {
      if (!isAutoCheck) {
        triggerWrongFeedback("🔒 縣市未解鎖：困難模式下，須先解鎖所屬縣市才能猜此車站！");
      }
      return false;
    }
    if (!isAutoCheck) {
      triggerWrongFeedback(`找不到或後綴不符：「${combined}」（進階後綴模式需含正確鄉/鎮/市/區後綴，或輸入車站名稱）`);
    }
    return false;
  }

  // CASE D2: FREE RECALL - STRICT HARD FULL NAME MODE (嚴格困難：必須包含「縣市＋鄉鎮市區＋後綴」，無前綴只打「信義區」絕不匹配、絕不跨縣市偷渡解鎖！)
  if (state.difficulty === "hard_full") {
    // Allow typing a County Name (e.g. 臺北市, 基隆市, 雲林縣) to unlock & switch the prefix dropdown
    const directCounty = getScopeCounties().find(
      (c) => cleanCore === normTw(c.name) || (!prefix && combined === normTw(c.name))
    );
    if (directCounty) {
      const wasUnlocked = state.unlockedCounties.has(directCounty.name);
      if (!wasUnlocked) {
        state.unlockedCounties.add(directCounty.name);
        playTone("tier");
        updatePrefixDropdownUI();
        document.getElementById("prefix-select").value = directCounty.name;
        clearCoreInput();
        refreshAllPolygonStyles();
        updateScoreAndProgressUI();
        setFeedback(`🔓 已解鎖縣市前綴「${directCounty.name}」並自動選取！現在可直接輸入其下轄鄉鎮市區`, "tier");
        return true;
      } else if (!isAutoCheck) {
        document.getElementById("prefix-select").value = directCounty.name;
        clearCoreInput();
        updateLiveCombinedPreview();
        setFeedback(`📍 已切換縣市前綴為「${directCounty.name}」`, "info");
        return true;
      }
    }

    // Strict full County+Township match ONLY (never match bare t.townName!)
    const matched = getScopeTowns().filter(
      (t) =>
        !state.unlockedTowns.has(t.id) &&
        (combined === normTw(t.fullCountyTown) ||
          combined === normTw(t.fullHierarchyName) ||
          (!prefix && cleanCore === normTw(t.fullCountyTown)) ||
          (!prefix && cleanCore === normTw(t.fullHierarchyName)))
    );
    if (matched.length > 0) {
      const t = matched[0];
      const wasCountyUnlocked = state.unlockedCounties.has(t.countyName);
      state.unlockedTowns.add(t.id);
      state.unlockedCounties.add(t.countyName);
      updatePrefixDropdownUI();
      // If user typed full "臺北市信義區" while prefix was empty, auto-select "臺北市" in prefix dropdown for convenience
      const prefixSelect = document.getElementById("prefix-select");
      if (prefixSelect && !prefixSelect.value) {
        prefixSelect.value = t.countyName;
      }
      onSuccessfulUnlock(
        wasCountyUnlocked ? `解鎖：${t.fullCountyTown}` : `🔓 解鎖「${t.countyName}」與「${t.fullCountyTown}」！`,
        t.fullCountyTown,
        false
      );
      return true;
    }
    if (isStationQuizActive && tryMatchAndUnlockStation(core, combined, isAutoCheck)) {
      return true;
    }
    if (!isAutoCheck) {
      const townOnlyCandidate = getScopeTowns().find(
        (t) => cleanCore === normTw(t.townName) || combined === normTw(t.townName)
      );
      if (townOnlyCandidate && !prefix) {
        triggerWrongFeedback(
          `⚠️ 困難全名模式不可只打「${combined}」！請加上縣市全名（如：${townOnlyCandidate.fullCountyTown}）或先輸入縣市解鎖前綴（想免打縣市可改選「進階後綴模式」）`
        );
      } else {
        triggerWrongFeedback(`找不到或未含完整縣市+鄉鎮市區後綴：「${combined}」`);
      }
    }
    return false;
  }

  // CASE E: FREE RECALL - CASUAL / ORIGINAL MODE
  const matchedCasual = getScopeTowns().filter((t) => {
    if (state.unlockedTowns.has(t.id)) return false;
    const cShortTown = normTw(`${t.countyShort}${t.townName}`);
    const cShortBase = normTw(`${t.countyShort}${t.baseName}`);
    return (
      cleanCore === normTw(t.townName) ||
      cleanCore === normTw(t.baseName) ||
      combined === normTw(t.townName) ||
      combined === normTw(t.baseName) ||
      combined === normTw(t.fullCountyTown) ||
      cleanCore === normTw(t.fullCountyTown) ||
      cleanCore === cShortTown ||
      cleanCore === cShortBase
    );
  });

  if (matchedCasual.length > 0) {
    matchedCasual.forEach((t) => {
      state.unlockedTowns.add(t.id);
      state.unlockedCounties.add(t.countyName);
    });
    // If station quiz is active and this name also matches an active station (e.g. 板橋, 苗栗, 瑞芳), unlock that station too!
    let stationBonus = "";
    if (isStationQuizActive) {
      const activeStations = getActiveQuizStations();
      const cStripped = cleanStationBaseName(core);
      const bonusSt = activeStations.filter((st) => !state.unlockedStations.has(st.key) && st.baseName === cStripped);
      if (bonusSt.length > 0) {
        bonusSt.forEach((st) => state.unlockedStations.add(st.key));
        updateRoadAndRailwayTileOverlays();
        stationBonus = ` ＋ 🚉 車站「${bonusSt[0].displayName}」`;
      }
    }
    const labelStr =
      matchedCasual.length > 1
        ? `一次解鎖 ${matchedCasual.length} 個同名行政區：${matchedCasual.map((m) => m.fullCountyTown).join("、")}${stationBonus}`
        : `解鎖：${matchedCasual[0].fullCountyTown}${stationBonus}`;
    onSuccessfulUnlock(labelStr, matchedCasual[0].fullCountyTown, false);
    return true;
  }

  // Check if input matches any active Station (e.g. 內壢, 大橋頭, 十分, 內灣, 奮起湖, 美麗島, etc.)
  if (isStationQuizActive && tryMatchAndUnlockStation(core, combined, isAutoCheck)) {
    return true;
  }

  if (!isAutoCheck) {
    triggerWrongFeedback(`找不到或已解鎖：「${combined}」`);
  }
  return false;
}

function onSuccessfulUnlock(msg, lastItemName, isTierOrTarget) {
  if (!state.stats) state.stats = { totalAttempts: 0, correctAttempts: 0, wrongAttempts: 0, streak: 0, maxStreak: 0 };
  state.stats.correctAttempts++;
  state.stats.totalAttempts++;
  state.stats.streak++;
  if (state.stats.streak > state.stats.maxStreak) state.stats.maxStreak = state.stats.streak;

  playTone(isTierOrTarget ? "tier" : "unlock");
  clearCoreInput();
  setFeedback(msg, "success");
  refreshAllPolygonStyles();
  updateScoreAndProgressUI();
  broadcastP2PState(lastItemName);
  checkVictoryCondition();
}

function triggerWrongFeedback(msg) {
  if (!state.stats) state.stats = { totalAttempts: 0, correctAttempts: 0, wrongAttempts: 0, streak: 0, maxStreak: 0 };
  state.stats.wrongAttempts++;
  state.stats.totalAttempts++;
  state.stats.streak = 0;

  playTone("error");
  setFeedback(msg, "error");
  const card = document.getElementById("input-dock-card");
  if (card) {
    card.classList.remove("animate-shake");
    void card.offsetWidth;
    card.classList.add("animate-shake");
  }
}

function setFeedback(text, level = "info") {
  const el = document.getElementById("feedback-message");
  if (!el) return;
  const dotColors = {
    success: "bg-emerald-400",
    tier: "bg-amber-400",
    error: "bg-rose-500",
    warn: "bg-amber-400",
    info: "bg-sky-400"
  };
  const textColors = {
    success: "text-emerald-300",
    tier: "text-amber-300 font-bold",
    error: "text-rose-300",
    warn: "text-amber-200",
    info: "text-slate-300"
  };
  el.className = `${textColors[level] || "text-slate-300"} font-medium flex items-center gap-1.5 truncate`;
  const dotEl = document.getElementById("feedback-dot");
  const txtEl = document.getElementById("feedback-text");
  if (dotEl && txtEl) {
    dotEl.className = `w-2 h-2 rounded-full shrink-0 ${dotColors[level] || "bg-sky-400"}`;
    txtEl.textContent = text;
  } else {
    el.textContent = text;
  }
}

// =========================================================================
// 7. TARGET REGION MODE
// =========================================================================
function pickNextTargetRegion() {
  state.hintLevel = 0;
  const remainingStations = getActiveQuizStations().filter((s) => !state.unlockedStations.has(s.key));
  const remainingPois = typeof getActiveQuizPois === "function"
    ? getActiveQuizPois().filter((p) => !state.unlockedPois.has(p.id))
    : [];
  const scopeTowns = getScopeTowns();
  const regionDone =
    scopeTowns.length === 0 ||
    (state.difficulty === "county_only"
      ? getScopeCounties().every((c) => state.unlockedCounties.has(c.name))
      : scopeTowns.every((t) => state.unlockedTowns.has(t.id)));

  // If region is done (or off) and POIs remain (and no stations left, or pure POI mode)
  if (regionDone && remainingPois.length > 0 && (remainingStations.length === 0 || Math.random() < 0.5)) {
    const pickPoi = remainingPois[Math.floor(Math.random() * remainingPois.length)];
    state.targetId = null;
    state.targetStationKey = null;
    state.targetPoiId = pickPoi.id;
    state.lastTargetLat = pickPoi.lat;
    state.lastTargetLng = pickPoi.lng;
    focusMapOnLatLng(pickPoi.lat, pickPoi.lng, 10);
    if (typeof refreshPoiMapLayer === "function") refreshPoiMapLayer();
    updateTargetBannerUI();
    refreshAllPolygonStyles();
    if (state.roomCode && typeof broadcastP2PState === "function") broadcastP2PState();
    return;
  }

  // If in Pure Station Mode (0 counties selected) OR all townships done while stations remain
  if (regionDone && remainingStations.length > 0) {
    const pickSt = remainingStations[Math.floor(Math.random() * remainingStations.length)];
    state.targetId = null;
    state.targetPoiId = null;
    state.targetStationKey = pickSt.key;
    state.lastTargetLat = pickSt.lat;
    state.lastTargetLng = pickSt.lng;
    focusMapOnLatLng(pickSt.lat, pickSt.lng, 12);
    updateRoadAndRailwayTileOverlays();
    if (typeof refreshPoiMapLayer === "function") refreshPoiMapLayer();
    updateTargetBannerUI();
    refreshAllPolygonStyles();
    if (state.roomCode && typeof broadcastP2PState === "function") broadcastP2PState();
    return;
  }

  state.targetStationKey = null;
  state.targetPoiId = null;
  if (state.difficulty === "county_only") {
    const remaining = getScopeCounties().filter((c) => !state.unlockedCounties.has(c.name));
    if (remaining.length === 0) {
      state.targetId = null;
      checkVictoryCondition();
      return;
    }
    const pick = remaining[Math.floor(Math.random() * remaining.length)];
    state.targetId = pick.name;
    state.lastTargetLat = pick.lat;
    state.lastTargetLng = pick.lng;
    focusMapOnLatLng(pick.lat, pick.lng, 9);
  } else {
    const remaining = scopeTowns.filter((t) => !state.unlockedTowns.has(t.id));
    if (remaining.length === 0) {
      state.targetId = null;
      checkVictoryCondition();
      return;
    }
    const pick = remaining[Math.floor(Math.random() * remaining.length)];
    state.targetId = pick.id;
    state.lastTargetLat = pick.lat;
    state.lastTargetLng = pick.lng;
    focusMapOnLatLng(pick.lat, pick.lng, 10);
  }
  updateTargetBannerUI();
  refreshAllPolygonStyles();
  if (state.roomCode && typeof broadcastP2PState === "function") broadcastP2PState();
}

// Exit target/random mode back to normal free recall mode
function exitTargetQuizMode() {
  state.targetId = null;
  state.targetStationKey = null;
  state.targetPoiId = null;
  state.hintLevel = 0;
  if (canLocalModifyGameConfig()) {
    if (state.isHost && state.roomCode && state.playMode !== "free") {
      if (typeof requestOrApplyConfigChange === "function") {
        requestOrApplyConfigChange({ playMode: "free" }, "出題方式");
      }
      return;
    }
    state.playMode = "free";
    if (typeof syncConfigButtonsUI === "function") syncConfigButtonsUI();
    if (typeof updateModeBadgeText === "function") updateModeBadgeText();
  }
  updateTargetBannerUI();
  if (typeof updateRoadAndRailwayTileOverlays === "function") updateRoadAndRailwayTileOverlays();
  refreshAllPolygonStyles();
  if (typeof refreshPoiMapLayer === "function") refreshPoiMapLayer();
  if (typeof renderRoomConciseSettingsSummary === "function") renderRoomConciseSettingsSummary();
  setFeedback("已退出指定/隨機目標視窗，切回一般自由輸入模式！", "info");
  const inp = document.getElementById("answer-input");
  if (inp) inp.focus({ preventScroll: true });
}

// Move target selection to the nearest locked neighbor in direction ('N' | 'S' | 'W' | 'E')
function moveTargetByDirection(dir) {
  if (state.playMode === "free") {
    return;
  }
  let curLat = state.lastTargetLat;
  let curLng = state.lastTargetLng;

  const isPureStationMode = getScopeTowns().length === 0 && getScopeCounties().length === 0;
  const moveStation = Boolean(state.targetStationKey || isPureStationMode);

  if (moveStation) {
    const activeStations = getActiveQuizStations();
    if (state.targetStationKey) {
      const curSt = activeStations.find((s) => s.key === state.targetStationKey);
      if (curSt) { curLat = curSt.lat; curLng = curSt.lng; }
    }
    const stCandidates = activeStations.filter((s) => !state.unlockedStations.has(s.key) && s.key !== state.targetStationKey);
    if (stCandidates.length === 0) return;

    let bestSt = null;
    let bestStScore = Infinity;
    stCandidates.forEach((item) => {
      const dLat = item.lat - curLat;
      const dLng = item.lng - curLng;
      const dist = Math.hypot(dLat, dLng);
      if (dist < 1e-6) return;
      let primary = 0, perp = 0;
      if (dir === "N") { primary = dLat; perp = Math.abs(dLng); }
      else if (dir === "S") { primary = -dLat; perp = Math.abs(dLng); }
      else if (dir === "E") { primary = dLng; perp = Math.abs(dLat); }
      else if (dir === "W") { primary = -dLng; perp = Math.abs(dLat); }
      if (primary <= 0) return;
      const score = dist + perp * 1.35;
      if (score < bestStScore) {
        bestStScore = score;
        bestSt = item;
      }
    });
    if (!bestSt) return;
    state.hintLevel = 0;
    state.targetStationKey = bestSt.key;
    state.targetId = null;
    state.lastTargetLat = bestSt.lat;
    state.lastTargetLng = bestSt.lng;
    updateRoadAndRailwayTileOverlays();
    updateTargetBannerUI();
    refreshAllPolygonStyles();
    if (state.roomCode && typeof broadcastP2PState === "function") broadcastP2PState();
    if (map) map.panTo([bestSt.lat, bestSt.lng], { animate: true, duration: 0.35 });
    const inp = document.getElementById("answer-input");
    if (inp) inp.focus({ preventScroll: true });
    return;
  }

  if (state.targetId) {
    if (state.difficulty === "county_only") {
      const c = COUNTY_BY_NAME[state.targetId];
      if (c) { curLat = c.lat; curLng = c.lng; }
    } else {
      const t = ALL_TOWNS.find((x) => x.id === state.targetId);
      if (t) { curLat = t.lat; curLng = t.lng; }
    }
  }

  const candidates = state.difficulty === "county_only"
    ? getScopeCounties().filter((c) => !state.unlockedCounties.has(c.name) && c.name !== state.targetId)
    : getScopeTowns().filter((t) => !state.unlockedTowns.has(t.id) && t.id !== state.targetId);

  if (candidates.length === 0) return;

  let best = null;
  let bestScore = Infinity;

  candidates.forEach((item) => {
    const dLat = item.lat - curLat;
    const dLng = item.lng - curLng;
    const dist = Math.hypot(dLat, dLng);
    if (dist < 1e-6) return;

    let primary = 0;
    let perp = 0;
    if (dir === "N") { primary = dLat; perp = Math.abs(dLng); }
    else if (dir === "S") { primary = -dLat; perp = Math.abs(dLng); }
    else if (dir === "E") { primary = dLng; perp = Math.abs(dLat); }
    else if (dir === "W") { primary = -dLng; perp = Math.abs(dLat); }

    if (primary <= 0) return;

    const score = dist + perp * 1.35;
    if (score < bestScore) {
      bestScore = score;
      best = item;
    }
  });

  if (!best) return;

  state.hintLevel = 0;
  state.targetStationKey = null;
  state.targetId = state.difficulty === "county_only" ? best.name : best.id;
  state.lastTargetLat = best.lat;
  state.lastTargetLng = best.lng;
  updateRoadAndRailwayTileOverlays();
  updateTargetBannerUI();
  refreshAllPolygonStyles();
  if (state.roomCode && typeof broadcastP2PState === "function") broadcastP2PState();
  if (map) {
    map.panTo([best.lat, best.lng], { animate: true, duration: 0.35 });
  }
  const inp = document.getElementById("answer-input");
  if (inp) inp.focus({ preventScroll: true });
}

function handlePolygonClick(townObj) {
  if (!isTownInScope(townObj)) return;
  const vState = typeof getActiveViewState === "function" ? getActiveViewState() : state;
  if (state.role === "spectator") {
    if (vState.unlockedTowns.has(townObj.id)) {
      setFeedback(`👁️ 觀戰檢視：選手已解鎖「${townObj.fullHierarchyName}」`, "info");
    } else if (isCountyRevealed(townObj.countyName)) {
      setFeedback(`👁️ 觀戰檢視：位於「${townObj.countyName}」內之未解鎖行政區`, "info");
    } else {
      setFeedback(`👁️ 觀戰檢視：尚未解鎖此區塊`, "info");
    }
    return;
  }

  if (state.playMode === "target_click" || state.playMode === "target_random") {
    if (state.difficulty === "county_only") {
      if (state.unlockedCounties.has(townObj.countyName)) {
        setFeedback(`「${townObj.countyName}」已經解鎖囉！`, "info");
        return;
      }
      state.targetId = townObj.countyName;
    } else {
      if (state.unlockedTowns.has(townObj.id)) {
        setFeedback(`已解鎖區塊：${townObj.fullHierarchyName}`, "info");
        return;
      }
      state.targetId = townObj.id;
    }
    state.targetStationKey = null;
    state.lastTargetLat = townObj.lat;
    state.lastTargetLng = townObj.lng;
    state.hintLevel = 0;
    updateRoadAndRailwayTileOverlays();
    updateTargetBannerUI();
    refreshAllPolygonStyles();
    if (state.roomCode && typeof broadcastP2PState === "function") broadcastP2PState();
    const inp = document.getElementById("answer-input");
    if (inp) inp.focus({ preventScroll: true });
    return;
  }

  if (state.unlockedTowns.has(townObj.id)) {
    setFeedback(`📍 ${townObj.fullHierarchyName}`, "info");
  } else if (isCountyRevealed(townObj.countyName)) {
    const prefixVal =
      state.difficulty === "master_hierarchy"
        ? townObj.isSpecial
          ? townObj.countyName
          : `${townObj.province}${townObj.countyName}`
        : townObj.countyName;
    const select = document.getElementById("prefix-select");
    if (select && isPrefixRequiredMode()) {
      select.value = prefixVal;
      updateLiveCombinedPreview();
      setFeedback(`已將前綴鎖定為「${prefixVal}」，請輸入該區名稱！`, "info");
      document.getElementById("answer-input").focus({ preventScroll: true });
    }
  } else {
    setFeedback(`🔒 尚未解鎖此區塊（位於未解鎖縣市內，猜中後自動揭曉）`, "info");
  }
}

function focusMapOnLatLng(lat, lng, minZ = 10) {
  if (!map) return;
  map.flyTo([lat, lng], Math.max(map.getZoom(), minZ), { duration: 0.5 });
}

function updateTargetBannerUI() {
  const banner = document.getElementById("target-quiz-banner");
  const titleEl = document.getElementById("target-banner-title");
  const descEl = document.getElementById("target-banner-desc");
  const hintBadge = document.getElementById("target-hint-badge");
  if (!banner) return;
  const vState = typeof getActiveViewState === "function" ? getActiveViewState() : state;

  // 一般自由模式 (playMode === "free") 不顯示提示/隨機橫幅，並確保清除殘留目標鎖定
  if (state.playMode === "free") {
    state.targetId = null;
    state.targetStationKey = null;
    banner.classList.add("hidden");
    return;
  }
  banner.classList.remove("hidden");

  const isRandom = state.playMode === "target_random";
  const isClick = state.playMode === "target_click";

  // 依據模式精確區分按鈕：指定模式只保留上下左右；隨機模式顯示隨機按鈕；提示預設隱藏除非開啟 allowTargetHints；皆可退出
  const dirGroup = document.getElementById("target-dir-group");
  const nextBtn = document.getElementById("btn-target-next");
  const hintBtn = document.getElementById("btn-target-hint");
  const exitBtn = document.getElementById("btn-target-exit");

  if (dirGroup) dirGroup.classList.toggle("hidden", !isClick);
  if (nextBtn) nextBtn.classList.toggle("hidden", !isRandom);
  if (hintBtn) hintBtn.classList.toggle("hidden", !state.allowTargetHints);
  if (exitBtn) exitBtn.classList.remove("hidden");

  if (vState.targetStationKey) {
    const targetSt = getActiveQuizStations().find((s) => s.key === vState.targetStationKey);
    if (targetSt) {
      titleEl.textContent = isRandom ? "🎯 隨機抽題 · 車站目標" : "👆 指定模式 · 車站目標";
      hintBadge.textContent = targetSt.lineName;
      descEl.textContent = "請輸入高亮圓點的「車站名稱」（或點選地圖其他行政區/車站切換目標）";
      return;
    }
  }

  titleEl.textContent = isRandom ? "🎯 隨機抽題模式" : "👆 指定點選模式";

  const reqText =
    state.difficulty === "casual"
      ? "普通難度：只需輸入鄉鎮或車站名稱"
      : state.difficulty === "county_only"
      ? "縣市模式：請輸入高亮區塊所屬的縣市名稱"
      : state.difficulty === "hard_suffix"
      ? "進階後綴：請輸入正確「鄉鎮市區+後綴」（免縣市）"
      : "困難全名：請輸入完整「縣市+鄉鎮市區+後綴」";

  if (!vState.targetId) {
    hintBadge.textContent = "等待點選目標";
    descEl.textContent = isClick
      ? "請點擊地圖區塊/車站，或按右側 ←↑↓→ 鍵切換目標！"
      : "請點擊右側「🎲 隨機下個」抽取下一個目標！";
  } else {
    hintBadge.textContent = "琥珀色高亮區塊";
    descEl.textContent = reqText;
  }
}

function giveTargetHint() {
  if (!state.allowTargetHints) {
    setFeedback("🚫 本局未開啟目標提示功能（預設關閉）", "warn");
    return;
  }
  if (state.targetStationKey) {
    const st = getActiveQuizStations().find((s) => s.key === state.targetStationKey);
    if (st) {
      state.hintLevel++;
      if (state.hintLevel === 1) {
        setFeedback(`💡 車站提示 1：所屬路線為「${st.lineName}」`, "warn");
      } else {
        setFeedback(`💡 車站提示 2：隸屬「${st.lineName}」，站名首字為「${st.displayName[0]}...」`, "warn");
      }
    }
    return;
  }
  if (!state.targetId) return;
  state.hintLevel++;
  if (state.difficulty === "county_only") {
    const c = COUNTY_BY_NAME[state.targetId];
    if (c) setFeedback(`💡 提示：位於「${c.province}」，首字為「${c.name[0]}...」`, "warn");
    return;
  }
  const t = ALL_TOWNS.find((x) => x.id === state.targetId);
  if (!t) return;
  if (state.hintLevel === 1) {
    setFeedback(`💡 提示 1：此區塊位於「${t.isSpecial ? t.countyName : t.province + t.countyName}」`, "warn");
  } else {
    setFeedback(`💡 提示 2：隸屬「${t.countyName}」，鄉鎮首字為「${t.townName[0]}...」`, "warn");
  }
}
