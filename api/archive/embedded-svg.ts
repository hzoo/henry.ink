import { SaxesParser } from "saxes";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const MAX_BYTES = 64 * 1024;
const ELEMENTS = new Set(["svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon"]);
const NUMBER_LIST = /^[\d\s.,+eE%-]+$/;
const PAINT = /^(?:[a-z]+|#[\da-f]{3,8}|(?:rgb|rgba|hsl|hsla)\([\d\s.,%+/-]+\))$/i;
const ATTRIBUTES: Record<string, RegExp> = {
  viewBox: NUMBER_LIST,
  width: NUMBER_LIST, height: NUMBER_LIST,
  x: NUMBER_LIST, y: NUMBER_LIST, x1: NUMBER_LIST, y1: NUMBER_LIST,
  x2: NUMBER_LIST, y2: NUMBER_LIST, cx: NUMBER_LIST, cy: NUMBER_LIST,
  r: NUMBER_LIST, rx: NUMBER_LIST, ry: NUMBER_LIST, points: NUMBER_LIST,
  d: /^[MmZzLlHhVvCcSsQqTtAa\d\s.,+eE-]+$/,
  transform: /^(?:(?:matrix|translate|scale|rotate|skewX|skewY)\([\d\s.,+eE-]+\)\s*)+$/,
  fill: PAINT, stroke: PAINT, color: PAINT,
  opacity: NUMBER_LIST, "fill-opacity": NUMBER_LIST, "stroke-opacity": NUMBER_LIST,
  "stroke-width": NUMBER_LIST, "stroke-miterlimit": NUMBER_LIST,
  "stroke-dasharray": /^(?:none|[\d\s.,+eE%-]+)$/,
  "stroke-dashoffset": NUMBER_LIST,
  "stroke-linecap": /^(?:butt|round|square)$/,
  "stroke-linejoin": /^(?:miter|round|bevel)$/,
  "fill-rule": /^(?:nonzero|evenodd)$/,
  preserveAspectRatio: /^(?:none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max)(?:\s+(?:meet|slice))?)$/,
};

// CSS image use only: reject the whole icon instead of repairing active SVG.
export function validatedEmbeddedSvg(url: string): string | undefined {
  if (url.length > MAX_BYTES * 3 + 64) return;
  const match = /^data:image\/svg\+xml(?:;charset=utf-8)?(;base64)?,([\s\S]*)$/i.exec(url);
  if (!match) return;
  try {
    let xml: string;
    if (match[1]) {
      const encoded = match[2];
      if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) return;
      const bytes = Buffer.from(encoded, "base64");
      if (bytes.length > MAX_BYTES || bytes.toString("base64") !== encoded) return;
      xml = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } else {
      xml = decodeURIComponent(match[2]);
    }
    if (Buffer.byteLength(xml) > MAX_BYTES || /[&\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(xml)) return;
    const reject = () => { throw new Error("Unsupported embedded SVG"); };
    const parser = new SaxesParser({ xmlns: true, position: false });
    let depth = 0;
    let nodes = 0;
    let attributes = 0;
    parser.on("error", reject);
    parser.on("doctype", reject);
    parser.on("xmldecl", reject);
    parser.on("processinginstruction", reject);
    parser.on("comment", reject);
    parser.on("cdata", reject);
    parser.on("text", text => { if (text.trim()) reject(); });
    parser.on("opentagstart", () => {
      if (++depth > 16 || ++nodes > 256) reject();
      attributes = 0;
    });
    parser.on("attribute", () => { if (++attributes > 32) reject(); });
    parser.on("opentag", tag => {
      if (tag.prefix || tag.uri !== SVG_NAMESPACE || !ELEMENTS.has(tag.name)) reject();
      if ((nodes === 1) !== (tag.name === "svg")) reject();
      for (const attr of Object.values(tag.attributes)) {
        if (attr.name === "xmlns" && nodes === 1 && attr.value === SVG_NAMESPACE) continue;
        const allowed = Object.hasOwn(ATTRIBUTES, attr.name) ? ATTRIBUTES[attr.name] : undefined;
        if (attr.prefix || attr.uri || !allowed?.test(attr.value)) reject();
      }
    });
    parser.on("closetag", () => { depth--; });
    parser.write(xml).close();
    if (!nodes || depth !== 0) return;
    return `data:image/svg+xml;base64,${Buffer.from(xml).toString("base64")}`;
  } catch { return; }
}
