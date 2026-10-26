import { expect, spyOn, test } from 'bun:test';
import { Client } from '@atcute/client';
import { QueryClient } from '@tanstack/react-query';
import type { AppBskyFeedDefs } from '@atcute/bluesky';
import type { AtCuteState } from '@/demo/lib/oauth';
import { submitReply, unlikePost, deleteRepost } from '@/src/lib/postActions';
import { appPersister, updatePostActionCache } from '@/src/lib/queryClient';

test('rejected writes reach draft error handling and optimistic rollback', async () => {
  const state = {
    agent: {}, session: { info: { sub: 'did:plc:test' } },
    rpc: new Client({ handler: async () => Response.json({ error: 'InvalidRecord' }, { status: 400 }) }),
  } as unknown as AtCuteState;
  await expect(submitReply({
    uri: 'at://did:plc:test/app.bsky.feed.post/parent', cid: 'parent',
    author: { did: 'did:plc:test', handle: 'reader.test' }, indexedAt: '2026-01-01T00:00:00Z',
    record: { $type: 'app.bsky.feed.post', text: 'Parent' },
  }, 'Keep this draft', state)).rejects.toThrow('InvalidRecord');
  await expect(unlikePost('at://did:plc:test/app.bsky.feed.like/like', state)).rejects.toThrow('InvalidRecord');
  await expect(deleteRepost('at://did:plc:test/app.bsky.feed.repost/repost', state)).rejects.toThrow('InvalidRecord');
});

test('successful actions survive cached navigation across lists and reply trees for their viewer only', () => {
  const client = new QueryClient();
  const persist = spyOn(appPersister, 'persistQueryByKey').mockResolvedValue();
  const did = 'did:plc:reader';
  const post: AppBskyFeedDefs.PostView = {
    uri: 'at://did:plc:author/app.bsky.feed.post/note', cid: 'note',
    author: { did: 'did:plc:author', handle: 'author.test' }, indexedAt: '2026-01-01T00:00:00Z',
    record: { $type: 'app.bsky.feed.post', text: 'Note' }, likeCount: 4, repostCount: 2,
    viewer: { threadMuted: true },
  };
  const other = { ...post, uri: 'at://did:plc:author/app.bsky.feed.post/other' } as AppBskyFeedDefs.PostView;
  const postsKey = ['posts', 'https://example.com', did];
  const feedKey = ['authorFeed', 'author.test', did];
  const threadKey = ['thread', other.uri, did];
  const otherViewerKey = ['posts', 'https://example.com', 'did:plc:other'];
  const anonymousKey = ['posts', 'https://example.com', null];
  const unrelatedKey = ['posts', 'https://other.example', did];
  client.setQueryData(postsKey, [post, other]);
  client.setQueryData(feedKey, { cursor: 'next-page', feed: [{ post, reason: { $type: 'test' } }] });
  client.setQueryData(threadKey, { post: other, replies: [{ post }] });
  client.setQueryData(otherViewerKey, [post]);
  client.setQueryData(anonymousKey, [post]);
  client.setQueryData(unrelatedKey, [other]);
  const unrelatedError = new Error('Earlier search failed');
  client.getQueryCache().find({ queryKey: unrelatedKey })!.setState({ dataUpdatedAt: 42, status: 'error', error: unrelatedError });
  const read = () => [
    client.getQueryData<AppBskyFeedDefs.PostView[]>(postsKey)![0],
    client.getQueryData<{ feed: { post: AppBskyFeedDefs.PostView }[] }>(feedKey)!.feed[0].post,
    client.getQueryData<{ replies: { post: AppBskyFeedDefs.PostView }[] }>(threadKey)!.replies[0].post,
  ];
  try {
    const like = 'at://did:plc:reader/app.bsky.feed.like/like';
    const repost = 'at://did:plc:reader/app.bsky.feed.repost/repost';
    updatePostActionCache(client, did, post.uri, 'like', like);
    client.getQueryCache().find({ queryKey: postsKey })!.setState({ dataUpdatedAt: 100 });
    updatePostActionCache(client, did, post.uri, 'like', like);
    expect(client.getQueryState(postsKey)?.dataUpdatedAt).toBe(100);
    updatePostActionCache(client, did, post.uri, 'repost', repost);
    for (const cached of read()) {
      expect(cached.likeCount).toBe(5);
      expect(cached.repostCount).toBe(3);
      expect(cached.viewer).toEqual({ threadMuted: true, like, repost });
    }
    expect(client.getQueryData(feedKey)).toMatchObject({ cursor: 'next-page', feed: [{ reason: { $type: 'test' } }] });
    expect(client.getQueryData<AppBskyFeedDefs.PostView[]>(postsKey)![1]).toBe(other);
    expect(client.getQueryData<AppBskyFeedDefs.PostView[]>(otherViewerKey)).toEqual([post]);
    expect(client.getQueryData<AppBskyFeedDefs.PostView[]>(anonymousKey)).toEqual([post]);
    expect(client.getQueryData<AppBskyFeedDefs.PostView[]>(unrelatedKey)).toEqual([other]);
    expect(client.getQueryState(unrelatedKey)).toMatchObject({ dataUpdatedAt: 42, status: 'error', error: unrelatedError });
    expect(persist.mock.calls).toHaveLength(6); // Three changed queries, not repeated/no-op updates.
    expect(persist.mock.calls.every(([key]) => [postsKey, feedKey, threadKey].some(expected => JSON.stringify(key) === JSON.stringify(expected)))).toBe(true);
    updatePostActionCache(client, did, post.uri, 'like');
    updatePostActionCache(client, did, post.uri, 'repost');
    for (const cached of read()) {
      expect(cached.likeCount).toBe(4);
      expect(cached.repostCount).toBe(2);
      expect(cached.viewer?.like).toBeUndefined();
      expect(cached.viewer?.repost).toBeUndefined();
    }
  } finally {
    persist.mockRestore();
    client.clear();
  }
});
