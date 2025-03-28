import { memo } from "preact/compat";
import { error } from "@/lib/signals";

interface ErrorMessageProps {
  message: string;
}

// Reusable component for displaying error messages
// Memoized to prevent unnecessary re-renders
export const ErrorMessage = memo(({ message }: ErrorMessageProps) => (
  <div class="p-4 m-3 text-red-700 bg-red-100 rounded-md dark:bg-red-900/30 dark:text-red-300 flex justify-between items-center">
    <span>{message}</span>
    <button
      onClick={() => error.value = null}
      class="ml-4 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
      aria-label="Dismiss error"
    >
      ✕
    </button>
  </div>
)); 