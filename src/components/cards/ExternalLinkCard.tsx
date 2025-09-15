/**
 * Generic external link card component
 * Handles non-AT Protocol external URLs
 */
import type { StoredMark } from "@/api/trails/trail-storage";

interface ExternalLinkCardProps {
  url: string;
  mark: StoredMark;
  onClick?: (mark: StoredMark) => void;
  className?: string;
}

export function ExternalLinkCard({ url, mark, onClick, className }: ExternalLinkCardProps) {
  const handleClick = () => {
    if (onClick) {
      onClick(mark);
    } else {
      // Default: open external link in new tab
      window.open(url, '_blank');
    }
  };

  const title = mark.external_title || mark.external_url || 'Untitled';
  const domain = url ? new URL(url).hostname.replace('www.', '') : null;

  return (
    <div 
      className={`col-span-1 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer group h-fit ${className || ''}`}
      onClick={handleClick}
      title={mark.note || title}
    >
      {/* Note at top with purple styling */}
      {mark.note && (
        <div className="px-3 py-2 bg-purple-50 dark:bg-purple-900/10 border-b border-purple-100 dark:border-purple-800/30">
          <div className="text-xs text-purple-700 dark:text-purple-300 line-clamp-2">
            › {mark.note}
          </div>
        </div>
      )}
      
      <div className="p-4">
        {/* Mark Type Indicator */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-shrink-0">
            <button
              className="w-5 h-5 bg-green-500 hover:bg-green-600 rounded-sm flex items-center justify-center transition-all hover:scale-110 hover:shadow-md"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (mark.external_url) {
                  window.open(mark.external_url, '_blank');
                }
              }}
              title="Open external link"
            >
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z" clipRule="evenodd" />
                <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          {domain && (
            <span className="text-xs text-gray-400 dark:text-gray-500 truncate ml-2">
              {domain}
            </span>
          )}
        </div>
        
        {/* Content */}
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {title}
        </h3>
      </div>
    </div>
  );
}

/**
 * Modal version of ExternalLinkCard for detailed view
 */
export function ExternalLinkCardModal({ url, mark }: Omit<ExternalLinkCardProps, 'onClick' | 'className'>) {
  const title = mark.external_title || mark.external_url || 'Untitled';
  const domain = url ? new URL(url).hostname.replace('www.', '') : null;
  
  const handleOpenUrl = () => {
    window.open(url, '_blank');
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-800/50">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                External Link
              </span>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {title}
            </h3>
            {domain && (
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                {domain}
              </div>
            )}
            {url && (
              <div className="text-sm text-gray-600 dark:text-gray-400 break-all font-mono bg-gray-100 dark:bg-gray-700 p-2 rounded">
                {url}
              </div>
            )}
          </div>
          {url && (
            <button
              onClick={handleOpenUrl}
              className="ml-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors font-medium"
            >
              Open
            </button>
          )}
        </div>
      </div>
    </div>
  );
}