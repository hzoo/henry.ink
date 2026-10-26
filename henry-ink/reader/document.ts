import DOMPurify, { type Config } from 'dompurify';
import { TRUSTED_CDNS } from '@/api/archive/trusted-cdns';
import { READER_DOCTYPES, type ReaderDocumentMode } from '@/src/lib/archive-document-mode';
export { readerDocumentMode, type ReaderDocumentMode } from '@/src/lib/archive-document-mode';

interface ArchiveDocumentInput {
  html: string;
  css: string;
  title?: string;
  htmlAttrs?: Record<string, string>;
  bodyAttrs?: Record<string, string>;
  assetOrigin: string;
  documentMode?: ReaderDocumentMode;
}

const readerHtmlPolicy: Config = {
  USE_PROFILES: { html: true, svg: true },
  CUSTOM_ELEMENT_HANDLING: {
    // Preserve passive layout containers, never their implementation or "is".
    tagNameCheck: /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/,
    allowCustomizedBuiltInElements: false,
  },
  FORBID_TAGS: ['script', 'style', 'iframe', 'embed', 'object', 'applet', 'base', 'meta', 'link',
    'form', 'noscript', 'template', 'math', 'foreignObject', 'animate', 'animateTransform',
    'animateMotion', 'set', 'use', 'feImage'],
  FORBID_ATTR: ['formaction', 'xlink:href', 'autofocus', 'contenteditable', 'srcdoc',
    'data-channel-slug'],
};

export function createReaderDocument(input: ArchiveDocumentInput, ownerDocument: Document = document): string {
  const doc = ownerDocument.implementation.createHTMLDocument(input.title || 'Article');
  const policy = doc.createElement('meta');
  policy.httpEquiv = 'Content-Security-Policy';
  const assets = `${new URL(input.assetOrigin).origin}/api/asset-proxy`;
  const fonts = TRUSTED_CDNS.map(host => `https://${host} https://*.${host}`).join(' ');
  policy.content = `default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src ${assets} data: ${fonts}; font-src ${assets} data: ${fonts}; base-uri 'none'; form-action 'none'; object-src 'none'; frame-src 'none'; connect-src 'none'`;
  doc.head.insertBefore(policy, doc.head.firstChild);
  const referrer = doc.createElement('meta');
  referrer.name = 'referrer';
  referrer.content = 'no-referrer';
  doc.head.appendChild(referrer);
  const viewport = doc.createElement('meta');
  viewport.name = 'viewport';
  viewport.content = 'width=device-width, initial-scale=1';
  doc.head.appendChild(viewport);
  const style = doc.createElement('style');
  // Raw-text style elements must not allow CSS strings to close the HTML element.
  style.textContent = input.css.replace(/<\/style/gi, closing => `\\3c ${closing.slice(1)}`) + '\n.arena-channel-link{font:inherit;color:inherit;border:0;border-bottom:1px dotted currentColor;background:none;padding:0;cursor:pointer}::highlight(henry-notes){background:#efd49588;color:inherit}';
  doc.head.appendChild(style);
  for (const [element, attrs] of [
    [doc.documentElement, input.htmlAttrs],
    [doc.body, input.bodyAttrs],
  ] as const) {
    for (const name of ['id', 'class', 'style', 'lang', 'dir', 'bgcolor', 'text', 'link', 'vlink', 'alink', 'marginwidth', 'marginheight', 'topmargin', 'leftmargin', 'rightmargin', 'bottommargin']) {
      if (typeof attrs?.[name] === 'string') element.setAttribute(name, attrs[name]);
    }
  }
  // The iframe is the CSS boundary. Extra wrappers or rewritten selectors change
  // direct-child layout, inheritance and the source cascade.
  const content = DOMPurify(ownerDocument.defaultView!).sanitize(input.html, {
    ...readerHtmlPolicy, RETURN_DOM_FRAGMENT: true,
  });
  // Adopt sanitized nodes directly, avoiding serialization and a second parse
  // before the final document is serialized for the isolated iframe.
  doc.body.appendChild(doc.adoptNode(content));
  return `${READER_DOCTYPES[input.documentMode || 'standards']}${doc.documentElement.outerHTML}`;
}
