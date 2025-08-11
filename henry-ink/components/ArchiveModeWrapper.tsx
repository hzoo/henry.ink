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

/**
 * Wrapper component that provides proper isolation for archive mode content
 * Applies HTML and body attributes from the archived page to inner containers
 */
export function ArchiveModeWrapper({ children, htmlAttrs, bodyAttrs }: ArchiveModeWrapperProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!wrapperRef.current) return;
    
    // Apply lang attribute to the wrapper if provided
    if (htmlAttrs?.lang) {
      wrapperRef.current.setAttribute('lang', htmlAttrs.lang);
    }
    
    return () => {
      // Cleanup lang attribute on unmount
      if (htmlAttrs?.lang) {
        wrapperRef.current?.removeAttribute('lang');
      }
    };
  }, [htmlAttrs?.lang]);
  
  // Build combined classes for html simulation
  const htmlClasses = ['archive-mode-html', htmlAttrs?.class].filter(Boolean).join(' ');
  
  // Build combined classes for body simulation
  const bodyClasses = ['archive-mode-body', bodyAttrs?.class].filter(Boolean).join(' ');
  
  // Parse and merge styles safely
  const parseStyleString = (styleStr?: string): Record<string, string> => {
    if (!styleStr) return {};
    
    try {
      const styles: Record<string, string> = {};
      styleStr.split(';').forEach(rule => {
        const [property, value] = rule.split(':').map(s => s.trim());
        if (property && value) {
          // Convert CSS property to camelCase for React
          const camelProperty = property.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
          styles[camelProperty] = value;
        }
      });
      return styles;
    } catch {
      return {};
    }
  };
  
  const htmlStyles = parseStyleString(htmlAttrs?.style);
  const bodyStyles = parseStyleString(bodyAttrs?.style);
  
  return (
    <div ref={wrapperRef} className="archive-mode-wrapper">
      {/* HTML-level container */}
      <div 
        className={htmlClasses}
        style={htmlStyles}
      >
        {/* Body-level container */}
        <div 
          className={bodyClasses}
          style={bodyStyles}
        >
          {children}
        </div>
      </div>
    </div>
  );
}