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
			className={`font-sans leading-normal text-[12px] absolute z-10 flex items-center gap-1 rounded-lg border p-1 whitespace-nowrap min-w-max transition-all duration-150 ease-out
						 ${isAnimating.value ? 'mt-1 bg-blue-100 dark:bg-blue-700/50' : 'bg-white dark:bg-gray-800 border-blue-200 dark:border-blue-300/30'}`}
			style={{
				top:0,
				left:0,
				transform: `translate(${position.value.left}px, ${position.value.top}px)`,
				userSelect: "none",
			}}
		>
			<button
				className="inline-flex flex-shrink-0 items-center gap-1 rounded px-1.5 py-1 text-gray-700 hover:bg-blue-100 
							 dark:text-gray-300 dark:hover:bg-blue-700/50"
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
					className="flex items-center justify-center rounded-sm bg-gray-200 px-1 py-0.5 text-xs text-gray-900 
								 dark:bg-gray-600 dark:text-gray-100"
				>
					{title[0].toUpperCase()}
				</kbd>
			</button>
		</div>
	);
};

export default SelectionPopup;
