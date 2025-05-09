import { contentSourceUrl } from "@/lib/signals";
import { Icon } from "@/components/Icon";
import { queryClient } from "@/lib/queryClient";

export function ManualFetchButton() {
	return (
		<button
			className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-800/40 text-green-700 dark:text-green-300 rounded-md text-sm font-medium transition-colors"
			onClick={() => {
				if (contentSourceUrl.value) {
					queryClient.refetchQueries({ queryKey: ['posts', contentSourceUrl.value] });
				}
			}}
			aria-label="Search for Bluesky posts"
		>
			<Icon name="magnifying" className="h-4 w-4" />
			Search Posts
		</button>
	);
}
