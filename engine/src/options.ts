// Options objects and exact counts shared by every module (internal; not part of the public API in index.ts).
//
// Options (Step 2.12, E-2/E-21): every exported function that takes an options object checks it here. Anything
// other than an object (a number passed where `{ tau, … }` belongs, an array) throws "options object expected:
// {…}", and an unknown key throws an error naming it, so a misspelt or renamed option is never ignored.
// Counts (E-12): a count shown with a result is a number up to 2^53 and a decimal string above, so results stay
// JSON-serializable; the exact BigInt rides along as a non-enumerable property (JSON.stringify skips it).

/** Old option names that were renamed, for a hint in the error message. */
const RENAMED: Readonly<Record<string, string>> = Object.freeze({ scale: "multiplier", tol: "tieTol" });

function describe(x: unknown): string {
  if (typeof x === "string") return JSON.stringify(x);
  if (Array.isArray(x)) return "an array";
  if (ArrayBuffer.isView(x)) return "a typed array";
  return String(x);
}

/**
 * Check an options argument: undefined or null gives {} (or throws when `required`), a non-object throws
 * "options object expected: {a, b, …}", and a key outside `allowed` throws naming it.
 */
export function readOptions<T extends object>(options: unknown, allowed: readonly string[], fn: string, required = false): T {
  const list = `{${allowed.join(", ")}}`;
  if (options === undefined || options === null) {
    if (required) throw new TypeError(`${fn}: options object expected: ${list}`);
    return {} as T;
  }
  if (typeof options !== "object" || Array.isArray(options) || ArrayBuffer.isView(options)) {
    throw new TypeError(`${fn}: options object expected: ${list}, got ${describe(options)}`);
  }
  for (const key of Object.keys(options)) {
    if (!allowed.includes(key)) {
      const to = RENAMED[key];
      const hint = to !== undefined && allowed.includes(to) ? ` (it is now called ${to})` : "";
      throw new TypeError(`${fn}: unknown option "${key}"${hint}; the options are ${list}`);
    }
  }
  return options as T;
}

/** Check the keys of a nested input object (a family, summaries) the same way. */
export function checkKeys(x: object, allowed: readonly string[], what: string): void {
  for (const key of Object.keys(x)) {
    if (!allowed.includes(key)) throw new TypeError(`${what}: unknown key "${key}"; the keys are {${allowed.join(", ")}}`);
  }
}

/** 2^53: counts up to this are exact doubles. */
const TWO_53 = 2n ** 53n;

/** A count for display and JSON: a number up to 2^53, else its decimal string. */
export function countValue(x: bigint): number | string {
  return x <= TWO_53 ? Number(x) : x.toString();
}

/** Attach an exact BigInt as a non-enumerable property (kept out of JSON.stringify and deep-equality checks). */
export function attachExact<T extends object>(target: T, key: string, value: bigint): T {
  Object.defineProperty(target, key, { value, enumerable: false, writable: false, configurable: true });
  return target;
}

/** "1 report", "2 reports". */
export function plural(x: number | bigint | string, one: string, many = `${one}s`): string {
  return String(x) === "1" ? one : many;
}

/** maxTies: a positive integer or Infinity; default 100. */
export function checkMaxTies(x: number | undefined, fn: string): number {
  const v = x ?? 100;
  if (typeof v !== "number" || !(v === Number.POSITIVE_INFINITY || (Number.isSafeInteger(v) && v >= 1))) {
    throw new RangeError(`${fn}: maxTies must be a positive integer (or Infinity), got ${String(v)}`);
  }
  return v;
}
