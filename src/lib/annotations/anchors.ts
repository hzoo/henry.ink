export interface QuoteAnchor { exact: string; prefix?: string; suffix?: string }

const normalize = (text: string) => text.replace(/\s+/g, ' ');

/** Index once per document, without changing article markup or selecting the first ambiguous match. */
export function indexArticle(root: HTMLElement) {
  const doc = root.ownerDocument;
  const styles = new WeakMap<Element, CSSStyleDeclaration>();
  const isHidden = (element: Element | null, checkVisibility: boolean) => {
    let parent = element;
    while (parent && root.contains(parent)) {
      let style = styles.get(parent);
      if (!style && doc.defaultView) {
        style = doc.defaultView.getComputedStyle(parent);
        styles.set(parent, style);
      }
      if (style?.display === 'none' || style?.opacity === '0'
        || (checkVisibility && parent === element && ['hidden', 'collapse'].includes(style?.visibility ?? ''))) return true;
      parent = parent.parentElement;
    }
    return false;
  };
  const walker = doc.createTreeWalker(root, 5, {
    acceptNode(node) {
      const element = node.nodeType === 1 ? node as Element : node.parentElement;
      if (element?.closest('script, style, noscript, nav, [hidden], [aria-hidden="true"]') || isHidden(element, node.nodeType === 3)) return 2;
      return node.nodeType === 3 || (node as Element).tagName === 'BR' ? 1 : 3;
    },
  });
  const chunks: string[] = [];
  const nodes: { node: Text; start: number; end: number; offsets: Uint32Array }[] = [];
  let length = 0;
  let lastWasSpace = false;
  let previousBlock: Element | null = null;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.nodeType === 1) {
      if (length && !lastWasSpace) { chunks.push(' '); length++; lastWasSpace = true; }
      continue;
    }
    const value = node.textContent ?? '';
    const block = node.parentElement?.closest('p, li, blockquote, pre, h1, h2, h3, h4, div, section') ?? null;
    if (length && block !== previousBlock && !lastWasSpace) {
      chunks.push(' ');
      length++;
      lastWasSpace = true;
    }
    previousBlock = block;
    let normalized = '';
    const offsets = new Uint32Array(value.length);
    let count = 0;
    for (let offset = 0; offset < value.length; offset++) {
      const char = /\s/.test(value[offset]) ? ' ' : value[offset];
      if (char === ' ' && lastWasSpace) continue;
      normalized += char;
      offsets[count++] = offset;
      lastWasSpace = char === ' ';
    }
    nodes.push({ node: node as Text, start: length, end: length + count, offsets });
    chunks.push(normalized);
    length += count;
  }
  const text = chunks.join('');
  return (anchor: QuoteAnchor): Range | null => {
    const exact = normalize(anchor.exact).trim();
    if (!exact || exact.length > 20000) return null;
    const prefix = normalize(anchor.prefix ?? '');
    const suffix = normalize(anchor.suffix ?? '');
    let match = -1;
    for (let at = text.indexOf(exact); at !== -1; at = text.indexOf(exact, at + 1)) {
      if (prefix && !text.slice(0, at).endsWith(prefix)) continue;
      if (suffix && !text.slice(at + exact.length).startsWith(suffix)) continue;
      if (match !== -1) return null;
      match = at;
    }
    if (match === -1) return null;
    const start = nodes.find(item => item.start <= match && item.end > match);
    const endAt = match + exact.length - 1;
    const end = nodes.find(item => item.start <= endAt && item.end > endAt);
    if (!start || !end) return null;
    const range = doc.createRange();
    range.setStart(start.node, start.offsets[match - start.start]);
    range.setEnd(end.node, end.offsets[endAt - end.start] + 1);
    return range;
  };
}

export function sameArticle(left: string, right: string): boolean {
  try {
    const a = new URL(left);
    const b = new URL(right);
    a.hash = '';
    b.hash = '';
    return a.href === b.href;
  } catch { return false; }
}

/** Only the capture's observed final URL is an alias, not a canonical tag or asset base. */
export function matchesArticleTarget(target: string, requestedUrl: string, resolvedUrl?: string): boolean {
  return sameArticle(target, requestedUrl) || (!!resolvedUrl && sameArticle(target, resolvedUrl));
}
