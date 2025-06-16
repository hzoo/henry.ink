import { useComputed, useSignal } from "@preact/signals-react";
import type { AppBskyFeedDefs } from "@atcute/bluesky";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ReplyInput } from "@/src/components/post/ReplyInput";
import { Icon } from "@/src/components/Icon";

import { atCuteState, type AtCuteState } from "@/site/lib/oauth";
import { formatCount } from "@/src/lib/utils/count";
import { submitReply } from "@/src/lib/postActions";
import { getRootPostUri } from "@/src/lib/threadUtils";

import { useLike } from "@/src/hooks/useLike";
import { useRepost } from "@/src/hooks/useRepost";

interface CompactPostActionsProps {
	post: AppBskyFeedDefs.PostView;
}

interface ReplyMutationVariables {
	text: string;
}

interface ReplyMutationResult {
	success: boolean;
}

export function CompactPostActions({ post }: CompactPostActionsProps) {
	const queryClient = useQueryClient();
	const isReplying = useSignal(false);
	const actionError = useSignal<string | null>(null);

	const state = atCuteState.value;
	const isLoggedIn = !!state?.session;

	const displayedReplyCount = useComputed(() => post.replyCount ?? 0);

	const onErrorCallback = (error: Error) => {
		actionError.value = error.message;
	};

	const {
		liked,
		likeCount,
		toggleLike,
		isPending: isLikePending,
	} = useLike({
		post,
		options: { onError: onErrorCallback },
	});
	const {
		reposted,
		repostCount,
		toggleRepost,
		isPending: isRepostPending,
	} = useRepost({
		post,
		options: { onError: onErrorCallback },
	});

	const replyMutation = useMutation<
		ReplyMutationResult,
		Error,
		ReplyMutationVariables
	>({
		mutationFn: async (variables: ReplyMutationVariables) => {
			actionError.value = null;
			const currentState = atCuteState.peek();
			if (!currentState?.session) {
				throw new Error("You must be logged in to reply.");
			}
			await submitReply(post, variables.text, currentState as AtCuteState);
			return { success: true };
		},
		onSuccess: () => {
			handleCancelReply();
			const rootUriToInvalidate = getRootPostUri(post);
			queryClient.invalidateQueries({
				queryKey: ["thread", rootUriToInvalidate],
			});
		},
		onError: (err: Error) => {
			actionError.value = err.message;
		},
	});

	const computedIsSubmitting = useComputed(() => replyMutation.isPending);
	const computedSubmitError = useComputed(
		() => replyMutation.error?.message || null,
	);

	const handleReplyClick = (e: MouseEvent) => {
		e.stopPropagation();
		isReplying.value = !isReplying.value;
		if (replyMutation.error) replyMutation.reset();
		actionError.value = null;
	};

	const handleCancelReply = () => {
		isReplying.value = false;
		if (replyMutation.error) replyMutation.reset();
		actionError.value = null;
	};

	const handleSubmitReply = async (text: string) => {
		try {
			await replyMutation.mutateAsync({ text });
		} catch (error) {
			// error is handled by replyMutation.error and displayed in ReplyInput
		}
	};

	const handleLikeClick = (e: MouseEvent) => {
		e.stopPropagation();
		if (!isLoggedIn || isLikePending) return;
		actionError.value = null;
		toggleLike();
	};

	const handleRepostClick = (e: MouseEvent) => {
		e.stopPropagation();
		if (!isLoggedIn || isRepostPending) return;
		actionError.value = null;
		toggleRepost();
	};

	const handleClearSubmitError = () => {
		replyMutation.reset();
		actionError.value = null;
	};

	return (
		<div className="mt-1">
			<div className="flex justify-between gap-4 text-gray-500 text-sm">
				<button
					onClick={handleReplyClick}
					className="flex items-center gap-1 hover:text-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
					aria-label="Reply"
					title="Reply"
					disabled={!isLoggedIn}
				>
					<Icon name="comment" className="w-3.5 h-3.5" />
					<span
						style={{
							visibility:
								displayedReplyCount.value === 0 ? "hidden" : "visible",
						}}
					>
						{formatCount(displayedReplyCount.value)}
					</span>
				</button>
				<button
					onClick={handleRepostClick}
					className={`flex items-center gap-1 ${reposted ? "text-green-500" : "hover:text-green-500"} ${isRepostPending ? "opacity-75" : ""} disabled:opacity-50 disabled:cursor-not-allowed`}
					aria-label="Repost"
					title="Repost"
					disabled={!isLoggedIn || isRepostPending}
				>
					<Icon name="arrowPath" className="w-3.5 h-3.5" />
					<span
						style={{
							visibility: (repostCount ?? 0) === 0 ? "hidden" : "visible",
						}}
					>
						{formatCount(repostCount ?? 0)}
					</span>
				</button>
				<button
					onClick={handleLikeClick}
					className={`flex items-center gap-1 ${liked ? "text-[#ec4899]" : "hover:text-[#ec4899]"} ${isLikePending ? "opacity-75" : ""} disabled:opacity-50 disabled:cursor-not-allowed`}
					aria-label="Like"
					title="Like"
					disabled={!isLoggedIn || isLikePending}
				>
					<Icon
						name={liked ? "heartFilled" : "heart"}
						className={"w-3.5 h-3.5"}
					/>
					<span
						style={{
							visibility: (likeCount ?? 0) === 0 ? "hidden" : "visible",
						}}
					>
						{formatCount(likeCount ?? 0)}
					</span>
				</button>
				<div />
			</div>
			{isLoggedIn && isReplying.value && (
				<ReplyInput
					onCancel={handleCancelReply}
					onSubmit={handleSubmitReply}
					isSubmitting={computedIsSubmitting}
					submitError={computedSubmitError}
					onClearError={handleClearSubmitError}
				/>
			)}
			{actionError.value && !computedSubmitError.value && (
				<p className="text-red-500 text-xs mt-1">{actionError.value}</p>
			)}
		</div>
	);
}
