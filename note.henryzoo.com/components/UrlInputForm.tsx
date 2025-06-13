import { inputValueSignal, errorSignal, isLoadingSignal } from "../signals";
import { currentUrl } from "@/lib/messaging";
import { useLocation } from "preact-iso";

export function UrlInputForm() {
	const location = useLocation();

	const handleLoadSiteClick = () => {
		if (inputValueSignal.value.startsWith("http")) {
			currentUrl.value = inputValueSignal.value; // This will trigger fetch via useContentFetcher
			// Update browser URL to reflect the input. The useUrlPathSyncer will see this change.
			location.route(`${inputValueSignal.value}`);
			errorSignal.value = null;
		} else {
			errorSignal.value =
				"Please enter a valid URL starting with http:// or https:/";
		}
	};

	const handleInput = (e: Event) => {
		const target = e.target as HTMLInputElement;
		inputValueSignal.value = target.value;
	};

	return (
		<div className="mb-6 p-4 bg-white shadow rounded-lg">
			<div className="flex flex-col sm:flex-row gap-2 items-center">
				<input
					type="text"
					value={inputValueSignal.value} // Bind to signal
					onInput={handleInput} // Update signal on input
					placeholder="Enter URL (e.g., https://example.com)"
					className="border p-2 w-full rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
					onKeyPress={(e) => e.key === "Enter" && handleLoadSiteClick()}
				/>
				<button
					onClick={handleLoadSiteClick}
					className="bg-blue-500 hover:bg-blue-600 text-white font-semibold p-2 px-4 rounded-md w-full sm:w-auto whitespace-nowrap"
					disabled={isLoadingSignal.value} // Use signal for disabled state
				>
					{isLoadingSignal.value ? "Loading..." : "Load Site"}
				</button>
			</div>
		</div>
	);
}
