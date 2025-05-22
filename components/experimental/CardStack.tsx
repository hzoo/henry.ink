import { useSignal } from "@preact/signals-react/runtime";
import { useComputed } from "@preact/signals";
import { useEffect, useRef } from "react";
import type { AppBskyFeedDefs } from "@atcute/bluesky";
import { PostText } from "@/components/post/PostText";
import { PostEmbed } from "@/components/post/PostEmbed";
import { Icon } from "@/components/Icon";
import type { DisplayableItem } from "@/components/post/FullPost";
import { getTimeAgo } from "@/lib/utils/time";
import { formatCount } from "@/lib/utils/count";
import type { ThreadNavigator } from "@/lib/threadNavigation";

/* helper for full timestamp in main card */
const formatFullDate = (iso: string) =>
	new Date(iso).toLocaleString(undefined, {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
		month: "short",
		day: "numeric",
		year: "numeric",
	});

interface CardStackProps {
	navigator: ThreadNavigator;
	displayItems: DisplayableItem[];
}

interface StackNode {
	uri: string;
	post: AppBskyFeedDefs.PostView;
	childUris: string[];
	descendantCount: number;
}

export function CardStack({ navigator, displayItems }: CardStackProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	
	// Build stack node with descendant count
	const buildStackNode = (uri: string): StackNode | null => {
		const post = navigator.getPost(uri);
		const node = navigator.getNode(uri);
		if (!post || !node) return null;

		// Calculate descendant count recursively
		const countDescendants = (nodeUri: string): number => {
			const n = navigator.getNode(nodeUri);
			if (!n) return 0;
			
			let count = n.childUris.length;
			for (const childUri of n.childUris) {
				count += countDescendants(childUri);
			}
			return count;
		};

		return {
			uri,
			post,
			childUris: node.childUris,
			descendantCount: countDescendants(uri),
		};
	};

	const root = useComputed<StackNode | null>(() => {
		return buildStackNode(navigator.rootUri);
	});

	const stack = useSignal<StackNode[]>([]);
	const focusIdx = useSignal(0); // highlighted preview-row
	const hasNav = useSignal(false); // show highlight only after kb-nav
	/** remembers the last selection for every card we've already seen */
	const memo = useRef<Map<string, number>>(new Map());

	/* ——————————————————————————————————————————————————————————————— helpers ——————————————————————————————————— */
	const clamp = (value: number, min: number, max: number) =>
		Math.max(min, Math.min(max, value));

	const getThumb = (post: AppBskyFeedDefs.PostView): string | null => {
		const e = post.embed as {
			$type?: string;
			images?: Array<{ thumb?: string }>;
			external?: { thumb?: string };
			media?: { images?: Array<{ thumb?: string }> };
		};
		if (!e) return null;
		switch (e.$type) {
			case "app.bsky.embed.images#view":
				return e.images?.[0]?.thumb ?? null;
			case "app.bsky.embed.external#view":
				return e.external?.thumb ?? null;
			case "app.bsky.embed.recordWithMedia#view":
				return e.media?.images?.[0]?.thumb ?? null;
			default:
				return null;
		}
	};

	// Initialize stack with root
	if (root.value && stack.value.length === 0) {
		stack.value = [root.value];
	}

	// Auto-navigate to cursor position when cursor changes
	useEffect(() => {
		const currentCursor = navigator.cursor.value;
		if (!currentCursor || !root.value) return;

		// Find path from root to cursor
		const getPathToCursor = (uri: string): string[] => {
			const node = navigator.getNode(uri);
			if (!node) return [];
			
			const path: string[] = [];
			let current = node;
			
			// Build path from cursor back to root
			while (current) {
				path.unshift(current.uri);
				current = current.parentUri ? navigator.getNode(current.parentUri) : null;
			}
			
			return path;
		};

		const pathToCursor = getPathToCursor(currentCursor);
		if (pathToCursor.length === 0) return;

		// Check if cursor is already visible in current stack
		const currentTopNode = stack.value[stack.value.length - 1];
		const isCursorVisible = currentTopNode?.uri === currentCursor || 
			currentTopNode?.childUris.includes(currentCursor);

		if (isCursorVisible) return;

		// Navigate stack to show cursor path
		const newStack: StackNode[] = [];
		
		// Build stack showing path to cursor (except the last item if it's a leaf)
		for (let i = 0; i < pathToCursor.length; i++) {
			const pathUri = pathToCursor[i];
			const stackNode = buildStackNode(pathUri);
			if (!stackNode) break;
			
			// Add this node to stack if it has children or if it's the cursor itself
			const isLastInPath = i === pathToCursor.length - 1;
			const hasChildren = stackNode.childUris.length > 0;
			
			if (hasChildren || isLastInPath) {
				newStack.push(stackNode);
				
				// If this node contains the cursor in its children, we can stop here
				if (stackNode.childUris.includes(currentCursor)) {
					break;
				}
			}
		}

		if (newStack.length > 0) {
			stack.value = newStack;
			
			// Set focus to the cursor if it's in the children of the top card
			const topCard = newStack[newStack.length - 1];
			const cursorIndex = topCard.childUris.indexOf(currentCursor);
			if (cursorIndex >= 0) {
				focusIdx.value = cursorIndex;
				memo.current.set(topCard.uri, cursorIndex);
			}
		}
	}, [navigator.cursor.value]);

	const openNode = (uri: string) => {
		const current = stack.value[stack.value.length - 1];
		memo.current.set(current.uri, focusIdx.value); // remember!

		const newNode = buildStackNode(uri);
		if (!newNode) return;

		stack.value = [...stack.value, newNode];
		focusIdx.value = memo.current.get(uri) ?? 0; // restore (or 0)
		hasNav.value = false; // clear highlight on click-open
		
		// Update navigator cursor to the opened node
		navigator.moveTo(uri);
	};

	const goBack = () => {
		if (stack.value.length > 1) {
			const exiting = stack.value[stack.value.length - 1];
			memo.current.set(exiting.uri, focusIdx.value); // remember!

			const newStack = stack.value.slice(0, -1);
			stack.value = newStack;

			const newTop = newStack[newStack.length - 1];
			focusIdx.value = memo.current.get(newTop.uri) ?? 0; // restore
			
			// Update navigator cursor to the new top
			navigator.moveTo(newTop.uri);
		}
	};

	/* ——————————————————————————————————————————————————————————— keyboard nav —————————————————————————————————— */
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		/* reset highlight on any click/tap inside the stack */
		const handleClick = () => (hasNav.value = false);
		el.addEventListener("click", handleClick);

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.ctrlKey) return;
			const current = stack.value[stack.value.length - 1];
			if (!current) return;

			switch (e.key) {
				/* ⇧ / k – previous row (no wrap) */
				case "ArrowUp":
				case "k": {
					e.preventDefault();
					if (current.childUris.length === 0) break;
					const idx = clamp(focusIdx.value - 1, 0, current.childUris.length - 1);
					focusIdx.value = idx;
					memo.current.set(current.uri, idx);
					hasNav.value = true;
					break;
				}
				/* ⇩ / j – next row (no wrap) */
				case "ArrowDown":
				case "j": {
					e.preventDefault();
					if (current.childUris.length === 0) break;
					const idx = clamp(focusIdx.value + 1, 0, current.childUris.length - 1);
					focusIdx.value = idx;
					memo.current.set(current.uri, idx);
					hasNav.value = true;
					break;
				}
				/* ⇨ / l / space – open focused child */
				case "ArrowRight":
				case "l":
				case " ": {
					e.preventDefault();
					if (current.childUris[focusIdx.value]) {
						openNode(current.childUris[focusIdx.value]);
					}
					hasNav.value = true;
					break;
				}
				/* ⇦ / h / esc – back */
				case "ArrowLeft":
				case "h":
				case "Escape":
					if (stack.value.length === 1 && document.activeElement === el) {
						e.preventDefault();
						el.blur();
						hasNav.value = false;
					} else {
						e.preventDefault();
						goBack();
					}
					break;
			}
		};

		const handleWindowKeyDown = (e: KeyboardEvent) => {
			if (!containerRef.current) return;
			if (
				document.activeElement !== containerRef.current &&
				[
					"ArrowUp",
					"ArrowDown",
					"ArrowLeft",
					"ArrowRight",
					"j",
					"k",
					"l",
					"h",
					" ",
				].includes(e.key) &&
				!e.ctrlKey
			) {
				containerRef.current.focus({ preventScroll: true });
				hasNav.value = true;
			}
		};

		el.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keydown", handleWindowKeyDown);
		/* focus as soon as the component mounts so keys work immediately */
		requestAnimationFrame(() => el.focus({ preventScroll: true }));
		return () => {
			el.removeEventListener("keydown", handleKeyDown);
			el.removeEventListener("click", handleClick);
			window.removeEventListener("keydown", handleWindowKeyDown);
		};
	}, []);

	/* ——————————————————————————————————————————— ensure row stays visible ————————————————————————————————— */
	const selectedRowRef = useRef<HTMLButtonElement | null>(null);
	useEffect(() => {
		selectedRowRef.current?.scrollIntoView({ block: "nearest" });
	}, [focusIdx.value]);

	return (
		<div
			ref={containerRef}
			// biome-ignore lint/a11y/noNoninteractiveTabindex: This div is intentionally focusable for keyboard navigation.
			tabIndex={0}
			className="relative h-[70vh] w-full max-w-md mx-auto focus:outline-none"
		>
			<div className="p-2 text-xs text-gray-500 flex gap-3">
				<div>
					<kbd className="px-1">↑/k</kbd> <kbd className="px-1">↓</kbd> select
				</div>
				<div>
					<kbd className="px-1">→/l/space</kbd> open
				</div>
				<div>
					<kbd className="px-1">←/h</kbd> or <kbd className="px-1">esc</kbd>{" "}
					back
				</div>
			</div>
			{stack.value.map((node, idx) => {
				const offset = (idx - stack.value.length + 1) * 16;
				const isTop = idx === stack.value.length - 1;
				
				// Get child posts for this node
				const childPosts = node.childUris.map(uri => ({
					uri,
					post: navigator.getPost(uri),
					stackNode: buildStackNode(uri),
				})).filter(item => item.post && item.stackNode);

				// Check if this card is showing the current navigator cursor
				const isCurrentCard = node.uri === navigator.cursor.value;

				return (
					<div
						key={node.uri}
						className="absolute inset-0 transition-transform"
						style={{ transform: `translateX(${offset}px)` }}
					>
						<div className={`border border-gray-200 dark:border-gray-700 rounded-md shadow-md h-full overflow-y-auto ${
							isCurrentCard 
								? "bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-700" 
								: "bg-white dark:bg-gray-800"
						}`}>
							<div className={`p-2 flex items-center justify-between sticky top-0 border-b border-gray-200 dark:border-gray-700 z-10 ${
								isCurrentCard 
									? "bg-blue-50 dark:bg-blue-950" 
									: "bg-white dark:bg-gray-800"
							}`}>
								<button
									onClick={goBack}
									disabled={stack.value.length === 1}
									className="p-1 disabled:opacity-30"
								>
									<Icon name="arrowUturnLeft" className="size-4" />
								</button>
								<div className="text-xs text-gray-500">
									{getTimeAgo(node.post.indexedAt)}
								</div>
							</div>
							<div className="p-3 space-y-2">
								<div className="flex items-center gap-2">
									{displayItems.includes("avatar") &&
										node.post.author.avatar && (
											<img
												src={node.post.author.avatar}
												className="w-8 h-8 rounded-full"
												alt={node.post.author.handle}
											/>
										)}
									<div className="flex flex-col">
										{displayItems.includes("displayName") && (
											<span className="font-medium text-sm">
												{node.post.author.displayName ||
													node.post.author.handle}
											</span>
										)}
										{displayItems.includes("handle") && (
											<span className="text-xs text-gray-500">
												@{node.post.author.handle}
											</span>
										)}
									</div>
								</div>
								<div className="prose prose-sm dark:prose-invert break-words">
									<PostText post={node.post} />
								</div>
								<PostEmbed post={node.post} />
								{/* —— post stats: reposts first, likes second —— */}
								<div className="flex gap-4 text-xs text-gray-600 mt-1">
									<div className="flex items-center gap-1">
										<Icon name="arrowPath" className="size-3.5" />
										{formatCount(node.post.repostCount ?? 0)}
									</div>
									<div className="flex items-center gap-1">
										<Icon name="heart" className="size-3.5" />
										{formatCount(node.post.likeCount ?? 0)}
									</div>
									<div className="flex items-center gap-1">
										<Icon name="comment" className="size-3.5" />
										{formatCount(node.post.replyCount ?? 0)}
									</div>
								</div>

								{/* full timestamp just above metrics */}
								<div className="text-xs text-gray-500 mt-3">
									{formatFullDate(node.post.indexedAt)}
								</div>
							</div>
							{childPosts.length > 0 && (
								<div className="border-t border-gray-200 dark:border-gray-700 p-2 space-y-1">
									{childPosts.map((child, cidx) => {
										// Check if this child is the current navigator cursor
										const isCurrentChild = child.uri === navigator.cursor.value;
										
										return (
											<button
												key={child.uri}
												onClick={() => openNode(child.uri)}
												ref={
													isTop && focusIdx.value === cidx
														? selectedRowRef
														: undefined
												}
												className={`group relative flex items-start gap-2 w-full text-left p-2 rounded ${
													isCurrentChild
														? "bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700"
														: isTop &&
														  focusIdx.value === cidx &&
														  hasNav.value /* ← highlight only after kb-nav */
															? "bg-blue-50 dark:bg-blue-950"
															: "hover:bg-gray-100 dark:hover:bg-gray-700"
												}`}
											>
												{/* Avatar replaces chevron */}
												{displayItems.includes("avatar") &&
													child.post!.author.avatar && (
														<img
															src={child.post!.author.avatar}
															alt={child.post!.author.handle}
															className="w-6 h-6 rounded-full flex-shrink-0"
														/>
													)}

												<div className="flex flex-col flex-1 min-w-0">
													{/* ───── header line: name  handle  •  time ───── */}
													<div className="flex items-center gap-1 text-xs min-w-0">
														{/* display-name (shrinks / ellipsis first) */}
														<span className="font-medium truncate min-w-0 max-w-[55%]">
															{displayItems.includes("displayName")
																? child.post!.author.displayName ||
																  child.post!.author.handle
																: child.post!.author.handle}
														</span>
														{/* handle (shrinks second) */}
														{displayItems.includes("handle") && (
															<span className="text-gray-500 truncate min-w-0 max-w-[35%]">
																@{child.post!.author.handle}
															</span>
														)}
														{/* bullet + relative time (never shrinks) */}
														<span className="text-gray-400 flex-shrink-0">•</span>
														<span className="text-gray-500 flex-shrink-0">
															{getTimeAgo(child.post!.indexedAt)}
														</span>
													</div>
													<span className="text-[11px] line-clamp-2">
														<PostText post={child.post!} />
													</span>
												</div>

												{/* thumbnail (image / link) */}
												{getThumb(child.post!) ? (
													<img
														src={getThumb(child.post!)!}
														className="w-8 h-8 rounded object-cover"
														alt=""
													/>
												) : child.post!.embed ? (
													<Icon name="link" className="size-4 text-gray-400" />
												) : null}

												{/* engagement counters: reposts → likes */}
												<div className="flex items-center gap-2 text-xs ml-auto">
													{/* reposts: hidden at 0 until hover */}
													<div
														className={`flex items-center gap-1 ${
															child.post!.repostCount === 0
																? "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
																: ""
														}`}
													>
														<Icon name="arrowPath" className="size-3.5" />
														{formatCount(child.post!.repostCount ?? 0)}
													</div>
													{/* likes: always visible, even at 0 */}
													<div className="flex items-center gap-1">
														<Icon name="heart" className="size-3.5" />
														{formatCount(child.post!.likeCount ?? 0)}
													</div>
												</div>

												{/* ↓ replies counter moved to bottom-right */}
												{child.stackNode!.descendantCount > 0 && (
													<span className="absolute bottom-1.5 right-2 text-[10px] text-gray-500">
														+{child.stackNode!.descendantCount}
													</span>
												)}
											</button>
										);
									})}
								</div>
							)}
						</div>
					</div>
				);
			})}
		</div>
	);
}
