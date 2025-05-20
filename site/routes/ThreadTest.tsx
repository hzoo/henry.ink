import { useSignal } from "@preact/signals-react/runtime";
import { batch } from "@preact/signals";
import { FullPost } from "@/components/post/FullPost";
import type { DisplayableItem } from "@/components/post/FullPost";

export function ThreadTest() {
	const threadUri = useSignal(
		"https://bsky.app/profile/henryzoo.com/post/3lltzjrnjnc2b",
	);
	const isDropdownOpen = useSignal(false);
	const displayItems = useSignal<DisplayableItem[]>([
		"avatar",
		"displayName",
		"handle",
	]);

	const toggleDisplayItem = (item: DisplayableItem) => {
		batch(() => {
			const currentItems = displayItems.value;
			if (currentItems.includes(item)) {
				displayItems.value = currentItems.filter((i) => i !== item);
			} else {
				displayItems.value = [...currentItems, item];
			}
		});
	};

	return (
		<div className="p-4 max-w-xl mx-auto">
			<div className="mb-4">
				<label
					htmlFor="threadUri"
					className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
				>
					Enter Thread URI:
				</label>
				<input
					type="text"
					id="threadUri"
					value={threadUri.value}
					onInput={(e) => {
						threadUri.value = e.currentTarget.value;
					}}
					placeholder="e.g., at://did:plc:example/app.bsky.feed.post/abcdefghijk"
					className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
				/>
			</div>

			{/* Settings as a post */}
			<div className="border border-gray-200 dark:border-gray-700 rounded-md mb-4 overflow-hidden">
				<div
					className="bg-gray-50 dark:bg-gray-800 p-2 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center"
					onClick={() => (isDropdownOpen.value = !isDropdownOpen.value)}
				>
					<span className="font-medium">Display Settings</span>
				</div>
				{isDropdownOpen.value && (
					<div className="p-3">
						<div className="flex items-center pb-2">
							{/* Mock post with toggleable elements */}
							<div className="flex flex-col min-w-0 w-full">
								<div className="flex items-center gap-1.5">
									<div className="relative hover:bg-amber-200">
										<img
											src={
												displayItems.value.includes("avatar")
													? "https://cdn.bsky.app/img/avatar/plain/did:plc:3wng2qnttvtg23546ar6bawo/bafkreiep2suix67jfwu5uw23zxiyleesjkfdbynuitdbtowwwm3r2xsmha@jpeg"
													: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='42' height='42' viewBox='0 0 42 42' fill='none'%3E%3Crect width='42' height='42' rx='21' fill='%23E5E7EB'/%3E%3C/svg%3E"
											}
											alt="Avatar"
											className="w-[42px] h-[42px] rounded-full flex-shrink-0 cursor-pointer transition-opacity hover:opacity-70 "
											onClick={() => toggleDisplayItem("avatar")}
										/>
									</div>
									<div className="flex flex-col">
										<div className="flex items-center gap-1">
											<div
												className={`${displayItems.value.includes("displayName") ? "font-semibold text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-500"} cursor-pointer hover:opacity-70 hover:bg-amber-200 transition-opacity`}
												onClick={() => toggleDisplayItem("displayName")}
											>
												henry
											</div>
											<div
												className={`${displayItems.value.includes("handle") ? "text-gray-500 dark:text-gray-400" : "text-gray-300 dark:text-gray-600"} cursor-pointer hover:opacity-70 hover:bg-amber-200 transition-opacity`}
												onClick={() => toggleDisplayItem("handle")}
											>
												@henryzoo.com
											</div>
											<span className="text-gray-400">·</span>
											<span className="text-gray-500">10m</span>
										</div>
										<div className="text-gray-800 dark:text-gray-200 mt-1">
											Click each element to toggle visibility in the thread.
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				)}
			</div>
			{threadUri.value && (
				<FullPost uri={threadUri.value} displayItems={displayItems.value} />
			)}
		</div>
	);
}
