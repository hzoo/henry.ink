import { VNode } from "preact";
import { Icon } from "@/components/Icon"; // Assuming Icon component exists for search, etc.

export function MockWikipedia(): VNode {
	// Using Tailwind to mimic Wikipedia's layout and style
	return (
		<div class="bg-gray-100 h-full overflow-auto font-sans text-black">
			{/* Main container mimicking overall structure */}
			<div class="max-w-screen-xl mx-auto bg-white border border-gray-300 shadow-sm min-h-full">
				{/* Header Section */}
				<header class="p-4 border-b border-gray-300 flex justify-between items-center">
					<div class="flex items-center space-x-4">
						{/* Placeholder for burger menu? */}
						<div class="text-gray-500">
							{/* Icon name='menu' className='h-6 w-6' /> */}
						</div>
						{/* Logo Placeholder */}
						<div class="flex items-center space-x-2">
							<div class="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center text-xs text-gray-600">
								Logo
							</div>
							<div>
								<div class="font-semibold text-lg">WIKIPEDIA</div>
								<div class="text-xs text-gray-600">
									The Free Encyclopedia
								</div>
							</div>
						</div>
					</div>
					<div class="flex items-center space-x-4">
						{/* Search Bar */}
						<div class="flex border border-gray-400 rounded overflow-hidden">
							<input
								type="text"
								placeholder="Search Wikipedia"
								class="px-2 py-1 focus:outline-none"
							/>
							<button class="px-3 bg-gray-100 hover:bg-gray-200">
								Search
								{/* <Icon name="search" className="h-5 w-5 text-gray-600" /> */}
							</button>
						</div>
						{/* Right Links */}
						<div class="text-sm space-x-3">
							<a href="#" class="text-blue-600 hover:underline">
								Donate
							</a>
							<a href="#" class="text-blue-600 hover:underline">
								Create account
							</a>
							<a href="#" class="text-blue-600 hover:underline">
								Log in
							</a>
							{/* Placeholder for tools menu */}
							<button class="text-gray-600">···</button>
						</div>
					</div>
				</header>

				{/* Content Area */}
				<div class="flex">
					{/* Main Content Body */}
					<main class="flex-1 p-6 font-serif">
						{/* Tabs */}
						<div class="flex border-b border-gray-300 mb-4">
							<button class="px-3 py-2 border-b-2 border-blue-600 text-sm font-sans">
								Main Page
							</button>
							<button class="px-3 py-2 text-blue-600 hover:bg-gray-100 text-sm font-sans">
								Talk
							</button>
							<div class="flex-grow"></div>
							{/* Read/View Source/History Tabs */}
							<div class="flex text-sm font-sans">
								<button class="px-3 py-2 border-b-2 border-blue-600">
									Read
								</button>
								<button class="px-3 py-2 text-blue-600 hover:bg-gray-100">
									View source
								</button>
								<button class="px-3 py-2 text-blue-600 hover:bg-gray-100">
									View history
								</button>
								<button class="px-3 py-2 text-blue-600 hover:bg-gray-100">
									Tools
								</button>
							</div>
						</div>

						{/* Welcome Message */}
						<div class="text-center mb-6">
							<h1 class="text-3xl mb-1 font-serif">Welcome to Wikipedia,</h1>
							<p class="text-sm font-sans">
								the free encyclopedia that anyone can edit.
							</p>
							<p class="text-xs text-gray-600 font-sans">
								117,298 active editors • 6,990,128 articles in English
							</p>
						</div>

						{/* Main Content Grid */}
						<div class="grid grid-cols-2 gap-6">
							{/* Left Column */}
							<div class="space-y-6">
								{/* Featured Article */}
								<div class="border border-gray-300 p-4 bg-gradient-to-b from-blue-50 to-white">
									<h2 class="text-lg font-semibold mb-2 font-sans border-b pb-1">
										From today's featured article
									</h2>
									{/* Placeholder image */}
									<div class="w-20 h-24 bg-gray-300 float-left mr-3 mb-1"></div>
									<p class="text-sm leading-relaxed">
										<b>Kingdom Hearts: Chain of Memories</b> is a 2004 action
										role-playing game... (placeholder text)
										<a href="#" class="text-blue-600 hover:underline font-sans">
											(Full article...)
										</a>
									</p>
									{/* Add more placeholder text if needed */}
									<div class="clear-both"></div>
								</div>
								{/* Did you know... */}
								<div class="border border-gray-300 p-4 bg-gradient-to-b from-green-50 to-white">
									<h2 class="text-lg font-semibold mb-2 font-sans border-b pb-1">
										Did you know ...
									</h2>
									<ul class="list-disc list-inside text-sm space-y-1">
										<li>... that novelist <b>Barbara Frischmuth</b> ...</li>
										<li>... that Playboi Carti's song titled "2024" ...</li>
										{/* Add more placeholder items */}
									</ul>
								</div>
							</div>

							{/* Right Column */}
							<div class="space-y-6">
								{/* In the news */}
								<div class="border border-gray-300 p-4 bg-gradient-to-b from-purple-50 to-white">
									<h2 class="text-lg font-semibold mb-2 font-sans border-b pb-1">
										In the news
									</h2>
									{/* Placeholder image */}
									<div class="w-24 h-16 bg-gray-300 float-right ml-3 mb-1"></div>
									<ul class="list-disc list-inside text-sm space-y-1">
										<li>In the <b>Singaporean general election</b>...</li>
										<li>The Australian Labor Party increases its majority...</li>
										{/* Add more placeholder items */}
									</ul>
									<div class="clear-both"></div>
								</div>
								{/* On this day */}
								<div class="border border-gray-300 p-4 bg-gradient-to-b from-yellow-50 to-white">
									<h2 class="text-lg font-semibold mb-2 font-sans border-b pb-1">
										On this day
									</h2>
									<ul class="list-disc list-inside text-sm space-y-1">
										<li>May 5: Lixia begins in China (2025); ...</li>
										<li>1646 – First English Civil War: ...</li>
										{/* Add more placeholder items */}
									</ul>
								</div>
							</div>
						</div>
					</main>

					{/* Right Sidebar (Appearance - Simplified) */}
					<aside class="w-48 border-l border-gray-300 p-4 text-sm font-sans hidden md:block">
						<div class="flex justify-between items-center mb-2">
							<h3 class="font-semibold">Appearance</h3>
							<button class="text-xs text-blue-600 hover:underline">
								hide
							</button>
						</div>
						{/* Text Size */}
						<div class="mb-3">
							<label class="block text-xs text-gray-600 mb-1">Text</label>
							<div class="space-y-1">
								<label class="flex items-center">
									<input type="radio" name="text-size" class="mr-1" /> Small
								</label>
								<label class="flex items-center">
									<input
										type="radio"
										name="text-size"
										class="mr-1"
										checked
									/>
									Standard
								</label>
								<label class="flex items-center">
									<input type="radio" name="text-size" class="mr-1" /> Large
								</label>
							</div>
						</div>
						{/* Width */}
						<div class="mb-3">
							<label class="block text-xs text-gray-600 mb-1">Width</label>
							<div class="space-y-1">
								<label class="flex items-center">
									<input
										type="radio"
										name="width"
										class="mr-1"
										checked
									/>
									Standard
								</label>
								<label class="flex items-center">
									<input type="radio" name="width" class="mr-1" /> Wide
								</label>
							</div>
						</div>
						{/* Color */}
						<div>
							<label class="block text-xs text-gray-600 mb-1">
								Color (beta)
							</label>
							<div class="space-y-1">
								<label class="flex items-center">
									<input type="radio" name="color" class="mr-1" /> Automatic
								</label>
								<label class="flex items-center">
									<input
										type="radio"
										name="color"
										class="mr-1"
										checked
									/>
									Light
								</label>
								<label class="flex items-center">
									<input type="radio" name="color" class="mr-1" /> Dark
								</label>
							</div>
						</div>
					</aside>
				</div>
			</div>
		</div>
	);
} 