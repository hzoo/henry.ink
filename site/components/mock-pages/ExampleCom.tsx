import { VNode } from "preact";

export function MockExampleCom(): VNode {
	// Using Tailwind classes to mimic example.com
	return (
		// Simulate body styles
		<div class="bg-[#f0f0f2] p-8 font-sans h-full overflow-auto">
			{/* Simulate the main content div */}
			<div class="max-w-[600px] mx-auto my-20 p-8 bg-[#fdfdff] rounded-lg shadow-[2px_3px_7px_2px_rgba(0,0,0,0.02)] md:mx-auto md:w-auto">
				<h1 class="text-3xl font-bold leading-tight mb-4">Example Domain</h1>
				<p class="mb-4 leading-snug">
					This domain is for use in illustrative examples in documents. You may
					use this domain in literature without prior coordination or asking for
					permission.
				</p>
				<p class="leading-relaxed">
					<a
						href="https://www.iana.org/domains/example"
						class="text-[#38488f] no-underline hover:underline"
					>
						More information...
					</a>
				</p>
			</div>
		</div>
	);
} 