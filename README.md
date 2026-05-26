# CSFloat Bulk Cart

A small Chrome extension that bulk-adds the first *N* listings on a [CSFloat](https://csfloat.com) search page to your cart, and empties the cart again in one click.

It is built for pages like the case listings at
`https://csfloat.com/search?sort_by=lowest_price&type=buy_now&def_index=4880`,
where you otherwise have to click **Add to cart** on every item by hand.

---

## Features

- **Add first N to cart** — clicks the add-to-cart button on the first *N* listings, in page order, as fast as the browser allows (no delay).
- **Click-as-you-scroll** — when you ask for more than a page holds, it clicks the loaded listings, then wiggle-scrolls (all the way down, a nudge back up, then down again) to trigger the lazy-loader, and keeps going until the target is reached (or nothing more loads).
- **Remove all from cart** — opens the cart, clicks **Clear** to empty it, and closes the cart again. Falls back to removing items one by one if no Clear button is present.
- **Dynamic label** — the add button shows the exact amount you typed, e.g. *Add first 25 to cart*.
- Text-only, light-blue UI. No tracking, no network calls of its own.

---

## Installation

1. Open `chrome://extensions` in Chrome (or any Chromium browser).
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select this folder
   (`CSFloat Bulk Buy Extension`).
4. Pin the extension to the toolbar for quick access.

After editing any file, return to `chrome://extensions` and click the refresh
icon on the extension card to reload it.

---

## Usage

1. Open a CSFloat **search** page.
2. Click the extension icon.
3. Enter the **number of items** to add (default: 25).
4. Click **Add first N to cart** — watch the status line for progress.
5. When you want to start over, click **Remove all from cart**.

---

## How it works

The extension is plain Manifest V3 with a popup and a content script.

| File | Responsibility |
| --- | --- |
| `manifest.json` | Extension metadata, permissions (`scripting`, `activeTab`), and host access to `csfloat.com`. |
| `popup.html` | The popup markup and styling (design tokens, light-blue theme). |
| `popup.js` | Reads the input, sends commands to the content script, shows status. |
| `content.js` | Runs on the page: finds listing cards and their buttons, performs the add/remove actions. |
| `icons/` | Toolbar icons (16/32/48/128 px). |

**Adding** — `content.js` finds the `<item-card>` elements and the
add-to-cart button inside each, then clicks them in order. When more listings
are needed it wiggle-scrolls — fully down, a small nudge up, then down again —
to trigger CSFloat's lazy-loader, and repeats until the target is reached.

**Removing** — the cart is a checkout overlay. The script clicks the navbar
cart toggle to open it, clicks **Clear**, then closes the overlay.

Button detection is intentionally tolerant (it matches Material icon names and
aria labels), so small CSFloat markup changes usually won't break it.

---

## Notes & limitations

- **Settings are not remembered.** The count always starts at the default (25).
  To change the default, edit `value="25"` in `popup.html`.
- **One pass per page load.** Each card is processed only once (it's marked
  after handling) to avoid double-adding. Refresh or run a new search to start
  clean.
- **Selectors are page-specific.** Detection is tuned to CSFloat's current DOM
  (`item-card`, the checkout overlay's `Clear` button and `delete` icons, and
  the navbar cart toggle). If CSFloat significantly restructures these, the
  selectors may need updating.
- **No delay between clicks.** This is fast by design; if CSFloat ever rate-limits
  rapid clicks, a small throttle can be added.

---

## Disclaimer

This is an unofficial helper that automates clicks you could make by hand. It
is not affiliated with CSFloat. Use it responsibly and at your own risk.
