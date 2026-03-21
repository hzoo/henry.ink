/**
 * Registry for AT Protocol URL renderers
 * Maps collection types to their appropriate renderer components
 */
import { detectAtProtoRecord } from './atproto-registry';

// Registry mapping collection types to their renderer components
const ATPROTO_RENDERERS = {
  'app.bsky.feed.post': {
    component: 'BskyPostCard',
    requiresSession: true,
  },
  'sh.tangled.repo': {
    component: 'TangledRepoCard',
    requiresSession: false,
  },
  // Easy to extend with more collections later
} as const;

export type AtProtoRenderer = typeof ATPROTO_RENDERERS[keyof typeof ATPROTO_RENDERERS];
export type AtProtoComponent = AtProtoRenderer['component'];

/**
 * Get appropriate renderer for a URL
 * Returns renderer config or null if not an AT Protocol URL
 */
export function getAtProtoRenderer(url: string): (AtProtoRenderer & { collection: string; handle: string; rkey: string }) | null {
  const detected = detectAtProtoRecord(url);
  if (!detected) return null;
  
  const renderer = ATPROTO_RENDERERS[detected.collection as keyof typeof ATPROTO_RENDERERS];
  if (!renderer) return null;
  
  return {
    ...renderer,
    collection: detected.collection,
    handle: detected.handle,
    rkey: detected.rkey,
  };
}

/**
 * Check if a URL is a supported AT Protocol URL
 */
export function isAtProtoUrl(url: string): boolean {
  return getAtProtoRenderer(url) !== null;
}