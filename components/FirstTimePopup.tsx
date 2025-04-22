import { lastSeenVersion } from "@/lib/signals";
import { version } from "../package.json";
import { changelogData } from "@/lib/changelog";
import type { ChangelogEntry } from "@/lib/changelog";
import { useMemo } from "preact/hooks";
import { useSignal } from "@preact/signals-react/runtime";
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

export function FirstTimePopup() {
	const currentStep = useSignal(0);

	const handleDismiss = () => {
		lastSeenVersion.value = currentVersion;
	};

	const relevantChanges = useMemo(() => {
		const lastVersion = lastSeenVersion.peek();

		if (lastVersion === "0.0.0") {
			return [];
		}

		const changesToShow: ChangelogEntry[] = [];
		for (const entry of changelogData) {
			const comparisonWithCurrent = compareVersions(
				entry.version,
				currentVersion,
			);
			const comparisonWithLast = compareVersions(entry.version, lastVersion);

			if (comparisonWithCurrent > 0) {
				continue;
			}

			if (comparisonWithLast > 0) {
				changesToShow.push(entry);
			} else {
				break;
			}
		}
		return changesToShow;
	}, []);

	const showWelcome = lastSeenVersion.value === "0.0.0";

	const stepsContent = useMemo(() => {
		const steps: JSX.Element[] = [];

		if (showWelcome) {
			steps.push(
				<>
					<p>
						hi there! I built this extension to see what people are saying about
						any website.
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
				</>,
			);
		}

		if (relevantChanges.length > 0) {
			steps.push(
				<div>
					<h3 className="font-semibold mb-1">
						What's New (
						{showWelcome
							? `Up to v${currentVersion}`
							: `Since v${lastSeenVersion.peek()}`}
						)
					</h3>
					<ul className="space-y-2 list-disc list-inside pl-0 text-xs">
						{relevantChanges.map((entry) => (
							<li key={entry.version} className="mt-1">
								<span className="font-medium">v{entry.version}:</span>
								<ul className="list-disc list-inside pl-2 mt-0.5 space-y-0.5">
									{entry.changes.map((change) => (
										<li key={change}>{change}</li>
									))}
								</ul>
							</li>
						))}
					</ul>
				</div>,
			);
		}

		if (showWelcome) {
			steps.push(
				<>
					<h3 className="font-semibold">How it works + privacy</h3>
					<p>
						When you navigate using a browser, the current URL (and your IP
						address) are sent to{" "}
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
						(auto-fetching/whitelisting), or use a VPN for added privacy.
					</p>
					<p>
						(there's also a small cache so navigating between previously visited
						pages will show instantly). In the future, I may need to add a
						dedicated server if bsky modifies their search API, or if I need to
						do my own caching
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
				</>,
			);
			steps.push(
				<>
					<p>
						As Emily from the Bluesky team put it, the vision of atproto is
						broad – imagine "
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
						. Future plans may include: dedicated lexicons for longer-form
						posts, other data sources (Obsidian, HN, etc.), archival, voting?
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
				</>,
			);
		}

		return steps;
	}, [showWelcome, relevantChanges]);

	const totalSteps = stepsContent.length;
	const isLastStep = currentStep.value === totalSteps - 1;

	const handleNext = () => {
		if (!isLastStep) {
			currentStep.value += 1;
		} else {
			handleDismiss();
		}
	};

	if (totalSteps === 0) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div className="relative bg-blue-100 border border-blue-300 p-4 shadow-lg rounded-lg max-h-[85vh] max-w-lg w-full flex flex-col">
				<div className="text-sm text-blue-900 space-y-3 overflow-y-auto flex-grow mb-4">
					{stepsContent[currentStep.value]}
				</div>
				{totalSteps > 1 && (
					<div className="flex justify-center space-x-2 mb-3">
						{stepsContent.map((_, index) => (
							<button
								key={index}
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
				<button
					onClick={handleNext}
					className="w-full px-3 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-blue-600"
				>
					{isLastStep
						? "Got it!"
						: `Next (${currentStep.value + 1}/${totalSteps})`}
				</button>
			</div>
		</div>
	);
}
