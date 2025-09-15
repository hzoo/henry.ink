import type { StoredMark } from "@/api/trails/trail-storage";
import { AtProtoCard, shouldUseAtProtoCard } from "@/src/components/AtProtoCard";
import { BskyPostCard } from "@/src/components/cards/BskyPostCard";
import { ExternalLinkCard } from "@/src/components/cards/ExternalLinkCard";

interface MarkCardProps {
  mark: StoredMark;
  onClick?: (mark: StoredMark) => void;
}

export function MarkCard({ mark, onClick }: MarkCardProps) {
  const handleClick = () => {
    if (onClick) {
      onClick(mark);
    } else {
      // Default click behavior
      const isExternal = mark.subject_type === 'external';
      if (isExternal && mark.external_url) {
        window.open(mark.external_url, '_blank');
      }
    }
  };

  const isExternal = mark.subject_type === 'external';
  const isStrongRef = mark.subject_type === 'strongRef';

  // Handle strongRef marks (AT Protocol references)
  if (isStrongRef) {
    return (
      <BskyPostCard 
        url={mark.subject_uri || ''}
        mark={mark}
        onClick={() => handleClick()}
        handle=""
        rkey=""
      />
    );
  }

  // Handle external links
  if (isExternal && mark.external_url) {
    // Check if it's a supported AT Protocol URL
    if (shouldUseAtProtoCard(mark)) {
      return (
        <AtProtoCard 
          url={mark.external_url}
          mark={mark}
          onClick={() => handleClick()}
        />
      );
    }
    
    // Regular external link
    return (
      <ExternalLinkCard 
        url={mark.external_url}
        mark={mark}
        onClick={() => handleClick()}
      />
    );
  }

  // Fallback for unknown mark types
  return (
    <div className="col-span-1 border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 text-center">
      <div className="text-gray-500 dark:text-gray-400">
        <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <div className="text-sm">Unknown mark type</div>
      </div>
    </div>
  );
}