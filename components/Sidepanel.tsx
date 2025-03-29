import { render } from "preact";

import { Sidebar } from "@/components/Sidebar";
import { setupTabListener } from "@/lib/messaging";
import "@/lib/styles.css";

// Setup side panel messaging
setupTabListener();

render(<Sidebar />, document.getElementById("app")!); 