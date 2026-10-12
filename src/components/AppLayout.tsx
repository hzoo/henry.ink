import { useEffect, useId, useLayoutEffect, useRef } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { signal, useSignal } from "@preact/signals";
import { useQueryClient } from "@tanstack/react-query";
import { LoginButton } from "@/src/components/LoginButton";
import { ReaderIcon } from "@/src/components/ReaderIcon";
import { quotedSelection, showCommentDialog, currentUrl } from "@/src/lib/messaging";
import { showQuotePopupOnSelection } from "@/src/lib/settings";
import SelectionPopupManagerV2 from "@/extension/entrypoints/popup.content/SelectionPopupManagerV2";
import {
	searchAndSaveArenaChannels,
	showArenaToast,
} from "@/src/lib/arena/arenaSearch";
import { arenaQueryKeys } from "@/src/lib/arena-api";
import { contentStateSignal, contentModeSignal } from "@/henry-ink/signals";

// UI state signals
const sidebarWidth = signal(384);
const isResizing = signal(false);
const isMobileSidebarOpen = signal(false);


interface AppLayoutProps {
	children: ComponentChildren;
	sidebar: ComponentChildren;
}

const clampSidebarWidth = (width: number) =>
	Math.min(600, Math.max(384, width));

const saveSidebarWidth = () => {
	try {
		localStorage.setItem("sidebar-width", sidebarWidth.peek().toString());
	} catch {
		// Resizing still works when browser storage is unavailable.
	}
};

export function AppLayout({ children, sidebar }: AppLayoutProps) {
	const mockContainerRef = useRef<HTMLDivElement>(null);
	const sidebarRef = useRef<HTMLElement>(null);
	const toggleRef = useRef<HTMLButtonElement>(null);
	const mobileSidebarHeaderRef = useRef<HTMLDivElement>(null);
	const resizeHandleRef = useRef<HTMLDivElement>(null);
	const restoreViewportFocusRef = useRef(false);
	const resizeControllerRef = useRef<AbortController | null>(null);
	const sidebarId = useId();
	const desktopSidebarOpen = useSignal(true);
	const isDesktop = useSignal(
		typeof window !== "undefined" &&
			window.matchMedia("(min-width: 1024px)").matches,
	);
	const queryClient = useQueryClient();
	const showHeader = Boolean(currentUrl.value?.trim());
	const mobileOpen = !isDesktop.value && isMobileSidebarOpen.value;
	const sidebarClosed = isDesktop.value ? !desktopSidebarOpen.value : !mobileOpen;
	const quote = quotedSelection.value;
	const comment = showCommentDialog.value;

	useEffect(() => {
		try {
			const width = Number(localStorage.getItem("sidebar-width"));
			if (Number.isFinite(width) && width >= 384 && width <= 600) {
				sidebarWidth.value = width;
			}
		} catch {
			// Keep the default width when browser storage is unavailable.
		}

		const controller = new AbortController();
		window.addEventListener('henry:show-article', () => { isMobileSidebarOpen.value = false; }, { signal: controller.signal });
		const media = window.matchMedia("(min-width: 1024px)");
		const updateViewport = () => {
			if (isDesktop.peek() !== media.matches) {
				const active = document.activeElement;
				const panelWillClose = !media.matches || !desktopSidebarOpen.peek();
				restoreViewportFocusRef.current = Boolean(
					(panelWillClose && sidebarRef.current?.contains(active)) ||
					(!media.matches && resizeHandleRef.current === active) ||
					(media.matches && mobileSidebarHeaderRef.current?.contains(active)) ||
					(media.matches && !currentUrl.peek()?.trim() && toggleRef.current === active),
				);
			}
			isDesktop.value = media.matches;
			isMobileSidebarOpen.value = false;
			resizeControllerRef.current?.abort();
			isResizing.value = false;
		};
		updateViewport();
		media.addEventListener("change", updateViewport, {
			signal: controller.signal,
		});

		return () => {
			controller.abort();
			resizeControllerRef.current?.abort();
			isResizing.value = false;
			isMobileSidebarOpen.value = false;
		};
	}, [isDesktop]);

	useLayoutEffect(() => {
		if (!restoreViewportFocusRef.current) return;
		restoreViewportFocusRef.current = false;
		const target = showHeader || !isDesktop.value ? toggleRef.current : sidebarRef.current;
		target?.focus({ preventScroll: true });
	}, [isDesktop.value, showHeader]);

	// Observe composition requests, not panel visibility: closing Notes must stay closed.
	useEffect(() => {
		if (!quote && !comment) return;
		if (isDesktop.peek()) desktopSidebarOpen.value = true;
		else isMobileSidebarOpen.value = true;
	}, [quote, comment, isDesktop, desktopSidebarOpen]);

	useEffect(() => {
		if (!mobileOpen) return;
		const controller = new AbortController();
		const panel = sidebarRef.current;
		panel?.focus();

		document.addEventListener(
			"keydown",
			(event) => {
				if (event.key === "Escape") {
					event.preventDefault();
					isMobileSidebarOpen.value = false;
				} else if (event.key === "Tab" && panel) {
					const controls = Array.from(
						panel.querySelectorAll<HTMLElement>(
							"a[href], button, input, select, textarea, summary, [tabindex]",
						),
					).filter(
						(element) =>
							element.tabIndex >= 0 &&
							!element.matches(":disabled") &&
							!element.closest("[inert]") &&
							element.getClientRects().length > 0,
					);
					const first = controls[0];
					const last = controls[controls.length - 1];
					if (!first || !last) {
						event.preventDefault();
						panel.focus();
					} else if (
						event.shiftKey &&
						(document.activeElement === first ||
							document.activeElement === panel)
					) {
						event.preventDefault();
						last.focus();
					} else if (
						!event.shiftKey &&
						(document.activeElement === last ||
							document.activeElement === panel)
					) {
						event.preventDefault();
						first.focus();
					}
				}
			},
			{ signal: controller.signal },
		);

		return () => {
			controller.abort();
			if (!isDesktop.peek()) toggleRef.current?.focus();
		};
	}, [mobileOpen, isDesktop]);

	const handlePointerDown = (event: PointerEvent) => {
		if (event.button !== 0 || !event.isPrimary) return;
		event.preventDefault();
		resizeControllerRef.current?.abort();
		const controller = new AbortController();
		resizeControllerRef.current = controller;
		const handle = event.currentTarget as HTMLElement;
		const pointerId = event.pointerId;
		const startX = event.clientX;
		const startWidth = sidebarWidth.peek();
		handle.setPointerCapture(pointerId);
		isResizing.value = true;

		const finish = () => {
			controller.abort();
			if (handle.hasPointerCapture(pointerId))
				handle.releasePointerCapture(pointerId);
			isResizing.value = false;
			saveSidebarWidth();
		};
		window.addEventListener(
			"pointermove",
			(move) => {
				if (move.pointerId === pointerId) {
					sidebarWidth.value = clampSidebarWidth(
						startWidth + startX - move.clientX,
					);
				}
			},
			{ signal: controller.signal },
		);
		window.addEventListener(
			"pointerup",
			(up) => {
				if (up.pointerId === pointerId) finish();
			},
			{ signal: controller.signal },
		);
		window.addEventListener(
			"pointercancel",
			(cancel) => {
				if (cancel.pointerId === pointerId) finish();
			},
			{ signal: controller.signal },
		);
		handle.addEventListener("lostpointercapture", finish, {
			signal: controller.signal,
		});
		window.addEventListener("blur", finish, { signal: controller.signal });
	};

	const modeButtonClass = (active: boolean) =>
		`inline-flex items-center justify-center gap-2 min-h-10 px-3 text-xs font-medium rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-gray-500 disabled:opacity-50 ${
			active
				? "bg-white shadow-sm text-gray-950 dark:bg-gray-700 dark:text-white"
				: "text-gray-500 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white"
		}`;

	return (
		<div class="flex h-dvh flex-col overflow-hidden text-gray-900 dark:text-gray-100 antialiased">
			{!showHeader && (
				<button
					ref={toggleRef}
					type="button"
					aria-controls={sidebarId}
					aria-expanded={mobileOpen}
					inert={mobileOpen}
					onClick={() =>
						(isMobileSidebarOpen.value = !isMobileSidebarOpen.value)
					}
					class="fixed right-4 top-4 z-20 inline-flex items-center gap-2 min-h-10 rounded-lg bg-white px-3 text-xs font-medium text-gray-700 focus-visible:outline-2 focus-visible:outline-gray-500 dark:bg-gray-900 dark:text-gray-300 lg:hidden"
				>
					<ReaderIcon name="panel" /> Notes
				</button>
			)}
			{showHeader && (
				<header
					inert={mobileOpen}
					class="relative z-20 shrink-0 border-b border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-900 sm:px-6"
				>
					<div class="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-0 py-1">
						<a
							href="https://henry.ink"
							class="shrink-0 font-serif text-lg font-semibold hover:text-blue-600 dark:hover:text-blue-400"
						>
							Henry's Note
						</a>
						<div class="ml-auto flex shrink-0 items-center gap-2 sm:order-3">
							<LoginButton />
							<button
								ref={toggleRef}
								type="button"
								aria-controls={sidebarId}
								aria-expanded={!sidebarClosed}
								aria-label={sidebarClosed ? 'Open notes' : 'Close notes'}
								title={sidebarClosed ? 'Open notes' : 'Close notes'}
								onClick={() =>
									isDesktop.value ? (desktopSidebarOpen.value = !desktopSidebarOpen.value) : (isMobileSidebarOpen.value = !isMobileSidebarOpen.value)
								}
								class={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-gray-500 ${sidebarClosed ? 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800' : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'}`}
							>
								<ReaderIcon name="panel" />
								Notes
							</button>
						</div>
						<nav
							aria-label="Reader view"
							class="flex w-full items-center gap-1 sm:w-auto"
						>
							{contentModeSignal.value !== "embed" && (
								<div class="flex items-center rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800" role="group" aria-label="Article appearance">
									<button
										type="button"
										aria-pressed={contentModeSignal.value === "archive"}
										disabled={contentStateSignal.value.type !== "success"}
										onClick={() => (contentModeSignal.value = "archive")}
										class={modeButtonClass(
											contentModeSignal.value === "archive",
										)}
									>
										<ReaderIcon name="layout" /> Original
									</button>
									<button
										type="button"
										aria-pressed={contentModeSignal.value === "md"}
										disabled={contentStateSignal.value.type !== "success"}
										onClick={() => (contentModeSignal.value = "md")}
										class={modeButtonClass(contentModeSignal.value === "md")}
									>
										<ReaderIcon name="text" /> Text
									</button>
								</div>
							)}
							<a
								href={currentUrl.value}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex min-h-10 items-center gap-1 rounded-md px-3 text-xs text-gray-500 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-gray-400 dark:hover:text-blue-400"
							>
								Source
								<svg
									aria-hidden="true"
									class="h-3 w-3"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeWidth={2}
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M14 3h7v7m0-7L10 14M10 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-5"
									/>
								</svg>
							</a>
						</nav>
					</div>
				</header>
			)}
			<div class="flex min-h-0 flex-1 overflow-hidden">
				<main
					inert={mobileOpen}
					class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
				>
					<div
						ref={mockContainerRef}
						class="flex min-h-0 flex-1 flex-col overflow-auto overscroll-contain"
					>
						<div
							class={
								contentModeSignal.value === "archive"
									? "flex min-h-0 w-full flex-1 flex-col"
									: "flex w-full min-w-0 flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8 lg:py-6"
							}
						>
							{children}
						</div>
					</div>
				</main>
				<div
						ref={resizeHandleRef}
					role="separator"
					tabIndex={0}
					aria-label="Resize notes panel"
					aria-orientation="vertical"
					aria-controls={sidebarId}
					aria-valuemin={384}
					aria-valuemax={600}
					aria-valuenow={sidebarWidth.value}
					class={`relative z-50 hidden w-1 shrink-0 touch-none cursor-col-resize bg-gray-100 hover:bg-gray-300 focus-visible:bg-gray-300 focus-visible:outline-2 focus-visible:outline-gray-500 dark:bg-gray-800 ${sidebarClosed ? '' : 'lg:block'} ${isResizing.value ? "!bg-gray-400" : ""}`}
					onPointerDown={handlePointerDown}
					onKeyDown={(event) => {
						const offsets: Record<string, number> = {
							ArrowLeft: 16,
							ArrowRight: -16,
						};
						if (
							event.key in offsets ||
							event.key === "Home" ||
							event.key === "End"
						) {
							event.preventDefault();
							sidebarWidth.value =
								event.key === "Home"
									? 384
									: event.key === "End"
										? 600
										: clampSidebarWidth(
												sidebarWidth.peek() + offsets[event.key],
											);
							saveSidebarWidth();
						}
					}}
				/>
				{mobileOpen && (
					<button
						type="button"
						tabIndex={-1}
						aria-label="Close notes"
						class="fixed inset-0 z-30 cursor-default bg-gray-900/40 lg:hidden"
						onClick={() => (isMobileSidebarOpen.value = false)}
					/>
				)}
				<aside
					ref={sidebarRef}
					id={sidebarId}
					tabIndex={-1}
					role={mobileOpen ? "dialog" : undefined}
					aria-modal={mobileOpen ? true : undefined}
					aria-label="Notes and discussions"
					aria-hidden={sidebarClosed ? true : undefined}
					inert={sidebarClosed}
					class={`fixed inset-y-0 right-0 z-40 w-full max-w-[min(28rem,100vw)] flex-col overflow-hidden border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 lg:static lg:max-w-none lg:shrink-0 ${sidebarClosed ? "hidden" : "flex"}`}
					style={
						isDesktop.value ? { width: `${sidebarWidth.value}px` } : undefined
					}
				>
						<div ref={mobileSidebarHeaderRef} class="flex min-h-10 shrink-0 items-center justify-between border-b border-gray-200 px-4 dark:border-gray-700 lg:hidden">
						<span class="text-sm font-semibold">Notes</span>
						<button
							type="button"
							class="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-gray-500 dark:hover:bg-gray-800"
							aria-label="Close notes"
							title="Close notes"
							onClick={() => (isMobileSidebarOpen.value = false)}
						>
							<ReaderIcon name="close" />
						</button>
					</div>
					{sidebar}
				</aside>
				{isResizing.value && (
					<div
						class="fixed inset-0 z-40 cursor-col-resize select-none"
						aria-hidden="true"
					/>
				)}
			</div>

			{/* Single SelectionPopupManagerV2 for the entire app */}
			<SelectionPopupManagerV2
				canShowPopup={() => showQuotePopupOnSelection.peek()}
				actions={[
					{
						title: "Quote",
						shortcut: "q",
						onClick: () => {
							const selection = window.getSelection()?.toString();
							if (!selection) return;
							quotedSelection.value = selection;
						},
					},
					{
						title: "Arena",
						shortcut: "a",
						onClick: async () => {
							const selection = window.getSelection()?.toString();
							if (!selection) return;
							const result = await searchAndSaveArenaChannels(selection);
							showArenaToast(result, selection);

							// Invalidate Arena matches query to show new channels immediately
							if (result.success && result.channelCount > 0) {
								queryClient.invalidateQueries({
									queryKey: arenaQueryKeys.matches(currentUrl.value || null),
								});
							}
						},
					},
				]}
				targetContainerRef={mockContainerRef}
			/>
		</div>
	);
}

// Sidebar component exports for composition
export const SidebarHeader = ({
	title,
	onRefresh,
	showRefresh = false,
	refreshTitle,
	cacheTimeAgo,
}: {
	title: string;
	onRefresh?: () => void;
	showRefresh?: boolean;
	refreshTitle?: string;
	cacheTimeAgo?: string;
}) => {
	return (
		<div class="flex-shrink-0 px-4 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
			{showRefresh && onRefresh ? (
				<button
					onClick={onRefresh}
					class="min-h-10 text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide hover:text-gray-800 dark:hover:text-gray-200 transition-colors cursor-pointer flex flex-col items-start justify-center group"
					aria-label={refreshTitle || "Refresh"}
					title={refreshTitle || "Refresh"}
				>
					<div class="flex items-center gap-1.5">
						<span>{title}</span>
						<svg
							class="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							/>
						</svg>
					</div>
					{cacheTimeAgo && (
						<span
							class="text-xs text-gray-400 dark:text-gray-500 normal-case tracking-normal font-normal"
							title="These discussions were saved to show you results faster. Click to refresh and get the latest posts."
						>
							{cacheTimeAgo}
						</span>
					)}
				</button>
			) : (
				<div class="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
					{title}
				</div>
			)}
			{/* Close button - only shows on mobile when sidebar is open */}
			{isMobileSidebarOpen.value && (
				<button
					class="lg:hidden min-h-10 min-w-10 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
					onClick={() => (isMobileSidebarOpen.value = false)}
					aria-label="Close sidebar"
				>
					<svg
						class="w-5 h-5"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			)}
		</div>
	);
};

export const SidebarContent = ({
	children,
}: {
	children: ComponentChildren;
}) => {
	return <div class="flex-1 min-h-0 overflow-hidden">{children}</div>;
};
