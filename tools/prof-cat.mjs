// Self time of a .cpuprofile grouped into regexp / gc / parse.js / main / other.
import { readFileSync, readdirSync } from 'node:fs';
const d = process.argv[2];
const p = JSON.parse(readFileSync(d + '/' + readdirSync(d).filter((x) => x.endsWith('.cpuprofile'))[0], 'utf8'));
const byId = new Map(p.nodes.map((n) => [n.id, n]));
const t = new Map();
for (let i = 0; i < p.samples.length; i++) t.set(p.samples[i], (t.get(p.samples[i]) || 0) + (p.timeDeltas[i] || 0));
const cat = {};
for (const [id, us] of t) {
  const n = byId.get(id); const fn = n.callFrame.functionName; const url = n.callFrame.url;
  const k = fn.startsWith('RegExp:') ? 'regexp' : fn === '(garbage collector)' ? 'gc' : url.endsWith('parse.js') ? 'parse.js' : url.endsWith('main.ts') ? 'main' : 'other';
  cat[k] = (cat[k] || 0) + us;
}
for (const [k, v] of Object.entries(cat).sort((a, b) => b[1] - a[1])) console.log((v / 1000).toFixed(0).padStart(6), k);
