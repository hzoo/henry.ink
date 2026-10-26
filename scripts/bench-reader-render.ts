// Manual CPU diagnostic: bun scripts/bench-reader-render.ts [--baseline=git-ref]
// Synthetic article HTML, no network, no production cache. These are preparation
// and anchoring timings, not paint timings or traffic-capacity measurements.
import { chromium } from 'playwright';

const paths = ['src/lib/annotations/anchors.ts', 'henry-ink/reader/document.ts'];
const baseline = process.argv.find(arg => arg.startsWith('--baseline='))?.slice('--baseline='.length);

async function modules(ref?: string) {
  const compiled = await Promise.all(paths.map(async path => {
    const build = await Bun.build({
      entrypoints: [path], target: 'browser',
      plugins: ref ? [{
        name: 'baseline-source',
        setup(builder) {
          builder.onLoad({ filter: /(?:annotations\/anchors|reader\/document)\.ts$/ }, args => {
            const relative = args.path.slice(`${process.cwd()}/`.length);
            const source = Bun.spawnSync(['git', 'show', `${ref}:${relative}`]);
            if (source.exitCode) throw new Error(source.stderr.toString());
            return { contents: source.stdout.toString(), loader: 'ts' };
          });
        },
      }] : [],
    });
    if (!build.success) throw new Error(build.logs.join('\n'));
    return `data:text/javascript;base64,${Buffer.from(await build.outputs[0].text()).toString('base64')}`;
  }));
  return { label: ref || 'working-tree', anchors: compiled[0], document: compiled[1] };
}

const versions = baseline ? [await modules(baseline), await modules()] : [await modules()];
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Reader CPU diagnostic</title>' }));
  await page.goto('https://reader.example/');
  const result = await page.evaluate(async versions => {
    const loaded = await Promise.all(versions.map(async version => ({
      label: version.label,
      indexArticle: (await import(version.anchors)).indexArticle as typeof import('@/src/lib/annotations/anchors').indexArticle,
      createReaderDocument: (await import(version.document)).createReaderDocument as typeof import('@/henry-ink/reader/document').createReaderDocument,
    })));
    const stats = (samples: number[]) => {
      samples.sort((a, b) => a - b);
      return { median: +samples[Math.floor(samples.length / 2)].toFixed(2), min: +samples[0].toFixed(2), max: +samples[samples.length - 1].toFixed(2) };
    };
    const results = [];
    for (const [paragraphs, quotes] of [[600, 20], [3000, 100]]) {
      const html = Array.from({ length: paragraphs }, (_, index) => `<p>Paragraph ${index}: ordinary supporting text <em>and inline context</em> ending with unique quote ${String(index).padStart(4, '0')}.</p>`).join('');
      const input = { html, css: 'body {max-width:65ch;font:20px/1.5 Georgia,serif;margin:20px auto}', assetOrigin: 'https://api.example' };
      const versions = [];
      let expectedDocument = '';
      let expectedRanges = '';
      for (const version of loaded) {
        const prepare: number[] = [];
        let output = '';
        for (let sample = 0; sample < 22; sample++) {
          const start = performance.now();
          output = version.createReaderDocument(input, document);
          if (sample >= 2) prepare.push(performance.now() - start);
        }
        // The UI pass removes the old source-side external icon. Normalize only
        // that obsolete rule when comparing the preceding release's output.
        const comparableOutput = output.replace('.arena-link-icon{font-size:.7em;margin-left:.2em}', '');
        if (expectedDocument && comparableOutput !== expectedDocument) throw new Error('Document output changed between benchmark versions');
        expectedDocument = comparableOutput;
        const frame = document.createElement('iframe');
        frame.sandbox.add('allow-same-origin');
        frame.style.cssText = 'width:1000px;height:800px';
        const blob = URL.createObjectURL(new Blob([output], { type: 'text/html' }));
        const ready = new Promise<void>(resolve => frame.addEventListener('load', () => resolve(), { once: true }));
        frame.src = blob;
        document.body.appendChild(frame);
        await ready;
        const root = frame.contentDocument!.body;
        const indexing: number[] = [];
        const resolving: number[] = [];
        let ranges = '';
        for (let sample = 0; sample < 22; sample++) {
          const start = performance.now();
          const find = version.indexArticle(root);
          const indexed = performance.now();
          ranges = Array.from({ length: quotes }, (_, note) => find({
            exact: `unique quote ${String(paragraphs - quotes + note).padStart(4, '0')}`,
            prefix: 'ending with ', suffix: '.',
          })?.toString() || 'unmatched').join('|');
          if (sample >= 2) { indexing.push(indexed - start); resolving.push(performance.now() - indexed); }
        }
        if (ranges.includes('unmatched') || (expectedRanges && ranges !== expectedRanges)) throw new Error('Quote output changed between benchmark versions');
        expectedRanges = ranges;
        versions.push({ version: version.label, prepareMs: stats(prepare), indexMs: stats(indexing), resolveMs: stats(resolving) });
        frame.remove();
        URL.revokeObjectURL(blob);
      }
      results.push({ paragraphs, quotes, htmlBytes: html.length, samples: 20, versions });
    }
    return results;
  }, versions);
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
