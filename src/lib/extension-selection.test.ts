import { expect, test } from "bun:test";
import { createPendingQuotes, selectionFromTab, trackActiveTab, type ExtensionSelection } from "./extension-selection";

const windowId = 42;
const a = { id: 1, windowId, url: "https://a.test/" };
const b = { id: 2, windowId, url: "https://b.test/" };

test("the active source cannot roll back when an older tab or URL lookup finishes", async () => {
  const initial = Promise.withResolvers<typeof a[]>();
  const first = Promise.withResolvers<typeof a>();
  const second = Promise.withResolvers<typeof b>();
  let url = "";
  const activeTab = trackActiveTab(windowId, value => { url = value; }, () => {});
  const initializing = activeTab.initialize(initial.promise);
  const activatingA = activeTab.activate({ tabId: a.id, windowId }, () => first.promise);
  const activatingB = activeTab.activate({ tabId: b.id, windowId }, () => second.promise);

  second.resolve(b);
  await activatingB;
  first.resolve(a);
  initial.resolve([a]);
  await Promise.all([activatingA, initializing]);
  expect(url).toBe(b.url);

  const stale = Promise.withResolvers<typeof b>();
  const oldLookup = activeTab.activate({ tabId: b.id, windowId }, () => stale.promise);
  activeTab.update({ tabId: b.id, windowId }, "https://b.test/new", true);
  stale.resolve(b);
  await oldLookup;
  expect(url).toBe("https://b.test/new");

  const opening = trackActiveTab(windowId, value => { url = value; }, () => {});
  const slowQuery = Promise.withResolvers<typeof b[]>();
  const panelOpening = opening.initialize(slowQuery.promise);
  opening.update({ tabId: b.id, windowId }, "https://b.test/latest", true);
  slowQuery.resolve([b]);
  await panelOpening;
  expect(url).toBe("https://b.test/latest");
});

test("a quote queued before opening waits for its own active tab and window", async () => {
  const selection = selectionFromTab("Selected passage", a, "https://a.test/old-page")!;
  const received: ExtensionSelection[] = [];
  const otherWindow = trackActiveTab(windowId + 1, () => {}, () => {});
  let matchingPanel: ReturnType<typeof trackActiveTab> | undefined;
  await otherWindow.initialize(Promise.resolve([{ ...a, windowId: windowId + 1 }]));
  const queue = createPendingQuotes(async message => {
    if (otherWindow.matches(message) || matchingPanel?.matches(message)) {
      received.push(message);
      return true;
    }
  });

  await queue.enqueue(selection);
  expect(received).toEqual([]);
  await queue.send({ tabId: a.id, windowId: windowId + 1 });
  expect(received).toEqual([]);

  const ready = Promise.withResolvers<void>();
  matchingPanel = trackActiveTab(windowId, () => {}, target => {
    void queue.send(target).then(ready.resolve, ready.reject);
  });
  await matchingPanel.initialize(Promise.resolve([{ ...a, url: "https://a.test/new-page" }]));
  await ready.promise;
  await queue.send({ tabId: a.id, windowId });
  expect(received).toEqual([{
    text: "Selected passage", url: "https://a.test/old-page", tabId: a.id, windowId,
  }]);
});

test("a ready signal during delivery retries only if the first attempt failed", async () => {
  const selection = selectionFromTab("Selected passage", a)!;
  for (const acceptedFirst of [true, false]) {
    const first = Promise.withResolvers<boolean>();
    const delivered: ExtensionSelection[] = [];
    const queue = createPendingQuotes(message => {
      delivered.push(message);
      return delivered.length === 1 ? first.promise : Promise.resolve(true);
    });

    const enqueued = queue.enqueue(selection);
    await Promise.resolve();
    const ready = queue.send(selection);
    expect(delivered).toEqual([selection]);
    first.resolve(acceptedFirst);
    await Promise.all([enqueued, ready]);
    expect(delivered).toEqual(acceptedFirst ? [selection] : [selection, selection]);
    await queue.send(selection);
    expect(delivered).toHaveLength(acceptedFirst ? 1 : 2);
  }
});
