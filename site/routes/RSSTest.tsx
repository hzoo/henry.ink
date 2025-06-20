import { useState } from "preact/hooks";
import { RSSContent, RSSFeedList } from "../../src/components/RSSContent";
import {
	discoverRSSFeeds,
	parseRSSFeed,
	formatRSSItemAsMarkdown,
} from "../../src/lib/rss-discovery";
import type { RSSFeed, ParsedRSSFeed } from "../../src/lib/rss-discovery";

interface ComparisonContentProps {
	url: string;
	rssContent?: string;
	jinaContent?: string;
}

function ComparisonContent({
	url,
	rssContent,
	jinaContent,
}: ComparisonContentProps) {
	return (
		<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
			{/* RSS Content */}
			<div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
				<div className="bg-green-100 dark:bg-green-900/30 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
					<h3 className="font-semibold text-green-800 dark:text-green-300">
						RSS Content
					</h3>
				</div>
				<div className="p-4 h-96 overflow-y-auto">
					{rssContent ? (
						<div className="prose prose-sm max-w-none text-gray-800 dark:text-gray-200">
							<pre className="whitespace-pre-wrap text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded">
								{rssContent}
							</pre>
						</div>
					) : (
						<p className="text-gray-500 dark:text-gray-400 italic">
							No RSS content available
						</p>
					)}
				</div>
			</div>

			{/* Jina.ai Content */}
			<div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
				<div className="bg-blue-100 dark:bg-blue-900/30 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
					<h3 className="font-semibold text-blue-800 dark:text-blue-300">
						Jina.ai Content
					</h3>
				</div>
				<div className="p-4 h-96 overflow-y-auto">
					{jinaContent ? (
						<div className="prose prose-sm max-w-none text-gray-800 dark:text-gray-200">
							<pre className="whitespace-pre-wrap text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded">
								{jinaContent}
							</pre>
						</div>
					) : (
						<p className="text-gray-500 dark:text-gray-400 italic">
							No Jina.ai content available
						</p>
					)}
				</div>
			</div>
		</div>
	);
}

export function RSSTest() {
	const [url, setUrl] = useState("https://overreacted.io/");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [discoveredFeeds, setDiscoveredFeeds] = useState<RSSFeed[]>([]);
	const [selectedFeedUrl, setSelectedFeedUrl] = useState<string | null>(null);
	const [parsedFeed, setParsedFeed] = useState<ParsedRSSFeed | null>(null);
	const [selectedItemIndex, setSelectedItemIndex] = useState(0);
	const [jinaContent, setJinaContent] = useState<string | null>(null);
	const [view, setView] = useState<"discovery" | "content" | "comparison">(
		"discovery",
	);

	const handleDiscoverFeeds = async () => {
		if (!url.trim()) return;

		setLoading(true);
		setError(null);
		setDiscoveredFeeds([]);
		setSelectedFeedUrl(null);
		setParsedFeed(null);

		try {
			const feeds = await discoverRSSFeeds(url.trim());
			setDiscoveredFeeds(feeds);

			if (feeds.length === 0) {
				setError(
					"No RSS feeds found for this URL. Try checking the site manually or using a different URL.",
				);
			}
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to discover RSS feeds",
			);
		} finally {
			setLoading(false);
		}
	};

	const handleFeedSelect = async (feedUrl: string) => {
		setSelectedFeedUrl(feedUrl);
		setLoading(true);
		setError(null);
		setParsedFeed(null);

		try {
			const feed = await parseRSSFeed(feedUrl);
			setParsedFeed(feed);
			setSelectedItemIndex(0);
			setView("content");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to parse RSS feed");
		} finally {
			setLoading(false);
		}
	};

	const handleCompareWithJina = async () => {
		if (!parsedFeed || !parsedFeed.items[selectedItemIndex]) return;

		const selectedItem = parsedFeed.items[selectedItemIndex];
		if (!selectedItem.link) {
			setError("Selected RSS item has no link to compare with Jina.ai");
			return;
		}

		setLoading(true);
		setError(null);

		try {
			const WORKER_BASE_URL = "https://jina_proxy_worker.hi-899.workers.dev";
			const response = await fetch(`${WORKER_BASE_URL}/${selectedItem.link}`);

			if (!response.ok) {
				throw new Error(`Jina.ai error: ${response.status}`);
			}

			const content = await response.text();
			setJinaContent(content);
			setView("comparison");
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to fetch content from Jina.ai",
			);
		} finally {
			setLoading(false);
		}
	};

	const rssContent = parsedFeed?.items[selectedItemIndex]
		? formatRSSItemAsMarkdown(parsedFeed.items[selectedItemIndex])
		: null;

	return (
		<div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 to-stone-100 dark:from-slate-900 dark:to-gray-900 text-gray-900 dark:text-gray-100">
			{/* Header */}
			<header className="px-6 py-4 border-b border-slate-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
							RSS Feed Explorer
						</h1>
						<p className="text-gray-600 dark:text-gray-400 mt-1">
							Discover and test RSS feeds as an alternative to web scraping
						</p>
					</div>
					<a
						href="/"
						className="text-blue-600 dark:text-blue-400 hover:underline"
					>
						← Back to Demo
					</a>
				</div>
			</header>

			{/* URL Input Section */}
			<div className="px-6 py-4 border-b border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800">
				<div className="flex gap-4 items-end">
					<div className="flex-1">
						<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							Website URL
						</label>
						<input
							type="url"
							value={url}
							onChange={(e) => setUrl((e.target as HTMLInputElement).value)}
							placeholder="https://example.com"
							className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						/>
					</div>
					<div className="flex gap-2">
						<button
							onClick={handleDiscoverFeeds}
							disabled={loading || !url.trim()}
							className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
						>
							{loading ? (
								<svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
									<circle
										className="opacity-25"
										cx="12"
										cy="12"
										r="10"
										stroke="currentColor"
										strokeWidth="4"
										fill="none"
									/>
									<path
										className="opacity-75"
										fill="currentColor"
										d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
									/>
								</svg>
							) : null}
							Discover Feeds
						</button>
						{parsedFeed && (
							<button
								onClick={handleCompareWithJina}
								disabled={loading}
								className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Compare with Jina.ai
							</button>
						)}
					</div>
				</div>
			</div>

			{/* View Toggle */}
			{(discoveredFeeds.length > 0 || parsedFeed) && (
				<div className="px-6 py-3 border-b border-slate-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
					<div className="flex gap-1">
						<button
							onClick={() => setView("discovery")}
							className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
								view === "discovery"
									? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
									: "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
							}`}
						>
							Feed Discovery
						</button>
						{parsedFeed && (
							<button
								onClick={() => setView("content")}
								className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
									view === "content"
										? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
										: "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
								}`}
							>
								RSS Content
							</button>
						)}
						{jinaContent && (
							<button
								onClick={() => setView("comparison")}
								className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
									view === "comparison"
										? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
										: "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
								}`}
							>
								RSS vs Jina.ai
							</button>
						)}
					</div>
				</div>
			)}

			{/* Error Display */}
			{error && (
				<div className="mx-6 mt-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg">
					<div className="flex items-center gap-2">
						<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
							<path
								fillRule="evenodd"
								d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
								clipRule="evenodd"
							/>
						</svg>
						{error}
					</div>
				</div>
			)}

			{/* Content Area */}
			<div className="flex-1 overflow-hidden p-6">
				{view === "discovery" && (
					<RSSFeedList
						feeds={discoveredFeeds}
						onFeedSelect={handleFeedSelect}
						selectedFeedUrl={selectedFeedUrl}
					/>
				)}

				{view === "content" && parsedFeed && (
					<div className="h-full border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
						<RSSContent
							feed={parsedFeed}
							selectedItemIndex={selectedItemIndex}
							onItemSelect={setSelectedItemIndex}
						/>
					</div>
				)}

				{view === "comparison" && (
					<ComparisonContent
						url={url}
						rssContent={rssContent}
						jinaContent={jinaContent}
					/>
				)}

				{!loading && discoveredFeeds.length === 0 && !error && (
					<div className="flex-1 flex items-center justify-center">
						<div className="text-center">
							<div className="w-24 h-24 mx-auto mb-6 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
								<svg
									className="w-12 h-12 text-gray-400"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 11-2 0 1 1 0 012 0z"
									/>
								</svg>
							</div>
							<h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
								RSS Feed Explorer
							</h3>
							<p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
								Enter a website URL above to discover available RSS/Atom feeds
								and explore their content.
							</p>
							<div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-left max-w-md">
								<h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
									Try these examples:
								</h4>
								<div className="space-y-2 text-sm">
									<button
										onClick={() => setUrl("https://overreacted.io/")}
										className="block text-blue-600 dark:text-blue-400 hover:underline"
									>
										overreacted.io
									</button>
									<button
										onClick={() => setUrl("https://ciechanow.ski/")}
										className="block text-blue-600 dark:text-blue-400 hover:underline"
									>
										ciechanow.ski
									</button>
								</div>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
