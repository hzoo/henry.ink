import { describe, expect, test } from "bun:test";
import { validatedEmbeddedSvg } from "@/api/archive/embedded-svg";

const svg = (content: string, attrs = "") => `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${content}</svg>`;
const uri = (xml: string) => `data:image/svg+xml,${encodeURIComponent(xml)}`;
const base64 = (xml: string) => `data:image/svg+xml;base64,${Buffer.from(xml).toString("base64")}`;

describe("passive embedded CSS SVG", () => {
  test("accepts the actual Moxie/Bootstrap hamburger and normalizes it", () => {
    const icon = "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'%3e%3cpath stroke='rgba%28255, 255, 255, 0.55%29' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2' d='M4 7h22M4 15h22M4 23h22'/%3e%3c/svg%3e";
    expect(validatedEmbeddedSvg(icon)).toBe(base64(decodeURIComponent(icon.split(",").slice(1).join(","))));
  });

  test("accepts percent and base64 shapes, paint, and transforms", () => {
    const xml = svg('<g transform="translate(1,2) scale(.5)"><path d="M0 0L10 10Z" fill="none" stroke="#abc"/><rect x="1" y="2" width="20" height="30"/><circle cx="5" cy="5" r="2"/><ellipse rx="3" ry="2"/><line x1="0" x2="10"/><polyline points="0,0 1,1"/><polygon points="0,0 1,1 2,0"/></g>', 'viewBox="0 0 30 30"');
    expect(validatedEmbeddedSvg(uri(xml))).toBe(base64(xml));
    expect(validatedEmbeddedSvg(base64(xml))).toBe(base64(xml));
    expect(validatedEmbeddedSvg(uri(xml).replace("svg+xml,", "svg+xml;charset=utf-8,"))).toBe(base64(xml));
  });

  test.each([
    '<script>alert(1)</script>', '<foreignObject><div/></foreignObject>',
    '<style>path{fill:red}</style>', '<use href="#x"/>', '<animate attributeName="fill"/>',
    '<animateTransform/>', '<animateMotion/>', '<set/>', '<image href="https://evil.test/a"/>',
    '<a href="javascript:alert(1)"><path/></a>', '<path onload="alert(1)"/>',
    '<path ONCLICK="alert(1)"/>', '<path style="fill:red"/>', '<path href="https://evil.test"/>',
    '<path xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#x"/>',
    '<path fill="url(https://evil.test/a)"/>', '<path stroke="url(#x)"/>',
    '<path fill="u\\72l(https://evil.test/a)"/>', '<path fill="var(--paint)"/>',
    '<path filter="url(https://evil.test)"/>', '<path xml:base="https://evil.test"/>',
    '<path xmlns="http://www.w3.org/1999/xhtml"/>', '<svg/>', '<path constructor="x"/>',
    '<![CDATA[<script/>]]>', '<!-- hidden -->', '<?xml-stylesheet href="https://evil.test/x.css"?>',
    '<path fill="&#117;rl(https://evil.test)"/>', '<path fill="&amp;"/>', '<path>&unknown;</path>',
    '<path><g></path>', '<path d="M0 0" d="M1 1"/>', 'visible text',
  ])("rejects unsafe or unsupported content: %s", content => {
    expect(validatedEmbeddedSvg(uri(svg(content)))).toBeUndefined();
    expect(validatedEmbeddedSvg(base64(svg(content)))).toBeUndefined();
  });

  test.each([
    '<!DOCTYPE svg SYSTEM "https://evil.test/dtd">',
    '<!DOCTYPE svg [<!ENTITY x "boom">]>', '<?xml version="1.0"?>',
  ])("rejects declarations: %s", declaration => {
    expect(validatedEmbeddedSvg(uri(declaration + svg('<path/>')))).toBeUndefined();
  });

  test("rejects invalid encodings, namespaces, MIME types, and multiple roots", () => {
    for (const input of ["data:image/svg+xml,%zz", "data:image/svg+xml,%C0%AF", "data:image/svg+xml;base64,/w==",
      "data:image/svg+xml;base64,PHN2Zz4=!!", "data:image/svg+xml;base64,AB==", "data:image/svg+xml;base64,",
      uri('<svg/>'), uri(svg("") + svg("")), uri(svg("")).replace("image/svg+xml", "text/html"),
      uri(svg("")).replace("svg+xml,", "svg+xml;charset=latin1,"), uri(svg('<path/>', 'xmlns:x="urn:other"')),
      uri(svg('<path d="M0\u0000"/>'))]) {
      expect(validatedEmbeddedSvg(input)).toBeUndefined();
    }
  });

  test("bounds encoded bytes, decoded bytes, nesting, nodes, and attributes", () => {
    expect(validatedEmbeddedSvg("data:image/svg+xml," + "%20".repeat(65537))).toBeUndefined();
    expect(validatedEmbeddedSvg(base64(svg(" ".repeat(65536))))).toBeUndefined();
    expect(validatedEmbeddedSvg(uri(svg("<g>".repeat(16) + "</g>".repeat(16))))).toBeUndefined();
    expect(validatedEmbeddedSvg(uri(svg("<path/>".repeat(256))))).toBeUndefined();
    const attrs = Array.from({ length: 33 }, (_, i) => `a${i}="0"`).join(" ");
    expect(validatedEmbeddedSvg(uri(svg(`<path ${attrs}/>`)))).toBeUndefined();
  });
});
