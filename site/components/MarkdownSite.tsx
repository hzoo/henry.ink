import { useLocation } from "preact-iso";
import { marked } from "marked";
import DOMPurify from "dompurify";

import {
	markdownContentSignal,
	isLoadingSignal,
	errorSignal,
} from "@/site/signals";
import { useUrlPathSyncer, useContentFetcher } from "@/site/services";

export function MarkdownSite() {
	const location = useLocation();

	// Use the custom hooks for URL syncing and content fetching
	useUrlPathSyncer();
	useContentFetcher();

	return (
		<div className="flex-1 overflow-auto h-full">
			<div className="h-full flex flex-col">
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
					<div className="flex-1 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-lg rounded-2xl m-4">
						<div
							className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300 p-4 bg-amber-50/50 dark:bg-gray-900/50 rounded-xl border border-amber-100 dark:border-gray-700 overflow-auto h-full"
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
						<div className="flex-1 flex items-center justify-center text-amber-600 dark:text-amber-400">
							<div className="max-w-md mx-auto text-center">
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
									Example:{" "}
									<a
										href="/https://overreacted.io/static-as-a-server/"
										className="text-blue-600 dark:text-blue-400 hover:underline"
									>
										/https://overreacted.io/static-as-a-server/
									</a>
								</p>
							</div>
						</div>
					)}
			</div>
		</div>
	);
}
