/**
 * Type definitions for trails firehose ingestion and records
 */

// Trail record data as it appears in AT Protocol firehose
export interface TrailRecordData {
  $type: 'ink.henry.feed.trail';
  name: string;
  description?: string;
  createdAt: string;
}

// Mark record data as it appears in AT Protocol firehose
export interface MarkRecordData {
  $type: 'ink.henry.feed.mark';
  trail: string; // AT-URI
  subject: {
    $type: 'com.atproto.repo.strongRef';
    uri: string;
    cid: string;
  } | {
    uri: string;
    title?: string;
    description?: string;
    thumb?: {
      $type: 'blob';
      ref: { $link: string };
      mimeType: string;
      size: number;
    };
  };
  note?: string;
  createdAt: string;
}

// Profile information
export interface Profile {
  handle: string;
  displayName?: string;
  avatar?: string;
  did: string;
}

// View types for API responses
export interface TrailView {
  uri: string;
  cid: string;
  name: string;
  description?: string;
  creator: Profile;
  markCount: number;
  indexedAt: string;
  createdAt: string;
  viewer?: {
    hasMarked?: string; // URI if viewer has marked this trail
  };
}

export interface MarkView {
  uri: string;
  cid: string;
  trail: TrailView;
  subject: SubjectView;
  note?: string;
  creator: Profile;
  indexedAt: string;
  createdAt: string;
}

export interface SubjectView {
  type: 'strongRef' | 'external';
  uri?: string; // AT-URI for strongRef
  cid?: string; // CID for strongRef
  url?: string; // URL for external
  title?: string;
  description?: string;
  thumb?: string; // Blob URL for external
}

// Type guards
export function isTrailRecord(obj: unknown): obj is TrailRecordData {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "$type" in obj &&
    (obj as any).$type === "ink.henry.feed.trail" &&
    "name" in obj &&
    "createdAt" in obj &&
    typeof (obj as any).name === "string" &&
    typeof (obj as any).createdAt === "string" &&
    (obj as any).name.trim().length > 0
  );
}

export function isMarkRecord(obj: unknown): obj is MarkRecordData {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "$type" in obj &&
    (obj as any).$type === "ink.henry.feed.mark" &&
    "trail" in obj &&
    "subject" in obj &&
    "createdAt" in obj &&
    typeof (obj as any).trail === "string" &&
    typeof (obj as any).subject === "object" &&
    typeof (obj as any).createdAt === "string"
  );
}