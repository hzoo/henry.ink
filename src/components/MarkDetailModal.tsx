import { useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import type { StoredMark } from "@/api/trails/trail-storage";
import { shouldUseAtProtoCard } from "@/src/components/AtProtoCard";
import { getAtProtoRenderer } from "@/src/lib/atproto-renderers";
import { BskyPostCardModal } from "@/src/components/cards/BskyPostCard";
import { TangledRepoCardModal } from "@/src/components/cards/TangledRepoCard";
import { ExternalLinkCardModal } from "@/src/components/cards/ExternalLinkCard";

interface MarkDetailModalProps {
  marks: StoredMark[];
  currentIndex: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

export function MarkDetailModal({ marks, currentIndex, onClose, onIndexChange }: MarkDetailModalProps) {
  const mark = marks[currentIndex];
  
  if (!mark) return null;

  const isExternal = mark.subject_type === 'external';
  const isStrongRef = mark.subject_type === 'strongRef';
  const title = mark.external_title || mark.note || 'Untitled';
  const url = mark.external_url || mark.subject_uri;
  const domain = isExternal && mark.external_url ? new URL(mark.external_url).hostname.replace('www.', '') : null;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        onIndexChange(currentIndex - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < marks.length - 1) {
        onIndexChange(currentIndex + 1);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, marks.length, onClose, onIndexChange]);

  // Handle clicks outside modal
  const handleBackdropClick = (e: Event) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6 lg:p-8"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 sm:p-8 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
              {title}
            </h2>
            {domain && (
              <span className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                {domain}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {currentIndex + 1} of {marks.length}
            </span>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1">
          {/* Note at top with purple styling */}
          {mark.note && (
            <div className="px-6 sm:px-8 py-4 bg-purple-50 dark:bg-purple-900/10 border-b border-purple-100 dark:border-purple-800/30">
              <div className="text-sm text-purple-700 dark:text-purple-300 leading-relaxed">
                › {mark.note}
              </div>
            </div>
          )}

          <div className="p-6 sm:p-8">
            {/* Render appropriate card component based on mark type */}
            {isStrongRef ? (
              <BskyPostCardModal 
                url={mark.subject_uri || ''}
                mark={mark}
                handle=""
                rkey=""
              />
            ) : isExternal && mark.external_url ? (
              shouldUseAtProtoCard(mark) ? (
                // AT Protocol URL (like Tangled)
                (() => {
                  const renderer = getAtProtoRenderer(mark.external_url);
                  if (renderer?.component === 'TangledRepoCard') {
                    return (
                      <TangledRepoCardModal 
                        url={mark.external_url}
                        mark={mark}
                        handle={renderer.handle}
                        rkey={renderer.rkey}
                      />
                    );
                  }
                  // Default fallback for unknown AT Proto renderers
                  return (
                    <ExternalLinkCardModal 
                      url={mark.external_url}
                      mark={mark}
                    />
                  );
                })()
              ) : (
                // Regular external link
                <ExternalLinkCardModal 
                  url={mark.external_url}
                  mark={mark}
                />
              )
            ) : (
              /* Fallback for unknown mark types */
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-gray-50 dark:bg-gray-800/50 text-center">
                <div className="text-gray-500 dark:text-gray-400">
                  <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div className="text-sm">Unknown mark type</div>
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400">
              <div>Created: {new Date(mark.created_at).toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Navigation Footer */}
        <div className="flex items-center justify-between p-6 sm:p-8 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600">
          <button
            onClick={() => onIndexChange(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </button>

          <div className="flex items-center gap-1">
            {marks.slice(Math.max(0, currentIndex - 2), currentIndex + 3).map((_, idx) => {
              const actualIndex = Math.max(0, currentIndex - 2) + idx;
              return (
                <button
                  key={actualIndex}
                  onClick={() => onIndexChange(actualIndex)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    actualIndex === currentIndex 
                      ? 'bg-blue-600' 
                      : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                  }`}
                />
              );
            })}
          </div>

          <button
            onClick={() => onIndexChange(currentIndex + 1)}
            disabled={currentIndex === marks.length - 1}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}