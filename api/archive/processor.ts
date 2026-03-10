import { chromium, type Browser, devices } from "playwright";
import { JSDOM, VirtualConsole } from "jsdom";
import { transform } from "lightningcss";
import { isTrustedCDN } from "./trusted-cdns";

// Reuse a single browser instance for efficiency
let sharedBrowserPromise: Promise<Browser> | null = null;
async function getSharedBrowser(): Promise<Browser> {
  if (!sharedBrowserPromise) {
    sharedBrowserPromise = chromium.launch({ 
      headless: true,
      channel: 'chrome'
    });
  }
  return sharedBrowserPromise;
}

// Bounded in-memory cache for archived pages (15 minute TTL, max 50 entries)
const MAX_CACHE_SIZE = 50;
const archiveCache = new Map<string, { result: ArchiveResult; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// Clean up old cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [url, entry] of archiveCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      archiveCache.delete(url);
    }
  }
}, CACHE_TTL);

// Dangerous URI schemes — allow data:image/ for inline images, block everything else
// Block data:image/svg+xml specifically (SVGs can contain scripts)
const DANGEROUS_URI_RE = /^\s*(javascript|vbscript|blob)\s*:/i;
const DANGEROUS_DATA_URI_RE = /^\s*data\s*:(?!image\/(?!svg\+xml))/i;

// Sanitize a JSDOM document in-place: strip scripts, dangerous elements, event handlers
function sanitizeDocument(document: Document): void {
  // Remove dangerous elements:
  // - script: JS execution
  // - iframe/embed/object/applet: load external content in same origin context
  // - base: hijacks all relative URLs
  // - meta[http-equiv]: redirects, charset overrides
  // - noscript/template: mXSS vectors (JSDOM/browser parser differentials)
  // - math: mXSS vector via annotation-xml
  // - form: phishing (default action="" submits to current page, formaction on buttons)
  // - link: prefetch/pingback/prerender tracking, icon injection
  document.querySelectorAll(
    'script, iframe, embed, object, applet, base, meta[http-equiv], ' +
    'noscript, template, math, form, link'
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
        if (DANGEROUS_URI_RE.test(attr.value) || DANGEROUS_DATA_URI_RE.test(attr.value)) {
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

// Precompiled regex for CSS url() matching
const CSS_URL_REGEX = /url\((["']?)([^)]+)\1\)/g;
const FONT_REGEX = /\.(woff2?|ttf|otf|eot)(\?.*)?$/i;
const IMAGE_REGEX = /\.(jpe?g|png|gif|webp|svg|avif|bmp)(\?.*)?$/i;
const PREMIUM_FONT_REGEX = /\b(use\.typekit\.net|p\.typekit\.net)\b/i;

// Function to rewrite asset URLs (fonts via proxy, Google Fonts direct, background images via proxy)
// Single-pass replacement: O(n) instead of O(n²)
export function rewriteAssetUrlsInCSS(css: string, baseUrl: string, assetProxyBaseUrl: string): string {
  return css.replace(CSS_URL_REGEX, (fullMatch, quote, originalUrl) => {
    if (originalUrl.startsWith('data:')) return fullMatch;

    try {
      const absoluteUrl = new URL(originalUrl, baseUrl).href;

      let replacementUrl: string;

      if (isTrustedCDN(absoluteUrl) || PREMIUM_FONT_REGEX.test(absoluteUrl)) {
        replacementUrl = absoluteUrl;
      } else if (FONT_REGEX.test(absoluteUrl) || IMAGE_REGEX.test(absoluteUrl)) {
        replacementUrl = `${assetProxyBaseUrl}/api/asset-proxy?url=${encodeURIComponent(absoluteUrl)}`;
      } else {
        // Strip unknown url() references (not fonts/images/trusted CDNs)
        // Prevents tracking pixels via list-style-image, cursor, content, etc.
        return 'url(about:blank)';
      }

      return `url(${quote}${replacementUrl}${quote})`;
    } catch {
      return 'url(about:blank)';
    }
  });
}




// Function to validate and minify CSS using Lightning CSS (with conservative targets for JSDOM compatibility)
async function validateAndProcessCSS(css: string): Promise<string | null> {
  // console.log(`🎨 Processing CSS, length: ${css.length}`);

  if (!css.trim()) {
    console.log('❌ Empty CSS provided to validator');
    return null;
  }

  // Strip @import rules before processing (bypass scoping by loading external sheets)
  css = css.replace(/@import\s+[^;]+;/gi, '/* @import stripped */');

  // Reject oversized CSS entirely — returning unscoped CSS is a security risk
  const MAX_CSS_SIZE = 2 * 1024 * 1024; // 2MB
  if (css.length > MAX_CSS_SIZE) {
    console.log(`⚠️ CSS too large (${Math.round(css.length / 1024 / 1024)}MB), rejecting`);
    return null;
  }

  try {
    // Add timeout to CSS processing to prevent hangs
    const CSS_TIMEOUT = 5000; // 5 seconds
    const processCSS = async () => {
      return transform({
        filename: 'archive-mode.css',
        code: Buffer.from(css),
        minify: false, // Disable minification to avoid breaking complex selectors
        targets: {
          // Use more modern browser targets to support newer CSS features
          chrome: 109 << 16,
          firefox: 128 << 16,
          safari: 18 << 16,
        },
        // Additional flags to make CSS more compatible
        unusedSymbols: [],
        errorRecovery: true, // Continue processing even if some CSS is invalid
        // Add visitor to transform selectors for archive mode scoping
        visitor: {
          Rule: {
            style(rule) {
              try {
                // The rule structure is different - access the actual style rule via rule.value
                const styleRule = rule.value;

                if (!styleRule || !styleRule.selectors || !Array.isArray(styleRule.selectors)) {
                  // console.log(`⚠️  StyleRule has no selectors:`, typeof styleRule?.selectors);
                  return rule;
                }

                // console.log(`🔍 Processing rule with ${styleRule.selectors.length} selectors`);

                // Transform each selector to add .archive-mode prefix  
                styleRule.selectors = styleRule.selectors.map(selector => {
                  // Lightning CSS selectors are arrays of SelectorComponent objects

                  // Transform html/body/root selectors using :where() for zero specificity
                  let needsTransform = false;
                  const transformedSelector = selector.map(component => {
                    if (component.type === 'type') {
                      if (component.name === 'html') {
                        needsTransform = true;
                        // Transform to :where(.archive-mode-html) for zero specificity
                        return {
                          type: 'pseudo-class' as const,
                          kind: 'where' as const,
                          selectors: [[{ type: 'class' as const, name: 'archive-mode-html' }]]
                        };
                      } else if (component.name === 'body') {
                        needsTransform = true;
                        // Transform to :where(.archive-mode-body) for zero specificity
                        return {
                          type: 'pseudo-class' as const,
                          kind: 'where' as const,
                          selectors: [[{ type: 'class' as const, name: 'archive-mode-body' }]]
                        };
                      }
                    } else if (component.type === 'pseudo-class' && component.kind === 'root') {
                      needsTransform = true;
                      // console.log(`🔍 Found :root rule - will transform to :where(.archive-mode-html)`);
                      // Transform :root to :where(.archive-mode-html) for zero specificity
                      return {
                        type: 'pseudo-class' as const,
                        kind: 'where' as const,
                        selectors: [[{ type: 'class' as const, name: 'archive-mode-html' }]]
                      };
                    }
                    return component;
                  });

                  if (needsTransform) {
                    // console.log(`🔄 Transformed html/body/root selector to :where() for zero specificity`);
                    return transformedSelector;
                  }

                  // Check if already scoped (first component is .archive-mode class)
                  if (selector.length > 0 &&
                    selector[0].type === 'class' &&
                    (selector[0] as any).name === 'archive-mode') {
                    // console.log(`✅ Already scoped selector`);
                    return selector;
                  }

                  // For all other selectors, prepend .archive-mode class and descendant combinator
                  const archiveModeClass = { type: 'class' as const, name: 'archive-mode' };
                  const descendantCombinator = { type: 'combinator' as const, value: 'descendant' as const };
                  const scopedSelector = [archiveModeClass, descendantCombinator, ...selector];

                  // console.log(`🔄 Adding .archive-mode ancestor prefix`);
                  return scopedSelector;
                });

                return rule;
              } catch (error) {
                console.log(`❌ Error transforming selector: ${error instanceof Error ? error.message : String(error)}`);
                // console.log(`❌ Rule structure:`, JSON.stringify(rule, null, 2));
                return rule;
              }
            }
          }
        }
      });
    };

    // Race CSS processing against timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('CSS processing timeout')), CSS_TIMEOUT);
    });

    const result = await Promise.race([processCSS(), timeoutPromise]);

    // console.log(`✅ CSS validation succeeded, output length: ${result.code.toString().length}`);
    return result.code.toString();

  } catch (error) {
    const isTimeout = error instanceof Error && error.message === 'CSS processing timeout';
    console.log(`❌ CSS ${isTimeout ? 'timeout' : 'failed'}: ${error instanceof Error ? error.message : String(error)}`);
    // Return null — never return unscoped CSS, it's a security risk
    return null;
  }
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
  extractionTime: number;
  contentSize: number;
  htmlAttrs: {
    class: string;
    style: string;
    lang: string;
  };
  bodyAttrs: {
    class: string;
    style: string;
  };
}

export async function createArchive(url: string, assetProxyBaseUrl?: string, linkRewriteBaseUrl?: string): Promise<ArchiveResult> {
  const startTime = Date.now();

  // Check cache first
  const cached = archiveCache.get(url);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    console.log(`📦 Archive: ${url} | Cache hit | 0ms`);
    return cached.result;
  }

  const browser = await getSharedBrowser();
  const context = await browser.newContext({
    ...devices["Desktop Chrome"],
    // Keep JavaScript enabled to capture dynamic content, but we'll strip it later
    javaScriptEnabled: true,
  });
  const page = await context.newPage();

  try {
    // Load the page and let JavaScript execute
    await page.goto(url, {
      waitUntil: "load",
      timeout: 5000,
    });

    // Get the full rendered HTML after JavaScript execution
    const fullHTMLContent = await page.content();

    // Extract all CSS (external and inline) in document order
    const { allCSS, baseUrl } = await page.evaluate(async () => {
      // Get all stylesheet-related elements in document order
      const allStyleElements = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'));

      // Process all CSS elements in parallel
      const cssPromises = allStyleElements.map(async (element: Element, index: number) => {
        try {
          if (element.tagName.toLowerCase() === 'link') {
            // External stylesheet
            const link = element as HTMLLinkElement;
            const href = link.getAttribute('href');
            if (!href) return { content: '', index };

            // Convert relative URLs to absolute
            const cssUrl = new URL(href, window.location.href).href;
            const response = await fetch(cssUrl);
            if (response.ok) {
              const cssText = await response.text();
              return {
                content: `/* From: ${cssUrl} */\n${cssText}`,
                index
              };
            }
          } else if (element.tagName.toLowerCase() === 'style') {
            // Inline style tag
            const styleElement = element as HTMLStyleElement;
            const cssText = styleElement.textContent || '';
            if (cssText.trim()) {
              return {
                content: `/* Inline styles */\n${cssText}`,
                index
              };
            }
          }
        } catch (error) {
          console.log(`❌ Failed to process CSS element: ${element.tagName}`);
        }
        return { content: '', index };
      });

      // Wait for all CSS to be fetched in parallel
      const cssResults = await Promise.all(cssPromises);

      // Sort by original order and filter out empty content
      const cssContents = cssResults
        .sort((a, b) => a.index - b.index)
        .map(result => result.content)
        .filter(content => content.length > 0);

      return {
        allCSS: cssContents.join('\n\n'),
        baseUrl: window.location.href
      };
    });

    // Process fonts in the CSS to use asset proxy
    const fontProcessedCSS = rewriteAssetUrlsInCSS(allCSS, baseUrl, assetProxyBaseUrl || 'http://localhost:3000');

    // Validate and minify CSS with Lightning CSS for security
    const processedCSS = await validateAndProcessCSS(fontProcessedCSS);

    // Get basic metadata and html/body attributes from the page
    const pageData = await page.evaluate(() => {
      const getMeta = (name: string) =>
        document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.getAttribute("content") || "";

      const getPublishedTime = () => {
        const metaTime = getMeta("article:published_time") || getMeta("article:published") || getMeta("datePublished") || getMeta("publish_date");
        if (metaTime) return metaTime;

        const timeElements = document.querySelectorAll("time[datetime]");
        if (timeElements.length > 0) {
          return timeElements[0].getAttribute("datetime") || "";
        }

        return "";
      };

      // Extract html and body attributes to preserve styling
      const htmlAttrs = {
        class: document.documentElement.className || '',
        style: document.documentElement.getAttribute('style') || '',
        lang: document.documentElement.getAttribute('lang') || '',
      };

      const bodyAttrs = {
        class: document.body.className || '',
        style: document.body.getAttribute('style') || '',
      };

      return {
        metadata: {
          title: getMeta("og:title") || document.title,
          author: getMeta("author") || getMeta("article:author") || "",
          publishedTime: getPublishedTime(),
          domain: location.hostname.replace(/^www\./, ""),
          description: getMeta("description") || getMeta("og:description") || "",
          image: getMeta("og:image") || "",
          url: location.href,
        },
        htmlAttrs,
        bodyAttrs,
      };
    });

    const pageMetadata = pageData.metadata;

    let finalCSS = processedCSS || '';

    // Check if there are any html/body transformations that need layer consistency
    const hasHtmlBodyRules = finalCSS.includes(':where(.archive-mode-html)') || finalCSS.includes(':where(.archive-mode-body)');

    if (hasHtmlBodyRules) {
      finalCSS = finalCSS.replace(
        /:where\(\.archive-mode-(html|body)\)\s*\{[^}]+\}/g,
        (match) => `@layer utilities {\n  ${match}\n}`
      );
    }

    // Single JSDOM pass: strip JS, rewrite assets, extract text — no re-parsing
    const virtualConsole = new VirtualConsole();
    virtualConsole.on("error", () => {});

    const dom = new JSDOM(fullHTMLContent, {
      pretendToBeVisual: false,
      virtualConsole,
    });
    const document = dom.window.document;

    // Sanitize in-place (was previously a separate parse+serialize cycle)
    sanitizeDocument(document);

    // Add viewport meta if not present
    if (!document.querySelector('meta[name="viewport"]')) {
      const viewport = document.createElement('meta');
      viewport.setAttribute('name', 'viewport');
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
      document.head.appendChild(viewport);
    }

    // Note: link elements already removed by sanitizeDocument

    // Convert image URLs to use asset proxy (both img[src] and source[srcset])
    const images = document.querySelectorAll('img[src]');
    const sources = document.querySelectorAll('source[srcset]');

    // console.log(`🖼️ Found ${images.length} img elements and ${sources.length} source elements to process`);

    // Helper function to process a single URL
    const processImageUrl = (url: string, element: Element, attributeName: string) => {
      if (!url || url.startsWith('data:')) {
        return url; // Keep data URLs as-is
      }

      try {
        // Convert to absolute URL first
        const absoluteUrl = url.startsWith('http') ? url : new URL(url, baseUrl).href;

        // Check if it's a same-origin image (don't proxy our own images)
        const imageUrl = new URL(absoluteUrl);
        const requestUrl = new URL(baseUrl);

        if (imageUrl.origin === requestUrl.origin) {
          // console.log(`ℹ️ Same-origin image, keeping direct: ${absoluteUrl}`);
          return absoluteUrl;
        }

        // Skip processing very large images (check URL for size hints)
        const urlLower = absoluteUrl.toLowerCase();
        // Simple heuristic: if URL suggests very large image, skip proxying
        if (urlLower.includes('4k') || urlLower.includes('8k') || urlLower.includes('fullsize') || urlLower.includes('original')) {
          console.log(`⚠️ Potentially large image detected, using direct URL: ${absoluteUrl}`);
          return absoluteUrl;
        }

        // Use asset proxy for external images
        const proxiedUrl = `${assetProxyBaseUrl}/api/asset-proxy?url=${encodeURIComponent(absoluteUrl)}`;
        // console.log(`✅ Proxied external image: ${url} → ${proxiedUrl}`);
        return proxiedUrl;
      } catch (error) {
        console.log(`❌ Invalid image URL: ${url} - ${error instanceof Error ? error.message : String(error)}`);
        return url; // Return original on error
      }
    };

    // Process img[src] attributes
    images.forEach((img: Element, index: number) => {
      const src = img.getAttribute('src');
      // console.log(`🖼️ img[${index + 1}]: ${src}`);

      if (src) {
        const processedSrc = processImageUrl(src, img, 'src');
        img.setAttribute('src', processedSrc);
      }
    });

    // Process source[srcset] attributes
    sources.forEach((source: Element, index: number) => {
      const srcset = source.getAttribute('srcset');
      // console.log(`🖼️ source[${index + 1}] srcset: ${srcset}`);

      if (srcset) {
        // Parse srcset format: "url1 w1, url2 w2, ..."
        const processedSrcset = srcset
          .split(',')
          .map((srcItem: string) => {
            const trimmed = srcItem.trim();
            const parts = trimmed.split(/\s+/);
            const url = parts[0];
            const descriptor = parts.slice(1).join(' '); // width descriptor like "512w"

            const processedUrl = processImageUrl(url, source, 'srcset');
            return descriptor ? `${processedUrl} ${descriptor}` : processedUrl;
          })
          .join(', ');

        source.setAttribute('srcset', processedSrcset);
        // console.log(`🔄 Updated srcset: ${processedSrcset}`);
      }
    });

    // Process style attributes for background URLs (background-image, background, etc.)
    const elementsWithStyle = document.querySelectorAll('[style*="background"]');
    elementsWithStyle.forEach((element: Element, index: number) => {
      const style = element.getAttribute('style');
      if (style) {
        // console.log(`🎨 Processing style[${index + 1}]: ${style}`);

        // Match all background properties that contain url(...) patterns
        // This handles: background-image, background, and shorthand properties
        let updatedStyle = style.replace(
          /(background(?:-image)?\s*:\s*)([^;]*url\([^)]+\)[^;]*)/gi,
          (match: string, property: string, value: string) => {
            // Process all url(...) patterns within this background property
            const processedValue = value.replace(
              /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
              (urlMatch: string, quote: string, url: string) => {
                const processedUrl = processImageUrl(url, element, 'style');
                return `url(${quote}${processedUrl}${quote})`;
              }
            );
            return property + processedValue;
          }
        );

        if (updatedStyle !== style) {
          element.setAttribute('style', updatedStyle);
          // console.log(`🔄 Updated style: ${updatedStyle}`);
        }
      }
    });

    // Convert relative link URLs to henry.ink routes
    if (linkRewriteBaseUrl) {
      const links = document.querySelectorAll('a[href]');
      links.forEach((link: Element) => {
        const href = link.getAttribute('href');
        if (href &&
          !href.startsWith('http') &&
          !href.startsWith('#') &&
          !href.startsWith('mailto:') &&
          !href.startsWith('javascript:') &&
          !href.startsWith('tel:')) {
          try {
            // Convert relative URL to absolute, then wrap with henry.ink
            const absoluteUrl = new URL(href, baseUrl).href;
            const henryInkUrl = `${linkRewriteBaseUrl}/${absoluteUrl}`;
            link.setAttribute('href', henryInkUrl);
          } catch (error) {
            console.log(`❌ Invalid link URL: ${href}`);
          }
        }
      });
      // console.log(`🔗 Processed ${linkCount} relative links`);
    }

    // Remove inline style tags (CSS already extracted separately via Playwright)
    document.querySelectorAll('style').forEach((tag: Element) => tag.remove());

    // Extract text content server-side (saves a client-side DOMParser round-trip)
    const textContent = document.body?.textContent || '';

    const cleanHTML = dom.serialize();

    const extractionTime = Date.now() - startTime;
    console.log(`📦 Archive: ${url} | ${extractionTime}ms`);

    const result = {
      html: cleanHTML,
      css: finalCSS,
      textContent,
      title: pageMetadata.title,
      author: pageMetadata.author || '',
      publishedTime: pageMetadata.publishedTime || '',
      domain: pageMetadata.domain,
      url: url,
      extractionTime,
      contentSize: cleanHTML.length,
      htmlAttrs: pageData.htmlAttrs,
      bodyAttrs: pageData.bodyAttrs
    };

    // Cache the result (evict oldest if at capacity)
    if (archiveCache.size >= MAX_CACHE_SIZE) {
      const oldest = archiveCache.keys().next().value;
      if (oldest) archiveCache.delete(oldest);
    }
    archiveCache.set(url, {
      result,
      timestamp: Date.now()
    });

    return result;

  } catch (error) {
    console.error("❌ Error creating archive:", error);
    throw error;
  } finally {
    // Clean up
    try {
      await page.close();
      await context.close();
    } catch { }
  }
}