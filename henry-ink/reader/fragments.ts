const textAnchorPrefix = 'henry-text-';

export const textAnchorId = (value: string) => value.startsWith(textAnchorPrefix) ? value : `${textAnchorPrefix}${value}`;

/** Source fragments belong to the article, including its isolated Original document. */
export function observeSourceFragment(root: HTMLElement): () => void {
  const controller = new AbortController();
  let frame = 0;
  const jump = (event?: Event) => {
    window.cancelAnimationFrame(frame);
    const params = new URLSearchParams(window.location.search);
    // A shared discussion or channel owns the initial reader jump.
    if (params.get('post') || params.get('channel')) return;
    if (!window.location.hash) {
      if (event && root.ownerDocument !== document) root.ownerDocument.defaultView?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      return;
    }
    const hash = window.location.hash.slice(1);
    let id: string;
    try { id = decodeURIComponent(hash); }
    catch { id = hash; }
    const ids = root.ownerDocument === document
      ? [textAnchorId(id)]
      : [id, id.startsWith(textAnchorPrefix) ? id.slice(textAnchorPrefix.length) : id];
    const target = ids.flatMap(candidate => [root.ownerDocument.getElementById(candidate),
      ...root.ownerDocument.getElementsByName(candidate)]).find(element => element && root.contains(element));
    if (!target) return;
    frame = window.requestAnimationFrame(() => {
      if (target.isConnected) target.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
  };
  jump();
  window.addEventListener('hashchange', jump, { signal: controller.signal });
  window.addEventListener('popstate', jump, { signal: controller.signal });
  return () => { controller.abort(); window.cancelAnimationFrame(frame); };
}
