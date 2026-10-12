import { describe, expect, test } from "bun:test";
import { PassThrough, Readable } from "node:stream";
import { gzipSync } from "node:zlib";
import type { IncomingMessage } from "node:http";
import { ArchiveFetchError, createPublicFetcher } from "@/api/archive/public-fetch";
import { isPublicAddress, resolvePublicAddress, validateArchiveUrl, validateUrl } from "@/api/archive/url-validation";

const publicDns = async () => [{ address: "93.184.216.34", family: 4 }];
function response(body: Buffer | string, headers: Record<string, string> = {}, status = 200): IncomingMessage {
  return Object.assign(Readable.from([Buffer.from(body)]), { headers, statusCode: status }) as unknown as IncomingMessage;
}
const options = { maxBytes: 1024, timeoutMs: 1000 };

describe("public destination policy", () => {
  test("blocks URL encodings, credentials, special hosts and ports", () => {
    for (const url of ["https://127.0.0.1", "https://2130706433", "https://[::1]", "https://metadata.google.internal", "https://internal", "https://example.com:8443", "https://user:pass@example.com", "https://example.local./"]) {
      expect(validateArchiveUrl(url)).not.toBeNull();
    }
    expect(validateArchiveUrl("http://example.com")).toBeNull();
    expect(validateUrl("http://example.com")).not.toBeNull();
    expect(validateUrl("https://example.com:443")).toBeNull();
  });

  test("blocks private and special IPv4 and IPv6 destinations", () => {
    for (const ip of ["0.0.0.0", "10.0.0.1", "100.100.100.200", "127.0.0.1", "169.254.169.254", "172.16.1.1", "192.168.0.1", "198.18.0.1", "224.0.0.1", "::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:8.8.8.8", "64:ff9b::a00:1", "2002:a00:1::", "2001:db8::1"]) expect(isPublicAddress(ip)).toBe(false);
    expect(isPublicAddress("8.8.8.8")).toBe(true);
    expect(isPublicAddress("2001:4860:4860::8888")).toBe(true);
  });

  test("rejects mixed public and private DNS answers", async () => {
    await expect(resolvePublicAddress("example.com", async () => [
      { address: "8.8.8.8", family: 4 }, { address: "::1", family: 6 },
    ])).rejects.toThrow("public addresses");
  });
});

describe("bounded public transport", () => {
  test("pins lookup while keeping the hostname and disables connection reuse", async () => {
    let lookups = 0;
    const fetcher = createPublicFetcher(async () => {
      lookups++;
      return lookups === 1 ? await publicDns() : [{ address: "127.0.0.1", family: 4 }];
    }, async (url, config) => {
      expect(url.hostname).toBe("example.com");
      expect(config.agent).toBe(false);
      await new Promise<void>((resolve, reject) => config.lookup!("example.com", { all: false }, (error, address, family) => {
        if (error) return reject(error);
        expect(address).toBe("93.184.216.34");
        expect(family).toBe(4);
        resolve();
      }));
      return response("ok");
    });
    expect((await fetcher("https://example.com", options)).body.toString()).toBe("ok");
    expect(lookups).toBe(1);
  });

  test("revalidates redirects before connecting", async () => {
    let connections = 0;
    const fetcher = createPublicFetcher(async hostname => hostname === "example.com" ? publicDns() : [{ address: "169.254.169.254", family: 4 }], async () => {
      connections++;
      return response("", { location: "https://redirect.example/latest" }, 302);
    });
    await expect(fetcher("https://example.com", options)).rejects.toMatchObject({ status: 403 });
    expect(connections).toBe(1);
  });

  test("bounds redirect chains", async () => {
    let connections = 0;
    const fetcher = createPublicFetcher(publicDns, async () => {
      connections++;
      return response("", { location: "/again" }, 302);
    });
    await expect(fetcher("https://example.com", options)).rejects.toThrow("redirects");
    expect(connections).toBe(6);
  });

  test("limits bytes without Content-Length and rejects misleading lengths", async () => {
    const cases: Array<Record<string, string>> = [{}, { "content-length": "1" }, { "content-length": "1000" }];
    for (const headers of cases) {
      const fetcher = createPublicFetcher(publicDns, async () => response("123456789", headers));
      await expect(fetcher("https://example.com", { ...options, maxBytes: 8 })).rejects.toMatchObject({ status: 413 });
    }
  });

  test("limits decompressed bytes", async () => {
    const fetcher = createPublicFetcher(publicDns, async () => response(gzipSync("x".repeat(300)), { "content-encoding": "gzip" }));
    await expect(fetcher("https://example.com", { ...options, maxBytes: 50 })).rejects.toMatchObject({ status: 413 });
  });

  test("decodes content before returning it", async () => {
    const fetcher = createPublicFetcher(publicDns, async () => response(gzipSync("article"), { "content-encoding": "gzip" }));
    const result = await fetcher("https://example.com", options);
    expect(result.body.toString()).toBe("article");
    expect(result.headers.has("content-encoding")).toBe(false);
    expect(result.headers.get("content-length")).toBe("7");
  });

  test("reports decoded bytes, not compressed wire bytes, exactly once", async () => {
    const body = "article".repeat(100);
    const compressed = gzipSync(body);
    let reported = 0;
    const fetcher = createPublicFetcher(publicDns, async () => response(compressed, { "content-encoding": "gzip" }));
    const result = await fetcher("https://example.com", { ...options, onBytes(bytes) { reported += bytes; } });
    expect(result.body.length).toBe(body.length);
    expect(reported).toBe(body.length);
    expect(reported).toBeGreaterThan(compressed.length);
  });

  test("a shared decoded-byte budget stops reads and destroys the source immediately", async () => {
    const stream = Object.assign(new PassThrough(), { headers: {}, statusCode: 200 }) as unknown as IncomingMessage;
    const fetcher = createPublicFetcher(publicDns, async () => stream);
    let reported = 0;
    const overflow = new ArchiveFetchError("Shared budget exhausted", 413);
    const result = fetcher("https://example.com", {
      ...options,
      onBytes(bytes) {
        reported += bytes;
        if (reported > 8) throw overflow;
      },
    });
    const failure = result.catch(error => error);
    // Leave the stream open: rejection must not wait for the rest of the body.
    (stream as unknown as PassThrough).write(Buffer.alloc(9));
    expect(await failure).toBe(overflow);
    expect(reported).toBe(9);
    expect(stream.destroyed).toBe(true);
  });

  test("callback rejection after decompression destroys the wire stream", async () => {
    const stream = response(gzipSync("x".repeat(500)), { "content-encoding": "gzip" });
    const fetcher = createPublicFetcher(publicDns, async () => stream);
    const overflow = new ArchiveFetchError("Shared budget exhausted", 413);
    let reported = 0;
    await expect(fetcher("https://example.com", {
      ...options, onBytes(bytes) { reported += bytes; throw overflow; },
    })).rejects.toBe(overflow);
    expect(reported).toBe(500);
    expect(stream.destroyed).toBe(true);
  });

  test("deadline covers stalled DNS and stalled response bodies", async () => {
    const stalledDns = createPublicFetcher(() => new Promise(() => {}));
    await expect(stalledDns("https://example.com", { ...options, timeoutMs: 15 })).rejects.toBeInstanceOf(ArchiveFetchError);
    const stalledBody = createPublicFetcher(publicDns, async () => Object.assign(new PassThrough(), { headers: {}, statusCode: 200 }) as unknown as IncomingMessage);
    await expect(stalledBody("https://example.com", { ...options, timeoutMs: 15 })).rejects.toMatchObject({ status: 504 });
  });

  test("already-cancelled requests never resolve DNS or connect", async () => {
    let called = false;
    const fetcher = createPublicFetcher(async () => { called = true; return publicDns(); });
    const controller = new AbortController();
    controller.abort();
    await expect(fetcher("https://example.com", { ...options, signal: controller.signal })).rejects.toThrow();
    expect(called).toBe(false);
  });
});
