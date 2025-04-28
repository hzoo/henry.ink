import { useSignal, type Signal } from "@preact/signals";
import type { ComponentChildren, JSX, h } from "preact";

interface ReplyInputProps {
  onCancel: () => void;
  onSubmit: (text: string) => Promise<void>;
  isSubmitting: Signal<boolean>;
  submitError: Signal<string | null>;
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
      className={`px-3 py-1 text-sm rounded-md bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${props.className || ""}`}
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

export function ReplyInput({ onCancel, onSubmit, isSubmitting, submitError }: ReplyInputProps) {
  const replyText = useSignal("");

  const handleSubmitClick = async (e: MouseEvent) => {
    e.stopPropagation();
    if (!replyText.value.trim() || isSubmitting.value) return;

    try {
      await onSubmit(replyText.value);
    } catch (error) {
      console.error("Reply submission failed (propagated to ReplyInput):", error);
    }
  };

  const handleKeyDown = (e: h.JSX.TargetedKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !isSubmitting.value) {
       const submit = async () => {
          try {
            await onSubmit(replyText.value);
          } catch(err) { /* already handled by caller */ }
       }
       submit();

    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="mt-2">
      <textarea
        value={replyText.value}
        onInput={(e) => {
           replyText.value = (e.target as HTMLTextAreaElement).value;
           submitError.value = null;
        }}
        onKeyDown={handleKeyDown}
        placeholder="Write your reply..."
        className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 ${submitError.value ? 'border-red-500 ring-red-500' : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'}`}
        rows={3}
        onClick={(e) => e.stopPropagation()}
        disabled={isSubmitting.value}
      />
      {submitError.value && (
          <p className="text-red-500 text-xs mt-1">{submitError.value}</p>
      )}
      <div className="flex justify-end gap-2 mt-1">
        <button
          onClick={(e) => { e.stopPropagation(); onCancel(); }}
          disabled={isSubmitting.value}
          className="px-3 py-1 text-sm rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <ReplyButton
          onClick={handleSubmitClick}
          disabled={!replyText.value.trim()}
          isLoading={isSubmitting.value}
        >
          Reply
        </ReplyButton>
      </div>
    </div>
  );
} 