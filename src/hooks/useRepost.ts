import type { AppBskyFeedDefs } from "@atcute/bluesky";
import type { ResourceUri } from "@atcute/lexicons";

import { useState, useEffect } from "preact/hooks";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { atCuteState, type AtCuteState } from "@/demo/lib/oauth";
import { repostPost, deleteRepost } from "@/src/lib/postActions";
import { updatePostActionCache } from "@/src/lib/queryClient";

interface UseRepostProps {
	post: AppBskyFeedDefs.PostView;
	options?: {
		onError?: (error: Error) => void;
	};
}

export function useRepost({ post, options }: UseRepostProps) {
	const queryClient = useQueryClient();
	const [reposted, setReposted] = useState(!!post.viewer?.repost);
	const [repostUri, setRepostUri] = useState(post.viewer?.repost);

	useEffect(() => {
		setReposted(!!post.viewer?.repost);
		setRepostUri(post.viewer?.repost);
	}, [post.viewer?.repost]);

	const repostCount =
		(reposted ? 1 : 0) -
		(post.viewer?.repost ? 1 : 0) +
		(post.repostCount || 0);

	const mutation = useMutation<{ uri?: ResourceUri }, Error>({
		mutationFn: async () => {
			const currentState = atCuteState.peek();
			if (!currentState?.session || !currentState?.rpc) {
				throw new Error("Login required to repost/unrepost.");
			}

			if (repostUri) {
				// Currently reposted, so delete repost
				setReposted(false);
				const previousRepostUri = repostUri;
				setRepostUri(undefined);
				try {
					await deleteRepost(previousRepostUri, currentState as AtCuteState);
					updatePostActionCache(queryClient, currentState.session.info.sub, post.uri, 'repost');
					return {};
				} catch (err) {
					setReposted(true); // Revert optimistic update
					setRepostUri(previousRepostUri); // Revert optimistic update
					throw err;
				}
			} else {
				// Currently not reposted, so repost
				setReposted(true);
				try {
					const result = await repostPost(post, currentState as AtCuteState);
					updatePostActionCache(queryClient, currentState.session.info.sub, post.uri, 'repost', result);
					setRepostUri(result);
					return { uri: result };
				} catch (err) {
					setReposted(false); // Revert optimistic update
					setRepostUri(undefined); // Revert optimistic update
					throw err;
				}
			}
		},
		onError: (error: Error) => {
			options?.onError?.(error);
		},
	});

	return {
		reposted,
		repostCount: Math.max(0, repostCount),
		toggleRepost: mutation.mutate,
		isPending: mutation.isPending,
	};
}
