// Experiment driver: apply V8 flags from $FLAGS (space separated), then run main.ts.
import { setFlagsFromString } from 'node:v8';
for (const f of (process.env.FLAGS || '').split(' ').filter(Boolean)) setFlagsFromString(f);
await import('../main.ts');
