import type { ContentScriptContext } from "#imports";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import { useSignal } from "@preact/signals-react/runtime";
import { useEffect, useRef } from "preact/hooks";
import { render } from "preact";
import { useSignalEffect } from "@preact/signals";
import SelectionPopup from "~/components/SelectionPopup";
import "./style.css";

const POPUP_OFFSET_Y_ABOVE = 40;
const POPUP_OFFSET_Y_BELOW = 10;
const POPUP_ESTIMATED_HALF_WIDTH = 80; // Adjust if needed
const HORIZONTAL_PADDING = 10;

const ContentScriptRoot = () => {
	const isVisible = useSignal(false);
	const position = useSignal({ top: 0, left: 0 });
	const popupRef = useRef<HTMLDivElement>(null);
	const isMouseDownRef = useRef(false);

	useSignalEffect(() => {
		const controller = new AbortController();
		const { signal } = controller;

		const handleSelectionChange = () => {
			if (!isMouseDownRef.current) return;

			const selection = window.getSelection();
			const selectedText = selection ? selection.toString().trim() : "";

			// Check if selection is not empty and has at least 1 space
			const spaceCount = (selectedText.match(/ /g) || []).length;

			if (selection && selectedText.length > 0 && spaceCount >= 2) {
				const range = selection.getRangeAt(0);
				const selectionRect = range.getBoundingClientRect();
				const clientRects = range.getClientRects();

				if (clientRects.length > 0) {
					// Determine selection direction
					let isBackward = false;
					const { anchorNode, anchorOffset, focusNode, focusOffset } = selection;
					if (anchorNode && focusNode) { // Ensure nodes are not null
						if (anchorNode === focusNode) {
							isBackward = focusOffset < anchorOffset;
						} else {
							const positionComparison = anchorNode.compareDocumentPosition(focusNode);
							// Check if focusNode precedes anchorNode in document order
							isBackward = Boolean(positionComparison & Node.DOCUMENT_POSITION_PRECEDING);
						}
					}

					// Choose the anchor rect based on direction
					const anchorRect = isBackward ? clientRects[clientRects.length - 1] : clientRects[0];

					// Calculate potential positions
					const topAbove = selectionRect.top + window.scrollY - POPUP_OFFSET_Y_ABOVE;
					const topBelow = selectionRect.bottom + window.scrollY + POPUP_OFFSET_Y_BELOW;

					// Decide vertical placement based on direction and viewport constraints
					let finalTop: number;
					if (isBackward) {
						// Selecting UP: Prefer ABOVE, flip to BELOW if top is off-screen
						finalTop = (topAbove < window.scrollY) ? topBelow : topAbove;
					} else {
						// Selecting DOWN: Prefer BELOW, flip to ABOVE if bottom is too close to viewport end
						// Use a buffer (e.g., POPUP_OFFSET_Y_ABOVE * 2) as a proxy for popup height + clearance
						const bottomClearance = POPUP_OFFSET_Y_ABOVE * 2;
						finalTop = (selectionRect.bottom > window.innerHeight - bottomClearance) ? topAbove : topBelow;
					}

					// Calculate ideal horizontal center
					const idealLeft = anchorRect.left + window.scrollX + anchorRect.width / 2;

					// Clamp horizontal position to keep popup within viewport
					const minAllowedLeft = window.scrollX + POPUP_ESTIMATED_HALF_WIDTH + HORIZONTAL_PADDING;
					const maxAllowedLeft = window.scrollX + window.innerWidth - POPUP_ESTIMATED_HALF_WIDTH - HORIZONTAL_PADDING;
					const finalLeft = Math.max(minAllowedLeft, Math.min(idealLeft, maxAllowedLeft));

					// Ensure top doesn't go negative
					position.value = { top: Math.max(0, finalTop), left: finalLeft };
					if (!isVisible.value) isVisible.value = true;
				} else {
					// Fallback or if no rects found, hide
					if (isVisible.value) isVisible.value = false;
				}
			} else {
				if (isVisible.value) isVisible.value = false;
			}
		};

		const handleMouseDown = (event: MouseEvent) => {
			isMouseDownRef.current = true;
			if (
				popupRef.current &&
				!popupRef.current.contains(event.target as Node)
			) {
				isVisible.value = false;
			}
			const selection = window.getSelection();
			if (!selection || selection.toString().trim().length === 0) {
				isVisible.value = false;
			}
		};

		const handleMouseUp = (event: MouseEvent) => {
			isMouseDownRef.current = false;
		};

		document.addEventListener("selectionchange", handleSelectionChange, { signal });
		document.addEventListener("mousedown", handleMouseDown, { signal });
		document.addEventListener("mouseup", handleMouseUp, { signal });

		return () => {
			controller.abort();
		};
	});

	return (
		<div ref={popupRef}>
			<SelectionPopup visible={isVisible.value} position={position.value} />
		</div>
	);
};

export default defineContentScript({
	matches: ["<all_urls>"],
	cssInjectionMode: "ui",

	async main(ctx) {
		const ui = await createUi(ctx);
		ui.mount();
		console.log("Selection popup content script loaded.");
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