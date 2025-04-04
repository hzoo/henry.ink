import { addDomainToWhitelist } from "@/lib/settings";
import { currentDomain } from "@/lib/messaging";

const handleWhitelist = () => {
  addDomainToWhitelist(currentDomain.value);
};

export function WhitelistButton() {
  return (
    <button
      onClick={handleWhitelist}
      className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      Allow auto-searching this site
    </button>
  );
} 