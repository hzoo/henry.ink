import { useQuery } from "@tanstack/react-query";
import type { RefObject, ComponentChildren } from "preact";
import { contentStateSignal } from "@/henry-ink/signals";
import { currentUrl } from "@/src/lib/messaging";
import { fetchArenaMatches, arenaQueryKeys } from "@/src/lib/arena-api";
import { navigateToChannel } from "@/src/lib/arena-navigation";
import type { ArenaMatch } from "@/src/lib/arena-types";
import { useEffect, useRef } from "preact/hooks";
import { enhanceArenaLinks } from "@/henry-ink/reader/arena-enhancement";

interface ArenaEnhancedContentProps {
  htmlContent: string;
  contentRef: RefObject<HTMLDivElement>;
  mode: 'md' | 'archive';
  renderContent?: (html: string) => ComponentChildren;
}

const EMPTY_MATCHES: ArenaMatch[] = [];

/**
 * Component that enhances HTML content with Arena channel links
 * Uses text matching instead of positions for accuracy
 */
export function ArenaEnhancedContent({ htmlContent, contentRef, mode, renderContent }: ArenaEnhancedContentProps) {
  const contentState = contentStateSignal.value;

  // Use shared query with URL-based key (much smaller than content)
  const { data: arenaMatches = EMPTY_MATCHES } = useQuery({
    queryKey: arenaQueryKeys.matches(currentUrl.value || null),
    queryFn: () => fetchArenaMatches(contentState.type === 'success' ? contentState.content : ''),
    enabled: contentState.type === 'success' && !!contentState.content,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  });

  const enhancedCache = useRef<{ html: string; matches: ArenaMatch[]; doc: Document; result: string } | null>(null);
  const enhance = () => {
    if (!arenaMatches.length || typeof document === 'undefined') return htmlContent;
    const root = document.createElement('div');
    root.innerHTML = htmlContent;
    enhanceArenaLinks(root, arenaMatches);
    return root.innerHTML;
  };
  const doc = typeof document === 'undefined' ? null : document;
  const cached = enhancedCache.current;
  const enhancedHtml = cached?.html === htmlContent && cached.matches === arenaMatches && cached.doc === doc
    ? cached.result : enhance();
  if (doc && (!cached || cached.html !== htmlContent || cached.matches !== arenaMatches || cached.doc !== doc)) {
    enhancedCache.current = { html: htmlContent, matches: arenaMatches, doc, result: enhancedHtml };
  }

  // Add click handlers for arena channel links
  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    const handleChannelClick = (event: Event) => {
      const button = event.target as HTMLElement;
      if (button.classList.contains('arena-channel-link')) {
        event.preventDefault();
        const channelData = button.getAttribute('data-channel-data');
        if (channelData) {
          try {
            const channel = JSON.parse(channelData) as ArenaMatch;
            navigateToChannel(channel);
          } catch (err) {
            console.error('Failed to parse channel data:', err);
          }
        }
      }
    };

    element.addEventListener('click', handleChannelClick);
    
    return () => {
      element.removeEventListener('click', handleChannelClick);
    };
  }, [contentRef, enhancedHtml]);

  // Both modes now use regular rendering - CSS isolation handled at parent level
  if (renderContent) return <>{renderContent(enhancedHtml)}</>;
  return (
    <div
      ref={contentRef}
      className={mode === 'archive' ? 'max-w-none' : 'prose prose-lg dark:prose-invert max-w-none leading-relaxed overflow-wrap-anywhere break-words'}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized
      dangerouslySetInnerHTML={{ __html: enhancedHtml }}
    />
  );
}
