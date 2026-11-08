// Author: JoonHo Lee (jlee296@ua.edu).
// Views of supplied grades/results only; no optimization or feasibility calculation.
import { formatCount, formatGrades } from "../format.js";
import { exactNum } from "./format.js";
import { candidateIdNode } from "./labels.js";

const named = (ctx, value) => ctx.h("span", { "data-prx-name": true }, String(value));
const count = (ctx, value) => ctx.num(value, formatCount(value));
const label = (labels, id) => labels?.[id] ?? id;

function card(value) {
  if (!value || !Array.isArray(value.unitIds) || !Array.isArray(value.domainIds) || !Array.isArray(value.values)) throw new TypeError("A named unit-by-domain grade matrix is required.");
  const { unitIds, domainIds, values } = value;
  if (unitIds.length === 0 || domainIds.length === 0 || new Set(unitIds).size !== unitIds.length || new Set(domainIds).size !== domainIds.length || values.length !== unitIds.length) throw new TypeError("Grade identities and dimensions must agree.");
  if ([...unitIds, ...domainIds].some((id) => typeof id !== "string" || !id.trim())) throw new TypeError("Nonblank grade IDs are required.");
  if (values.some((row) => !Array.isArray(row) || row.length !== domainIds.length || row.some((g) => !Number.isSafeInteger(g) || g < 1))) throw new TypeError("Canonical integer grades are required.");
  for (let d = 0; d < domainIds.length; d += 1) {
    const column = values.map((row) => row[d]);
    if (new Set(column).size !== Math.max(...column)) throw new TypeError("Grade labels must be consecutive from one.");
  }
  return value;
}

function table(ctx, headers, rows, { caption, part }) {
  const head = ctx.h("thead", {}, ctx.h("tr", {}, ...headers.map((header) => ctx.h("th", { scope: "col" }, header))));
  const body = ctx.h("tbody", {}, ...rows);
  const node = ctx.h("table", { style: { width: "max-content", "min-width": "100%", "max-width": "none" } }, ctx.h("caption", {}, caption), head, body);
  for (const cell of node.querySelectorAll("th, td")) cell.style.setProperty("white-space", "nowrap");
  const wrapper = ctx.h("div", { class: "prx-data-table prx-mdomain-table", style: { "overflow-x": "auto", "max-width": "100%", "min-width": "0" } }, node);
  return ctx.part(part, ctx.scrollRegion(wrapper, caption));
}

export function gradeTable(ctx, supplied, options = {}) {
  const grades = card(supplied);
  const rows = grades.unitIds.map((id, i) => {
    const content = options.onSelectUnit
      ? ctx.h("button", { type: "button", class: "prx-btn", "data-prx-focus-key": `profile-unit:${id}`, "aria-pressed": id === options.selectedUnit ? "true" : "false", onclick: () => options.onSelectUnit(id) }, named(ctx, label(options.unitLabels, id)))
      : named(ctx, label(options.unitLabels, id));
    return ctx.h("tr", { "data-prx-mdomain-unit": id }, ctx.h("th", { scope: "row" }, content), ...grades.values[i].map((g) => ctx.h("td", {}, count(ctx, g))));
  });
  return table(ctx, ["Unit", ...grades.domainIds.map((id) => named(ctx, label(options.domainLabels, id)))], rows, { caption: options.caption ?? "Grades by domain", part: options.part ?? "profile-grades" });
}

export function profileCells(supplied, { columnDomain = 0, rowDomain = 1 } = {}) {
  const grades = card(supplied);
  if (columnDomain === rowDomain || !Number.isInteger(columnDomain) || !Number.isInteger(rowDomain) || !grades.domainIds[columnDomain] || !grades.domainIds[rowDomain]) throw new TypeError("Two distinct declared grid domains are required.");
  const columns = Math.max(...grades.values.map((row) => row[columnDomain]));
  const rows = Math.max(...grades.values.map((row) => row[rowDomain]));
  return Array.from({ length: rows }, (_, r) => Array.from({ length: columns }, (_, c) => {
    const members = grades.unitIds.filter((_, i) => grades.values[i][columnDomain] === c + 1 && grades.values[i][rowDomain] === r + 1);
    return { rowGrade: r + 1, columnGrade: c + 1, count: members.length, members };
  })).flat();
}

export function profileGrid(ctx, supplied, options = {}) {
  const grades = card(supplied);
  const columnDomain = options.columnDomain ?? 0, rowDomain = options.rowDomain ?? 1;
  const cells = profileCells(grades, { columnDomain, rowDomain });
  const nColumns = Math.max(...cells.map((cell) => cell.columnGrade));
  const nRows = Math.max(...cells.map((cell) => cell.rowGrade));
  const columnLabel = label(options.domainLabels, grades.domainIds[columnDomain]);
  const rowLabel = label(options.domainLabels, grades.domainIds[rowDomain]);
  const headers = [named(ctx, `${rowLabel} / ${columnLabel}`), ...Array.from({ length: nColumns }, (_, c) => ctx.h("span", {}, named(ctx, columnLabel), " grade ", count(ctx, c + 1)))];
  const focusCell = cells.find((cell) => cell.members.includes(options.selectedUnit)) ?? cells[0];
  const rows = Array.from({ length: nRows }, (_, r) => ctx.h("tr", {},
    ctx.h("th", { scope: "row" }, named(ctx, rowLabel), " grade ", count(ctx, r + 1)),
    ...cells.filter((cell) => cell.rowGrade === r + 1).map((cell) => {
      const members = ctx.h("span", { "data-prx-name": true }, cell.members.join(", ") || "No units");
      const content = [count(ctx, cell.count), cell.count === 1 ? " unit: " : " units: ", members];
      const selected = cell.members.includes(options.selectedUnit);
      const node = options.onSelectCell ? ctx.h("button", { type: "button", class: selected ? "prx-btn prx-btn-primary" : "prx-btn", "data-prx-focus-key": `profile-cell:${cell.rowGrade}:${cell.columnGrade}`, "aria-pressed": selected ? "true" : "false", "data-prx-profile-grid-cell": true,
        tabindex: cell === focusCell ? 0 : -1,
        "aria-label": `${rowLabel} grade ${cell.rowGrade}; ${columnLabel} grade ${cell.columnGrade}. ${cell.count} ${cell.count === 1 ? "unit" : "units"}: ${cell.members.join(", ") || "No units"}.`,
        onkeydown: (event) => {
          const shifts = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] };
          const shift = shifts[event.key]; if (!shift) return; event.preventDefault();
          const rr = (cell.rowGrade - 1 + shift[0] + nRows) % nRows + 1;
          const cc = (cell.columnGrade - 1 + shift[1] + nColumns) % nColumns + 1;
          const table = event.currentTarget.closest("table");
          const target = table.querySelector(`[data-prx-focus-key="profile-cell:${rr}:${cc}"]`);
          for (const button of table.querySelectorAll("[data-prx-profile-grid-cell]")) button.tabIndex = button === target ? 0 : -1;
          target?.focus({ preventScroll: true });
        },
        onclick: () => options.onSelectCell({ ...cell, members: [...cell.members] }) }, ...content) : ctx.h("span", {}, ...content);
      return ctx.h("td", { "data-prx-mdomain-cell": `${cell.rowGrade},${cell.columnGrade}` }, node);
    })));
  return table(ctx, headers, rows, { caption: options.caption ?? "Profile cells: row and column grades are domain specific", part: options.part ?? "profile-cells" });
}

export function pairRows(supplied) {
  const grades = card(supplied), rows = [];
  if (grades.domainIds.length > 2) throw new TypeError("Pair classifications support at most two domains.");
  for (let i = 0; i < grades.unitIds.length; i += 1) {
    for (let j = i + 1; j < grades.unitIds.length; j += 1) {
      const directions = grades.domainIds.map((_, d) => grades.values[i][d] < grades.values[j][d] ? 1 : grades.values[i][d] > grades.values[j][d] ? -1 : 0);
      let classification;
      if (directions.every((d) => d === 0)) classification = "neither";
      else if (directions[0] === 0) classification = "second_only";
      else if (directions.length === 1 || directions[1] === 0) classification = "first_only";
      else classification = directions[0] === directions[1] ? "same_direction" : "crossed";
      rows.push({ pairId: JSON.stringify([grades.unitIds[i], grades.unitIds[j]]), unitA: grades.unitIds[i], unitB: grades.unitIds[j], directions, classification });
    }
  }
  return rows;
}

export function pairTable(ctx, supplied, options = {}) {
  const grades = card(supplied);
  const descriptions = { neither: "Directions withheld in every domain", first_only: "Disclosed only in the first domain", second_only: "Disclosed only in the second domain", same_direction: "Same reported direction in both domains", crossed: "Opposite reported directions" };
  const rows = pairRows(grades).filter((row) => !options.units || options.units.includes(row.unitA) && options.units.includes(row.unitB)).map((row) => ctx.h("tr", {},
    ctx.h("th", { scope: "row" }, named(ctx, `${label(options.unitLabels, row.unitA)} / ${label(options.unitLabels, row.unitB)}`)),
    ...row.directions.map((direction) => ctx.h("td", {}, named(ctx, direction === 0 ? "Direction withheld" : `${label(options.unitLabels, direction === 1 ? row.unitA : row.unitB)} above ${label(options.unitLabels, direction === 1 ? row.unitB : row.unitA)}`))),
    ctx.h("td", {}, descriptions[row.classification])));
  return table(ctx, ["Pair", ...grades.domainIds.map((id) => named(ctx, label(options.domainLabels, id))), "Reported comparison"], rows, { caption: options.caption ?? "Pair directions within each domain", part: options.part ?? "profile-pairs" });
}

export function candidateTable(ctx, fit, options = {}) {
  if (!Array.isArray(fit?.candidateTable) || fit.candidateTable.length === 0) throw new TypeError("A complete candidate table is required.");
  const domains = fit.candidateTable[0].grades.domainIds;
  const showJoint = options.jointEnabled !== false;
  const headers = ["Candidate", ...domains.map((id) => named(ctx, `${label(options.domainLabels, id)} grades`)), "Expected loss", ...(showJoint ? ["Joint-event probability"] : []), "Feasibility", "Optimality", "Representative"];
  const rows = fit.candidateTable.map((row) => {
    const grades = card(row.grades);
    const id = candidateIdNode(ctx, row.candidateId);
    const identity = options.onSelectCandidate ? ctx.h("button", { type: "button", class: "prx-btn", "data-prx-focus-key": `profile-candidate:${row.candidateId}`, "aria-pressed": options.focusedId === row.candidateId ? "true" : "false", onclick: () => options.onSelectCandidate(row.candidateId, row) }, id) : id;
    return ctx.h("tr", { "data-prx-mdomain-candidate": row.candidateId }, ctx.h("th", { scope: "row" }, identity),
      ...domains.map((_, d) => { const vector = grades.values.map((values) => values[d]); return ctx.h("td", {}, ctx.num(vector, formatGrades(vector))); }),
      ctx.h("td", {}, exactNum(ctx, row.riskExact)), ...(showJoint ? [ctx.h("td", {}, exactNum(ctx, row.jointProbabilityExact))] : []),
      ctx.h("td", {}, row.feasible ? "Feasible" : "Infeasible"), ctx.h("td", {}, row.optimal ? "Minimum loss" : ""), ctx.h("td", {}, row.selected ? "Displayed by default" : ""));
  });
  return table(ctx, headers, rows, { caption: options.caption ?? "All declared candidate cards", part: options.part ?? "profile-candidates" });
}
