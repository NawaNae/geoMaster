// ================================================================
// 2. APPLICATION STATE (With Device ID Session, Spectator View & IME Flags)
// ================================================================
function computeHardwareFingerprint() {
  const parts = [
    navigator.userAgent || "",
    navigator.language || "",
    `${screen.width || 0}x${screen.height || 0}x${screen.colorDepth || 0}`,
    String(navigator.hardwareConcurrency || ""),
    String(navigator.deviceMemory || ""),
    (Intl && Intl.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone : "") || ""
  ];
  try {
    const cvs = document.createElement("canvas");
    cvs.width = 120;
    cvs.height = 32;
    const gl = cvs.getContext("webgl") || cvs.getContext("experimental-webgl");
    if (gl) {
      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      if (dbg) {
        parts.push(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || "");
        parts.push(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || "");
      }
    } else {
      const ctx = cvs.getContext("2d");
      if (ctx) {
        ctx.textBaseline = "top";
        ctx.font = "13px sans-serif";
        ctx.fillStyle = "#0ea5e9";
        ctx.fillRect(4, 2, 54, 18);
        ctx.fillStyle = "#f8fafc";
        ctx.fillText("TW-GeoMaster", 6, 8);
        parts.push(cvs.toDataURL().slice(-48));
      }
    }
  } catch (_) {}

  let h = 0x811c9dc5;
  const raw = parts.join("|");
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function getOrCreateStableDeviceId() {
  try {
    const params = new URLSearchParams(window.location.search);
    const devOverride = params.get("dev_id") || params.get("device");
    if (devOverride && devOverride.trim()) {
      return "dev_" + devOverride.trim().replace(/[^a-zA-Z0-9_-]/g, "");
    }
  } catch (_) {}

  const fp = computeHardwareFingerprint();
  let uuid = "";
  try {
    uuid = localStorage.getItem("tw_geomaster_device_uuid") || "";
    if (!uuid) {
      uuid =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID().replace(/-/g, "").slice(0, 10)
          : Math.random().toString(36).slice(2, 10);
      localStorage.setItem("tw_geomaster_device_uuid", uuid);
    }
  } catch (_) {
    uuid = fp;
  }
  return `dev_${fp}_${uuid}`;
}

const STABLE_DEVICE_ID = getOrCreateStableDeviceId();

function getOrCreateTabInstanceId(baseDeviceId) {
  try {
    let tabId = sessionStorage.getItem("tw_geomaster_tab_instance_id") || "";
    if (!tabId) {
      tabId = baseDeviceId + "_" + Math.random().toString(36).slice(2, 6);
      sessionStorage.setItem("tw_geomaster_tab_instance_id", tabId);
    }
    return tabId;
  } catch (_) {
    return baseDeviceId;
  }
}

const TAB_INSTANCE_ID = getOrCreateTabInstanceId(STABLE_DEVICE_ID);

const state = {
  difficulty: "casual",       // 'casual' | 'county_only' | 'hard_suffix' | 'hard_full' | 'master_hierarchy'
  playMode: "free",           // 'free' | 'target_random' | 'target_click' | 'satellite_quiz'
  satelliteStyle: "day",      // 'day' | 'night' | 'hybrid'
  satelliteLockViewport: true,
  satelliteOutlineRevealed: false,
  satelliteActiveQuestionStyle: "day",
  satelliteSavedBaseLayer: null,
  satelliteSavedDistrictBorders: null,
  satelliteViewportLocked: false,
  satelliteTargetPoint: null,
  pinDropRounds: 10,          // 5 | 10 | 20 | 0 (0 = endless)
  pinDropBaseLayer: "satellite", // 'satellite' | 'terrain' | 'vector'
  pinDropLockBaseLayer: false,
  pinDropShowBorders: false,
  pinDropSavedBaseLayer: null,
  pinDropSavedDistrictBorders: null,
  pinDrop: {
    active: false,
    totalRounds: 10,
    currentRound: 0,
    phase: "idle",            // 'idle' | 'placing' | 'revealed' | 'finished'
    queue: [],
    currentTarget: null,
    guessLatLng: null,
    lastReveal: null,
    history: [],
    totalScore: 0
  },
  mapLayer: "vector",         // 'vector' | 'terrain' | 'street' | 'satellite' | 'satellite_night' | 'satellite_hybrid'
  showRailOverlay: false,     // Default OFF
  transportMode: "off",       // 'off' | 'rail_only' | 'lines_and_stations' | 'stations_only'
  showDistrictBorders: true,  // Toggleable administrative boundaries (區界開關)
  showStationNames: false,    // Hidden by default so station names don't spoil answers
  openRailLoaded: false,      // True when OpenRailwayMap tiles successfully load in browser
  hideMrtLinesOnOpenRail: false, // User toggle: hide MRT lines on openrail loaded, keep colored dots
  p2pLayerRule: "free",       // 'free' | 'locked'
  p2pForcedLayer: "vector",
  p2pRailRule: "free", // 'free' | 'ban_roads_only' | 'ban_rail' | 'force_lines' | 'force_rail_only'
  p2pBorderRule: "free", // 'free' | 'force_off'
  leaderLineMode: "smart",    // 'smart' | 'all_callout' | 'inline_only'
  // Performance & Label Display Settings (Local only, never synced in P2P)
  dragSyncMode: "realtime_raf",// 'hide_on_move' (高效能移動時隱藏) | 'realtime_raf' (即時同步跟隨)
  maxVisibleCallouts: 30,     // Max callout labels on screen
  minPolygonPixelSize: 22,    // Hide labels for polygons smaller than this when zoomed out
  perfLiteMode: true,         // Disable heavy CSS blurs by default for 60FPS
  isImeComposing: false,      // Tracks Windows Bopomofo / IME dotted-underline state!
  selectedCounties: new Set(TAIWAN_ADMIN_DATA.map((c) => c.name)),
  selectedTownIds: new Set(ALL_TOWNS.map((t) => t.id)),
  unlockedTowns: new Set(),
  unlockedCounties: new Set(),
  unlockedProvinces: new Set(),
  missedTowns: new Set(),
  unlockedStations: new Set(),
  missedStations: new Set(),
  targetStationKey: null,
  unlockedPois: new Set(),
  missedPois: new Set(),
  targetPoiId: null,
  regionQuizEnabled: true,
  stationQuizEnabled: false,
  airportQuizEnabled: false,
  portQuizEnabled: false,
  reservoirQuizEnabled: false,
  lakeQuizEnabled: false,
  settlementQuizEnabled: false,
  airportSubTypes: new Set(["intl", "domestic", "military"]),
  portSubTypes: new Set(["intl_commercial", "intl_aux", "fishery_cat1"]),
  reservoirSubTypes: new Set(["res_major"]),
  lakeSubTypes: new Set(["lake_scenic"]),
  settlementSubTypes: new Set(["signage_major"]),
  quizTargetMode: "region", // Derived legacy mode: 'region' | 'station' | 'mixed'
  settingsTab: "simple",    // 'simple' | 'advanced' (Default 'simple' per user spec)
  showRawOpenRailwayTile: false,
  showStationTerminusHints: false,
  allowTargetHints: false,         // 指定/隨機模式下預設關閉提示 (可於設定開啟或由房主禁用)
  filterStationsByRegion: false,   // 混合模式下：僅猜所選行政區域內的鐵道車站 // 軌道猜謎下預設不顯示路線頭尾端點站提示 (防劇透, 可手動開啟)
  useAlgorithmicCleanRailTile: false,
  quizStationLines: new Set(),
  isGameOver: false,
  targetId: null,
  lastTargetLat: 23.75,
  lastTargetLng: 120.95,
  hintLevel: 0,
  timerMode: "up",
  countdownTotalSec: 300,
  elapsedSec: 0,
  timerRunning: false,
  timerInterval: null,
  soundEnabled: false,
  enableLegacyStationOnlyMode: false,
  deviceId: STABLE_DEVICE_ID,
  localInstanceId: TAB_INSTANCE_ID,
  nickname: (function () {
    try {
      return localStorage.getItem("tw_geomaster_nickname") || "GeoMasterTW";
    } catch (_) {
      return "GeoMasterTW";
    }
  })(),
  hubEntryTab: "solo",        // 'solo' | 'host' | 'join'
  p2pPanelExpanded: false,    // Legacy flag kept for compatibility
  roomCode: "",
  roomPassword: "",
  roomHasPassword: false,     // Whether target room requires a password (checked on link entry)
  bannedDevices: new Set(),   // Host-side banned deviceIds for this game room
  pendingJoinRoomCode: "",    // Room code being joined via URL or client entry modal
  pendingJoinRole: "spectator",
  peer: null,
  conn: null,
  peers: new Map(),           // Host-side: senderId -> DataConnection (prevents multi-player overwrite)
  players: {},                // Roster: senderId -> { id, deviceId, name, role, isReady, finished, ... }
  bcChannel: null,
  isHost: false,
  role: "solo",               // 'solo' | 'host' | 'player' | 'spectator'
  spectatingPlayerId: null,   // Player ID currently being watched on map & sidebar
  spectatorLayerInitialized: false,
  _configToastTimer: null,    // Auto-dismiss timer for lightweight room setting change toast
  _readyJustClearedByHost: false,
  _lastBroadcastConfigJson: "",
  matchInProgress: false,
  promptedLastPlayer: false,
  isReady: false,
  finished: false,
  finalStats: null,
  stats: {
    totalAttempts: 0,
    correctAttempts: 0,
    wrongAttempts: 0,
    streak: 0,
    maxStreak: 0
  },
  opponent: {
    name: "對手",
    score: 0,
    total: 368,
    stationScore: 0,
    stationTotal: 0,
    macroProgress: {},
    lastUnlocked: "尚無動態",
    connected: false,
    isReady: false,
    finished: false,
    finalStats: null
  },
  aiRivalActive: false,
  aiRivalTimer: null
};

// Initialize default selected transport lines from data/transport-data.js
state.selectedTransportLines = new Set(TAIWAN_SELECTABLE_LINES.map((l) => l.id));

function isTargetQuizPlayMode(pm = state.playMode) {
  return pm === "target_random" || pm === "target_click" || pm === "satellite_quiz";
}

function isRandomTargetPlayMode(pm = state.playMode) {
  return pm === "target_random" || pm === "satellite_quiz";
}

// Keeps legacy state.quizTargetMode synchronized with multi-select topic toggles
function syncLegacyQuizTargetMode() {
  const hasR = Boolean(state.regionQuizEnabled);
  const hasS = Boolean(state.stationQuizEnabled && state.quizStationLines && state.quizStationLines.size > 0);
  const hasA = Boolean(state.airportQuizEnabled && state.airportSubTypes && state.airportSubTypes.size > 0);
  const hasP = Boolean(state.portQuizEnabled && state.portSubTypes && state.portSubTypes.size > 0);
  const hasRes = Boolean(state.reservoirQuizEnabled && state.reservoirSubTypes && state.reservoirSubTypes.size > 0);
  const hasLk = Boolean(state.lakeQuizEnabled && state.lakeSubTypes && state.lakeSubTypes.size > 0);
  const hasStl = Boolean(state.settlementQuizEnabled && state.settlementSubTypes && state.settlementSubTypes.size > 0);
  const activeCount = (hasR ? 1 : 0) + (hasS ? 1 : 0) + (hasA ? 1 : 0) + (hasP ? 1 : 0) + (hasRes ? 1 : 0) + (hasLk ? 1 : 0) + (hasStl ? 1 : 0);
  if (activeCount === 1 && hasR) {
    state.quizTargetMode = "region";
  } else if (activeCount === 1 && hasS) {
    state.quizTargetMode = "station";
  } else {
    state.quizTargetMode = "mixed";
  }
  return state.quizTargetMode;
}

// Returns whether local user is allowed to change game difficulty/scope/rules
// In Solo mode: true (local only, never broadcast). In Multiplayer room: ONLY Host!
function canLocalModifyGameConfig() {
  if (!state.roomCode && !state.aiRivalActive) return true;
  return Boolean(state.isHost);
}

// Returns the active view state for map polygons, stations, labels, and sidebar progress.
// When in Spectator mode (or finished & watching another player), returns that player's live map state.
function getActiveViewState() {
  const canSpectateOther =
    Boolean(state.roomCode || state.aiRivalActive) &&
    (state.role === "spectator" || state.finished) &&
    state.spectatingPlayerId &&
    state.spectatingPlayerId !== state.localInstanceId &&
    state.players &&
    state.players[state.spectatingPlayerId];

  if (!canSpectateOther) {
    return state;
  }

  const p = state.players[state.spectatingPlayerId];
  if (!p._viewSets) {
    p._viewSets = {
      unlockedTowns: new Set(Array.isArray(p.unlockedTowns) ? p.unlockedTowns : []),
      unlockedCounties: new Set(Array.isArray(p.unlockedCounties) ? p.unlockedCounties : []),
      unlockedProvinces: new Set(Array.isArray(p.unlockedProvinces) ? p.unlockedProvinces : []),
      missedTowns: new Set(Array.isArray(p.missedTowns) ? p.missedTowns : []),
      unlockedStations: new Set(Array.isArray(p.unlockedStations) ? p.unlockedStations : []),
      missedStations: new Set(Array.isArray(p.missedStations) ? p.missedStations : []),
      unlockedPois: new Set(Array.isArray(p.unlockedPois) ? p.unlockedPois : []),
      missedPois: new Set(Array.isArray(p.missedPois) ? p.missedPois : [])
    };
  }

  return {
    unlockedTowns: p._viewSets.unlockedTowns,
    unlockedCounties: p._viewSets.unlockedCounties,
    unlockedProvinces: p._viewSets.unlockedProvinces,
    missedTowns: p._viewSets.unlockedTowns && p._viewSets.missedTowns ? p._viewSets.missedTowns : new Set(),
    unlockedStations: p._viewSets.unlockedStations,
    missedStations: p._viewSets.missedStations,
    unlockedPois: p._viewSets.unlockedPois || new Set(),
    missedPois: p._viewSets.missedPois || new Set(),
    targetId: p.targetId || null,
    targetStationKey: p.targetStationKey || null,
    targetPoiId: p.targetPoiId || null,
    isGameOver: Boolean(p.finished),
    spectatingPlayer: p
  };
}

// ================================================================
// 3. WEB AUDIO SYNTHESIZER
// ================================================================
let audioCtx = null;
function playTone(type) {
  if (!state.soundEnabled) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === "unlock") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.14);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
    } else if (type === "tier") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(659.25, now + 0.08);
      osc.frequency.setValueAtTime(880, now + 0.16);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      osc.start(now);
      osc.stop(now + 0.32);
    } else if (type === "error") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(190, now);
      osc.frequency.linearRampToValueAtTime(140, now + 0.15);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.start(now);
      osc.stop(now + 0.16);
    }
  } catch (e) {}
}
