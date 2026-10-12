import { test, expect, describe } from "bun:test";
import { getCorsHeaders, optionsResponse } from "./cors";
import { rewriteAssetUrlsInCSS } from "./archive/processor";

describe("getCorsHeaders", () => {
  test("returns origin for allowed origins", () => {
    expect(getCorsHeaders("https://henry.ink")["Access-Control-Allow-Origin"]).toBe("https://henry.ink");
    expect(getCorsHeaders("http://localhost:3003")["Access-Control-Allow-Origin"]).toBe("http://localhost:3003");
    expect(getCorsHeaders("https://annotation-demo.henryzoo.com")["Access-Control-Allow-Origin"]).toBe("https://annotation-demo.henryzoo.com");
    expect(getCorsHeaders("https://henry.ink")["Vary"]).toBe("Origin");
  });

  test("omits access for unknown origins", () => {
    expect(getCorsHeaders("https://evil.com")["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(getCorsHeaders("")["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(getCorsHeaders()["Access-Control-Allow-Origin"]).toBeUndefined();
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

  test("preserves raster data URIs", () => {
    const css = `.icon { background: url(data:image/png;base64,abc); }`;
    const result = rewriteAssetUrlsInCSS(css, base, proxy);
    expect(result).toContain("data:image/png;base64,abc");
  });

  test("blocks unknown asset references", () => {
    const css = `.x { background: url('/page'); }`;
    const result = rewriteAssetUrlsInCSS(css, base, proxy);
    expect(result).toContain("about:blank");
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
