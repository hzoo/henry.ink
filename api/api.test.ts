import { test, expect, describe } from "bun:test";
import { getCorsHeaders, optionsResponse } from "./cors";
import { rewriteAssetUrlsInCSS } from "./archive/processor";
import { countGraphemes } from "./trails/ingester";

describe("getCorsHeaders", () => {
  test("returns origin for allowed origins", () => {
    expect(getCorsHeaders("https://henry.ink")["Access-Control-Allow-Origin"]).toBe("https://henry.ink");
    expect(getCorsHeaders("http://localhost:3003")["Access-Control-Allow-Origin"]).toBe("http://localhost:3003");
  });

  test("returns * for unknown origins", () => {
    expect(getCorsHeaders("https://evil.com")["Access-Control-Allow-Origin"]).toBe("*");
    expect(getCorsHeaders("")["Access-Control-Allow-Origin"]).toBe("*");
    expect(getCorsHeaders()["Access-Control-Allow-Origin"]).toBe("*");
  });
});

describe("optionsResponse", () => {
  test("returns 204 with cache header", () => {
    const req = new Request("https://api.henry.ink/api/archive", {
      method: "OPTIONS",
      headers: { Origin: "https://henry.ink" },
    });
    const res = optionsResponse(req);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Max-Age")).toBe("86400");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://henry.ink");
  });
});

describe("rewriteAssetUrlsInCSS", () => {
  const base = "https://example.com";
  const proxy = "https://api.henry.ink";

  test("proxies font URLs", () => {
    const css = `@font-face { src: url('/fonts/inter.woff2'); }`;
    const result = rewriteAssetUrlsInCSS(css, base, proxy);
    expect(result).toContain("api/asset-proxy?url=");
    expect(result).toContain("inter.woff2");
  });

  test("proxies image URLs", () => {
    const css = `.bg { background: url("hero.jpg"); }`;
    const result = rewriteAssetUrlsInCSS(css, base, proxy);
    expect(result).toContain("api/asset-proxy?url=");
  });

  test("leaves data URIs untouched", () => {
    const css = `.icon { background: url(data:image/svg+xml;base64,abc); }`;
    const result = rewriteAssetUrlsInCSS(css, base, proxy);
    expect(result).toBe(css);
  });

  test("leaves non-asset URLs as absolute", () => {
    const css = `.x { background: url('/page'); }`;
    const result = rewriteAssetUrlsInCSS(css, base, proxy);
    expect(result).toContain("https://example.com/page");
    expect(result).not.toContain("asset-proxy");
  });

  test("handles multiple URLs in one rule", () => {
    const css = `div { background: url('a.png'), url('b.woff2'); }`;
    const result = rewriteAssetUrlsInCSS(css, base, proxy);
    expect(result.match(/asset-proxy/g)?.length).toBe(2);
  });

  test("skips premium font services", () => {
    const css = `@font-face { src: url('https://use.typekit.net/abc.woff2'); }`;
    const result = rewriteAssetUrlsInCSS(css, base, proxy);
    expect(result).not.toContain("asset-proxy");
    expect(result).toContain("use.typekit.net");
  });
});

describe("countGraphemes", () => {
  test("counts ASCII correctly", () => {
    expect(countGraphemes("hello")).toBe(5);
    expect(countGraphemes("")).toBe(0);
  });

  test("counts emoji as single graphemes", () => {
    expect(countGraphemes("👋")).toBe(1);
    expect(countGraphemes("👨‍👩‍👧‍👦")).toBe(1); // family emoji = 1 grapheme
    expect(countGraphemes("hi 👋")).toBe(4); // h, i, space, wave
  });

  test("counts combined characters correctly", () => {
    expect(countGraphemes("é")).toBe(1); // precomposed
    expect(countGraphemes("e\u0301")).toBe(1); // decomposed e + combining accent
  });

  test("enforces 300 grapheme limit correctly", () => {
    const under = "a".repeat(300);
    const over = "a".repeat(301);
    expect(countGraphemes(under)).toBe(300);
    expect(countGraphemes(over)).toBe(301);
    expect(countGraphemes(under) > 300).toBe(false);
    expect(countGraphemes(over) > 300).toBe(true);
  });
});

describe("bounded map eviction", () => {
  test("FIFO eviction when at capacity", () => {
    const map = new Map<string, number>();
    const MAX = 3;

    function track(key: string) {
      if (map.size >= MAX) {
        const oldest = map.keys().next().value;
        if (oldest) map.delete(oldest);
      }
      map.set(key, Date.now());
    }

    track("a");
    track("b");
    track("c");
    expect(map.size).toBe(3);

    track("d"); // should evict "a"
    expect(map.has("a")).toBe(false);
    expect(map.has("d")).toBe(true);
    expect(map.size).toBe(3);
  });
});
