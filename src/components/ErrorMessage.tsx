import { memo } from "preact/compat";
import type { ErrorState } from "@/src/lib/signals";

interface ErrorMessageProps {
	// Accept either the ErrorState object or a simple string
	message: ErrorState | string | null;
}

// Reusable component for displaying error messages
// Memoized to prevent unnecessary re-renders
export const ErrorMessage = memo(
	({ message }: ErrorMessageProps) => {
		if (!message) return null;

		// Determine message text and link (if any)
		const messageText = typeof message === "string" ? message : message.message;
		const messageLink =
			typeof message === "object" && message?.link ? message.link : null;

		return (
			<div class="p-4 m-3 text-red-700 bg-red-100 rounded-md dark:bg-red-900/30 dark:text-red-300">
				<span>
					{messageText}
					{messageLink && (
						<a
							href={messageLink}
							target="_blank"
							rel="noopener noreferrer"
							class="ml-1 underline text-red-800 dark:text-red-200 hover:text-red-900 dark:hover:text-red-100 font-medium"
						>
							Link
						</a>
					)}
				</span>
			</div>
		);
	},
);
