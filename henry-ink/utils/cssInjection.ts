/**
 * Simple CSS isolation utility for archive mode
 */

const ARCHIVE_CSS_ATTRIBUTE = 'data-archive-css';

/**
 * Simple CSS scoping - replace key selectors with .archive-mode and filter problematic rules
 */
function scopeArchiveCSS(css: string): string {
  console.log('🔧 Scoping CSS with simple replacements and filtering');
  
  // First, filter out problematic universal reset styles but preserve others
  let processedCSS = css
    // Only remove universal resets that have margin/padding AND are truly universal (* selector only)
    .replace(/^\s*\*\s*\{\s*[^}]*margin:\s*0[^}]*\}/gm, (match) => {
      console.log('🚫 Filtering universal margin reset:', match.substring(0, 60) + '...');
      return '/* Filtered universal margin reset */';
    })
    .replace(/^\s*\*\s*\{\s*[^}]*padding:\s*0[^}]*\}/gm, (match) => {
      console.log('🚫 Filtering universal padding reset:', match.substring(0, 60) + '...');
      return '/* Filtered universal padding reset */';
    })
    // Also filter complex universal resets that include margin/padding
    .replace(/^\s*\*\s*,\s*\*:[^{]*\{\s*[^}]*(?:margin|padding):\s*0[^}]*\}/gm, (match) => {
      console.log('🚫 Filtering complex universal reset:', match.substring(0, 60) + '...');
      return '/* Filtered complex universal reset */';
    });
  
  return processedCSS
    // Replace body with .archive-mode
    .replace(/\bbody\b/g, '.archive-mode')
    // Replace :root with .archive-mode for CSS variables
    .replace(/:root/g, '.archive-mode')
    // Prefix other selectors (but skip @rules, comments, and already scoped)
    .replace(/^(\s*)([^@{}/*\s][^{}]*?)(\s*\{)/gm, (match, indent, selector, brace) => {
      // Skip if already contains .archive-mode
      if (selector.includes('.archive-mode')) {
        return match;
      }
      // Skip if it's a pseudo-selector only (like :hover)
      if (selector.trim().startsWith(':')) {
        return match;
      }
      // Skip filtered comments
      if (selector.includes('Filtered')) {
        return match;
      }
      return `${indent}.archive-mode ${selector}${brace}`;
    });
}

/**
 * Inject archive CSS into document head with simple scoping
 */
export function injectArchiveCSS(css: string): void {
  console.log('🔧 injectArchiveCSS called with CSS length:', css.length);
  
  // Clean up any existing archive CSS first
  cleanupArchiveCSS();
  
  if (!css.trim()) {
    console.log('❌ Empty CSS provided, skipping injection');
    return;
  }
  
  // Process CSS with simple scoping
  const scopedCSS = scopeArchiveCSS(css);
  console.log('🔧 Scoped CSS length:', scopedCSS.length);
  console.log('🔧 First 500 chars of scoped CSS:', scopedCSS.substring(0, 500));
  
  // Create and inject style element
  const styleElement = document.createElement('style');
  styleElement.setAttribute(ARCHIVE_CSS_ATTRIBUTE, 'true');
  styleElement.textContent = scopedCSS;
  
  document.head.appendChild(styleElement);
  console.log('✅ CSS injected successfully');
  
  // Add visual debug indicator
  const debugIndicator = document.createElement('div');
  debugIndicator.id = 'archive-css-debug';
  debugIndicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #4bbdff;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 9999;
    pointer-events: none;
  `;
  debugIndicator.textContent = 'Archive CSS Active';
  document.body.appendChild(debugIndicator);
}

/**
 * Remove all injected archive CSS from document head
 */
export function cleanupArchiveCSS(): void {
  const archiveStyles = document.querySelectorAll(`style[${ARCHIVE_CSS_ATTRIBUTE}]`);
  archiveStyles.forEach(style => style.remove());
  
  // Remove debug indicator
  const debugIndicator = document.getElementById('archive-css-debug');
  if (debugIndicator) {
    debugIndicator.remove();
  }
}

