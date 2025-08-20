# Browser Extension

the original platform - shows discussions about your current page in the sidebar.

## Install

[<img src="https://raw.githubusercontent.com/alrra/browser-logos/90fdf03c/src/chrome/chrome.svg" width="24" alt="Chrome" valign="middle">][link-chrome] Chrome & Chromium • [<img src="https://raw.githubusercontent.com/alrra/browser-logos/90fdf03c/src/firefox/firefox.svg" width="24" alt="Firefox" valign="middle">][link-firefox] Firefox

[link-chrome]: https://chromewebstore.google.com/detail/bluesky-sidebar/lbbbgodnfjcndohnhdjkomcckekjpjni 'Version published on Chrome Web Store'
[link-firefox]: https://addons.mozilla.org/en-US/firefox/addon/bluesky-sidebar/ 'Version published on Mozilla Add-ons'

## How it works

shows discussions about your current page in the sidebar. can like and reply directly. select text to quote it in your own post.

automatic post discovery as you browse. you can also switch to manual mode in settings if you prefer.

## Development

```sh
bun run dev          # Chrome extension development
bun run dev:ff       # Firefox extension development
bun run build        # Build Chrome extension
bun run build:ff     # Build Firefox extension
```

## Local Installation

- Download the corresponding `zip` from [releases](https://github.com/hzoo/extension-annotation-sidebar/releases)
- Chrome: go to `chrome://extensions/` and click "Load unpacked" (enable Developer Mode)
- Firefox: go to `about:debugging#/runtime/this-firefox` and click "Load Temporary Add-on…"

## Privacy Notes

automatically searches Bluesky using your current URL, making your IP visible to their servers. only matters because it's "automatic" - same as manually searching URLs. to avoid this: use [henry.ink](https://henry.ink) instead, enable manual mode, or use a VPN.