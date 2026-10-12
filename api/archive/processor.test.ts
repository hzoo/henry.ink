import { describe, expect, test } from "bun:test";
import { createArchiveService, rewriteAssetUrlsInCSS, validateAndProcessCSS } from "@/api/archive/processor";
import type { capturePage } from "@/api/archive/browser-capture";

const fixture: Awaited<ReturnType<typeof capturePage>> = {
  fullHTMLContent: '<!doctype html><html lang="en"><body style="background:url(/header.png)"><script>danger()</script><p style="cursor:u\\72l(/cursor.png), auto">Article</p><a href="java&#9;script:alert(1)">bad</a><a href="next">Next</a><img src="/a.png" srcset="/a.png 1x, /b.png 2x"></body></html>',
  pageData: {
    baseUrl: "https://example.com/articles/post/",
    cssSources: [],
    metadata: { title: "Article", author: "Author", publishedTime: "", domain: "example.com", url: "https://example.com/articles/post/" },
    htmlAttrs: { class: "", style: "", lang: "en" },
    bodyAttrs: { class: "", style: "background:url(/header.png)" },
  },
  cssSources: [{ content: 'p { background: url(../images/bg.png) }', baseUrl: "https://styles.example/theme/main.css", media: "screen and (min-width: 600px)" }],
};

describe("archive processing", () => {
  test('returns the observed final URL separately from requested URL and document base', async () => {
    const resolvedUrl = 'https://example.com/article/';
    const service = createArchiveService(async () => ({ ...fixture,
      pageData: { ...fixture.pageData, baseUrl: 'https://assets.example/',
        metadata: { ...fixture.pageData.metadata, url: resolvedUrl } },
    }));
    const result = await service('https://example.com/article');
    expect(result.url).toBe('https://example.com/article');
    expect(result.resolvedUrl).toBe(resolvedUrl);
    expect((await service('https://example.com/article#quote')).resolvedUrl).toBe(resolvedUrl);
  });
  test('preserves validated embedded font faces without allowing arbitrary data URLs', () => {
    const data = `data:application/x-font-woff;charset=utf-8;base64,${Buffer.from('wOFFfont').toString('base64')}`;
    const css = rewriteAssetUrlsInCSS(`@font-face {font-family: Equity;src:url("${data}")} p {background:url(data:text/html;base64,PGh0bWw+);}`, 'https://example.com', 'http://localhost:3000');
    expect(css).toContain('data:font/woff;base64,');
    expect(css).toContain('about:blank');
    expect(css).not.toContain('data:text/html');
  });
  test('retains limited-quirks document mode through server serialization', async () => {
    const service = createArchiveService(async () => ({ ...fixture,
      fullHTMLContent: '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"><p>Legacy article</p>',
    }));
    expect((await service('https://example.com/legacy')).html).toStartWith('<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"');
  });
  test('keeps commas inside image CDN URLs while rewriting responsive candidates', async () => {
    const image = 'https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto/example.jpg';
    const service = createArchiveService(async () => ({ ...fixture,
      fullHTMLContent: `<img srcset="${image} 1456w, /small.jpg 320w">`,
    }));
    const result = await service('https://example.com/article');
    expect(result.html).toContain(`${encodeURIComponent(image)} 1456w, http://localhost:3000/api/asset-proxy?url=https%3A%2F%2Fexample.com%2Fsmall.jpg 320w`);
  });
  test('promotes missing lazy image sources through the same validated proxy', async () => {
    const service = createArchiveService(async () => ({ ...fixture,
      fullHTMLContent: '<img data-src="/hero.jpg"><img src="/keep.jpg" data-src="/other.jpg"><img data-src="javascript:evil()"><picture><source data-srcset="/wide.jpg 900w"><img data-src="/small.jpg"></picture>',
    }));
    const result = await service('https://example.com/article');
    expect(result.html).toContain('src="http://localhost:3000/api/asset-proxy?url=https%3A%2F%2Fexample.com%2Fhero.jpg"');
    expect(result.html).toContain('src="http://localhost:3000/api/asset-proxy?url=https%3A%2F%2Fexample.com%2Fkeep.jpg"');
    expect(result.html).toContain('srcset="http://localhost:3000/api/asset-proxy?url=https%3A%2F%2Fexample.com%2Fwide.jpg 900w"');
    expect(result.html).not.toMatch(/\ssrc="javascript:/);
  });
  test("retains article text nested in legacy forms without submission controls", async () => {
    const service = createArchiveService(async () => ({
      ...fixture,
      fullHTMLContent: '<!doctype html><body marginwidth="0" topmargin="0"><form action="/submit"><h2>Seven principles</h2><p>Closing argument</p><input name="secret"><button formaction="/other">Submit</button><script>evil()</script></form></body>',
    }));
    const result = await service('https://example.com/article');
    expect(result.html).toContain('<h2>Seven principles</h2>');
    expect(result.textContent).toContain('Closing argument');
    expect(result.html).not.toMatch(/<(form|input|button|script)\b/);
    expect(result.bodyAttrs.marginwidth).toBe('0');
    expect(result.bodyAttrs.topmargin).toBe('0');
  });
  test("preserves original root and typography selectors without archive scoping", async () => {
    const css = `
      :root { --reading-font: Georgia; }
      html { font-family: var(--reading-font); }
      body { font-family: serif; }
      html.dark body#article > main .copy { font-family: Georgia !important; }
      :where(.caption) { font-family: monospace; }
    `;
    const processed = await validateAndProcessCSS(css);
    expect(processed).not.toBeNull();
    expect(processed).toContain(":root {");
    expect(processed).toContain("html {");
    expect(processed).toContain("body {");
    expect(processed).toContain("html.dark body#article > main .copy {");
    expect(processed).toContain("!important");
    expect(processed).toContain(":where(.caption)");
    expect(processed).not.toContain("archive-mode");
    expect(processed).not.toContain("@layer");
  });

  test("retains source layer order, unlayered root rules, and stylesheet media", async () => {
    const service = createArchiveService(async () => ({
      ...fixture,
      cssSources: [
        {
          content: '@layer reset, theme; @layer reset { body { font-family: serif; } }',
          baseUrl: "https://styles.example/reset.css",
          media: "",
        },
        {
          content: ':root { --reading-font: Georgia; } @layer theme { html.dark body { font-family: var(--reading-font); } }',
          baseUrl: "https://styles.example/theme.css",
          media: "screen and (min-width: 600px)",
        },
        {
          content: 'body { font-family: Georgia; }',
          baseUrl: "https://styles.example/overrides.css",
          media: "",
        },
      ],
    }));
    const { css } = await service("https://example.com/articles/post/", "https://api.henry.ink");
    const layerOrder = [...new Set([...css.matchAll(/@layer\s+([^;{]+)[;{]/g)]
      .flatMap(match => match[1].split(',').map(name => name.trim())))];
    expect(layerOrder).toEqual(["reset", "theme"]);
    expect(css).toContain("@layer reset {");
    expect(css).toContain("@layer theme {");
    expect(css).toMatch(/@media screen and \((?:min-width:\s*600px|width\s*>=\s*600px)\)\s*\{\s*:root\s*\{/);
    expect(css).toContain("html.dark body {");
    expect(css).toContain(":root {");
    expect(css).not.toContain("archive-mode");
    expect(css).not.toContain("@layer utilities");
    const rules = ["@layer reset {", "@media screen", ":root {", "@layer theme {", "font-family: Georgia;"];
    const positions = rules.map(rule => css.indexOf(rule));
    expect(positions.every(position => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  test("preserves safe root attributes but not event or data attributes", async () => {
    const service = createArchiveService(async () => ({
      ...fixture,
      fullHTMLContent: `<!doctype html>
        <html id="source-root" class="dark" lang="en" dir="rtl" style="color:red"
          bgcolor="#111111" text="#eeeeee" link="#00aaff" vlink="#aa00ff" alink="#ff0000"
          onclick="danger()" data-source="ignored">
        <body id="source-body" class="reading" lang="fr" dir="ltr" style="color:blue"
          bgcolor="#222222" text="#dddddd" link="#00bbff" vlink="#bb00ff" alink="#ff1111"
          onload="danger()" data-source="ignored"><p>Article</p></body></html>`,
    }));
    const result = await service("https://example.com/articles/post/", "https://api.henry.ink");
    expect(result.htmlAttrs).toMatchObject({
      id: "source-root", class: "dark", lang: "en", dir: "rtl",
      bgcolor: "#111111", text: "#eeeeee", link: "#00aaff", vlink: "#aa00ff", alink: "#ff0000",
    });
    expect(result.bodyAttrs).toMatchObject({
      id: "source-body", class: "reading", lang: "fr", dir: "ltr",
      bgcolor: "#222222", text: "#dddddd", link: "#00bbff", vlink: "#bb00ff", alink: "#ff1111",
    });
    expect(result.htmlAttrs.style).toContain("color: red");
    expect(result.bodyAttrs.style).toContain("color: #00f");
    const allowed = ['class', 'style', 'lang', 'id', 'dir', 'bgcolor', 'text', 'link', 'vlink', 'alink'].sort();
    expect(Object.keys(result.htmlAttrs).sort()).toEqual(allowed);
    expect(Object.keys(result.bodyAttrs).sort()).toEqual(allowed);
    expect(result.html).not.toContain("onclick");
    expect(result.html).not.toContain("onload");
  });

  test("preserves explicit HTML language without adding a BODY language override", async () => {
    const service = createArchiveService(async () => ({
      ...fixture,
      fullHTMLContent: '<!doctype html><html lang="en-US"><body><p>Article</p></body></html>',
    }));
    const result = await service("https://example.com/articles/post/", "https://api.henry.ink");
    expect(result.htmlAttrs.lang).toBe("en-US");
    expect(result.bodyAttrs).not.toHaveProperty("lang");
    expect(result.html).toContain('<html lang="en-US">');
    expect(result.html).toContain('<body>');
  });

  test("keeps dangerous CSS URLs blocked and enforces byte rather than character bounds", async () => {
    const rewritten = rewriteAssetUrlsInCSS('body { background: url("javascript:alert(1)"); }', "https://example.com", "https://api.henry.ink");
    expect(rewritten).toContain("about:blank");
    expect(rewritten).not.toContain("javascript:");
    const oversized = `/*${"\u00e9".repeat(1024 * 1024)}*/`;
    expect(oversized.length).toBeLessThan(2 * 1024 * 1024);
    expect(await validateAndProcessCSS(oversized)).toBeNull();
    expect(rewriteAssetUrlsInCSS(oversized, "https://example.com", "https://api.henry.ink")).toBe("");
  });

  test("coalesces capture and keeps rewrite variants distinct", async () => {
    let captures = 0;
    const service = createArchiveService(async () => { captures++; await Bun.sleep(10); return fixture; });
    const input = "https://example.com/articles/post/";
    const results = await Promise.all(Array.from({ length: 5 }, () => service(input, "https://api.henry.ink", "https://henry.ink")));
    expect(captures).toBe(1);
    expect(results[0].html).toContain("https://henry.ink/https://example.com/articles/post/next");
    const other = await service(input, "https://other.example");
    expect(captures).toBe(2);
    expect(other.html).toContain("https://other.example/api/asset-proxy");
    expect(other.html).not.toContain("https://henry.ink/https://example.com");
    const fragment = await service(input + "#quote", "https://api.henry.ink", "https://henry.ink");
    expect(fragment.url).toBe(input + "#quote");
    expect(captures).toBe(2);
  });

  test("preserves stylesheet bases/media, rewrites inline URLs, and removes scripts", async () => {
    const service = createArchiveService(async () => fixture);
    const result = await service("https://example.com/articles/post/", "https://api.henry.ink");
    expect(result.css).toContain("@media screen");
    expect(result.css).toContain("600px");
    expect(result.css).toContain(encodeURIComponent("https://styles.example/images/bg.png"));
    expect(result.html).toContain(encodeURIComponent("https://example.com/cursor.png"));
    expect(result.html).toContain(encodeURIComponent("https://example.com/b.png"));
    expect(result.bodyAttrs.style).toContain("asset-proxy");
    expect(result.html).not.toContain("<script");
    expect(result.html).not.toContain("java\tscript");
    expect(result.textContent).toContain("Article");
    expect(result.textContent).not.toContain("danger()");
  });

  test("escaped imports are removed after parsing and escaped URLs are rewritten", async () => {
    const css = '@\\69mport "https://evil.example/global.css"; .x {background:u\\72l(https://example.com/a.png)}';
    const rewritten = rewriteAssetUrlsInCSS(css, "https://example.com", "https://api.henry.ink");
    expect(rewritten).not.toContain("@import");
    expect(rewritten).not.toContain("global.css");
    expect(rewritten).toContain("asset-proxy");
    expect(await validateAndProcessCSS(css)).not.toContain("@import");
  });

  test("relative links use the final redirected document base without requiring a rewrite host", async () => {
    const redirected = {
      ...fixture,
      fullHTMLContent: '<!doctype html><p id="section">Article</p><a href="next">Next</a><a href="/root">Root</a><a href="#section">Section</a><a href="https://external.example/path">External</a>',
      pageData: { ...fixture.pageData, baseUrl: "https://redirect.example/new/path/article/" },
    };
    const service = createArchiveService(async () => redirected);
    const result = await service("https://example.com/original", "https://api.henry.ink");
    expect(result.html).toContain('href="https://redirect.example/new/path/article/next"');
    expect(result.html).toContain('href="https://redirect.example/root"');
    expect(result.html).toContain('href="#section"');
    expect(result.html).toContain('href="https://external.example/path"');
    const wrapped = await service("https://example.com/original", "https://api.henry.ink", "https://henry.ink");
    expect(wrapped.html).toContain('href="https://henry.ink/https://redirect.example/new/path/article/next"');
    expect(wrapped.html).toContain('href="#section"');
    expect(wrapped.html).toContain('href="https://external.example/path"');
  });
});
