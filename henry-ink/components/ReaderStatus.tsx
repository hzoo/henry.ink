import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';

/** Mount per request so a previous slow navigation cannot flash this state. */
export function ReaderLoading({ label = 'Opening page' }: { label?: string }) {
  const visible = useSignal(false);
  useEffect(() => {
    const timer = setTimeout(() => { visible.value = true; }, 650);
    return () => clearTimeout(timer);
  }, []);
  if (!visible.value) return null;
  return <div role="status" class="flex items-center gap-2 px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
    <svg aria-hidden="true" class="h-3.5 w-3.5 motion-safe:animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="12" cy="12" r="9" opacity=".2" />
      <path d="M12 3a9 9 0 0 1 9 9" stroke-linecap="round" />
    </svg>
    {label}
  </div>;
}

export function ReaderError({ message, source, onRetry }: { message: string; source: string; onRetry: () => void }) {
  return <div class="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
    <p role="alert" class="[overflow-wrap:anywhere]">{message}</p>
    <div class="mt-1 flex flex-wrap items-center gap-4 text-xs">
      <button class="min-h-10 underline underline-offset-4 hover:text-slate-950 dark:hover:text-white" onClick={onRetry}>Try again</button>
      <a class="inline-flex min-h-10 items-center underline underline-offset-4 hover:text-slate-950 dark:hover:text-white" href={source} target="_blank" rel="noopener noreferrer">Open source</a>
    </div>
  </div>;
}
