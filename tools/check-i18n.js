/* Every Russian string the app shows must have an English twin.
   Russian is the source language and a missing key silently falls back to Russian,
   so an English user sees Russian text and nothing crashes. This finds those.

   Scans call sites (L`...`, L('...'), tr('...') in renderer/, t('...') in main.js and src/)
   and checks each canonical key against the EN dictionary of the matching i18n.js.

   `npm test` runs this through test/i18n.test.js, so a missing twin fails a pull request
   rather than waiting for somebody to notice Cyrillic in an English window.

   Usage: node tools/check-i18n.js        exit 1 if a key is missing
          node tools/check-i18n.js --unused   also list EN keys nothing calls (advisory:
                                                data-driven tr(var) lookups look unused here) */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

// ---- the two dictionaries -------------------------------------------------
function readDict(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const start = src.indexOf('const EN = {');
  if (start < 0) throw new Error(`no "const EN = {" in ${file}`);
  const open = src.indexOf('{', start);
  let depth = 0;
  let i = open;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') { const q = c; i++; while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; } continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) break;
  }
  // eslint-disable-next-line no-new-func
  return new Function(`return ${src.slice(open, i + 1)}`)();
}

// ---- call-site scanner ----------------------------------------------------
// Walks the source once, skipping comments, strings and regex literals, and picks up
// the string that L / tr / t is called with. Keys use {0},{1}… for interpolated values,
// exactly like canonKey() in renderer/i18n.js.
const IDENT = /[A-Za-z_$]/;
const IDENT_REST = /[\w$]/;

function scan(src, names, baseLine = 1) {
  const hits = [];
  const lineAt = (idx) => baseLine + src.slice(0, idx).split('\n').length - 1;
  // Code inside a template's ${…}: the UI builds its markup as one big template, so most
  // L`` calls in the app live in there. Skipping those regions (as this scanner did until
  // 2026-08-06) made the check pass while never looking at the banners at all.
  const nested = [];
  let i = 0;
  let prev = ''; // last significant code char, to tell division from a regex

  const readString = (k) => { // k at the quote; returns { value, end } or null
    const q = src[k];
    const from = k;
    k++;
    while (k < src.length && src[k] !== q) { if (src[k] === '\\') k++; k++; }
    if (k >= src.length) return null;
    try {
      // eslint-disable-next-line no-new-func
      return { value: new Function(`return ${src.slice(from, k + 1)}`)(), end: k + 1 };
    } catch { return null; }
  };

  // Advance past a template literal, nested ones and all, recording nothing. Used while
  // skipping over an interpolation that is going to be scanned properly in its own right.
  const skipTemplate = (k) => {
    k++;
    while (k < src.length) {
      const c = src[k];
      if (c === '\\') { k += 2; continue; }
      if (c === '`') return k + 1;
      if (c === '$' && src[k + 1] === '{') {
        let depth = 1;
        k += 2;
        while (k < src.length && depth) {
          const d = src[k];
          if (d === '{') depth++;
          else if (d === '}') { if (--depth === 0) { k++; break; } }
          else if (d === "'" || d === '"') { const q = d; k++; while (k < src.length && src[k] !== q) { if (src[k] === '\\') k++; k++; } }
          else if (d === '`') { k = skipTemplate(k) - 1; }
          k++;
        }
        continue;
      }
      k++;
    }
    return k;
  };

  const readTemplate = (k) => { // k at the backtick; ${…} becomes {0},{1}…
    let out = '';
    let n = 0;
    k++;
    while (k < src.length) {
      const c = src[k];
      if (c === '\\') {
        const e = src[k + 1];
        out += e === 'n' ? '\n' : e === 't' ? '\t' : e;
        k += 2;
        continue;
      }
      if (c === '`') return { value: out, end: k + 1 };
      if (c === '$' && src[k + 1] === '{') {
        let depth = 1;
        k += 2;
        const from = k;
        while (k < src.length && depth) {
          const d = src[k];
          if (d === '{') depth++;
          else if (d === '}') { if (--depth === 0) { nested.push({ from, to: k }); k++; break; } }
          else if (d === "'" || d === '"') { const q = d; k++; while (k < src.length && src[k] !== q) { if (src[k] === '\\') k++; k++; } }
          // Step over a template nested in this interpolation WITHOUT recording anything:
          // the whole region is scanned recursively below, and letting readTemplate run here
          // too would register its interpolations twice (and four times one level deeper).
          else if (d === '`') { k = skipTemplate(k) - 1; }
          k++;
        }
        out += `{${n++}}`;
        continue;
      }
      out += c;
      k++;
    }
    return null;
  };

  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '/' && !IDENT_REST.test(prev) && prev !== ')' && prev !== ']') { // regex literal
      i++;
      let inClass = false;
      while (i < src.length) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '[') inClass = true;
        else if (src[i] === ']') inClass = false;
        else if (src[i] === '/' && !inClass) { i++; break; }
        else if (src[i] === '\n') break;
        i++;
      }
      prev = '0';
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const r = c === '`' ? readTemplate(i) : readString(i);
      i = r ? r.end : i + 1;
      prev = '"';
      continue;
    }
    if (IDENT.test(c)) {
      const from = i;
      while (i < src.length && IDENT_REST.test(src[i])) i++;
      const name = src.slice(from, i);
      const isProp = /[.\w$]/.test(src[from - 1] || '');
      let j = i;
      while (j < src.length && /\s/.test(src[j])) j++;
      if (!isProp && names.includes(name)) {
        if (src[j] === '`') {
          const r = readTemplate(j);
          if (r) { hits.push({ line: lineAt(from), key: r.value, call: `${name}\`\`` }); i = r.end; prev = '"'; continue; }
        } else if (src[j] === '(') {
          let k = j + 1;
          while (k < src.length && /\s/.test(src[k])) k++;
          const r = src[k] === '`' ? readTemplate(k) : (src[k] === "'" || src[k] === '"') ? readString(k) : null;
          if (r) { hits.push({ line: lineAt(from), key: r.value, call: `${name}()` }); i = r.end; prev = '"'; continue; }
        }
      }
      prev = name.slice(-1);
      continue;
    }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  // Every ${…} found above is ordinary code: scan it the same way, with its own line offset
  // so a hit still points at the line the author wrote it on. Templates nested inside those
  // interpolations queue their own regions when this runs, so depth costs nothing extra.
  for (const r of nested) {
    hits.push(...scan(src.slice(r.from, r.to), names, lineAt(r.from)));
  }
  return hits;
}

// ---- what to check --------------------------------------------------------
function jsFiles(dir, skip) {
  const out = [];
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...jsFiles(p, skip));
    else if (e.name.endsWith('.js') && !skip.includes(p)) out.push(p);
  }
  return out;
}

const SIDES = [
  { name: 'renderer', dict: 'renderer/i18n.js', calls: ['L', 'tr'], files: jsFiles('renderer', ['renderer/i18n.js']) },
  { name: 'main', dict: 'src/i18n.js', calls: ['t'], files: ['main.js', ...jsFiles('src', ['src/i18n.js'])] },
];

let missing = 0;
for (const side of SIDES) {
  const dict = readDict(side.dict);
  const used = new Set();
  const gaps = [];
  for (const file of side.files) {
    for (const h of scan(fs.readFileSync(path.join(ROOT, file), 'utf8'), side.calls)) {
      used.add(h.key);
      // A key with no Russian letters is already language-neutral (a name, a number, a path).
      if (dict[h.key] == null && /[А-Яа-яЁё]/.test(h.key)) gaps.push({ ...h, file });
    }
  }
  if (gaps.length) {
    missing += gaps.length;
    console.log(`\n${gaps.length} string(s) with no English twin in ${side.dict}:`);
    for (const g of gaps) console.log(`  ${g.file}:${g.line}  ${g.call}  ${JSON.stringify(g.key)}`);
  }
  if (process.argv.includes('--unused')) {
    const dead = Object.keys(dict).filter((k) => !used.has(k));
    if (dead.length) console.log(`\n${dead.length} key(s) in ${side.dict} that no literal call site uses (data-driven lookups land here too):\n  ${dead.map((k) => JSON.stringify(k)).join('\n  ')}`);
  }
}

if (missing) {
  console.log(`\nAdd the English text to the EN dictionary, keyed by the exact Russian string.`);
  process.exit(1);
}
console.log(`i18n: every Russian string in ${rel(path.join(ROOT, 'renderer'))}/ and main has an English twin.`);
