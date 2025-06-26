import { useEffect } from "preact/hooks";
import { useRoute } from "preact-iso";
import { useQuery } from "@tanstack/react-query";
import { AppLayout, SidebarHeader, SidebarContent } from "@/src/components/AppLayout";
import { getProfile, getAuthorFeed } from "@/src/lib/bsky";
import { filterProfilePosts } from "@/src/lib/profileFilters";
import { ProfilePost } from "@/note-site/components/ProfilePost";


export function ProfilePage() {
	const route = useRoute();
	const username = route.params?.username as string;

	// Update page title
	useEffect(() => {
		document.title = `@${username}`;
	}, [username]);

	// Fetch profile data
	const profileQuery = useQuery({
		queryKey: ["profile", username],
		queryFn: () => getProfile(username),
		enabled: !!username,
	});

	// Fetch author feed
	const feedQuery = useQuery({
		queryKey: ["authorFeed", username],
		queryFn: () => getAuthorFeed(username),
		enabled: !!username,
	});

	// Filter posts to only show ones with links or quotes
	const filteredPosts = feedQuery.data?.feed 
		? filterProfilePosts(feedQuery.data.feed.map(item => item.post))
		: [];

	const profile = profileQuery.data;
	const isLoading = profileQuery.isLoading || feedQuery.isLoading;
	const error = profileQuery.error || feedQuery.error;

	return (
		<AppLayout
			sidebar={
				<>
					<SidebarHeader title="Profile Discussion" />
					<SidebarContent>
						<div class="text-center p-8 text-gray-500 dark:text-gray-400">
							Profile discussions coming soon...
						</div>
					</SidebarContent>
				</>
			}
		>
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
				<div class="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl">
					<div class="flex items-center">
						<svg
							class="w-5 h-5 mr-2"
							fill="currentColor"
							viewBox="0 0 20 20"
						>
							<path
								fillRule="evenodd"
								d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
								clipRule="evenodd"
							/>
						</svg>
						<span class="font-medium">Error:</span>
						<span class="ml-1">{error?.message || 'Failed to load profile'}</span>
					</div>
				</div>
			)}

			{profile && (
				<>
					{/* Profile Header */}
					<div class="mb-4 pb-6 border-b border-gray-200 dark:border-gray-700">
						<div class="flex items-start gap-4">
							{profile.avatar ? (
								<img
									src={profile.avatar}
									alt={profile.displayName || profile.handle}
									class="w-20 h-20 rounded-full object-cover bg-gray-100 dark:bg-gray-800"
								/>
							) : (
								<div class="w-20 h-20 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
									<svg class="w-10 h-10 text-gray-400 dark:text-gray-500" fill="currentColor" viewBox="0 0 20 20">
										<path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
									</svg>
								</div>
							)}
							<div class="flex-1 min-w-0">
								<h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
									{profile.displayName || profile.handle}
								</h1>
								<p class="text-gray-600 dark:text-gray-400 mb-3">
									@{profile.handle}
								</p>
								{profile.description && (
									<p class="text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap">
										{profile.description}
									</p>
								)}
								<div class="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
									<span>
										<span class="font-medium text-gray-900 dark:text-gray-100">
											{profile.followersCount || 0}
										</span>{" "}
										followers
									</span>
									<span>
										<span class="font-medium text-gray-900 dark:text-gray-100">
											{profile.followsCount || 0}
										</span>{" "}
										following
									</span>
									<span>
										<span class="font-medium text-gray-900 dark:text-gray-100">
											{profile.postsCount || 0}
										</span>{" "}
										posts
									</span>
								</div>
							</div>
						</div>
					</div>

					{/* Posts Section */}
					<div class="mb-2">
						<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
							Annotations
							<span class="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
								({filteredPosts.length} posts)
							</span>
						</h2>
					</div>

					{filteredPosts.length > 0 ? (
						<div class="space-y-1">
							{filteredPosts.map((post) => (
								<div key={post.uri} class="border border-gray-200 dark:border-gray-700 rounded-lg">
									<ProfilePost 
										post={post}
										displayItems={["avatar", "displayName", "handle"]}
									/>
								</div>
							))}
						</div>
					) : feedQuery.data && (
						<div class="text-center p-8 text-gray-500 dark:text-gray-400">
							<p class="text-lg mb-2">No posts with links + quotes found</p>
							<p class="text-sm">
								This user hasn't posted any content that combines both links and quotes yet.
							</p>
						</div>
					)}
				</>
			)}
		</AppLayout>
	);
}