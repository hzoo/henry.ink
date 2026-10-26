import { useLocation } from "preact-iso";
import { useRef } from "preact/hooks";

import { contentStateSignal, contentModeSignal, contentRevision } from "@/henry-ink/signals";
import { useUrlPathSyncer, useContentFetcher } from "@/henry-ink/services";
import { ArenaEnhancedContent } from "@/henry-ink/components/ArenaEnhancedContent";
import { ArchiveDocument } from "@/henry-ink/components/ArchiveDocument";
import { readerDocumentMode } from "@/henry-ink/reader/document";
import { sanitizeReadableHtml } from "@/henry-ink/reader/readable";
import { useReaderNotes } from "@/henry-ink/reader/notes";
import { currentUrl } from "@/src/lib/messaging";
import { YouTubePlayer } from "@/henry-ink/components/YouTubePlayer";
import { extractYouTubeVideoId } from '@/henry-ink/embed/youtube';
import { ReaderError, ReaderLoading } from '@/henry-ink/components/ReaderStatus';

const examples = [
	{
		title: "Spatial Software",
		domain: "darkblueheaven.com",
		url: "/darkblueheaven.com/spatialsoftware/"
	},
	{
		title: "Reality has a surprising amount of detail",
		domain: "johnsalvatier.org",
		url: "/http://johnsalvatier.org/blog/2017/reality-has-a-surprising-amount-of-detail"
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

function OpenPageForm() {
	const location = useLocation();
	return <form className="mb-7 text-left" onSubmit={event => {
		event.preventDefault();
		const input = event.currentTarget.elements.namedItem('url') as HTMLInputElement;
		const value = input.value.trim();
		try {
			const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`);
			if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error();
			location.route(`/${url.href}`);
		} catch {
			input.setCustomValidity('Enter a web address, such as example.com/article.');
			input.reportValidity();
		}
	}}>
		<label className="mb-2 block text-sm font-medium" htmlFor="page-url">Web address</label>
		<div className="flex gap-2">
			<input id="page-url" name="url" type="text" inputMode="url" autoComplete="url" autoCapitalize="none" spellcheck={false}
				required placeholder="example.com/article" onInput={event => event.currentTarget.setCustomValidity('')}
				className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-3 text-base focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-gray-700 dark:bg-gray-900" />
			<button type="submit" className="shrink-0 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">Open page</button>
		</div>
	</form>;
}

export function MarkdownSite() {
	const contentState = contentStateSignal.value;
	const contentMode = contentModeSignal.value;
	const contentRef = useRef<HTMLDivElement>(null);
	const renderedHtml = useRef<{ source: string; doc: Document; html: string } | null>(null);
	const videoId = contentMode === 'embed' ? extractYouTubeVideoId(currentUrl.value) : null;
	const embedContent = contentState.type === 'success' && contentState.url === currentUrl.value ? contentState.embed : undefined;
	const prepareReadableHtml = (source: string) => {
		const cached = renderedHtml.current;
		if (cached?.source === source && cached.doc === document) return cached.html;
		const html = sanitizeReadableHtml(source, document);
		renderedHtml.current = { source, doc: document, html };
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
			{videoId && <YouTubePlayer key={videoId} videoId={videoId} title={embedContent?.title} />}

			{!videoId && contentState.type === "success" && contentState.url === currentUrl.value && contentState.mode === contentMode && (
				<>
					{/* Content - conditional width based on mode */}
					<div className={contentMode === 'archive' ? 'flex-1 min-h-0 flex flex-col' : contentMode === 'md'
						? 'w-full min-w-0 max-w-4xl mx-auto px-4 sm:px-6 [overflow-wrap:anywhere] [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_pre]:max-w-full [&_pre]:overflow-x-auto'
						: 'max-w-4xl mx-auto'}>
						{contentMode === 'archive' && contentState.html ? (
									<ArenaEnhancedContent
										htmlContent={contentState.html}
										contentRef={contentRef}
										mode="archive"
										renderContent={(html, arenaMatches) => <ArchiveDocument key={contentState.url} html={html} css={contentState.css || ''} arenaMatches={arenaMatches}
											article={contentState}
											documentMode={readerDocumentMode(contentState.html || '')}
											resolvedUrl={contentState.resolvedUrl}
											url={currentUrl.value} title={contentState.title} htmlAttrs={contentState.htmlAttrs} bodyAttrs={contentState.bodyAttrs} />}
									/>
						) : (
							<ArenaEnhancedContent
									htmlContent={prepareReadableHtml(contentState.html || '')}
								contentRef={contentRef}
								mode="md"
							/>
						)}
					</div>
				</>
			)}

			{contentState.type === "idle" && !currentUrl.value && (
				<div className="flex-1 flex items-center justify-center px-4 py-10">
					<div className="max-w-xl text-center w-full">
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

						<OpenPageForm />
						<nav aria-label="Example articles" className="mb-7 text-left">
							<h3 className="mb-2 text-xs text-gray-500 dark:text-gray-400">Or try an article</h3>
							{examples.map(example => <a key={example.url} href={example.url}
								className="flex min-h-11 items-center justify-between gap-3 rounded-md py-2 text-sm text-gray-700 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-gray-300 dark:hover:text-blue-400">
								<span>{example.title}</span><span className="shrink-0 text-xs text-gray-600 dark:text-gray-400 max-sm:hidden">{example.domain}</span>
							</a>)}
						</nav>

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
							className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mt-6 block text-center transition-colors"
						>
							by henry
						</a>
					</div>
				</div>
			)}
		</div>
	);
}
