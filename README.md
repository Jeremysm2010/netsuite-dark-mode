# NetSuite Dark Mode

A Chrome/Edge extension that makes NetSuite dark, with a popup to control brightness,
contrast, warmth, scheduling, and per-page exclusions. No build step, no dependencies, and
it never talks to the network.

> Not affiliated with, endorsed by, or sponsored by Oracle. NetSuite and Oracle are
> trademarks of Oracle Corporation. This is an independent, cosmetic browser extension that
> only changes how pages are displayed in your own browser.

<!-- Add a screenshot here — for a visual extension it does more than any paragraph.
     Drop a PNG in docs/ and reference it:  ![Popup](docs/popup.png) -->

## Install

**From a release (recommended)** — download the zip from the
[Releases](../../releases) page and unzip it somewhere permanent.

**From source** — clone this repository. The extension itself lives in `netsuite-dark/`.

Then:

1. Go to `chrome://extensions` (or `edge://extensions`).
2. Turn on Developer mode (top right).
3. Click **Load unpacked** and pick the `netsuite-dark` folder.
4. Pin the extension. Open any NetSuite page and click the icon.

Chrome reads an unpacked extension from that path at every launch, so keep the folder
somewhere stable — not Downloads, and ideally not inside a cloud-sync folder that can
evict files or change its path.

After editing any file, click **Reload** on the card at `chrome://extensions`, then reload
your NetSuite tab. Changing `manifest.json` always needs the extension reload.

## Privacy

The extension collects nothing and sends nothing. There are no network calls in the source
— no analytics, no telemetry, no remote configuration. Your settings are stored with
`chrome.storage.local`, which stays on your machine and in your browser profile. It requests
exactly two permissions: `storage`, and access to `*.netsuite.com` so it can restyle those
pages.

## Controls
- Enable/disable toggle. Settings persist locally, per browser profile.
- Style: **Filter** inverts the whole page and re-inverts images. Works on every NetSuite
  screen, including record forms, saved searches, iframes, and popups. **Native** restyles
  NetSuite's own elements (tables, inputs, buttons, portlets) with a hand-picked palette.
  Cleaner look, but new or unusual pages may show light patches.
- Brightness, contrast, warmth sliders (Filter only). Warmth adds a little sepia so the page
  is not blue-white on invert.
- Keep dark areas dark (Filter only): the parts of NetSuite that are already dark — the
  header and nav bars in most colour themes — would otherwise invert into glaring light
  bands. These are measured at runtime and flipped back. Turn it off to see the difference.
- Keep images true to color (Filter only): re-inverts images so logos and photos are not
  negatives. Charts drawn on `<canvas>` are deliberately left inverted, which reads as a
  proper dark chart; if a chart arrives as a PNG it will show on a light background, and
  turning this off makes it dark again. Native mode has its own icon handling and ignores
  this checkbox.
- Presets: Night, Dim, Warm (Filter only).
- Schedule: Always, With device (follows the OS dark mode setting), or Custom hours.
  Setting the same from/to hour means always on.
- Pages that stay light: remembers the current NetSuite page and leaves it light.

## Keyboard
Alt+Shift+D toggles dark mode from any tab. The toolbar icon shows an **OFF** badge when
dark mode is disabled, so the shortcut has visible feedback. Rebind or clear a conflict at
`chrome://extensions/shortcuts`.

## How page exclusions match
An excluded entry is stored as the page's path plus `script`/`deploy` when present, and a
page is excluded when its own key *starts with* a stored entry. Two consequences worth
knowing:

- Excluding one record page excludes every record of that type. `/app/accounting/transactions/salesord.nl`
  covers every sales order, not just the one open. That is usually what you want; if it isn't,
  this scheme can't express it.
- Suitelets all live at `/app/site/hosting/scriptlet.nl`, so `script` and `deploy` are kept to
  tell them apart. Excluding one Suitelet does not exclude the rest.

Entries added before 1.2 were bare paths and still match correctly.

## How Filter mode works, and its two rules
The root element is inverted, then a small set of things is inverted a second time to bring
them back. Both rules below were violated by the 1.1 CSS, which is what made the page look
half-dark with bright slabs in it:

1. **A `filter` applies to the element's entire subtree.** Un-inverting a container drags
   everything inside it back to light. Only leaves (images) or regions you genuinely want
   to look untouched may be un-inverted. The old rule un-inverted anything carrying an
   inline `background-image`, which flipped whole toolbars and their contents back to white.
2. **A `filter` makes an element a containing block for absolutely positioned descendants.**
   Applying it to arbitrary containers repositions NetSuite's dropdowns and popups relative
   to that container instead of the page. Keep the set small and deliberate.

Which regions count as "already dark" is measured, not guessed from a selector list, because
it depends on the account's colour theme. The scan walks the top seven levels of the tree —
where page chrome lives — and only accepts band-shaped or rail-shaped elements with an opaque
dark background, so a page wrapper can never be flipped. It re-runs a few times after load to
catch late-rendering portlets rather than keeping an observer on a very large DOM.

## Maintaining Native mode
The Native selector list is a best-effort map of NetSuite's classic (`uir-`, `list*`) and
newer (`ns-`, `n-`) class names. NetSuite ships UI changes several times a year, so when a
patch of light shows up:

1. Right-click the light element on the real page → Inspect.
2. Copy the class or id that carries the light `background`/`color`.
3. Add it to the matching block in `nativeCSS()` in `netsuite-dark/content.js`, reload the
   extension.

Filter mode needs none of this, which is why it stays the default.

## Notes
- Sliders push changes to the page over messaging while you drag, then write to storage once
  the drag settles (250 ms). `chrome.storage.local` has no per-minute write quota — that limit
  is on `storage.sync` — but a write per drag frame still means a storage round trip and a
  restyle per event, so the debounce stays.
- Injected at `document_start`. Because reading settings from storage is async, the top frame
  paints a neutral dark background immediately and the real CSS replaces it a few milliseconds
  later. Without that, a cold service worker start can show a white flash.
- Runs in all frames since NetSuite uses iframes for many panels. In Filter mode only the top
  document is filtered — frames are painted through it, so filtering them too would double
  invert. In Native mode every frame styles itself, and frames follow the exclusion decision
  made for the top page.
- The style element is kept last in `<head>` so NetSuite stylesheets that load after us can't
  win an `!important` tie on source order, and it is re-added if the page removes it.
- Only matches `*.netsuite.com`. Add other hosts in `netsuite-dark/manifest.json` under both
  `host_permissions` and `content_scripts.matches` if you use a custom domain.
- To tune the Native palette, edit the constants at the top of `nativeCSS()` in `content.js`.

## Repository layout

```
netsuite-dark/        the extension — this is the folder you Load unpacked
  manifest.json
  content.js          all styling logic, runs in every frame
  background.js       keyboard shortcut and toolbar badge
  popup.html/.js      the settings popup
  icons/
build.sh              builds the release zip
```

## Releasing
`./build.sh` validates the manifest and JS, then writes `netsuite-dark-mode-<version>.zip`.
Attach that to a GitHub Release. The zip is gitignored on purpose — it goes stale as soon as
a source file changes, so it is built on demand rather than committed.

## Version history
- **1.3** — Filter mode rebuilt. Removed the `[style*="background-image"]` un-invert rule
  that turned whole containers bright and broke dropdown positioning; already-dark NetSuite
  chrome is now detected and kept dark instead of inverting to glaring light bands (new
  "Keep dark areas dark" toggle); image un-inversion now also applies inside iframes, where
  it previously never ran; `canvas` no longer un-inverted, so charts stay dark.
- **1.2** — Toolbar icons and an OFF badge; anti-flash bootstrap; Suitelet-aware exclusions;
  frames follow the top page's exclusion; stylesheet kept last in `<head>`; popup widened to
  360px (the Schedule control was clipping "Custom" at 320px); popup shows live status and
  stays in sync when the shortcut toggles; `from == to` schedule no longer means "never".
- **1.1** — Keyboard toggle, presets, schedule, per-page exclusions, Native mode rebuilt for
  the newer NetSuite UI (header and menu bar, dashboard portlets, calendar, transaction lists
  with zebra rows and hover, filters bar, forms and inputs, buttons, dropdowns, alerts).

## License
MIT — see [LICENSE](LICENSE).
