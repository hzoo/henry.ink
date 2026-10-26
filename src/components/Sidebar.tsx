import {
	currentUrl,
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
import { useEffect } from "preact/hooks";
import { atCuteState, useAtCute } from "@/demo/lib/oauth";
import type { AppBskyFeedDefs } from "@atcute/bluesky";

// Constants for error handling
const MY_AUTH_ERROR_MESSAGE =
	"Bluesky search sometimes requires login due to high load. See:";
const AUTH_ERROR_LINK =
	"https://github.com/hzoo/extension-annotation-sidebar/issues/8";

function SidebarBody({ autoAllowDomain }: { autoAllowDomain?: string }) {
	const url = currentUrl.value;
	const state = atCuteState.value;
	const rpc = state?.rpc ?? null;
	// Check if we're on the auto-allow domain
	const isAllowedWithOverride =
		autoAllowDomain && window.location.hostname === autoAllowDomain
			? true
			: isAllowed.value;

	const {
		data: fetchedPostsData,
		isLoading: queryIsLoading,
		isFetching,
		isError: queryIsError,
		error: queryError,
		dataUpdatedAt,
		refetch,
	} = useQuery<AppBskyFeedDefs.PostView[] | undefined>({
		queryKey: ["posts", url, state?.session.info.sub ?? null],
		queryFn: async ({ signal }) => {
			if (!url) return [];
			return (await searchBskyPosts(url, { signal, rpc })) || [];
		},
		enabled:
			isSearchableUrl.value && autoFetchEnabled.value && isAllowedWithOverride,
		staleTime: Number.POSITIVE_INFINITY,
		gcTime: Number.POSITIVE_INFINITY,
	});

	useEffect(() => {
		cacheTimeAgo.value = dataUpdatedAt || null;
	}, [dataUpdatedAt]);

	const handleSearch = () => {
		if (isSearchableUrl.peek() && !isBlocked.peek()) void refetch();
	};

	return (
		<div className="flex-1 overflow-y-auto">
			{isBlocked.value ? <EmptyList autoAllowDomain={autoAllowDomain} onSearch={handleSearch} /> : <>
			{queryIsError && <div role="alert">
				<ErrorMessage
					message={
						queryError?.message?.startsWith(MY_AUTH_ERROR_MESSAGE)
							? ({
									message: MY_AUTH_ERROR_MESSAGE,
									link: AUTH_ERROR_LINK,
								} as ErrorState)
							: ((queryError?.message || "Failed to fetch posts") as string)
					}
				/>
				<button type="button" disabled={isFetching} onClick={handleSearch}
					className="mx-3 mb-3 min-h-10 rounded px-3 text-sm underline focus-visible:outline-2 focus-visible:outline-gray-500 disabled:opacity-50">Try again</button>
			</div>}
			{queryIsLoading ? (
				<LoadingItemList />
			) : fetchedPostsData?.length ? (
				<PostList posts={fetchedPostsData} />
			) : !queryIsError && <EmptyList autoAllowDomain={autoAllowDomain} onSearch={handleSearch} />}
			</>}
		</div>
	);
}

export function Sidebar({
	hidePopup = false,
	autoAllowDomain,
	hideQuotePopup = false,
}: {
	hidePopup?: boolean;
	autoAllowDomain?: string;
	hideQuotePopup?: boolean;
}) {
	useAtCute();

	return (
		<div className="flex flex-col h-full min-h-0 relative">
			{!autoAllowDomain && <SidebarHeader />}
			<SidebarBody autoAllowDomain={autoAllowDomain} />
			{!hidePopup && <FirstTimePopup />}
			{!hideQuotePopup && <QuotePopup />}
		</div>
	);
}
