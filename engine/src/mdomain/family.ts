// Author: JoonHo Lee (jlee296@ua.edu).

import { fail, MdomainError } from "./error.ts";
import { mdomainInput } from "./input.ts";
import { canonicalGradeVector } from "./grades.ts";
import { strictRecord, exactKeys, exactArray, nonblankString, orderedIds, assertIdentity } from "./validation.ts";
import type { CanonicalBank, CanonicalColumn, GradeMatrix, MdomainFamily, MdomainFamilySpec, MdomainInput, MdomainInputSpec } from "./types.ts";

const SPEC_FIELDS = ["familyId", "unitIds", "domainIds", "maxGrades", "maxActions", "banks"] as const;
const RUNTIME_FIELDS = ["sourceSpec", "constructionInput", "banks", "candidateCount"] as const;

function lexicographic(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

function canonicalFamilyColumn(input: MdomainInput, raw: unknown, domain: number, field: string): number[] {
  try {
    return canonicalGradeVector(input, raw, domain, field);
  } catch (error) {
    if (error instanceof MdomainError && error.code === "mdomainGradesInvalid") {
      fail("mdomainFamilyInvalid", error.field, error.message, error.details);
    }
    throw error;
  }
}

/** Own supplied banks, canonicalise complete columns and count their full product. */
export function mdomainFamily(input: MdomainInput, spec: MdomainFamilySpec): MdomainFamily {
  const constructionInput = mdomainInput(input);
  const record = strictRecord(spec, "family", "mdomainFamilyInvalid");
  exactKeys(record, SPEC_FIELDS, "family", "mdomainFamilyInvalid");
  const familyId = nonblankString(record.familyId, "family.familyId", "mdomainFamilyInvalid");
  const unitIds = assertIdentity(record.unitIds, constructionInput.unitIds, "family.unitIds");
  const domainIds = assertIdentity(record.domainIds, constructionInput.domainIds, "family.domainIds");
  const n = unitIds.length;
  const D = domainIds.length;
  const maxGrades = exactArray(record.maxGrades, D, "family.maxGrades", "mdomainFamilyInvalid").map((value, d) => {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > n) {
      fail("mdomainFamilyInvalid", `family.maxGrades[${d}]`, "The grade cap must be a positive safe integer no larger than the unit count.");
    }
    return value;
  });
  const maxActions = record.maxActions;
  if (typeof maxActions !== "number" || !Number.isSafeInteger(maxActions) || maxActions < 1) {
    fail("mdomainFamilyInvalid", "family.maxActions", "A positive safe integer action limit is required.");
  }
  if (maxActions > 256) {
    fail("mdomainResourceCap", "family.maxActions", "The browser action limit cannot exceed 256.", { maximum: 256 });
  }

  const bankRows = exactArray(record.banks, D, "family.banks", "mdomainFamilyInvalid");
  const banks: CanonicalBank[] = [];
  const sourceBanks: MdomainFamilySpec["banks"] = [];
  let candidateCount = 1;
  for (let d = 0; d < D; d += 1) {
    const field = `family.banks[${d}]`;
    const bank = strictRecord(bankRows[d], field, "mdomainFamilyInvalid");
    exactKeys(bank, ["domainId", "columns"], field, "mdomainFamilyInvalid");
    const domainId = nonblankString(bank.domainId, `${field}.domainId`, "mdomainFamilyInvalid");
    if (domainId !== domainIds[d]) {
      fail("mdomainIdentityMismatch", `${field}.domainId`, "Banks must match the input's domain order exactly.");
    }
    if (!Array.isArray(bank.columns)) {
      fail("mdomainFamilyInvalid", `${field}.columns`, "An explicit column array is required.");
    }
    if (bank.columns.length > 256) {
      fail("mdomainResourceCap", `${field}.columns`, "A raw bank cannot contain more than 256 supplied columns.", { maximum: 256 });
    }
    const supplied = exactArray(bank.columns, bank.columns.length, `${field}.columns`, "mdomainFamilyInvalid");
    const sourceColumns: MdomainFamilySpec["banks"][number]["columns"] = [];
    const rawIds = new Set<string>();
    const canonical = new Map<string, CanonicalColumn>();
    for (let c = 0; c < supplied.length; c += 1) {
      const columnField = `${field}.columns[${c}]`;
      const column = strictRecord(supplied[c], columnField, "mdomainFamilyInvalid");
      exactKeys(column, ["columnId", "grades"], columnField, "mdomainFamilyInvalid");
      const alias = nonblankString(column.columnId, `${columnField}.columnId`, "mdomainFamilyInvalid");
      if (rawIds.has(alias)) {
        fail("mdomainFamilyInvalid", `${columnField}.columnId`, "Supplied column IDs must be unique within each bank.");
      }
      rawIds.add(alias);
      const grades = canonicalFamilyColumn(constructionInput, column.grades, d, `${columnField}.grades`);
      if (Math.max(...grades) > maxGrades[d]) {
        fail("mdomainFamilyInvalid", `${columnField}.grades`, "A supplied column exceeds its declared grade cap.");
      }
      const rawGrades = exactArray(column.grades, n, `${columnField}.grades`, "mdomainFamilyInvalid").map((value) => value as number);
      sourceColumns.push({ columnId: alias, grades: rawGrades });
      const columnId = `g:${grades.join(",")}`;
      const existing = canonical.get(columnId);
      if (existing) existing.aliases.push(alias);
      else canonical.set(columnId, { columnId, aliases: [alias], grades });
    }
    const withheld = new Array<number>(n).fill(1);
    const withheldId = `g:${withheld.join(",")}`;
    if (!canonical.has(withheldId)) {
      canonical.set(withheldId, { columnId: withheldId, aliases: [], grades: withheld });
    }
    const columns = [...canonical.values()].sort((a, b) => lexicographic(a.grades, b.grades));
    candidateCount *= columns.length;
    if (candidateCount > maxActions || candidateCount > 256) {
      fail("mdomainResourceCap", "family.maxActions", "The complete canonical product exceeds the action limit; no cards were enumerated.", {
        candidateCount, maxActions,
      });
    }
    banks.push({ domainId, columns });
    sourceBanks.push({ domainId, columns: sourceColumns });
  }
  const sourceSpec: MdomainFamilySpec = { familyId, unitIds, domainIds, maxGrades, maxActions, banks: sourceBanks };
  return { sourceSpec, constructionInput, banks, candidateCount };
}

function constructionFrom(value: unknown): MdomainInput {
  try {
    return mdomainInput(value as MdomainInputSpec);
  } catch (error) {
    if (error instanceof MdomainError) {
      fail("mdomainFamilyInvalid", "family.constructionInput", "The stored construction input is invalid; rebuild the family.", {
        causeCode: error.code, causeField: error.field,
      });
    }
    throw error;
  }
}

function checkDerivedBanks(value: unknown, expected: CanonicalBank[], n: number): void {
  const banks = exactArray(value, expected.length, "family.banks", "mdomainFamilyInvalid");
  for (let d = 0; d < expected.length; d += 1) {
    const field = `family.banks[${d}]`;
    const bank = strictRecord(banks[d], field, "mdomainFamilyInvalid");
    exactKeys(bank, ["domainId", "columns"], field, "mdomainFamilyInvalid");
    if (bank.domainId !== expected[d].domainId) {
      fail("mdomainIdentityMismatch", `${field}.domainId`, "Stored canonical bank identities have changed.");
    }
    const columns = exactArray(bank.columns, expected[d].columns.length, `${field}.columns`, "mdomainFamilyInvalid");
    for (let c = 0; c < columns.length; c += 1) {
      const columnField = `${field}.columns[${c}]`;
      const column = strictRecord(columns[c], columnField, "mdomainFamilyInvalid");
      exactKeys(column, ["columnId", "aliases", "grades"], columnField, "mdomainFamilyInvalid");
      const wanted = expected[d].columns[c];
      if (column.columnId !== wanted.columnId) {
        fail("mdomainFamilyInvalid", `${columnField}.columnId`, "The canonical column ID or order has changed.");
      }
      const aliases = exactArray(column.aliases, wanted.aliases.length, `${columnField}.aliases`, "mdomainFamilyInvalid");
      if (aliases.some((alias, i) => alias !== wanted.aliases[i])) {
        fail("mdomainFamilyInvalid", `${columnField}.aliases`, "Canonical aliases do not match the supplied source columns.");
      }
      const grades = exactArray(column.grades, n, `${columnField}.grades`, "mdomainFamilyInvalid");
      if (grades.some((grade, i) => grade !== wanted.grades[i])) {
        fail("mdomainFamilyInvalid", `${columnField}.grades`, "Canonical grades do not match the supplied source columns.");
      }
    }
  }
}

/** Rebuild all derived content and reject a family bound to a different full input. */
export function validateFamily(input: MdomainInput, family: MdomainFamily): MdomainFamily {
  const checkedInput = mdomainInput(input);
  const record = strictRecord(family, "family", "mdomainFamilyInvalid");
  exactKeys(record, RUNTIME_FIELDS, "family", "mdomainFamilyInvalid");
  const construction = constructionFrom(record.constructionInput);
  if (JSON.stringify(construction) !== JSON.stringify(checkedInput)) {
    fail("mdomainIdentityMismatch", "family.constructionInput", "This family was constructed for a different input specification; rebuild it.");
  }
  const rebuilt = mdomainFamily(checkedInput, record.sourceSpec as MdomainFamilySpec);
  if (record.candidateCount !== rebuilt.candidateCount) {
    fail("mdomainFamilyInvalid", "family.candidateCount", "The stored candidate count has changed.");
  }
  checkDerivedBanks(record.banks, rebuilt.banks, checkedInput.unitIds.length);
  return rebuilt;
}

/** Content key for a canonical unit-by-domain matrix, with or without its IDs. */
export function candidateKey(card: GradeMatrix | number[][]): string {
  let rows: unknown;
  let n: number;
  let D: number;
  if (Array.isArray(card)) {
    rows = card;
    n = card.length;
    D = Array.isArray(card[0]) ? card[0].length : 0;
  } else {
    const record = strictRecord(card, "grades", "mdomainGradesInvalid");
    exactKeys(record, ["unitIds", "domainIds", "values"], "grades", "mdomainGradesInvalid");
    n = orderedIds(record.unitIds, "grades.unitIds", "mdomainGradesInvalid").length;
    D = orderedIds(record.domainIds, "grades.domainIds", "mdomainGradesInvalid").length;
    rows = record.values;
  }
  if (n < 2 || n > 4 || D < 1 || D > 2) {
    fail("mdomainGradesInvalid", "grades.values", "A canonical matrix within the declared dimensions is required.");
  }
  const matrix = exactArray(rows, n, "grades.values", "mdomainGradesInvalid")
    .map((row, i) => exactArray(row, D, `grades.values[${i}]`, "mdomainGradesInvalid"));
  const columns: string[] = [];
  for (let d = 0; d < D; d += 1) {
    const column: number[] = [];
    for (let i = 0; i < n; i += 1) {
      const grade = matrix[i][d];
      if (typeof grade !== "number" || !Number.isSafeInteger(grade) || grade < 1 || grade > n) {
        fail("mdomainGradesInvalid", `grades.values[${i}][${d}]`, "Candidate keys require canonical positive integer grades.");
      }
      column.push(grade);
    }
    if (new Set(column).size !== Math.max(...column)) {
      fail("mdomainGradesInvalid", `grades.column[${d}]`, "Candidate key grades must use every occupied label from one.");
    }
    columns.push(column.join(","));
  }
  return `p:${columns.join("|")}`;
}

/** Enumerate the complete bounded product, first domain most significant. */
export function enumerateCards(family: MdomainFamily): GradeMatrix[] {
  const record = strictRecord(family, "family", "mdomainFamilyInvalid");
  const checked = validateFamily(constructionFrom(record.constructionInput), family);
  const { unitIds, domainIds } = checked.constructionInput;
  const selected: number[][] = [];
  const cards: GradeMatrix[] = [];
  const visit = (domain: number): void => {
    if (domain === domainIds.length) {
      cards.push({
        unitIds: [...unitIds], domainIds: [...domainIds],
        values: unitIds.map((_, i) => domainIds.map((_, d) => selected[d][i])),
      });
      return;
    }
    for (const column of checked.banks[domain].columns) {
      selected[domain] = column.grades;
      visit(domain + 1);
    }
  };
  visit(0);
  return cards;
}
