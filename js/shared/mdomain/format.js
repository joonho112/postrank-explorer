// Author: JoonHo Lee (jlee296@ua.edu).
// Presentation only: these functions never decide feasibility, ties or optimizers.

function fraction(raw) {
  if (typeof raw !== "string") throw new TypeError("A canonical nonnegative exact string is required.");
  const match = /^(0|[1-9]\d*)(?:\/([1-9]\d*))?$/.exec(raw);
  if (!match) throw new TypeError("A canonical nonnegative exact string is required.");
  const n = BigInt(match[1]), d = match[2] === undefined ? 1n : BigInt(match[2]);
  let a = n, b = d;
  while (b) { const remainder = a % b; a = b; b = remainder; }
  if ((n === 0n && raw !== "0") || (d === 1n && match[2] !== undefined) || a !== 1n) {
    throw new TypeError("Exact strings must be reduced, with zero and integers written without a denominator.");
  }
  return { n, d };
}

export function isCanonicalExact(raw) {
  try { fraction(raw); return true; } catch { return false; }
}

function displayOptions({ style = "fraction", digits = 4 } = {}) {
  if (!["fraction", "decimal", "percent"].includes(style)) throw new TypeError("Exact display style must be fraction, decimal or percent.");
  if (!Number.isInteger(digits) || digits < 0 || digits > 20) throw new RangeError("Exact display digits must be an integer from zero to twenty.");
  return { style, digits };
}

/** Fixed decimal rounding is half-even on the fraction itself, without binary64 conversion. */
export function formatExactText(raw, options = {}) {
  const { style, digits } = displayOptions(options);
  if (raw === null) return "NA: no disclosure";
  const { n, d } = fraction(raw);
  if (style === "fraction") return raw;
  if (n === 0n) return style === "percent" ? "0%" : raw;
  const scaled = n * (style === "percent" ? 100n : 1n) * 10n ** BigInt(digits);
  let rounded = scaled / d;
  const twice = 2n * (scaled % d);
  if (twice > d || (twice === d && rounded % 2n === 1n)) rounded += 1n;
  if (digits === 0) return String(rounded) + (style === "percent" ? "%" : "");
  const text = String(rounded).padStart(digits + 1, "0");
  const integer = text.slice(0, -digits), decimal = text.slice(-digits);
  return style === "percent" ? `${integer}.${decimal}%` : `${integer === "0" ? "" : integer}.${decimal}`;
}

export const exactText = formatExactText;

/** ctx.num carries the canonical source; metadata makes the chosen display independently checkable. */
export function exactNum(ctx, raw, options = {}) {
  const { style, digits } = displayOptions(options);
  const display = formatExactText(raw, { style, digits });
  const node = ctx.num(raw, display);
  node.setAttribute("data-prx-format", "mdomain-exact");
  node.setAttribute("data-prx-exact-style", style);
  node.setAttribute("data-prx-exact-digits", String(digits));
  if (options.field) node.setAttribute("data-prx-mdomain-field", options.field);
  if (options.className) node.classList.add(...String(options.className).split(/\s+/).filter(Boolean));
  if (options.title) node.title = options.title;
  if (options.part) ctx.part(options.part, node);
  options.onReadout?.({ raw, display, node });
  return node;
}

export function undefinedRatioNum(ctx, raw, options = {}) {
  return exactNum(ctx, raw, options);
}
