import { useSignal, useComputed, useSignalEffect } from "@preact/signals-react/runtime";
import { useEffect, useRef } from "react";
import type { AppBskyFeedDefs } from "@atcute/bluesky";
import { PostText } from "@/components/post/PostText";
import { PostEmbed } from "@/components/post/PostEmbed";
import { Icon } from "@/components/Icon";
import type { DisplayableItem } from "@/components/post/FullPost";
import type { Thread } from "@/lib/threadUtils";
import type { ThreadReply } from "@/lib/types";

interface SlideshowViewProps {
	threadData: Thread;
	displayItems: DisplayableItem[];
	linearMode?: boolean;
}

// Interface for slide items
interface SlideItem {
	post: AppBskyFeedDefs.PostView;
	depth: number;
	isRoot: boolean;
}

export function SlideshowView({
	threadData,
	displayItems,
	linearMode = true,
}: SlideshowViewProps) {
	const currentSlideIndex = useSignal(0);
	const isTransitioning = useSignal(false);
	const slideContainerRef = useRef<HTMLDivElement>(null);
	const autoplayTimerRef = useRef<NodeJS.Timeout | null>(null);
	const autoplayEnabled = useSignal(false);
	const showControls = useSignal(true);

	// Flatten thread into items for slideshow
	const slides = useComputed(() => {
		if (!threadData?.post) return [];

		const items: SlideItem[] = [];

		// Add root post
		items.push({
			post: threadData.post,
			depth: 0,
			isRoot: true,
		});

		// Function to recursively process replies
		function addReplies(replies: ThreadReply[] | undefined, depth: number) {
			if (!replies) return;

			// Sort replies by timestamp or other criteria
			const sortedReplies = [...replies].sort((a, b) => {
				return (
					new Date(a.post.indexedAt).getTime() -
					new Date(b.post.indexedAt).getTime()
				);
			});

			sortedReplies.forEach((reply) => {
				items.push({
					post: reply.post,
					depth: depth,
					isRoot: false,
				});

				// Process nested replies
				addReplies(reply.replies, depth + 1);
			});
		}

		// Process all replies
		addReplies(threadData.replies, 1);

		return items;
	});

	// Navigate to next slide
	const goToNextSlide = () => {
		if (slides.value.length === 0) return;
		isTransitioning.value = true;
		currentSlideIndex.value = (currentSlideIndex.value + 1) % slides.value.length;
		
		// Reset transition after delay
		setTimeout(() => {
			isTransitioning.value = false;
		}, 300);
	};

	// Navigate to previous slide
	const goToPrevSlide = () => {
		if (slides.value.length === 0) return;
		isTransitioning.value = true;
		currentSlideIndex.value = currentSlideIndex.value === 0 
			? slides.value.length - 1 
			: currentSlideIndex.value - 1;
			
		// Reset transition after delay
		setTimeout(() => {
			isTransitioning.value = false;
		}, 300);
	};

	// Toggle autoplay
	const toggleAutoplay = () => {
		autoplayEnabled.value = !autoplayEnabled.value;
	};

	// Handle autoplay with signal effect
	useSignalEffect(() => {
		if (autoplayEnabled.value) {
			autoplayTimerRef.current = setInterval(goToNextSlide, 5000);
		} else if (autoplayTimerRef.current) {
			clearInterval(autoplayTimerRef.current);
			autoplayTimerRef.current = null;
		}

		return () => {
			if (autoplayTimerRef.current) {
				clearInterval(autoplayTimerRef.current);
			}
		};
	});

	// Toggle controls visibility on mouse movement
	const handleMouseMove = () => {
		showControls.value = true;
		setTimeout(() => {
			showControls.value = false;
		}, 3000);
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies:
	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			switch(e.key) {
				case "ArrowRight":
					goToNextSlide();
					break;
				case "ArrowLeft":
					goToPrevSlide();
					break;
				case " ":
				case "Spacebar":
					e.preventDefault();
					toggleAutoplay();
					break;
			}
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	return (
		<div
			className="relative h-[80vh] overflow-hidden bg-black rounded-xl"
			onMouseMove={handleMouseMove}
			ref={slideContainerRef}
		>
			{/* Slides container */}
			<div
				className="h-full flex items-center justify-center transition-transform duration-300 ease-in-out"
				style={{
					transform: isTransitioning.value
						? "scale(0.95) opacity(0.7)"
						: "scale(1) opacity(1)",
				}}
			>
				{slides.value.length > 0 && (
					<div
						className="w-full max-w-3xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-y-auto max-h-[90%] relative"
						style={{
							padding: slides.value[currentSlideIndex.value].isRoot
								? "2rem"
								: "1.5rem",
						}}
					>
						<div
							className={`absolute top-3 right-3 text-xs inline-block px-2 py-1 rounded-full ${slides.value[currentSlideIndex.value].isRoot ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"}`}
						>
							{currentSlideIndex.value + 1} / {slides.value.length}
						</div>

						{/* Author information */}
						<div className="flex items-center mb-4 gap-2">
							{displayItems.includes("avatar") && (
								<img
									src={slides.value[currentSlideIndex.value].post.author.avatar}
									alt={slides.value[currentSlideIndex.value].post.author.displayName}
									className="w-12 h-12 rounded-full"
								/>
							)}

							<div>
								{displayItems.includes("displayName") && (
									<div className="font-semibold text-gray-900 dark:text-white">
										{slides.value[currentSlideIndex.value].post.author.displayName}
									</div>
								)}
								{displayItems.includes("handle") && (
									<div className="text-gray-500 text-sm">
										@{slides.value[currentSlideIndex.value].post.author.handle}
									</div>
								)}
							</div>
						</div>

						{/* Post content */}
						<div
							className={`prose prose-lg dark:prose-invert max-w-none mb-4 ${slides.value[currentSlideIndex.value].isRoot ? "text-xl" : "text-base"}`}
						>
							<PostText post={slides.value[currentSlideIndex.value].post} />
						</div>

						{/* Embedded content */}
						<div className="mt-4">
							<PostEmbed post={slides.value[currentSlideIndex.value].post} />
						</div>

						{/* Reply indicators */}
						{!linearMode && slides.value[currentSlideIndex.value].depth > 0 && (
							<div className="absolute left-0 top-0 h-full w-1 bg-blue-500 opacity-80" />
						)}
					</div>
				)}
			</div>

			{/* Navigation controls (visible on hover) */}
			<div
				className={`absolute bottom-5 left-0 right-0 flex justify-center items-center gap-4 transition-opacity duration-300 ${showControls.value ? "opacity-100" : "opacity-0"}`}
			>
				<button
					onClick={goToPrevSlide}
					className="bg-white/20 hover:bg-white/40 text-white rounded-full p-3 backdrop-blur-sm transition-colors duration-200"
				>
					<Icon name="leftArrow" className="size-6" />
				</button>

				<button
					onClick={toggleAutoplay}
					className={`rounded-full p-3 backdrop-blur-sm transition-colors duration-200 ${autoplayEnabled.value ? "bg-rose-500/70 hover:bg-rose-500/90" : "bg-blue-500/70 hover:bg-blue-500/90"} text-white`}
				>
					<Icon
						name={autoplayEnabled.value ? "minusCircle" : "plusCircle"}
						className="size-6"
					/>
				</button>

				<button
					onClick={goToNextSlide}
					className="bg-white/20 hover:bg-white/40 text-white rounded-full p-3 backdrop-blur-sm transition-colors duration-200"
				>
					<Icon name="rightArrow" className="size-6" />
				</button>
			</div>

			{/* Progress bar */}
			<div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800">
				<div
					className="h-full bg-blue-500 transition-all duration-300"
					style={{
						width: `${(currentSlideIndex.value / (slides.value.length - 1)) * 100}%`,
					}}
				/>
			</div>
		</div>
	);
}
