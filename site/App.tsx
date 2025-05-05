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
import { MockBlog } from "@/site/components/mock-pages/MockBlog";
// Define the shape of our sample URLs
interface SampleUrl {
	name: string;
	category: string;
	url: string;
	title?: string;
	mockComponent?: FunctionComponent;
}

// Sample URLs for badges
const sampleUrls: SampleUrl[] = [
	{
		name: "example.com",
		category: "unblocked",
		url: "https://example.com",
		mockComponent: MockExampleCom,
	},
	{
		name: "Wikipedia",
		category: "unblocked",
		url: "https://en.wikipedia.org/wiki/Main_Page",
		mockComponent: MockWikipedia,
	},
	{
		name: "Blog",
		category: "blog",
		url: "https://overreacted.io/impossible-components/",
		mockComponent: MockBlog,
	},
	{
		name: "ArXiv",
		title: "Attention is All You Need",
		category: "paper",
		url: "https://arxiv.org/abs/1706.03762",
		mockComponent: MockArxiv,
	},
	{
		name: "YouTube",
		title: "Surface-Stable Fractal Dithering Explained",
		category: "video",
		url: "https://www.youtube.com/watch?v=HPqGaIMVuLs",
		mockComponent: MockYouTube,
	},
	{
		name: "GitHub",
		title: "Extension Annotation Sidebar",
		category: "repo",
		url: "https://github.com/hzoo/extension-annotation-sidebar",
		mockComponent: MockGitHub,
	},
];

// Helper function to manage whitelist for the demo
const ensureDomainIsWhitelisted = (url: string) => {
	const domain = extractBaseDomain(url);
	if (domain && !whitelistedDomains.value.includes(domain)) {
		whitelistedDomains.value = [...whitelistedDomains.value, domain];
	}
};

const initialSample = sampleUrls[3];
const initialUrl = initialSample.url;

export function App() {
	const inputUrl = useSignal(initialUrl);
	const CurrentMockComponent = useSignal<FunctionComponent | null>(
		initialSample.mockComponent ?? null,
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		currentUrl.value = initialUrl;
		ensureDomainIsWhitelisted(initialUrl);
	}, []);

	const loadUrl = (newUrlString: string, mockComponent: FunctionComponent | null) => {
		if (!newUrlString) return;
		try {
			const urlObj = new URL(
				newUrlString.includes("://") ? newUrlString : `https://${newUrlString}`,
			);
			const finalUrl = urlObj.toString();

			CurrentMockComponent.value = mockComponent;
			inputUrl.value = finalUrl;
			currentUrl.value = finalUrl;
			ensureDomainIsWhitelisted(finalUrl);
		} catch (error) {
			console.error("Invalid URL:", error);
			CurrentMockComponent.value = null;
			alert("Please enter a valid URL (e.g., https://example.com)");
		}
	};

	const handleSubmit = (e: Event) => {
		e.preventDefault();
		const matchedSample = sampleUrls.find((s) => s.url === inputUrl.value);
		loadUrl(inputUrl.value, matchedSample?.mockComponent ?? null);
	};

	return (
		<div class="flex flex-col h-screen bg-gradient-to-br from-slate-50 to-stone-100 dark:from-slate-900 dark:to-gray-900 text-gray-900 dark:text-gray-100 font-sans">
			{/* Cozy/Lofi Header */}
			<header class="px-4 py-3 border-b border-slate-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm flex justify-between items-center">
				<div>
					<div class="flex items-center gap-2 group relative">
						<h1 class="text-xl font-medium text-gray-700 dark:text-gray-300 tracking-tight">
							Annotation Sidebar Demo
						</h1>
						<Icon name="cog" className="w-4 h-4 text-slate-950 cursor-help" />
						<span class="absolute top-full left-0 mt-1 w-max max-w-xs p-2 bg-gray-700 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-200 z-20">
							This demo uses static mock views for websites. The sidebar on the right shows real Bluesky posts related to the current mock URL.
						</span>
					</div>
					<div class="flex items-center gap-3 mt-1">
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
							placeholder="Enter URL (e.g., https://example.com)"
							class="flex-grow p-2 border border-r-0 rounded-l dark:bg-gray-800 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
						/>
						<button
							type="submit"
							class="px-4 py-2 bg-blue-600 text-white rounded-r hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500/80"
						>
							Go
						</button>
					</form>

					{/* URL Badges - Simplified */}
					<div class="flex flex-wrap gap-2 items-center text-sm">
						<span class="text-gray-600 dark:text-gray-400">Try these (Mock Views):</span>
						{sampleUrls.map((sample) => (
							<button
								key={sample.url}
								onClick={() =>
									loadUrl(sample.url, sample.mockComponent ?? null)
								}
								title={`Load Mock View for ${sample.url}`}
								// Consistent styling for all mock buttons
								class={`px-2 py-1 rounded-xl transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-purple-500/50 bg-purple-200 dark:bg-purple-700 hover:bg-purple-300 dark:hover:bg-purple-600 text-purple-800 dark:text-purple-100`}
							>
								{sample.name}
							</button>
						))}
					</div>

					{/* Content Area: Only Mock Component or Placeholder */}
					<div class="flex-1 border border-dashed rounded dark:border-gray-700 bg-gray-100 dark:bg-gray-800 overflow-hidden relative">
						<span class="absolute top-1 right-2 text-xs text-gray-400 dark:text-gray-600 italic z-10 select-none">
							Mock View
						</span>
						{CurrentMockComponent.value ? (
							// Render Mock Component if active
							<CurrentMockComponent.value />
						) : (
							// Placeholder if no mock is active (e.g., invalid typed URL)
							<div class="w-full h-full flex items-center justify-center text-gray-500 p-4 text-center">
								URL entered does not match a mock sample. Try one of the buttons above.
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
