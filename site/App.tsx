import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { Sidebar } from "@/components/Sidebar";
import { LoginButton } from "@/site/components/LoginButton";
import { initializeOAuth } from "@/site/lib/oauth";
import { currentUrl, extractBaseDomain } from "@/lib/messaging";
import { whitelistedDomains } from "@/lib/settings";
import { Icon } from "@/components/Icon";
import { version } from "../package.json";

// Initialize OAuth once when the module loads or app starts
initializeOAuth();

// Sample URLs for badges
const sampleUrls = [
	{ name: "example.com", url: "https://example.com" },
	{ name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Main_Page" },
    { name: "this website lol", url: "https://annotation-sidebar-demo.pages.dev" },
    { name: "this github", url: "https://github.com/hzoo/extension-annotation-sidebar" },
];

// Helper function to manage whitelist for the demo
const ensureDomainIsWhitelisted = (url: string) => {
	const domain = extractBaseDomain(url);
	if (domain && !whitelistedDomains.value.includes(domain)) {
		// Add the domain to the signal's array
		whitelistedDomains.value = [...whitelistedDomains.value, domain];
	}
};

const initialUrl = "https://example.com";

export function App() {
	const inputUrl = useSignal(initialUrl); // Input field state
	const iframeUrl = useSignal(initialUrl); // iframe src state

	// Initial setup: set currentUrl and ensure initial domain is whitelisted
	useEffect(() => {
		currentUrl.value = initialUrl;
		ensureDomainIsWhitelisted(initialUrl);
	}, []);

	// Refactored function to load a URL
	const loadUrl = (newUrlString: string) => {
		if (!newUrlString) return;
		try {
			const urlObj = new URL(newUrlString.includes('://') ? newUrlString : `https://${newUrlString}`);
			const finalUrl = urlObj.toString();

			inputUrl.value = finalUrl; // Keep input in sync
			iframeUrl.value = finalUrl; // Trigger iframe load
			
			// Update the global signal that Sidebar listens to
			currentUrl.value = finalUrl;
			// Ensure the new domain is treated as whitelisted for the demo
			ensureDomainIsWhitelisted(finalUrl);

		} catch (error) {
			console.error("Invalid URL:", error);
			alert("Please enter a valid URL (e.g., https://example.com)");
		}
	};

	// Initial setup
	currentUrl.value = initialUrl;
	ensureDomainIsWhitelisted(initialUrl);

	const handleSubmit = (e: Event) => {
		e.preventDefault();
		loadUrl(inputUrl.value);
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
						<span class="text-xs text-gray-400 dark:text-gray-600">|</span> { /* Separator */}
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
						<span class="text-xs text-gray-400 dark:text-gray-600">|</span> { /* Separator */}
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
				<div>
					<LoginButton />
				</div>
			</header>

			<div class="flex flex-1 overflow-hidden">
				<main class="flex-1 flex flex-col p-3 gap-3">
                <span class="text-xs text-gray-500 dark:text-gray-400 self-center italic">↓ Simulated Browser Window ↓</span>
                {/* Address Bar */}
					<form onSubmit={handleSubmit} class="flex">
						<input
							type="text"
							value={inputUrl}
							onInput={(e) => inputUrl.value = (e.target as HTMLInputElement).value}
							placeholder="Enter URL (e.g., https://neal.fun/)"
							class="flex-grow p-2 border border-r-0 rounded-l dark:bg-gray-800 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
						/>
						<button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-r hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500/80">
							Go
						</button>
					</form>

					{/* URL Badges */}
					<div class="flex flex-wrap gap-2 items-center text-sm">
						<span class="text-gray-600 dark:text-gray-400">Click these links!!!</span>
						{sampleUrls.map(({ name, url }) => (
							<button
								key={url}
								onClick={() => loadUrl(url)}
								title={`Load ${url}`}
								class="px-2 py-1 rounded-xl bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-blue-500/50 transition-colors duration-150"
							>
								{name}
							</button>
						))}
					</div>

					{/* Iframe container - simplified */}
                    <div class="flex-1 border rounded dark:border-gray-700 bg-gray-100 dark:bg-gray-800 overflow-hidden">
                        <iframe
                            src={iframeUrl}
                            title="Website Content"
                            class="w-full h-full border-0"
                            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                        />
                    </div>
				</main>
				<aside class="w-80 border-l border-slate-200 dark:border-gray-700 h-full flex flex-col bg-white dark:bg-gray-800/50">
					<div class="p-2 border-b border-slate-200 dark:border-gray-700 text-center">
						<span class="text-xs text-gray-500 dark:text-gray-400 italic">↓ Extension Sidebar (Actual Bluesky Posts) ↓</span>
					</div>
					<Sidebar />
				</aside>
			</div>
		</div>
	);
}