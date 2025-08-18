import { chromium, type Browser, devices } from "playwright";
import { JSDOM, VirtualConsole } from "jsdom";
import { transform } from "lightningcss";

// Reuse a single browser instance for efficiency
let sharedBrowserPromise: Promise<Browser> | null = null;
async function getSharedBrowser(): Promise<Browser> {
  if (!sharedBrowserPromise) {
    sharedBrowserPromise = chromium.launch({ headless: true });
  }
  return sharedBrowserPromise;
}

// Simple in-memory cache for archived pages (1 hour TTL)
const archiveCache = new Map<string, { result: ArchiveResult; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

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
  scripts.forEach(script => script.remove());

  // Remove all event handlers (onclick, onload, etc.)
  const allElements = document.querySelectorAll('*');
  allElements.forEach(element => {
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
  allElements.forEach(element => {
    scriptAttributes.forEach(attr => {
      if (element.hasAttribute(attr)) {
        element.removeAttribute(attr);
      }
    });
  });

  return dom.serialize();
}

// Function to rewrite asset URLs (fonts via proxy, Google Fonts direct)
function rewriteAssetUrlsInCSS(css: string, baseUrl: string, assetProxyBaseUrl: string): string {
  // Find all font URLs in @font-face rules and CSS imports
  const fontUrlRegex = /url\((["']?)([^)]+)\1\)/g;
  
  let processedCSS = css;
  const fontUrls: string[] = [];
  const proxiedFonts: string[] = [];
  
  let match;
  while ((match = fontUrlRegex.exec(css)) !== null) {
    const fontUrl = match[2];
    
    // Skip data URIs that are already inlined
    if (fontUrl.startsWith('data:')) continue;
    
    // Convert relative URLs to absolute
    try {
      const absoluteUrl = new URL(fontUrl, baseUrl).href;
      if (!fontUrls.includes(absoluteUrl)) {
        fontUrls.push(absoluteUrl);
        
        // Check if this is actually a font file (not an image or other asset)
        const isFontFile = /\.(woff2?|ttf|otf|eot)(\?.*)?$/i.test(absoluteUrl);
        const isGoogleFont = absoluteUrl.includes('fonts.googleapis.com') || absoluteUrl.includes('fonts.gstatic.com');
        
        if (isGoogleFont) {
          // Keep Google Fonts URLs as-is (no proxying needed)
          continue;
        } else if (isFontFile) {
          // Only proxy actual font files
          const proxiedUrl = `${assetProxyBaseUrl}/api/asset-proxy?url=${encodeURIComponent(absoluteUrl)}`;
          
          // Replace the original URL with the proxy URL
          const urlPattern = new RegExp(`url\\((["']?)${fontUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1\\)`, 'g');
          processedCSS = processedCSS.replace(urlPattern, `url("${proxiedUrl}")`);
          
          proxiedFonts.push(absoluteUrl);
        } else {
          // For non-font assets (SVG, PNG, etc.), just convert to absolute URL
          const urlPattern = new RegExp(`url\\((["']?)${fontUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1\\)`, 'g');
          processedCSS = processedCSS.replace(urlPattern, `url("${absoluteUrl}")`);
        }
      }
    } catch (error) {
      console.log(`❌ Invalid font URL: ${fontUrl}`);
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
  
  try {
    const result = transform({
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
    
    // console.log(`✅ CSS validation succeeded, output length: ${result.code.toString().length}`);
    return result.code.toString();
    
  } catch (error) {
    console.log(`❌ CSS validation failed: ${error instanceof Error ? error.message : String(error)}`);
    // console.log(`📝 First 500 chars of failed CSS:`, css.substring(0, 500));
    
    // Instead of returning null, return the original CSS
    // This ensures we don't lose styles due to overly strict validation
    // console.log(`🔄 Returning original CSS due to validation failure`);
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
    const gotoStart = Date.now();
    await page.goto(url, {
      waitUntil: "load",
      timeout: 8000,
    });
    const pageLoadTime = Date.now() - gotoStart;
    
    // Get the full rendered HTML after JavaScript execution
    const fullHTMLContent = await page.content();
    
    // Extract all CSS (external and inline) in document order
    const { allCSS, baseUrl } = await page.evaluate(async () => {
      // Get all stylesheet-related elements in document order
      const allStyleElements = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'));
      
      // Process all CSS elements in parallel
      const cssPromises = allStyleElements.map(async (element, index) => {
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
    let imageCount = 0;
    
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
        
        // Use asset proxy for external images
        const proxiedUrl = `${assetProxyBaseUrl}/api/asset-proxy?url=${encodeURIComponent(absoluteUrl)}`;
        // console.log(`✅ Proxied external image: ${url} → ${proxiedUrl}`);
        imageCount++;
        return proxiedUrl;
      } catch (error) {
        console.log(`❌ Invalid image URL: ${url} - ${error.message}`);
        return url; // Return original on error
      }
    };
    
    // Process img[src] attributes
    images.forEach((img, index) => {
      const src = img.getAttribute('src');
      // console.log(`🖼️ img[${index + 1}]: ${src}`);
      
      if (src) {
        const processedSrc = processImageUrl(src, img, 'src');
        img.setAttribute('src', processedSrc);
      }
    });
    
    // Process source[srcset] attributes
    sources.forEach((source, index) => {
      const srcset = source.getAttribute('srcset');
      // console.log(`🖼️ source[${index + 1}] srcset: ${srcset}`);
      
      if (srcset) {
        // Parse srcset format: "url1 w1, url2 w2, ..."
        const processedSrcset = srcset
          .split(',')
          .map(srcItem => {
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

    // Convert relative link URLs to henry.ink routes
    if (linkRewriteBaseUrl) {
      const links = document.querySelectorAll('a[href]');
      let linkCount = 0;
      links.forEach(link => {
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
            linkCount++;
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
    styleTags.forEach(tag => tag.remove());
    
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