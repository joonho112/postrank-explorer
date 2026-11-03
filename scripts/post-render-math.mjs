#!/usr/bin/env node
// Post-render math pass (from postrank Explorer v1, without the number registry and notation map). Quarto keeps TeX
// through the stub URL of its mathjax method (_quarto.yml); this step converts every span.math to MathML with Temml
// (throwOnError, the macros of js/shared/math.js, `trust` only for \class), removes the stub script and the remote
// polyfill Quarto injects, links styles/temml.css once per page, and rewrites search.json so that every formula there
// is plain text. Pages then need no script and no network for math.
//
// As a Quarto post-render script it processes only QUARTO_PROJECT_OUTPUT_FILES (partial renders stay partial):
//   project:
//     post-render: node scripts/post-render-math.mjs
// By hand:  node scripts/post-render-math.mjs [--dir docs] [file.html ...]
// Any failure (a Temml error) exits 1, names the file and writes nothing.
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync, copyFileSync, realpathSync } from "node:fs";
import { join, resolve, relative, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { MACROS } from "../js/shared/math.js";

// Temml 0.14.0 drops the last character of a \mathrm{...} group that holds a digit ("U19" shows "U1"); such a
// group is written as \text{...} (the same rule as js/widgets/math.js).
const fixMathrmDigits = (tex) => String(tex).replace(/\\mathrm\{([^{}]*\d[^{}]*)\}/g, "\\text{$1}");

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_CSS = "styles/temml.css";

/** Temml for Node: the vendored js/vendor/temml/temml.cjs ($PRX_TEMML may name another temml.cjs). */
export function loadTemml() {
  const require = createRequire(import.meta.url);
  const p = process.env.PRX_TEMML ?? join(ROOT, "js/vendor/temml/temml.cjs");
  if (!existsSync(p)) throw new Error(`Temml not found at ${relative(ROOT, p)} (run: node tools/vendor.mjs)`);
  return { temml: require(p), path: p };
}

export const temmlOptions = (macros, displayMode) => ({
  displayMode, macros: { ...macros }, throwOnError: true, trust: (ctx) => ctx.command === "\\class",
});

const unescapeHtml = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, "&");
const escapeAttr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const escapeText = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The TeX of a span.math body (HTML-escaped, with \( \) or \[ \] delimiters). */
export function spanTex(body) {
  return unescapeHtml(body).trim().replace(/^\\\(/, "").replace(/\\\)$/, "").replace(/^\\\[/, "").replace(/\\\]$/, "").trim();
}

/**
 * Convert one HTML document. Returns { html, spans }. `fileLabel` prefixes errors. `cssHref` is page-relative.
 */
export function convertHtml(html, { temml, macros = MACROS, cssHref, stub = "mathjax-stub.js", deck = false, fileLabel = "" }) {
  let spans = 0;
  const where = fileLabel ? `${fileLabel}: ` : "";
  html = html.replace(/<span class="math (inline|display)">([\s\S]*?)<\/span>/g, (whole, kind, body) => {
    if (body.trimStart().startsWith("<math")) return whole;   // already converted (a second run is a no-op)
    spans++;
    const tex = fixMathrmDigits(spanTex(body));
    let out;
    try {
      out = temml.renderToString(tex, temmlOptions(macros, kind === "display"));
    } catch (e) {
      throw new Error(`${where}Temml could not convert ${JSON.stringify(tex)}: ${e.message.split("\n")[0]}`);
    }
    return `<span class="math ${kind}">${out}</span>`;
  });
  html = html.replace(new RegExp(`<script[^>]*${escapeRe(stub)}[^>]*>\\s*</script>\\s*`, "g"), "");
  // Quarto's mathjax method also injects a remote polyfill (CONTRACT 2.4, 4.2).
  html = html.replace(/<script[^>]*cdnjs\.cloudflare\.com\/polyfill[^>]*>\s*<\/script>\s*/g, "");
  if (deck) {
    html = html.replace(/<script src="[^"]*plugin\/math\/math\.js"><\/script>\s*/g, "");
    html = html.replace(/\n\s*RevealMath,/g, "");
  }
  if (cssHref && !/<link[^>]+href="[^"]*\btemml\.css"/.test(html)) {
    html = html.replace("</head>", `<link rel="stylesheet" href="${escapeAttr(cssHref)}">\n</head>`);
  }
  return { html, spans };
}

// ---------------------------------------------------------------------------------------------------------------
// Plain text from MathML (search index). Temml's MathML is parsed with a small tag reader; the reading keeps letters,
// numbers and operators, writes sub- and superscripts with Unicode script characters where every character has one
// (otherwise "_" or "^" and the text), fractions as a/b, accents as combining marks, and spaces around relations.

const SUB = Object.fromEntries([..."0123456789+−=()aehijklmnoprstuvxβγρφχ"].map((c, i) => [c, [..."₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓᵦᵧᵨᵩᵪ"][i]]));
const SUP = Object.fromEntries([..."0123456789+−=()abcdefghijklmnoprstuvwxyzABDEGHIJKLMNOPRTUVWβγδθφχ"]
  .map((c, i) => [c, [..."⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻᴬᴮᴰᴱᴳᴴᴵᴶᴷᴸᴹᴺᴼᴾᴿᵀᵁⱽᵂᵝᵞᵟᶿᵠᵡ"][i]]));
const SCRIPT_KEEP = new Set([",", "′", "″", "*", "∗", "⋆", "↓", "↑"]);
const ACCENTS = { "ˆ": "̂", "^": "̂", "‾": "̄", "¯": "̄", "ˉ": "̄", "~": "̃", "˜": "̃",
  "→": "⃗", "⃗": "⃗", "˙": "̇", "¨": "̈", "ˇ": "̌" };
const RELATIONS = new Set(["=", "<", ">", "≤", "≥", "≠", "∈", "∉", "≈", "≡", "→", "←", "↔", "⇒", "⇔", "∼", "≃", "⊂", "⊆", "⊃", "⊇", "≔", "↦", "∣", "≻", "≺", "⪰", "⪯", "≽", "≼", "⊥"]);
const BIG_OPS = /^[∑∏∫∮⋃⋂⨁⨂]/;
const BINARY = new Set(["+", "−", "±", "∓", "×"]);
const INVISIBLE = /[⁡-⁤​]/g;

export function parseMathML(s) {
  const root = { tag: "#root", attrs: {}, children: [] };
  const stack = [root];
  const re = /<(\/?)([A-Za-z][\w:-]*)((?:\s+[\w:-]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(s))) {
    if (m[5] !== undefined) { stack[stack.length - 1].children.push({ text: unescapeHtml(m[5]) }); continue; }
    const [, close, tag, attrText, selfClose] = m;
    if (close) {
      while (stack.length > 1 && stack.pop().tag !== tag);
      continue;
    }
    const attrs = Object.fromEntries([...attrText.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].map((a) => [a[1], a[2] ?? ""]));
    const node = { tag, attrs, children: [] };
    stack[stack.length - 1].children.push(node);
    if (!selfClose) stack.push(node);
  }
  return root;
}

const kids = (n) => (n.children ?? []).filter((c) => c.tag !== undefined || c.text.trim() !== "" || / /.test(c.text));
const textOf = (n) => n.text !== undefined ? n.text : (n.children ?? []).map(textOf).join("");

function script(str, map, mark) {
  const s = str.replace(/\s+/g, "");
  if (s && [...s].every((c) => map[c] || SCRIPT_KEEP.has(c))) return [...s].map((c) => map[c] ?? c).join("");
  return mark + s;
}
const wrap = (s) => (/[\s+−\-=<>≤≥,·×/]/.test(s) && !/^\(.*\)$/.test(s) ? `(${s})` : s);

function plainNode(n, inScript) {
  if (n.text !== undefined) return n.text.replace(INVISIBLE, "").replace(/ /g, " ");
  const c = kids(n);
  const P = (x, sc = inScript) => plainNode(x, sc);
  switch (n.tag) {
    case "annotation": case "annotation-xml": case "mphantom": return "";
    case "semantics": return c.length ? P(c[0]) : "";
    case "mi": case "mn": case "mtext": case "ms": return textOf(n).replace(INVISIBLE, "").replace(/ /g, " ");
    case "mo": {
      let t = textOf(n).replace(INVISIBLE, "").replace("⋅", "·");
      if (t === "|" && n.attrs.lspace) t = "∣";   // \mid
      if (inScript) return t;
      if (RELATIONS.has(t)) return ` ${t} `;
      if (t === "," && n.attrs.separator === "true") return ", ";
      return t;
    }
    case "mspace": {
      const w = parseFloat(n.attrs.width ?? "0");
      return !inScript && w >= 0.27 ? " " : "";
    }
    case "msub": return P(c[0]) + script(P(c[1], true), SUB, "_") + (c[0]?.tag === "mo" && !inScript ? " " : "");
    case "msup": return P(c[0]) + script(P(c[1], true), SUP, "^");
    case "msubsup": return P(c[0]) + script(P(c[1], true), SUB, "_") + script(P(c[2], true), SUP, "^");
    case "munder": return P(c[0]) + script(P(c[1], true), SUB, "_") + (inScript ? "" : " ");
    case "munderover": return P(c[0]) + script(P(c[1], true), SUB, "_") + script(P(c[2], true), SUP, "^") + (inScript ? "" : " ");
    case "mover": {
      const base = P(c[0]), over = c[1] ? textOf(c[1]).replace(INVISIBLE, "").trim() : "";
      if (ACCENTS[over]) return base + ACCENTS[over];
      return base + script(c[1] ? P(c[1], true) : "", SUP, "^");
    }
    case "mfrac": {
      const a = P(c[0]), b = P(c[1]);
      if (n.attrs.linethickness === "0px" || n.attrs.linethickness === "0") return `${a} choose ${b}`;
      return `${wrap(a.trim())}/${wrap(b.trim())}`;
    }
    case "msqrt": return `√${wrap(c.map((x) => P(x)).join("").trim())}`;
    case "mroot": return `${script(P(c[1], true), SUP, "^")}√${wrap(P(c[0]).trim())}`;
    case "mtable": return c.map((r) => P(r)).join("; ");
    case "mtr": return c.map((d) => P(d).trim()).join(" ");
    case "mlabeledtr": return [...c.slice(1), c[0]].map((d) => P(d).trim()).join(" ");
    default: {
      // mrow and friends: binary operators get spaces when they follow an operand.
      let out = "", prev = null;
      for (const x of c) {
        const s = P(x);
        // An operator name with limits (arg min_g, max_i) is followed by a space before its argument.
        const afterLimits = !inScript && x.tag === "mo" && /\u2061/.test(textOf(x)) && /^(msub|munder|msubsup|munderover)$/.test(prev?.tag ?? "");
        prev = x;
        if (afterLimits) { out += " "; continue; }
        // A big operator (sum, product, integral) after an operand starts a new term: 1/M ∑ ...
        if (!inScript && /^(msub|munder|msubsup|munderover|mo)$/.test(x.tag) && BIG_OPS.test(s) && out.trim() && !/[\s(\[{]$/.test(out)) out += " ";
        if (!inScript && x.tag === "mo" && BINARY.has(s) && out.trim() && !/[(\[{|,]\s*$/.test(out) && !/ [=<>≤≥≠∈≈→] $/.test(out)) out += ` ${s} `;
        else out += s;
      }
      return out;
    }
  }
}

export function mathmlToPlain(mathml) {
  return plainNode(parseMathML(mathml), false).replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").trim();
}

/** One formula of the search index -> plain text. */
export function texToSearchText(tex, { temml, macros = MACROS, display = false, where = "" }) {
  let t = tex, tag = "";
  t = t.replace(/\\tag\*?\s*\{([^{}]*)\}/g, (_, x) => { tag = ` (${x})`; return ""; });
  let mathml;
  try { mathml = temml.renderToString(fixMathrmDigits(t), temmlOptions(macros, display)); }
  catch (e) { throw new Error(`${where}Temml could not convert ${JSON.stringify(tex)}: ${e.message.split("\n")[0]}`); }
  return mathmlToPlain(mathml) + tag;
}

/** Rewrite a search index (Quarto's search.json): formulas \( \) and \[ \] become plain text. */
export function convertSearchJson(text, { temml, macros = MACROS, fileLabel = "search.json" } = {}) {
  const where = `${fileLabel}: `;
  const convert = (s) => {
    if (!/\\\(|\\\[/.test(s)) return s;
    return s.replace(/\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g, (_, inl, disp) => {
      const display = disp !== undefined;
      return escapeText(texToSearchText(unescapeHtml(display ? disp : inl).trim(), { temml, macros, display, where }));
    });
  };
  const walk = (v) => {
    if (typeof v === "string") return convert(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return JSON.stringify(walk(JSON.parse(text)));
}

// ---------------------------------------------------------------------------------------------------------------
// CLI.

function walkHtml(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkHtml(p, out);
    else if (name.endsWith(".html")) out.push(p);
  }
  return out;
}

function parseArgs(argv) {
  const o = { files: [], search: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dir") o.dir = resolve(argv[++i]);
    else if (a === "--no-search") o.search = false;
    else if (a.startsWith("--")) throw new Error(`unknown option ${a}`);
    else o.files.push(resolve(a));
  }
  return o;
}

async function main(argv) {
  const opt = parseArgs(argv);
  const outRoot = opt.dir ?? (process.env.QUARTO_PROJECT_OUTPUT_DIR ? resolve(process.env.QUARTO_PROJECT_OUTPUT_DIR) : null);
  let files = opt.files;
  if (!files.length && process.env.QUARTO_PROJECT_OUTPUT_FILES) {
    files = process.env.QUARTO_PROJECT_OUTPUT_FILES.split(/\r?\n/).filter(Boolean).map((f) => resolve(f));
  }
  if (!files.length && opt.dir) files = walkHtml(opt.dir);
  files = files.filter((f) => f.endsWith(".html"));
  const root = outRoot ?? (files.length ? dirname(files[0]) : process.cwd());
  const { temml } = loadTemml();
  const search = join(root, "search.json");
  const searchText = opt.search && existsSync(search) ? readFileSync(search, "utf8") : null;
  const cssDest = join(root, DEFAULT_CSS);
  if (!existsSync(cssDest)) {
    mkdirSync(dirname(cssDest), { recursive: true });
    copyFileSync(join(ROOT, DEFAULT_CSS), cssDest);
  }
  // convert everything first and write only when every page succeeded
  let spans = 0;
  const done = [];
  for (const f of files) {
    const html = readFileSync(f, "utf8");
    const label = relative(root, f).split(sep).join("/");
    const cssHref = relative(dirname(f), cssDest).split(sep).join("/");
    const r = convertHtml(html, { temml, cssHref, fileLabel: label });
    // pages without math keep no stylesheet link
    // a page whose app typesets formulas at run time (it loads temml.min.js) needs the stylesheet as well
    const appMath = /<script[^>]+temml\.min\.js"/.test(html);
    done.push([f, r.spans || appMath ? r.html : convertHtml(html, { temml, cssHref: null, fileLabel: label }).html]);
    spans += r.spans;
  }
  const newSearch = searchText !== null && /\\\\[(\[]/.test(searchText) ? convertSearchJson(searchText, { temml }) : null;
  for (const [f, html] of done) writeFileSync(f, html);
  if (newSearch !== null) writeFileSync(search, newSearch);
  console.log(`post-render-math: ${files.length} page(s), ${spans} math span(s) converted${newSearch !== null ? ", search.json updated" : ""}`);
}

const isMain = (() => {
  try { return realpathSync(process.argv[1] ?? "") === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();
if (isMain) {
  main(process.argv.slice(2)).catch((e) => { console.error(`post-render-math: ${e.message}`); process.exit(1); });
}
