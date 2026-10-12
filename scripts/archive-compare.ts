import { JSDOM } from 'jsdom';
import { chromium } from 'playwright';
import { createArchiveService } from '@/api/archive/processor';
import { createReaderDocument, readerDocumentMode } from '@/henry-ink/reader/document';
import { fetchPublicResource, type PublicResource } from '@/api/archive/public-fetch';

// Deterministic before/after rendering of saved captures, with assets shared
// between both versions. Never runs source scripts or follows page navigation.
const directory = process.argv[2] || '/tmp/henry-archive-baseline';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const owner = new JSDOM('<!doctype html>');
const assets = new Map<string, Promise<PublicResource | null>>();
let failures = 0;
try {
  for await (const filename of new Bun.Glob('*.json').scan(directory)) {
    const fixture = await Bun.file(`${directory}/${filename}`).json();
    if (!fixture.captured) continue;
    const service = createArchiveService(async () => fixture.captured);
    const start = performance.now();
    const after = await service(fixture.url, 'https://api.henry.ink');
    const processMs = performance.now() - start;
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled: false, reducedMotion: 'reduce', serviceWorkers: 'block' });
      await context.route('**/*', async route => {
        if (!['image', 'font'].includes(route.request().resourceType())) return route.abort();
        const requested = new URL(route.request().url());
        const url = requested.pathname === '/api/asset-proxy' ? requested.searchParams.get('url')! : requested.href;
        if (!assets.has(url)) assets.set(url, fetchPublicResource(url, { allowHttp: true, maxBytes: 8 * 1024 * 1024, timeoutMs: 5000 }).catch(() => null));
        const resource = await assets.get(url);
        if (!resource) return route.abort();
        return route.fulfill({ status: resource.status, contentType: resource.headers.get('content-type') || 'application/octet-stream', body: resource.body });
      });
      const images: Buffer[] = [];
      const layouts: string[] = [];
      for (const [label, archive] of [['before', fixture.archive], ['after', after]] as const) {
        const page = await context.newPage();
        const html = createReaderDocument({ ...archive, assetOrigin: 'https://api.henry.ink', documentMode: readerDocumentMode(archive.html) }, owner.window.document);
        await page.setContent(html, { waitUntil: 'load' });
        await page.evaluate(async () => {
          // Offscreen lazy images otherwise settle between layout measurement
          // and the screenshot, causing false before/after geometry differences.
          await Promise.all([document.fonts.ready, ...Array.from(document.images, image => {
            image.loading = 'eager';
            return image.decode().catch(() => {});
          })]);
        });
        layouts.push(await page.evaluate(() => JSON.stringify(Array.from(document.body.querySelectorAll('*')).map(element => {
          const rect = element.getBoundingClientRect();
          const css = getComputedStyle(element);
          return [element.tagName, rect.x, rect.y, rect.width, rect.height, css.fontFamily, css.fontSize, css.lineHeight, css.color, css.backgroundColor, css.display];
        }))));
        images.push(await page.screenshot({ path: `${directory}/${filename.replace('.json', '')}-${width}-${label}.png`, animations: 'disabled', mask: [page.locator('video, audio')] }));
        await page.close();
      }
      const layoutEqual = layouts[0] === layouts[1];
      const pixelsEqual = images[0].equals(images[1]);
      if (!layoutEqual || !pixelsEqual) failures++;
      console.log(JSON.stringify({ site: filename, width, layoutEqual, pixelsEqual, processMs: Math.round(processMs) }));
      await context.close();
    }
  }
} finally { owner.window.close(); await browser.close(); }
if (failures) process.exitCode = 1;
