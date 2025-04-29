import type { ContentScriptContext } from "#imports";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import { render } from "preact";
import type { ContentScriptPingMessage } from "@/lib/messagingTypes";
import "@/lib/styles.css";
import SelectionPopupManager from "./SelectionPopupManager";

const pingMessage: ContentScriptPingMessage = {
	type: "PING_SIDEPANEL",
	from: "content",
};

const checkSidepanelOpen = async () => {
	try {
		const response = await browser.runtime.sendMessage(pingMessage);
		if (response && response.type === "PONG_SIDEPANEL") {
			return true;
		}
	} catch {
		return false;
	}

	return false;
};

export default defineContentScript({
	matches: ["<all_urls>"],
	cssInjectionMode: "ui",

	async main(ctx) {
		const ui = await createUi(ctx);
		ui.mount();
	},
});

async function createUi(ctx: ContentScriptContext) {
	const ui = await createShadowRootUi(ctx, {
		name: "selection-popup-ui",
		position: "inline",
		anchor: "body",
		append: "first",
		onMount(container: HTMLElement) {
			const root = render(
				<SelectionPopupManager
					canShowPopup={checkSidepanelOpen}
					popupTitle="Quote"
				/>,
				container,
			);
			return root;
		},
	});

	return ui;
}
