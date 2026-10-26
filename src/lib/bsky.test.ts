import { afterEach, describe, expect, spyOn, test } from "bun:test";
import type { AppBskyFeedDefs } from "@atcute/bluesky";
import { Client, type FetchHandler } from "@atcute/client";
import { atCuteState, type AtCuteState } from "@/demo/lib/oauth";
import { getAuthorFeed, getPostThread, getProfile, searchBskyPosts } from "@/src/lib/bsky";

const videoId = "dQw4w9WgXcQ";
const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
const originalState = atCuteState.value;
const restores: (() => void)[] = [];

afterEach(() => {
	for (const restore of restores.splice(0)) restore();
	atCuteState.value = originalState;
});

function post(
	id: string,
	fields: Partial<AppBskyFeedDefs.PostView> = {},
): AppBskyFeedDefs.PostView {
	return {
		uri: `at://did:plc:test/app.bsky.feed.post/${id}`,
		cid: "bafyreitest",
		author: { did: "did:plc:test", handle: "test.bsky.social" },
		record: { $type: "app.bsky.feed.post", text: "Unrelated post" },
		indexedAt: "2026-10-12T12:00:00.000Z",
		...fields,
	};
}

function transport(mode: "worker" | "authenticated", handler: FetchHandler) {
	if (mode === "authenticated") {
		// Search only needs the RPC client, not an OAuth session or credentials.
		atCuteState.value = { rpc: new Client({ handler }) } as AtCuteState;
		return;
	}
	atCuteState.value = null;
	const fakeFetch: typeof globalThis.fetch = Object.assign(
		(input: Parameters<typeof globalThis.fetch>[0], init?: RequestInit) =>
			handler(String(input), init ?? {}),
		{ preconnect: globalThis.fetch.preconnect },
	);
	const fetch = spyOn(globalThis, "fetch").mockImplementation(fakeFetch);
	restores.push(() => fetch.mockRestore());
}

for (const mode of ["worker", "authenticated"] as const) {
	describe(`${mode} Bluesky search`, () => {
		test("matches video IDs in text, external embeds and facets, then ranks engagement", async () => {
			const posts = [
				post("text", { record: { text: videoUrl }, likeCount: 1 }),
				post("unrelated", { likeCount: 999 }),
				post("external", {
					embed: {
						$type: "app.bsky.embed.external#view",
						external: { uri: videoUrl, title: "Video", description: "" },
					},
					repostCount: 3,
				}),
				post("facet", {
					record: {
						facets: [
							{
								features: [
									{ $type: "app.bsky.richtext.facet#link", uri: videoUrl },
								],
							},
						],
					},
					replyCount: 2,
					likeCount: 2,
				}),
				post("images", {
					embed: { $type: "app.bsky.embed.images#view", images: [] },
				}),
			];
			const requests: string[] = [];
			const controller = new AbortController();
			transport(mode, async (url, init) => {
				requests.push(url);
				expect(init.signal).toBe(controller.signal);
				return Response.json({ posts });
			});
			const result = await searchBskyPosts(videoUrl, {
				signal: controller.signal,
			});
			expect(result?.map((entry) => entry.uri.split("/").pop())).toEqual([
				"facet",
				"external",
				"text",
			]);
			expect(requests).toHaveLength(1);
			const requestUrl = new URL(requests[0], "https://worker.test");
			expect(requestUrl.searchParams.get("url")).toBe(videoUrl);
			if (mode === "authenticated") {
				expect(requestUrl.pathname).toBe("/xrpc/app.bsky.feed.searchPosts");
				expect(requestUrl.searchParams.get("limit")).toBe("100");
			}
		});

		test("ignores unknown record fields and malformed facets without losing valid matches", async () => {
			transport(mode, async () =>
				Response.json({
					posts: [
						post("unknown", { record: { text: {}, facets: "not an array" } }),
						post("malformed", {
							record: {
								facets: [
									null,
									5,
									{},
									{ features: "invalid" },
									{ features: [null, 1, {}, { uri: 5 }] },
								],
							},
						}),
						post("valid", {
							record: {
								facets: [
									{ features: [{ uri: `https://youtu.be/${videoId}` }] },
								],
							},
						}),
					],
				}),
			);
			expect(
				(await searchBskyPosts(videoUrl))?.map((entry) =>
					entry.uri.split("/").pop(),
				),
			).toEqual(["valid"]);
		});

		test("keeps non-video results and stable ordering for equal engagement", async () => {
			const like = "at://did:plc:viewer/app.bsky.feed.like/liked";
			const posts = [
				post("first"),
				post("second"),
				post("popular", { likeCount: 2, viewer: { like } }),
			];
			transport(mode, async () => Response.json({ posts }));
			const result = await searchBskyPosts("https://www.robinsloan.com/notes/home-cooked-app");
			expect(result?.map((entry) => entry.uri.split("/").pop())).toEqual(["popular", "first", "second"]);
			if (mode === "authenticated") {
				expect(result?.[0].viewer?.like).toBe(like);
			} else {
				expect(result?.[0].viewer).toBeUndefined();
			}
		});

		test("accepts empty search results", async () => {
			transport(mode, async () => Response.json({ posts: [] }));
			expect(await searchBskyPosts(videoUrl)).toEqual([]);
		});

		test("preserves the login-required error", async () => {
			const log = spyOn(console, "error").mockImplementation(() => {});
			restores.push(() => log.mockRestore());
			transport(mode, async () =>
				Response.json({ error: "AuthMissing" }, { status: 401 }),
			);
			await expect(searchBskyPosts(videoUrl)).rejects.toThrow(
				"Bluesky search sometimes requires login",
			);
		});

		test("propagates upstream failures", async () => {
			const log = spyOn(console, "error").mockImplementation(() => {});
			restores.push(() => log.mockRestore());
			transport(mode, async () =>
				Response.json({ error: "UpstreamFailure" }, { status: 502 }),
			);
			await expect(searchBskyPosts(videoUrl)).rejects.toThrow(
				"UpstreamFailure",
			);
		});

		test("preserves cancellation behavior without returning stale results", async () => {
			const log = spyOn(console, "error").mockImplementation(() => {});
			restores.push(() => log.mockRestore());
			transport(mode, async (_url, init) => {
				init.signal?.throwIfAborted();
				throw new Error("Expected an aborted request");
			});
			const controller = new AbortController();
			controller.abort();
			expect(
				await searchBskyPosts(videoUrl, { signal: controller.signal }),
			).toBeUndefined();
		});
	});
}

test("keeps captured clients and explicit anonymous search after an account change", async () => {
	const requests: string[] = [];
	const controller = new AbortController();
	const fixture = post("owned");
	const handler: FetchHandler = async (url, init) => {
		requests.push(url);
		expect(init.signal).toBe(controller.signal);
		const path = new URL(url, "https://public.test").pathname;
		if (path.endsWith("getPostThread")) return Response.json({ thread: { post: fixture } });
		if (path.endsWith("getProfile")) return Response.json(fixture.author);
		if (path.endsWith("getAuthorFeed")) return Response.json({ feed: [{ post: fixture }] });
		return Response.json({ posts: [fixture] });
	};
	const capturedRpc = new Client({ handler });
	const nextAccountRpc = new Client({ handler: async () => { throw new Error("Used the next account's client"); } });
	const read = (rpc: Client | null) => Promise.resolve().then(() => Promise.all([
		searchBskyPosts("https://example.com/article", { signal: controller.signal, rpc }),
		getPostThread(fixture.uri, { signal: controller.signal, rpc }),
		getProfile(fixture.author.did, { signal: controller.signal, rpc }),
		getAuthorFeed(fixture.author.did, { signal: controller.signal, rpc }),
	]));

	const capturedRead = read(capturedRpc);
	// Persistence may defer these helpers until another account is active.
	atCuteState.value = { rpc: nextAccountRpc } as AtCuteState;
	const authenticated = await capturedRead;
	expect(authenticated[0]?.[0].uri).toBe(fixture.uri);
	expect(requests).toHaveLength(4);

	transport("worker", handler);
	const anonymousRead = Promise.resolve().then(() => searchBskyPosts("https://example.com/article", { signal: controller.signal, rpc: null }));
	atCuteState.value = { rpc: nextAccountRpc } as AtCuteState;
	const anonymous = await anonymousRead;
	expect(anonymous?.[0].uri).toBe(fixture.uri);
	expect(requests).toHaveLength(5);
});
