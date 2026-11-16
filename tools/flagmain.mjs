// Experiment driver: apply V8 flags from $FLAGS (space separated) and run the same work as
// main.ts (without main.ts's own flags).
import { setFlagsFromString } from 'node:v8';
import { readFileSync, writeFileSync } from 'node:fs';
for (const f of (process.env.FLAGS || '').split(' ').filter(Boolean)) setFlagsFromString(f);
const { parse } = await import('../parse.js');
const cases = JSON.parse(readFileSync(process.env.MAKEFUN_INPUT_DIR + '/cases.json', 'utf8'));
const html = cases.map((c) => parse(c.markdown));
writeFileSync(process.env.MAKEFUN_OUTPUT_DIR + '/html.json', JSON.stringify(html));
