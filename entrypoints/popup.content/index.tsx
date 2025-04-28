import type { ContentScriptContext } from "#imports";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import { useSignal } from "@preact/signals-react/runtime";
import { useRef } from "preact/hooks";
import { render } from "preact";
import { batch, useSignalEffect } from "@preact/signals";
import SelectionPopup from "~/components/SelectionPopup";
import type {
	ContentScriptPingMessage,
} from "@/lib/messagingTypes";
import "@/lib/styles.css";

const POPUP_ESTIMATED_WIDTH = 75; // Rough width for positioning/clamping
const HORIZONTAL_PADDING = 10;
const POPUP_VERTICAL_OFFSET = 15; // Pixels above/below selection
const POPUP_ESTIMATED_HEIGHT = 38; // Rough height for vertical clamping
const VERTICAL_PADDING = 5; // Padding from top/bottom viewport edges

const calculatePopupPosition = (
	selection: Selection,
	positionAtEnd: boolean // True for mouseup (end of selection), False for selectionchange (start of selection)
): { top: number; left: number } | null => {
	if (!(selection && selection.rangeCount > 0 && selection.toString().trim().length > 0)) {
		return null; // Invalid selection
	}

	const range = selection.getRangeAt(0);
	const rect = range.getBoundingClientRect();

	// Determine selection direction
	let isSelectingUpward = false;
	const { anchorNode, anchorOffset, focusNode, focusOffset } = selection;
	if (anchorNode && focusNode) {
		if (anchorNode === focusNode) {
			isSelectingUpward = focusOffset < anchorOffset;
		} else {
			const positionComparison = anchorNode.compareDocumentPosition(focusNode);
			isSelectingUpward = Boolean(positionComparison & Node.DOCUMENT_POSITION_PRECEDING);
		}
	}

	const currentScrollX = window.scrollX;
	const currentScrollY = window.scrollY;
	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;

	// Calculate Ideal Position based on flag
	let idealTop: number;
	if (positionAtEnd) {
		// Position relative to the END of the selection
		if (isSelectingUpward) {
			idealTop = rect.top + currentScrollY - POPUP_ESTIMATED_HEIGHT - POPUP_VERTICAL_OFFSET;
		} else {
			idealTop = rect.bottom + currentScrollY + POPUP_VERTICAL_OFFSET;
		}
	} else {
		// Position relative to the START of the selection (opposite of end)
		if (!isSelectingUpward) { // Start is top when selecting down
			idealTop = rect.top + currentScrollY - POPUP_ESTIMATED_HEIGHT - POPUP_VERTICAL_OFFSET;
		} else { // Start is bottom when selecting up
			idealTop = rect.bottom + currentScrollY + POPUP_VERTICAL_OFFSET;
		}
	}
	const idealLeft = rect.left + currentScrollX + (rect.width / 2) - (POPUP_ESTIMATED_WIDTH / 2);

	// Clamp Position Horizontally & Vertically
	const minAllowedLeft = currentScrollX + HORIZONTAL_PADDING;
	const maxAllowedLeft = currentScrollX + viewportWidth - POPUP_ESTIMATED_WIDTH - HORIZONTAL_PADDING;
	const finalLeft = Math.max(minAllowedLeft, Math.min(idealLeft, maxAllowedLeft));

	const minAllowedTop = currentScrollY + VERTICAL_PADDING;
	const maxAllowedTop = currentScrollY + viewportHeight - POPUP_ESTIMATED_HEIGHT - VERTICAL_PADDING;
	const finalTop = Math.max(minAllowedTop, Math.min(idealTop, maxAllowedTop));

	return { top: finalTop, left: finalLeft };
};

const checkSidepanelOpen = async () => {
	const pingMessage: ContentScriptPingMessage = {
		type: "PING_SIDEPANEL",
		from: "content",
	};
	try {
		const response = await browser.runtime.sendMessage(pingMessage);
		if (response && response.type === "PONG_SIDEPANEL") {
			return true;
		}
	} catch { 
		return false;
	}
}

const ContentScriptRoot = () => {
	const isVisible = useSignal(false);
	const position = useSignal({ top: 0, left: 0 });
	const popupRef = useRef<HTMLDivElement>(null);
	const isMouseDown = useSignal(false);

	// --- Effects and Handlers ---
	useSignalEffect(() => {
		const controller = new AbortController();
		const { signal } = controller;

		const handleSelectionChange = () => {
			const selection = window.getSelection();
			if (!selection) return;

			const newPos = calculatePopupPosition(selection, false); // Position at START during selection

			if (newPos) {
				position.value = newPos;
				if (!isVisible.value) isVisible.value = true;
			} else {
				if (isVisible.value) isVisible.value = false;
			}
		};

		const handleMouseDown = async (event: MouseEvent) => {
			if (popupRef.current?.contains(event.target as Node)) {
				return;
			}

			const isOpen = await checkSidepanelOpen();
			if (!isOpen) {
				batch(() => {
					isMouseDown.value = false;
					if (isVisible.value) isVisible.value = false;
				});
				return;
			}

			batch(() => {
				isMouseDown.value = true;
				isVisible.value = false; // Hide initially on mousedown
			});

			document.addEventListener("selectionchange", handleSelectionChange, { signal });
			// Add a small delay to ensure selectionchange has fired before mouseup
			await new Promise(resolve => setTimeout(resolve, 10)); 
		};

		const handleMouseUp = (event: MouseEvent) => {
			isMouseDown.value = false;
			document.removeEventListener("selectionchange", handleSelectionChange);

			const selection = window.getSelection();
			if (!selection) return;

			// Reposition based on the final selection state ENDPOINT
			const finalPos = calculatePopupPosition(selection, true); // Position at END on mouseup

			if (finalPos) {
				position.value = finalPos;
				// Ensure visibility is on if it wasn't already (e.g., very fast click didn't trigger selectionchange)
				if (!isVisible.peek()) isVisible.value = true;
			} else {
				// If selection became invalid by mouseup time, hide it
				if (isVisible.peek()) isVisible.value = false;
			}
		};

		document.addEventListener("mousedown", handleMouseDown, { signal });
		document.addEventListener("mouseup", handleMouseUp, { signal });

		return () => {
			controller.abort();
		};
	});

	return (
		<div ref={popupRef}>
			{isVisible.value && (
				<SelectionPopup position={position.value} title="Quote" />
			)}
		</div>
	);
};

export default defineContentScript({
	matches: ["<all_urls>"],
	cssInjectionMode: "ui",

	async main(ctx) {
		const ui = await createUi(ctx);
		ui.mount();
	},
});

async function createUi(ctx: ContentScriptContext) {
	const ui = await createShadowRootUi(ctx, {
		name: "selection-popup-ui",
		position: "inline",
		anchor: "body",
		append: "first",
		onMount(container: HTMLElement) {
			const root = render(<ContentScriptRoot />, container);
			return root;
		},
	});

	return ui;
}