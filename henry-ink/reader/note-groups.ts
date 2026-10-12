import type { AnnotationView } from '@/src/lib/annotations/margin';

export interface HighlightGroup {
  key: string;
  exact: string;
  notes: AnnotationView[];
}

// A bookmark with a written description contributes more than a bare save.
export function groupNotes(items: AnnotationView[]) {
  const comments: AnnotationView[] = [];
  const highlights = new Map<string, HighlightGroup>();
  const bookmarks = new Map<string, AnnotationView[]>();
  const seen = new Set<string>();
  let hidden = 0;
  for (const note of items) {
    if (seen.has(note.uri)) continue;
    seen.add(note.uri);
    if (note.labels.length) { hidden++; continue; }
    const hasContent = note.body?.kind === 'text' ? !!note.body.text.trim() : !!note.body;
    if (hasContent || note.description?.trim()) {
      comments.push(note);
    } else if (note.anchor.kind === 'quote') {
      // Context and target matter: identical words can refer to different passages.
      const key = JSON.stringify([note.target, note.anchor.exact.replace(/\s+/g, ' ').trim(),
        note.anchor.prefix ?? '', note.anchor.suffix ?? '']);
      const group = highlights.get(key);
      if (group) group.notes.push(note);
      else highlights.set(key, { key, exact: note.anchor.exact, notes: [note] });
    } else if (note.motivation === 'bookmarking' && note.anchor.kind === 'page') {
      const records = bookmarks.get(note.author.did);
      if (records) records.push(note);
      else bookmarks.set(note.author.did, [note]);
    } else {
      comments.push(note);
    }
  }
  return { comments, highlights: [...highlights.values()], bookmarks: [...bookmarks.values()], hidden };
}
