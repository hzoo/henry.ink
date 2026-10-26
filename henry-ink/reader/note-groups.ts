import type { AnnotationView } from '@/src/lib/annotations/margin';

export interface HighlightGroup {
  key: string;
  exact: string;
  notes: AnnotationView[];
}

export interface CommentGroup {
  key: string;
  exact?: string;
  notes: AnnotationView[];
  highlights: AnnotationView[];
}

function passageKey(note: AnnotationView) {
  return note.anchor.kind === 'quote'
    ? JSON.stringify([note.target, note.anchor.exact.replace(/\s+/g, ' ').trim(), note.anchor.prefix ?? '', note.anchor.suffix ?? ''])
    : note.uri;
}

// A bookmark with a written description contributes more than a bare save.
export function groupNotes(items: AnnotationView[]) {
  const comments: AnnotationView[] = [];
  const commentGroups = new Map<string, CommentGroup>();
  const highlights = new Map<string, HighlightGroup>();
  const bookmarks = new Map<string, AnnotationView[]>();
  const seen = new Set<string>();
  let hidden = 0;
  const addComment = (note: AnnotationView) => {
    comments.push(note);
    const key = passageKey(note);
    const group = commentGroups.get(key);
    if (group) group.notes.push(note);
    else commentGroups.set(key, { key, exact: note.anchor.kind === 'quote' ? note.anchor.exact : undefined, notes: [note], highlights: [] });
  };
  for (const note of items) {
    if (seen.has(note.uri)) continue;
    seen.add(note.uri);
    if (note.labels.length) { hidden++; continue; }
    const hasContent = note.body?.kind === 'text' ? !!note.body.text.trim() : !!note.body;
    if (hasContent || note.description?.trim()) {
      addComment(note);
    } else if (note.anchor.kind === 'quote') {
      // Context and target matter: identical words can refer to different passages.
      const key = passageKey(note);
      const group = highlights.get(key);
      if (group) group.notes.push(note);
      else highlights.set(key, { key, exact: note.anchor.exact, notes: [note] });
    } else if (note.motivation === 'bookmarking' && note.anchor.kind === 'page') {
      const records = bookmarks.get(note.author.did);
      if (records) records.push(note);
      else bookmarks.set(note.author.did, [note]);
    } else {
      addComment(note);
    }
  }
  for (const [key, group] of highlights) {
    const discussion = commentGroups.get(key);
    if (!discussion) continue;
    discussion.highlights = group.notes;
    highlights.delete(key);
  }
  return { comments, commentGroups: [...commentGroups.values()], highlights: [...highlights.values()], bookmarks: [...bookmarks.values()], hidden };
}
