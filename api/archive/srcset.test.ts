import { expect, test } from "bun:test";
import { rewriteSrcset } from "@/api/archive/srcset";

const unchanged = (url: string) => url;
const substack = (width: number) => `https://substackcdn.com/image/fetch/w_${width},c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Farticle.jpeg`;

test("rewrites real Substack CDN URL shapes without splitting transformation commas", () => {
  const calls: string[] = [];
  const urls = [substack(728), substack(1456)];
  const result = rewriteSrcset(`${urls[0]} 728w, ${urls[1]} 1456w`, url => {
    calls.push(url);
    return `/api/asset-proxy?url=${encodeURIComponent(url)}`;
  });
  expect(calls).toEqual(urls);
  expect(result).toBe(`/api/asset-proxy?url=${encodeURIComponent(urls[0])} 728w, /api/asset-proxy?url=${encodeURIComponent(urls[1])} 1456w`);
});

test("preserves width candidates and normalizes ASCII whitespace", () => {
  expect(rewriteSrcset("\t small.png\n320w,medium.png\f640w, large.png\r 1280w ", unchanged)).toBe("small.png 320w, medium.png 640w, large.png 1280w");
});

test("preserves valid density descriptors including decimal, exponent, and zero", () => {
  expect(rewriteSrcset("one.png 1x, half.png .5x, large.png 1.5x, exponent.png 2e+0x, zero.png 0x", unchanged)).toBe("one.png 1x, half.png .5x, large.png 1.5x, exponent.png 2e+0x, zero.png 0x");
});

test("keeps internal commas in descriptorless URL tokens", () => {
  expect(rewriteSrcset("https://cdn.example/a,b.jpg, https://cdn.example/c,d.jpg", unchanged)).toBe("https://cdn.example/a,b.jpg, https://cdn.example/c,d.jpg");
  expect(rewriteSrcset("a.png,b.png", unchanged)).toBe("a.png,b.png");
  expect(rewriteSrcset(substack(1456), unchanged)).toBe(substack(1456));
});

test("trailing commas delimit descriptorless candidates, not URL interiors", () => {
  expect(rewriteSrcset(",, a.png,,, b.png, c.png 2x,,,", unchanged)).toBe("a.png, b.png, c.png 2x");
  expect(rewriteSrcset("a.png, 2x, b.png 3x", unchanged)).toBe("a.png, 2x, b.png 3x");
});

test("omits data URIs without inventing candidates from their payload commas", () => {
  const calls: string[] = [];
  const result = rewriteSrcset("data:image/png;base64,AAAA 1x, DATA:image/svg+xml,%3Csvg,a,b%3E 2x, safe.png 3x", url => { calls.push(url); return url; });
  expect(calls).toEqual(["safe.png"]);
  expect(result).toBe("safe.png 3x");
  expect(rewriteSrcset("data:image/png;base64,AAAA, safe.png", unchanged)).toBe("safe.png");
});

test("invalid descriptors drop only their candidates", () => {
  const bad = ["0w", "-1w", "1.5w", "+1w", "1W", "2X", "-1x", "+1x", "1.x", "Infinityx", "NaNx", "1e999x", "100w 2x", "1x 2x", "100w 200w", "100h", "100h 2x", "100w 100h 200h", "unknown"];
  for (const descriptor of bad) {
    const calls: string[] = [];
    expect(rewriteSrcset(`bad.png ${descriptor}, safe.png 2x`, url => { calls.push(url); return url; })).toBe("safe.png 2x");
    expect(calls).toEqual(["safe.png"]);
  }
});

test("preserves browser-accepted width plus future-compatible height descriptors", () => {
  expect(rewriteSrcset("one.png 100w 50h, two.png 100h 200w", unchanged)).toBe("one.png 100w 50h, two.png 100h 200w");
});

test("parentheses keep invalid descriptor commas from becoming new candidates", () => {
  expect(rewriteSrcset("bad.png fn(1x, evil.png 2x), safe.png 3x", unchanged)).toBe("safe.png 3x");
  expect(rewriteSrcset("bad.png fn(1x, safe.png 3x", unchanged)).toBe("");
});

test("empty and separator-only inputs produce no candidates", () => {
  for (const input of ["", " \t\n\r\f", ",,,", " , , "]) expect(rewriteSrcset(input, () => { throw new Error("Unexpected callback"); })).toBe("");
});

test("callback can omit unsafe candidates", () => {
  expect(rewriteSrcset("bad.png 1x, safe.png 2x, absent.png 3x", url => url === "safe.png" ? "/proxy/safe.png" : null)).toBe("/proxy/safe.png 2x");
  expect(rewriteSrcset("one.png", () => undefined)).toBe("");
});

test("callback output cannot inject descriptors or additional candidates", () => {
  for (const output of ["", "safe.png 1x, evil.png", "safe.png\tevil.png", "safe.png\u0000", ",evil.png", "evil.png,", "data:image/png;base64,AAAA"]) {
    expect(rewriteSrcset("one.png 1x, two.png 2x", url => url === "one.png" ? output : "safe.png")).toBe("safe.png 2x");
  }
});

test("serialized candidates are stable when parsed again", () => {
  const input = `${substack(728)} 728w, ${substack(1456)} 1456w, fallback,a.jpg, fallback,b.jpg 2x`;
  const rewritten = rewriteSrcset(input, unchanged);
  expect(rewriteSrcset(rewritten, unchanged)).toBe(rewritten);
});
