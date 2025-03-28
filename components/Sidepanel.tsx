import { render } from "preact";
import { Sidebar } from "@/components/Sidebar";
import { setupTabListener } from "@/lib/messaging";
import { isDarkMode } from "@/lib/settings";

import "@/lib/styles.css";

// Setup side panel messaging
setupTabListener();

// Initialize theme
document.documentElement.classList.toggle('dark', isDarkMode.value);

// Render sidebar directly instead of through App component
render(<Sidebar />, document.getElementById("app")!); 