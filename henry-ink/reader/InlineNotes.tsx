import { useSignal, useSignalEffect } from '@preact/signals';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { indexArticle, matchesArticleTarget } from '@/src/lib/annotations/anchors';
import { readerNotes, matchedNotes, noteSource, noteText } from '@/henry-ink/reader/notes';
import { extractedQuotes, quotesUrl } from '@/src/lib/highlights/signals';
import { createProviderLogo } from '@/src/components/ProviderLogo';

interface InlineNote { id: string; exact: string; prefix?: string; suffix?: string; author: string; text: string; source: string; href: string; createdAt?: string }

const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const olderDateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export function InlineNotes({ root, url, resolvedUrl }: { root: HTMLElement; url: string; resolvedUrl?: string }) {
  const revision = useSignal(0);
  const index = useRef<{ root: HTMLElement; resolve: ReturnType<typeof indexArticle> } | null>(null);
  const observer = useRef<MutationObserver | null>(null);
  const ownedHosts = useRef(new WeakSet<Node>());
  const expandedNotes = useRef(new Set<string>());
  const sourceChanged = (records: MutationRecord[]) => records.some(record =>
    record.type !== 'childList' || [...record.addedNodes, ...record.removedNodes].some(node => !ownedHosts.current.has(node)));

  useLayoutEffect(() => {
    const view = root.ownerDocument.defaultView;
    if (!view) return;
    index.current = null;
    revision.value++;
    const invalidate = () => { index.current = null; revision.value++; };
    const watch = new view.MutationObserver(records => {
      if (sourceChanged(records)) invalidate();
    });
    observer.current = watch;
    watch.observe(root, { subtree: true, childList: true, characterData: true, attributes: true });
    for (let parent = root.parentElement; parent; parent = parent.parentElement) {
      watch.observe(parent, { attributes: true });
    }
    if (root.ownerDocument.head) watch.observe(root.ownerDocument.head, { subtree: true, childList: true, characterData: true, attributes: true });
    const controller = new AbortController();
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    // Dragging the panel or changing mobile browser chrome can emit many resizes.
    const resize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(invalidate, 100);
    };
    view.addEventListener('resize', resize, { signal: controller.signal });
    view.visualViewport?.addEventListener('resize', resize, { signal: controller.signal });
    return () => {
      watch.disconnect();
      observer.current = null;
      controller.abort();
      clearTimeout(resizeTimer);
      index.current = null;
    };
  }, [root, url, resolvedUrl]);

  useSignalEffect(() => {
    revision.value;
    const notes = readerNotes.value;
    const entries: InlineNote[] = notes.status === 'ready' && notes.url === url ? notes.items
      .filter(note => !note.labels.length && matchesArticleTarget(note.target, url, resolvedUrl) && note.anchor.kind === 'quote')
      .map(note => ({
        id: note.uri, ...(note.anchor as { exact: string; prefix?: string; suffix?: string }),
        author: note.author.name || note.author.handle || note.author.did,
        text: note.body?.kind === 'text' ? note.body.text.trim() || note.description?.trim() || ''
          : note.body ? noteText(note) : note.description?.trim() || '',
        source: noteSource(note), createdAt: note.createdAt,
        href: `https://margin.at/annotation/${encodeURIComponent(note.uri)}`,
      })) : [];
    if (quotesUrl.value === url) {
      for (const quote of extractedQuotes.value) {
        const post = quote.postData;
        const record = post.record as { text?: unknown; createdAt?: unknown };
        const [, , repo, , rkey] = quote.postUri.split('/');
        entries.push({ id: quote.id, exact: quote.quote, author: post.author.displayName || post.author.handle,
          text: typeof record.text === 'string' ? record.text : '', source: 'Bluesky',
          createdAt: typeof record.createdAt === 'string' ? record.createdAt : undefined,
          href: `https://bsky.app/profile/${encodeURIComponent(repo)}/post/${encodeURIComponent(rkey)}` });
      }
    }
    if (sourceChanged(observer.current?.takeRecords() ?? [])) index.current = null;
    if (index.current?.root !== root) index.current = { root, resolve: indexArticle(root) };
    const resolve = index.current.resolve;
    const hosts: HTMLElement[] = [];
    const matched = new Map<string, HTMLElement>();
    const controller = new AbortController();
    // Resolve before inserting discussion text so notes can never match other notes.
    const resolved = entries.slice(0, 100).map(note => ({ note, range: resolve(note) }));
    const ranges: Range[] = [];
    for (const { note, range } of resolved) {
      if (!range) continue;
      const paragraph = range.endContainer.parentElement?.closest('p, li, blockquote, pre, h1, h2, h3, h4');
      if (!paragraph || !root.contains(paragraph)) continue;
      const host = root.ownerDocument.createElement('aside');
      ownedHosts.current.add(host);
      host.setAttribute('aria-label', `${note.source} note by ${note.author}`);
      host.style.cssText = 'display:block;clear:both;position:relative;margin:0.25rem 0 0.5rem;';
      host.addEventListener('click', event => event.stopPropagation(), { signal: controller.signal });
      const shadow = host.attachShadow({ mode: 'open' });
      const style = root.ownerDocument.createElement('style');
      style.textContent = ':host{color:inherit}.attribution{display:flex;align-items:center;gap:10px;min-height:32px;font:12px/1.4 Georgia,serif;opacity:.7}.author{overflow-wrap:anywhere}time{font-size:11px;white-space:nowrap}details{border-left:1px solid #c79031;padding:0 12px;max-width:65ch;box-sizing:border-box}summary{cursor:pointer}summary::before{content:"+"}details[open]>summary::before{content:"−"}p{font:14px/1.5 Georgia,serif;white-space:pre-wrap;overflow-wrap:anywhere;margin:4px 0 8px}a{position:relative;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;min-width:32px;min-height:32px;color:inherit;text-decoration:none}a::after{content:"";position:absolute;inset:-4px}a:hover{opacity:.65}a:focus-visible{outline:2px solid currentColor;outline-offset:2px;border-radius:3px}';
      const content = root.ownerDocument.createElement(note.text ? 'details' : 'div');
      if (note.text && expandedNotes.current.has(note.id)) content.setAttribute('open', '');
      const attribution = root.ownerDocument.createElement(note.text ? 'summary' : 'div');
      attribution.className = 'attribution';
      const author = root.ownerDocument.createElement('span');
      author.className = 'author';
      author.textContent = note.author;
      attribution.appendChild(author);
      const date = new Date(note.createdAt || '');
      if (Number.isFinite(date.getTime())) {
        const time = root.ownerDocument.createElement('time');
        time.dateTime = note.createdAt!;
        time.title = date.toLocaleString();
        time.textContent = (date.getFullYear() === new Date().getFullYear() ? dateFormat : olderDateFormat).format(date);
        attribution.appendChild(time);
      }
      const link = root.ownerDocument.createElement('a');
      link.href = note.href;
      link.title = `Open ${note.source} record by ${note.author} (new tab)`;
      link.setAttribute('aria-label', link.title);
      const logo = createProviderLogo(root.ownerDocument, note.source);
      if (logo) link.appendChild(logo);
      else link.textContent = note.source;
      link.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        window.open(note.href, '_blank', 'noopener,noreferrer');
      }, { signal: controller.signal });
      attribution.appendChild(link);
      content.appendChild(attribution);
      if (note.text) {
        const text = root.ownerDocument.createElement('p');
        text.textContent = note.text;
        content.appendChild(text);
      }
      shadow.append(style, content);
      const insertionPoint = paragraph.closest('a') || paragraph;
      insertionPoint.parentNode?.insertBefore(host, insertionPoint.nextSibling);
      hosts.push(host);
      matched.set(note.id, host);
      ranges.push(range);
    }
    const view = root.ownerDocument.defaultView as (Window & { CSS?: typeof CSS; Highlight?: typeof Highlight }) | null;
    if (view?.Highlight && view.CSS?.highlights) view.CSS.highlights.set('henry-notes', new view.Highlight(...ranges));
    matchedNotes.value = matched;
    return () => {
      controller.abort();
      expandedNotes.current = new Set([...matched].filter(([, host]) => host.shadowRoot?.querySelector('details')?.open).map(([id]) => id));
      hosts.forEach(host => host.remove());
      view?.CSS?.highlights?.delete('henry-notes');
      matchedNotes.value = new Map();
    };
  });
  return null;
}
