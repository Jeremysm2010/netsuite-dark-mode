const DEFAULTS = { enabled: true, mode: "filter", brightness: 100, contrast: 95, warmth: 10, keepImages: true, keepDark: true,
  schedule: "always", from: 19, to: 7, excludes: [] };
const PRESETS = {
  night: { brightness: 90, contrast: 100, warmth: 6 },
  dim:   { brightness: 78, contrast: 92, warmth: 12 },
  warm:  { brightness: 96, contrast: 94, warmth: 32 }
};
const $ = (id) => document.getElementById(id);
const sliders = ["brightness", "contrast", "warmth"];
let state = { ...DEFAULTS }, tabId = null, pagePath = null, persistTimer = null;

// hour selects
const hourLabel = (h) => (h % 12 === 0 ? 12 : h % 12) + (h < 12 ? " am" : " pm");
["from", "to"].forEach(id => { for (let h = 0; h < 24; h++) { const o = document.createElement("option"); o.value = h; o.textContent = hourLabel(h); $(id).appendChild(o); } });

function segSet(containerId, attr, val) {
  document.querySelectorAll(`#${containerId} button`).forEach(b => {
    const on = b.dataset[attr] === val;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
}
function render(s) {
  $("enabled").checked = s.enabled;
  $("main").classList.toggle("off", !s.enabled);
  segSet("modes", "mode", s.mode);
  segSet("sched", "s", s.schedule);
  const filter = s.mode === "filter";
  $("filter-controls").style.display = filter ? "" : "none";
  $("native-note").style.display = filter ? "none" : "block";
  sliders.forEach(k => { $(k).value = s[k]; $("v-" + k).value = s[k] + "%"; });
  $("keepImages").checked = s.keepImages;
  $("keepDark").checked = s.keepDark !== false;
  $("hours").style.display = s.schedule === "hours" ? "flex" : "none";
  $("from").value = s.from; $("to").value = s.to;
  renderExcludes(s);
}
function renderExcludes(s) {
  const list = $("exlist"); list.innerHTML = "";
  (s.excludes || []).forEach(p => {
    const row = document.createElement("div");
    const code = document.createElement("code"); code.textContent = p; code.title = p;
    const btn = document.createElement("button"); btn.textContent = "×"; btn.title = "Remove"; btn.setAttribute("aria-label", "Remove " + p);
    btn.addEventListener("click", () => save({ excludes: s.excludes.filter(x => x !== p) }));
    row.append(code, btn); list.appendChild(row);
  });
  const isSkipped = pagePath && (s.excludes || []).some(x => pagePath.startsWith(x));
  $("skip").textContent = isSkipped ? "Use dark here" : "Add this page";
  $("skip").disabled = !pagePath;
  $("skip-note").textContent = pagePath ? "Current: " + pagePath.replace(/^\/app\//, "") : "Open a NetSuite tab to add a page.";
  $("skip-note").title = pagePath || "";
  updateStatus(isSkipped);
}
// Mirrors active() in content.js so the status stays right while you change settings.
function scheduleOn(s) {
  if (s.schedule === "system") return matchMedia("(prefers-color-scheme: dark)").matches;
  if (s.schedule === "hours") {
    const from = Number(s.from), to = Number(s.to), h = new Date().getHours();
    if (from === to) return true;
    return from < to ? (h >= from && h < to) : (h >= from || h < to);
  }
  return true;
}
function updateStatus(isSkipped) {
  const el = $("status");
  if (!pagePath) { el.textContent = "Changes apply live"; return; }
  if (!state.enabled) el.textContent = "Dark mode is off";
  else if (isSkipped) el.textContent = "This page stays light";
  else if (!scheduleOn(state)) el.textContent = "Off right now — schedule";
  else el.textContent = "Dark on this page";
}
function preview() {
  if (tabId !== null) chrome.tabs.sendMessage(tabId, { type: "nsdm-preview", settings: state }, () => void chrome.runtime.lastError);
}
function persist() { clearTimeout(persistTimer); persistTimer = setTimeout(() => chrome.storage.local.set(state), 250); }
function save(patch, { immediate = true } = {}) {
  state = { ...state, ...patch }; render(state); preview();
  if (immediate) chrome.storage.local.set(state); else persist();
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  tabId = tabs[0] ? tabs[0].id : null;
  if (tabId === null) return;
  chrome.tabs.sendMessage(tabId, { type: "nsdm-where" }, (r) => {
    if (chrome.runtime.lastError || !r) return;
    pagePath = r.key || r.pathname; renderExcludes(state);
  });
});
chrome.storage.local.get(DEFAULTS, (s) => { state = { ...DEFAULTS, ...s }; render(state); });

// Keep the popup honest if Alt+Shift+D or another window changes settings while it is open.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  const patch = {};
  let differs = false;
  for (const k in changes) {
    const v = changes[k].newValue === undefined ? DEFAULTS[k] : changes[k].newValue;
    if (JSON.stringify(v) !== JSON.stringify(state[k])) { patch[k] = v; differs = true; }
  }
  if (!differs) return;                     // our own write echoing back; don't fight the controls
  state = { ...state, ...patch };
  render(state);
});

$("enabled").addEventListener("change", e => save({ enabled: e.target.checked }));
$("keepImages").addEventListener("change", e => save({ keepImages: e.target.checked }));
$("keepDark").addEventListener("change", e => save({ keepDark: e.target.checked }));
document.querySelectorAll("#modes button").forEach(b => b.addEventListener("click", () => save({ mode: b.dataset.mode })));
document.querySelectorAll("#sched button").forEach(b => b.addEventListener("click", () => save({ schedule: b.dataset.s })));
document.querySelectorAll("#presets button").forEach(b => b.addEventListener("click", () => save(PRESETS[b.dataset.p])));
$("from").addEventListener("change", e => save({ from: Number(e.target.value) }));
$("to").addEventListener("change", e => save({ to: Number(e.target.value) }));
sliders.forEach(k => {
  $(k).addEventListener("input", e => save({ [k]: Number(e.target.value) }, { immediate: false }));
  $(k).addEventListener("change", e => save({ [k]: Number(e.target.value) }));
});
$("skip").addEventListener("click", () => {
  if (!pagePath) return;
  const ex = state.excludes || [];
  const skipped = ex.some(x => pagePath.startsWith(x));
  save({ excludes: skipped ? ex.filter(x => !pagePath.startsWith(x)) : [...ex, pagePath] });
});
$("reset").addEventListener("click", () => save({ ...DEFAULTS, excludes: state.excludes }));
