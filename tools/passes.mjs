// In-process timing of repeated passes over a set: shows cold (JIT warm-up) vs warm cost.
import { readFileSync } from 'node:fs';
import { parse } from '../parse.js';
const KIT = process.env.KIT ?? '../kit3/markdown-render-speed-02-kit';
const cases = JSON.parse(readFileSync(process.argv[2] ?? KIT + '/practice/input/cases.json', 'utf8'));
for (let pass = 0; pass < 4; pass++) {
  const t0 = process.cpuUsage();
  for (const c of cases) parse(c.markdown);
  const t = process.cpuUsage(t0);
  console.log(`pass ${pass}: ${((t.user + t.system) / 1000).toFixed(0)} ms`);
}
