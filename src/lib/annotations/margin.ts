import { isCanonicalResourceUri } from '@atcute/lexicons/syntax';

// A read model, not a new AT Protocol record schema. Text is never trusted HTML.
export interface AnnotationView {
  uri: string;
  collection: string;
  via: 'margin';
  motivation: string;
  author: { did: string; handle?: string; name?: string };
  target: string;
  title?: string;
  createdAt: string;
  body?:
    | { kind: 'text'; text: string; format: string; uri?: string }
    | { kind: 'reference'; uri: string; format?: string }
    | { kind: 'unsupported' };
  description?: string;
  anchor:
    | { kind: 'page' }
    | { kind: 'quote'; exact: string; prefix?: string; suffix?: string }
    | { kind: 'unsupported' };
  labels: { value: string; source: string; scope?: string }[];
}

const collections = new Set([
  'at.margin.note',
  'at.margin.annotation',
  'at.margin.highlight',
  'at.margin.bookmark',
  'community.lexicon.bookmarks.bookmark',
  'community.lexicon.annotation.annotation',
  'network.cosmik.card',
]);

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function string(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function httpTarget(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 8192) return;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return;
    // Margin also indexes the exact source string. Validation must not rewrite it.
    return value;
  } catch {
    return;
  }
}

function decodeNote(value: unknown): AnnotationView | undefined {
  const note = object(value);
  if (!note || !isCanonicalResourceUri(note.id) || note.id.includes('#')) return;
  const [, , did, collection] = note.id.split('/');
  if (!collections.has(collection)) return;
  const author = object(note.creator);
  const target = object(note.target);
  const source = httpTarget(target?.source);
  const created = string(note.created);
  if (!author || author.did !== did || !source || !created || !Number.isFinite(Date.parse(created))) return;
  const motivation = string(note.motivation);
  if (!motivation) return;

  const selector = object(target?.selector);
  let anchor: AnnotationView['anchor'] = target?.selector == null
    ? { kind: 'page' }
    : { kind: 'unsupported' };
  // Do not treat CSS/XPath positions or a refinement as an independently valid quote.
  if (selector?.type === 'TextQuoteSelector' && typeof selector.exact === 'string'
    && selector.exact.trim() && selector.refinedBy == null) {
    anchor = {
      kind: 'quote', exact: selector.exact,
      prefix: string(selector.prefix), suffix: string(selector.suffix),
    };
  }
  const body = object(note.body);
  const bodyUri = httpTarget(body?.uri)
    ?? (isCanonicalResourceUri(body?.uri) ? body.uri : undefined);
  let content: AnnotationView['body'];
  if (typeof body?.value === 'string' && body.value.length > 0) {
    content = { kind: 'text', text: body.value, format: string(body.format) ?? 'text/plain', uri: bodyUri };
  } else if (bodyUri) {
    content = { kind: 'reference', uri: bodyUri, format: string(body?.format) };
  } else if (note.body != null) {
    content = { kind: 'unsupported' };
  }
  const labels: AnnotationView['labels'] = [];
  if (note.labels != null) {
    if (!Array.isArray(note.labels)) return;
    for (const entry of note.labels) {
      const label = object(entry);
      if (!label || typeof label.val !== 'string' || typeof label.src !== 'string') return;
      labels.push({ value: label.val, source: label.src, scope: string(label.scope) });
    }
  }
  return {
    uri: note.id, collection, via: 'margin', motivation,
    author: { did, handle: string(author.handle), name: string(author.displayName) },
    target: source, title: string(target?.title), createdAt: created,
    body: content, description: string(note.description),
    anchor, labels,
  };
}

export function decodeMarginTargets(value: unknown): {
  items: AnnotationView[];
  skipped: number;
} {
  const response = object(value);
  const groups = ['annotations', 'highlights', 'bookmarks'] as const;
  if (!response || groups.some(key => !Array.isArray(response[key]))) {
    throw new Error('Invalid Margin targets response');
  }
  const items = new Map<string, AnnotationView>();
  let skipped = 0;
  for (const key of groups) {
    for (const entry of response[key] as unknown[]) {
      const note = decodeNote(entry);
      if (note) items.set(note.uri, note);
      else skipped++;
    }
  }
  return { items: [...items.values()], skipped };
}
