import DOMPurify from 'dompurify';
import type { ArchiveResponse } from '@/api/archive/routes';

export interface ReadableArticle {
  html: string;
  textContent: string;
  title?: string;
}

// Text mode lives in the app document, unlike the sandboxed Original iframe.
// Use a semantic allowlist: no source CSS, custom elements, forms or namespaces.
const tags = ['a', 'abbr', 'article', 'aside', 'b', 'bdi', 'bdo', 'blockquote', 'br',
  'caption', 'cite', 'code', 'dd', 'del', 'details', 'dfn', 'div', 'dl', 'dt', 'em',
  'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'i',
  'img', 'kbd', 'li', 'main', 'mark', 'ol', 'p', 'pre', 'q', 's', 'samp', 'section',
  'small', 'span', 'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'tfoot',
  'th', 'thead', 'time', 'tr', 'u', 'ul', 'var', 'wbr'];

const anchorPrefix = 'henry-text-';
const anchorId = (value: string) => value.startsWith(anchorPrefix) ? value : `${anchorPrefix}${value}`;

function purifierFor(ownerDocument: Document) {
  const purifier = DOMPurify(ownerDocument.defaultView!);
  purifier.addHook('uponSanitizeAttribute', (_node, attribute) => {
    if (attribute.attrName === 'id' || attribute.attrName === 'name') {
      attribute.attrValue = anchorId(attribute.attrValue);
    }
  });
  return purifier;
}

export function sanitizeReadableHtml(html: string, ownerDocument: Document = document): string {
  const clean = purifierFor(ownerDocument).sanitize(html, {
    ALLOWED_TAGS: tags,
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'lang', 'dir', 'datetime', 'colspan',
      'rowspan', 'scope', 'start', 'reversed', 'value', 'id', 'name'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  });
  const doc = ownerDocument.implementation.createHTMLDocument('');
  doc.body.innerHTML = clean;
  const targets = new Set<string>();
  for (const element of doc.body.querySelectorAll('[id], a[name]')) {
    for (const attr of ['id', 'name']) {
      const value = element.getAttribute(attr);
      if (value) targets.add(value);
    }
  }
  for (const link of doc.body.querySelectorAll('a[href^="#"]')) {
    const hash = link.getAttribute('href')!.slice(1);
    let target: string;
    try { target = anchorId(decodeURIComponent(hash)); }
    catch { target = anchorId(hash); }
    if (targets.has(target)) link.setAttribute('href', `#${encodeURIComponent(target)}`);
    else link.removeAttribute('href');
  }
  return doc.body.innerHTML;
}

function plainText(element: Element): string {
  const copy = element.cloneNode(true) as Element;
  for (const block of copy.querySelectorAll('p, div, section, article, h1, h2, h3, h4, h5, h6, li, tr, blockquote, pre, br')) {
    block.append('\n');
  }
  return (copy.textContent || '').replace(/[\t ]+/g, ' ').replace(/ *\n\s*/g, '\n').trim();
}

export async function extractReadableArticle(
  archive: ArchiveResponse, url: string, ownerDocument: Document = document,
): Promise<ReadableArticle> {
  const doc = ownerDocument.implementation.createHTMLDocument(archive.title || '');
  // Sanitize before parsing into our detached document, not just after extraction.
  doc.body.innerHTML = purifierFor(ownerDocument).sanitize(archive.html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'style', 'link', 'base', 'meta', 'iframe', 'object', 'embed', 'form', 'template', 'noscript'],
    FORBID_ATTR: ['style', 'srcdoc', 'is'],
    ALLOW_DATA_ATTR: false,
  });
  for (const element of doc.body.querySelectorAll('[href], [src]')) {
    for (const attribute of ['href', 'src']) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      if (attribute === 'href' && value.startsWith('#')) continue;
      try {
        let resolved = new URL(value, archive.resolvedUrl || url);
        // Production captures wrap relative links in the reader route. Compare
        // their source destination before deciding whether a footnote is local.
        if (attribute === 'href' && resolved.origin === 'https://henry.ink' && /^\/https?:\/\//.test(resolved.pathname)) {
          resolved = new URL(resolved.href.slice(resolved.origin.length + 1));
        }
        const page = new URL(archive.resolvedUrl || url);
        page.hash = '';
        const withoutHash = new URL(resolved);
        withoutHash.hash = '';
        element.setAttribute(attribute, attribute === 'href' && resolved.hash && withoutHash.href === page.href
          ? resolved.hash : new URL(value, archive.resolvedUrl || url).href);
      }
      catch { element.removeAttribute(attribute); }
    }
  }

  const fallback = doc.body;
  const fallbackText = plainText(fallback);
  let html = fallback.innerHTML;
  let title = archive.title || doc.querySelector('h1')?.textContent?.trim();
  // Readability can discard short notes and old table/font-based layouts. Keep
  // the intact sanitized body for those rather than gambling on a tiny extract.
  if (fallbackText.length >= 500) {
    try {
      const { Readability } = await import('@mozilla/readability');
      const article = new Readability(doc.cloneNode(true) as Document).parse();
      if (article?.content && (article.textContent?.trim().length || 0) >= Math.min(500, fallbackText.length / 2)) {
        html = article.content;
        title = title || article.title || undefined;
      }
    } catch {
      // A failed lazy chunk or extraction must never make the captured page empty.
    }
  }

  const output = ownerDocument.implementation.createHTMLDocument('');
  output.body.innerHTML = sanitizeReadableHtml(html, ownerDocument);
  if (!plainText(output.body) && archive.textContent.trim()) {
    for (const paragraph of archive.textContent.trim().split(/\n\s*\n/)) {
      const p = output.createElement('p');
      p.textContent = paragraph;
      output.body.appendChild(p);
    }
  }
  if (title && !output.body.querySelector('h1')) {
    const heading = output.createElement('h1');
    heading.textContent = title;
    output.body.insertBefore(heading, output.body.firstChild);
  }
  return { html: output.body.innerHTML, textContent: plainText(output.body), title };
}
