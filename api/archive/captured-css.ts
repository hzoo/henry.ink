import { bundleAsync, transform } from "lightningcss";
import type { PublicResource } from "@/api/archive/public-fetch";

export interface CapturedCssSource {
  content: string;
  baseUrl: string;
  media: string;
}

const MAX_DEPTH = 8;
const MAX_EXPANSIONS = 128;
const MAX_BYTES = 2 * 1024 * 1024;

function httpUrl(value: string, baseUrl: string): string | undefined {
  try {
    const url = new URL(value, baseUrl);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return;
    return url.href;
  } catch { return; }
}

// This is a closed, in-memory bundle: neither resolver callback can fetch or
// fall back to filesystem access. Repeated imports remain distinct applications.
export async function flattenCapturedStylesheets(
  sources: CapturedCssSource[],
  sheets: ReadonlyMap<string, PublicResource>,
): Promise<CapturedCssSource[]> {
  let inputBytes = 0;
  let outputBytes = 0;
  let expansions = 0;
  const result: CapturedCssSource[] = [];
  for (const source of sources) {
    type Node = { content: string; baseUrl: string; depth: number; ancestors: ReadonlySet<string> };
    const nodes = new Map<string, Node>();
    const root = "captured-root.css";
    let omitted = 0;
    const omit = () => `captured-omitted-${++omitted}.css`;
    nodes.set(root, { ...source, depth: 0, ancestors: new Set([source.baseUrl]) });
    let rootHasImports = false;
    let rootAccepted = false;
    try {
      const bundled = await bundleAsync({
        filename: root,
        resolver: {
          read(filename) {
            const node = nodes.get(filename);
            if (!node) return "";
            const bytes = Buffer.byteLength(node.content);
            if (inputBytes + bytes > MAX_BYTES) return "";
            inputBytes += bytes;
            let namespace = false;
            let hasImports = false;
            let prepared;
            try { prepared = transform({
              filename,
              code: Buffer.from(node.content),
              errorRecovery: true,
              visitor: {
                StyleSheet(sheet) { namespace = sheet.rules.some(rule => rule.type === "namespace"); },
                Rule: {
                  import() {
                    hasImports = true;
                    // A namespace is sheet-local; merging it could change selectors.
                    if (namespace) return [];
                  },
                },
                Url(value) {
                  if (value.url.startsWith("#") || value.url.startsWith("data:")) return value;
                  return { ...value, url: httpUrl(value.url, node.baseUrl) || "about:blank" };
                },
              },
            }); } catch { return ""; }
            if (filename === root) {
              rootHasImports = hasImports || prepared.warnings.length > 0;
              rootAccepted = true;
            } else if (namespace) return "";
            return prepared.code.toString();
          },
          resolve(specifier, filename) {
            const parent = nodes.get(filename);
            if (!parent || parent.depth >= MAX_DEPTH || expansions >= MAX_EXPANSIONS) return omit();
            const url = httpUrl(specifier, parent.baseUrl);
            const resource = url ? sheets.get(url) : undefined;
            if (!resource || !httpUrl(resource.url, resource.url) || parent.ancestors.has(resource.url)) return omit();
            if (resource.status !== 200 || resource.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "text/css") return omit();
            const child = `captured-${++expansions}.css`;
            nodes.set(child, {
              content: resource.body.toString(), baseUrl: resource.url, depth: parent.depth + 1,
              ancestors: new Set([...parent.ancestors, resource.url]),
            });
            return child;
          },
        },
      });
      const content = rootAccepted ? (rootHasImports ? bundled.code.toString() : source.content) : "";
      const bytes = Buffer.byteLength(content);
      if (outputBytes + bytes > MAX_BYTES) result.push({ ...source, content: "" });
      else {
        outputBytes += bytes;
        result.push({ ...source, content });
      }
    } catch {
      // Unsupported CSS must not leave a live @import in the archive.
      result.push({ ...source, content: "" });
    }
  }
  return result;
}
