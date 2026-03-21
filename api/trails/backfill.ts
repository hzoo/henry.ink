#!/usr/bin/env bun
/**
 * Simple backfill script for trails and marks from AT Protocol PDS
 * Fetches records directly from Bluesky PDS for a specific DID
 */

import { TrailStorage } from "./trail-storage";
import { isTrailRecord, isMarkRecord } from "./types";
import type { TrailRecordData, MarkRecordData } from "./types";

const PDS_URL = "https://bsky.social";
const TRAILS_DB_PATH = "./api/trails/data/trails.db";
const TARGET_DID = "did:plc:3wng2qnttvtg23546ar6bawo"; // henryzoo.com

// Rate limiting
const RATE_LIMIT_DELAY = 250; // ms between requests

interface RecordResponse {
	records: Array<{
		uri: string;
		cid: string;
		value: any;
	}>;
	cursor?: string;
}

async function fetchRecords(
	did: string,
	collection: string,
	cursor?: string,
): Promise<RecordResponse | null> {
	const url = new URL(`${PDS_URL}/xrpc/com.atproto.repo.listRecords`);
	url.searchParams.set("repo", did);
	url.searchParams.set("collection", collection);
	url.searchParams.set("limit", "100");
	if (cursor) url.searchParams.set("cursor", cursor);

	console.log(`📡 Fetching ${collection} records...`);

	try {
		const response = await fetch(url);
		if (!response.ok) {
			console.error(`HTTP ${response.status}: ${response.statusText}`);
			return null;
		}
		return await response.json();
	} catch (error) {
		console.error(`Failed to fetch records:`, error);
		return null;
	}
}

async function backfillTrails(
	storage: TrailStorage,
	did: string,
): Promise<number> {
	let cursor: string | undefined;
	let totalTrails = 0;

	while (true) {
		const data = await fetchRecords(did, "ink.henry.annotate.trail", cursor);
		if (!data || !data.records || data.records.length === 0) break;

		for (const record of data.records) {
			if (!isTrailRecord(record.value)) {
				console.warn(`❌ Invalid trail record structure:`, record.value);
				continue;
			}

			const trail = record.value as TrailRecordData;

			// Validate trail name
			const name = trail.name.trim();
			if (!name || name.length > 64) {
				console.warn(`❌ Invalid trail name: "${name}"`);
				continue;
			}

			// Check if already exists
			const existing = storage.getTrail(record.uri);
			if (existing) {
				console.log(`⏭️  Trail already exists: "${name}"`);
				continue;
			}

			try {
				await storage.storeTrail({
					uri: record.uri,
					name,
					description: trail.description || undefined,
					author_did: did,
					created_at: trail.createdAt,
				});

				console.log(`✅ Imported trail: "${name}" (${trail.createdAt})`);
				totalTrails++;
			} catch (error) {
				console.error(`❌ Failed to store trail "${name}":`, error);
			}
		}

		cursor = data.cursor;
		if (!cursor) break;

		// Rate limit
		await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY));
	}

	return totalTrails;
}

async function backfillMarks(
	storage: TrailStorage,
	did: string,
): Promise<number> {
	let cursor: string | undefined;
	let totalMarks = 0;

	while (true) {
		const data = await fetchRecords(did, "ink.henry.annotate.mark", cursor);
		if (!data || !data.records || data.records.length === 0) break;

		for (const record of data.records) {
			if (!isMarkRecord(record.value)) {
				console.warn(`❌ Invalid mark record structure:`, record.value);
				continue;
			}

			const mark = record.value as MarkRecordData;

			// Validate trail reference
			if (!mark.trail.startsWith("at://")) {
				console.warn(`❌ Invalid trail URI: ${mark.trail}`);
				continue;
			}

			// Process subject based on type
			const subject = mark.subject;
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
					console.warn(`❌ Invalid strongRef format:`, subject);
					continue;
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
					externalTitle = "title" in subject ? subject.title : undefined;
				} catch {
					console.warn(`❌ Invalid external URL: ${subject.uri}`);
					continue;
				}
			} else {
				console.warn(`❌ Unknown subject type:`, subject);
				continue;
			}

			// Check if already exists (we need to construct the URI from the record URI)
			// The record URI is like at://did/collection/rkey, we need that exact URI
			try {
				// Try to get existing mark to see if it already exists
				const existingMarks = storage.getTrailMarks(mark.trail, 1000);
				const alreadyExists = existingMarks.some(
					(existingMark) => existingMark.uri === record.uri,
				);

				if (alreadyExists) {
					const subjectDisplay =
						subjectType === "strongRef"
							? `AT:${subjectUri?.split("/").pop()}`
							: `URL:${new URL(externalUrl!).hostname}`;
					console.log(`⏭️  Mark already exists: ${subjectDisplay}`);
					continue;
				}

				await storage.storeMark({
					uri: record.uri,
					trail_uri: mark.trail,
					subject_type: subjectType,
					subject_uri: subjectUri,
					subject_cid: subjectCid,
					external_url: externalUrl,
					external_title: externalTitle,
					note: mark.note || undefined,
					author_did: did,
					created_at: mark.createdAt,
				});

				const subjectDisplay =
					subjectType === "strongRef"
						? `AT:${subjectUri?.split("/").pop()}`
						: `URL:${new URL(externalUrl!).hostname}`;

				console.log(
					`✅ Imported mark: ${subjectDisplay} → trail (${mark.createdAt})`,
				);
				totalMarks++;
			} catch (error) {
				console.error(`❌ Failed to store mark:`, error);
			}
		}

		cursor = data.cursor;
		if (!cursor) break;

		// Rate limit
		await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY));
	}

	return totalMarks;
}

async function backfillUser(did: string): Promise<void> {
	console.log(`🚀 Starting backfill for ${did}`);

	const storage = new TrailStorage(TRAILS_DB_PATH);

	try {
		// Store basic profile if not exists
		const existingProfile = storage.getProfile(did);
		if (!existingProfile) {
			console.log(`📝 Creating basic profile for ${did}`);
			await storage.storeProfile({
				did,
				handle: "henryzoo.com", // Your known handle
				displayName: undefined,
				avatar: undefined,
			});
		}

		console.log(`\n📚 Backfilling trails...`);
		const trailCount = await backfillTrails(storage, did);

		console.log(`\n📌 Backfilling marks...`);
		const markCount = await backfillMarks(storage, did);

		console.log(`\n🎉 Backfill complete!`);
		console.log(`   Imported ${trailCount} new trails`);
		console.log(`   Imported ${markCount} new marks`);

		// Show current stats
		const stats = storage.getStats();
		console.log(`\n📊 Current database totals:`);
		console.log(`   ${stats.total_trails} trails`);
		console.log(`   ${stats.total_marks} marks`);
		console.log(`   ${stats.total_authors} authors`);
	} catch (error) {
		console.error(`❌ Backfill failed:`, error);
	} finally {
		storage.close();
	}
}

// Run if called directly
if (import.meta.main) {
	const args = process.argv.slice(2);
	const did = args[0] || TARGET_DID;

	console.log(`🔄 Trail/Mark Backfill Tool`);
	console.log(`   Target DID: ${did}`);
	console.log(`   Database: ${TRAILS_DB_PATH}`);
	console.log(`   PDS: ${PDS_URL}`);
	console.log(``);

	backfillUser(did).catch(console.error);
}

export { backfillUser };
