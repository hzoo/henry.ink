// Run with: bun api/arena/optimization.bench.ts
// Compare the former unconditional rebuild path with revision-checked refreshes.
import type { ArenaChannel } from '@/api/arena/arena-api-types';
import { ChannelStorage } from '@/api/arena/channel-storage';
import { LinkEnhancer } from '@/api/arena/link-enhancer';
import { ChannelPatternMatcher } from '@/api/arena/pattern-matcher';

class CountingMatcher extends ChannelPatternMatcher {
  builds = 0;
  override buildFromPatterns(...args: Parameters<ChannelPatternMatcher['buildFromPatterns']>) {
    this.builds++;
    super.buildFromPatterns(...args);
  }
}

const storage = new ChannelStorage(':memory:');
const matcher = new CountingMatcher();
const enhancer = new LinkEnhancer(storage, matcher);
const channels: ArenaChannel[] = Array.from({ length: 10_000 }, (_, id) => ({
  id, slug: `channel-${id}`, title: `Topic Number ${id}`, counts: { contents: 10 },
  created_at: '2026-01-01', updated_at: '2026-01-02', visibility_name: 'PUBLIC',
}));
const log = console.log;
try {
  console.log = () => {};
  for (let i = 0; i < channels.length; i += 100) {
    await storage.storeChannels(channels.slice(i, i + 100));
  }
  await enhancer.initialize();
  matcher.builds = 0;
  const rounds = 20;
  let start = performance.now();
  for (let i = 0; i < rounds; i++) {
    await storage.storeChannels(channels.slice(0, 100));
    matcher.buildFromPatterns(storage.getChannelPatterns(), storage.normalizeForMatching.bind(storage));
  }
  const unconditionalMs = performance.now() - start;
  const beforeBuilds = matcher.builds;
  matcher.builds = 0;
  start = performance.now();
  for (let i = 0; i < rounds; i++) {
    await storage.storeChannels(channels.slice(0, 100));
    await enhancer.refreshPatterns();
  }
  const revisionCheckedMs = performance.now() - start;
  log(JSON.stringify({
    channels: channels.length, rounds, automatonBuilds: { before: beforeBuilds, after: matcher.builds },
    unconditionalMs, revisionCheckedMs,
  }, null, 2));
} finally {
  console.log = log;
  storage.close();
}
