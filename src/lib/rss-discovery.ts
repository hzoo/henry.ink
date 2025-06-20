export interface RSSFeed {
	url: string;
	title: string;
	type: string;
}

export interface RSSItem {
	title: string;
	link: string;
	description: string;
	content?: string;
	pubDate?: string;
	author?: string;
	guid?: string;
}

export interface ParsedRSSFeed {
	title: string;
	description: string;
	link: string;
	items: RSSItem[];
	feedType: "rss" | "atom";
}

// Discover RSS feeds from a webpage's HTML
export async function discoverRSSFeeds(url: string): Promise<RSSFeed[]> {
	const feeds: RSSFeed[] = [];

	try {
		// First try to fetch the page HTML to look for feed links
		// Use CORS proxy for browser compatibility
		const corsProxy = 'https://api.allorigins.win/raw?url=';
		const proxiedUrl = corsProxy + encodeURIComponent(url);
		
		const response = await fetch(proxiedUrl, {
			headers: {
				'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
			}
		});
		if (!response.ok) {
			throw new Error(`Failed to fetch page: ${response.status} ${response.statusText}`);
		}

		const html = await response.text();
		const parser = new DOMParser();
		const doc = parser.parseFromString(html, "text/html");

		// Look for RSS/Atom feed links in the document head
		const feedSelectors = [
			'link[rel="alternate"][type="application/rss+xml"]',
			'link[rel="alternate"][type="application/atom+xml"]',
			'link[rel="alternate"][type="application/rdf+xml"]',
			'link[rel="alternate"][type="application/rss"]',
			'link[rel="alternate"][type="application/atom"]',
		];

		for (const selector of feedSelectors) {
			const links = doc.querySelectorAll(selector);
			links.forEach((link) => {
				const linkElement = link as HTMLLinkElement;
				const feedUrl = new URL(linkElement.href, url).href;
				feeds.push({
					url: feedUrl,
					title:
						linkElement.title ||
						linkElement.getAttribute("title") ||
						"RSS Feed",
					type: linkElement.type || "application/rss+xml",
				});
			});
		}

		// If no feeds found, try common RSS URL patterns
		if (feeds.length === 0) {
			const baseUrl = new URL(url);
			const commonPaths = [
				"/rss",
				"/feed",
				"/rss.xml",
				"/feed.xml",
				"/atom.xml",
				"/feeds/all.atom.xml",
				"/index.xml",
			];

			for (const path of commonPaths) {
				const feedUrl = new URL(path, baseUrl).href;
				try {
					// Try HEAD first, then fallback to GET if HEAD fails
					let testResponse;
					const corsProxy = 'https://api.allorigins.win/raw?url=';
					const proxiedUrl = corsProxy + encodeURIComponent(feedUrl);
					
					try {
						testResponse = await fetch(proxiedUrl, { method: "HEAD" });
					} catch {
						// HEAD might be blocked, try GET with a small range
						testResponse = await fetch(proxiedUrl, { 
							headers: { 'Range': 'bytes=0-1023' } 
						});
					}
					
					if (testResponse.ok) {
						const contentType = testResponse.headers.get('content-type') || '';
						const feedType = contentType.includes('atom') ? 'application/atom+xml' : 'application/rss+xml';
						feeds.push({
							url: feedUrl,
							title: `${path.includes('atom') ? 'Atom' : 'RSS'} Feed (${path})`,
							type: feedType,
						});
					}
				} catch {
					// Ignore errors for common path tests
				}
			}
		}
	} catch (error) {
		console.error("Error discovering RSS feeds:", error);
		
		// Last resort: try common paths without HEAD check
		// This is useful when CORS blocks our discovery attempts
		if (feeds.length === 0) {
			const baseUrl = new URL(url);
			const fallbackPaths = ["/atom.xml", "/rss.xml", "/feed.xml"];
			
			for (const path of fallbackPaths) {
				const feedUrl = new URL(path, baseUrl).href;
				feeds.push({
					url: feedUrl,
					title: `${path.includes('atom') ? 'Atom' : 'RSS'} Feed (${path}) - Not Verified`,
					type: path.includes('atom') ? 'application/atom+xml' : 'application/rss+xml',
				});
			}
		}
	}

	return feeds;
}

// Parse RSS/Atom feed content
export async function parseRSSFeed(feedUrl: string): Promise<ParsedRSSFeed> {
	// Use CORS proxy for browser compatibility
	const corsProxy = 'https://api.allorigins.win/raw?url=';
	const proxiedUrl = corsProxy + encodeURIComponent(feedUrl);
	
	const response = await fetch(proxiedUrl);
	if (!response.ok) {
		throw new Error(`Failed to fetch RSS feed: ${response.status} ${response.statusText}`);
	}

	const feedXML = await response.text();
	const parser = new DOMParser();
	const doc = parser.parseFromString(feedXML, "application/xml");

	// Check for XML parsing errors
	const parserError = doc.querySelector("parsererror");
	if (parserError) {
		throw new Error("Invalid XML in RSS feed");
	}

	// Determine if it's RSS or Atom
	const isAtom = doc.documentElement.tagName === "feed";
	const isRSS =
		doc.documentElement.tagName === "rss" || doc.querySelector("rss");

	if (isAtom) {
		return parseAtomFeed(doc);
	} else if (isRSS) {
		return parseRSSFeed2(doc);
	} else {
		throw new Error("Unrecognized feed format");
	}
}

function parseRSSFeed2(doc: Document): ParsedRSSFeed {
	const channel = doc.querySelector("channel");
	if (!channel) {
		throw new Error("Invalid RSS feed: no channel element");
	}

	const title = channel.querySelector("title")?.textContent || "Untitled Feed";
	const description = channel.querySelector("description")?.textContent || "";
	const link = channel.querySelector("link")?.textContent || "";

	const items: RSSItem[] = [];
	const itemElements = channel.querySelectorAll("item");

	itemElements.forEach((item) => {
		const itemTitle = item.querySelector("title")?.textContent || "Untitled";
		const itemLink = item.querySelector("link")?.textContent || "";
		const itemDescription =
			item.querySelector("description")?.textContent || "";
		const itemContent =
			item.querySelector("content\\:encoded, content")?.textContent || "";
		const itemPubDate = item.querySelector("pubDate")?.textContent || "";
		const itemAuthor =
			item.querySelector("author, dc\\:creator")?.textContent || "";
		const itemGuid = item.querySelector("guid")?.textContent || "";

		items.push({
			title: itemTitle,
			link: itemLink,
			description: itemDescription,
			content: itemContent || itemDescription,
			pubDate: itemPubDate,
			author: itemAuthor,
			guid: itemGuid,
		});
	});

	return {
		title,
		description,
		link,
		items,
		feedType: "rss",
	};
}

function parseAtomFeed(doc: Document): ParsedRSSFeed {
	const feed = doc.documentElement;

	const title = feed.querySelector("title")?.textContent || "Untitled Feed";
	const description = feed.querySelector("subtitle")?.textContent || "";
	const linkElement =
		feed
			.querySelector('link[rel="alternate"], link:not([rel])')
			?.getAttribute("href") || "";

	const items: RSSItem[] = [];
	const entryElements = feed.querySelectorAll("entry");

	entryElements.forEach((entry) => {
		const entryTitle = entry.querySelector("title")?.textContent || "Untitled";
		const entryLink =
			entry
				.querySelector('link[rel="alternate"], link:not([rel])')
				?.getAttribute("href") || "";
		const entrySummary = entry.querySelector("summary")?.textContent || "";
		const entryContent = entry.querySelector("content")?.textContent || "";
		const entryUpdated =
			entry.querySelector("updated, published")?.textContent || "";
		const entryAuthor = entry.querySelector("author name")?.textContent || "";
		const entryId = entry.querySelector("id")?.textContent || "";

		items.push({
			title: entryTitle,
			link: entryLink,
			description: entrySummary,
			content: entryContent || entrySummary,
			pubDate: entryUpdated,
			author: entryAuthor,
			guid: entryId,
		});
	});

	return {
		title,
		description,
		link: linkElement,
		items,
		feedType: "atom",
	};
}

// Get the best content from an RSS item (prioritizes full content over description)
export function getBestContent(item: RSSItem): string {
	return item.content || item.description || "";
}

// Format RSS item as markdown
export function formatRSSItemAsMarkdown(item: RSSItem): string {
	let markdown = `# ${item.title}\n\n`;

	if (item.author) {
		markdown += `**Author:** ${item.author}\n\n`;
	}

	if (item.pubDate) {
		const date = new Date(item.pubDate);
		if (!Number.isNaN(date.getTime())) {
			markdown += `**Published:** ${date.toLocaleDateString()}\n\n`;
		}
	}

	if (item.link) {
		markdown += `**Link:** [${item.link}](${item.link})\n\n`;
	}

	const content = getBestContent(item);
	if (content) {
		// Simple HTML to markdown conversion for basic tags
		const cleanContent = content
			.replace(/<br\s*\/?>/gi, "\n")
			.replace(/<p>/gi, "\n")
			.replace(/<\/p>/gi, "\n")
			.replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
			.replace(/<b>(.*?)<\/b>/gi, "**$1**")
			.replace(/<em>(.*?)<\/em>/gi, "*$1*")
			.replace(/<i>(.*?)<\/i>/gi, "*$1*")
			.replace(/<a href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)")
			.replace(/<[^>]*>/g, "") // Remove remaining HTML tags
			.replace(/\n\s*\n/g, "\n\n") // Clean up extra newlines
			.trim();

		markdown += cleanContent;
	}

	return markdown;
}
