import { expect, test } from "bun:test";
import { flattenCapturedStylesheets } from "@/api/archive/captured-css";
import type { PublicResource } from "@/api/archive/public-fetch";

const baseUrl = "https://source.example/css/main.css";
function sheet(url: string, content: string): PublicResource {
  return { url, status: 200, headers: new Headers({ "content-type": "text/css" }), body: Buffer.from(content) };
}
async function flatten(content: string, sheets = new Map<string, PublicResource>()) {
  return (await flattenCapturedStylesheets([{ content, baseUrl, media: "print" }], sheets))[0];
}

test("leaves a sheet without imports and its outer media unchanged", async () => {
  const source = 'p{color:blue;background:url(../bg.png)}';
  expect(await flatten(source)).toEqual({ content: source, baseUrl, media: "print" });
});

test("escaped imports still bundle while import text in comments and strings stays untouched", async () => {
  const source = '/* @import "not-a-sheet.css" */ p{--label:"@import";color:blue}';
  expect((await flatten(source)).content).toBe(source);
  const url = 'https://source.example/css/child.css';
  const { content } = await flatten('@\\69mport "child.css"; .root{color:red}', new Map([[url, sheet(url, '.child{color:blue}')]]));
  expect(content).toContain('.child');
  expect(content).toContain('.root');
  expect(content).not.toContain('@import');
});

test("rebases nested fonts and images against each final import URL", async () => {
  const sheets = new Map([
    ["https://source.example/css/old.css", sheet("https://cdn.example/theme/imported.css", '@import "nested.css"; .child{background:url(../image.png)}')],
    ["https://cdn.example/theme/nested.css", sheet("https://fonts.example/styles/font.css", '@font-face{font-family:Test;src:url(../font.woff2)}')],
  ]);
  const { content } = await flatten('@import "old.css"; .root{background:url(./root.png)}', sheets);
  expect(content).toContain('https://fonts.example/font.woff2');
  expect(content).toContain('https://cdn.example/image.png');
  expect(content).toContain('https://source.example/css/root.png');
  expect(content).not.toContain('@import');
});

test("preserves import cascade position, repeats, and layer/supports/media conditions", async () => {
  const url = "https://source.example/css/child.css";
  const sheets = new Map([[url, sheet(url, '.child{color:blue}')]]);
  const { content } = await flatten('@layer reset, theme; @import "child.css" layer(theme) supports(display:grid) screen and (min-width:1px); @import "child.css" layer; .root{color:red}', sheets);
  expect(content).toContain('@layer reset, theme;');
  expect(content).toContain('@supports (display: grid)');
  expect(content).toContain('@media screen and (width >= 1px)');
  expect(content).toContain('@layer theme');
  expect(content).toContain('@layer {');
  expect(content.match(/\.child/g)).toHaveLength(2);
  expect(content.indexOf('.child')).toBeLessThan(content.indexOf('.root'));
});

test("omits missing, non-HTTP, credentialed, non-CSS, and unsuccessful imports", async () => {
  const invalid = sheet("https://source.example/css/bad.css", '.bad{color:red}');
  invalid.headers.set("content-type", "text/html");
  const failed = { ...sheet("https://source.example/css/failed.css", '.bad{color:red}'), status: 404 };
  const { content } = await flatten('@import "missing.css"; @import "data:text/css,.bad{}"; @import "file:///etc/passwd"; @import "https://user:password@source.example/x.css"; @import "bad.css"; @import "failed.css"; .safe{color:blue}', new Map([[invalid.url, invalid], [failed.url, failed]]));
  expect(content).toContain('.safe');
  expect(content).not.toContain('@import');
  expect(content).not.toContain('.bad');
  expect(content).not.toContain('password');
});

test("omits namespaced imported sheets without losing parent rules", async () => {
  const url = "https://source.example/css/child.css";
  const { content } = await flatten('@import "child.css"; .root{color:red}', new Map([[url, sheet(url, '@namespace svg "http://www.w3.org/2000/svg"; svg|a{fill:red}')]]));
  expect(content).toContain('.root');
  expect(content).not.toContain('@namespace');
  expect(content).not.toContain('fill');
});

test("bounds redirected-alias cycles but retains each sheet's own rules", async () => {
  const url = "https://source.example/css/child.css";
  const root = sheet(baseUrl, '@import "child.css"; .root{color:red}');
  const { content } = await flatten(root.body.toString(), new Map([
    [url, sheet(url, '@import "alias.css"; .child{color:blue}')],
    ["https://source.example/css/alias.css", root],
  ]));
  expect(content.match(/\.root/g)).toHaveLength(1);
  expect(content.match(/\.child/g)).toHaveLength(1);
  expect(content).not.toContain('@import');
});

test("bounds import depth", async () => {
  const sheets = new Map(Array.from({ length: 12 }, (_, i) => {
    const url = `https://source.example/css/${i}.css`;
    return [url, sheet(url, `@import "${i + 1}.css"; .depth${i}{color:red}`)] as const;
  }));
  const { content } = await flatten('@import "0.css"; .root{color:blue}', sheets);
  expect(content).toContain('.depth7');
  expect(content).not.toContain('.depth8');
  expect(content).toContain('.root');
});

test("bounds repeated import expansion", async () => {
  const url = "https://source.example/css/child.css";
  const { content } = await flatten('@import "child.css" layer;'.repeat(200) + '.root{color:red}', new Map([[url, sheet(url, '.child{color:blue}')]]));
  expect(content.match(/\.child/g)).toHaveLength(128);
  expect(content).toContain('.root');
  expect(content).not.toContain('@import');
});

test("bounds bytes across sources and expanded copies", async () => {
  const large = '.large{--text:"' + 'x'.repeat(1024 * 1024) + '"}';
  const url = "https://source.example/css/large.css";
  const { content } = await flatten('@import "large.css"; @import "large.css"; .root{color:red}', new Map([[url, sheet(url, large)]]));
  expect(content.match(/\.large/g)).toHaveLength(1);
  expect(content).toContain('.root');
  const sources = await flattenCapturedStylesheets(Array.from({ length: 3 }, () => ({ content: large, baseUrl, media: "" })), new Map());
  expect(sources.filter(source => source.content)).toHaveLength(1);
});

test("unsafe asset protocols stay inert and local fragment references survive", async () => {
  const url = "https://source.example/css/child.css";
  const { content } = await flatten('@import "child.css";', new Map([[url, sheet(url, '.child{background:url(javascript:alert);filter:url(#local)}')]]));
  expect(content).toContain('about:blank');
  expect(content).toContain('#local');
  expect(content).not.toContain('javascript:');
});
