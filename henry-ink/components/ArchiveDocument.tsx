import { useEffect, useRef } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import { apiBase } from '@/src/lib/api-url';
import { useLocation } from 'preact-iso';
import { createReaderDocument, type ReaderDocumentMode } from '@/henry-ink/reader/document';
import { InlineNotes } from '@/henry-ink/reader/InlineNotes';
import { quotedSelection } from '@/src/lib/messaging';
import { navigateToChannel } from '@/src/lib/arena-navigation';
import type { ArenaMatch } from '@/src/lib/arena-types';
import { enhanceArenaLinks } from '@/henry-ink/reader/arena-enhancement';
import { sameArticle } from '@/src/lib/annotations/anchors';
import { observeArenaNavigation } from '@/henry-ink/reader/arena-navigation';
import type { ArticleContent } from '@/henry-ink/signals';
import { observeSourceFragment } from '@/henry-ink/reader/fragments';

interface Props {
  html: string; css: string; url: string; title?: string;
  resolvedUrl?: string;
  htmlAttrs?: Record<string, string>; bodyAttrs?: Record<string, string>;
  documentMode?: ReaderDocumentMode;
  arenaMatches: ArenaMatch[];
  article: ArticleContent;
}

export function ArchiveDocument(props: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const loaded = useSignal<{ article: ArticleContent; root: HTMLElement } | null>(null);
  const selection = useSignal('');
  const location = useLocation();
  useEffect(() => {
    const root = loaded.value?.article === props.article ? loaded.value.root : null;
    if (!root) return;
    enhanceArenaLinks(root, props.arenaMatches);
    return observeArenaNavigation(root, props.url);
  }, [loaded.value, props.article, props.url, props.arenaMatches]);
  useEffect(() => {
    if (loaded.value?.article === props.article) return observeSourceFragment(loaded.value.root);
  }, [loaded.value, props.article]);
  useEffect(() => {
    loaded.value = null;
    selection.value = '';
    const iframe = frame.current;
    if (!iframe) return;
    const controller = new AbortController();
    iframe.addEventListener('load', () => {
      const doc = iframe.contentDocument;
      if (!doc?.body) return;
      loaded.value = { article: props.article, root: doc.body };
      doc.addEventListener('selectionchange', () => {
        selection.value = doc.getSelection()?.toString().trim() || '';
      }, { signal: controller.signal });
      doc.addEventListener('click', event => {
        const target = event.target as Element | null;
        const channel = target?.closest?.('.arena-channel-link');
        if (channel) {
          event.preventDefault();
          const slug = channel.getAttribute('data-channel-slug');
          if (slug) navigateToChannel(slug);
          return;
        }
        const link = target?.closest?.('a');
        if (!link) return;
        event.preventDefault();
        const href = link.getAttribute('href');
        if (!href) return;
        try {
          const destination = new URL(href, props.resolvedUrl || props.url);
          if (!['https:', 'http:'].includes(destination.protocol) || destination.username || destination.password) return;
          if (event.ctrlKey || event.metaKey || link.target === '_blank') {
            window.open(destination.href, '_blank', 'noopener,noreferrer');
          } else if (href.startsWith('#') || (destination.hash && (sameArticle(destination.href, props.url) || (!!props.resolvedUrl && sameArticle(destination.href, props.resolvedUrl))))) {
            window.location.hash = destination.hash;
            if (!destination.hash) doc.defaultView?.scrollTo(0, 0);
            else {
              const id = decodeURIComponent(destination.hash.slice(1));
              (doc.getElementById(id) || doc.getElementsByName(id)[0])?.scrollIntoView();
            }
          } else {
            location.route(destination.origin === window.location.origin ? destination.pathname + destination.search + destination.hash : `/${destination.href}`);
          }
        } catch { /* Invalid source links are inert. */ }
      }, { signal: controller.signal });
    }, { signal: controller.signal });
    const documentUrl = URL.createObjectURL(new Blob([createReaderDocument({
      ...props, assetOrigin: apiBase,
    })], { type: 'text/html' }));
    // srcdoc forces standards mode, even for legacy table-based documents.
    // A same-origin blob retains the doctype under the same sandbox and CSP.
    iframe.src = documentUrl;
    return () => { controller.abort(); loaded.value = null; URL.revokeObjectURL(documentUrl); };
  }, [props.article, props.html, props.css, props.url, props.title, props.htmlAttrs, props.bodyAttrs, props.documentMode]);
  return <div class="relative flex-1 min-h-0 flex flex-col">
    {loaded.value?.article === props.article && selection.value && <div class="absolute right-4 top-3 z-10">
      <button class="px-3 py-2 rounded bg-gray-950 text-white text-xs shadow" onClick={() => { quotedSelection.value = selection.value; selection.value = ''; }}>Quote selection on Bluesky</button>
    </div>}
    <iframe ref={frame} title={props.title || 'Original article layout'} sandbox="allow-same-origin" referrerPolicy="no-referrer" class="w-full flex-1 min-h-[65vh] border-0 bg-white" />
    {loaded.value?.article === props.article && <InlineNotes key={props.url} root={loaded.value.root} article={props.article} />}
  </div>;
}
