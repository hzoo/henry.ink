import type { ContentScriptContext } from "#imports";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import { render } from "preact";
import type { ContentScriptPingMessage, ContentScriptSelectionMessage } from "@/lib/messagingTypes";
// import "@/lib/styles.css";
import SelectionPopupManager from "./SelectionPopupManager";

const pingMessage: ContentScriptPingMessage = {
	type: "PING_SIDEPANEL",
	from: "content",
};

async function checkSidepanelOpen() {
	try {
		const response = await browser.runtime.sendMessage(pingMessage);
		if (response && response.type === "PONG_SIDEPANEL") {
			return true;
		}
	} catch {
		return false;
	}

	return false;
}

function sendSelection() {
	const selection = window.getSelection()?.toString();
	if (!selection) return;
	const message: ContentScriptSelectionMessage = {
		type: "SELECTION",
		from: "content",
		data: { selection },
	};
	browser.runtime.sendMessage(message).catch(console.error);
};

export default defineContentScript({
	registration: "runtime",
	// cssInjectionMode: "ui",

	async main(ctx) {
		console.log("Creating UI");
		const ui = await createUi(ctx);
		ui.mount();
	},
});

async function createUi(ctx: ContentScriptContext) {
	const ui = await createShadowRootUi(ctx, {
		name: "extension-annotation-popup",
		position: "inline",
		anchor: "body",
		append: "first",
		onMount(container: HTMLElement) {
			const root = render(
				<SelectionPopupManager
					canShowPopup={checkSidepanelOpen}
					popupTitle="Quote"
					sendSelection={sendSelection}
				/>,
				container,
			);
			return root;
		},
	});

	return ui;
}
