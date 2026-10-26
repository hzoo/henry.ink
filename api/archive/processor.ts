import { JSDOM, VirtualConsole } from "jsdom";
import { transform } from "lightningcss";
import { isTrustedCDN } from "@/api/archive/trusted-cdns";
import { capturePage } from "@/api/archive/browser-capture";
import { archiveCacheKey, SnapshotCache, type CacheOptions } from "@/api/archive/snapshot-cache";
import { rewriteSrcset } from "@/api/archive/srcset";
import { readerDocumentMode, READER_DOCTYPES } from "@/src/lib/archive-document-mode";
import { validatedEmbeddedFont } from "@/api/archive/asset-validation";
import { validatedEmbeddedSvg } from "@/api/archive/embedded-svg";
import { sameArticle } from '@/src/lib/annotations/anchors';

// Dangerous URI schemes — allow data:image/ for inline images, block everything else
// Block data:image/svg+xml specifically (SVGs can contain scripts)
const DANGEROUS_URI_RE = /^(javascript|vbscript|blob):/i;
const DANGEROUS_DATA_URI_RE = /^\s*data\s*:(?!image\/(?!svg\+xml))/i;

// Sanitize a JSDOM document in-place: strip scripts, dangerous elements, event handlers
function sanitizeDocument(document: Document): void {
  // Legacy pages sometimes wrap article text in forms. Remove submission
  // controls and unwrap the form, not the readable content inside it.
  document.querySelectorAll('form').forEach(form => {
    form.querySelectorAll('input, select, textarea, button').forEach(control => control.remove());
    form.replaceWith(...Array.from(form.childNodes));
  });
  // Remove dangerous elements:
  // - script: JS execution
  // - iframe/embed/object/applet: load external content in same origin context
  // - base: hijacks all relative URLs
  // - meta[http-equiv]: redirects, charset overrides
  // - noscript/template: mXSS vectors (JSDOM/browser parser differentials)
  // - math: mXSS vector via annotation-xml
  // - link: prefetch/pingback/prerender tracking, icon injection
  document.querySelectorAll(
    'script, iframe, embed, object, applet, base, meta[http-equiv], ' +
    'noscript, template, math, link'
  ).forEach((el: Element) => el.remove());

  // Sanitize SVGs: keep visual elements, strip anything that can execute code
  document.querySelectorAll(
    'svg foreignObject, svg script, svg animate, svg animateTransform, ' +
    'svg animateMotion, svg set, svg use, svg a'
  ).forEach((el: Element) => el.remove());

  // Walk all elements: strip event handlers, dangerous URIs, script data attrs
  document.querySelectorAll('*').forEach((element: Element) => {
    const attributesToRemove: string[] = [];
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      const name = attr.name.toLowerCase();

      // Strip all on* event handlers
      if (name.startsWith('on')) {
        attributesToRemove.push(attr.name);
        continue;
      }

      // Strip formaction (bypasses form-level action stripping)
      if (name === 'formaction') {
        attributesToRemove.push(attr.name);
        continue;
      }

      // Strip dangerous URI schemes from href, src, action, poster, etc.
      if (['href', 'src', 'action', 'poster', 'formaction', 'xlink:href'].includes(name)) {
        const uri = attr.value.replace(/[\u0000-\u0020\u007f]/g, '');
        if (DANGEROUS_URI_RE.test(uri) || DANGEROUS_DATA_URI_RE.test(uri)) {
          attributesToRemove.push(attr.name);
        }
      }
    }
    attributesToRemove.forEach(attrName => element.removeAttribute(attrName));

    // Remove script-related data attributes
    for (const attr of ['data-script', 'data-js', 'data-on']) {
      if (element.hasAttribute(attr)) element.removeAttribute(attr);
    }
  });
}

const FONT_REGEX = /\.(woff2?|ttf|otf|eot)(\?.*)?$/i;
const IMAGE_REGEX = /\.(jpe?g|png|gif|webp|svg|avif|bmp)(\?.*)?$/i;

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
              return { ...value, url: `${assetProxyBaseUrl}/api/asset-proxy?url=${encodeURIComponent(absolute.href)}` };
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
  for (const name of ['class', 'style', 'lang', 'id', 'dir', 'bgcolor', 'text', 'link', 'vlink', 'alink', 'marginwidth', 'marginheight', 'topmargin', 'leftmargin', 'rightmargin', 'bottommargin']) {
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

export function createArchiveService(capture: typeof capturePage = capturePage, options: Partial<CacheOptions<ArchiveResult>> = {}) {
  const cache = new SnapshotCache<ArchiveResult>({
    maxEntries: 50, maxBytes: 32 * 1024 * 1024, ttlMs: 15 * 60 * 1000,
    concurrency: 2, maxPending: 8,
    size: result => Buffer.byteLength(JSON.stringify(result)),
    ...options,
  });
  return async (url: string, assetProxyBaseUrl = 'http://localhost:3000', linkRewriteBaseUrl?: string, admitCapture?: () => void): Promise<ArchiveResult> => {
    const result = await cache.getOrCreate(archiveCacheKey(url, assetProxyBaseUrl, linkRewriteBaseUrl),
      () => processArchive(url, assetProxyBaseUrl, linkRewriteBaseUrl, capture), admitCapture);
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

async function processArchive(url: string, assetProxyBaseUrl: string, linkRewriteBaseUrl: string | undefined, capture: typeof capturePage): Promise<ArchiveResult> {
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

    // Sanitize in-place (was previously a separate parse+serialize cycle)
    sanitizeDocument(document);

    // Note: link elements already removed by sanitizeDocument

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
        return `${assetProxyBaseUrl}/api/asset-proxy?url=${encodeURIComponent(absolute.href)}`;
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
    // requested URL after redirects or a source <base> element.
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
        const relative = !/^[a-z][a-z0-9+.-]*:/i.test(href);
        const currentFragment = destination.hash && sameArticle(destination.href, pageData.metadata.url);
        link.setAttribute('href', relative && linkRewriteBaseUrl && !currentFragment
          ? `${linkRewriteBaseUrl}/${destination.href}` : destination.href);
      } catch { link.removeAttribute('href'); }
    });

    // Remove inline style tags (CSS already extracted separately via Playwright)
    document.querySelectorAll('style').forEach((tag: Element) => tag.remove());

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
