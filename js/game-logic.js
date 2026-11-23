// =========================================================================
// 6. GAME LOGIC: SPOILER-FREE PREFIXES, SMART SUFFIX OVERRIDE & WINDOWS IME FIX
// =========================================================================
function _activePack() {
  return typeof getActiveMapPack === "function" ? getActiveMapPack() : null;
}

function _glIsTaiwanModernPack() {
  const pack = _activePack();
  return !pack || pack.id === "tw_modern";
}

function _activeItems() {
  if (typeof getActiveItems === "function") return getActiveItems();
  return typeof ALL_TOWNS !== "undefined" ? ALL_TOWNS : [];
}

function _activeGroups() {
  if (typeof getActiveGroups === "function") return getActiveGroups();
  return typeof TAIWAN_ADMIN_DATA !== "undefined" ? TAIWAN_ADMIN_DATA : [];
}

function _activeGroupByName(name) {
  if (typeof getActiveGroupByName === "function") return getActiveGroupByName(name);
  return typeof COUNTY_BY_NAME !== "undefined" ? COUNTY_BY_NAME[name] || null : null;
}

function _normInput(str) {
  if (typeof normalizeActiveInput === "function") return normalizeActiveInput(str);
  if (typeof normTw === "function") return normTw(str);
  return String(str || "").trim().toLowerCase();
}

function _activeFeatures() {
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

function _activeMapView() {
  if (typeof getActivePackMapView === "function") return getActivePackMapView();
  return {
    center: [23.75, 120.95],
    defaultZoom: 8,
    minZoom: 7,
    maxZoom: 18,
    targetFocusZoom: 10,
    groupFocusZoom: 9,
    targetMaxZoom: 12,
    satelliteFallbackDelta: { group: 0.18, item: 0.06 },
    worldCopyJump: false
  };
}

function _activeUnitLabels() {
  if (typeof getActivePackUnitLabels === "function") return getActivePackUnitLabels();
  return {
    group: "縣市",
    item: "鄉鎮市區",
    itemShort: "區",
    fullScopeLabel: "全台 368 區"
  };
}

function _isSingleLayer() {
  return typeof isActivePackSingleLayer === "function" ? isActivePackSingleLayer() : false;
}

function _aliasStr(rawAl) {
  if (!rawAl) return "";
  return typeof rawAl === "object" ? String(rawAl.name || rawAl.value || "") : String(rawAl);
}

function _getItemEffectiveAliases(item) {
  if (!item) return [];
  const pack = _activePack();
  if (pack && typeof pack.getItemAliases === "function") {
    const res = pack.getItemAliases(item, typeof state !== "undefined" ? state : null);
    if (Array.isArray(res)) return res;
  }
  return Array.isArray(item.aliases) ? item.aliases : [];
}

function _itemAliasesMatch(item, ...candidates) {
  const aliases = _getItemEffectiveAliases(item);
  if (!aliases.length) return false;
  for (let i = 0; i < aliases.length; i++) {
    const normAl = _normInput(_aliasStr(aliases[i]));
    if (!normAl) continue;
    for (let j = 0; j < candidates.length; j++) {
      if (candidates[j] && candidates[j] === normAl) return true;
    }
  }
  return false;
}

function _itemExactAliasesMatch(item, ...candidates) {
  if (!item) return false;
  if (Array.isArray(item.exactAliases)) {
    for (let i = 0; i < item.exactAliases.length; i++) {
      const normAl = _normInput(_aliasStr(item.exactAliases[i]));
      if (normAl && candidates.includes(normAl)) return true;
    }
  }
  if (Array.isArray(item.aliases) && item.aliases.length > 0) {
    for (let i = 0; i < item.aliases.length; i++) {
      const rawAl = item.aliases[i];
      if (!rawAl) continue;
      if (typeof rawAl === "object") {
        if (!rawAl.exact) continue;
        const normAl = _normInput(_aliasStr(rawAl));
        if (normAl && candidates.includes(normAl)) return true;
      } else {
        const strAl = String(rawAl);
        const normAl = _normInput(strAl);
        if (!normAl || !candidates.includes(normAl)) continue;
        if (item.suffix) {
          const normItemSuf = _normInput(item.suffix);
          if (normItemSuf && (strAl.endsWith(item.suffix) || normAl.endsWith(normItemSuf))) {
            return true;
          }
        } else {
          for (const suf of VALID_TOWN_SUFFIXES) {
            const normSuf = _normInput(suf);
            if (normSuf && (strAl.endsWith(suf) || normAl.endsWith(normSuf))) {
              return true;
            }
          }
        }
      }
    }
  }
  return false;
}

function _groupAliasesMatch(group, ...candidates) {
  if (!group || !Array.isArray(group.aliases) || group.aliases.length === 0) return false;
  for (let i = 0; i < group.aliases.length; i++) {
    const normAl = _normInput(_aliasStr(group.aliases[i]));
    if (!normAl) continue;
    for (let j = 0; j < candidates.length; j++) {
      if (candidates[j] && candidates[j] === normAl) return true;
    }
  }
  return false;
}

function getScopeTowns() {
  if (!state.regionQuizEnabled) return [];
  const pack = _activePack();
  const items =
    typeof getPackEligibleItems === "function"
      ? getPackEligibleItems(pack, state)
      : _activeItems();
  if (state.selectedTownIds instanceof Set) {
    return items.filter((t) => state.selectedTownIds.has(t.id));
  }
  return items.filter((t) => state.selectedCounties.has(t.countyName));
}

function getScopeCounties() {
  if (!state.regionQuizEnabled) return [];
  return _activeGroups().filter((c) => state.selectedCounties.has(c.name));
}

function syncScopeWithPackOptions(includeNewlyEnabledMicrostates = false) {
  const pack = _activePack();
  if (!pack || typeof pack.isItemEnabledByOptions !== "function") return;
  const eligibleItems =
    typeof getPackEligibleItems === "function" ? getPackEligibleItems(pack, state) : _activeItems();
  const eligibleSet = new Set(eligibleItems.map((it) => it.id));
  if (!(state.selectedTownIds instanceof Set)) {
    state.selectedTownIds = new Set(
      eligibleItems.filter((t) => state.selectedCounties.has(t.countyName)).map((t) => t.id)
    );
    return;
  }
  for (const id of Array.from(state.selectedTownIds)) {
    if (!eligibleSet.has(id)) state.selectedTownIds.delete(id);
  }
  if (includeNewlyEnabledMicrostates && state.selectedCounties.size > 0) {
    eligibleItems.forEach((it) => {
      if (it.isMicrostate && state.selectedCounties.has(it.countyName)) {
        state.selectedTownIds.add(it.id);
      }
    });
  }
  state.selectedCounties = new Set(
    eligibleItems.filter((t) => state.selectedTownIds.has(t.id)).map((t) => t.countyName)
  );
}

function isCountyRevealed(countyName) {
  const vState = typeof getActiveViewState === "function" ? getActiveViewState() : state;
  if (_isSingleLayer() || vState.isGameOver || state.difficulty === "casual" || state.difficulty === "hard_suffix") return true;
  if (vState.unlockedCounties.has(countyName)) return true;
  if (state.difficulty === "hard_full") {
    return _activeItems().some((t) => t.countyName === countyName && vState.unlockedTowns.has(t.id));
  }
  return false;
}

function isPrefixRequiredMode() {
  if (_isSingleLayer()) return false;
  return Boolean(
    state.regionQuizEnabled &&
    (state.difficulty === "hard_full" ||
      (state.difficulty === "master_hierarchy" && _activeFeatures().supportsMasterHierarchy))
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
  const groups = _activeGroups();
  const features = _activeFeatures();

  if (state.difficulty === "master_hierarchy" && features.supportsMasterHierarchy) {
    if (guideBar) guideBar.classList.remove("hidden");
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

    groups.forEach((c) => {
      if (!state.selectedCounties.has(c.name)) return;
      if (state.unlockedCounties.has(c.name)) {
        const fullPrefix = c.isSpecial ? c.name : `${c.province || ""}${c.name}`;
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
    if (guideBar) guideBar.classList.add("hidden");
    groups.forEach((c) => {
      if (!state.selectedCounties.has(c.name)) return;
      if (isCountyRevealed(c.name)) {
        prefixOptions.push({ val: c.name, label: c.name });
      }
    });
  } else if (state.difficulty === "county_only") {
    if (guideBar) guideBar.classList.add("hidden");
    if (features.supportsMasterHierarchy) {
      prefixOptions.push({ val: "臺灣省", label: "臺灣省" });
      prefixOptions.push({ val: "福建省", label: "福建省" });
    }
  } else {
    if (guideBar) guideBar.classList.add("hidden");
    groups.forEach((c) => {
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

let VALID_TOWN_SUFFIXES = new Set(["區", "鄉", "鎮", "市"]);
let EXACT_TOWN_NAMES_SET = new Set();
let EXACT_COUNTY_NAMES_SET = new Set();
let _EXACT_GROUP_FULL_NAMES_SET = new Set();

function rebuildActivePackLookupSets() {
  const features = _activeFeatures();
  const quickSufs =
    Array.isArray(features.quickSuffixes) && features.quickSuffixes.length > 0
      ? features.quickSuffixes
      : (_glIsTaiwanModernPack() ? ["區", "鄉", "鎮", "市"] : []);

  const nextSuffixes = new Set();
  quickSufs.forEach((suf) => {
    if (!suf) return;
    nextSuffixes.add(suf);
    const normSuf = _normInput(suf);
    if (normSuf) nextSuffixes.add(normSuf);
  });
  VALID_TOWN_SUFFIXES = nextSuffixes;

  const nextTownSet = new Set();
  _activeItems().forEach((item) => {
    if (!item) return;
    if (item.townName) {
      const n = _normInput(item.townName);
      if (n) nextTownSet.add(n);
    }
    const effAliases = _getItemEffectiveAliases(item);
    if (effAliases.length > 0) {
      effAliases.forEach((al) => {
        const n = _normInput(_aliasStr(al));
        if (n) nextTownSet.add(n);
      });
    }
  });
  EXACT_TOWN_NAMES_SET = nextTownSet;

  const nextCountySet = new Set();
  const nextGroupFullSet = new Set();
  _activeGroups().forEach((group) => {
    if (!group) return;
    if (group.name) {
      const n = _normInput(group.name);
      if (n) {
        nextCountySet.add(n);
        nextGroupFullSet.add(n);
      }
    }
    if (group.short) {
      const ns = _normInput(group.short);
      if (ns) nextCountySet.add(ns);
    }
    if (Array.isArray(group.aliases)) {
      group.aliases.forEach((al) => {
        const na = _normInput(_aliasStr(al));
        if (na) {
          nextCountySet.add(na);
          nextGroupFullSet.add(na);
        }
      });
    }
  });
  EXACT_COUNTY_NAMES_SET = nextCountySet;
  _EXACT_GROUP_FULL_NAMES_SET = nextGroupFullSet;
}

rebuildActivePackLookupSets();

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
    Object.keys(STATION_NAME_ALIASES).forEach((k) => set.add(typeof normTw === "function" ? normTw(k) : _normInput(k)));
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
  if (_isSingleLayer()) return false;
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
  const features = _activeFeatures();
  const list = [""];
  const regionSuffixes =
    features.supportsSuffixDifficulty && Array.isArray(features.quickSuffixes)
      ? features.quickSuffixes
      : [];
  if (state.regionQuizEnabled && regionSuffixes.length > 0) {
    regionSuffixes.forEach((s) => {
      if (s && !list.includes(s)) list.push(s);
    });
  }
  if (
    features.supportsTransportQuiz &&
    state.stationQuizEnabled &&
    state.quizStationLines &&
    state.quizStationLines.size > 0
  ) {
    list.push("站");
  }
  if (features.supportsPoiQuiz && typeof isPoiCategoryActive === "function") {
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

  const features = _activeFeatures();
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

  // Ensure dynamically required region suffix buttons exist in #suffix-quick-group
  const groupEl = document.getElementById("suffix-quick-group");
  const regionSuffixes =
    features.supportsSuffixDifficulty && Array.isArray(features.quickSuffixes)
      ? features.quickSuffixes
      : [];
  if (groupEl && typeof document.createElement === "function" && regionSuffixes.length > 0) {
    const existingBtns = Array.from(document.querySelectorAll(".suffix-quick-btn") || []);
    const existingVals = new Set(
      existingBtns.map((b) => (typeof b.getAttribute === "function" ? b.getAttribute("data-suffix") : ""))
    );
    const firstNonRegion = existingBtns.find((b) => {
      const tp = typeof b.getAttribute === "function" ? b.getAttribute("data-suffix-topic") : "";
      return tp && tp !== "always" && tp !== "region";
    });
    regionSuffixes.forEach((suf) => {
      if (!suf || existingVals.has(suf)) return;
      const btn = document.createElement("button");
      btn.type = "button";
      if (typeof btn.setAttribute === "function") {
        btn.setAttribute("data-suffix", suf);
        btn.setAttribute("data-suffix-topic", "region");
        btn.setAttribute("data-suffix-dynamic", "1");
      }
      btn.className = "suffix-quick-btn px-1.5 py-1 rounded-lg text-[11px] font-bold text-slate-300 hover:text-white";
      btn.textContent = suf;
      if (!groupEl._delegatedSuffixClick && typeof btn.addEventListener === "function") {
        btn.addEventListener("click", () => {
          const inp = document.getElementById("suffix-input");
          if (inp) inp.value = suf;
          updateSuffixControlsUI();
          const ans = document.getElementById("answer-input");
          if (ans && typeof ans.focus === "function") ans.focus({ preventScroll: true });
        });
      }
      if (firstNonRegion && firstNonRegion.parentNode === groupEl && typeof groupEl.insertBefore === "function") {
        groupEl.insertBefore(btn, firstNonRegion);
      } else if (typeof groupEl.appendChild === "function") {
        groupEl.appendChild(btn);
      }
      existingVals.add(suf);
    });
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
  let c = _normInput(core);
  if (!c) return "";
  const isSingleLayer = _isSingleLayer();
  const features = _activeFeatures();
  const p = isSingleLayer ? "" : _normInput(prefix);
  const s = _normInput(suffix);

  // 1. Resolve Suffix first (before prepending prefix)
  // Do not append suffix if user is typing a Province or County full name directly (e.g. 臺灣省, 花蓮縣)
  const isProvOrCountyOnly =
    !isSingleLayer &&
    ((features.supportsMasterHierarchy && (c === "臺灣省" || c === "福建省")) ||
      _EXACT_GROUP_FULL_NAMES_SET.has(c));

  if (s && !isProvOrCountyOnly && !c.endsWith(s)) {
    // Check if c (or its town part after any county prefix) is ALREADY a complete valid townName (e.g. 虎尾鎮, 花蓮市)
    let townPart = c;
    if (!isSingleLayer) {
      const groups = _activeGroups();
      for (const county of groups) {
        const cn = _normInput(county.name);
        const pn = county.province ? _normInput(county.province + county.name) : "";
        if (pn && townPart.startsWith(pn) && townPart.length > pn.length) {
          townPart = townPart.slice(pn.length);
          break;
        } else if (cn && townPart.startsWith(cn) && townPart.length > cn.length) {
          townPart = townPart.slice(cn.length);
          break;
        }
      }
    }
    const candidateTown = townPart + s;
    const supportsTransport = Boolean(features.supportsTransportQuiz);
    const supportsPoi = Boolean(features.supportsPoiQuiz);
    const normPoiCore = supportsPoi && typeof normalizePoiText === "function" ? normalizePoiText(c) : c;
    const candidatePoi = supportsPoi && typeof normalizePoiText === "function" ? normalizePoiText(c + s) : c + s;
    // Append suffix whenever (core + suffix) forms a real target (e.g. 內湖+區, 南港+區, 大湖+鄉, 內湖+站, 松山機場+站, 鯉魚潭+水庫, 澎湖+機場)
    const appendsToValidTarget =
      (VALID_TOWN_SUFFIXES.has(s) && EXACT_TOWN_NAMES_SET.has(candidateTown)) ||
      (supportsTransport && s === "站" && EXACT_STATION_BASES_SET.has(c)) ||
      (supportsPoi && EXACT_POI_SUFFIXED_KEYS_SET.has(candidatePoi));

    const isAlreadyComplete =
      EXACT_TOWN_NAMES_SET.has(townPart) ||
      (supportsTransport && c.endsWith("站")) ||
      (supportsPoi && EXACT_POI_SUFFIXED_KEYS_SET.has(normPoiCore)) ||
      (supportsPoi && /^[A-Za-z]{3,4}$/.test(c));

    if (appendsToValidTarget || !isAlreadyComplete) {
      c = c + s;
    }
  }

  // 2. Resolve Prefix without false-positive matching on county.short (so 花蓮市 / 宜蘭市 / 苗栗市 / 彰化市 / 南投市 / 屏東市 / 臺東市 / 桃園區 work!)
  if (p) {
    if (c.startsWith(p)) {
      // Already starts with exact prefix
    } else if (features.supportsMasterHierarchy && (p === "臺灣省" || p === "福建省") && !c.startsWith("臺灣省") && !c.startsWith("福建省")) {
      c = p + c;
    } else {
      // Check if c already starts with a full County Name (e.g. 花蓮縣花蓮市) or Province+County Name
      const startsWithFullCounty =
        (features.supportsMasterHierarchy && (c.startsWith("臺灣省") || c.startsWith("福建省"))) ||
        _activeGroups().some((county) => {
          const cn = _normInput(county.name);
          return cn && c.startsWith(cn);
        });

      if (!startsWithFullCounty) {
        c = p + c;
      } else if (features.supportsMasterHierarchy && p.startsWith("臺灣省") && c.startsWith(p.slice(3))) {
        // e.g. p is "臺灣省花蓮縣" and user typed "花蓮縣花蓮市" -> combine cleanly into "臺灣省花蓮縣花蓮市"
        c = "臺灣省" + c;
      } else if (features.supportsMasterHierarchy && p.startsWith("福建省") && c.startsWith(p.slice(3))) {
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

  const features = _activeFeatures();
  const isSingleLayer = _isSingleLayer();
  const isTwPack = _glIsTaiwanModernPack();
  const unitLabels = _activeUnitLabels();
  const groupLabel = unitLabels.group || "縣市";
  const itemLabel = unitLabels.item || "鄉鎮市區";

  const prefix = isPrefixRequiredMode() ? (document.getElementById("prefix-select")?.value || "") : "";
  const suffixEl = document.getElementById("suffix-input");
  const suffix = suffixEl ? suffixEl.value.trim() : "";
  const core = rawInput.trim();
  if (!core) return false;

  const combined = buildCombinedInput(prefix, core, suffix);
  const coreWithSuffix = buildCombinedInput("", core, suffix);
  const cleanCore = _normInput(core);

  if (!state.timerRunning && state.elapsedSec === 0) {
    startTimer();
  }

  if (state.playMode === "free") {
    state.targetStationKey = null;
    state.targetId = null;
    state.targetPoiId = null;
  }

  // CASE -1: POI QUIZ (Airports & Ports) — Gated by pack feature supportsPoiQuiz
  const isPoiQuizActive = Boolean(
    features.supportsPoiQuiz &&
    typeof hasAnyPoiQuizActive === "function" &&
    hasAnyPoiQuizActive()
  );
  const isStationQuizActive = Boolean(
    features.supportsTransportQuiz &&
    state.stationQuizEnabled &&
    state.quizStationLines &&
    state.quizStationLines.size > 0
  );
  const isPurePoiQuiz = isPoiQuizActive && !state.regionQuizEnabled && !isStationQuizActive;
  const isTargetingPoi = isPoiQuizActive && (state.playMode === "target_click" || state.playMode === "target_random" || state.playMode === "satellite_quiz") && Boolean(state.targetPoiId);
  const isTargetingOtherFromPoi = (state.playMode === "target_click" || state.playMode === "target_random" || state.playMode === "satellite_quiz") && Boolean(state.targetId || state.targetStationKey);
  const poiSuffixRe = /(機場|基地|航空站|桃機|松機|清泉崗|漁港|商港|工業港|天然氣港|接收港|接收站|港|碼頭|一接|二接|三接|水庫|攔河堰|人工湖|大壩|壩|湖|潭|池|埤|窟|水漾森林|天使的眼淚)$/;
  const normPoiWithSuffix = isPoiQuizActive && typeof normalizePoiText === "function" ? normalizePoiText(coreWithSuffix) : _normInput(coreWithSuffix);
  const normPoiCombined = isPoiQuizActive && typeof normalizePoiText === "function" ? normalizePoiText(combined) : _normInput(combined);
  const looksLikePoiInput = isPoiQuizActive && (
    EXACT_POI_SUFFIXED_KEYS_SET.has(normPoiWithSuffix) ||
    EXACT_POI_SUFFIXED_KEYS_SET.has(normPoiCombined) ||
    poiSuffixRe.test(coreWithSuffix) ||
    /^[A-Za-z]{3,4}$/.test(core)
  );

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
              (t) =>
                !state.unlockedTowns.has(t.id) &&
                ((t.baseName && cleanCore === _normInput(t.baseName)) ||
                  cleanCore === _normInput(t.townName) ||
                  _itemAliasesMatch(t, cleanCore))
            );
            if (bonusTowns.length > 0) {
              bonusTowns.forEach((t) => {
                state.unlockedTowns.add(t.id);
                if (t.countyName) state.unlockedCounties.add(t.countyName);
              });
              bonusText += ` ＋ 🗺️ ${bonusTowns.map((t) => t.fullCountyTown || t.townName).join("、")}`;
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
          if (state.playMode === "target_random" || state.playMode === "satellite_quiz") {
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
  const isTargetingStation = isStationQuizActive && (state.playMode === "target_click" || state.playMode === "target_random" || state.playMode === "satellite_quiz") && Boolean(state.targetStationKey);
  const looksLikeStationInput = isStationQuizActive && (core.endsWith("站") || coreWithSuffix.endsWith("站") || suffix === "站");
  const isTargetingOtherFromStation = (state.playMode === "target_click" || state.playMode === "target_random" || state.playMode === "satellite_quiz") && Boolean(state.targetId || state.targetPoiId);
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
  if (state.playMode === "target_random" || state.playMode === "target_click" || state.playMode === "satellite_quiz") {
    if (!state.targetId && !state.targetStationKey && !state.targetPoiId) {
      if (!isAutoCheck) {
        setFeedback(
          isTwPack
            ? "請先在地圖上點選一個目標區塊、車站或地標，或使用上方目標控制按鈕！"
            : `請先在地圖上點選一個目標${itemLabel}，或使用上方目標控制按鈕！`,
          "warn"
        );
      }
      return false;
    }

    if (!isSingleLayer && state.difficulty === "county_only") {
      const targetCounty = _activeGroupByName(state.targetId);
      if (!targetCounty) return false;
      const ok =
        combined === _normInput(targetCounty.name) ||
        cleanCore === _normInput(targetCounty.name) ||
        (targetCounty.short && cleanCore === _normInput(targetCounty.short)) ||
        _groupAliasesMatch(targetCounty, cleanCore, combined);
      if (ok) {
        state.unlockedCounties.add(targetCounty.name);
        state.lastTargetLat = targetCounty.lat;
        state.lastTargetLng = targetCounty.lng;
        const hitMsg = isTwPack
          ? `🎯 答對指定縣市：${targetCounty.name}！（可按方向鍵 ↑↓←→ 移至相鄰縣市或點選下一個）`
          : `🎯 答對指定${groupLabel}：${targetCounty.name}！（可按方向鍵 ↑↓←→ 移至相鄰${groupLabel}或點選下一個）`;
        onSuccessfulUnlock(hitMsg, targetCounty.name, true);
        if (state.playMode === "target_random" || state.playMode === "satellite_quiz") {
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

    const targetTown = _activeItems().find((t) => t.id === state.targetId);
    if (!targetTown) return false;

    let isMatch = false;
    if (isSingleLayer) {
      if (state.difficulty === "hard_suffix" && features.supportsSuffixDifficulty) {
        isMatch =
          combined === _normInput(targetTown.townName) ||
          cleanCore === _normInput(targetTown.townName) ||
          _itemExactAliasesMatch(targetTown, combined, cleanCore);
      } else {
        isMatch =
          (targetTown.baseName && cleanCore === _normInput(targetTown.baseName)) ||
          cleanCore === _normInput(targetTown.townName) ||
          combined === _normInput(targetTown.townName) ||
          (targetTown.baseName && combined === _normInput(targetTown.baseName)) ||
          _itemAliasesMatch(targetTown, cleanCore, combined);
      }
    } else if (state.difficulty === "casual") {
      isMatch =
        (targetTown.baseName && cleanCore === _normInput(targetTown.baseName)) ||
        cleanCore === _normInput(targetTown.townName) ||
        combined === _normInput(targetTown.townName) ||
        (targetTown.fullCountyTown && combined === _normInput(targetTown.fullCountyTown)) ||
        (targetTown.fullHierarchyName && combined === _normInput(targetTown.fullHierarchyName)) ||
        _itemAliasesMatch(targetTown, cleanCore, combined);
    } else if (state.difficulty === "hard_suffix") {
      isMatch =
        combined === _normInput(targetTown.townName) ||
        cleanCore === _normInput(targetTown.townName) ||
        (targetTown.fullCountyTown && (combined === _normInput(targetTown.fullCountyTown) || cleanCore === _normInput(targetTown.fullCountyTown))) ||
        (targetTown.fullHierarchyName && combined === _normInput(targetTown.fullHierarchyName)) ||
        _itemExactAliasesMatch(targetTown, combined, cleanCore);
    } else {
      isMatch =
        (targetTown.fullHierarchyName && (combined === _normInput(targetTown.fullHierarchyName) || cleanCore === _normInput(targetTown.fullHierarchyName))) ||
        (targetTown.fullCountyTown && (combined === _normInput(targetTown.fullCountyTown) || cleanCore === _normInput(targetTown.fullCountyTown)));
    }

    if (isMatch) {
      state.unlockedTowns.add(targetTown.id);
      if (targetTown.countyName) state.unlockedCounties.add(targetTown.countyName);
      if (!isSingleLayer && features.supportsMasterHierarchy) {
        const provKey = targetTown.isSpecial ? targetTown.countyName : targetTown.province;
        if (provKey) state.unlockedProvinces.add(provKey);
      }
      state.lastTargetLat = targetTown.lat;
      state.lastTargetLng = targetTown.lng;
      updatePrefixDropdownUI();
      const displayFull = isSingleLayer
        ? targetTown.townName
        : (targetTown.fullHierarchyName || targetTown.fullCountyTown || targetTown.townName);
      const displayShort = isSingleLayer
        ? targetTown.townName
        : (targetTown.fullCountyTown || targetTown.townName);
      onSuccessfulUnlock(`🎯 精準命中：${displayFull}！（按方向鍵 ↑↓←→ 可移至相鄰區塊，或直接點選地圖）`, displayShort, true);
      if (state.playMode === "target_random" || state.playMode === "satellite_quiz") {
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
        let reqHint;
        if (isTwPack) {
          reqHint =
            state.difficulty === "casual"
              ? "（普通難度只需輸入鄉鎮名稱）"
              : state.difficulty === "hard_suffix"
              ? "（進階後綴模式需含正確鄉/鎮/市/區後綴）"
              : "（困難全名模式需含完整縣市+鄉鎮市區全名）";
        } else {
          const sufHint = (features.quickSuffixes || []).join("/") || "正確後綴";
          reqHint =
            state.difficulty === "casual"
              ? `（普通難度只需輸入${itemLabel}名稱）`
              : state.difficulty === "hard_suffix"
              ? `（進階後綴模式需含正確${sufHint}後綴）`
              : `（困難全名模式需含完整${groupLabel}+${itemLabel}全名）`;
        }
        triggerWrongFeedback(`與指定區塊不符 ${reqHint}`);
      }
      return false;
    }
  }

  // CASE B: FREE RECALL - COUNTY ONLY MODE
  if (!isSingleLayer && state.difficulty === "county_only") {
    const matchedCounty = getScopeCounties().find(
      (c) =>
        !state.unlockedCounties.has(c.name) &&
        (combined === _normInput(c.name) ||
          cleanCore === _normInput(c.name) ||
          (c.short && cleanCore === _normInput(c.short)) ||
          (c.province && combined === _normInput(`${c.province}${c.name}`)) ||
          _groupAliasesMatch(c, cleanCore, combined))
    );
    if (matchedCounty) {
      state.unlockedCounties.add(matchedCounty.name);
      const unlockCountyMsg = isTwPack
        ? `🎉 解鎖縣市：${matchedCounty.name}（可點右側標籤直接放大定位）`
        : `🎉 解鎖${groupLabel}：${matchedCounty.name}（可點右側標籤直接放大定位）`;
      onSuccessfulUnlock(unlockCountyMsg, matchedCounty.name, true);
      return true;
    }
    if (!isAutoCheck) {
      triggerWrongFeedback(
        isTwPack ? `找不到未解鎖的縣市「${combined}」` : `找不到未解鎖的${groupLabel}「${combined}」`
      );
    }
    return false;
  }

  // CASE C: FREE RECALL - MASTER HIERARCHY MODE (gated on supportsMasterHierarchy & hierarchyDepth >= 2)
  if (!isSingleLayer && features.supportsMasterHierarchy && state.difficulty === "master_hierarchy") {
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
      (c) =>
        c.isSpecial &&
        (cleanCore === _normInput(c.name) || combined === _normInput(c.name) || _groupAliasesMatch(c, cleanCore, combined))
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
        (combined === _normInput(`${c.province}${c.name}`) ||
          (state.unlockedProvinces.has(c.province) && (cleanCore === _normInput(c.name) || _groupAliasesMatch(c, cleanCore))))
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
        _normInput(t.fullHierarchyName) === combined ||
        (state.unlockedCounties.has(t.countyName) &&
          _normInput(t.fullCountyTown) === combined)
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

  // CASE D1: FREE RECALL - HARD SUFFIX MODE (較簡單的困難：免縣市前綴，僅需正確鄉鎮市區+後綴，如「信義區」、「虎尾鎮」或「東京都」)
  if (state.difficulty === "hard_suffix" && features.supportsSuffixDifficulty) {
    const normPrefix = isSingleLayer ? "" : _normInput(prefix);
    const matched = getScopeTowns().filter((t) => {
      if (state.unlockedTowns.has(t.id)) return false;
      if (isSingleLayer) {
        return (
          combined === _normInput(t.townName) ||
          cleanCore === _normInput(t.townName) ||
          _itemExactAliasesMatch(t, combined, cleanCore)
        );
      }
      // If user explicitly selected a county prefix in dropdown and didn't type a different full county name, scope to that county
      if (normPrefix && combined === _normInput(`${normPrefix}${t.townName}`)) {
        return _normInput(t.countyName) === normPrefix;
      }
      return (
        (t.fullCountyTown && combined === _normInput(t.fullCountyTown)) ||
        (t.fullHierarchyName && combined === _normInput(t.fullHierarchyName)) ||
        (t.fullCountyTown && cleanCore === _normInput(t.fullCountyTown)) ||
        combined === _normInput(t.townName) ||
        (!normPrefix && cleanCore === _normInput(t.townName)) ||
        (!normPrefix && _itemExactAliasesMatch(t, combined, cleanCore))
      );
    });
    if (matched.length > 0) {
      matched.forEach((t) => {
        state.unlockedTowns.add(t.id);
        if (t.countyName) state.unlockedCounties.add(t.countyName);
      });
      updatePrefixDropdownUI();
      const fmtItem = (m) => (isSingleLayer ? m.townName : (m.fullCountyTown || m.townName));
      const labelStr =
        matched.length > 1
          ? `一次解鎖 ${matched.length} 個同名${isTwPack ? "行政區" : itemLabel}：${matched.map(fmtItem).join("、")}`
          : `解鎖：${fmtItem(matched[0])}`;
      onSuccessfulUnlock(labelStr, fmtItem(matched[0]), false);
      return true;
    }
    if (isStationQuizActive && tryMatchAndUnlockStation(core, combined, isAutoCheck)) {
      return true;
    }
    if (isStationQuizActive && state._lastStationLockedCounty) {
      if (!isAutoCheck) {
        triggerWrongFeedback("🔒 縣市未解鎖：困難模式下，須先解鎖所屬縣市才能猜此車站！");
      }
      return false;
    }
    if (!isAutoCheck) {
      if (isTwPack) {
        triggerWrongFeedback(`找不到或後綴不符：「${combined}」（進階後綴模式需含正確鄉/鎮/市/區後綴，或輸入車站名稱）`);
      } else {
        const sufHint = (features.quickSuffixes || []).join("/") || "正確後綴";
        triggerWrongFeedback(`找不到或後綴不符：「${combined}」（進階後綴模式需含正確${sufHint}後綴）`);
      }
    }
    return false;
  }

  // CASE D2: FREE RECALL - STRICT HARD FULL NAME MODE (嚴格困難：必須包含「縣市＋鄉鎮市區＋後綴」，無前綴只打「信義區」絕不匹配、絕不跨縣市偷渡解鎖！)
  if (!isSingleLayer && state.difficulty === "hard_full") {
    // Allow typing a County Name (e.g. 臺北市, 基隆市, 雲林縣) to unlock & switch the prefix dropdown
    const directCounty = getScopeCounties().find(
      (c) =>
        cleanCore === _normInput(c.name) ||
        (!prefix && combined === _normInput(c.name)) ||
        _groupAliasesMatch(c, cleanCore, !prefix ? combined : "")
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
        setFeedback(
          isTwPack
            ? `🔓 已解鎖縣市前綴「${directCounty.name}」並自動選取！現在可直接輸入其下轄鄉鎮市區`
            : `🔓 已解鎖${groupLabel}前綴「${directCounty.name}」並自動選取！現在可直接輸入其下轄${itemLabel}`,
          "tier"
        );
        return true;
      } else if (!isAutoCheck) {
        document.getElementById("prefix-select").value = directCounty.name;
        clearCoreInput();
        updateLiveCombinedPreview();
        setFeedback(
          isTwPack ? `📍 已切換縣市前綴為「${directCounty.name}」` : `📍 已切換${groupLabel}前綴為「${directCounty.name}」`,
          "info"
        );
        return true;
      }
    }

    // Strict full County+Township match ONLY (never match bare t.townName!)
    const matched = getScopeTowns().filter(
      (t) =>
        !state.unlockedTowns.has(t.id) &&
        ((t.fullCountyTown && combined === _normInput(t.fullCountyTown)) ||
          (t.fullHierarchyName && combined === _normInput(t.fullHierarchyName)) ||
          (!prefix && t.fullCountyTown && cleanCore === _normInput(t.fullCountyTown)) ||
          (!prefix && t.fullHierarchyName && cleanCore === _normInput(t.fullHierarchyName)))
    );
    if (matched.length > 0) {
      const t = matched[0];
      const wasCountyUnlocked = state.unlockedCounties.has(t.countyName);
      state.unlockedTowns.add(t.id);
      if (t.countyName) state.unlockedCounties.add(t.countyName);
      updatePrefixDropdownUI();
      // If user typed full "臺北市信義區" while prefix was empty, auto-select "臺北市" in prefix dropdown for convenience
      const prefixSelect = document.getElementById("prefix-select");
      if (prefixSelect && !prefixSelect.value && t.countyName) {
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
        (t) => cleanCore === _normInput(t.townName) || combined === _normInput(t.townName)
      );
      if (townOnlyCandidate && !prefix) {
        triggerWrongFeedback(
          isTwPack
            ? `⚠️ 困難全名模式不可只打「${combined}」！請加上縣市全名（如：${townOnlyCandidate.fullCountyTown}）或先輸入縣市解鎖前綴（想免打縣市可改選「進階後綴模式」）`
            : `⚠️ 困難全名模式不可只打「${combined}」！請加上${groupLabel}全名（如：${townOnlyCandidate.fullCountyTown}）或先輸入${groupLabel}解鎖前綴`
        );
      } else {
        triggerWrongFeedback(
          isTwPack
            ? `找不到或未含完整縣市+鄉鎮市區後綴：「${combined}」`
            : `找不到或未含完整${groupLabel}+${itemLabel}：「${combined}」`
        );
      }
    }
    return false;
  }

  // CASE E: FREE RECALL - CASUAL / ORIGINAL MODE
  const matchedCasual = getScopeTowns().filter((t) => {
    if (state.unlockedTowns.has(t.id)) return false;
    if (isSingleLayer) {
      return (
        cleanCore === _normInput(t.townName) ||
        (t.baseName && cleanCore === _normInput(t.baseName)) ||
        combined === _normInput(t.townName) ||
        (t.baseName && combined === _normInput(t.baseName)) ||
        _itemAliasesMatch(t, cleanCore, combined)
      );
    }
    const cShortTown = t.countyShort ? _normInput(`${t.countyShort}${t.townName}`) : "";
    const cShortBase = t.countyShort && t.baseName ? _normInput(`${t.countyShort}${t.baseName}`) : "";
    return (
      cleanCore === _normInput(t.townName) ||
      (t.baseName && cleanCore === _normInput(t.baseName)) ||
      combined === _normInput(t.townName) ||
      (t.baseName && combined === _normInput(t.baseName)) ||
      (t.fullCountyTown && combined === _normInput(t.fullCountyTown)) ||
      (t.fullCountyTown && cleanCore === _normInput(t.fullCountyTown)) ||
      (cShortTown && cleanCore === cShortTown) ||
      (cShortBase && cleanCore === cShortBase) ||
      _itemAliasesMatch(t, cleanCore, combined)
    );
  });

  if (matchedCasual.length > 0) {
    matchedCasual.forEach((t) => {
      state.unlockedTowns.add(t.id);
      if (t.countyName) state.unlockedCounties.add(t.countyName);
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
    const fmtItem = (m) => (isSingleLayer ? m.townName : (m.fullCountyTown || m.townName));
    const labelStr =
      matchedCasual.length > 1
        ? `一次解鎖 ${matchedCasual.length} 個同名${isTwPack ? "行政區" : itemLabel}：${matchedCasual.map(fmtItem).join("、")}${stationBonus}`
        : `解鎖：${fmtItem(matchedCasual[0])}${stationBonus}`;
    onSuccessfulUnlock(labelStr, fmtItem(matchedCasual[0]), false);
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
// 7. TARGET REGION MODE & SATELLITE QUIZ MODE
// =========================================================================
function applySatelliteTargetViewport(pickObj) {
  if (!pickObj) return;
  if (typeof unlockMapViewportToPack === "function") {
    unlockMapViewportToPack({ restoreLayers: false });
  } else if (typeof unlockMapViewportToTaiwan === "function") {
    unlockMapViewportToTaiwan({ restoreLayers: false });
  }
  const mapView = _activeMapView();
  const fallbackDelta = mapView.satelliteFallbackDelta || { group: 0.18, item: 0.06 };
  const isGroupMode = !_isSingleLayer() && state.difficulty === "county_only";
  let targetBounds =
    pickObj.mainBounds && typeof pickObj.mainBounds.isValid === "function" && pickObj.mainBounds.isValid()
      ? pickObj.mainBounds
      : pickObj.bounds && typeof pickObj.bounds.isValid === "function" && pickObj.bounds.isValid()
      ? pickObj.bounds
      : null;

  if (!targetBounds && typeof L !== "undefined" && typeof L.latLngBounds === "function" && Number.isFinite(pickObj.lat) && Number.isFinite(pickObj.lng)) {
    const d = isGroupMode
      ? (Number.isFinite(fallbackDelta.group) ? fallbackDelta.group : 0.18)
      : (Number.isFinite(fallbackDelta.item) ? fallbackDelta.item : 0.06);
    targetBounds = L.latLngBounds([pickObj.lat - d, pickObj.lng - d], [pickObj.lat + d, pickObj.lng + d]);
  }

  const framedBounds =
    targetBounds && typeof targetBounds.pad === "function"
      ? targetBounds.pad(0.18)
      : targetBounds;
  const targetMaxZoom = Number.isFinite(mapView.targetMaxZoom) ? mapView.targetMaxZoom : 12;
  const groupFocusZoom = Number.isFinite(mapView.groupFocusZoom) ? mapView.groupFocusZoom : 9;
  const targetFocusZoom = Number.isFinite(mapView.targetFocusZoom) ? mapView.targetFocusZoom : 10;
  const maxFitZoom = isGroupMode
    ? Math.min(targetMaxZoom, Math.max(groupFocusZoom + 1, targetFocusZoom))
    : targetMaxZoom;
  if (map && framedBounds && typeof map.fitBounds === "function") {
    map.fitBounds(framedBounds, { padding: [32, 32], maxZoom: maxFitZoom, animate: false });
  } else if (Number.isFinite(pickObj.lat) && Number.isFinite(pickObj.lng)) {
    focusMapOnLatLng(pickObj.lat, pickObj.lng, isGroupMode ? groupFocusZoom : targetFocusZoom);
  }

  if (state.satelliteLockViewport && targetBounds && typeof lockMapViewportToBounds === "function") {
    lockMapViewportToBounds(targetBounds, { maxFitZoom });
  }
  if (typeof updateSatelliteTargetMarker === "function") {
    updateSatelliteTargetMarker(pickObj);
  }
}

function ensureSatelliteQuizEnvironment() {
  if (state.playMode !== "satellite_quiz") return;
  if (state.satelliteSavedBaseLayer === null) {
    const curLayer = state.mapLayer || "vector";
    state.satelliteSavedBaseLayer =
      curLayer === "satellite_night" || curLayer === "satellite_hybrid" ? "vector" : curLayer;
  }
  if (state.satelliteSavedDistrictBorders === null) {
    state.satelliteSavedDistrictBorders = Boolean(state.showDistrictBorders);
  }
  if (typeof window.setDistrictBordersVisible === "function") {
    window.setDistrictBordersVisible(false, true);
  } else {
    state.showDistrictBorders = false;
  }
  if (typeof countyBorderLayerGroup !== "undefined" && countyBorderLayerGroup && map && map.hasLayer(countyBorderLayerGroup)) {
    map.removeLayer(countyBorderLayerGroup);
  }
  state.satelliteActiveQuestionStyle =
    typeof resolveSatelliteQuestionStyle === "function"
      ? resolveSatelliteQuestionStyle(state.difficulty, state.satelliteStyle)
      : state.satelliteStyle === "night"
      ? "night"
      : "day";
  const targetLayer = state.satelliteActiveQuestionStyle === "night" ? "satellite_night" : "satellite";
  if (typeof setMapBaseLayer === "function") {
    setMapBaseLayer(targetLayer, true);
  } else {
    state.mapLayer = targetLayer;
  }
}

function pickNextTargetRegion() {
  state.hintLevel = 0;
  state.satelliteOutlineRevealed = false;
  const isSatellite = state.playMode === "satellite_quiz";
  if (isSatellite) {
    ensureSatelliteQuizEnvironment();
  }

  const features = _activeFeatures();
  const mapView = _activeMapView();
  const targetFocusZoom = Number.isFinite(mapView.targetFocusZoom) ? mapView.targetFocusZoom : 10;
  const groupFocusZoom = Number.isFinite(mapView.groupFocusZoom) ? mapView.groupFocusZoom : 9;
  const targetMaxZoom = Number.isFinite(mapView.targetMaxZoom) ? mapView.targetMaxZoom : 12;
  const isGroupMode = !_isSingleLayer() && state.difficulty === "county_only";

  const remainingStations =
    features.supportsTransportQuiz && typeof getActiveQuizStations === "function"
      ? getActiveQuizStations().filter((s) => !state.unlockedStations.has(s.key))
      : [];
  const remainingPois =
    features.supportsPoiQuiz && typeof getActiveQuizPois === "function"
      ? getActiveQuizPois().filter((p) => !state.unlockedPois.has(p.id))
      : [];
  const scopeTowns = getScopeTowns();
  const regionDone =
    scopeTowns.length === 0 ||
    (isGroupMode
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
    if (isSatellite) {
      applySatelliteTargetViewport(pickPoi);
    } else {
      focusMapOnLatLng(pickPoi.lat, pickPoi.lng, targetFocusZoom);
    }
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
    if (isSatellite) {
      applySatelliteTargetViewport(pickSt);
    } else {
      focusMapOnLatLng(pickSt.lat, pickSt.lng, targetMaxZoom);
    }
    updateRoadAndRailwayTileOverlays();
    if (typeof refreshPoiMapLayer === "function") refreshPoiMapLayer();
    updateTargetBannerUI();
    refreshAllPolygonStyles();
    if (state.roomCode && typeof broadcastP2PState === "function") broadcastP2PState();
    return;
  }

  state.targetStationKey = null;
  state.targetPoiId = null;
  if (isGroupMode) {
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
    if (isSatellite) {
      applySatelliteTargetViewport(pick);
    } else {
      focusMapOnLatLng(pick.lat, pick.lng, groupFocusZoom);
    }
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
    if (isSatellite) {
      applySatelliteTargetViewport(pick);
    } else {
      focusMapOnLatLng(pick.lat, pick.lng, targetFocusZoom);
    }
  }
  updateTargetBannerUI();
  refreshAllPolygonStyles();
  if (state.roomCode && typeof broadcastP2PState === "function") broadcastP2PState();
}

// Exit target/random/satellite mode back to normal free recall mode
function exitTargetQuizMode() {
  if (state.playMode === "pin_drop" && typeof restorePinDropEnvironment === "function") {
    restorePinDropEnvironment();
  }
  state.targetId = null;
  state.targetStationKey = null;
  state.targetPoiId = null;
  state.hintLevel = 0;
  state.satelliteOutlineRevealed = false;
  if (typeof clearSatelliteTargetMarker === "function") {
    clearSatelliteTargetMarker();
  }
  if (typeof unlockMapViewportToPack === "function") {
    unlockMapViewportToPack({ restoreLayers: true, clearMarker: true });
  } else if (typeof unlockMapViewportToTaiwan === "function") {
    unlockMapViewportToTaiwan({ restoreLayers: true, clearMarker: true });
  }
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
  if (state.playMode === "free" || state.playMode === "satellite_quiz") {
    return;
  }
  const features = _activeFeatures();
  const mapView = _activeMapView();
  const wrapLng = Boolean(mapView.worldCopyJump);
  const normalizeDLng = (rawDLng) => {
    if (!wrapLng) return rawDLng;
    let d = rawDLng;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    return d;
  };

  let curLat = state.lastTargetLat;
  let curLng = state.lastTargetLng;

  const isPureStationMode = features.supportsTransportQuiz && getScopeTowns().length === 0 && getScopeCounties().length === 0;
  const moveStation = Boolean(features.supportsTransportQuiz && (state.targetStationKey || isPureStationMode));

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
      const dLng = normalizeDLng(item.lng - curLng);
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

  const isGroupMode = !_isSingleLayer() && state.difficulty === "county_only";
  if (state.targetId) {
    if (isGroupMode) {
      const c = _activeGroupByName(state.targetId);
      if (c) { curLat = c.lat; curLng = c.lng; }
    } else {
      const t = _activeItems().find((x) => x.id === state.targetId);
      if (t) { curLat = t.lat; curLng = t.lng; }
    }
  }

  const candidates = isGroupMode
    ? getScopeCounties().filter((c) => !state.unlockedCounties.has(c.name) && c.name !== state.targetId)
    : getScopeTowns().filter((t) => !state.unlockedTowns.has(t.id) && t.id !== state.targetId);

  if (candidates.length === 0) return;

  let best = null;
  let bestScore = Infinity;

  candidates.forEach((item) => {
    const dLat = item.lat - curLat;
    const dLng = normalizeDLng(item.lng - curLng);
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
  state.targetId = isGroupMode ? best.name : best.id;
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

function handlePolygonClick(townObj, ev) {
  if (state.playMode === "pin_drop") {
    if (typeof handlePinDropMapClick === "function") {
      const ll =
        (ev && ev.latlng) ||
        (townObj && townObj.mainPoint) ||
        (townObj ? { lat: townObj.lat, lng: townObj.lng } : null);
      if (ll) handlePinDropMapClick(ll);
    }
    return;
  }
  if (!isTownInScope(townObj)) return;
  const vState = typeof getActiveViewState === "function" ? getActiveViewState() : state;
  const isSingleLayer = _isSingleLayer();
  const isTwPack = _glIsTaiwanModernPack();
  const unitLabels = _activeUnitLabels();
  const groupLabel = unitLabels.group || "縣市";
  const itemLabel = unitLabels.item || "行政區";
  const displayFull = isSingleLayer
    ? townObj.townName
    : (townObj.fullHierarchyName || townObj.fullCountyTown || townObj.townName);

  if (state.role === "spectator") {
    if (vState.unlockedTowns.has(townObj.id)) {
      setFeedback(`👁️ 觀戰檢視：選手已解鎖「${displayFull}」`, "info");
    } else if (!isSingleLayer && isCountyRevealed(townObj.countyName)) {
      setFeedback(`👁️ 觀戰檢視：位於「${townObj.countyName}」內之未解鎖${isTwPack ? "行政區" : itemLabel}`, "info");
    } else {
      setFeedback(`👁️ 觀戰檢視：尚未解鎖此區塊`, "info");
    }
    return;
  }

  if (state.playMode === "satellite_quiz") {
    if (state.unlockedTowns.has(townObj.id)) {
      setFeedback(`📍 已解鎖：${displayFull}`, "info");
    } else {
      setFeedback("🛰️ 衛星影像猜題模式中，請觀察當前鎖定視野作答（或點擊上方「👁️ 顯示輪廓」提示）！", "info");
    }
    return;
  }

  if (state.playMode === "target_click" || state.playMode === "target_random") {
    if (!isSingleLayer && state.difficulty === "county_only") {
      if (state.unlockedCounties.has(townObj.countyName)) {
        setFeedback(`「${townObj.countyName}」已經解鎖囉！`, "info");
        return;
      }
      state.targetId = townObj.countyName;
    } else {
      if (state.unlockedTowns.has(townObj.id)) {
        setFeedback(`已解鎖區塊：${displayFull}`, "info");
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
    setFeedback(`📍 ${displayFull}`, "info");
  } else if (isCountyRevealed(townObj.countyName)) {
    const prefixVal =
      state.difficulty === "master_hierarchy"
        ? townObj.isSpecial
          ? townObj.countyName
          : `${townObj.province || ""}${townObj.countyName}`
        : townObj.countyName;
    const select = document.getElementById("prefix-select");
    if (select && isPrefixRequiredMode()) {
      select.value = prefixVal;
      updateLiveCombinedPreview();
      setFeedback(`已將前綴鎖定為「${prefixVal}」，請輸入該區名稱！`, "info");
      document.getElementById("answer-input").focus({ preventScroll: true });
    }
  } else {
    setFeedback(
      isTwPack
        ? "🔒 尚未解鎖此區塊（位於未解鎖縣市內，猜中後自動揭曉）"
        : `🔒 尚未解鎖此區塊（位於未解鎖${groupLabel}內，猜中後自動揭曉）`,
      "info"
    );
  }
}

function focusMapOnLatLng(lat, lng, minZ) {
  if (!map) return;
  const mapView = _activeMapView();
  const resolvedMinZ = Number.isFinite(minZ)
    ? minZ
    : (Number.isFinite(mapView.targetFocusZoom) ? mapView.targetFocusZoom : 10);
  map.flyTo([lat, lng], Math.max(map.getZoom(), resolvedMinZ), { duration: 0.5 });
}

function updateTargetBannerUI() {
  if (state.playMode === "pin_drop") {
    if (typeof updatePinDropBannerAndDockUI === "function") {
      updatePinDropBannerAndDockUI();
    }
    return;
  }
  if (typeof updatePinDropBannerAndDockUI === "function") {
    updatePinDropBannerAndDockUI();
  }
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

  const isSatellite = state.playMode === "satellite_quiz";
  const isRandom = state.playMode === "target_random" || isSatellite;
  const isClick = state.playMode === "target_click";
  const isTwPack = _glIsTaiwanModernPack();
  const isSingleLayer = _isSingleLayer();
  const features = _activeFeatures();
  const unitLabels = _activeUnitLabels();
  const groupLabel = unitLabels.group || "縣市";
  const itemLabel = unitLabels.item || "鄉鎮市區";

  // 依據模式精確區分按鈕：指定模式只保留上下左右；隨機/衛星模式顯示隨機按鈕；衛星模式顯示顯示輪廓與提示；皆可退出
  const dirGroup = document.getElementById("target-dir-group");
  const nextBtn = document.getElementById("btn-target-next");
  const hintBtn = document.getElementById("btn-target-hint");
  const revealBtn = document.getElementById("btn-target-reveal-outline");
  const exitBtn = document.getElementById("btn-target-exit");

  if (dirGroup) dirGroup.classList.toggle("hidden", !isClick);
  if (nextBtn) nextBtn.classList.toggle("hidden", !isRandom);
  if (hintBtn) hintBtn.classList.toggle("hidden", !(state.allowTargetHints || isSatellite));
  if (revealBtn) {
    revealBtn.classList.toggle("hidden", !isSatellite);
    if (isSatellite) {
      revealBtn.textContent = state.satelliteOutlineRevealed ? "👁️ 已顯示輪廓" : "👁️ 顯示輪廓";
      revealBtn.className = state.satelliteOutlineRevealed
        ? "px-2 py-1 rounded-lg bg-amber-500/25 text-[11px] font-bold text-amber-200 border border-amber-400/60 transition whitespace-nowrap"
        : "px-2 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/35 text-[11px] font-bold text-sky-200 border border-sky-400/50 transition whitespace-nowrap";
    }
  }
  if (exitBtn) exitBtn.classList.remove("hidden");

  if (features.supportsTransportQuiz && vState.targetStationKey) {
    const targetSt = getActiveQuizStations().find((s) => s.key === vState.targetStationKey);
    if (targetSt) {
      titleEl.textContent = isSatellite ? "🛰️ 衛星影像 · 車站目標" : isRandom ? "🎯 隨機抽題 · 車站目標" : "👆 指定模式 · 車站目標";
      hintBadge.textContent = targetSt.lineName;
      descEl.textContent = "請輸入高亮圓點的「車站名稱」（或點選地圖其他行政區/車站切換目標）";
      return;
    }
  }

  if (isSatellite) {
    const styleLabel = state.satelliteActiveQuestionStyle === "night" ? "🌙 夜間燈火" : "☀️ 日間衛星";
    titleEl.textContent = `🛰️ 衛星影像猜題 · ${styleLabel}`;
  } else {
    titleEl.textContent = isRandom ? "🎯 隨機抽題模式" : "👆 指定點選模式";
  }

  let reqText;
  if (isTwPack) {
    reqText =
      state.difficulty === "casual"
        ? "普通難度：只需輸入鄉鎮或車站名稱"
        : state.difficulty === "county_only"
        ? (isSatellite ? "縣市模式：觀察衛星地貌與燈火，輸入視野中心所屬縣市名稱" : "縣市模式：請輸入高亮區塊所屬的縣市名稱")
        : state.difficulty === "hard_suffix"
        ? "進階後綴：請輸入正確「鄉鎮市區+後綴」（免縣市）"
        : "困難全名：請輸入完整「縣市+鄉鎮市區+後綴」";
  } else {
    const sufHint = (features.quickSuffixes || []).join("/") || "後綴";
    reqText =
      state.difficulty === "casual"
        ? `普通難度：只需輸入${itemLabel}名稱`
        : !isSingleLayer && state.difficulty === "county_only"
        ? (isSatellite ? `${groupLabel}模式：觀察衛星地貌與燈火，輸入視野中心所屬${groupLabel}名稱` : `${groupLabel}模式：請輸入高亮區塊所屬的${groupLabel}名稱`)
        : state.difficulty === "hard_suffix"
        ? `進階後綴：請輸入正確「${itemLabel}+${sufHint}」`
        : `困難全名：請輸入完整「${groupLabel}+${itemLabel}」`;
  }

  if (!vState.targetId) {
    hintBadge.textContent = "等待點選目標";
    descEl.textContent = isClick
      ? (isTwPack ? "請點擊地圖區塊/車站，或按右側 ←↑↓→ 鍵切換目標！" : `請點擊地圖${itemLabel}，或按右側 ←↑↓→ 鍵切換目標！`)
      : "請點擊右側「🎲 隨機下個」抽取下一個目標！";
  } else if (isSatellite) {
    hintBadge.textContent = state.satelliteOutlineRevealed
      ? "👁️ 已顯示輪廓"
      : state.satelliteViewportLocked
      ? "🔒 視野已鎖定"
      : "🛰️ 衛星盲猜中";
    descEl.textContent = reqText;
  } else {
    hintBadge.textContent = "琥珀色高亮區塊";
    descEl.textContent = reqText;
  }
}

function giveTargetHint() {
  const isTwPack = _glIsTaiwanModernPack();
  const isSingleLayer = _isSingleLayer();
  const features = _activeFeatures();
  const unitLabels = _activeUnitLabels();
  const groupLabel = unitLabels.group || "縣市";
  const itemLabel = unitLabels.item || "行政區";

  if (state.playMode === "satellite_quiz") {
    if (!state.targetId && !state.targetStationKey && !state.targetPoiId) return;
    state.hintLevel++;
    state.satelliteOutlineRevealed = true;
    refreshAllPolygonStyles();
    updateTargetBannerUI();
    if (state.hintLevel === 1) {
      setFeedback(
        isTwPack
          ? "💡 衛星提示 1：已於地圖上顯示目標行政區輪廓邊界！"
          : `💡 衛星提示 1：已於地圖上顯示目標${itemLabel}輪廓邊界！`,
        "warn"
      );
      return;
    }
    if (features.supportsTransportQuiz && state.targetStationKey) {
      const st = getActiveQuizStations().find((s) => s.key === state.targetStationKey);
      if (st) {
        if (state.hintLevel === 2) {
          setFeedback(`💡 衛星提示 2：所屬路線為「${st.lineName}」（${st.countyName || ""}）`, "warn");
        } else {
          setFeedback(`💡 衛星提示 3：隸屬「${st.lineName}」，站名首字為「${st.displayName[0]}...」`, "warn");
        }
      }
      return;
    }
    if (features.supportsPoiQuiz && state.targetPoiId && typeof TAIWAN_POI_BY_ID !== "undefined") {
      const p = TAIWAN_POI_BY_ID.get(state.targetPoiId);
      if (p) {
        if (state.hintLevel === 2) {
          setFeedback(`💡 衛星提示 2：此地標位於「${p.countyName || ""}${p.townName || ""}」`, "warn");
        } else {
          setFeedback(`💡 衛星提示 3：位於「${p.countyName || ""}」，地標首字為「${(p.shortName || p.name)[0]}...」`, "warn");
        }
      }
      return;
    }
    if (!isSingleLayer && state.difficulty === "county_only") {
      const c = _activeGroupByName(state.targetId);
      if (c) {
        setFeedback(
          isTwPack
            ? `💡 衛星提示 2：位於「${c.province}」，縣市首字為「${c.name[0]}...」`
            : c.province
            ? `💡 衛星提示 2：位於「${c.province}」，${groupLabel}首字為「${c.name[0]}...」`
            : `💡 衛星提示 2：${groupLabel}首字為「${c.name[0]}...」`,
          "warn"
        );
      }
      return;
    }
    const t = _activeItems().find((x) => x.id === state.targetId);
    if (!t) return;
    if (isSingleLayer) {
      if (state.hintLevel === 2) {
        setFeedback(
          t.countyName
            ? `💡 衛星提示 2：此${itemLabel}位於「${t.countyName}」`
            : `💡 衛星提示 2：${itemLabel}首字為「${t.townName[0]}...」`,
          "warn"
        );
      } else {
        setFeedback(
          t.countyName
            ? `💡 衛星提示 3：隸屬「${t.countyName}」，${itemLabel}首字為「${t.townName[0]}...」`
            : `💡 衛星提示 3：${itemLabel}首字為「${t.townName[0]}...」`,
          "warn"
        );
      }
    } else if (state.hintLevel === 2) {
      const locName = t.isSpecial || !t.province ? t.countyName : t.province + t.countyName;
      setFeedback(`💡 衛星提示 2：此區塊位於「${locName}」`, "warn");
    } else {
      setFeedback(
        isTwPack
          ? `💡 衛星提示 3：隸屬「${t.countyName}」，鄉鎮首字為「${t.townName[0]}...」`
          : `💡 衛星提示 3：隸屬「${t.countyName}」，${itemLabel}首字為「${t.townName[0]}...」`,
        "warn"
      );
    }
    return;
  }
  if (!state.allowTargetHints) {
    setFeedback("🚫 本局未開啟目標提示功能（預設關閉）", "warn");
    return;
  }
  if (features.supportsTransportQuiz && state.targetStationKey) {
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
  if (!isSingleLayer && state.difficulty === "county_only") {
    const c = _activeGroupByName(state.targetId);
    if (c) {
      setFeedback(
        isTwPack
          ? `💡 提示：位於「${c.province}」，首字為「${c.name[0]}...」`
          : c.province
          ? `💡 提示：位於「${c.province}」，首字為「${c.name[0]}...」`
          : `💡 提示：${groupLabel}首字為「${c.name[0]}...」`,
        "warn"
      );
    }
    return;
  }
  const t = _activeItems().find((x) => x.id === state.targetId);
  if (!t) return;
  if (isSingleLayer) {
    if (state.hintLevel === 1) {
      setFeedback(
        t.countyName
          ? `💡 提示 1：此${itemLabel}位於「${t.countyName}」`
          : `💡 提示 1：${itemLabel}首字為「${t.townName[0]}...」`,
        "warn"
      );
    } else {
      setFeedback(
        t.countyName
          ? `💡 提示 2：隸屬「${t.countyName}」，${itemLabel}首字為「${t.townName[0]}...」`
          : `💡 提示 2：${itemLabel}首字為「${t.townName[0]}...」`,
        "warn"
      );
    }
  } else if (state.hintLevel === 1) {
    const locName = t.isSpecial || !t.province ? t.countyName : t.province + t.countyName;
    setFeedback(`💡 提示 1：此區塊位於「${locName}」`, "warn");
  } else {
    setFeedback(
      isTwPack
        ? `💡 提示 2：隸屬「${t.countyName}」，鄉鎮首字為「${t.townName[0]}...」`
        : `💡 提示 2：隸屬「${t.countyName}」，${itemLabel}首字為「${t.townName[0]}...」`,
      "warn"
    );
  }
}

function revealSatelliteOutline() {
  if (state.playMode !== "satellite_quiz") return;
  const isTwPack = _glIsTaiwanModernPack();
  const itemLabel = _activeUnitLabels().item || "行政區";
  if (state.hintLevel < 1) {
    giveTargetHint();
  } else {
    state.satelliteOutlineRevealed = true;
    refreshAllPolygonStyles();
    updateTargetBannerUI();
    setFeedback(
      isTwPack
        ? "💡 衛星提示 1：已於地圖上顯示目標行政區輪廓邊界！"
        : `💡 衛星提示 1：已於地圖上顯示目標${itemLabel}輪廓邊界！`,
      "warn"
    );
  }
}
