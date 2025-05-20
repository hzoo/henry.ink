import { useSignal } from "@preact/signals-react/runtime";
import { batch } from "@preact/signals";
import { FullPost } from "@/components/post/FullPost";
import { ContinuousPost } from "@/components/post/ContinuousPost";
import type { DisplayableItem } from "@/components/post/FullPost";
import { Icon } from "@/components/Icon"; // Import Icon component

export function ThreadTest() {
	const threadUri = useSignal(
		"https://bsky.app/profile/henryzoo.com/post/3lltzjrnjnc2b",
	);
	// Removed isDropdownOpen signal, using CSS hover instead
	const displayItems = useSignal<DisplayableItem[]>([
		"avatar",
		"displayName",
		"handle",
	]);
	const viewMode = useSignal<"nested" | "continuous">("nested");

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
		<div className="p-2 max-w-xl mx-auto space-y-2">
			<div>
				<label
					htmlFor="threadUri"
					className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5"
				>
					Enter Thread URI:
				</label>
				<div className="flex items-center gap-1 relative group">
					<input
						type="text"
						id="threadUri"
						value={threadUri.value}
						onInput={(e) => {
							threadUri.value = e.currentTarget.value;
						}}
						placeholder="e.g., at://did:plc:example/app.bsky.feed.post/abcdefghijk"
						className="flex-grow px-2 py-1 border border-gray-300 rounded-sm shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
					/>
					<div className="absolute inset-y-0 right-0 flex items-center pr-2">
						<div className="cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
							<Icon name="cog" className="size-4" />
						</div>
					</div>

					<div className="absolute top-full right-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-sm shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
						<div className="p-2">
							<div className="flex items-center pb-1">
								<div className="flex flex-col min-w-0 w-full">
									<div className="flex items-center gap-1">
										<div className="relative hover:bg-amber-200 dark:hover:bg-amber-700/50 rounded-full">
											<img
												src={
													displayItems.value.includes("avatar")
														? "https://cdn.bsky.app/img/avatar/plain/did:plc:3wng2qnttvtg23546ar6bawo/bafkreiep2suix67jfwu5uw23zxiyleesjkfdbynuitdbtowwwm3r2xsmha@jpeg"
														: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32' fill='none'%3E%3Crect width='32' height='32' rx='16' fill='%23E5E7EB'/%3E%3C/svg%3E"
												}
												alt="Avatar"
												className="w-8 h-8 rounded-full flex-shrink-0 cursor-pointer transition-opacity hover:opacity-70"
												onClick={() => toggleDisplayItem("avatar")}
											/>
										</div>
										<div className="flex flex-col">
											<div className="flex items-center gap-0.5">
												<div
													className={`${displayItems.value.includes("displayName") ? "font-semibold text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-500"} cursor-pointer hover:opacity-70 hover:bg-amber-200 dark:hover:bg-amber-700/50 transition-opacity text-xs rounded-sm px-0.5`}
													onClick={() => toggleDisplayItem("displayName")}
												>
													henry
												</div>
												<div
													className={`${displayItems.value.includes("handle") ? "text-gray-500 dark:text-gray-400" : "text-gray-300 dark:text-gray-600"} cursor-pointer hover:opacity-70 hover:bg-amber-200 dark:hover:bg-amber-700/50 transition-opacity text-xs rounded-sm px-0.5`}
													onClick={() => toggleDisplayItem("handle")}
												>
													@henryzoo.com
												</div>
												<span className="text-gray-400 text-xs">·</span>
												<span className="text-gray-500 text-xs">10m</span>
											</div>
											<div className="text-gray-800 dark:text-gray-200 mt-0.5 text-xs">
												Click each element to toggle visibility.
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div className="flex items-center gap-3">
				<span className="text-xs font-medium text-gray-700 dark:text-gray-300">View Mode:</span>
				<div className="flex border border-gray-300 dark:border-gray-600 rounded-sm overflow-hidden">
					<button
						onClick={() => viewMode.value = "nested"}
						className={`px-3 py-1 text-xs ${viewMode.value === "nested" ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" : "bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}
					>
						Nested
					</button>
					<button
						onClick={() => viewMode.value = "continuous"}
						className={`px-3 py-1 text-xs ${viewMode.value === "continuous" ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" : "bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}
					>
						Continuous
					</button>
				</div>
			</div>

			{threadUri.value && viewMode.value === "nested" && (
				<FullPost uri={threadUri.value} displayItems={displayItems.value} />
			)}

			{threadUri.value && viewMode.value === "continuous" && (
				<ContinuousPost uri={threadUri.value} displayItems={displayItems.value} />
			)}
		</div>
	);
}
