import { useSignal } from "@preact/signals";
import { FunctionComponent, VNode } from "preact";
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
import { MockExampleCom } from "@/site/components/mock-pages/ExampleCom";
import { MockWikipedia } from "@/site/components/mock-pages/MockWikipedia";
import { MockArxiv } from "@/site/components/mock-pages/MockArxiv";
import { MockYouTube } from "@/site/components/mock-pages/MockYouTube";
import { MockGitHub } from "@/site/components/mock-pages/MockGitHub";

// Define the shape of our sample URLs
interface SampleUrl {
	name: string;
	category: string;
	url: string;
	blocksEmbedding: boolean;
	title?: string;
	mockComponent?: FunctionComponent;
}

// Sample URLs for badges
const sampleUrls: SampleUrl[] = [
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
		mockComponent: MockExampleCom,
	},
	{
		name: "Wikipedia",
		category: "unblocked",
		url: "https://en.wikipedia.org/wiki/Main_Page",
		blocksEmbedding: false,
		mockComponent: MockWikipedia,
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
		mockComponent: MockArxiv,
	},
	{
		name: "YouTube",
		title: "Surface-Stable Fractal Dithering Explained",
		category: "video",
		url: "https://www.youtube.com/watch?v=HPqGaIMVuLs",
		blocksEmbedding: true,
		mockComponent: MockYouTube,
	},
	{
		name: "GitHub",
		title: "Extension Annotation Sidebar",
		category: "repo",
		url: "https://github.com/hzoo/extension-annotation-sidebar",
		blocksEmbedding: true,
		mockComponent: MockGitHub,
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
	const inputUrl = useSignal(initialUrl);
	const iframeUrl = useSignal<string | null>(initialUrl);
	const showEmbeddingBlockMessage = useSignal(initialSample.blocksEmbedding);
	const CurrentMockComponent = useSignal<FunctionComponent | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		const sample = sampleUrls.find((s) => s.url === initialUrl);
		showEmbeddingBlockMessage.value = sample?.blocksEmbedding ?? false;
		iframeUrl.value = initialUrl;
		currentUrl.value = initialUrl;
		ensureDomainIsWhitelisted(initialUrl);

		if (sample) {
			if (sample.blocksEmbedding) {
				iframeUrl.value = null;
			}
			if (sample.mockComponent) {
				CurrentMockComponent.value = sample.mockComponent;
				iframeUrl.value = null;
			}
		}
	}, []);

	// Refactored function to load a URL
	const loadUrl = (
		newUrlString: string,
		blocksEmbedding = false,
		mockComponent: FunctionComponent | null = null,
	) => {
		if (!newUrlString) return;
		try {
			const urlObj = new URL(
				newUrlString.includes("://") ? newUrlString : `https://${newUrlString}`,
			);
			const finalUrl = urlObj.toString();

			// Update state *before* changing URLs
			showEmbeddingBlockMessage.value = blocksEmbedding;
			CurrentMockComponent.value = mockComponent;

			inputUrl.value = finalUrl;

			// Only update iframe src if NOT blocked AND no mock is active
			if (!blocksEmbedding && !mockComponent) {
				iframeUrl.value = finalUrl;
			} else {
				iframeUrl.value = null;
			}

			// Update the global signal for the sidebar regardless
			currentUrl.value = finalUrl;
			ensureDomainIsWhitelisted(finalUrl);
		} catch (error) {
			console.error("Invalid URL:", error);
			alert("Please enter a valid URL (e.g., https://example.com)");
		}
	};

	// handleSubmit for the form - assume not blocked, no mock
	const handleSubmit = (e: Event) => {
		e.preventDefault();
		const matchedSample = sampleUrls.find((s) => s.url === inputUrl.value);
		loadUrl(
			inputUrl.value,
			matchedSample?.blocksEmbedding ?? false,
			matchedSample?.mockComponent ?? null,
		);
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
						↓ Simulated (Mock) Browser Window ↓
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
								onClick={() =>
									loadUrl(
										sample.url,
										sample.blocksEmbedding,
										sample.mockComponent ?? null,
									)
								}
								title={`Load ${sample.url}${sample.blocksEmbedding ? " (Known to block embedding)" : ""}${sample.mockComponent ? " (Mocked View)" : ""}`}
								class={`px-2 py-1 rounded-xl transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-blue-500/50 ${sample.mockComponent ? "bg-purple-200 dark:bg-purple-700 hover:bg-purple-300 dark:hover:bg-purple-600 text-purple-800 dark:text-purple-100" : sample.blocksEmbedding ? "bg-yellow-200 dark:bg-yellow-700 hover:bg-yellow-300 dark:hover:bg-yellow-600 text-yellow-800 dark:text-yellow-100" : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"}`}
							>
								{sample.name}
							</button>
						))}
					</div>

					{/* Content Area: Mock Component, Iframe, or Blocking Message */}
					<div class="flex-1 border rounded dark:border-gray-700 bg-gray-100 dark:bg-gray-800 overflow-hidden relative">
						{CurrentMockComponent.value ? (
							// Render Mock Component if active
							<CurrentMockComponent.value />
						) : showEmbeddingBlockMessage.value ? (
							// Render Blocking Message if embedding is blocked
							(() => {
								const currentSample = sampleUrls.find(
									(s) => s.url === currentUrl.value,
								);
								const title = currentSample?.title || "This website";
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
						) : iframeUrl.value ? (
							// Render the iframe normally if not blocked and no mock active
							<iframe
								key={iframeUrl.value}
								src={iframeUrl.value}
								title="Website Content"
								class="w-full h-full border-0"
								sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
							/>
						) : (
							// Placeholder if nothing else is shown
							<div class="w-full h-full flex items-center justify-center text-gray-500">
								{/* Content blocked or not loaded */}
							</div>
						)}
					</div>
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
					// For inline content, we need to ensure currentUrl still reflects the *original* URL
					// currentUrl is already managed correctly in loadUrl, so this should be fine.
					// currentUrl.value = window.location.href; // This would be wrong for inline content
				}}
			/>
		</div>
	);
}
