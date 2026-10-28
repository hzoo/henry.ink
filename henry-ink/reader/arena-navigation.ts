import { arenaNavigationRequest } from '@/src/lib/messaging';
import { indexArticle } from '@/src/lib/annotations/anchors';

/** Navigate to source context without wrapping or moving its content. */
export function observeArenaNavigation(root: HTMLElement, url: string): () => void {
  let frame = 0;
  const dispose = arenaNavigationRequest.subscribe(request => {
    if (!request || request.url !== url || !root.isConnected) return;
    window.cancelAnimationFrame(frame);
    const button = Array.from(root.querySelectorAll<HTMLButtonElement>('button[data-channel-slug]'))
      .find(element => element.dataset.channelSlug === request.channelSlug);
    // Phrases spanning source elements have no generated button. Reuse the
    // reader's exact, ambiguity-rejecting index without changing source nodes.
    const range = button ? null : indexArticle(root)({ exact: request.matchedText });
    const target = button || range?.endContainer.parentElement?.closest<HTMLElement>('p, li, blockquote, pre, h1, h2, h3, h4');
    arenaNavigationRequest.value = null;
    if (!target) return;
    window.dispatchEvent(new Event('henry:show-article'));
    frame = window.requestAnimationFrame(() => {
      if (!target.isConnected) return;
      target.scrollIntoView({ block: 'center', behavior: 'instant' });
      if (!button) target.tabIndex = -1;
      target.focus({ preventScroll: true });
    });
  });
  return () => { dispose(); window.cancelAnimationFrame(frame); };
}
