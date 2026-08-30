// Runs every functions/**/*.test.mjs file via Node's built-in test runner.
//
// This can't just pass the file paths to `node --test <files...>`: Node's
// test runner treats any CLI file argument containing `[`/`]`/`*`/`?` as a
// glob pattern (not a literal path) — Cloudflare Pages' `[id]`-style dynamic
// route folders contain literal `[`/`]`, so `[id]` gets parsed as a
// single-character glob class and matches nothing, silently dropping that
// whole file's tests with zero error output. Instead, this walks the
// filesystem for `*.test.mjs` files itself, writes a tiny throwaway
// "aggregator" module that `import()`s each one by its resolved file: URL
// (module specifiers are never glob-interpreted), and runs `node --test`
// against just that one aggregator file.
import { readdirSync, statSync, writeFileSync, unlinkSync, mkdtempSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(import.meta.dirname, '..', 'functions');

function collectTestFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      results.push(...collectTestFiles(fullPath));
    } else if (entry.endsWith('.test.mjs')) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = collectTestFiles(root);
if (files.length === 0) {
  console.error('No functions/**/*.test.mjs files found.');
  process.exit(1);
}

const tmpDir = mkdtempSync(join(tmpdir(), 'tagmate-functions-tests-'));
const aggregatorPath = join(tmpDir, 'run-all.mjs');
const aggregatorSource = files
  .map((file) => `await import(${JSON.stringify(pathToFileURL(file).href)});`)
  .join('\n');
writeFileSync(aggregatorPath, aggregatorSource);

try {
  const result = spawnSync(process.execPath, ['--test', aggregatorPath], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} finally {
  try {
    unlinkSync(aggregatorPath);
    rmdirSync(tmpDir);
  } catch {
    // best-effort cleanup — a leftover temp file/dir isn't worth failing the run over
  }
}
