import {
	type AppBskyFeedDefs,
	AppBskyEmbedImages,
	AppBskyEmbedRecord,
	AppBskyEmbedExternal,
	AppBskyEmbedRecordWithMedia,
	AppBskyEmbedVideo,
} from "@atcute/bluesky";
import { is } from "@atcute/lexicons";
import { getPost } from "@/src/lib/utils/postUrls";
import { currentUrl } from "@/src/lib/messaging";
import { sameArticle } from "@/src/lib/annotations/anchors";

import { EmbeddedRecordView } from "@/src/components/post/EmbeddedRecordView";

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

function ImageEmbed({ content }: { content: AppBskyEmbedImages.View }) {
	const images = content.images.slice(0, 4);
	const count = images.length;
	if (!count) return null;
	return <div className={`mt-2 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 ${count > 1 ? 'grid grid-cols-2 gap-1' : ''} ${count === 3 ? 'grid-rows-2 aspect-[4/3]' : count === 4 ? 'grid-rows-2 aspect-square' : ''}`}>
		{images.map((image, index) => <a key={image.thumb || index} href={image.fullsize || image.thumb}
			target="_blank" rel="noopener noreferrer" title="Open full-size image (new tab)"
			aria-label={image.alt || `Open image ${index + 1}`}
			className={`block min-h-0 min-w-0 overflow-hidden focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 ${count === 3 && index === 0 ? 'row-span-2' : ''}`}>
			<img src={image.thumb} alt={image.alt} loading="lazy"
				className={`w-full object-cover ${count === 1 ? 'h-auto max-h-[500px]' : count === 2 ? 'aspect-square' : 'h-full'}`} />
		</a>)}
	</div>;
}

// Helper function to get a nice domain from a URL
function toNiceDomain(url: string): string {
	try {
		const urlp = new URL(url);
		return urlp.host ? urlp.host.replace(/^www\./, "") : url;
	} catch (e) {
		return url; // Return original URL if parsing fails
	}
}

// External Link Embed Component
function ExternalEmbed({
	content,
}: { content: import("@atcute/bluesky").AppBskyEmbedExternal.View }) {
	// For now, we won't implement labelInfo from the example.

	if (
		content.external.uri &&
		sameArticle(content.external.uri, currentUrl.value)
	) {
		return null; // Don't render if the link is the same as the current URL
	}

	return (
		<a
			href={content.external.uri}
			target="_blank"
			rel="noopener noreferrer"
			className="block w-full rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors duration-150"
		>
			{content.external.thumb && (
				<img
					src={content.external.thumb}
					loading="lazy"
					alt={`Thumbnail for ${content.external.title}`}
					className="w-full aspect-[1.91/1] object-cover border-b border-slate-200 dark:border-slate-700"
				/>
			)}
			<div className="p-2">
				<p className="font-semibold text-sm text-slate-800 dark:text-slate-100 line-clamp-2 mb-0.5">
					{content.external.title}
				</p>
				{content.external.description && (
					<p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
						{content.external.description}
					</p>
				)}
				<div className="mt-1 pt-1 border-t border-slate-200 dark:border-slate-700">
					<p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
						🌐 {toNiceDomain(content.external.uri)}
					</p>
				</div>
			</div>
		</a>
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
	}

	// Case 3: Record Embed (Quote post, etc.)
	if (is(AppBskyEmbedRecord.viewSchema, embed)) {
		const { record } = embed;

		// Sub-case: Standard Record (e.g. a post)
		if (is(AppBskyEmbedRecord.viewRecordSchema, record)) {
			// Use the new EmbeddedRecordView component to render the quoted post
			return <EmbeddedRecordView record={record} />;
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
				className="mt-2 block text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline p-2 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800"
			>
				View Record
			</a>
		);
	}

	if (is(AppBskyEmbedRecordWithMedia.viewSchema, embed)) {
		return <>
			<PostEmbed post={{ ...post, embed: embed.media }} />
			<PostEmbed post={{ ...post, embed: { ...embed.record, $type: 'app.bsky.embed.record#view' } }} />
		</>;
	}

	// Case 5: Video Embed
	if (is(AppBskyEmbedVideo.viewSchema, embed)) {
		return (
			<a href={getPost(post.uri)} target="_blank" rel="noopener noreferrer"
				className="inline-flex min-h-10 items-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline">
				Watch video on Bluesky
			</a>
		);
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
