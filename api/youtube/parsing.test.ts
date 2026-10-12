import { expect, test } from 'bun:test';
import { parseTranscript, playerField } from '@/api/youtube/parsing';

test('legacy XML handles reordered attributes, nested text, and entities exactly once', () => {
  expect(parseTranscript('<transcript><text dur="2.5" extra="ignored" start="1.5">Tom &amp; Jerry&#39;s &quot;show&quot; &#x1F600; <b>bold</b><br/>next &amp;lt;</text></transcript>', 'en')).toEqual([
    { offset: 1.5, duration: 2.5, lang: 'en', text: 'Tom & Jerry\'s "show" 😀 bold\nnext &lt;' },
  ]);
});

test('srv3 XML preserves nested segment text and converts milliseconds to seconds', () => {
  expect(parseTranscript('<timedtext format="3"><head/><body><p t="1500" d="2500"><s>Hello </s><s t="500">world</s></p></body></timedtext>', 'en')).toEqual([
    { text: 'Hello world', offset: 1.5, duration: 2.5, lang: 'en' },
  ]);
});

test('JSON3 skips window events and preserves literal text and timings', () => {
  expect(parseTranscript(JSON.stringify({ events: [
    { tStartMs: 0, wWinId: 0 },
    { tStartMs: 1500, dDurationMs: 2500, segs: [{ utf8: 'Hello &amp;' }, { utf8: ' world' }] },
  ] }), 'fr')).toEqual([{ text: 'Hello &amp; world', offset: 1.5, duration: 2.5, lang: 'fr' }]);
});

test('empty transcript documents remain empty, not fabricated segments', () => {
  for (const body of ['', ' \n', '<transcript/>', '<timedtext><body/></timedtext>', '{"events":[]}']) {
    expect(parseTranscript(body, 'en')).toEqual([]);
  }
});

test('malformed documents, unsupported formats, DTDs and invalid timings fail closed', () => {
  for (const body of ['<html>Sign in</html>', '<transcript><text start="0" dur="1">partial',
    '<!DOCTYPE transcript [<!ENTITY secret SYSTEM "file:///etc/passwd">]><transcript/>',
    '<transcript><text start="0" dur="1">&unknown;</text></transcript>',
    '<timedtext><body><p t="0">missing duration</p></body></timedtext>',
    '{bad', '{}', '{"events":[null]}', '{"events":[{"segs":"bad"}]}',
    ...['NaN', 'Infinity', '-1', '', '1oops'].flatMap(value => [
      `<transcript><text start="${value}" dur="1">bad</text></transcript>`,
      `<transcript><text start="0" dur="${value}">bad</text></transcript>`,
      JSON.stringify({ events: [{ tStartMs: value, dDurationMs: 100, segs: [{ utf8: 'bad' }] }] }),
    ]),
  ]) expect(() => parseTranscript(body, 'en')).toThrow();
});

test('unclosed and invalid embedded player objects fail instead of claiming no captions', () => {
  for (const html of ['"captions":{', '"captions":{invalid}', '"captions":[]']) {
    expect(() => playerField(html, 'captions')).toThrow();
  }
  expect(playerField('unrelated content', 'captions')).toBeUndefined();
});
