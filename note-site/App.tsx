import { useEffect, useRef } from "preact/hooks";
import { Sidebar } from "@/src/components/Sidebar";
import { LoginButton } from "@/src/components/LoginButton";
import { currentUrl, quotedSelection } from "@/src/lib/messaging";
import { showQuotePopupOnSelection } from "@/src/lib/settings";
import SelectionPopupManager from "@/entrypoints/popup.content/SelectionPopupManager";
import { MarkdownSite } from "@/site/components/MarkdownSite";

export function App() {
	const mockContainerRef = useRef<HTMLDivElement>(null);

	return (
		<div class="flex flex-col h-screen bg-gradient-to-br from-amber-50 via-stone-50 to-yellow-50 dark:from-stone-900 dark:via-amber-950 dark:to-stone-900 text-stone-800 dark:text-amber-100">
			{/* Cozy/Lofi Header */}
			<header class="px-6 py-4 border-b border-amber-200/50 dark:border-amber-800/30 bg-amber-50/80 dark:bg-stone-900/80 backdrop-blur-sm flex justify-between items-center shadow-sm">
				<div>
					<div class="flex items-center gap-3 group relative">
						<h1 class="text-xl font-light text-amber-900 dark:text-amber-200 tracking-wide">
							Henry's Note
						</h1>
					</div>
				</div>
				<LoginButton />
			</header>
			{/* Desktop: Centered content + sidebar group */}
			<div class="flex flex-1 overflow-hidden justify-center">
				<div class="flex w-full max-w-[1400px] overflow-hidden">
					<div
						ref={mockContainerRef}
						class="flex flex-col flex-1 overflow-auto lg:max-w-[800px] bg-gradient-to-b from-amber-25/30 to-stone-50/30 dark:from-stone-900/50 dark:to-amber-950/30"
					>
						<div class="w-full px-8 py-12">
							<MarkdownSite />
						</div>
					</div>
					{/* Desktop Sidebar */}
					<aside class="hidden lg:flex w-[600px] border-l border-amber-200/40 dark:border-amber-800/20 h-full flex-col bg-stone-50/60 dark:bg-stone-900/60 backdrop-blur-sm p-4">
						<Sidebar hidePopup />
						<SelectionPopupManager
							canShowPopup={() => showQuotePopupOnSelection.peek()}
							popupTitle="Quote"
							sendSelection={() => {
								const selection = window.getSelection()?.toString();
								if (!selection) return;
								quotedSelection.value = selection;
							}}
							targetContainerRef={mockContainerRef}
						/>
					</aside>
				</div>

				{/* Mobile/Tablet Bottom Sheet or Overlay */}
				<div class="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-stone-50/95 dark:bg-stone-900/95 border-t border-amber-200/50 dark:border-amber-800/30 h-1/3 overflow-auto backdrop-blur-sm">
					<div class="p-6">
						<Sidebar hidePopup />
						<SelectionPopupManager
							canShowPopup={() => showQuotePopupOnSelection.peek()}
							popupTitle="Quote"
							sendSelection={() => {
								const selection = window.getSelection()?.toString();
								if (!selection) return;
								quotedSelection.value = selection;
							}}
							targetContainerRef={mockContainerRef}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
