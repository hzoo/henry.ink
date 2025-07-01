import { useSignal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import {
	startLoginProcess,
	logout,
	atCuteState,
	isLoadingSession,
} from "@/demo/lib/oauth";
import type { JSX } from "preact/jsx-runtime";
import { sleep } from "@/src/lib/utils/sleep";

const getStorageKey = (did: string) => `bskyUserHandle_${did}`;
const getAvatarStorageKey = (did: string) => `bskyUserAvatar_${did}`;

export function LoginButton() {
	const userHandle = useSignal<string | null>(null);
	const userAvatar = useSignal<string | null>(null);
	const isFetchingProfile = useSignal(false);
	const prevAtCuteValue = useRef(atCuteState.value);
	const currentAtCute = atCuteState.value;
	const isDropdownOpen = useSignal(false);

	useEffect(() => {
		if (!currentAtCute) {
			userHandle.value = null;
			userAvatar.value = null;
		} else {
			const did = currentAtCute.session.info.sub;
			const cachedHandle = localStorage.getItem(getStorageKey(did));
			const cachedAvatar = localStorage.getItem(getAvatarStorageKey(did));

			if (cachedHandle) {
				userHandle.value = cachedHandle;
			} else {
				userHandle.value = null;
			}

			if (cachedAvatar) {
				userAvatar.value = cachedAvatar;
			} else {
				userAvatar.value = null;
			}
		}
		prevAtCuteValue.current = currentAtCute;
	}, [currentAtCute, userHandle, userAvatar]);

	useEffect(() => {
		if (currentAtCute && !isFetchingProfile.value && !userHandle.value) {
			const did = currentAtCute.session.info.sub;
			const storageKey = getStorageKey(did);

			const fetchProfile = async () => {
				isFetchingProfile.value = true;
				try {
					await sleep(100);
					const { ok, data } = await currentAtCute.rpc.get(
						"app.bsky.actor.getProfile",
						{
							params: { actor: did },
						},
					);

					if (!ok) {
						throw new Error(`Error fetching profile: ${data.error}`);
					}

					const fetchedHandle = data.handle;
					const fetchedAvatar = data.avatar;
					const avatarStorageKey = getAvatarStorageKey(did);

					if (fetchedHandle) {
						userHandle.value = fetchedHandle;
						userAvatar.value = fetchedAvatar || null;
						localStorage.setItem(storageKey, fetchedHandle);

						if (fetchedAvatar) {
							localStorage.setItem(avatarStorageKey, fetchedAvatar);
						} else {
							localStorage.removeItem(avatarStorageKey);
						}
					} else {
						localStorage.removeItem(storageKey);
						localStorage.removeItem(avatarStorageKey);
					}
				} catch (error) {
					console.error("Failed to fetch user profile handle:", error);
					const avatarStorageKey = getAvatarStorageKey(did);
					localStorage.removeItem(storageKey);
					localStorage.removeItem(avatarStorageKey);
					if (
						error instanceof Error &&
						error.message.includes("invalid_token")
					) {
						console.error(
							"Authentication error detected during profile fetch, logging out.",
						);
						logout();
					}
				} finally {
					isFetchingProfile.value = false;
				}
			};
			fetchProfile();
		}
	}, [currentAtCute, isFetchingProfile, userHandle, userAvatar]);

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (isDropdownOpen.value) {
				isDropdownOpen.value = false;
			}
		};

		if (isDropdownOpen.value) {
			document.addEventListener("click", handleClickOutside);
			return () => document.removeEventListener("click", handleClickOutside);
		}
	}, [isDropdownOpen.value]);

	const handleSignIn = () => {
		startLoginProcess("");
	};

	const handleLogout = () => {
		if (currentAtCute) {
			const did = currentAtCute.session.info.sub;
			localStorage.removeItem(getStorageKey(did));
			localStorage.removeItem(getAvatarStorageKey(did));
		}
		logout();
	};

	const displayName = currentAtCute
		? userHandle.value ||
			(isFetchingProfile.value ? "..." : currentAtCute.session.info.sub)
		: "";

	return (
		<>
			{currentAtCute ? (
				<div className="relative">
					<button
						onClick={(e) => {
							e.stopPropagation();
							isDropdownOpen.value = !isDropdownOpen.value;
						}}
						className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
						aria-label="Account menu"
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
						<div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-1 z-50 min-w-[120px]">
							<div className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
								{displayName}
							</div>
							<button
								onClick={handleLogout}
								className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
							>
								Logout
							</button>
						</div>
					)}
				</div>
			) : (
				<button
					onClick={handleSignIn}
					className="flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-blue-400 text-white rounded-md hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500/80 disabled:opacity-50 transition-colors"
					disabled={isLoadingSession.value}
					aria-label="Sign in with Bluesky"
				>
					<span className="text-base">🦋</span>
					Sign in
				</button>
			)}
		</>
	);
}
