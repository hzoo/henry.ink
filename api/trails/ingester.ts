/**
 * Firehose ingester for ink.henry.annotate.trail and ink.henry.annotate.mark records
 * Based on statusphere jetstream implementation
 */

import { JetstreamSubscription } from "@atcute/jetstream";
import { TrailStorage } from "./trail-storage";
import type { TrailRecordData, MarkRecordData } from "./types";
import { isTrailRecord, isMarkRecord } from "./types";

// Jetstream event types based on actual API structure
interface JetstreamCommitEvent {
	did: string;
	time_us: number;
	kind: "commit";
	commit: {
		rev: string;
		operation: "create" | "update" | "delete";
		collection: string;
		rkey: string;
		record?: TrailRecordData | MarkRecordData;
		cid?: string;
	};
}

interface JetstreamIdentityEvent {
	did: string;
	time_us: number;
	kind: "identity";
	identity: {
		did: string;
		handle: string;
		seq: number;
		time: string;
	};
}

interface JetstreamAccountEvent {
	did: string;
	time_us: number;
	kind: "account";
	account: {
		active: boolean;
		did: string;
		seq: number;
		time: string;
	};
}

type JetstreamEvent = JetstreamCommitEvent | JetstreamIdentityEvent | JetstreamAccountEvent;

// Cache Intl.Segmenter at module level
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function countGraphemes(text: string): number {
	let count = 0;
	for (const _ of graphemeSegmenter.segment(text)) count++;
	return count;
}

export class TrailsIngester {
	private subscription: JetstreamSubscription;
	private storage: TrailStorage;
	private isRunning = false;
	private retryAttempt = 0;
	private profileCache = new Set<string>(); // Track DIDs we've already fetched
	private static MAX_PROFILE_CACHE = 10000;

	constructor(storage: TrailStorage) {
		this.storage = storage;
		this.subscription = new JetstreamSubscription({
			url: "wss://jetstream2.us-east.bsky.network",
			wantedCollections: [
				"ink.henry.annotate.trail",
				"ink.henry.annotate.mark",
			],
		});
	}

	/**
	 * Fetch and cache profile information for a DID
	 */
	private async ensureProfileCached(did: string): Promise<void> {
		// Skip if we've already processed this DID recently
		if (this.profileCache.has(did)) {
			return;
		}

		try {
			// Check if profile exists in storage first
			const existingProfile = this.storage.getProfile(did);
			if (existingProfile) {
				this.profileCache.add(did);
				return;
			}

			// Fetch profile from AT Protocol (simplified - would need actual AT client)
			// For now, just store basic info from DID
			const basicProfile = {
				did,
				handle: did.includes(":") ? did.split(":")[2]?.slice(-8) + "..." : did,
				displayName: undefined,
				avatar: undefined,
			};

			await this.storage.storeProfile(basicProfile);
			// Bound cache size
			if (this.profileCache.size >= TrailsIngester.MAX_PROFILE_CACHE) {
				const first = this.profileCache.values().next().value;
				if (first) this.profileCache.delete(first);
			}
			this.profileCache.add(did);

			// TODO: In a full implementation, you'd fetch from AT Protocol:
			// const profile = await atClient.getProfile({ actor: did });
			// await this.storage.storeProfile(profile);
		} catch (error) {
			console.warn(`Failed to cache profile for ${did}:`, error);
			// Add to cache anyway to avoid repeated failures
			this.profileCache.add(did);
		}
	}

	async start() {
		if (this.isRunning) {
			console.log("Trails ingester already running");
			return;
		}

		this.isRunning = true;
		console.log("📡 Starting Trails Ingester for ink.henry.annotate collections");

		try {
			for await (const event of this.subscription) {
				if (!this.isRunning) break;
				this.retryAttempt = 0; // Reset on successful message

				if (event.kind === "commit") {
					await this.handleCommitEvent(event as JetstreamCommitEvent);
				}
			}
		} catch (error) {
			console.error("Jetstream connection error:", error);
			this.isRunning = false;
			const backoff = Math.min(1000 * Math.pow(2, this.retryAttempt), 60000);
			this.retryAttempt++;
			console.log(`Retrying in ${backoff}ms (attempt ${this.retryAttempt})`);
			setTimeout(() => this.start(), backoff);
		}
	}

	private async handleCommitEvent(event: JetstreamCommitEvent) {
		const commit = event.commit;

		// Only process our collections
		if (commit.collection === "ink.henry.annotate.trail") {
			if (commit.operation === "create" || commit.operation === "update") {
				await this.handleTrailRecord(event);
			} else if (commit.operation === "delete") {
				await this.handleTrailDelete(event);
			}
		} else if (commit.collection === "ink.henry.annotate.mark") {
			if (commit.operation === "create" || commit.operation === "update") {
				await this.handleMarkRecord(event);
			} else if (commit.operation === "delete") {
				await this.handleMarkDelete(event);
			}
		}
	}

	private async handleTrailRecord(event: JetstreamCommitEvent) {
		try {
			const commit = event.commit;
			const record = commit.record;

			if (!isTrailRecord(record)) {
				console.warn("Invalid trail record structure");
				return;
			}

			// Validate trail name
			const name = record.name.trim();
			if (!name || name.length > 64) {
				console.warn("Invalid trail name length");
				return;
			}

			// Validate description length if present
			if (record.description) {
				const graphemeCount = countGraphemes(record.description);
				if (graphemeCount > 300) {
					console.warn("Trail description too long");
					return;
				}
			}

			const did = event.did;
			const uri = `at://${did}/ink.henry.annotate.trail/${commit.rkey}`;

			// Ensure profile is cached
			await this.ensureProfileCached(did);

			try {
				await this.storage.storeTrail({
					uri,
					name,
					description: record.description || undefined,
					author_did: did,
					created_at: record.createdAt,
				});

				console.log(`✅ Stored trail: "${name}" from ${did.slice(-8)}...`);
			} catch (dbError) {
				console.error(`Failed to store trail "${name}":`, dbError);
				throw dbError; // Re-throw to trigger outer catch
			}
		} catch (error) {
			console.error("Failed to process trail record:", error);
		}
	}

	private async handleMarkRecord(event: JetstreamCommitEvent) {
		try {
			const commit = event.commit;
			const record = commit.record;

			if (!isMarkRecord(record)) {
				console.warn("Invalid mark record structure:", record);
				return;
			}

			// Validate trail reference
			if (!record.trail.startsWith("at://")) {
				console.warn("Invalid trail URI format");
				return;
			}

			// Validate subject based on type
			const subject = record.subject;
			let subjectType: "strongRef" | "external";
			let subjectUri: string | undefined;
			let subjectCid: string | undefined;
			let externalUrl: string | undefined;
			let externalTitle: string | undefined;

			if (
				"$type" in subject &&
				subject.$type === "com.atproto.repo.strongRef"
			) {
				// strongRef validation
				if (!subject.uri.startsWith("at://") || !subject.cid) {
					console.warn("Invalid strongRef format");
					return;
				}
				subjectType = "strongRef";
				subjectUri = subject.uri;
				subjectCid = subject.cid;
			} else if ("uri" in subject) {
				// External URL validation
				try {
					new URL(subject.uri);
					subjectType = "external";
					externalUrl = subject.uri;
					externalTitle = subject.title || undefined;
				} catch {
					console.warn("Invalid external URL format");
					return;
				}
			} else {
				console.warn("Unknown subject type");
				return;
			}

			// Validate note length if present
			if (record.note) {
				const graphemeCount = countGraphemes(record.note);
				if (graphemeCount > 300) {
					console.warn("Mark note too long");
					return;
				}
			}

			const did = event.did;
			const uri = `at://${did}/ink.henry.annotate.mark/${commit.rkey}`;

			// Ensure profile is cached
			await this.ensureProfileCached(did);

			const markData = {
				uri,
				trail_uri: record.trail,
				subject_type: subjectType,
				subject_uri: subjectUri,
				subject_cid: subjectCid,
				external_url: externalUrl,
				external_title: externalTitle,
				note: record.note || undefined,
				author_did: did,
				created_at: record.createdAt,
			};

			try {
				await this.storage.storeMark(markData);

				const subjectDisplay =
					subjectType === "strongRef"
						? `AT:${subjectUri?.split("/").pop()}`
						: `URL:${new URL(externalUrl!).hostname}`;

				console.log(
					`✅ Stored mark: ${subjectDisplay} to trail from ${did.slice(-8)}...`,
				);
			} catch (dbError) {
				console.error(`Failed to store mark:`, dbError);
				throw dbError; // Re-throw to trigger outer catch
			}
		} catch (error) {
			console.error("Failed to process mark record:", error);
		}
	}

	private async handleTrailDelete(event: JetstreamCommitEvent) {
		try {
			const commit = event.commit;
			const did = event.did;
			const uri = `at://${did}/ink.henry.annotate.trail/${commit.rkey}`;

			this.storage.deleteTrail(uri);
			console.log(`🗑️ Deleted trail from ${did.slice(-8)}...`);
		} catch (error) {
			console.error("Failed to delete trail:", error);
		}
	}

	private async handleMarkDelete(event: JetstreamCommitEvent) {
		try {
			const commit = event.commit;
			const did = event.did;
			const uri = `at://${did}/ink.henry.annotate.mark/${commit.rkey}`;

			this.storage.deleteMark(uri);
			console.log(`🗑️ Deleted mark from ${did.slice(-8)}...`);
		} catch (error) {
			console.error("Failed to delete mark:", error);
		}
	}

	stop() {
		this.isRunning = false;
		console.log("Stopping trails ingester...");
	}
}
