// Usage: bun docs/bench/landing-load.ts <baseline dist> <candidate dist>
// Landing page to "Open page" visible, 150 ms latency, 1.6 Mbps, 4x CPU throttle.
import { chromium } from 'playwright';
const dirs = { base: process.argv[2], branch: process.argv[3] };
function serveDir(dir: string) {
  return Bun.serve({ port: 0, async fetch(req) {
    const p = new URL(req.url).pathname;
    const f = Bun.file(dir + p);
    if (p !== '/' && await f.exists()) return new Response(f);
    return new Response(Bun.file(dir + '/index.html'), { headers: { 'content-type': 'text/html' } });
  } });
}
const browser = await chromium.launch();
const results: Record<string, number[]> = { base: [], branch: [] };
const bytes: Record<string, number> = {};
for (let round = 0; round < 7; round++) for (const [name, dir] of Object.entries(dirs)) {
  const server = serveDir(dir);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await ctx.route(u => !u.href.startsWith(`http://localhost:${server.port}`), r => r.abort());
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
  let js = 0;
  page.on('response', async r => { if (r.url().endsWith('.js')) js += (await r.body()).length; });
  const t0 = Date.now();
  await page.goto(`http://localhost:${server.port}/`);
  await page.getByRole('button', { name: 'Open page' }).waitFor({ timeout: 60000 });
  results[name].push(Date.now() - t0);
  bytes[name] = js;
  await ctx.close(); server.stop(true);
}
const med = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1];
for (const n of Object.keys(results)) console.log(n, 'median ms', med(results[n]), 'all', results[n].join(','), 'js bytes', bytes[n]);
await browser.close();
