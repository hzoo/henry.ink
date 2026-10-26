import { useComputed, useSignal } from '@preact/signals';
import { currentUrl } from '@/src/lib/messaging';
import { readerNotes, notesRevision, noteSource, noteText } from '@/henry-ink/reader/notes';
import { readerAnchors, showReaderAnchor } from '@/src/lib/highlights/signals';
import { groupNotes } from '@/henry-ink/reader/note-groups';
import type { AnnotationView } from '@/src/lib/annotations/margin';
import { ReaderIcon } from '@/src/components/ReaderIcon';
import { ProviderLogo } from '@/src/components/ProviderLogo';

const authorName = (note: AnnotationView) => note.author.name || note.author.handle || note.author.did;
const countLabel = (count: number, singular: string, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;
const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const olderDateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

function RecordLink({ note, showAuthor = false }: { note: AnnotationView; showAuthor?: boolean }) {
  const source = noteSource(note);
  const date = new Date(note.createdAt);
  const label = `Open ${source} record by ${authorName(note)}${showAuthor && Number.isFinite(date.getTime()) ? `, ${date.toLocaleString()}` : ''} (new tab)`;
  return <a class={`note-record${showAuthor ? ' note-record-person' : ''}`} aria-label={label} title={label} href={`https://margin.at/annotation/${encodeURIComponent(note.uri)}`} target="_blank" rel="noopener noreferrer">
    {showAuthor && <span>{authorName(note)}</span>}
    {source === 'Margin' || source === 'Semble'
      ? <ProviderLogo provider={source} />
      : <ReaderIcon name="external" />}
  </a>;
}

function Attribution({ note, placementNotes }: { note: AnnotationView; placementNotes?: AnnotationView[] }) {
  const date = new Date(note.createdAt);
  return <div class="note-attribution">
    <span class="min-w-0 break-words font-medium text-gray-700 dark:text-gray-300" title={note.author.handle || note.author.did}>{authorName(note)}</span>
    {Number.isFinite(date.getTime()) && <time dateTime={note.createdAt} title={date.toLocaleString()}>{(date.getFullYear() === new Date().getFullYear() ? dateFormat : olderDateFormat).format(date)}</time>}
    {placementNotes && <Placement notes={placementNotes} />}
    <RecordLink note={note} />
  </div>;
}

function Placement({ notes }: { notes: AnnotationView[] }) {
  const placed = notes.find(note => readerAnchors.value?.anchors.has(note.uri));
  return placed
    ? <button class="reader-icon-button" title="Show passage in article" aria-label="Show passage in article" onClick={() => showReaderAnchor(placed.uri)}><ReaderIcon name="arrow" /></button>
    : <span class="text-[11px] text-gray-500" title="This passage could not be matched in this version of the article.">Unplaced</span>;
}

function SavedNotes({ people }: { people: AnnotationView[][] }) {
  const expanded = useSignal(false);
  return <details class="note-disclosure border-b border-gray-100 dark:border-gray-800" onToggle={event => { expanded.value = event.currentTarget.open; }}>
    <summary class="flex min-h-10 items-center gap-3 cursor-pointer px-4 text-xs text-gray-600 dark:text-gray-300"><ReaderIcon name="bookmark" /><span>Saved by {countLabel(people.length, 'person', 'people')}</span><ReaderIcon name="chevron" class="note-chevron ml-auto" /></summary>
    {expanded.value && <ul class="saved-people" aria-label="People who saved this page">{people.map(records => <li class="saved-person" key={records[0].author.did}>
      {records.map((note, index) => <RecordLink key={note.uri} note={note} showAuthor={index === 0} />)}
    </li>)}</ul>}
  </details>;
}

function CommentContent({ note }: { note: AnnotationView }) {
  const text = note.body?.kind === 'text' ? note.body.text.trim() || note.description?.trim() || noteText(note) : noteText(note);
  const body = <p class="whitespace-pre-wrap break-words leading-relaxed">{text}</p>;
  if (text.length <= 600 && text.split('\n').length <= 8) return body;
  return <details class="note-comment">
    <summary>
      <span class="note-comment-preview whitespace-pre-wrap break-words leading-relaxed">{text}</span>
      <span class="note-comment-more">Read more</span>
      <span class="note-comment-less">Show less</span>
    </summary>
    {body}
  </details>;
}

export function MarginNotes() {
  const grouped = useComputed(() => {
    const state = readerNotes.value;
    return groupNotes(state.status === 'ready' ? state.items : []);
  });
  const state = readerNotes.value;
  if (!currentUrl.value) return <p class="p-5 text-sm text-gray-600 dark:text-gray-400">Open an article to see notes.</p>;
  if (state.url !== currentUrl.value || state.status === 'loading') return <p class="p-5 text-sm text-gray-600 dark:text-gray-400" role="status">Loading notes...</p>;
  if (state.status === 'idle') return <p class="p-5 text-sm text-gray-600 dark:text-gray-400">Automatic lookup is off for this page.</p>;
  if (state.status === 'error') return <div class="p-5 text-sm"><p role="alert">{state.message}</p><button class="mt-3 underline" onClick={() => notesRevision.value++}>Try again</button></div>;
  const { comments, commentGroups, highlights, bookmarks, hidden } = grouped.value;
  const highlightedPassages = highlights.length + commentGroups.filter(group => group.highlights.length).length;
  const counts = [comments.length && countLabel(comments.length, 'comment'), highlightedPassages && countLabel(highlightedPassages, 'passage'), bookmarks.length && countLabel(bookmarks.length, 'save')].filter(Boolean);
  return <section class="reader-notes h-full overflow-y-auto" aria-label="Notes discovered through Margin">
    <div class="px-4 flex min-h-10 justify-between items-center gap-3 border-b border-gray-100 dark:border-gray-800 text-xs text-gray-500">
      <div class="flex items-center gap-4 tabular-nums" role="group" aria-label={counts.join(', ') || 'No notes'}>
        <span class="inline-flex items-center gap-1.5" title={countLabel(comments.length, 'comment')}><ReaderIcon name="comment" /><span aria-hidden="true">{comments.length}</span></span>
        <span class="inline-flex items-center gap-1.5" title={countLabel(highlightedPassages, 'passage')}><ReaderIcon name="highlight" /><span aria-hidden="true">{highlightedPassages}</span></span>
        <span class="inline-flex items-center gap-1.5" title={countLabel(bookmarks.length, 'save')}><ReaderIcon name="bookmark" /><span aria-hidden="true">{bookmarks.length}</span></span>
      </div>
      <button class="reader-icon-button" title="Refresh notes" aria-label="Refresh notes" onClick={() => notesRevision.value++}><ReaderIcon name="refresh" /></button>
    </div>
    {!counts.length && <p class="p-5 text-sm text-gray-500">No notes found in this lookup.</p>}
    {commentGroups.map(group => <article key={group.key} class="px-4 pb-3 border-b border-gray-100 dark:border-gray-800 text-sm">
      {group.exact && <blockquote class="border-l-2 border-amber-400 pl-3 mt-3 mb-1 break-words font-serif italic text-gray-600 dark:text-gray-300">{group.exact}</blockquote>}
      {group.notes.map(note => <div key={note.uri}>
        <Attribution note={note} placementNotes={note.anchor.kind !== 'page' ? [note] : undefined} />
        <CommentContent note={note} />
      </div>)}
      {group.highlights.length > 0 && <div class="note-curation" aria-label="People who highlighted this passage">{group.highlights.map(note => <RecordLink key={note.uri} note={note} showAuthor />)}</div>}
    </article>)}
    {highlights.length > 0 && <section class="px-4 pt-3 pb-1 border-b border-gray-100 dark:border-gray-800" aria-label="Highlighted passages">
      <h2 class="flex items-center gap-2 text-[11px] font-medium text-gray-500 mb-2"><ReaderIcon name="highlight" /> Highlights</h2>
      <div class="space-y-2">{highlights.map(group => <article key={group.key}>
        <blockquote class="border-l-2 border-amber-300/80 pl-3 break-words font-serif text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">{group.exact}</blockquote>
        <div>{group.notes.map((note, index) => <Attribution key={note.uri} note={note} placementNotes={index === group.notes.length - 1 ? group.notes : undefined} />)}</div>
      </article>)}</div>
    </section>}
    {bookmarks.length > 0 && <SavedNotes key={state.url} people={bookmarks} />}
    <details class="note-disclosure px-4 text-[11px] text-gray-500">
      <summary class="flex min-h-10 cursor-pointer items-center gap-2"><ReaderIcon name="info" /><span>Partial lookup via Margin</span><ReaderIcon name="chevron" class="note-chevron ml-auto" /></summary>
      <p class="pb-4 leading-relaxed">Discovery may be incomplete.{hidden > 0 && ` ${hidden} labeled notes hidden.`}{state.skipped > 0 && ` ${state.skipped} unsupported records omitted.`}</p>
    </details>
  </section>;
}
