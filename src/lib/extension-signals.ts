import { signalBrowserLocal } from "@/src/lib/signal";

// Signal to track the last version the user has seen the intro/update popup for
export const lastSeenVersion = signalBrowserLocal<string>(
	"last-seen-version",
	"0.0.0",
);
