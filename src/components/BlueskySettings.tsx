import { useSignal } from "@preact/signals";
import {
	autoFetchEnabled,
	setDomainStatus,
	showQuotePopupOnSelection,
	domainSettings,
} from "@/src/lib/settings";
import { DomainManager } from "./DomainManager";
import { currentDomain, isAllowed, isBlocked } from "@/src/lib/messaging";
import { Icon } from "@/src/components/Icon";

const handleAutoFetchToggle = () => {
	autoFetchEnabled.value = !autoFetchEnabled.value;
};

const handleShowQuotePopupToggle = () => {
	showQuotePopupOnSelection.value = !showQuotePopupOnSelection.value;
};

export function BlueskySettings() {
	const showDomainManager = useSignal(false);

	const handleSetCurrentDomainStatus = async (status: "a" | "b" | null) => {
		if (currentDomain.value) {
			await setDomainStatus(currentDomain.value, status);
		}
	};

	return (
		<div className="space-y-4">
			{/* Privacy Settings */}
			<div className="p-4 border-b border-gray-200 dark:border-gray-700">
				<div className="flex items-center justify-between mb-2 gap-1">
					<div>
						<label
							htmlFor="auto-fetch"
							className="text-sm font-medium text-gray-900 dark:text-gray-100"
						>
							Auto-search posts
						</label>
						<p className="text-xs text-gray-500 dark:text-gray-400">
							{autoFetchEnabled.value
								? "Auto-search enabled for allowed sites"
								: "Manual search only"}
						</p>
					</div>
					<label className="relative inline-flex items-center cursor-pointer">
						<input
							type="checkbox"
							id="auto-fetch"
							className="sr-only"
							checked={autoFetchEnabled.value}
							onChange={handleAutoFetchToggle}
						/>
						<div
							className={`w-9 h-5 rounded-full transition ${
								autoFetchEnabled.value
									? "bg-green-600"
									: "bg-gray-300 dark:bg-gray-600"
							} after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all ${
								autoFetchEnabled.value ? "after:translate-x-4" : ""
							}`}
						/>
					</label>
				</div>

				{/* Domain status management for current site */}
				{autoFetchEnabled.value && currentDomain.value && (
					<div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
						<div className="flex flex-col gap-2">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
										{currentDomain.value}
									</p>
									{(() => {
										const status = domainSettings.value[currentDomain.value];
										if (status === "b") {
											return (
												<p className="text-xs text-red-700 dark:text-red-300">
													Site Blocked. Auto-search disabled.
												</p>
											);
										} else if (status === "a") {
											return (
												<p className="text-xs text-green-700 dark:text-green-300">
													Site Allowed. Auto-search enabled.
												</p>
											);
										} else {
											return (
												<p className="text-xs text-gray-700 dark:text-gray-300">
													Default. Auto-search disabled (site not explicitly
													allowed).
												</p>
											);
										}
									})()}
								</div>
								{/* Action buttons for current domain status */}
								<div className="flex items-center gap-1 flex-shrink-0">
									<button
										title="Allow this site for auto-search"
										onClick={() => handleSetCurrentDomainStatus("a")}
										disabled={isAllowed.value}
										className="p-1.5 rounded text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-green-500"
									>
										<Icon name="arrowPath" className="w-3 h-3" />
									</button>
									<button
										title="Block this site"
										onClick={() => handleSetCurrentDomainStatus("b")}
										disabled={isBlocked.value}
										className="p-1.5 rounded text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-red-500"
									>
										<Icon name="xMark" className="w-3 h-3" />
									</button>
									<button
										title="Clear setting for this site"
										onClick={() => handleSetCurrentDomainStatus(null)}
										disabled={!domainSettings.value[currentDomain.value]}
										className="p-1.5 rounded text-gray-700 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-gray-400"
									>
										<Icon name="funnel" className="w-3 h-3" />
									</button>
								</div>
							</div>
							<button
								onClick={() => (showDomainManager.value = true)}
								className="text-xs text-slate-600 dark:text-slate-400 hover:underline hover:text-slate-800 dark:hover:text-slate-300 text-left flex items-center gap-1"
							>
								<span>Manage all site settings</span>
								<Icon name="chevronRight" className="h-3 w-3" />
							</button>
						</div>
					</div>
				)}

				{/* New toggle for showQuotePopupOnSelection */}
				<div className="flex items-center justify-between mb-2 gap-1 pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
					<div>
						<label
							htmlFor="show-quote-popup"
							className="text-sm font-medium text-gray-900 dark:text-gray-100"
						>
							Show quote popup on selection
						</label>
						<p className="text-xs text-gray-500 dark:text-gray-400">
							{showQuotePopupOnSelection.value
								? "Popup will show on text selection"
								: "Popup will not show on text selection"}
						</p>
					</div>
					<label className="relative inline-flex items-center cursor-pointer">
						<input
							type="checkbox"
							id="show-quote-popup"
							className="sr-only"
							checked={showQuotePopupOnSelection.value}
							onChange={handleShowQuotePopupToggle}
						/>
						<div
							className={`w-9 h-5 rounded-full transition ${
								showQuotePopupOnSelection.value
									? "bg-green-600"
									: "bg-gray-300 dark:bg-gray-600"
							} after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all ${
								showQuotePopupOnSelection.value ? "after:translate-x-4" : ""
							}`}
						/>
					</label>
				</div>
			</div>

			{/* Domain Settings Manager Modal */}
			{showDomainManager.value && (
				<DomainManager onClose={() => (showDomainManager.value = false)} />
			)}
		</div>
	);
}
