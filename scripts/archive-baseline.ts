import { capturePage, closeArchiveBrowser } from '@/api/archive/browser-capture';
import { createArchiveService } from '@/api/archive/processor';

// Save fixed inputs before a pipeline change; replay them without fetching sites again.
const defaults = [
  ['robin', 'https://www.robinsloan.com/notes/home-cooked-app'],
  ['spatial', 'https://darkblueheaven.com/spatialsoftware'],
  ['detail', 'https://johnsalvatier.org/blog/2017/reality-has-a-surprising-amount-of-detail'],
  ['conversations', 'https://www.experimental-history.com/p/good-conversations-have-lots-of-doorknobs'],
  ['garden', 'https://firstthings.com/making-the-garden/'],
  ['church', 'https://sambleckley.com/writing/church-of-interruption.html'],
  ['tyranny', 'https://www.jofreeman.com/joreen/tyranny.htm'],
];
const directory = process.argv[2] || '/tmp/henry-archive-baseline';
const examples: string[][] = process.argv[3] ? await Bun.file(process.argv[3]).json() : defaults;
if (!Array.isArray(examples) || examples.some(entry => !Array.isArray(entry) || entry.length !== 2 ||
  !/^[a-z0-9-]+$/.test(entry[0]) || !/^https?:\/\//.test(entry[1]))) {
  throw new Error('Expected a JSON array of [safe-name, http(s)-URL] pairs');
}
let failures = 0;
try {
  for (const [name, url] of examples) {
    try {
      const start = performance.now();
      const captured = await capturePage(url);
      const captureMs = performance.now() - start;
      const service = createArchiveService(async () => captured);
      const processStart = performance.now();
      const archive = await service(url, 'https://api.henry.ink');
      const processMs = performance.now() - processStart;
      await Bun.write(`${directory}/${name}.json`, JSON.stringify({ url, captured, archive, captureMs, processMs }));
      console.log(JSON.stringify({ name, captureMs, processMs, bytes: JSON.stringify(archive).length }));
    } catch (error) { failures++; console.error(name, String(error)); }
  }
} finally { await closeArchiveBrowser(); }
if (failures) process.exitCode = 1;
