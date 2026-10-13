import { describe, expect, test } from 'bun:test';
import { JSDOM } from 'jsdom';
import { createReaderDocument, sanitizeReaderHtml, readerDocumentMode } from '@/henry-ink/reader/document';

function render(html: string, css = '', attrs: Record<string, string> = {}) {
  const host = new JSDOM('<!doctype html><html><body></body></html>');
  const output = createReaderDocument({ html, css, bodyAttrs: attrs, assetOrigin: 'http://localhost:3000' }, host.window.document);
  host.window.close();
  return new JSDOM(output);
}

describe('isolated reader document', () => {
  test('preserves recognized legacy rendering modes with fixed safe declarations', () => {
    expect(readerDocumentMode('<!doctype html><p>Text</p>')).toBe('standards');
    expect(readerDocumentMode('<p>Text</p>')).toBe('quirks');
    expect(readerDocumentMode('<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">')).toBe('limited-quirks');
    const host = new JSDOM('');
    const output = createReaderDocument({ html: '<p>Text</p>', css: '', assetOrigin: 'http://localhost:3000', documentMode: 'limited-quirks' }, host.window.document);
    expect(output).toStartWith('<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"');
    host.window.close();
  });
  test('source pre-sanitization keeps passive containers but rejects spoofed reader data', () => {
    const host = new JSDOM('');
    const html = sanitizeReaderHtml('<stamp-thwack data-channel-slug="spoof" onclick="evil()">From</stamp-thwack>', host.window.document, true);
    expect(html).toBe('<stamp-thwack>From</stamp-thwack>');
    host.window.close();
  });
  test('preserves inert custom containers and direct body children', () => {
    const dom = render('<main><stamp-thwack><label>From:</label> Robin</stamp-thwack><p>Article</p></main>', 'main stamp-thwack { display: none }');
    const doc = dom.window.document;
    expect(doc.querySelector('body > main > stamp-thwack')?.textContent).toBe('From: Robin');
    expect(dom.window.getComputedStyle(doc.querySelector('stamp-thwack')!).display).toBe('none');
    expect(doc.querySelector('.archive-mode')).toBeNull();
    dom.window.close();
  });

  test('preserves root styling attributes without copying executable attributes', () => {
    const dom = render('<p>Article</p>', '', { id: 'article', bgcolor: '#eee', text: '#123', dir: 'rtl', onload: 'evil()' });
    expect(dom.window.document.body.id).toBe('article');
    expect(dom.window.document.body.getAttribute('bgcolor')).toBe('#eee');
    expect(dom.window.document.body.dir).toBe('rtl');
    expect(dom.window.document.body.hasAttribute('onload')).toBe(false);
    dom.window.close();
  });

  test('custom elements do not admit handlers, executable URLs or active children', () => {
    const dom = render('<stamp-thwack onclick="evil()"><script>evil()</script><iframe src="https://example.com"></iframe><a href="javascript:evil()">Link</a><button is="evil-button">Button</button></stamp-thwack>');
    const doc = dom.window.document;
    expect(doc.querySelector('stamp-thwack')).not.toBeNull();
    expect(doc.querySelector('script, iframe, [onclick]')).toBeNull();
    expect(doc.querySelector('a')?.hasAttribute('href')).toBe(false);
    expect(doc.querySelector('button')?.getAttribute('is')).not.toBe('evil-button');
    expect(doc.querySelector('meta[http-equiv]')?.getAttribute('content')).toContain("script-src 'none'");
    dom.window.close();
  });

  test('CSS cannot break out of its raw-text element', () => {
    const dom = render('<p>Article</p>', 'p::before {content:"</style><script>evil()</script>"}');
    expect(dom.window.document.scripts.length).toBe(0);
    expect(dom.window.document.querySelectorAll('style').length).toBe(1);
    dom.window.close();
  });

  test('raw-text escaping leaves media-query comparison operators intact', () => {
    const dom = render('<p>Article</p>', '@media (width <= 68rem) { p { display: none } }');
    expect(dom.window.document.querySelector('style')?.textContent).toContain('(width <= 68rem)');
    dom.window.close();
  });
});
