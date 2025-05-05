import { VNode } from "preact";
import { Icon } from "@/components/Icon"; // Assuming Icon component for repo icons, etc.

export function MockGitHub(): VNode {
	// Using Tailwind to mimic GitHub repo page layout
	return (
		<div class="bg-white dark:bg-gray-900 h-full overflow-auto font-sans text-gray-900 dark:text-gray-100 text-sm">
			{/* Header Section (Simplified) */}
			<header class="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
				<div class="flex justify-between items-center">
					<div class="flex items-center space-x-2 text-xl">
						{/* Repo Icon Placeholder */}
						<span class="text-gray-500">📚</span>
						<a href="#" class="text-blue-600 dark:text-blue-400 hover:underline">
							hzoo
						</a>
						<span class="text-gray-500">/</span>
						<a
							href="#"
							class="font-semibold text-gray-800 dark:text-gray-200 hover:underline"
						>
							extension-annotation-sidebar
						</a>
						<span class="text-xs font-medium border border-gray-300 dark:border-gray-600 rounded-full px-2 py-0.5 ml-2 text-gray-600 dark:text-gray-400">
							Public
						</span>
					</div>
					<div class="flex items-center space-x-2 text-xs">
						<button class="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-1">
							<span>🔔</span> <span>Notifications</span>
						</button>
						<button class="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-1">
							<span>🍴</span> <span>Fork</span> <span class="font-bold">1</span>
						</button>
						<button class="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-1">
							<span>⭐</span> <span>Star</span> <span class="font-bold">13</span>
						</button>
					</div>
				</div>
				{/* Tabs */}
				<div class="mt-4 flex border-b border-gray-200 dark:border-gray-700">
					<button class="px-4 py-2 border-b-2 border-orange-500 font-semibold flex items-center space-x-1">
						<span>💻</span> <span>Code</span>
					</button>
					<button class="px-4 py-2 hover:border-b-2 border-gray-400 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 flex items-center space-x-1">
						<span>❗</span> <span>Issues</span> <span class="font-bold">5</span>
					</button>
					<button class="px-4 py-2 hover:border-b-2 border-gray-400 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 flex items-center space-x-1">
						<span>⇄</span> <span>Pull requests</span> <span class="font-bold">1</span>
					</button>
					{/* Add other tabs: Actions, Security, Insights */}
				</div>
			</header>

			{/* Main Content Area */}
			<div class="max-w-screen-xl mx-auto p-4 flex flex-col md:flex-row gap-6">
				{/* Left Column (File Browser + README) */}
				<div class="flex-1">
					{/* File Browser Header */}
					<div class="border border-gray-200 dark:border-gray-700 rounded-t-md bg-gray-50 dark:bg-gray-800 px-4 py-2 flex justify-between items-center">
						<div class="flex items-center space-x-2">
							<button class="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-xs font-semibold">
								main ▼
							</button>
							<span class="text-xs text-gray-600 dark:text-gray-400">
								2 Branches
							</span>
							<span class="text-xs text-gray-600 dark:text-gray-400">
								7 Tags
							</span>
						</div>
						<div class="flex items-center space-x-2">
							<button class="px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
								Go to file
							</button>
							<button class="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-semibold">
								&lt;&gt; Code ▼
							</button>
						</div>
					</div>
					{/* Last Commit Info */}
					<div class="border-x border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700/50 px-4 py-2 flex justify-between items-center text-xs">
						<div class="flex items-center space-x-2">
							{/* Avatar Placeholder */}
							<div class="w-5 h-5 rounded-full bg-gray-400"></div>
							<span class="font-semibold">hzoo</span>
							<span class="text-gray-600 dark:text-gray-400">
								fix: slight indication of reply if not the root
							</span>
						</div>
						<div class="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
							<span class="font-mono">d4525ea</span>
							<span>last week</span>
							<span>·</span>
							<span>🕒 121 Commits</span>
						</div>
					</div>
					{/* File List */}
					<div class="border border-t-0 border-gray-200 dark:border-gray-700 rounded-b-md overflow-hidden">
						{/* Example File/Folder Rows */}
						<div class="flex items-center px-4 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800">
							<span class="w-4 mr-2 text-blue-500">📁</span>
							<span class="flex-1 text-gray-700 dark:text-gray-300">
								.cursor/rules
							</span>
							<span class="text-gray-500 dark:text-gray-400 text-xs mr-4">
								refactor: update popup component
							</span>
							<span class="text-gray-500 dark:text-gray-400 text-xs">
								last week
							</span>
						</div>
						<div class="flex items-center px-4 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800">
							<span class="w-4 mr-2 text-blue-500">📁</span>
							<span class="flex-1 text-gray-700 dark:text-gray-300">
								components
							</span>
							<span class="text-gray-500 dark:text-gray-400 text-xs mr-4">
								fix: slight indication of reply if not the root
							</span>
							<span class="text-gray-500 dark:text-gray-400 text-xs">
								last week
							</span>
						</div>
						{/* ... add more file/folder rows ... */}
						<div class="flex items-center px-4 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800">
							<span class="w-4 mr-2 text-gray-500">📄</span>
							<span class="flex-1 text-gray-700 dark:text-gray-300">
								README.md
							</span>
							<span class="text-gray-500 dark:text-gray-400 text-xs mr-4">
								spacing
							</span>
							<span class="text-gray-500 dark:text-gray-400 text-xs">
								last week
							</span>
						</div>
						<div class="flex items-center px-4 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800">
							<span class="w-4 mr-2 text-gray-500">📄</span>
							<span class="flex-1 text-gray-700 dark:text-gray-300">
								wxt.config.ts
							</span>
							<span class="text-gray-500 dark:text-gray-400 text-xs mr-4">
								refactor: update popup component
							</span>
							<span class="text-gray-500 dark:text-gray-400 text-xs">
								last week
							</span>
						</div>
					</div>

					{/* README Section */}
					<div class="mt-6 border border-gray-200 dark:border-gray-700 rounded-md">
						<div class="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
							<div class="font-semibold text-xs flex items-center space-x-1">
								<span>📝</span> <span>README.md</span>
							</div>
							<button class="text-gray-500 dark:text-gray-400">
								<svg
									class="w-4 h-4"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M4 6h16M4 12h16M4 18h7"
									></path>
								</svg>
							</button>
						</div>
						<article class="prose dark:prose-invert max-w-none p-4">
							<h1>extension-annotation-sidebar</h1>
							<p>
								Discover what people are saying about any webpage: a sidebar
								browser extension that shows you real-time discussions about
								the sites you visit (bsky atm).
							</p>
							{/* Add more README content as needed */}
						</article>
					</div>
				</div>

				{/* Right Sidebar */}
				<aside class="w-full md:w-72 flex-shrink-0 space-y-6">
					{/* About Section */}
					<div>
						<h2 class="text-base font-semibold mb-2">About</h2>
						<p class="text-sm text-gray-700 dark:text-gray-300 mb-3">
							*search by browsing*: a browser extension that shows linked
							posts of the current website (bluesky only atm)
						</p>
						<div class="text-sm mb-3">
							<a
								href="#"
								class="text-blue-600 dark:text-blue-400 hover:underline"
							>
								🔗 annotation-demo.henryzoo.com
							</a>
						</div>
						<div class="flex flex-wrap gap-2 mb-3">
							<span class="text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
								browser-extension
							</span>
							<span class="text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
								bluesky
							</span>
						</div>
						<ul class="text-sm space-y-1 text-gray-600 dark:text-gray-400">
							<li>📄 Readme</li>
							<li>📈 Activity</li>
							<li>⭐ 13 stars</li>
							<li>👁️ 1 watching</li>
							<li>🍴 1 fork</li>
						</ul>
					</div>

					{/* Releases Section */}
					<div>
						<h2 class="text-base font-semibold mb-2 flex justify-between items-center">
							Releases <span class="text-xs font-bold">7</span>
						</h2>
						<div class="text-sm space-y-1">
							<div class="flex items-center space-x-1">
								<span>🏷️</span>
								<a
									href="#"
									class="font-semibold text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
								>
									v0.0.7 post quotes
								</a>
								<span class="text-xs font-medium border border-green-400 dark:border-green-600 text-green-700 dark:text-green-300 rounded-full px-1.5 py-0.5">
									Latest
								</span>
							</div>
							<div class="text-xs text-gray-500 dark:text-gray-400 ml-4">
								last week
							</div>
						</div>
						<a
							href="#"
							class="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 block"
						>
							+ 6 releases
						</a>
					</div>

					{/* Packages Section */}
					<div>
						<h2 class="text-base font-semibold mb-2">Packages</h2>
						<p class="text-xs text-gray-600 dark:text-gray-400">
							No packages published
						</p>
					</div>

					{/* Languages Section */}
					<div>
						<h2 class="text-base font-semibold mb-2">Languages</h2>
						<div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2 flex overflow-hidden">
							<div
								class="bg-blue-500 h-2"
								style="width: 99.5%"
							></div>
							<div class="bg-gray-400 h-2" style="width: 0.5%"></div>
						</div>
						<div class="flex justify-between text-xs text-gray-600 dark:text-gray-400">
							<span>🔵 TypeScript 99.5%</span>
							<span>⚪ Other 0.5%</span>
						</div>
					</div>
				</aside>
			</div>
		</div>
	);
} 