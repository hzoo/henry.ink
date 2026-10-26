import { expect, test } from 'bun:test';
import { JSDOM } from 'jsdom';
import { chromium } from 'playwright';
import { createReaderDocument } from '@/henry-ink/reader/document';

test.skipIf(!process.env.ARCHIVE_BROWSER_TESTS)('sandboxed reader blobs retain legacy line boxes, media queries and script isolation', async () => {
  const host = new JSDOM('');
  const html = createReaderDocument({
    html: '<stamp-thwack>Hidden metadata</stamp-thwack><table><tr><td><p><font face="Verdana" size="2">One<br>Two</font></p></td></tr></table>',
    css: '@media (width <= 1000px) { stamp-thwack { display:none } }',
    assetOrigin: 'https://api.example', documentMode: 'limited-quirks',
  }, host.window.document).replace('</body>', '<script>parent.__sourceExecuted=true</script></body>');
  host.window.close();
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Reader host</title>' }));
    await page.goto('https://reader.example/');
    const result = await page.evaluate(async content => {
      const frame = document.createElement('iframe');
      frame.setAttribute('sandbox', 'allow-same-origin');
      frame.style.width = '800px';
      const url = URL.createObjectURL(new Blob([content], { type: 'text/html' }));
      const loaded = new Promise<void>(resolve => frame.addEventListener('load', () => resolve(), { once: true }));
      frame.src = url;
      document.body.appendChild(frame);
      await loaded;
      const doc = frame.contentDocument!;
      const result = {
        height: doc.querySelector('p')!.getBoundingClientRect().height,
        hidden: doc.defaultView!.getComputedStyle(doc.querySelector('stamp-thwack')!).display,
        executed: '__sourceExecuted' in window,
        publicId: doc.doctype?.publicId,
      };
      frame.remove();
      URL.revokeObjectURL(url);
      return result;
    }, html);
    expect(result.height).toBe(32);
    expect(result.hidden).toBe('none');
    expect(result.executed).toBe(false);
    expect(result.publicId).toContain('XHTML 1.0 Transitional');
  } finally { await browser.close(); }
}, 20_000);
