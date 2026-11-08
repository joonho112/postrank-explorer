// partbar.js: the part-of-whole bar of the result-first frame (review 044 repair). A labeled track of the parts
// of a set (pairs stated as the table does, stated the other way, silent; or wrong stated directions, withheld pairs
// …) with, under it, the count of each part and its words, so the numbers sit on the mark they size. It was lifted
// from app 1.1 case-zero's pair bar so that every app that splits a set the same way draws it the same way.
//
//   import { partBar } from "../shared/partbar.js";
//   const bar = partBar(ctx, { hook: "pairs", parts: [
//     { key: "agree", role: "agree" }, { key: "against", role: "against" }, { key: "silent", role: "silent" } ] });
//   ctx.charts.append(bar.root);
//   // in render:
//   bar.set({ title: ["All ", n, " pairs of firms"], total: M, counts: { agree, against, silent },
//             words: { agree: " stated as the table does", against: " stated the other way", silent: " silent" } });
//
// Each count is a number with data-num and, when the bar has a hook, a read-out hook `${hook}-${key}`. A title given
// as a function receives `total()`, a function that makes the hooked total (`${hook}-all`): title: (total) => ["All ",
// total(), " pairs"]. Pass `num(hook, raw, display)` to make hooked numbers the app's own way. The track only pictures the counts written under it, so screen readers skip it (aria-hidden) and
// read the list. A part with a positive count is at least 3 px wide, so a single reversed pair of 4,656 still shows.
// Roles take the shared mark colors (styles/tokens.css): agree = --prx-rel-above, against = --prx-rel-below,
// silent/withheld-pair = hatch over --prx-rel-withheld, error = --prx-err, withheld = --prx-wh, neutral = grade ramp.
// compact: true lays title, track and keys in one wrapping row (a per-item strip).
import { formatCount } from "./format.js";

export const ROLES = Object.freeze(["agree", "against", "silent", "error", "withheld", "neutral"]);

const pct = (part, total) => (total > 0 ? `${(100 * part) / total}%` : "0%");

export function partBar(ctx, { hook = null, parts = [], compact = false, className = "", num } = {}) {
  const h = ctx.h;
  const make = typeof num === "function" ? num : (name, raw, display) => {
    const node = ctx.num(raw, display);
    if (name) node.setAttribute("data-prx-readout", name);
    return node;
  };
  const segs = parts.map((p) => h("span", { class: "prx-partbar-seg", "data-role": p.role ?? "neutral", "data-prx-segment": p.key }));
  const head = h("p", { class: "prx-partbar-title" });
  const track = h("div", { class: "prx-partbar-track", "aria-hidden": "true" }, ...segs);
  const keys = h("ul", { class: "prx-partbar-keys" });
  const root = h("div", { class: `prx-partbar prx-light-panel${compact ? " prx-partbar-compact" : ""}${className ? ` ${className}` : ""}`, "data-prx-partbar": hook ?? "" }, head, track, keys);
  return {
    root,
    /** Redraw. title: content (strings and nodes) or a function total => content; counts: { key: n } adding up to
     *  total; words: { key: text after the count }; after(key): extra nodes after a key's words. */
    set({ title = null, total, counts = {}, words = {}, after = () => [] } = {}) {
      const totalNode = () => make(hook ? `${hook}-all` : null, total, formatCount(total));
      const t = typeof title === "function" ? title(totalNode) : title;
      head.replaceChildren(...[t].flat(Infinity).filter((x) => x !== null && x !== undefined && x !== false));
      head.hidden = head.childNodes.length === 0;
      parts.forEach((p, k) => {
        const n = Number(counts[p.key]) || 0;
        segs[k].style.width = pct(n, total);
        segs[k].classList.toggle("prx-partbar-some", n > 0);
      });
      keys.replaceChildren(...parts.map((p) => h("li", { class: "prx-partbar-key" },
        h("span", { class: "prx-partbar-sw", "data-role": p.role ?? "neutral", "aria-hidden": "true" }),
        make(hook ? `${hook}-${p.key}` : null, Number(counts[p.key]) || 0, formatCount(Number(counts[p.key]) || 0)),
        words[p.key] ?? "", ...[after(p.key)].flat().filter(Boolean))));
    },
  };
}
