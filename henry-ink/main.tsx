import { render } from "preact";
import { ErrorBoundary, LocationProvider, Router, Route, lazy } from "preact-iso";
import { App } from "@/henry-ink/App";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/src/lib/queryClient";

import "@/henry-ink/styles.css";

const ProfilePage = lazy(() => import("@/henry-ink/components/ProfilePage").then(module => module.ProfilePage));
const Bookmarklet = lazy(() => import("@/henry-ink/routes/tools/bookmarklet"));

render(
	<QueryClientProvider client={queryClient}>
		{/* @ts-ignore */}
		<LocationProvider>
			<ErrorBoundary>
				<Router>
					<Route path="/profile/:username" component={ProfilePage} />
					<Route path="/tools/bookmarklet" component={Bookmarklet} />
					<Route path="/:params*" component={App} />
					<Route path="/" component={App} />
				</Router>
			</ErrorBoundary>
		</LocationProvider>
	</QueryClientProvider>,
	document.getElementById("app")!,
);
