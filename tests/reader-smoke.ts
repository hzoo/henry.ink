import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { loadEnv } from 'vite';
import { blueskySearchUrl, resolveApiBase } from '../src/lib/api-config';
import type { AnnotationView } from '../src/lib/annotations/margin';
import { readerFixtures } from './fixtures/reader';

// Exercise the actual production bundle. Only transport responses are replaced;
// routing, fetch effects, sanitization, matching, CSS and click handlers are real.
const dist = resolve('henry-ink/dist');
assert(await Bun.file(`${dist}/index.html`).exists(), 'Run bun run build:ink first');
const env = loadEnv('production', process.cwd());
const api = resolveApiBase(env.VITE_API_URL, true);
const worker = blueskySearchUrl;
const websiteOnly = process.argv.includes('--website');
const server = Bun.serve({
  hostname: '127.0.0.1', port: 0,
  async fetch(request) {
    const pathname = decodeURIComponent(new URL(request.url).pathname);
    const path = resolve(dist, `.${pathname}`);
    if (path === dist) return new Response(Bun.file(`${dist}/index.html`));
    if (!path.startsWith(`${dist}/`)) return new Response('Not found', { status: 404 });
    const file = Bun.file(path);
    return new Response(await file.exists() ? file : Bun.file(`${dist}/index.html`));
  },
});
const origin = server.url.origin;
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(async error => {
  await server.stop(true);
  throw error;
});

async function websiteFlows(width: number) {
  const fixture = readerFixtures[0];
  const source = `${fixture.url}?token=a%2fb&tag=one+two&code=article-code&state=article-state`;
  const caseSource = source.replace('/custom-styled', '/Custom-Styled');
  const unavailableSource = 'https://reader-fixtures.example/unavailable?case=One%2fTwo';
  const linkedText = `@old.test ${caseSource}\n${source}`;
  const image = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  const cid = `bafyrei${'a'.repeat(52)}`;
  const quote = fixture.paragraphs.at(-1)!;
  const longHandle = `${'a'.repeat(63)}.example`;
  const posts = Array.from({ length: 25 }, (_, index) => ({
    uri: `at://did:plc:fixture/app.bsky.feed.post/${index ? `plain${index}` : 'shared'}`,
    cid: `fixture${index}`, author: { did: 'did:plc:fixture', handle: index < 2 ? longHandle : 'reader.test' },
    indexedAt: '2026-01-01T00:00:00Z', likeCount: 0, replyCount: index === 0 ? 1 : 0, repostCount: 0,
    record: { $type: 'app.bsky.feed.post', createdAt: '2026-01-01T00:00:00Z',
      text: index === 1 ? linkedText : index === 4 ? '> This passage is absent from this edition.\n\nDiscuss the earlier wording.'
        : index ? `An observation about the article, number ${index}.` : `> An earlier passage is missing.\n\n> ${quote}\n\nLeave room for another reader.`,
      _annotation: index === 4 ? { quote: { unexpected: 'custom data' } } : undefined,
      facets: index === 1 ? [
        { index: { byteStart: 0, byteEnd: 9 }, features: [{ $type: 'app.bsky.richtext.facet#mention', did: 'did:plc:renamed' }] },
        { index: { byteStart: 10, byteEnd: 10 + caseSource.length }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: caseSource }] },
      ] : undefined },
    embed: index === 1 ? { $type: 'app.bsky.embed.recordWithMedia#view',
      media: { $type: 'app.bsky.embed.images#view', images: [{ thumb: image, fullsize: 'https://reader-images.example/full.png', alt: 'Shared shelf detail' }] },
      record: { $type: 'app.bsky.embed.record#view', record: { $type: 'app.bsky.embed.record#viewRecord',
        uri: 'at://did:plc:fixture/app.bsky.feed.post/quoted', cid, author: { did: 'did:plc:fixture', handle: 'reader.test' },
        indexedAt: '2026-01-01T00:00:00Z', value: { $type: 'app.bsky.feed.post', text: 'A quoted observation beside its image.', createdAt: '2026-01-01T00:00:00Z' } } },
    } : index === 2 ? { $type: 'app.bsky.embed.external#view', external: { uri: caseSource, title: 'Distinct case article', description: '' } }
      : index === 3 ? { $type: 'app.bsky.embed.video#view', cid, playlist: 'https://video.example/playlist.m3u8' } : undefined,
  }));
  const context = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.addInitScript(() => {
    localStorage.setItem('site-annotations-domainSettings', JSON.stringify({ 'reader-fixtures.example': 'a' }));
    if (localStorage.getItem('site-annotations-autoFetchEnabled') === null) localStorage.setItem('site-annotations-autoFetchEnabled', 'false');
    const selectionPreference = 'site-annotations-showQuotePopupOnSelection';
    localStorage.setItem(selectionPreference, '{');
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === selectionPreference) throw new DOMException('Storage is full', 'QuotaExceededError');
      setItem.call(this, key, value);
    };
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (key === 'atcute-oauth:did') throw new DOMException('Storage is blocked', 'SecurityError');
      return getItem.call(this, key);
    };
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const failures: string[] = [];
  const archiveRequests: string[] = [];
  const lookupPages: number[] = [];
  let threadRequests = 0;
  let postRequests = 0;
  let postsUnavailable = true;
  let threadUnavailable = true;
  let lookupUnavailable = true;
  let nextPageUnavailable = true;
  let releaseThread!: () => void;
  const threadReady = new Promise<void>(resolve => { releaseThread = resolve; });
  let releasePosts!: () => void;
  const postsReady = new Promise<void>(resolve => { releasePosts = resolve; });
  let releaseArchive = () => {};
  let archiveReady = Promise.resolve();
  page.on('pageerror', error => failures.push(error.message));
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin && !url.pathname.startsWith('/api/')) return route.continue();
    const json = (value: unknown) => route.fulfill({ json: value, headers: { 'Access-Control-Allow-Origin': '*' } });
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type' } });
    if (url.origin === api) {
      if (url.pathname === '/api/archive') {
        archiveRequests.push(url.searchParams.get('url')!);
        if (url.searchParams.get('url') === unavailableSource) return route.fulfill({ status: 503, json: { error: 'Unavailable fixture' }, headers: { 'Access-Control-Allow-Origin': '*' } });
        await archiveReady;
        return json({ ...fixture.archive, url: source, resolvedUrl: source,
          css: `${fixture.archive.css}\n#last-paragraph{margin-top:1200px}` });
      }
      if (url.pathname === '/api/annotations/margin') {
        assert([source, unavailableSource].includes(url.searchParams.get('url')!));
        return json({ items: [], skipped: 0 });
      }
      if (url.pathname === '/api/arena/lookup') {
        if (url.searchParams.get('url') === unavailableSource) return json({ blocks: [{ id: 201, title: 'Saved page', kind: 'Link', channels: { state: 'ready', items: [{ slug: 'independent', title: 'Saved independently', visibility: 'closed' }], hasMore: false } }], nextPage: null });
        assert.equal(url.searchParams.get('url'), source, 'Are.na must look up the source URL, including its query bytes');
        const lookupPage = Number(url.searchParams.get('page'));
        lookupPages.push(lookupPage);
        if (lookupUnavailable || (lookupPage === 2 && nextPageUnavailable)) return route.fulfill({ status: 503, json: {}, headers: { 'Access-Control-Allow-Origin': '*' } });
        const channel = { slug: 'shared-reading', title: 'Shared reading', visibility: 'public', blockCount: 214,
          description: 'Essays, experiments, and tools for thinking together.', owner: { name: 'Fixture', slug: 'fixture' } };
        return json({ blocks: lookupPage === 1 ? [
          { id: 101, title: 'The shape of shared reading', kind: 'Link', previewUrl: 'https://images.are.na/fixture-preview.svg',
            creator: { name: 'Mira', slug: 'mira' }, createdAt: '2022-04-04T18:41:08.612Z',
            excerpt: 'A small library grows around a page: references, connections, and the people who notice them.', channels: { state: 'ready', items: [channel], hasMore: false } },
          { id: 102, title: 'Reading is a way of making connections', kind: 'Text', previewUrl: 'https://images.are.na/unavailable.png',
            creator: { name: 'Alex', slug: 'alex' }, createdAt: '2023-06-12T09:00:00Z',
            excerpt: 'The most useful marginalia points beyond the page. A collection becomes another way into an idea.', channels: { state: 'ready', items: [channel], hasMore: false } },
        ] : [{ id: 103, title: 'A note to return to', kind: 'Link', channels: { state: 'ready', items: [channel,
          { slug: 'further-reading', title: 'Further reading', visibility: 'closed', blockCount: 37, description: 'Sources to come back to.', owner: { name: 'Alex', slug: 'alex' } }], hasMore: false } }], nextPage: lookupPage === 1 ? 2 : null });
      }
    }
    if (url.href === 'https://images.are.na/fixture-preview.svg') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160"><rect width="120" height="160" fill="#eee9df"/><path d="M18 30h84M18 38h84M18 46h60M18 64h84M18 72h78M18 80h84M18 88h64" stroke="#555f48" stroke-width="3"/><circle cx="60" cy="124" r="16" fill="#a4b092"/></svg>' });
    if (url.href === 'https://images.are.na/unavailable.png') return route.fulfill({ status: 404, body: '' });
    if (url.origin === new URL(worker).origin && url.pathname === new URL(worker).pathname) {
      postRequests++;
      await postsReady;
      if (postsUnavailable) return route.fulfill({ status: 503, body: 'Search unavailable', headers: { 'Access-Control-Allow-Origin': '*' } });
      return json({ posts });
    }
    if (url.pathname === '/xrpc/app.bsky.feed.getPostThread') {
      threadRequests++;
      await threadReady;
      if (threadUnavailable) return route.fulfill({ status: 503, json: { error: 'ThreadUnavailable' }, headers: { 'Access-Control-Allow-Origin': '*' } });
      return json({ thread: { $type: 'app.bsky.feed.defs#threadViewPost', post: posts[0], replies: [
        { $type: 'app.bsky.feed.defs#threadViewPost', post: { ...posts[1], uri: 'at://did:plc:fixture/app.bsky.feed.post/reply', cid: 'reply',
          record: { $type: 'app.bsky.feed.post', text: 'A reply to the shared passage.', createdAt: '2026-01-01T00:00:00Z' } } },
      ] } });
    }
    failures.push(`Unexpected request: ${url.href}`);
    return route.abort();
  });
  try {
    await page.goto(`${origin}/not-a-web-address`);
    await page.getByLabel('Web address', { exact: true }).waitFor();
    await page.getByLabel('Web address', { exact: true }).fill('javascript:alert(1)');
    await page.getByRole('button', { name: 'Open page', exact: true }).click();
    assert.equal(await page.getByLabel('Web address', { exact: true }).evaluate(el => (el as HTMLInputElement).validity.valid), false);
    await page.getByLabel('Web address', { exact: true }).fill(source.replace('https://', ''));
    await page.getByRole('button', { name: 'Open page', exact: true }).click();
    await page.frameLocator('iframe[title]').locator('#last-paragraph').waitFor();
    await page.waitForFunction(() => {
      const signIn = document.querySelector<HTMLButtonElement>('[aria-label="Sign in with Bluesky"]');
      return signIn && !signIn.disabled;
    });
    assert.deepEqual(archiveRequests, [source], 'The URL form must preserve source queries');
    if (width < 1024) {
      await page.getByRole('button', { name: 'Open notes', exact: true }).click();
      const notes = page.getByRole('dialog', { name: 'Notes and discussions', exact: true });
      for (const isComposing of [true, false]) {
        const prevented = await notes.evaluate(async (element, composing) => {
          const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true, isComposing: composing });
          if (!composing) event.preventDefault();
          element.dispatchEvent(event);
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          return event.defaultPrevented;
        }, isComposing);
        assert.equal(prevented, !isComposing);
        assert(await notes.isVisible(), 'IME and already-handled Escape must keep Notes open');
      }
      await page.keyboard.press('Escape');
      await notes.waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: 'Open notes', exact: true }).click();
    }
    await page.getByRole('tab', { name: 'Bluesky', exact: true }).click();
    assert.equal(postRequests, 0, 'Manual mode must not search before the user asks');
    await page.getByRole('button', { name: 'Search for Bluesky posts', exact: true }).click();
    releasePosts();
    const searchError = page.getByRole('alert').filter({ hasText: 'Search unavailable' });
    await searchError.waitFor();
    postsUnavailable = false;
    await searchError.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.frameLocator('iframe[title]').locator('details[data-note-id]').waitFor();
    const discussion = page.locator('[data-post-rkey="shared"]');
    assert.equal(postRequests, 2, 'Manual search and explicit retry must each fetch once');
    postsUnavailable = true;
    await page.getByRole('button', { name: 'Refresh Bluesky discussions', exact: true }).click();
    await searchError.waitFor();
    assert(await discussion.isVisible(), 'A failed refresh must preserve loaded discussions');
    postsUnavailable = false;
    await searchError.getByRole('button', { name: 'Try again', exact: true }).click();
    await searchError.waitFor({ state: 'detached' });
    assert.equal(postRequests, 4, 'Refreshing a manual search and retrying it must each fetch once');
    const linkedPost = page.locator('[data-post-rkey="plain1"]');
    assert.equal(await linkedPost.getByRole('link', { name: '@old.test', exact: true }).getAttribute('href'), 'https://bsky.app/profile/did%3Aplc%3Arenamed');
    assert.equal(await linkedPost.getByRole('link', { name: caseSource, exact: true }).getAttribute('href'), caseSource);
    assert((await linkedPost.innerText()).includes(source), 'Plain post text must retain the source URL');
    assert.equal(await linkedPost.getByRole('link', { name: 'Shared shelf detail', exact: true }).getAttribute('href'), 'https://reader-images.example/full.png');
    await linkedPost.getByText('A quoted observation beside its image.', { exact: true }).waitFor();
    assert.equal(await page.locator('[data-post-rkey="plain2"]').getByRole('link').filter({ hasText: 'Distinct case article' }).getAttribute('href'), caseSource);
    assert.equal(await page.locator('[data-post-rkey="plain3"]').getByRole('link', { name: 'Watch video on Bluesky', exact: true }).getAttribute('href'), 'https://bsky.app/profile/did:plc:fixture/post/plain3');
    assert.equal(threadRequests, 0, 'Search results must not eagerly fetch threads');
    await discussion.getByRole('button', { name: 'Load replies', exact: true }).click();
    await discussion.getByText('Loading replies…', { exact: true }).waitFor();
    releaseThread();
    const repliesError = discussion.getByRole('alert').filter({ hasText: 'Replies could not be loaded.' });
    await repliesError.waitFor();
    threadUnavailable = false;
    await repliesError.getByRole('button', { name: 'Try again', exact: true }).click();
    const reply = discussion.locator('[data-post-rkey="reply"]');
    await reply.getByText('A reply to the shared passage.', { exact: true }).waitFor();
    for (const post of [discussion, reply]) {
      assert(await post.evaluate(el => el.scrollWidth <= el.clientWidth), 'Long account handles must fit discussion posts and replies');
    }
    const collapseReply = reply.getByRole('button', { name: 'Collapse thread', exact: true });
    await collapseReply.focus();
    await page.keyboard.press('Enter');
    const expandReply = reply.getByRole('button', { name: 'Expand thread', exact: true });
    assert(await expandReply.evaluate(el => el === document.activeElement), 'Collapsing a nested thread must preserve keyboard focus');
    await page.keyboard.press('Space');
    assert(await collapseReply.evaluate(el => el === document.activeElement), 'Expanding a nested thread must preserve keyboard focus');
    await discussion.getByRole('button', { name: 'Hide replies', exact: true }).click();
    await discussion.getByRole('button', { name: 'Load replies', exact: true }).click();
    await discussion.getByText('A reply to the shared passage.', { exact: true }).waitFor();
    assert.equal(threadRequests, 2, 'Retry must fetch once; reopening and nested toggles must reuse the thread');
    await discussion.getByRole('button', { name: 'Show quote in article', exact: true }).click();
    await page.waitForFunction(() => !!(document.querySelector('iframe') as HTMLIFrameElement)?.contentDocument?.querySelector('aside')?.shadowRoot?.activeElement);
    if (width < 1024) await page.getByRole('button', { name: 'Open notes', exact: true }).click();
    const commentButton = page.getByRole('button', { name: 'Add your comment', exact: true });
    await commentButton.click();
    const composer = page.getByRole('dialog', { name: 'Comment on this page', exact: true });
    await composer.waitFor();
    assert(await composer.locator('textarea').evaluate(el => el === document.activeElement), 'The composer must focus its editor');
    const editor = composer.locator('textarea');
    const postButton = composer.getByRole('button', { name: 'Post', exact: true });
    await editor.fill('🙂'.repeat(300));
    await composer.getByText('0', { exact: true }).waitFor();
    assert(!await postButton.isDisabled(), 'A 300-grapheme emoji post must remain valid');
    await editor.fill('a'.repeat(301));
    assert(await postButton.isDisabled(), 'Posts above 300 graphemes must be blocked');
    await editor.fill('👨‍👩‍👧‍👦'.repeat(120));
    assert.equal(await editor.inputValue(), '👨‍👩‍👧‍👦'.repeat(120), 'The input cap must preserve valid ZWJ emoji');
    assert(!await postButton.isDisabled(), 'A post at the 3000-byte limit must remain valid');
    await editor.fill('👨‍👩‍👧‍👦'.repeat(121));
    await composer.getByText('25 bytes over limit', { exact: true }).waitFor();
    assert(await postButton.isDisabled(), 'Posts above 3000 bytes must be blocked');
    await page.keyboard.press('Escape');
    await composer.waitFor({ state: 'detached' });
    assert(await commentButton.evaluate(el => el === document.activeElement), 'Composer dismissal must restore its trigger focus');
    if (width < 1024) await page.getByRole('dialog', { name: 'Notes and discussions', exact: true }).waitFor();
    await commentButton.click();
    await composer.waitFor();
    const draft = 'A draft that stays with this article. [h↗]';
    await editor.fill(draft);
    const draftLink = composer.getByRole('link', { name: /^henry\.ink\// });
    const draftHref = await draftLink.getAttribute('href');
    await page.goBack();
    await page.waitForFunction(() => location.pathname === '/not-a-web-address' && !!document.querySelector('#page-url'));
    assert.equal(await editor.inputValue(), draft, 'History navigation must preserve the draft');
    assert.equal(await draftLink.getAttribute('href'), draftHref, 'History navigation must not retarget the draft source');
    await page.goForward();
    await page.frameLocator('iframe[title]').locator('#last-paragraph').waitFor();
    assert.equal(await editor.inputValue(), draft);
    assert.equal(await draftLink.getAttribute('href'), draftHref);
    await page.keyboard.press('Escape');
    await composer.waitFor({ state: 'detached' });
    // Subsequent navigations exercise normal automatic search with the same source.
    await page.evaluate(() => localStorage.setItem('site-annotations-autoFetchEnabled', 'true'));

    archiveReady = new Promise<void>(resolve => { releaseArchive = resolve; });
    await page.goto(`${origin}/${source}&post=shared`);
    await page.locator('[data-post-rkey="shared"]').waitFor({ state: 'attached' });
    releaseArchive();
    archiveReady = Promise.resolve();
    await page.waitForFunction(() => {
      const frame = document.querySelector('iframe') as HTMLIFrameElement;
      return !!frame?.contentDocument?.querySelector('aside')?.shadowRoot?.activeElement;
    });
    await page.getByRole('button', { name: 'Text', exact: true }).click();
    await page.waitForFunction(() => !!document.querySelector('main aside')?.shadowRoot?.activeElement);

    await page.goto(`${origin}/${source}&post=plain4`);
    await page.waitForFunction(() => (document.activeElement as HTMLElement)?.dataset.postRkey === 'plain4');
    assert.equal(await page.locator('[data-post-rkey="plain4"]').getByRole('button', { name: 'Show quote in article', exact: true }).count(), 0, 'Unplaced quotes must not offer a dead article jump');
    if (width < 1024) await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Original', exact: true }).click();
    await page.waitForFunction(() => (document.activeElement as HTMLElement)?.dataset.postRkey === 'plain4');

    await page.goto(`${origin}/${source}&post=plain24`);
    await page.waitForFunction(() => (document.activeElement as HTMLElement)?.dataset.postRkey === 'plain24');
    await page.getByRole('tab', { name: 'Bluesky', exact: true, selected: true }).waitFor();
    if (width < 1024) await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Text', exact: true }).click();
    await page.waitForFunction(() => (document.activeElement as HTMLElement)?.dataset.postRkey === 'plain24');
    if (width < 1024) await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Original', exact: true }).click();
    await page.frameLocator('iframe[title]').locator('#last-paragraph').waitFor();
    await page.waitForFunction(() => (document.activeElement as HTMLElement)?.dataset.postRkey === 'plain24');
    const beforeArena = archiveRequests.length;
    assert.equal(lookupPages.length, 0, 'Are.na must stay quiet until its tab is opened');
    await page.getByRole('tab', { name: 'Are.na', exact: true }).click();
    await page.getByText('Couldn’t load Are.na saves.', { exact: true }).waitFor();
    lookupUnavailable = false;
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    const channel = page.getByRole('link', { name: 'Shared reading', exact: true });
    await channel.waitFor();
    assert.equal(await channel.count(), 1, 'Copies of the page in one channel must share a row');
    assert.equal(await channel.getAttribute('href'), 'https://www.are.na/channel/shared-reading');
    assert.equal(await page.getByRole('link', { name: 'Channel owner: Fixture', exact: true }).getAttribute('href'), 'https://www.are.na/fixture');
    for (const id of [101, 102]) assert.equal(await page.getByRole('link', { name: `Open saved block ${id} on Are.na`, exact: true }).getAttribute('href'), `https://www.are.na/block/${id}`);
    await page.getByText('Essays, experiments, and tools for thinking together.', { exact: true }).waitFor();
    await page.getByText('214 blocks', { exact: true }).waitFor();
    const versions = page.getByRole('region', { name: 'Saved versions', exact: true });
    await versions.getByText('The most useful marginalia points beyond the page. A collection becomes another way into an idea.', { exact: true }).waitFor();
    assert.equal(await versions.getByRole('link', { name: 'Block creator: Mira', exact: true }).getAttribute('href'), 'https://www.are.na/mira');
    assert.equal(await versions.locator('time').first().getAttribute('datetime'), '2022-04-04T18:41:08.612Z');
    const imageSave = versions.getByRole('link', { name: 'Open saved block 101 on Are.na', exact: true });
    await imageSave.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => { const img = document.querySelector('[aria-label="Open saved block 101 on Are.na"] img') as HTMLImageElement | null; return img?.complete && img.naturalWidth > 0; });
    const textSave = versions.getByRole('link', { name: 'Open saved block 102 on Are.na', exact: true });
    await textSave.scrollIntoViewIfNeeded();
    await textSave.locator('img').waitFor({ state: 'detached' });
    await textSave.getByText('Text', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Load more results', exact: true }).click();
    await page.getByText('More results couldn’t be loaded.', { exact: true }).waitFor();
    assert.equal(await channel.count(), 1, 'A later-page failure must preserve loaded saves');
    nextPageUnavailable = false;
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.getByRole('link', { name: 'Further reading', exact: true }).waitFor();
    assert.equal(await channel.count(), 1, 'Later pages must merge duplicate channels');
    assert.deepEqual(lookupPages, [1, 1, 2, 2]);
    assert.equal(await page.frameLocator('iframe[title]').locator('.arena-channel-link').count(), 0, 'URL discovery must not decorate article text');
    if (width < 1024) await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Text', exact: true }).click();
    await page.locator('main aside').waitFor();
    assert.equal(await page.getByRole('tab', { name: 'Are.na', exact: true, includeHidden: true }).getAttribute('aria-selected'), 'true', 'Reading mode changes must preserve the selected source');
    assert.equal(archiveRequests.length, beforeArena, 'Are.na browsing must reuse the article');
    if (width < 1024) await page.getByRole('button', { name: 'Open notes', exact: true }).click();
    await page.getByRole('tabpanel').filter({ visible: true }).locator('[aria-busy]').evaluate(el => { el.scrollTop = 0; });
    await page.screenshot({ path: `test-results/website-flows-${width}.png` });
    const beforeHome = archiveRequests.length;
    if (width < 1024) await page.keyboard.press('Escape');
    await page.getByRole('link', { name: "Henry's Note", exact: true }).click();
    await page.getByLabel('Web address', { exact: true }).waitFor();
    assert.equal(page.url(), `${origin}/`, 'Home must stay on the current site');
    await page.goBack();
    await page.locator('main p').filter({ hasText: quote }).first().waitFor();
    assert.equal(archiveRequests.length, beforeHome, 'Returning from Home must reuse the article');
    await page.goto(`${origin}/${unavailableSource}`);
    await page.locator('main button').filter({ hasText: 'Try again' }).waitFor({ state: 'attached' });
    if (width < 1024) await page.getByRole('button', { name: 'Open notes', exact: true }).click();
    await page.getByRole('tab', { name: 'Are.na', exact: true }).click();
    await page.getByRole('link', { name: 'Saved independently', exact: true }).waitFor();
    assert.equal(await page.locator('main iframe').count(), 0, 'URL lookup must work even without an article document');
    await page.screenshot({ path: `test-results/arena-without-article-${width}.png` });
    assert.deepEqual(failures, []);
    console.info(`PASS Website flows ${width}px: manual search, social links/media, composer focus, quote fallbacks, URL saves and source queries`);
  } catch (error) {
    console.error('Website flow failure', { width, url: page.url(), failures, archiveRequests, lookupPages }, error);
    await page.screenshot({ path: `test-results/website-flows-${width}-failed.png`, timeout: 5000 }).catch(() => {});
    throw error;
  } finally { releasePosts(); releaseArchive(); releaseThread(); await context.close(); }
}
try {
  for (const width of [1280, 390]) {
    for (const fixture of websiteOnly ? [] : readerFixtures) {
      const context = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
      const page = await context.newPage();
      page.setDefaultTimeout(8000);
      const failures: string[] = [];
      const requests: string[] = [];
      page.on('pageerror', error => failures.push(error.message));
      const quote = fixture.paragraphs.at(-1)!;
      const note: AnnotationView = {
        uri: 'at://did:plc:test/at.margin.highlight/fixture', collection: 'at.margin.highlight',
        via: 'margin', motivation: 'highlighting', author: { did: 'did:plc:test', handle: 'reader.test' },
        target: fixture.url, createdAt: '2026-01-01T00:00:00Z', labels: [], anchor: { kind: 'quote', exact: quote },
      };
      const shortComment: AnnotationView = { ...note, uri: `${note.uri}-short`, motivation: 'commenting',
        author: { did: 'did:plc:short', name: 'Short Reader' }, body: { kind: 'text', format: 'text/plain', text: 'Leave room for the next person to add something.' } };
      const longComment: AnnotationView = { ...shortComment, uri: `${note.uri}-long`,
        author: { did: 'did:plc:long', name: 'Long Reader' }, body: { kind: 'text', format: 'text/plain',
          text: 'The arrangement stays useful when people can change it together. '.repeat(24) } };
      const unplacedComment: AnnotationView = { ...shortComment, uri: `${note.uri}-unplaced`,
        anchor: { kind: 'quote', exact: 'This passage is absent from this version.' } };
      const bookmark: AnnotationView = { ...note, uri: `${note.uri}-saved`, motivation: 'bookmarking', anchor: { kind: 'page' } };
      let releaseArena!: () => void;
      const arenaReady = new Promise<void>(resolve => { releaseArena = resolve; });
      // Force a real scroll without depending on the amount of synthetic prose.
      const archive = {
        ...fixture.archive,
        html: `<a href="${fixture.url}#last-paragraph">Jump to ending</a>` + fixture.archive.html.replace('<p', '<p onclick="parent.__sourceScriptRan=true"') + '<a href="#">Return to beginning</a><script>parent.__sourceScriptRan=true</script>',
        css: `${fixture.archive.css || ''}\n#last-paragraph{margin-top:1200px}`,
      };
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin === origin && !url.pathname.startsWith('/api/')) return route.continue();
        requests.push(url.href);
        const json = (value: unknown) => route.fulfill({ json: value, headers: { 'Access-Control-Allow-Origin': '*' } });
        if (route.request().method() === 'OPTIONS' && url.origin === api) return route.fulfill({
          status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type' },
        });
        if (url.origin === api) {
          if (url.pathname === '/api/archive' && url.searchParams.get('url') === fixture.url) return json(archive);
          if (url.pathname === '/api/annotations/margin') return json({ items: [note, shortComment, longComment, unplacedComment, bookmark], skipped: 0 });
          if (url.pathname === '/api/arena/lookup') {
            await arenaReady;
            return json({ blocks: [{ id: 1, title: 'Saved page', kind: 'Link', channels: { state: 'ready', items: [{ slug: 'shared-reading', title: 'Shared reading', visibility: 'closed' }], hasMore: false } }], nextPage: null });
          }
        }
        if (url.origin === new URL(worker).origin && url.pathname === new URL(worker).pathname) return json({ posts: [] });
        if (url.origin === 'https://www.youtube-nocookie.com' && route.request().resourceType() === 'document') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Offline player</title>' });
        failures.push(`Unexpected request: ${url.href}`);
        return route.abort();
      });
      try {
        await page.goto(`${origin}/${fixture.url}`);
        const iframe = page.locator('iframe[title]').first();
        await iframe.waitFor();
        const frame = page.frameLocator('iframe[title]').first();
        await frame.locator('aside[aria-label="3 notes on this passage"]').waitFor();
        assert.equal(await frame.locator('aside[aria-label]').count(), 1, 'Same passage notes must share one host');
        const shortDetails = frame.locator(`details[data-note-id="${shortComment.uri}"]`);
        const longDetails = frame.locator(`details[data-note-id="${longComment.uri}"]`);
        assert(await shortDetails.evaluate(el => (el as HTMLDetailsElement).open), 'Short comments should be readable inline');
        assert.equal(await longDetails.evaluate(el => (el as HTMLDetailsElement).open), false, 'Long comments should begin with a preview');
        const content = await frame.locator('body').innerText();
        for (const paragraph of fixture.paragraphs) assert(content.replace(/\s+/g, ' ').includes(paragraph), `Missing article paragraph: ${paragraph}`);
        assert.equal(await iframe.getAttribute('sandbox'), 'allow-same-origin');
        assert.equal(await frame.locator('script, [onclick], [onerror]').count(), 0);
        assert.equal(await page.evaluate(() => '__sourceScriptRan' in window), false);
        const frameWidth = await iframe.evaluate(el => el.clientWidth);
        const sourceContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width: frameWidth, height: 800 } });
        try {
          await sourceContext.route('**/*', route => route.abort());
          const source = await sourceContext.newPage();
          await source.setContent(`<!doctype html><html><head><style>${archive.css}</style></head><body>${archive.html}</body></html>`);
          await source.evaluate(attrs => {
            for (const [el, values] of [[document.documentElement, attrs.html], [document.body, attrs.body]] as const) {
              for (const [name, value] of Object.entries(values || {})) el.setAttribute(name, value);
            }
          }, { html: archive.htmlAttrs, body: archive.bodyAttrs });
          const styles = (el: Element) => {
            const style = el.ownerDocument.defaultView!.getComputedStyle(el);
            return [style.color, style.backgroundColor, style.fontFamily, style.fontSize, style.lineHeight, style.textAlign];
          };
          for (const selector of ['body', 'h1', 'p']) {
            if (!await source.locator(selector).count()) continue;
            assert.deepEqual(await frame.locator(selector).first().evaluate(styles), await source.locator(selector).first().evaluate(styles), `${selector}: original typography/color changed`);
          }
        } finally { await sourceContext.close(); }
        const highlight = await iframe.evaluate((element) => {
          const doc = (element as HTMLIFrameElement).contentDocument!;
          const view = doc.defaultView! as Window & { CSS: typeof CSS };
          return [...(view.CSS.highlights.get('henry-notes') || [])].map(range => range.toString());
        });
        assert(highlight.includes(quote), 'The visible highlight must cover the expected passage');
        const before = await frame.locator('aside[aria-label]').evaluate(el => el.getBoundingClientRect().top);
        assert(before > 800, 'Jump fixture must start outside the viewport');
        await page.screenshot({ path: `test-results/${fixture.id}-${width}-original.png` });
        if (width < 1024) await page.getByRole('button', { name: 'Open notes', exact: true }).click();
        const tabs = page.getByRole('tablist', { name: 'Discussion source' });
        const tabHeight = await tabs.locator('..').evaluate(el => el.getBoundingClientRect().height);
        await page.getByRole('tab', { name: 'Notes', exact: true }).focus();
        await page.keyboard.press('ArrowRight');
        await page.getByRole('tab', { name: 'Bluesky', exact: true, selected: true }).waitFor();
        assert.equal(await tabs.locator('..').evaluate(el => el.getBoundingClientRect().height), tabHeight, 'Source changes must not move the header');
        await page.keyboard.press('End');
        await page.getByRole('tab', { name: 'Are.na', exact: true, selected: true }).waitFor();
        await page.keyboard.press('Home');
        await page.getByRole('tab', { name: 'Notes', exact: true, selected: true }).waitFor();
        assert.equal(await page.getByText('Unplaced', { exact: true }).count(), 1);
        await page.getByText('Saved by 1 person', { exact: true }).click();
        await page.getByRole('list', { name: 'People who saved this page' }).getByRole('link').first().waitFor();
        assert.equal(await page.getByRole('list', { name: 'People who saved this page' }).getByRole('link').count(), 1);
        if (width < 1024) {
          await page.keyboard.press('Escape');
          assert(await page.getByRole('button', { name: 'Open notes', exact: true }).evaluate(el => el === document.activeElement));
          await page.getByRole('button', { name: 'Open notes', exact: true }).click();
        }
        await page.getByRole('button', { name: 'Show passage in article', exact: true }).first().click();
        await page.waitForFunction(() => {
          const frame = document.querySelector('iframe') as HTMLIFrameElement;
          const note = frame?.contentDocument?.querySelector('aside[aria-label]');
          if (!note) return false;
          const rect = note.getBoundingClientRect();
          return rect.top >= 0 && rect.bottom <= frame.clientHeight;
        });
        if (width < 1024) assert.equal(await page.getByRole('button', { name: 'Open notes', exact: true }).getAttribute('aria-expanded'), 'false');
        await page.waitForFunction(() => document.activeElement?.tagName === 'IFRAME');
        assert(await iframe.evaluate(el => el === document.activeElement), 'Passage jumps must focus the article');
        const loadedSrc = await iframe.getAttribute('src');
        await frame.getByRole('link', { name: 'Jump to ending', exact: true }).click();
        await page.waitForFunction(() => location.hash === '#last-paragraph');
        assert.equal(await iframe.getAttribute('src'), loadedSrc, 'Absolute source fragments must stay in the loaded article');
        await frame.getByRole('link', { name: 'Return to beginning', exact: true }).click();
        await page.waitForFunction(() => !location.hash);
        assert.equal(await iframe.evaluate(el => (el as HTMLIFrameElement).contentWindow!.scrollY), 0);
        await page.goBack();
        await page.waitForFunction(() => location.hash === '#last-paragraph');
        await page.waitForFunction(() => (document.querySelector('iframe') as HTMLIFrameElement)?.contentWindow!.scrollY > 0);
        await page.goForward();
        await page.waitForFunction(() => !location.hash);
        await page.waitForFunction(() => (document.querySelector('iframe') as HTMLIFrameElement)?.contentWindow!.scrollY === 0);
        await frame.getByRole('link', { name: 'Jump to ending', exact: true }).click();
        const scrollBeforeContext = await iframe.evaluate(el => (el as HTMLIFrameElement).contentWindow!.scrollY);
        if (width < 1024) await page.getByRole('button', { name: 'Open notes', exact: true }).click();
        await page.getByRole('tab', { name: 'Are.na', exact: true }).click();
        releaseArena();
        await page.getByRole('link', { name: 'Shared reading', exact: true }).waitFor();
        assert.equal(await frame.locator('.arena-channel-link').count(), 0);
        assert.equal(await iframe.getAttribute('src'), loadedSrc, 'Sidebar discovery must retain the current document');
        const scrollAfterContext = await iframe.evaluate(el => (el as HTMLIFrameElement).contentWindow!.scrollY);
        assert(Math.abs(scrollAfterContext - scrollBeforeContext) <= 2, `Late context must retain reading position (${scrollBeforeContext} → ${scrollAfterContext})`);
        await page.getByRole('tab', { name: 'Notes', exact: true }).click();
        await page.locator('.note-attribution').filter({ hasText: 'Long Reader' }).getByRole('button', { name: 'Show passage in article', exact: true }).click();
        assert(await longDetails.evaluate(el => (el as HTMLDetailsElement).open), 'Jump must open the selected comment in a group');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Reader chrome overflows on mobile');
        await page.screenshot({ path: `test-results/${fixture.id}-${width}-jump.png` });
        await page.getByRole('button', { name: 'Text', exact: true }).click();
        await page.locator('iframe[title]').waitFor({ state: 'detached' });
        await page.locator('p').filter({ hasText: quote }).first().waitFor();
        const textParagraphs = await page.locator('p').allTextContents();
        for (const paragraph of fixture.paragraphs) assert(textParagraphs.some(text => text.replace(/\s+/g, ' ').trim() === paragraph), `Text mode lost paragraph: ${paragraph}`);
        await page.locator('main aside[aria-label="3 notes on this passage"]').waitFor();
        assert.equal(await page.locator('main aside[aria-label]').count(), 1, 'Text mode must group and place the same notes');
        if (width < 1024) await page.getByRole('button', { name: 'Open notes', exact: true }).click();
        await page.getByRole('button', { name: 'Show passage in article', exact: true }).first().click();
        await page.waitForFunction(() => {
          const host = document.querySelector('main aside[aria-label]');
          return host?.shadowRoot?.activeElement?.tagName === 'SUMMARY';
        });
        assert(await page.locator('main details[data-note-id]').first().locator('summary').evaluate(el => el === (el.getRootNode() as ShadowRoot).activeElement), 'Text mode passage jump must focus its note');
        const textHighlight = await page.evaluate(() => [...(CSS.highlights.get('henry-notes') || [])].map(range => range.toString()));
        assert(textHighlight.includes(quote), 'Text mode must retain passage highlighting');
        assert.equal(requests.filter(url => new URL(url).pathname === '/api/archive').length, 1, 'Text mode must reuse the archive');
        await page.screenshot({ path: `test-results/${fixture.id}-${width}-text.png` });
        await page.getByRole('button', { name: 'Original', exact: true }).click();
        await page.frameLocator('iframe[title]').locator('p').filter({ hasText: quote }).first().waitFor();
        const restoredFrame = page.locator('iframe[title]');
        const restoredSrc = await restoredFrame.getAttribute('src');
        assert(restoredSrc?.startsWith('blob:'), 'Returning to original mode must initialize the article frame');
        await page.setViewportSize({ width: width === 390 ? 1280 : 390, height: 900 });
        await page.frameLocator('iframe[title]').locator('p').filter({ hasText: quote }).first().waitFor();
        assert.equal(await restoredFrame.getAttribute('src'), restoredSrc, 'Resizing must preserve the article document');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Reader chrome overflows after resizing');
        await page.setViewportSize({ width, height: 900 });
        assert.equal(requests.filter(url => new URL(url).pathname === '/api/archive').length, 1, 'Mode switching and resizing must reuse the archive');
        if (fixture === readerFixtures[0]) {
          await page.goto(`${origin}/${fixture.url}#last-paragraph`);
          const sourceFragmentVisible = () => {
            const frame = document.querySelector('iframe') as HTMLIFrameElement;
            const target = frame?.contentDocument?.getElementById('last-paragraph');
            const rect = target?.getBoundingClientRect();
            return rect && frame.contentWindow!.scrollY > 0 && rect.top < frame.clientHeight && rect.bottom > 0;
          };
          await page.waitForFunction(sourceFragmentVisible);
          const fragmentRequests = requests.filter(url => new URL(url).pathname === '/api/archive').length;
          await page.getByRole('button', { name: 'Text', exact: true }).click();
          await page.locator('#henry-text-last-paragraph').waitFor();
          await page.waitForFunction(() => {
            const rect = document.getElementById('henry-text-last-paragraph')?.getBoundingClientRect();
            return rect && rect.top < innerHeight && rect.bottom > 0;
          });
          assert.equal(new URL(page.url()).hash, '#last-paragraph', 'Mode changes must preserve the source fragment');
          await page.getByRole('button', { name: 'Original', exact: true }).click();
          await page.waitForFunction(sourceFragmentVisible);
          const fragmentFrame = page.locator('iframe[title]');
          const fragmentSrc = await fragmentFrame.getAttribute('src');
          await page.evaluate(() => { location.hash = 'missing-section'; });
          await page.waitForFunction(() => location.hash === '#missing-section');
          await fragmentFrame.evaluate(el => (el as HTMLIFrameElement).contentWindow!.scrollTo(0, 0));
          await page.goBack();
          await page.waitForFunction(sourceFragmentVisible);
          assert.equal(await fragmentFrame.getAttribute('src'), fragmentSrc, 'Fragment history must keep the loaded document');
          assert.equal(requests.filter(url => new URL(url).pathname === '/api/archive').length, fragmentRequests, 'Fragment history and mode changes must reuse the archive');
          await page.goto(`${origin}/https://www.youtube.com/watch?v=H4LosXgKX4g`);
          const player = page.locator('iframe[src*="youtube-nocookie.com/embed/H4LosXgKX4g"]');
          await player.waitFor();
          // Allow delayed effects/loaders to run: opening a video must stay quiet.
          await page.waitForTimeout(800);
          assert.equal(requests.filter(url => new URL(url).pathname === '/api/youtube/transcript').length, 0, 'Video must not request an automatic transcript');
          assert.equal(await page.getByRole('status').filter({ hasText: /transcript/i }).count(), 0);
          assert.equal(await page.getByRole('alert').count(), 0);
          assert.equal(await page.getByRole('button', { name: 'Try again', exact: true }).count(), 0);
          assert.equal(await page.getByRole('button', { name: 'Copy', exact: true }).count(), 0);
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Video layout overflows mobile');
          await page.screenshot({ path: `test-results/${fixture.id}-${width}-video.png` });
          await page.reload();
          await player.waitFor();
          await page.waitForTimeout(800);
          assert.equal(requests.filter(url => new URL(url).pathname === '/api/youtube/transcript').length, 0, 'Reload must not request an automatic transcript');
        }
        assert.deepEqual(failures, []);
        console.info(`PASS ${fixture.name} ${width}px: source fidelity, grouped notes, both view jumps, keyboard tabs, late context`);
      } catch (error) {
        const focus = await page.evaluate(() => {
          const host = document.querySelector('main aside[aria-label]');
          return { active: document.activeElement?.outerHTML.slice(0, 500), noteActive: host?.shadowRoot?.activeElement?.outerHTML,
            articleInert: document.querySelector('main')?.closest('[inert]')?.outerHTML.slice(0, 100) };
        }).catch(() => null);
        await page.screenshot({ path: `test-results/${fixture.id}-${width}-failure.png` }).catch(() => {});
        throw new Error(`${fixture.name} ${width}px: ${String(error)}\nFocus: ${JSON.stringify(focus)}\n${failures.join('\n')}`, { cause: error });
      } finally { releaseArena(); await context.close(); }
    }
    await websiteFlows(width);
  }
} finally {
  await browser.close();
  await server.stop(true);
}
