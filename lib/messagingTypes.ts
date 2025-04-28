// Message from Content Script (SelectionPopup)
export interface ContentScriptSelectionMessage {
	type: "SELECTION";
	from: "content";
	data: { selection: string };
}

export interface ContentScriptPingMessage {
	type: "PING_SIDEPANEL";
	from: "content";
}

export interface SidepanelPongMessage {
	type: "PONG_SIDEPANEL";
	from: "sidepanel";
}

export type BackgroundScriptMessage = ContentScriptSelectionMessage;
export type SidepanelMessage = ContentScriptPingMessage; 