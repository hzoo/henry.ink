interface SelectionPopupProps {
  visible: boolean;
  position: { top: number; left: number };
}

const SelectionPopup = ({ visible, position }: SelectionPopupProps) => {
  if (!visible) {
    return null;
  }

  console.log("SelectionPopup", visible, position);

  return (
    <div
      className="absolute z-50 flex items-center gap-1 rounded-lg border border-blue-200 p-1 bg-white shadow-xl whitespace-nowrap min-w-max 
						 dark:bg-gray-800 dark:border-blue-300/30"
      style={{
        top: 0,
        left: 0,
        transform: `translate(${position.left}px, ${position.top}px) translateX(-50%)`,
        transition: "transform 0.1s ease-out",
        pointerEvents: "auto",
        userSelect: "none",
      }}
    >
      <button className="inline-flex flex-shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-sm text-gray-700 hover:bg-blue-100 
							 dark:text-gray-300 dark:hover:bg-blue-700/50">
        Annotate
        <kbd className="font-mono pointer-events-none flex select-none items-center justify-center rounded-sm bg-gray-200 px-1 text-xs text-gray-900 
								 dark:bg-gray-600 dark:text-gray-100">
          A
        </kbd>
      </button>
      <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" />
      <button className="inline-flex flex-shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-sm text-gray-700 hover:bg-blue-100 
							 dark:text-gray-300 dark:hover:bg-blue-700/50">
        Quote
        <kbd className="font-mono pointer-events-none flex select-none items-center justify-center rounded-sm bg-gray-200 px-1 text-xs text-gray-900 
								 dark:bg-gray-600 dark:text-gray-100">
          Q
        </kbd>
      </button>
    </div>
  );
};

export default SelectionPopup; 