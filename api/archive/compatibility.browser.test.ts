import { afterAll, expect, test } from 'bun:test';
import { JSDOM } from 'jsdom';
import { chromium } from 'playwright';
import { capturePage, closeArchiveBrowser } from '@/api/archive/browser-capture';
import { createArchiveService } from '@/api/archive/processor';
import { createAssetProxyHandler, registerArchiveAssets } from '@/api/archive/routes';
import { createReaderDocument } from '@/henry-ink/reader/document';
import type { PublicFetcher } from '@/api/archive/public-fetch';

const browserTest = test.skipIf(!process.env.ARCHIVE_BROWSER_TESTS);
afterAll(async () => { if (process.env.ARCHIVE_BROWSER_TESTS) await closeArchiveBrowser(); });
const css = `@layer base, theme;
@layer base { body { margin:0; background:#faf0dc } article-shell { display:block; max-width:880px; margin:auto; padding:20px; } }
@layer theme { .paper > body { color:#342918; font:18px/1.6 Georgia,serif } h1 { font-size:42px } }
.images { display:grid; grid-template-columns:repeat(4,1fr); gap:8px } img { width:100%; height:20px }
@media(max-width:600px) { h1 { font-size:28px } .images { grid-template-columns:repeat(2,1fr) } }`;
const source = `<!doctype html><html class="paper"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body>
<article-shell><h1>Original styles, passive content</h1><p>A compact fixture for responsive layouts.</p>
<div class="images"><picture><source media="(max-width:600px)" srcset="/mobile.svg"><img src="/desktop.svg"></picture>
${Array.from({ length: 11 }, (_, i) => `<img src="/image-${i}.svg">`).join('')}</div>
<img id="lazy" data-src="/lazy.svg"><script>document.body.textContent='Source script executed'</script></article-shell></body></html>`;

for (const width of [1280, 390]) browserTest(`capture and sandbox preserve CSS and responsive images at ${width}px`, async () => {
  let assetDownloads = 0;
  const fetcher: PublicFetcher = async url => {
    if (url.endsWith('.svg')) {
      assetDownloads++;
      await Bun.sleep(30);
      return { url, status: 200, headers: new Headers({ 'content-type': 'image/svg+xml' }),
        body: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="20"><rect width="24" height="20" fill="#856c40"/></svg>') };
    }
    return { url, status: 200, headers: new Headers({ 'content-type': 'text/html' }), body: Buffer.from(source) };
  };
  const archive = await createArchiveService(url => capturePage(url, fetcher))('https://compat.example/article', 'https://api.example');
  expect(assetDownloads).toBe(0);
  expect(archive.html).not.toContain('<script');
  registerArchiveAssets(archive);
  const proxy = createAssetProxyHandler(fetcher);
  const host = new JSDOM('');
  const reader = createReaderDocument({ ...archive, assetOrigin: 'https://api.example' }, host.window.document);
  host.window.close();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled: false });
    const statuses: number[] = [];
    await context.route('**/*', async route => {
      const url = route.request().url();
      if (url.startsWith('https://api.example/api/asset-proxy')) {
        const response = await proxy(new Request(url, { headers: { 'x-forwarded-for': `compat-${width}` } }));
        statuses.push(response.status);
        await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
      } else if (url.endsWith('.svg')) {
        const asset = await fetcher(url, { maxBytes: 1024, timeoutMs: 5000 });
        await route.fulfill({ contentType: 'image/svg+xml', body: asset.body });
      } else await route.fulfill({ contentType: 'text/html', body: url.endsWith('/original') ? source : reader });
    });
    const page = await context.newPage();
    const metrics = () => page.evaluate(() => {
      const heading = document.querySelector('h1')!;
      const style = getComputedStyle(heading);
      return { headingWidth: heading.getBoundingClientRect().width, font: style.font, color: style.color,
        background: getComputedStyle(document.body).backgroundColor,
        columns: getComputedStyle(document.querySelector('.images')!).gridTemplateColumns,
        overflow: document.documentElement.scrollWidth > innerWidth };
    });
    await page.goto('https://compat.example/original');
    const original = await metrics();
    assetDownloads = 0;
    await page.goto('https://reader.example/rendered');
    expect(await metrics()).toEqual(original);
    expect(original.overflow).toBe(false);
    expect(await page.locator('img').evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth === 24))).toBe(true);
    expect(await page.locator('picture img').evaluate(image => decodeURIComponent((image as HTMLImageElement).currentSrc))).toContain(width < 600 ? '/mobile.svg' : '/desktop.svg');
    expect(statuses).toHaveLength(13);
    expect(statuses.every(status => status === 200)).toBe(true);
    expect(assetDownloads).toBe(13);
    await page.reload();
    expect(assetDownloads).toBe(13);
    expect(statuses).toHaveLength(26);
  } finally { await browser.close(); }
}, 20_000);
