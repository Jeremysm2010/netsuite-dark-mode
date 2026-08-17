// Regression tests for content.js decision logic.
// Run with:  node test/logic.test.js
//
// Loads content.js under a fake DOM and a stubbed chrome API, then exercises the parts that
// decide *whether* and *what* to style — exclusions, scheduling, frame handling, and the CSS
// each mode emits. No browser needed; it runs in about a second.
const fs = require("fs");
const path = require("path");
const SRC = path.join(__dirname, "..", "netsuite-dark", "content.js");
const code = fs.readFileSync(SRC, "utf8");

function load({ topFrame = true, href = "https://x.app.netsuite.com/app/accounting/transactions/salesord.nl?id=9",
                topHref = null, systemDark = false, hour = 12, hiddenTab = false, stored = {} } = {}) {
  const mkLoc = (u) => { const p = new URL(u); return { href: u, pathname: p.pathname, search: p.search }; };
  const loc = mkLoc(href);
  const topLoc = mkLoc(topHref || href);
  const styleStore = {};
  const doc = {
    head: { appendChild(){}, },
    documentElement: { appendChild(){} },
    getElementById: (id) => styleStore[id] || null,
    addEventListener(){}, querySelectorAll: () => [],
    createElement: () => ({ id: "", textContent: "", parentNode: null, nextSibling: null }),
  };
  doc.head.appendChild = (el) => { styleStore[el.id] = el; el.parentNode = doc.head; };
  doc.documentElement.appendChild = (el) => { styleStore[el.id] = el; };

  const win = {};
  win.top = topFrame ? win : { location: topLoc };
  win.addEventListener = () => {};
  const sandbox = {
    window: win, document: doc, location: loc, URLSearchParams, URL, Date,
    requestAnimationFrame: (fn) => { if (!hiddenTab) fn(); },   // hidden tabs never get a frame
    setInterval: () => 0, setTimeout: (fn) => { if (!hiddenTab) fn(); return 0; },
    MutationObserver: class { observe(){} },
    chrome: {
      storage: { local: { get: (d, cb) => cb({ ...d, ...stored }) }, onChanged: { addListener(){} } },
      runtime: { onMessage: { addListener(){} } },
    },
  };
  win.matchMedia = () => ({ matches: systemDark, addEventListener(){} });
  // freeze the clock
  const RealDate = Date;
  sandbox.Date = class extends RealDate { getHours() { return hour; } };

  const wrapped = new Function("window","document","location","chrome","requestAnimationFrame",
    "setInterval","setTimeout","MutationObserver","Date","URLSearchParams",
    code + "\nreturn { active, excluded, build, pageKey, inHours, chromeShaped, filterExceptionCSS, isEmpty };")
    .call(null, win, doc, loc, sandbox.chrome, sandbox.requestAnimationFrame, sandbox.setInterval,
          sandbox.setTimeout, sandbox.MutationObserver, sandbox.Date, URLSearchParams);
  return { api: wrapped, styleStore };
}

let pass = 0, fail = 0;
const t = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n        got ${JSON.stringify(got)}  want ${JSON.stringify(want)}`}`);
};
const S = (o) => ({ enabled:true, mode:"filter", brightness:100, contrast:95, warmth:10, keepImages:true,
  schedule:"always", from:19, to:7, excludes:[], ...o });

// --- page keys -------------------------------------------------------------
let { api } = load();
t("pageKey drops noise params", api.pageKey({ pathname:"/app/accounting/transactions/salesord.nl", search:"?id=9&e=T" }),
  "/app/accounting/transactions/salesord.nl");
t("pageKey keeps script+deploy", api.pageKey({ pathname:"/app/site/hosting/scriptlet.nl", search:"?script=482&deploy=1&x=2" }),
  "/app/site/hosting/scriptlet.nl?script=482&deploy=1");

// --- exclusions ------------------------------------------------------------
t("no excludes -> active", api.active(S()), true);
t("path prefix excludes", api.active(S({ excludes:["/app/accounting/transactions/salesord.nl"] })), false);
t("unrelated exclude ignored", api.active(S({ excludes:["/app/accounting/print/"] })), false === true ? false : true);

({ api } = load({ href:"https://x.app.netsuite.com/app/site/hosting/scriptlet.nl?script=482&deploy=1" }));
t("suitelet A excluded by its own key", api.active(S({ excludes:["/app/site/hosting/scriptlet.nl?script=482&deploy=1"] })), false);
({ api } = load({ href:"https://x.app.netsuite.com/app/site/hosting/scriptlet.nl?script=999&deploy=1" }));
t("different suitelet NOT excluded", api.active(S({ excludes:["/app/site/hosting/scriptlet.nl?script=482&deploy=1"] })), true);

// --- iframe follows the top page ------------------------------------------
({ api } = load({ topFrame:false, href:"https://x.app.netsuite.com/app/common/search/searchresults.nl",
                  topHref:"https://x.app.netsuite.com/app/accounting/print/hotlist.nl" }));
t("iframe inherits top-page exclusion", api.active(S({ mode:"native", excludes:["/app/accounting/print/hotlist.nl"] })), false);

// --- schedule --------------------------------------------------------------
({ api } = load({ hour:22 }));
t("hours 19->7 at 22:00 on", api.active(S({ schedule:"hours", from:19, to:7 })), true);
({ api } = load({ hour:12 }));
t("hours 19->7 at 12:00 off", api.active(S({ schedule:"hours", from:19, to:7 })), false);
({ api } = load({ hour:3 }));
t("hours 19->7 at 03:00 on (wrap)", api.active(S({ schedule:"hours", from:19, to:7 })), true);
({ api } = load({ hour:9 }));
t("hours 9->17 at 09:00 on", api.active(S({ schedule:"hours", from:9, to:17 })), true);
t("from==to means always", api.active(S({ schedule:"hours", from:9, to:9 })), true);
({ api } = load({ systemDark:true }));
t("system dark on", api.active(S({ schedule:"system" })), true);
({ api } = load({ systemDark:false }));
t("system light off", api.active(S({ schedule:"system" })), false);
t("master switch wins", api.active(S({ enabled:false })), false);

// --- css emission ----------------------------------------------------------
({ api } = load());
t("top frame filter mode emits filter", /filter: invert\(1\)/.test(api.build(S())), true);
t("filter css re-inverts images when keepImages", /img, picture, video, svg image/.test(api.build(S())), true);
t("filter css skips image rule when off", /img, picture, video, svg image/.test(api.build(S({ keepImages:false }))), false);
t("charts on canvas stay inverted, not un-inverted", /canvas/.test(api.build(S())), false);
({ api } = load({ topFrame:false, href:"https://x.app.netsuite.com/app/common/search/searchresults.nl" }));
t("subframe carries NO root filter (no double invert)", /html \{ filter:/.test(api.build(S())), false);
t("subframe DOES carry exceptions (images in frames)", /invert\(1\) hue-rotate\(180deg\) !important/.test(api.build(S())), true);
t("subframe DOES emit in native mode", /color-scheme: dark/.test(api.build(S({ mode:"native" }))), true);

// --- already-dark region detection ----------------------------------------
({ api } = load());
const R = (w,h) => ({ width:w, height:h });
t("header band qualifies",        api.chromeShaped(R(1400, 44)),  true);
t("nav band qualifies",           api.chromeShaped(R(1400, 34)),  true);
t("side rail qualifies",          api.chromeShaped(R(280, 800)),  true);
t("page wrapper rejected",        api.chromeShaped(R(1400, 900)), false);
t("record body rejected",         api.chromeShaped(R(1200, 600)), false);
t("tiny chip rejected",           api.chromeShaped(R(60, 20)),    false);
t("thin divider rejected",        api.chromeShaped(R(1400, 8)),   false);

t("keepDark on emits keep rule",  /\.nsdm-keep-dark \{ filter:/.test(api.filterExceptionCSS(S())), true);
t("keepDark off omits keep rule", /\.nsdm-keep-dark \{ filter:/.test(api.filterExceptionCSS(S({ keepDark:false }))), false);
t("images excluded inside kept-dark", /:not\(\.nsdm-keep-dark \*\)/.test(api.filterExceptionCSS(S())), true);
t("no background-image un-invert rule", /background-image/.test(api.filterExceptionCSS(S())), false);

// --- hidden tabs: styling must not be gated behind requestAnimationFrame -----
// Chrome never fires rAF in a background tab, and NetSuite records get cmd-clicked into
// background tabs constantly. Gating on rAF left those tabs unstyled until focused.
{
  const { styleStore } = load({ hiddenTab: true, stored: { mode: "native" } });
  const css = (styleStore["nsdm-style"] || {}).textContent || "";
  t("hidden tab still gets styled (no frame, no timer)", css.includes("color-scheme: dark"), true);
  t("hidden tab css is not just the bootstrap", css.length > 200, true);
}
{
  const { styleStore } = load({ hiddenTab: true });
  const css = (styleStore["nsdm-style"] || {}).textContent || "";
  t("hidden tab filter mode styled too", /html \{ filter: invert\(1\)/.test(css), true);
}

// --- empty-element rule that keeps the wrapper fix safe ----------------------
({ api } = load());
t("empty element qualifies",        api.isEmpty({ textContent: "" }),          true);
t("whitespace-only qualifies",      api.isEmpty({ textContent: "\n   \t " }), true);
t("element with text is spared",    api.isEmpty({ textContent: "Reminders" }), false);
t("nested text is still text",      api.isEmpty({ textContent: " 1000 Truist Checking " }), false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
