import { useEffect } from "preact/hooks";
import { useSignal, useComputed } from "@preact/signals";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { now as tidNow } from "@atcute/tid";
import { useAtCute, atCuteState, isLoadingSession, startLoginProcess } from "@/demo/lib/oauth";
import { normalizeToAtUri } from "@/src/lib/atproto-helpers";
import { detectAtProtoRecord } from "@/src/lib/atproto-registry";
import { ensureInboxTrail } from "@/src/lib/trails-api";
import type { StoredTrail } from "@/api/trails/trail-storage";

interface QuickMarkProps {
	url: string;
	title?: string;
	text?: string;
}

export default function QuickMark() {
	const url = useSignal("");
	const title = useSignal("");
	const selectedText = useSignal("");
	const selectedTrail = useSignal("");
	const note = useSignal("");
	const isConverting = useSignal(false);
	const isConvertingAtProto = useSignal(false);
	const isCreatingNewTrail = useSignal(false);
	const newTrailName = useSignal("");
	const isEditingUrlTitle = useSignal(false);
	const detectedRecord = useComputed(() => {
		if (url.value.trim()) {
			return detectAtProtoRecord(url.value);
		}
		return null;
	});

	useAtCute(); // Initialize OAuth
	const session = atCuteState.value;
	const queryClient = useQueryClient();

	// Create clean display URL (remove protocol)
	const getDisplayUrl = (url: string) => {
		return url.replace(/^https?:\/\//, "");
	};

	// Handle URL changes and ensure protocol
	const handleUrlChange = (value: string) => {
		// Always store with protocol for form submission
		if (value && !value.match(/^https?:\/\//)) {
			url.value = `https://${value}`;
		} else {
			url.value = value;
		}
	};

	// Parse URL params on mount
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		url.value = params.get("url") || "";
		title.value = params.get("title") || "";
		selectedText.value = params.get("text") || "";
	}, []);

	// Fetch user's trails
	const { data: trails = [], isLoading: trailsLoading } = useQuery({
		queryKey: ["user-trails", session?.session?.info?.sub],
		queryFn: async () => {
			if (!session?.rpc) throw new Error("No session");

			const { ok, data } = await session.rpc.get(
				"com.atproto.repo.listRecords",
				{
					params: {
						repo: session.session.info.sub,
						collection: "ink.henry.annotate.trail",
						limit: 50,
					},
				},
			);

			if (!ok) throw new Error("Failed to fetch trails");

			return data.records
				.map((record) => ({
					uri: record.uri,
					name: record.value.name,
					description: record.value.description,
				}))
				.sort((a, b) => (a.name as string).localeCompare(b.name as string));
		},
		enabled: !!session?.rpc,
		staleTime: 0, // Always fetch fresh data
		refetchOnWindowFocus: true, // Refetch when user comes back to tab
		refetchOnMount: "always", // Always refetch on component mount
	});

	// Check for existing marks when URL changes
	const { data: existingTrails = [] } = useQuery({
		queryKey: ["existing-marks", url.value, session?.session?.info?.sub],
		queryFn: async (): Promise<Array<{uri: string; name: string; markCount: number}>> => {
			if (!url.value.trim() || !session?.session?.info?.sub) return [];
			
			// Use the URL as-is for the search (external URLs will be stored as external_url)
			let searchUrl = url.value.trim();
			
			// If it's an AT Protocol URL, also check the converted form
			const detectedRecord = detectAtProtoRecord(url.value);
			if (detectedRecord && session?.rpc) {
				// Resolve handle to DID and create proper AT-URI
				try {
					const { resolveHandle } = await import("@/src/lib/atproto-helpers");
					const did = await resolveHandle(detectedRecord.handle, session.rpc);
					if (did) {
						searchUrl = `at://${did}/${detectedRecord.collection}/${detectedRecord.rkey}`;
					}
				} catch (error) {
					console.error("Handle resolution failed:", error);
					// Fall back to original URL
				}
			}

			const response = await fetch(
				`/api/trails/containing?subject=${encodeURIComponent(searchUrl)}&author_did=${session.session.info.sub}`
			);
			
			if (!response.ok) return [];
			return await response.json() as Array<{uri: string; name: string; markCount: number}>;
		},
		enabled: !!url.value.trim() && !!session?.session?.info?.sub,
		staleTime: 60000, // Cache for 1 minute
	});

	// Auto-select trail with Inbox as fallback
	useEffect(() => {
		const selectTrail = async () => {
			if (session?.session?.info?.sub && !trailsLoading) {
				// If no trails exist, ensure Inbox is created
				if (trails.length === 0) {
					try {
						const inboxUri = await ensureInboxTrail(session);
						selectedTrail.value = inboxUri;
						// Force refetch trails to update UI immediately
						await queryClient.invalidateQueries({
							queryKey: ["user-trails", session.session.info.sub],
						});
						await queryClient.refetchQueries({
							queryKey: ["user-trails", session.session.info.sub],
						});
						return;
					} catch (error) {
						console.error("Failed to create Inbox trail:", error);
						return;
					}
				}

				// Only select a trail if none is currently selected
				if (!selectedTrail.value) {
					// Priority 1: Last used trail (if it still exists)
					const lastTrailKey = `lastTrail:${session.session.info.sub}`;
					const lastTrail = localStorage.getItem(lastTrailKey);
					if (lastTrail && trails.find((t) => t.uri === lastTrail)) {
						selectedTrail.value = lastTrail;
						return;
					}

					// Priority 2: Inbox trail (default)
					const inboxTrail = trails.find((t) => (t.name as string) === "Inbox");
					if (inboxTrail) {
						selectedTrail.value = inboxTrail.uri;
						return;
					}

					// Priority 3: First available trail
					if (trails.length > 0) {
						selectedTrail.value = trails[0].uri;
					}
				}
			}
		};

		selectTrail();
	}, [trails, session, queryClient, trailsLoading, selectedTrail.value]);

	// Initialize note with selected text
	useEffect(() => {
		if (selectedText.value) {
			note.value = selectedText.value;
		}
	}, [selectedText.value]);

	const createMarkMutation = useMutation({
		mutationFn: async () => {
			if (!session?.rpc || !selectedTrail.value || !url.value) {
				throw new Error("Missing required data");
			}
			
			// Check if we're trying to add to a trail that already has this URL
			const alreadyHasUrl = existingTrails.some(existing => existing.uri === selectedTrail.value);
			if (alreadyHasUrl) {
				throw new Error("You've already added this URL to this trail");
			}

			isConverting.value = true;

			// Smart URL conversion
			let subject: any;

			// Check if it's an AT Protocol URL using the detection function
			const detectedRecord = detectAtProtoRecord(url.value);
			if (detectedRecord) {
				isConvertingAtProto.value = true;
				try {
					const result = await normalizeToAtUri(url.value, session.rpc);
					if (result) {
						subject = {
							$type: "com.atproto.repo.strongRef",
							uri: result.atUri,
							cid: result.cid,
						};
					}
				} catch (error) {
					console.warn(
						"Failed to convert AT Protocol URL, using as external:",
						error,
					);
				} finally {
					isConvertingAtProto.value = false;
				}
			}

			// Fallback to external URL
			if (!subject) {
				subject = {
					uri: url.value,
					title: title.value || undefined,
				};
			}

			const rkey = tidNow().toString();
			const markRecord = {
				$type: "ink.henry.annotate.mark",
				trail: selectedTrail.value,
				subject,
				note: note.value.trim() || undefined,
				createdAt: new Date().toISOString(),
			};

			const { ok, data } = await session.rpc.post(
				"com.atproto.repo.createRecord",
				{
					input: {
						repo: session.session.info.sub,
						collection: "ink.henry.annotate.mark",
						rkey,
						record: markRecord,
					},
				},
			);

			if (!ok) {
				console.error("Create mark failed:", {
					error: data.error,
					message: data.message,
					record: markRecord,
					fullResponse: data,
				});
				throw new Error(`Failed to create mark: ${data.error || data.message || 'Unknown error'}`);
			}

			// Remember last used trail
			localStorage.setItem(
				`lastTrail:${session.session.info.sub}`,
				selectedTrail.value,
			);

			return data;
		},
		onSuccess: () => {
			// Notify parent window if opened as popup
			if (window.opener) {
				window.opener.postMessage("mark-saved", "*");
				window.close();
			}
		},
	});

	const createTrailMutation = useMutation({
		mutationFn: async (name: string) => {
			if (!session?.rpc) throw new Error("No session");

			const rkey = tidNow().toString();
			const trailRecord = {
				$type: "ink.henry.annotate.trail",
				name: name.trim(),
				createdAt: new Date().toISOString(),
			};

			const { ok, data: result } = await session.rpc.post(
				"com.atproto.repo.createRecord",
				{
					input: {
						repo: session.session.info.sub,
						collection: "ink.henry.annotate.trail",
						rkey,
						record: trailRecord,
					},
				},
			);

			if (!ok) {
				throw new Error(`Error creating trail: ${result.error}`);
			}

			const uri = `at://${session.session.info.sub}/ink.henry.annotate.trail/${rkey}`;
			return { uri, name: name.trim() };
		},
		onSuccess: (newTrail) => {
			// Set as selected trail and exit creation mode
			selectedTrail.value = newTrail.uri;
			isCreatingNewTrail.value = false;
			newTrailName.value = "";

			// Invalidate both Quick Mark trails and main trails page
			queryClient.invalidateQueries({
				queryKey: ["user-trails", session?.session?.info?.sub],
			});
			queryClient.invalidateQueries({ queryKey: ["trails"] }); // For /trails page
		},
	});

	// Keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				window.close();
			}
			if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
				e.preventDefault();
				if ((selectedTrail.value || newTrailName.value.trim()) && url.value.trim()) {
					handleSubmit(new Event("submit"));
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [selectedTrail.value, url.value, createMarkMutation]);

	const handleSubmit = async (e: Event) => {
		e.preventDefault();

		// If creating a new trail, create it first
		if (isCreatingNewTrail.value && newTrailName.value.trim()) {
			try {
				await createTrailMutation.mutateAsync(newTrailName.value);
				// The onSuccess callback will set selectedTrail
				// Then create the mark (will be handled by the mutation's onSuccess)
				setTimeout(() => createMarkMutation.mutate(), 100);
			} catch (error) {
				console.error("Failed to create trail:", error);
			}
		} else if (selectedTrail.value) {
			// Direct mark creation with existing trail
			createMarkMutation.mutate();
		}
	};

	// Show loading while session is being loaded
	if (isLoadingSession.value) {
		return (
			<div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
				<div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 max-w-sm w-full text-center">
					<div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
					<p className="text-sm text-gray-600 dark:text-gray-400">Loading...</p>
				</div>
			</div>
		);
	}

	// Show login if not authenticated
	if (!session) {
		return (
			<div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
				<div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 max-w-sm w-full text-center">
					<h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
						Sign in to add mark
					</h2>
					<p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
						You need to be signed in to save content to your trails.
					</p>
					<button
						onClick={startLoginProcess}
						className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
					>
						Sign in with Bluesky
					</button>
				</div>
			</div>
		);
	}

	const isSubmitting = createMarkMutation.isPending;
	const error = createMarkMutation.error;

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-3 flex items-start justify-center pt-8">
			<div className="w-full max-w-sm">
				<div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-4">
					<form onSubmit={handleSubmit}>
						{/* Header */}
						<div className="mb-3 flex justify-between items-start">
							<div className="flex-1">
								<h2 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-1">
									Add to Trail
								</h2>
							</div>
							<button
								type="button"
								onClick={() => window.close()}
								className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 -m-1"
								disabled={isSubmitting}
								title="Close (ESC)"
							>
								<svg
									className="w-4 h-4"
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
						</div>

						{/* URL/Title Card */}
						<div className="mb-3">
							{isEditingUrlTitle.value ? (
								<div className="space-y-2">
									{/* URL input */}
									<div>
										<label
											htmlFor="url"
											className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
										>
											{detectedRecord.value ? (
												<>
													URL (AT Protocol) 
													<span className="ml-2 text-green-600 dark:text-green-400">✓</span>
												</>
											) : (
												"URL (https)"
											)}
										</label>
										<input
											id="url"
											type="text"
											value={getDisplayUrl(url.value)}
											onChange={(e) =>
												handleUrlChange((e.target as HTMLInputElement).value)
											}
											placeholder="example.com/article"
											className={`w-full px-2 py-1.5 border-0 rounded text-xs font-mono placeholder-gray-500 dark:placeholder-gray-400 placeholder:text-xs focus:outline-none focus:shadow-sm transition-all ${
												detectedRecord.value
													? "bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-100 focus:bg-green-100 dark:focus:bg-green-800/30"
													: "bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:bg-white dark:focus:bg-gray-700"
											}`}
											disabled={isSubmitting}
											required
										/>
										{detectedRecord.value && (
											<div className="text-xs text-green-600 dark:text-green-400 mt-1">
												→ {detectedRecord.value.collection} record
											</div>
										)}
									</div>

									{/* Title input */}
									<div>
										<label
											htmlFor="title"
											className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
										>
											Title
										</label>
										<input
											id="title"
											type="text"
											value={title.value}
											onChange={(e) =>
												title.value = (e.target as HTMLInputElement).value
											}
											placeholder="Custom title for this mark"
											className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-900 border-0 rounded text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 placeholder:text-xs focus:outline-none focus:bg-white dark:focus:bg-gray-700 focus:shadow-sm transition-all"
											disabled={isSubmitting}
										/>
									</div>

									<button
										type="button"
										onClick={() => isEditingUrlTitle.value = false}
										className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
										disabled={isSubmitting}
									>
										Done editing
									</button>
								</div>
							) : (
								<div 
									className={`p-2 rounded border-2 border-dashed border-gray-200 dark:border-gray-600 cursor-pointer hover:border-gray-300 dark:hover:border-gray-500 transition-colors ${
										detectedRecord.value 
											? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700" 
											: "bg-gray-50 dark:bg-gray-800"
									}`}
									onClick={() => isEditingUrlTitle.value = true}
								>
									<div className="flex items-start justify-between gap-2">
										<div className="flex-1 min-w-0">
											<div className="text-xs font-medium text-gray-900 dark:text-gray-100 mb-1 truncate">
												{title.value || getDisplayUrl(url.value) || "Add URL"}
											</div>
											<div className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
												{getDisplayUrl(url.value)}
											</div>
											{detectedRecord.value && (
												<div className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
													<span>✓</span>
													<span>{detectedRecord.value.collection}</span>
												</div>
											)}
										</div>
										<button
											type="button"
											className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 -m-1 flex-shrink-0"
											disabled={isSubmitting}
											title="Edit URL and title"
										>
											<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
											</svg>
										</button>
									</div>
								</div>
							)}
						</div>

						{/* Existing marks notification */}
						{existingTrails.length > 0 && (
							<div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
								<p className="text-xs text-blue-800 dark:text-blue-200 mb-1">
									You've already added this URL to:
								</p>
								<div className="text-xs text-blue-600 dark:text-blue-300">
									{existingTrails.map((trail, index) => (
										<span key={trail.uri}>
											{trail.name}
											{index < existingTrails.length - 1 ? ', ' : ''}
										</span>
									))}
								</div>
								<p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
									You can still add it to a different trail below.
								</p>
							</div>
						)}

						{/* Trail selector */}
						<div className="mb-2">
							<label
								htmlFor="trail"
								className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
							>
								Trail
								<span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
									(saves to Inbox by default)
								</span>
							</label>
							{trailsLoading ? (
								<div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
									<div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
									Loading trails...
								</div>
							) : isCreatingNewTrail.value ? (
								<div className="space-y-2">
									<input
										type="text"
										value={newTrailName.value}
										onChange={(e) =>
											newTrailName.value = (e.target as HTMLInputElement).value
										}
										placeholder="Enter trail name..."
										className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-900 border-0 rounded text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 placeholder:text-xs focus:outline-none focus:bg-white dark:focus:bg-gray-700 focus:shadow-sm transition-all"
										disabled={createTrailMutation.isPending}
										onKeyDown={(e) => {
											if (e.key === "Enter" && newTrailName.value.trim()) {
												e.preventDefault();
												createTrailMutation.mutate(newTrailName.value);
											}
											if (e.key === "Escape") {
												isCreatingNewTrail.value = false;
												newTrailName.value = "";
											}
										}}
									/>
									<button
										type="button"
										onClick={() => {
											isCreatingNewTrail.value = false;
											newTrailName.value = "";
										}}
										className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
									>
										Cancel
									</button>
								</div>
							) : (
								<select
									id="trail"
									value={selectedTrail.value}
									onChange={(e) => {
										const value = (e.target as HTMLSelectElement).value;
										if (value === "__new__") {
											isCreatingNewTrail.value = true;
											selectedTrail.value = "";
										} else {
											selectedTrail.value = value;
										}
									}}
									className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-900 border-0 rounded text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:bg-white dark:focus:bg-gray-700 focus:shadow-sm transition-all"
									disabled={isSubmitting}
									required
								>
									{trails.length === 0 ? (
										<>
											<option value="">Inbox (default)</option>
											<option value="__new__">+ Create new trail</option>
										</>
									) : (
										<>
											<option value="__new__">+ Create new trail</option>
											{trails.map((trail) => {
												const alreadyHasUrl = existingTrails.some(existing => existing.uri === trail.uri);
												return (
													<option 
														key={trail.uri} 
														value={trail.uri}
														disabled={alreadyHasUrl}
														style={alreadyHasUrl ? { color: '#9CA3AF' } : {}}
													>
														{trail.name as string}{alreadyHasUrl ? ' ✓ (already added)' : ''}
													</option>
												);
											})}
										</>
									)}
								</select>
							)}
						</div>

						{/* Note field */}
						<div className="mb-2">
							<label
								htmlFor="note"
								className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
							>
								Note
							</label>
							<textarea
								id="note"
								value={note.value}
								onChange={(e) =>
									note.value = (e.target as HTMLTextAreaElement).value
								}
								placeholder="Add your thoughts..."
								rows={2}
								maxLength={300}
								className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-900 border-0 rounded text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 placeholder:text-xs focus:outline-none focus:bg-white dark:focus:bg-gray-700 focus:shadow-sm transition-all resize-none"
								disabled={isSubmitting}
							/>
							<div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
								{note.value.length}/300 characters
							</div>
						</div>

						{/* URL conversion status */}
						{isConvertingAtProto.value && (
							<div className="mb-2 p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800 text-xs">
								<div className="text-blue-600 dark:text-blue-400">
									Converting AT Protocol URL...
								</div>
							</div>
						)}

						{/* Error message */}
						{error && (
							<div className="mb-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
								<div className="text-xs text-red-600 dark:text-red-400">
									{error.message}
								</div>
							</div>
						)}

						{/* Actions */}
						<div className="mt-3">
							<button
								type="submit"
								className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed rounded transition-colors flex items-center justify-center gap-2"
								disabled={
									(!selectedTrail.value && !newTrailName.value.trim()) ||
									!url.value.trim() ||
									isSubmitting ||
									createTrailMutation.isPending
								}
							>
								{isSubmitting && (
									<div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
								)}
								Save Mark
								<span className="text-xs opacity-75 ml-1">⌘↵</span>
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
}
