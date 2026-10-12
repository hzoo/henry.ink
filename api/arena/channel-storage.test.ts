import { expect, spyOn, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ArenaChannel } from '@/api/arena/arena-api-types';
import { ChannelStorage } from '@/api/arena/channel-storage';
import { LinkEnhancer } from '@/api/arena/link-enhancer';
import { ChannelPatternMatcher } from '@/api/arena/pattern-matcher';

function channel(overrides: Partial<ArenaChannel> = {}): ArenaChannel {
  return {
    id: 1, slug: 'channel-1', title: 'Storage Test', counts: { contents: 10 },
    author_name: 'Reader', author_slug: 'reader', visibility_name: 'PUBLIC',
    created_at: '2026-01-01', updated_at: '2026-01-02', ...overrides,
  };
}

test('identical writes and missing deletes keep revision; all relevant changes invalidate', async () => {
  const storage = new ChannelStorage(':memory:');
  try {
    const emptyVersion = storage.getPatternVersion();
    await storage.storeChannels([]);
    storage.removeChannelBySlug('missing');
    storage.updateChannelAuthor('missing', 'Nobody');
    expect(storage.getPatternVersion()).toBe(emptyVersion);
    let current = channel();
    await storage.storeChannels([current]);
    expect(storage.getPatternVersion()).not.toBe(emptyVersion);
    let version = storage.getPatternVersion();
    await storage.storeChannels([current]);
    storage.updateChannelAuthor(current.slug, 'Reader', 'reader');
    expect(storage.getPatternVersion()).toBe(version);
    expect(storage.getChannelBySlug(current.slug)?.last_checked).toBeTruthy();
    for (const change of [
      { title: 'Different Title' }, { slug: 'new-slug' }, { counts: { contents: 25 } },
      { author_name: 'Different Reader' }, { author_slug: undefined }, { updated_at: '2026-02-01' },
    ]) {
      current = { ...current, ...change };
      await storage.storeChannels([current]);
      expect(storage.getPatternVersion()).not.toBe(version);
      version = storage.getPatternVersion();
    }
    storage.updateChannelAuthor(current.slug, 'Enriched', 'enriched');
    expect(storage.getPatternVersion()).not.toBe(version);
    version = storage.getPatternVersion();
    storage.removeChannelBySlug(current.slug);
    expect(storage.getPatternVersion()).not.toBe(version);
  } finally {
    storage.close();
  }
});

test('bulk upserts retain ID/slug replacement behavior and roll back failed batches', async () => {
  const storage = new ChannelStorage(':memory:');
  try {
    await storage.storeChannels([channel(), channel({ id: 2, slug: 'channel-2' })]);
    await storage.storeChannels([channel({ slug: 'channel-2', title: 'Replacement Title' })]);
    expect(storage.getChannelBySlug('channel-1')).toBeNull();
    expect(storage.getChannelBySlug('channel-2')?.id).toBe(1);
    await storage.storeChannels([channel({ id: 3, slug: 'channel-2' })]);
    expect(storage.getChannelBySlug('channel-2')?.id).toBe(3);
    await storage.storeChannels([
      channel({ id: 3, slug: 'channel-2', title: 'Intermediate Title' }),
      channel({ id: 3, slug: 'channel-2' }),
    ]);
    expect(storage.getChannelBySlug('channel-2')?.title).toBe('Storage Test');
    const version = storage.getPatternVersion();
    await expect(storage.storeChannels([
      channel({ id: 3, slug: 'channel-2', title: 'Must Roll Back' }),
      channel({ id: 4, slug: 'bad', title: null as unknown as string }),
    ])).rejects.toThrow();
    expect(storage.getPatternVersion()).toBe(version);
    expect(storage.getChannelBySlug('channel-2')?.title).toBe('Storage Test');
  } finally {
    storage.close();
  }
});

test('refresh before initialize builds once; subsequent unchanged calls reuse it', async () => {
  const storage = new ChannelStorage(':memory:');
  const matcher = new ChannelPatternMatcher();
  const enhancer = new LinkEnhancer(storage, matcher);
  const builds = spyOn(matcher, 'buildFromPatterns');
  try {
    await storage.storeChannels([channel()]);
    await enhancer.refreshPatterns();
    await Promise.all(Array.from({ length: 10 }, () => enhancer.findChannelMatches('Storage Test')));
    expect(builds).toHaveBeenCalledTimes(1);
    storage.removeChannelBySlug('channel-1');
    expect((await enhancer.findChannelMatches('Storage Test')).matches).toHaveLength(0);
    expect(builds).toHaveBeenCalledTimes(2);
  } finally {
    builds.mockRestore();
    storage.close();
  }
});

test('external SQLite writes refresh matcher metadata and remove deleted matches', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'arena-storage-'));
  const path = join(directory, 'channels.db');
  const storage = new ChannelStorage(path);
  const writer = new ChannelStorage(path);
  const enhancer = new LinkEnhancer(storage, new ChannelPatternMatcher());
  try {
    await enhancer.initialize();
    const version = storage.getPatternVersion();
    await writer.storeChannels([channel()]);
    expect(storage.getPatternVersion()).not.toBe(version);
    expect((await enhancer.findChannelMatches('Storage Test')).matches).toHaveLength(1);
    writer.updateChannelAuthor('channel-1', 'External', 'external');
    expect((await enhancer.findChannelMatches('Storage Test')).matches[0].author_slug).toBe('external');
    writer.removeChannelBySlug('channel-1');
    expect(await enhancer.previewMatches('Storage Test')).toHaveLength(0);
  } finally {
    storage.close();
    writer.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
