// table.js: accessible data and audit tables with sticky labels, scroll regions, and value formatters.
// Never uses axis tickLabel on table cells (so small positive values never collapse to "0").

import * as FMT from "./format.js";

/**
 * @typedef {object} DataTableColumn
 * @property {string | number} [key] Property key or array index on each row.
 * @property {any} [label] Column header content (<th scope="col">).
 * @property {any} [header] Alias of label.
 * @property {"left" | "right" | "center"} [align] Horizontal alignment.
 * @property {boolean} [rowHeader] Render body cells in this column as <th scope="row">.
 * @property {boolean} [numeric] Explicitly treat cell values as numeric (attaching data-num via setNum).
 * @property {boolean} [name] Mark text cells with data-prx-name="" when displaying unit/criterion identifiers.
 * @property {string | ((val: any, row: any, rowIndex: number) => any)} [format] Named formatter kind or custom formatter.
 * @property {string} [kind] Named formatter kind ("prob" | "readoutProb" | "risk" | "readoutRisk" | "share" | "expected" | "est" | "count" | "setting" | "sig" | "decimal" | "sci" | "exact").
 * @property {(row: any, rowIndex: number) => any} [value] Cell value extractor.
 * @property {(row: any, rowIndex: number) => any} [raw] Raw value override for data-num.
 * @property {(val: any, row: any, rowIndex: number) => any} [render] Custom DOM node/content renderer.
 * @property {string | ((row: any, rowIndex: number) => string | null | undefined)} [hook] Optional data-prx-readout hook.
 * @property {string} [className] Optional CSS class on header and body cells.
 * @property {number} [sig] Significant digits for "sig" / "sci" kinds.
 * @property {number} [digits] Decimal places for "decimal" / "exact" kinds.
 * @property {object} [exactOptions] Options passed to formatExactText for "exact" kind.
 */

const NUMERIC_KINDS = new Set([
  "prob", "readoutProb", "risk", "readoutRisk", "share", "expected",
  "readoutExpected", "est", "count", "setting", "sig", "decimal", "sci", "exact",
]);

const isNode = (x) => x !== null && typeof x === "object" && typeof x.nodeType === "number";
const isStyleRecord = (x) => x !== null && typeof x === "object" && !Array.isArray(x);

/**
 * Plain text of nested string/node content.
 * @param {any} content
 * @returns {string}
 */
function contentText(content) {
  return [content]
    .flat(Infinity)
    .filter((c) => c !== null && c !== undefined && c !== false)
    .map((c) => (isNode(c) ? c.textContent ?? "" : String(c)))
    .join("");
}

/**
 * Fallback DOM element factory when a bare Document/Element is passed instead of widget ctx.
 * @param {Document} doc
 */
function fallbackFactory(doc) {
  return (tag, attrs = {}, ...children) => {
    const node = doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs ?? {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === "class") node.className = String(v);
      else if (k === "text") node.textContent = String(v);
      else if (k === "style" && isStyleRecord(v)) {
        for (const [p, s] of Object.entries(v)) node.style.setProperty(p, String(s));
      } else node.setAttribute(k, v === true ? "" : String(v));
    }
    appendContent(node, children);
    return node;
  };
}

/**
 * Mark a standalone element as a keyboard scroll region when ctx.scrollRegion is not present.
 * @param {HTMLElement} node
 * @param {string} regionLabel
 */
function fallbackScrollRegion(node, regionLabel) {
  node.classList.add("prx-scroll-region");
  node.setAttribute("tabindex", "0");
  node.setAttribute("role", "region");
  node.setAttribute("aria-label", regionLabel);
  return node;
}

/**
 * @param {any} target
 * @returns {Document}
 */
function docOf(target) {
  const d = target?.doc ?? (target?.nodeType === 9 ? target : target?.ownerDocument) ?? globalThis.document;
  if (!d) throw new TypeError("table: pass a widget ctx, an element, or a document");
  return d;
}

/**
 * Resolve a named value formatter (never tickLabel).
 * @param {string | undefined} kind
 * @param {DataTableColumn} col
 * @returns {((v: any) => string) | null}
 */
function resolveKindFormatter(kind, col) {
  if (!kind) return null;
  switch (kind) {
    case "prob": return (v) => FMT.formatProb(v);
    case "readoutProb": return (v) => (FMT.formatReadoutProb ?? FMT.formatProb)(v);
    case "risk": return (v) => FMT.formatRisk(v);
    case "readoutRisk": return (v) => (FMT.formatReadoutRisk ?? FMT.formatRisk)(v);
    case "share": return (v) => FMT.formatShare(v);
    case "expected": return (v) => FMT.formatExpectedCount(v);
    case "readoutExpected": return (v) => (FMT.formatReadoutExpected ?? FMT.formatExpectedCount)(v);
    case "est": return (v) => (FMT.formatReadoutEst ?? ((x) => FMT.formatSig(x, { sig: 3 })))(v);
    case "count": return (v) => FMT.formatCount(v);
    case "setting": return (v) => FMT.formatSetting(v);
    case "sig": return (v) => (v === 0 ? "0" : FMT.formatSig(v, { sig: col.sig ?? 4 }));
    case "sci": return (v) => (v === 0 ? "0" : FMT.formatSci(v, { sig: col.sig ?? 3 }));
    case "decimal": {
      const digits = col.digits ?? 4;
      const floor = 0.5 * 10 ** -digits;
      return (v) => {
        if (typeof v !== "number" || !Number.isFinite(v)) return FMT.NA;
        if (v === 0) return "0";
        // Never round a non-zero small value to ".0000".
        if (Math.abs(v) < floor) return FMT.formatSci(v, { sig: 3 });
        return FMT.formatDecimal(v, { digits });
      };
    }
    case "exact":
      return (v) => FMT.formatExactText(v, col.exactOptions ?? (col.digits !== undefined ? { digits: col.digits } : {}));
    default:
      return null;
  }
}

/**
 * Default numeric display when a column has numeric values without an explicit kind/formatter.
 * @param {any} raw
 * @param {boolean} integerColumn
 * @returns {string}
 */
function defaultNumericDisplay(raw, integerColumn) {
  if (typeof raw === "bigint") return FMT.formatCount(raw);
  if (typeof raw !== "number" || !Number.isFinite(raw)) return FMT.NA;
  if (raw === 0) return "0";
  if (integerColumn && Number.isInteger(raw)) return FMT.formatCount(raw);
  return Math.abs(raw) < 1e-4 ? FMT.formatSci(raw, { sig: 4 }) : FMT.formatSig(raw, { sig: 4 });
}

/**
 * Append strings/nodes cleanly to an element.
 * @param {Element} el
 * @param {any} content
 */
function appendContent(el, content) {
  for (const item of [content].flat(Infinity)) {
    if (item === null || item === undefined || item === false) continue;
    el.append(isNode(item) ? item : String(item));
  }
}

/**
 * Render an accessible data table wrapped in a keyboard-reachable scrollRegion when wide.
 * @param {any} ctx Widget ctx, Scope, Element, or Document.
 * @param {object} [options]
 * @param {DataTableColumn[]} [options.columns]
 * @param {any[]} [options.rows]
 * @param {any} [options.caption]
 * @param {string} [options.label] Accessible region label (falls back to caption text or "Data table").
 * @param {number | boolean} [options.sticky=1] Number of sticky leading columns (0, 1, or 2).
 * @param {number} [options.stickyCols] Alias for sticky.
 * @param {number} [options.maxRows] Optional row cap for initial rendering.
 * @param {string} [options.className=""] Extra class on outer .prx-data-table wrapper.
 * @param {string} [options.tableClassName=""] Extra class on <table>.
 * @param {string} [options.emptyText="No rows."] Text displayed when rows is empty.
 * @param {boolean} [options.scroll=true] Wrap in scrollRegion when true.
 * @returns {HTMLDivElement}
 */
export function renderDataTable(ctx, {
  columns = [],
  rows = [],
  caption,
  label,
  sticky = 1,
  stickyCols,
  maxRows,
  className = "",
  tableClassName = "",
  emptyText = "No rows.",
  scroll = true,
} = {}) {
  const doc = docOf(ctx);
  const h = ctx?.renderScope?.h ?? ctx?.h ?? fallbackFactory(doc);
  const nSticky = stickyCols !== undefined ? Number(stickyCols) : (typeof sticky === "boolean" ? (sticky ? 1 : 0) : Number(sticky));
  const stickyClass = nSticky >= 2 ? "prx-sticky-two" : nSticky === 1 ? "prx-sticky-first" : "";
  const tblClasses = [stickyClass, tableClassName].filter(Boolean).join(" ");
  const table = h("table", tblClasses ? { class: tblClasses } : {});

  if (caption !== undefined && caption !== null && caption !== false) {
    const capEl = h("caption", {});
    appendContent(capEl, caption);
    table.append(capEl);
  }

  const visibleRows = Number.isFinite(maxRows) && Number(maxRows) > 0 && rows.length > Number(maxRows)
    ? rows.slice(0, Number(maxRows))
    : rows;

  const extractVal = (col, row, rIdx, cIdx) => {
    if (typeof col.value === "function") return col.value(row, rIdx);
    if (Array.isArray(row)) return row[typeof col.key === "number" ? col.key : cIdx];
    return col.key !== undefined ? row?.[col.key] : undefined;
  };

  // Pre-detect integer-only columns for clean default formatting when no explicit kind/format is given.
  const colMeta = columns.map((col, cIdx) => {
    const kindName = typeof col.format === "string" ? col.format : col.kind;
    const kindFn = resolveKindFormatter(kindName, col);
    const customFn = typeof col.format === "function" ? col.format : null;
    const isNumericCol = Boolean(
      col.numeric ||
      (kindName && NUMERIC_KINDS.has(kindName)) ||
      (visibleRows.length > 0 && visibleRows.every((r, rIdx) => {
        const v = extractVal(col, r, rIdx, cIdx);
        return v === null || v === undefined || typeof v === "number" || typeof v === "bigint";
      }) && visibleRows.some((r, rIdx) => {
        const v = extractVal(col, r, rIdx, cIdx);
        return typeof v === "number" || typeof v === "bigint";
      })),
    );
    const integerOnly = isNumericCol && !kindFn && !customFn && visibleRows.every((r, rIdx) => {
      const v = extractVal(col, r, rIdx, cIdx);
      return v === null || v === undefined || typeof v === "bigint" || (typeof v === "number" && Number.isInteger(v));
    });
    const align = col.align ?? (isNumericCol ? "right" : "left");
    return { col, kindName, kindFn, customFn, isNumericCol, integerOnly, align };
  });

  if (columns.length > 0) {
    const theadRow = h("tr", {});
    for (const { col, align } of colMeta) {
      const thClasses = [col.className, align === "right" ? "prx-num-col" : ""].filter(Boolean).join(" ");
      const th = h("th", {
        scope: "col",
        class: thClasses || undefined,
        style: align !== "left" ? { "text-align": align } : undefined,
      });
      appendContent(th, col.label ?? col.header ?? (col.key !== undefined ? String(col.key) : ""));
      theadRow.append(th);
    }
    table.append(h("thead", {}, theadRow));
  }

  const tbody = h("tbody", {});
  if (visibleRows.length === 0) {
    const td = h("td", {
      class: "prx-table-empty",
      colspan: String(Math.max(1, columns.length)),
    }, emptyText);
    tbody.append(h("tr", {}, td));
  } else {
    visibleRows.forEach((row, rIdx) => {
      const tr = h("tr", {});
      colMeta.forEach(({ col, kindFn, customFn, isNumericCol, integerOnly, align }, cIdx) => {
        const val = extractVal(col, row, rIdx, cIdx);
        const raw = typeof col.raw === "function" ? col.raw(row, rIdx) : val;
        const tag = col.rowHeader ? "th" : "td";
        const cellClasses = [col.className, align === "right" ? "prx-num-cell" : ""].filter(Boolean).join(" ");
        const cell = h(tag, {
          scope: col.rowHeader ? "row" : undefined,
          class: cellClasses || undefined,
          style: align !== "left" ? { "text-align": align } : undefined,
        });
        if (col.name) cell.setAttribute("data-prx-name", "");
        const hookName = typeof col.hook === "function" ? col.hook(row, rIdx) : col.hook;
        if (hookName) cell.setAttribute("data-prx-readout", String(hookName));

        if (typeof col.render === "function") {
          const rendered = col.render(val, row, rIdx);
          appendContent(cell, rendered);
        } else if (customFn) {
          const formatted = customFn(val, row, rIdx);
          if (isNode(formatted) || Array.isArray(formatted)) {
            appendContent(cell, formatted);
          } else if (isNumericCol || typeof raw === "number" || typeof raw === "bigint") {
            FMT.setNum(cell, raw, String(formatted ?? ""));
          } else {
            cell.textContent = formatted === null || formatted === undefined ? "" : String(formatted);
          }
        } else if (kindFn) {
          FMT.setNum(cell, raw, kindFn(val));
        } else if (isNode(val) || (Array.isArray(val) && val.some(isNode))) {
          appendContent(cell, val);
        } else if (typeof raw === "number" || typeof raw === "bigint" || (raw === null && isNumericCol)) {
          FMT.setNum(cell, raw, defaultNumericDisplay(raw, integerOnly));
        } else {
          cell.textContent = val === null || val === undefined ? "" : String(val);
        }

        const gloss = cell.hasAttribute("data-num") ? FMT.sciGloss(cell.textContent ?? "") : null;
        if (gloss && !cell.getAttribute("title")) cell.setAttribute("title", gloss);
        tr.append(cell);
      });
      tbody.append(tr);
    });
  }
  table.append(tbody);

  if (rows.length > visibleRows.length) {
    const numNode = typeof ctx?.num === "function"
      ? (n) => ctx.num(n, FMT.formatCount(n))
      : (n) => FMT.numSpan(n, FMT.formatCount(n), { document: doc });
    const noteCell = h("td", { colspan: String(Math.max(1, columns.length)), class: "prx-table-truncated" },
      "Showing ", numNode(visibleRows.length), " of ", numNode(rows.length), " rows.");
    table.append(h("tfoot", {}, h("tr", {}, noteCell)));
  }

  const wrapClass = ["prx-data-table", className].filter(Boolean).join(" ");
  const wrap = /** @type {HTMLDivElement} */ (h("div", { class: wrapClass }, table));
  if (scroll !== false) {
    const regionLabel = label ?? (caption ? contentText(caption) : "") ?? "Data table";
    const cleanLabel = String(regionLabel).trim() || "Data table";
    if (typeof ctx?.scrollRegion === "function") ctx.scrollRegion(wrap, cleanLabel);
    else fallbackScrollRegion(wrap, cleanLabel);
  }
  return wrap;
}

/**
 * Visually-hidden screen-reader data table for SVG figures using value formatters (never tickLabel).
 * @param {any} ctx
 * @param {object} [options]
 * @param {DataTableColumn[]} [options.columns]
 * @param {any[]} [options.rows]
 * @param {any} [options.caption]
 * @param {string} [options.className="prx-sr-only"]
 * @returns {HTMLDivElement}
 */
export function hiddenTable(ctx, { columns = [], rows = [], caption, className = "prx-sr-only" } = {}) {
  return renderDataTable(ctx, { columns, rows, caption, sticky: 0, scroll: false, className });
}
