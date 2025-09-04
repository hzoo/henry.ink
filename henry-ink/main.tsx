import { render } from "preact";
import { ErrorBoundary, LocationProvider, Router, Route } from "preact-iso";
import { App } from "@/henry-ink/App";
import { ProfilePage } from "@/henry-ink/components/ProfilePage";
import { TrailsPage } from "@/henry-ink/components/TrailsPage";
import Bookmarklet from "@/henry-ink/routes/tools/bookmarklet";
import QuickMark from "@/henry-ink/routes/tools/quick-mark";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/src/lib/queryClient";

import "@/henry-ink/styles.css";

render(
	<QueryClientProvider client={queryClient}>
		{/* @ts-ignore */}
		<LocationProvider>
			<ErrorBoundary>
				<Router>
					<Route path="/profile/:username" component={ProfilePage} />
					<Route path="/profile/:username/trails" component={ProfilePage} />
					<Route path="/profile/:username/trail/:rkey" component={ProfilePage} />
					<Route path="/trails" component={TrailsPage} />
					<Route path="/tools/bookmarklet" component={Bookmarklet} />
					<Route path="/tools/quick-mark" component={QuickMark} />
					<Route path="/:params*" component={App} />
					<Route path="/" component={App} />
				</Router>
			</ErrorBoundary>
		</LocationProvider>
	</QueryClientProvider>,
	document.getElementById("app")!,
);
