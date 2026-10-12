import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { loadEnv } from 'vite';
import { resolveApiBase } from '../src/lib/api-config';
import type { AnnotationView } from '../src/lib/annotations/margin';
import { readerFixtures } from './fixtures/reader';

// Exercise the actual production bundle. Only transport responses are replaced;
// routing, fetch effects, sanitization, matching, CSS and click handlers are real.
const dist = resolve('henry-ink/dist');
assert(await Bun.file(`${dist}/index.html`).exists(), 'Run bun run build:ink first');
const env = loadEnv('production', process.cwd());
const api = resolveApiBase(env.VITE_API_URL, true);
const worker = env.VITE_WORKER_URL || 'https://bsky-search.henry.ink';
const server = Bun.serve({
  hostname: '127.0.0.1', port: 0,
  async fetch(request) {
    const pathname = decodeURIComponent(new URL(request.url).pathname);
    const path = resolve(dist, `.${pathname}`);
    if (!path.startsWith(`${dist}/`)) return new Response('Not found', { status: 404 });
    const file = Bun.file(path);
    return new Response(await file.exists() ? file : Bun.file(`${dist}/index.html`));
  },
});
const origin = server.url.origin;
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(async error => {
  await server.stop(true);
  throw error;
});
try {
  for (const width of [1280, 390]) {
    for (const fixture of readerFixtures) {
      const context = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
      const page = await context.newPage();
      page.setDefaultTimeout(8000);
      const failures: string[] = [];
      const requests: string[] = [];
      let releaseTranscript!: () => void;
      let transcriptMode: 'ready' | 'pending' | 'error' = 'ready';
      let transcriptGate: Promise<void> = Promise.resolve();
      page.on('pageerror', error => failures.push(error.message));
      const quote = fixture.paragraphs.at(-1)!;
      const note: AnnotationView = {
        uri: 'at://did:plc:test/at.margin.highlight/fixture', collection: 'at.margin.highlight',
        via: 'margin', motivation: 'highlighting', author: { did: 'did:plc:test', handle: 'reader.test' },
        target: fixture.url, createdAt: '2026-01-01T00:00:00Z', labels: [], anchor: { kind: 'quote', exact: quote },
      };
      // Force a real scroll without depending on the amount of synthetic prose.
      const archive = {
        ...fixture.archive,
        html: fixture.archive.html.replace('<p', '<p onclick="parent.__sourceScriptRan=true"') + '<script>parent.__sourceScriptRan=true</script>',
        css: `${fixture.archive.css || ''}\n#last-paragraph{margin-top:1200px}`,
      };
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin === origin && !url.pathname.startsWith('/api/')) return route.continue();
        requests.push(url.href);
        const json = (value: unknown) => route.fulfill({ json: value, headers: { 'Access-Control-Allow-Origin': '*' } });
        if (route.request().method() === 'OPTIONS' && url.origin === api) return route.fulfill({
          status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type' },
        });
        if (url.origin === api) {
          if (url.pathname === '/api/archive' && url.searchParams.get('url') === fixture.url) return json(archive);
          if (url.pathname === '/api/annotations/margin') return json({ items: [note], skipped: 0 });
          if (url.pathname === '/api/arena/enhance') return json({ matches: [] });
          if (url.pathname === '/api/youtube/transcript') {
            if (transcriptMode === 'pending') await transcriptGate;
            if (transcriptMode === 'error') return route.fulfill({ status: 500,
              json: { videoId: url.searchParams.get('videoId'), transcript: [], error: 'Failed to fetch transcript: private upstream details' },
              headers: { 'Access-Control-Allow-Origin': '*' } });
            return json({ videoId: url.searchParams.get('videoId'), title: 'Transcript fixture', transcript: [{ text: 'A transcript from the configured API.', offset: 0, duration: 5 }] });
          }
        }
        if (url.origin === new URL(worker).origin && url.pathname === new URL(worker).pathname) return json({ posts: [] });
        if (url.origin === 'https://www.youtube-nocookie.com' && route.request().resourceType() === 'document') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Offline player</title>' });
        failures.push(`Unexpected request: ${url.href}`);
        return route.abort();
      });
      try {
        await page.goto(`${origin}/${fixture.url}`);
        const iframe = page.locator('iframe[title]').first();
        await iframe.waitFor();
        const frame = page.frameLocator('iframe[title]').first();
        await frame.locator('aside[aria-label="Margin note by reader.test"]').waitFor();
        const content = await frame.locator('body').innerText();
        for (const paragraph of fixture.paragraphs) assert(content.replace(/\s+/g, ' ').includes(paragraph), `Missing article paragraph: ${paragraph}`);
        assert.equal(await iframe.getAttribute('sandbox'), 'allow-same-origin');
        assert.equal(await frame.locator('script, [onclick], [onerror]').count(), 0);
        assert.equal(await page.evaluate(() => '__sourceScriptRan' in window), false);
        const frameWidth = await iframe.evaluate(el => el.clientWidth);
        const sourceContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width: frameWidth, height: 800 } });
        try {
          await sourceContext.route('**/*', route => route.abort());
          const source = await sourceContext.newPage();
          await source.setContent(`<!doctype html><html><head><style>${archive.css}</style></head><body>${archive.html}</body></html>`);
          await source.evaluate(attrs => {
            for (const [el, values] of [[document.documentElement, attrs.html], [document.body, attrs.body]] as const) {
              for (const [name, value] of Object.entries(values || {})) el.setAttribute(name, value);
            }
          }, { html: archive.htmlAttrs, body: archive.bodyAttrs });
          const styles = (el: Element) => {
            const style = el.ownerDocument.defaultView!.getComputedStyle(el);
            return [style.color, style.backgroundColor, style.fontFamily, style.fontSize, style.lineHeight, style.textAlign];
          };
          for (const selector of ['body', 'h1', 'p']) {
            if (!await source.locator(selector).count()) continue;
            assert.deepEqual(await frame.locator(selector).first().evaluate(styles), await source.locator(selector).first().evaluate(styles), `${selector}: original typography/color changed`);
          }
        } finally { await sourceContext.close(); }
        const highlight = await iframe.evaluate((element) => {
          const doc = (element as HTMLIFrameElement).contentDocument!;
          const view = doc.defaultView! as Window & { CSS: typeof CSS };
          return [...(view.CSS.highlights.get('henry-notes') || [])].map(range => range.toString());
        });
        assert(highlight.includes(quote), 'The visible highlight must cover the expected passage');
        const before = await frame.locator('aside[aria-label]').evaluate(el => el.getBoundingClientRect().top);
        assert(before > 800, 'Jump fixture must start outside the viewport');
        await page.screenshot({ path: `test-results/${fixture.id}-${width}-original.png` });
        if (width < 1024) await page.getByRole('button', { name: 'Open notes', exact: true }).click();
        await page.getByRole('button', { name: 'Show passage in article', exact: true }).click();
        await page.waitForFunction(() => {
          const frame = document.querySelector('iframe') as HTMLIFrameElement;
          const note = frame?.contentDocument?.querySelector('aside[aria-label]');
          if (!note) return false;
          const rect = note.getBoundingClientRect();
          return rect.top >= 0 && rect.bottom <= frame.clientHeight;
        });
        if (width < 1024) assert.equal(await page.getByRole('button', { name: 'Open notes', exact: true }).getAttribute('aria-expanded'), 'false');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Reader chrome overflows on mobile');
        await page.screenshot({ path: `test-results/${fixture.id}-${width}-jump.png` });
        await page.getByRole('button', { name: 'Text', exact: true }).click();
        await page.locator('iframe[title]').waitFor({ state: 'detached' });
        await page.locator('p').filter({ hasText: quote }).first().waitFor();
        const textParagraphs = await page.locator('p').allTextContents();
        for (const paragraph of fixture.paragraphs) assert(textParagraphs.some(text => text.replace(/\s+/g, ' ').trim() === paragraph), `Text mode lost paragraph: ${paragraph}`);
        assert.equal(requests.filter(url => new URL(url).pathname === '/api/archive').length, 1, 'Text mode must reuse the archive');
        await page.screenshot({ path: `test-results/${fixture.id}-${width}-text.png` });
        await page.goto(`${origin}/https://www.youtube.com/watch?v=abcdefghijk`);
        await page.getByText('A transcript from the configured API.', { exact: true }).waitFor();
        assert(requests.some(url => url.startsWith(`${api}/api/youtube/transcript?`)), 'Transcript must use the configured production API');
        assert.equal(requests.filter(url => new URL(url).pathname === '/api/youtube/transcript').length, 1, 'Switching into embed mode must not fetch twice');
        assert.equal(await page.getByRole('status').filter({ hasText: 'Loading transcript' }).count(), 0);
        transcriptMode = 'pending';
        transcriptGate = new Promise(resolve => { releaseTranscript = resolve; });
        await page.goto(`${origin}/https://www.youtube.com/watch?v=H4LosXgKX4g`);
        const player = page.locator('iframe[src*="youtube-nocookie.com/embed/H4LosXgKX4g"]');
        await player.waitFor();
        const playerElement = await player.elementHandle();
        assert.equal(await page.getByRole('status').filter({ hasText: 'Loading transcript' }).count(), 0, 'Loading text must not appear immediately');
        await page.getByRole('status').filter({ hasText: 'Loading transcript' }).waitFor();
        await page.screenshot({ path: `test-results/${fixture.id}-${width}-transcript-loading.png` });
        transcriptMode = 'error';
        releaseTranscript();
        await page.getByRole('alert').filter({ hasText: 'The transcript could not be loaded.' }).waitFor();
        assert.equal(await playerElement!.evaluate(el => el.isConnected), true, 'Transcript failure must not replace the video');
        assert(!(await page.locator('body').innerText()).includes('private upstream details'), 'Do not expose upstream bodies');
        assert.equal(await page.getByRole('button', { name: 'Copy', exact: true }).count(), 0, 'Unavailable transcripts have no dead controls');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Video/error layout overflows mobile');
        await page.screenshot({ path: `test-results/${fixture.id}-${width}-transcript-error.png` });
        transcriptMode = 'ready';
        await page.getByRole('button', { name: 'Try again', exact: true }).click();
        await page.getByText('A transcript from the configured API.', { exact: true }).waitFor();
        assert.equal(await playerElement!.evaluate(el => el.isConnected), true, 'Retry must preserve the player and playback');
        assert.deepEqual(failures, []);
        console.info(`PASS ${fixture.name} ${width}px: article, highlight, jump, text reuse, delayed transcript, non-blocking failure/retry`);
      } catch (error) {
        await page.screenshot({ path: `test-results/${fixture.id}-${width}-failure.png` }).catch(() => {});
        throw new Error(`${fixture.name} ${width}px: ${String(error)}\n${failures.join('\n')}`, { cause: error });
      } finally { await context.close(); }
    }
  }
} finally {
  await browser.close();
  await server.stop(true);
}
