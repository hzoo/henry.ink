import { useLocation } from "preact-iso";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { useRef, useEffect } from "preact/hooks";

import { contentStateSignal, contentModeSignal } from "@/henry-ink/signals";
import { useUrlPathSyncer, useContentFetcher } from "@/henry-ink/services";
import { HighlightController } from "@/src/components/highlights/HighlightController";
import { QuotePositionDots } from "@/src/components/highlights/QuotePositionDots";
import { ArenaNavigationController } from "@/src/components/highlights/ArenaNavigationController";
import { ArenaEnhancedContent } from "@/henry-ink/components/ArenaEnhancedContent";
import { ArchiveModeWrapper } from "@/henry-ink/components/ArchiveModeWrapper";
import { currentUrl } from "@/src/lib/messaging";
import { injectArchiveCSS, cleanupArchiveCSS } from "@/henry-ink/utils/cssInjection";
import "@/henry-ink/styles/archive-mode.css";

export function MarkdownSite() {
	const location = useLocation();
	const contentState = contentStateSignal.value;
	const contentMode = contentModeSignal.value;
	const contentRef = useRef<HTMLDivElement>(null);

	// Use the custom hooks for URL syncing and content fetching
	useUrlPathSyncer();
	useContentFetcher();

	// Handle CSS injection for archive mode
	useEffect(() => {
		if (contentMode === 'archive' && contentState.type === 'success' && contentState.css) {
			console.log('🎨 Archive CSS detected, length:', contentState.css.length);
			console.log('🎨 First 500 chars:', contentState.css.substring(0, 500));
			injectArchiveCSS(contentState.css);
		} else {
			console.log('🎨 Cleaning up archive CSS, mode:', contentMode, 'state:', contentState.type, 'hasCss:', !!(contentState.type === 'success' && contentState.css));
			cleanupArchiveCSS();
		}
		
		// Cleanup on unmount
		return () => {
			cleanupArchiveCSS();
		};
	}, [contentMode, contentState]);

	return (
		<div className="flex-1 h-full flex flex-col min-w-0">
			{contentState.type === "loading" && (
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
					{/* Content mode tabs */}
					<div className="mb-2 flex gap-1 items-center">
						{/* Mode buttons */}
						<button
							onClick={() => contentModeSignal.value = 'md'}
							className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
								contentMode === 'md'
									? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
									: 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
							}`}
							title="Markdown reader mode"
						>
							<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
								<path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
							</svg>
							reader
						</button>

						<button
							onClick={() => contentModeSignal.value = 'archive'}
							className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
								contentMode === 'archive'
									? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
									: 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
							}`}
							title="Original page styling"
						>
							<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
								<path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
							</svg>
							original
						</button>

						{/* Separator */}
						<div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1"></div>

						{/* External links */}
						<a
							href={`https://web.archive.org/web/${currentUrl.value}`}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
							title="View on Wayback Machine"
						>
							<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
								<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
							</svg>
							wayback
						</a>
						
						<a
							href={`https://arena.henryzoo.com/${currentUrl.value}`}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
							title="Search on Arena"
						>
							<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
								<path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
							</svg>
							arena
						</a>

						<a
							href={currentUrl.value}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
							title="View original page"
						>
							<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
								<path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
							</svg>
							original
						</a>
					</div>
					
					{contentMode === 'archive' && contentState.html ? (
						<ArchiveModeWrapper
							htmlAttrs={contentState.htmlAttrs}
							bodyAttrs={contentState.bodyAttrs}
						>
							<div className="archive-mode">
								<ArenaEnhancedContent 
									htmlContent={DOMPurify.sanitize(contentState.html)}
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
						<h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
							Welcome to Henry's Note
						</h2>
						<p className="text-lg mb-8 text-gray-700 dark:text-gray-300">
							reader* mode with social annotations
						</p>

						<div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700">
							<h3 className="text-lg font-medium mb-6 text-gray-900 dark:text-gray-100">
								How to use:
							</h3>
							<div className="space-y-4 text-left">
								<div className="flex items-start gap-4">
									<div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center text-blue-700 dark:text-blue-300 font-medium text-sm">
										1
									</div>
									<div>
										<p className="font-medium text-gray-900 dark:text-gray-100 mb-1">
											Quick access bookmarklet
										</p>
										<p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
											Drag this button to your bookmarks bar for 1-click access
											for any page
										</p>
										{/* biome-ignore lint/a11y/useValidAnchor: <explanation> */}
										<a
											href="javascript:location.href='https://henry.ink/'+location.href"
											className="inline-flex items-center px-3 py-2 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/70 transition-colors text-sm font-medium cursor-move border border-blue-200 dark:border-blue-800"
											onClick={(e) => {
												e.preventDefault();
												alert(
													"Drag this button to your bookmarks bar instead of clicking!",
												);
											}}
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
													d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
												/>
											</svg>
											→ henry.ink
										</a>
									</div>
								</div>

								<div className="flex items-start gap-4">
									<div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center text-blue-700 dark:text-blue-300 font-medium text-sm">
										2
									</div>
									<div>
										<p className="font-medium text-gray-900 dark:text-gray-100 mb-1">
											Or paste any URL
										</p>
										<p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
											Just append any URL to the end of
											<span className="inline-flex items-center mx-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
												henry.ink/
											</span>
											to get a clean version
										</p>
									</div>
								</div>

								<div className="flex items-start gap-4">
									<div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center text-blue-700 dark:text-blue-300 font-medium text-sm">
										3
									</div>
									<div>
										<p className="font-medium text-gray-900 dark:text-gray-100 mb-1">
											See social discussions
										</p>
										<p className="text-sm text-gray-600 dark:text-gray-400">
											View related Bluesky conversations in the sidebar
										</p>
									</div>
								</div>
							</div>

							<div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
								<a
									href="/https://overreacted.io/static-as-a-server/"
									className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
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
									Example: Static as a Server
								</a>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
