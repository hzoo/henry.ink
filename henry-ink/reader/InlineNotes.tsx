import { useSignal, useSignalEffect } from '@preact/signals';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { indexArticle, matchesArticleTarget } from '@/src/lib/annotations/anchors';
import { readerNotes, noteSource, noteText } from '@/henry-ink/reader/notes';
import { extractedQuotes, quotesUrl, readerAnchors } from '@/src/lib/highlights/signals';
import type { ArticleContent } from '@/henry-ink/signals';
import { createProviderLogo } from '@/src/components/ProviderLogo';

interface InlineNote { id: string; exact: string; prefix?: string; suffix?: string; author: string; text: string; source: string; href: string; createdAt?: string }

const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const olderDateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const inlineStyle = `
:host{color:inherit}
.attribution{display:flex;align-items:center;gap:10px;min-height:40px;font:12px/1.4 Georgia,serif;color:inherit;opacity:.75}
.author{min-width:0;overflow-wrap:anywhere}
time{font-size:11px;white-space:nowrap;flex-shrink:0}
.highlights{display:flex;flex-wrap:wrap;gap:0 14px}
details{border-left:1px solid #c79031;padding:0 12px;max-width:65ch;box-sizing:border-box}
summary{cursor:pointer;list-style:none}
summary::-webkit-details-marker{display:none}
summary .attribution::before{content:"+";flex-shrink:0}
details[open]>summary .attribution::before{content:"−"}
.preview,p{font:14px/1.5 Georgia,serif;white-space:pre-wrap;overflow-wrap:anywhere}
.preview{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;margin:0 0 8px}
details[open] .preview{display:none}
p{margin:0 0 8px}
a{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;min-width:40px;min-height:40px;color:inherit;text-decoration:none}
a:hover{opacity:.65}
a:focus-visible,summary:focus-visible,.attribution:focus-visible{outline:2px solid currentColor;outline-offset:2px;border-radius:3px}
`;

function appendAttribution(doc: Document, parent: HTMLElement, note: InlineNote, controller: AbortController) {
  const attribution = doc.createElement('span');
  attribution.className = 'attribution';
  const author = doc.createElement('span');
  author.className = 'author';
  author.textContent = note.author;
  attribution.appendChild(author);
  const date = new Date(note.createdAt || '');
  if (Number.isFinite(date.getTime())) {
    const time = doc.createElement('time');
    time.dateTime = note.createdAt!;
    time.title = date.toLocaleString();
    time.textContent = (date.getFullYear() === new Date().getFullYear() ? dateFormat : olderDateFormat).format(date);
    attribution.appendChild(time);
  }
  const link = doc.createElement('a');
  link.href = note.href;
  link.title = `Open ${note.source} record by ${note.author} (new tab)`;
  link.setAttribute('aria-label', link.title);
  const logo = createProviderLogo(doc, note.source);
  if (logo) link.appendChild(logo);
  else link.textContent = note.source;
  link.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    window.open(note.href, '_blank', 'noopener,noreferrer');
  }, { signal: controller.signal });
  attribution.appendChild(link);
  parent.appendChild(attribution);
}

export function InlineNotes({ root, article }: { root: HTMLElement; article: ArticleContent }) {
  const { url, resolvedUrl } = article;
  const revision = useSignal(0);
  const index = useRef<{ root: HTMLElement; resolve: ReturnType<typeof indexArticle> } | null>(null);
  const observer = useRef<MutationObserver | null>(null);
  const ownedHosts = useRef(new WeakSet<Node>());
  const expandedNotes = useRef(new Map<string, boolean>());
  const sourceChanged = (records: MutationRecord[]) => records.some(record => {
    // Mobile Notes changes ancestor inertness without changing article text or
    // layout. Keep the note host alive while focus returns to the article.
    if (record.type === 'attributes' && record.attributeName === 'inert' && !root.contains(record.target)) return false;
    return record.type !== 'childList' || [...record.addedNodes, ...record.removedNodes].some(node => !ownedHosts.current.has(node));
  });

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
  }, [root, article]);

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
    const quotes = quotesUrl.value === url ? extractedQuotes.value : null;
    if (quotes) {
      for (const quote of quotes) {
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
    const matched = new Map<string, HTMLElement>();
    const placement = { article, root, quotes, anchors: matched };
    const clearPlacement = () => { if (readerAnchors.peek() === placement) readerAnchors.value = null; };
    if (!entries.length) { readerAnchors.value = placement; return clearPlacement; }
    if (index.current?.root !== root) index.current = { root, resolve: indexArticle(root) };
    const resolve = index.current.resolve;
    const hosts: HTMLElement[] = [];
    const controller = new AbortController();
    // Resolve before inserting discussion text so notes can never match other notes.
    const seen = new Set<string>();
    const resolved = entries.filter(note => {
      if (seen.has(note.id)) return false;
      seen.add(note.id);
      return true;
    }).sort((a, b) => Number(!!b.text) - Number(!!a.text)).slice(0, 100).map(note => ({ note, range: resolve(note) }));
    const nodeIds = new WeakMap<Node, number>();
    let nextNodeId = 0;
    const nodeId = (node: Node) => {
      if (!nodeIds.has(node)) nodeIds.set(node, nextNodeId++);
      return nodeIds.get(node)!;
    };
    const groups = new Map<string, { range: Range; notes: InlineNote[] }>();
    for (const { note, range } of resolved) {
      if (!range) continue;
      const key = `${nodeId(range.startContainer)}:${range.startOffset}:${nodeId(range.endContainer)}:${range.endOffset}`;
      const group = groups.get(key);
      if (group) group.notes.push(note);
      else groups.set(key, { range, notes: [note] });
    }
    const ranges: Range[] = [];
    const insertionTails = new Map<Element, HTMLElement>();
    for (const { notes: passageNotes, range } of groups.values()) {
      const paragraph = range.endContainer.parentElement?.closest('p, li, blockquote, pre, h1, h2, h3, h4');
      if (!paragraph || !root.contains(paragraph)) continue;
      const host = root.ownerDocument.createElement('aside');
      ownedHosts.current.add(host);
      host.setAttribute('aria-label', passageNotes.length === 1 ? `${passageNotes[0].source} note by ${passageNotes[0].author}` : `${passageNotes.length} notes on this passage`);
      host.style.cssText = 'display:block;clear:both;position:relative;margin:0.25rem 0 0.5rem;';
      host.addEventListener('click', event => event.stopPropagation(), { signal: controller.signal });
      const shadow = host.attachShadow({ mode: 'open' });
      const style = root.ownerDocument.createElement('style');
      style.textContent = inlineStyle;
      shadow.appendChild(style);
      const highlights = root.ownerDocument.createElement('div');
      highlights.className = 'highlights';
      // Written comments lead; bare highlights only need their provenance.
      for (const note of passageNotes) {
        const content = root.ownerDocument.createElement(note.text ? 'details' : 'div');
        content.dataset.noteId = note.id;
        const summary = note.text ? root.ownerDocument.createElement('summary') : content;
        if (note.text) {
          const short = note.text.length <= 280 && note.text.split('\n').length <= 4;
          if (expandedNotes.current.get(note.id) ?? short) content.setAttribute('open', '');
          const preview = root.ownerDocument.createElement('span');
          preview.className = 'preview';
          preview.textContent = note.text;
          appendAttribution(root.ownerDocument, summary, note, controller);
          summary.appendChild(preview);
          content.appendChild(summary);
          const text = root.ownerDocument.createElement('p');
          text.textContent = note.text;
          content.appendChild(text);
          shadow.appendChild(content);
        } else {
          appendAttribution(root.ownerDocument, content, note, controller);
          content.querySelector<HTMLElement>('.attribution')!.tabIndex = -1;
          highlights.appendChild(content);
        }
        matched.set(note.id, host);
      }
      if (highlights.childNodes.length) shadow.appendChild(highlights);
      const insertionPoint = paragraph.closest('a') || paragraph;
      const tail = insertionTails.get(insertionPoint) || insertionPoint;
      insertionPoint.parentNode?.insertBefore(host, tail.nextSibling);
      insertionTails.set(insertionPoint, host);
      hosts.push(host);
      ranges.push(range);
    }
    const view = root.ownerDocument.defaultView as (Window & { CSS?: typeof CSS; Highlight?: typeof Highlight }) | null;
    if (view?.Highlight && view.CSS?.highlights) view.CSS.highlights.set('henry-notes', new view.Highlight(...ranges));
    readerAnchors.value = placement;
    return () => {
      controller.abort();
      const expanded = new Map<string, boolean>();
      for (const host of hosts) {
        for (const details of host.shadowRoot?.querySelectorAll('details') ?? []) {
          expanded.set(details.dataset.noteId!, details.open);
        }
      }
      expandedNotes.current = expanded;
      hosts.forEach(host => host.remove());
      view?.CSS?.highlights?.delete('henry-notes');
      clearPlacement();
    };
  });
  return null;
}
