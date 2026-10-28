import { useSignal } from "@preact/signals";

export default function Bookmarklet() {
	const copied = useSignal(false);
	const bookmarkletCode = "javascript:location.href='https://henry.ink/'+location.href";

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
			<div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
				<div className="max-w-4xl mx-auto px-4 py-6">
					<a href="/" className="text-blue-600 dark:text-blue-400 hover:underline">
						henry.ink
					</a>
					<h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-4">
						Reader Bookmarklet
					</h1>
					<p className="text-gray-600 dark:text-gray-400 mt-1">
						Open the current page in henry.ink.
					</p>
				</div>
			</div>
			<div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
				<section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
					<p className="text-gray-600 dark:text-gray-400 mb-4">
						Drag this button to your bookmark bar, then click it on a page you want to read:
					</p>
					<a
						href={bookmarkletCode}
						className="inline-flex px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium cursor-move"
						title="Drag to bookmark bar"
					>
						Read in henry.ink
					</a>
				</section>
				<section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
					<h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
						Manual Installation
					</h2>
					<p className="text-gray-600 dark:text-gray-400 mb-4">
						If dragging doesn't work, create a bookmark named "Read in henry.ink" and use this code as its URL:
					</p>
					<pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded border text-xs overflow-x-auto">
						<code className="text-gray-800 dark:text-gray-200">{bookmarkletCode}</code>
					</pre>
					<button
						onClick={copyBookmarklet}
						className="mt-3 px-3 py-1 text-sm rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
					>
						{copied.value ? "Copied" : "Copy"}
					</button>
				</section>
			</div>
		</div>
	);
}
