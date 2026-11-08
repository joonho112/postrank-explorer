import type { MdomainErrorCode } from "./error.ts";
/** Validate an ordinary transport record without reading inherited fields or getters. */
export declare function strictRecord(value: unknown, field: string, code: MdomainErrorCode): Record<string, unknown>;
/** Reject unknown fields; the caller validates every required field explicitly. */
export declare function exactKeys(record: Record<string, unknown>, allowedKeys: readonly string[], field: string, code: MdomainErrorCode): void;
export declare function nonblankString(value: unknown, field: string, code: MdomainErrorCode): string;
/** Dense JSON-style array of exactly the requested length; no values are coerced. */
export declare function exactArray(value: unknown, length: number, field: string, code: MdomainErrorCode): unknown[];
export declare function orderedIds(value: unknown, field: string, code: MdomainErrorCode): string[];
/** Validate exact identity/order; never sort, trim or realign supplied IDs. */
export declare function assertIdentity(value: unknown, expected: readonly string[], field: string): string[];
