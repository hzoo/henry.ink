export interface QuoteAnchor { exact: string; prefix?: string; suffix?: string }

const normalize = (text: string) => text.replace(/\s+/g, ' ');

/** Index once per document, without changing article markup or selecting the first ambiguous match. */
export function indexArticle(root: HTMLElement): (anchor: QuoteAnchor) => Range | null {
  const doc = root.ownerDocument;
  const styles = new WeakMap<Element, CSSStyleDeclaration>();
  const styleFor = (element: Element) => {
    let style = styles.get(element);
    if (!style && doc.defaultView) {
      style = doc.defaultView.getComputedStyle(element);
      styles.set(element, style);
    }
    return style;
  };
  const excluded = 'script, style, noscript, nav, [hidden], [aria-hidden="true"]';
  const rootStyle = styleFor(root);
  if (root.closest(excluded) || rootStyle?.display === 'none' || rootStyle?.opacity === '0') return () => null;
  const walker = doc.createTreeWalker(root, 5, {
    acceptNode(node) {
      const element = node.nodeType === 1 ? node as Element : node.parentElement;
      if (element) {
        const style = styleFor(element);
        // Rejecting an element also prunes its descendants; no ancestor scan is
        // needed for display or opacity. Visibility can be overridden by a child.
        if (node.nodeType === 1 && (element.matches(excluded) || style?.display === 'none' || style?.opacity === '0')) return 2;
        if (node.nodeType === 3 && (style?.visibility === 'hidden' || style?.visibility === 'collapse')) return 2;
      }
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
  const nodeAt = (offset: number) => {
    let first = 0;
    let last = nodes.length;
    while (first < last) {
      const middle = (first + last) >>> 1;
      if (nodes[middle].end <= offset) first = middle + 1;
      else last = middle;
    }
    const item = nodes[first];
    return item && item.start <= offset ? item : undefined;
  };
  return (anchor: QuoteAnchor): Range | null => {
    const exact = normalize(anchor.exact).trim();
    if (!exact || exact.length > 20000) return null;
    const prefix = normalize(anchor.prefix ?? '');
    const suffix = normalize(anchor.suffix ?? '');
    let match = -1;
    for (let at = text.indexOf(exact); at !== -1; at = text.indexOf(exact, at + 1)) {
      if (prefix && (at < prefix.length || !text.startsWith(prefix, at - prefix.length))) continue;
      if (suffix && !text.startsWith(suffix, at + exact.length)) continue;
      if (match !== -1) return null;
      match = at;
    }
    if (match === -1) return null;
    const start = nodeAt(match);
    const endAt = match + exact.length - 1;
    const end = nodeAt(endAt);
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
