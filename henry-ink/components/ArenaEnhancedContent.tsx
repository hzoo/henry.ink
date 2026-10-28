import { useQuery } from "@tanstack/react-query";
import type { ComponentChildren } from "preact";
import { contentStateSignal } from "@/henry-ink/signals";
import { currentUrl } from "@/src/lib/messaging";
import { fetchArenaMatches, arenaQueryKeys } from "@/src/lib/arena-api";
import { navigateToChannel } from "@/src/lib/arena-navigation";
import type { ArenaMatch } from "@/src/lib/arena-types";
import { useCallback, useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { enhanceArenaLinks } from "@/henry-ink/reader/arena-enhancement";
import { InlineNotes } from "@/henry-ink/reader/InlineNotes";
import { observeArenaNavigation } from '@/henry-ink/reader/arena-navigation';
import { observeSourceFragment } from '@/henry-ink/reader/fragments';

interface ArenaEnhancedContentProps {
  htmlContent: string;
  renderContent?: (html: string, matches: ArenaMatch[]) => ComponentChildren;
}

const EMPTY_MATCHES: ArenaMatch[] = [];

/**
 * Component that enhances HTML content with Arena channel links
 * Uses text matching instead of positions for accuracy
 */
export function ArenaEnhancedContent({ htmlContent, renderContent }: ArenaEnhancedContentProps) {
  const contentState = contentStateSignal.value;
  const url = currentUrl.value;
  const textRoot = useSignal<HTMLDivElement | null>(null);
  const setTextRoot = useCallback((root: HTMLDivElement | null) => {
    textRoot.value = root;
  }, [textRoot]);

  // Use shared query with URL-based key (much smaller than content)
  const { data: arenaMatches = EMPTY_MATCHES } = useQuery({
    queryKey: arenaQueryKeys.matches(url || null),
    queryFn: ({ signal }) => fetchArenaMatches(contentState.type === 'success' ? contentState.content : '', url, signal),
    enabled: contentState.type === 'success' && contentState.url === url && !!contentState.content,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  });

  // Update the Text document in place, just like the isolated Original frame.
  useEffect(() => {
    if (!textRoot.value) return;
    enhanceArenaLinks(textRoot.value, arenaMatches);
    return observeArenaNavigation(textRoot.value, currentUrl.value);
  }, [textRoot.value, htmlContent, arenaMatches, currentUrl.value]);

  useEffect(() => {
    if (textRoot.value) return observeSourceFragment(textRoot.value);
  }, [textRoot.value, htmlContent]);

  // Add click handlers for arena channel links
  useEffect(() => {
    const element = textRoot.value;
    if (!element) return;

    const handleChannelClick = (event: Event) => {
      const button = (event.target as Element | null)?.closest?.('button.arena-channel-link');
      const slug = button?.getAttribute('data-channel-slug');
      if (slug) {
        event.preventDefault();
        navigateToChannel(slug);
      }
    };

    const controller = new AbortController();
    element.addEventListener('click', handleChannelClick, { signal: controller.signal });
    return () => controller.abort();
  }, [textRoot.value]);

  if (renderContent) return <>{renderContent(htmlContent, arenaMatches)}</>;
  return (
    <>
    <div
      ref={setTextRoot}
      className="prose prose-lg dark:prose-invert max-w-none leading-relaxed overflow-wrap-anywhere break-words"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
    {textRoot.value && contentState.type === 'success' && <InlineNotes root={textRoot.value} article={contentState} />}
    </>
  );
}
