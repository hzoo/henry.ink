export function ManualFetchButton({ onSearch, disabled }: { onSearch: () => void; disabled?: boolean }) {
	return (
		<button
			className="flex min-h-10 items-center justify-center gap-1.5 px-3 py-1.5 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-800/40 text-green-700 dark:text-green-300 rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
			onClick={onSearch}
			disabled={disabled}
			aria-label="Search for Bluesky posts"
		>
			One-time search
		</button>
	);
}
