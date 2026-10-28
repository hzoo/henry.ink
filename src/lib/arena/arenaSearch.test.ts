import { expect, spyOn, test } from 'bun:test';
import { JSDOM } from 'jsdom';
import { showArenaToast } from '@/src/lib/arena/arenaSearch';

test('search notices display untrusted text literally and use a normal search link', () => {
  const dom = new JSDOM('<!doctype html><head></head><body></body>');
  const previous = globalThis.document;
  globalThis.document = dom.window.document;
  const timeout = spyOn(globalThis, 'setTimeout').mockImplementation((() => 0) as unknown as typeof setTimeout);
  const selected = '<img src=x onerror="alert(1)"> & "quoted"';
  try {
    showArenaToast({ success: true, channelCount: 2, message: 'Found' }, selected);
    const link = dom.window.document.querySelector<HTMLAnchorElement>('[role="status"] a')!;
    expect(link.textContent).toContain(selected);
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
    expect(JSON.parse(new URL(link.href).searchParams.get('q')!).term.facet).toBe(selected);
    showArenaToast({ success: false, channelCount: 0, message: selected }, 'query');
    expect(dom.window.document.body.lastElementChild?.textContent).toBe(selected);
    expect(dom.window.document.querySelector('img, script, style, [onclick]')).toBeNull();
  } finally {
    timeout.mockRestore();
    globalThis.document = previous;
    dom.window.close();
  }
});
