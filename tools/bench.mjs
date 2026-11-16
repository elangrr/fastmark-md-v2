// Median CPU (ms, user+sys of the whole process) over N fresh `node <script>` runs, interleaved.
// usage: node tools/bench.mjs [N=9] [inputDir] [script...]   (default: main.ts, kit baseline, null)
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const KIT = process.env.KIT ?? '../kit3/markdown-render-speed-02-kit';
const N = +(process.argv[2] ?? 9);
const IN = process.argv[3] ?? join(KIT, 'practice/input');
let scripts = process.argv.slice(4);
if (!scripts.length) scripts = ['main.ts', join(KIT, 'baselines/main.ts'), 'tools/null.ts'];
const OUT = mkdtempSync(join(tmpdir(), 'mdbench-'));
const hook = pathToFileURL('tools/cpu-hook.mjs').href;
const res = Object.fromEntries(scripts.map((s) => [s, []]));
for (let i = 0; i < N; i++) for (const s of scripts) {
  const p = spawnSync(process.env.NODE_BIN || process.execPath,['--import', hook, s], { env: { ...process.env, MAKEFUN_INPUT_DIR: IN, MAKEFUN_OUTPUT_DIR: OUT }, encoding: 'utf8' });
  const m = /CPU ([\d.]+)/.exec(p.stderr);
  if (p.status !== 0 || !m) { console.error(p.stderr); process.exit(1); }
  res[s].push(+m[1]);
}
const med = (a) => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };
const nul = scripts.includes('tools/null.ts') ? med(res['tools/null.ts']) : 0;
for (const s of scripts) console.log(`${s.padEnd(50)} median ${med(res[s]).toFixed(0)} ms  net ${(med(res[s]) - nul).toFixed(0)} ms  [${res[s].map((x) => x.toFixed(0)).join(' ')}]`);
