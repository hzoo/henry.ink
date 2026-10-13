import type { ArenaMatch } from '@/src/lib/arena-types';

const excluded = 'a, button, code, pre, svg, script, style, textarea, .arena-channel-link-wrapper';
const blocks = 'address, article, aside, blockquote, dd, div, dl, dt, figcaption, figure, footer, h1, h2, h3, h4, h5, h6, header, li, main, nav, ol, p, section, table, td, th, tr, ul';
const wordBefore = /[\p{L}\p{N}\p{M}_]$/u;
const wordAfter = /^[\p{L}\p{N}\p{M}_]/u;

interface TextEntry {
  node: Text;
  block: Element;
}

interface Replacement {
  start: number;
  end: number;
  match: ArenaMatch;
}

function createLink(doc: Document, match: ArenaMatch, text: string): HTMLElement {
  const wrapper = doc.createElement('span');
  wrapper.className = 'arena-channel-link-wrapper';
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'arena-channel-link';
  button.title = 'View ' + match.title + ' in sidebar';
  button.textContent = text;
  button.setAttribute('data-channel-slug', match.slug);
  button.setAttribute('data-channel-data', JSON.stringify(match));
  const external = doc.createElement('a');
  external.href = 'https://are.na/channels/' + match.slug;
  external.className = 'arena-link-icon';
  external.target = '_blank';
  external.rel = 'noopener noreferrer';
  external.title = 'Open ' + match.title + ' on Are.na';
  external.textContent = '\u2197';
  wrapper.appendChild(button);
  wrapper.appendChild(external);
  return wrapper;
}

/** Enhance a detached source subtree without replacing its existing elements. */
export function enhanceArenaLinks(root: HTMLElement, matches: readonly ArenaMatch[]): void {
  const patterns = matches.map(match => ({ match, text: match.matchedText.trim() }))
    .filter(({ text }) => text.split(/\s+/).length > 1)
    .sort((a, b) => b.text.length - a.text.length)
    .map(({ match, text }) => ({
      match,
      key: text.toLowerCase(),
      expression: new RegExp(text.replace(/[$.*+?^{}()|[\]\\]/g, '\\$&'), 'giu'),
    }));
  if (!patterns.length) return;

  const doc = root.ownerDocument;
  const entries: (TextEntry | null)[] = [];
  const walker = doc.createTreeWalker(root, 5); // SHOW_ELEMENT | SHOW_TEXT
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.nodeType === 1 && (node as Element).tagName === 'BR') entries.push(null);
    if (node.nodeType === 3 && node.textContent) {
      entries.push({ node: node as Text, block: node.parentElement?.closest(blocks) ?? root });
    }
  }

  const enhanced = new Set<string>();
  const changes: { node: Text; replacements: Replacement[] }[] = [];
  for (const [index, entry] of entries.entries()) {
    if (!entry || entry.node.parentElement?.closest(excluded)) continue;
    const text = entry.node.data;
    // Inline element edges are not word boundaries: <em>at A</em>mazon.
    const previous = entries[index - 1];
    const next = entries[index + 1];
    const beforeNode = previous?.block === entry.block ? previous.node.data : '';
    const afterNode = next?.block === entry.block ? next.node.data : '';
    const replacements: Replacement[] = [];
    for (const { match, key, expression } of patterns) {
      if (enhanced.has(key)) continue;
      expression.lastIndex = 0;
      let found: RegExpExecArray | null;
      while ((found = expression.exec(text))) {
        const start = found.index;
        const end = start + found[0].length;
        // An invalid or overlapping occurrence must not hide a later valid one.
        expression.lastIndex = start + (found[0].codePointAt(0)! > 0xffff ? 2 : 1);
        if (wordBefore.test(text.slice(0, start) || beforeNode)
          || wordAfter.test(text.slice(end) || afterNode)
          || replacements.some(range => start < range.end && end > range.start)) continue;
        replacements.push({ start, end, match });
        enhanced.add(key);
        break;
      }
    }
    if (replacements.length) changes.push({ node: entry.node, replacements });
  }

  // Apply the validated, non-overlapping offsets once. Never re-search fragments.
  for (const { node, replacements } of changes) {
    const text = node.data;
    const fragment = doc.createDocumentFragment();
    let offset = 0;
    for (const { start, end, match } of replacements.sort((a, b) => a.start - b.start)) {
      fragment.append(text.slice(offset, start), createLink(doc, match, text.slice(start, end)));
      offset = end;
    }
    fragment.append(text.slice(offset));
    node.replaceWith(fragment);
  }
}
