import { lastSeenVersion } from "@/lib/extension-signals";
import { version } from "../package.json";
import { changelogData } from "@/lib/changelog";
import type { ChangelogEntry } from "@/lib/changelog";
import { useComputed, useSignal } from "@preact/signals-react/runtime";
import type { JSX } from "preact";

const currentVersion = version;

// Helper function to compare simple versions (e.g., "0.1.0", "0.2.1")
// Returns > 0 if v1 > v2, < 0 if v1 < v2, 0 if equal
function compareVersions(v1: string, v2: string): number {
	const parts1 = v1.split(".").map(Number);
	const parts2 = v2.split(".").map(Number);
	const len = Math.max(parts1.length, parts2.length);
	for (let i = 0; i < len; i++) {
		const p1 = parts1[i] || 0;
		const p2 = parts2[i] || 0;
		if (p1 > p2) return 1;
		if (p1 < p2) return -1;
	}
	return 0;
}

// --- Extracted Logic ---

function getRelevantChanges(
	lastVersion: string,
	currentVersion: string,
	allChanges: readonly ChangelogEntry[],
): ChangelogEntry[] {
	if (lastVersion === "0.0.0") {
		// Show only the latest entry for brand new users
		return allChanges.length > 0 ? [allChanges[0]] : [];
	}

	const changesToShow: ChangelogEntry[] = [];
	// Iterate newest to oldest
	for (const entry of allChanges) {
		const comparisonWithCurrent = compareVersions(
			entry.version,
			currentVersion,
		);
		const comparisonWithLast = compareVersions(entry.version, lastVersion);

		// Skip versions newer than current (shouldn't happen in prod)
		if (comparisonWithCurrent > 0) {
			continue;
		}

		// Include versions newer than the last seen version
		if (comparisonWithLast > 0) {
			changesToShow.push(entry);
		} else {
			// Stop once we reach the last seen version or older
			break;
		}
	}
	// Return in chronological order (oldest first) if needed, but current display is newest first.
	// If chronological needed: return changesToShow.reverse();
	return changesToShow; // Keep newest first as per original display logic
}

function shouldShowWelcome(lastVersion: string): boolean {
	return lastVersion === "0.0.0";
}

// --- Step Rendering Functions ---

function renderWelcomeStep(): JSX.Element {
	return (
		<>
			<p>
				hi there! I built this extension to see what people are saying about any
				website.
			</p>
			<p>
				upon using it, I realized that{" "}
				<em className="font-bold">browsing becomes searching</em>: relevant
				discussions appear automatically as you navigate.
			</p>
			<p className="text-xs text-blue-700">
				akin to an early internet idea of{" "}
				<a
					href="https://en.wikipedia.org/wiki/Web_annotation"
					target="_blank"
					rel="noopener noreferrer"
					className="text-blue-500 hover:underline"
				>
					web annotations
				</a>
				, but on atproto
			</p>
		</>
	);
}

function renderWhatsNewStep(
	changes: ChangelogEntry[],
	showWelcome: boolean,
	lastVersion: string,
	currentVersion: string,
): JSX.Element {
	return (
		<div>
			<h3 className="font-semibold mb-1">
				What's New (
				{showWelcome ? `Up to v${currentVersion}` : `Since v${lastVersion}`})
			</h3>
			<ul className="space-y-2 list-disc list-inside pl-0 text-xs">
				{changes.map((entry) => (
					<li key={entry.version} className="mt-1">
						<span className="font-medium">v{entry.version}:</span>
						<ul className="list-disc list-inside pl-2 mt-0.5 space-y-0.5">
							{entry.changes.map((change) => (
								// Using change content + version as key for potential duplicates
								<li key={`${entry.version}-${change}`}>{change}</li>
							))}
						</ul>
					</li>
				))}
			</ul>
		</div>
	);
}

function renderHowItWorksStep(currentVersion: string): JSX.Element {
	return (
		<>
			<h3 className="font-semibold">How it works + privacy</h3>
			<p>
				When you navigate using a browser, the current URL (and your IP address)
				are sent to{" "}
				<a
					href="https://docs.bsky.app/docs/api/app-bsky-feed-search-posts"
					target="_blank"
					rel="noopener noreferrer"
					className="text-blue-500 hover:underline"
				>
					Bluesky's servers
				</a>
				. This is the same as{" "}
				<a
					href="https://bsky.app/search?q=https%3A%2F%2Fgithub.com%2Fhzoo%2Fextension-annotation-sidebar "
					target="_blank"
					rel="noopener noreferrer"
					className="text-blue-500 hover:underline"
				>
					searching
				</a>{" "}
				on their website directly, but automatic.
			</p>
			<p className="text-xs text-blue-700">
				(Note: Private URLs like Gmail pages typically won't have public
				discussions, so no results will appear for those.)
			</p>
			<p>
				You can manage this behavior in the settings
				(auto-fetching), or use a VPN for added privacy.
			</p>
			<p>
				(there's also a small cache so navigating between previously visited
				pages will show instantly). In the future, I may need to add a dedicated
				server if bsky modifies their search API, or if I need to do my own
				caching
			</p>
			<p className="text-xs text-blue-700">
				Have questions or feedback? Find the code on{" "}
				<a
					href="https://github.com/hzoo/extension-annotation-sidebar"
					target="_blank"
					rel="noopener noreferrer"
					className="text-blue-500 hover:underline"
				>
					GitHub (v{currentVersion})
				</a>
				.
			</p>
		</>
	);
}

function renderEthosStep(): JSX.Element {
	return (
		<>
			<p>
				As Emily from the Bluesky team put it, the vision of atproto is broad –
				imagine "
				<a
					href="https://bsky.app/profile/emilyliu.me/post/3lbssu4hrck2i"
					target="_blank"
					rel="noopener noreferrer"
					className="text-blue-500 hover:underline"
				>
					Community Notes for the entire internet
				</a>
				"! Being able to tap into the existing conversations of the entire
				Bluesky user base and more is powerful.
			</p>
			<p className="text-xs text-blue-700">
				Hoping for this project to work towards a similar{" "}
				<a
					href="https://atproto.com/articles/atproto-ethos"
					target="_blank"
					rel="noopener noreferrer"
					className="text-blue-500 hover:underline"
				>
					ethos
				</a>
				. Future plans may include: dedicated lexicons for longer-form posts,
				other data sources (Obsidian, HN, etc.), archival, voting?
			</p>
			<p>
				with thanks,{" "}
				<a
					href="https://bsky.app/profile/henryzoo.com"
					target="_blank"
					rel="noopener noreferrer"
					className="text-blue-500 hover:underline"
				>
					Henry
				</a>
				.
			</p>
		</>
	);
}

// --- Component ---

const handleDismiss = () => {
	lastSeenVersion.value = currentVersion;
};

type Step = {
	id: string;
	content: JSX.Element;
};

export function FirstTimePopup() {
	if (lastSeenVersion.value === currentVersion) {
		return null;
	}

	const currentStep = useSignal(0);
	const relevantChanges = useComputed(() =>
		getRelevantChanges(lastSeenVersion.value, currentVersion, changelogData),
	);

	const steps = useComputed<Step[]>(() => {
		const generatedSteps: Step[] = [];
		const showWelcome = shouldShowWelcome(lastSeenVersion.value);

		// Use the memoized values calculated above
		if (showWelcome) {
			generatedSteps.push({ id: "welcome", content: renderWelcomeStep() });
		}

		if (relevantChanges.value.length > 0) {
			generatedSteps.push({
				id: "whats-new",
				content: renderWhatsNewStep(
					relevantChanges.value,
					showWelcome,
					lastSeenVersion.value, // Use the reactive value directly
					currentVersion,
				),
			});
		}

		if (showWelcome) {
			generatedSteps.push({
				id: "how-it-works",
				content: renderHowItWorksStep(currentVersion),
			});
			generatedSteps.push({
				id: "ethos",
				content: renderEthosStep(),
			});
		}

		return generatedSteps;
	});
	const totalSteps = useComputed(() => steps.value.length);
	const isLastStep = useComputed(
		() => currentStep.value === totalSteps.value - 1,
	);

	const handleNext = () => {
		if (!isLastStep.value) {
			currentStep.value += 1;
		} else {
			handleDismiss();
		}
	};

	if (totalSteps.value === 0) {
		// This might happen if the user somehow has a future version stored
		// or if changelogData is empty and lastSeenVersion is not '0.0.0'
		console.warn("FirstTimePopup: No steps to display.", {
			lastVersion: lastSeenVersion.value, // Use reactive value here too
			currentVersion,
			hasChanges: relevantChanges.value.length > 0,
		});
		return null;
	}

	// Handle edge case where currentStep might be out of bounds if stepsContent changes
	// Though useMemo dependency should handle this by recreating stepsContent
	if (currentStep.value >= totalSteps.value && totalSteps.value > 0) {
		console.warn("FirstTimePopup: currentStep out of bounds, resetting.");
		currentStep.value = 0;
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div className="relative bg-blue-100 border border-blue-300 p-4 rounded-lg max-h-[85vh] max-w-lg w-full flex flex-col">
				<div className="text-sm text-blue-900 space-y-3 overflow-y-auto flex-grow mb-4">
					{/* Render the current step safely */}
					{/* Check if steps[currentStep.value] exists before accessing .content */}
					{steps.value[currentStep.value]?.content}
				</div>
				{totalSteps.value > 1 && (
					<div className="flex justify-center space-x-2 mb-3">
						{steps.value.map((step, index) => (
							<button
								// Use the unique step ID as the key
								key={step.id}
								onClick={() => (currentStep.value = index)}
								className={`h-2 w-2 rounded-full ${
									currentStep.value === index
										? "bg-blue-600"
										: "bg-blue-300 hover:bg-blue-400"
								}`}
								aria-label={`Go to step ${index + 1}`}
							/>
						))}
					</div>
				)}
				<div className="flex justify-between gap-1">
					<button
						onClick={handleDismiss}
						className="px-3 py-1.5 text-sm font-semibold text-white bg-yellow-600 rounded-md hover:bg-yellow-500 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-yellow-600"
					>
						Skip
					</button>
					<button
						onClick={handleNext}
						className="w-full px-3 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-500 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-blue-600"
					>
						{isLastStep.value
							? "Got it!"
							: `Next (${currentStep.value + 1}/${totalSteps.value})`}
					</button>
				</div>
			</div>
		</div>
	);
}
