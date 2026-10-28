import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import type { LookupAddress } from "node:dns";

const blocked = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10],
  ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blocked.addSubnet(address, prefix, "ipv4");

const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
blocked.addSubnet("2001::", 23, "ipv6"); // special-purpose assignments
blocked.addSubnet("2001:db8::", 32, "ipv6");
blocked.addSubnet("2002::", 16, "ipv6"); // IPv4 tunnelling
blocked.addSubnet("3fff::", 20, "ipv6");

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, "ipv4");
  // Excludes loopback, link-local, ULA, multicast, mapped IPv4 and NAT64.
  return family === 6 && globalV6.check(address, "ipv6") && !blocked.check(address, "ipv6");
}

function validate(url: string, allowHttp: boolean): string | null {
  if (url.length > 8192) return "URL too long";
  let parsed: URL;
  try { parsed = new URL(url); } catch { return "Invalid URL"; }
  if (parsed.protocol !== "https:" && !(allowHttp && parsed.protocol === "http:")) {
    return allowHttp ? "Only HTTP and HTTPS URLs are allowed" : "Only HTTPS URLs are allowed";
  }
  if (parsed.username || parsed.password) return "URL credentials are not allowed";
  if (parsed.port) return "Only standard HTTP and HTTPS ports are allowed";
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (isIP(hostname.replace(/^\[|\]$/g, ""))) return "IP addresses are not allowed — use a domain name";
  if (!hostname.includes(".") || /(?:^|\.)(localhost|local|internal|lan|home|onion)$/.test(hostname)) {
    return "A public domain name is required";
  }
  return null;
}

export const validateUrl = (url: string): string | null => validate(url, false);
export const validateArchiveUrl = (url: string): string | null => validate(url, true);

export type ResolveAddresses = (hostname: string) => Promise<LookupAddress[]>;
export const resolveAddresses: ResolveAddresses = hostname => lookup(hostname, { all: true, verbatim: true });

export async function resolvePublicAddress(
  hostname: string,
  resolve: ResolveAddresses = resolveAddresses,
): Promise<LookupAddress> {
  const addresses = await resolve(hostname);
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error("Destination does not resolve exclusively to public addresses");
  }
  return addresses.find(address => address.family === 4) || addresses[0];
}
