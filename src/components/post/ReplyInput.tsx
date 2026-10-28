import { useComputed, useSignal } from "@preact/signals";
import type { ComponentChildren, JSX, h } from "preact";
import { useId, useLayoutEffect, useRef } from "preact/hooks";

const MAX_CHARS = 300;
const MAX_BYTES = 3000;
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const textEncoder = new TextEncoder();

interface ReplyInputProps {
  onCancel: () => void;
  onSubmit: (text: string) => Promise<void>;
  isSubmitting: boolean;
  submitError: string | null;
  onClearError: () => void;
}

interface ReplyButtonProps extends JSX.HTMLAttributes<HTMLButtonElement> {
    isLoading: boolean;
    children: ComponentChildren;
    disabled?: boolean;
}

function ReplyButton({ isLoading, children, ...props }: ReplyButtonProps) {
  return (
    <button
      {...props}
      disabled={props.disabled || isLoading}
      className={`min-h-10 px-3 py-1 text-sm rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${props.className || ""}`}
    >
      {isLoading ? (
        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : children}
    </button>
  )
}

export function ReplyInput({ onCancel, onSubmit, isSubmitting, submitError, onClearError }: ReplyInputProps) {
  const replyText = useSignal("");
  const remainingChars = useComputed(() => MAX_CHARS - Array.from(graphemes.segment(replyText.value)).length);
  const remainingBytes = useComputed(() => MAX_BYTES - textEncoder.encode(replyText.value).length);
  const overLimit = remainingChars.value < 0 || remainingBytes.value < 0;
  const limitId = useId();
  const editor = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => { editor.current?.focus(); }, []);

  const handleSubmit = async () => {
    if (!replyText.value.trim() || isSubmitting || remainingChars.value < 0 || remainingBytes.value < 0) return;

    try {
      await onSubmit(replyText.value);
    } catch { /* The caller displays the submission error. */ }
  };

  const handleKeyDown = (e: h.JSX.TargetedKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.isComposing) return;
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();
      void handleSubmit();
    }
  };

  return (
    <div className="mt-2" onKeyDown={event => {
      if (event.key !== 'Escape' || event.isComposing) return;
      event.preventDefault();
      event.stopPropagation();
      if (!isSubmitting) onCancel();
    }}>
      <textarea
        ref={editor}
        aria-label="Your reply"
        aria-invalid={overLimit || !!submitError || undefined}
        aria-describedby={limitId}
        value={replyText.value}
        onInput={(e) => {
           replyText.value = (e.target as HTMLTextAreaElement).value;
           onClearError();
        }}
        onKeyDown={handleKeyDown}
        placeholder="Write your reply..."
        className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 ${submitError ? 'border-red-500 ring-red-500' : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'}`}
        rows={3}
        maxLength={MAX_BYTES}
        onClick={(e) => e.stopPropagation()}
        disabled={isSubmitting}
      />
      {submitError && (
          <p role="alert" className="text-red-500 text-xs mt-1">{submitError}</p>
      )}
      <div className="flex items-center justify-end gap-2 mt-1">
        <span id={limitId} className={`mr-auto min-w-0 text-xs ${overLimit ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
          {remainingBytes.value < 0 ? `${-remainingBytes.value} ${remainingBytes.value === -1 ? 'byte' : 'bytes'} over limit`
            : remainingChars.value < 0 ? `${-remainingChars.value} ${remainingChars.value === -1 ? 'character' : 'characters'} over limit`
            : `${remainingChars.value} ${remainingChars.value === 1 ? 'character' : 'characters'} left`}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onCancel(); }}
          disabled={isSubmitting}
          className="min-h-10 px-3 py-1 text-sm rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <ReplyButton
          onClick={event => { event.stopPropagation(); void handleSubmit(); }}
          disabled={!replyText.value.trim() || overLimit}
          isLoading={isSubmitting}
        >
          Reply
        </ReplyButton>
      </div>
    </div>
  );
}
