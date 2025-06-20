import { autoFetchEnabled } from "@/src/lib/settings";
import { ManualFetchButton } from "@/src/components/ManualFetchButton";
import {
	isAllowed,
	currentDomain,
	isSearchableUrl,
	currentUrl,
	isBlocked,
} from "@/src/lib/messaging";
import { Icon } from "@/src/components/Icon";
import { setDomainStatus } from "@/src/lib/settings";

const handleAllowFromEmptyState = () => {
	if (currentDomain.value) {
		setDomainStatus(currentDomain.value, "a");
	}
};

// Add handler for denying from empty state
const handleDenyFromEmptyState = () => {
	if (currentDomain.value) {
		setDomainStatus(currentDomain.value, "b");
	}
};

function AllowButton() {
	return (
		<button
			onClick={handleAllowFromEmptyState}
			className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 dark:bg-green-500 border border-transparent rounded-md hover:bg-green-700 dark:hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
		>
			Allow this site
		</button>
	);
}

// Create DenyButton component
function DenyButton() {
	return (
		<button
			onClick={handleDenyFromEmptyState}
			// Use smaller padding/text and red color for a 'smaller' appearance
			className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-rose-500 dark:text-rose-200 bg-rose-100 dark:bg-rose-900 border border-transparent rounded-md hover:bg-rose-200 dark:hover:bg-rose-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 disabled:opacity-50 disabled:cursor-not-allowed"
		>
			Deny this site
		</button>
	);
}

function DomainBadge() {
	return (
		<div className="font-semibold font-mono text-gray-900 dark:text-gray-100 bg-slate-300 dark:bg-slate-700 rounded-lg px-2 py-1 w-max mx-auto">
			{currentDomain.value}
		</div>
	);
}

export function EmptyList({ autoAllowDomain }: { autoAllowDomain?: string }) {
	// Check if we're on the auto-allow domain
	const isAllowedWithOverride =
		autoAllowDomain && window.location.hostname === autoAllowDomain
			? true
			: isAllowed.value;

	return (
		<div className="h-full flex flex-col items-center justify-center p-6 text-center">
			<div className="rounded-full bg-gray-100 dark:bg-gray-800 p-3 mb-4">
				<Icon
					name="comment"
					className="h-6 w-6 text-gray-900 dark:text-gray-100"
				/>
			</div>

			{isBlocked.value ? (
				<>
					<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
						Site Blocked
					</h3>
					<p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
						<DomainBadge /> is currently blocked. Posts from this site will not
						be searched or displayed.
					</p>
					{/* allow */}
					<AllowButton />
				</>
			) : !isSearchableUrl.value ? (
				<>
					<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
						Paste a URL to get started
					</h3>
					<p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
						Enter any URL in the input above to see Bluesky discussions about that page
					</p>
					<a
						href="https://github.com/hzoo/extension-annotation-sidebar"
						target="_blank"
						rel="noopener noreferrer"
						className="inline-block px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-600 rounded-md transition-colors duration-150 ease-in-out"
					>
						Learn more
					</a>
				</>
			) : autoFetchEnabled.value ? (
				<>
					<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
						{isAllowedWithOverride ? (
							"No posts found yet"
						) : (
							<>
								<div>Enable auto-search for</div>
								<DomainBadge />
							</>
						)}
					</h3>
					{isAllowedWithOverride ? (
						<p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
							No one has shared this page on Bluesky yet. Be the first!
						</p>
					) : (
						<>
							<p className="text-xs text-gray-500 dark:text-gray-400 mb-4 rounded-md p-2 flex items-center justify-between">
								<span>
									Domains aren't enabled by default, you need to explicitly
									allow them.
								</span>
							</p>
							<div className="space-y-3 flex flex-col items-center">
								<div className="relative group">
									<AllowButton />
									<div className="absolute -top-8 left-1/2 transform -translate-x-1/2 px-3 py-1 bg-gray-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none w-max">
										<div>For your privacy, auto-search is off by default.</div>
									</div>
								</div>
							</div>
						</>
					)}
				</>
			) : (
				<>
					<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
						Manual mode
					</h3>
					<p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
						Search Bluesky for posts about {currentDomain.value}
					</p>
					<ManualFetchButton />
				</>
			)}

			{/* bottom of page */}
			<div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-center gap-2">
				<ManualFetchButton />
				{!isBlocked.value && <DenyButton />}
			</div>
		</div>
	);
}
