import { useState, useEffect } from "preact/hooks";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AppBskyFeedDefs } from "@atcute/bluesky";
import type { ResourceUri } from "@atcute/lexicons";

import { atCuteState, type AtCuteState } from "@/site/lib/oauth";
import { likePost, unlikePost } from "@/src/lib/postActions";
import { getRootPostUri } from "@/src/lib/threadUtils"; // Assuming getRootPostUri is moved or accessible

interface UseLikeProps {
	post: AppBskyFeedDefs.PostView;
	options?: {
		onError?: (error: Error) => void;
	};
}

export function useLike({ post, options }: UseLikeProps) {
	const queryClient = useQueryClient();
	const [liked, setLiked] = useState(!!post.viewer?.like);
	const [likeUri, setLikeUri] = useState(post.viewer?.like);

	// Effect to update local state if the post prop changes (e.g., due to cache update)
	useEffect(() => {
		setLiked(!!post.viewer?.like);
		setLikeUri(post.viewer?.like);
	}, [post.viewer?.like]);

	const likeCount =
		(liked ? 1 : 0) - (post.viewer?.like ? 1 : 0) + (post.likeCount || 0);

	const mutation = useMutation<{ uri?: ResourceUri }, Error>({
		mutationFn: async () => {
			const currentState = atCuteState.peek();
			if (!currentState?.session || !currentState?.rpc) {
				throw new Error("Login required to like/unlike.");
			}

			if (likeUri) {
				// Currently liked, so unlike
				setLiked(false);
				// Store current likeUri in case of error
				const previousLikeUri = likeUri;
				setLikeUri(undefined);
				try {
					await unlikePost(previousLikeUri, currentState as AtCuteState);
					return {};
				} catch (err) {
					setLiked(true); // Revert optimistic update
					setLikeUri(previousLikeUri); // Revert optimistic update
					throw err;
				}
			} else {
				// Currently not liked, so like
				setLiked(true);
				try {
					const result = await likePost(post, currentState as AtCuteState);
					setLikeUri(result); // Set the new like URI
					return { uri: result };
				} catch (err) {
					setLiked(false); // Revert optimistic update
					setLikeUri(undefined); // Revert optimistic update
					throw err;
				}
			}
		},
		onSettled: () => {
			const rootUri = getRootPostUri(post);
			queryClient.invalidateQueries({ queryKey: ["thread", rootUri] });
			queryClient.refetchQueries({ queryKey: ["thread", rootUri] });
		},
		onError: (error: Error) => {
			options?.onError?.(error);
		},
	});

	return {
		liked,
		likeCount: Math.max(0, likeCount), // Ensure count doesn't go negative
		toggleLike: mutation.mutate,
		isPending: mutation.isPending,
	};
}
