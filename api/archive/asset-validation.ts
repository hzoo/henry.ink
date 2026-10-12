import { SaxesParser } from "saxes";
import { ArchiveFetchError, type PublicResource } from "@/api/archive/public-fetch";

const IMAGE_LIMIT = 10 * 1024 * 1024;
const FONT_LIMIT = 5 * 1024 * 1024;
export const MAX_ASSET_BYTES = IMAGE_LIMIT;

export function validatedEmbeddedFont(url: string): string | undefined {
  if (url.length > 2 * 1024 * 1024) return;
  const match = /^data:([^;,]+)(?:;charset=[^;,]+)?;base64,([a-z0-9+/]+={0,2})$/i.exec(url);
  if (!match) return;
  try {
    const body = Buffer.from(match[2], 'base64');
    const type = validateAsset({ url, body, status: 200, headers: new Headers({ 'content-type': match[1] }) });
    if (type.startsWith('font/')) return `data:${type};base64,${body.toString('base64')}`;
  } catch { /* Unsupported or mislabeled data remains blocked. */ }
}

function detectFormat(body: Buffer): string | undefined {
  if (body.length < 4) return;
  const ascii = (start: number, end: number) => body.toString("ascii", start, end);
  if (body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (body[0] === 255 && body[1] === 216 && body[2] === 255) return "image/jpeg";
  if (["GIF87a", "GIF89a"].includes(ascii(0, 6))) return "image/gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp" && /avif|avis/.test(ascii(8, Math.min(64, body.length)))) return "image/avif";
  if (body.length >= 54 && ascii(0, 2) === "BM") return "image/bmp";
  if (ascii(0, 4) === "wOFF") return "font/woff";
  if (ascii(0, 4) === "wOF2") return "font/woff2";
  if (ascii(0, 4) === "OTTO") return "font/otf";
  if (body.subarray(0, 4).equals(Buffer.from([0, 1, 0, 0])) || ascii(0, 4) === "true") return "font/ttf";
}

export function validateAsset(resource: PublicResource): string {
  const declared = resource.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || "";
  if (declared === "image/svg+xml") {
    if (resource.body.length > 1024 * 1024) throw new ArchiveFetchError("SVG too large", 413);
    const text = resource.body.toString();
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new ArchiveFetchError("SVG declarations are not allowed", 415);
    try {
      // Validate XML without allocating a DOM or walking deep ancestor chains.
      const parser = new SaxesParser({ xmlns: true, position: false });
      let depth = 0;
      let nodes = 0;
      let attributes = 0;
      parser.on('opentagstart', () => {
        if (++depth > 64 || ++nodes > 10_000) throw new Error('SVG complexity limit');
        attributes = 0;
      });
      parser.on('attribute', () => {
        if (++attributes > 128) throw new Error('SVG attribute limit');
      });
      parser.on('opentag', tag => {
        if (nodes === 1 && (tag.local !== 'svg' || tag.uri !== 'http://www.w3.org/2000/svg')) throw new Error('Not SVG');
      });
      parser.on('closetag', () => { depth--; });
      parser.write(text).close();
      return declared;
    } catch { throw new ArchiveFetchError("Invalid SVG", 415); }
  }
  const detected = detectFormat(resource.body);
  if (!detected) throw new ArchiveFetchError("Unsupported asset bytes", 415);
  const aliases: Record<string, string> = {
    "image/jpg": "image/jpeg", "image/apng": "image/png", "image/x-ms-bmp": "image/bmp",
    "application/font-woff": "font/woff", "application/x-font-woff": "font/woff",
    "application/x-font-ttf": "font/ttf", "application/x-font-opentype": "font/otf",
  };
  const canonical = aliases[declared] || declared;
  // Some sites serve OpenType under a WOFF MIME type. Only cross-normalize
  // recognized font formats; HTML and image/font mismatches still fail closed.
  const mislabeledFont = ["font/woff", "font/woff2", "font/ttf", "font/otf"].includes(canonical)
    && detected.startsWith("font/");
  if (declared && declared !== "application/octet-stream" && canonical !== detected && !mislabeledFont) {
    throw new ArchiveFetchError("Asset content type does not match bytes", 415);
  }
  if (resource.body.length > (detected.startsWith("font/") ? FONT_LIMIT : IMAGE_LIMIT)) {
    throw new ArchiveFetchError("Asset too large", 413);
  }
  return detected;
}
