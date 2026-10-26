import { describe, expect, test } from 'bun:test';
import { groupNotes } from '../../henry-ink/reader/note-groups';
import type { AnnotationView } from '../../src/lib/annotations/margin';

function note(id: string, overrides: Partial<AnnotationView> = {}): AnnotationView {
  return {
    uri: `at://did:plc:alice/at.margin.note/${id}`, collection: 'at.margin.note', via: 'margin',
    motivation: 'highlighting', author: { did: 'did:plc:alice' }, target: 'https://example.com/post',
    createdAt: '2026-10-12T00:00:00Z', anchor: { kind: 'quote', exact: 'A passage.' }, labels: [], ...overrides,
  };
}

describe('reader contribution groups', () => {
  test('prioritizes written content even on a bookmark or highlight', () => {
    const result = groupNotes([
      note('1', { motivation: 'bookmarking', body: { kind: 'text', text: 'My comment', format: 'text/plain' } }),
      note('2', { description: 'My description' }),
      note('3'),
    ]);
    expect(result.comments).toHaveLength(2);
    expect(result.highlights).toHaveLength(0);
    expect(result.commentGroups[0].highlights).toHaveLength(1);
  });

  test('renders repeated passages once without losing attribution', () => {
    const result = groupNotes([note('1'), note('2', { author: { did: 'did:plc:bob' }, anchor: { kind: 'quote', exact: 'A\npassage.' } })]);
    expect(result.highlights).toHaveLength(1);
    expect(result.highlights[0].notes).toHaveLength(2);
  });

  test('groups written comments by passage while retaining independent page notes', () => {
    const content = { body: { kind: 'text', text: 'A comment', format: 'text/plain' } } as const;
    const result = groupNotes([
      note('1', content),
      note('2', { ...content, author: { did: 'did:plc:bob' }, anchor: { kind: 'quote', exact: 'A\npassage.' } }),
      note('3', { ...content, anchor: { kind: 'page' } }),
      note('4', { ...content, anchor: { kind: 'page' } }),
    ]);
    expect(result.comments).toHaveLength(4);
    expect(result.commentGroups).toHaveLength(3);
    expect(result.commentGroups[0].notes.map(note => note.uri)).toEqual([note('1').uri, note('2').uri]);
    expect(result.commentGroups[0].exact).toBe('A passage.');
    expect(result.commentGroups[1].exact).toBeUndefined();
  });

  test('does not merge different contexts or targets', () => {
    const result = groupNotes([note('1'), note('2', { anchor: { kind: 'quote', exact: 'A passage.', prefix: 'Different context' } }), note('3', { target: 'https://example.com/other' })]);
    expect(result.highlights).toHaveLength(3);
  });

  test('merges highlight provenance into a discussion only when its passage context matches', () => {
    const result = groupNotes([
      note('comment', { body: { kind: 'text', text: 'A response', format: 'text/plain' } }),
      note('highlight'),
      note('other-context', { anchor: { kind: 'quote', exact: 'A passage.', prefix: 'Other occurrence' } }),
    ]);
    expect(result.commentGroups[0].highlights.map(note => note.uri)).toEqual([note('highlight').uri]);
    expect(result.highlights).toHaveLength(1);
    expect(result.highlights[0].notes[0].uri).toBe(note('other-context').uri);
  });

  test('counts unique savers while retaining all their records', () => {
    const bookmark = { motivation: 'bookmarking', anchor: { kind: 'page' } } as const;
    const result = groupNotes([note('1', bookmark), note('2', bookmark), note('3', { ...bookmark, author: { did: 'did:plc:bob' } })]);
    expect(result.bookmarks).toHaveLength(2);
    expect(result.bookmarks[0]).toHaveLength(2);
  });

  test('excludes labeled records and repeated URIs before counting', () => {
    const result = groupNotes([note('1'), note('1'), note('2', { labels: [{ value: 'warn', source: 'test' }] })]);
    expect(result.highlights[0].notes).toHaveLength(1);
    expect(result.hidden).toBe(1);
  });

  test('keeps references and unsupported bodies visible rather than hiding them as saves', () => {
    const result = groupNotes([note('1', { body: { kind: 'reference', uri: 'https://example.com/note' } }), note('2', { body: { kind: 'unsupported' } })]);
    expect(result.comments).toHaveLength(2);
  });

  test('whitespace-only body is not a comment', () => {
    expect(groupNotes([note('1', { body: { kind: 'text', text: '  ', format: 'text/plain' } })]).highlights).toHaveLength(1);
  });

  test('does not silently drop unsupported anchors', () => {
    expect(groupNotes([note('1', { anchor: { kind: 'unsupported' } })]).comments).toHaveLength(1);
  });
});
