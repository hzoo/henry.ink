import { useRef } from "preact/hooks";
import { useLocation } from "preact-iso";
import { marked } from "marked";
import DOMPurify from "dompurify";

import { Sidebar } from "@/components/Sidebar";
import { currentUrl, quotedSelection } from "@/lib/messaging";
import { showQuotePopupOnSelection } from "@/lib/settings";
import SelectionPopupManager from "@/entrypoints/popup.content/SelectionPopupManager";

import {
	inputValueSignal,
	markdownContentSignal,
	isLoadingSignal,
	errorSignal,
} from "./signals";
import { useUrlPathSyncer, useContentFetcher } from "./services";

export function App() {
	const location = useLocation();
	const contentContainerRef = useRef<HTMLDivElement>(null);

	// Use the custom hooks for URL syncing and content fetching
	useUrlPathSyncer();
	useContentFetcher();

	const handleLoadSiteClick = () => {
		if (inputValueSignal.value) {
			if (inputValueSignal.value.startsWith("http")) {
				// Update currentUrl directly to trigger fetching and sidebar
				currentUrl.value = inputValueSignal.value;
				// Also update the URL in the address bar
				history.pushState({}, "", `/${inputValueSignal.value}`);
			} else {
				errorSignal.value =
					"Please enter a valid URL starting with http:// or https://";
			}
		}
	};

	const handleKeyPress = (e: KeyboardEvent) => {
		if (e.key === "Enter") {
			handleLoadSiteClick();
		}
	};
	return (
		<div className="flex h-screen bg-gradient-to-br from-amber-50 to-orange-50 dark:from-slate-900 dark:to-gray-900 font-mono antialiased">
			<div ref={contentContainerRef} className="flex-1 overflow-auto">
				<div className="p-6">
					<div className="max-w-4xl mx-auto">
						<header className="mb-12 text-center">
							<h1 className="text-4xl font-light text-amber-800 dark:text-amber-200 tracking-wide mb-2">
								Site Reader
							</h1>
							<p className="text-amber-600 dark:text-amber-400 text-sm font-light">
								Transform any website into clean, readable text
							</p>
						</header>

						<div className="mb-8 rounded-2xl">
							<div className="flex flex-col sm:flex-row gap-3 items-center">
								<input
									type="text"
									value={inputValueSignal.value}
									onInput={(e) =>
										(inputValueSignal.value = e.currentTarget.value)
									}
									onKeyPress={handleKeyPress}
									placeholder="Enter URL (e.g., https://example.com)"
									className="border border-amber-200 dark:border-gray-600 p-3 w-full rounded-xl focus:ring-2 focus:ring-amber-400 dark:focus:ring-amber-500 focus:border-transparent outline-none bg-white/90 dark:bg-gray-700/90 text-gray-800 dark:text-gray-200 placeholder-amber-500 dark:placeholder-gray-400 text-xs backdrop-blur-sm shadow-lg"
								/>
								<button
									onClick={handleLoadSiteClick}
									className="bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 text-white font-medium p-2 px-6 rounded-xl w-full sm:w-auto whitespace-nowrap transition-colors duration-200 shadow-sm"
									disabled={isLoadingSignal.value}
								>
									{isLoadingSignal.value ? "Loading..." : "Load"}
								</button>
							</div>
						</div>

						{isLoadingSignal.value && (
							<div className="text-center p-8">
								<div className="inline-flex items-center px-4 py-2 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
									<svg
										className="animate-spin -ml-1 mr-3 h-5 w-5 text-amber-500"
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
							</div>
						)}

						{errorSignal.value && (
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
									<span className="ml-1">{errorSignal.value}</span>
								</div>
							</div>
						)}

						{markdownContentSignal.value && !isLoadingSignal.value && (
							<div className="p-6 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-lg rounded-2xl border border-amber-200/50 dark:border-gray-700/50">
								<div
									className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300 p-4 bg-amber-50/50 dark:bg-gray-900/50 rounded-xl border border-amber-100 dark:border-gray-700 overflow-auto max-h-[60vh]"
									dangerouslySetInnerHTML={{
										__html: DOMPurify.sanitize(
											marked.parse(markdownContentSignal.value) as string,
										),
									}}
								/>
							</div>
						)}

						{!markdownContentSignal.value &&
							!isLoadingSignal.value &&
							!errorSignal.value &&
							location.path === "/" && (
								<div className="text-center p-8 text-amber-600 dark:text-amber-400">
									<div className="max-w-md mx-auto">
										<svg
											className="w-16 h-16 mx-auto mb-4 text-amber-400 dark:text-amber-500"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={1.5}
												d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
											/>
										</svg>
										<p className="text-lg font-light">
											Enter a URL above to transform any website into clean,
											readable text
										</p>
										<p className="text-sm mt-2 opacity-75">
											Or navigate to /https://your-target-url.com directly
										</p>
									</div>
								</div>
							)}
					</div>
				</div>
			</div>

			{/* Sidebar */}
			<aside className="w-[600px] border-l border-slate-200 dark:border-gray-700 h-full flex flex-col bg-white dark:bg-gray-800/50 p-2">
				<Sidebar />
				<SelectionPopupManager
					canShowPopup={() => showQuotePopupOnSelection.peek()}
					popupTitle="Quote"
					sendSelection={() => {
						const selection = window.getSelection()?.toString();
						if (!selection) return;
						quotedSelection.value = selection;
					}}
					targetContainerRef={contentContainerRef}
				/>
			</aside>
		</div>
	);
}
