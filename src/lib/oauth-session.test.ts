import { expect, test } from "bun:test";
import { storeSession } from "@atcute/oauth-browser-client";
import { JSDOM } from "jsdom";
import { h, render } from "preact";
import { act } from "preact/test-utils";
import { atCuteState, initializeOAuth, isLoadingSession, useAtCute } from "@/demo/lib/oauth";

test("a failed refresh can recover, but a captured client cannot act after another tab signs out", async () => {
  const dom = new JSDOM('<main></main>', { url: "https://reader.test/" });
  const { window } = dom;
  const mount = window.document.querySelector("main")!;
  const prior = {
    window: globalThis.window,
    document: globalThis.document,
    localStorage: globalThis.localStorage,
    addEventListener: globalThis.addEventListener,
    fetch: globalThis.fetch,
  };
  const did = "did:plc:offline-test";
  const accountKey = "atcute-oauth:did";
  let offline = true;
  let writes = 0;
  const fetchStub = (async (request: Request) => {
    if (request.url === "https://accounts.test/token") {
      if (offline) throw new TypeError("Network disconnected");
      return Response.json({
        sub: did, scope: "atproto", token_type: "DPoP", access_token: "refreshed",
        refresh_token: "refresh", expires_in: 300,
      });
    }
    expect(request.url).toBe("https://accounts.test/xrpc/com.atproto.repo.createRecord");
    expect(request.headers.get("Authorization")).toBe("DPoP refreshed");
    writes++;
    return Response.json({ uri: `at://${did}/app.bsky.feed.like/test`, cid: "test" });
  }) as typeof fetch;

  function Auth() {
    useAtCute();
    return null;
  }

  async function mountAuth() {
    isLoadingSession.value = true;
    const finished = Promise.withResolvers<void>();
    const unsubscribe = isLoadingSession.subscribe(loading => { if (!loading) finished.resolve(); });
    try {
      await act(() => render(h(Auth, {}), mount));
      await finished.promise;
    } finally {
      unsubscribe();
    }
  }

  Object.assign(globalThis, {
    window, document: window.document, localStorage: window.localStorage,
    addEventListener: (type: string, listener: EventListener) => window.addEventListener(type, listener),
    fetch: fetchStub,
  });
  try {
    initializeOAuth();
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const pkcs8 = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
    await storeSession(did, {
      dpopKey: { typ: "ES256", key: Buffer.from(pkcs8).toString("base64url"), jwt: "fixture" },
      info: { sub: did, aud: "https://accounts.test", server: {
        issuer: "https://accounts.test", authorization_endpoint: "https://accounts.test/authorize",
        token_endpoint: "https://accounts.test/token",
      } },
      token: { scope: "atproto", type: "DPoP", access: "expired", refresh: "refresh", expires_at: Date.now() - 60_000 },
    });
    window.localStorage.setItem(accountKey, did);
    await mountAuth();
    expect(atCuteState.peek()).toBeNull();
    expect(window.localStorage.getItem(accountKey)).toBe(did);

    await act(() => render(null, mount));
    offline = false;
    await mountAuth();
    const rpc = atCuteState.peek()?.rpc;
    expect(rpc).toBeDefined();
    const like = () => rpc!.post("com.atproto.repo.createRecord", {
      input: { repo: did, collection: "app.bsky.feed.like", record: { $type: "app.bsky.feed.like" } },
    });
    expect((await like()).ok).toBe(true);
    expect(writes).toBe(1);

    window.localStorage.removeItem(accountKey);
    window.dispatchEvent(new window.StorageEvent("storage", {
      key: accountKey, oldValue: did, newValue: null, storageArea: window.localStorage,
    }));
    expect(atCuteState.peek()).toBeNull();
    await expect(like()).rejects.toThrow("Login required.");
    expect(writes).toBe(1);

    await act(() => render(null, mount));
    window.localStorage.setItem(accountKey, "did:plc:missing-session");
    await mountAuth();
    expect(atCuteState.peek()).toBeNull();
    expect(window.localStorage.getItem(accountKey)).toBeNull();
  } finally {
    await act(() => render(null, mount));
    atCuteState.value = null;
    Object.assign(globalThis, prior);
    dom.window.close();
  }
});
