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
const wall = Object.fromEntries(scripts.map((s) => [s, []]));
for (let i = 0; i < N; i++) for (const s of scripts) {
  // an argument "flags:<v8 flags>" runs tools/flagmain.mjs with those flags (interleaved A/B of flags)
  // "mod:<path relative to tools/>" runs that parse module under --no-opt (A/B of code versions)
  const isFlags = s.startsWith('flags:'), isMod = s.startsWith('mod:');
  const script = isFlags || isMod ? 'tools/flagmain.mjs' : s;
  const env = { ...process.env, MAKEFUN_INPUT_DIR: IN, MAKEFUN_OUTPUT_DIR: OUT, FLAGS: isFlags ? s.slice(6) : isMod ? '--no-opt' : '', PARSE_MOD: isMod ? s.slice(4) : '' };
  const p = spawnSync(process.env.NODE_BIN || process.execPath, ['--import', hook, script], { env, encoding: 'utf8' });
  const m = /CPU ([\d.]+) WALL ([\d.]+)/.exec(p.stderr);
  if (p.status !== 0 || !m) { console.error(p.stderr); process.exit(1); }
  res[s].push(+m[1]);
  wall[s].push(+m[2]);
}
const med = (a) => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };
// trimmed mean (drop the 2 lowest and 2 highest when there are enough runs), like the grader's heat
const tmean = (a) => { const b = [...a].sort((x, y) => x - y); const c = b.length > 6 ? b.slice(2, -2) : b; return c.reduce((x, y) => x + y, 0) / c.length; };
const nul = scripts.includes('tools/null.ts') ? med(res['tools/null.ts']) : 0;
const nulT = scripts.includes('tools/null.ts') ? tmean(res['tools/null.ts']) : 0;
for (const s of scripts) console.log(`${s.padEnd(40)} median ${med(res[s]).toFixed(0)} net ${(med(res[s]) - nul).toFixed(0)} | tmean ${tmean(res[s]).toFixed(0)} net ${(tmean(res[s]) - nulT).toFixed(0)} ms  [${res[s].map((x) => x.toFixed(0)).join(' ')}]`);
// paired difference of each script against the first one (runs are interleaved), mean +- standard error
const pair = (a, b) => { const d = a.map((x, i) => x - b[i]); const mu = d.reduce((x, y) => x + y, 0) / d.length; const sd = Math.sqrt(d.reduce((x, y) => x + (y - mu) ** 2, 0) / (d.length - 1)); return `${mu.toFixed(1)} +- ${(sd / Math.sqrt(d.length)).toFixed(1)}`; };
for (const s of scripts.slice(1)) console.log(`${s} minus ${scripts[0]}: CPU ${pair(res[s], res[scripts[0]])} ms, wall ${pair(wall[s], wall[scripts[0]])} ms (wall medians ${med(wall[scripts[0]]).toFixed(1)} / ${med(wall[s]).toFixed(1)})`);
