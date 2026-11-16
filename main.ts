// fastmark driver: render every case of /input/cases.json with parse() and write /output/html.json.
// MAKEFUN_INPUT_DIR / MAKEFUN_OUTPUT_DIR override the directories for local runs.
import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from './parse.js';

const inDir = process.env.MAKEFUN_INPUT_DIR || '/input';
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const cases: { id: string; markdown: string }[] = JSON.parse(readFileSync(inDir + '/cases.json', 'utf8'));
const html: string[] = new Array(cases.length);
for (let i = 0; i < cases.length; i++) html[i] = parse(cases[i].markdown);
writeFileSync(outDir + '/html.json', JSON.stringify(html));
