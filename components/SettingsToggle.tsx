import { useSignal, useComputed } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { BlueskySettings } from "./BlueskySettings";
import { autoFetchEnabled } from "@/lib/settings";

export function SettingsToggle() {
  const isOpen = useSignal(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const toggleDropdown = () => {
    isOpen.value = !isOpen.value;
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        isOpen.value = false;
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Settings button with integrated privacy indicator */}
      <button
        className="relative p-1.5 rounded-full text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700"
        onClick={toggleDropdown}
        aria-label="Settings"
      >
        {/* Auto-fetch indicator */}
        <div 
          className={`absolute top-0.5 right-0.5 w-2 h-2 rounded-full ${
            autoFetchEnabled.value ? 'bg-green-500' : 'bg-yellow-500'
          } flex items-center justify-center`}
          title={autoFetchEnabled.value ? 'Auto-fetch enabled - Posts are automatically loaded' : 'Auto-fetch disabled - Manual refresh only'}
        >
          {autoFetchEnabled.value && (
            <svg 
              className="w-1.5 h-1.5 text-white" 
              viewBox="0 0 24 24" 
              fill="currentColor"
            >
              <path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8zm0 16v2A10 10 0 0 0 22 12h-2a8 8 0 0 1-8 8z"/>
            </svg>
          )}
        </div>
        {/* Settings icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>

      {/* Settings dropdown */}
      {isOpen.value && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-md shadow-lg overflow-hidden z-20 border border-gray-200 dark:border-gray-700 animate-slideDown">
          <div className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 py-2 px-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Privacy & Settings
            </h3>
          </div>
          <BlueskySettings />
        </div>
      )}
    </div>
  );
}