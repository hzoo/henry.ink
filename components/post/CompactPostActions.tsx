import { batch, type Signal, useComputed, useSignal } from "@preact/signals";
import { Icon } from "@/components/Icon";
import { formatCount } from "@/lib/utils/count";
import type { AppBskyFeedDefs } from "@atcute/client/lexicons";
import { ReplyInput } from "@/components/post/ReplyInput";
import { atCuteState } from "@/site/lib/oauth";
import { fetchAndUpdateThreadSignal } from "@/lib/threadUtils";
import { getThreadSignal } from "@/lib/signals";
import {
	submitReply,
	likePost,
	unlikePost,
	repostPost,
	deleteRepost,
	isRecord,
} from "@/lib/postActions";
import { findAndUpdatePostInSignal } from "@/lib/signalUtils";
import { ExpandButton } from "@/components/post/ExpandButton";

interface CompactPostActionsProps {
	post: AppBskyFeedDefs.PostView;
	isExpanded: Signal<boolean>;
}

export function CompactPostActions({
	post,
	isExpanded,
}: CompactPostActionsProps) {
	const isReplying = useSignal(false);
	const isSubmitting = useSignal(false);
	const submitError = useSignal<string | null>(null);
	const isLiking = useSignal(false);
	const isReposting = useSignal(false);
	const actionError = useSignal<string | null>(null);

	const state = atCuteState.value;
	const isLoggedIn = !!state?.session;

	const threadSignal = getThreadSignal(post.uri);

	const localLikeUri = useSignal<string | undefined>(post.viewer?.like);
	const localLikeCount = useSignal(post.likeCount ?? 0);
	const localRepostUri = useSignal<string | undefined>(post.viewer?.repost);
	const localRepostCount = useSignal(post.repostCount ?? 0);

	const displayedReplyCount = useComputed(() => {
		const signalData = threadSignal.value.data;
		return Array.isArray(signalData)
			? signalData.length
			: (post.replyCount ?? 0);
	});

	const handleReplyClick = (e: MouseEvent) => {
		e.stopPropagation();
		batch(() => {
			isReplying.value = !isReplying.value;
			submitError.value = null;
		});
	};

	const handleCancelReply = () => {
		batch(() => {
			isReplying.value = false;
			submitError.value = null;
		});
	};

	const handleSubmitReply = async (text: string) => {
		const currentState = atCuteState.peek();
		if (!currentState?.session) {
			submitError.value = "You must be logged in to reply.";
			console.error("Attempted reply submission without active session.");
			return;
		}

		batch(() => {
			isSubmitting.value = true;
			submitError.value = null;
		});

		try {
			await submitReply(post, text, currentState);
			handleCancelReply();

			let rootUri = post.uri;
			const record = post.record;
			if (isRecord(record) && record.reply?.root?.uri) {
				rootUri = record.reply.root.uri;
				if (rootUri) {
					fetchAndUpdateThreadSignal(rootUri).catch((err) => {
						console.error(
							`Error refreshing thread ${rootUri} after reply:`,
							err,
						);
					});
				}
			}
		} catch (error: unknown) {
			console.error("Failed to submit reply:", error);
			if (error instanceof Error) {
				submitError.value = error.message;
			} else {
				try {
					submitError.value = JSON.stringify(error);
				} catch {
					submitError.value = "An unknown, non-serializable error occurred.";
				}
			}
		} finally {
			isSubmitting.value = false;
		}
	};

	const handleLikeClick = async (e: MouseEvent) => {
		e.stopPropagation();
		if (!isLoggedIn || isLiking.value) return;

		const currentState = atCuteState.peek();
		if (!currentState?.session || !currentState?.xrpc) {
			console.error("Like action requires logged-in state with XRPC client.");
			actionError.value = "Login required.";
			return;
		}

		const currentLikeUri = localLikeUri.peek();
		const originalLikeCount = localLikeCount.peek();

		batch(() => {
			isLiking.value = true;
			actionError.value = null;
			if (currentLikeUri) {
				localLikeUri.value = undefined;
				localLikeCount.value = Math.max(0, originalLikeCount - 1);
			} else {
				localLikeUri.value = undefined;
				localLikeCount.value = originalLikeCount + 1;
			}
		});

		try {
			if (currentLikeUri) {
				await unlikePost(currentLikeUri, currentState);
				findAndUpdatePostInSignal(
					threadSignal,
					post.uri,
					(p: AppBskyFeedDefs.PostView) => ({
						...p,
						viewer: { ...p.viewer, like: undefined },
						likeCount: Math.max(0, (p.likeCount ?? 0) - 1),
					}),
				);
			} else {
				const likeResultUri = await likePost(post, currentState);
				batch(() => {
					localLikeUri.value = likeResultUri;
					findAndUpdatePostInSignal(
						threadSignal,
						post.uri,
						(p: AppBskyFeedDefs.PostView) => ({
							...p,
							viewer: { ...p.viewer, like: likeResultUri },
							likeCount: (p.likeCount ?? 0) + 1,
						}),
					);
				});
			}
		} catch (error: unknown) {
			console.error("Failed to like/unlike post:", error);
			batch(() => {
				localLikeUri.value = currentLikeUri;
				localLikeCount.value = originalLikeCount;
				actionError.value =
					error instanceof Error
						? error.message
						: "Failed to update like status.";
			});
		} finally {
			isLiking.value = false;
		}
	};

	const handleRepostClick = async (e: MouseEvent) => {
		e.stopPropagation();
		if (!isLoggedIn || isReposting.value) return;

		const currentState = atCuteState.peek();
		if (!currentState?.session || !currentState?.xrpc) {
			console.error("Repost action requires logged-in state with XRPC client.");
			actionError.value = "Login required.";
			return;
		}

		const currentRepostUri = localRepostUri.peek();
		const originalRepostCount = localRepostCount.peek();

		batch(() => {
			isReposting.value = true;
			actionError.value = null;
			if (currentRepostUri) {
				localRepostUri.value = undefined;
				localRepostCount.value = Math.max(0, originalRepostCount - 1);
			} else {
				localRepostUri.value = undefined;
				localRepostCount.value = originalRepostCount + 1;
			}
		});

		try {
			if (currentRepostUri) {
				await deleteRepost(currentRepostUri, currentState);
				findAndUpdatePostInSignal(
					threadSignal,
					post.uri,
					(p: AppBskyFeedDefs.PostView) => ({
						...p,
						viewer: { ...p.viewer, repost: undefined },
						repostCount: Math.max(0, (p.repostCount ?? 0) - 1),
					}),
				);
			} else {
				const repostResultUri = await repostPost(post, currentState);
				batch(() => {
					localRepostUri.value = repostResultUri;
					findAndUpdatePostInSignal(
						threadSignal,
						post.uri,
						(p: AppBskyFeedDefs.PostView) => ({
							...p,
							viewer: { ...p.viewer, repost: repostResultUri },
							repostCount: (p.repostCount ?? 0) + 1,
						}),
					);
				});
			}
		} catch (error: unknown) {
			console.error("Failed to repost/delete repost:", error);
			batch(() => {
				localRepostUri.value = currentRepostUri;
				localRepostCount.value = originalRepostCount;
				actionError.value =
					error instanceof Error
						? error.message
						: "Failed to update repost status.";
			});
		} finally {
			isReposting.value = false;
		}
	};

	return (
		<div className="mt-1">
			<div className="flex items-center gap-4 text-gray-500 text-sm">
				{post.replyCount !== undefined && post.replyCount > 0 && (
					<ExpandButton post={post} isExpanded={isExpanded} />
				)}
				{post.replyCount !== undefined && (
					<button
						onClick={handleReplyClick}
						className="flex items-center gap-1 hover:text-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
						aria-label="Reply"
						title="Reply"
						disabled={!isLoggedIn}
					>
						<Icon name="comment" className="w-3.5 h-3.5" />
						{formatCount(displayedReplyCount.value)}
					</button>
				)}
				{post.repostCount !== undefined && (
					<button
						onClick={handleRepostClick}
						className={`flex items-center gap-1 ${localRepostUri.value ? "text-green-500" : "hover:text-green-500"} disabled:opacity-50 disabled:cursor-not-allowed`}
						aria-label="Repost"
						title="Repost"
						disabled={!isLoggedIn || isReposting.value}
					>
						<Icon name="arrowPath" className="w-3.5 h-3.5" />
						{formatCount(localRepostCount.value)}
					</button>
				)}
				{post.likeCount !== undefined && (
					<button
						onClick={handleLikeClick}
						className={`flex items-center gap-1 ${localLikeUri.value ? "text-[#ec4899]" : "hover:text-[#ec4899]"} disabled:opacity-50 disabled:cursor-not-allowed`}
						aria-label="Like"
						title="Like"
						disabled={!isLoggedIn || isLiking.value}
					>
						<Icon
							name={localLikeUri.value ? "heartFilled" : "heart"}
							className={"w-3.5 h-3.5"}
						/>
						{formatCount(localLikeCount.value)}
					</button>
				)}
			</div>
			{isLoggedIn && isReplying.value && (
				<ReplyInput
					onCancel={handleCancelReply}
					onSubmit={handleSubmitReply}
					isSubmitting={isSubmitting}
					submitError={submitError}
				/>
			)}
			{actionError.value && (
				<p className="text-red-500 text-xs mt-1">{actionError.value}</p>
			)}
		</div>
	);
}
