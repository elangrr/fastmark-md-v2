// Per-line self ticks for one function in a .cpuprofile. usage: node tools/prof-lines.mjs dir fnName
import { readFileSync, readdirSync } from 'node:fs';
const [dir, fn] = process.argv.slice(2);
const f = readdirSync(dir).filter((x) => x.endsWith('.cpuprofile'))[0];
const p = JSON.parse(readFileSync(dir + '/' + f, 'utf8'));
const lines = new Map();
for (const n of p.nodes) if (n.callFrame.functionName === fn && n.positionTicks) for (const t of n.positionTicks) lines.set(t.line, (lines.get(t.line) || 0) + t.ticks);
for (const [l, t] of [...lines].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(String(t).padStart(6), l);
