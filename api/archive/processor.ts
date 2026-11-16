import { JSDOM, VirtualConsole } from "jsdom";
import createDOMPurify from "dompurify";
import { readerHtmlPolicy, READER_ROOT_ATTRIBUTES } from "@/src/lib/reader-html-policy";
import { transform } from "lightningcss";
import { isTrustedCDN } from "@/api/archive/trusted-cdns";
import { capturePage } from "@/api/archive/browser-capture";
import { archiveCacheKey, SnapshotCache, type CacheOptions } from "@/api/archive/snapshot-cache";
import { rewriteSrcset } from "@/api/archive/srcset";
import { readerDocumentMode, READER_DOCTYPES } from "@/src/lib/archive-document-mode";
import { validatedEmbeddedFont } from "@/api/archive/asset-validation";
import { validatedEmbeddedSvg } from "@/api/archive/embedded-svg";
import { assetProxyUrl } from "@/api/archive/asset-signature";
import { publicApiOrigin } from "@/api/public-origin";

/**
 * The one cleaning pass: the reader's allowlist, applied in place to the parsed
 * page. Everything written into the document afterwards (proxied asset
 * addresses, resolved links, rewritten inline styles) is generated here.
 */
function cleanDocument(window: JSDOM["window"]): void {
  const document = window.document;
  // A named image, form, embed, iframe or object shadows the document property
  // of the same name: <img name="body"> makes document.body that image, here as
  // in a browser. Remove such names first, without trusting any property the
  // page could have shadowed, or the pass below would clean the wrong element.
  const find = window.Document.prototype.querySelectorAll;
  for (const element of find.call(document, 'embed[name], form[name], iframe[name], img[name], object[name], object[id]')) {
    for (const attribute of ['name', 'id']) {
      if ((element.getAttribute(attribute) || '') in window.Document.prototype) element.removeAttribute(attribute);
    }
  }
  // Legacy pages sometimes wrap article text in forms. Remove submission
  // controls before the allowlist unwraps the form around the readable content.
  document.querySelectorAll('form').forEach(form => {
    form.querySelectorAll('input, select, textarea, button').forEach(control => control.remove());
  });
  // Nothing reads the source head: styles were captured separately, the title
  // and metadata travel beside the page, and the reader builds its own head.
  document.head.replaceChildren();
  // The reader copies a fixed list of root attributes by name, as text. Keep
  // exactly those on <html> and <body>, including legacy ones the allowlist drops.
  const kept = [document.documentElement, document.body].map(root => {
    const attributes = READER_ROOT_ATTRIBUTES.flatMap(name => {
      const value = root.getAttribute(name);
      return value === null ? [] : [[name, value] as const];
    });
    for (const name of root.getAttributeNames()) root.removeAttribute(name);
    return { root, attributes };
  });
  // SANITIZE_DOM would also drop ordinary anchors named like DOM properties
  // (id="title", id="links", id="attributes"). Nothing here looks elements up
  // by name once the shadowing names above are gone, and Text only needs those
  // anchors; the browser applies the full policy before the frame renders.
  createDOMPurify(window).sanitize(document.body, { ...readerHtmlPolicy, IN_PLACE: true, SANITIZE_DOM: false });
  for (const { root, attributes } of kept) for (const [name, value] of attributes) root.setAttribute(name, value);
}

const FONT_REGEX = /\.(woff2?|ttf|otf|eot)(\?.*)?$/i;
const IMAGE_REGEX = /\.(jpe?g|png|gif|webp|svg|avif|bmp)(\?.*)?$/i;

/** Rewrites CSS asset URLs to signed asset-proxy addresses. */
export function rewriteAssetUrlsInCSS(css: string, baseUrl: string, assetProxyBaseUrl: string): string {
  if (!css.trim()) return '';
  if (Buffer.byteLength(css) > 2 * 1024 * 1024) return '';
  try {
    return transform({
      filename: 'assets.css', code: Buffer.from(css), errorRecovery: true,
      targets: { chrome: 109 << 16, firefox: 128 << 16, safari: 18 << 16 },
      visitor: {
        Rule: { import() { return []; } },
        Url(value) {
          if (value.url.startsWith('#') || /^data:image\/(?:png|jpeg|gif|webp|avif);/i.test(value.url)) return value;
          if (/^data:/i.test(value.url)) return { ...value, url: validatedEmbeddedSvg(value.url) || validatedEmbeddedFont(value.url) || 'about:blank' };
          try {
            const absolute = new URL(value.url, baseUrl);
            if (absolute.protocol !== 'https:' && absolute.protocol !== 'http:') return { ...value, url: 'about:blank' };
            if (isTrustedCDN(absolute.href)) return { ...value, url: absolute.href };
            if (FONT_REGEX.test(absolute.href) || IMAGE_REGEX.test(absolute.href)) {
              return { ...value, url: assetProxyUrl(assetProxyBaseUrl, absolute.href) };
            }
          } catch { }
          return { ...value, url: 'about:blank' };
        },
      },
    }).code.toString();
  } catch { return ''; }
}

function extractRootAttributes(element: Element): Record<string, string> {
  const attributes: Record<string, string> = { class: '', style: '' };
  for (const name of READER_ROOT_ATTRIBUTES) {
    const value = element.getAttribute(name);
    if (value !== null) attributes[name] = value;
  }
  return attributes;
}

interface ArchiveResult {
  html: string;
  css: string;
  textContent: string;
  title: string;
  author: string;
  publishedTime: string;
  domain: string;
  url: string;
  resolvedUrl: string;
  extractionTime: number;
  contentSize: number;
  htmlAttrs: Record<string, string>;
  bodyAttrs: Record<string, string>;
}

function isArchiveResult(value: unknown): value is ArchiveResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Record<string, unknown>;
  return ['html', 'css', 'textContent', 'title', 'author', 'publishedTime', 'domain', 'url', 'resolvedUrl']
    .every(key => typeof result[key] === 'string')
    && ['extractionTime', 'contentSize'].every(key => typeof result[key] === 'number' && Number.isFinite(result[key]))
    && ['htmlAttrs', 'bodyAttrs'].every(key => {
      const attrs = result[key];
      return attrs !== null && typeof attrs === 'object' && !Array.isArray(attrs)
        && Object.values(attrs).every(value => typeof value === 'string');
    });
}

/** One cleaned copy per page: nothing in it depends on who asked. */
export function createArchiveService(capture: typeof capturePage = capturePage, { assetOrigin = publicApiOrigin, ...options }: Partial<CacheOptions<ArchiveResult>> & { assetOrigin?: string } = {}) {
  const cache = new SnapshotCache<ArchiveResult>({
    maxEntries: 50, maxBytes: 32 * 1024 * 1024, ttlMs: 15 * 60 * 1000,
    concurrency: 2, maxPending: 8,
    size: result => Buffer.byteLength(JSON.stringify(result)),
    ...options,
  });
  return async (url: string, admitCapture?: () => void): Promise<ArchiveResult> => {
    const result = await cache.getOrCreate(archiveCacheKey(url),
      () => processArchive(url, assetOrigin, capture), admitCapture);
    return result.url === url ? result : { ...result, url };
  };
}

export const createArchive = createArchiveService(capturePage, {
  staleWhileRevalidateMs: (24 * 60 - 15) * 60 * 1000,
  refreshCooldownMs: 60_000,
  persistence: {
    path: process.env.ARCHIVE_CACHE_PATH || 'archive-snapshots.db',
    maxEntries: 200, maxBytes: 128 * 1024 * 1024, validate: isArchiveResult,
  },
});

async function processArchive(url: string, assetProxyBaseUrl: string, capture: typeof capturePage): Promise<ArchiveResult> {
  const startTime = Date.now();
  const { fullHTMLContent, pageData, cssSources } = await capture(url);
  const baseUrl = pageData.baseUrl;
  const pageMetadata = pageData.metadata;
  const allCSS = cssSources.map(source => {
    const css = source.media ? `@media ${source.media} {\n${source.content}\n}` : source.content;
    return rewriteAssetUrlsInCSS(css, source.baseUrl, assetProxyBaseUrl);
  }).join('\n');
  // Each sheet was already parsed, validated and target-transformed while
  // rewriting URLs. Keep source order without parsing the joined CSS again.
  const processedCSS = Buffer.byteLength(allCSS) <= 2 * 1024 * 1024 ? allCSS : '';
  let dom: JSDOM | undefined;
  try {
    // Single JSDOM pass: strip JS, rewrite assets, extract text — no re-parsing
    const virtualConsole = new VirtualConsole();
    virtualConsole.on("error", () => {});

    dom = new JSDOM(fullHTMLContent, {
      pretendToBeVisual: false,
      virtualConsole,
    });
    const document = dom.window.document;

    cleanDocument(dom.window);

    // Recover declarative lazy images without executing the site's loader.
    document.querySelectorAll('img, picture source').forEach(element => {
      for (const name of element.tagName === 'IMG' ? ['src', 'srcset'] : ['srcset']) {
        if (!element.getAttribute(name) && element.getAttribute(`data-${name}`)) {
          element.setAttribute(name, element.getAttribute(`data-${name}`)!);
        }
      }
    });

    // Convert image URLs to use asset proxy (both img[src] and source[srcset])
    const images = document.querySelectorAll('img[src]');
    const sources = document.querySelectorAll('source[srcset], img[srcset]');

    // console.log(`🖼️ Found ${images.length} img elements and ${sources.length} source elements to process`);

    // Helper function to process a single URL
    const processImageUrl = (url: string) => {
      if (/^data:image\/(?:png|jpeg|gif|webp|avif);/i.test(url)) return url;
      try {
        const absolute = new URL(url, baseUrl);
        if (absolute.protocol !== 'http:' && absolute.protocol !== 'https:') return '';
        return assetProxyUrl(assetProxyBaseUrl, absolute.href);
      } catch { return ''; }
    };

    // Process img[src] attributes
    images.forEach((img: Element, index: number) => {
      const src = img.getAttribute('src');
      // console.log(`🖼️ img[${index + 1}]: ${src}`);

      if (src) {
        const processedSrc = processImageUrl(src);
        img.setAttribute('src', processedSrc);
      }
    });

    // Process source[srcset] attributes
    sources.forEach((source: Element, index: number) => {
      const srcset = source.getAttribute('srcset');
      // console.log(`🖼️ source[${index + 1}] srcset: ${srcset}`);

      if (srcset) {
        const processedSrcset = rewriteSrcset(srcset, processImageUrl);
        if (processedSrcset) source.setAttribute('srcset', processedSrcset);
        else source.removeAttribute('srcset');
      }
    });

    // Parse all inline declarations, including cursor, mask and content URLs.
    document.querySelectorAll('[style]').forEach((element: Element) => {
      const style = element.getAttribute('style') || '';
      try {
        const wrapped = rewriteAssetUrlsInCSS(`x {${style}}`, baseUrl, assetProxyBaseUrl);
        const declarations = wrapped.slice(wrapped.indexOf('{') + 1, wrapped.lastIndexOf('}')).trim();
        element.setAttribute('style', declarations);
      } catch { element.removeAttribute('style'); }
    });

    // Resolve against the captured document base, which can differ from the
    // requested URL after redirects or a source <base> element. Links keep
    // their source destination; the reader decides where a click goes.
    document.querySelectorAll('a[href]').forEach((link: Element) => {
      const href = (link.getAttribute('href') || '').trim();
      if (!href) return;
      if (href.startsWith('#')) {
        link.setAttribute('href', href);
        return;
      }
      try {
        const destination = new URL(href, baseUrl);
        if (destination.protocol !== 'http:' && destination.protocol !== 'https:') return;
        link.setAttribute('href', destination.href);
      } catch { link.removeAttribute('href'); }
    });

    // Extract text content server-side (saves a client-side DOMParser round-trip)
    const textContent = document.body?.textContent || '';

    // JSDOM serialization discards legacy PUBLIC/SYSTEM identifiers.
    const cleanHTML = READER_DOCTYPES[readerDocumentMode(fullHTMLContent)] + document.documentElement.outerHTML;

    const extractionTime = Date.now() - startTime;
    console.log(`📦 Archive: ${url} | ${extractionTime}ms`);

    const result = {
      html: cleanHTML,
      css: processedCSS || '',
      textContent,
      title: pageMetadata.title,
      author: pageMetadata.author || '',
      publishedTime: pageMetadata.publishedTime || '',
      domain: pageMetadata.domain,
      url: url,
      resolvedUrl: pageMetadata.url,
      extractionTime,
      contentSize: cleanHTML.length,
      htmlAttrs: extractRootAttributes(document.documentElement),
      bodyAttrs: extractRootAttributes(document.body),
    };

    return result;

  } catch (error) {
    console.error("❌ Error creating archive:", error);
    throw error;
  } finally {
    dom?.window.close();
  }
}
