import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { h, render } from "preact";
import { act } from "preact/test-utils";

test("the quote composer keeps the selected source through navigation and another selection", async () => {
  const dom = new JSDOM("<main></main>", { url: "https://reader.test/" });
  const { window } = dom;
  window.matchMedia = (() => ({ matches: false })) as unknown as typeof window.matchMedia;
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const prior = {
    window: globalThis.window, document: globalThis.document, localStorage: globalThis.localStorage,
  };
  const mount = window.document.querySelector("main")!;
  Object.assign(globalThis, { window, document: window.document, localStorage: window.localStorage });
  const { currentUrl, quotedSelection } = await import("./messaging");
  const { QuotePopup } = await import("@/src/components/QuotePopup");
  try {
    quotedSelection.value = { text: "Original passage", url: "https://quoted.test/article" };
    currentUrl.value = "https://current.test/";
    await act(() => render(h(QuotePopup, {}), mount));
    const link = () => mount.querySelector<HTMLAnchorElement>('a[href^="https://henry.ink/"]')?.href;
    const textarea = () => mount.querySelector("textarea")?.value;
    expect(link()).toContain("https://henry.ink/https://quoted.test/article?");
    expect(textarea()).toContain("Original passage");

    await act(() => {
      currentUrl.value = "https://next.test/";
      quotedSelection.value = { text: "New passage", url: "https://next.test/" };
    });
    expect(link()).toContain("https://henry.ink/https://quoted.test/article?");
    expect(textarea()).toContain("Original passage");
  } finally {
    await act(() => render(null, mount));
    quotedSelection.value = null;
    currentUrl.value = "";
    Object.assign(globalThis, prior);
    dom.window.close();
  }
});
