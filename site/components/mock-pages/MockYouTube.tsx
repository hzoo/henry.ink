import { VNode } from "preact";
import { Icon } from "@/components/Icon"; // Assuming Icon for like, dislike, etc.

export function MockYouTube(): VNode {
	// Using Tailwind to mimic YouTube video page layout
	return (
		<div class="bg-white dark:bg-[#0f0f0f] h-full overflow-auto font-sans text-black dark:text-white text-sm">
			{/* Header (Very Simplified) */}
			<header class="p-2 px-4 flex justify-between items-center border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-[#0f0f0f] z-10">
				<div class="flex items-center space-x-4">
					{/* Menu Icon Placeholder */}
					<div class="w-6 h-6 text-gray-600 dark:text-gray-400">☰</div>
					{/* YouTube Logo Placeholder */}
					<div class="text-red-600 font-bold text-lg">YouTube</div>
				</div>
				<div class="flex items-center flex-grow max-w-xl mx-4">
					<input
						type="text"
						placeholder="Search"
						class="w-full px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-l-full bg-gray-100 dark:bg-gray-800 focus:outline-none focus:border-blue-500 dark:focus:border-blue-500"
					/>
					<button class="px-4 py-1 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-full bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600">
						{/* Search Icon Placeholder */}
						🔍
					</button>
				</div>
				<div class="flex items-center space-x-4">
					{/* Mic Icon Placeholder */}
					<div class="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
						🎤
					</div>
					{/* More Options Placeholder */}
					<div class="w-6 h-6 text-gray-600 dark:text-gray-400">⋮</div>
					{/* Sign in Button */}
					<button class="px-3 py-1 border border-blue-500 text-blue-500 rounded-full text-xs font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/30">
						Sign in
					</button>
				</div>
			</header>

			{/* Main Content Area (Video + Info + Comments - Simplified Layout) */}
			<div class="max-w-screen-lg mx-auto p-4 flex flex-col">
				{/* Video Player Placeholder */}
				<div class="aspect-video bg-black mb-3 relative">
					<div class="absolute inset-0 flex items-center justify-center text-gray-400 text-xl">
						Video Player Placeholder
					</div>
					{/* Fake Controls */}
					<div class="absolute bottom-0 left-0 right-0 h-10 bg-black/50 flex items-center px-2 text-white text-xs">
						<span>▶</span>
						<span class="mx-2">❚❚</span>
						<span>0:01 / 21:45</span>
						<span class="flex-grow"></span>
						<span>⚙️</span>
						<span class="ml-2">❐</span>
						<span class="ml-2">️↔️</span>
					</div>
				</div>

				{/* Video Title */}
				<h1 class="text-xl font-bold mb-2">
					Surface-Stable Fractal Dithering Explained
				</h1>

				{/* Channel Info & Actions */}
				<div class="flex justify-between items-center mb-3 flex-wrap gap-2">
					<div class="flex items-center space-x-3">
						{/* Channel Icon Placeholder */}
						<div class="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center font-bold text-white">
							R
						</div>
						<div>
							<div class="font-semibold">runevision</div>
							<div class="text-xs text-gray-600 dark:text-gray-400">
								19.9K subscribers
							</div>
						</div>
						<button class="ml-4 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-full text-xs font-semibold">
							Subscribe
						</button>
					</div>
					<div class="flex items-center space-x-2">
						{/* Like/Dislike */}
						<div class="flex items-center bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
							<button class="px-3 py-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center space-x-1">
								{/* Like Icon */}
								<span>👍</span> <span>29K</span>
							</button>
							<div class="border-l border-gray-300 dark:border-gray-600 h-5 self-center"></div>
							<button class="px-3 py-1.5 hover:bg-gray-200 dark:hover:bg-gray-700">
								{/* Dislike Icon */}
								<span>👎</span>
							</button>
						</div>
						{/* Share, Save, etc. (Simplified) */}
						<button class="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
							Share
						</button>
						<button class="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
							Save
						</button>
						<button class="px-2 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
							...
						</button>
					</div>
				</div>

				{/* Description Box */}
				<div class="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 mb-4 text-sm">
					<div class="font-semibold mb-1">
						406K views 3 months ago
					</div>
					<p class="leading-relaxed">
						I invented a new form of dithering I call Surface-Stable Fractal
						Dithering. I've released it as open source along with this
						explainer video of how it works.
						<button class="font-semibold ml-1">...more</button>
					</p>
				</div>

				{/* Comments Section */}
				<div class="mb-4 flex items-center space-x-4">
					<h2 class="text-lg font-semibold">1,386 Comments</h2>
					<button class="text-xs flex items-center space-x-1">
						<span>↕️</span>
						<span>Sort by</span>
					</button>
				</div>

				{/* Add Comment Input */}
				<div class="flex items-start space-x-3 mb-6">
					{/* User Icon Placeholder */}
					<div class="w-8 h-8 rounded-full bg-blue-300"></div>
					<input
						type="text"
						placeholder="Add a comment..."
						class="flex-grow border-b border-gray-300 dark:border-gray-600 bg-transparent focus:outline-none focus:border-black dark:focus:border-white pb-1"
					/>
				</div>

				{/* Pinned Comment Example */}
				<div class="flex items-start space-x-3 mb-4">
					{/* Channel Icon Placeholder */}
					<div class="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center font-bold text-white text-xs flex-shrink-0">
						R
					</div>
					<div class="text-xs">
						<div class="text-gray-500 dark:text-gray-400 mb-1">Pinned by @runevision</div>
						<div>
							<span class="font-semibold mr-1">@runevision</span>
							<span class="text-gray-600 dark:text-gray-400">3 months ago</span>
						</div>
						<p class="my-1 leading-normal">
							Please see this FAQ before asking questions and making suggestions.
							That would save me a lot of time. Thanks for all the interest
							everyone!
							<a
								href="#"
								class="text-blue-500 hover:underline block"
							>
								https://github.com/runevision/Dither3D/discussions/12
							</a>
						</p>
						<div class="flex items-center space-x-4 text-gray-600 dark:text-gray-400">
							<button class="flex items-center space-x-1 hover:text-black dark:hover:text-white">
								<span>👍</span> <span>121</span>
							</button>
							<button class="hover:text-black dark:hover:text-white">
								<span>👎</span>
							</button>
							<button class="font-semibold hover:text-black dark:hover:text-white">
								Reply
							</button>
						</div>
						<button class="mt-2 text-blue-500 font-semibold flex items-center space-x-1">
							<span>▼</span> <span>11 replies</span>
						</button>
					</div>
				</div>
				{/* Add more comments as needed */}
			</div>
		</div>
	);
} 