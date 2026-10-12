import { describe, expect, test } from "bun:test";
import { validateAsset, validatedEmbeddedFont } from "@/api/archive/asset-validation";
import { createAssetProxyHandler, registerArchiveAssets } from "@/api/archive/routes";
import type { PublicResource } from "@/api/archive/public-fetch";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWekAAAAASUVORK5CYII=", "base64");
const makeResource = (body: Buffer, mime: string): PublicResource => ({
  url: "https://assets.example/a.png", status: 200,
  headers: new Headers({ "content-type": mime }), body,
});

describe("asset validation", () => {
  test('accepts signature-checked embedded fonts but not HTML, SVG or mislabeled bytes', () => {
    const font = Buffer.from('wOFFfont').toString('base64');
    expect(validatedEmbeddedFont(`data:application/x-font-woff;charset=utf-8;base64,${font}`)).toBe(`data:font/woff;base64,${font}`);
    expect(validatedEmbeddedFont(`data:font/woff2;base64,${font}`)).toBe(`data:font/woff;base64,${font}`);
    expect(validatedEmbeddedFont(`data:font/woff;base64,${Buffer.from('<script>evil()</script>').toString('base64')}`)).toBeUndefined();
    expect(validatedEmbeddedFont(`data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64')}`)).toBeUndefined();
  });
  test("rejects HTML even with a PNG filename", () => {
    expect(() => validateAsset(makeResource(Buffer.from('<script>alert(1)</script>'), "text/html"))).toThrow();
    expect(() => validateAsset(makeResource(png, "text/html"))).toThrow("content type");
  });
  test("uses canonical types from bytes and rejects mislabeled images", () => {
    expect(validateAsset(makeResource(png, "image/png"))).toBe("image/png");
    expect(validateAsset(makeResource(png, "application/octet-stream"))).toBe("image/png");
    expect(() => validateAsset(makeResource(png, "image/jpeg"))).toThrow();
  });
  test("checks font signatures and size", () => {
    expect(validateAsset(makeResource(Buffer.from("wOF2font"), "font/woff2"))).toBe("font/woff2");
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1);
    oversized.write("wOF2");
    expect(() => validateAsset(makeResource(oversized, "font/woff2"))).toThrow("too large");
  });
  test("normalizes mislabeled font formats without accepting cross-family mismatches", () => {
    const otf = Buffer.from("OTTOfont");
    expect(validateAsset(makeResource(otf, "font/woff2"))).toBe("font/otf");
    expect(() => validateAsset(makeResource(otf, "text/html"))).toThrow("content type");
    expect(() => validateAsset(makeResource(otf, "image/png"))).toThrow("content type");
    expect(() => validateAsset(makeResource(png, "font/woff2"))).toThrow("content type");
    expect(() => validateAsset(makeResource(Buffer.from("<html>font</html>"), "font/woff2"))).toThrow();
  });
  test("requires valid SVG XML without entity declarations", () => {
    expect(validateAsset(makeResource(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>'), "image/svg+xml"))).toBe("image/svg+xml");
    for (const source of ['<html/>', '<svg', '<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg"/>']) {
      expect(() => validateAsset(makeResource(Buffer.from(source), "image/svg+xml"))).toThrow();
    }
  });
  test('bounds SVG depth, element count, and attributes before allocating a DOM', () => {
    const svg = (content: string) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg">${content}</svg>`);
    for (const content of [
      '<g>'.repeat(10_000) + '</g>'.repeat(10_000),
      '<path/>'.repeat(10_000),
      `<path ${Array.from({ length: 129 }, (_, i) => `a${i}="x"`).join(' ')}/>`]) {
      expect(() => validateAsset(makeResource(svg(content), 'image/svg+xml'))).toThrow('Invalid SVG');
    }
    expect(validateAsset(makeResource(svg('<g>'.repeat(63) + '</g>'.repeat(63)), 'image/svg+xml'))).toBe('image/svg+xml');
    for (const content of ['<g></path>', '<g x="1" x="2"/>', '<g>&unknown;</g>', '<g:unknown/>']) {
      expect(() => validateAsset(makeResource(svg(content), 'image/svg+xml'))).toThrow('Invalid SVG');
    }
  });
});

describe("asset proxy", () => {
  const req = (target: string, ip: string) => new Request(`https://api.henry.ink/api/asset-proxy?url=${encodeURIComponent(target)}`, { headers: { Origin: "https://henry.ink", "X-Forwarded-For": ip } });
  const permit = (target: string) => registerArchiveAssets({ html: `<img src="https://api.henry.ink/api/asset-proxy?url=${encodeURIComponent(target)}">`, textContent: "" });

  test("only fetches exact registered URLs", async () => {
    const target = "https://assets.example/exact.png";
    permit(target);
    let calls = 0;
    const handler = createAssetProxyHandler(async () => { calls++; return makeResource(png, "image/png"); });
    expect((await handler(req(target + "?different=1", "unregistered"))).status).toBe(403);
    expect((await handler(req(target, "registered"))).status).toBe(200);
    expect(calls).toBe(1);
  });

  test("five requests share one download with a byte limit", async () => {
    const target = "https://assets.example/coalesced.png";
    permit(target);
    let calls = 0;
    const handler = createAssetProxyHandler(async (_url, options) => {
      expect(options.maxBytes).toBe(10 * 1024 * 1024);
      expect(options.timeoutMs).toBe(5000);
      calls++;
      await Bun.sleep(10);
      return makeResource(png, "image/png");
    });
    const responses = await Promise.all(Array.from({ length: 5 }, (_, i) => handler(req(target, `asset-${i}`))));
    expect(calls).toBe(1);
    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/png");
      expect(response.headers.get("cache-control")).toBe("public, max-age=900");
      expect(response.headers.get("vary")).toBe("Origin");
    }
  });

  test("HTML is rejected and SVG receives an execution sandbox", async () => {
    const htmlTarget = "https://assets.example/html.png";
    const svgTarget = "https://assets.example/diagram.svg";
    permit(htmlTarget);
    permit(svgTarget);
    const handler = createAssetProxyHandler(async url => url.endsWith(".svg")
      ? makeResource(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>document.title="executed"</script></svg>'), "image/svg+xml")
      : makeResource(Buffer.from('<script>document.title="executed"</script>'), "text/html"));
    expect((await handler(req(htmlTarget, "html"))).status).toBe(415);
    const result = await handler(req(svgTarget, "svg"));
    expect(result.status).toBe(200);
    expect(result.headers.get("content-security-policy")).toContain("sandbox;");
    expect(result.headers.get("content-security-policy")).toContain("script-src 'none'");
    expect(result.headers.get("content-disposition")).toBe("attachment");
    expect(result.headers.get("x-content-type-options")).toBe("nosniff");
  });

  test("distinct downloads are bounded and failed jobs can retry", async () => {
    const targets = Array.from({ length: 9 }, (_, i) => `https://assets.example/bounded-${i}.png`);
    targets.forEach(permit);
    let fail = true;
    const handler = createAssetProxyHandler(async () => { await Bun.sleep(15); if (fail) throw new Error("upstream failed"); return makeResource(png, "image/png"); });
    const jobs = targets.slice(0, 8).map((url, i) => handler(req(url, `bounded-${i}`)));
    expect((await handler(req(targets[8], "overflow"))).status).toBe(429);
    await Promise.all(jobs);
    fail = false;
    expect((await handler(req(targets[0], "retry"))).status).toBe(200);
  });
});
