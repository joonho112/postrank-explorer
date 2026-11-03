// Number registry lookup (CONTRACT 4.2, 5.1-5.2). One module for the registry builder, the post-render math
// step, the checks and (bundled by esbuild) widget math. The core functions are pure; `loadRegistry` is the only
// function that touches the file system, and it imports node:fs lazily so that a browser bundle never needs it.
//
//   import { loadRegistry, replacePrxnum } from "./registry.mjs";
//   const reg = await loadRegistry();                 // data/numbers.json + data/numbers-cases.json
//   reg.display("six.A.cap3.tau20.risk")              // ".0417"
//   replacePrxnum("R = \\prxnum{six.A.cap3.tau20.risk}", reg)   // "R = \\text{.0417}"

/** Registry key grammar (CONTRACT 4.2): the same for `num`, `setting`, `\prxnum` and both data files. */
export const KEY_RE = /^[a-z0-9][A-Za-z0-9_.]*$/;
/** Keys of setting values (CONTRACT 5.3); the `setting` shortcode reads only these. */
export const SETTINGS_PREFIX = "settings.";
/** Entry types (CONTRACT 5.1). */
export const TYPES = ["scalar", "vector", "fraction", "text", "na", "set"];
/** The two data files, relative to the data directory. */
export const NUMBERS_FILE = "numbers.json";
export const CASES_FILE = "numbers-cases.json";

export class RegistryError extends Error {
  constructor(message) { super(message); this.name = "RegistryError"; }
}

/** True when `key` follows the registry key grammar. */
export function isKey(key) {
  return typeof key === "string" && KEY_RE.test(key);
}

/** True for a `settings.*` key. */
export function isSettingKey(key) {
  return typeof key === "string" && key.startsWith(SETTINGS_PREFIX);
}

/**
 * Build a registry from the two parsed data files (key -> entry maps). Throws a RegistryError that lists every
 * problem: a key outside the grammar, a key present in both files, an entry without a string display or with an
 * unknown type.
 */
export function createRegistry(numbers = {}, cases = {}, { numbersName = NUMBERS_FILE, casesName = CASES_FILE } = {}) {
  const errors = [];
  const merged = new Map();
  const add = (map, name) => {
    if (map === null || typeof map !== "object" || Array.isArray(map)) {
      errors.push(`${name}: expected an object mapping registry keys to entries`);
      return;
    }
    for (const [key, entry] of Object.entries(map)) {
      if (!isKey(key)) { errors.push(`${name}: key "${key}" does not match ${KEY_RE}`); continue; }
      if (merged.has(key)) { errors.push(`key "${key}" is defined in both ${merged.get(key).file} and ${name}`); continue; }
      if (entry === null || typeof entry !== "object") { errors.push(`${name}: ${key}: entry is not an object`); continue; }
      if (typeof entry.display !== "string") errors.push(`${name}: ${key}: display is not a string`);
      if (!TYPES.includes(entry.type)) errors.push(`${name}: ${key}: type ${JSON.stringify(entry.type)} is not one of ${TYPES.join(", ")}`);
      merged.set(key, { file: name, entry });
    }
  };
  add(numbers, numbersName);
  add(cases, casesName);
  if (errors.length) throw new RegistryError(`registry is invalid:\n  ${errors.join("\n  ")}`);
  const keys = [...merged.keys()].sort();
  const lookup = (key, where) => {
    if (!isKey(key)) throw new RegistryError(`${where}invalid registry key "${key}" (grammar ${KEY_RE})`);
    const hit = merged.get(key);
    if (!hit) throw new RegistryError(`${where}unknown registry key "${key}"${suggest(key, keys)}`);
    return hit;
  };
  return {
    keys: () => keys.slice(),
    has: (key) => merged.has(key),
    /** The full entry ({ type, value, display, ... }); throws for a missing key. */
    get: (key, where = "") => lookup(key, where).entry,
    /** The display string; throws for a missing key. */
    display: (key, where = "") => lookup(key, where).entry.display,
    /** Which file defines the key. */
    fileOf: (key) => merged.get(key)?.file ?? null,
    size: merged.size,
  };
}

// A short "did you mean" hint: keys sharing the longest dotted prefix.
function suggest(key, keys) {
  const parts = key.split(".");
  for (let n = parts.length - 1; n > 0; n--) {
    const prefix = parts.slice(0, n).join(".") + ".";
    const near = keys.filter((k) => k.startsWith(prefix)).slice(0, 4);
    if (near.length) return ` (keys under ${prefix}*: ${near.join(", ")}${near.length === 4 ? ", ..." : ""})`;
  }
  return "";
}

/**
 * Load the registry from a data directory (default: `<repo>/data`, or $PRX_DATA_DIR). `numbers-cases.json` is
 * optional until r-export writes it (`requireCases: true` makes it required); `numbers.json` is required.
 */
export async function loadRegistry({ dataDir, numbersPath, casesPath, requireCases = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");
  const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
  const dir = dataDir ?? process.env.PRX_DATA_DIR ?? path.join(root, "data");
  const np = numbersPath ?? path.join(dir, NUMBERS_FILE);
  const cp = casesPath ?? path.join(dir, CASES_FILE);
  const read = (p, required) => {
    if (!fs.existsSync(p)) {
      if (required) throw new RegistryError(`registry file not found: ${p} (run: node scripts/build_numbers.mjs)`);
      return {};
    }
    try { return JSON.parse(fs.readFileSync(p, "utf8")); }
    catch (e) { throw new RegistryError(`${p}: not valid JSON (${e.message})`); }
  };
  const registry = createRegistry(read(np, true), read(cp, requireCases), { numbersName: np, casesName: cp });
  return Object.assign(registry, { paths: { numbers: np, cases: cp } });
}

// TeX text-mode escapes for the ten special characters (CONTRACT 4.2: % _ # & $ ~ ^ \ { }).
const TEX_ESCAPES = {
  "\\": "\\textbackslash{}",
  "{": "\\{",
  "}": "\\}",
  "%": "\\%",
  "_": "\\_",
  "#": "\\#",
  "&": "\\&",
  "$": "\\$",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
};

/** Escape a display string for use inside \text{...}. One pass, so a backslash is never escaped twice. */
export function escapeTeX(s) {
  return String(s).replace(/[\\{}%_#&$~^]/g, (c) => TEX_ESCAPES[c]);
}

// \prxnum{key}: the brace content is captured loosely so that a malformed key is reported, never left to Temml.
const PRXNUM_RE = /\\prxnum\s*\{([^{}]*)\}/g;
const PRXNUM_ANY = /\\prxnum(?![A-Za-z])/;

/**
 * Replace every \prxnum{key} in a TeX string by \text{<escaped display>}. Throws a RegistryError for a missing
 * key, a key outside the grammar, or a \prxnum without a braced key. `where` prefixes error messages.
 */
export function replacePrxnum(tex, registry, { where = "" } = {}) {
  const out = String(tex).replace(PRXNUM_RE, (_, raw) => {
    const key = raw.trim();
    return `\\text{${escapeTeX(registry.display(key, where))}}`;
  });
  if (PRXNUM_ANY.test(out)) throw new RegistryError(`${where}\\prxnum without a braced key in: ${tex}`);
  return out;
}

/** The plain-text form (search index, aria text): \prxnum{key} becomes the display string itself. */
export function replacePrxnumPlain(text, registry, { where = "" } = {}) {
  const out = String(text).replace(PRXNUM_RE, (_, raw) => registry.display(raw.trim(), where));
  if (PRXNUM_ANY.test(out)) throw new RegistryError(`${where}\\prxnum without a braced key in: ${text}`);
  return out;
}

/** Keys referenced by \prxnum in a TeX string, in order (malformed keys included, so callers can report them). */
export function prxnumKeys(tex) {
  return [...String(tex).matchAll(PRXNUM_RE)].map((m) => m[1].trim());
}
