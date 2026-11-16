// Summarise a .cpuprofile: self time per function (top 30).
import { readFileSync, readdirSync } from 'node:fs';
const dir = process.argv[2];
const f = readdirSync(dir).filter((x) => x.endsWith('.cpuprofile'))[0];
const p = JSON.parse(readFileSync(dir + '/' + f, 'utf8'));
const self = new Map();
const dt = p.timeDeltas; const byId = new Map(p.nodes.map((n) => [n.id, n]));
const t = new Map();
for (let i = 0; i < p.samples.length; i++) t.set(p.samples[i], (t.get(p.samples[i]) || 0) + (dt[i] || 0));
for (const [id, us] of t) { const n = byId.get(id); const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber}`; self.set(k, (self.get(k) || 0) + us); }
const tot = [...self.values()].reduce((a, b) => a + b, 0);
console.log('total ms', (tot / 1000).toFixed(0));
for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log((v / 1000).toFixed(1).padStart(8), k);
