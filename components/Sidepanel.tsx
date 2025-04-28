import { render } from "preact";
import { Sidebar } from "@/components/Sidebar";
import { setupTabListener } from "@/lib/messaging";
import type { SidepanelMessage } from "@/lib/messagingTypes";
import "@/lib/styles.css";

setupTabListener();

browser.runtime.onMessage.addListener((message: SidepanelMessage, sender, sendResponse) => {
	if (message.type === "PING_SIDEPANEL") {
		// console.log("Sidepanel received PING, sending PONG");
		sendResponse({ type: "PONG_SIDEPANEL", from: "sidepanel" });
		return true;
	}
});

render(<Sidebar />, document.getElementById("app")!);
