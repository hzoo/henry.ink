import { render } from "preact";
import { ErrorBoundary, LocationProvider, Router, Route } from "preact-iso";
import { App } from "@/note-site/App";
import { ProfilePage } from "@/note-site/components/ProfilePage";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/src/lib/queryClient";

import "@/note-site/styles.css";

render(
	<QueryClientProvider client={queryClient}>
		{/* @ts-ignore */}
		<LocationProvider>
			<ErrorBoundary>
				<Router>
					<Route path="/profile/:username" component={ProfilePage} />
					<Route path="/:params*" component={App} />
					<Route path="/" component={App} />
				</Router>
			</ErrorBoundary>
		</LocationProvider>
	</QueryClientProvider>,
	document.getElementById("app")!,
);
