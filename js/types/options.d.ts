/**
 * Check an options argument: undefined or null gives {} (or throws when `required`), a non-object throws
 * "options object expected: {a, b, …}", and a key outside `allowed` throws naming it.
 */
export declare function readOptions<T extends object>(options: unknown, allowed: readonly string[], fn: string, required?: boolean): T;
/** Check the keys of a nested input object (a family, summaries) the same way. */
export declare function checkKeys(x: object, allowed: readonly string[], what: string): void;
/** A count for display and JSON: a number up to 2^53, else its decimal string. */
export declare function countValue(x: bigint): number | string;
/** Attach an exact BigInt as a non-enumerable property (kept out of JSON.stringify and deep-equality checks). */
export declare function attachExact<T extends object>(target: T, key: string, value: bigint): T;
/** "1 report", "2 reports". */
export declare function plural(x: number | bigint | string, one: string, many?: string): string;
/** maxTies: a positive integer or Infinity; default 100. */
export declare function checkMaxTies(x: number | undefined, fn: string): number;
