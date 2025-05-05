import { VNode } from "preact";

export function MockArxiv(): VNode {
	// Using Tailwind to mimic arXiv abstract page layout
	return (
		<div class="bg-gray-100 h-full overflow-auto font-sans text-black text-sm">
			{/* Header Section (Simplified) */}
			<header class="bg-[#a50000] text-white">
				<div class="max-w-screen-lg mx-auto p-2 flex justify-between items-center">
					{/* Cornell Logo Placeholder */}
					<div class="text-xs">Cornell University</div>
					<div class="text-xs text-center">
						We gratefully acknowledge support...
						<button class="ml-2 px-2 py-0.5 bg-red-700 hover:bg-red-800 rounded text-xs">
							Donate
						</button>
					</div>
				</div>
				<div class="max-w-screen-lg mx-auto p-2 flex justify-between items-center bg-white text-gray-700 border-t border-gray-300">
					{/* arXiv Logo & Breadcrumbs */}
					<div class="flex items-center">
						<div class="mr-4 font-bold text-xl text-[#a50000]">
							arXiv <span class="font-normal text-gray-500">&gt; cs &gt;</span>
							arXiv:1706.03762
						</div>
					</div>
					{/* Search Bar (Simplified) */}
					<div class="flex items-center text-xs">
						<input
							type="text"
							placeholder="Search..."
							class="border px-1 py-0.5 rounded-l focus:outline-none"
						/>
						<select class="border-t border-b px-1 py-0.5 focus:outline-none bg-gray-100">
							<option>All fields</option>
						</select>
						<button class="px-2 py-0.5 bg-gray-200 hover:bg-gray-300 rounded-r border border-gray-300">
							Search
						</button>
						<span class="ml-2">
							<a href="#" class="text-blue-600 hover:underline">
								Help
							</a>
							|
							<a href="#" class="text-blue-600 hover:underline">
								Advanced
							</a>
						</span>
					</div>
				</div>
			</header>

			{/* Main Content Area */}
			<div class="max-w-screen-lg mx-auto flex pt-4">
				{/* Left Column (Main Paper Info) */}
				<div class="flex-1 pr-6">
					<div class="mb-2">
						<h1 class="text-lg font-medium text-gray-700">
							Computer Science &gt; Computation and Language
						</h1>
					</div>

					<div class="bg-white p-4 border border-gray-300">
						<div class="text-xs text-gray-600 mb-2">
							[Submitted on 12 Jun 2017 (v1), last revised 2 Aug 2023 (this
							version, v7)]
						</div>
						<h1 class="text-xl font-bold text-[#a50000] mb-1">
							Attention Is All You Need
						</h1>
						<div class="mb-4 text-sm">
							<span class="font-semibold">Authors:</span>
							<a href="#" class="text-blue-600 hover:underline">
								Ashish Vaswani
							</a>
							, {/* Add other authors */}
							<a href="#" class="text-blue-600 hover:underline">
								Noam Shazeer
							</a>
							, {/* ... */}
							<a href="#" class="text-blue-600 hover:underline">
								Illia Polosukhin
							</a>
						</div>
						<blockquote class="border-l-4 border-gray-300 pl-4 italic text-sm mb-4 leading-relaxed">
							<span class="font-semibold not-italic block mb-1">
								Abstract:
							</span>
							The dominant sequence transduction models are based on complex
							recurrent or convolutional neural networks in an encoder-decoder
							configuration. The best performing models also connect the
							encoder and decoder through an attention mechanism. We propose a
							new simple network architecture, the Transformer, based solely on
							attention mechanisms, dispensing with recurrence and convolutions
							entirely... (placeholder text)
						</blockquote>
						<div class="text-sm space-y-1 mb-4">
							<div>
								<span class="font-semibold w-20 inline-block">Comments:</span>
								15 pages, 5 figures
							</div>
							<div>
								<span class="font-semibold w-20 inline-block">Subjects:</span>
								<span class="font-medium">Computation and Language (cs.CL)</span>;
								Machine Learning (cs.LG)
							</div>
							<div>
								<span class="font-semibold w-20 inline-block">Cite as:</span>
								<a href="#" class="text-blue-600 hover:underline">
									arXiv:1706.03762
								</a>
								[cs.CL]
							</div>
						</div>
						<div class="mb-4">
							<h2 class="text-base font-semibold mb-1">
								Submission history
							</h2>
							<p class="text-xs mb-2">
								From: Llion Jones [view email]
							</p>
							<ul class="text-xs space-y-0.5">
								<li>[v1] Mon, 12 Jun 2017 17:57:34 UTC (1,102 KB)</li>
								<li>[v2] Mon, 19 Jun 2017 16:49:45 UTC (1,125 KB)</li>
								<li>...</li>
								<li>[v7] Wed, 2 Aug 2023 00:41:18 UTC (1,124 KB)</li>
							</ul>
						</div>
					</div>

					{/* Tabs for Tools (Simplified) */}
					<div class="mt-4 border border-b-0 border-gray-300 bg-gray-50">
						<button class="px-4 py-2 border-b-2 border-blue-600 bg-white text-sm">
							Bibliographic Tools
						</button>
						<button class="px-4 py-2 text-blue-600 hover:bg-gray-100 text-sm">
							Code, Data, Media
						</button>
						{/* Add other tabs */}
					</div>
					<div class="border border-gray-300 p-4 bg-white">
						<h2 class="text-base font-semibold mb-2">
							Bibliographic and Citation Tools
						</h2>
						{/* Placeholder toggles */}
						<div class="flex items-center space-x-2 mb-1">
							<div class="w-10 h-5 bg-gray-300 rounded-full"></div>
							<span>Bibliographic Explorer</span>
						</div>
						<div class="flex items-center space-x-2 mb-1">
							<div class="w-10 h-5 bg-gray-300 rounded-full"></div>
							<span>Connected Papers</span>
						</div>
						{/* Add other toggles */}
					</div>
				</div>

				{/* Right Column (Access Links, Refs, etc.) */}
				<div class="w-64 flex-shrink-0">
					<div class="border border-gray-300 bg-white p-3 mb-4">
						<h2 class="text-base font-semibold mb-2">Access Paper:</h2>
						<ul class="space-y-1">
							<li>
								<a href="https://arxiv.org/pdf/1706.03762" class="text-blue-600 hover:underline font-medium">
									View PDF
								</a>
							</li>
							<li>
								<a href="#" class="text-blue-600 hover:underline">
									HTML (experimental)
								</a>
							</li>
							<li>
								<a href="#" class="text-blue-600 hover:underline">
									TeX Source
								</a>
							</li>
							<li>
								<a href="#" class="text-blue-600 hover:underline">
									Other Formats
								</a>
							</li>
						</ul>
						<div class="text-xs text-gray-500 mt-1">view license</div>
					</div>

					<div class="border border-gray-300 bg-white p-3 mb-4 text-xs">
						Current browse context: cs.CL
						<div class="mt-1">
							&lt; prev | next &gt;
						</div>
						{/* Add more context links */}
					</div>

					<div class="border border-gray-300 bg-white p-3 mb-4">
						<h3 class="text-base font-semibold mb-2">
							References & Citations
						</h3>
						<ul class="space-y-1 text-sm">
							<li>
								<a href="#" class="text-blue-600 hover:underline">
									NASA ADS
								</a>
							</li>
							<li>
								<a href="#" class="text-blue-600 hover:underline">
									Google Scholar
								</a>
							</li>
							<li>
								<a href="#" class="text-blue-600 hover:underline">
									Semantic Scholar
								</a>
							</li>
						</ul>
					</div>
					{/* Add DBLP, Bookmark sections if needed */}
				</div>
			</div>
		</div>
	);
} 