# Privacy Policy — NetSuite Dark Mode

Last updated: 2026-08-18

NetSuite Dark Mode collects nothing and sends nothing. There are no network calls,
analytics, telemetry, or remote configuration anywhere in the source.

## What the extension stores
Your settings — enabled/disabled state, style mode, brightness/contrast/warmth,
schedule, and the list of pages you've chosen to keep light — are stored with the
browser's built-in `chrome.storage.local` API. This data:

- stays on your machine, inside your browser profile
- is never transmitted anywhere, by this extension or otherwise
- is never sold, shared, or used for tracking, because none of that machinery exists
  in the code

## Permissions and why they're needed
- **`storage`** — to save the preferences above locally so they persist between
  browser sessions.
- **Host access to `*.netsuite.com`** — to run the content script that restyles
  NetSuite pages. The script only reads and modifies the page's own styling
  (CSS filters, class names, inline styles); it does not read, collect, or transmit
  any business data, records, or credentials from your NetSuite account.

## Third parties
None. The extension does not integrate with any third-party service, SDK, or
analytics provider.

## Changes
If this policy ever changes, the update will be reflected here and in the
extension's version history in [README.md](README.md).

## Contact
Open an issue at the project's GitHub repository:
https://github.com/Jeremysm2010/netsuite-dark-mode/issues
