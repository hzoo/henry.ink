import { render } from "preact";
import { Sidebar } from "@/components/Sidebar";
import { setupSidePanel } from "@/lib/messaging";
import { loadSettings, isDarkMode } from "@/lib/settings";

import "@/lib/styles.css";

// Setup side panel messaging
setupSidePanel();

// Load settings from storage
loadSettings().catch(err => console.error("Failed to load settings:", err));

// Initialize theme
document.documentElement.classList.toggle('dark', isDarkMode.value);

// Render sidebar directly instead of through App component
render(<Sidebar />, document.getElementById("app")!); 