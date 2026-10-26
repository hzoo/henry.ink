import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSignal } from "@preact/signals";
import {
	fetchChannelBlocks,
	arenaQueryKeys,
	formatRelativeTime,
	parseArenaSourceUrl,
} from "@/src/lib/arena-api";
import { arenaNavigationRequest, currentUrl } from "@/src/lib/messaging";
import { navigateToChannel, openBlockOverlay } from "@/src/lib/arena-navigation";
import type {
	ArenaMatch,
	ArenaBlock,
	ImageBlock,
	TextBlock,
	LinkBlock,
	EmbedBlock,
	AttachmentBlock,
} from "@/src/lib/arena-types";
import type { ArenaViewMode } from "@/henry-ink/signals";
import { useRef } from "preact/hooks";

interface ArenaChannelItemProps {
	match: ArenaMatch;
	matchTextCounts: Record<string, number>;
	viewMode: ArenaViewMode;
}

interface ArenaBlockItemProps {
	block: ArenaBlock;
	channelSlug?: string;
}

function BlockThumbnail({ src, alt, className }: { src: string; alt: string; className: string }) {
	const failedSource = useSignal<string | null>(null);
	if (failedSource.value === src) {
		return <div className="flex h-full w-full items-center justify-center text-xs text-gray-500 dark:text-gray-400">IMG</div>;
	}
	return <img src={src} alt={alt} className={className} loading="lazy" onError={() => { failedSource.value = src; }} />;
}

export function ArenaBlockItem({ block, channelSlug }: ArenaBlockItemProps) {
	const handleBlockClick = () => {
		openBlockOverlay(block, channelSlug);
	};

	switch (block.__typename) {
		case "Image":
			const imageBlock = block as ImageBlock;
			const imageUrl =
				imageBlock.resized_image?.grid_cell_resized_image?.src_1x || imageBlock.image_url;

			if (!imageUrl) {
				return (
					<button type="button" aria-label={`Open block: ${block.title || block.__typename}`}
						className="w-full text-left focus-visible:outline-2 focus-visible:outline-green-600 cursor-pointer group relative bg-gray-200 dark:bg-gray-700 rounded overflow-hidden min-h-[100px] flex items-center justify-center"
						onClick={handleBlockClick}
						title={imageBlock.title || "Untitled image"}
					>
						<div className="text-gray-500 dark:text-gray-400 text-xs">IMG</div>
					</button>
				);
			}

			return (
				<button type="button" aria-label={`Open block: ${block.title || block.__typename}`}
					className="w-full min-h-[100px] text-left focus-visible:outline-2 focus-visible:outline-green-600 cursor-pointer group relative bg-gray-100 dark:bg-gray-800 rounded overflow-hidden hover:ring-2 hover:ring-green-500 hover:ring-opacity-50 transition-shadow duration-200"
					onClick={handleBlockClick}
					title={imageBlock.title || "Untitled image"}
				>
					<BlockThumbnail
						src={imageUrl}
						alt={imageBlock.title || "Arena image"}
						className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
					/>
				</button>
			);

		case "Text":
			const textBlock = block as TextBlock;
			const content =
				textBlock.content?.replace(/<[^>]*>/g, "").trim() ||
				textBlock.title ||
				"Text block";
			const truncatedContent =
				content.length > 80 ? content.substring(0, 80) + "..." : content;

			return (
				<button type="button" aria-label={`Open block: ${block.title || block.__typename}`}
					className="w-full text-left focus-visible:outline-2 focus-visible:outline-green-600 cursor-pointer group p-3 bg-gray-50 dark:bg-gray-800/50 rounded border-l-4 border-green-500 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
					onClick={handleBlockClick}
					title={content}
				>
					<div className="text-xs text-gray-700 dark:text-gray-300 line-clamp-4 leading-relaxed">
						{truncatedContent}
					</div>
				</button>
			);

		case "Link":
			const linkBlock = block as LinkBlock;
			const linkImageUrl =
				linkBlock.resized_image?.grid_cell_resized_image?.src_1x || linkBlock.image_url;
			const domain = parseArenaSourceUrl(linkBlock.source?.url)?.hostname || "Link";

			return (
				<button type="button" aria-label={`Open block: ${block.title || block.__typename}`}
					className="w-full text-left focus-visible:outline-2 focus-visible:outline-green-600 cursor-pointer group bg-gray-50 dark:bg-gray-800/50 rounded overflow-hidden hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
					onClick={handleBlockClick}
					title={linkBlock.title || "Untitled link"}
				>
					{linkImageUrl && (
						<div className="aspect-video bg-gray-200 dark:bg-gray-700">
							<BlockThumbnail
								src={linkImageUrl}
								alt={linkBlock.title || "Link preview"}
								className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
							/>
						</div>
					)}
					<div className="p-2">
						<div className="text-xs font-medium text-gray-800 dark:text-gray-200 line-clamp-2 mb-1">
							{linkBlock.title || "Untitled"}
						</div>
						<div className="text-xs text-gray-500 dark:text-gray-400">
							{domain}
						</div>
					</div>
				</button>
			);

		case "Embed":
			const embedBlock = block as EmbedBlock;
			const embedImageUrl =
				embedBlock.resized_image?.grid_cell_resized_image?.src_1x || embedBlock.image_url;
			const provider = embedBlock.source?.provider_name || "Embed";

			return (
				<button type="button" aria-label={`Open block: ${block.title || block.__typename}`}
					className="w-full text-left focus-visible:outline-2 focus-visible:outline-green-600 cursor-pointer group bg-gray-50 dark:bg-gray-800/50 rounded overflow-hidden hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
					onClick={handleBlockClick}
					title={embedBlock.title || "Untitled embed"}
				>
					{embedImageUrl && (
						<div className="aspect-video bg-gray-200 dark:bg-gray-700">
							<BlockThumbnail
								src={embedImageUrl}
								alt={embedBlock.title || "Embed preview"}
								className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
							/>
						</div>
					)}
					<div className="p-2">
						<div className="text-xs font-medium text-gray-800 dark:text-gray-200 line-clamp-2 mb-1">
							{embedBlock.title || "Untitled"}
						</div>
						<div className="text-xs text-gray-500 dark:text-gray-400">
							{provider}
						</div>
					</div>
				</button>
			);

		case "Attachment":
			const attachmentBlock = block as AttachmentBlock;
			const attachmentImageUrl =
				attachmentBlock.resized_image?.grid_cell_resized_image?.src_1x || attachmentBlock.image_url;
			const fileType = attachmentBlock.file_extension?.toUpperCase() || "FILE";

			return (
				<button type="button" aria-label={`Open block: ${block.title || block.__typename}`}
					className="w-full text-left focus-visible:outline-2 focus-visible:outline-green-600 cursor-pointer group bg-gray-50 dark:bg-gray-800/50 rounded overflow-hidden hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
					onClick={handleBlockClick}
					title={attachmentBlock.title || "Untitled attachment"}
				>
					{attachmentImageUrl ? (
						<div className="aspect-video bg-gray-200 dark:bg-gray-700">
							<BlockThumbnail
								src={attachmentImageUrl}
								alt={attachmentBlock.title || "Attachment preview"}
								className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
							/>
						</div>
					) : (
						<div className="aspect-video bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
							<div className="text-sm font-medium text-gray-600 dark:text-gray-400">
								{fileType}
							</div>
						</div>
					)}
					<div className="p-2">
						<div className="text-xs font-medium text-gray-800 dark:text-gray-200 line-clamp-2">
							{attachmentBlock.title || "Untitled"}
						</div>
					</div>
				</button>
			);

		default:
			return null;
	}
}

export function ArenaChannelItem({
	match,
	matchTextCounts,
	viewMode,
}: ArenaChannelItemProps) {
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const queryClient = useQueryClient();

	// Handle navigation to text position
	const handleNavigateToMatch = (match: ArenaMatch) => {
		arenaNavigationRequest.value = { channelSlug: match.slug, matchedText: match.matchedText, url: currentUrl.peek() };
	};

	// Prefetch channel blocks on hover
	const handleChannelHover = () => {
		queryClient.prefetchQuery({
			queryKey: arenaQueryKeys.blocks(match.slug, 24, 1),
			queryFn: ({ signal }) => fetchChannelBlocks(match.slug, 24, 1, signal),
			staleTime: 10 * 60 * 1000,
		});
	};

	// Fetch blocks for this channel (only in preview mode)
	const {
		data: channelWithBlocks,
		isLoading: blocksLoading,
		error: blocksError,
	} = useQuery({
		queryKey: arenaQueryKeys.blocks(match.slug, 24, 1),
		queryFn: ({ signal }) => fetchChannelBlocks(match.slug, 24, 1, signal),
		staleTime: 10 * 60 * 1000, // 10 minutes
		retry: 1,
		enabled: viewMode === "preview", // Only fetch in preview mode
	});

	const blocks = channelWithBlocks?.blocks || [];
	const totalMatches = matchTextCounts[match.matchedText] || 1;

	// Scroll handlers
	const scrollLeft = () => {
		if (scrollContainerRef.current) {
			scrollContainerRef.current.scrollBy({ left: -200, behavior: "smooth" });
		}
	};

	const scrollRight = () => {
		if (scrollContainerRef.current) {
			scrollContainerRef.current.scrollBy({ left: 200, behavior: "smooth" });
		}
	};

	return (
		<div className="p-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
			{/* Channel Title */}
			<div className="flex min-w-0 flex-wrap gap-1 justify-between">
				<div className="mb-1 min-w-0 flex-1">
					<button
						onClick={() => navigateToChannel(match.slug)}
						onMouseEnter={handleChannelHover}
						className="max-w-full break-words text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 font-medium text-sm leading-tight hover:underline text-left"
					>
						{match.title}
					</button>
				</div>

				{/* Matched Text */}
				<button type="button"
					className="mb-2 max-w-full min-h-10 cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-green-600"
					aria-label={`Scroll to text: ${match.matchedText}`}
					onClick={() => handleNavigateToMatch(match)}
					title={`Navigate to: "${match.matchedText}"${match.context ? `\nContext: ...${match.context}...` : ""}`}
				>
					<span className="max-w-full [overflow-wrap:anywhere] bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-xs px-1.5 py-0.5 rounded font-medium group-hover:bg-yellow-200 dark:group-hover:bg-yellow-900/50 transition-colors inline-flex items-center gap-1">
						"
						{match.matchedText.length > 30
							? `${match.matchedText.substring(0, 30)}...`
							: match.matchedText}
						"
						{totalMatches > 1 && (
							<span className="text-yellow-700 dark:text-yellow-300">
								×{totalMatches}
							</span>
						)}
					</span>
				</button>
			</div>

			{/* Metadata Line */}
      <div className="flex min-w-0 gap-1 justify-between">
			<div className="min-w-0 flex-1 break-words text-xs text-gray-500 dark:text-gray-400 mb-1.5">
				{match.author_slug ? (
					<a
						href={`https://are.na/${match.author_slug}`}
						target="_blank"
						rel="noopener noreferrer"
						className="hover:text-green-600 dark:hover:text-green-400 transition-colors"
					>
						{match.author_name}
					</a>
				) : (
					<span>{match.author_name}</span>
				)}
			</div>
      <div className="shrink-0 text-xs text-gray-500 dark:text-gray-400 mb-1.5">
				{formatRelativeTime(match.updated_at)} ago
      </div>
      </div>

			{/* Blocks - Only in Preview Mode */}
			{viewMode === "preview" && (
				<div className="relative">
					{blocksLoading ? (
						<div className="flex items-center justify-center py-4">
							<div className="w-3 h-3 border-2 border-gray-300 dark:border-gray-600 border-t-green-500 rounded-full animate-spin" />
							<span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
								Loading blocks...
							</span>
						</div>
					) : blocksError ? (
						<div className="text-xs text-gray-500 dark:text-gray-400 italic py-2">
							{blocksError.message?.includes("404")
								? "Channel not accessible"
								: "Failed to load blocks"}
						</div>
					) : blocks.length > 0 ? (
						<div className="relative group/scroll">
							{/* Scroll buttons */}
							<button
								onClick={scrollLeft}
								className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-gray-800 shadow-md rounded-full p-1 opacity-0 group-hover/scroll:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-green-600 transition-opacity"
								aria-label="Scroll left"
							>
								<svg
									className="w-4 h-4 text-gray-600 dark:text-gray-400"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M15 19l-7-7 7-7"
									/>
								</svg>
							</button>
							<button
								onClick={scrollRight}
								className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-gray-800 shadow-md rounded-full p-1 opacity-0 group-hover/scroll:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-green-600 transition-opacity"
								aria-label="Scroll right"
							>
								<svg
									className="w-4 h-4 text-gray-600 dark:text-gray-400"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M9 5l7 7-7 7"
									/>
								</svg>
							</button>

							{/* Scrollable blocks container */}
							<div
								ref={scrollContainerRef}
								className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1"
								style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
							>
								{blocks.map((block) => (
									<div key={block.id} className="flex-shrink-0 w-32">
										<ArenaBlockItem block={block} channelSlug={match.slug} />
									</div>
								))}
							</div>

							{/* View all link */}
							<div className="text-right">
								<a
									href={match.url}
									target="_blank"
									rel="noopener noreferrer"
									className="text-xs text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
								>
									View all {match.contents_count}▪ →
								</a>
							</div>
						</div>
					) : (
						<div className="text-xs text-gray-500 dark:text-gray-400 italic py-2">
							No blocks available
						</div>
					)}
				</div>
			)}
		</div>
	);
}
