# TRACK-B：給地名標座標模式（類 GeoGuessr / Pin-Drop）

- **Track ID**：`TRACK-B`
- **預估難度**：★★★☆☆（原估 ★★☆☆☆；因需建立「回合制＋連續分數 0–5000」狀態機、手機確認送出 UX、純 JS 幾何最近邊界距離引擎，並與既有解鎖計數制隔離，實測為 3 顆星）
- **前置依賴**：無（可直接於現有 `GeoMaster TW` 實作，且**第一天即可支援全專案既有題庫**：368 鄉鎮、22 縣市、609 車站、543+ 機場/港口/水庫/湖泊/傳統聚落！）
- **未來複用性**：完成本模組的幾何距離＋計分引擎後，`TRACK-C/D/E` 與 `jp1945` 皆可直接掛載本玩法。

---

## 1. 核心玩法與遊戲流程

與現有「打字解鎖全部區塊」不同，本模式採 **GeoGuessr 風格回合制**：

1. **出題方式 (`playMode: "pin_drop"`)**：
   - 系統從當前啟用的題庫範圍（行政區／縣市／車站／機場／港口／水庫／湖泊／聚落）抽出 `N` 題（預設 10 題，可選 5 / 10 / 20 / 無盡模式）。
   - 上方目標橫幅顯示題目名稱（例如：`📍 請在地圖上標出：彰化縣 芳苑鄉` 或 `🚉 台鐵 追分站` 或 `🪧 路上厝（路上）`）。
   - 底圖自動切為**無字底圖**（可選：`vector` 純輪廓、`terrain` Esri 無字地形、`satellite` Esri 無字衛星），並依難度決定是否隱藏鄉鎮區界線（預設隱藏區界、僅留海岸線或縣市大界，防止直接看形狀秒殺）。
2. **玩家標點與送出（手機友善防誤觸）**：
   - 點擊地圖任意處放置／移動藍色預覽圖釘（`pinPreviewMarker`），**不於第一次點擊就直接送出**（避免手機滑動或微調誤判）。
   - 玩家確認位置後，點擊底部「📍 確認標記（或按空白鍵 / Enter）」送出本題。
3. **揭曉與視覺回饋**：
   - 計算玩家標點到目標的**最短地表距離 (`distanceKm`)**：
     - **面狀目標（鄉鎮／縣市）**：點落在多邊形內（`pointInPolygon === true`）➔ **`0.00 km` 滿分 5,000 分**！落在外部 ➔ 計算到多邊形所有外環線段的**最近邊界點 (`nearestPoint`)** 與最短公里數！
     - **點狀目標（車站／POI）**：計算 Haversine 距離至目標座標；若 `distanceKm <= 0.5`（或依類型調整如機場 1.5 km）視為滿分 5,000 分。
   - 地圖動畫展開：
     - 高亮顯示正確目標（面狀填色發光 / 點狀亮綠標記）。
     - 繪製一條從玩家標點連到最近邊界點（或點位）的**琥珀色虛線 (`L.polyline` with `dashArray`)**，線段中點顯示距離標籤（例如 `4.2 km · +4,347 分`）。
     - 自動 `fitBounds` 同時框住玩家標點與正確目標（padding `[60, 60]`）。
   - 點擊「➡️ 下一題（或按空白鍵 / Enter）」進入下一回合；全部回合結束後彈出**標座標專屬結算卡**（總分 `XX,XXX / 50,000`、平均誤差公里數、最準一題、每題明細清單）。

---

## 2. 演算法與無依賴設計（強烈建議純 JS，不強制依賴 Turf.js）

> **為何不直接引 500KB+ 的完整 Turf.js CDN？**
> 1. 本專案強調 `file://` 離線穩定與輕量快速。
> 2. Turf.js 的 `polygonToLine()` 遇到 `MultiPolygon` 會回傳 `FeatureCollection`，直接丟進 `nearestPointOnLine()` 會拋出型別錯誤，反而要額外包一層迴圈。
> 3. 純 JS 實作 Ray-Casting + Haversine 點到線段最近點僅約 **70 行**，零依賴、支援帶洞 MultiPolygon，且能直接放進 Node `tests/` 做 100% 確定性測試！

### 建議獨立新模組：`js/pindrop-engine.js`（載入於 `js/game-logic.js` 之前）

必備純函式（皆需匯出或掛於全域以供單元測試驗證）：
1. `haversineDistanceKm(lat1, lng1, lat2, lng2)`：地球半徑 `R = 6371.0088 km`。
2. `isPointInRing(lng, lat, ring)`：標準 Ray-Casting 演算法。
3. `isPointInGeoJsonGeometry(lng, lat, geometry)`：
   - 支援 `Polygon`（在外環內且不在任一內洞 `rings[1..]` 內）與 `MultiPolygon`（在任一子 Polygon 內即回傳 `true`）。
4. `nearestPointOnSegment(px, py, ax, ay, bx, by)`：
   - 注意台灣緯度（~23.5°N）經度縮放修正：`cosLat = Math.cos((py * Math.PI) / 180)`，在局部平面投影 `(x * cosLat, y)` 上求投影比例 `t = clamp(dot/lenSq, 0, 1)`，轉回 `(lng, lat)` 後以 `haversineDistanceKm` 計算精準球面距離。
5. `computeDistanceToGeoJson(lat, lng, geometry)`：
   - 若 `isPointInGeoJsonGeometry` 為 `true`，回傳 `{ inside: true, distanceKm: 0, nearestLat: lat, nearestLng: lng }`。
   - 否則遍歷所有外環線段，回傳 `{ inside: false, distanceKm, nearestLat, nearestLng }`。
6. `computePinDropScore(distanceKm, scaleKm = 30, perfectRadiusKm = 0)`：
   - 若 `distanceKm <= perfectRadiusKm` 回傳 `5000`。
   - 否則 `Math.round(5000 * Math.exp(-(distanceKm - perfectRadiusKm) / scaleKm))`。
   - 建議 `scaleKm` 預設表（預留給未來多地圖包擴充）：
     - 台灣鄉鎮 / 車站 / POI：`scaleKm = 25`（偏 5km ≈ 4094分，偏 25km ≈ 1839分，偏 80km ≈ 204分）
     - 台灣縣市：`scaleKm = 40`
     - 日本都道府縣 / 中國省級（未來）：`scaleKm = 150`
     - 世界各國（未來）：`scaleKm = 1500`

---

## 3. 與現行架構的整合邊界

1. **GeoJSON 幾何快取**：
   - 目前 `js/map-engine.js` 的 `rebuildMapLayers()` 只把 `polyLayer` 存進 `townObj.layers`，未把原始 `feat.geometry` 存到 `townObj` 或 `countyObj`。
   - 需於 `rebuildMapLayers()` 中保存 `townObj.geojsonGeometry = feat.geometry`（以及 `countyObj.geojsonGeometry` 由 `loadedTopoData.countiesGeo` 對應寫入，或合併所屬鄉鎮幾何陣列遍歷判定）。
2. **與「打字解鎖模式」的狀態隔離**：
   - 於 `state.js` 新增獨立區塊 `state.pinDrop = { active: false, totalRounds: 10, currentRound: 0, phase: "idle" /* 'placing' | 'revealed' | 'finished' */, queue: [], currentTarget: null, guessLatLng: null, history: [], totalScore: 0 }`。
   - `playMode === "pin_drop"` 時：
     - 隱藏底部文字輸入框 (`#answer-input` 區塊)，改顯示「標座標操作列」（提示目前座標狀態、`📍 確認標記` / `➡️ 下一題` 按鈕）。
     - 頂部計分條 (`#top-score-display`) 改顯示 `得分 / 滿分` 與 `第 X / N 題`，不干擾 `unlockedTowns`。
     - 點擊地圖多邊形 (`handlePolygonClick`) 時，若 `playMode === "pin_drop"` 改轉發給 `handlePinDropMapClick(latlng)`，不觸發舊版點選鎖定！
3. **P2P 分階段實作策略**：
   - **Phase 1（本 Handoff 必完成）**：單人模式完整上線；若玩家在多人房間中，暫不於 P2P 啟用 `pin_drop`（或加明確 guard 提示「標座標模式目前僅支援單人遊玩」），避免破壞現有 142KB `p2p-engine.js` 的計分同步。
   - **Phase 2（後續擴充）**：由房主產生題目 ID 陣列廣播給所有人，每回合同步比較 0–5000 累積分數。

---

## 4. 建議修改檔案清單

| 檔案 | 修改重點 |
| :--- | :--- |
| `js/pindrop-engine.js` *(新增)* | 純 JS 幾何距離引擎、計分公式、抽題佇列、圖釘/虛線/揭曉圖層 (`pinDropLayerGroup`) 與回合狀態機。 |
| `js/state.js` | 新增 `state.pinDrop` 狀態物件與 `pinDropRounds: 10` 設定。 |
| `js/map-engine.js` | `rebuildMapLayers()` 快取 `townObj.geojsonGeometry` 與縣市幾何；`map.on("click")` 在 `pin_drop` 模式下觸發放置預覽圖釘。 |
| `js/game-logic.js` | `handlePolygonClick()` 在 `pin_drop` 時不攔截、轉交放置圖釘。 |
| `js/dashboard-ui.js` | `updateScoreAndProgressUI()` 支援顯示 `pin_drop` 回合進度與累積總分；新增標座標結算摘要卡片。 |
| `js/ui-controls.js` & `index.html` | 引入 `js/pindrop-engine.js`；`#modal-scope` 新增「📍 給地名標座標」模式與回合數選擇；新增底部標座標控制列與結算 `<template>`（嚴格零 `.innerHTML`）。 |
| `tests/test_pindrop_geometry.js` *(新增)* | 測試點在多邊形內（回傳 0 km / 5000 分）、點在洞內（視為境外）、MultiPolygon 離島判定、點到線段最近點精度（誤差 < 0.05 km）、指數衰減計分單調性。 |

---

## 5. 驗收標準（Acceptance Criteria）

1. [ ] 單人切換至「給地名標座標」模式，可針對「368 鄉鎮」、「22 縣市」、「軌道車站」、「機場/港口/水庫/湖泊/傳統聚落」任一或混合題庫出題。
2. [ ] 標點落在目標行政區內部時，精準判定 `0.0 km` 並給 `5,000` 分（包含花蓮秀林、高雄桃源等大面積鄉鎮，絕非算中心點）。
3. [ ] 標點落在外部時，正確畫出連向**最近邊界點**的虛線與距離，並依指數公式計分。
4. [ ] 手機版點擊地圖只放置/移動預覽圖釘，按「確認標記」才送出；鍵盤支援空白鍵/Enter 確認與換題。
5. [ ] 退出 `pin_drop` 切回自由輸入模式時，所有圖釘、虛線與目標遮罩清除乾淨，打字輸入列正常恢復。
6. [ ] 既有 `tests/` 全數通過，且 `tests/test_pindrop_geometry.js` 全數通過。
