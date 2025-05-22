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

	const activeNode = navigator.getCurrentNode();

	// Build thread path from root to current node
	const threadPath = useComputed(() => {
		const currentNode = activeNode;
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

	const relatedNodes = useComputed(() => {
		const node = activeNode;
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
		if (!activeNode) return;

		const container = threadContainerRef.current;
		if (!container) return;
		container.focus();

		const handleKeyDown = (e: KeyboardEvent) => {
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
				case "j":
					if (activeNode.childUris.length > 0) {
						navigator.moveToFirstChild();
					} else {
						navigator.moveToNextSibling();
					}
					break;
				case "k":
					if (!navigator.moveToPrevSibling()) {
						navigator.moveToParent();
					}
					break;
				case "n":
					navigator.moveToNext(); // chronological navigation
					break;
				case "p":
					navigator.moveToPrev(); // chronological navigation
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
	}, [navigator, activeNode, showMetadata, showMiniMap]);

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
					<kbd>↑</kbd> Parent
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
					<kbd>j</kbd> Next node (child or sibling)
				</div>
				<div>
					<kbd>k</kbd> Previous node (sibling or parent)
				</div>
				<div>
					<kbd>n</kbd> Next (chronological)
				</div>
				<div>
					<kbd>p</kbd> Previous (chronological)
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

	// Recursive function to render the tree minimap
	const renderTreeNode = (uri: string, level: number): React.ReactNode => {
		const post = navigator.getPost(uri);
		const node = navigator.getNode(uri);
		
		if (!post || !node || applyFilters(post, filters)) return null;

		const isActive = uri === navigator.cursor.value;
		const isInPath = threadPath.value.some(p => p.uri === uri);

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
					{node.childUris.length > 0 ? (
						<Icon name="comment" className="size-3 mr-1 flex-shrink-0" />
					) : (
						<span className="w-3 mr-1" />
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
				{/* Render children if this node is in the active path or is a sibling of an active path node */}
				{node.childUris.length > 0 &&
					(isInPath ||
						node.childUris.some(childUri =>
							threadPath.value.some(p => p.uri === childUri)
						)) && (
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

											{/* Chronological navigation */}
											<div className="flex ml-auto">
												<button
													onClick={() => navigator.moveToPrev()}
													className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-l hover:bg-gray-200 dark:hover:bg-gray-600 border-r border-gray-200 dark:border-gray-600"
													title="Previous (chronological) (p)"
												>
													<Icon
														name="arrowUturnLeft"
														className="size-3 -rotate-90"
													/>
												</button>

												<button
													onClick={() => navigator.moveToNext()}
													className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-r hover:bg-gray-200 dark:hover:bg-gray-600"
													title="Next (chronological) (n)"
												>
													<Icon
														name="arrowUturnLeft"
														className="size-3 rotate-90"
													/>
												</button>
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
