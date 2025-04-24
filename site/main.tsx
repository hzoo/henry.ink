import { render } from "preact";
import { App } from "@/site/App";
import "@/lib/styles.css";

render(
    <App />, document.getElementById("app")!
);