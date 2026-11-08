// Author: JoonHo Lee (jlee296@ua.edu).
import { formatCount } from "../format.js";

/** Preserve the content key while recording every embedded grade as a numeric value. */
export function candidateIdNode(ctx, id) {
  if (typeof id !== "string" || !/^p:[1-9]\d*(?:,[1-9]\d*)*(?:\|[1-9]\d*(?:,[1-9]\d*)*)*$/.test(id)) throw new TypeError("A canonical profile candidate key is required.");
  const columns = id.slice(2).split("|").map((column) => column.split(",").map(Number));
  const n = columns[0].length;
  if (columns.some((column) => column.length !== n || column.some((g) => !Number.isSafeInteger(g) || g > n) || new Set(column).size !== Math.max(...column))) throw new TypeError("A canonical profile candidate key is required.");
  const node = ctx.h("span", { "data-prx-mdomain-candidate-id": id }, "p:");
  columns.forEach((column, d) => {
    if (d) node.append("|");
    column.forEach((g, i) => { if (i) node.append(","); node.append(ctx.num(g, formatCount(g))); });
  });
  return node;
}

export function resultScopeNode(ctx, result, { kind = "fit", part = "profile-scope" } = {}) {
  let node;
  if (kind === "stored") {
    node = ctx.h("p", { "data-prx-mdomain-scope": "stored_display" }, "The app displays a saved profile report.");
  } else if (kind === "fixed") {
    node = ctx.h("p", { "data-prx-mdomain-scope": "fixed_card" }, "Evaluation of the grades shown here.");
  } else if (kind === "subset") {
    if (result?.scope !== "listed_subset" || !Array.isArray(result.candidateIds)) throw new TypeError("A listed-subset result is required.");
    node = ctx.h("p", { "data-prx-mdomain-scope": "listed_subset" }, "Minimum loss among ", ctx.num(result.candidateIds.length, formatCount(result.candidateIds.length)), " listed cards.");
  } else {
    const scope = result?.searchScope;
    if (scope?.type !== "declared_cartesian_product" || scope.fullProductExamined !== true || scope.unrestrictedOptimalityClaim !== false || scope.candidateCount !== scope.examinedActions) {
      throw new TypeError("A complete declared-product search result is required.");
    }
    node = ctx.h("p", { "data-prx-mdomain-scope": "candidate_restricted" }, "Minimum loss among ", ctx.num(scope.candidateCount, formatCount(scope.candidateCount)), " profile cards, covering every combination of the domain columns.");
  }
  return ctx.part(part, node);
}

export function optimizerSummaryNode(ctx, fit, { part = "profile-optimizers" } = {}) {
  if (!Array.isArray(fit?.optimizerIds) || fit.optimizerIds.length === 0 || !fit.optimizerIds.includes(fit.selectedId)) throw new TypeError("A complete optimizer set and its selected representative are required.");
  const count = fit.optimizerIds.length;
  const list = ctx.h("ul", {}, ...fit.optimizerIds.map((id) => ctx.h("li", {}, candidateIdNode(ctx, id), id === fit.selectedId ? " — displayed by default" : "")));
  return ctx.part(part, ctx.h("div", { "data-prx-mdomain-optimizers": true },
    ctx.h("p", {}, ctx.num(count, formatCount(count)), count === 1 ? " card attains the minimum loss." : " cards tie for the minimum loss."), list));
}
