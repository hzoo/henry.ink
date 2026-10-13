import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('the real production Vite configuration rejects a localhost API before building', async () => {
  const output = await mkdtemp(join(tmpdir(), 'henry-invalid-build-'));
  try {
    const result = Bun.spawnSync({
      cmd: [process.execPath, 'node_modules/vite/bin/vite.js', 'build', '--config', 'henry-ink/vite.config.ts', '--outDir', output],
      cwd: resolve(import.meta.dir, '../..'),
      env: { ...process.env, VITE_API_URL: 'http://localhost:8789' },
      stdout: 'pipe', stderr: 'pipe',
    });
    expect(result.exitCode).not.toBe(0);
    expect(new TextDecoder().decode(result.stderr)).toContain('Production VITE_API_URL must use HTTPS and cannot point to localhost');
  } finally { await rm(output, { recursive: true, force: true }); }
}, 30_000);
