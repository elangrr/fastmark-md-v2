// fastmark: a dependency-free Markdown renderer that returns exactly what marked 18.1.3's
// marked.parse(src) returns with the default options (gfm on, breaks off, pedantic off).
// It follows marked's lexing algorithm (see NOTICE) but renders inline content straight to
// HTML strings instead of building token trees, and avoids marked's option/extension plumbing.

const R = String.raw;
const SHADOW = false;
const BT = '`';

// ---------------------------------------------------------------------------------------------
// Block grammar
// ---------------------------------------------------------------------------------------------
const TAGS = 'address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul';
const HR = R` {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)`;
const HEAD_START = R` {0,3}#{1,6}(?:\s|$)`;
const BQ_START = R` {0,3}>`;
const FENCE_START = R` {0,3}(?:${BT}{3,}(?=[^${BT}\n]*(?:\n|$))|~~~)[^\n]*(?:\n|$)`;
const HTML_START = R` {0,3}(?:<\/?(?:${TAGS})(?: +|\n|\/?>)|<(?:(?:script|pre|style|textarea)(?:[\s>]|$)|!--)|<\?|<![A-Za-z]|<!\[CDATA\[)`;
const TABLE = R` *([^\n ].*)\n {0,3}((?:\| *)?:?-+:? *(?:\| *:?-+:? *)*(?:\| *)?)(?:\n((?:(?! *\n|${HR}|${HEAD_START}|${BQ_START}|(?: {4}| {0,3}\t)[^\n]|${FENCE_START}| {0,3}(?:[*+-]|1[.)])[ \t]|${HTML_START}).*(?:\n|$))*)\n*|$)`;
const para = (list, table) => R`([^\n]+(?:\n(?!${HR}|${HEAD_START}|${BQ_START}|${FENCE_START}|${list}|${HTML_START}|${table}[ \t]+\n)[^\n]+)*)`;

const reNewline = /^(?:[ \t]*(?:\n|$))+/;
const reCode = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
const reFences = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}(?:(?=`)\1`*|(?=~)\1~*) *(?=\n|$)|$)/;
const reHeading = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
const reHr = new RegExp('^' + HR);
const reList = /^( {0,3}(?:[*+-]|\d{1,9}[.)]))([ \t][^\n]*?)?(?:\n|$)/;
const reDef = /^ {0,3}\[((?!\s*\])(?:\\[\s\S]|[^\[\]\\\n]|\n(?![ \t]*\n))+)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)((?:"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\\n]|\n(?!\n))*'|\((?:\\[\s\S]|[^()\\])*\))))? *(?:\n+|$)/;
const reHtml = new RegExp(R`^ {0,3}(?:<(script|pre|style|textarea)[\s>][\s\S]*?(?:<\/\1>[^\n]*\n*|$)|<!--(?:-?>|[\s\S]*?(?:-->|$))[^\n]*(\n+|$)|<\?[\s\S]*?(?:\?>[^\n]*\n*|$)|<![A-Z][\s\S]*?(?:>[^\n]*\n*|$)|<!\[CDATA\[[\s\S]*?(?:\]\]>[^\n]*\n*|$)|<\/?(${TAGS})(?:[ \t]+|\n|\/?>|$)[\s\S]*?(?:(?:\n[ \t]*)+\n|$)|<(?!(?:script|pre|style|textarea)(?![a-z0-9-]))([a-z][a-z0-9-]*)(?: +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>${BT}]+)?)*? *\/?>(?=[ \t]*(?:\n|$))[\s\S]*?(?:(?:\n[ \t]*)+\n|$)|<\/[a-z][a-z0-9-]*\s*>(?=[ \t]*(?:\n|$))[\s\S]*?(?:(?:\n[ \t]*)+\n|$))`, 'i');
const reTable = new RegExp('^' + TABLE);
const SETEXT_STOP = R` {0,3}(?:[*+-]|\d{1,9}[.)]) | {0,3}(?:${BT}{3,}|~{3,})| {0,3}>| {0,3}#{1,6}(?:\s|$)`;
const reLheading = new RegExp(R`^(?!${SETEXT_STOP.replace(' {0,3}>', '(?: {4}| {0,3}\\t)| {0,3}>')}| {0,3}<[^\n>]+>\n| {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n)((?:.|\n(?!\s*?\n|${SETEXT_STOP}|${HR.replace('3}((', '3}(?:(')}| {0,3}<[^\n>]+>\n| {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n))+?)\n {0,3}(=+|-+)[ \t]*(?:\n+|$)`);
const reParagraph = new RegExp('^' + para(R` {0,3}(?:[*+-]|1[.)])[ \t]+[^ \t\n]`, TABLE + '|'));
const reBlockquote = new RegExp(R`^( {0,3}> ?(?:(?![ \t]*(?:\n|$))(${para(R` {0,3}(?:[*+-]|\d{1,9}[.)])(?:[ \t]|\n|$)`, '')})|[^\n]*)(?:\n|$))+`);
const reText = /^[^\n]+/;

// list helpers, one regex per indentation class (marked clamps the indent to 0..3)
const indentRes = (mk) => [0, 1, 2, 3].map(mk);
const reNextBullet = indentRes((n) => new RegExp(`^ {0,${n}}(?:[*+-]|\\d{1,9}[.)])((?:[ \t][^\\n]*)?(?:\\n|$))`));
const reHrIn = indentRes((n) => new RegExp(`^ {0,${n}}((?:-[ \t]*){3,}|(?:_[ \t]*){3,}|(?:\\*[ \t]*){3,})(?:\\n+|$)`));
const reFenceIn = indentRes((n) => new RegExp(`^ {0,${n}}(?:${BT}${BT}${BT}|~~~)`));
const reHeadIn = indentRes((n) => new RegExp(`^ {0,${n}}#{1,6}(?:\\s|$)`));
const reHtmlIn = indentRes((n) => new RegExp(`^ {0,${n}}(?:</?(?:${TAGS})(?: +|$|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)`, 'i'));
const reBqIn = indentRes((n) => new RegExp(`^ {0,${n}}>`));
// list item regexes for the five bullet kinds, built once at load
const ITEM_RES = {};
for (const bull of ['\\-', '\\*', '\\+', '\\d{1,9}\\.', '\\d{1,9}\\)']) ITEM_RES[bull] = new RegExp(`^( {0,3}${bull})((?:[\t ][^\\n]*)?(?:\\n|$))`);

// ---------------------------------------------------------------------------------------------
// Inline grammar
// ---------------------------------------------------------------------------------------------
const reEscape = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
const reTag = /^<!--(?:-?>|[\s\S]*?-->)|^<\/[a-zA-Z][a-zA-Z0-9-]*\s*>|^<[a-zA-Z][a-zA-Z0-9-]*(?:\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?)*?\s*\/?>|^<\?[\s\S]*?\?>|^<![a-zA-Z]+\s[\s\S]*?>|^<!\[CDATA\[[\s\S]*?\]\]>/;
const LABEL = R`(?:\[(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|${BT}+(?!${BT})[^${BT}]*?${BT}+(?!${BT})|${BT}${BT}+(?=\])|[^\[\]\\${BT}])*?`;
const REF = R`(?!\s*\])(?:\\[\s\S]|[^\[\]\\\n]|\n(?![ \t]*\n))+`;
const reLink = new RegExp(R`^!?\[(${LABEL})\]\([ \t\n]*(<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]+|(?=\)))(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)("(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|\((?:\\[\s\S]|[^)\\])*\)))?[ \t\n]*\)`);
const reRefLink = new RegExp(R`^!?\[(${LABEL})\]\[(${REF})\]`);
const reNoLink = new RegExp(R`^!?\[(${REF})\](?:\[\])?`);
const reRefSearch = new RegExp(R`!?\[((?:[^\[\]\\${BT}]*(?:\[(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|${BT}+(?!${BT})[^${BT}]*?${BT}+(?!${BT})|${BT}${BT}+(?=\]))){0,999}?[^\[\]\\${BT}]*?)\]\[((?!\s*\])(?:\\[\s\S]|[^\[\]\\]){1,999})\]|!?\[((?!\s*\])(?:\\[\s\S]|[^\[\]\\]){1,999})\](?:\[\])?(?!\()`, 'g');
const reBlockSkip = /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)|(?<!`)()(?<b>`+)[^`]+\k<b>(?!`)|<(?! )[^<>]*?>/g;
const reAnyPunctOutsideCode = /(`+)(?:[^`]|[^`][\s\S]*?[^`])\1(?!`)|`+|\\([\p{P}\p{S}])/gu;
const reAnyPunct = /\\([\p{P}\p{S}])/gu;
const reCodespan = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
const reBr = /^( {2,}|\\)\n(?!\s*$)[ \t]*/;
const reAutolink = /^<([a-zA-Z][a-zA-Z0-9+.-]{1,31}:[^\s\x00-\x1f<>]*|[a-zA-Z0-9.!#$%&'*+/=?_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_]))>/;
const EMAIL = R`[A-Za-z0-9._+-]+@[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])`;
const reUrl = new RegExp(R`^(?:mailto:${EMAIL}|xmpp:${EMAIL}(?:\/[A-Za-z0-9@.]+)?)|^((?:[hH][tT][tT][pP][sS]?|[fF][tT][pP]):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^${EMAIL.replace('@', '(@)')}`);
const reBackpedal = /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/;
const EMAILCH = R`a-zA-Z0-9.!#$%&'*+\/=?_${BT}{\|}~-`;
const reInlineText = new RegExp(R`^(?:[^a-zA-Z0-9](?=(?:mailto|xmpp):)|(${BT}+|~+|[^${BT}~])(?:(?=[${BT}~])|(?= {2,}\n)|(?=[${EMAILCH}]+@)|[\s\S]*?(?:(?=[\\<!\[${BT}*~_]|\b_|[hH][tT][tT][pP][sS]?|[fF][tT][pP]:\/\/|(?<![^\s*_~(])www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9](?=(?:mailto|xmpp):)|[^${EMAILCH}](?=[${EMAILCH}]+@))))`);
const P_ = R`[\p{P}\p{S}]`;
const PS = R`[\s\p{P}\p{S}]`;
const NPS = R`[^\s\p{P}\p{S}]`;
const reEmLeft = new RegExp(R`^(?:\*+(?:((?!\*)(?!~)${P_})|([^\s*]))?)|^_+(?:((?!_)(?!~)${P_})|([^\s_]))?`, 'u');
const reEmRightAst = new RegExp(R`^[^_*]*?__[^_*]*?\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\*)(?!~)${P_}(\*+)(?=[\s]|$)|(?:${NPS}|~)(\*+)(?!\*)(?=(?!~)${PS}|$)|(?!\*)(?!~)${PS}(\*+)(?=(?:${NPS}|~))|[\s](\*+)(?!\*)(?=(?!~)${P_})|(?!\*)(?!~)${P_}(\*+)(?!\*)(?=(?!~)${P_})|(?:${NPS}|~)(\*+)(?=(?:${NPS}|~))`, 'gu');
const reEmRightUnd = new RegExp(R`^[^_*]*?\*\*[^_*]*?_[^_*]*?(?=\*\*)|[^_]+(?=[^_])|(?!_)${P_}(_+)(?=[\s]|$)|${NPS}(_+)(?!_)(?=${PS}|$)|(?!_)${PS}(_+)(?=${NPS})|[\s](_+)(?!_)(?=${P_})|(?!_)${P_}(_+)(?!_)(?=${P_})`, 'gu');
const reDelLeft = new RegExp(R`^~~?(?:((?!~)${P_})|[^\s~])`, 'u');
const reDelRight = new RegExp(R`^[^~]+(?=[^~])|(?!~)${P_}(~~?)(?=[\s]|$)|${NPS}(~~?)(?!~)(?=${PS}|$)|(?!~)${PS}(~~?)(?=${NPS})|[\s](~~?)(?!~)(?=${P_})|(?!~)${P_}(~~?)(?!~)(?=${P_})|${NPS}(~~?)(?=${NPS})`, 'gu');
const rePunct = new RegExp(R`^((?![*_])${PS})`, 'u');
const reAlnum = /[\p{L}\p{N}]/u;

// ---------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escCh = (c) => ESC[c];
const reEscAllTest = /[&<>"']/;
const reEscAll = /[&<>"']/g;
const reEscSoftTest = /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/;
const reEscSoft = /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g;
function escAll(s) { return reEscAllTest.test(s) ? s.replace(reEscAll, escCh) : s; }
function escSoft(s) { return reEscSoftTest.test(s) ? s.replace(reEscSoft, escCh) : s; }

const reNumRef = /&#(?:(\d{1,7})|[Xx]([A-Fa-f0-9]{1,6}));/;
const reNumRefOrAmp = /&#(?:(\d{1,7})|[Xx]([A-Fa-f0-9]{1,6}));|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g;
function numRef(m, dec, hex) {
  if (dec === undefined && hex === undefined) return '&amp;';
  const c = dec === undefined ? parseInt(hex, 16) : parseInt(dec, 10);
  if (c === 0 || c > 1114111 || (c >= 55296 && c <= 57343)) return '\uFFFD';
  return c === 38 ? '&amp;' : String.fromCodePoint(c);
}
function decodeRefs(s) { return reNumRef.test(s) ? s.replace(reNumRefOrAmp, numRef) : s; }

function safeUri(s) {
  try { return encodeURI(s).replace(/%25/g, '%'); } catch { return null; }
}

// strip a run of `ch` from the end of s (marked's rtrim)
function rtrimCh(s, ch) {
  let n = s.length;
  while (n > 0 && s[n - 1] === ch) n--;
  return s.slice(0, n);
}

// drop trailing blank lines unless there are at most one
function trimBlankTail(s) {
  const lines = s.split('\n');
  let i = lines.length - 1;
  while (i >= 0 && /^[ \t]*$/.test(lines[i])) i--;
  return lines.length - i <= 2 ? s : lines.slice(0, i + 1).join('\n');
}

function normLabel(s) {
  return s.trim().replace(/\s+/g, ' ').toLowerCase().toUpperCase().toLowerCase();
}

// index of the unbalanced closing bracket, -1 if none, -2 if unclosed
function findClose(s, open, close) {
  if (s.indexOf(open) === -1 && s.indexOf(close) === -1) return -1;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') i++;
    else if (c === open) depth++;
    else if (c === close && --depth < 0) return i;
  }
  return depth > 0 ? -2 : -1;
}

function expandTabs(s, col) {
  let out = '';
  for (const ch of s) {
    if (ch === '\t') { const w = 4 - (col % 4); out += ' '.repeat(w); col += w; }
    else { out += ch; col++; }
  }
  return out;
}

// /\n[ \t]*\n[ \t]*$/ as a backward scan
function endsWithBlankLine(s) {
  let i = s.length - 1;
  while (i >= 0 && (s.charCodeAt(i) === 32 || s.charCodeAt(i) === 9)) i--;
  if (i < 0 || s.charCodeAt(i) !== 10) return false;
  i--;
  while (i >= 0 && (s.charCodeAt(i) === 32 || s.charCodeAt(i) === 9)) i--;
  return i >= 0 && s.charCodeAt(i) === 10;
}

function lineOf(s) {
  const i = s.indexOf('\n');
  return i < 0 ? s : s.slice(0, i);
}

// expand tabs in the leading run of spaces/tabs only (no-op when there is no tab there)
function leadTabs(s, col) {
  let i = 0, tab = false;
  for (; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 9) tab = true;
    else if (c !== 32) break;
  }
  return tab ? expandTabs(s.slice(0, i), col) + s.slice(i) : s;
}

function splitCells(row, count) {
  const marked = row.replace(/\|/g, (m, off, str) => {
    let esc = false, p = off;
    while (--p >= 0 && str[p] === '\\') esc = !esc;
    return esc ? '|' : ' |';
  });
  const cells = marked.split(/ \|/);
  if (!cells[0].trim()) cells.shift();
  if (cells.length > 0 && !cells[cells.length - 1].trim()) cells.pop();
  if (count) {
    if (cells.length > count) cells.splice(count);
    else while (cells.length < count) cells.push('');
  }
  for (let i = 0; i < cells.length; i++) cells[i] = cells[i].trim().replace(/\\\|/g, '|');
  return cells;
}

// ---------------------------------------------------------------------------------------------
// Per-parse state (reset on every call)
// ---------------------------------------------------------------------------------------------
let links, queue, top, inLink, inRawBlock, linkEmitted, parenPossible;

function enqueue(src) {
  const q = { src, html: '', pre: '' };
  queue.push(q);
  return q;
}

// ---------------------------------------------------------------------------------------------
// Block lexer
// ---------------------------------------------------------------------------------------------
function blockTokens(src, toks, lazy) {
  while (src) {
    const c0 = src.charCodeAt(0);
    let m, tok, last;
    if (c0 === 10 || c0 === 32 || c0 === 9) {
      m = reNewline.exec(src);
      if (m && m[0].length > 0) {
        src = src.substring(m[0].length);
        last = toks[toks.length - 1];
        if (m[0].length === 1 && last !== undefined) last.raw += '\n';
        else toks.push({ type: 'space', raw: m[0] });
        continue;
      }
      if ((tok = indentedCode(src))) {
        src = src.substring(tok.raw.length);
        last = toks[toks.length - 1];
        if (last !== undefined && (last.type === 'paragraph' || last.type === 'text')) {
          last.raw += (last.raw.endsWith('\n') ? '' : '\n') + tok.raw;
          last.text += '\n' + tok.text;
          queue[queue.length - 1].src = last.text;
        } else toks.push(tok);
        continue;
      }
    }
    let j = 0;
    while (j < 3 && src.charCodeAt(j) === 32) j++;
    const c = src.charCodeAt(j);
    if (c === 96 || c === 126) { if ((tok = fences(src))) { src = src.substring(tok.raw.length); toks.push(tok); continue; } }
    if (c === 35) { if ((tok = heading(src))) { src = src.substring(tok.raw.length); toks.push(tok); continue; } }
    if (c === 45 || c === 95 || c === 42) {
      if ((m = reHr.exec(src))) { tok = { type: 'hr', raw: rtrimCh(m[0], '\n') }; src = src.substring(tok.raw.length); toks.push(tok); continue; }
    }
    if (c === 62) { if ((tok = blockquote(src))) { src = src.substring(tok.raw.length); toks.push(tok); continue; } }
    if (c === 42 || c === 43 || c === 45 || (c >= 48 && c <= 57)) { if ((tok = list(src))) { src = src.substring(tok.raw.length); toks.push(tok); continue; } }
    if (c === 60) {
      if ((m = reHtml.exec(src))) {
        const raw = trimBlankTail(m[0]);
        toks.push({ type: 'html', raw, text: raw });
        src = src.substring(raw.length);
        continue;
      }
    }
    if (c === 91) {
      if ((tok = def(src))) {
        src = src.substring(tok.raw.length);
        last = toks[toks.length - 1];
        if (last !== undefined && (last.type === 'paragraph' || last.type === 'text')) {
          last.raw += (last.raw.endsWith('\n') ? '' : '\n') + tok.raw;
          last.text += '\n' + tok.raw;
          queue[queue.length - 1].src = last.text;
        } else {
          if (!links[tok.tag]) links[tok.tag] = { href: tok.href, title: tok.title };
          toks.push(tok);
        }
        continue;
      }
    }
    if ((tok = table(src))) { src = src.substring(tok.raw.length); toks.push(tok); continue; }
    if (maybeSetext(src) && (m = reLheading.exec(src))) {
      const text = m[1].trim();
      tok = { type: 'heading', raw: rtrimCh(m[0], '\n'), depth: m[2].charAt(0) === '=' ? 1 : 2, q: enqueue(text) };
      src = src.substring(tok.raw.length);
      toks.push(tok);
      continue;
    }
    if (top && (m = reParagraph.exec(src))) {
      const t1 = m[1];
      const text = t1.charCodeAt(t1.length - 1) === 10 ? t1.slice(0, -1) : t1;
      tok = { type: 'paragraph', raw: m[0], text, q: enqueue(text) };
      last = toks[toks.length - 1];
      if (lazy && last !== undefined && last.type === 'paragraph') {
        last.raw += (last.raw.endsWith('\n') ? '' : '\n') + tok.raw;
        last.text += '\n' + tok.text;
        queue.pop();
        queue[queue.length - 1].src = last.text;
      } else toks.push(tok);
      lazy = false;
      src = src.substring(tok.raw.length);
      continue;
    }
    if ((m = reText.exec(src))) {
      tok = { type: 'text', raw: m[0], text: m[0], q: enqueue(m[0]) };
      src = src.substring(tok.raw.length);
      last = toks[toks.length - 1];
      if (last !== undefined && last.type === 'text') {
        last.raw += (last.raw.endsWith('\n') ? '' : '\n') + tok.raw;
        last.text += '\n' + tok.text;
        queue.pop();
        queue[queue.length - 1].src = last.text;
      } else toks.push(tok);
      continue;
    }
    if (src) throw new Error('Infinite loop on byte: ' + src.charCodeAt(0));
  }
  top = true;
  return toks;
}

// Necessary condition for a setext heading: before the first blank line, some line after the
// first starts with at most 3 spaces and then '=' or '-'.
function maybeSetext(s) {
  let i = s.indexOf('\n');
  while (i !== -1) {
    let j = i + 1;
    while (s.charCodeAt(j) === 32) j++;
    const c = s.charCodeAt(j);
    if ((c === 61 || c === 45) && j - i - 1 <= 3) return true;
    let k = j;
    while (s.charCodeAt(k) === 32 || s.charCodeAt(k) === 9) k++;
    if (k >= s.length || s.charCodeAt(k) === 10) return false;
    i = s.indexOf('\n', k);
  }
  return false;
}

function indentedCode(src) {
  const m = reCode.exec(src);
  if (!m) return undefined;
  const raw = trimBlankTail(m[0]);
  return { type: 'code', raw, lang: undefined, text: raw.replace(/^(?: {0,3}\t| {1,4})/gm, '') };
}

function fences(src) {
  const m = reFences.exec(src);
  if (!m) return undefined;
  const raw = m[0];
  let text = m[3] || '';
  const ind = /^(\s+)(?:```)/.exec(raw);
  if (ind !== null) {
    const n = ind[1].length;
    text = text.split('\n').map((line) => {
      const sp = /^\s+/.exec(line);
      return sp === null ? line : line.slice(Math.min(sp[0].length, n));
    }).join('\n');
  }
  return { type: 'code', raw, lang: m[2] ? m[2].trim().replace(reAnyPunct, '$1') : m[2], text };
}

function heading(src) {
  const m = reHeading.exec(src);
  if (!m) return undefined;
  let text = m[2].trim();
  if (text.endsWith('#')) {
    const t = rtrimCh(text, '#');
    if (!t || /[ \t]$/.test(t)) text = t.trim();
  }
  return { type: 'heading', raw: rtrimCh(m[0], '\n'), depth: m[1].length, q: enqueue(text) };
}

function def(src) {
  const m = reDef.exec(src);
  if (!m) return undefined;
  if (m[2].charCodeAt(0) !== 60 && findClose(m[2], '(', ')') !== -1) return undefined;
  return {
    type: 'def',
    tag: normLabel(m[1]),
    raw: rtrimCh(m[0], '\n'),
    href: m[2] ? m[2].replace(/^<(.*)>$/, '$1').replace(reAnyPunct, '$1') : '',
    title: m[3] ? m[3].substring(1, m[3].length - 1).replace(reAnyPunct, '$1') : m[3],
  };
}

function table(src) {
  const m = reTable.exec(src);
  if (!m || !/[:|]/.test(m[2])) return undefined;
  const head = splitCells(m[1]);
  const aligns = m[2].replace(/^\||\| *$/g, '').split('|');
  const rows = m[3] && m[3].trim() ? m[3].replace(/\n[ \t]*$/, '').split('\n') : [];
  if (head.length !== aligns.length) return undefined;
  const align = aligns.map((a) => (/^ *-+: *$/.test(a) ? 'right' : /^ *:-+: *$/.test(a) ? 'center' : /^ *:-+ *$/.test(a) ? 'left' : null));
  const header = head.map((h) => enqueue(h));
  const body = rows.map((r) => splitCells(r, head.length).map((cell) => enqueue(cell)));
  return { type: 'table', raw: rtrimCh(m[0], '\n'), align, header, rows: body };
}

function blockquote(src) {
  const m = reBlockquote.exec(src);
  if (!m) return undefined;
  let lines = rtrimCh(m[0], '\n').split('\n');
  let raw = '', text = '';
  const toks = [];
  while (lines.length > 0) {
    let inQuote = false, p;
    const cur = [];
    for (p = 0; p < lines.length; p++) {
      if (/^ {0,3}>/.test(lines[p])) { cur.push(lines[p]); inQuote = true; }
      else if (!inQuote) cur.push(lines[p]);
      else break;
    }
    lines = lines.slice(p);
    const chunk = cur.join('\n');
    const inner = chunk
      .replace(/^( {0,3}>)([ \t]+)/gm, (_, mk, ws) => mk + expandTabs(ws, mk.length))
      .replace(/\n {0,3}((?:=+|-+)[ \t]*)(?=\n|$)/g, '\n    $1')
      .replace(/^ {0,3}>[ \t]?/gm, '');
    raw = raw ? `${raw}\n${chunk}` : chunk;
    text = text ? `${text}\n${inner}` : inner;
    const saved = top;
    top = true;
    blockTokens(inner, toks, true);
    top = saved;
    if (lines.length === 0) break;
    const last = toks[toks.length - 1];
    const lt = last && last.type;
    if (lt === 'code' || lt === 'heading' || lt === 'hr' || lt === 'html' || lt === 'table') break;
    if (lt === 'blockquote') {
      const joined = last.raw + '\n' + lines.join('\n').replace(/^ {0,3}>[ \t]?/gm, '');
      const redo = blockquote(joined);
      toks[toks.length - 1] = redo;
      const rest = joined.substring(redo.raw.length).replace(/^\n/, '');
      const nRest = rest ? rest.split('\n').length : 0;
      const used = nRest ? lines.slice(0, -nRest) : lines;
      if (used.length > 0) raw = `${raw}\n${used.join('\n')}`;
      text = text.substring(0, text.length - last.text.length) + redo.text;
      lines = lines.slice(used.length);
      if (lines.length > 0 && /^ {0,3}>/.test(lines[0])) continue;
      break;
    } else if (lt === 'list') {
      const joined = last.raw + '\n' + lines.join('\n');
      const redo = list(joined);
      toks[toks.length - 1] = redo;
      const n = redo.raw.length > last.raw.length ? joined.slice(last.raw.length + 1, redo.raw.length).split('\n').length : 0;
      if (n > 0) {
        const more = lines.slice(0, n).join('\n');
        raw = `${raw}\n${more}`;
        text = `${text}\n${more}`;
      }
      lines = lines.slice(n);
      continue;
    }
  }
  return { type: 'blockquote', raw, tokens: toks, text };
}

// Would `s` start a fence, heading, html block or hr (and, when `all`, a blockquote or another
// bullet) indented by at most k spaces? Dispatches on the first non-space char so only the one
// regex that char could start is run.
function interrupts(s, k, all) {
  let sp = 0;
  while (sp < s.length && s.charCodeAt(sp) === 32) sp++;
  if (sp > k) return false;
  switch (s.charCodeAt(sp)) {
    case 96: case 126: return reFenceIn[k].test(s);
    case 35: return reHeadIn[k].test(s);
    case 60: return reHtmlIn[k].test(s);
    case 62: return all;
    case 95: return reHrIn[k].test(s);
    case 42: case 45: return (all && reNextBullet[k].test(s)) || reHrIn[k].test(s);
    case 43: case 48: case 49: case 50: case 51: case 52: case 53: case 54: case 55: case 56: case 57:
      return all && reNextBullet[k].test(s);
    default: return false;
  }
}

function list(src) {
  let m = reList.exec(src);
  if (!m) return undefined;
  const orig = src;
  let bull = m[1].trim();
  const ordered = bull.length > 1;
  const lst = { type: 'list', raw: '', ordered, start: ordered ? +bull.slice(0, -1) : '', loose: false, items: [] };
  bull = ordered ? `\\d{1,9}\\${bull.slice(-1)}` : `\\${bull}`;
  const reItem = ITEM_RES[bull];
  let blankEnded = false;
  while (src) {
    let endEarly = false, body = '';
    if (!(m = reItem.exec(src)) || reHr.test(src)) break;
    const startAt = orig.length - src.length;
    src = src.substring(m[0].length);
    const firstLine = lineOf(m[2]);
    const markLen = m[1].length;
    let line = leadTabs(firstLine, markLen);
    let next = lineOf(src);
    let blank = !line.trim();
    let indent = 0;
    if (blank) indent = markLen + 1;
    else {
      indent = line.search(/[^ ]/);
      indent = indent > 4 ? 1 : indent;
      body = line.slice(indent);
      indent += markLen;
    }
    if (blank && /^[ \t]*$/.test(next)) {
      src = src.substring(next.length + 1);
      endEarly = true;
    }
    if (!endEarly) {
      const k = Math.max(0, Math.min(3, indent - 1));
      while (src) {
        const rawLine = lineOf(src);
        next = rawLine;
        const expanded = leadTabs(next, 0);
        if (interrupts(next, k, true)) break;
        if (expanded.search(/[^ ]/) >= indent || !next.trim()) {
          body += '\n' + expanded.slice(indent);
        } else {
          if (blank || line.replace(/\t/g, '    ').search(/[^ ]/) >= 4 || interrupts(line, k, false)) break;
          const setext = /^ {0,3}(?:=+|-+) *$/.test(next) && reLheading.test(`${line}\n${next}`);
          body += '\n' + (setext ? `    ${expanded.replace(/^ {0,3}/, '')}` : next);
        }
        blank = !next.trim();
        src = src.substring(rawLine.length + 1);
        line = expanded.slice(indent);
      }
    }
    const itemRaw = orig.slice(startAt, orig.length - src.length);
    if (!lst.loose) {
      if (blankEnded) lst.loose = true;
      else if (endsWithBlankLine(itemRaw)) blankEnded = true;
    }
    lst.items.push({ raw: itemRaw, task: /^\[[ xX]\][ \t]+\S/.test(body), checked: undefined, text: body, tokens: null });
  }
  const lastItem = lst.items[lst.items.length - 1];
  if (!lastItem) return undefined;
  lastItem.raw = lastItem.raw.trimEnd();
  lastItem.text = lastItem.text.trimEnd();
  lst.raw = orig.slice(0, orig.length - src.length).trimEnd();
  for (const it of lst.items) {
    top = false;
    it.tokens = blockTokens(it.text, []);
    if (!lst.loose) {
      let loose = false;
      for (const t of it.tokens) if (t.type === 'space' && /\n.*\n/.test(t.raw)) { loose = true; break; }
      lst.loose = loose;
    }
  }
  for (const it of lst.items) {
    const first = it.tokens[0];
    if (it.task && first !== undefined && (first.type === 'text' || first.type === 'paragraph')) {
      it.text = it.text.replace(/^\[[ xX]\][ \t]+/, '');
      first.raw = first.raw.replace(/^\[[ xX]\][ \t]+/, '');
      first.text = first.text.replace(/^\[[ xX]\][ \t]+/, '');
      for (let g = queue.length - 1; g >= 0; g--) {
        if (/^\[[ xX]\][ \t]+\S/.test(queue[g].src)) { queue[g].src = queue[g].src.replace(/^\[[ xX]\][ \t]+/, ''); break; }
      }
      const cb = /\[[ xX]\]/.exec(it.raw);
      if (cb) {
        const checked = cb[0] !== '[ ]';
        it.checked = checked;
        const html = checked ? '<input checked="" disabled="" type="checkbox"> ' : '<input disabled="" type="checkbox"> ';
        if (lst.loose) {
          if (first.q) first.q.pre = html + first.q.pre;
          else it.tokens.unshift({ type: 'checkbox', html });
        } else it.tokens.unshift({ type: 'checkbox', html });
      }
    } else if (it.task) it.task = false;
  }
  if (lst.loose) {
    for (const it of lst.items) for (const t of it.tokens) if (t.type === 'text') t.type = 'paragraph';
  }
  return lst;
}

// ---------------------------------------------------------------------------------------------
// Inline lexer + renderer. mode 0 renders HTML, mode 1 renders the plain text used for image alt.
// ---------------------------------------------------------------------------------------------
// Start of the last maximal run of `ch` in s whose preceding char is not a space, tab, newline,
// CR or form feed (a run at index 0 counts as preceded by a newline); -1 if none.
function lastRunStart(s, ch) {
  let i = s.lastIndexOf(ch);
  while (i !== -1) {
    while (i > 0 && s[i - 1] === ch) i--;
    if (i === 0) return -1;
    const b = s.charCodeAt(i - 1);
    if (b !== 32 && b !== 9 && b !== 10 && b !== 13 && b !== 12) return i;
    i = s.lastIndexOf(ch, i - 2);
  }
  return -1;
}

function lastCloser(s) {
  return { ast: lastRunStart(s, '*'), und: lastRunStart(s, '_'), del: lastRunStart(s, '~') };
}

function inlineTokens(src, mode) {
  const saved = parenPossible;
  parenPossible = saved && src.includes(')');
  const out = lexInline(src, mode);
  parenPossible = saved;
  return out;
}

function linkInText(s) {
  if (!s.includes('[')) return false;
  for (const mm of s.matchAll(reBlockSkip)) {
    if (reLink.test(mm[0]) && s.charAt(mm.index - 1) !== '!') return true;
  }
  for (const mm of s.matchAll(reRefSearch)) {
    const t = mm[0];
    const b = t.lastIndexOf('[');
    if (!(t.charAt(0) === '!' || !Object.hasOwn(links, normLabel(t.slice(b + 1, -1)))) && !(b > 1 && linkInText(t.slice(1, b - 1)))) return true;
  }
  return false;
}

function maskRef(r) {
  const b = r.lastIndexOf('[');
  if (!Object.hasOwn(links, normLabel(r.slice(b + 1, -1)))) return r;
  if (b > 1 && r.charAt(0) !== '!') {
    const inner = r.slice(1, b - 1);
    if (linkInText(inner)) return '[' + inner.replace(reRefSearch, maskRef) + '][' + 'a'.repeat(r.length - b - 2) + ']';
  }
  return '[' + 'a'.repeat(r.length - 2) + ']';
}

function mask(src) {
  let t = src;
  const br = src.includes('['), bt = src.includes('`');
  if (br) t = t.replace(reRefSearch, maskRef);
  if (bt || src.includes('\\')) t = t.replace(reAnyPunctOutsideCode, (m, ticks, esc) => (esc ? '+'.repeat(m.length) : ticks ? ticks + m.slice(ticks.length, -ticks.length).replace(/`/g, '+') + ticks : m));
  if (br || bt || src.includes('<')) t = t.replace(reBlockSkip, (m) => '[' + 'a'.repeat(m.length - 2) + ']');
  return t;
}

// does the link label contain an html tag / autolink that runs past its end?
function labelHasOpenTag(src, label, off) {
  if (!label.includes('<')) return false;
  for (let i = 0; i < label.length; i++) {
    const c = label[i];
    if (c === '\\') { i++; continue; }
    if (c === '`') {
      const mm = reCodespan.exec(label.slice(i));
      if (mm) { i += mm[0].length - 1; continue; }
    }
    if (c !== '<') continue;
    const rest = src.slice(off + i);
    const mm = reTag.exec(rest) || reAutolink.exec(rest);
    if (mm) {
      if (mm[0].length > label.length - i) return true;
      i += mm[0].length - 1;
    }
  }
  return false;
}

// marked's outputLink: returns rendered html, or null when a nested link forbids this one
function outLink(m, href, title, mode) {
  const text = m[1].replace(/\\([\[\]])/g, '$1');
  const image = m[0].charAt(0) === '!';
  const pLink = inLink, pEmit = linkEmitted, pRaw = inRawBlock;
  inLink = true;
  linkEmitted = false;
  const inner = inlineTokens(text, image ? 1 : mode);
  const emitted = linkEmitted;
  linkEmitted = pEmit;
  inLink = pLink;
  if (!image) {
    if (emitted) { inRawBlock = pRaw; return null; }
    linkEmitted = true;
  }
  title = title || null;
  if (image) {
    if (mode === 1) return inner;
    const u = safeUri(href);
    if (u === null) return escSoft(inner);
    let h = `<img src="${escSoft(u)}" alt="${escSoft(inner)}"`;
    if (title) h += ` title="${escSoft(title)}"`;
    return h + '>';
  }
  if (mode === 1) return inner;
  const u = safeUri(href);
  if (u === null) return inner;
  let h = '<a href="' + escSoft(u) + '"';
  if (title) h += ' title="' + escSoft(title) + '"';
  return h + '>' + inner + '</a>';
}

function autoLinkHtml(text, href, mode) {
  if (mode === 1) return text;
  const inner = escAll(text);
  const u = safeUri(href);
  if (u === null) return inner;
  return '<a href="' + escAll(u) + '">' + inner + '</a>';
}

function lexInline(src, mode) {
  const whole = src;
  let masked = null;
  let hasAt = -1, hasColon = false;
  let out = '';
  let pend = null, pendEsc = false;
  let keepPrev = false, prev = '';
  let closers = null;
  let guard = Infinity;
  while (src) {
    if (src.length < guard) guard = src.length;
    else throw new Error('Infinite loop on byte: ' + src.charCodeAt(0));
    if (!keepPrev) prev = '';
    keepPrev = false;
    const c = src.charCodeAt(0);
    let m, h;
    // escape
    if (c === 92 && (m = reEscape.exec(src))) {
      if (pend !== null) { out += (mode || pendEsc) ? pend : escSoft(pend); pend = null; }
      out += mode ? m[1] : escSoft(m[1]);
      src = src.substring(m[0].length);
      continue;
    }
    // inline html
    if (c === 60 && (m = reTag.exec(src))) {
      const raw = m[0];
      if (!inLink && /^<a /i.test(raw)) inLink = true;
      else if (inLink && /^<\/a>/i.test(raw)) inLink = false;
      if (!inRawBlock && /^<(pre|code|kbd|script)(\s|>)/i.test(raw)) inRawBlock = true;
      else if (inRawBlock && /^<\/(pre|code|kbd|script)(\s|>)/i.test(raw)) inRawBlock = false;
      if (pend !== null) { out += (mode || pendEsc) ? pend : escSoft(pend); pend = null; }
      out += raw;
      src = src.substring(raw.length);
      continue;
    }
    if (c === 91 || c === 33) {
      // inline link
      if (parenPossible !== false && (m = reLink.exec(src))) {
        h = inlineLink(src, m, mode);
        if (h !== undefined && h !== null) {
          if (pend !== null) { out += (mode || pendEsc) ? pend : escSoft(pend); pend = null; }
          out += h;
          src = src.substring(m[0].length);
          continue;
        }
      }
      // reference link
      if ((m = reRefLink.exec(src)) || (m = reNoLink.exec(src))) {
        if (!labelHasOpenTag(src, m[1], m[0].charAt(0) === '!' ? 2 : 1)) {
          const ref = links[normLabel(m[2] || m[1])];
          if (!ref) {
            const ch = m[0].charAt(0);
            if (pend !== null) pend += ch; else { pend = ch; pendEsc = false; }
            src = src.substring(1);
            continue;
          }
          h = outLink(m, ref.href, ref.title, mode);
          if (h !== null) {
            if (pend !== null) { out += (mode || pendEsc) ? pend : escSoft(pend); pend = null; }
            out += h;
            src = src.substring(m[0].length);
            continue;
          }
        }
      }
    }
    // emphasis
    if (c === 42 || c === 95) {
      if (closers === null) { masked = mask(whole); closers = lastCloser(masked); }
      const r = emStrong(src, masked, prev, closers, mode);
      if (r !== undefined) {
        if (pend !== null) { out += (mode || pendEsc) ? pend : escSoft(pend); pend = null; }
        out += r[1];
        src = src.substring(r[0]);
        continue;
      }
    }
    // code span
    if (c === 96 && (m = reCodespan.exec(src))) {
      let t = m[2].replace(/\n/g, ' ');
      if (/[^ ]/.test(t) && t.charCodeAt(0) === 32 && t.charCodeAt(t.length - 1) === 32) t = t.substring(1, t.length - 1);
      if (pend !== null) { out += (mode || pendEsc) ? pend : escSoft(pend); pend = null; }
      out += mode ? t : '<code>' + escAll(t) + '</code>';
      src = src.substring(m[0].length);
      continue;
    }
    // hard break
    if ((c === 32 || c === 92) && (m = reBr.exec(src))) {
      if (pend !== null) { out += (mode || pendEsc) ? pend : escSoft(pend); pend = null; }
      out += mode ? '' : '<br>';
      src = src.substring(m[0].length);
      continue;
    }
    // strikethrough
    if (c === 126) {
      if (closers === null) { masked = mask(whole); closers = lastCloser(masked); }
      const r = del(src, masked, prev, closers, mode);
      if (r !== undefined) {
        if (pend !== null) { out += (mode || pendEsc) ? pend : escSoft(pend); pend = null; }
        out += r[1];
        src = src.substring(r[0]);
        continue;
      }
    }
    // <autolink>
    if (c === 60 && (m = reAutolink.exec(src))) {
      if (pend !== null) { out += (mode || pendEsc) ? pend : escSoft(pend); pend = null; }
      out += autoLinkHtml(m[1], m[2] === '@' ? 'mailto:' + m[1] : m[1], mode);
      src = src.substring(m[0].length);
      continue;
    }
    // bare url / email
    if (!inLink && (m = reUrl.exec(src))) {
      let text, href;
      if (m[2] === '@') { text = m[0]; href = 'mailto:' + text; }
      else {
        let before;
        do { before = m[0]; const b = reBackpedal.exec(m[0]); m[0] = b ? b[0] : ''; } while (before !== m[0]);
        text = m[0];
        href = m[1] === 'www.' ? 'http://' + text : text;
      }
      if (pend !== null) { out += (mode || pendEsc) ? pend : escSoft(pend); pend = null; }
      out += autoLinkHtml(text, href, mode);
      src = src.substring(m[0].length);
      continue;
    }
    // text
    {
      const raw = reInlineText.exec(src)[0];
      const text = inRawBlock ? raw : decodeRefs(raw);
      src = src.substring(raw.length);
      if (raw.charCodeAt(raw.length - 1) !== 95) prev = raw.slice(-1);
      keepPrev = true;
      if (pend !== null) pend += text; else { pend = text; pendEsc = inRawBlock; }
    }
  }
  if (pend !== null) out += (mode || pendEsc) ? pend : escSoft(pend);
  return out;
}

// Character classes for the text scanner: bit 1 = [a-zA-Z0-9], bit 2 = email-local char.
const CLS = new Uint8Array(128);
for (let i = 0; i < 128; i++) {
  const ch = String.fromCharCode(i);
  if (/[a-zA-Z0-9]/.test(ch)) CLS[i] |= 1;
  if (/[a-zA-Z0-9.!#$%&'*+/=?_`{|}~-]/.test(ch)) CLS[i] |= 2;
}
const isAlnum = (c) => c < 128 && (CLS[c] & 1) !== 0;
const isMailCh = (c) => c < 128 && (CLS[c] & 2) !== 0;

function isJsSpace(c) {
  return c === 32 || (c >= 9 && c <= 13) || c === 0xa0 || c === 0x1680 || (c >= 0x2000 && c <= 0x200a) ||
    c === 0x2028 || c === 0x2029 || c === 0x202f || c === 0x205f || c === 0x3000 || c === 0xfeff;
}

// at i: two or more spaces then a newline
function spacesNl(s, i) {
  if (s.charCodeAt(i) !== 32 || s.charCodeAt(i + 1) !== 32) return false;
  i += 2;
  while (s.charCodeAt(i) === 32) i++;
  return s.charCodeAt(i) === 10;
}

// at i: one or more email-local chars then '@'
function mailAhead(s, i) {
  let j = i;
  while (j < s.length && isMailCh(s.charCodeAt(j))) j++;
  return j > i && s.charCodeAt(j) === 64;
}

function mailProto(s, i) {
  return s.startsWith('mailto:', i) || s.startsWith('xmpp:', i);
}

// Length of marked's inline text token at the start of s (same result as its gfm text regex).
function textLen(s, at, colon) {
  const n = s.length;
  const c0 = s.charCodeAt(0);
  if (colon && !isAlnum(c0) && mailProto(s, 1)) return 1;
  let p = 1;
  if (c0 === 96 || c0 === 126) while (p < n && s.charCodeAt(p) === c0) p++;
  if (p >= n) return n;
  const c1 = s.charCodeAt(p);
  if (c1 === 96 || c1 === 126) return p;
  if (c1 === 32 && spacesNl(s, p)) return p;
  if (at && mailAhead(s, p)) return p;
  for (let q = p; q < n; q++) {
    const ch = s.charCodeAt(q);
    switch (ch) {
      case 92: case 60: case 33: case 91: case 96: case 42: case 126: case 95: return q;
      case 104: case 72: {
        const a = s.charCodeAt(q + 1) | 32, b = s.charCodeAt(q + 2) | 32, d = s.charCodeAt(q + 3) | 32;
        if (a === 116 && b === 116 && d === 112) return q;
        break;
      }
      case 102: case 70:
        if ((s.charCodeAt(q + 1) | 32) === 116 && (s.charCodeAt(q + 2) | 32) === 112 && s.startsWith('://', q + 3)) return q;
        break;
      case 119:
        if (s.startsWith('ww.', q + 1)) {
          const b = s.charCodeAt(q - 1);
          if (b === 42 || b === 95 || b === 126 || b === 40 || isJsSpace(b)) return q;
        }
        break;
    }
    if (ch !== 32 && s.charCodeAt(q + 1) === 32 && spacesNl(s, q + 1)) return q + 1;
    if (colon && !isAlnum(ch) && mailProto(s, q + 1)) return q + 1;
    if (at && !isMailCh(ch) && mailAhead(s, q + 1)) return q + 1;
  }
  return n;
}

function inlineLink(src, m, mode) {
  if (labelHasOpenTag(src, m[1], m[0].charAt(0) === '!' ? 2 : 1)) return undefined;
  const t2 = m[2].trim();
  let href = m[2], whole = m[0], title = m[3];
  if (t2.charCodeAt(0) === 60) {
    if (t2.charCodeAt(t2.length - 1) !== 62) return undefined;
    const l = rtrimCh(t2.slice(0, -1), '\\');
    if ((t2.length - l.length) % 2 === 0) return undefined;
  } else {
    const l = findClose(href, '(', ')');
    if (l === -2) return undefined;
    if (l > -1) {
      const cut = (whole.indexOf('!') === 0 ? 5 : 4) + m[1].length + l;
      href = href.substring(0, l);
      whole = whole.substring(0, cut).trim();
      title = '';
    }
  }
  const r = rtrimCh(whole.slice(0, -1), '\\');
  if ((whole.length - r.length) % 2 === 0) return undefined;
  let t = title ? title.slice(1, -1) : '';
  href = href.trim();
  if (href.charCodeAt(0) === 60) href = href.slice(1, -1);
  m[0] = whole;
  const res = outLink(m, href && href.replace(reAnyPunct, '$1'), t && t.replace(reAnyPunct, '$1'), mode);
  return res;
}

const cpLen = (s) => { let n = 0; for (const _ of s) n++; return n; };
const lastCp = (s) => { let r = ''; for (const ch of s) r = ch; return r; };
const firstCpLen = (s) => { const c = s.charCodeAt(0); return c >= 0xd800 && c <= 0xdbff && s.length > 1 && (s.charCodeAt(1) & 0xfc00) === 0xdc00 ? 2 : 1; };

// returns [consumed length, html] or undefined
function emStrong(src, masked, prev, closers, mode) {
  let m = reEmLeft.exec(src);
  if (!m || (!m[1] && !m[2] && !m[3] && !m[4])) return undefined;
  const ch = m[0][0];
  const sameAsPrev = prev === ch;
  const pos = masked.length - src.length;
  let l = pos;
  while (l > 0 && masked[l - 1] === ch) l--;
  const before = lastCp(masked.slice(Math.max(0, l - 2), l));
  const beforePunct = before === '*' || before === '_' || !!rePunct.exec(before);
  if (l < pos) prev = before;
  const prevPunct = l < pos ? beforePunct : !!rePunct.exec(prev);
  if (m[4] && reAlnum.test(prev)) return undefined;
  const lead = m[1] || m[3] || '';
  if (lead && prev && !prevPunct) return undefined;
  const k = cpLen(m[0]) - 1;
  let need = k, carry = 0;
  const runLen = pos - l + k;
  const strict = !!before.trim() && (!!lead || (ch === '*' && !beforePunct));
  const re = ch === '*' ? reEmRightAst : reEmRightUnd;
  const last = ch === '*' ? closers.ast : closers.und;
  const q = masked.length - src.length + k;
  if (last < q) return undefined;
  const t = masked.slice(-1 * src.length + k);
  const limit = last - q;
  re.lastIndex = 0;
  while ((m = re.exec(t)) !== null && !(m.index > limit)) {
    const g = m[1] || m[2] || m[3] || m[4] || m[5] || m[6];
    if (!g) continue;
    let b = cpLen(g);
    if (m[3] || m[4]) { need += b; continue; }
    else if (m[5] || m[6] || strict) {
      if (sameAsPrev && (m[5] || m[6])) break;
      if (runLen % 3 && !((runLen + b) % 3)) { carry += b; continue; }
    }
    need -= b;
    if (need > 0) continue;
    b = Math.min(b, b + need + carry);
    const first = firstCpLen(m[0]);
    const raw = src.slice(0, k + m.index + first + b);
    if (Math.min(k, b) % 2) {
      const inner = inlineTokens(raw.slice(1, -1), mode);
      return [raw.length, mode ? inner : '<em>' + inner + '</em>'];
    }
    const inner = inlineTokens(raw.slice(2, -2), mode);
    return [raw.length, mode ? inner : '<strong>' + inner + '</strong>'];
  }
  return undefined;
}

function del(src, masked, prev, closers, mode) {
  let m = reDelLeft.exec(src);
  if (!m) return undefined;
  if (!(!(m[1] || '') || !prev || rePunct.exec(prev))) return undefined;
  const k = cpLen(m[0]) - 1;
  let need = k;
  const last = closers.del;
  const q = masked.length - src.length + k;
  if (last < q) return undefined;
  const t = masked.slice(-1 * src.length + k);
  const limit = last - q;
  reDelRight.lastIndex = 0;
  while ((m = reDelRight.exec(t)) !== null && !(m.index > limit)) {
    const g = m[1] || m[2] || m[3] || m[4] || m[5] || m[6];
    if (!g) continue;
    let b = cpLen(g);
    if (b !== k) continue;
    if (m[3] || m[4]) { need += b; continue; }
    need -= b;
    if (need > 0) continue;
    b = Math.min(b, b + need);
    const first = firstCpLen(m[0]);
    const raw = src.slice(0, k + m.index + first + b);
    const inner = inlineTokens(raw.slice(k, -k), mode);
    return [raw.length, mode ? inner : '<del>' + inner + '</del>'];
  }
  return undefined;
}

// ---------------------------------------------------------------------------------------------
// Block renderer
// ---------------------------------------------------------------------------------------------
function renderBlocks(toks) {
  let out = '';
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    switch (t.type) {
      case 'space': case 'def': break;
      case 'paragraph': out += '<p>' + t.q.pre + t.q.html + '</p>\n'; break;
      case 'text': out += t.q.pre + t.q.html; break;
      case 'heading': out += `<h${t.depth}>` + t.q.pre + t.q.html + `</h${t.depth}>\n`; break;
      case 'hr': out += '<hr>\n'; break;
      case 'html': out += t.text; break;
      case 'checkbox': out += t.html; break;
      case 'code': {
        const lang = t.lang ? /^\S*/.exec(t.lang)[0] : '';
        const body = t.text ? t.text.replace(/\n$/, '') + '\n' : '';
        out += (lang ? '<pre><code class="language-' + escSoft(lang) + '">' : '<pre><code>') + escAll(body) + '</code></pre>\n';
        break;
      }
      case 'blockquote': out += '<blockquote>\n' + renderBlocks(t.tokens) + '</blockquote>\n'; break;
      case 'list': {
        const tag = t.ordered ? 'ol' : 'ul';
        out += '<' + tag + (t.ordered && t.start !== 1 ? ' start="' + t.start + '"' : '') + '>\n';
        for (const it of t.items) out += '<li>' + renderBlocks(it.tokens) + '</li>\n';
        out += '</' + tag + '>\n';
        break;
      }
      case 'table': {
        let row = '';
        for (let c = 0; c < t.header.length; c++) row += cell('th', t.align[c], t.header[c]);
        out += '<table>\n<thead>\n<tr>\n' + row + '</tr>\n</thead>\n';
        let body = '';
        for (const r of t.rows) {
          row = '';
          for (let c = 0; c < r.length; c++) row += cell('td', t.align[c], r[c]);
          body += '<tr>\n' + row + '</tr>\n';
        }
        if (body) out += '<tbody>' + body + '</tbody>';
        out += '</table>\n';
        break;
      }
    }
  }
  return out;
}

function cell(tag, align, q) {
  return (align ? `<${tag} align="${align}">` : `<${tag}>`) + q.html + `</${tag}>\n`;
}

// ---------------------------------------------------------------------------------------------
export function parse(markdown) {
  links = Object.create(null);
  queue = [];
  top = true;
  inLink = false;
  inRawBlock = false;
  linkEmitted = false;
  parenPossible = true;
  const toks = blockTokens(markdown.replace(/\r\n|\r/g, '\n'), [], false);
  for (let i = 0; i < queue.length; i++) {
    const q = queue[i];
    inRawBlock = false;
    q.html = inlineTokens(q.src, 0);
  }
  const html = renderBlocks(toks);
  links = queue = null;
  return html;
}
