import { batch, useComputed, useSignal } from "@preact/signals-react";
import type { AppBskyFeedDefs, At } from "@atcute/client/lexicons";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ReplyInput } from "@/components/post/ReplyInput";
import { Icon } from "@/components/Icon";

import { atCuteState, type AtCuteState } from "@/site/lib/oauth";
import { formatCount } from "@/lib/utils/count";
import {
	submitReply,
	likePost,
	unlikePost,
	repostPost,
	deleteRepost,
	isRecord,
} from "@/lib/postActions";
import type { ThreadReply } from "@/lib/types";

interface CompactPostActionsProps {
	post: AppBskyFeedDefs.PostView;
}

interface ProcessedThreadData {
	post: AppBskyFeedDefs.PostView;
	replies: ThreadReply[];
}

interface ActionMutationContext {
	previousThreadData?: ProcessedThreadData;
	queryKey: string[];
}

interface LikeMutationResult {
	liked: boolean;
	newLikeUri?: At.ResourceUri;
}

interface RepostMutationResult {
	reposted: boolean;
	newRepostUri?: At.ResourceUri;
}

interface ReplyMutationVariables {
	text: string;
}

interface ReplyMutationResult {
	success: boolean;
}

function getRootPostUri(post: AppBskyFeedDefs.PostView): string {
	if (isRecord(post.record) && post.record.reply?.root?.uri) {
		return post.record.reply.root.uri;
	}
	return post.uri;
}

export function CompactPostActions({ post }: CompactPostActionsProps) {
	const queryClient = useQueryClient();
	const isReplying = useSignal(false);
	const actionError = useSignal<string | null>(null);

	const state = atCuteState.value;
	const isLoggedIn = !!state?.session;

	const displayedReplyCount = useComputed(() => post.replyCount ?? 0);

	const likeMutation = useMutation<
		LikeMutationResult,
		Error,
		void,
		ActionMutationContext
	>({
		mutationFn: async () => {
			actionError.value = null;
			const currentState = atCuteState.peek();
			if (!currentState?.session || !currentState?.rpc) {
				throw new Error("Login required to like/unlike.");
			}
			if (post.viewer?.like) {
				await unlikePost(post.viewer.like, currentState as AtCuteState);
				return { liked: false, newLikeUri: undefined };
			}
			const likeResultUri = await likePost(post, currentState as AtCuteState);
			return { liked: true, newLikeUri: likeResultUri };
		},
		onError: (err: Error) => {
			actionError.value = err.message;
		},
		onSettled: () => {
			const rootUri = getRootPostUri(post);
			const queryKey = ["thread", rootUri];
			queryClient.invalidateQueries({ queryKey });
		},
	});

	const repostMutation = useMutation<
		RepostMutationResult,
		Error,
		void,
		ActionMutationContext
	>({
		mutationFn: async () => {
			actionError.value = null;
			const currentState = atCuteState.peek();
			if (!currentState?.session || !currentState?.rpc) {
				throw new Error("Login required to repost/unrepost.");
			}
			if (post.viewer?.repost) {
				await deleteRepost(post.viewer.repost, currentState as AtCuteState);
				return { reposted: false, newRepostUri: undefined };
			}
			const repostResultUri = await repostPost(
				post,
				currentState as AtCuteState,
			);
			return { reposted: true, newRepostUri: repostResultUri };
		},
		onError: (err: Error) => {
			actionError.value = err.message;
		},
		onSettled: () => {
			const rootUri = getRootPostUri(post);
			const queryKey = ["thread", rootUri];
			queryClient.invalidateQueries({ queryKey });
		},
	});

	const replyMutation = useMutation<
		ReplyMutationResult,
		Error,
		ReplyMutationVariables,
		void
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
	};

	const handleCancelReply = () => {
		isReplying.value = false;
		if (replyMutation.error) replyMutation.reset();
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
		if (!isLoggedIn || likeMutation.isPending) return;
		likeMutation.mutate();
	};

	const handleRepostClick = (e: MouseEvent) => {
		e.stopPropagation();
		if (!isLoggedIn || repostMutation.isPending) return;
		repostMutation.mutate();
	};

	const handleClearSubmitError = () => {
		replyMutation.reset();
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
					className={`flex items-center gap-1 ${post.viewer?.repost ? "text-green-500" : "hover:text-green-500"} disabled:opacity-50 disabled:cursor-not-allowed`}
					aria-label="Repost"
					title="Repost"
					disabled={!isLoggedIn || repostMutation.isPending}
				>
					<Icon name="arrowPath" className="w-3.5 h-3.5" />
					<span
						style={{
							visibility: (post.repostCount ?? 0) === 0 ? "hidden" : "visible",
						}}
					>
						{formatCount(post.repostCount ?? 0)}
					</span>
				</button>
				<button
					onClick={handleLikeClick}
					className={`flex items-center gap-1 ${post.viewer?.like ? "text-[#ec4899]" : "hover:text-[#ec4899]"} disabled:opacity-50 disabled:cursor-not-allowed`}
					aria-label="Like"
					title="Like"
					disabled={!isLoggedIn || likeMutation.isPending}
				>
					<Icon
						name={post.viewer?.like ? "heartFilled" : "heart"}
						className={"w-3.5 h-3.5"}
					/>
					<span
						style={{
							visibility: (post.likeCount ?? 0) === 0 ? "hidden" : "visible",
						}}
					>
						{formatCount(post.likeCount ?? 0)}
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
			{actionError.value && !replyMutation.error && (
				<p className="text-red-500 text-xs mt-1">{actionError.value}</p>
			)}
		</div>
	);
}
