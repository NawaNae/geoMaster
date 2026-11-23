#!/usr/bin/env node
/**
 * TDD tests for GeoMaster TW POI visual scaling, unified zoom typography,
 * and frameless translucent-halo pass/fail states.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = process.argv[2] || path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");

// 1. Load computeMapZoomScaleMetrics & applyMapZoomVisualVars from js/map-engine.js
const mapJs = read("js/map-engine.js");
const labelJs = read("js/label-engine.js");
const poiJs = read("js/poi-engine.js");
const css = read("css/styles.css");

// Extract and execute computeMapZoomScaleMetrics + applyMapZoomVisualVars in an isolated VM
const styleStore = {};
const mockContainer = {
  style: {
    setProperty(k, v) { styleStore[k] = v; }
  }
};
const sandbox = {
  Math,
  Number,
  document: {
    getElementById(id) {
      return id === "map-container" || id === "leaflet-map" ? mockContainer : null;
    }
  }
};
vm.createContext(sandbox);
const helperMatch = mapJs.match(/function computeMapZoomScaleMetrics[\s\S]*?function applyMapZoomVisualVars[\s\S]*?\n\}/);
assert(helperMatch, "map-engine.js must define computeMapZoomScaleMetrics and applyMapZoomVisualVars");
vm.runInContext(helperMatch[0], sandbox);

// 2. Verify monotonic zoom scaling across z=7..14
const z7 = sandbox.computeMapZoomScaleMetrics(7);
const z8 = sandbox.computeMapZoomScaleMetrics(8);
const z9 = sandbox.computeMapZoomScaleMetrics(9);
const z10 = sandbox.computeMapZoomScaleMetrics(10);
const z11 = sandbox.computeMapZoomScaleMetrics(11);
const z12 = sandbox.computeMapZoomScaleMetrics(12);
const z14 = sandbox.computeMapZoomScaleMetrics(14);

// Label font sizes must match township inline label progression (8..12.5px)
assert.strictEqual(z7.labelFontPx, 8);
assert.strictEqual(z8.labelFontPx, 8.5);
assert.strictEqual(z9.labelFontPx, 9.5);
assert.strictEqual(z10.labelFontPx, 10.5);
assert.strictEqual(z11.labelFontPx, 11.5);
assert.strictEqual(z12.labelFontPx, 12.5);
assert.strictEqual(z14.labelFontPx, 12.5);

// POI glyph size at zoomed-out (z=7,8) must be compact (comparable to ~8-11px station dots, far smaller than old 24px box)
assert(z7.poiGlyphPx <= 10.5 && z7.poiGlyphPx >= 8.5, `z7 poiGlyphPx=${z7.poiGlyphPx} out of compact range`);
assert(z8.poiGlyphPx <= 11.5 && z8.poiGlyphPx >= 9.5, `z8 poiGlyphPx=${z8.poiGlyphPx} out of compact range`);
assert(z8.poiHaloPx <= 16, `z8 poiHaloPx=${z8.poiHaloPx} should stay slim`);

// Monotonic growth when zooming in
const levels = [z7, z8, z9, z10, z11, z12];
for (let i = 1; i < levels.length; i++) {
  assert(levels[i].labelFontPx >= levels[i - 1].labelFontPx, "labelFontPx must grow monotonically");
  assert(levels[i].poiGlyphPx > levels[i - 1].poiGlyphPx, "poiGlyphPx must grow monotonically");
  assert(levels[i].poiHaloPx > levels[i - 1].poiHaloPx, "poiHaloPx must grow monotonically");
  assert(levels[i].poiTagOffsetPx >= levels[i - 1].poiTagOffsetPx, "poiTagOffsetPx must grow monotonically");
}

// 3. Verify applyMapZoomVisualVars sets CSS custom properties on #map-container
sandbox.applyMapZoomVisualVars(8);
assert.strictEqual(styleStore["--map-label-size"], "8.5px");
assert.strictEqual(styleStore["--poi-glyph-size"], `${z8.poiGlyphPx}px`);
assert.strictEqual(styleStore["--poi-halo-size"], `${z8.poiHaloPx}px`);
assert.strictEqual(styleStore["--poi-tag-offset"], `${z8.poiTagOffsetPx}px`);

sandbox.applyMapZoomVisualVars(12);
assert.strictEqual(styleStore["--map-label-size"], "12.5px");
assert.strictEqual(styleStore["--poi-glyph-size"], `${z12.poiGlyphPx}px`);

// 4. Verify integration hooks in map-engine.js, label-engine.js, poi-engine.js
assert(mapJs.includes("applyMapZoomVisualVars(map.getZoom())"), "map-engine.js must sync CSS zoom vars on init and zoomend");
assert(labelJs.includes("computeMapZoomScaleMetrics"), "label-engine.js must reuse computeMapZoomScaleMetrics for unified label sizing");
assert(!poiJs.includes(".innerHTML"), "poi-engine.js must remain strictly zero-innerHTML");
assert(poiJs.includes("iconSize: [20, 20]"), "poi-engine.js should use centered [20, 20] host iconSize");

// 5. Verify CSS uses unified --map-label-size across station tips, callouts, and POI tags,
//    and uses frameless/translucent-halo POI styling instead of opaque 24px solid boxes
assert(css.includes("font-size: var(--map-label-size"), "styles.css must bind --map-label-size");
assert(css.includes("font-size: var(--poi-glyph-size"), "styles.css must bind --poi-glyph-size");
assert(css.includes("width: var(--poi-halo-size"), "styles.css must bind --poi-halo-size");
assert(!css.includes("width: 24px;\n  height: 24px;"), "Old fixed 24px opaque POI box must be removed");
assert(css.includes(".tw-poi-state-unlocked"), "Must style unlocked POI state");
assert(css.includes(".tw-poi-state-missed"), "Must style missed POI state");
assert(css.includes("dashed"), "Missed POI halo must use dashed ring for non-color-only status distinction");
assert(css.includes(".tw-poi-pin,\n  .geo-select-card") || css.includes(".tw-poi-pin {\n    transition: none"), "Must respect prefers-reduced-motion for POI pins");

// 6. Mobile pan performance regressions:
//    - Zero expensive CSS filter: drop-shadow() or radial-gradient(color-mix()) on POI pins/glyphs
assert(!/\.tw-poi-[^{]*\{[^}]*filter:\s*drop-shadow/s.test(css), "POI pins/glyphs must not use expensive CSS filter: drop-shadow()");
assert(!/\.tw-poi-pin\s*\{[^}]*radial-gradient\(/s.test(css), ".tw-poi-pin must avoid per-node radial-gradient() rasterization");
assert(css.includes("contain: layout style;"), ".tw-poi-icon-host should declare CSS layout/style containment");

//    - applyMapZoomVisualVars must skip redundant setProperty writes when zoom bucket is unchanged
let setCount = 0;
const countingHost = {
  style: {
    setProperty() { setCount++; }
  }
};
const perfSandbox = {
  Math,
  Number,
  document: { getElementById: () => countingHost }
};
vm.createContext(perfSandbox);
vm.runInContext(helperMatch[0], perfSandbox);
perfSandbox.applyMapZoomVisualVars(8);
const firstCount = setCount;
assert.strictEqual(firstCount, 6, "First zoom apply should set 6 CSS vars");
perfSandbox.applyMapZoomVisualVars(8);
assert.strictEqual(setCount, firstCount, "Pure pan at same zoom must NOT rewrite CSS custom properties");
perfSandbox.applyMapZoomVisualVars(10);
assert.strictEqual(setCount, firstCount + 6, "Zoom change should update CSS custom properties");

//    - poi-engine.js must perform viewport culling & hook into map-engine.js moveend/zoomend
assert(poiJs.includes("syncPoiViewportMarkers"), "poi-engine.js must expose syncPoiViewportMarkers for viewport culling");
assert(poiJs.includes("getPoiViewportBounds"), "poi-engine.js must compute padded viewport bounds");
assert(mapJs.includes("syncPoiViewportMarkers"), "map-engine.js must sync viewport-culled POI markers on moveend/zoomend");

//    - transport-engine.js must skip redundant classList writes on pure pan
const trJs = read("js/transport-engine.js");
assert(trJs.includes("if (mapEl.classList.contains(nextClass)) return;"), "updateTransportZoomClass must skip redundant classList churn on pure pan");

console.log("PASS: All GeoMaster POI visual scaling, frameless halo & mobile pan performance tests passed!");
