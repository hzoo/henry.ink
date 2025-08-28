/**
 * Firehose ingester for ink.henry.feed.trail and ink.henry.feed.mark records
 * Based on statusphere jetstream implementation
 */

import { JetstreamSubscription } from "@atcute/jetstream";
import { TrailStorage } from "./trail-storage";
import type { TrailRecordData, MarkRecordData } from "./types";
import { isTrailRecord, isMarkRecord } from "./types";

interface FirehoseEvent {
  kind: string;
  commit: {
    operation: 'create' | 'update' | 'delete';
    collection: string;
    rkey: string;
    repo: string;
    record?: TrailRecordData | MarkRecordData;
    cid?: string;
  };
  did?: string;
}

export class TrailsIngester {
  private subscription: JetstreamSubscription;
  private storage: TrailStorage;
  private isRunning = false;

  constructor(storage: TrailStorage) {
    this.storage = storage;
    this.subscription = new JetstreamSubscription({
      url: "wss://jetstream2.us-east.bsky.network",
      wantedCollections: ["ink.henry.feed.trail", "ink.henry.feed.mark"],
    });
  }

  async start() {
    if (this.isRunning) {
      console.log("Trails ingester already running");
      return;
    }

    this.isRunning = true;
    console.log("📡 Listening for ink.henry.feed.trail and ink.henry.feed.mark records");

    try {
      for await (const event of this.subscription) {
        if (!this.isRunning) break;

        if (event.kind === "commit") {
          await this.handleCommitEvent(event as FirehoseEvent);
        }
      }
    } catch (error) {
      console.error("Jetstream connection error:", error);
      this.isRunning = false;
      // Simple retry after 5 seconds
      setTimeout(() => this.start(), 5000);
    }
  }

  private async handleCommitEvent(event: FirehoseEvent) {
    const commit = event.commit;
    
    if (commit.collection === "ink.henry.feed.trail") {
      if (commit.operation === "create" || commit.operation === "update") {
        await this.handleTrailRecord(event);
      } else if (commit.operation === "delete") {
        await this.handleTrailDelete(event);
      }
    } else if (commit.collection === "ink.henry.feed.mark") {
      if (commit.operation === "create" || commit.operation === "update") {
        await this.handleMarkRecord(event);
      } else if (commit.operation === "delete") {
        await this.handleMarkDelete(event);
      }
    }
  }

  private async handleTrailRecord(event: FirehoseEvent) {
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
        // Count graphemes for proper emoji/unicode support
        const graphemeCount = [...new Intl.Segmenter({ granularity: 'grapheme' }).segment(record.description)].length;
        if (graphemeCount > 300) {
          console.warn("Trail description too long");
          return;
        }
      }

      const did = event.did || commit.repo;
      const uri = `at://${did}/ink.henry.feed.trail/${commit.rkey}`;

      await this.storage.storeTrail({
        uri,
        name,
        description: record.description || undefined,
        author_did: did,
        created_at: record.createdAt,
      });

      console.log(`✅ Stored trail: "${name}" from ${did.slice(-8)}...`);
    } catch (error) {
      console.error("Failed to process trail record:", error);
    }
  }

  private async handleMarkRecord(event: FirehoseEvent) {
    try {
      const commit = event.commit;
      const record = commit.record;

      if (!isMarkRecord(record)) {
        console.warn("Invalid mark record structure");
        return;
      }

      // Validate trail reference
      if (!record.trail.startsWith('at://')) {
        console.warn("Invalid trail URI format");
        return;
      }

      // Validate subject based on type
      const subject = record.subject;
      let subjectType: 'strongRef' | 'external';
      let subjectUri: string | undefined;
      let subjectCid: string | undefined;
      let externalUrl: string | undefined;
      let externalTitle: string | undefined;
      let externalDescription: string | undefined;

      if ('$type' in subject && subject.$type === 'com.atproto.repo.strongRef') {
        // strongRef validation
        if (!subject.uri.startsWith('at://') || !subject.cid) {
          console.warn("Invalid strongRef format");
          return;
        }
        subjectType = 'strongRef';
        subjectUri = subject.uri;
        subjectCid = subject.cid;
      } else if ('uri' in subject) {
        // External URL validation
        try {
          new URL(subject.uri);
          subjectType = 'external';
          externalUrl = subject.uri;
          externalTitle = subject.title || undefined;
          externalDescription = subject.description || undefined;
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
        const graphemeCount = [...new Intl.Segmenter({ granularity: 'grapheme' }).segment(record.note)].length;
        if (graphemeCount > 300) {
          console.warn("Mark note too long");
          return;
        }
      }

      const did = event.did || commit.repo;
      const uri = `at://${did}/ink.henry.feed.mark/${commit.rkey}`;

      await this.storage.storeMark({
        uri,
        trail_uri: record.trail,
        subject_type: subjectType,
        subject_uri: subjectUri,
        subject_cid: subjectCid,
        external_url: externalUrl,
        external_title: externalTitle,
        external_description: externalDescription,
        note: record.note || undefined,
        author_did: did,
        created_at: record.createdAt,
      });

      const subjectDisplay = subjectType === 'strongRef' 
        ? `AT:${subjectUri?.split('/').pop()}` 
        : `URL:${new URL(externalUrl!).hostname}`;
      
      console.log(`✅ Stored mark: ${subjectDisplay} to trail from ${did.slice(-8)}...`);
    } catch (error) {
      console.error("Failed to process mark record:", error);
    }
  }

  private async handleTrailDelete(event: FirehoseEvent) {
    try {
      const commit = event.commit;
      const did = event.did || commit.repo;
      const uri = `at://${did}/ink.henry.feed.trail/${commit.rkey}`;

      this.storage.deleteTrail(uri);
      console.log(`🗑️ Deleted trail from ${did.slice(-8)}...`);
    } catch (error) {
      console.error("Failed to delete trail:", error);
    }
  }

  private async handleMarkDelete(event: FirehoseEvent) {
    try {
      const commit = event.commit;
      const did = event.did || commit.repo;
      const uri = `at://${did}/ink.henry.feed.mark/${commit.rkey}`;

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