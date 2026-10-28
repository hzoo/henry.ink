import { useSignal, useComputed } from "@preact/signals";
import { useEffect, useLayoutEffect, useMemo, useRef } from "preact/hooks";
import { now as generateRkey } from '@atcute/tid';
import { quotedSelection, currentUrl, showCommentDialog } from "@/src/lib/messaging";
import { atCuteState } from "@/demo/lib/oauth";
import { contentStateSignal } from '@/henry-ink/signals';
import { pageMetadata } from '@/src/lib/page-metadata';
import { discussionShareUrl } from '@/henry-ink/reader/url';
import type {
	AppBskyFeedPost,
	AppBskyRichtextFacet,
} from "@atcute/bluesky";

const MAX_CHARS = 300;
const MAX_BYTES = 3000;
const MAX_QUOTE_DISPLAY = 80;
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const textEncoder = new TextEncoder();

function handleClose() {
	quotedSelection.value = null;
	showCommentDialog.value = false;
	// Save draft on close? Maybe not on explicit cancel.
}


const truncateQuote = (quote: string) => {
	let length = 0;
	let end = quote.length;
	for (const { index } of graphemes.segment(quote)) {
		if (length === MAX_QUOTE_DISPLAY) end = index;
		length++;
	}
	if (length <= MAX_QUOTE_DISPLAY) return { text: quote, length };

	// Find the last space within the grapheme-safe prefix to avoid cutting words.
	const truncated = quote.slice(0, end);
	const lastSpace = truncated.lastIndexOf(' ');
	return { text: `${truncated.slice(0, lastSpace > 0 ? lastSpace : undefined)}...`, length };
};

// Helper function to create compose-friendly text for Bluesky
const createComposeText = (text: string, originalUrl: string): string => {
	// Replace [h↗] with the actual URL for external sharing
	const textWithUrl = text.replace(/\[h↗\]/g, originalUrl);
	return textWithUrl;
};


// Helper function to create facet for [h↗] with post rkey
const createHenryInkFacet = (text: string, postRkey: string, originalUrl: string): AppBskyRichtextFacet.Main[] => {
	const henryInkText = "[h↗]";
	const henryInkIndex = text.indexOf(henryInkText);
	
	if (henryInkIndex === -1) return [];
	
	const byteStartIndex = textEncoder.encode(text.slice(0, henryInkIndex)).length;
	const byteEndIndex = byteStartIndex + textEncoder.encode(henryInkText).length;
	const henryInkUrl = discussionShareUrl(originalUrl, postRkey);
	
	return [{
		index: { byteStart: byteStartIndex, byteEnd: byteEndIndex },
		features: [{
			$type: "app.bsky.richtext.facet#link",
			uri: henryInkUrl as `${string}:${string}`,
		}],
	}];
};

const fetchPageMetadata = async (originalUrl: string) => {
	const article = contentStateSignal.peek();
	if (article.type === 'success' && article.url === originalUrl) {
		return pageMetadata(originalUrl, article);
	}
	if (typeof browser !== 'undefined' && browser.tabs) {
		try {
			const tabs: { url?: string; title?: string }[] = await browser.tabs.query({ active: true, currentWindow: true });
			const tab = tabs.find(tab => tab.url === originalUrl);
			if (tab?.url) return pageMetadata(originalUrl, { url: tab.url, title: tab.title });
		} catch { /* Metadata must not prevent posting. */ }
	}
	return pageMetadata(originalUrl);
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
	return <QuoteComposer />;
}

function QuoteComposer() {
	const dialogRef = useRef<HTMLDialogElement>(null);
	useLayoutEffect(() => {
		const dialog = dialogRef.current;
		dialog?.showModal();
		return () => dialog?.close();
	}, []);

	// --- State Signals ---
	const { originalUrl, initialQuote } = useMemo(() => ({
		originalUrl: currentUrl.peek(),
		initialQuote: quotedSelection.peek(),
	}), []);
	const quotePreview = useMemo(() => truncateQuote(initialQuote || ''), [initialQuote]);
	const userText = useSignal(initialQuote
		? `${quotePreview.text.split("\n").map(line => `> ${line}`).join("\n")}\n\n[h↗]`
		: "[h↗]");
	const isPosting = useSignal(false);
	const postError = useSignal<string | null>(null);
	const previewMetadata = useSignal<{title: string, description: string} | null>(null);
	const userProfile = useSignal<{handle: string, avatar?: string} | null>(null);
	const currentAtCute = atCuteState.value;
	const isQuoteExpanded = useSignal(false);
	const postRkey = useMemo(generateRkey, []);
	const failedPostText = useSignal<string>(""); // Store text when login fails

	// --- Computed Values ---
	const combinedLength = useComputed(() => Array.from(graphemes.segment(userText.value)).length);
	const remainingChars = useComputed(() => MAX_CHARS - combinedLength.value);
	const remainingBytes = useComputed(() => MAX_BYTES - textEncoder.encode(userText.value).length);

	const isPostDisabled = useComputed(
		() =>
			isPosting.value ||
			userText.value.trim().length === 0 || // Disallow empty posts
			remainingChars.value < 0 || remainingBytes.value < 0,
	);

	// --- Effects ---
	// Effect to fetch metadata for preview
	useEffect(() => {
		let active = true;
		previewMetadata.value = null;
		if (originalUrl) {
			fetchPageMetadata(originalUrl).then(metadata => {
				if (active) previewMetadata.value = metadata;
			});
		}
		return () => { active = false; };
	}, [originalUrl]);

	// Effect to fetch user profile
	useEffect(() => {
		userProfile.value = null;
		if (!currentAtCute) return;
		const controller = new AbortController();
		const did = currentAtCute.session.info.sub;
		try {
			const handle = localStorage.getItem(`bskyUserHandle_${did}`);
			if (handle) {
				userProfile.value = { handle, avatar: localStorage.getItem(`bskyUserAvatar_${did}`) || undefined };
				return;
			}
		} catch { /* Fetch the profile when its optional cache is unavailable. */ }
		void currentAtCute.rpc.get("app.bsky.actor.getProfile", {
			params: { actor: did }, signal: controller.signal,
		}).then(({ ok, data }) => {
			if (!ok || controller.signal.aborted || atCuteState.peek() !== currentAtCute || !data.handle) return;
			userProfile.value = { handle: data.handle, avatar: data.avatar };
		}).catch(() => { /* Profile details must not prevent composing. */ });
		return () => controller.abort();
	}, [currentAtCute]);

	// --- Event Handlers ---
	const handlePostClick = async () => {
		if (isPosting.value || isPostDisabled.value) return;
		isPosting.value = true;
		postError.value = null;

		const state = atCuteState.peek();
		if (!state?.session || !state?.rpc) {
			postError.value = "You must be logged in to post.";
			failedPostText.value = createComposeText(userText.value.trim(), originalUrl); // Store compose-friendly text
			isPosting.value = false;
			return;
		}

		const { session, rpc } = state;
		const fullText = userText.value.trim();

		try {
			// Create facets for [h↗] link with rkey
			const facets = createHenryInkFacet(fullText, postRkey, originalUrl);

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
			if (initialQuote) {
				postRecord._annotation = {
					quote: initialQuote,
				};
			}

			const { ok, data } = await rpc.post("com.atproto.repo.createRecord", {
				input: {
					repo: session.info.sub,
					collection: "app.bsky.feed.post",
					rkey: postRkey,
					record: postRecord,
				},
			});
			if (!ok) throw new Error(data.message || data.error);

			userText.value = ""; // Clear text on success
			if (dialogRef.current?.open) handleClose();
		} catch (err) {
			console.error("Failed to create post:", err);
			postError.value = `Failed to post: ${err instanceof Error ? err.message : "Unknown error"}`;
		} finally {
			isPosting.value = false;
		}
	};

	return (
		<dialog
			ref={dialogRef}
			aria-label={initialQuote ? 'Quote this page' : 'Comment on this page'}
			className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent open:flex justify-center items-start pt-16 p-4 backdrop:bg-black/30"
			onKeyDown={event => event.stopPropagation()}
			onClose={handleClose}
			onCancel={event => {
				event.preventDefault();
				if (!isPosting.peek()) handleClose();
			}}
			onClick={event => {
				if (event.target === event.currentTarget && !isPosting.peek()) handleClose();
			}}
		>
			<div
				className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="flex justify-between items-center p-3 border-b border-gray-200 dark:border-gray-700">
					<button
						onClick={handleClose}
						disabled={isPosting.value}
						className="min-h-10 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium px-2 py-1 rounded disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						onClick={handlePostClick}
						disabled={isPostDisabled.value}
						className="min-h-10 px-4 py-1 rounded-full bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[70px]"
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

				{/* Body - Integrated Preview/Edit */}
				<div className="p-4">
					<div className="flex gap-3">
						{/* User avatar */}
						{userProfile.value?.avatar ? (
							<img 
								src={userProfile.value.avatar} 
								alt={userProfile.value.handle}
								className="w-10 h-10 rounded-full object-cover"
							/>
						) : (
							<div className="w-10 h-10 rounded-full bg-blue-600 flex-shrink-0 flex items-center justify-center">
								<span className="text-white text-sm font-semibold">
									{userProfile.value?.handle?.charAt(0).toUpperCase() || 'U'}
								</span>
							</div>
						)}
						<div className="flex-1 min-w-0">
							{/* User info */}
							<div className="flex items-center gap-1 text-sm mb-1">
								<span className="font-semibold text-gray-900 dark:text-gray-100 truncate">
									{userProfile.value?.handle || 'your-handle'}
								</span>
								<span className="text-gray-500 dark:text-gray-400">·</span>
								<span className="text-gray-500 dark:text-gray-400">now</span>
							</div>
							{/* Editable textarea styled like a post */}
							<textarea
								id="quote-reply-textarea"
								autoFocus
								className="w-full bg-transparent outline-none resize-none text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 whitespace-pre-wrap break-words"
								rows={4}
								style={{ fieldSizing: "content", minHeight: "60px", maxHeight: "300px" }}
								placeholder={initialQuote ? "Add your comment..." : "Share your thoughts about this page..."}
								value={userText.value}
								onInput={(e) => {
									userText.value = (e.target as HTMLTextAreaElement).value;
									postError.value = null;
									failedPostText.value = "";
								}}
								maxLength={MAX_BYTES}
								disabled={isPosting.value}
							/>
							{/* External embed preview */}
							{previewMetadata.value && originalUrl && (
								<div className="mt-1 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
									<div className="px-3 pt-2 pb-1 bg-gray-50 dark:bg-gray-900">
										<div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
											{previewMetadata.value.title}
										</div>
										<div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
											{previewMetadata.value.description}
										</div>
										{/* hr */}
										<hr className="my-1 border-gray-200 dark:border-gray-700" />
										<div className="text-xs text-gray-600 dark:text-gray-300 truncate">
											{new URL(originalUrl).hostname}
										</div>
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
				
				
				{postError.value && (
					<div className="px-4 pb-2 text-xs">
						{postError.value === "You must be logged in to post." ? (
							<div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
								<span>Not logged in</span>
								<span>→</span>
								<a
									href={`https://bsky.app/intent/compose?text=${encodeURIComponent(failedPostText.value)}`}
									target="_blank"
									rel="noopener noreferrer"
									className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
								>
									Post on Bluesky
								</a>
							</div>
						) : (
							<div className="text-red-600 dark:text-red-400">
								{postError.value}
							</div>
						)}
					</div>
				)}
				{/* Footer with metadata */}
				<div className="border-t bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 px-3 py-2">
					<div className="flex justify-between items-start">
						<div className="space-y-1 flex-1">
							{/* Quote truncation info */}
							{initialQuote && quotePreview.length > MAX_QUOTE_DISPLAY && (
								<div className="space-y-2">
									<div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
										<span>Quote truncated ({quotePreview.length}→{MAX_QUOTE_DISPLAY} chars)</span>
										<button
											onClick={() => isQuoteExpanded.value = !isQuoteExpanded.value}
											className="inline-flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
											aria-label={isQuoteExpanded.value ? "Hide full quote" : "Show full quote"}
										>
											<svg 
												className={`w-3 h-3 transition-transform ${isQuoteExpanded.value ? 'rotate-90' : ''}`}
												fill="none" 
												stroke="currentColor" 
												viewBox="0 0 24 24"
											>
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
											</svg>
										</button>
									</div>
									{isQuoteExpanded.value && (
										<div className="bg-gray-100 dark:bg-gray-800 rounded p-2 border border-gray-200 dark:border-gray-700 max-w-md">
											<div className="flex items-start justify-between gap-2 mb-2">
												<span className="text-xs font-medium text-gray-700 dark:text-gray-300">Full quote:</span>
												<button
													onClick={() => navigator.clipboard.writeText(initialQuote)}
													className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 flex-shrink-0"
													aria-label="Copy full quote"
												>
													<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
													</svg>
													Copy
												</button>
											</div>
											<div className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
												{initialQuote}
											</div>
										</div>
									)}
								</div>
							)}
							{/* Henry.ink link info */}
							{userText.value.includes('[h↗]') && (
								<div className="text-xs text-gray-600 dark:text-gray-400">
									<span className="font-mono bg-gray-100 dark:bg-gray-700 dark:text-gray-300 px-1 rounded text-xs">[h↗]</span>
									<span className="ml-1">
									→ <a className="hover:text-gray-800 dark:hover:text-gray-200 font-normal" href={discussionShareUrl(originalUrl || 'your-url', postRkey)} target="_blank" rel="noopener noreferrer">henry.ink/{new URL(originalUrl || 'https://example.com').hostname}...</a>
									</span>
								</div>
							)}
						</div>
						{/* Character count */}
						<div className="ml-3">
							<span
								className={`text-sm ${remainingChars.value < 0 || remainingBytes.value < 0 ? "text-red-600 dark:text-red-400 font-semibold" : "text-gray-500 dark:text-gray-400"}`}
							>
								{remainingBytes.value < 0 ? `${-remainingBytes.value} bytes over limit` : remainingChars.value}
							</span>
						</div>
					</div>
				</div>
			</div>
		</dialog>
	);
}
