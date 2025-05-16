import { type AppBskyFeedDefs, AppBskyEmbedImages, AppBskyEmbedRecord, AppBskyEmbedExternal, AppBskyEmbedRecordWithMedia, AppBskyEmbedVideo } from "@atcute/bluesky";
import { is } from "@atcute/lexicons";
import { getPost } from "@/lib/utils/postUrls";
import { currentUrl } from "@/lib/messaging";

// Helper component for informational messages (can be moved to a separate file later)
function Info({ children }: { children: React.ReactNode }) {
	return (
		<div className="w-full rounded-xl border py-2 px-2.5 flex-row flex gap-2 bg-neutral-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 my-1">
			{/* Placeholder for an icon, if desired */}
			{/* <img src={infoIcon} className="w-4 h-4 shrink-0 mt-0.5" /> */}
			<p className="text-sm text-slate-600 dark:text-slate-300">{children}</p>
		</div>
	);
}

// Add normalizeUrl function (similar to PostText.tsx)
function normalizeUrl(url: string): string {
	try {
		const parsed = new URL(url);
		// Remove www.
		const hostname = parsed.hostname.replace(/^www\./, '');
		// Reconstruct without www and trailing slash
		return `${parsed.protocol}//${hostname}${parsed.pathname.replace(/\/$/, '')}${parsed.search}${parsed.hash}`.toLowerCase();
	} catch {
		return url.toLowerCase();
	}
}

// Image Embed Component (adapted from example)
function ImageEmbed({ content }: { content: AppBskyEmbedImages.View }) {
	// For now, we won't implement labelInfo, but it's good to be aware of.
	// const labelInfo = useMemo(() => labelsToInfo(labels), [labels]);
	// if (labelInfo) {
	//   return <Info>{labelInfo}</Info>;
	// }

	const imageCount = content.images.length;

	if (imageCount === 1) {
		return (
			<div className="mt-2 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
				<img
					src={content.images[0].fullsize || content.images[0].thumb} // Prefer fullsize
					alt={content.images[0].alt}
					className="w-full h-auto object-cover max-h-[500px]" // Max height to prevent huge images
				/>
			</div>
		);
	}
	if (imageCount === 2) {
		return (
			<div className="mt-2 grid grid-cols-2 gap-1 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
				{content.images.map((image, i) => (
					<img
						key={image.thumb || i} // Use thumb as key, fallback to index
						src={image.thumb} // Thumbnails are fine for multi-image layouts
						alt={image.alt}
						className="aspect-[1/1] w-full h-full object-cover" // Square aspect ratio for 2 images
					/>
				))}
			</div>
		);
	}
	if (imageCount === 3) {
		return (
			<div className="mt-2 grid grid-cols-2 grid-rows-2 gap-1 rounded-lg overflow-hidden aspect-[4/3] border border-slate-200 dark:border-slate-700">
				<div className="col-span-1 row-span-2">
					<img
						src={content.images[0].thumb}
						alt={content.images[0].alt}
						className="w-full h-full object-cover"
					/>
				</div>
				<div className="col-span-1 row-span-1">
					<img
						src={content.images[1].thumb}
						alt={content.images[1].alt}
						className="w-full h-full object-cover"
					/>
				</div>
				<div className="col-span-1 row-span-1">
					<img
						src={content.images[2].thumb}
						alt={content.images[2].alt}
						className="w-full h-full object-cover"
					/>
				</div>
			</div>
		);
	}
	if (imageCount >= 4) {
		return (
			<div className="mt-2 grid grid-cols-2 grid-rows-2 gap-1 rounded-lg overflow-hidden aspect-square border border-slate-200 dark:border-slate-700">
				{content.images.slice(0, 4).map((image, i) => (
					<img
						key={image.thumb || i} // Use thumb as key, fallback to index
						src={image.thumb}
						alt={image.alt}
						className="w-full h-full object-cover"
					/>
				))}
			</div>
		);
	}
	return null;
}

// Helper function to get a nice domain from a URL
function toNiceDomain(url: string): string {
	try {
		const urlp = new URL(url);
		return urlp.host ? urlp.host.replace(/^www\./, '') : url;
	} catch (e) {
		return url; // Return original URL if parsing fails
	}
}

// External Link Embed Component
function ExternalEmbed({ content }: { content: import("@atcute/bluesky").AppBskyEmbedExternal.View }) {
	// For now, we won't implement labelInfo from the example.

	if (content.external.uri && normalizeUrl(content.external.uri) === normalizeUrl(currentUrl.value)) {
		return null; // Don't render if the link is the same as the current URL
	}

	return (
		<a
			href={content.external.uri}
			target="_blank"
			rel="noopener noreferrer"
			className="mt-2 block w-full rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors duration-150"
		>
			{content.external.thumb && (
				<img
					src={content.external.thumb}
					alt={`Thumbnail for ${content.external.title}`}
					className="w-full aspect-[1.91/1] object-cover border-b border-slate-200 dark:border-slate-700"
				/>
			)}
			<div className="p-3">
				<p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mb-0.5">
					{toNiceDomain(content.external.uri)}
				</p>
				<p className="font-semibold text-sm text-slate-800 dark:text-slate-100 line-clamp-2 mb-0.5">
					{content.external.title}
				</p>
				{content.external.description && (
					<p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
						{content.external.description}
					</p>
				)}
			</div>
		</a>
	);
}

// Helper function to clamp a number between a min and max value
function clamp(num: number, min: number, max: number): number {
	return Math.max(min, Math.min(num, max));
}

// Video Embed Component
function VideoEmbed({ content }: { content: import("@atcute/bluesky").AppBskyEmbedVideo.View }) {
	let aspectRatio = 1; // Default to 1:1 (square)

	if (content.aspectRatio) {
		const { width, height } = content.aspectRatio;
		if (height !== 0) { // Avoid division by zero
			aspectRatio = clamp(width / height, 1 / 1, 3 / 1); // Clamp between 1:1 and 3:1
		} else {
			aspectRatio = 16/9; // Default to 16:9 if height is 0, or handle as an error
		}
	} else {
		aspectRatio = 16/9; // Default aspect ratio if not provided
	}

	return (
		<div
			className="mt-2 w-full overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 relative bg-black"
			style={{ aspectRatio: `${aspectRatio}` }} // CSS aspect-ratio property
		>
			{content.thumbnail && (
				<img
					src={content.thumbnail}
					alt={content.alt || 'Video thumbnail'}
					className="w-full h-full object-cover"
				/>
			)}
			{/* Play icon overlay */}
			<div className="absolute inset-0 flex items-center justify-center bg-black/30">
				<div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-black/60 flex items-center justify-center text-white text-3xl md:text-4xl select-none">
					▶
				</div>
			</div>
			{/* Normally, clicking this would open a video player or navigate. For now, it's just visual. */}
		</div>
	);
}

export function PostEmbed({ post }: { post: AppBskyFeedDefs.PostView }) {
	const { embed } = post; // Destructure for convenience
	if (!embed) return null;

	// Case 1: Image Embed
	if (is(AppBskyEmbedImages.viewSchema, embed)) {
		return <ImageEmbed content={embed} />;
	}

	// Case 2: External link Embed
	if (is(AppBskyEmbedExternal.viewSchema, embed)) {
		return <ExternalEmbed content={embed} />;
		// return <div>External Link: {embed.external.uri}</div>; // Old placeholder
	}

	// Case 3: Record Embed (Quote post, etc.)
	if (is(AppBskyEmbedRecord.viewSchema, embed)) {
		const { record } = embed;

		// Sub-case: Standard Record (e.g. a post)
		if (is(AppBskyEmbedRecord.viewRecordSchema, record)) {
			// For now, a simple link. We can enhance this later.
			// To do: Create a richer preview for quoted posts.
			return (
				<a
					href={getPost(record.uri)}
					target="_blank"
					rel="noopener noreferrer"
					className="mt-2 block text-sm text-blue-500 hover:underline p-2 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800"
				>
					Quoted Post: {record.author.displayName || `@${record.author.handle}`}
					{/* We could try to show some text if available: record.value?.text (needs type check) */}
				</a>
			);
		}
		// Sub-case: Record Not Found
		if (is(AppBskyEmbedRecord.viewNotFoundSchema, record)) {
			return <Info>Quoted post not found, it may have been deleted.</Info>;
		}
		// Sub-case: Record Blocked
		if (is(AppBskyEmbedRecord.viewBlockedSchema, record)) {
			return <Info>The quoted post is blocked.</Info>;
		}
		// Sub-case: Record Detached (rare, typically for migration/system reasons)
		// if (AppBskyEmbedRecord.isViewDetached(record)) {
		//   return <Info>This quoted content is currently detached.</Info>;
		// }
		
		// Fallback for other record types (lists, feeds, etc.) until implemented
		return (
			<a
				href={getPost(record.uri)} // Assuming all records have a URI we can link to
				target="_blank"
				rel="noopener noreferrer"
				className="mt-2 block text-sm text-blue-500 hover:underline p-2 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800"
			>
				View Record
			</a>
		);
	}

	// Case 4: Record with Media Embed (To be implemented)
	if (is(AppBskyEmbedRecordWithMedia.viewSchema, embed)) {
		// return (
		//   <div className="flex flex-col gap-2">
		//     <PostEmbed content={embed.media} labels={post.labels} hideRecord />
		//     <PostEmbed content={{ $type: 'app.bsky.embed.record#view', record: embed.record.record }} labels={embed.record.record.labels} hideRecord />
		//   </div>
		// );
		return <div className="text-sm text-gray-500 dark:text-gray-400">[Record with Media]</div>;
	}

	// Case 5: Video Embed
	if (is(AppBskyEmbedVideo.viewSchema, embed)) {
		// return <VideoEmbed content={embed} />;
		return <div className="text-sm text-gray-500 dark:text-gray-400">[Video Embed]</div>;
	}

	// Fallback for any other unknown embed type
	// If we've reached here, it's an embed type we haven't explicitly handled.
	// We know `embed` is not undefined (checked at the start) and should be one of the
	// valid embed view objects from the union, all of which have a $type property.
	const unknownEmbed = embed as { $type: string; [k: string]: unknown };
	// It's possible $type might not exist if the object is malformed, though unlikely for valid views.
	if (unknownEmbed?.$type) {
		return <Info>Unsupported embed type: {unknownEmbed.$type}</Info>;
	}

	return null;
}
