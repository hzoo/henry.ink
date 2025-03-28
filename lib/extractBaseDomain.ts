
export function extractBaseDomain(url: string): string {
  try {
    const { hostname } = new URL(url);
    return hostname;
  } catch {
    return "";
  }
}
