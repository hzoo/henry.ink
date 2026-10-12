import { afterAll, afterEach, beforeAll, beforeEach, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";

if (process.env.HENRY_LAYOUT_TEST_CHILD !== "1") {
	// Bun module mocks persist across files, so keep this UI fixture in its own process.
	test("reader layout composition and breakpoint focus regressions", () => {
		const result = Bun.spawnSync({
			cmd: [process.execPath, "test", import.meta.path],
			env: { ...process.env, HENRY_LAYOUT_TEST_CHILD: "1" },
			stdout: "pipe",
			stderr: "pipe",
		});
		if (result.exitCode !== 0) {
			throw new Error(new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr));
		}
		expect(result.exitCode).toBe(0);
	}, 30_000);
} else {

const dom = new JSDOM('<!doctype html><body><div id="mount"></div></body>', {
	url: "https://henry.ink/",
});
const prior = {
	window: globalThis.window,
	document: globalThis.document,
	localStorage: globalThis.localStorage,
	AbortController: globalThis.AbortController,
};
const mediaEvents = new dom.window.EventTarget();
let desktop = true;
const media = {
	get matches() { return desktop; },
	addEventListener: mediaEvents.addEventListener.bind(mediaEvents),
	removeEventListener: mediaEvents.removeEventListener.bind(mediaEvents),
};
dom.window.matchMedia = (() => media) as unknown as typeof dom.window.matchMedia;

let preact: typeof import("preact");
let act: typeof import("preact/test-utils").act;
let messaging: typeof import("@/src/lib/messaging");
let AppLayout: typeof import("@/src/components/AppLayout").AppLayout;
let previousAnimationFrame: typeof import("preact").options.requestAnimationFrame;
const mount = dom.window.document.querySelector("#mount") as HTMLElement;

beforeAll(async () => {
	Object.assign(globalThis, {
		window: dom.window,
		document: dom.window.document,
		localStorage: dom.window.localStorage,
		AbortController: dom.window.AbortController,
	});
	preact = await import("preact");
	({ act } = await import("preact/test-utils"));
	previousAnimationFrame = preact.options.requestAnimationFrame;
	preact.options.requestAnimationFrame = callback => { setTimeout(callback, 0); };
	// Keep the real layout, hooks, and signals; isolate unrelated auth and selection UI.
	mock.module("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries() {} }) }));
	mock.module("@/src/components/LoginButton", () => ({ LoginButton: () => null }));
	mock.module("@/extension/entrypoints/popup.content/SelectionPopupManagerV2", () => ({ default: () => null }));
	mock.module("@/src/lib/arena/arenaSearch", () => ({ searchAndSaveArenaChannels() {}, showArenaToast() {} }));
	messaging = await import("@/src/lib/messaging");
	({ AppLayout } = await import("@/src/components/AppLayout"));
});

beforeEach(() => {
	desktop = true;
	messaging.currentUrl.value = "https://example.com/article";
	messaging.quotedSelection.value = null;
	messaging.showCommentDialog.value = false;
});

afterEach(async () => {
	await act(() => preact.render(null, mount));
	messaging.quotedSelection.value = null;
	messaging.showCommentDialog.value = false;
});

afterAll(() => {
	messaging.currentUrl.value = "";
	preact.options.requestAnimationFrame = previousAnimationFrame;
	mock.restore();
	Object.assign(globalThis, prior);
	dom.window.close();
});

async function show() {
	await act(() => preact.render(preact.h(AppLayout, {
		children: preact.h("button", { id: "article-control" }, "Article"),
		sidebar: preact.h("textarea", { id: "composer" }),
	}), mount));
}

function panel() { return mount.querySelector("aside") as HTMLElement; }
function toggle() { return mount.querySelector("button[aria-controls]") as HTMLButtonElement; }
function composer() { return mount.querySelector("#composer") as HTMLTextAreaElement; }
function articleControl() { return mount.querySelector("#article-control") as HTMLButtonElement; }
async function clickToggle() { await act(() => toggle().click()); }
async function viewport(matches: boolean) {
	await act(() => {
		desktop = matches;
		mediaEvents.dispatchEvent(new dom.window.Event("change"));
	});
}
function expectOpen(open: boolean) {
	expect(panel().classList.contains("hidden")).toBe(!open);
	expect(panel().hasAttribute("inert")).toBe(!open);
	expect(toggle().getAttribute("aria-expanded")).toBe(String(open));
}

for (const device of ["desktop", "mobile"] as const) {
	for (const request of ["quote", "comment"] as const) {
		test(`${request} opens collapsed ${device} Notes without preventing manual closure`, async () => {
			desktop = device === "desktop";
			await show();
			if (desktop) await clickToggle();
			expectOpen(false);
			await act(() => {
				if (request === "quote") messaging.quotedSelection.value = "Selected passage";
				else messaging.showCommentDialog.value = true;
			});
			expectOpen(true);
			if (desktop) await clickToggle();
			else await act(() => (panel().querySelector('button[aria-label="Close notes"]') as HTMLButtonElement).click());
			expectOpen(false);
			await act(() => { messaging.currentUrl.value = "https://example.com/another"; });
			expectOpen(false);
			await act(() => {
				messaging.quotedSelection.value = null;
				messaging.showCommentDialog.value = false;
			});
			expectOpen(false);
			await act(() => {
				if (request === "quote") messaging.quotedSelection.value = "Next passage";
				else messaging.showCommentDialog.value = true;
			});
			expectOpen(true);
		});
	}
}

test("desktop-to-mobile restores focus from the hidden sidebar", async () => {
	await show();
	composer().focus();
	await viewport(false);
	expectOpen(false);
	expect(dom.window.document.activeElement).toBe(toggle());
});

test("desktop-to-mobile restores focus from the hidden resize handle", async () => {
	await show();
	(mount.querySelector('[role="separator"]') as HTMLElement).focus();
	await viewport(false);
	expect(dom.window.document.activeElement).toBe(toggle());
});

test("desktop-to-mobile preserves focus outside the sidebar", async () => {
	await show();
	articleControl().focus();
	await viewport(false);
	expect(dom.window.document.activeElement).toBe(articleControl());
});

test("mobile-to-desktop restores focus when the desktop sidebar is collapsed", async () => {
	await show();
	await clickToggle();
	await viewport(false);
	await clickToggle();
	composer().focus();
	await viewport(true);
	expectOpen(false);
	expect(dom.window.document.activeElement).toBe(toggle());
});

test("mobile-to-desktop preserves focus in the visible sidebar", async () => {
	desktop = false;
	await show();
	await clickToggle();
	composer().focus();
	await viewport(true);
	expectOpen(true);
	expect(dom.window.document.activeElement).toBe(composer());
});

test("mobile-to-desktop restores focus from the mobile-only close button", async () => {
	desktop = false;
	await show();
	await clickToggle();
	(panel().querySelector('button[aria-label="Close notes"]') as HTMLButtonElement).focus();
	await viewport(true);
	expectOpen(true);
	expect(dom.window.document.activeElement).toBe(toggle());
});

test("the headerless mobile toggle hands focus to the visible desktop sidebar", async () => {
	desktop = false;
	messaging.currentUrl.value = "";
	await show();
	toggle().focus();
	await viewport(true);
	expect(dom.window.document.activeElement).toBe(panel());
});

test("an active composition request does not reopen Notes on a breakpoint change", async () => {
	await show();
	await act(() => { messaging.showCommentDialog.value = true; });
	await clickToggle();
	await viewport(false);
	expectOpen(false);
	await viewport(true);
	expectOpen(false);
});

}
