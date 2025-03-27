import { memo } from "preact/compat";

interface ErrorMessageProps {
  message: string;
}

// Reusable component for displaying error messages
// Memoized to prevent unnecessary re-renders
export const ErrorMessage = memo(({ message }: ErrorMessageProps) => (
  <div class="p-4 m-3 text-red-700 bg-red-100 rounded-md dark:bg-red-900/30 dark:text-red-300">
    {message}
  </div>
)); 