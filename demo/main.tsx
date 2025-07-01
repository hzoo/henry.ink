import { render } from "preact";
import { ErrorBoundary, LocationProvider, Router, Route } from "preact-iso";
import { App } from "@/demo/App";
import { ThreadTest } from "@/demo/routes/ThreadTest";
import "@/demo/styles.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/src/lib/queryClient";

render(
	<QueryClientProvider client={queryClient}>
		{/* @ts-ignore */}
		<LocationProvider>
			<ErrorBoundary>
				<Router>
					<Route path="/thread" component={ThreadTest} />
					<Route path="/profile/:user/post/:post?" component={ThreadTest} />
					<Route path="/:params*" component={App} />
					<Route path="/" component={App} />
				</Router>
			</ErrorBoundary>
		</LocationProvider>
	</QueryClientProvider>,
	document.getElementById("app")!,
);
