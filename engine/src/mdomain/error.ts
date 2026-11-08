/** Typed browser validation errors; independent of R native error names. */
export type MdomainErrorCode =
  | "mdomainInputInvalid"
  | "mdomainIdentityMismatch"
  | "mdomainPolicyInvalid"
  | "mdomainGradesInvalid"
  | "mdomainFamilyInvalid"
  | "mdomainResourceCap"
  | "mdomainUnsupported";

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/** Copy only JSON-safe diagnostic details. Unsafe diagnostics are optional and omitted. */
function copyDetails(details: unknown): JsonValue | undefined {
  const seen = new Set<object>();
  const copy = (value: unknown): JsonValue => {
    if (value === null || typeof value === "boolean" || typeof value === "string") return value;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "object") throw new TypeError("Non-JSON diagnostic value.");
    if (seen.has(value)) throw new TypeError("Cyclic diagnostic value.");
    seen.add(value);
    try {
      if (Array.isArray(value)) return value.map(copy);
      if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
        throw new TypeError("Non-JSON diagnostic object.");
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)]));
    } finally { seen.delete(value); }
  };
  try { return copy(details); } catch { return undefined; }
}

export class MdomainError extends Error {
  readonly code: MdomainErrorCode;
  readonly field: string;
  readonly details?: JsonValue;

  constructor(code: MdomainErrorCode, field: string, message: string, details?: JsonValue) {
    super(message);
    this.name = "MdomainError";
    this.code = code;
    this.field = field;
    if (details !== undefined) {
      const safe = copyDetails(details);
      if (safe !== undefined) this.details = safe;
    }
  }

  toJSON(): { code: MdomainErrorCode; field: string; message: string; details?: JsonValue } {
    return {
      code: this.code,
      field: this.field,
      message: this.message,
      ...(this.details === undefined ? {} : { details: this.details }),
    };
  }
}

export function fail(code: MdomainErrorCode, field: string, message: string, details?: JsonValue): never {
  throw new MdomainError(code, field, message, details);
}
