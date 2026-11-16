// fastmark driver: render every case of /input/cases.json with parse() and write /output/html.json.
// MAKEFUN_INPUT_DIR / MAKEFUN_OUTPUT_DIR override the directories for local runs.
import { readFileSync, writeFileSync } from 'node:fs';
import { setFlagsFromString } from 'node:v8';

// A single cold run renders ~3 MB once: TurboFan's (background) compile CPU costs more than it
// saves here, so stay on the interpreter/baseline tiers. Set before parse.js is loaded.
setFlagsFromString('--no-opt');
const { parse } = await import('./parse.js');

const inDir = process.env.MAKEFUN_INPUT_DIR || '/input';
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const cases: { id: string; markdown: string }[] = JSON.parse(readFileSync(inDir + '/cases.json', 'utf8'));
// Each result is serialised as soon as it is rendered: that flattens its concatenation tree while
// it is still young, so the tree dies in the nursery instead of being copied and promoted until a
// final JSON.stringify. '[' + items.join(',') + ']' is exactly JSON.stringify of the string array.
const items: string[] = new Array(cases.length);
for (let i = 0; i < cases.length; i++) items[i] = JSON.stringify(parse(cases[i].markdown));
writeFileSync(outDir + '/html.json', '[' + items.join(',') + ']');
