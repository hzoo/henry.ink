/**
 * Smart component that determines which AT Protocol renderer to use
 * Based on URL detection and registry
 */
import type { StoredMark } from "@/api/trails/trail-storage";
import { getAtProtoRenderer, type AtProtoComponent } from "@/src/lib/atproto-renderers";
import { BskyPostCard } from "@/src/components/cards/BskyPostCard";
import { TangledRepoCard } from "@/src/components/cards/TangledRepoCard";
import { ExternalLinkCard } from "@/src/components/cards/ExternalLinkCard";

interface AtProtoCardProps {
  url: string;
  mark: StoredMark;
  onClick?: (mark: StoredMark) => void;
  className?: string;
}

export function AtProtoCard({ url, mark, onClick, className }: AtProtoCardProps) {
  const renderer = getAtProtoRenderer(url);
  
  if (!renderer) {
    // Fall back to external link card for unrecognized URLs
    return <ExternalLinkCard url={url} mark={mark} onClick={onClick} className={className} />;
  }
  
  // Dynamic component selection based on renderer type
  switch (renderer.component) {
    case 'BskyPostCard':
      return (
        <BskyPostCard 
          url={url} 
          mark={mark} 
          onClick={onClick} 
          className={className}
          handle={renderer.handle}
          rkey={renderer.rkey}
        />
      );
      
    case 'TangledRepoCard':
      return (
        <TangledRepoCard 
          url={url} 
          mark={mark} 
          onClick={onClick} 
          className={className}
          handle={renderer.handle}
          rkey={renderer.rkey}
        />
      );
      
    default:
      // Fallback for unknown renderer types
      return <ExternalLinkCard url={url} mark={mark} onClick={onClick} className={className} />;
  }
}

/**
 * Check if a mark should be rendered with AT Protocol card
 */
export function shouldUseAtProtoCard(mark: StoredMark): boolean {
  if (mark.subject_type !== 'external' || !mark.external_url) {
    return false;
  }
  
  return getAtProtoRenderer(mark.external_url) !== null;
}