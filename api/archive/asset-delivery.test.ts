import { expect, test } from "bun:test";
import { createAssetProxyHandler, registerArchiveAssets } from "@/api/archive/routes";
import type { PublicResource } from "@/api/archive/public-fetch";

const TTL = 15 * 60 * 1000;
const png = Buffer.from("89504e470d0a1a0a", "hex");
let sequence = 0;
function permit(label: string): string {
  const url = `https://assets.example/delivery-${label}-${++sequence}.png`;
  registerArchiveAssets({ html: `/api/asset-proxy?url=${encodeURIComponent(url)}`, textContent: "" });
  return url;
}
function request(url: string, options: { origin?: string; ip?: string; signal?: AbortSignal } = {}): Request {
  return new Request(`https://api.henry.ink/api/asset-proxy?url=${encodeURIComponent(url)}`, {
    headers: { Origin: options.origin ?? "https://henry.ink", "X-Forwarded-For": options.ip ?? `delivery-reader-${++sequence}` },
    signal: options.signal,
  });
}
function resource(url: string, headers: Record<string, string> = {}, body = png): PublicResource {
  return { url, status: 200, headers: new Headers({ "content-type": "image/png", ...headers }), body };
}
const tick = () => Bun.sleep(0);

test("sequential reads reuse validated bytes, with fresh CORS and security headers per reader", async () => {
  const url = permit("repeat");
  let calls = 0;
  const route = createAssetProxyHandler(async target => {
    calls++;
    return resource(target, { "access-control-allow-origin": "https://evil.example", "content-security-policy": "default-src *" });
  });
  for (const origin of ["https://henry.ink", "http://127.0.0.1:3003", "https://evil.example", "https://henry.ink"]) {
    const response = await route(request(url, { origin }));
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(png);
    expect(response.headers.get("access-control-allow-origin")).toBe(origin === "https://evil.example" ? null : origin);
    expect(response.headers.get("vary")).toBe("Origin");
    expect(response.headers.get("content-security-policy")).toContain("sandbox; default-src 'none'");
    expect(response.headers.get("content-disposition")).toBe("attachment");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  }
  expect(calls).toBe(1);
});

test("expiry is non-sliding and response max-age shrinks on cache hits", async () => {
  const url = permit("expiry");
  let now = Date.now();
  let calls = 0;
  const route = createAssetProxyHandler(async target => { calls++; return resource(target); }, { now: () => now });
  expect((await route(request(url))).headers.get("cache-control")).toBe("public, max-age=900");
  now += TTL - 1000;
  expect((await route(request(url))).headers.get("cache-control")).toBe("public, max-age=1");
  expect(calls).toBe(1);
  now += 1000;
  expect((await route(request(url))).status).toBe(200);
  expect(calls).toBe(2);
});

const uncacheableHeaders: Record<string, string>[] = [
  { "cache-control": "private, max-age=3600" },
  { "cache-control": 'private="Set-Cookie", max-age=3600' },
  { "cache-control": "no-store" },
  { "cache-control": 'public, no-cache="etag", max-age=3600' },
  { "set-cookie": "session=secret; Secure" },
  { pragma: "no-cache" },
  { vary: "Accept, *" },
  { "cache-control": "max-age=60" },
  { "cache-control": "max-age=3600, s-maxage=10" },
  { "cache-control": "max-age=900", age: "1" },
  { "cache-control": "max-age=3600", age: "3000" },
  { "cache-control": "max-age=invalid" },
  { "cache-control": 'max-age="3600' },
  { expires: "Thu, 01 Jan 1970 00:00:00 GMT" },
];
test.each(uncacheableHeaders)("does not retain or publicly cache restrictive/short upstream freshness: %j", async headers => {
  const url = permit("uncacheable");
  let calls = 0;
  const route = createAssetProxyHandler(async target => { calls++; return resource(target, headers); });
  for (let i = 0; i < 2; i++) {
    const response = await route(request(url));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.has("set-cookie")).toBe(false);
  }
  expect(calls).toBe(2);
});

test("honors apparent age and Expires while admitting long-lived upstream assets", async () => {
  const now = Date.now();
  const date = new Date(now - 120_000).toUTCString();
  for (const [headers, expected] of [
    [{ "cache-control": "public, max-age=960", date }, 2],
    [{ date, expires: new Date(now + 60_000).toUTCString() }, 2],
    [{ "cache-control": 'public, max-age="3600"', date, age: "100" }, 1],
    [{ date, expires: new Date(now + 3_600_000).toUTCString() }, 1],
  ] as const) {
    const url = permit("freshness");
    let calls = 0;
    const route = createAssetProxyHandler(async target => { calls++; return resource(target, headers); }, { now: () => now });
    await route(request(url));
    await route(request(url));
    expect(calls).toBe(expected);
  }
});

test("Date-bearing responses with no explicit freshness use the bounded 15-minute heuristic", async () => {
  const url = permit("heuristic");
  let now = Date.now();
  const date = new Date(now - 3_600_000).toUTCString();
  let calls = 0;
  const route = createAssetProxyHandler(async target => {
    calls++;
    return resource(target, { date });
  }, { now: () => now });
  expect((await route(request(url))).headers.get("cache-control")).toBe("public, max-age=900");
  now += TTL - 1000;
  expect((await route(request(url))).headers.get("cache-control")).toBe("public, max-age=1");
  expect(calls).toBe(1);
  now += 1000;
  expect((await route(request(url))).status).toBe(200);
  expect(calls).toBe(2);
});

test("permission and rate-limit checks run before cache hits", async () => {
  const url = permit("permission");
  let now = Date.now();
  let calls = 0;
  const route = createAssetProxyHandler(async target => { calls++; return resource(target); }, { now: () => now });
  // Populate shortly before permission expires, so the cache entry is still fresh afterward.
  now += 24 * 60 * 60 * 1000 - 1000;
  expect((await route(request(url))).status).toBe(200);
  expect((await route(request(url + "?unregistered=1"))).status).toBe(403);
  const ip = `delivery-budget-${++sequence}`;
  for (let i = 0; i < 30; i++) expect((await route(request(url, { ip }))).status).toBe(200);
  expect((await route(request(url, { ip }))).status).toBe(429);
  now += 1000;
  expect((await route(request(url))).status).toBe(403);
  expect(calls).toBe(1);
});

test("eight active and eight waiting downloads bound distinct work, coalesce, and recover after failure", async () => {
  const urls = Array.from({ length: 17 }, () => permit("queue"));
  const gates: Array<{ resolve: (value: PublicResource) => void; reject: (error: Error) => void; url: string }> = [];
  let active = 0;
  let peak = 0;
  let calls = 0;
  const route = createAssetProxyHandler(async url => {
    calls++;
    peak = Math.max(peak, ++active);
    try { return await new Promise<PublicResource>((resolve, reject) => gates.push({ resolve, reject, url })); }
    finally { active--; }
  });
  const jobs = urls.slice(0, 16).map(url => route(request(url)));
  const duplicate = route(request(urls[8]));
  expect(calls).toBe(8);
  const overflow = await route(request(urls[16]));
  expect(overflow.status).toBe(429);
  expect(overflow.headers.get("retry-after")).toBe("2");
  for (const gate of gates.splice(0)) gate.reject(new Error("Failed upstream"));
  await tick();
  expect(calls).toBe(16);
  expect(active).toBe(8);
  for (const gate of gates.splice(0)) gate.resolve(resource(gate.url));
  expect((await Promise.all(jobs)).map(r => r.status)).toEqual([...Array(8).fill(502), ...Array(8).fill(200)]);
  expect((await duplicate).status).toBe(200);
  const retry = route(request(urls[0]));
  expect(calls).toBe(17);
  gates[0].resolve(resource(gates[0].url));
  expect((await retry).status).toBe(200);
  expect(peak).toBe(8);
});

test("cancelled readers detach, orphaned queued work never fetches, and shared downloads survive", async () => {
  const urls = Array.from({ length: 10 }, () => permit("cancel"));
  const gates: Array<{ resolve: (value: PublicResource) => void; url: string }> = [];
  const calls: string[] = [];
  const route = createAssetProxyHandler(async url => {
    calls.push(url);
    return new Promise<PublicResource>(resolve => gates.push({ resolve, url }));
  });
  const already = new AbortController(); already.abort();
  expect((await route(request(urls[9], { signal: already.signal }))).status).toBe(499);
  expect(calls).toHaveLength(0);
  const activeAbort = new AbortController();
  const jobs = urls.slice(0, 8).map((url, i) => route(request(url, { signal: i === 0 ? activeAbort.signal : undefined })));
  const survivor = route(request(urls[0]));
  const queuedAbort = new AbortController();
  const orphan = route(request(urls[8], { signal: queuedAbort.signal }));
  activeAbort.abort(); queuedAbort.abort();
  expect((await jobs[0]).status).toBe(499);
  expect((await orphan).status).toBe(499);
  const last = route(request(urls[9]));
  for (const gate of gates.splice(0)) gate.resolve(resource(gate.url));
  await tick();
  expect(calls).not.toContain(urls[8]);
  expect(calls).toContain(urls[9]);
  for (const gate of gates.splice(0)) gate.resolve(resource(gate.url));
  expect((await survivor).status).toBe(200);
  expect((await last).status).toBe(200);
  await Promise.all(jobs);
  const retry = route(request(urls[8]));
  gates[0].resolve(resource(gates[0].url));
  expect((await retry).status).toBe(200);
});

test("failed, partial and malicious results never poison the cache", async () => {
  for (const kind of ["network", "status", "partial", "html", "svg"] as const) {
    const url = permit(kind);
    let calls = 0;
    const route = createAssetProxyHandler(async target => {
      calls++;
      if (calls > 1) return resource(target);
      if (kind === "network") throw new Error("private upstream details");
      if (kind === "status" || kind === "partial") return { ...resource(target), status: kind === "partial" ? 206 : 500 };
      if (kind === "html") return resource(target, {}, Buffer.from("<script>evil()</script>"));
      return resource(target, { "content-type": "image/svg+xml" }, Buffer.from('<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg"/>'));
    });
    const failed = await route(request(url));
    expect(failed.status).toBe(kind === "html" || kind === "svg" ? 415 : 502);
    expect(failed.headers.get("cache-control")).toBe("no-store");
    expect(await failed.text()).not.toContain("private upstream details");
    expect((await route(request(url))).status).toBe(200);
    expect((await route(request(url))).status).toBe(200);
    expect(calls).toBe(2);
  }
});

test("LRU retention stays within 128 entries and 32 MiB", async () => {
  for (const [count, bytes] of [[129, 8], [4, 10 * 1024 * 1024]]) {
    const urls = Array.from({ length: count }, () => permit("evict"));
    const body = Buffer.alloc(bytes); png.copy(body);
    let calls = 0;
    const route = createAssetProxyHandler(async url => { calls++; return resource(url, {}, body); });
    for (const url of urls) expect((await route(request(url))).status).toBe(200);
    expect((await route(request(urls.at(-1)!))).status).toBe(200);
    expect(calls).toBe(count);
    expect((await route(request(urls[0]))).status).toBe(200);
    expect(calls).toBe(count + 1);
  }
});
