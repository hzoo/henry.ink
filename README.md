# extension-annotation-sidebar

Discover what people are saying about any webpage: a *sidebar* browser extension that shows you real-time discussions about the sites you visit (bsky atm).

[link-chrome]: https://chromewebstore.google.com/detail/bluesky-sidebar/lbbbgodnfjcndohnhdjkomcckekjpjni 'Version published on Chrome Web Store'
[link-firefox]: https://addons.mozilla.org/en-US/firefox/addon/bluesky-sidebar/ 'Version published on Mozilla Add-ons'

> i also made a [web app](https://annotation-sidebar-demo.pages.dev/) if you want to test it first (no installation needed)  
> *note*: [bsky](https://bsky.app/profile/bnewbold.net/post/3lnvhcghi6s23) is likely removing unauthenticated `/search` access so will need to login to see posts unless I make a proxy or my own search cluster (comment if you have ideas [#8](https://github.com/hzoo/extension-annotation-sidebar/issues/8))

### pondering

> what's on my mind; a north star to move towards. please check these out!
- [Chatting with Glue, 2020](https://a9.io/glue-comic/)
- [The Garden of Forking Memes, 2020](https://aaronzlewis.com/blog/2020/07/07/the-garden-of-forking-memes/)
- [Loom: interface to the multiverse, 2021](https://generative.ink/posts/loom-interface-to-the-multiverse/)
- [Bible references, footnotes, commentaries, concordance](https://en.wikipedia.org/wiki/Bible_citation)

### Install Links

[<img src="https://raw.githubusercontent.com/alrra/browser-logos/90fdf03c/src/chrome/chrome.svg" width="48" alt="Chrome" valign="middle">][link-chrome] [<img valign="middle" src="https://img.shields.io/chrome-web-store/v/lbbbgodnfjcndohnhdjkomcckekjpjni.svg?label=%20">][link-chrome] and other Chromium browsers ([not Arc](https://www.reddit.com/r/ArcBrowser/comments/1fb1gm3/chromesidepanel_api_for_extensions_in_arc_browser/))

[<img src="https://raw.githubusercontent.com/alrra/browser-logos/90fdf03c/src/firefox/firefox.svg" width="48" alt="Firefox" valign="middle">][link-firefox] [<img valign="middle" src="https://img.shields.io/amo/v/bluesky-sidebar.svg?label=%20">][link-firefox] and friends

[![example on neal.fun](https://github.com/user-attachments/assets/6abc83f9-8a87-4468-9763-8c1b007ddf7d)](https://annotation-sidebar-demo.pages.dev)

## What it does

- **Automatic Post Discovery**: As you browse the web, the extension automatically shows posts that mention your current webpage
- **Actions**: Log in to like, repost, and reply to posts directly
- **Annotate**: select text on the page to quote and annotate

## Privacy Considerations

- Since the extension automatically searches a backend (Bluesky) using your current URL, your IP address would be visible to it's servers. This only matters since it's done "automatically", otherwise it's the same as just searching a url in the searchbox on the website.
- **Note**: this is a moot point if you are logged-in and like/reply.
- To account for this:
  - Only auto-search on sites you trust
  - Enable *manual* mode to control when searches happen
  - Or just use a VPN

## Future Ideas

- **Cross-Platform Search**: Integration with other "open" social platforms (HN, Arena, local Obsidian?)
- **Smart Filtering**: Filter posts from your follows??

## Local Download

> You may need to build the extension yourself if the zip (not source code) isn't there (see below)

- Download the corresponding `zip` from [releases](https://github.com/hzoo/extension-annotation-sidebar/releases)
  - Chorme: go to `chrome://extensions/` and click "Load unpacked" (enable Developer Mode)
  - Firefox: go to `about:debugging#/runtime/this-firefox` and click "Load Temporary Add-on…"

## Local Dev

```sh
bun install
bun run dev
# check /.output folder
bun run build
bun run build:ff
```

## Related
- I made an older repo that does a similar thing for [Community Archive](https://www.community-archive.org/) (since Twitter API is not exactly open): https://github.com/hzoo/extension-find-annotations
- https://emilyliu.me/blog/comments
- https://github.com/joneslloyd/bluniversal-comments
- https://github.com/czue/bluesky-comments
- Hypothesis annotation: https://web.hypothes.is/start
- History of annotation: https://en.wikipedia.org/wiki/Web_annotation
