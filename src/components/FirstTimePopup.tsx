import { lastSeenVersion } from "@/src/lib/extension-signals";
import { lazyComponent } from "@/src/lib/lazy-component";
import { version } from "@/package.json";

// Welcome and changelog steps only load when there is something new to show.
const FirstTimeSteps = lazyComponent(() =>
	import("@/src/components/FirstTimeSteps").then((module) => module.FirstTimeSteps),
);

export function FirstTimePopup() {
	if (lastSeenVersion.value === version) return null;
	return <FirstTimeSteps />;
}
