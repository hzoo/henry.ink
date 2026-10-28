import { useEffect } from "preact/hooks";
import { useRoute } from "preact-iso";
import { useQuery } from "@tanstack/react-query";
import { getProfile, getAuthorFeed } from "@/src/lib/bsky";
import { filterProfilePosts } from "@/src/lib/profileFilters";
import { ProfilePost } from "@/henry-ink/components/ProfilePost";
import { ProfileHeader } from "@/src/components/ProfileHeader";
import { atCuteState, useAtCute } from "@/demo/lib/oauth";

export function ProfilePage() {
	const routeInfo = useRoute();
	const username = routeInfo.params?.username as string;
	const state = atCuteState.value;
	const rpc = state?.rpc ?? null;

	useAtCute();

	// Update page title reactively
	useEffect(() => {
		if (!username) return;
		document.title = `${username} | henry.ink`;
	}, [username]);

	// Fetch profile data
	const profileQuery = useQuery({
		queryKey: ["profile", username, state?.session.info.sub ?? null],
		queryFn: ({ signal }) => getProfile(username, { signal, rpc }),
		enabled: !!username,
		staleTime: 60 * 1000,
	});

	// Fetch author feed
	const feedQuery = useQuery({
		queryKey: ["authorFeed", username, state?.session.info.sub ?? null],
		queryFn: ({ signal }) => getAuthorFeed(username, { signal, rpc }),
		enabled: !!username,
		staleTime: 60 * 1000,
	});

	// Filter posts to only show ones with links or quotes
	const filteredPosts = feedQuery.data?.feed 
		? filterProfilePosts(feedQuery.data.feed.map(item => item.post))
		: [];

	const profile = profileQuery.data;
	const isLoading = profileQuery.isLoading || feedQuery.isLoading;
	const error = profileQuery.error || feedQuery.error;

	// Regular profile view - centered layout like GitHub
	return (
		<div className="min-h-screen bg-white dark:bg-gray-900">
			<div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<a href="/" className="mb-4 inline-flex min-h-10 items-center rounded text-sm text-gray-600 hover:text-gray-950 focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-gray-400 dark:hover:text-white">Home</a>
			{isLoading && (
				<div class="text-center p-8 flex flex-col items-center justify-center space-y-2">
					<div class="inline-flex items-center px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
						<svg
							class="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								strokeWidth="4"
							/>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							/>
						</svg>
						Loading profile...
					</div>
				</div>
			)}

				{error && (
					<div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl">
						<div className="flex items-center">
							<svg
								className="w-5 h-5 mr-2"
								fill="currentColor"
								viewBox="0 0 20 20"
							>
								<path
									fillRule="evenodd"
									d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
									clipRule="evenodd"
								/>
							</svg>
							<span className="font-medium">Error:</span>
							<span className="ml-1">{error?.message || 'Failed to load profile'}</span>
						</div>
						<button type="button" disabled={profileQuery.isFetching || feedQuery.isFetching}
							onClick={() => {
								if (profileQuery.isError) void profileQuery.refetch();
								if (feedQuery.isError) void feedQuery.refetch();
							}}
							className="mt-2 inline-flex min-h-10 items-center rounded px-3 text-sm font-medium hover:bg-red-200 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 dark:hover:bg-red-900/50">Try again</button>
					</div>
				)}

				{profile && (
					<>
						{/* Profile Header */}
						<ProfileHeader 
							profile={profile}
						/>

						{/* Posts Section */}
						<div className="mb-3 sm:mb-4">
							<h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
								Annotations in recent activity
								{feedQuery.data && <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
									({filteredPosts.length} posts)
								</span>}
							</h2>
						</div>

						{filteredPosts.length > 0 ? (
							<div className="space-y-2 sm:space-y-1">
								{filteredPosts.map((post) => (
									<div key={post.uri} className="border border-gray-200 dark:border-gray-700 rounded-lg">
										<ProfilePost 
											post={post}
											displayItems={["avatar", "displayName", "handle"]}
										/>
									</div>
								))}
							</div>
						) : feedQuery.data && (
							<div className="text-center p-8 text-gray-500 dark:text-gray-400">
								<p className="text-lg">No annotations found in recent activity.</p>
							</div>
						)}

					</>
				)}
			</div>
		</div>
	);
}
