// NetSuite Dark Mode content script. Runs at document_start in every frame.

const STYLE_ID = "nsdm-style";
const DEFAULTS = {
  enabled: true,
  mode: "filter",        // "filter" | "native"
  brightness: 100, contrast: 95, warmth: 10,
  keepImages: true,
  keepDark: true,        // leave already-dark NetSuite chrome dark instead of inverting it bright
  schedule: "always",    // "always" | "system" | "hours"
  from: 19, to: 7,       // hours mode, 24h clock
  excludes: []           // pathname prefixes to leave light
};

/* ---------- Filter mode ----------
   The whole page is inverted at the root, then specific things are inverted a second time
   to bring them back. Two rules matter, and both were learned the hard way:

   1. A `filter` on an element applies to its ENTIRE SUBTREE, so un-inverting a container
      drags all of its contents back to light. Only ever un-invert leaves (images) or a
      region you genuinely want to look untouched (chrome NetSuite already draws dark).
   2. A `filter` on an element makes it a containing block for absolutely positioned
      descendants. Sprinkling it over arbitrary containers mispositions NetSuite's
      dropdowns and popups. Keep the set small and deliberate.                            */

const KEEP = "nsdm-keep-dark";              // marks regions NetSuite already draws dark

function filterRootCSS(s) {
  const base = `invert(1) hue-rotate(180deg) brightness(${s.brightness}%) contrast(${s.contrast}%) sepia(${s.warmth}%)`;
  return `html { filter: ${base} !important; background: #fff !important; }`;
}
function filterExceptionCSS(s) {
  const un = `invert(1) hue-rotate(180deg)`;
  const media = `img, picture, video, svg image`;
  return `
/* Regions NetSuite already renders dark. Inverting them turns them into glaring light
   bands, so invert them back and they keep the dark look NetSuite shipped. */
${s.keepDark === false ? "" : `.${KEEP} { filter: ${un} !important; }`}

/* Images. Skipped inside kept-dark regions, which have already been flipped back once —
   a second flip there would show the image as a negative. */
${s.keepImages ? `:is(${media}):not(.${KEEP}):not(.${KEEP} *) { filter: ${un} !important; }` : ""}

/* Saturated status bands read badly inverted. Take the edge off instead. */
.ns-header-sandbox, .ns-sandbox-banner { filter: grayscale(0.4) !important; }
`;
}

/* ---------- Native mode (targeted at NetSuite Redwood + classic UIR) ---------- */
function nativeCSS() {
  const bg = "#15181c", surface = "#1c2025", raised = "#23282e", line = "#30363d";
  const text = "#d9dde2", muted = "#98a0aa", link = "#78b7f0", accent = "#2f8f83", accentText = "#ffffff";
  const rowAlt = "#1a1e23", rowHover = "#262c33", selected = "#20313a";
  return `
:root { color-scheme: dark; }
html, body { background: ${bg} !important; color: ${text} !important; }

/* Kill NetSuite's inline whites and light greys wherever they show up */
[bgcolor], [style*="background-color: rgb(255"], [style*="background-color:#fff"], [style*="background: #fff"],
[style*="background-color: white"], [style*="background:white"] { background-color: ${surface} !important; }
table, td, th, tr, tbody, div, span, form, fieldset, section, nav, ul, li, label, legend, p, h1, h2, h3, h4 {
  border-color: ${line} !important; }
body, td, th, div, span, p, label, li, h1, h2, h3, h4, .uir-label, .smalltext, .text, .textbold, .listtext,
.uir-field-wrapper, .uir-page-title-firstline, .uir-record-type, .uir-page-title, .n-header, .n-nav { color: ${text}; }

/* Header + global nav (Redwood) */
.ns-header, #ns-header, .ns-header-menu, .ns-header-menu-main, .ns-header-menu-secondary, .ns-role-menu,
.ns-header-cross-app-links, .ns-header-nav, .n-header, .n-header-container, .n-role, .n-search {
  background: ${surface} !important; color: ${text} !important; border-color: ${line} !important; }
.ns-header-menu-main-item, .ns-menu-main-item, .ns-header-menu-item, .ns-header-menu-main a,
.n-nav a, .n-nav li { color: ${text} !important; background: transparent !important; }
.ns-header-menu-main-item:hover, .ns-menu-main-item:hover, .ns-header-menu-main-item.ns-active,
.ns-menu-main-item.ns-menu-main-item-selected, .n-nav li.selected { background: ${raised} !important; }
.ns-header-searchbox, .ns-header-search, .ns-header-search-input, input#_searchstring, .n-search input {
  background: ${raised} !important; color: ${text} !important; border: 1px solid ${line} !important; }
.ns-header-sandbox, .ns-sandbox-banner { background: #5b4b1c !important; color: #f4e6b6 !important; }
.ns-header-logo, .ns-logo, .ns-header-logo-container { background: transparent !important; }

/* Page title bar, action links, tabs */
.uir-page-title-container, .uir-page-title, .uir-page-title-firstline, .uir-page-title-secondline,
.uir-header-buttons, .uir-list-header, .uir-record-type-heading, .n-page-title, .n-page-header,
.n-tab-container, .n-tabs, .formtabgroup, .formtabs, .uir-tab-container, .uir-tabs {
  background: ${bg} !important; color: ${text} !important; }
.formtab, .formtabtext, .formtabselected, .formtabtextselected, .n-tab, .n-tab a, .uir-tab, .uir-tab a {
  background: ${surface} !important; color: ${muted} !important; border-color: ${line} !important; }
.formtabselected, .formtabtextselected, .n-tab-selected, .n-tab.selected, .uir-tab-active, .uir-tab-active a {
  background: ${raised} !important; color: ${text} !important; box-shadow: inset 0 -2px 0 ${accent} !important; }

/* Dashboard portlets */
.ns-portlet, .ns-portlet-container, .ns-portlet-content, .ns-portlet-body, .uir-portlet, .uir-portlet-content,
.portlet, .portletcontent, .n-portlet, .n-portlet-body, .ns-dashboard-portlet, .ns-dashboard-column,
.ns-dashboard, .n-dashboard, .n-dashboard-column, [class*="portlet"][class*="container"] {
  background: ${surface} !important; color: ${text} !important; border-color: ${line} !important; box-shadow: none !important; }
.ns-portlet-header, .ns-portlet-title, .uir-portlet-header, .portlettitle, .n-portlet-header, .n-portlet-title,
.ns-portlet-nav, .portletheader { background: ${surface} !important; color: ${text} !important; border-color: ${line} !important; }
.ns-portlet-nav a, .ns-portlet-header a, .ns-portlet-actions a, .n-portlet-header a { color: ${muted} !important; }
.ns-portlet-nav a:hover, .ns-portlet-header a:hover { color: ${text} !important; }
/* decorative corner artwork in empty portlets */
.ns-portlet-empty-state, .ns-portlet-nosetup, [class*="empty-state"] img,
[class*="portlet"] [style*="background-image"] { background-image: none !important; opacity: .35; }

/* Calendar portlet */
.n-calendar, .ns-calendar, .uir-calendar, [class*="calendar"] { color: ${text} !important; }
[class*="calendar"] td, [class*="calendar"] th, .n-calendar-day, .n-calendar-header, .n-calendar-week-row {
  background: ${surface} !important; color: ${text} !important; border-color: ${line} !important; }
.n-calendar-today, .n-calendar-day.today, [class*="calendar"] [class*="today"], [class*="calendar"] [class*="selected"] {
  background: ${selected} !important; box-shadow: inset 0 0 0 1px ${accent} !important; }
[class*="calendar"] [class*="weekend"], [class*="calendar"] [class*="other-month"] { color: ${muted} !important; }

/* Lists and saved searches (transaction lists, item lists, search results) */
.uir-list-headerrow, .listheader, .listheadertext, .listheadertextb, .listheadertextctr, .listheadertextrt,
.uir-list-headerrow td, .uir-list-headerrow th, .uir-machine-headerrow, .uir-machine-headerrow td,
table.listtable th, .listtable .listheader, .n-list-header, .n-list-header th {
  background: ${raised} !important; color: ${text} !important; border-color: ${line} !important; }
tr.uir-list-row-even, tr.uir-list-row-even td, .uir-list-row-tr:nth-child(odd) td, .listtable tr:nth-child(odd) td,
.uir-machine-row-even td { background: ${bg} !important; }
tr.uir-list-row-odd, tr.uir-list-row-odd td, .uir-list-row-tr:nth-child(even) td, .listtable tr:nth-child(even) td,
.uir-machine-row-odd td { background: ${rowAlt} !important; }
.uir-list-row-tr:hover td, .uir-list-row-tr.uir-list-row-hover td, tr.uir-list-row-even:hover td,
tr.uir-list-row-odd:hover td, .listtable tr:hover td { background: ${rowHover} !important; }
.listtext, .listtextb, .listtextctr, .listtextrt, .listtextnowrap, td.text, td.textbold, .uir-list-row-cell {
  color: ${text} !important; border-color: ${line} !important; }
.uir-list-filter, .uir-list-filter-container, .uir-list-filters, .n-list-filter, .uir-list-toolbar, .n-list-toolbar,
.uir-list-header-buttons, .listtoolbar, .uir-machine-toolbar, [class*="filter"][class*="container"] {
  background: ${surface} !important; color: ${text} !important; border-color: ${line} !important; }
.uir-list-quicksort, .uir-list-quicksort select, .n-quick-sort { color: ${text} !important; }
.uir-list-total, .n-total, .uir-machine-total { color: ${muted} !important; }

/* Record forms */
#main_form, .uir-page, .uir-body, #div__body, .uir-record, .n-record, .uir-form, .n-form,
.uir-field-wrapper, .uir-field-wrapper-inline, .n-field, .uir-machine-table-container, .uir-machine-table,
.uir-outside-fields-table, .uir-collapsible, .uir-collapsible-header, .uir-collapsible-body,
.n-section, .n-section-header, .n-fieldgroup, .fieldgroup, .fieldset { background: ${bg} !important; color: ${text} !important; border-color: ${line} !important; }
.uir-collapsible-header, .n-section-header, .fieldgroup-title, .uir-fieldgroup-title { background: ${surface} !important; }
.uir-label, .uir-label span, .fieldlabel, .labelSpanEdit, .smalltextnolink, .n-label, label { color: ${muted} !important; }
.uir-required-icon, .uir-required { color: #ff8b8b !important; }
.uir-field-input, .inputreadonly, .input, .textboxinput, .dropdownInput, .dropdownDiv, .dropdownDivH,
input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]), textarea, select,
.n-input, .n-select, .n-textarea, .n-datepicker input, .uir-datepicker input {
  background: ${raised} !important; color: ${text} !important; border: 1px solid ${line} !important; box-shadow: none !important; }
input::placeholder, textarea::placeholder { color: ${muted} !important; }
input:focus, textarea:focus, select:focus, .n-input:focus { outline: 2px solid ${accent} !important; outline-offset: -1px; }
input[type=checkbox], input[type=radio] { accent-color: ${accent}; }
.inputreadonly, .uir-field-wrapper-readonly, .n-readonly { background: ${surface} !important; color: ${muted} !important; }
/* dropdown menus (custom NS dropdowns) */
.dropdownDiv, .dropdownDivH, .dropdownDivH div, .dropdownDivC, .n-dropdown, .n-dropdown-menu, .uir-dropdown-menu, .ns-menu,
.uir-menu, .ns-header-menu-panel, .n-menu, .contextmenu, .contextmenuitem { background: ${raised} !important; color: ${text} !important; border-color: ${line} !important; }
.dropdownSelected, .n-dropdown-item:hover, .uir-menu-item:hover, .contextmenuitem:hover, .ns-menu-item:hover { background: ${selected} !important; }

/* Buttons */
.rndbuttoninpt, .bntBgB, .bntBgT, .bntBg, .n-button, .uir-button, .pgBntG, .pgBntB, .rndbuttoninpt.bntBgT,
input[type=button], input[type=submit], button, .uir-list-toolbar a.button, .n-toolbar-button {
  background: ${raised} !important; color: ${text} !important; border: 1px solid ${line} !important; box-shadow: none !important; }
.rndbuttoninpt:hover, .n-button:hover, .uir-button:hover, button:hover, input[type=button]:hover { background: ${selected} !important; }
.pgBntB, .rndbuttoninpt.bntBgB, .uir-button-primary, .n-button-primary, .n-button.primary, #newrec, #submitter, #btn_multibutton_submitter,
input[value="Save"], input[value="Submit"], input[value="New Transaction"] { background: ${accent} !important; color: ${accentText} !important; border-color: ${accent} !important; }
.n-toggle, .uir-toggle, .n-switch { background: ${line} !important; }
.n-toggle.on, .uir-toggle.on, .n-switch.on { background: ${accent} !important; }

/* Links */
a, a:visited, .dottedlink, .smalltextul, .uir-field-wrapper a, .listtext a, .n-link { color: ${link} !important; }
a:hover { color: #a5d0f7 !important; }

/* Alerts, tooltips, popups, dialogs, footer */
.uir-alert-box, .ns-alert, .alertbox, .n-alert, .n-toast, .uir-popup, .n-popup, .n-dialog, .n-modal, .x-window, .x-panel,
.uir-dialog, .dialog, .uir-tooltip, .n-tooltip, .ns-tooltip, .x-tip { background: ${raised} !important; color: ${text} !important; border-color: ${line} !important; }
.uir-alert-box.warning, .n-alert-warning { border-left: 3px solid #d9a441 !important; }
.uir-alert-box.error, .n-alert-error { border-left: 3px solid #d95c5c !important; }
.uir-alert-box.confirmation, .n-alert-success { border-left: 3px solid ${accent} !important; }
.n-footer, .uir-footer, #div__footer, .ns-footer, .copyright { color: ${muted} !important; background: transparent !important; }

/* Icons that are dark-on-transparent PNG/SVG get lost. Lift them. */
.ns-header-menu img, .uir-header-buttons img, .uir-list-toolbar img, .n-toolbar img, .n-page-header img,
img[src*="icon"], img[src*="Icon"], img[src*="i/"], svg.n-icon, .n-icon svg { filter: invert(0.85) hue-rotate(180deg) !important; }
img[src*="logo"], .ns-logo img, .ns-header-logo img { filter: none !important; }

/* Scrollbars */
::-webkit-scrollbar { width: 12px; height: 12px; }
::-webkit-scrollbar-track { background: ${bg}; }
::-webkit-scrollbar-thumb { background: ${line}; border-radius: 6px; border: 3px solid ${bg}; }
::-webkit-scrollbar-thumb:hover { background: ${muted}; }
`;
}

/* ---------- Effective state ---------- */
const isTop = window.top === window;
let current = { ...DEFAULTS };
let pending = false;
let booted = false;            // true once real settings have arrived
const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

function inHours(from, to) {
  if (from === to) return true;                    // a zero-length window means "always"
  const h = new Date().getHours();
  return from < to ? (h >= from && h < to) : (h >= from || h < to);
}

/* A page's identity for exclusions. Most NetSuite screens are identified by pathname,
   but every Suitelet lives at the same path and differs only by script/deploy, so keep those. */
function pageKey(loc) {
  const q = new URLSearchParams(loc.search || "");
  const keep = ["script", "deploy"].filter(k => q.get(k)).map(k => `${k}=${q.get(k)}`);
  return loc.pathname + (keep.length ? "?" + keep.join("&") : "");
}
/* Frames must follow the decision made for the page the user actually sees. */
function ownerLocation() {
  if (isTop) return location;
  try { void window.top.location.pathname; return window.top.location; } catch { return location; }
}
function excluded(list) {
  const key = pageKey(ownerLocation());
  return (list || []).some(x => x && key.startsWith(x));
}
function active(s) {
  if (!s.enabled) return false;
  if (excluded(s.excludes)) return false;
  if (s.schedule === "system") return !!(mq && mq.matches);
  if (s.schedule === "hours") return inHours(Number(s.from), Number(s.to));
  return true;
}
function build(s) {
  if (!active(s)) return "";
  // In filter mode only the top document carries the root filter — frames are painted
  // through it, so filtering them again would double invert. The exceptions still have to
  // be emitted per frame, or images and dark chrome inside NetSuite's iframes stay wrong.
  if (s.mode === "filter") return (isTop ? filterRootCSS(s) : "") + filterExceptionCSS(s);
  return nativeCSS();
}

/* ---------- Find the regions NetSuite already draws dark ----------
   Which parts of NetSuite are dark depends on the account's colour theme, so this is
   measured rather than guessed with a selector list. Scans the top few levels of the tree
   only, which is where page chrome lives, and stops at the first dark ancestor so we never
   flip a container and its child twice. */
function bgLuminance(el) {
  const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
  if (!m) return null;
  if (m.length > 3 && Number(m[3]) < 0.6) return null;   // see-through: what's behind decides
  return (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255;
}
/* A band or a side rail, not a page wrapper. Flipping a wrapper would drag the whole
   record back to light, which is the bug this mode used to have. */
function chromeShaped(r) {
  if (r.width < 120 || r.height < 24) return false;
  if (r.height <= 220) return true;
  return r.width <= 360 && r.height >= 200;
}
function tagDarkRegions() {
  if (!document.body) return;
  const wanted = current.mode === "filter" && current.keepDark !== false && active(current);
  const found = new Set();
  if (wanted) {
    let level = [document.body], depth = 0, budget = 3000;
    while (level.length && depth < 7 && budget > 0) {
      const next = [];
      for (const el of level) {
        if (--budget < 0) break;
        const l = bgLuminance(el);
        if (l !== null && l < 0.35 && chromeShaped(el.getBoundingClientRect())) { found.add(el); continue; }
        for (const c of el.children) next.push(c);
      }
      level = next; depth++;
    }
  }
  for (const el of document.querySelectorAll("." + KEEP)) if (!found.has(el)) el.classList.remove(KEEP);
  for (const el of found) el.classList.add(KEEP);
}

function styleEl() {
  let el = document.getElementById(STYLE_ID);
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    (document.head || document.documentElement).appendChild(el);
  }
  return el;
}
function apply(s) {
  const el = styleEl();
  const css = build(s);
  if (el.textContent !== css) el.textContent = css;
}
function schedule(patch) {
  current = { ...current, ...patch };
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; apply(current); tagDarkRegions(); });
}

/* NetSuite paints portlets and frame content well after load, so re-measure a few times
   instead of running a permanent observer over a very large DOM. */
function rescanLater() { [400, 1500, 4000].forEach(ms => setTimeout(tagDarkRegions, ms)); }
document.addEventListener("DOMContentLoaded", () => { tagDarkRegions(); rescanLater(); });
window.addEventListener("load", rescanLater);

/* Storage is async, so the first paint can land before settings arrive. Paint a neutral
   dark background synchronously at document_start; the real CSS replaces it milliseconds
   later. Top frame only: a dark frame background would invert to white under filter mode. */
if (isTop) styleEl().textContent = `html, body { background: #15181c !important; }`;

chrome.storage.local.get(DEFAULTS, (s) => { booted = true; schedule({ ...DEFAULTS, ...s }); });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  const patch = {};
  for (const k in changes) {
    const v = changes[k].newValue;
    patch[k] = v === undefined ? DEFAULTS[k] : v;    // storage.clear() must fall back, not blank out
  }
  schedule(patch);
});
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (!msg) return;
  if (msg.type === "nsdm-preview") schedule(msg.settings);
  if (msg.type === "nsdm-where" && isTop) {
    reply({ key: pageKey(location), pathname: location.pathname, active: booted && active(current) });
  }
});
if (mq) mq.addEventListener("change", () => schedule({}));
setInterval(() => { if (current.schedule === "hours") schedule({}); }, 60000);

/* Re-add our style if the page tears it out, and keep it last in <head> so NetSuite's own
   stylesheets (loaded after us at document_start) can't win an !important tie on order. */
let headWatched = false;
function watchHead() {
  if (headWatched || !document.head) return;
  headWatched = true;
  new MutationObserver(() => {
    const el = document.getElementById(STYLE_ID);
    if (!el) return apply(current);
    if (el.parentNode !== document.head || el.nextSibling) document.head.appendChild(el);
  }).observe(document.head, { childList: true });
  const el = document.getElementById(STYLE_ID);
  if (el) document.head.appendChild(el);
}
new MutationObserver(() => {
  if (!document.getElementById(STYLE_ID)) apply(current);
  watchHead();
}).observe(document.documentElement, { childList: true });
watchHead();
