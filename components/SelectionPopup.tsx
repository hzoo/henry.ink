import { useEffect } from "preact/hooks";
import type { ContentScriptQuoteMessage } from "@/lib/messagingTypes";

interface SelectionPopupProps {
	position: { top: number; left: number };
}

function handleQuote() {
	const selection = window.getSelection()?.toString();
	if (!selection) return;

	const message: ContentScriptQuoteMessage = {
		type: "QUOTE_SELECTION",
		from: "content",
		data: { selection },
	};
	browser.runtime.sendMessage(message).catch(console.error);
}

const SelectionPopup = ({ position }: SelectionPopupProps) => {
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
				return;
			}

			const key = event.key.toLowerCase();
			if (key === "q") {
				event.preventDefault();
				event.stopPropagation();
            	console.debug("[q] pressed");
				handleQuote();
			}
		};

		document.addEventListener("keydown", handleKeyDown, { capture: true });

		return () => {
			document.removeEventListener("keydown", handleKeyDown, { capture: true });
		};
	}, []);

	return (
		<div
			className="font-sans leading-normal text-[12px] absolute z-50 flex items-center gap-1 rounded-lg border border-blue-200 p-1 bg-white whitespace-nowrap min-w-max 
						 dark:bg-gray-800 dark:border-blue-300/30"
			style={{
				top: 0,
				left: 0,
				transform: `translate(${position.left}px, ${position.top}px)`,
				transition: "transform 0.1s ease-out",
				userSelect: "none",
			}}
		>
			<button
				className="inline-flex flex-shrink-0 items-center gap-1 rounded px-1.5 py-1 text-gray-700 hover:bg-blue-100 
							 dark:text-gray-300 dark:hover:bg-blue-700/50"
				onMouseDown={(e) => {
					e.stopPropagation();
					console.debug("[q] clicked");
					handleQuote();
				}}
			>
				Quote
				<kbd
					className="flex items-center justify-center rounded-sm bg-gray-200 px-1 py-0.5 text-xs text-gray-900 
								 dark:bg-gray-600 dark:text-gray-100"
				>
					Q
				</kbd>
			</button>
		</div>
	);
};

export default SelectionPopup;
