import { useEffect, useRef } from "preact/hooks";
import type { ComponentChildren } from "preact";

interface ArchiveModeWrapperProps {
  children: ComponentChildren;
  htmlAttrs?: {
    class?: string;
    style?: string;
    lang?: string;
  };
  bodyAttrs?: {
    class?: string;
    style?: string;
  };
}

// Only allow CSS properties that affect text/color rendering, not layout/positioning.
// Blocks: position, z-index, display, overflow, background-image (tracking), fixed/absolute overlays
const SAFE_STYLE_PROPERTIES = new Set([
  'color', 'background-color', 'background',
  'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing',
  'text-align', 'text-decoration', 'text-transform', 'word-spacing',
  'direction', 'writing-mode', 'text-orientation',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'max-width', 'min-height',
  'border', 'border-radius', 'box-sizing',
]);

function sanitizeStyleString(styleStr?: string): Record<string, string> {
  if (!styleStr) return {};
  try {
    const styles: Record<string, string> = {};
    styleStr.split(';').forEach(rule => {
      const colonIdx = rule.indexOf(':');
      if (colonIdx === -1) return;
      const property = rule.slice(0, colonIdx).trim().toLowerCase();
      const value = rule.slice(colonIdx + 1).trim();
      if (!property || !value) return;
      // Block any value containing url() (tracking/exfiltration)
      if (/url\s*\(/i.test(value)) return;
      if (!SAFE_STYLE_PROPERTIES.has(property)) return;
      // Convert to camelCase for Preact
      const camelProperty = property.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      styles[camelProperty] = value;
    });
    return styles;
  } catch {
    return {};
  }
}

/**
 * Wrapper component that provides proper isolation for archive mode content
 * Applies sanitized HTML and body attributes from the archived page
 */
export function ArchiveModeWrapper({ children, htmlAttrs, bodyAttrs }: ArchiveModeWrapperProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wrapperRef.current) return;
    if (htmlAttrs?.lang) {
      wrapperRef.current.setAttribute('lang', htmlAttrs.lang);
    }
    return () => {
      if (htmlAttrs?.lang) {
        wrapperRef.current?.removeAttribute('lang');
      }
    };
  }, [htmlAttrs?.lang]);

  // Don't pass through archived page classes — they can collide with host Tailwind classes
  // or inject utility classes like "fixed", "hidden", "z-50" that break the UI.
  // The scoped CSS uses :where(.archive-mode-html/body) which matches our own classes.

  const htmlStyles = sanitizeStyleString(htmlAttrs?.style);
  const bodyStyles = sanitizeStyleString(bodyAttrs?.style);

  return (
    <div ref={wrapperRef} className="archive-mode-wrapper">
      <div className="archive-mode-html" style={htmlStyles}>
        <div className="archive-mode-body" style={bodyStyles}>
          {children}
        </div>
      </div>
    </div>
  );
}