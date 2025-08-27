import { computed } from "@preact/signals";
import { useQuery } from "@tanstack/react-query";
import type { RefObject } from "preact";
import { contentStateSignal } from "@/henry-ink/signals";
import { currentUrl } from "@/src/lib/messaging";
import { fetchArenaMatches, arenaQueryKeys } from "@/src/lib/arena-api";
import { navigateToChannel } from "@/src/lib/arena-navigation";
import type { ArenaMatch } from "@/src/lib/arena-types";
import { useEffect } from "preact/hooks";

interface ArenaEnhancedContentProps {
  htmlContent: string;
  contentRef: RefObject<HTMLDivElement>;
  mode: 'md' | 'archive';
}

/**
 * Component that enhances HTML content with Arena channel links
 * Uses text matching instead of positions for accuracy
 */
export function ArenaEnhancedContent({ htmlContent, contentRef, mode }: ArenaEnhancedContentProps) {
  const contentState = contentStateSignal.value;

  // Use shared query with URL-based key (much smaller than content)
  const { data: arenaMatches = [] } = useQuery({
    queryKey: arenaQueryKeys.matches(currentUrl.value || null),
    queryFn: () => fetchArenaMatches(contentState.type === 'success' ? contentState.content : ''),
    enabled: contentState.type === 'success' && !!contentState.content,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  });

  // Compute enhanced content
  const enhancedHtml = computed(() => {
    if (!arenaMatches.length || typeof window === 'undefined') {
      return htmlContent;
    }

    // Create a temporary container for DOM manipulation
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    // Sort matches by length (longest first) to avoid partial replacements
    const sortedMatches = [...arenaMatches].sort((a, b) => 
      b.matchedText.length - a.matchedText.length
    );

    // Track what we've already enhanced to avoid duplicates
    const enhancedTexts = new Set<string>();

    // Walk through text nodes and enhance matches
    const walker = document.createTreeWalker(
      tempDiv,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (parent) {
            // Skip if already in a link, code, or pre
            if (parent.tagName === 'A' || 
                parent.tagName === 'CODE' || 
                parent.tagName === 'PRE' ||
                parent.closest('a') ||
                parent.closest('code') ||
                parent.closest('pre')) {
              return NodeFilter.FILTER_REJECT;
            }
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodesToReplace: Array<{
      node: Text;
      replacements: Array<{ match: ArenaMatch; index: number }>
    }> = [];

    // Find all matches in text nodes
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const textNode = node as Text;
      const text = textNode.textContent || '';
      const lowerText = text.toLowerCase();
      const replacements: Array<{ match: ArenaMatch; index: number }> = [];

      for (const match of sortedMatches) {
        const matchLower = match.matchedText.toLowerCase();
        
        // Skip if we've already enhanced this text
        if (enhancedTexts.has(matchLower)) continue;

        let index = lowerText.indexOf(matchLower);
        if (index !== -1) {
          // Check word boundaries
          const before = index > 0 ? text[index - 1] : ' ';
          const after = index + match.matchedText.length < text.length 
            ? text[index + match.matchedText.length] : ' ';
          
          const validBefore = /\s|^/.test(before) || !/\w/.test(before);
          const validAfter = /\s|$/.test(after) || !/\w/.test(after);
          
          if (validBefore && validAfter) {
            replacements.push({ match, index });
            enhancedTexts.add(matchLower);
          }
        }
      }

      if (replacements.length > 0) {
        nodesToReplace.push({ node: textNode, replacements });
      }
    }

    // Apply replacements (after walking to avoid modifying tree during traversal)
    for (const { node, replacements } of nodesToReplace) {
      const text = node.textContent || '';
      const parent = node.parentNode;
      if (!parent) continue;

      // Sort replacements by position (reverse order)
      const sortedReplacements = replacements.sort((a, b) => b.index - a.index);
      
      let currentText = text;
      let fragments: (string | HTMLElement)[] = [text];

      // Process each replacement
      for (const { match, index } of sortedReplacements) {
        const newFragments: (string | HTMLElement)[] = [];
        
        for (const fragment of fragments) {
          if (typeof fragment === 'string') {
            const fragLower = fragment.toLowerCase();
            const matchLower = match.matchedText.toLowerCase();
            const fragIndex = fragLower.indexOf(matchLower);
            
            if (fragIndex !== -1) {
              // Split the fragment and insert link
              const before = fragment.substring(0, fragIndex);
              const matchedText = fragment.substring(fragIndex, fragIndex + match.matchedText.length);
              const after = fragment.substring(fragIndex + match.matchedText.length);
              
              if (before) newFragments.push(before);
              
              // Create link wrapper
              const linkWrapper = document.createElement('span');
              linkWrapper.className = 'arena-channel-link-wrapper';
              
              // Create clickable text for internal navigation
              const textLink = document.createElement('button');
              textLink.className = 'arena-channel-link';
              textLink.title = `View ${match.title} in sidebar`;
              textLink.textContent = matchedText;
              textLink.setAttribute('data-channel-slug', match.slug);
              textLink.setAttribute('data-channel-data', JSON.stringify(match));
              
              // Create external link icon
              const externalLink = document.createElement('a');
              externalLink.href = `https://are.na/channels/${match.slug}`;
              externalLink.className = 'arena-link-icon';
              externalLink.target = '_blank';
              externalLink.rel = 'noopener noreferrer';
              externalLink.title = `Open ${match.title} on Are.na`;
              externalLink.textContent = '↗';
              
              linkWrapper.appendChild(textLink);
              linkWrapper.appendChild(externalLink);
              
              newFragments.push(linkWrapper);
              if (after) newFragments.push(after);
            } else {
              newFragments.push(fragment);
            }
          } else {
            newFragments.push(fragment);
          }
        }
        
        fragments = newFragments;
      }

      // Replace the text node with fragments
      for (const fragment of fragments) {
        if (typeof fragment === 'string') {
          parent.insertBefore(document.createTextNode(fragment), node);
        } else {
          parent.insertBefore(fragment, node);
        }
      }
      parent.removeChild(node);
    }

    return tempDiv.innerHTML;
  });

  // Add click handlers for arena channel links
  useEffect(() => {
    if (!contentRef.current) return;

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

    contentRef.current.addEventListener('click', handleChannelClick);
    
    return () => {
      contentRef.current?.removeEventListener('click', handleChannelClick);
    };
  }, [contentRef, enhancedHtml.value]);

  // Both modes now use regular rendering - CSS isolation handled at parent level
  return (
    <div
      ref={contentRef}
      className={mode === 'archive' ? 'max-w-none' : 'prose prose-lg dark:prose-invert max-w-none leading-relaxed overflow-wrap-anywhere break-words'}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized
      dangerouslySetInnerHTML={{ __html: enhancedHtml.value }}
    />
  );
}