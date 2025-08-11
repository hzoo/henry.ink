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

// Function to rewrite font URLs (Google Fonts direct, others via proxy)
function rewriteFontUrls(css: string, baseUrl: string, fontProxyBaseUrl: string): string {
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
        
        // Check if this is a Google Fonts URL (safe to load directly)
        if (absoluteUrl.includes('fonts.googleapis.com') || absoluteUrl.includes('fonts.gstatic.com')) {
          // Keep Google Fonts URLs as-is (no proxying needed)
          continue;
        }
        
        // For non-Google fonts, use proxy for security with full URL
        const proxiedUrl = `${fontProxyBaseUrl}/api/font-proxy?url=${encodeURIComponent(absoluteUrl)}`;
        
        // Replace the original URL with the proxy URL
        const urlPattern = new RegExp(`url\\((["']?)${fontUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1\\)`, 'g');
        processedCSS = processedCSS.replace(urlPattern, `url("${proxiedUrl}")`);
        
        proxiedFonts.push(absoluteUrl);
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
                // console.log(`🔍 Processing selector components (length: ${selector.length})`);
                
                // Check if first component is a special root-level selector
                if (selector.length === 1) {
                  const component = selector[0];
                  if (component.type === 'type' && 
                      (component.name === 'html' || component.name === 'body')) {
                    // console.log(`🔄 Transforming ${component.name} → .archive-mode`);
                    // Replace with .archive-mode class selector
                    return [{
                      type: 'class',
                      name: 'archive-mode'
                    }];
                  }
                  // Handle :root pseudo-class
                  if (component.type === 'pseudo-class' && component.kind === 'root') {
                    // console.log(`🔄 Transforming :root → .archive-mode`);
                    return [{
                      type: 'class',
                      name: 'archive-mode'
                    }];
                  }
                }
                
                // Check if already scoped (first component is .archive-mode class)
                if (selector.length > 0 && 
                    selector[0].type === 'class' && 
                    selector[0].name === 'archive-mode') {
                  // console.log(`✅ Already scoped selector`);
                  return selector;
                }
                
                // For all other selectors, prepend .archive-mode class and descendant combinator
                const archiveModeClass = { type: 'class' as const, name: 'archive-mode' };
                const descendantCombinator = { type: 'combinator' as const, value: 'descendant' as const };
                const scopedSelector = [archiveModeClass, descendantCombinator, ...selector];
                
                // console.log(`🔄 Transforming selector → .archive-mode descendant`);
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

export async function createArchive(url: string, fontProxyBaseUrl?: string, linkRewriteBaseUrl?: string): Promise<ArchiveResult> {
  const startTime = Date.now();

  // Check cache first
  const cached = archiveCache.get(url);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    console.log(`⚡ Cache hit | Total: ${Date.now() - startTime}ms`);
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
      waitUntil: "networkidle",
      timeout: 30000,
    });
    const pageLoadTime = Date.now() - gotoStart;
    
    // Get the full rendered HTML after JavaScript execution
    const fullHTMLContent = await page.content();
    
    // Extract all CSS (external and inline) in document order
    const { allCSS, baseUrl } = await page.evaluate(async () => {
      // Get all stylesheet-related elements in document order
      const allStyleElements = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'));
      const cssContents: string[] = [];
      
      for (const element of allStyleElements) {
        try {
          if (element.tagName.toLowerCase() === 'link') {
            // External stylesheet
            const link = element as HTMLLinkElement;
            const href = link.getAttribute('href');
            if (!href) continue;
            
            // Convert relative URLs to absolute
            const cssUrl = new URL(href, window.location.href).href;
            const response = await fetch(cssUrl);
            if (response.ok) {
              const cssText = await response.text();
              cssContents.push(`/* From: ${cssUrl} */\n${cssText}`);
            }
          } else if (element.tagName.toLowerCase() === 'style') {
            // Inline style tag
            const styleElement = element as HTMLStyleElement;
            const cssText = styleElement.textContent || '';
            if (cssText.trim()) {
              cssContents.push(`/* Inline styles */\n${cssText}`);
            }
          }
        } catch (error) {
          console.log(`❌ Failed to process CSS element: ${element.tagName}`);
        }
      }
      
      return {
        allCSS: cssContents.join('\n\n'),
        baseUrl: window.location.href
      };
    });
    
    // Process fonts in the CSS to use font proxy
    const fontProcessedCSS = rewriteFontUrls(allCSS, baseUrl, fontProxyBaseUrl || 'http://localhost:3000');
    
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
    
    const finalCSS = [
      processedCSS,
      `
        /* Responsive images */
        img { 
          max-width: 100% !important; 
          height: auto !important; 
        }
        
        /* Ensure text wraps properly */
        * { 
          word-wrap: break-word !important;
          overflow-wrap: break-word !important;
          box-sizing: border-box !important;
        }
      `
    ].filter(Boolean).join('\n\n');
    
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

    // Convert relative image URLs to absolute URLs
    const images = document.querySelectorAll('img[src]');
    let imageCount = 0;
    images.forEach(img => {
      const src = img.getAttribute('src');
      if (src && !src.startsWith('http') && !src.startsWith('data:')) {
        try {
          const absoluteUrl = new URL(src, baseUrl).href;
          img.setAttribute('src', absoluteUrl);
          imageCount++;
        } catch (error) {
          console.log(`❌ Invalid image URL: ${src}`);
        }
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
      console.log(`🔗 Processed ${linkCount} relative links`);
    }

    // Body content is already included in the full HTML
    
    // Remove all style tags and CSS links from the HTML since we'll return CSS separately
    const styleTags = document.querySelectorAll('style');
    styleTags.forEach(tag => tag.remove());
    
    const cssLinks = document.querySelectorAll('link[rel="stylesheet"]');
    cssLinks.forEach(link => link.remove());

    const cleanHTML = dom.serialize();

    const extractionTime = Date.now() - startTime;
    console.log(`⏱️ Page: ${pageLoadTime}ms | Total: ${extractionTime}ms`);

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