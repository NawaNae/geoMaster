# TRACK-M0：多地圖包抽象層 (`MapPack` Core Refactor)

- **Track ID**：`TRACK-M0`
- **預估難度**：★★★★☆（前置架構重構；專案實測發現 `TAIWAN_ADMIN_DATA` / `ALL_TOWNS` / `COUNTY_BY_NAME` / `normTw` / `TAIWAN_MAX_BOUNDS` 在 9 個 JS 檔案中共被直接硬編碼 **181 次**）
- **前置依賴**：無
- **解鎖軌道**：完成後即可無痛掛載 **`TRACK-D`（日本/中國）**、**`TRACK-C`（世界各國）**、以及既有 **`HANDOFF_JP1945_MAP.md`（1945 日治臺灣）**！

> **⚠️ 專案架構決策提醒（開工前請先與業主確認）**
> 本重構會動到全部核心引擎（包含 142KB `p2p-engine.js` 與 111KB `dashboard-ui.js`）。
> - **若目標是「同一個網站切換台灣 / 日治 1945 / 日本 / 中國 / 世界，且全部共用 P2P 對戰＋衛星＋標座標」**：**必做本 TRACK-M0**。
> - **若想零風險快速上線世界／日本／中國，且不希望把 GeoMaster TW 的 UI 與程式碼體積繼續膨脹**：可改走「**同 `github.io` 網域下另開輕量姊妹 Repo（如 `geoMaster-world`）**」路線，直接讀取同一個 `localStorage` 的 `tw_geomaster_nickname` 與 `tw_geomaster_device_uuid`，以頂部導覽連結互轉即可完全共用帳號身分且免動 181 處台灣耦合！

---

## 1. 現況耦合盤點（實測數據）

透過靜態掃描本專案 `js/` 目錄，直接引用台灣全域常數的處數如下：
- `js/game-logic.js`：**75 處**（省/縣市/鄉鎮 5 種難度、`臺灣省/福建省`、`區/鄉/鎮/市` 後綴）
- `js/ui-controls.js`：**27 處**（區域篩選面板、縣市群組快捷鍵）
- `js/dashboard-ui.js`：**24 處**（北中南東離島統計、山區/平原/濱海稱號）
- `js/map-engine.js`：**20 處**（`TAIWAN_MAX_BOUNDS`、`TAIWAN_FULL_VIEW_BOUNDS`、`taiwan-atlas` 載入）
- `js/p2p-engine.js`：**19 處**（設定摘要、巨觀進度條、房主同步設定）
- `js/transport-engine.js`：**11 處**（僅屬於台灣現代包）
- `js/state.js` / `js/label-engine.js` / `js/poi-engine.js`：**5 處**

---

## 2. `MapPack` 標準介面規格

新增 `js/map-pack-registry.js`（載入於 `data/*.js` 之後、`js/state.js` 之前），定義統一的地圖包契約：

```js
window.GEOMASTER_PACKS = window.GEOMASTER_PACKS || {};

// 每個地圖包須實作的標準結構（以 id 註冊，例如 'tw_modern', 'tw_jp1945', 'jp_pref', 'cn_prov', 'world_countries'）
const MapPackSchema = {
  id: "tw_modern",
  displayName: "現代臺灣（22縣市 / 368鄉鎮）",
  shortLabel: "🇹🇼 台灣",
  version: "1.0",
  hierarchyDepth: 2, // 1 = 單層（世界各國/日本都道府縣/中國省級）, 2 = 兩層（台灣縣市->鄉鎮）, 3 = 可選省層
  unitLabels: {
    group: "縣市",       // 例如：地方（日本）/ 大洲（世界）/ 州廳（日治）
    item: "鄉鎮市區"     // 例如：都道府縣 / 省級行政區 / 國家
  },
  // 視角與縮放邊界
  mapView: {
    center: [23.75, 120.95],
    defaultZoom: 8,
    minZoom: 7,
    maxZoom: 15,
    maxBounds: [[20.2, 116.5], [27.4, 123.8]], // null 代表世界地圖不限經度
    fullViewBounds: [[21.82, 119.25], [25.38, 122.08]],
    pinDropScaleKm: 25
  },
  // 支援的功能旗標（非台灣現代包自動隱藏台鐵/台灣 POI/省級階層模式）
  features: {
    supportsTransportQuiz: true,
    supportsPoiQuiz: true,
    supportsMasterHierarchy: true,
    supportsSuffixDifficulty: true,
    quickSuffixes: ["區", "鄉", "鎮", "市"],
    supportedDifficulties: ["casual", "county_only", "hard_suffix", "hard_full", "master_hierarchy"]
  },
  // 篩選群組（取代硬編碼的北中南東離島、山區、平原、濱海）
  regionFilters: [
    // { id: "north", label: "北部", itemIds: [...] }
  ],
  // 正規化與別名比對（取代全域寫死 normTw）
  normalizeInput(rawStr) { /* ... */ },
  // 題庫資料提供器（lazy-load 友善）
  async ensureLoaded() { /* 動態載入 <script> 或 TopoJSON */ },
  getGroups() { /* 取代 TAIWAN_ADMIN_DATA */ },
  getItems() { /* 取代 ALL_TOWNS */ },
  getGroupByName(name) { /* 取代 COUNTY_BY_NAME[name] */ },
  matchFeatureToItem(props) { /* 取代 matchFeatureToTownObj */ }
};
```

---

## 3. 安全重構策略（漸進式零破壞）

**絕對不要一次大改寫 181 處！** 採「**Proxy Adapter 漸進抽離**」確保每步既有 10,490+ 項測試都綠燈：

1. **Step 1：建立 `tw_modern` 預設包包裝層 (`js/map-pack-registry.js`)**：
   - 把現有的 `TAIWAN_ADMIN_DATA`、`ALL_TOWNS`、`COUNTY_BY_NAME`、`normTw` 原封不動包裝為 `GEOMASTER_PACKS["tw_modern"]`。
   - 提供全域存取器：`getActiveMapPack()`、`getActiveGroups()`、`getActiveItems()`、`getActiveGroupByName(n)`、`normalizeActiveInput(s)`。
   - **向後相容**：未切換地圖包時，`ALL_TOWNS` 等舊變數仍存在，確保 `tests/matching-exhaustive.test.js` 零修改即可全數通過！
2. **Step 2：切換地圖包生命週期函式 (`switchActiveMapPack(packId)`)**：
   - 呼叫 `await pack.ensureLoaded()`（支援動態 `<script>` 載入，兼顧 `file://` 與 HTTPS！）。
   - 重設目前對局狀態（清空 `unlockedTowns` / `unlockedCounties` / `missedTowns`、`selectedCounties` / `selectedTownIds` 改以新包全體初始化）。
   - 更新 Leaflet `map.setMaxBounds(pack.mapView.maxBounds)`、`map.setMinZoom(...)`、`map.flyToBounds(pack.mapView.fullViewBounds)`。
   - 依 `pack.features` 自動隱藏／停用不適用的 UI（例如世界／日本包自動關閉 `stationQuizEnabled`、`airportQuizEnabled` 等台灣專屬題庫與 `master_hierarchy` 難度按鈕）。
   - 重新呼叫 `rebuildMapLayers(pack.topoData)`、`renderScopeModalGrid()`、`updateScoreAndProgressUI()`。
3. **Step 3：逐檔替換硬編碼引用**：
   - 優先順序：`map-engine.js` ➔ `game-logic.js` ➔ `label-engine.js` ➔ `dashboard-ui.js` ➔ `ui-controls.js` ➔ `p2p-engine.js`。
   - 在 `p2p-engine.js` 的 `getHostSyncConfig()` 加入 `mapPackId: state.activeMapPackId`；房主切換地圖包時，所有成員自動觸發 `switchActiveMapPack(cfg.mapPackId)`。
4. **Step 4：單層地圖 (`hierarchyDepth === 1`) 行為規範**：
   - 日本（47 都道府縣）、中國（34 省級）、世界（~195 國）皆屬**單層題庫**，分區（關東/關西、華北/華南、亞歐非美大洋洲）僅作為「範圍篩選群組 (`groups`)」，答題單位直接是 `items`（無需「先解鎖大洲才能猜國家」或縣市+鄉鎮前綴）。
   - 因此在 `hierarchyDepth === 1` 時，UI 自動將難度簡化為適合該包的選項（例如：休閒別名容錯 vs 嚴格全名 / 含英文模式）。

---

## 4. 驗收標準（Acceptance Criteria）

1. [ ] 新增 `js/map-pack-registry.js` 並完成 `tw_modern` 包裝與 `switchActiveMapPack()` 生命週期。
2. [ ] 撰寫一支最小 Dummy Mock Pack（例如 3 個虛擬區塊）於 `tests/test_mappack_switch.js` 中測試「`tw_modern` ↔ `mock_pack` ↔ `tw_modern`」來回切換，驗證 bounds、題數、計分、難度按鈕、台灣 POI/車站自動停用與恢復皆正確無殘留。
3. [ ] 既有 `tests/matching-exhaustive.test.js`（10,490+ 項）及其他所有測試 **100% 通過零退化**。
4. [ ] 雙擊 `file://` 開啟 `index.html` 載入速度無退化、無 Console 錯誤。
