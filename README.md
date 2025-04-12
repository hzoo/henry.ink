# extension-annotation-sidebar

Discover what people are saying about any webpage (Bluesky only atm) - a sidebar browser extension that shows you real-time discussions about the sites you visit.

[link-chrome]: https://chromewebstore.google.com/detail/bluesky-sidebar/lbbbgodnfjcndohnhdjkomcckekjpjni 'Version published on Chrome Web Store'
[link-firefox]: https://addons.mozilla.org/en-US/firefox/addon/bluesky-sidebar/ 'Version published on Mozilla Add-ons'

[<img src="https://raw.githubusercontent.com/alrra/browser-logos/90fdf03c/src/chrome/chrome.svg" width="48" alt="Chrome" valign="middle">][link-chrome] [<img valign="middle" src="https://img.shields.io/chrome-web-store/v/lbbbgodnfjcndohnhdjkomcckekjpjni.svg?label=%20">][link-chrome] and other Chromium browsers

[<img src="https://raw.githubusercontent.com/alrra/browser-logos/90fdf03c/src/firefox/firefox.svg" width="48" alt="Firefox" valign="middle">][link-firefox] [<img valign="middle" src="https://img.shields.io/amo/v/bluesky-sidebar.svg?label=%20">][link-firefox] 

![example on neal.fun](https://github.com/user-attachments/assets/afc834a4-1d17-4b1d-843c-2e58f857f247)

## What it does

- **Automatic Post Discovery**: As you browse the web, the extension automatically shows posts that mention your current webpage
- **View Options**: Toggle between compact (reddit-like) and full post views

## Privacy Considerations

- Since the extension automatically searches a backend (Bluesky) using your current URL, your IP address would be visible to it's servers. This only matters since it's done "automatically", otherwise it's the same as just searching a url in the searchbox on the website.
- **Note**: this is a moot point if you are logged-in and like/reply.
- To account for this:
  - Use the *whitelist* feature to only auto-search on sites you trust
  - Enable *manual* mode to control when searches happen
  - Or just use a VPN

## Future Ideas

- **Cross-Platform Search**: Integration with other "open" social platforms (HN, Arena, local Obsidian?)
- **Authentication**: Log in to like, repost, and reply to posts directly
- **Smart Filtering**: Filter posts from your follows??

## Local Chrome/Edge/Brave/Opera

- Download the `zip` from [releases](https://github.com/hzoo/extension-annotation-sidebar/releases)
- Go to `chrome://extensions/`
- Enable "Developer mode" in the top-right corner
- Click "Load unpacked", open the folder

## Local Firefox

1. Download the `zip` from [releases](https://github.com/hzoo/extension-annotation-sidebar/releases)
2. Go to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on…"

## Dev

```sh
bun install
bun run dev
bun run build
bun run build:firefox
```
