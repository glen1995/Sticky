# Sip — a tiny water reminder

A Manifest V3 Chrome extension prototype with a friendly animated bottle mascot. A small floating bottle is injected into regular webpages; click it to open a water check-in. Set reminder intervals and active hours in the extension popup, then record drinks from the page widget or a Chrome notification. Each check-in lowers the bottle's water level. The popup, content script, service worker, and Vite configuration are written in TypeScript.

## Load in Chrome

1. Open `chrome://extensions` and enable **Developer mode**.
2. From this project folder, run `npm install` once and then `npm run build`.
3. Choose **Load unpacked** and select the generated `dist` folder.
4. In the extension's **Details**, set **Site access** to **On all sites**, then reload any webpages that were already open. The extension also requests Chrome's notifications permission when installed.

The extension uses `chrome.alarms` for reminders and `chrome.storage.local` for settings and daily progress. `npm run build` type-checks the source and writes a loadable JavaScript extension to `dist`. Run `npm run dev` to rebuild `dist` whenever source files change, then reload the unpacked extension in `chrome://extensions`. For predictable reminder timing, keep Chrome running; alarms can be delayed while the browser is closed or the device is asleep.

## Source layout

- `assets/icons/` — notification and extension images.
- `src/popup/` — popup HTML and TypeScript controller.
- `src/content/` — webpage bottle widget content script.
- `src/background/` — alarm and notification service worker.
- `global.css` — shared Tailwind theme and animation styles at the project root.
- Root — shared styles, manifest, Vite, TypeScript, package, and README configuration.

Chrome does not allow extensions to inject into browser-internal pages such as `chrome://extensions`, the Chrome Web Store, or some restricted pages.

## Prototype features

- Adjustable reminder cadence and daily active hours.
- Notification actions to record a drink or snooze for 15 minutes.
- A floating, animated bottle widget on webpages with a Shadow DOM-isolated Tailwind UI.
- Hide the page widget until the next scheduled reminder, or restore it from the popup; reminders automatically bring it back.
- Shared Tailwind theme and animation styles in the root `global.css` file.
- Animated CSS bottle that visibly empties with each check-in.
- Daily drink count and settings saved locally in the browser.