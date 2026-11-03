// Shared test helpers: fixture loading and error measures.
import fs from "node:fs";
import path from "node:path";

export const FIXTURES = path.resolve(import.meta.dirname, "fixtures");

export function readFixture<T = Record<string, unknown>>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf8")) as T;
}

/** |got − ref| / |ref|; 0 when equal (including both 0). */
export function relErr(got: number, ref: number): number {
  if (got === ref) return 0;
  return Math.abs(got - ref) / Math.abs(ref);
}

/** Distance in units in the last place of `ref` (ulp of a double near ref). */
export function ulps(got: number, ref: number): number {
  if (got === ref) return 0;
  const ulp = 2 ** (Math.floor(Math.log2(Math.abs(ref))) - 52);
  return Math.abs(got - ref) / ulp;
}

/** Largest error of f over the pairs, with the argument where it occurs. */
export function maxError(xs: number[], f: (x: number, i: number) => number): { max: number; at: number } {
  let max = 0;
  let at = Number.NaN;
  xs.forEach((x, i) => {
    const e = f(x, i);
    if (!(e <= max)) {
      max = e;
      at = x;
    }
  });
  return { max, at };
}
