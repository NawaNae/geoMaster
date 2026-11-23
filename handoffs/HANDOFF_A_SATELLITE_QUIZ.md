# TRACK-A：衛星影像猜縣市 / 鄉鎮模式（日間 / 夜間 / 混合）

- **Track ID**：`TRACK-A`
- **預估難度**：★★☆☆☆（原估 ★☆☆☆☆；因含主多邊形外接框、NASA GIBS 層級限制、防作弊視野鎖定復原與 P2P 同步，實測為 2 顆星）
- **前置依賴**：無（可直接於現有 `GeoMaster TW` 實作）
- **可並行軌道**：與 `TRACK-B`、`TRACK-E` 互不衝突（僅共用 `index.html` 設定面板與 `state.js` 欄位）

---

## 1. 目標與玩法設計

在現有「隨機抽題 (`target_random`)」與「衛星圖層 (`GIS_TILES.satellite`)」基礎上，新增專屬衛星盲猜體驗（可作為新 `playMode: "satellite_quiz"` 或 `target_random` 的「🛰️ 衛星聚焦挑戰」子模式，**建議獨立為 `playMode: "satellite_quiz"`** 以便乾淨管理視野鎖定與結束復原）：

1. **三種影像風格 (`state.satelliteStyle`)**：
   - `day`（日間衛星）：沿用現有 `GIS_TILES.satellite`（Esri `World_Imagery`，無字純影像）。
   - `night`（夜間燈火）：使用免費免 Key 之 **NASA GIBS VIIRS Black Marble** 圖磚。
   - `hybrid`（混合模式）：支援兩種定義，請於規格定案實作（推薦選項 1，或兩者並存）：
     - **隨機混合（預設推薦）**：每題隨機以日間或夜間影像出題（縣市題高機率夜間、小鄉鎮偏日間）。
     - **疊加光害（可選）**：Esri 衛星暗化底圖 + NASA 夜間燈火以 `mix-blend-mode: screen` 疊加。
2. **自動縮放至目標外接框 (`fitBounds`)**：
   - 抽到目標縣市或鄉鎮時，自動 `fitBounds` 對準該行政區的**主體多邊形外接框**（含適度 padding，如 `[28, 28]`），並自動隱藏地名標籤與行政區界線（`showDistrictBorders = false`）。
   - 隱藏高亮色塊填滿（否則直接把精確形狀輪廓洩漏給玩家），改以「僅鎖定外接框視野」或「外圍微暗遮罩（Spotlight Mask）」框出大略區域；**「顯示輪廓」改為可選提示（Hint Level 1）**！
3. **防作弊視野鎖定**：
   - 答題期間動態設定 `map.setMaxBounds(paddedTargetBounds)` 與 `map.setMinZoom(targetMinZoom)`，防止玩家拉遠看全台灣海岸線作弊。
   - 允許適度微幅放大（看道路紋理、地形、港口）與小範圍拖曳。
   - **退出模式／遊戲結束／揭曉答案時，必須 100% 恢復** `TAIWAN_MAX_BOUNDS`、`minZoom: 7` 與原圖層設定！

---

## 2. 本專案實測技術坑點（必處理）

### 坑點 1：NASA GIBS VIIRS Black Marble 的 `maxNativeZoom` 與座標軸順序
- NASA GIBS `VIIRS_Black_Marble` 的 `GoogleMapsCompatible_Level8` 圖磚層級上限為 **Zoom 8**，且 URL 參數順序為 **`{z}/{y}/{x}.png`**（與 ArcGIS 相同，非 OSM 的 `{x}/{y}`）。
- 若未設定 `maxNativeZoom: 8`，放大至 Zoom 9～14 會全部回傳 HTTP 400/404 空白磚！
- 正確掛載範例：
  ```js
  const NASA_NIGHT_URL =
    "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png";
  L.tileLayer(NASA_NIGHT_URL, {
    maxNativeZoom: 8,
    maxZoom: 15,
    opacity: 0.95,
    attribution: "Night Lights &copy; NASA GIBS VIIRS Black Marble"
  });
  ```
- **解析度體驗提示**：夜間圖原生解析度約 500m/pixel，在 `county_only`（22 縣市）效果極佳；若玩家選 `town`（368 鄉鎮）＋ `night`，須於 UI 顯示輕量提示「夜間解析度較低，鄉鎮模式屬高難度趣味挑戰」。

### 坑點 2：`taiwan-atlas/towns-10t.json` 的超遠離島外接框陷阱
- 目前 `js/map-engine.js`（約 L521-537）直接用 `polyLayer.getBounds()` 計算 `townObj.bounds` 並 `cObj.bounds.extend(b)`。
- 實際影響行政區：
  - **高雄市 / 旗津區**：含東沙島、南沙太平島，整包 bbox 會拉到整個南海！
  - **宜蘭縣 / 頭城鎮**：含龜山島（部分資料含釣魚台）。
  - **基隆市 / 中正區**：含彭佳嶼、棉花嶼、花瓶嶼（北方三島）。
  - **臺東縣**（綠島、蘭嶼）、**屏東縣**（琉球鄉）：縣市級 `cObj.bounds` 會被離島拉偏。
- **解法（純 JS，免外部依賴）**：
  - 於 `js/map-engine.js` 的 `rebuildMapLayers()` 中新增 `computeMainPolygonBounds(geojsonFeature)`：
    - 若為 `Polygon`，取外環 bbox。
    - 若為 `MultiPolygon`，對每個子 Polygon 外環以 Shoelace 公式計算面積（近似 `abs(sum(x1*y2 - x2*y1))`），選出最大主體 Polygon，並納入「距離主體質心小於閾值（例如 0.35°）」的鄰近島嶼（確保澎湖、金門、連江等純群島鄉鎮不被誤裁掉單一島嶼！），以此產出 `townObj.mainBounds`。
    - 縣市級 `cObj.mainBounds`：本島縣市僅合併本島多邊形（排除 `TAIWAN_MAINLAND_OFFSHORE_SET` 與離縣市主體 > 0.45° 的外島），純離島縣市（澎湖、金門、連江）則保留該縣主要群島範圍。

### 坑點 3：P2P 多人與觀戰者隔離
- `js/p2p-engine.js` 需於 `getHostSyncConfig()`、`applyRemoteSyncConfig()`、`describeConfigDiff()`、`renderRoomConciseSettingsSummary()` 同步 `playMode: "satellite_quiz"` 與 `satelliteStyle`、`satelliteLockViewport`。
- **觀戰者 (`state.role === "spectator"`)**：不得套用 `setMaxBounds` / `setMinZoom` 視野鎖定，以免觀戰者無法自由拖曳看全盤！

---

## 3. 建議修改檔案清單（精準範圍）

| 檔案 | 修改重點 |
| :--- | :--- |
| `js/state.js` | 新增 `satelliteStyle: "day"`（`'day' \| 'night' \| 'hybrid'`）、`satelliteLockViewport: true`、`satelliteOutlineRevealed: false` |
| `js/map-engine.js` | 1) `GIS_TILES` 新增 `satellite_night`；`setMapBaseLayer()` 支援 `satellite_night` 與 `satellite_hybrid`。<br>2) `rebuildMapLayers()` 計算並快取 `townObj.mainBounds` 與 `cObj.mainBounds`。<br>3) 新增 `lockMapViewportToBounds(bounds)` 與 `unlockMapViewportToTaiwan()`。<br>4) `computePolygonStyle()` 在 `satellite_quiz` 模式下預設隱藏目標填色與區界（僅在 `satelliteOutlineRevealed` 或已答對/結束時顯示輪廓）。 |
| `js/game-logic.js` | 1) `pickNextTargetRegion()` 支援 `satellite_quiz`：抽題後自動切換對應日/夜圖層、`fitBounds(mainBounds)` 並呼叫 `lockMapViewportToBounds()`。<br>2) `giveTargetHint()` Level 1 揭曉輪廓 (`satelliteOutlineRevealed = true`)、Level 2 給所屬縣市、Level 3 給首字。<br>3) `exitTargetQuizMode()` 與結束流程必呼叫 `unlockMapViewportToTaiwan()`。 |
| `js/p2p-engine.js` | 同步 `satelliteStyle` / `satelliteLockViewport` 並更新設定摘要文案。 |
| `js/ui-controls.js` & `index.html` | 於 `#modal-scope` 出題方式新增「🛰️ 衛星影像猜題」選項與日/夜/混合子切換；目標橫幅補「👁️ 顯示輪廓」按鈕（遵循零 `.innerHTML`）。 |
| `tests/` | 新增 `tests/test_satellite_bounds.js`（或併入既有測試）：驗證主多邊形 bbox 演算法對高雄/旗津、宜蘭/頭城、澎湖群島的正確性與 `unlockMapViewportToTaiwan()` 狀態復原。 |

---

## 4. 驗收標準（Acceptance Criteria）

1. [ ] 選擇「衛星影像猜題」＋「日間 / 夜間 / 混合」，每抽一題自動 `fitBounds` 至目標主體且隱藏區界與地名。
2. [ ] 抽到高雄市（縣市模式）與高雄市旗津區（鄉鎮模式）時，畫面聚焦於高雄本島／旗津本體，不會縮放到整個南海。
3. [ ] 夜間模式放大至 Zoom 12 以上仍正常顯示 upscaled 圖磚，無破圖或 400 錯誤。
4. [ ] 鎖定視野開關開啟時，玩家無法拉遠看全台灣；點擊「退出目標模式」或「結束看答案」後，地圖立即恢復可自由縮放至全台灣。
5. [ ] 點擊「顯示輪廓」提示可浮現目標邊界線；答對後高亮顯示並自動切下一題。
6. [ ] `file://` 直接雙擊 `index.html` 無報錯；既有 `tests/` 全數通過＋新增測試全數通過。
