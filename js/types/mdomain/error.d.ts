/** Typed browser validation errors; independent of R native error names. */
export type MdomainErrorCode = "mdomainInputInvalid" | "mdomainIdentityMismatch" | "mdomainPolicyInvalid" | "mdomainGradesInvalid" | "mdomainFamilyInvalid" | "mdomainResourceCap" | "mdomainUnsupported";
export type JsonValue = null | boolean | number | string | JsonValue[] | {
    [key: string]: JsonValue;
};
export declare class MdomainError extends Error {
    readonly code: MdomainErrorCode;
    readonly field: string;
    readonly details?: JsonValue;
    constructor(code: MdomainErrorCode, field: string, message: string, details?: JsonValue);
    toJSON(): {
        code: MdomainErrorCode;
        field: string;
        message: string;
        details?: JsonValue;
    };
}
export declare function fail(code: MdomainErrorCode, field: string, message: string, details?: JsonValue): never;
