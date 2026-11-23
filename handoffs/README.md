# GeoMaster TW — 擴充方向總覽與 Handoff 分派索引

本目錄將未來 5 大擴充方向（A～E）與前置重構（M0）拆分為獨立、可直接交辦給不同工程師或 AI Agent 執行的交接文件。每份文件皆對齊本專案現行真實架構（原生 `<script>` 免打包、`file://` 相容、零 `.innerHTML`、Leaflet Canvas、PeerJS P2P、`tests/` 確定性測試）。

---

## 一、總表、真實難度重評與相依關係

| Track ID | 交接文件 | 內容 | 他模型原估 | **專案實測重評** | 前置依賴 | 建議順位 |
| :--- | :--- | :--- | :---: | :---: | :--- | :---: |
| **TRACK-A** | [HANDOFF_A_SATELLITE_QUIZ.md](HANDOFF_A_SATELLITE_QUIZ.md) | 衛星影像猜縣市/鄉鎮（日間/夜間/混合＋外接框縮放＋鎖視野） | ★☆☆☆☆ | **★★☆☆☆** | 無（直接做） | **1** |
| **TRACK-B** | [HANDOFF_B_PIN_DROP.md](HANDOFF_B_PIN_DROP.md) | 給地名標座標（類 GeoGuessr，最近邊界距離＋0–5000 分） | ★★☆☆☆ | **★★★☆☆** | 無（直接做） | **2** |
| **TRACK-M0** | [HANDOFF_M0_MAPPACK_CORE.md](HANDOFF_M0_MAPPACK_CORE.md) | 多地圖包抽象層 (`MapPack` Core) — 解除 181 處台灣硬編碼 | *(未列)* | **★★★★☆** | 無（與 C/D/jp1945 共用） | **3** |
| **TRACK-D** | [HANDOFF_D_JP_CN_MAPS.md](HANDOFF_D_JP_CN_MAPS.md) | 鄰國題庫：日本 47 都道府縣＋中國 34 省級 | ★★☆☆☆ | **★★☆☆☆** *(含 M0 則 ★★★★☆)* | **TRACK-M0**（或獨立姊妹 Repo） | **4** |
| **TRACK-C** | [HANDOFF_C_WORLD_MAP.md](HANDOFF_C_WORLD_MAP.md) | 世界地圖（~195 國＋微型國熱區＋繁中/英文別名） | ★★☆☆☆ | **★★★☆☆** *(含 M0 則 ★★★★☆)* | **TRACK-M0**（或獨立姊妹 Repo） | **5** |
| **TRACK-E** | [HANDOFF_E_TAIWAN_VILLAGES.md](HANDOFF_E_TAIWAN_VILLAGES.md) | 台灣 7,748 村里模式（22 縣市按需載入＋階層計分） | ★★★★☆ | **★★★★☆** | 無（獨立台灣模組） | **6** |

> 註：專案既有交接文件仍保留於根目錄：[HANDOFF_SETTLEMENTS_SIGNAGE.md](../HANDOFF_SETTLEMENTS_SIGNAGE.md)（已完成）與 [HANDOFF_JP1945_MAP.md](../HANDOFF_JP1945_MAP.md)（建議可與 **TRACK-M0** 整合實作）。

---

## 二、相依關係圖

```text
現行 GeoMaster TW
 ├──► TRACK-A (衛星影像猜縣市/鄉鎮)  ──► 獨立可立即並行
 ├──► TRACK-B (給地名標座標)          ──► 獨立可立即並行（第一天即支援鄉鎮/縣市/車站/POI）
 ├──► TRACK-E (台灣 7,748 村里模式)   ──► 獨立可隨時開工（僅動台灣模組＋按需載入）
 └──► [路線選擇]
       ├─ 路線 1（同專案統一站）：TRACK-M0 (MapPack 抽象層) ──┬──► TRACK-D (日本/中國)
       │                                                     ├──► TRACK-C (世界各國)
       │                                                     └──► HANDOFF_JP1945_MAP (1945 日治臺灣)
       └─ 路線 2（同源姊妹 Repo）：另開 geoMaster-world Repo，共用 localStorage 帳號 Key，直接內建 MapPack 架構做 D + C
```

---

## 三、共用帳號 / 儲存鍵規範（跨 Repo 同源互通必守）

本專案目前於 `localStorage` 實際使用的鍵值（位於 `js/state.js`、`js/p2p-engine.js`、`js/transport-engine.js`）：
- **玩家共用身分（同 `*.github.io` Origin 可直接互通，請勿任意改名）**：
  - `tw_geomaster_nickname`：玩家暱稱
  - `tw_geomaster_device_uuid`：穩定裝置識別碼（搭配硬體指紋防封鎖繞過）
- **本專案專用快取 / 房間恢復（若開獨立姊妹 Repo，必須換用新前綴如 `world_geomaster_*` 防覆蓋）**：
  - `tw_geomaster_osm_stations_v5` / `tw_geomaster_osm_tracks_v2`
  - `tw_geomaster_tab_instance_id` (`sessionStorage`)
  - `getSessionStorageKey()` 房間快照鍵

---

## 四、通用專案鐵律（所有 Handoff 共同遵守）

1. **免打包與 `file://` 雙擊相容**：不得改為 `<script type="module">`；動態載入本地資料集時**禁止使用 `fetch("./data/...")`**（`file://` 會觸發 CORS 失敗），應改用動態 `<script>` 註冊 callback 或附 CDN HTTPS 備援。
2. **嚴格零 `.innerHTML`**：所有新增 UI 必須使用 `index.html` 的 `<template>` 或 `document.createElement` / `textContent` / `replaceChildren()`。
3. **P2P 單人隔離原則**：單人模式絕不廣播設定；多人模式僅房主 (`canLocalModifyGameConfig()`) 可修改設定，且觀戰者 (`state.role === "spectator"`) 不受玩家端視野鎖定影響。
4. **確定性測試不退化**：每次交付皆須執行 `tests/` 既有測試全數通過，並補齊新功能的確定性單元測試。

---

## 五、一鍵指派指令範本（可直接複製交給其他 Agent / 工程師）

- 指定單一軌道：
  > 請先閱讀 `AGENTS.md` 與 `handoffs/HANDOFF_A_SATELLITE_QUIZ.md`，僅讀取該文件列出的相關檔案，依規格實作 **TRACK-A** 並補齊對應單元測試後回報驗證結果。
- 指定前置重構＋後續地圖：
  > 請先閱讀 `AGENTS.md` 與 `handoffs/HANDOFF_M0_MAPPACK_CORE.md`，完成 **TRACK-M0** 並確認既有 10,490+ 項測試全數通過後停下讓我驗收。
