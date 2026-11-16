// Compare parse.js against marked's expected HTML on the practice set and every extra set.
// usage: node tools/compare.mjs [extra-sets-dir=../sets2]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from '../parse.js';

const KIT = process.env.KIT ?? '../kit3/markdown-render-speed-02-kit';
const extra = process.argv[2] ?? '../sets2';
const sets = [[join(KIT, 'practice/input/cases.json'), join(KIT, 'practice/reference/expected.json'), 'practice']];
if (existsSync(extra)) for (const d of readdirSync(extra).sort()) {
  const inp = join(extra, d, 'out/input/cases.json');
  if (existsSync(inp)) sets.push([inp, join(extra, d, 'out/reference/expected.json'), d]);
}
let allOk = true, nCases = 0, nSets = 0;
for (const [inp, ref, name] of sets) {
  const cases = JSON.parse(readFileSync(inp, 'utf8'));
  const exp = JSON.parse(readFileSync(ref, 'utf8')).cases;
  let bad = 0, first = null;
  for (let i = 0; i < cases.length; i++) {
    let got;
    try { got = parse(cases[i].markdown); } catch (e) { got = 'THREW ' + e.stack; }
    if (got !== exp[i].html) {
      bad++;
      if (!first) {
        let k = 0; while (k < got.length && got[k] === exp[i].html[k]) k++;
        first = { id: cases[i].id, at: k, md: cases[i].markdown, got: got.slice(Math.max(0, k - 80), k + 80), exp: exp[i].html.slice(Math.max(0, k - 80), k + 80) };
      }
    }
  }
  nSets++; nCases += cases.length;
  if (bad) {
    allOk = false;
    console.log(`${name}: ${bad} mismatches; first ${first.id} at char ${first.at}`);
    if (process.env.V) console.log('MD:', JSON.stringify(first.md.length > 600 ? '...' : first.md));
    console.log('  got:', JSON.stringify(first.got));
    console.log('  exp:', JSON.stringify(first.exp));
  }
}
console.log(allOk ? `ALL IDENTICAL: ${nSets} sets, ${nCases} cases` : 'MISMATCHES');
process.exit(allOk ? 0 : 1);
