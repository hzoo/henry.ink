import { useSignal, type Signal } from "@preact/signals";
import { useEffect } from "preact/hooks";

export interface PopupAction {
	title: string;
	shortcut: string;
	onClick: () => void;
	icon?: string;
}

interface MultiButtonSelectionPopupProps {
	position: Signal<{ top: number; left: number }>;
	actions: PopupAction[];
}

const MultiButtonSelectionPopup = ({ position, actions }: MultiButtonSelectionPopupProps) => {
	const animatingIndex = useSignal<number | null>(null);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
				return;
			}
		
			const actionIndex = actions.findIndex(
				action => event.key.toLowerCase() === action.shortcut.toLowerCase()
			);
			
			if (actionIndex !== -1) {
				event.preventDefault();
				event.stopPropagation();
				animatingIndex.value = actionIndex;
				setTimeout(() => {
					actions[actionIndex].onClick();
					animatingIndex.value = null;
				}, 150);
			}
		};

		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [actions, animatingIndex]);

	return (
		<div
			className={`font-sans leading-normal text-[12px] absolute z-10 flex items-center gap-0.5 rounded-lg border p-1 whitespace-nowrap min-w-max transition-all duration-150 ease-out bg-white dark:bg-gray-800 border-blue-200 dark:border-blue-300/30`}
			style={{
				top: 0,
				left: 0,
				transform: `translate(${position.value.left}px, ${position.value.top}px)`,
				userSelect: "none",
			}}
		>
			{actions.map((action, index) => (
				<>
					<button
						key={action.title}
						className={`inline-flex flex-shrink-0 items-center gap-1 rounded px-1.5 py-1 text-gray-700 hover:bg-blue-100 
									 dark:text-gray-300 dark:hover:bg-blue-700/50 transition-colors
									 ${animatingIndex.value === index ? 'bg-blue-100 dark:bg-blue-700/50' : ''}`}
						onMouseDown={(e) => {
							e.stopPropagation();
							animatingIndex.value = index;
							setTimeout(() => {
								action.onClick();
								animatingIndex.value = null;
							}, 150);
						}}
					>
						{action.icon && <span className="text-sm">{action.icon}</span>}
						{action.title}
						<kbd
							className="flex items-center justify-center rounded-sm bg-gray-200 px-1 py-0.5 text-xs text-gray-900 
										 dark:bg-gray-600 dark:text-gray-100"
						>
							{action.shortcut.toUpperCase()}
						</kbd>
					</button>
					{index < actions.length - 1 && (
						<div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
					)}
				</>
			))}
		</div>
	);
};

export default MultiButtonSelectionPopup;