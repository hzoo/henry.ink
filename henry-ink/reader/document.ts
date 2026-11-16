import DOMPurify from 'dompurify';
import { readerHtmlPolicy, READER_ROOT_ATTRIBUTES } from '@/src/lib/reader-html-policy';
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

/**
 * The elements whose name (or, for some, id) becomes a property of their
 * document, ahead of the built-in one: <img name="body"> replaces
 * document.body. The reader's own code reads the frame's document, so these
 * must never carry such a name. Other elements' ids never shadow anything.
 */
const NAMED_ON_DOCUMENT = new Set(['embed', 'form', 'iframe', 'img', 'object']);

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
  style.textContent = input.css.replace(/<\/style/gi, closing => `\\3c ${closing.slice(1)}`) + '\n::highlight(henry-notes){background:#efd49588;color:inherit}';
  doc.head.appendChild(style);
  for (const [element, attrs] of [
    [doc.documentElement, input.htmlAttrs],
    [doc.body, input.bodyAttrs],
  ] as const) {
    for (const name of READER_ROOT_ATTRIBUTES) {
      if (typeof attrs?.[name] === 'string') element.setAttribute(name, attrs[name]);
    }
  }
  // The iframe is the CSS boundary. Extra wrappers or rewritten selectors change
  // direct-child layout, inheritance and the source cascade.
  // The API already applied this policy under jsdom. Applying it again here is
  // deliberate: this parser, not jsdom's, is the one that renders the result.
  const purifier = DOMPurify(ownerDocument.defaultView!);
  const form = ownerDocument.createElement('form');
  purifier.addHook('uponSanitizeAttribute', (node, attribute) => {
    if (attribute.attrName !== 'id' && attribute.attrName !== 'name') return;
    if (!(attribute.attrValue in ownerDocument) && !(attribute.attrValue in form)) return;
    // The value is also the name of a document or form property. DOMPurify's
    // SANITIZE_DOM would drop every such id and name, which breaks ordinary
    // anchors: <h2 id="title">, <a name="links">. Only some elements can
    // actually shadow a property of the frame's document (see NAMED_ON_DOCUMENT),
    // and the frame has no forms to shadow. Drop the attribute there and on any
    // non-anchor name; keep it where it is just a link target.
    if (NAMED_ON_DOCUMENT.has(node.localName) || (attribute.attrName === 'name' && node.localName !== 'a')) {
      attribute.keepAttr = false;
    }
  });
  const content = purifier.sanitize(input.html, {
    ...readerHtmlPolicy, SANITIZE_DOM: false, RETURN_DOM_FRAGMENT: true,
  });
  // Adopt sanitized nodes directly, avoiding serialization and a second parse
  // before the final document is serialized for the isolated iframe.
  doc.body.appendChild(doc.adoptNode(content));
  return `${READER_DOCTYPES[input.documentMode || 'standards']}${doc.documentElement.outerHTML}`;
}
