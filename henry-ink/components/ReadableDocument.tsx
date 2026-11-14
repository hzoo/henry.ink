import { useCallback, useEffect } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import { contentStateSignal } from '@/henry-ink/signals';
import { InlineNotes } from '@/henry-ink/reader/InlineNotes';
import { observeSourceFragment } from '@/henry-ink/reader/fragments';

export function ReadableDocument({ htmlContent }: { htmlContent: string }) {
  const article = contentStateSignal.value;
  const root = useSignal<HTMLDivElement | null>(null);
  const setRoot = useCallback((element: HTMLDivElement | null) => { root.value = element; }, [root]);

  useEffect(() => {
    if (root.value) return observeSourceFragment(root.value);
  }, [root.value, htmlContent]);

  return <>
    <div ref={setRoot}
      className="prose prose-lg dark:prose-invert max-w-none leading-relaxed overflow-wrap-anywhere break-words"
      dangerouslySetInnerHTML={{ __html: htmlContent }} />
    {root.value && article.type === 'success' && <InlineNotes root={root.value} article={article} />}
  </>;
}
