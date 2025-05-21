import {
	useSignal,
	useComputed,
	useSignalEffect,
} from "@preact/signals-react/runtime";
import { useEffect, useRef } from "react";
import type { AppBskyFeedDefs } from "@atcute/bluesky";
import { useQuery } from "@tanstack/react-query";

import { PostText } from "@/components/post/PostText";
import { PostEmbed } from "@/components/post/PostEmbed";
import { Icon } from "@/components/Icon";
import { fetchProcessedThread } from "@/lib/threadUtils";
import type { ThreadReply } from "@/lib/types";
import type { DisplayableItem } from "@/components/post/FullPost";

import { getAtUriFromUrl, getAuthorUrl, getPost } from "@/lib/utils/postUrls";
import { getFormattedDate, getTimeAgo } from "@/lib/utils/time";
import { applyFilters, type PostFilter } from "@/lib/postFilters";

interface ContinuousPostProps {
	threadData: {
		post: AppBskyFeedDefs.PostView;
		replies: ThreadReply[];
	};
	displayItems: DisplayableItem[];
	filters?: PostFilter[];
}

// Interface for tree node structure
interface ThreadNode {
	post: AppBskyFeedDefs.PostView;
	depth: number;
	path: string; // Dot-separated path (e.g., "0.1.2")
	children: ThreadNode[];
	parent: ThreadNode | null;
}

const INITIAL_PATH = "n";

export function FSPost({
	threadData,
	displayItems,
	filters,
}: ContinuousPostProps) {
	// Current navigation cursor position (path)
	const activeCursor = useSignal<string>(INITIAL_PATH);
	// For keyboard focus management
	const threadContainerRef = useRef<HTMLDivElement>(null);
	// Show/hide metadata like timestamps
	const showMetadata = useSignal<boolean>(true);
	// Show navigation mini-map
	const showMiniMap = useSignal<boolean>(true);
	// Track history for back/forward navigation
	const navigationHistory = useSignal<string[]>(["0"]);
	const historyPosition = useSignal<number>(0);
	// Map to store refs for each post
	const postRefs = useRef<Map<string, HTMLDivElement>>(new Map());

	// Build a complete thread tree
	const threadTree = useComputed(() => {
		if (!threadData?.post) return null;

		// Create root node
		const root: ThreadNode = {
			post: threadData.post,
			depth: 0,
			path: INITIAL_PATH,
			children: [],
			parent: null,
		};

		// Map to quickly find nodes by path
		const nodeMap = new Map<string, ThreadNode>();
		nodeMap.set(INITIAL_PATH, root);

		// Recursively build the tree
		function buildTreeFromReplies(
			replies: ThreadReply[] | undefined,
			parentPath: string,
			parentNode: ThreadNode,
		) {
			if (!replies) return;

			replies.forEach((reply, index) => {
				const currentPath = `${parentPath}-${index}`;
				const node: ThreadNode = {
					post: reply.post,
					depth: parentPath.split("-").length,
					path: currentPath,
					children: [],
					parent: parentNode,
				};

				// Store in map and add to parent's children
				nodeMap.set(currentPath, node);
				parentNode.children.push(node);

				// Process this node's children
				buildTreeFromReplies(reply.replies, currentPath, node);
			});
		}

		// Build tree starting with root's children
		buildTreeFromReplies(threadData.replies, INITIAL_PATH, root);

		return { root, nodeMap };
	});

	// Get current active node based on cursor
	const activeNode = useComputed(() => {
		if (!threadTree.value?.nodeMap) return null;
		return threadTree.value.nodeMap.get(activeCursor.value) || null;
	});

	// Get path nodes from root to active node (include all ancestors)
	const threadPath = useComputed(() => {
		if (!activeNode.value || !threadTree.value?.nodeMap) return [];

		const pathNodes: ThreadNode[] = [];
		let currentNode: ThreadNode | null = activeNode.value;

		// Walk up the tree from active node to root
		while (currentNode) {
			pathNodes.unshift(currentNode); // Add to beginning to maintain order
			currentNode = currentNode.parent;
		}

		return pathNodes;
	});

	// Get related nodes (siblings and children)
	const relatedNodes = useComputed(() => {
		if (!activeNode.value) return { siblings: [], children: [] };

		const siblings =
			activeNode.value.parent?.children.filter(
				(node) => node.path !== activeNode.value?.path,
			) || [];

		return {
			siblings,
			children: activeNode.value.children,
		};
	});

	// Collect all leaf nodes for leaf navigation
	const leafNodes = useComputed(() => {
		if (!threadTree.value?.root) return [];

		const leaves: ThreadNode[] = [];

		function findLeaves(node: ThreadNode) {
			if (node.children.length === 0) {
				leaves.push(node);
			} else {
				node.children.forEach((child) => findLeaves(child));
			}
		}

		findLeaves(threadTree.value.root);
		return leaves;
	});

	// Find the next/previous leaf
	const adjacentLeaves = useComputed(() => {
		if (!activeNode.value || leafNodes.value.length === 0)
			return { prev: null, next: null };

		const currentLeafIndex = leafNodes.value.findIndex(
			(node) => node.path === activeNode.value?.path,
		);

		// If not on a leaf, find closest leaf
		if (currentLeafIndex === -1) {
			const nextLeafIndex = leafNodes.value.findIndex(
				(leaf) => leaf.path.localeCompare(activeNode.value?.path || "") > 0,
			);

			if (nextLeafIndex === -1) {
				return {
					prev: leafNodes.value[leafNodes.value.length - 1],
					next: null,
				};
			}

			return {
				prev: nextLeafIndex > 0 ? leafNodes.value[nextLeafIndex - 1] : null,
				next: leafNodes.value[nextLeafIndex],
			};
		}

		// On a leaf, get adjacent leaves
		return {
			prev: currentLeafIndex > 0 ? leafNodes.value[currentLeafIndex - 1] : null,
			next:
				currentLeafIndex < leafNodes.value.length - 1
					? leafNodes.value[currentLeafIndex + 1]
					: null,
		};
	});

	// Find next sibling even if we need to go up the tree
	const findNextSibling = (node: ThreadNode | null): ThreadNode | null => {
		if (!node || !node.parent) return null;

		const siblings = node.parent.children;
		const currentIndex = siblings.findIndex((n) => n.path === node.path);

		// If there's a next sibling at this level, return it
		if (currentIndex < siblings.length - 1) {
			return siblings[currentIndex + 1];
		}

		// Otherwise, go up to parent and find its next sibling
		return findNextSibling(node.parent);
	};

	// Find previous sibling even if we need to go up the tree
	const findPrevSibling = (node: ThreadNode | null): ThreadNode | null => {
		if (!node || !node.parent) return null;

		const siblings = node.parent.children;
		const currentIndex = siblings.findIndex((n) => n.path === node.path);

		// If there's a previous sibling at this level, return it
		if (currentIndex > 0) {
			return siblings[currentIndex - 1];
		}

		// Otherwise, go up to parent and find its previous sibling
		return findPrevSibling(node.parent);
	};

	// Handle cursor changes and update history
	const navigateTo = (path: string) => {
		if (path === activeCursor.value) return;

		// Add to history, removing any forward history
		const newHistory = [
			...navigationHistory.value.slice(0, historyPosition.value + 1),
			path,
		];

		navigationHistory.value = newHistory;
		historyPosition.value = newHistory.length - 1;
		activeCursor.value = path;
	};

	// History navigation
	const goBack = () => {
		if (historyPosition.value > 0) {
			historyPosition.value--;
			activeCursor.value = navigationHistory.value[historyPosition.value];
		}
	};

	const goForward = () => {
		if (historyPosition.value < navigationHistory.value.length - 1) {
			historyPosition.value++;
			activeCursor.value = navigationHistory.value[historyPosition.value];
		}
	};

	// Set up keyboard navigation
	useEffect(() => {
		if (!threadTree.value) return;

		const container = threadContainerRef.current;
		if (!container) return;

		// Focus container to capture key events
		container.focus();

		const handleKeyDown = (e: KeyboardEvent) => {
			if (!activeNode.value) return;

			// Prevent browser default actions on our navigation keys
			const shouldPreventDefault = () => {
				e.preventDefault();
				e.stopPropagation();
			};

			switch (e.key) {
				case "ArrowUp":
					// Navigate to parent
					if (activeNode.value.parent) {
						shouldPreventDefault();
						navigateTo(activeNode.value.parent.path);
					}
					break;

				case "ArrowDown":
					// Navigate to first child
					if (activeNode.value.children.length > 0) {
						shouldPreventDefault();
						navigateTo(activeNode.value.children[0].path);
					}
					break;

				case "ArrowLeft":
					if (e.shiftKey) {
						// Go back in history
						shouldPreventDefault();
						goBack();
					} else {
						// Navigate to previous sibling or ancestor's previous sibling
						shouldPreventDefault();
						const prevSibling = findPrevSibling(activeNode.value);
						if (prevSibling) {
							navigateTo(prevSibling.path);
						}
					}
					break;

				case "ArrowRight":
					if (e.shiftKey) {
						// Go forward in history
						shouldPreventDefault();
						goForward();
					} else {
						// Navigate to next sibling or ancestor's next sibling
						shouldPreventDefault();
						const nextSibling = findNextSibling(activeNode.value);
						if (nextSibling) {
							navigateTo(nextSibling.path);
						}
					}
					break;

				case "j": {
					// Next sibling or next node
					shouldPreventDefault();
					if (activeNode.value.children.length > 0) {
						// Go to first child if available
						navigateTo(activeNode.value.children[0].path);
					} else {
						// Otherwise try to go to next sibling
						const nextSibling = findNextSibling(activeNode.value);
						if (nextSibling) {
							navigateTo(nextSibling.path);
						}
					}
					break;
				}
				case "k": {
					// Previous sibling or parent
					shouldPreventDefault();
					const prevSibling = findPrevSibling(activeNode.value);
					if (prevSibling) {
						navigateTo(prevSibling.path);
					} else if (activeNode.value.parent) {
						navigateTo(activeNode.value.parent.path);
					}
					break;
				}
				case "n":
					// Next leaf
					if (adjacentLeaves.value.next) {
						shouldPreventDefault();
						navigateTo(adjacentLeaves.value.next.path);
					}
					break;

				case "p":
					// Previous leaf
					if (adjacentLeaves.value.prev) {
						shouldPreventDefault();
						navigateTo(adjacentLeaves.value.prev.path);
					}
					break;

				case "r":
					// Return to root
					shouldPreventDefault();
					navigateTo(INITIAL_PATH);
					break;

				case "m":
					// Toggle metadata
					shouldPreventDefault();
					showMetadata.value = !showMetadata.value;
					break;

				case "t":
					// Toggle minimap
					shouldPreventDefault();
					showMiniMap.value = !showMiniMap.value;
					break;
			}
		};

		container.addEventListener("keydown", handleKeyDown);
		return () => {
			container.removeEventListener("keydown", handleKeyDown);
		};
	}, []);

	// Scroll to active post when cursor changes
	useSignalEffect(() => {
		const path = activeCursor.value;

		// Re-focus the container
		if (threadContainerRef.current) {
			threadContainerRef.current.focus();

			// Use a small timeout to ensure the DOM has updated
			setTimeout(() => {
				const ref = postRefs.current.get(path);
				if (!ref) return;

				ref.scrollIntoView({
					behavior: "smooth",
					block: "nearest",
				});
			}, 50);
		}
	});

	// Render the keyboard shortcuts help
	const renderKeyboardHelp = () => (
		<div className="p-3 bg-gray-50 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-300 rounded-md mb-4">
			<div className="font-medium mb-1">Keyboard Navigation:</div>
			<div className="grid grid-cols-2 gap-x-4 gap-y-1">
				<div>
					<kbd>↑</kbd> Parent
				</div>
				<div>
					<kbd>↓</kbd> First child
				</div>
				<div>
					<kbd>←</kbd> Previous sibling or ancestor's sibling
				</div>
				<div>
					<kbd>→</kbd> Next sibling or ancestor's sibling
				</div>
				<div>
					<kbd>j</kbd> Next node (child or sibling)
				</div>
				<div>
					<kbd>k</kbd> Previous node (sibling or parent)
				</div>
				<div>
					<kbd>Shift+←</kbd> Back
				</div>
				<div>
					<kbd>Shift+→</kbd> Forward
				</div>
				<div>
					<kbd>n</kbd> Next leaf
				</div>
				<div>
					<kbd>p</kbd> Previous leaf
				</div>
				<div>
					<kbd>r</kbd> Root post
				</div>
				<div>
					<kbd>m</kbd> Toggle metadata
				</div>
				<div>
					<kbd>t</kbd> Toggle tree map
				</div>
			</div>
		</div>
	);

	return (
		<div className="flex flex-col">
			{renderKeyboardHelp()}

			<div className="flex gap-4">
				{/* Thread minimap (navigation tree) */}
				{showMiniMap.value && (
					<div className="w-52 shrink-0 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 overflow-auto h-[70vh]">
						<div className="p-2 font-medium text-xs border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
							Thread Map
						</div>
						<div className="p-2">
							{/* Render tree nodes recursively */}
							{renderTreeNode(threadTree.value.root, 0)}
						</div>
					</div>
				)}

				{/* Main thread content */}
				<div
					ref={threadContainerRef}
					className="flex-1 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 outline-none overflow-hidden focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-opacity-50 h-[70vh] overflow-y-auto"
					// Using tabIndex with a div is necessary here for keyboard navigation
					// eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
					tabIndex={0}
				>
					{/* Navigation toolbar */}
					<div className="bg-gray-50 dark:bg-gray-750 px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
						<div className="flex items-center gap-2">
							<button
								onClick={goBack}
								disabled={historyPosition.value === 0}
								className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30"
								title="Back (Shift+←)"
							>
								<Icon name="arrowUturnLeft" className="size-4 rotate-180" />
							</button>
							<button
								onClick={goForward}
								disabled={
									historyPosition.value >= navigationHistory.value.length - 1
								}
								className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30"
								title="Forward (Shift+→)"
							>
								<Icon name="arrowUturnLeft" className="size-4" />
							</button>
							<button
								onClick={() => navigateTo("0")}
								className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
								title="Root (r)"
							>
								<Icon name="magnifying" className="size-4" />
							</button>
						</div>

						<div className="flex items-center gap-2">
							<button
								onClick={() => (showMetadata.value = !showMetadata.value)}
								className={`p-1 rounded ${showMetadata.value ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "hover:bg-gray-200 dark:hover:bg-gray-700"}`}
								title="Toggle metadata (m)"
							>
								<Icon name="cog" className="size-4" />
							</button>
							<button
								onClick={() => (showMiniMap.value = !showMiniMap.value)}
								className={`p-1 rounded ${showMiniMap.value ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "hover:bg-gray-200 dark:hover:bg-gray-700"}`}
								title="Toggle tree map (t)"
							>
								<Icon name="rectangleStack" className="size-4" />
							</button>
						</div>
					</div>

					{/* Thread path - all posts from root to current cursor */}
					<div className="divide-y divide-gray-100 dark:divide-gray-700">
						{threadPath.value.map((node, index) => {
							const isActiveNode = node.path === activeCursor.value;

							return (
								<div
									key={node.path}
									id={node.path}
									className={`px-3 py-2 ${isActiveNode ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
									ref={(el) => {
										if (el) postRefs.current.set(node.path, el);
									}}
								>
									{/* Author info and metadata */}
									<div className="flex justify-between items-start mb-2">
										<div className="flex items-center gap-2">
											{displayItems.includes("avatar") &&
												node.post.author.avatar && (
													<img
														src={node.post.author.avatar}
														alt={
															node.post.author.displayName ||
															node.post.author.handle
														}
														className="w-6 h-6 rounded-full"
													/>
												)}
											<div className="flex gap-1 items-center">
												{displayItems.includes("displayName") && (
													<div className="font-medium text-sm">
														{node.post.author.displayName ||
															node.post.author.handle}
													</div>
												)}
												{displayItems.includes("handle") && (
													<div className="text-xs text-gray-500">
														@{node.post.author.handle}
													</div>
												)}
											</div>
										</div>

										{showMetadata.value && (
											<div className="text-xs text-gray-500 flex items-center gap-2">
												{getTimeAgo(node.post.indexedAt)}

												{/* Node path indicator */}
												<span
													className={`px-1.5 py-0.5 rounded ${isActiveNode ? "bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-300" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"}`}
												>
													{node.path.split("-").slice(1).join(".")}
												</span>
											</div>
										)}
									</div>

									{/* Post content */}
									<div className="prose prose-sm dark:prose-invert max-w-none mb-2">
										<PostText post={node.post} />
										<PostEmbed post={node.post} />
									</div>

									{/* Node navigation controls (only for active node) */}
									{isActiveNode && (
										<div className="flex flex-wrap gap-2 text-xs mt-3">
											{/* Parent link */}
											{node.parent && (
												<button
													onClick={() => navigateTo(node.parent!.path)}
													className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
												>
													<Icon
														name="arrowUturnLeft"
														className="size-3 rotate-90"
													/>
													<span>Parent</span>
												</button>
											)}

											{/* Children counter */}
											{node.children.length > 0 && (
												<button
													onClick={() => navigateTo(node.children[0].path)}
													className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
												>
													<Icon name="comment" className="size-3" />
													<span>Replies ({node.children.length})</span>
												</button>
											)}

											{/* Siblings counter */}
											{relatedNodes.value.siblings.length > 0 && (
												<div className="flex items-center gap-0.5">
													{relatedNodes.value.siblings
														.slice(0, 5)
														.map((sibling) => (
															<button
																key={sibling.path}
																onClick={() => navigateTo(sibling.path)}
																className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
																title={
																	sibling.post.author.displayName ||
																	sibling.post.author.handle
																}
															>
																{displayItems.includes("avatar") &&
																sibling.post.author.avatar ? (
																	<img
																		src={sibling.post.author.avatar}
																		alt=""
																		className="size-4 rounded-full"
																	/>
																) : (
																	<Icon
																		name="rectangleStack"
																		className="size-3"
																	/>
																)}
															</button>
														))}

													{relatedNodes.value.siblings.length > 5 && (
														<span className="text-xs text-gray-500 px-1">
															+{relatedNodes.value.siblings.length - 5} more
														</span>
													)}
												</div>
											)}

											{/* Leaf navigation */}
											<div className="flex ml-auto">
												{adjacentLeaves.value.prev && (
													<button
														onClick={() =>
															navigateTo(adjacentLeaves.value.prev!.path)
														}
														className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-l hover:bg-gray-200 dark:hover:bg-gray-600 border-r border-gray-200 dark:border-gray-600"
														title="Previous leaf (p)"
													>
														<Icon
															name="arrowUturnLeft"
															className="size-3 -rotate-90"
														/>
													</button>
												)}

												{adjacentLeaves.value.next && (
													<button
														onClick={() =>
															navigateTo(adjacentLeaves.value.next!.path)
														}
														className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-r hover:bg-gray-200 dark:hover:bg-gray-600"
														title="Next leaf (n)"
													>
														<Icon
															name="arrowUturnLeft"
															className="size-3 rotate-90"
														/>
													</button>
												)}
											</div>
										</div>
									)}
								</div>
							);
						})}

						{/* Add extra padding to ensure scrollability */}
						{threadPath.value.length > 0 && <div className="h-[70vh]" />}
					</div>
				</div>
			</div>
		</div>
	);

	// Recursive function to render the tree minimap
	function renderTreeNode(node: ThreadNode, level: number) {
		if (!node || applyFilters(node.post, filters)) return null;

		const isActive = node.path === activeCursor.value;
		const isInPath = threadPath.value.some((n) => n.path === node.path);

		return (
			<div key={node.path} className="mb-1">
				<div
					className={`flex items-center py-0.5 px-1 text-xs rounded cursor-pointer ${
						isActive
							? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
							: isInPath
								? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
								: "hover:bg-gray-100 dark:hover:bg-gray-700"
					}`}
					style={{ paddingLeft: `${level * 12 + 4}px` }}
					onClick={() => navigateTo(node.path)}
				>
					{node.children.length > 0 ? (
						<Icon name="comment" className="size-3 mr-1 flex-shrink-0" />
					) : (
						<span className="w-3 mr-1" />
					)}

					{displayItems.includes("avatar") && node.post.author.avatar && (
						<img
							src={node.post.author.avatar}
							alt=""
							className="size-4 rounded-full mr-1 flex-shrink-0"
						/>
					)}

					<span className="truncate">
						{displayItems.includes("displayName")
							? node.post.author.displayName || node.post.author.handle
							: node.post.author.handle}
					</span>
				</div>

				{/* Render children if this node is in the active path or is a sibling of an active path node */}
				{node.children.length > 0 &&
					(isInPath ||
						node.children.some((child) =>
							threadPath.value.some((n) => n.path === child.path),
						)) && (
						<div>
							{node.children.map((childNode) =>
								renderTreeNode(childNode, level + 1),
							)}
						</div>
					)}
			</div>
		);
	}
}
