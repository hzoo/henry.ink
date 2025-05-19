import { createPortal } from "preact/compat";
import { Icon } from "@/components/Icon";
import { domainSettings, setDomainStatus } from "@/lib/settings";
import type { DomainStatus } from "@/lib/settings";

interface Props {
  onClose: () => void;
}

const handleSetDomainStatus = async (domain: string, status: DomainStatus | null) => {
  await setDomainStatus(domain, status);
};

export function DomainManager({ onClose }: Props) {
  const currentSettingsArray = Object.entries(domainSettings.value || {});

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
        className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md mx-4 flex flex-col max-h-[min(32rem,90vh)]"
      >
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Manage Site Settings
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
          {currentSettingsArray.length > 0 ? (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {currentSettingsArray.map(([domain, status]) => (
                <div key={domain} 
                  className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 group gap-2"
                >
                  <span className="text-sm text-gray-900 dark:text-gray-100 truncate flex-1">
                    {domain}
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${status === 'a' ? 'bg-green-100 text-green-700 dark:bg-green-700 dark:text-green-100' : 'bg-red-100 text-red-700 dark:bg-red-700 dark:text-red-100'}`}>
                      {status === 'a' ? 'Allowed' : 'Blocked'}
                    </span>
                  </span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                        title={`Allow ${domain}`}
                        onClick={() => handleSetDomainStatus(domain, 'a')}
                        disabled={status === 'a'}
                        className="p-1 rounded text-white bg-green-600 hover:bg-green-700 disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-green-500"
                    >
                        <Icon name="arrowPath" className="w-3 h-3" />
                    </button>
                    <button
                        title={`Block ${domain}`}
                        onClick={() => handleSetDomainStatus(domain, 'b')}
                        disabled={status === 'b'}
                        className="p-1 rounded text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-red-500"
                    >
                        <Icon name="xMark" className="w-3 h-3" />
                    </button>
                    <button
                        title={`Clear setting for ${domain}`}
                        onClick={() => handleSetDomainStatus(domain, null)}
                        className="p-1 rounded text-gray-700 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-gray-400"
                    >
                        <Icon name="funnel" className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 dark:text-gray-400 p-4">
              No sites have specific settings yet. Default behavior applies.
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
} 