import { useSignal, type Signal } from "@preact/signals";
import { useEffect } from "preact/hooks";

interface SelectionPopupProps {
	position: Signal<{ top: number; left: number }>;
	title: string;
	sendSelection: () => void;
}

// dev: shortcut is the first letter of the title
const SelectionPopup = ({ position, title, sendSelection }: SelectionPopupProps) => {
	const isAnimating = useSignal(false);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent, title: string) => {
			if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
				return;
			}
		
			if (event.key.toLowerCase() === title[0].toLowerCase()) {
				event.preventDefault();
				event.stopPropagation();
				isAnimating.value = true;
				setTimeout(() => {
					sendSelection();
					isAnimating.value = false;
				}, 150);
			}
		};

		document.addEventListener("keydown", (event) => onKeyDown(event, title));
		return () => {
			document.removeEventListener("keydown", (event) => onKeyDown(event, title));
		};
	}, [title, isAnimating, sendSelection]);

	return (
		<div
			className={`selection-popup ${isAnimating.value ? 'is-animating' : ''}`}
			style={{
				top:0,
				left:0,
				transform: `translate(${position.value.left}px, ${position.value.top}px)`,
				userSelect: "none",
			}}
		>
			<button
				className="selection-popup button"
				onMouseDown={(e) => {
					e.stopPropagation();
					isAnimating.value = true;
					setTimeout(() => {
						sendSelection();
						isAnimating.value = false;
					}, 150);
				}}
			>
				{title}
				<kbd
					className="selection-popup kbd"
				>
					{title[0].toUpperCase()}
				</kbd>
			</button>
		</div>
	);
};

export default SelectionPopup;
