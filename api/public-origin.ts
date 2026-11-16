/**
 * The one public address of this API, written into every cleaned page as the
 * home of its images and fonts. It is configuration, never taken from a
 * request, so the same stored page is correct for every reader. The API
 * listens on localhost behind a proxy and cannot know this address itself;
 * the systemd unit states it.
 */
export function resolvePublicOrigin(value: string | undefined, port = "3000"): string {
  if (!value) return `http://localhost:${port}`;
  const url = new URL(value);
  if (url.origin !== value) throw new Error("API_PUBLIC_ORIGIN must be an origin, such as https://api.henry.ink");
  return url.origin;
}

export const publicApiOrigin = resolvePublicOrigin(process.env.API_PUBLIC_ORIGIN, process.env.API_PORT);
