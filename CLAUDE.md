# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Firefox WebExtension (manifest_version 2), "Send bookmark to API" in `manifest.json`. The toolbar button POSTs the active tab's URL to a user-configured endpoint (settings page: URL + bearer token). There is no build step, package manager, bundler, or test suite — it's plain JS/HTML loaded directly by Firefox.

## Running / testing

There is no build or test command. To try changes, load the extension into Firefox as a temporary add-on:

1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Click **Load Temporary Add-on…**
3. Select `manifest.json` (for live iteration) or the packaged `bookmark-it.xpi`.

To exercise the settings page: `about:addons` → **Bookmark it!** → **⋯** → **Preferences**.

Prefer testing in an isolated temporary Firefox profile so you don't disturb the user's real browsing session, e.g.:
```
firefox -profile <temp-dir> -no-remote -new-instance "about:debugging#/runtime/this-firefox"
```

There is no GUI input-automation tool (`xdotool`/`ydotool`/`web-ext`) available in this environment, and Playwright's Firefox build does not support loading arbitrary WebExtensions — so driving the loaded add-on's UI (clicking, typing) requires either the user's manual interaction or installing/configuring new system tooling, which needs the user's sign-off first.

## Packaging the .xpi

`zip` is not installed in this environment. Rebuild `bookmark-it.xpi` with Python's `zipfile` instead, explicitly listing the files to include (avoids picking up stray files):

```python
import zipfile
files = [
    "manifest.json", "background.js", "options.html", "options.js",
    "icons/book-icon.png", "icons/book-icon-32x32.png", "icons/LICENSE",
]
with zipfile.ZipFile("bookmark-it.xpi", "w", zipfile.ZIP_DEFLATED) as z:
    for f in files:
        z.write(f)
```
The file list must match whatever `icons/` currently contains and whatever `manifest.json` references — check both before packaging, since they've changed before.
Regenerate the xpi whenever `manifest.json`, `background.js`, `options.html`, `options.js`, or the icon set changes.

## Architecture

**`manifest.json`** — declares `tabs`, `storage`, `menus`, `webRequest`, `webRequestBlocking`, and `<all_urls>` permissions (the last is required because `fetch()` targets a user-configured, arbitrary-origin URL), registers `background.js` as the background script, `options.html` via `options_ui` (opens in a tab), and the `browserAction` (toolbar button, static icon — no toggle state).

**`background.js`**:
- `currentTab` — the active tab, kept in sync via `updateAddonStateForActiveTab()`, itself wired to `browser.tabs.onUpdated`, `browser.tabs.onActivated`, and `browser.windows.onFocusChanged`.
- `sendUrl()` (bound to `browserAction.onClicked`) reads `url`/`token` from `browser.storage.local` and, if a URL is configured, `fetch()`s it with `POST`, `Authorization: Bearer <token>`, and a JSON body `{ url: currentTab.url }`. No-op if no URL is configured. Fires on every click — there's no on/off or toggle state, and the extension does not touch `browser.bookmarks` at all.
- `pendingOriginOverride` + the `browser.webRequest.onBeforeSendHeaders` listener: `Origin` is a forbidden header that `fetch()` cannot set directly, so `sendUrl()` stashes `{url: settings.url, origin: new URL(settings.url).origin}` in `pendingOriginOverride` right before calling `fetch()` — i.e. the Origin header always deterministically matches the stored URL's own origin, no separate setting needed. The blocking `webRequest` listener rewrites the `Origin` header on that specific outgoing request (matched by exact URL) before clearing the pending state in `.finally()`. The listener is registered for `<all_urls>`/`xmlhttprequest` (broader than ideal) but only ever mutates a request when `pendingOriginOverride` is set and the URL matches, so it's a no-op for all other browser traffic.
- A `browser.menus` entry (context: `browser_action`) adds a right-click "Settings" item on the toolbar button that calls `browser.runtime.openOptionsPage()`.

**`options.html` / `options.js`** — a standalone settings page (opened in its own tab, not a popup) with two fields: URL and bearer token (masked, `type="password"`). `options.js` reads/writes both via `browser.storage.local` (keys: `"url"`, `"token"`). `browser.storage.local` is not encrypted at rest — the token sits in the profile's extension storage like any other local extension data. There is no Origin-related setting; Origin is always derived from the URL field (see above).

## Icons

`icons/` holds `book-icon.png` (browser action toolbar icon) and `book-icon-32x32.png` (extension icon, referenced from `manifest.json`'s `icons` key). `icons/LICENSE` covers their licensing — check it before adding/replacing icons.
