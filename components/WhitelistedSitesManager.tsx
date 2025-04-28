import { createPortal } from "preact/compat";
import { Icon } from "@/components/Icon";
import { whitelistedDomains, removeDomainFromWhitelist } from "@/lib/settings";

interface Props {
  onClose: () => void;
}

const handleRemoveDomain = async (domain: string) => {
  await removeDomainFromWhitelist(domain);
};

export function WhitelistedSitesManager({ onClose }: Props) {
  const modal = (
    <div 
      className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50"
      onMouseDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-sm mx-4 flex flex-col max-h-[min(32rem,90vh)]"
      >
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Manage Whitelisted Sites
          </h2>
          <button
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            aria-label="Close"
          >
            <Icon name="xMark" className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 overscroll-contain">
          {whitelistedDomains.value.length > 0 ? (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {whitelistedDomains.value.map(domain => (
                <div key={domain} 
                  className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 group"
                >
                  <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
                    {domain}
                  </span>
                  <button
                    onClick={(e) => {
                      handleRemoveDomain(domain);
                    }}
                    className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ml-3 flex-shrink-0"
                    title="Remove from whitelist"
                  >
                    <Icon name="xMark" className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 dark:text-gray-400 p-4">
              No sites have been whitelisted yet
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
} 