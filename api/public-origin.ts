/**
 * The one public address of this API, written into every cleaned page as the
 * home of its images and fonts. It is configuration, never taken from a
 * request, so the same stored page is correct for every reader.
 */
export function resolvePublicOrigin(value: string | undefined, production: boolean, port = "3000"): string {
  if (!value) {
    if (production) throw new Error("API_PUBLIC_ORIGIN is required in production");
    return `http://localhost:${port}`;
  }
  const url = new URL(value);
  if (url.origin !== value) throw new Error("API_PUBLIC_ORIGIN must be an origin, such as https://api.henry.ink");
  return url.origin;
}

export const publicApiOrigin = resolvePublicOrigin(
  process.env.API_PUBLIC_ORIGIN, process.env.NODE_ENV === "production", process.env.API_PORT);
