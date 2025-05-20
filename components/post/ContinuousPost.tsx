import { useSignal, useComputed } from "@preact/signals-react/runtime";
import { useEffect, useRef } from "react";
import type { AppBskyFeedDefs } from "@atcute/bluesky";
import { useQuery } from "@tanstack/react-query";

import { PostText } from "@/components/post/PostText";
import { PostEmbed } from "@/components/post/PostEmbed";
import { Icon } from "@/components/Icon";
import { fetchProcessedThread } from "@/lib/threadUtils";
import type { ThreadReply } from "@/lib/types";
import type { DisplayableItem } from "@/components/post/FullPost";

import { getAtUriFromUrl } from "@/lib/utils/postUrls";
import { getTimeAgo } from "@/lib/utils/time";
import { applyFilters, type PostFilter } from "@/lib/postFilters";

interface ContinuousPostProps {
	uri: string;
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

export function ContinuousPost({
	uri,
	displayItems,
	filters,
}: ContinuousPostProps) {
	// Current navigation cursor position (path)
	const activeCursor = useSignal<string>("0");
	// For keyboard focus management
	const threadContainerRef = useRef<HTMLDivElement>(null);
	// Show/hide metadata like timestamps
	const showMetadata = useSignal<boolean>(false);
	// Show breadcrumb navigation
	const showBreadcrumbs = useSignal<boolean>(true);
	// If we should preview siblings
	const showSiblings = useSignal<boolean>(false);

    if (uri.startsWith("https://")) {
        uri = getAtUriFromUrl(uri);
    }

	const {
		data: threadData,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["thread", uri],
		queryFn: () => fetchProcessedThread(uri),
		staleTime: 1000 * 60 * 60 * 24, // 1 day
	});

	// Build a complete thread tree 
	const threadTree = useComputed(() => {
		if (!threadData?.post) return null;
		
		// Create root node
		const root: ThreadNode = {
			post: threadData.post,
			depth: 0,
			path: "0",
			children: [],
			parent: null
		};
		
		// Map to quickly find nodes by path
		const nodeMap = new Map<string, ThreadNode>();
		nodeMap.set("0", root);
		
		// Recursively build the tree
		function buildTreeFromReplies(replies: ThreadReply[] | undefined, parentPath: string, parentNode: ThreadNode) {
			if (!replies) return;
			
			replies.forEach((reply, index) => {
				const currentPath = `${parentPath}.${index}`;
				const node: ThreadNode = {
					post: reply.post,
					depth: parentPath.split(".").length,
					path: currentPath,
					children: [],
					parent: parentNode
				};
				
				// Store in map and add to parent's children
				nodeMap.set(currentPath, node);
				parentNode.children.push(node);
				
				// Process this node's children
				buildTreeFromReplies(reply.replies, currentPath, node);
			});
		}
		
		// Build tree starting with root's children
		buildTreeFromReplies(threadData.replies, "0", root);
		
		return { root, nodeMap };
	});
	
	// Get current active node based on cursor
	const activeNode = useComputed(() => {
		if (!threadTree.value?.nodeMap) return null;
		return threadTree.value.nodeMap.get(activeCursor.value) || null;
	});
	
	// Get parent, siblings, and children of current active node
	const activeRelations = useComputed(() => {
		if (!activeNode.value) return { parent: null, siblings: [], children: [] };
		
		const parent = activeNode.value.parent;
		
		let siblings: ThreadNode[] = [];
		if (parent) {
			// Get siblings (other children of the same parent)
			siblings = parent.children.filter(node => node.path !== activeNode.value?.path);
		}
		
		return {
			parent,
			siblings, 
			children: activeNode.value.children
		};
	});
	
	// Collect all leaf nodes (nodes without children) for leaf navigation
	const leafNodes = useComputed(() => {
		if (!threadTree.value?.root) return [];
		
		const leaves: ThreadNode[] = [];
		
		function findLeaves(node: ThreadNode) {
			if (node.children.length === 0) {
				leaves.push(node);
			} else {
				node.children.forEach(child => findLeaves(child));
			}
		}
		
		findLeaves(threadTree.value.root);
		return leaves;
	});
	
	// Find the next/previous leaf from current position
	const adjacentLeaves = useComputed(() => {
		if (!activeNode.value || leafNodes.value.length === 0) 
			return { prev: null, next: null };
		
		const currentLeafIndex = leafNodes.value.findIndex(
			node => node.path === activeNode.value?.path
		);
		
		// If not on a leaf, find closest leaf
		if (currentLeafIndex === -1) {
			// Find the next leaf that would come after this path
			const nextLeafIndex = leafNodes.value.findIndex(
				leaf => leaf.path.localeCompare(activeNode.value?.path || "") > 0
			);
			
			if (nextLeafIndex === -1) {
				// No next leaf, return the last leaf as prev and no next
				return { 
					prev: leafNodes.value[leafNodes.value.length - 1],
					next: null
				};
			}
			
			return {
				prev: nextLeafIndex > 0 ? leafNodes.value[nextLeafIndex - 1] : null,
				next: leafNodes.value[nextLeafIndex]
			};
		}
		
		// On a leaf, get adjacent leaves
		return {
			prev: currentLeafIndex > 0 ? leafNodes.value[currentLeafIndex - 1] : null,
			next: currentLeafIndex < leafNodes.value.length - 1 ? 
				leafNodes.value[currentLeafIndex + 1] : null
		};
	});
	
	// Generate path segments for navigation breadcrumbs
	const pathSegments = useComputed(() => {
		if (!activeCursor.value || !threadTree.value?.nodeMap) return [];
		
		const segments = activeCursor.value.split('.');
		const result = [];
		
		let currentPath = "";
		for (let i = 0; i < segments.length; i++) {
			currentPath = currentPath ? `${currentPath}.${segments[i]}` : segments[i];
			const node = threadTree.value.nodeMap.get(currentPath);
			if (node) {
				result.push({
					path: currentPath,
					node
				});
			}
		}
		
		return result;
	});
	
	// Set up keyboard navigation
	useEffect(() => {
		if (!threadTree.value) return;
		
		const container = threadContainerRef.current;
		if (!container) return;
		
		// Focus container to capture key events
		container.focus();
		
		const handleKeyDown = (e: KeyboardEvent) => {
			if (!activeNode.value) return;
			
            console.log(e.key);

			switch (e.key) {
				case 'ArrowUp':
					// Navigate to parent
					if (activeRelations.value.parent) {
						e.preventDefault();
						activeCursor.value = activeRelations.value.parent.path;
					}
					break;
				case 'ArrowDown':
					// Navigate to first child
					if (activeNode.value.children.length > 0) {
						e.preventDefault();
						activeCursor.value = activeNode.value.children[0].path;
					}
					break;
				case 'ArrowLeft':
					// Navigate to previous sibling
					if (activeRelations.value.siblings.length > 0 && activeNode.value.parent) {
						e.preventDefault();
						const siblings = activeNode.value.parent.children;
						const currentIndex = siblings.findIndex(node => node.path === activeNode.value?.path);
						if (currentIndex > 0) {
							activeCursor.value = siblings[currentIndex - 1].path;
						}
					}
					break;
				case 'ArrowRight':
					// Navigate to next sibling
					if (activeRelations.value.siblings.length > 0 && activeNode.value.parent) {
						e.preventDefault();
						const siblings = activeNode.value.parent.children;
						const currentIndex = siblings.findIndex(node => node.path === activeNode.value?.path);
						if (currentIndex < siblings.length - 1) {
							activeCursor.value = siblings[currentIndex + 1].path;
						}
					}
					break;
				case 'j':
					// Previous leaf
					if (adjacentLeaves.value.prev) {
						e.preventDefault();
						activeCursor.value = adjacentLeaves.value.prev.path;
					}
					break;
				case 'k':
					// Next leaf
					if (adjacentLeaves.value.next) {
						e.preventDefault();
						activeCursor.value = adjacentLeaves.value.next.path;
					}
					break;
				case 'r':
					// Return to root
					e.preventDefault();
					activeCursor.value = "0";
					break;
				case 'm':
					// Toggle metadata
					e.preventDefault();
					showMetadata.value = !showMetadata.value;
					break;
				case 'b':
					// Toggle breadcrumbs
					e.preventDefault();
					showBreadcrumbs.value = !showBreadcrumbs.value;
					break;
				case 's':
					// Toggle siblings view
					e.preventDefault();
					showSiblings.value = !showSiblings.value;
					break;
			}
		};
		
		container.addEventListener('keydown', handleKeyDown);
		return () => {
			container.removeEventListener('keydown', handleKeyDown);
		};
	}, []);
	
	if (isLoading) return <div className="p-4">Loading conversation...</div>;

	if (error) {
		return (
			<div className="p-4 text-center text-red-500">
				Error loading thread: {error instanceof Error ? error.message : "Unknown error"}
			</div>
		);
	}

	if (!threadData?.post || !threadTree.value) {
		return <div className="p-4">No conversation found.</div>;
	}
	
	// Render the keyboard shortcuts help
	const renderKeyboardHelp = () => (
		<div className="p-3 bg-gray-50 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-300 rounded-md mb-4">
			<div className="font-medium mb-1">Keyboard Navigation:</div>
			<div className="grid grid-cols-2 gap-x-4 gap-y-1">
				<div><kbd>↑</kbd> Parent</div>
				<div><kbd>↓</kbd> First child</div>
				<div><kbd>←</kbd> Previous sibling</div>
				<div><kbd>→</kbd> Next sibling</div>
				<div><kbd>j</kbd> Previous leaf</div>
				<div><kbd>k</kbd> Next leaf</div>
				<div><kbd>r</kbd> Root post</div>
				<div><kbd>m</kbd> Toggle metadata</div>
				<div><kbd>b</kbd> Toggle breadcrumbs</div>
				<div><kbd>s</kbd> Toggle siblings</div>
			</div>
		</div>
	);

	return (
		<div className="flex flex-col">
			{renderKeyboardHelp()}
			
			<div 
				ref={threadContainerRef}
				className="border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 outline-none overflow-hidden focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-opacity-50"
				tabIndex={0}
			>
				{/* Breadcrumb navigation */}
				{showBreadcrumbs.value && (
					<div className="bg-gray-50 dark:bg-gray-750 px-4 py-2 flex overflow-x-auto">
						{pathSegments.value.map((segment, index) => (
							<div key={segment.path} className="flex items-center min-w-0">
								{index > 0 && (
									<span className="mx-1 text-gray-400">
										<Icon name="chevronRight" className="size-3" />
									</span>
								)}
								<button
									onClick={() => activeCursor.value = segment.path}
									className={`flex items-center px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
										activeCursor.value === segment.path 
											? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
											: ''
									}`}
								>
									{displayItems.includes("avatar") && segment.node.post.author.avatar && (
										<img
											src={segment.node.post.author.avatar}
											alt=""
											className="w-4 h-4 rounded-full mr-1"
										/>
									)}
									<span className="truncate max-w-[50px] text-xs">
										{segment.node.post.author.displayName || segment.node.post.author.handle}
									</span>
								</button>
							</div>
						))}
					</div>
				)}
				
				{/* Main content area */}
				<div className="divide-y divide-gray-100 dark:divide-gray-700">
					{/* Active post */}
					{activeNode.value && !applyFilters(activeNode.value.post, filters) && (
						<div className="px-4 py-3">
							{/* Author info and metadata */}
							<div className="flex justify-between items-start mb-2">
								<div className="flex items-center gap-2">
									{displayItems.includes("avatar") && activeNode.value.post.author.avatar && (
										<img
											src={activeNode.value.post.author.avatar}
											alt={activeNode.value.post.author.displayName || activeNode.value.post.author.handle}
											className="w-8 h-8 rounded-full"
										/>
									)}
									<div>
										{displayItems.includes("displayName") && (
											<div className="font-medium">
												{activeNode.value.post.author.displayName || activeNode.value.post.author.handle}
											</div>
										)}
										{displayItems.includes("handle") && (
											<div className="text-xs text-gray-500">
												@{activeNode.value.post.author.handle}
											</div>
										)}
									</div>
								</div>
								
								{showMetadata.value && (
									<div className="text-xs text-gray-500">
										{getTimeAgo(activeNode.value.post.indexedAt)}
										
										{/* Path indicator */}
										<span className="ml-2 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300">
											{activeNode.value.path}
										</span>
									</div>
								)}
							</div>
							
							{/* Post content */}
							<div className="prose prose-sm dark:prose-invert max-w-none mb-4">
								<PostText post={activeNode.value.post} />
								<PostEmbed post={activeNode.value.post} />
							</div>
							
							{/* Navigation indicators */}
							<div className="flex flex-wrap gap-2 text-xs">
								{/* Parent link */}
								{activeRelations.value.parent && (
									<button
										onClick={() => activeCursor.value = activeRelations.value.parent!.path}
										className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
									>
										<Icon name="arrowUturnLeft" className="size-3 rotate-90" />
										<span>Parent</span>
									</button>
								)}
								
								{/* Sibling counter/navigation */}
								{activeRelations.value.siblings.length > 0 && (
									<button
										onClick={() => showSiblings.value = !showSiblings.value}
										className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
									>
										<Icon name="rectangleStack" className="size-3" />
										<span>Siblings ({activeRelations.value.siblings.length})</span>
									</button>
								)}
								
								{/* Children counter/navigation */}
								{activeRelations.value.children.length > 0 && (
									<button
										onClick={() => activeCursor.value = activeRelations.value.children[0].path}
										className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
									>
										<Icon name="comment" className="size-3" />
										<span>Replies ({activeRelations.value.children.length})</span>
									</button>
								)}
								
								{/* Leaf navigation */}
								<div className="flex ml-auto">
									{adjacentLeaves.value.prev && (
										<button
											onClick={() => activeCursor.value = adjacentLeaves.value.prev!.path}
											className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-l-md hover:bg-gray-200 dark:hover:bg-gray-600 border-r border-gray-200 dark:border-gray-600"
											title="Previous leaf (j)"
										>
											<Icon name="leftArrow" className="size-3" />
										</button>
									)}
									
									{adjacentLeaves.value.next && (
										<button
											onClick={() => activeCursor.value = adjacentLeaves.value.next!.path}
											className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-r-md hover:bg-gray-200 dark:hover:bg-gray-600"
											title="Next leaf (k)"
										>
											<Icon name="rightArrow" className="size-3" />
										</button>
									)}
								</div>
							</div>
						</div>
					)}
					
					{/* Siblings preview (when enabled) */}
					{showSiblings.value && activeRelations.value.siblings.length > 0 && (
						<div className="px-4 py-3 bg-gray-50 dark:bg-gray-750">
							<div className="text-sm font-medium mb-2">Siblings</div>
							<div className="space-y-2">
								{activeRelations.value.siblings.map(sibling => (
									<button
										key={sibling.path}
										onClick={() => activeCursor.value = sibling.path}
										className="block w-full text-left p-2 rounded-md bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-650"
									>
										<div className="flex items-center gap-2">
											{displayItems.includes("avatar") && sibling.post.author.avatar && (
												<img
													src={sibling.post.author.avatar}
													alt=""
													className="w-5 h-5 rounded-full"
												/>
											)}
											<span className="font-medium text-xs">
												{sibling.post.author.displayName || sibling.post.author.handle}
											</span>
											{showMetadata.value && (
												<span className="text-xs text-gray-500">
													{getTimeAgo(sibling.post.indexedAt)}
												</span>
											)}
										</div>
										<div className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-1">
											{sibling.post.record.text as string}
										</div>
									</button>
								))}
							</div>
						</div>
					)}
					
					{/* Children preview (always show first few) */}
					{activeRelations.value.children.length > 0 && (
						<div className="px-4 py-3 bg-gray-50 dark:bg-gray-750">
							<div className="text-sm font-medium mb-2">Replies</div>
							<div className="space-y-2">
								{activeRelations.value.children.map(child => (
									<button
										key={child.path}
										onClick={() => activeCursor.value = child.path}
										className="block w-full text-left p-2 rounded-md bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-650"
									>
										<div className="flex items-center gap-2">
											{displayItems.includes("avatar") && child.post.author.avatar && (
												<img
													src={child.post.author.avatar}
													alt=""
													className="w-5 h-5 rounded-full"
												/>
											)}
											<span className="font-medium text-xs">
												{child.post.author.displayName || child.post.author.handle}
											</span>
											{showMetadata.value && (
												<span className="text-xs text-gray-500">
													{getTimeAgo(child.post.indexedAt)}
												</span>
											)}
										</div>
										<div className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
											{child.post.record.text as string}
										</div>
									</button>
								))}
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
} 