import { chromium, type Browser, devices } from "playwright";
import { JSDOM, VirtualConsole } from "jsdom";
import { transform } from "lightningcss";
import { isTrustedCDN } from "./trusted-cdns";

// Reuse a single browser instance for efficiency
let sharedBrowserPromise: Promise<Browser> | null = null;
async function getSharedBrowser(): Promise<Browser> {
  if (!sharedBrowserPromise) {
    sharedBrowserPromise = chromium.launch({ headless: true });
  }
  return sharedBrowserPromise;
}

// Simple in-memory cache for archived pages (15 minute TTL)
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
}, 15 * 60 * 1000); // Clean every 15 minutes

// Strip JavaScript from HTML for security while preserving all styling
function stripJavaScript(html: string): string {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  // Remove all <script> tags
  const scripts = document.querySelectorAll('script');
  scripts.forEach((script: Element) => script.remove());

  // Remove all event handlers (onclick, onload, etc.)
  const allElements = document.querySelectorAll('*');
  allElements.forEach((element: Element) => {
    // Remove all on* attributes
    const attributes = element.attributes;
    const attributesToRemove: string[] = [];
    
    for (let i = 0; i < attributes.length; i++) {
      const attr = attributes[i];
      if (attr.name.toLowerCase().startsWith('on')) {
        attributesToRemove.push(attr.name);
      }
    }
    
    attributesToRemove.forEach(attrName => {
      element.removeAttribute(attrName);
    });

    // Remove javascript: URLs from href and src
    if (element.hasAttribute('href') && element.getAttribute('href')?.toLowerCase().startsWith('javascript:')) {
      element.removeAttribute('href');
    }
    if (element.hasAttribute('src') && element.getAttribute('src')?.toLowerCase().startsWith('javascript:')) {
      element.removeAttribute('src');
    }
  });

  // Remove any remaining script-related attributes
  const scriptAttributes = ['data-script', 'data-js', 'data-on'];
  allElements.forEach((element: Element) => {
    scriptAttributes.forEach(attr => {
      if (element.hasAttribute(attr)) {
        element.removeAttribute(attr);
      }
    });
  });

  return dom.serialize();
}

// Function to rewrite asset URLs (fonts via proxy, Google Fonts direct, background images via proxy)
function rewriteAssetUrlsInCSS(css: string, baseUrl: string, assetProxyBaseUrl: string): string {
  // Find all URLs in CSS (fonts, background images, etc.)
  const urlRegex = /url\((["']?)([^)]+)\1\)/g;
  
  let processedCSS = css;
  const processedUrls: string[] = [];
  
  let match;
  while ((match = urlRegex.exec(css)) !== null) {
    const originalUrl = match[2];
    const quote = match[1];
    
    // Skip data URIs that are already inlined
    if (originalUrl.startsWith('data:')) continue;
    
    // Convert relative URLs to absolute
    try {
      const absoluteUrl = new URL(originalUrl, baseUrl).href;
      if (!processedUrls.includes(absoluteUrl)) {
        processedUrls.push(absoluteUrl);
        
        // Determine asset type and source
        const isFontFile = /\.(woff2?|ttf|otf|eot)(\?.*)?$/i.test(absoluteUrl);
        const isImageFile = /\.(jpe?g|png|gif|webp|svg|avif|bmp)(\?.*)?$/i.test(absoluteUrl);
        const isTrustedCDNUrl = isTrustedCDN(absoluteUrl);
        
        // Check for premium font services that won't work when proxied
        const isPremiumFont = /\b(use\.typekit\.net|p\.typekit\.net)\b/i.test(absoluteUrl);
        
        
        let replacementUrl: string;
        
        if (isTrustedCDNUrl) {
          // Keep trusted CDN URLs as-is (no proxying needed)
          replacementUrl = absoluteUrl;
        } else if (isPremiumFont) {
          // Skip premium fonts that won't work when proxied - let them fail fast
          replacementUrl = absoluteUrl;
        } else if (isFontFile || isImageFile) {
          // Proxy all other fonts and images to avoid CORS issues
          replacementUrl = `${assetProxyBaseUrl}/api/asset-proxy?url=${encodeURIComponent(absoluteUrl)}`;
        } else {
          // For other assets, convert to absolute URL but don't proxy
          replacementUrl = absoluteUrl;
        }
        
        // Replace the original URL with the processed URL
        const urlPattern = new RegExp(`url\\((["']?)${originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1\\)`, 'g');
        processedCSS = processedCSS.replace(urlPattern, `url(${quote}${replacementUrl}${quote})`);
      }
    } catch (error) {
      console.log(`❌ Invalid URL in CSS: ${originalUrl}`);
    }
  }
  
  return processedCSS;
}




// Function to validate and minify CSS using Lightning CSS (with conservative targets for JSDOM compatibility)
async function validateAndProcessCSS(css: string): Promise<string | null> {
  // console.log(`🎨 Processing CSS, length: ${css.length}`);
  
  if (!css.trim()) {
    console.log('❌ Empty CSS provided to validator');
    return null;
  }
  
  // Skip validation for extremely large CSS (>2MB) to prevent crashes
  const MAX_CSS_SIZE = 2 * 1024 * 1024; // 2MB
  if (css.length > MAX_CSS_SIZE) {
    console.log(`⚠️ CSS too large (${Math.round(css.length / 1024 / 1024)}MB), skipping validation`);
    return css; // Return original CSS without processing
  }
  
  try {
    // Add timeout to CSS processing to prevent hangs
    const CSS_TIMEOUT = 5000; // 5 seconds
    const processCSS = async () => {
      return transform({
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
      drafts: {
        nesting: true,  // Allow CSS nesting as it's widely supported
      },
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
    console.log(`❌ CSS validation ${isTimeout ? 'timed out' : 'failed'}: ${error instanceof Error ? error.message : String(error)}`);
    // console.log(`📝 First 500 chars of failed CSS:`, css.substring(0, 500));
    
    // Instead of returning null, return the original CSS
    // This ensures we don't lose styles due to timeouts or validation failures
    // console.log(`🔄 Returning original CSS due to ${isTimeout ? 'timeout' : 'validation failure'}`);
    return css;
  }
}

interface ArchiveResult {
  html: string;
  css: string;
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

    // Strip JavaScript from the HTML for security while preserving all styling
    const cleanedHTML = stripJavaScript(fullHTMLContent);

    // Combine all CSS into a single bundle for client-side injection
    // console.log(`📦 Combining CSS - processedCSS length: ${processedCSS?.length || 0}`);
    if (processedCSS) {
      // console.log(`📦 ProcessedCSS preview:`, processedCSS.substring(0, 300));
    } else {
      // console.log(`❌ processedCSS is null or empty!`);
    }
    
    let finalCSS = processedCSS || '';
    
    // Check if there are any html/body transformations that need layer consistency
    const hasHtmlBodyRules = finalCSS.includes(':where(.archive-mode-html)') || finalCSS.includes(':where(.archive-mode-body)');
    
    if (hasHtmlBodyRules) {
      // Wrap each :where() rule individually in @layer utilities, preserving surrounding context
      finalCSS = finalCSS.replace(
        /:where\(\.archive-mode-(html|body)\)\s*\{[^}]+\}/g, 
        (match) => `@layer utilities {\n  ${match}\n}`
      );
    }
    
    // console.log(`📦 Final combined CSS length: ${finalCSS.length}`);

    // Create virtual console to suppress CSS parsing errors (Lightning CSS handles validation)
    const virtualConsole = new VirtualConsole();
    virtualConsole.on("error", () => {
      // Suppress JSDOM CSS parsing errors - Lightning CSS already validated the CSS
    });

    // Parse HTML with JSDOM (use cleaned HTML without CSS)
    const dom = new JSDOM(cleanedHTML, {
      resources: "usable",
      runScripts: "outside-only",
      pretendToBeVisual: false,
      virtualConsole,
    });
    const document = dom.window.document;

    // Add security and responsive meta tags if not present
    if (!document.querySelector('meta[name="viewport"]')) {
      const viewport = document.createElement('meta');
      viewport.setAttribute('name', 'viewport');
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
      document.head.appendChild(viewport);
    }


    // Remove original stylesheet links since we're inlining the CSS
    const stylesheetLinks = document.querySelectorAll('link[rel="stylesheet"]');
    stylesheetLinks.forEach(link => link.remove());

    // Remove preload/prefetch links that cause 404s (Next.js performance hints we don't need)
    const preloadLinks = document.querySelectorAll('link[rel="preload"], link[rel="prefetch"], link[rel="dns-prefetch"], link[rel="modulepreload"]');
    preloadLinks.forEach(link => link.remove());

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

    // Body content is already included in the full HTML
    
    // Remove all style tags and CSS links from the HTML since we'll return CSS separately
    const styleTags = document.querySelectorAll('style');
    styleTags.forEach((tag: Element) => tag.remove());
    
    const cssLinks = document.querySelectorAll('link[rel="stylesheet"]');
    cssLinks.forEach(link => link.remove());

    const cleanHTML = dom.serialize();

    const extractionTime = Date.now() - startTime;
    console.log(`📦 Archive: ${url} | ${extractionTime}ms`);

    const result = {
      html: cleanHTML,
      css: finalCSS,
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

    // Cache the result
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
    } catch {}
  }
}