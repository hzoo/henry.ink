import {
	useSignal,
	useComputed,
	useSignalEffect,
} from "@preact/signals-react/runtime";
import { useEffect, useRef } from "react";

import { PostText } from "@/components/post/PostText";
import { PostEmbed } from "@/components/post/PostEmbed";
import { Icon } from "@/components/Icon";
import type { DisplayableItem } from "@/components/post/FullPost";

import { getTimeAgo } from "@/lib/utils/time";
import { applyFilters, type PostFilter } from "@/lib/postFilters";
import type { ThreadNavigator } from "@/lib/threadNavigation";
import type { AppBskyFeedDefs } from "@atcute/bluesky";

// Helper functions for leaf traversal
const findNextLeafInTraversal = (navigator: ThreadNavigator, startUri: string): string | null => {
	const startNode = navigator.getNode(startUri);
	if (!startNode) return null;

	// If current node has children, go to first child and find first leaf in that subtree
	if (startNode.childUris.length > 0) {
		const firstChild = startNode.childUris[0];
		const firstChildNode = navigator.getNode(firstChild);
		if (firstChildNode) {
			// If first child is a leaf, return it
			if (firstChildNode.childUris.length === 0) {
				return firstChild;
			}
			// Otherwise, recursively find first leaf in first child's subtree
			return findNextLeafInTraversal(navigator, firstChild);
		}
	}

	// No children, try to find next sibling
	let currentUri = startUri;
	let currentNode = startNode;

	while (currentNode) {
		if (currentNode.parentUri) {
			const parent = navigator.getNode(currentNode.parentUri);
			if (parent) {
				const currentIndex = parent.childUris.indexOf(currentUri);
				// Try next sibling
				if (currentIndex < parent.childUris.length - 1) {
					const nextSiblingUri = parent.childUris[currentIndex + 1];
					const nextSiblingNode = navigator.getNode(nextSiblingUri);
					if (nextSiblingNode) {
						// If next sibling is a leaf, return it
						if (nextSiblingNode.childUris.length === 0) {
							return nextSiblingUri;
						}
						// Otherwise, find first leaf in next sibling's subtree
						return findNextLeafInTraversal(navigator, nextSiblingUri);
					}
				}
				// No next sibling, go up to parent and continue
				currentUri = currentNode.parentUri;
				currentNode = parent;
			} else {
				break;
			}
		} else {
			// Reached root with no siblings, no next leaf
			break;
		}
	}

	return null;
};

const findPrevLeafInTraversal = (navigator: ThreadNavigator, startUri: string): string | null => {
	const startNode = navigator.getNode(startUri);
	if (!startNode) return null;

	// Try to find previous sibling
	if (startNode.parentUri) {
		const parent = navigator.getNode(startNode.parentUri);
		if (parent) {
			const currentIndex = parent.childUris.indexOf(startUri);
			if (currentIndex > 0) {
				// Go to previous sibling and find its last leaf
				const prevSiblingUri = parent.childUris[currentIndex - 1];
				return findLastLeafInSubtree(navigator, prevSiblingUri);
			} else {
				// No previous sibling, go to parent
				const parentNode = navigator.getNode(startNode.parentUri);
				if (parentNode && parentNode.childUris.length === 0) {
					// Parent is a leaf
					return startNode.parentUri;
				} else {
					// Parent has children, find previous leaf from parent
					return findPrevLeafInTraversal(navigator, startNode.parentUri);
				}
			}
		}
	}

	return null;
};

const findLastLeafInSubtree = (navigator: ThreadNavigator, uri: string): string => {
	const node = navigator.getNode(uri);
	if (!node || node.childUris.length === 0) {
		return uri; // This is a leaf
	}
	// Go to last child and find its last leaf
	const lastChildUri = node.childUris[node.childUris.length - 1];
	return findLastLeafInSubtree(navigator, lastChildUri);
};

interface FileViewProps {
	navigator: ThreadNavigator;
	displayItems: DisplayableItem[];
	filters?: PostFilter[];
}

export function FileView({ navigator, displayItems, filters }: FileViewProps) {
	const threadContainerRef = useRef<HTMLDivElement>(null);
	const showMetadata = useSignal<boolean>(true);
	const showMiniMap = useSignal<boolean>(true);
	const postRefs = useRef<Map<string, HTMLDivElement>>(new Map());

	// Build thread path from root to current node
	const threadPath = useComputed(() => {
		const currentNode = navigator.currentNode.value;
		if (!currentNode) return [];

		const pathUris: string[] = [];
		let current: typeof currentNode | null = currentNode;
		
		// Walk up to root
		while (current) {
			pathUris.unshift(current.uri);
			if (current.parentUri) {
				current = navigator.getNode(current.parentUri);
			} else {
				current = null;
			}
		}
		
		// Return posts for the path
		return pathUris.map(uri => navigator.getPost(uri)).filter(Boolean) as AppBskyFeedDefs.PostView[];
	});

	// Get all leaf nodes (nodes with no children) for leaf navigation
	const leafNodes = useComputed(() => {
		const leaves: string[] = [];
		
		// Get all URIs from chronological list and filter for leaf nodes
		for (const uri of navigator.chronologicalUris) {
			const node = navigator.getNode(uri);
			if (node && node.childUris.length === 0) {
				leaves.push(uri);
			}
		}
		
		return leaves;
	});



	// Find adjacent leaf nodes for navigation
	const adjacentLeaves = useComputed(() => {
		const currentUri = navigator.cursor.value;
		if (!currentUri) return { prev: null, next: null };
		
		const currentIndex = leafNodes.value.indexOf(currentUri);
		
		// If current node is not a leaf, find the closest leaves
		if (currentIndex === -1) {
			// Find next leaf chronologically
			let nextLeafUri: string | null = null;
			let prevLeafUri: string | null = null;
			
			const chronoIndex = navigator.chronologicalUris.indexOf(currentUri);
			
			// Look forward for next leaf
			for (let i = chronoIndex + 1; i < navigator.chronologicalUris.length; i++) {
				if (leafNodes.value.includes(navigator.chronologicalUris[i])) {
					nextLeafUri = navigator.chronologicalUris[i];
					break;
				}
			}
			
			// Look backward for previous leaf
			for (let i = chronoIndex - 1; i >= 0; i--) {
				if (leafNodes.value.includes(navigator.chronologicalUris[i])) {
					prevLeafUri = navigator.chronologicalUris[i];
					break;
				}
			}
			
			return { prev: prevLeafUri, next: nextLeafUri };
		}
		
		// Current node is a leaf, get adjacent leaves
		return {
			prev: currentIndex > 0 ? leafNodes.value[currentIndex - 1] : null,
			next: currentIndex < leafNodes.value.length - 1 ? leafNodes.value[currentIndex + 1] : null,
		};
	});

	const relatedNodes = useComputed(() => {
		const node = navigator.currentNode.value;
		if (!node) return { siblings: [], children: [] };

		// Get parent to find siblings
		const parent = node.parentUri ? navigator.getNode(node.parentUri) : null;
		const siblingUris = parent?.childUris.filter(uri => uri !== node.uri) || [];
		const siblings = siblingUris.map(uri => navigator.getPost(uri)).filter(Boolean) as AppBskyFeedDefs.PostView[];
		
		// Get children
		const childPosts = node.childUris.map(uri => navigator.getPost(uri)).filter(Boolean) as AppBskyFeedDefs.PostView[];

		return {
			siblings,
			children: childPosts,
		};
	});

	// Set up keyboard navigation
	useEffect(() => {
		const currentNode = navigator.currentNode.value;
		if (!currentNode) return;

		const container = threadContainerRef.current;
		if (!container) return;
		container.focus();

		const handleKeyDown = (e: KeyboardEvent) => {
			const activeNode = navigator.currentNode.value;
			if (!activeNode) return;

			const preventDefault = () => {
				e.preventDefault();
				e.stopPropagation();
			};

			let handled = true;
			switch (e.key) {
				case "ArrowUp":
					navigator.moveToParent();
					break;
				case "ArrowDown":
					if (activeNode.childUris.length > 0) {
						navigator.moveToFirstChild();
					} else {
						handled = false;
					}
					break;
				case "ArrowLeft":
					navigator.moveToPrevSibling();
					break;
				case "ArrowRight":
					navigator.moveToNextSibling();
					break;
				case "j": {
					// Move to next leaf in traversal order
					const nextLeaf = findNextLeafInTraversal(navigator, navigator.cursor.value);
					if (nextLeaf) {
						navigator.moveTo(nextLeaf);
					}
					break;
				}
				case "k": {
					// Move to previous leaf in traversal order
					const prevLeaf = findPrevLeafInTraversal(navigator, navigator.cursor.value);
					if (prevLeaf) {
						navigator.moveTo(prevLeaf);
					}
					break;
				}
				case "n":
					// Next leaf navigation
					if (adjacentLeaves.value.next) {
						navigator.moveTo(adjacentLeaves.value.next);
					}
					break;
				case "p":
					// Previous leaf navigation  
					if (adjacentLeaves.value.prev) {
						navigator.moveTo(adjacentLeaves.value.prev);
					}
					break;
				case "r":
					navigator.moveToRoot();
					break;
				case "m":
					showMetadata.value = !showMetadata.value;
					break;
				case "t":
					showMiniMap.value = !showMiniMap.value;
					break;
				default:
					handled = false;
					break;
			}
			if (handled) {
				preventDefault();
			}
		};

		container.addEventListener("keydown", handleKeyDown);
		return () => {
			container.removeEventListener("keydown", handleKeyDown);
		};
	}, [navigator, showMetadata, showMiniMap, adjacentLeaves]);

	// Scroll to active post when cursor changes
	useSignalEffect(() => {
		const uri = navigator.cursor.value;
		if (!uri) return;

		if (threadContainerRef.current) {
			threadContainerRef.current.focus({ preventScroll: true });
			setTimeout(() => {
				const ref = postRefs.current.get(uri);
				if (!ref) return;
				ref.scrollIntoView({ behavior: "smooth", block: "nearest" });
			}, 50);
		}
	});

	// Render the keyboard shortcuts help
	const renderKeyboardHelp = () => (
		<div className="p-3 bg-gray-50 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-300 rounded-md mb-4">
			<div className="font-medium mb-1">Keyboard Navigation:</div>
			<div className="grid grid-cols-2 gap-x-4 gap-y-1">
				<div>
					<kbd>↑</kbd> Parent node
				</div>
				<div>
					<kbd>↓</kbd> First child
				</div>
				<div>
					<kbd>←</kbd> Previous sibling
				</div>
				<div>
					<kbd>→</kbd> Next sibling
				</div>
				<div>
					<kbd>j</kbd> Next leaf (smart)
				</div>
				<div>
					<kbd>k</kbd> Previous leaf (smart)
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

	// Recursive function to render the tree minimap - show more nodes
	const renderTreeNode = (uri: string, level: number): React.ReactNode => {
		const post = navigator.getPost(uri);
		const node = navigator.getNode(uri);
		
		if (!post || !node || applyFilters(post, filters)) return null;

		const isActive = uri === navigator.cursor.value;
		const isInPath = threadPath.value.some(p => p.uri === uri);
		const isLeaf = node.childUris.length === 0;

		return (
			<div key={uri} className="mb-1">
				<div
					className={`flex items-center py-0.5 px-1 text-xs rounded cursor-pointer ${
						isActive
							? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
							: isInPath
								? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
								: "hover:bg-gray-100 dark:hover:bg-gray-700"
					}`}
					style={{ paddingLeft: `${level * 12 + 4}px` }}
					onClick={() => navigator.moveTo(uri)}
				>
					{isLeaf ? (
						<span className="w-3 mr-1 text-green-600 dark:text-green-400">•</span>
					) : (
						<Icon name="comment" className="size-3 mr-1 flex-shrink-0" />
					)}

					{displayItems.includes("avatar") && post.author.avatar && (
						<img
							src={post.author.avatar}
							alt={post.author.handle}
							className="size-4 rounded-full mr-1 flex-shrink-0"
						/>
					)}

					<span className="truncate">
						{displayItems.includes("displayName")
							? post.author.displayName || post.author.handle
							: post.author.handle}
					</span>
				</div>
				{/* Always render children if they exist - more permissive than before */}
				{node.childUris.length > 0 && (
					<div>
						{node.childUris.map(childUri =>
							renderTreeNode(childUri, level + 1)
						)}
					</div>
				)}
			</div>
		);
	};

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
							{/* Render tree starting from root */}
							{renderTreeNode(navigator.rootUri, 0)}
						</div>
					</div>
				)}

				{/* Main thread content */}
				<div
					ref={threadContainerRef}
					className="flex-1 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 outline-none overflow-hidden focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-opacity-50 h-[70vh] overflow-y-auto"
					// biome-ignore lint/a11y/noNoninteractiveTabindex: This div is intentionally focusable for keyboard navigation.
					tabIndex={0}
				>
					{/* Navigation toolbar */}
					<div className="bg-gray-50 dark:bg-gray-750 px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
						<div className="flex items-center gap-2">
							<button
								onClick={() => navigator.moveToRoot()}
								className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
								title="Root (r)"
							>
								<Icon name="magnifying" className="size-4" />
							</button>
							<div className="text-xs text-gray-500">
								{navigator.getCurrentPosition().index + 1} / {navigator.getCurrentPosition().total}
							</div>
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
						{threadPath.value.map((post) => {
							const isActiveNode = post.uri === navigator.cursor.value;
							const node = navigator.getNode(post.uri);
							const isLeaf = node && node.childUris.length === 0;

							return (
								<div
									key={post.uri}
									id={post.uri}
									className={`px-3 py-2 ${isActiveNode ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
									ref={(el) => {
										if (el) postRefs.current.set(post.uri, el);
									}}
								>
									{/* Author info and metadata */}
									<div className="flex justify-between items-start mb-2">
										<div className="flex items-center gap-2">
											{displayItems.includes("avatar") && post.author.avatar && (
												<img
													src={post.author.avatar}
													alt={post.author.displayName || post.author.handle}
													className="w-6 h-6 rounded-full"
												/>
											)}
											<div className="flex gap-1 items-center">
												{displayItems.includes("displayName") && (
													<div className="font-medium text-sm">
														{post.author.displayName || post.author.handle}
													</div>
												)}
												{displayItems.includes("handle") && (
													<div className="text-xs text-gray-500">
														@{post.author.handle}
													</div>
												)}
											</div>
										</div>

										{showMetadata.value && (
											<div className="text-xs text-gray-500 flex items-center gap-2">
												{getTimeAgo(post.indexedAt)}
												<span
													className={`px-1.5 py-0.5 rounded ${isActiveNode ? "bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-300" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"}`}
												>
													D:{node?.depth || 0}
												</span>
												{isLeaf && (
													<span className="text-green-600 dark:text-green-400 font-bold">
														LEAF
													</span>
												)}
											</div>
										)}
									</div>

									{/* Post content */}
									<div className="prose prose-sm dark:prose-invert max-w-none mb-2">
										<PostText post={post} />
										<PostEmbed post={post} />
									</div>

									{/* Node navigation controls (only for active node) */}
									{isActiveNode && node && (
										<div className="flex flex-wrap gap-2 text-xs mt-3">
											{/* Parent link */}
											{node.parentUri && (
												<button
													onClick={() => navigator.moveTo(node.parentUri!)}
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
											{node.childUris.length > 0 && (
												<button
													onClick={() => navigator.moveTo(node.childUris[0])}
													className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
												>
													<Icon name="comment" className="size-3" />
													<span>Replies ({node.childUris.length})</span>
												</button>
											)}

											{/* Siblings counter */}
											{relatedNodes.value.siblings.length > 0 && (
												<div className="flex items-center gap-0.5">
													{relatedNodes.value.siblings.slice(0, 5).map((sibling) => (
														<button
															key={sibling.uri}
															onClick={() => navigator.moveTo(sibling.uri)}
															className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
															title={sibling.author.displayName || sibling.author.handle}
														>
															{displayItems.includes("avatar") && sibling.author.avatar ? (
																<img
																	src={sibling.author.avatar}
																	alt=""
																	className="size-4 rounded-full"
																/>
															) : (
																<Icon name="rectangleStack" className="size-3" />
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
														onClick={() => navigator.moveTo(adjacentLeaves.value.prev!)}
														className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900 rounded-l hover:bg-green-200 dark:hover:bg-green-800 border-r border-green-200 dark:border-green-700"
														title="Previous leaf (p)"
													>
														<Icon
															name="arrowUturnLeft"
															className="size-3 -rotate-90"
														/>
														<span className="text-xs">Leaf</span>
													</button>
												)}

												{adjacentLeaves.value.next && (
													<button
														onClick={() => navigator.moveTo(adjacentLeaves.value.next!)}
														className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900 rounded-r hover:bg-green-200 dark:hover:bg-green-800"
														title="Next leaf (n)"
													>
														<span className="text-xs">Leaf</span>
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
}
