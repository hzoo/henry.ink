import type { ContentScriptContext } from "#imports";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import { useSignal } from "@preact/signals-react/runtime";
import { useEffect, useRef } from "preact/hooks";
import { render } from "preact";
import { useSignalEffect } from "@preact/signals";
import SelectionPopup from "~/components/SelectionPopup";
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
// -----------------------------

const MOUSE_OFFSET_Y_UPWARD = -60;  // Pixels above cursor when selecting UP
const MOUSE_OFFSET_Y_DOWNWARD = 60; // Pixels below cursor when selecting DOWN
const MOUSE_OFFSET_X = 20;  // Pixels left/right of cursor
const POPUP_ESTIMATED_WIDTH = 160; // Rough width for positioning/clamping
const HORIZONTAL_PADDING = 10;
const MIN_SELECTION_SPACES = 1; // Required spaces in selection
const THROTTLE_LIMIT_MS = 50; // Update position max every 50ms

const ContentScriptRoot = () => {
	const isVisible = useSignal(false);
	const position = useSignal({ top: 0, left: 0 });
	const popupRef = useRef<HTMLDivElement>(null);
	const isMouseDownRef = useRef(false); // Track active selection
	const latestMousePosRef = useRef({ x: 0, y: 0 }); // Track current mouse coords

	useSignalEffect(() => {
		const controller = new AbortController();
		const { signal } = controller;

		const handleMouseMove = (event: MouseEvent) => {
			latestMousePosRef.current = { x: event.clientX, y: event.clientY };
		};

		// --- Throttled position update logic ---
		const updatePositionThrottled = throttleVoid(() => {
			const selection = window.getSelection();
			const selectedText = selection ? selection.toString().trim() : "";
			const spaceCount = (selectedText.match(/ /g) || []).length;

			if (selection && selectedText.length > 0 && spaceCount >= MIN_SELECTION_SPACES) {
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

				// Use latest tracked mouse position
				const { x: clientX, y: clientY } = latestMousePosRef.current;

				// Calculate position based on mouse cursor & direction
				const currentScrollX = window.scrollX;
				const currentScrollY = window.scrollY;
				const viewportWidth = window.innerWidth;

				const verticalOffset = isSelectingUpward ? MOUSE_OFFSET_Y_UPWARD : MOUSE_OFFSET_Y_DOWNWARD;
				const idealTop = clientY + currentScrollY + verticalOffset;

				let idealLeft: number;
				if (clientX < viewportWidth / 2) {
					// Cursor on left half, show popup to the right
					idealLeft = clientX + currentScrollX + MOUSE_OFFSET_X;
				} else {
					// Cursor on right half, show popup to the left
					idealLeft = clientX + currentScrollX - MOUSE_OFFSET_X - POPUP_ESTIMATED_WIDTH;
				}

				// Clamp horizontal position
				const minAllowedLeft = currentScrollX + HORIZONTAL_PADDING;
				const maxAllowedLeft = currentScrollX + viewportWidth - POPUP_ESTIMATED_WIDTH - HORIZONTAL_PADDING;
				const finalLeft = Math.max(minAllowedLeft, Math.min(idealLeft, maxAllowedLeft));

				// Clamp top position (ensure doesn't go negative or off-screen)
				const finalTop = Math.max(currentScrollY + HORIZONTAL_PADDING, idealTop);

				position.value = { top: finalTop, left: finalLeft };
				if (!isVisible.value) isVisible.value = true;
			} else {
				// Hide if selection is invalid (too short, etc.)
				if (isVisible.value) isVisible.value = false;
			}
		}, THROTTLE_LIMIT_MS);
		// ---------------------------------------

		const handleSelectionChange = () => {
			// Only update during active selection (mouse down)
			if (!isMouseDownRef.current) {
				// If mouse is not down, hide popup immediately if selection clears
				const selection = window.getSelection();
				const selectedText = selection ? selection.toString().trim() : "";
				if (isVisible.value && selectedText.length === 0) {
					isVisible.value = false;
				}
				return;
			}

			// Call the throttled function to update position
			updatePositionThrottled();
		};

		const handleMouseDown = (event: MouseEvent) => {
			isMouseDownRef.current = true; // Start tracking selection
			// Capture initial mouse position in case mousemove hasn't fired yet
			latestMousePosRef.current = { x: event.clientX, y: event.clientY };
			// Hide popup if clicked outside the popup itself
			if (
				popupRef.current &&
				!popupRef.current.contains(event.target as Node)
			) {
				isVisible.value = false;
			}
		};

		const handleMouseUp = (event: MouseEvent) => {
			isMouseDownRef.current = false; // Stop tracking selection
			// Optional: could do a final check/hide here if needed, but selectionchange handles most cases.
		};

		document.addEventListener("selectionchange", handleSelectionChange, { signal });
		document.addEventListener("mousedown", handleMouseDown, { signal });
		document.addEventListener("mouseup", handleMouseUp, { signal });
		document.addEventListener("mousemove", handleMouseMove, { signal }); // Add mousemove listener

		return () => {
			controller.abort();
		};
	});

	return (
		<div ref={popupRef}>
			{isVisible.value && (
				<SelectionPopup position={position.value} />
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