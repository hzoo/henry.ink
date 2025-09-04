import { useSignal } from "@preact/signals";

export default function Bookmarklet() {
	const copied = useSignal(false);

	// The bookmarklet code (minified for production use)
	const bookmarkletCode = `javascript:(function(){var u=encodeURIComponent(window.location.href),t=encodeURIComponent(document.title),s=encodeURIComponent(window.getSelection().toString().trim()),p=window.open('https://henry.ink/tools/quick-mark?url='+u+'&title='+t+(s?'&text='+s:''),'henry-ink-quick-mark','width=450,height=600,resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no');p&&p.focus();})();`;

	const copyBookmarklet = async () => {
		try {
			await navigator.clipboard.writeText(bookmarkletCode);
			copied.value = true;
			setTimeout(() => (copied.value = false), 2000);
		} catch (error) {
			console.error("Failed to copy:", error);
		}
	};

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-900">
			{/* Header */}
			<div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
				<div className="max-w-4xl mx-auto px-4 py-6">
					<div className="flex items-center gap-4">
						<a
							href="/"
							className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
						>
							← henry.ink
						</a>
						<div>
							<h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
								Trail Bookmarklet
							</h1>
							<p className="text-gray-600 dark:text-gray-400 mt-1">
								Save any webpage to your trails with one click
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* Content */}
			<div className="max-w-4xl mx-auto px-4 py-8">
				<div className="space-y-8">
					{/* How it works */}
					<section>
						<h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
							How it works
						</h2>
						<div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
							<ol className="space-y-3 text-gray-700 dark:text-gray-300">
								<li className="flex gap-3">
									<span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-medium">
										1
									</span>
									<span>
										Drag the bookmarklet button below to your browser's bookmark
										bar
									</span>
								</li>
								<li className="flex gap-3">
									<span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-medium">
										2
									</span>
									<span>Visit any webpage you want to save to your trails</span>
								</li>
								<li className="flex gap-3">
									<span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-medium">
										3
									</span>
									<span>
										Click the bookmarklet to open the quick-save popup
									</span>
								</li>
								<li className="flex gap-3">
									<span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-medium">
										4
									</span>
									<span>
										Quick annotations are saved to your "Inbox" trail by
										default, or select a custom trail
									</span>
								</li>
								<li className="flex gap-3">
									<span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-medium">
										5
									</span>
									<span>Click "Save Mark" - done!</span>
								</li>
							</ol>
						</div>
					</section>

					{/* Bookmarklet */}
					<section>
						<h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
							Bookmarklet
						</h2>
						<div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
							<div className="text-center space-y-4">
								<p className="text-gray-600 dark:text-gray-400">
									Drag this button to your bookmark bar:
								</p>

								{/* Draggable bookmarklet */}
								<div className="flex justify-center">
									<a
										href={bookmarkletCode}
										className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors border-2 border-dashed border-transparent hover:border-blue-400 cursor-move"
										title="Drag to bookmark bar"
									>
										<span>📌</span>
										Add to Trail
									</a>
								</div>

								<p className="text-sm text-gray-500 dark:text-gray-400">
									Don't see your bookmark bar? Press{" "}
									<kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">
										Ctrl+Shift+B
									</kbd>{" "}
									(Windows) or{" "}
									<kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">
										Cmd+Shift+B
									</kbd>{" "}
									(Mac) to show it
								</p>
							</div>
						</div>
					</section>

					{/* Manual installation */}
					<section>
						<h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
							Manual Installation
						</h2>
						<div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
							<p className="text-gray-600 dark:text-gray-400 mb-4">
								If dragging doesn't work, you can manually create a bookmark:
							</p>

							<ol className="space-y-3 text-gray-700 dark:text-gray-300 text-sm mb-4">
								<li>
									1. Right-click your bookmark bar and select "Add bookmark"
								</li>
								<li>
									2. Set the name to: <strong>Add to Trail</strong>
								</li>
								<li>3. Copy the code below and paste it as the URL</li>
							</ol>

							<div className="relative">
								<pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded border text-xs overflow-x-auto">
									<code className="text-gray-800 dark:text-gray-200">
										{bookmarkletCode}
									</code>
								</pre>
								<button
									onClick={copyBookmarklet}
									className={`absolute top-2 right-2 px-3 py-1 text-xs rounded transition-colors ${
										copied.value
											? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
											: "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
									}`}
								>
									{copied.value ? "✓ Copied" : "Copy"}
								</button>
							</div>
						</div>
					</section>

					{/* Features */}
					<section>
						<h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
							Smart Features
						</h2>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
								<h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
									<span>🔗</span>
									Smart URL Detection
								</h3>
								<p className="text-sm text-gray-600 dark:text-gray-400">
									Automatically converts Bluesky post URLs to AT Protocol
									references
								</p>
							</div>

							<div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
								<h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
									<span>📝</span>
									Text Selection
								</h3>
								<p className="text-sm text-gray-600 dark:text-gray-400">
									Automatically includes selected text as your note
								</p>
							</div>

							<div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
								<h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
									<span>⚡</span>
									Last Trail Memory
								</h3>
								<p className="text-sm text-gray-600 dark:text-gray-400">
									Remembers your last used trail for quick saving
								</p>
							</div>

							<div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
								<h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
									<span>📥</span>
									Auto-Inbox
								</h3>
								<p className="text-sm text-gray-600 dark:text-gray-400">
									Creates an "Inbox" trail automatically for quick annotations -
									organize into custom trails later
								</p>
							</div>

							<div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
								<h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
									<span>🔐</span>
									Secure Authentication
								</h3>
								<p className="text-sm text-gray-600 dark:text-gray-400">
									Uses your existing henry.ink login - no separate
									authentication needed
								</p>
							</div>
						</div>
					</section>

					{/* Need help */}
					<section className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-6">
						<h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
							Need help?
						</h3>
						<p className="text-blue-700 dark:text-blue-300 text-sm">
							Make sure you're{" "}
							<a href="/trails" className="underline hover:no-underline">
								logged in to henry.ink
							</a>{" "}
							to start annotating. An "Inbox" trail will be created
							automatically for your quick annotations.{" "}
							<a href="/trails" className="underline hover:no-underline">
								Create custom trails
							</a>{" "}
							to organize your collections.
						</p>
					</section>
				</div>
			</div>
		</div>
	);
}
