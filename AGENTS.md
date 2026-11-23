# AGENTS.md — GeoMaster TW 專案架構與維護導覽

> **核心目標**：本專案將「靜態資料 (`data/`)」、「樣式 (`css/`)」、「功能引擎 (`js/`)」與「網頁視圖骨幹與 `<template>` 模板 (`index.html`)」完整分離（MVC 架構）。
> AI 代理（Agents）在維護或擴充功能時，**請根據下方索引只讀取需要修改的目標檔案**，切勿一次讀取全部檔案，以節省 80%~90% 的 Token 消耗。

## 1. 本地執行與載入規範 (`file://` 相容)

- **免建置、免打包**：本專案採用原生 `<script src="...">` 依序載入（不使用 `<script type="module">`），因此：
  1. 可直接雙擊 `index.html`（透過 `file://` 協定）在瀏覽器本地執行，不會觸發 CORS 阻擋；`css/styles.css` 亦內建離線 RWD 佈局與漸層按鈕樣式備援。
  2. 亦可透過 VS Code Live Server、`python3 -m http.server 8000` 或直接部署至 GitHub Pages 執行。
- **腳本載入順序**（定義於 `index.html` 底部，請勿任意調換順序）：
  1. `data/admin-data.js` ➔ 2. `data/railisland-shapes.js` ➔ 3. `data/transport-data.js` ➔ 4. `data/poi-data.js` ➔ 4.5. `js/map-pack-registry.js` ➔ 5. `js/state.js` ➔ 6. `js/map-engine.js` ➔ 7. `js/transport-engine.js` ➔ 8. `js/poi-engine.js` ➔ 9. `js/label-engine.js` ➔ 10. `js/game-logic.js` ➔ 11. `js/dashboard-ui.js` ➔ 12. `js/p2p-engine.js` ➔ 13. `js/ui-controls.js`

## 2. 目錄結構與檔案職責總覽

| 檔案路徑 | 行數 (約) | 職責說明 | 關鍵全域變數 / 函式 |
| :--- | :--- | :--- | :--- |
| `index.html` | ~1,020 | 網頁 DOM 視圖骨幹、頂部導覽列（即時同步暱稱 `#top-nickname-input`、結束看答案 `#btn-top-give-up`、建立/退出房間 `#btn-top-create-room` / `#btn-top-open-room` / `#btn-top-leave-room`、模式設定 `#btn-open-scope`）、最上層連結進房彈窗 (`#modal-join-entry` z-720)、精簡多人房間視窗 (`#modal-room` z-610)、共用模式設定視窗 (`#modal-scope` z-650，含簡易/進階 Tab)、設定變更輕量自動消失通知 (`#room-config-toast`) 與底部 `<template>` 視圖模板 | `#leaflet-map`, `#top-nickname-input`, `#btn-top-give-up`, `#btn-top-create-room`, `#btn-top-leave-room`, `#modal-join-entry`, `#modal-room`, `#modal-scope`, `#tpl-*` |
| `css/styles.css` | ~700 | 視覺樣式：Apple Glass 毛玻璃、效能模式 (`body.perf-lite`)、彈窗開啟時背景鎖定防滾動穿透 (`body.modal-open`, `.overscroll-contain`)、RWD 地圖高度自適應與離線備援 | `.apple-glass`, `body.modal-open`, `.overscroll-contain`, `.tw-station-lbl`, `.map-region-label` |
| `data/admin-data.js` | ~235 | 台灣 22 縣市與 368 鄉鎮市區靜態清單、山區 (`TAIWAN_MOUNTAIN_SET`)、西部平原 (`TAIWAN_WEST_PLAIN_SET`)、東部平原 (`TAIWAN_EAST_PLAIN_SET`) 與濱海集合 | `TAIWAN_ADMIN_DATA`, `ALL_TOWNS`, `TAIWAN_MOUNTAIN_SET`, `TAIWAN_WEST_PLAIN_SET`, `TAIWAN_EAST_PLAIN_SET`, `TAIWAN_MAINLAND_OFFSHORE_SET` |
| `data/transport-data.js` | ~845 | 全台交通路網與軌道車站清單（高鐵、台鐵西部/東部/支線、北桃中捷高捷、輕軌、纜車、林鐵、糖鐵） | `TAIWAN_SELECTABLE_LINES`, `LINE_DISPLAY_META`, `STATION_TOWNSHIP_MAP`, `resolveStationTownInfo()`, `getLineDisplayName()` |
| `data/railisland-shapes.js` | ~1 | 開放資料鐵道與捷運真實幾何線段 (`MultiLineString`) | `RAILISLAND_SHAPES`, `OPEN_RAIL_ATTRIBUTION` |
| `data/poi-data.js` | ~560 | 台灣機場（24座）、港口（233座；官方第一類漁港9座＋完整第二類漁港212座［精選24＋其餘188］）、水庫（41座：主要21/其他本島14/離島6）與湖泊（34座：觀光平地22/高山秘境12，6座雙屬性湖庫跨類別去重）精準經緯度資料集 | `POI_CATEGORY_META`, `AIRPORT_SUBTYPES`, `PORT_SUBTYPES`, `RESERVOIR_SUBTYPES`, `LAKE_SUBTYPES`, `SETTLEMENT_SUBTYPES`, `TAIWAN_POI_DATA`, `resolvePoiTownId()` |
| `js/poi-engine.js` | ~300 | 機場與港口核心引擎：多標籤自動去重計數、區域篩選、答題別名比對與專屬地圖標記圖層 (`poiMarkerPane`) | `getActiveQuizPois()`, `countPoisBySubType()`, `countUniquePoisForSubTypes()`, `tryMatchAndUnlockPoi()`, `initPoiMapEngine()`, `refreshPoiMapLayer()` |
| `TODO.md` | ~60 | 第二階段待實作題庫（水庫、湖泊、島嶼）調查與實作注意事項 | 待辦規劃文件 |
| `js/map-pack-registry.js` | ~700 | 多地圖包抽象層 (`TRACK-M0`)：`GEOMASTER_PACKS` 註冊表、`tw_modern` 預設轉接層、支援 `file://` 的動態 `<script>` 載入與 `switchActiveMapPack()` 生命週期 | `GEOMASTER_PACKS`, `registerMapPack()`, `getActiveMapPack()`, `getActiveGroups()`, `getActiveItems()`, `switchActiveMapPack()` |
| `js/state.js` | ~290 | 全域狀態物件 (`state`，含 `activeMapPackId`、`settingsTab`、`bannedDevices`、`roomHasPassword`)、穩定裝置識別碼 (`getOrCreateStableDeviceId()`)、觀戰視角代理 (`getActiveViewState()`)、防作弊權限守衛 (`canLocalModifyGameConfig()`) | `state`, `getActiveViewState()`, `canLocalModifyGameConfig()`, `playTone()` |
| `js/map-engine.js` | ~550 | Leaflet Canvas 地圖初始化、GPU 縮放矩陣同步 (`zoomanim`)、Esri 底圖切換、TopoJSON 載入與多邊形渲染 | `map`, `canvasRenderer`, `initMap()`, `setMapBaseLayer()`, `refreshAllPolygonStyles()` |
| `js/transport-engine.js` | ~1,020 | 鐵道與車站核心引擎：真實軌道向量與車站圓點渲染、車站猜題比對 | `initPrecisionRailAndStationEngine()`, `shouldFilterStationsByRegion()`, `getActiveQuizStations()`, `tryMatchAndUnlockStation()` |
| `js/label-engine.js` | ~180 | 視窗裁切 (Viewport Culling) 與智慧防重疊外拉引線 (Leader Lines) 標籤渲染引擎 | `renderSmartLabelsAndLeaderLines()` |
| `js/game-logic.js` | ~925 | 答題判定與目標區塊模式：5 種難度規則、前後綴組合、答題判定 (`evaluateGuess`)、方向鍵鄰近區塊導航 | `getScopeTowns()`, `getScopeCounties()`, `evaluateGuess()`, `pickNextTargetRegion()`, `exitTargetQuizMode()` |
| `js/dashboard-ui.js` | ~1,260 | 右側進度儀表板、多重軌道分類進度條、防暴雷縣市清單、勝利判定與結算成績單 | `updateScoreAndProgressUI()`, `computeClearedBlocksStats()`, `detectRegionThemeProfile()`, `detectStationThemeProfile()`, `getGradeFromStats()`, `checkVictoryCondition()`, `resetGame()` |
| `js/p2p-engine.js` | ~1,650 | 多人房間與權限引擎：連結進房探測 (`ROOM_PROBE`/`ROOM_INFO`)、密碼錯誤提示、精簡條列題目設定摘要 (`renderRoomConciseSettingsSummary`)、房主設定變更免投票即時同步（自動重設已按 Ready 狀態並彈出短暫輕量通知 `showRoomConfigChangeToast`）、房主踢出 (`kickPlayerFromRoom`) 與封鎖裝置 (`banDeviceFromRoom`)、房主退出自動移交 (`HOST_HANDOVER`) 與全退關閉房間 (`ROOM_CLOSED`)、單人防廣播隔離 | `initP2PEngine()`, `hostP2PRoom()`, `joinP2PRoom()`, `kickPlayerFromRoom()`, `banDeviceFromRoom()`, `leaveP2PRoom()`, `renderRoomConciseSettingsSummary()` |
| `js/ui-controls.js` | ~1,020 | 模式設定視窗（預設簡易設定 / 進階設定 Tab `setSettingsTab`）、精簡房間彈窗 (`openRoomModal`)、Hover/Touch 氣泡提示 (`initHoverAndTouchTipSystem`)、DOM 事件綁定與 Windows 微軟注音 IME 防吃字處理 | `setSettingsTab()`, `openModeSettingsModal()`, `openRoomModal()`, `renderScopeModalGrid()`, `bindAllUIEvents()` |
