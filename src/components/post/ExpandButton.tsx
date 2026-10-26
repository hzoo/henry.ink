import type { Signal } from "@preact/signals-core";
import { Icon } from "@/src/components/Icon";

interface ExpandButtonProps {
	isExpanded: Signal<boolean>;
}

export function ExpandButton({ isExpanded }: ExpandButtonProps) {
	return <>
		<button
			type="button"
			aria-label={isExpanded.value ? "Collapse thread" : "Expand thread"}
			aria-expanded={isExpanded.value}
			className="peer inline-flex h-10 w-10 shrink-0 items-center justify-center rounded hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-gray-500 dark:hover:bg-gray-800"
			onClick={event => {
				event.stopPropagation();
				isExpanded.value = !isExpanded.value;
			}}
			title={isExpanded.value ? "Collapse thread" : "Expand thread"}
		>
			<Icon name={isExpanded.value ? "minusCircle" : "plusCircle"} className={isExpanded.value ? "size-4" : "size-6"} />
		</button>
		{isExpanded.value && <span aria-hidden="true" className="pointer-events-none absolute bottom-1 left-5 top-10 w-[1.5px] bg-gray-200 transition-colors duration-150 peer-hover:bg-slate-800 peer-focus-visible:bg-slate-800 dark:bg-gray-700 dark:peer-hover:bg-slate-50 dark:peer-focus-visible:bg-slate-50" />}
	</>;
}
