import { quotedSelection, showCommentDialog } from "@/src/lib/messaging";
import { lazyComponent } from "@/src/lib/lazy-component";

// The composer is the largest sidebar component and only matters once someone
// writes, so it loads on first open instead of with the reader.
export const QuoteComposer = lazyComponent(() =>
	import("@/src/components/QuoteComposer").then((module) => module.QuoteComposer),
);

export function QuotePopup() {
	if (!quotedSelection.value && !showCommentDialog.value) return null;
	return <QuoteComposer />;
}
