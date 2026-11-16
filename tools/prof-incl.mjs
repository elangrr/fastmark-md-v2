// Inclusive time per function name (counted once per stack) from a .cpuprofile.
import { readFileSync, readdirSync } from 'node:fs';
const d = process.argv[2];
const p = JSON.parse(readFileSync(d + '/' + readdirSync(d).filter((x) => x.endsWith('.cpuprofile'))[0], 'utf8'));
const byId = new Map(p.nodes.map((n) => [n.id, n]));
const parent = new Map();
for (const n of p.nodes) for (const c of n.children || []) parent.set(c, n.id);
const t = new Map();
for (let i = 0; i < p.samples.length; i++) t.set(p.samples[i], (t.get(p.samples[i]) || 0) + (p.timeDeltas[i] || 0));
const incl = {};
for (const [id, us] of t) {
  const seen = new Set();
  for (let x = id; x !== undefined; x = parent.get(x)) {
    const n = byId.get(x); const k = n.callFrame.functionName || '(anon)';
    if (!seen.has(k)) { seen.add(k); incl[k] = (incl[k] || 0) + us; }
  }
}
for (const [k, v] of Object.entries(incl).sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log((v / 1000).toFixed(0).padStart(6), k.slice(0, 80));
