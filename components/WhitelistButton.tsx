import { addDomainToWhitelist } from "@/lib/settings";
import { extractBaseDomain } from "@/lib/extractBaseDomain";
import { useSignal } from "@preact/signals";

interface WhitelistButtonProps {
  onWhitelist?: () => void;
}

export function WhitelistButton({ onWhitelist }: WhitelistButtonProps) {
  const isWhitelisting = useSignal(false);

  const handleWhitelist = async () => {
    isWhitelisting.value = true;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab.url) {
        const domain = extractBaseDomain(tab.url);
        await addDomainToWhitelist(domain);
        onWhitelist?.();
      }
    } finally {
      isWhitelisting.value = false;
    }
  };

  return (
    <button
      onClick={handleWhitelist}
      disabled={isWhitelisting.value}
      className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isWhitelisting.value ? (
        <svg className="w-4 h-4 mr-2 animate-spin" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : null}
      Allow auto-fetch for this site
    </button>
  );
} 