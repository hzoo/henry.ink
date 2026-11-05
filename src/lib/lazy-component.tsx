import { signal } from "@preact/signals";
import type { ComponentType } from "preact";

// Renders nothing until the chunk arrives, then the component. Meant for
// dialogs and overlays that most readers never open: no Suspense boundary,
// and a failed load retries the next time the component renders.
export function lazyComponent<P extends object>(load: () => Promise<ComponentType<P>>) {
	const loaded = signal<ComponentType<P> | null>(null);
	let pending: Promise<void> | undefined;
	const preload = () => {
		pending ??= load().then(
			(component) => { loaded.value = component; },
			(error) => { pending = undefined; throw error; },
		);
		return pending;
	};
	function Lazy(props: P) {
		const Component = loaded.value;
		if (!Component) {
			void preload().catch(() => {});
			return null;
		}
		return <Component {...props} />;
	}
	return Object.assign(Lazy, { preload });
}
