import { useLocation } from "preact-iso";
import { useRef } from "preact/hooks";
import { signal, useSignalEffect } from "@preact/signals";

import { contentStateSignal, contentModeSignal, contentRevision } from "@/henry-ink/signals";
import { useUrlPathSyncer, useContentFetcher } from "@/henry-ink/services";
import { HighlightController } from "@/src/components/highlights/HighlightController";
import { QuotePositionDots } from "@/src/components/highlights/QuotePositionDots";
import { ArenaNavigationController } from "@/src/components/highlights/ArenaNavigationController";
import { ArenaEnhancedContent } from "@/henry-ink/components/ArenaEnhancedContent";
import { ArchiveDocument } from "@/henry-ink/components/ArchiveDocument";
import { sanitizeReaderHtml, readerDocumentMode } from "@/henry-ink/reader/document";
import { sanitizeReadableHtml } from "@/henry-ink/reader/readable";
import { useReaderNotes } from "@/henry-ink/reader/notes";
import { currentUrl } from "@/src/lib/messaging";
import { YouTubePlayer } from "@/henry-ink/components/YouTubePlayer";
import { extractYouTubeVideoId } from '@/henry-ink/embed/youtube';
import { ReaderError, ReaderLoading } from '@/henry-ink/components/ReaderStatus';

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

export function MarkdownSite() {
	const location = useLocation();
	const contentState = contentStateSignal.value;
	const contentMode = contentModeSignal.value;
	const contentRef = useRef<HTMLDivElement>(null);
	const renderedHtml = useRef<{ mode: 'archive' | 'md'; source: string; doc: Document; html: string } | null>(null);
	const videoId = contentMode === 'embed' ? extractYouTubeVideoId(currentUrl.value) : null;
	const embedContent = contentState.type === 'success' && contentState.url === currentUrl.value ? contentState.embed : undefined;
	const prepareHtml = (mode: 'archive' | 'md', source: string) => {
		const cached = renderedHtml.current;
		if (cached?.mode === mode && cached.source === source && cached.doc === document) return cached.html;
		const html = mode === 'archive'
			? sanitizeReaderHtml(source, document, true)
			: sanitizeReadableHtml(source, document);
		renderedHtml.current = { mode, source, doc: document, html };
		return html;
	};

	// Use the custom hooks for URL syncing and content fetching
	useUrlPathSyncer();
	useContentFetcher();
	useReaderNotes();

	return (
		<div className="flex-1 h-full min-h-0 flex flex-col min-w-0">
			{!videoId && contentState.type === 'loading' && <ReaderLoading key={`${currentUrl.value}:${contentMode}:${contentRevision.value}`} label={contentState.message} />}
			{!videoId && contentState.type === 'error' && <ReaderError message={contentState.message} source={currentUrl.value} onRetry={() => contentRevision.value++} />}
			{videoId && <YouTubePlayer key={videoId} videoId={videoId} title={embedContent?.title}
				transcriptState={embedContent ? { type: 'ready', items: embedContent.transcript }
					: contentState.type === 'error' ? { type: 'error', message: contentState.message } : { type: 'loading' }}
				onRetry={() => contentRevision.value++} />}

			{!videoId && contentState.type === "success" && contentState.url === currentUrl.value && contentState.mode === contentMode && (
				<>
					{/* Content - conditional width based on mode */}
					<div className={contentMode === 'archive' ? 'flex-1 min-h-0 flex flex-col' : contentMode === 'md'
						? 'w-full min-w-0 max-w-4xl mx-auto px-4 sm:px-6 [overflow-wrap:anywhere] [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_pre]:max-w-full [&_pre]:overflow-x-auto'
						: 'max-w-4xl mx-auto'}>
						{contentMode === 'archive' && contentState.html ? (
									<ArenaEnhancedContent
										htmlContent={prepareHtml('archive', contentState.html)}
										contentRef={contentRef}
										mode="archive"
										renderContent={html => <ArchiveDocument key={contentState.url} html={html} css={contentState.css || ''}
											documentMode={readerDocumentMode(contentState.html || '')}
											resolvedUrl={contentState.resolvedUrl}
											url={currentUrl.value} title={contentState.title} htmlAttrs={contentState.htmlAttrs} bodyAttrs={contentState.bodyAttrs} />}
									/>
						) : (
							<ArenaEnhancedContent
									htmlContent={prepareHtml('md', contentState.html || '')}
								contentRef={contentRef}
								mode="md"
							/>
						)}
					</div>
					{contentMode !== 'archive' && <>
						<HighlightController contentRef={contentRef} />
						<QuotePositionDots contentRef={contentRef} />
						<ArenaNavigationController contentRef={contentRef} enabled={true} />
					</>}
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
