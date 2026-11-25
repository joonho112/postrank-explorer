// cards.js: reusable report-card grade blocks, grade legends, pairwise relation matrices, and wrapping preset chips.

import * as FMT from "./format.js";
import { plural } from "./labels.js";

let cardUidCounter = 0;
const nextCardUid = (prefix = "prx-card") => `${prefix}-${(cardUidCounter += 1)}`;

const GRADE_PATTERNS = Object.freeze(["solid", "dashed", "double", "dotted"]);

const CELL_SUPPLEMENTS = Object.freeze({
  ordered: Object.freeze({ pattern: "solid", border: "solid", symbol: ">" }),
  agree: Object.freeze({ pattern: "solid", border: "solid", symbol: ">" }),
  above: Object.freeze({ pattern: "solid", border: "solid", symbol: ">" }),
  stated: Object.freeze({ pattern: "solid", border: "solid", symbol: ">" }),
  withheld: Object.freeze({ pattern: "hatch", border: "dashed", symbol: "·" }),
  silent: Object.freeze({ pattern: "hatch", border: "dashed", symbol: "·" }),
  open: Object.freeze({ pattern: "hatch", border: "dashed", symbol: "·" }),
  tied: Object.freeze({ pattern: "hatch", border: "dashed", symbol: "=" }),
  against: Object.freeze({ pattern: "crosshatch", border: "double", symbol: "×" }),
  conflict: Object.freeze({ pattern: "crosshatch", border: "double", symbol: "!" }),
  reverse: Object.freeze({ pattern: "crosshatch", border: "double", symbol: "<" }),
  below: Object.freeze({ pattern: "dots", border: "dotted", symbol: "<" }),
  neutral: Object.freeze({ pattern: "solid", border: "solid", symbol: "" }),
});

/**
 * @param {unknown} x
 * @returns {x is Record<string, any>}
 */
const isRecord = (x) => x !== null && typeof x === "object" && !Array.isArray(x);

/**
 * @param {any} target
 * @returns {Document}
 */
function docOf(target) {
  const d = target?.doc ?? (target?.nodeType === 9 ? target : target?.ownerDocument) ?? globalThis.document;
  if (!d) throw new TypeError("cards: pass a widget ctx, scope, element, or document");
  return d;
}

/**
 * @param {Document} doc
 */
function fallbackFactory(doc) {
  return (tag, attrs = {}, ...children) => {
    const node = doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs ?? {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === "class") node.className = String(v);
      else if (k === "text") node.textContent = String(v);
      else if (k === "style" && isRecord(v)) {
        for (const [p, s] of Object.entries(v)) node.style.setProperty(p, String(s));
      } else node.setAttribute(k, v === true ? "" : String(v));
    }
    for (const c of [children].flat(Infinity)) {
      if (c === null || c === undefined || c === false) continue;
      node.append(typeof c === "object" ? c : String(c));
    }
    return node;
  };
}

/**
 * Resolve the transient render scope if available, else the widget/scope, else a plain factory.
 * @param {any} target
 */
function bindingScopeOf(target) {
  const activeScope = target?.renderScope ?? target;
  const doc = docOf(target);
  const h = typeof activeScope?.h === "function" ? activeScope.h : fallbackFactory(doc);
  const listen = typeof activeScope?.listen === "function"
    ? activeScope.listen.bind(activeScope)
    : (node, type, fn, opts) => {
        node.addEventListener(type, fn, opts);
        return () => node.removeEventListener(type, fn, opts);
      };
  const num = typeof target?.num === "function"
    ? (raw, display, opts) => target.num(raw, display, opts)
    : (raw, display, opts) => FMT.numSpan(raw, display, { document: doc, ...opts });
  return { doc, h, listen, num };
}

/**
 * Non-color pattern name for 1-based grade g.
 * @param {number} g
 * @returns {string}
 */
function gradePattern(g) {
  return GRADE_PATTERNS[(Math.max(1, Math.trunc(g)) - 1) % GRADE_PATTERNS.length];
}

/**
 * Render ordered grade blocks for a canonical grade vector (e.g. [1, 1, 2, 3]).
 * @param {any} ctx
 * @param {object} [options]
 * @param {ArrayLike<number>} [options.grades=[]] 1-based grade assignment per unit.
 * @param {string[]} [options.ids=[]] Unit labels matching grades.
 * @param {boolean | ArrayLike<number> | Record<string | number, number>} [options.counts] Show per-grade unit counts.
 * @param {string | number | null} [options.selectedUnit] Selected unit id or index.
 * @param {(unitId: string, unitIndex: number) => void} [options.onSelectUnit] Optional unit click callback.
 * @param {string} [options.className=""] Extra class on root container.
 * @returns {HTMLDivElement}
 */
export function renderGradeBlocks(ctx, {
  grades = [],
  ids = [],
  counts,
  selectedUnit = null,
  onSelectUnit,
  className = "",
} = {}) {
  const { h, num } = bindingScopeOf(ctx);
  const gArr = Array.from(grades, Number);
  const rootClass = ["prx-grade-blocks", className].filter(Boolean).join(" ");
  const root = /** @type {HTMLDivElement} */ (h("div", { class: rootClass, role: "group", "aria-label": "Reported grades" }));
  if (gArr.length === 0) return root;

  const maxGrade = gArr.reduce((m, v) => (Number.isFinite(v) && v > m ? v : m), 0);
  const distinctGrades = [];
  for (let g = 1; g <= maxGrade; g += 1) {
    if (gArr.some((v) => v === g)) distinctGrades.push(g);
  }

  distinctGrades.forEach((g, blockIdx) => {
    if (blockIdx > 0) {
      root.append(h("span", { class: "prx-grade-sep", "aria-hidden": "true", text: ">" }));
    }
    const members = [];
    for (let i = 0; i < gArr.length; i += 1) {
      if (gArr[i] === g) members.push({ index: i, id: String(ids[i] ?? i + 1) });
    }
    const pattern = gradePattern(g);
    const headerParts = ["Grade ", num(g, FMT.formatCount(g))];
    if (counts) {
      const explicitCount = Array.isArray(counts) || ArrayBuffer.isView(counts)
        ? Number(counts[g - 1] ?? members.length)
        : isRecord(counts)
          ? Number(counts[g] ?? counts[g - 1] ?? members.length)
          : members.length;
      headerParts.push(" (", num(explicitCount, FMT.formatCount(explicitCount)), ` ${plural(explicitCount, "unit")})`);
    }
    const unitNodes = members.map(({ index, id }) => {
      const isSelected = selectedUnit !== null && selectedUnit !== undefined
        && (selectedUnit === id || selectedUnit === index);
      if (typeof onSelectUnit === "function") {
        return h("button", {
          type: "button",
          class: "prx-grade-unit",
          "data-unit": id,
          "data-unit-index": String(index),
          "aria-pressed": String(isSelected),
          "data-prx-focus-key": `grade-unit:${id}`,
          onclick: () => onSelectUnit(id, index),
        }, h("span", { "data-prx-name": "", text: id }));
      }
      return h("span", {
        class: "prx-grade-unit",
        "data-unit": id,
        "data-unit-index": String(index),
        "data-prx-name": "",
        text: id,
      });
    });

    const block = h("div", {
      class: "prx-grade-block",
      "data-grade": String(g),
      "data-pattern": pattern,
      style: { "--prx-grade-border-style": pattern },
    },
    h("div", { class: "prx-grade-header" }, ...headerParts),
    h("div", { class: "prx-grade-members" }, ...unitNodes));
    root.append(block);
  });

  return root;
}

/**
 * Render an accessible legend for 1..G grades with non-color border/pattern supplements.
 * @param {any} ctx
 * @param {number} G Total number of grades.
 * @param {object} [options]
 * @param {string[]} [options.labels] Optional custom labels per grade.
 * @param {string} [options.className=""]
 * @returns {HTMLDivElement}
 */
export function renderGradeLegend(ctx, G, { labels, className = "" } = {}) {
  const { h, num } = bindingScopeOf(ctx);
  const count = Math.max(0, Math.trunc(Number(G) || 0));
  const rootClass = ["prx-grade-legend", className].filter(Boolean).join(" ");
  const items = [];
  for (let g = 1; g <= count; g += 1) {
    const pattern = gradePattern(g);
    const swatch = h("span", {
      class: "prx-grade-swatch",
      "data-grade": String(g),
      "data-pattern": pattern,
      style: { "border-style": pattern },
      "aria-hidden": "true",
    });
    const custom = labels?.[g - 1];
    const labelNodes = custom !== undefined
      ? [custom]
      : ["Grade ", num(g, FMT.formatCount(g)), g === 1 && count > 1 ? " (top)" : g === count && count > 1 ? " (bottom)" : null];
    items.push(h("span", {
      class: "prx-grade-legend-item",
      role: "listitem",
      "data-grade": String(g),
      "data-pattern": pattern,
    }, swatch, h("span", { class: "prx-grade-legend-label" }, ...labelNodes)));
  }
  return /** @type {HTMLDivElement} */ (h("div", {
    class: rootClass,
    role: "list",
    "aria-label": "Grade legend",
  }, ...items));
}

/**
 * Resolve cell descriptor for pair (i, j) from function, 2D array, Map, or Record.
 * @param {any} cells
 * @param {number} i
 * @param {number} j
 * @returns {any}
 */
function lookupCell(cells, i, j) {
  if (typeof cells === "function") return cells(i, j);
  if (Array.isArray(cells)) return Array.isArray(cells[i]) ? cells[i][j] : undefined;
  if (cells instanceof Map) return cells.get(`${i},${j}`);
  if (isRecord(cells)) return cells[`${i},${j}`];
  return undefined;
}

/**
 * Find next off-diagonal (r, c) coordinate when navigating a size x size matrix with arrow keys.
 * @param {number} size
 * @param {number} r
 * @param {number} c
 * @param {string} key
 * @returns {[number, number] | null}
 */
function stepMatrixCoord(size, r, c, key) {
  if (size < 2) return null;
  if (key === "Home") {
    const firstCol = r === 0 ? 1 : 0;
    return firstCol < size ? [r, firstCol] : null;
  }
  if (key === "End") {
    const lastCol = r === size - 1 ? size - 2 : size - 1;
    return lastCol >= 0 ? [r, lastCol] : null;
  }
  const dr = key === "ArrowDown" ? 1 : key === "ArrowUp" ? -1 : 0;
  const dc = key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0;
  if (dr === 0 && dc === 0) return null;
  let nr = r + dr;
  let nc = c + dc;
  if (nr === nc) {
    nr += dr;
    nc += dc;
  }
  if (nr < 0 || nr >= size || nc < 0 || nc >= size || nr === nc) return null;
  return [nr, nc];
}

/**
 * Render an n x n pairwise matrix with roving-tabindex keyboard navigation and non-color hatch/border supplements.
 * @param {any} ctx
 * @param {object} [options]
 * @param {number} [options.n] Matrix dimension (defaults to ids.length).
 * @param {string[]} [options.ids=[]] Unit identifiers.
 * @param {any} [options.cells] Cell lookup (i, j) -> { state?, value?, raw?, format?, label?, title?, pattern?, border?, symbol? } | number | string.
 * @param {[number, number] | { i: number, j: number } | string | null} [options.selectedPair] Currently selected (i, j) pair.
 * @param {(detail: { i: number, j: number, rowId: string, colId: string, cell: any }, pair: [number, number]) => void} [options.onSelectPair] Selection callback.
 * @param {any} [options.caption] Accessible table caption.
 * @param {string} [options.className=""]
 * @param {boolean} [options.scroll=true]
 * @returns {HTMLDivElement}
 */
export function renderPairMatrix(ctx, {
  n,
  ids = [],
  cells,
  selectedPair = null,
  onSelectPair,
  caption,
  className = "",
  scroll = true,
} = {}) {
  const { h, listen } = bindingScopeOf(ctx);
  const size = Math.max(0, Math.trunc(Number.isFinite(n) ? Number(n) : ids.length));
  const unitIds = Array.from({ length: size }, (_, i) => String(ids[i] ?? String.fromCharCode(65 + (i % 26))));

  let selI = -1;
  let selJ = -1;
  if (Array.isArray(selectedPair) && selectedPair.length >= 2) {
    selI = Number(selectedPair[0]);
    selJ = Number(selectedPair[1]);
  } else if (isRecord(selectedPair) && "i" in selectedPair && "j" in selectedPair) {
    selI = Number(selectedPair.i);
    selJ = Number(selectedPair.j);
  } else if (typeof selectedPair === "string" && selectedPair.includes(",")) {
    const [a, b] = selectedPair.split(",").map(Number);
    selI = a;
    selJ = b;
  }
  const hasValidSelection = selI >= 0 && selI < size && selJ >= 0 && selJ < size && selI !== selJ;
  const activeI = hasValidSelection ? selI : 0;
  const activeJ = hasValidSelection ? selJ : (size > 1 ? 1 : 0);

  const table = h("table", {
    class: "prx-pair-matrix-table prx-sticky-first",
    role: "grid",
    "aria-label": typeof caption === "string" && caption.trim() ? caption : "Pairwise comparison matrix",
  });
  if (caption) table.append(h("caption", {}, caption));

  if (size > 0) {
    const headRow = h("tr", {},
      h("th", { scope: "col", class: "prx-pair-corner", "aria-label": "Unit" }, ""),
      ...unitIds.map((uidText) => h("th", { scope: "col", "data-prx-name": "", text: uidText })),
    );
    table.append(h("thead", {}, headRow));
  }

  const tbody = h("tbody", {});
  /** @type {Map<string, HTMLButtonElement>} */
  const buttonMap = new Map();

  for (let i = 0; i < size; i += 1) {
    const tr = h("tr", {}, h("th", { scope: "row", "data-prx-name": "", text: unitIds[i] }));
    for (let j = 0; j < size; j += 1) {
      if (i === j) {
        tr.append(h("td", {
          class: "prx-pair-cell prx-pair-diagonal",
          "data-row": String(i),
          "data-col": String(j),
          "data-cell-state": "diagonal",
          "data-pattern": "diagonal",
          "aria-label": `${unitIds[i]} self`,
          text: "—",
        }));
        continue;
      }

      const rawEntry = lookupCell(cells, i, j);
      const cellObj = isRecord(rawEntry)
        ? rawEntry
        : typeof rawEntry === "number"
          ? { value: rawEntry }
          : typeof rawEntry === "string"
            ? { state: rawEntry }
            : {};

      const state = String(cellObj.state ?? "neutral");
      const supp = CELL_SUPPLEMENTS[state] ?? CELL_SUPPLEMENTS.neutral;
      const pattern = String(cellObj.pattern ?? supp.pattern);
      const borderStyle = String(cellObj.border ?? supp.border);
      const isSelected = hasValidSelection && i === selI && j === selJ;
      const isTabStop = i === activeI && j === activeJ;

      const valueSpan = (() => {
        if (typeof cellObj.value === "number" && Number.isFinite(cellObj.value)) {
          const rawVal = cellObj.raw !== undefined ? cellObj.raw : cellObj.value;
          const display = typeof cellObj.format === "function"
            ? String(cellObj.format(cellObj.value))
            : (FMT.formatReadoutProb ?? FMT.formatProb)(cellObj.value);
          const s = h("span", { class: "prx-num prx-pair-val" });
          FMT.setNum(s, rawVal, display);
          return s;
        }
        const sym = cellObj.text ?? cellObj.symbol ?? supp.symbol;
        return sym ? h("span", { class: "prx-pair-symbol", "aria-hidden": "true", text: String(sym) }) : null;
      })();

      const ariaLabel = String(
        cellObj.label
          ?? `${unitIds[i]} versus ${unitIds[j]}: ${state}${valueSpan?.textContent ? ` (${valueSpan.textContent})` : ""}`,
      );

      const btn = /** @type {HTMLButtonElement} */ (h("button", {
        type: "button",
        class: "prx-pair-cell-btn",
        tabindex: isTabStop ? "0" : "-1",
        "data-row": String(i),
        "data-col": String(j),
        "data-cell-state": state,
        "data-pattern": pattern,
        "data-border-style": borderStyle,
        "aria-pressed": String(isSelected),
        "aria-label": ariaLabel,
        title: cellObj.title ? String(cellObj.title) : ariaLabel,
        "data-prx-focus-key": `pair:${i},${j}`,
        style: { "border-style": borderStyle },
      }, valueSpan));
      buttonMap.set(`${i},${j}`, btn);

      tr.append(h("td", {
        class: "prx-pair-cell",
        "data-row": String(i),
        "data-col": String(j),
        "data-cell-state": state,
        "data-pattern": pattern,
        "data-border-style": borderStyle,
      }, btn));
    }
    tbody.append(tr);
  }
  table.append(tbody);

  const setRovingStop = (r, c) => {
    for (const [k, b] of buttonMap) {
      b.setAttribute("tabindex", k === `${r},${c}` ? "0" : "-1");
    }
  };

  listen(table, "keydown", (e) => {
    const target = /** @type {HTMLElement | null} */ (e.target);
    const btn = target?.closest?.("button.prx-pair-cell-btn");
    if (!btn) return;
    const r = Number(btn.getAttribute("data-row"));
    const c = Number(btn.getAttribute("data-col"));
    const next = stepMatrixCoord(size, r, c, e.key);
    if (!next) return;
    e.preventDefault();
    const [nr, nc] = next;
    const nextBtn = buttonMap.get(`${nr},${nc}`);
    if (nextBtn) {
      setRovingStop(nr, nc);
      nextBtn.focus({ preventScroll: true });
    }
  });

  listen(table, "click", (e) => {
    const target = /** @type {HTMLElement | null} */ (e.target);
    const btn = target?.closest?.("button.prx-pair-cell-btn");
    if (!btn) return;
    const r = Number(btn.getAttribute("data-row"));
    const c = Number(btn.getAttribute("data-col"));
    setRovingStop(r, c);
    for (const [k, b] of buttonMap) {
      b.setAttribute("aria-pressed", String(k === `${r},${c}`));
    }
    if (typeof onSelectPair === "function") {
      onSelectPair({
        i: r,
        j: c,
        rowId: unitIds[r],
        colId: unitIds[c],
        cell: lookupCell(cells, r, c),
      }, [r, c]);
    }
  });

  const wrapClass = ["prx-pair-matrix", className].filter(Boolean).join(" ");
  const wrap = /** @type {HTMLDivElement} */ (h("div", { class: wrapClass }, table));
  if (scroll !== false) {
    const regionLabel = typeof caption === "string" && caption.trim() ? caption : "Pairwise comparison matrix";
    if (typeof ctx?.scrollRegion === "function") ctx.scrollRegion(wrap, regionLabel);
    else {
      wrap.classList.add("prx-scroll-region");
      wrap.setAttribute("tabindex", "0");
      wrap.setAttribute("role", "region");
      wrap.setAttribute("aria-label", regionLabel);
    }
  }
  return wrap;
}

/**
 * Render wrapping preset chips (button.prx-seg[data-value][aria-pressed]) that wrap cleanly on mobile without clipping.
 * @param {any} scope Scope, widget ctx, Element, or Document.
 * @param {object} [options]
 * @param {string | null} [options.label="Presets"] Group label (null to omit visible label).
 * @param {Array<{ id?: string, value?: any, label?: any, title?: string }>} [options.presets=[]] Preset items.
 * @param {Array<{ id?: string, value?: any, label?: any, title?: string }>} [options.options] Alias for presets.
 * @param {string} [options.firstPreset] Optional preset id to place first.
 * @param {any} [options.value=null] Currently active preset id.
 * @param {(value: any) => void} [options.onSelect] Selection callback.
 * @param {(value: any) => void} [options.onChange] Alias for onSelect.
 * @param {string} [options.name="preset"] Focus-key namespace.
 * @param {string} [options.className=""] Extra class on outer container.
 */
export function renderPresetChips(scope, {
  label = "Presets",
  presets = [],
  options,
  firstPreset,
  value = null,
  onSelect,
  onChange,
  name = "preset",
  className = "",
} = {}) {
  const { h, listen } = bindingScopeOf(scope);
  const rawList = Array.isArray(options) ? options : presets;
  const normalized = rawList.map((item) => ({
    val: item.value !== undefined ? item.value : item.id,
    label: item.label ?? String(item.value ?? item.id ?? ""),
    title: item.title,
  }));
  const ordered = firstPreset && normalized.some((p) => String(p.val) === String(firstPreset))
    ? [
        ...normalized.filter((p) => String(p.val) === String(firstPreset)),
        ...normalized.filter((p) => String(p.val) !== String(firstPreset)),
      ]
    : normalized;

  const labelId = nextCardUid("prx-chips");
  let current = value;
  const same = (a, b) => Object.is(a, b) || (a !== undefined && a !== null && b !== undefined && b !== null && String(a) === String(b));
  const fire = onSelect ?? onChange;

  const buttons = ordered.map((o, idx) => {
    const b = /** @type {HTMLButtonElement} */ (h("button", {
      type: "button",
      class: "prx-seg",
      title: o.title,
      "aria-pressed": String(same(o.val, current)),
      "data-value": String(o.val),
      "data-prx-focus-key": `seg:${name}:${idx}`,
    }, o.label));
    listen(b, "click", () => {
      current = o.val;
      sync();
      fire?.(o.val);
    });
    return b;
  });

  const sync = () => {
    buttons.forEach((b, idx) => {
      b.setAttribute("aria-pressed", String(same(ordered[idx].val, current)));
    });
  };

  const rootClasses = ["prx-control", "prx-segmented", "prx-presets", "prx-preset-chips", className].filter(Boolean).join(" ");
  const root = /** @type {HTMLDivElement} */ (h("div", {
    class: rootClasses,
    role: "group",
    "data-prx-part": "presets",
    "aria-labelledby": label ? labelId : undefined,
    "aria-label": !label ? "Presets" : undefined,
  },
  label ? h("span", { id: labelId, class: "prx-seg-label", text: label }) : null,
  h("span", {
    class: "prx-seg-buttons prx-chip-wrap",
    style: { display: "flex", "flex-wrap": "wrap", gap: "0.35rem", "overflow-x": "visible" },
  }, ...buttons)));

  return {
    root,
    buttons,
    get: () => current,
    set(v) { current = v; sync(); },
    setDisabled(disabled) { for (const b of buttons) b.disabled = Boolean(disabled); },
  };
}

// Architecture doc convenience aliases (spec/code-architecture.md §2).
export const renderReportCard = renderGradeBlocks;
export const gradeLegend = renderGradeLegend;
export const pairMatrix = renderPairMatrix;
export const presetChips = renderPresetChips;
