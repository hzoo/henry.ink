import { useSignal, useSignalEffect, useComputed } from "@preact/signals";
import { quotedSelection, currentUrl, showCommentDialog } from "@/src/lib/messaging";
import { atCuteState } from "@/site/lib/oauth";
import type {
	AppBskyFeedPost,
	AppBskyRichtextFacet,
} from "@atcute/bluesky";

const MAX_CHARS = 300;
const MAX_QUOTE_DISPLAY = 80;

function handleClose() {
	quotedSelection.value = null;
	showCommentDialog.value = false;
	// Save draft on close? Maybe not on explicit cancel.
}


// Helper function to truncate quote for display
const truncateQuote = (quote: string, maxLength: number = MAX_QUOTE_DISPLAY): string => {
	if (quote.length <= maxLength) return quote;
	
	// Find last space before limit to avoid cutting words
	const truncated = quote.substring(0, maxLength);
	const lastSpace = truncated.lastIndexOf(' ');
	
	return `${truncated.substring(0, lastSpace > 0 ? lastSpace : maxLength)}...`;
};


// Helper function to create facet for [h↗]
const createHenryInkFacet = (text: string): AppBskyRichtextFacet.Main[] => {
	const henryInkText = "[h↗]";
	const henryInkIndex = text.indexOf(henryInkText);
	
	if (henryInkIndex === -1) return [];
	
	const textEncoder = new TextEncoder();
	const textBytes = textEncoder.encode(text);
	const henryInkBytes = textEncoder.encode(henryInkText);
	
	// Find byte index
	let byteStartIndex = -1;
	for (let i = 0; (i = textBytes.indexOf(henryInkBytes[0], i)) !== -1; i++) {
		if (
			textBytes
				.slice(i, i + henryInkBytes.length)
				.every((byte, j) => byte === henryInkBytes[j])
		) {
			byteStartIndex = i;
			break;
		}
	}
	
	if (byteStartIndex === -1) return [];
	
	const byteEndIndex = byteStartIndex + henryInkBytes.length;
	const henryInkUrl = `https://henry.ink/${currentUrl.value}`;
	
	return [{
		index: { byteStart: byteStartIndex, byteEnd: byteEndIndex },
		features: [{
			$type: "app.bsky.richtext.facet#link",
			uri: henryInkUrl as `${string}:${string}`,
		}],
	}];
};

// Helper function to fetch page metadata using Jina worker
const fetchPageMetadata = async (originalUrl: string) => {
	try {
		// Use the same Jina worker that henry.ink uses to get metadata
		const response = await fetch(`https://jina_proxy_worker.hi-899.workers.dev/${originalUrl}`);
		const content = await response.text();
		
		// Extract title from markdown content (Jina already processes it)
		let title = 'View on original site';
		let description = 'Click to view the original article';
		
		// Look for title in the first line (usually formatted as # Title)
		const titleMatch = content.match(/^#\s+(.+)$/m);
		if (titleMatch) {
			title = titleMatch[1].trim();
		}
		
		// Look for description (usually in italics after title)
		const descMatch = content.match(/\*(.+)\*/);
		if (descMatch) {
			description = descMatch[1].trim();
		}
		
		return { title, description };
	} catch (error) {
		console.warn('Failed to fetch page metadata from Jina worker:', error);
		return {
			title: 'View on original site',
			description: 'Click to view the original article'
		};
	}
};

// Helper function to create external embed
const createExternalEmbed = async (url: string) => {
	const metadata = await fetchPageMetadata(url);
	
	return {
		$type: "app.bsky.embed.external",
		external: {
			uri: url,
			title: metadata.title,
			description: metadata.description,
			// Note: thumb would require uploading the image as a blob
			// We can add that later if needed
		},
	};
};


export function QuotePopup() {
	// Show popup if either quoted text or comment dialog is active
	if (!quotedSelection.value && !showCommentDialog.value) return null;

	// --- State Signals ---
	// Initialize empty, will be populated by effect
	const userText = useSignal<string>("");
	const isPosting = useSignal(false);
	const postError = useSignal<string | null>(null);

	// --- Computed Values ---
	// Length is now just the userText length
	const combinedLength = useComputed(() => userText.value.length);
	const remainingChars = useComputed(() => MAX_CHARS - combinedLength.value);

	const isPostDisabled = useComputed(
		() =>
			isPosting.value ||
			userText.value.trim().length === 0 || // Disallow empty posts
			remainingChars.value < 0,
	);

	// --- Effects ---
	// Effect to set/reset text based on the current selection
	useSignalEffect(() => {
		const currentSelection = quotedSelection.value;
		const isCommentMode = showCommentDialog.value && !currentSelection;

		if (currentSelection) {
			// Selection exists, format the text with truncated quote
			const displayQuote = truncateQuote(currentSelection);
			const quoteLines = displayQuote
				.split("\n")
				.map((line) => `> ${line}`)
				.join("\n");
			const newInitialText = `${quoteLines}\n\n[h↗]`;

			// Reset userText to the new quote/URL format
			userText.value = newInitialText;
		} else if (isCommentMode) {
			// Comment mode without selection - just the henry.ink link
			userText.value = "[h↗]";
		}
	});

	// --- Event Handlers ---
	const handlePostClick = async () => {
		if (isPosting.value || isPostDisabled.value) return;
		isPosting.value = true;
		postError.value = null;

		const state = atCuteState.peek();
		if (!state?.session || !state?.rpc) {
			postError.value = "You must be logged in to post.";
			isPosting.value = false;
			return;
		}

		const { session, rpc } = state;
		const fullText = userText.value.trim();
		const originalUrl = currentUrl.value;
		const hasQuote = quotedSelection.value;

		try {
			// Create facets for [h↗] link
			const facets = createHenryInkFacet(fullText);

			// Create external embed with metadata
			const embed = originalUrl ? await createExternalEmbed(originalUrl) : undefined;

			// Create post record
			const postRecord: any = {
				$type: "app.bsky.feed.post",
				text: fullText,
				createdAt: new Date().toISOString(),
				facets: facets.length > 0 ? facets : undefined,
				embed: embed,
			};

			// Add annotation if there's a quote
			if (hasQuote) {
				postRecord._annotation = {
					quote: hasQuote,
				};
			}

			await rpc.post("com.atproto.repo.createRecord", {
				input: {
					repo: session.info.sub,
					collection: "app.bsky.feed.post",
					record: postRecord,
				},
			});

			userText.value = ""; // Clear text on success
			handleClose();
		} catch (err) {
			console.error("Failed to create post:", err);
			postError.value = `Failed to post: ${err instanceof Error ? err.message : "Unknown error"}`;
		} finally {
			isPosting.value = false;
		}
	};

	return (
		<div
			className="fixed inset-0 z-20 bg-black/30 flex items-center justify-center p-4"
			onClick={handleClose}
		>
			<div
				className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col overflow-hidden"
				onClick={(e) => e.stopPropagation()}
			>
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
							<svg
								className="animate-spin h-4 w-4 text-white"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
							>
								<circle
									className="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									strokeWidth="4"
								/>
								<path
									className="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								/>
							</svg>
						) : (
							"Post"
						)}
					</button>
				</div>

				{/* Body */}
				<div className="p-4 flex gap-3">
					<div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0" />
					<div className="flex-grow text-sm text-gray-900 dark:text-gray-100">
						<textarea
							id="quote-reply-textarea"
							className="w-full bg-transparent outline-none resize-none placeholder-gray-500 dark:placeholder-gray-400 break-all"
							rows={7}
							style={{ fieldSizing: "content", maxHeight: "500px" }}
							placeholder={quotedSelection.value ? "Add your comment..." : "Share your thoughts about this page..."}
							value={userText.value}
							onInput={(e) => {
								userText.value = (e.target as HTMLTextAreaElement).value;
								postError.value = null;
							}}
							maxLength={MAX_CHARS * 2}
							disabled={isPosting.value}
						/>
						{/* Help text for [h↗] link */}
						{(quotedSelection.value || showCommentDialog.value) && (
							<div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
								<span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">[h↗]</span>
								{" "}will link to henry.ink/your-url
							</div>
						)}
					</div>
				</div>
				{postError.value && (
					<div className="px-4 pb-2 text-red-500 text-xs">
						{postError.value}
					</div>
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
