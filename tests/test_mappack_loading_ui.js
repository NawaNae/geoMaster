#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "css/styles.css"), "utf8");
const registryCode = fs.readFileSync(path.join(ROOT, "js/map-pack-registry.js"), "utf8");
const uiControlsCode = fs.readFileSync(path.join(ROOT, "js/ui-controls.js"), "utf8");

let passed = 0;
let failed = 0;

function check(cond, name, detail = "") {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL [${name}]: ${detail}`);
  }
}

class MockClassList {
  constructor(initial = []) {
    this._set = new Set(initial);
  }
  add(...cls) {
    cls.forEach((c) => c && this._set.add(c));
  }
  remove(...cls) {
    cls.forEach((c) => this._set.delete(c));
  }
  toggle(c, force) {
    if (force === undefined) {
      if (this._set.has(c)) {
        this._set.delete(c);
        return false;
      }
      this._set.add(c);
      return true;
    }
    if (force) this._set.add(c);
    else this._set.delete(c);
    return Boolean(force);
  }
  contains(c) {
    return this._set.has(c);
  }
  toArray() {
    return Array.from(this._set);
  }
}

class MockElement {
  constructor(tag = "div", id = "", initialClasses = []) {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.classList = new MockClassList(initialClasses);
    this.attributes = {};
    this.children = [];
    this.textContent = "";
    this.listeners = {};
    this.style = {};
    this.disabled = false;
  }
  set className(val) {
    this.classList = new MockClassList(String(val || "").split(/\s+/).filter(Boolean));
  }
  get className() {
    return this.classList.toArray().join(" ");
  }
  setAttribute(k, v) {
    this.attributes[k] = String(v);
  }
  getAttribute(k) {
    return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null;
  }
  removeAttribute(k) {
    delete this.attributes[k];
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  replaceChildren(...nodes) {
    this.children = nodes.slice();
  }
  addEventListener(type, fn) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(fn);
  }
  click() {
    (this.listeners.click || []).forEach((fn) => fn({ target: this, preventDefault() {} }));
  }
  querySelector(sel) {
    if (sel.startsWith(".")) {
      const cls = sel.slice(1);
      for (const ch of this.children) {
        if (ch.classList && ch.classList.contains(cls)) return ch;
        const nested = ch.querySelector ? ch.querySelector(sel) : null;
        if (nested) return nested;
      }
    }
    return null;
  }
}

function buildSandbox(extraGlobals = {}) {
  const elements = {
    "mappack-selector-section": new MockElement("div", "mappack-selector-section", ["hidden"]),
    "mappack-selector-grid": new MockElement("div", "mappack-selector-grid"),
    "mappack-loading-status": new MockElement("div", "mappack-loading-status", ["hidden"]),
    "mappack-loading-text": new MockElement("span", "mappack-loading-text"),
    "unified-settings-panel": new MockElement("div", "unified-settings-panel"),
    "map-loading-overlay": new MockElement("div", "map-loading-overlay", ["hidden"]),
    "map-loading-text": new MockElement("div", "map-loading-text")
  };

  const eventsLog = [];
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    Promise,
    Set,
    Map,
    Array,
    Object,
    String,
    Boolean,
    Number,
    Error,
    window: { GEOMASTER_PACKS: {} },
    document: {
      readyState: "loading",
      getElementById(id) {
        return elements[id] || null;
      },
      createElement(tag) {
        return new MockElement(tag);
      },
      querySelectorAll() {
        return [];
      },
      head: { appendChild() {} },
      body: { appendChild() {} }
    },
    TAIWAN_ADMIN_DATA: [{ name: "臺北市", code: "63000", towns: ["中正區"] }],
    ALL_TOWNS: [{ id: "臺北市_中正區", countyName: "臺北市", name: "中正區", baseName: "中正" }],
    state: {
      activeMapPackId: "tw_modern",
      difficulty: "casual",
      playMode: "free",
      regionQuizEnabled: true,
      stationQuizEnabled: false,
      quizStationLines: new Set(),
      selectedCounties: new Set(["臺北市"]),
      selectedTownIds: new Set(["臺北市_中正區"]),
      unlockedTowns: new Set(),
      unlockedCounties: new Set(),
      unlockedProvinces: new Set(),
      missedTowns: new Set(),
      unlockedStations: new Set(),
      missedStations: new Set(),
      unlockedPois: new Set(),
      missedPois: new Set(),
      stats: { totalAttempts: 0, correctAttempts: 0, wrongAttempts: 0, streak: 0, maxStreak: 0 },
      packOptions: { worldIncludeMicrostates: true, cnAllowSingleCharAlias: false },
      isHost: false,
      roomCode: ""
    },
    canLocalModifyGameConfig: () => true,
    setFeedback: (msg, type) => eventsLog.push({ event: "feedback", msg, type }),
    playTone: () => {},
    rebuildMapLayers: () => eventsLog.push({ event: "rebuildMapLayers" }),
    clearActiveMapLayers: () => {},
    applyMapPackViewport: () => {},
    rebuildActivePackLookupSets: () => {},
    applyActivePackFeatureGatingUI: () => {},
    updatePrefixDropdownUI: () => {},
    updateSuffixControlsUI: () => {},
    getScopeTowns: () => [],
    updateTargetBannerUI: () => {},
    renderScopeModalGrid: () => {},
    syncConfigButtonsUI: () => {},
    updateModeBadgeText: () => {},
    updateScoreAndProgressUI: () => {},
    renderSmartLabelsAndLeaderLines: () => {},
    updateRoadAndRailwayTileOverlays: () => {},
    updateTransportVisualStyles: () => {},
    refreshPoiMapLayer: () => {},
    _eventsLog: eventsLog,
    _elements: elements,
    ...extraGlobals
  };
  sandbox.window = sandbox.window || {};
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(registryCode, sandbox);

  // Extract only the map-pack switcher + loading UI helpers from ui-controls.js
  // by running ui-controls.js safely (we stub DOMContentLoaded listener)
  sandbox.document.addEventListener = () => {};
  sandbox.window.addEventListener = () => {};
  vm.runInContext(uiControlsCode, sandbox);
  return { sandbox, elements, eventsLog };
}

(async function main() {
  // 1. Static HTML / CSS / zero-innerHTML checks
  check(html.includes('id="mappack-loading-status"'), "HTML.StatusPill", "index.html should contain #mappack-loading-status");
  check(html.includes('id="mappack-loading-text"'), "HTML.StatusText", "index.html should contain #mappack-loading-text");
  check(html.includes('id="map-loading-text"'), "HTML.MapOverlayText", "index.html should contain #map-loading-text");
  check(css.includes(".mappack-spinner"), "CSS.Spinner", "styles.css should define .mappack-spinner");
  check(css.includes(".is-switching-pack"), "CSS.SwitchingClass", "styles.css should define .is-switching-pack");
  check(css.includes(".mappack-card-loading"), "CSS.CardLoading", "styles.css should define .mappack-card-loading");
  check(css.includes("prefers-reduced-motion"), "CSS.ReducedMotion", "styles.css should honor prefers-reduced-motion");
  check(!/\.innerHTML\s*=/.test(registryCode), "Security.NoInnerHTML.Registry", "map-pack-registry.js must not use .innerHTML");
  check(!/\.innerHTML\s*=/.test(uiControlsCode), "Security.NoInnerHTML.UIControls", "ui-controls.js must not use .innerHTML");

  // 2. Loading state lifecycle with deferred pack A
  const { sandbox, elements } = buildSandbox();
  check(
    vm.runInContext(`typeof getLoadingMapPackId === "function" && getLoadingMapPackId() === null`, sandbox),
    "Init.LoadingIdNull",
    "getLoadingMapPackId() should be defined and null initially"
  );

  let resolvePackA;
  let packACalls = 0;
  sandbox._makeDeferredPackA = () => {
    packACalls++;
    return new Promise((r) => {
      resolvePackA = r;
    });
  };
  vm.runInContext(
    `registerMapPack({
      id: "pack_a",
      displayName: "測試地圖 A",
      shortLabel: "🗺️ 測試A",
      badgeText: "10區",
      getGroups: () => [{ name: "G1" }],
      getItems: () => [{ id: "a1", countyName: "G1", name: "A1", baseName: "A1" }],
      ensureLoaded: () => _makeDeferredPackA(),
      loadTopoData: async () => null
    });
    renderMapPackSwitcherUI();`,
    sandbox
  );

  // Trigger click via handleMapPackSelection
  vm.runInContext(`handleMapPackSelection("pack_a");`, sandbox);
  check(
    vm.runInContext(`getLoadingMapPackId()`, sandbox) === "pack_a",
    "Loading.PendingIdSet",
    "getLoadingMapPackId() should immediately be 'pack_a'"
  );
  check(
    !elements["mappack-loading-status"].classList.contains("hidden"),
    "Loading.StatusPillVisible",
    "#mappack-loading-status should be visible while loading"
  );
  check(
    elements["mappack-loading-text"].textContent.includes("測試A"),
    "Loading.StatusTextLabel",
    `Expected #mappack-loading-text to include '測試A', got '${elements["mappack-loading-text"].textContent}'`
  );
  check(
    elements["unified-settings-panel"].classList.contains("is-switching-pack"),
    "Loading.PanelDimmed",
    "#unified-settings-panel should have .is-switching-pack while loading"
  );
  check(
    elements["unified-settings-panel"].getAttribute("aria-busy") === "true",
    "Loading.PanelAriaBusy",
    "#unified-settings-panel should have aria-busy='true' while loading"
  );
  check(
    !elements["map-loading-overlay"].classList.contains("hidden"),
    "Loading.MapOverlayVisible",
    "#map-loading-overlay should be visible during pack switch"
  );
  check(
    elements["map-loading-text"].textContent.includes("測試A"),
    "Loading.MapOverlayText",
    `Expected #map-loading-text to include '測試A', got '${elements["map-loading-text"].textContent}'`
  );

  const packABtn = elements["mappack-selector-grid"].children.find((b) => b.getAttribute("data-mappack-id") === "pack_a");
  check(Boolean(packABtn), "Loading.CardExists", "pack_a button should exist in grid");
  check(
    packABtn && packABtn.getAttribute("aria-busy") === "true",
    "Loading.CardAriaBusy",
    "Loading pack card should have aria-busy='true'"
  );
  check(
    packABtn && packABtn.classList.contains("mappack-card-loading"),
    "Loading.CardClass",
    "Loading pack card should have .mappack-card-loading"
  );
  check(
    Boolean(packABtn && packABtn.querySelector(".mappack-spinner")),
    "Loading.CardSpinner",
    "Loading pack card should render a .mappack-spinner"
  );

  // Double-tap on already loading pack should be ignored
  vm.runInContext(`handleMapPackSelection("pack_a");`, sandbox);
  check(packACalls === 1, "Loading.IgnoreDuplicateClick", `Expected packACalls=1, got ${packACalls}`);

  // Resolve Pack A
  resolvePackA();
  await new Promise((r) => setTimeout(r, 20));

  check(
    vm.runInContext(`getLoadingMapPackId()`, sandbox) === null,
    "Done.PendingIdCleared",
    "getLoadingMapPackId() should be null after switch completes"
  );
  check(
    vm.runInContext(`state.activeMapPackId`, sandbox) === "pack_a",
    "Done.ActivePackUpdated",
    "state.activeMapPackId should be 'pack_a'"
  );
  check(
    elements["mappack-loading-status"].classList.contains("hidden"),
    "Done.StatusPillHidden",
    "#mappack-loading-status should hide after completion"
  );
  check(
    !elements["unified-settings-panel"].classList.contains("is-switching-pack"),
    "Done.PanelUndimmed",
    "#unified-settings-panel should remove .is-switching-pack after completion"
  );
  check(
    elements["map-loading-overlay"].classList.contains("hidden"),
    "Done.MapOverlayHidden",
    "#map-loading-overlay should hide after completion"
  );
  const donePackABtn = elements["mappack-selector-grid"].children.find((b) => b.getAttribute("data-mappack-id") === "pack_a");
  check(
    donePackABtn && donePackABtn.getAttribute("aria-busy") !== "true",
    "Done.CardNotBusy",
    "Completed pack card should not have aria-busy='true'"
  );

  // 3. Interruptibility: click Pack B while Pack C is loading -> stale Pack C must not clear Pack B's loading UI
  let resolvePackB, resolvePackC;
  sandbox._makeDeferredPackB = () => new Promise((r) => { resolvePackB = r; });
  sandbox._makeDeferredPackC = () => new Promise((r) => { resolvePackC = r; });
  vm.runInContext(
    `registerMapPack({
      id: "pack_b",
      displayName: "測試地圖 B",
      shortLabel: "🗺️ 測試B",
      getGroups: () => [{ name: "GB" }],
      getItems: () => [{ id: "b1", countyName: "GB", name: "B1", baseName: "B1" }],
      ensureLoaded: () => _makeDeferredPackB(),
      loadTopoData: async () => null
    });
    registerMapPack({
      id: "pack_c",
      displayName: "測試地圖 C",
      shortLabel: "🗺️ 測試C",
      getGroups: () => [{ name: "GC" }],
      getItems: () => [{ id: "c1", countyName: "GC", name: "C1", baseName: "C1" }],
      ensureLoaded: () => _makeDeferredPackC(),
      loadTopoData: async () => null
    });`,
    sandbox
  );

  vm.runInContext(`handleMapPackSelection("pack_c");`, sandbox);
  check(vm.runInContext(`getLoadingMapPackId()`, sandbox) === "pack_c", "Interrupt.PackCStarted", "pack_c loading");
  vm.runInContext(`handleMapPackSelection("pack_b");`, sandbox);
  check(vm.runInContext(`getLoadingMapPackId()`, sandbox) === "pack_b", "Interrupt.PackBSupersedes", "pack_b supersedes pack_c");
  check(
    elements["mappack-loading-text"].textContent.includes("測試B"),
    "Interrupt.StatusShowsB",
    "Loading status should now show 測試B"
  );

  // Resolve stale Pack C first -> loading UI must STAY visible for Pack B!
  resolvePackC();
  await new Promise((r) => setTimeout(r, 20));
  check(
    vm.runInContext(`getLoadingMapPackId()`, sandbox) === "pack_b",
    "Interrupt.StaleCDoesNotClearB",
    "Stale pack_c resolution must not clear pack_b loading state"
  );
  check(
    !elements["mappack-loading-status"].classList.contains("hidden"),
    "Interrupt.StatusStaysVisibleForB",
    "#mappack-loading-status must stay visible while pack_b is still loading"
  );

  // Now resolve Pack B -> finishes cleanly
  resolvePackB();
  await new Promise((r) => setTimeout(r, 20));
  check(vm.runInContext(`state.activeMapPackId`, sandbox) === "pack_b", "Interrupt.FinalActiveIsB", "Active pack should be pack_b");
  check(vm.runInContext(`getLoadingMapPackId()`, sandbox) === null, "Interrupt.FinalLoadingNull", "Loading ID cleared after pack_b finishes");
  check(elements["mappack-loading-status"].classList.contains("hidden"), "Interrupt.FinalStatusHidden", "Status pill hidden after pack_b finishes");

  // 4. Interrupt back to currently active pack (pack_b -> start pack_c -> immediately click pack_b again)
  vm.runInContext(`handleMapPackSelection("pack_c");`, sandbox);
  check(vm.runInContext(`getLoadingMapPackId()`, sandbox) === "pack_c", "CancelBack.PackCStarted", "pack_c started");
  vm.runInContext(`handleMapPackSelection("pack_b");`, sandbox);
  check(vm.runInContext(`getLoadingMapPackId()`, sandbox) === "pack_b", "CancelBack.AllowsClickingActive", "Clicking active pack_b while pack_c is loading should supersede pack_c");
  resolvePackB();
  resolvePackC();
  await new Promise((r) => setTimeout(r, 20));
  check(vm.runInContext(`state.activeMapPackId`, sandbox) === "pack_b", "CancelBack.RemainsPackB", "Active pack remains pack_b");
  check(vm.runInContext(`getLoadingMapPackId()`, sandbox) === null, "CancelBack.Cleared", "Loading state cleared");

  // 5. Error recovery: ensureLoaded() rejects -> loading UI must always clean up
  vm.runInContext(
    `registerMapPack({
      id: "pack_fail",
      displayName: "失敗地圖",
      shortLabel: "⚠️ 失敗",
      getGroups: () => [],
      getItems: () => [],
      ensureLoaded: () => Promise.reject(new Error("network_down")),
      loadTopoData: async () => null
    });`,
    sandbox
  );
  vm.runInContext(`handleMapPackSelection("pack_fail");`, sandbox);
  await new Promise((r) => setTimeout(r, 20));
  check(vm.runInContext(`getLoadingMapPackId()`, sandbox) === null, "Error.LoadingCleared", "Loading ID must clear on error");
  check(elements["mappack-loading-status"].classList.contains("hidden"), "Error.StatusHidden", "Status pill must hide on error");
  check(!elements["unified-settings-panel"].classList.contains("is-switching-pack"), "Error.PanelUndimmed", "Panel must undim on error");
  check(elements["map-loading-overlay"].classList.contains("hidden"), "Error.OverlayHidden", "Map overlay must hide on error");
  check(vm.runInContext(`state.activeMapPackId`, sandbox) === "pack_b", "Error.ActiveUnchanged", "Active pack must remain pack_b on error");

  // 6. Browser paint yield: when requestAnimationFrame exists, loading UI updates BEFORE rebuildMapLayers runs
  const rafOrder = [];
  const { sandbox: rafSandbox } = buildSandbox({
    requestAnimationFrame(cb) {
      rafOrder.push("rAF");
      setTimeout(cb, 5);
    },
    rebuildMapLayers() {
      rafOrder.push("rebuildMapLayers");
    }
  });
  vm.runInContext(
    `registerMapPack({
      id: "pack_cached",
      displayName: "已快取地圖",
      shortLabel: "⚡ 快取",
      getGroups: () => [{ name: "G" }],
      getItems: () => [{ id: "g1", countyName: "G", name: "G1", baseName: "G1" }],
      ensureLoaded: async () => {},
      loadTopoData: async () => ({})
    });`,
    rafSandbox
  );
  await vm.runInContext(`switchActiveMapPack("pack_cached")`, rafSandbox);
  check(
    rafOrder[0] === "rAF" && rafOrder.includes("rebuildMapLayers"),
    "PaintYield.RafBeforeRebuild",
    `Expected rAF before rebuildMapLayers, got ${JSON.stringify(rafOrder)}`
  );

  if (failed > 0) {
    console.error(`\nFAILED: ${failed} failed, ${passed} passed.`);
    process.exit(1);
  }
  console.log(`PASS [GREEN]: All ${passed} MapPack loading UI/UX checks passed!`);
})();
