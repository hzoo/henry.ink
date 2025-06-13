import { render } from "preact";
import { ErrorBoundary, LocationProvider, Router, Route } from "preact-iso";
import { App } from "@/note.henryzoo.com/App.tsx";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

import "./styles.css";

render(
	<QueryClientProvider client={queryClient}>
		{/* @ts-ignore */}
		<LocationProvider>
			<ErrorBoundary>
				<Router>
					<Route path="/:params*" component={App} />
					<Route default component={App} />
				</Router>
			</ErrorBoundary>
		</LocationProvider>
	</QueryClientProvider>,
	document.getElementById("app")!,
);
