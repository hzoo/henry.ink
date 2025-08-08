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
function rewriteFontUrls(css: string, baseUrl: string): string {
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
        
        // For non-Google fonts, use proxy for security
        const proxiedUrl = `/api/font-proxy?url=${encodeURIComponent(absoluteUrl)}`;
        
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
  try {
    const result = transform({
      code: Buffer.from(css),
      minify: true,
      targets: {
        // Use older browser targets to avoid modern CSS features that break JSDOM
        chrome: 70 << 16,  // Chrome 70 (2018) - more conservative
        firefox: 65 << 16,  // Firefox 65 (2019) - more conservative  
        safari: 12 << 16,   // Safari 12 (2018) - more conservative
      },
      // Additional flags to make CSS more compatible
      unusedSymbols: [],
      drafts: {
        nesting: false,  // Disable CSS nesting
      },
    });
    
    return result.code.toString();
    
  } catch (error) {
    console.log(`❌ CSS validation failed: ${error.message}`);
    return null;
  }
}

interface ArchiveResult {
  html: string;
  title: string;
  author: string;
  publishedTime: string;
  domain: string;
  url: string;
  extractionTime: number;
  contentSize: number;
}

export async function createArchive(url: string): Promise<ArchiveResult> {
  const startTime = Date.now();

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
      waitUntil: "networkidle",
      timeout: 30000,
    });
    
    // Wait a bit longer for any dynamic content to render
    await page.waitForTimeout(2000);
    
    // Get the full rendered HTML after JavaScript execution
    const fullHTMLContent = await page.content();
    
    // Extract and inline all external CSS files
    const { externalCSS, baseUrl } = await page.evaluate(async () => {
      const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      const cssContents: string[] = [];
      
      for (const link of stylesheets) {
        try {
          const href = link.getAttribute('href');
          if (!href) continue;
          
          // Convert relative URLs to absolute
          const cssUrl = new URL(href, window.location.href).href;
          const response = await fetch(cssUrl);
          if (response.ok) {
            const cssText = await response.text();
            cssContents.push(`/* From: ${cssUrl} */\n${cssText}`);
          }
        } catch (error) {
          console.log(`❌ Failed to fetch CSS: ${link.getAttribute('href')}`);
        }
      }
      
      return {
        externalCSS: cssContents.join('\n\n'),
        baseUrl: window.location.href
      };
    });
    
    // Process fonts in the CSS to use font proxy
    const fontProcessedCSS = rewriteFontUrls(externalCSS, baseUrl);
    
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

    // Insert validated CSS into HTML string
    let htmlWithCSS = cleanedHTML;
    if (processedCSS) {
      const externalCSSBlock = `<style>\n/* External stylesheets validated and minified by Lightning CSS */\n${processedCSS}\n</style>`;
      htmlWithCSS = htmlWithCSS.replace('</head>', `${externalCSSBlock}\n</head>`);
    }
    
    const additionalCSSBlock = `<style>
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
        
        /* Minimal fixed archive info banner */
        .archive-info { 
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          z-index: 1000 !important;
          background: rgba(240, 240, 240, 0.95) !important;
          backdrop-filter: blur(4px) !important;
          padding: 6px 12px !important;
          font-size: 11px !important;
          color: #666 !important;
          border-bottom: 1px solid #ddd !important;
          height: 24px !important;
          line-height: 12px !important;
          box-sizing: border-box !important;
        }
        .archive-info a { 
          color: #0066cc !important; 
          text-decoration: none !important;
        }
        
        /* Push content down to avoid overlap with fixed header */
        .archive-html-wrapper {
          margin-top: 24px !important;
        }
      </style>`;
    htmlWithCSS = htmlWithCSS.replace('</head>', `${additionalCSSBlock}\n</head>`);

    // Create virtual console to suppress CSS parsing errors (Lightning CSS handles validation)
    const virtualConsole = new VirtualConsole();
    virtualConsole.on("error", () => {
      // Suppress JSDOM CSS parsing errors - Lightning CSS already validated the CSS
    });

    // Parse HTML with JSDOM
    const dom = new JSDOM(htmlWithCSS, {
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

    // Wrap content with preserved html/body styling and add archive banner
    const existingBodyContent = document.body.innerHTML;
    
    // Build style attributes from extracted html/body attributes
    const htmlWrapperStyle = [
      pageData.htmlAttrs.style,
    ].filter(Boolean).join('; ');
    
    const bodyWrapperStyle = [
      pageData.bodyAttrs.style,
    ].filter(Boolean).join('; ');
    
    const htmlWrapperClass = pageData.htmlAttrs.class;
    const bodyWrapperClass = pageData.bodyAttrs.class;
    
    // Create new body content with preserved styling and minimal archive banner
    const archiveDate = new Date().toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    
    const wrappedContent = `
      <div class="archive-info">
        Archived from <a href="${url}" target="_blank">${pageMetadata.domain}</a> • ${archiveDate}
      </div>
      
      <div class="archive-html-wrapper${htmlWrapperClass ? ' ' + htmlWrapperClass : ''}"${htmlWrapperStyle ? ` style="${htmlWrapperStyle}"` : ''}>
        <div class="archive-body-wrapper${bodyWrapperClass ? ' ' + bodyWrapperClass : ''}"${bodyWrapperStyle ? ` style="${bodyWrapperStyle}"` : ''}>
          ${existingBodyContent}
        </div>
      </div>
    `;
    
    document.body.innerHTML = wrappedContent;

    const archivedHTML = dom.serialize();

    const extractionTime = Date.now() - startTime;

    return {
      html: archivedHTML,
      title: pageMetadata.title,
      author: pageMetadata.author || '',
      publishedTime: pageMetadata.publishedTime || '',
      domain: pageMetadata.domain,
      url: url,
      extractionTime,
      contentSize: archivedHTML.length
    };

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