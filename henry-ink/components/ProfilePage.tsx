import { useEffect } from "preact/hooks";
import { useComputed } from "@preact/signals";
import { useRoute } from "preact-iso";
import { useQuery } from "@tanstack/react-query";
// Removed AppLayout to create centered layout like GitHub profile
import { getProfile, getAuthorFeed } from "@/src/lib/bsky";
import { filterProfilePosts } from "@/src/lib/profileFilters";
import { ProfilePost } from "@/henry-ink/components/ProfilePost";
import { TrailDetail } from "@/src/components/TrailDetail";
import { ProfileTrails } from "@/src/components/ProfileTrails";
import { ProfileHeader } from "@/src/components/ProfileHeader";
import { useAtCute, atCuteState } from "@/demo/lib/oauth";
import { 
  updatePageTitle, 
  setCurrentUser, 
  currentUserDid
} from "@/src/lib/trails-signals";


export function ProfilePage() {
	const routeInfo = useRoute();
	const username = routeInfo.params?.username as string;
	const rkey = routeInfo.params?.rkey as string;
	const path = routeInfo.path;

	useAtCute(); // Initialize OAuth for trail functionality

	// Determine what we're showing based on the path
	const isTrailsView = path.includes('/trails');
	const isSpecificTrail = path.includes('/trail/') && rkey;

	// Check if username is a DID or handle
	const isDidFormat = useComputed(() => username?.startsWith('did:') || false);

	// Update page title reactively
	useEffect(() => {
		if (!username) return;
		
		if (isTrailsView) {
			updatePageTitle(`@${username}'s Trails | henry.ink`);
		} else if (isSpecificTrail) {
			updatePageTitle(`@${username}'s Trail | henry.ink`);
		} else {
			updatePageTitle(`@${username} | Henry's Note`);
		}
	}, [username, isTrailsView, isSpecificTrail]);

	// Fetch profile data
	const profileQuery = useQuery({
		queryKey: ["profile", username],
		queryFn: () => getProfile(username),
		enabled: !!username,
	});

	// Set current user in signals when profile loads
	useEffect(() => {
		if (profileQuery.data?.did) {
			setCurrentUser(profileQuery.data.did, username);
		} else if (isDidFormat.value && username) {
			setCurrentUser(username, username);
		}
	}, [profileQuery.data, username]);

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

	// For trail routes, redirect to main profile since trails are now shown there
	if (isTrailsView) {
		// Use window.location for redirect
		useEffect(() => {
			if (username) {
				window.location.href = `/profile/${username}`;
			}
		}, [username]);
		
		return (
			<div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full mx-auto mb-4"></div>
					<p className="text-gray-600 dark:text-gray-400">Redirecting to profile...</p>
				</div>
			</div>
		);
	}

	if (isSpecificTrail) {
		// Use signal-based current user DID
		const trailUri = useComputed(() => 
			currentUserDid.value ? `at://${currentUserDid.value}/ink.henry.annotate.trail/${rkey}` : null
		);
		
		// Don't render until we have the DID
		if (!trailUri.value) {
			return (
				<div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
					<div className="text-center">
						<div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full mx-auto mb-4"></div>
						<p className="text-gray-600 dark:text-gray-400">Loading trail...</p>
					</div>
				</div>
			);
		}
		
		return (
			<div className="min-h-screen bg-white dark:bg-gray-900">
				<div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
					<div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
						<div className="flex items-center gap-3">
							<a
								href={`/profile/${username}`}
								className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-1"
							>
								<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
								</svg>
								Back to Profile
							</a>
						</div>
					</div>
				</div>
				<div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
					<TrailDetail 
						trailUri={trailUri.value}
						session={atCuteState.value}
					/>
				</div>
			</div>
		);
	}

	// Regular profile view - centered layout like GitHub
	return (
		<div className="min-h-screen bg-white dark:bg-gray-900">
			<div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
					</div>
				)}

				{profile && (
					<>
						{/* Profile Header */}
						<ProfileHeader 
							profile={profile}
							username={username}
						/>

						{/* Trails Section */}
						{currentUserDid.value && (
							<ProfileTrails />
						)}

						{/* Posts Section */}
						<div className="mb-3 sm:mb-4">
							<h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
								Annotations
								<span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
									({filteredPosts.length} posts)
								</span>
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
								<p className="text-lg mb-2">No posts with links + quotes found</p>
								<p className="text-sm">
									This user hasn't posted any content that combines both links and quotes yet.
								</p>
							</div>
						)}

					</>
				)}
			</div>
		</div>
	);
}