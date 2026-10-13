// Manual network diagnostic: bun scripts/bench-reader.ts [https://example.com/article ...]
// Uses a fresh in-memory snapshot cache, never the production snapshot database.
import { capturePage, closeArchiveBrowser } from '@/api/archive/browser-capture';
import { createArchiveService } from '@/api/archive/processor';
import { fetchPublicResource, type PublicFetcher } from '@/api/archive/public-fetch';

const urls = process.argv.slice(2);
if (!urls.length) urls.push('https://www.robinsloan.com/notes/home-cooked-app', 'https://moxie.org/2022/01/07/web3-first-impressions.html');
try {
  for (const url of urls) {
    await closeArchiveBrowser();
    const downloads: Array<{ url: string; ms: number; bytes: number; type: string }> = [];
    const fetcher: PublicFetcher = async (target, options) => {
      const start = performance.now();
      const result = await fetchPublicResource(target, options);
      downloads.push({ url: target, ms: Math.round(performance.now() - start), bytes: result.body.length, type: result.headers.get('content-type') || '' });
      return result;
    };
    let captureMs = 0;
    const service = createArchiveService(async target => {
      const start = performance.now();
      const result = await capturePage(target, fetcher);
      captureMs = performance.now() - start;
      return result;
    });
    const start = performance.now();
    const result = await service(url, 'https://api.henry.ink');
    const coldMs = performance.now() - start;
    const warmStart = performance.now();
    await service(url, 'https://api.henry.ink');
    console.log(JSON.stringify({ url, coldMs: Math.round(coldMs), captureMs: Math.round(captureMs),
      processingMs: Math.round(coldMs - captureMs), cachedMs: +(performance.now() - warmStart).toFixed(2),
      htmlBytes: Buffer.byteLength(result.html), cssBytes: Buffer.byteLength(result.css), downloads }, null, 2));
  }
} finally { await closeArchiveBrowser(); }
