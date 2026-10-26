import { useSignal } from "@preact/signals";
import { useEffect, useId, useRef } from "preact/hooks";
import {
	startLoginProcess,
	logout,
	atCuteState,
	isLoadingSession,
} from "@/demo/lib/oauth";
import { ProviderLogo } from "@/src/components/ProviderLogo";

const getStorageKey = (did: string) => `bskyUserHandle_${did}`;
const getAvatarStorageKey = (did: string) => `bskyUserAvatar_${did}`;

export function LoginButton() {
	const userHandle = useSignal<string | null>(null);
	const userAvatar = useSignal<string | null>(null);
	const isFetchingProfile = useSignal(false);
	const currentAtCute = atCuteState.value;
	const isDropdownOpen = useSignal(false);
	const accountRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const dropdownId = useId();

	useEffect(() => {
		const controller = new AbortController();
		isDropdownOpen.value = false;
		userHandle.value = null;
		userAvatar.value = null;
		isFetchingProfile.value = false;
		if (!currentAtCute) return;

		const did = currentAtCute.session.info.sub;
		const storageKey = getStorageKey(did);
		const avatarStorageKey = getAvatarStorageKey(did);
		try {
			userHandle.value = localStorage.getItem(storageKey);
			userAvatar.value = localStorage.getItem(avatarStorageKey);
		} catch { /* The profile cache is optional. */ }
		if (userHandle.value) return;

		isFetchingProfile.value = true;
		const fetchProfile = async () => {
			try {
				const { ok, data } = await currentAtCute.rpc.get("app.bsky.actor.getProfile", {
					params: { actor: did }, signal: controller.signal,
				});
				if (controller.signal.aborted || atCuteState.peek() !== currentAtCute) return;
				if (!ok) throw new Error(`Error fetching profile: ${data.error}`);

				userHandle.value = data.handle || null;
				userAvatar.value = data.avatar || null;
				try {
					if (data.handle) localStorage.setItem(storageKey, data.handle);
					else localStorage.removeItem(storageKey);
					if (data.avatar) localStorage.setItem(avatarStorageKey, data.avatar);
					else localStorage.removeItem(avatarStorageKey);
				} catch { /* Keep the fetched profile when storage is unavailable. */ }
			} catch (error) {
				if (controller.signal.aborted || atCuteState.peek() !== currentAtCute) return;
				console.error("Failed to fetch user profile handle:", error);
				if (error instanceof Error && error.message.includes("invalid_token")) logout();
			} finally {
				if (!controller.signal.aborted && atCuteState.peek() === currentAtCute) isFetchingProfile.value = false;
			}
		};
		fetchProfile();
		return () => controller.abort();
	}, [currentAtCute]);

	useEffect(() => {
		if (!isDropdownOpen.value) return;
		const controller = new AbortController();
		document.addEventListener("pointerdown", event => {
			if (!accountRef.current?.contains(event.target as Node)) isDropdownOpen.value = false;
		}, { signal: controller.signal });
		return () => controller.abort();
	}, [isDropdownOpen.value]);

	const handleSignIn = () => {
		startLoginProcess();
	};

	const displayName = currentAtCute
		? userHandle.value ||
			(isFetchingProfile.value ? "..." : currentAtCute.session.info.sub)
		: "";

	return (
		<>
			{currentAtCute ? (
				<div ref={accountRef} className="relative"
					onFocusOut={event => {
						if (!event.currentTarget.contains(event.relatedTarget as Node | null)) isDropdownOpen.value = false;
					}}
					onKeyDown={event => {
						if (event.key !== 'Escape' || !isDropdownOpen.value) return;
						event.preventDefault();
						event.stopPropagation();
						isDropdownOpen.value = false;
						triggerRef.current?.focus();
					}}>
					<button
						ref={triggerRef}
						onClick={() => {
							isDropdownOpen.value = !isDropdownOpen.value;
						}}
						className="flex min-h-10 min-w-10 items-center justify-center gap-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
						aria-label="Account menu"
						aria-expanded={isDropdownOpen.value}
						aria-controls={dropdownId}
					>
						{userAvatar.value ? (
							<img
								src={userAvatar.value}
								alt={displayName}
								className="w-8 h-8 rounded-full"
							/>
						) : (
							<div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
								{displayName ? displayName[0]?.toUpperCase() : "?"}
							</div>
						)}
					</button>
					{isDropdownOpen.value && (
						<div id={dropdownId} className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-1 z-50 min-w-[120px] w-max max-w-[min(16rem,calc(100vw-9rem))]">
							<div className="break-all px-3 py-2 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
								{displayName}
							</div>
							<button
								onClick={() => { void logout(); }}
								className="min-h-10 w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
							>
								Logout
							</button>
						</div>
					)}
				</div>
			) : (
				<button
					onClick={handleSignIn}
					className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-950 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 disabled:opacity-50 transition-colors"
					disabled={isLoadingSession.value}
					aria-label="Sign in with Bluesky"
				>
					<ProviderLogo provider="Bluesky" />
					<span className="hidden min-[360px]:inline">Sign in</span>
				</button>
			)}
		</>
	);
}
