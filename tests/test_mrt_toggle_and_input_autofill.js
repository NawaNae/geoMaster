const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "css/styles.css"), "utf8");
const uiSrc = fs.readFileSync(path.join(root, "js/ui-controls.js"), "utf8");
const p2pSrc = fs.readFileSync(path.join(root, "js/p2p-engine.js"), "utf8");
const transportSrc = fs.readFileSync(path.join(root, "data/transport-data.js"), "utf8");

// Load TAIWAN_SELECTABLE_LINES from data/transport-data.js
const tCtx = { window: {} };
vm.runInNewContext(transportSrc + "\nthis._LINES = TAIWAN_SELECTABLE_LINES;", tCtx);
const LINES = tCtx._LINES;
assert(Array.isArray(LINES) && LINES.length > 30, "TAIWAN_SELECTABLE_LINES should load");

// Extract SIMPLE_STATION_MAP and getDefaultStationQuizLines from js/ui-controls.js
const mapMatch = uiSrc.match(/const SIMPLE_STATION_MAP = \{[\s\S]*?\n\};/);
assert(mapMatch, "SIMPLE_STATION_MAP not found");
const defMatch = uiSrc.match(/function getDefaultStationQuizLines\(\) \{[\s\S]*?\n\}/);
assert(defMatch, "getDefaultStationQuizLines not found");

const uCtx = {
  TAIWAN_SELECTABLE_LINES: LINES,
  _uiIsTaiwanModernPack: () => true
};
vm.runInNewContext(
  mapMatch[0] + "\n" + defMatch[0] + "\nthis.SIMPLE_STATION_MAP = SIMPLE_STATION_MAP; this.getDefaultStationQuizLines = getDefaultStationQuizLines;",
  uCtx
);

const { SIMPLE_STATION_MAP, getDefaultStationQuizLines } = uCtx;

// 1. tpemrt includes all mrt_tpe_* + mrt_ntpc_y + mrt_ntpc_lb
const tpeIds = SIMPLE_STATION_MAP.tpemrt();
assert(tpeIds.includes("mrt_tpe_r"), "tpemrt includes mrt_tpe_r");
assert(tpeIds.includes("mrt_ntpc_y"), "tpemrt includes mrt_ntpc_y");
assert(tpeIds.includes("mrt_ntpc_lb"), "tpemrt includes mrt_ntpc_lb (三鶯線)");
assert(!tpeIds.includes("mrt_ty_a"), "tpemrt does NOT include mrt_ty_a");

// 2. tymrt includes mrt_ty_a
assert.strictEqual(typeof SIMPLE_STATION_MAP.tymrt, "function", "SIMPLE_STATION_MAP.tymrt exists");
assert.deepStrictEqual(Array.from(SIMPLE_STATION_MAP.tymrt()), ["mrt_ty_a"], "tymrt returns ['mrt_ty_a']");

// 3. Union of the 4 MRT toggles covers 100% of mrt_* lines
const allMrtInData = LINES.filter((l) => !l.isHighway && l.id.startsWith("mrt_")).map((l) => l.id).sort();
const union4 = Array.from(new Set([
  ...SIMPLE_STATION_MAP.tpemrt(),
  ...SIMPLE_STATION_MAP.tymrt(),
  ...SIMPLE_STATION_MAP.tcmrt(),
  ...SIMPLE_STATION_MAP.khmrt()
])).sort();
assert.deepStrictEqual(Array.from(union4), Array.from(allMrtInData), "4 MRT toggles must cover every mrt_* line");

// 4. Turning off all 4 MRT toggles from default station quiz lines leaves ZERO mrt_* lines
const defaults = new Set(getDefaultStationQuizLines());
for (const key of ["tpemrt", "tymrt", "tcmrt", "khmrt"]) {
  SIMPLE_STATION_MAP[key]().forEach((id) => defaults.delete(id));
}
const leftoverMrt = Array.from(defaults).filter((id) => id.startsWith("mrt_"));
assert.deepStrictEqual(leftoverMrt, [], "Zero MRT lines should remain after turning off all 4 MRT toggles");
assert(defaults.has("tra_west_n") && defaults.has("tra_yilan"), "TRA mainlines should remain");

// 5. HTML simple presets include tymrt and updated tpemrt tooltip
assert(html.includes('data-simple-station="tymrt"'), "index.html has tymrt simple toggle");
assert(html.includes("三鶯線"), "index.html tpemrt tooltip mentions 三鶯線");

// 6. p2p-engine.js groupDefs groups mrt_ntpc_lb into 北捷
assert(
  /label:\s*"北捷",\s*ids:\s*\[[^\]]*"mrt_ntpc_lb"[^\]]*\]/.test(p2pSrc),
  "p2p-engine.js 北捷 group includes mrt_ntpc_lb"
);

// 7. Answer & suffix inputs use type="search" + autofill suppression + CSS hides cancel button
const ansInputBlock = html.match(/<input[^>]*id="answer-input"[^>]*>/);
assert(ansInputBlock, "answer-input element found");
assert(ansInputBlock[0].includes('type="search"'), "answer-input uses type=search");
assert(ansInputBlock[0].includes('autocomplete="off"'), "answer-input has autocomplete=off");
assert(ansInputBlock[0].includes('data-form-type="other"'), "answer-input has data-form-type=other");

const sufInputBlock = html.match(/<input[^>]*id="suffix-input"[^>]*>/);
assert(sufInputBlock, "suffix-input element found");
assert(sufInputBlock[0].includes('type="search"'), "suffix-input uses type=search");
assert(sufInputBlock[0].includes('autocomplete="off"'), "suffix-input has autocomplete=off");

assert(css.includes("#answer-input::-webkit-search-cancel-button"), "CSS hides search cancel button");

console.log("PASS: All MRT toggle & input autofill checks passed! (15/15)");
