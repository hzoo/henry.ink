/**
 * Simple CSS isolation utility for archive mode
 */

const ARCHIVE_CSS_ATTRIBUTE = 'data-archive-css';

/**
 * Inject pre-scoped archive CSS into document head
 * (CSS is already scoped by Lightning CSS visitor on server-side)
 */
export function injectArchiveCSS(css: string): void {
  // Clean up any existing archive CSS first
  cleanupArchiveCSS();
  
  if (!css.trim()) {
    return;
  }
  
  // Create and inject style element directly (CSS already scoped on server)
  const styleElement = document.createElement('style');
  styleElement.setAttribute(ARCHIVE_CSS_ATTRIBUTE, 'true');
  styleElement.textContent = css;
  
  document.head.appendChild(styleElement);
}

/**
 * Remove all injected archive CSS from document head
 */
export function cleanupArchiveCSS(): void {
  const archiveStyles = document.querySelectorAll(`style[${ARCHIVE_CSS_ATTRIBUTE}]`);
  archiveStyles.forEach(style => style.remove());
}

