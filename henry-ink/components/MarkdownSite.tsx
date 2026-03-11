import { useLocation } from "preact-iso";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { useRef, useEffect } from "preact/hooks";
import { signal, useSignalEffect } from "@preact/signals";

import { contentStateSignal, contentModeSignal } from "@/henry-ink/signals";
import { useUrlPathSyncer, useContentFetcher } from "@/henry-ink/services";
import { HighlightController } from "@/src/components/highlights/HighlightController";
import { QuotePositionDots } from "@/src/components/highlights/QuotePositionDots";
import { ArenaNavigationController } from "@/src/components/highlights/ArenaNavigationController";
import { ArenaEnhancedContent } from "@/henry-ink/components/ArenaEnhancedContent";
import { ArchiveModeWrapper } from "@/henry-ink/components/ArchiveModeWrapper";
import { YouTubePlayer } from "@/henry-ink/components/YouTubePlayer";
import { injectArchiveCSS, cleanupArchiveCSS } from "@/henry-ink/utils/cssInjection";
import "@/henry-ink/styles/archive-mode.css";

// Example carousel component
const examples = [
	{
		title: "Spatial Software",
		domain: "darkblueheaven.com",
		url: "/darkblueheaven.com/spatialsoftware/"
	},
	{
		title: "Reality has a surprising amount of detail",
		domain: "johnsalvatier.org",
		url: "https://henry.ink/http://johnsalvatier.org/blog/2017/reality-has-a-surprising-amount-of-detail"
	},
	{
		title: "Mechanical Watch",
		domain: "ciechanow.ski",
		url: "/ciechanow.ski/mechanical-watch/"
	},
	{
		title: "How I cut GTA Online loading times by 70%",
		domain: "nee.lv",
		url: "/nee.lv/2021/02/28/How-I-cut-GTA-Online-loading-times-by-70/"
	},
];

const currentExampleIndex = signal(0);
const isHovered = signal(false);
const progress = signal(0);

function ExampleCarousel() {
	// Auto-rotate examples with progress animation
	useSignalEffect(() => {
		if (isHovered.value) return;

		progress.value = 0;

		const progressInterval = setInterval(() => {
			if (isHovered.value) return;
			progress.value += 1;

			if (progress.value >= 100) {
				currentExampleIndex.value = (currentExampleIndex.value + 1) % examples.length;
				progress.value = 0;
			}
		}, 40);

		return () => clearInterval(progressInterval);
	});

	const currentExample = examples[currentExampleIndex.value];

	return (
		<div
			className="text-center"
			onMouseEnter={() => isHovered.value = true}
			onMouseLeave={() => isHovered.value = false}
		>
			<a
				href={currentExample.url}
				className="relative inline-flex items-center px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300 text-sm font-medium overflow-hidden"
			>
				<svg
					className="w-4 h-4 mr-2"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
					/>
				</svg>
				<span
					key={currentExample.title}
					className="transition-opacity duration-300"
				>
					Try: {currentExample.title}
				</span>

				{/* Progress bar */}
				<div
					className="absolute bottom-0 left-0 h-0.5 bg-white/30 transition-all duration-75 ease-linear"
					style={{ width: `${progress.value}%` }}
				/>
			</a>

			{/* Domain transformation subtitle */}
			<div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
				<span className="inline-flex items-center px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-mono">
					{currentExample.domain}
				</span>
				<span className="mx-2">→</span>
				<span className="inline-flex items-center px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-mono">
					henry.ink/{currentExample.domain}
				</span>
			</div>
		</div>
	);
}

// Signal to control delayed loading state
const showLoadingSignal = signal(false);

export function MarkdownSite() {
	const location = useLocation();
	const contentState = contentStateSignal.value;
	const contentMode = contentModeSignal.value;
	const contentRef = useRef<HTMLDivElement>(null);
	const showLoading = showLoadingSignal.value;
	const embedContent = contentState.type === 'success' ? contentState.embed : undefined;

	// Use the custom hooks for URL syncing and content fetching
	useUrlPathSyncer();
	useContentFetcher();

	// Handle delayed loading state (only show after 300ms)
	useSignalEffect(() => {
		if (contentStateSignal.value.type === 'loading') {
			const timer = setTimeout(() => {
				showLoadingSignal.value = true;
			}, 300);
			return () => clearTimeout(timer);
		} else {
			showLoadingSignal.value = false;
		}
	});

	// Handle CSS injection for archive mode
	useEffect(() => {
		if (contentMode === 'archive' && contentState.type === 'success' && contentState.css) {
			injectArchiveCSS(contentState.css);
		} else {
			cleanupArchiveCSS();
		}

		return () => {
			cleanupArchiveCSS();
		};
	}, [contentMode, contentState]);

	return (
		<div className="flex-1 h-full flex flex-col min-w-0">
			{contentState.type === "loading" && showLoading && (
				<div className="text-center p-8 flex flex-col items-center justify-center space-y-2">
					<div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
						<svg
							className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500"
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
						Loading content...
					</div>
					<div className="text-gray-500 dark:text-gray-400 text-sm">
						(first time processing a site can take a moment)
					</div>
				</div>
			)}

			{contentState.type === "error" && (
				<div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl">
					<div className="flex items-center">
						<svg
							className="w-5 h-5 mr-2"
							fill="currentColor"
							viewBox="0 0 20 20"
						>
							<path
								fillRule="evenodd"
								d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
								clipRule="evenodd"
							/>
						</svg>
						<span className="font-medium">Error:</span>
						<span className="ml-1">{contentState.message}</span>
					</div>
				</div>
			)}

			{contentState.type === "success" && (
				<>
					{/* Content - conditional width based on mode */}
					<div className={contentMode === 'archive' ? '' : 'max-w-4xl mx-auto'}>
						{contentMode === 'embed' && embedContent ? (
							embedContent.provider === 'youtube' ? (
								<YouTubePlayer
									videoId={embedContent.videoId}
									title={embedContent.title}
									transcript={embedContent.transcript}
								/>
							) : (
								<div className="rounded-xl border border-yellow-200 dark:border-yellow-900/40 bg-yellow-50 dark:bg-yellow-900/20 p-4 text-sm text-yellow-800 dark:text-yellow-200">
									Unsupported embed provider: {embedContent.provider}
								</div>
							)
						) : contentMode === 'archive' && contentState.html ? (
							<ArchiveModeWrapper
								htmlAttrs={contentState.htmlAttrs}
								bodyAttrs={contentState.bodyAttrs}
							>
								<div className="archive-mode">
									<ArenaEnhancedContent
										htmlContent={DOMPurify.sanitize(contentState.html, {
											USE_PROFILES: { html: true, svg: true },
											FORBID_TAGS: ['script', 'iframe', 'embed', 'object', 'applet', 'base',
												'form', 'noscript', 'template', 'math', 'link',
												'foreignObject', 'animate', 'animateTransform', 'animateMotion', 'set',
												'use', 'feImage'],
											FORBID_ATTR: ['formaction', 'xlink:href'],
										})}
										contentRef={contentRef}
										mode="archive"
									/>
								</div>
							</ArchiveModeWrapper>
						) : (
							<ArenaEnhancedContent
								htmlContent={DOMPurify.sanitize(marked.parse(contentState.content) as string)}
								contentRef={contentRef}
								mode="md"
							/>
						)}
					</div>
					<HighlightController contentRef={contentRef} />
					<QuotePositionDots contentRef={contentRef} />
					<ArenaNavigationController contentRef={contentRef} enabled={contentState.type === 'success'} />
				</>
			)}

			{contentState.type === "idle" && location.path === "/" && (
				<div className="flex-1 flex items-center justify-center">
					<div className="max-w-2xl text-center px-2 sm:px-4 w-full">
						<img
							src="/hnote.webp"
							alt="Henry's Note"
							className="w-20 h-20 mx-auto mb-6 object-contain dark:filter dark:invert"
						/>
						<h2 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
							Henry's Note
						</h2>
						<p className="text-gray-600 dark:text-gray-400 mb-8">
							A social annotation layer for the web
						</p>

						{/* Lead with examples */}
						<div className="mb-8">
							<ExampleCarousel />
						</div>

						{/* Collapsible how-to */}
						<details className="bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 text-left">
							<summary className="px-6 py-4 cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
								How does this work?
							</summary>
							<div className="px-6 pb-6 space-y-4">
								<div className="flex items-start gap-3">
									<div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center text-blue-700 dark:text-blue-300 font-medium text-xs">
										1
									</div>
									<div>
										<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
											Prepend henry.ink/ to any URL
										</p>
										<p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
											<span className="font-mono">domain.com</span>
											<span className="mx-1.5">→</span>
											<span className="font-mono text-blue-600 dark:text-blue-400">henry.ink/domain.com</span>
										</p>
									</div>
								</div>

								<div className="flex items-start gap-3">
									<div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center text-blue-700 dark:text-blue-300 font-medium text-xs">
										2
									</div>
									<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
										See Bluesky discussions and Arena connections in the sidebar
									</p>
								</div>

								<div className="flex items-start gap-3">
									<div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center text-blue-700 dark:text-blue-300 font-medium text-xs">
										3
									</div>
									<div>
										<p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
											Bookmarklet for quick access
										</p>
										{/* biome-ignore lint/a11y/useValidAnchor: bookmarklet */}
										<a
											href="javascript:location.href='https://henry.ink/'+location.href"
											className="inline-flex items-center px-3 py-1.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/70 transition-colors text-xs font-medium cursor-move border border-blue-200 dark:border-blue-800"
											onClick={(e) => {
												e.preventDefault();
												alert("Drag this button to your bookmarks bar instead of clicking!");
											}}
										>
											<svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
											</svg>
											→ henry.ink
										</a>
										<span className="text-xs text-gray-400 dark:text-gray-500 ml-2">drag to bookmarks bar</span>
									</div>
								</div>
							</div>
						</details>

						<a
							href="https://henryzoo.com"
							target="_blank"
							rel="noopener noreferrer"
							className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400 mt-6 block text-center transition-colors"
						>
							by henry
						</a>
					</div>
				</div>
			)}
		</div>
	);
}
