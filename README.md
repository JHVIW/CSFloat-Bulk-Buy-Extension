# CSFloat Bulk Cart

A small Chrome extension that bulk-adds the first *N* listings on a [CSFloat](https://csfloat.com) search page to your cart, and empties the cart again in one click.

It is built for pages like the case listings at
`https://csfloat.com/search?sort_by=lowest_price&type=buy_now&def_index=4880`,
where you otherwise have to click **Add to cart** on every item by hand.

---

## Demo

<video src="https://github.com/JHVIW/CSFloat-Bulk-Buy-Extension/raw/refs/heads/main/demo.mov" controls width="600"></video>

If the player does not show, [watch the demo here](https://github.com/JHVIW/CSFloat-Bulk-Buy-Extension/raw/refs/heads/main/demo.mov).

---

## Features

- **Add first N to cart:** clicks the add-to-cart button on the first *N* listings, in page order, as fast as the browser allows (no delay).
- **Click-as-you-scroll:** when you ask for more than a page holds, it clicks the loaded listings, then wiggle-scrolls (all the way down, a nudge back up, then down again) to trigger the lazy-loader, and keeps going until the target is reached (or nothing more loads).
- **Remove all from cart:** opens the cart, clicks **Clear** to empty it, and closes the cart again. Falls back to removing items one by one if no Clear button is present.
- **Dynamic label:** the add button shows the exact amount you typed, for example *Add first 25 to cart*.
- Text-only, light-blue UI. No tracking, no network calls of its own.

---

## Installation

This extension is not on the Chrome Web Store, so you install it manually as an
unpacked extension. It takes about a minute.

1. **Download the code.**
   - On the GitHub page, click the green **Code** button and choose
     **Download ZIP**.
   - Or download a packaged release from the **Releases** section if one is
     available.
2. **Unzip it.** Right-click the downloaded `.zip` and extract it to a folder
   you will keep (do not delete this folder afterwards, Chrome loads the
   extension from it every time). You should end up with a folder containing
   `manifest.json`, `popup.html`, `content.js`, and an `icons` folder.
3. **Open the extensions page.** Go to `chrome://extensions` in Chrome (or any
   Chromium browser such as Edge, Brave, or Opera).
4. **Enable Developer mode** using the toggle in the top-right corner.
5. **Load it.** Click **Load unpacked** and select the unzipped folder (the one
   that directly contains `manifest.json`).
6. **Pin it.** Click the puzzle-piece icon in the toolbar and pin
   **CSFloat Bulk Cart** so it is always one click away.

To update later, download the new ZIP, replace the folder contents, then click
the refresh icon on the extension's card at `chrome://extensions`.

---

## Usage

1. Open a CSFloat **search** page.
2. Click the extension icon.
3. Enter the **number of items** to add (default: 25).
4. Click **Add first N to cart** and watch the status line for progress.
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

**Adding:** `content.js` finds the `<item-card>` elements and the add-to-cart
button inside each, then clicks them in order. When more listings are needed it
wiggle-scrolls (fully down, a small nudge up, then down again) to trigger
CSFloat's lazy-loader, and repeats until the target is reached.

**Removing:** the cart is a checkout overlay. The script clicks the navbar cart
toggle to open it, clicks **Clear**, then closes the overlay.

Button detection is intentionally tolerant (it matches Material icon names and
aria labels), so small CSFloat markup changes usually will not break it.

---

## Notes & limitations

- **Settings are not remembered.** The count always starts at the default (25).
  To change the default, edit `value="25"` in `popup.html`.
- **One pass per page load.** Each card is processed only once (it is marked
  after handling) to avoid double-adding. Refresh or run a new search to start
  clean.
- **Selectors are page-specific.** Detection is tuned to CSFloat's current DOM
  (`item-card`, the checkout overlay's `Clear` button and `delete` icons, and
  the navbar cart toggle). If CSFloat significantly restructures these, the
  selectors may need updating.
- **No delay between clicks.** This is fast by design. If CSFloat ever
  rate-limits rapid clicks, a small throttle can be added.

---

## Disclaimer

This is an unofficial helper that automates clicks you could make by hand. It
is not affiliated with CSFloat. Use it responsibly and at your own risk.
