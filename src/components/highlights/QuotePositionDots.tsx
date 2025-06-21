import { useSignal, useSignalEffect } from "@preact/signals-react/runtime";
import { useEffect } from "preact/hooks";
import { extractedQuotes } from "@/src/lib/highlights/signals";

interface QuotePositionDotsProps {
	contentRef: React.RefObject<HTMLElement>;
}

interface QuoteDot {
	id: string;
	position: number; // percentage from top (0-100)
	quote: string;
}

/**
 * Shows subtle dots along the right edge indicating quote positions in the content
 */
export function QuotePositionDots({ contentRef }: QuotePositionDotsProps) {
	const quoteDots = useSignal<QuoteDot[]>([]);

	// Calculate quote positions when quotes or content changes
	const updateQuotePositions = () => {
		const container = contentRef.current;
		if (!container) return;

		const quotes = extractedQuotes.value;
		if (quotes.length === 0) {
			quoteDots.value = [];
			return;
		}

		const newDots: QuoteDot[] = [];

		// Get container bounds
		const containerRect = container.getBoundingClientRect();
		const containerTop = containerRect.top + window.scrollY;
		const containerHeight = container.scrollHeight;

		for (const quote of quotes) {
			// Find the highlighted element for this quote
			const highlightElement = document.querySelector(
				`[data-highlight-id="${quote.id}"]`,
			);

			if (highlightElement) {
				const elementRect = highlightElement.getBoundingClientRect();
				const elementTop = elementRect.top + window.scrollY;

				// Calculate position relative to container
				const relativeTop = elementTop - containerTop;
				const position = Math.max(
					0,
					Math.min(100, (relativeTop / containerHeight) * 100),
				);

				newDots.push({
					id: quote.id,
					position,
					quote:
						quote.quote.substring(0, 100) +
						(quote.quote.length > 100 ? "..." : ""),
				});
			}
		}

		quoteDots.value = newDots;
	};

	// Update positions when quotes change
	useSignalEffect(() => {
		// Small delay to ensure highlights are rendered
		setTimeout(updateQuotePositions, 100);
	});

	// Update positions on window resize
	useEffect(() => {
		const handleResize = () => updateQuotePositions();
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	const scrollToQuote = (quoteId: string) => {
		const highlightElement = document.querySelector(
			`[data-highlight-id="${quoteId}"]`,
		);

		if (highlightElement) {
			highlightElement.scrollIntoView({
				behavior: "smooth",
				block: "center",
			});

			// Add a subtle pulse effect
			const originalBackground = (highlightElement as HTMLElement).style
				.backgroundColor;
			(highlightElement as HTMLElement).style.backgroundColor =
				"rgba(59, 130, 246, 0.4)";
			setTimeout(() => {
				(highlightElement as HTMLElement).style.backgroundColor =
					originalBackground;
			}, 1000);
		}
	};

	if (quoteDots.value.length === 0) {
		return null;
	}

	return (
		<div className="fixed right-2 top-20 bottom-20 w-2 pointer-events-none z-10 hidden lg:block">
			{quoteDots.value.map((dot) => (
				<button
					key={dot.id}
					onClick={() => scrollToQuote(dot.id)}
					className="absolute w-2 h-2 bg-blue-400/60 hover:bg-blue-500/80 rounded-full transition-all duration-200 hover:scale-125 pointer-events-auto group"
					style={{ top: `${dot.position}%` }}
					title={dot.quote}
				>
					<div className="absolute right-4 top-1/2 -translate-y-1/2 bg-gray-900 dark:bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap max-w-xs truncate pointer-events-none shadow-lg">
						{dot.quote}
					</div>
				</button>
			))}
		</div>
	);
}
