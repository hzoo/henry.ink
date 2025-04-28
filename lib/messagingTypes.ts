// Message from Content Script (SelectionPopup)
export interface ContentScriptQuoteMessage {
	type: "QUOTE_SELECTION";
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

export type BackgroundScriptMessage = ContentScriptQuoteMessage;
export type SidepanelMessage = ContentScriptPingMessage; 