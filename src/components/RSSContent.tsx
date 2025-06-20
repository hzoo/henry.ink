import { useState } from "preact/hooks";
import { marked } from "marked";
import DOMPurify from "dompurify";
import type { ParsedRSSFeed, RSSItem } from "../lib/rss-discovery";
import { formatRSSItemAsMarkdown } from "../lib/rss-discovery";

interface RSSContentProps {
	feed: ParsedRSSFeed;
	selectedItemIndex?: number;
	onItemSelect?: (index: number) => void;
}

export function RSSContent({ feed, selectedItemIndex = 0, onItemSelect }: RSSContentProps) {
	const [selectedIndex, setSelectedIndex] = useState(selectedItemIndex);
	
	const handleItemSelect = (index: number) => {
		setSelectedIndex(index);
		if (onItemSelect) {
			onItemSelect(index);
		}
	};
	
	const selectedItem = feed.items[selectedIndex];
	
	if (!selectedItem) {
		return (
			<div className="text-center p-8 text-gray-500 dark:text-gray-400">
				No items found in this RSS feed
			</div>
		);
	}
	
	const markdown = formatRSSItemAsMarkdown(selectedItem);
	
	return (
		<div className="flex flex-col h-full">
			{/* Feed Header */}
			<div className="border-b border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800">
				<div className="flex items-center justify-between">
					<div>
						<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
							{feed.title}
						</h2>
						{feed.description && (
							<p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
								{feed.description}
							</p>
						)}
					</div>
					<div className="flex items-center gap-2">
						<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
							{feed.feedType.toUpperCase()}
						</span>
						<span className="text-sm text-gray-500 dark:text-gray-400">
							{feed.items.length} items
						</span>
					</div>
				</div>
			</div>
			
			<div className="flex flex-1 overflow-hidden">
				{/* Item List */}
				<div className="w-80 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
					<div className="p-2">
						{feed.items.map((item, index) => (
							<button
								key={item.guid || item.link || index}
								onClick={() => handleItemSelect(index)}
								className={`w-full text-left p-3 rounded-lg mb-2 transition-colors ${
									selectedIndex === index
										? 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800'
										: 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-700'
								} border`}
							>
								<h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 line-clamp-2 leading-tight">
									{item.title}
								</h3>
								{item.pubDate && (
									<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
										{new Date(item.pubDate).toLocaleDateString()}
									</p>
								)}
								{item.description && (
									<p className="text-xs text-gray-600 dark:text-gray-400 mt-2 line-clamp-3">
										{item.description.replace(/<[^>]*>/g, '').substring(0, 120)}...
									</p>
								)}
							</button>
						))}
					</div>
				</div>
				
				{/* Content Area */}
				<div className="flex-1 overflow-y-auto">
					<div className="p-6">
						<div
							className="prose prose-lg max-w-none text-gray-800 dark:text-gray-200 prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-strong:text-gray-900 dark:prose-strong:text-gray-100 prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-p:text-gray-800 dark:prose-p:text-gray-200 prose-li:text-gray-800 dark:prose-li:text-gray-200 leading-relaxed"
							// biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized
							dangerouslySetInnerHTML={{
								__html: DOMPurify.sanitize(marked.parse(markdown) as string),
							}}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}

interface RSSFeedListProps {
	feeds: Array<{ url: string; title: string; type: string }>;
	onFeedSelect: (feedUrl: string) => void;
	selectedFeedUrl?: string;
}

export function RSSFeedList({ feeds, onFeedSelect, selectedFeedUrl }: RSSFeedListProps) {
	if (feeds.length === 0) {
		return (
			<div className="text-center p-8 text-gray-500 dark:text-gray-400">
				No RSS feeds discovered
			</div>
		);
	}
	
	return (
		<div className="space-y-2">
			<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
				Discovered RSS Feeds ({feeds.length})
			</h3>
			{feeds.map((feed, index) => (
				<button
					key={feed.url}
					onClick={() => onFeedSelect(feed.url)}
					className={`w-full text-left p-4 rounded-lg border transition-colors ${
						selectedFeedUrl === feed.url
							? 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800'
							: 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-700'
					}`}
				>
					<div className="flex items-center justify-between">
						<div className="flex-1">
							<h4 className="font-medium text-gray-900 dark:text-gray-100">
								{feed.title}
							</h4>
							<p className="text-sm text-gray-600 dark:text-gray-400 mt-1 break-all">
								{feed.url}
							</p>
						</div>
						<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 ml-2">
							{feed.type.replace('application/', '')}
						</span>
					</div>
				</button>
			))}
		</div>
	);
}