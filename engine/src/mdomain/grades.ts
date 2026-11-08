// Author: JoonHo Lee (jlee296@ua.edu).

import { fail } from "./error.ts";
import { mdomainInput } from "./input.ts";
import { strictRecord, exactKeys, exactArray, assertIdentity } from "./validation.ts";
import type { GradeMatrix, MdomainInput } from "./types.ts";

/** Internal column validator; its caller supplies a freshly validated input. */
export function canonicalGradeVector(input: MdomainInput, raw: unknown, domainIndex: number, field = "grades"): number[] {
  if (!Number.isInteger(domainIndex) || domainIndex < 0 || domainIndex >= input.domainIds.length) {
    fail("mdomainGradesInvalid", field, "A declared domain index is required.");
  }
  const entries = exactArray(raw, input.unitIds.length, field, "mdomainGradesInvalid");
  const labels: number[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    const label = entries[i];
    if (typeof label !== "number" || !Number.isSafeInteger(label)) {
      fail("mdomainGradesInvalid", `${field}[${i}]`, "Raw grade labels must be safe integers.");
    }
    labels.push(label);
  }
  const ordered = [...new Set(labels)].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  const ranks = new Map(ordered.map((label, index) => [label, index + 1]));
  const result = labels.map((label) => ranks.get(label)!);
  const classes = input.targets[domainIndex].equalityClasses;
  const classGrades = new Map<string, number>();
  for (let i = 0; i < result.length; i += 1) {
    const label = classes[i];
    if (classGrades.has(label) && classGrades.get(label) !== result[i]) {
      fail("mdomainGradesInvalid", `${field}[${i}]`, "Units in a declared structural class must receive the same grade.");
    }
    classGrades.set(label, result[i]);
  }
  return result;
}

/** Revalidate the current input, then own and canonicalise a named unit-by-domain card. */
export function mdomainGrades(input: MdomainInput, grades: GradeMatrix): GradeMatrix {
  const checkedInput = mdomainInput(input);
  const record = strictRecord(grades, "grades", "mdomainGradesInvalid");
  exactKeys(record, ["unitIds", "domainIds", "values"], "grades", "mdomainGradesInvalid");
  const unitIds = assertIdentity(record.unitIds, checkedInput.unitIds, "grades.unitIds");
  const domainIds = assertIdentity(record.domainIds, checkedInput.domainIds, "grades.domainIds");
  const rows = exactArray(record.values, unitIds.length, "grades.values", "mdomainGradesInvalid");
  const supplied: unknown[][] = rows.map((row, i) => exactArray(row, domainIds.length, `grades.values[${i}]`, "mdomainGradesInvalid"));
  const columns = domainIds.map((_, d) => canonicalGradeVector(checkedInput, supplied.map((row) => row[d]), d, `grades.column[${d}]`));
  const values = unitIds.map((_, i) => domainIds.map((_, d) => columns[d][i]));
  return { unitIds, domainIds, values };
}
