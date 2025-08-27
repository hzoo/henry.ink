import { useSignal } from "@preact/signals-react/runtime";
import { batch } from "@preact/signals-core";
import { useEffect, useRef } from "preact/hooks";
import type { RefObject } from "preact";
import MultiButtonSelectionPopup, { type PopupAction } from "./MultiButtonSelectionPopup";

const POPUP_ESTIMATED_WIDTH = 150; // Wider for two buttons
const HORIZONTAL_PADDING = 10;
const POPUP_VERTICAL_OFFSET = 15;
const POPUP_ESTIMATED_HEIGHT = 38;
const VERTICAL_PADDING = 5;

const calculatePopupPosition = (
	selection: Selection | null,
	positionAtEnd: boolean,
): { top: number; left: number } | null => {
	if (
		!selection ||
		selection.rangeCount === 0 ||
		!selection.toString().trim().includes(" ")
	) {
		return null;
	}

	const range = selection.getRangeAt(0);
	const rect = range.getBoundingClientRect();

	let isSelectingUpward = false;
	const { anchorNode, anchorOffset, focusNode, focusOffset } = selection;
	if (anchorNode && focusNode) {
		if (anchorNode === focusNode) {
			isSelectingUpward = focusOffset < anchorOffset;
		} else {
			const positionComparison = anchorNode.compareDocumentPosition(focusNode);
			isSelectingUpward = Boolean(
				positionComparison & Node.DOCUMENT_POSITION_PRECEDING,
			);
		}
	}

	const currentScrollX = window.scrollX;
	const currentScrollY = window.scrollY;
	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;

	let idealTop: number;
	if (positionAtEnd) {
		if (isSelectingUpward) {
			idealTop =
				rect.top +
				currentScrollY -
				POPUP_ESTIMATED_HEIGHT -
				POPUP_VERTICAL_OFFSET;
		} else {
			idealTop = rect.bottom + currentScrollY + POPUP_VERTICAL_OFFSET;
		}
	} else {
		if (!isSelectingUpward) {
			idealTop =
				rect.top +
				currentScrollY -
				POPUP_ESTIMATED_HEIGHT -
				POPUP_VERTICAL_OFFSET;
		} else {
			idealTop = rect.bottom + currentScrollY + POPUP_VERTICAL_OFFSET;
		}
	}
	const idealLeft =
		rect.left + currentScrollX + rect.width / 2 - POPUP_ESTIMATED_WIDTH / 2;

	const minAllowedLeft = currentScrollX + HORIZONTAL_PADDING;
	const maxAllowedLeft =
		currentScrollX + viewportWidth - POPUP_ESTIMATED_WIDTH - HORIZONTAL_PADDING;
	const finalLeft = Math.max(
		minAllowedLeft,
		Math.min(idealLeft, maxAllowedLeft),
	);

	const minAllowedTop = currentScrollY + VERTICAL_PADDING;
	const maxAllowedTop =
		currentScrollY + viewportHeight - POPUP_ESTIMATED_HEIGHT - VERTICAL_PADDING;
	const finalTop = Math.max(minAllowedTop, Math.min(idealTop, maxAllowedTop));

	return { top: finalTop, left: finalLeft };
};

interface SelectionPopupManagerV2Props {
	canShowPopup: () => Promise<boolean> | boolean;
	actions: PopupAction[];
	targetContainerRef?: RefObject<HTMLDivElement>;
}

const SelectionPopupManagerV2 = ({
	canShowPopup,
	actions,
	targetContainerRef,
}: SelectionPopupManagerV2Props) => {
	const isVisible = useSignal(false);
	const position = useSignal({ top: 0, left: 0 });
	const popupRef = useRef<HTMLDivElement>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		const controller = new AbortController();
		const { signal } = controller;

		const onSelectionChange = () => {
			batch(() => {	
				const newPos = calculatePopupPosition(window.getSelection(), false);
				if (newPos) {
					isVisible.value = true;
					position.value = newPos;
				} else {
					isVisible.value = false;
				}
			});
		};

		const onMouseDown = async (event: Event) => {
			if (popupRef.current?.contains(event.target as Node)) {
				return;
			}

			if (!(await canShowPopup())) {
				isVisible.value = false;
				return;
			}

			document.addEventListener("selectionchange", onSelectionChange, {
				signal,
			});
			document.addEventListener("mouseup", onMouseUp, { signal });
		};

		const onMouseUp = async () => {
			document.removeEventListener("selectionchange", onSelectionChange);
			document.removeEventListener("mouseup", onMouseUp);

			const allowedToShow = await canShowPopup();
			if (!allowedToShow) {
				isVisible.value = false;
				return;
			}

			batch(() => {
				const finalPos = calculatePopupPosition(window.getSelection(), true);
				if (finalPos) {
					position.value = finalPos;
					isVisible.value = true;
				} else {
					isVisible.value = false;
				}
			});
		};

		// Attach mousedown listener to the target container
		(targetContainerRef?.current || document).addEventListener("mousedown", onMouseDown, { signal });

		return () => {
			controller.abort();
		};
	}, []);

	return (
		<div ref={popupRef}>
			{isVisible.value && (
				<MultiButtonSelectionPopup position={position} actions={actions} />
			)}
		</div>
	);
};

export default SelectionPopupManagerV2;