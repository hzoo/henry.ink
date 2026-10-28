import { afterAll, expect, spyOn, test } from "bun:test";
import { capturePage, closeArchiveBrowser, createCaptureDownloader } from "@/api/archive/browser-capture";
import { flattenCapturedStylesheets } from "@/api/archive/captured-css";
import { ARCHIVE_USER_AGENT, ArchiveFetchError, createPublicFetcher, type PublicFetcher, type PublicFetchOptions, type PublicResource } from "@/api/archive/public-fetch";
import { chromium, type Browser } from "playwright";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { createAssetProxyHandler, registerArchiveAssets } from "@/api/archive/routes";
import { createArchiveService } from "@/api/archive/processor";

const browserTest = test.skipIf(!process.env.ARCHIVE_BROWSER_TESTS);
afterAll(async () => { if (process.env.ARCHIVE_BROWSER_TESTS) await closeArchiveBrowser(); });

const resource = (url: string, bytes = 10): PublicResource => ({
  url, status: 200, headers: new Headers({ "content-type": "text/css" }), body: Buffer.alloc(bytes),
});

test("cold browser startup overlaps document fetching without creating a context before validation", async () => {
  await closeArchiveBrowser();
  const launched = Promise.withResolvers<Browser>();
  const downloaded = Promise.withResolvers<PublicResource>();
  const fetching = Promise.withResolvers<void>();
  let contexts = 0;
  const browser = {
    on() {},
    async close() {},
    async newContext(options: { userAgent: string; javaScriptEnabled: boolean; serviceWorkers: string }) {
      expect(options.userAgent).toBe(ARCHIVE_USER_AGENT);
      expect(options.javaScriptEnabled).toBe(false);
      expect(options.serviceWorkers).toBe("block");
      contexts++;
      throw new Error("Reached browser context");
    },
  } as unknown as Browser;
  const launch = spyOn(chromium, "launch").mockReturnValue(launched.promise);
  const url = "https://source.example/overlap";
  const document = { ...resource(url), headers: new Headers({ "content-type": "text/html" }) };
  const result = capturePage(url, async () => {
    fetching.resolve();
    return downloaded.promise;
  }).catch(error => error);
  try {
    await fetching.promise;
    expect(launch).toHaveBeenCalledTimes(1);
    launched.resolve(browser);
    await Promise.resolve();
    expect(contexts).toBe(0);
    downloaded.resolve(document);
    expect(await result).toMatchObject({ message: "Reached browser context" });
    expect(contexts).toBe(1);
  } finally {
    launched.resolve(browser);
    downloaded.resolve(document);
    await result;
    await closeArchiveBrowser();
    launch.mockRestore();
  }
});

test("document rejection still wins over an overlapping browser launch failure", async () => {
  await closeArchiveBrowser();
  const launch = spyOn(chromium, "launch").mockRejectedValue(new Error("Chrome unavailable"));
  try {
    await expect(capturePage("https://source.example/file", async url => {
      await Bun.sleep(0);
      return { ...resource(url), headers: new Headers({ "content-type": "application/pdf" }) };
    })).rejects.toMatchObject({ status: 415 });
    expect(launch).toHaveBeenCalledTimes(1);
  } finally {
    await closeArchiveBrowser();
    launch.mockRestore();
  }
});

test("capture admits at most four network downloads from a 39-stylesheet burst", async () => {
  const controller = new AbortController();
  const gates: Array<() => void> = [];
  let active = 0;
  let peak = 0;
  let calls = 0;
  const download = createCaptureDownloader(async url => {
    calls++;
    peak = Math.max(peak, ++active);
    await new Promise<void>(resolve => gates.push(resolve));
    active--;
    return resource(url);
  }, controller);
  try {
    const results = Array.from({ length: 39 }, (_, i) => download(`https://source.example/${i}.css`, "stylesheet"));
    for (let i = 0; i < results.length; i += 4) {
      await Promise.resolve();
      expect(active).toBe(Math.min(4, results.length - i));
      for (const release of gates.splice(0)) release();
      await Promise.all(results.slice(i, i + 4));
    }
    expect(calls).toBe(39);
    expect(peak).toBe(4);
  } finally { controller.abort(); }
});

test("capture budget overflow aborts active downloads and rejects queued ones without starting them", async () => {
  const controller = new AbortController();
  const started: Array<{ options: PublicFetchOptions; resolve: (value: PublicResource) => void }> = [];
  const download = createCaptureDownloader((url, options) => new Promise(resolve => started.push({ options, resolve })), controller);
  const results = Promise.allSettled(Array.from({ length: 39 }, (_, i) => download(`https://source.example/${i}.css`, "stylesheet")));
  await Promise.resolve();
  expect(started).toHaveLength(4);
  started[0].options.onBytes!(1024 * 1024);
  started[1].options.onBytes!(1024 * 1024);
  expect(() => started[2].options.onBytes!(1)).toThrow("Page stylesheets too large");
  for (const [i, pending] of started.entries()) {
    expect(pending.options.signal?.aborted).toBe(true);
    pending.resolve(resource(`https://source.example/${i}.css`));
  }
  for (const result of await results) {
    expect(result.status).toBe("rejected");
    if (result.status === "rejected") expect(result.reason).toMatchObject({ status: 413, message: "Page stylesheets too large" });
  }
  expect(started).toHaveLength(4);
});

test("capture charges returned buffers from mock fetchers and keeps per-resource limits", async () => {
  for (const kind of ["document", "stylesheet"] as const) {
    const controller = new AbortController();
    const download = createCaptureDownloader(async url => resource(url, 2 * 1024 * 1024 + 1), controller);
    await expect(download("https://source.example/resource", kind)).rejects.toMatchObject({ status: 413, message: "Resource too large" });
    expect(controller.signal.aborted).toBe(true);
  }
  const controller = new AbortController();
  const download = createCaptureDownloader(async url => resource(url, 1024 * 1024 + 1), controller);
  await download("https://source.example/one.css", "stylesheet");
  await expect(download("https://source.example/two.css", "stylesheet")).rejects.toMatchObject({ status: 413, message: "Page stylesheets too large" });
});

test("capture charges initial HTML toward the shared total and does not double-charge chunks", async () => {
  const controller = new AbortController();
  const download = createCaptureDownloader(async (url, options) => {
    const bytes = url.endsWith("overflow.css") ? 1 : 2 * 1024 * 1024;
    options.onBytes!(bytes / 2);
    // Only half was reported: the returned buffer must charge the remainder.
    return resource(url, bytes);
  }, controller);
  await download("https://source.example/one", "document");
  await download("https://source.example/two", "document");
  await expect(download("https://source.example/overflow.css", "stylesheet")).rejects.toMatchObject({ status: 413, message: "Page resources too large" });
});

test("streamed bytes from failed resources still spend the capture budget", async () => {
  const controller = new AbortController();
  const download = createCaptureDownloader(async (_url, options) => {
    options.onBytes!(1024 * 1024);
    throw new Error("Connection lost after reading");
  }, controller);
  await expect(download("https://source.example/one.css", "stylesheet")).rejects.toThrow("Connection lost");
  await expect(download("https://source.example/two.css", "stylesheet")).rejects.toThrow("Connection lost");
  await expect(download("https://source.example/three.css", "stylesheet")).rejects.toMatchObject({ status: 413 });
});

test("capture cancellation rejects queued work without waiting for active fetchers", async () => {
  const controller = new AbortController();
  let calls = 0;
  const gates: Array<(value: PublicResource) => void> = [];
  const download = createCaptureDownloader(() => {
    calls++;
    return new Promise(resolve => gates.push(resolve));
  }, controller);
  const active = Promise.allSettled(Array.from({ length: 4 }, () => download("https://source.example/active.css", "stylesheet")));
  const queued = download("https://source.example/queued.css", "stylesheet");
  const failure = queued.catch(error => error);
  await Promise.resolve();
  controller.abort(new Error("Cancelled capture"));
  expect(await failure).toMatchObject({ message: "Cancelled capture" });
  expect(calls).toBe(4);
  for (const resolve of gates) resolve(resource("https://source.example/active.css"));
  await active;
  await expect(download("https://source.example/never.css", "stylesheet")).rejects.toThrow("Cancelled capture");
  expect(calls).toBe(4);
});

browserTest("browser downloads only HTML/CSS, never executes source scripts, and reuses redirected CSS", async () => {
  const calls: string[] = [];
  const fetcher: PublicFetcher = async url => {
    calls.push(url);
    if (url === "https://source.example/start") return {
      url: "https://source.example/articles/post/", status: 200,
      headers: new Headers({ "content-type": "text/html" }),
      body: Buffer.from('<!doctype html><html><head><title>Static title</title><link rel="stylesheet" href="https://styles.example/old.css"></head><body><p>Static article</p><script>document.title="SOURCE SCRIPT EXECUTED";fetch("https://private.example/leak")</script><img src="slow.png"></body></html>'),
    };
    if (url === "https://styles.example/old.css") return {
      url: "https://styles.example/theme/main.css", status: 200,
      headers: new Headers({ "content-type": "text/css" }),
      body: Buffer.from('p {color:blue;background:url(../bg.png)}'),
    };
    throw new Error("Unexpected network request: " + url);
  };
  const result = await capturePage("https://source.example/start", fetcher);
  expect(result.pageData.metadata.title).toBe("Static title");
  expect(result.pageData.baseUrl).toBe("https://source.example/articles/post/");
  expect(result.cssSources[0].baseUrl).toBe("https://styles.example/theme/main.css");
  expect(result.cssSources[0].content).toContain("color:blue");
  expect(calls).toEqual(["https://source.example/start", "https://styles.example/old.css"]);
});

browserTest("browser forwards document validation failures", async () => {
  const fetcher: PublicFetcher = async url => ({ url, status: 200, headers: new Headers({ "content-type": "application/pdf" }), body: Buffer.from("%PDF") });
  await expect(capturePage("https://source.example/file", fetcher)).rejects.toMatchObject({ status: 415 });
});

function stylesheetFixture(sizes: number[]) {
  const cssPrefix = 'p{color:blue}/*';
  const sheets = sizes.map(bytes => Buffer.from(cssPrefix + 'x'.repeat(bytes - cssPrefix.length - 2) + '*/'));
  const cssLimits: number[] = [];
  const fetcher: PublicFetcher = async (url, options) => {
    const stylesheet = new URL(url).pathname.match(/^\/(\d+)\.css$/);
    let body: Buffer;
    if (stylesheet) {
      cssLimits.push(options.maxBytes);
      body = sheets[Number(stylesheet[1])];
    } else {
      body = Buffer.from('<!doctype html><head>' + sizes.map((_, index) => `<link rel="stylesheet" href="/${index}.css">`).join('') + '</head><body><p>Article</p></body>');
    }
    if (body.length > options.maxBytes) throw new ArchiveFetchError("Resource too large", 413);
    return { url, status: 200, headers: new Headers({ "content-type": stylesheet ? "text/css" : "text/html" }), body };
  };
  return { fetcher, cssLimits };
}

browserTest("browser accepts a 542655-byte stylesheet within the 2 MiB CSS budget", async () => {
  const { fetcher, cssLimits } = stylesheetFixture([542_655]);
  const result = await capturePage("https://source.example/large-stylesheet", fetcher);
  expect(cssLimits).toEqual([2 * 1024 * 1024]);
  expect(result.cssSources).toHaveLength(1);
  expect(result.cssSources[0].content).toMatch(/color:\s*blue/);
});

browserTest("browser rejects individually allowed stylesheets exceeding the aggregate 2 MiB CSS budget", async () => {
  const { fetcher, cssLimits } = stylesheetFixture([1024 * 1024, 1024 * 1024 + 1]);
  await expect(capturePage("https://source.example/oversized-css-total", fetcher)).rejects.toMatchObject({
    status: 413, message: "Page stylesheets too large",
  });
  expect(cssLimits).toEqual([2 * 1024 * 1024, 2 * 1024 * 1024]);
});

browserTest("capture propagates the modern UA through nested CSS imports without fetching fonts or executing scripts", async () => {
  const calls: string[] = [];
  const resources: Record<string, string> = {
    "https://source.example/article": '<!doctype html><title>Static</title><link rel="stylesheet" href="/main.css"><script>document.title="Executed"</script><p>Article</p>',
    "https://source.example/main.css": '@import "/child.css" layer(theme) supports(display:grid) screen; p{color:red}',
    "https://source.example/child.css": '@import "/font.css"; p{background:url(/image.png)}',
    "https://source.example/font.css": '@font-face{font-family:Test;font-weight:100 900;src:url(./font.woff2) format("woff2")}',
  };
  const fetcher = createPublicFetcher(async () => [{ address: "93.184.216.34", family: 4 }], async (url, options) => {
    calls.push(url.href);
    expect((options.headers as Record<string, string>)["User-Agent"]).toBe(ARCHIVE_USER_AGENT);
    if (!(url.href in resources)) throw new Error("Unexpected fetch: " + url.href);
    return Object.assign(Readable.from([Buffer.from(resources[url.href])]), {
      statusCode: 200, headers: { "content-type": url.pathname.endsWith(".css") ? "text/css" : "text/html" },
    }) as unknown as IncomingMessage;
  });
  const result = await capturePage("https://source.example/article", fetcher);
  expect(result.pageData.metadata.title).toBe("Static");
  expect(result.cssSources[0].content).not.toContain('@import');
  expect(result.cssSources[0].content).toContain('https://source.example/font.woff2');
  expect(result.cssSources[0].content).toContain('font-weight: 100 900');
  expect(result.cssSources[0].content).toContain('@layer theme');
  expect(result.cssSources[0].content).toContain('@supports (display: grid)');
  expect(calls).toEqual(Object.keys(resources));
});

browserTest("flattened conditional imports preserve the browser's named layer ordering", async () => {
  const baseUrl = "https://source.example/main.css";
  const childUrl = "https://source.example/child.css";
  const css = '@import "child.css" layer(first) supports(unknown:unknown); @import "child.css" layer(second); @layer first{p{color:red}} @layer second{p{color:blue}}';
  const child = { url: childUrl, status: 200, headers: new Headers({ "content-type": "text/css" }), body: Buffer.from('p{color:blue}') };
  const [flattened] = await flattenCapturedStylesheets([{ content: css, baseUrl, media: "" }], new Map([[childUrl, child]]));
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  try {
    const context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: "block" });
    const page = await context.newPage();
    await context.route("**/*", route => route.fulfill({ contentType: "text/css", body: child.body }));
    await page.setContent(`<style>${css.replaceAll('"child.css"', `"${childUrl}"`)}</style><p>Article</p>`, { waitUntil: "load" });
    const originalColor = await page.locator("p").evaluate(element => getComputedStyle(element).color);
    await page.setContent(`<style>${flattened.content}</style><p>Article</p>`, { waitUntil: "load" });
    expect(await page.locator("p").evaluate(element => getComputedStyle(element).color)).toBe(originalColor);
  } finally { await browser.close(); }
}, 20_000);

browserTest("five concurrent archives use one real browser capture and one HTML download", async () => {
  let downloads = 0;
  let captures = 0;
  const fetcher: PublicFetcher = async url => {
    downloads++;
    return { url, status: 200, headers: new Headers({ "content-type": "text/html" }), body: Buffer.from('<!doctype html><title>Article</title><p>Original text</p><img src="https://images.example/slow.png">') };
  };
  const service = createArchiveService(url => { captures++; return capturePage(url, fetcher); });
  const results = await Promise.all(Array.from({ length: 5 }, () => service("https://source.example/article", "https://api.henry.ink")));
  expect(captures).toBe(1);
  expect(downloads).toBe(1);
  expect(results).toHaveLength(5);
  expect(results[0].textContent).toContain("Original text");
});

browserTest("browser aborts a page exceeding the resource count budget", async () => {
  const { fetcher, cssLimits } = stylesheetFixture(Array.from({ length: 40 }, () => 100));
  await expect(capturePage("https://source.example/many-stylesheets", fetcher)).rejects.toMatchObject({
    status: 413, message: "Too many page resources",
  });
  // The routed HTML document counts toward the 40-resource limit.
  expect(cssLimits.length).toBeLessThanOrEqual(39);
});

browserTest("proxied SVG still renders as an image and cannot execute in a document", async () => {
  const asset = "https://assets.example/csp-test.svg";
  registerArchiveAssets({ html: `/api/asset-proxy?url=${encodeURIComponent(asset)}`, textContent: "" });
  const proxy = createAssetProxyHandler(async url => ({
    url, status: 200, headers: new Headers({ "content-type": "image/svg+xml" }),
    body: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><rect width="12" height="12" fill="red"/><script>globalThis.__sourceScriptExecuted=true</script></svg>'),
  }));
  const result = await proxy(new Request(`https://api.henry.ink/api/asset-proxy?url=${encodeURIComponent(asset)}`));
  expect(result.status).toBe(200);
  const body = Buffer.from(await result.arrayBuffer());
  const headers = Object.fromEntries(result.headers);
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  try {
    const page = await browser.newPage();
    await page.route("**/*", async route => {
      const url = route.request().url();
      if (url.endsWith("/probe")) {
        await route.fulfill({ contentType: "text/html", body: '<img id="image" src="/asset.svg"><iframe src="/inline.svg"></iframe>' });
      } else {
        const responseHeaders = { ...headers };
        // Check CSP independently of attachment disposition on a navigable SVG.
        if (url.endsWith("/inline.svg")) delete responseHeaders["content-disposition"];
        await route.fulfill({ headers: responseHeaders, body });
      }
    });
    await page.goto("https://fixture.example/probe", { waitUntil: "load" });
    expect(await page.locator("#image").evaluate(element => (element as HTMLImageElement).naturalWidth)).toBe(12);
    const frame = page.frames().find(frame => frame.url().endsWith("/inline.svg"));
    expect(frame).toBeDefined();
    expect(await frame!.evaluate(() => (globalThis as typeof globalThis & { __sourceScriptExecuted?: boolean }).__sourceScriptExecuted)).toBeUndefined();
  } finally { await browser.close(); }
}, 20_000);
