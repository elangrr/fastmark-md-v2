// Random-snippet fuzzer: compares parse() with the kit's vendored marked on generated inputs.
// usage: node tools/fuzz.mjs [count=20000] [seed=1]
import { parse } from '../parse.js';
const KIT = process.env.KIT ?? '../kit3/markdown-render-speed-02-kit';
const { marked } = await import(new URL('../' + KIT + '/baselines/vendor/marked/marked.esm.js', import.meta.url));
const N = +(process.argv[2] ?? 20000);
let seed = +(process.argv[3] ?? 1);
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const atoms = ['*', '**', '_', '__', '~', '~~', '`', '``', '[', ']', '(', ')', '<', '>', '!', '\\', ' ', '  ', '\n', '\n\n', '\t',
  'a', 'foo', 'bar', 'x_y', 'http://e.com', 'https://a.b/c?d=e.', 'www.x.org', 'ftp://f.g', 'http', 'a@b.co', 'mailto:a@b.co', 'xmpp:u@h.io/r',
  '&amp;', '&#35;', '&#x41;', '&', '"', "'", ':', '@', '#', '# ', '- ', '1. ', '> ', '    ', '---', '===', '|', ' | ', '|---|', '[x] ', '[ ] ',
  '<a href="x">', '</a>', '<pre>', '</pre>', '<div>', '<!-- c -->', '[r]', '[r]: /u "t"\n', '![i](/p)', '[l](/u)', 'é', '😀', ' ', '.', ',', '?'];
let bad = 0;
for (let i = 0; i < N; i++) {
  let s = '';
  const len = 1 + Math.floor(rnd() * 25);
  for (let k = 0; k < len; k++) s += atoms[Math.floor(rnd() * atoms.length)];
  let exp, got;
  try { exp = marked.parse(s); } catch (e) { exp = 'ERR'; }
  try { got = parse(s); } catch (e) { got = 'ERR ' + e.message; }
  if (got !== exp) {
    if (++bad <= 5) console.log('MISMATCH', JSON.stringify(s), '\n got', JSON.stringify(got), '\n exp', JSON.stringify(exp));
  }
}
console.log(bad ? `${bad} mismatches of ${N}` : `fuzz ok: ${N} inputs identical`);
