/**
 * Unified API client for trails operations
 * Integrates with signals for reactive updates and centralized caching
 */
import { queryClient } from "@/src/lib/queryClient";

// API base URL
const apiUrl = import.meta.env.VITE_API_URL || '';
import type { TrailView } from "@/api/trails/types";
import {
	setTrailsData,
	setTrailsLoading,
	setTrailsError,
	clearTrailsError,
	currentTrailData,
	addTrail,
	updateTrail,
	removeTrail,
	setProfileTrailsCount,
} from "@/src/lib/trails-signals";

// === FETCH OPERATIONS ===

// Fetch all trails with optional filtering and sorting
export const fetchAllTrails = async (
	params: {
		search?: string;
		limit?: number;
		offset?: number;
		author_did?: string;
	} = {},
) => {
	try {
		setTrailsLoading(true);
		clearTrailsError();

		const queryParams = new URLSearchParams();
		if (params.search?.trim()) queryParams.set("search", params.search.trim());
		if (params.limit) queryParams.set("limit", params.limit.toString());
		if (params.offset) queryParams.set("offset", params.offset.toString());
		if (params.author_did) queryParams.set("author_did", params.author_did);

		const response = await fetch(`${apiUrl}/api/trails?${queryParams.toString()}`);
		if (!response.ok) {
			throw new Error(`Failed to fetch trails: ${response.statusText}`);
		}

		const trails = (await response.json()) as TrailView[];
		setTrailsData(trails);

		return trails;
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Failed to fetch trails";
		setTrailsError(errorMessage);
		throw error;
	} finally {
		setTrailsLoading(false);
	}
};

// Fetch user's trails with hybrid PDS/API approach
export const fetchUserTrails = async (
	authorDid: string,
	username: string,
	session?: any,
	usePDS: boolean = false,
): Promise<TrailView[]> => {
	try {
		setTrailsLoading(true);
		clearTrailsError();

		let trails: TrailView[];

		if (usePDS && session?.rpc) {
			// Fetch directly from PDS for own trails (real-time but no mark counts)
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

			if (!ok) throw new Error("Failed to fetch trails from PDS");

			trails = data.records
				.map(
					(record: any): TrailView => ({
						uri: record.uri,
						cid: record.cid,
						name: record.value.name,
						description: record.value.description,
						creator: {
							did: session.session.info.sub,
							handle: username,
							displayName: undefined,
							avatar: undefined,
						},
						markCount: 0, // PDS doesn't provide mark counts
						indexedAt: new Date().toISOString(),
						createdAt: record.value.createdAt,
					}),
				)
				.sort((a: TrailView, b: TrailView) => a.name.localeCompare(b.name));
		} else {
			// Use API for mark counts and other users
			const params = new URLSearchParams({
				author_did: authorDid,
				limit: "50",
			});

			const response = await fetch(`${apiUrl}/api/trails?${params.toString()}`);
			if (!response.ok) {
				throw new Error(`Failed to fetch trails: ${response.statusText}`);
			}
			trails = (await response.json()) as TrailView[];
		}

		// Update signals
		setTrailsData(trails);
		setProfileTrailsCount(trails.length);

		return trails;
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Failed to fetch trails";
		setTrailsError(errorMessage);
		throw error;
	} finally {
		setTrailsLoading(false);
	}
};

// Fetch specific trail with marks
export const fetchTrailDetail = async (
	trailUri: string,
	session?: any,
	markLimit: number = 25, // Increased for grid display
	markOffset: number = 0,
) => {
	try {
		setTrailsLoading(true);
		clearTrailsError();

		const isOwnTrail =
			session?.session?.info?.sub &&
			trailUri.includes(session.session.info.sub);
		let trailData;

		if (isOwnTrail && session?.rpc) {
			// Hybrid approach: Get trail from PDS, marks from API
			const rkey = trailUri.split("/").pop();
			const [trailResponse, marksResponse] = await Promise.all([
				// Fetch trail from PDS
				session.rpc.get("com.atproto.repo.getRecord", {
					params: {
						repo: session.session.info.sub,
						collection: "ink.henry.annotate.trail",
						rkey: rkey,
					},
				}),
				// Fetch marks from API
				fetch(
					`${apiUrl}/api/trails/${encodeURIComponent(trailUri)}?limit=${markLimit}&offset=${markOffset}`,
				),
			]);

			if (!trailResponse.ok) {
				throw new Error("Failed to fetch trail from PDS");
			}

			if (!marksResponse.ok) {
				throw new Error("Failed to fetch marks from API");
			}

			const apiData = (await marksResponse.json()) as { marks: any[] };
			const pdsTrail = trailResponse.data.value;

			trailData = {
				trail: {
					uri: trailUri,
					cid: trailResponse.data.cid || '',
					name: pdsTrail.name,
					description: pdsTrail.description,
					creator: {
						did: session.session.info.sub,
						handle: session.session.info.handle || '',
						displayName: session.session.info.displayName,
						avatar: session.session.info.avatar,
					},
					markCount: apiData.marks?.length || 0,
					indexedAt: new Date().toISOString(),
					createdAt: pdsTrail.createdAt,
				},
				marks: apiData.marks || [],
			};
		} else {
			// Fallback to full API
			const response = await fetch(
				`${apiUrl}/api/trails/${encodeURIComponent(trailUri)}?limit=${markLimit}&offset=${markOffset}`,
			);
			if (!response.ok) {
				throw new Error(`Failed to fetch trail: ${response.statusText}`);
			}
			trailData = await response.json();
		}

		// Update signal
		currentTrailData.value = trailData as { trail: any; marks: any[] };

		return trailData as { trail: any; marks: any[] };
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Failed to fetch trail detail";
		setTrailsError(errorMessage);
		throw error;
	} finally {
		setTrailsLoading(false);
	}
};

// === TRAIL OPERATIONS ===

// Create trail (via AT Protocol RPC)
export const createTrail = async (
	session: any,
	name: string,
	description?: string,
): Promise<TrailView> => {
	if (!session?.rpc) {
		throw new Error("Authentication required");
	}

	try {
		const trailData = {
			$type: "ink.henry.annotate.trail",
			name: name.trim(),
			description: description?.trim() || undefined,
			createdAt: new Date().toISOString(),
		};

		const { ok, data } = await session.rpc.post(
			"com.atproto.repo.createRecord",
			{
				data: {
					repo: session.session.info.sub,
					collection: "ink.henry.annotate.trail",
					record: trailData,
				},
			},
		);

		if (!ok) {
			throw new Error("Failed to create trail");
		}

		// Create optimistic trail view
		const newTrail: TrailView = {
			uri: data.uri,
			cid: data.cid,
			name: trailData.name,
			description: trailData.description,
			creator: {
				did: session.session.info.sub,
				handle: session.session.info.handle,
				displayName: session.session.info.displayName,
				avatar: session.session.info.avatar,
			},
			markCount: 0,
			indexedAt: new Date().toISOString(),
			createdAt: trailData.createdAt,
		};

		// Optimistic update
		addTrail(newTrail);
		setProfileTrailsCount(
			currentTrailData.value ? (currentTrailData.value.trail.markCount || 0) + 1 : 1,
		);

		return newTrail;
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Failed to create trail";
		setTrailsError(errorMessage);
		throw error;
	}
};

// Ensure "Inbox" trail exists for user, create if needed
export const ensureInboxTrail = async (session: any): Promise<string> => {
	if (!session?.rpc) {
		throw new Error("Authentication required");
	}

	try {
		// First, try to fetch existing trails to check for Inbox
		const { ok, data } = await session.rpc.get("com.atproto.repo.listRecords", {
			params: {
				repo: session.session.info.sub,
				collection: "ink.henry.annotate.trail",
				limit: 100, // Increased limit to ensure we find Inbox if it exists
			},
		});

		if (ok) {
			// Look for existing Inbox trail
			const inboxTrail = data.records.find(
				(record: any) => record.value.name === "Inbox",
			);

			if (inboxTrail) {
				return inboxTrail.uri;
			}
		}

		// No Inbox trail found, create one
		const trailData = {
			$type: "ink.henry.annotate.trail",
			name: "Inbox",
			description: "Default collection for quick annotations",
			createdAt: new Date().toISOString(),
		};

		const createResponse = await session.rpc.post(
			"com.atproto.repo.createRecord",
			{
				data: {
					repo: session.session.info.sub,
					collection: "ink.henry.annotate.trail",
					record: trailData,
				},
			},
		);

		if (!createResponse.ok) {
			throw new Error("Failed to create Inbox trail");
		}

		// Create optimistic trail view for cache
		const newTrail: TrailView = {
			uri: createResponse.data.uri,
			cid: createResponse.data.cid,
			name: trailData.name,
			description: trailData.description,
			creator: {
				did: session.session.info.sub,
				handle: session.session.info.handle,
				displayName: session.session.info.displayName,
				avatar: session.session.info.avatar,
			},
			markCount: 0,
			indexedAt: new Date().toISOString(),
			createdAt: trailData.createdAt,
		};

		// Optimistic update
		addTrail(newTrail);

		return createResponse.data.uri;
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Failed to ensure Inbox trail";
		console.error("ensureInboxTrail error:", errorMessage);
		throw error;
	}
};

// Update trail (via AT Protocol RPC)
export const updateTrailRecord = async (
	session: any,
	trailUri: string,
	updates: { name?: string; description?: string },
): Promise<void> => {
	if (!session?.rpc) {
		throw new Error("Authentication required");
	}

	try {
		const rkey = trailUri.split("/").pop();
		if (!rkey) {
			throw new Error("Invalid trail URI");
		}

		// Get current record first
		const getResponse = await session.rpc.get("com.atproto.repo.getRecord", {
			params: {
				repo: session.session.info.sub,
				collection: "ink.henry.annotate.trail",
				rkey: rkey,
			},
		});

		if (!getResponse.ok) {
			throw new Error("Failed to fetch current trail record");
		}

		const currentRecord = getResponse.data.value;
		const updatedRecord = {
			...currentRecord,
			...updates,
			// Keep original createdAt, don't update it
		};

		const { ok } = await session.rpc.post("com.atproto.repo.putRecord", {
			data: {
				repo: session.session.info.sub,
				collection: "ink.henry.annotate.trail",
				rkey: rkey,
				record: updatedRecord,
			},
		});

		if (!ok) {
			throw new Error("Failed to update trail");
		}

		// Optimistic update
		updateTrail(trailUri, {
			name: updates.name || currentRecord.name,
			description:
				updates.description !== undefined
					? updates.description
					: currentRecord.description,
			indexedAt: new Date().toISOString(),
		});
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Failed to update trail";
		setTrailsError(errorMessage);
		throw error;
	}
};

// Delete trail (via AT Protocol RPC)
export const deleteTrailRecord = async (
	session: any,
	trailUri: string,
): Promise<void> => {
	if (!session?.rpc) {
		throw new Error("Authentication required");
	}

	try {
		const rkey = trailUri.split("/").pop();
		if (!rkey) {
			throw new Error("Invalid trail URI");
		}

		const { ok } = await session.rpc.post("com.atproto.repo.deleteRecord", {
			data: {
				repo: session.session.info.sub,
				collection: "ink.henry.annotate.trail",
				rkey: rkey,
			},
		});

		if (!ok) {
			throw new Error("Failed to delete trail");
		}

		// Optimistic update
		removeTrail(trailUri);
		setProfileTrailsCount(
			Math.max(0, (currentTrailData.value?.trail.markCount || 1) - 1),
		);
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Failed to delete trail";
		setTrailsError(errorMessage);
		throw error;
	}
};

// === CACHE MANAGEMENT ===

// Invalidate specific queries
export const invalidateTrailsCache = () => {
	queryClient.invalidateQueries({ queryKey: ["trails"] });
	queryClient.invalidateQueries({ queryKey: ["profile-trails"] });
	queryClient.invalidateQueries({ queryKey: ["global-trails"] });
};

export const invalidateTrailDetailCache = (trailUri: string) => {
	queryClient.invalidateQueries({ queryKey: ["trail-detail", trailUri] });
};

// Refresh data and clear cache
export const refreshTrailsData = async (params?: { author_did?: string }) => {
	// Clear cache first
	invalidateTrailsCache();

	// Fetch fresh data
	if (params?.author_did) {
		return fetchUserTrails(params.author_did, "", undefined, false);
	} else {
		return fetchAllTrails();
	}
};

// === STATISTICS ===

export const fetchTrailsStats = async () => {
	try {
		const response = await fetch(`${apiUrl}/api/stats`);
		if (!response.ok) {
			throw new Error("Failed to fetch stats");
		}
		return response.json();
	} catch (error) {
		console.error("Failed to fetch trails stats:", error);
		return null;
	}
};
