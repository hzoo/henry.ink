import DOMPurify from 'dompurify';
import { readerHtmlPolicy, READER_ROOT_ATTRIBUTES } from '@/src/lib/reader-html-policy';
import { readerContentSecurityPolicy } from '@/src/lib/reader-csp';
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

export function createReaderDocument(input: ArchiveDocumentInput, ownerDocument: Document = document): string {
  const doc = ownerDocument.implementation.createHTMLDocument(input.title || 'Article');
  const policy = doc.createElement('meta');
  policy.httpEquiv = 'Content-Security-Policy';
  policy.content = readerContentSecurityPolicy(input.assetOrigin);
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
  const content = DOMPurify(ownerDocument.defaultView!).sanitize(input.html, {
    ...readerHtmlPolicy, RETURN_DOM_FRAGMENT: true,
  });
  // Adopt sanitized nodes directly, avoiding serialization and a second parse
  // before the final document is serialized for the isolated iframe.
  doc.body.appendChild(doc.adoptNode(content));
  return `${READER_DOCTYPES[input.documentMode || 'standards']}${doc.documentElement.outerHTML}`;
}
