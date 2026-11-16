// End-to-end check of the driver: run `node main.ts` (NODE_BIN, e.g. Node 22) on the practice set
// and every extra set, and compare its html.json with the reference HTML case by case.
// usage: NODE_BIN=path/to/node node tools/check-main.mjs [extra-sets-dir=../sets2]
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const KIT = process.env.KIT ?? '../kit3/markdown-render-speed-02-kit';
const extra = process.argv[2] ?? '../sets2';
const sets = [[join(KIT, 'practice/input'), join(KIT, 'practice/reference/expected.json'), 'practice']];
if (existsSync(extra)) for (const d of readdirSync(extra).sort()) {
  if (existsSync(join(extra, d, 'out/input/cases.json'))) sets.push([join(extra, d, 'out/input'), join(extra, d, 'out/reference/expected.json'), d]);
}
const out = mkdtempSync(join(tmpdir(), 'mdcheck-'));
let ok = true, nCases = 0;
for (const [inp, ref, name] of sets) {
  const p = spawnSync(process.env.NODE_BIN || process.execPath, ['main.ts'], { env: { ...process.env, MAKEFUN_INPUT_DIR: inp, MAKEFUN_OUTPUT_DIR: out }, encoding: 'utf8' });
  if (p.status !== 0) { console.log(`${name}: main.ts exited ${p.status}\n${p.stderr}`); ok = false; continue; }
  const got = JSON.parse(readFileSync(join(out, 'html.json'), 'utf8'));
  const exp = JSON.parse(readFileSync(ref, 'utf8')).cases;
  const bad = exp.filter((c, i) => got[i] !== c.html).length + Math.abs(got.length - exp.length);
  nCases += exp.length;
  if (bad) { console.log(`${name}: ${bad} mismatches`); ok = false; }
}
console.log(ok ? `main.ts ALL IDENTICAL: ${sets.length} sets, ${nCases} cases` : 'MISMATCHES');
process.exit(ok ? 0 : 1);
