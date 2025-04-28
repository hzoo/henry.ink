import { useSignal, useSignalEffect, useComputed } from "@preact/signals";
import { quotedSelection, currentUrl } from "@/lib/messaging";
import { atCuteState } from "@/site/lib/oauth";
import type {
	AppBskyFeedPost,
	ComAtprotoRepoCreateRecord,
} from "@atcute/client/lexicons";

const DRAFT_STORAGE_KEY = "quote_reply_draft";
const MAX_CHARS = 300;

function handleClose() {
	quotedSelection.value = null;
	// Save draft on close? Maybe not on explicit cancel.
}

export function QuotePopup() {
	// --- State Signals ---
	// Initialize empty, will be populated by effect
	const userText = useSignal<string>("");
	const isPosting = useSignal(false);
	const postError = useSignal<string | null>(null);

	// --- Computed Values ---
	// Length is now just the userText length
	const combinedLength = useComputed(() => userText.value.length);
	const remainingChars = useComputed(() => MAX_CHARS - combinedLength.value);

	const isPostDisabled = useComputed(() =>
		isPosting.value ||
		userText.value.trim().length === 0 || // Disallow empty posts
		remainingChars.value < 0
	);

	// --- Effects ---
	// Effect to set/reset text based on the current selection
	useSignalEffect(() => {
		const currentSelection = quotedSelection.value;

		if (currentSelection) {
			// Selection exists, format the text
			const url = currentUrl.value;
			const quoteLines = currentSelection.split('\n').map(line => `> ${line}`).join('\n');
			const newInitialText = `${quoteLines}\n\n${url}\n\n`;

			// Reset userText to the new quote/URL format
			userText.value = newInitialText;

			// Focus and move cursor to the end
			queueMicrotask(() => {
				const textarea = document.getElementById("quote-reply-textarea") as HTMLTextAreaElement | null;
				if (textarea) {
					textarea.focus();
					textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
				}
			});
		} else {
			// Selection cleared, reset userText (optional, depends on desired behavior on close)
			// userText.value = "";
		}
	});

	// Save draft whenever userText changes *while* a selection is active
	useSignalEffect(() => {
		if (quotedSelection.value) { // Only save if the popup is conceptually "open"
			localStorage.setItem(DRAFT_STORAGE_KEY, userText.value);
		} else {
			// Optional: Clear draft when selection is cleared/popup closes
			// localStorage.removeItem(DRAFT_STORAGE_KEY);
		}
	});

	// --- Event Handlers ---
	const handlePostClick = async () => {
		if (isPosting.value || isPostDisabled.value) return;
		isPosting.value = true;
		postError.value = null;

		const state = atCuteState.peek();
		if (!state?.session || !state?.xrpc) {
			postError.value = "You must be logged in to post.";
			isPosting.value = false;
			return;
		}

		const { session, xrpc } = state;
		const fullText = userText.value.trim(); // Use userText directly

		try {
			const postRecord: Partial<AppBskyFeedPost.Record> = {
				$type: "app.bsky.feed.post",
				text: fullText,
				createdAt: new Date().toISOString(),
			};

			const createRecordInput: ComAtprotoRepoCreateRecord.Input = {
				repo: session.info.sub,
				collection: "app.bsky.feed.post",
				record: postRecord as ComAtprotoRepoCreateRecord.Input["record"],
			};

			await xrpc.call("com.atproto.repo.createRecord", {
				data: createRecordInput,
			});

			userText.value = ""; // Clear text on success
			localStorage.removeItem(DRAFT_STORAGE_KEY); // Clear draft on success
			handleClose();

		} catch (err) {
			console.error("Failed to create post:", err);
			postError.value = `Failed to post: ${err instanceof Error ? err.message : "Unknown error"}`;
		} finally {
			isPosting.value = false;
		}
	};

	// --- Render ---
	if (!quotedSelection.value) return null;

	return (
		<div className="fixed inset-0 z-20 bg-black/30 flex items-center justify-center p-4" onClick={handleClose}>
			<div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
				{/* Header */}
				<div className="flex justify-between items-center p-3 border-b border-gray-200 dark:border-gray-700">
					<button
						onClick={handleClose}
						disabled={isPosting.value}
						className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 font-medium px-2 py-1 rounded disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						onClick={handlePostClick}
						disabled={isPostDisabled.value}
						className="px-4 py-1 rounded-full bg-blue-500 text-white font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[70px]"
					>
						{isPosting.value ? (
							<svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
								<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
							</svg>
						) : "Post"}
					</button>
				</div>

				{/* Body */}
				<div className="p-4 flex gap-3">
					<div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0" />
					<div className="flex-grow text-sm text-gray-900 dark:text-gray-100">
						<textarea
							id="quote-reply-textarea"
							className="w-full bg-transparent outline-none resize-none placeholder-gray-500 dark:placeholder-gray-400"
							rows={7}
							placeholder="Add your comment..."
							value={userText.value}
							onInput={(e) => {
								userText.value = (e.target as HTMLTextAreaElement).value;
								postError.value = null;
							}}
							maxLength={MAX_CHARS}
							disabled={isPosting.value}
						/>
					</div>
				</div>
				{postError.value && (
					<div className="px-4 pb-2 text-red-500 text-xs">{postError.value}</div>
				)}
				{/* Footer */}
				<div className="flex justify-end items-center gap-3 p-3 border-t border-gray-200 dark:border-gray-700">
					<span
						className={`text-sm ${remainingChars.value < 0 ? "text-red-500 font-semibold" : "text-gray-500 dark:text-gray-400"}`}
					>
						{remainingChars.value}
					</span>
				</div>
			</div>
		</div>
	);
}
