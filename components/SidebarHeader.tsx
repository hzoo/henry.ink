import { SettingsToggle } from "@/components/SettingsToggle";
import { isDarkMode, toggleTheme } from "@/lib/settings";
import { mode } from "@/lib/signals";
import { autoFetchEnabled } from "@/lib/settings";
import { currentDomain, isWhitelisted } from "@/lib/messaging";

export function SidebarHeader() {
	return (
		<div class="sticky top-0 z-10 p-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-b border-gray-200 dark:border-gray-800">
			<div class="flex items-center justify-between gap-1">
				<div class="min-w-0 flex-1">
					<div class="flex flex-col items-start p-1">
						<button 
							class="text-base font-semibold text-gray-900 dark:text-gray-100 hover:text-gray-700 dark:hover:text-gray-300"
						>
							bsky posts
						</button>
						{autoFetchEnabled.value ? (
							isWhitelisted.value ? (
								<div class="flex items-center text-[10px] mt-0.5 gap-1">
									<span class="flex items-center gap-0.5 text-green-600 dark:text-green-400 whitespace-nowrap">
										<svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
											<path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8zm0 16v2A10 10 0 0 0 22 12h-2a8 8 0 0 1-8 8z"/>
										</svg>
										Auto
									</span>
									<span class="text-gray-600 dark:text-gray-400 truncate">
										{currentDomain.value}
									</span>
								</div>
							) : (
								<div class="flex items-center text-[10px] mt-0.5">
									<span class="text-gray-600 dark:text-gray-400">
										Not whitelisted
									</span>
								</div>
							)
						) : (
							<div class="flex items-center text-[10px] mt-0.5">
								<span class="text-gray-600 dark:text-gray-400">
									Manual mode
								</span>
							</div>
						)}
					</div>
				</div>
				<div class="flex items-center gap-1 flex-shrink-0">
					<button
						onClick={toggleTheme}
						class="p-1 rounded-full text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700"
						aria-label="Toggle theme"
					>
						{isDarkMode.value ? (
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
							</svg>
						) : (
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
							</svg>
						)}
					</button>
					<button
						onClick={() => mode.value = mode.value === 'full' ? 'compact' : 'full'}
						class="p-1 rounded-full text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700"
						aria-label="Toggle view mode"
					>
						{mode.value === 'full' ? (
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
							</svg>
						) : (
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5h16a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zm0 8h16a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4a1 1 0 011-1z" />
							</svg>
						)}
					</button>
					<SettingsToggle />
				</div>
			</div>
		</div>
	);
}
