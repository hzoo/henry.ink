import { signal, useSignalEffect } from '@preact/signals';
import { apiBase } from '@/src/lib/api-url';
import { currentUrl, isBlocked } from '@/src/lib/messaging';
import { autoFetchEnabled } from '@/src/lib/settings';
import type { AnnotationView } from '@/src/lib/annotations/margin';

type NotesState =
  | { status: 'idle'; url: string }
  | { status: 'loading'; url: string }
  | { status: 'error'; url: string; message: string }
  | { status: 'ready'; url: string; items: AnnotationView[]; skipped: number };

export const readerNotes = signal<NotesState>({ status: 'idle', url: '' });
export const notesRevision = signal(0);

// Only the reader owns this request. Do not persist anonymous moderation-sensitive results.
export function useReaderNotes() {
  useSignalEffect(() => {
    const url = currentUrl.value;
    notesRevision.value;
    const controller = new AbortController();
    if (!url || isBlocked.value || !autoFetchEnabled.value) {
      readerNotes.value = { status: 'idle', url };
      return;
    }
    readerNotes.value = { status: 'loading', url };
    const base = apiBase;
    fetch(`${base}/api/annotations/margin?${new URLSearchParams({ url })}`, {
      signal: controller.signal, credentials: 'omit', cache: 'no-store',
    }).then(async response => {
      if (!response.ok) throw new Error('Notes could not be loaded.');
      const data = await response.json() as { items?: AnnotationView[]; skipped?: number };
      if (!Array.isArray(data.items)) throw new Error('Invalid notes response.');
      if (!controller.signal.aborted) readerNotes.value = {
        status: 'ready', url, items: data.items, skipped: data.skipped ?? 0,
      };
    }).catch(error => {
      if (!controller.signal.aborted) readerNotes.value = { status: 'error', url, message: error.message };
    });
    return () => controller.abort();
  });
}

export function noteSource(note: AnnotationView): string {
  if (note.collection.startsWith('network.cosmik.')) return 'Semble';
  if (note.collection.startsWith('community.lexicon.bookmarks.')) return 'Bookmark';
  if (note.collection.startsWith('at.margin.')) return 'Margin';
  return 'Annotation';
}

export function noteText(note: AnnotationView): string {
  if (note.body?.kind === 'text') return note.body.text;
  if (note.description) return note.description;
  if (note.body?.kind === 'reference') return 'Linked note';
  if (note.body?.kind === 'unsupported') return 'Unsupported note format';
  return note.motivation === 'bookmarking' ? 'Bookmark' : note.motivation === 'highlighting' ? 'Highlighted passage' : 'Note without text';
}
