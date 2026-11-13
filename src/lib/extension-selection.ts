export type QuoteSelection = Readonly<{ text: string; url: string }>;
export type TabLocation = Readonly<{ tabId: number; windowId: number }>;
export type ExtensionSelection = QuoteSelection & TabLocation;

export type SelectionMessage =
  | { type: "SELECTION"; text: string }
  | { type: "PING_SIDEPANEL" }
  | { type: "SIDEPANEL_READY"; target: TabLocation }
  | { type: "DELIVER_SELECTION"; selection: ExtensionSelection };

interface Tab {
  id?: number;
  windowId: number;
  url?: string;
  pendingUrl?: string;
}

export function selectionFromTab(text: string | undefined, tab: Tab | undefined, url = tab?.url): ExtensionSelection | null {
  if (typeof text !== "string" || !text.trim() || !url || tab?.id === undefined) return null;
  return { text, url, tabId: tab.id, windowId: tab.windowId };
}

export function trackActiveTab(windowId: number, publishUrl: (url: string) => void, ready: (target: TabLocation) => void) {
  let tabId: number | undefined;
  let revision = 0;

  const matches = (target: TabLocation) => target.windowId === windowId && target.tabId === tabId;
  const selectTab = (id: number, url: string) => {
    tabId = id;
    publishUrl(url);
    ready({ tabId: id, windowId });
  };

  return {
    matches,
    async initialize(lookup: Promise<Tab[]>) {
      const initialRevision = revision;
      const [tab] = await lookup;
      if (revision === initialRevision && tab?.id !== undefined && tab.windowId === windowId) {
        selectTab(tab.id, tab.url || tab.pendingUrl || "");
      }
    },
    async activate(target: TabLocation, lookup: (tabId: number) => Promise<Tab>) {
      if (target.windowId !== windowId) return;
      const activation = ++revision;
      selectTab(target.tabId, "");
      const tab = await lookup(target.tabId);
      if (revision === activation) publishUrl(tab.url || tab.pendingUrl || "");
    },
    update(target: TabLocation, url: string | undefined, active: boolean) {
      if (url === undefined) return;
      if (matches(target)) {
        ++revision;
        publishUrl(url);
      } else if (tabId === undefined && active && target.windowId === windowId) {
        ++revision;
        selectTab(target.tabId, url);
      }
    },
  };
}

interface PendingQuote {
  selection: ExtensionSelection;
  delivery?: Promise<void>;
  retry: boolean;
}

export function createPendingQuotes(deliver: (selection: ExtensionSelection) => Promise<unknown>) {
  const queued = new Map<number, PendingQuote>();
  const send = async (target: TabLocation): Promise<void> => {
    const pending = queued.get(target.tabId);
    if (!pending || pending.selection.windowId !== target.windowId) return;
    if (pending.delivery) {
      pending.retry = true;
      return pending.delivery;
    }

    pending.delivery = Promise.resolve().then(async () => {
      try {
        while (queued.get(target.tabId) === pending) {
          pending.retry = false;
          let accepted: unknown;
          try { accepted = await deliver(pending.selection); }
          catch { /* The side panel can become ready during this attempt. */ }
          if (accepted === true && queued.get(target.tabId) === pending) {
            queued.delete(target.tabId);
            return;
          }
          if (!pending.retry) return;
        }
      } finally {
        pending.delivery = undefined;
      }
    });
    return pending.delivery;
  };

  return {
    async enqueue(selection: ExtensionSelection) {
      queued.set(selection.tabId, { selection, retry: false });
      await send(selection);
    },
    send,
    remove: (tabId: number) => { queued.delete(tabId); },
  };
}
