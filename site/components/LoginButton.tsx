import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { useAtCute, startLoginProcess, logout } from "@/site/lib/oauth";
import type { JSX } from "preact/jsx-runtime";

export function LoginButton() {
	const handleInput = useSignal("");
	const { state: atCute, isLoading } = useAtCute();
	const userHandle = useSignal<string | null>(null);
	const isFetchingProfile = useSignal(false);

	useEffect(() => {
		if (atCute && !userHandle.value && !isFetchingProfile.value) {
			const fetchProfile = async () => {
				isFetchingProfile.value = true;
				try {
					const profile = await atCute.xrpc.get('app.bsky.actor.getProfile', {
						params: { actor: atCute.session.info.sub },
					});
					if (profile?.data?.handle) {
						userHandle.value = profile.data.handle;
					}
				} catch (error) {
					console.error("Failed to fetch user profile handle:", error);
				} finally {
					isFetchingProfile.value = false;
				}
			};
			fetchProfile();
		} else if (!atCute) {
			userHandle.value = null;
		}
	}, [atCute, userHandle, isFetchingProfile]);

	const handleSubmit = (e: JSX.TargetedEvent<HTMLFormElement, Event>) => {
		e.preventDefault();
		startLoginProcess(handleInput.value.trim());
	};

	if (isLoading) {
		return <span class="text-xs text-gray-500 dark:text-gray-400">Loading...</span>;
	}

	if (atCute) {
		const userInfo = atCute.session.info;
		const displayName = userHandle.value || userInfo.sub;

		return (
			<div class="flex items-center gap-2">
				<span 
					class="px-2.5 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full dark:bg-blue-900 dark:text-blue-300"
					title={userInfo.sub}
				>
					{displayName}
				</span>
				<button
					onClick={logout}
					class="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-md hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900/80 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-red-500/50 transition-colors"
					aria-label="Logout"
				>
					Logout
				</button>
			</div>
		);
	}

	return (
		<form onSubmit={handleSubmit} class="flex items-center gap-1">
			<input
				type="text"
				value={handleInput}
                onInput={(e) => handleInput.value = (e.target as HTMLInputElement).value}
				placeholder="yourname.bsky.social"
				required
				class="px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
				aria-label="Bluesky Handle"
			/>
			<button
				type="submit"
				class="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500/80"
			>
				Login
			</button>
		</form>
	);
} 