import { useEffect } from "preact/hooks";
import type { ContentScriptSelectionMessage } from "@/lib/messagingTypes";
import { signal } from "@preact/signals";

interface SelectionPopupProps {
	position: { top: number; left: number };
	title: string;
}

const isAnimating = signal(false);

const handleSelection = () => {
	const selection = window.getSelection()?.toString();
	if (!selection) return;

	isAnimating.value = true;
	setTimeout(() => {
		isAnimating.value = false;
	}, 150);

	const message: ContentScriptSelectionMessage = {
		type: "SELECTION",
		from: "content",
		data: { selection },
	};
	browser.runtime.sendMessage(message).catch(console.error);
};

const handleKeyDown = (event: KeyboardEvent, title: string) => {
	if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
		return;
	}

	if (event.key.toLowerCase() === title[0].toLowerCase()) {
		event.preventDefault();
		event.stopPropagation();
		handleSelection();
	}
};

// dev: shortcut is the first letter of the title
const SelectionPopup = ({ position, title }: SelectionPopupProps) => {
	useEffect(() => {
		if (!title) return;
		document.addEventListener("keydown", (event) => handleKeyDown(event, title), { capture: true });
		return () => {
			document.removeEventListener("keydown", (event) => handleKeyDown(event, title), { capture: true });
		};
	}, [title]);

	return (
		<div
			className={`font-sans leading-normal text-[12px] absolute z-50 flex items-center gap-1 rounded-lg border p-1 whitespace-nowrap min-w-max transition-all duration-150 ease-out
						 ${isAnimating.value ? 'mt-1 bg-blue-100 dark:bg-blue-700/50' : 'bg-white dark:bg-gray-800 border-blue-200 dark:border-blue-300/30'}`}
			style={{
				top: 0,
				left: 0,
				transform: `translate(${position.left}px, ${position.top}px)`,
				userSelect: "none",
			}}
		>
			<button
				className="inline-flex flex-shrink-0 items-center gap-1 rounded px-1.5 py-1 text-gray-700 hover:bg-blue-100 
							 dark:text-gray-300 dark:hover:bg-blue-700/50"
				onMouseDown={(e) => {
					e.stopPropagation();
					handleSelection();
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
