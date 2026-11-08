// Author: JoonHo Lee (jlee296@ua.edu).

import { fail } from "./error.ts";
import type { MdomainErrorCode } from "./error.ts";

/** Validate an ordinary transport record without reading inherited fields or getters. */
export function strictRecord(value: unknown, field: string, code: MdomainErrorCode): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(code, field, "An ordinary object is required.");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail(code, field, "An ordinary object is required.");
  }
  const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") fail(code, field, "Symbol properties are not transport fields.");
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      fail(code, `${field}.${key}`, "Transport fields must be enumerable data properties.");
    }
    result[key] = descriptor.value;
  }
  return result;
}

/** Reject unknown fields; the caller validates every required field explicitly. */
export function exactKeys(record: Record<string, unknown>, allowedKeys: readonly string[], field: string, code: MdomainErrorCode): void {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) fail(code, `${field}.${key}`, "Unknown transport field.");
  }
}

export function nonblankString(value: unknown, field: string, code: MdomainErrorCode): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(code, field, "A nonblank string is required.");
  }
  return value;
}

/** Dense JSON-style array of exactly the requested length; no values are coerced. */
export function exactArray(value: unknown, length: number, field: string, code: MdomainErrorCode): unknown[] {
  if (!Array.isArray(value) || value.length !== length) {
    fail(code, field, "An array of the exact declared length is required.", { expectedLength: length });
  }
  for (let i = 0; i < length; i += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      fail(code, `${field}[${i}]`, "Dense array entries must be enumerable data properties.");
    }
  }
  for (const key of Reflect.ownKeys(value)) {
    if (key === "length") continue;
    if (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length) {
      fail(code, field, "Array properties outside the declared entries are not supported.");
    }
  }
  return value;
}

export function orderedIds(value: unknown, field: string, code: MdomainErrorCode): string[] {
  if (!Array.isArray(value)) fail(code, field, "An ordered ID array is required.");
  const entries = exactArray(value, value.length, field, code);
  const ids: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < entries.length; i += 1) {
    const id = nonblankString(entries[i], `${field}[${i}]`, code);
    if (seen.has(id)) fail(code, `${field}[${i}]`, "IDs must be unique within their ordered vector.");
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/** Validate exact identity/order; never sort, trim or realign supplied IDs. */
export function assertIdentity(value: unknown, expected: readonly string[], field: string): string[] {
  const entries = exactArray(value, expected.length, field, "mdomainIdentityMismatch");
  const ids = orderedIds(entries, field, "mdomainIdentityMismatch");
  if (ids.some((id, i) => id !== expected[i])) {
    fail("mdomainIdentityMismatch", field, "IDs must match the input's declared order exactly.", {
      expected: [...expected], actual: ids,
    });
  }
  return ids;
}
