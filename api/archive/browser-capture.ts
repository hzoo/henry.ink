import { chromium, devices, type Browser, type BrowserContext } from "playwright";
import { flattenCapturedStylesheets } from "@/api/archive/captured-css";
import { ARCHIVE_USER_AGENT, ArchiveFetchError, fetchPublicResource, type PublicFetcher, type PublicResource } from "@/api/archive/public-fetch";

let browserPromise: Promise<Browser> | undefined;
async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true, channel: "chrome", timeout: 10_000 }).then(browser => {
      browser.on("disconnected", () => { browserPromise = undefined; });
      return browser;
    }).catch(error => { browserPromise = undefined; throw error; });
  }
  return browserPromise;
}

export async function closeArchiveBrowser(): Promise<void> {
  const pending = browserPromise;
  browserPromise = undefined;
  if (pending) await (await pending).close();
}

const MAX_CSS_BYTES = 2 * 1024 * 1024;
const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const MAX_REQUESTS = 40;
const TIMEOUT_MS = 12_000;
const MAX_NETWORK_CONCURRENCY = 4;

export function createCaptureDownloader(fetcher: PublicFetcher, controller: AbortController) {
  const signal = controller.signal;
  let active = 0;
  let totalBytes = 0;
  let cssBytes = 0;
  const waiting: Array<{ resolve: () => void; reject: (reason: unknown) => void }> = [];
  const listeners = new AbortController();
  signal.addEventListener("abort", () => {
    for (const waiter of waiting.splice(0)) waiter.reject(signal.reason);
    listeners.abort();
  }, { once: true, signal: listeners.signal });

  function acquire(): Promise<void> {
    signal.throwIfAborted();
    if (active < MAX_NETWORK_CONCURRENCY) {
      active++;
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => waiting.push({ resolve, reject }));
  }

  function release() {
    const next = waiting.shift();
    // Transfer the reserved slot directly so a new caller cannot steal it.
    if (next) next.resolve();
    else active--;
  }

  return async (url: string, kind: "document" | "stylesheet"): Promise<PublicResource> => {
    await acquire();
    const maxBytes = kind === "document" ? MAX_PAGE_BYTES : MAX_CSS_BYTES;
    let reportedBytes = 0;
    const onBytes = (bytes: number) => {
      signal.throwIfAborted();
      reportedBytes += bytes;
      totalBytes += bytes;
      if (kind === "stylesheet") cssBytes += bytes;
      let error: ArchiveFetchError | undefined;
      if (reportedBytes > maxBytes) error = new ArchiveFetchError("Resource too large", 413);
      else if (totalBytes > MAX_PAGE_BYTES + MAX_CSS_BYTES) error = new ArchiveFetchError("Page resources too large", 413);
      else if (cssBytes > MAX_CSS_BYTES) error = new ArchiveFetchError("Page stylesheets too large", 413);
      if (error) {
        controller.abort(error);
        throw error;
      }
    };
    try {
      signal.throwIfAborted();
      const resource = await fetcher(url, {
        allowHttp: true, maxBytes, timeoutMs: TIMEOUT_MS, signal, onBytes,
        accept: kind === "document" ? "text/html,application/xhtml+xml" : "text/css",
      });
      signal.throwIfAborted();
      // Test/custom fetchers may report no chunks (or only part of the body).
      // Charge the remainder, never double-count bytes reported during reading.
      if (resource.body.length > reportedBytes) onBytes(resource.body.length - reportedBytes);
      return resource;
    } catch (error) {
      if (error instanceof ArchiveFetchError && error.status === 413) controller.abort(error);
      throw signal.aborted ? signal.reason : error;
    } finally {
      release();
    }
  };
}

export async function capturePage(url: string, fetcher: PublicFetcher = fetchPublicResource) {
  let context: BrowserContext | undefined;
  const controller = new AbortController();
  const download = createCaptureDownloader(fetcher, controller);
  const sheets = new Map<string, PublicResource>();
  const downloaded = new Map<string, PublicResource>();
  let requests = 0;
  let fatal: Error | undefined;
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const error = new ArchiveFetchError("Archive capture timeout", 504);
      controller.abort(error);
      void context?.close().catch(() => {});
      reject(error);
    }, TIMEOUT_MS);
  });
  const capture = async () => {
    // Browser startup and the checked document fetch are independent. Observe
    // launch failures even when document validation exits before awaiting it.
    const browserReady = getBrowser();
    void browserReady.catch(() => {});
    // Resolve HTTP redirects before Chromium navigates. Playwright routing may
    // only intercept the first request of a browser redirect chain.
    const initial = await download(url, "document");
    const initialMime = initial.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (initialMime !== "text/html" && initialMime !== "application/xhtml+xml") throw new ArchiveFetchError("URL did not return an HTML document", 415);
    if (initial.status < 200 || initial.status >= 300) throw new ArchiveFetchError("Page upstream returned an error");
    downloaded.set(initial.url, initial);
    const browser = await browserReady;
    controller.signal.throwIfAborted();
    context = await browser.newContext({
      ...devices["Desktop Chrome"],
      userAgent: ARCHIVE_USER_AGENT,
      javaScriptEnabled: false,
      serviceWorkers: "block",
    });
    if (controller.signal.aborted) {
      await context.close();
      throw controller.signal.reason;
    }
    await context.routeWebSocket("**/*", socket => socket.close());
    const page = await context.newPage();
    await context.route("**/*", async route => {
      const request = route.request();
      const kind = request.resourceType();
      if (request.method() !== "GET" ||
        !(kind === "stylesheet" || (kind === "document" && request.frame() === page.mainFrame()))) {
        await route.abort();
        return;
      }
      try {
        controller.signal.throwIfAborted();
        if (++requests > MAX_REQUESTS) throw new ArchiveFetchError("Too many page resources", 413);
        let resource = downloaded.get(request.url());
        if (!resource) {
          resource = await download(request.url(), kind);
          downloaded.set(request.url(), resource);
          downloaded.set(resource.url, resource);
        }
        const mime = resource.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
        if (kind === "document" && mime !== "text/html" && mime !== "application/xhtml+xml") {
          throw new ArchiveFetchError("URL did not return an HTML document", 415);
        }
        if (kind === "document" && (resource.status < 200 || resource.status >= 300)) throw new ArchiveFetchError("Page upstream returned an error");
        if (kind === "stylesheet") {
          if (resource.status !== 200 || mime !== "text/css") { await route.abort(); return; }
          sheets.set(request.url(), resource);
          sheets.set(resource.url, resource);
        }
        // Do not forward Set-Cookie, redirects, reporting or preloading headers.
        await route.fulfill({
          status: resource.status,
          headers: { "Content-Type": resource.headers.get("content-type") || "text/html" },
          body: resource.body,
        });
      } catch (error) {
        if (kind === "document" || (error instanceof ArchiveFetchError && error.status === 413)) {
          fatal = error instanceof Error ? error : new ArchiveFetchError("Page fetch failed");
          controller.abort(fatal);
        }
        await route.abort().catch(() => {});
      }
    });
    try { await page.goto(initial.url, { waitUntil: "load", timeout: TIMEOUT_MS }); }
    catch (error) { throw fatal || error; }
    if (fatal) throw fatal;
    const fullHTMLContent = await page.content();
    const pageData = await page.evaluate(() => {
      const meta = (name: string) => document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.getAttribute("content") || "";
      return {
        baseUrl: document.baseURI,
        cssSources: Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).filter(element =>
          !(element instanceof HTMLLinkElement && element.disabled),
        ).map(element => ({
          url: element instanceof HTMLLinkElement ? element.href : null,
          content: element.tagName.toLowerCase() === "style" ? element.textContent || "" : "",
          media: element.getAttribute("media") || "",
        })),
        metadata: {
          title: meta("og:title") || document.title,
          author: meta("author") || meta("article:author"),
          publishedTime: meta("article:published_time") || meta("article:published") || meta("datePublished") || meta("publish_date") || document.querySelector("time[datetime]")?.getAttribute("datetime") || "",
          domain: location.hostname.replace(/^www\./, ""),
          url: location.href,
        },
        htmlAttrs: { class: document.documentElement.className || "", style: document.documentElement.getAttribute("style") || "", lang: document.documentElement.lang || "" },
        bodyAttrs: { class: document.body?.className || "", style: document.body?.getAttribute("style") || "" },
      };
    });
    const cssSources = await flattenCapturedStylesheets(pageData.cssSources.map(source => {
      const resource = source.url ? sheets.get(source.url) : undefined;
      return { content: source.url ? resource?.body.toString() || "" : source.content, baseUrl: resource?.url || pageData.baseUrl, media: source.media };
    }), sheets);
    return { fullHTMLContent, pageData, cssSources };
  };
  try { return await Promise.race([capture(), deadline]); }
  finally {
    clearTimeout(timer!);
    controller.abort();
    await context?.close().catch(() => {});
  }
}
