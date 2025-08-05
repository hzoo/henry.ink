import { useEffect, useRef } from "preact/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/src/components/Sidebar";
import { LoginButton } from "@/src/components/LoginButton";
import { currentUrl, quotedSelection } from "@/src/lib/messaging";
import { showQuotePopupOnSelection } from "@/src/lib/settings";
import { Icon } from "@/src/components/Icon";
import { version } from "../package.json";
import SelectionPopupManagerV2 from "@/entrypoints/popup.content/SelectionPopupManagerV2";
import { searchAndSaveArenaChannels, showArenaToast } from "@/src/lib/arena/arenaSearch";
import { arenaQueryKeys } from "@/src/lib/arena-api";
import { MarkdownSite } from "@/henry-ink/components/MarkdownSite";
import { QuickUrlButtons } from "@/demo/components/QuickUrlButtons";

export function App() {
	const mockContainerRef = useRef<HTMLDivElement>(null);
	const queryClient = useQueryClient();

	useEffect(() => {
		currentUrl.value = "https://overreacted.io/static-as-a-server";
	}, []);

	return (
		<div class="flex flex-col h-screen bg-gradient-to-br from-slate-50 to-stone-100 dark:from-slate-900 dark:to-gray-900 text-gray-900 dark:text-gray-100 font-sans">
			{/* Cozy/Lofi Header */}
			<header class="px-4 py-3 border-b border-slate-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm flex justify-between items-center">
				<div>
					<div class="flex items-center gap-2 group relative">
						<h1 class="text-xl font-medium text-gray-700 dark:text-gray-300 tracking-tight">
							Extension: Annotation Sidebar Demo
						</h1>
						<Icon name="cog" className="w-4 h-4 text-slate-950 cursor-help" />
						<span class="absolute top-full left-0 mt-1 w-max max-w-xs p-2 bg-gray-700 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-200 z-20">
							This demo renders a reader view of each site. The sidebar on the
							right shows real Bluesky posts related to the URL.
						</span>
					</div>
					<div class="flex items-center gap-3 mt-1">
						{/* Chrome Store Link */}
						<a
							href="https://chromewebstore.google.com/detail/bluesky-sidebar/lbbbgodnfjcndohnhdjkomcckekjpjni"
							target="_blank"
							rel="noopener noreferrer"
							title="Get on Chrome Web Store"
							className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
						>
							<Icon name="chrome" className="w-3.5 h-3.5" /> Chrome
						</a>
						{/* Firefox Add-ons Link */}
						<a
							href="https://addons.mozilla.org/en-US/firefox/addon/bluesky-sidebar/"
							target="_blank"
							rel="noopener noreferrer"
							title="Get on Firefox Add-ons"
							className="inline-flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 hover:underline hover:text-orange-800 dark:hover:text-orange-300 transition-colors"
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
							className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 hover:underline hover:text-gray-800 dark:hover:text-gray-300 transition-colors"
						>
							<Icon name="github" className="w-3.5 h-3.5" /> v{version}
						</a>
						<span class="text-xs text-gray-400 dark:text-gray-600">|</span>{" "}
						{/* Separator */}
						<a
							href="https://bsky.app/profile/henryzoo.com"
							target="_blank"
							rel="noopener noreferrer"
							className="text-xs text-gray-600 dark:text-gray-400 hover:underline hover:text-gray-800 dark:hover:text-gray-300 transition-colors"
						>
							by henryzoo.com
						</a>
						<span class="text-xs text-gray-400 dark:text-gray-600">|</span>{" "}
						{/* Separator */}
						<a
							href="/thread"
							className="text-xs text-yellow-600 dark:text-yellow-400 hover:underline hover:text-yellow-800 dark:hover:text-yellow-300 transition-colors"
						>
							Thread UI Experiments
						</a>
					</div>
				</div>
				<LoginButton />
			</header>
			<div class="flex flex-1 overflow-hidden">
				<div ref={mockContainerRef} class="flex flex-col flex-1 overflow-auto">
					{/* <MockBrowser /> */}
					<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12 flex-1 flex flex-col w-full">
						<MarkdownSite />
					</div>
				</div>

				{/* Sidebar */}
				<aside class="w-[600px] border-l border-slate-200 dark:border-gray-700 h-full flex flex-col bg-white dark:bg-gray-800/50 p-2">
					<div class="p-2 border-b border-slate-200 dark:border-gray-700 text-center">
						<div class="flex flex-wrap gap-2 items-center justify-center text-sm">
							<QuickUrlButtons />
						</div>
					</div>
					<Sidebar
						autoAllowDomain={
							import.meta.env.DEV ? "127.0.0.1" : "annotation-demo.henryzoo.com"
						}
					/>
					<SelectionPopupManagerV2
						canShowPopup={() => showQuotePopupOnSelection.peek()}
						actions={[
							{
								title: "Quote",
								shortcut: "q",
								onClick: () => {
									const selection = window.getSelection()?.toString();
									if (!selection) return;
									quotedSelection.value = selection;
								},
								icon: "💬"
							},
							{
								title: "Arena",
								shortcut: "a",
								onClick: async () => {
									const selection = window.getSelection()?.toString();
									if (!selection) return;
									const result = await searchAndSaveArenaChannels(selection);
									showArenaToast(result, selection);
									
									// Invalidate Arena matches query to show new channels immediately
									if (result.success && result.channelCount > 0) {
										queryClient.invalidateQueries({ 
											queryKey: arenaQueryKeys.matches(currentUrl.value || null) 
										});
									}
								},
								icon: "🔍"
							}
						]}
						targetContainerRef={mockContainerRef}
					/>
				</aside>
			</div>
		</div>
	);
}
