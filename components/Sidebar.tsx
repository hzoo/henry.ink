import { useSignal, useSignalEffect } from "@preact/signals-react/runtime";
import { currentUrl, isWhitelisted, isSearchableUrl } from "@/lib/messaging";
import { LoadingItemList } from "@/components/LoadingItem";
import { ErrorMessage } from "@/components/ErrorMessage";
import { SidebarHeader } from "@/components/SidebarHeader";
import { EmptyList } from "@/components/EmptyList";
import { cacheTimeAgo } from "@/lib/signals";
import { autoFetchEnabled } from "@/lib/settings";
import { PostList } from "@/components/PostList";
import { searchBskyPosts } from "@/lib/bsky";
import { FirstTimePopup } from "@/components/FirstTimePopup";
import { QuotePopup } from "./QuotePopup";
import { quotedSelection } from "@/lib/messaging";
import { useQuery } from "@tanstack/react-query";
import { useRef } from "preact/hooks";

// Type for ErrorMessage prop
export type ErrorMessageType = string | { message: string; link: string };

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
	} = useQuery({
		queryKey: ['posts', currentUrl.value],
		queryFn: async ({ signal }) => {
			if (!currentUrl.value) return [];
			return (await searchBskyPosts(currentUrl.value, { signal })) || [];
		},
		enabled: isSearchableUrl.value && autoFetchEnabled.value && isWhitelisted.value,
		staleTime: 86400000, // 24 hours
		retry: (failureCount, err) => !err?.message?.startsWith(MY_AUTH_ERROR_MESSAGE) && failureCount < 3,
	});

	useSignalEffect(() => {
		const currentKey = currentUrl.value;
		if (currentKey !== prevQueryKey.current) {
			userDismissedError.value = false;
		} else if (queryIsError && queryError !== prevErrorInstance.current) {
			userDismissedError.value = false;
		}
		prevQueryKey.current = currentKey;
		prevErrorInstance.current = queryError;
		cacheTimeAgo.value = dataUpdatedAt || null;
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
								? { message: MY_AUTH_ERROR_MESSAGE, link: AUTH_ERROR_LINK }
								: queryError?.message || "Failed to fetch posts"
						}
						onDismiss={() => userDismissedError.value = true}
					/>
				) : !fetchedPostsData || fetchedPostsData.length === 0 ? (
					<EmptyList />
				) : (
					<PostList posts={fetchedPostsData} />
				)
			}
		</div>
	);
}

export function Sidebar() {
	return (
		<div className="flex flex-col h-full relative">
			<SidebarHeader />
			<SidebarBody />
			<FirstTimePopup />
			{quotedSelection.value && <QuotePopup />}
		</div>
	);
}
