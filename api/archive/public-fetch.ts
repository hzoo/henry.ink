import { request as httpRequest, type IncomingMessage, type RequestOptions } from "node:http";
import { request as httpsRequest } from "node:https";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import type { LookupFunction } from "node:net";
import {
  resolveAddresses, resolvePublicAddress, validateArchiveUrl, validateUrl, type ResolveAddresses,
} from "@/api/archive/url-validation";

export class ArchiveFetchError extends Error {
  constructor(message: string, public readonly status = 502) { super(message); }
}

export interface PublicResource {
  url: string;
  status: number;
  headers: Headers;
  body: Buffer;
}

export interface PublicFetchOptions {
  maxBytes: number;
  timeoutMs: number;
  allowHttp?: boolean;
  signal?: AbortSignal;
  accept?: string;
}

export type PublicFetcher = (url: string, options: PublicFetchOptions) => Promise<PublicResource>;
type RequestTransport = (url: URL, options: RequestOptions) => Promise<IncomingMessage>;

function requestResource(url: URL, options: RequestOptions): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, options, resolve);
    request.on("error", reject);
    request.end();
  });
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    if (signal.aborted) return abort();
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

function responseHeaders(response: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(response.headers)) {
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  return headers;
}

async function readBody(response: IncomingMessage, maxBytes: number, signal: AbortSignal): Promise<Buffer> {
  const length = Number(response.headers["content-length"]);
  if (Number.isFinite(length) && length > maxBytes) {
    response.destroy();
    throw new ArchiveFetchError("Resource too large", 413);
  }
  const encoding = response.headers["content-encoding"]?.toLowerCase();
  const decoder = encoding === "gzip" ? createGunzip()
    : encoding === "br" ? createBrotliDecompress()
    : encoding === "deflate" ? createInflate() : undefined;
  if (encoding && encoding !== "identity" && !decoder) {
    response.destroy();
    throw new ArchiveFetchError("Unsupported content encoding");
  }
  const stream = decoder ? response.pipe(decoder) : response;
  const abort = () => { response.destroy(signal.reason); stream.destroy(signal.reason); };
  const chunks: Buffer[] = [];
  let decodedBytes = 0;
  let wireBytes = 0;
  const limitWire = (chunk: Buffer) => {
    wireBytes += chunk.length;
    if (wireBytes > maxBytes) {
      const error = new ArchiveFetchError("Resource too large", 413);
      response.destroy(error);
      stream.destroy(error);
    }
  };
  response.on("data", limitWire);
  const forwardError = (error: Error) => { if (decoder) decoder.destroy(error); };
  response.on("error", forwardError);
  signal.addEventListener("abort", abort, { once: true });
  try {
    if (signal.aborted) throw signal.reason;
    for await (const value of stream) {
      const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
      decodedBytes += chunk.length;
      if (decodedBytes > maxBytes) throw new ArchiveFetchError("Resource too large", 413);
      chunks.push(chunk);
    }
    return Buffer.concat(chunks, decodedBytes);
  } finally {
    signal.removeEventListener("abort", abort);
    response.removeListener("data", limitWire);
    response.removeListener("error", forwardError);
    response.destroy();
    decoder?.destroy();
  }
}

// Pin each connection to a checked IP while retaining Host, TLS SNI and
// certificate verification against the original hostname. No second lookup.
export function createPublicFetcher(
  resolve: ResolveAddresses = resolveAddresses,
  transport: RequestTransport = requestResource,
): PublicFetcher {
  return async (input, options) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new ArchiveFetchError("Resource fetch timeout", 504)), options.timeoutMs);
    const externalAbort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", externalAbort, { once: true });
    if (options.signal?.aborted) externalAbort();
    const signal = controller.signal;
    let current = input;
    try {
      for (let redirects = 0; redirects <= 5; redirects++) {
        signal.throwIfAborted();
        const error = options.allowHttp ? validateArchiveUrl(current) : validateUrl(current);
        if (error) throw new ArchiveFetchError(error, 403);
        const url = new URL(current);
        let address;
        try { address = await abortable(resolvePublicAddress(url.hostname, resolve), signal); }
        catch (error) {
          if (signal.aborted) throw signal.reason;
          throw new ArchiveFetchError(error instanceof Error ? error.message : "DNS lookup failed", 403);
        }
        const pinnedLookup: LookupFunction = (_hostname, lookupOptions, callback) => {
          if (lookupOptions.all) callback(null, [address]);
          else callback(null, address.address, address.family);
        };
        const response = await abortable(transport(url, {
          agent: false,
          lookup: pinnedLookup,
          signal,
          maxHeaderSize: 32 * 1024,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; HenryInk/1.0; +https://henry.ink)",
            Accept: options.accept || "*/*",
            "Accept-Encoding": "gzip, deflate, br",
          },
        }), signal);
        response.on("error", () => {});
        const headers = responseHeaders(response);
        const status = response.statusCode || 502;
        if ([301, 302, 303, 307, 308].includes(status)) {
          response.destroy();
          const location = headers.get("location");
          if (!location || redirects === 5) throw new ArchiveFetchError("Invalid or excessive redirects");
          current = new URL(location, url).href;
          continue;
        }
        const body = await readBody(response, options.maxBytes, signal);
        headers.delete("content-encoding");
        headers.delete("transfer-encoding");
        headers.set("content-length", String(body.length));
        return { url: url.href, status, headers, body };
      }
      throw new ArchiveFetchError("Excessive redirects");
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", externalAbort);
      controller.abort();
    }
  };
}

export const fetchPublicResource = createPublicFetcher();
