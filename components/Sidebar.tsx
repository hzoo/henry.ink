import { useSignal, useSignalEffect } from "@preact/signals-react/runtime";
import { currentUrl, isAllowed, isSearchableUrl, isBlocked } from "@/lib/messaging";
import { LoadingItemList } from "@/components/LoadingItem";
import { ErrorMessage } from "@/components/ErrorMessage";
import { SidebarHeader } from "@/components/SidebarHeader";
import { EmptyList } from "@/components/EmptyList";
import { cacheTimeAgo, type ErrorState } from "@/lib/signals";
import { autoFetchEnabled } from "@/lib/settings";
import { PostList } from "@/components/PostList";
import { searchBskyPosts } from "@/lib/bsky";
import { FirstTimePopup } from "@/components/FirstTimePopup";
import { QuotePopup } from "./QuotePopup";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "preact/hooks";
import { useAtCute } from "@/site/lib/oauth";
import type { AppBskyFeedDefs } from "@atcute/bluesky";

// Constants for error handling
const MY_AUTH_ERROR_MESSAGE = "Bluesky search sometimes requires login due to high load. See:";
const AUTH_ERROR_LINK = 'https://github.com/hzoo/extension-annotation-sidebar/issues/8';

function SidebarBody() {
	const userDismissedError = useSignal(false);
	const prevQueryKey = useRef(currentUrl.value);
	const prevErrorInstance = useRef<unknown>(null);

	const {
		data: fetchedPostsData,
		isLoading: queryIsLoading,
		isError: queryIsError,
		error: queryError,
		dataUpdatedAt,
	} = useQuery<AppBskyFeedDefs.PostView[] | undefined>({
		queryKey: ['posts', currentUrl.value],
		queryFn: async ({ signal }) => {
			if (!currentUrl.value) return [];
			return (await searchBskyPosts(currentUrl.value, { signal })) || [];
		},
		enabled: isSearchableUrl.value && autoFetchEnabled.value && isAllowed.value,
		staleTime: Number.POSITIVE_INFINITY,
		gcTime: Number.POSITIVE_INFINITY,
	});

	useEffect(() => {
		cacheTimeAgo.value = dataUpdatedAt || null;
	}, [dataUpdatedAt]);

	useSignalEffect(() => {
		const currentKey = currentUrl.value;
		if (currentKey !== prevQueryKey.current) {
			userDismissedError.value = false;
		} else if (queryIsError && queryError !== prevErrorInstance.current) {
			userDismissedError.value = false;
		}
		prevQueryKey.current = currentKey;
		prevErrorInstance.current = queryError;
	});

	return (
		<div className="flex-1 overflow-y-auto">
			{
				queryIsLoading ? (
					<LoadingItemList />
				) : queryIsError && !userDismissedError.value ? (
					<ErrorMessage
						message={
							queryError?.message?.startsWith(MY_AUTH_ERROR_MESSAGE)
								? { message: MY_AUTH_ERROR_MESSAGE, link: AUTH_ERROR_LINK } as ErrorState
								: (queryError?.message || "Failed to fetch posts") as string
						}
						onDismiss={() => userDismissedError.value = true}
					/>
				) : !fetchedPostsData || fetchedPostsData.length === 0 || isBlocked.value ? (
					<EmptyList />
				) : (
					<PostList posts={fetchedPostsData} />
				)
			}
		</div>
	);
}

export function Sidebar() {
	useAtCute();

	return (
		<div className="flex flex-col h-svh relative">
			<SidebarHeader />
			<SidebarBody />
			<FirstTimePopup />
			<QuotePopup />
		</div>
	);
}
