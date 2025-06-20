import { useSignal, useSignalEffect } from "@preact/signals-react/runtime";
import {
	currentUrl,
	currentDomain,
	isAllowed,
	isSearchableUrl,
	isBlocked,
} from "@/src/lib/messaging";
import { LoadingItemList } from "@/src/components/LoadingItem";
import { ErrorMessage } from "@/src/components/ErrorMessage";
import { SidebarHeader } from "@/src/components/SidebarHeader";
import { EmptyList } from "@/src/components/EmptyList";
import { cacheTimeAgo, type ErrorState } from "@/src/lib/signals";
import { autoFetchEnabled } from "@/src/lib/settings";
import { PostList } from "@/src/components/PostList";
import { searchBskyPosts } from "@/src/lib/bsky";
import { FirstTimePopup } from "@/src/components/FirstTimePopup";
import { QuotePopup } from "./QuotePopup";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "preact/hooks";
import { useAtCute } from "@/site/lib/oauth";
import type { AppBskyFeedDefs } from "@atcute/bluesky";

// Constants for error handling
const MY_AUTH_ERROR_MESSAGE =
	"Bluesky search sometimes requires login due to high load. See:";
const AUTH_ERROR_LINK =
	"https://github.com/hzoo/extension-annotation-sidebar/issues/8";

function SidebarBody({ autoAllowDomain }: { autoAllowDomain?: string }) {
	const userDismissedError = useSignal(false);
	const prevQueryKey = useRef(currentUrl.value);
	const prevErrorInstance = useRef<unknown>(null);

	// Check if we're on the auto-allow domain
	const isAllowedWithOverride =
		autoAllowDomain && window.location.hostname === autoAllowDomain
			? true
			: isAllowed.value;

	const {
		data: fetchedPostsData,
		isLoading: queryIsLoading,
		isError: queryIsError,
		error: queryError,
		dataUpdatedAt,
	} = useQuery<AppBskyFeedDefs.PostView[] | undefined>({
		queryKey: ["posts", currentUrl.value],
		queryFn: async ({ signal }) => {
			if (!currentUrl.value) return [];
			return (await searchBskyPosts(currentUrl.value, { signal })) || [];
		},
		enabled:
			isSearchableUrl.value && autoFetchEnabled.value && isAllowedWithOverride,
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
			{queryIsLoading ? (
				<LoadingItemList />
			) : queryIsError && !userDismissedError.value ? (
				<ErrorMessage
					message={
						queryError?.message?.startsWith(MY_AUTH_ERROR_MESSAGE)
							? ({
									message: MY_AUTH_ERROR_MESSAGE,
									link: AUTH_ERROR_LINK,
								} as ErrorState)
							: ((queryError?.message || "Failed to fetch posts") as string)
					}
					onDismiss={() => (userDismissedError.value = true)}
				/>
			) : !fetchedPostsData ||
				fetchedPostsData.length === 0 ||
				isBlocked.value ? (
				<EmptyList autoAllowDomain={autoAllowDomain} />
			) : (
				<PostList posts={fetchedPostsData} />
			)}
		</div>
	);
}

export function Sidebar({
	hidePopup = false,
	autoAllowDomain,
}: {
	hidePopup?: boolean;
	autoAllowDomain?: string;
}) {
	useAtCute();

	return (
		<div className="flex flex-col h-svh relative">
			{!autoAllowDomain && <SidebarHeader />}
			<SidebarBody autoAllowDomain={autoAllowDomain} />
			{!hidePopup && <FirstTimePopup />}
			<QuotePopup />
		</div>
	);
}
