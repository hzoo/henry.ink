import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { Sidebar } from "@/components/Sidebar";
import { LoginButton } from "@/components/LoginButton";
import {
	currentUrl,
	extractBaseDomain,
	quotedSelection,
} from "@/lib/messaging";
import { whitelistedDomains } from "@/lib/settings";
import { Icon } from "@/components/Icon";
import { version } from "../package.json";
import SelectionPopupManager from "@/entrypoints/popup.content/SelectionPopupManager";
import { SampleQuotes } from '@/components/SampleQuotes';

// Sample URLs for badges
const sampleUrls = [
	{
		name: "this website",
		category: "unblocked",
		url: "https://annotation-demo.henryzoo.com",
		blocksEmbedding: false,
	},
	{
		name: "example.com",
		category: "unblocked",
		url: "https://example.com",
		blocksEmbedding: false,
	},
	{
		name: "Wikipedia",
		category: "unblocked",
		url: "https://en.wikipedia.org/wiki/Main_Page",
		blocksEmbedding: false,
	},
	{
		name: "Blog",
		category: "blog",
		url: "https://overreacted.io/impossible-components/",
		blocksEmbedding: false,
	},
	{
		name: "ArXiv",
		title: "Attention is All You Need",
		category: "paper",
		url: "https://arxiv.org/abs/1706.03762",
		blocksEmbedding: true,
	},
	{
		name: "YouTube",
		title: "Surface-Stable Fractal Dithering Explained",
		category: "video",
		url: "https://www.youtube.com/watch?v=HPqGaIMVuLs",
		blocksEmbedding: true,
	},
	{
		name: "GitHub",
		title: "Extension Annotation Sidebar",
		category: "repo",
		url: "https://github.com/hzoo/extension-annotation-sidebar",
		blocksEmbedding: true,
	},
];

// Helper function to manage whitelist for the demo
const ensureDomainIsWhitelisted = (url: string) => {
	const domain = extractBaseDomain(url);
	if (domain && !whitelistedDomains.value.includes(domain)) {
		// Add the domain to the signal's array
		whitelistedDomains.value = [...whitelistedDomains.value, domain];
	}
};

const initialSample = sampleUrls[3];
const initialUrl = initialSample.url;

export function App() {
	const inputUrl = useSignal(initialUrl); // Input field state
	const iframeUrl = useSignal(initialUrl); // iframe src state - may not match input if blocked
	const showEmbeddingBlockMessage = useSignal(initialSample.blocksEmbedding); // New state signal

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		const sample = sampleUrls.find((s) => s.url === initialUrl);
		showEmbeddingBlockMessage.value = sample?.blocksEmbedding ?? false;
		currentUrl.value = initialUrl;
		ensureDomainIsWhitelisted(initialUrl);
	}, []);

	// Refactored function to load a URL
	const loadUrl = (newUrlString: string, blocksEmbedding = false) => {
		// Added blocksEmbedding param
		if (!newUrlString) return;
		try {
			const urlObj = new URL(
				newUrlString.includes("://") ? newUrlString : `https://${newUrlString}`,
			);
			const finalUrl = urlObj.toString();

			// Update state *before* changing URLs
			showEmbeddingBlockMessage.value = blocksEmbedding;

			inputUrl.value = finalUrl; // Keep input in sync

			// Only update iframe src if embedding is NOT blocked
			if (!blocksEmbedding) {
				iframeUrl.value = finalUrl; // Trigger iframe load
			} else {
				// Optionally clear iframe or set to blank if blocked?
				// iframeUrl.value = "about:blank"; // Or leave as is?
			}

			// Update the global signal for the sidebar regardless
			currentUrl.value = finalUrl;
			// Ensure the new domain is whitelisted for the demo regardless
			ensureDomainIsWhitelisted(finalUrl);
		} catch (error) {
			console.error("Invalid URL:", error);
			alert("Please enter a valid URL (e.g., https://example.com)");
		}
	};

	// handleSubmit for the form - assume not blocked
	const handleSubmit = (e: Event) => {
		e.preventDefault();
		loadUrl(inputUrl.value, false);
	};

	return (
		<div class="flex flex-col h-screen bg-gradient-to-br from-slate-50 to-stone-100 dark:from-slate-900 dark:to-gray-900 text-gray-900 dark:text-gray-100 font-sans">
			{/* Cozy/Lofi Header */}
			<header class="px-4 py-3 border-b border-slate-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm flex justify-between items-center">
				<div>
					<h1 class="text-xl font-medium text-gray-700 dark:text-gray-300 tracking-tight mb-1">
						Annotation Sidebar Demo
					</h1>
					<div class="flex items-center gap-3">
						{/* Chrome Store Link */}
						<a
							href="https://chromewebstore.google.com/detail/bluesky-sidebar/lbbbgodnfjcndohnhdjkomcckekjpjni"
							target="_blank"
							rel="noopener noreferrer"
							title="Get on Chrome Web Store"
							class="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
						>
							<Icon name="chrome" className="w-3.5 h-3.5" /> Chrome
						</a>
						{/* Firefox Add-ons Link */}
						<a
							href="https://addons.mozilla.org/en-US/firefox/addon/bluesky-sidebar/"
							target="_blank"
							rel="noopener noreferrer"
							title="Get on Firefox Add-ons"
							class="inline-flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 hover:underline hover:text-orange-700 dark:hover:text-orange-300 transition-colors"
						>
							<Icon name="firefox" className="w-3.5 h-3.5" /> Firefox
						</a>
						<span class="text-xs text-gray-400 dark:text-gray-600">|</span>{" "}
						{/* Separator */}
						{/* GitHub Link */}
						<a
							href="https://github.com/hzoo/extension-annotation-sidebar"
							target="_blank"
							rel="noopener noreferrer"
							title={`GitHub Repository (v${version})`}
							class="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 hover:underline hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
						>
							<Icon name="github" className="w-3.5 h-3.5" /> v{version}
						</a>
						<span class="text-xs text-gray-400 dark:text-gray-600">|</span>{" "}
						{/* Separator */}
						<a
							href="https://bsky.app/profile/henryzoo.com"
							target="_blank"
							rel="noopener noreferrer"
							class="text-xs text-gray-600 dark:text-gray-400 hover:underline hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
						>
							by henryzoo.com
						</a>
					</div>
				</div>
				<LoginButton />
			</header>
			<div class="flex flex-1 overflow-hidden">
				<main class="flex flex-1 flex-col p-3 gap-3">
					<span class="text-xs text-gray-500 dark:text-gray-400 self-center italic">
						↓ Simulated Browser Window ↓
					</span>
					{/* Address Bar */}
					<form onSubmit={handleSubmit} class="flex">
						<input
							type="text"
							value={inputUrl}
							onInput={(e) =>
								(inputUrl.value = (e.target as HTMLInputElement).value)
							}
							placeholder="Enter URL (e.g., https://neal.fun/)"
							class="flex-grow p-2 border border-r-0 rounded-l dark:bg-gray-800 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
						/>
						<button
							type="submit"
							class="px-4 py-2 bg-blue-600 text-white rounded-r hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500/80"
						>
							Go
						</button>
					</form>

					{/* URL Badges */}
					<div class="flex flex-wrap gap-2 items-center text-sm">
						<span class="text-gray-600 dark:text-gray-400">Try these:</span>
						{sampleUrls.map((sample) => (
							<button
								key={sample.url}
								onClick={() => loadUrl(sample.url, sample.blocksEmbedding)} // Pass flag
								title={`Load ${sample.url}${sample.blocksEmbedding ? " (Known to block embedding)" : ""}`}
								class={`px-2 py-1 rounded-xl transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-blue-500/50 ${sample.blocksEmbedding ? "bg-yellow-200 dark:bg-yellow-700 hover:bg-yellow-300 dark:hover:bg-yellow-600 text-yellow-800 dark:text-yellow-100" : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"}`}
							>
								{sample.name}
							</button>
						))}
					</div>

					{/* Content Area: Either Iframe or Blocking Message */}
					<div class="flex-1 border rounded dark:border-gray-700 bg-gray-100 dark:bg-gray-800 overflow-hidden relative">
						{showEmbeddingBlockMessage.value ? (
							(() => {
								// Find the current sample object to get the title
								const currentSample = sampleUrls.find(
									(s) => s.url === currentUrl.value,
								);
								const title = currentSample?.title || "This website"; // Fallback title
								const hostname = new URL(currentUrl.value).hostname;

								return (
									<div class="absolute inset-0 flex flex-col items-center justify-center bg-yellow-50 dark:bg-yellow-900/50 p-4 text-center">
										<p class="text-yellow-700 dark:text-yellow-300 font-semibold mb-2">
											Embedding Blocked
										</p>
										<p class="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
											Title: "{title}"
										</p>
										<p class="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
											URL:{" "}
											<code class="text-xs bg-yellow-100 dark:bg-yellow-800 px-1 py-0.5 rounded">
												{currentUrl.value}
											</code>
										</p>
										<p class="text-xs text-yellow-500 dark:text-yellow-500 mt-2">
											({hostname} likely prevents being displayed in iframes)
										</p>
										<p class="text-sm text-yellow-600 dark:text-yellow-400 mt-3">
											You can still view and add annotations using the sidebar
											on the right.
										</p>
									</div>
								);
							})()
						) : (
							// Render the iframe normally if not blocked
							<iframe
								key={iframeUrl.value} // Use iframeUrl here for re-render trigger
								src={iframeUrl.value}
								title="Website Content"
								class="w-full h-full border-0"
								sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
								// We might not need onLoad/onError if we trust the flag
								// onLoad={...}
								// onError={...}
							/>
							// Or potentially use the IframeLoader component again if needed
							// <IframeLoader url={iframeUrl} />
						)}
					</div>
					<SampleQuotes />
				</main>
				<aside class="w-[360px] border-l border-slate-200 dark:border-gray-700 h-full flex flex-col bg-white dark:bg-gray-800/50 p-2">
					<div class="p-2 border-b border-slate-200 dark:border-gray-700 text-center">
						<span class="text-xs text-gray-500 dark:text-gray-400 italic">
							↓ Extension Sidebar (Actual Bluesky Posts) ↓
						</span>
					</div>
					<Sidebar />
				</aside>
			</div>
			<SelectionPopupManager
				canShowPopup={() => Promise.resolve(true)}
				popupTitle="Quote"
				sendSelection={() => {
					const selection = window.getSelection()?.toString();
					if (!selection) return;
					quotedSelection.value = selection;
					currentUrl.value = window.location.href;
				}}
			/>
		</div>
	);
}
