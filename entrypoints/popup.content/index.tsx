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

// --- Simple Throttle Utility (Specific for no args, void return) ---
function throttleVoid(func: () => void, limit: number): () => void {
	let inThrottle: boolean;
	return (): void => {
		if (!inThrottle) {
			inThrottle = true;
			func();
			setTimeout(() => (inThrottle = false), limit);
		}
	};
}

const POPUP_ESTIMATED_WIDTH = 75; // Rough width for positioning/clamping
const HORIZONTAL_PADDING = 10;
const MIN_SELECTION_SPACES = 1; // Required spaces in selection
const THROTTLE_LIMIT_MS = 50;
const POPUP_VERTICAL_OFFSET = 20; // Pixels above/below selection
const POPUP_ESTIMATED_HEIGHT = 20; // Rough height for vertical clamping
const VERTICAL_PADDING = 5; // Padding from top/bottom viewport edges

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
	const latestMousePos = useSignal({ x: 0, y: 0 });

	useSignalEffect(() => {
		const controller = new AbortController();
		const { signal } = controller;

		const handleMouseMove = (event: MouseEvent) => {
			latestMousePos.value = { x: event.clientX, y: event.clientY };
		};

		const updatePositionThrottled = throttleVoid(() => {
			const selection = window.getSelection();
			const selectedText = selection ? selection.toString().trim() : "";
			const spaceCount = (selectedText.match(/ /g) || []).length;

			// Check if selection is valid
			if (selection && selection.rangeCount > 0 && selectedText.length > 0 && spaceCount >= MIN_SELECTION_SPACES) {
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

				// --- Position Calculation based on Selection Rect ---

				// 1. Calculate Ideal Position
				let idealTop: number;
				if (isSelectingUpward) {
					idealTop = rect.top + currentScrollY - POPUP_ESTIMATED_HEIGHT - POPUP_VERTICAL_OFFSET;
				} else {
					idealTop = rect.bottom + currentScrollY + POPUP_VERTICAL_OFFSET;
				}
				const idealLeft = rect.left + currentScrollX + (rect.width / 2) - (POPUP_ESTIMATED_WIDTH / 2);

				// 2. Clamp Position Horizontally & Vertically
				const minAllowedLeft = currentScrollX + HORIZONTAL_PADDING;
				const maxAllowedLeft = currentScrollX + viewportWidth - POPUP_ESTIMATED_WIDTH - HORIZONTAL_PADDING;
				const finalLeft = Math.max(minAllowedLeft, Math.min(idealLeft, maxAllowedLeft));

				const minAllowedTop = currentScrollY + VERTICAL_PADDING;
				const maxAllowedTop = currentScrollY + viewportHeight - POPUP_ESTIMATED_HEIGHT - VERTICAL_PADDING;
				const finalTop = Math.max(minAllowedTop, Math.min(idealTop, maxAllowedTop));

				// --- Final Assignment ---
				position.value = { top: finalTop, left: finalLeft };
				if (!isVisible.value) isVisible.value = true;
			} else {
				// Hide popup if selection is invalid or cleared
				if (isVisible.value) isVisible.value = false;
			}
		}, THROTTLE_LIMIT_MS);

		const handleSelectionChange = () => {
			// console.log("Selection change, updating position");
			updatePositionThrottled();
		};

		const handleMouseDown = async (event: MouseEvent) => {
			if (popupRef.current?.contains(event.target as Node)) {
				return;
			}

			const isOpen = await checkSidepanelOpen();
			if (!isOpen) {
				// console.log("Mousedown check: Sidepanel closed, aborting selection start.");
				batch(() => {
					isMouseDown.value = false;
					if (isVisible.value) isVisible.value = false;
				});
				return;
			}

			// console.log("Mousedown check: Sidepanel open, starting selection tracking.");
			batch(() => {
				isMouseDown.value = true;
				latestMousePos.value = { x: event.clientX, y: event.clientY };
				isVisible.value = false;
			});


			document.addEventListener("mousemove", handleMouseMove, { signal });
			document.addEventListener("selectionchange", handleSelectionChange, { signal });

		};

		const handleMouseUp = (event: MouseEvent) => {
			isMouseDown.value = false;
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("selectionchange", handleSelectionChange);
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