var Br = Object.defineProperty;
var Vr = (t, e, r) => e in t ? Br(t, e, { enumerable: !0, configurable: !0, writable: !0, value: r }) : t[e] = r;
var z = (t, e, r) => Vr(t, typeof e != "symbol" ? e + "" : e, r);
const Lr = Object.freeze({ scale: "multiplier", tol: "tieTol" });
function Wr(t) {
  return typeof t == "string" ? JSON.stringify(t) : Array.isArray(t) ? "an array" : ArrayBuffer.isView(t) ? "a typed array" : String(t);
}
function M(t, e, r, n = !1) {
  const o = `{${e.join(", ")}}`;
  if (t == null) {
    if (n) throw new TypeError(`${r}: options object expected: ${o}`);
    return {};
  }
  if (typeof t != "object" || Array.isArray(t) || ArrayBuffer.isView(t))
    throw new TypeError(`${r}: options object expected: ${o}, got ${Wr(t)}`);
  for (const s of Object.keys(t))
    if (!e.includes(s)) {
      const i = Lr[s], a = i !== void 0 && e.includes(i) ? ` (it is now called ${i})` : "";
      throw new TypeError(`${r}: unknown option "${s}"${a}; the options are ${o}`);
    }
  return t;
}
function xt(t, e, r) {
  for (const n of Object.keys(t))
    if (!e.includes(n)) throw new TypeError(`${r}: unknown key "${n}"; the keys are {${e.join(", ")}}`);
}
const Ur = 2n ** 53n;
function sr(t) {
  return t <= Ur ? Number(t) : t.toString();
}
function ir(t, e, r) {
  return Object.defineProperty(t, e, { value: r, enumerable: !1, writable: !1, configurable: !0 }), t;
}
function Dt(t, e, r = `${e}s`) {
  return String(t) === "1" ? e : r;
}
function Mt(t, e) {
  const r = t ?? 100;
  if (typeof r != "number" || !(r === Number.POSITIVE_INFINITY || Number.isSafeInteger(r) && r >= 1))
    throw new RangeError(`${e}: maxTies must be a positive integer (or Infinity), got ${String(r)}`);
  return r;
}
const Yr = 5.656854249492381, de = 0.3989422804014327, ar = Number.EPSILON * 0.5, Yt = 16, ie = [2.2352520354606837, 161.02823106855587, 1067.6894854603709, 18154.98125334356, 0.06568233791820745], Pe = [47.202581904688245, 976.0985517377767, 10260.932208618979, 45507.78933502673], ae = [
  0.39894151208813466,
  8.883149794388377,
  93.50665613217785,
  597.2702763948002,
  2494.5375852903726,
  6848.190450536283,
  11602.65143764735,
  9842.714838383978,
  10765576773720192e-24
], je = [
  22.266688044328117,
  235.387901782625,
  1519.3775994075547,
  6485.558298266761,
  18615.571640885097,
  34900.95272114598,
  38912.00328609327,
  19685.429676859992
], ce = [0.215898534057957, 0.12740116116024736, 0.022235277870649807, 0.0014216191932278934, 29112874951168793e-21, 0.023073441764940174], _e = [1.284260096144911, 0.4682382124808651, 0.06598813786892856, 0.0037823963320275824, 7297515550839662e-20], be = 37.5193, cr = 8.2924;
function lr(t) {
  const e = Math.abs(t);
  if (e <= 0.67448975) {
    let n = 0, o = 0;
    if (e > ar) {
      const i = t * t;
      n = ie[4] * i, o = i;
      for (let a = 0; a < 3; a += 1)
        n = (n + ie[a]) * i, o = (o + Pe[a]) * i;
    }
    const s = t * (n + ie[3]) / (o + Pe[3]);
    return [0.5 + s, 0.5 - s];
  }
  let r;
  if (e <= Yr) {
    let n = ae[8] * e, o = e;
    for (let i = 0; i < 7; i += 1)
      n = (n + ae[i]) * e, o = (o + je[i]) * e;
    const s = (n + ae[7]) / (o + je[7]);
    r = ze(e) * s;
  } else if (e < be) {
    const n = 1 / (t * t);
    let o = ce[5] * n, s = n;
    for (let a = 0; a < 4; a += 1)
      o = (o + ce[a]) * n, s = (s + _e[a]) * n;
    let i = n * (o + ce[4]) / (s + _e[4]);
    i = (de - i) / e, r = ze(t) * i;
  } else
    r = 0;
  return t > 0 ? [1 - r, r] : [r, 1 - r];
}
function ze(t) {
  const e = Math.trunc(t * Yt) / Yt, r = (t - e) * (t + e);
  return Math.exp(-e * (e * 0.5)) * Math.exp(-(r * 0.5));
}
function At(t) {
  return Number.isNaN(t) ? Number.NaN : t <= -be ? 0 : t >= cr ? 1 : lr(t)[0];
}
function Hr(t) {
  if (typeof t != "number" || !(t >= 0)) throw new RangeError(`normalCoverage: k must be a number ≥ 0 (or Infinity), got ${String(t)}`);
  return t === Number.POSITIVE_INFINITY ? 1 : At(t) - At(-t);
}
function Zr(t) {
  return Number.isNaN(t) ? Number.NaN : t >= be ? 0 : t <= -cr ? 1 : lr(t)[1];
}
const Qr = Math.sqrt(-2 * Math.LN2 * -1073), qe = 65536;
function co(t) {
  if (Number.isNaN(t)) return Number.NaN;
  const e = Math.abs(t);
  if (e === 1 / 0) return 0;
  if (e < 5) return de * Math.exp(-0.5 * e * e);
  if (e > Qr) return 0;
  const r = Xr(e * qe) / qe, n = e - r;
  return de * (Math.exp(-0.5 * r * r) * Math.exp((-0.5 * n - r) * n));
}
function Xr(t) {
  const e = Math.floor(t), r = t - e;
  return r > 0.5 ? e + 1 : r < 0.5 || e % 2 === 0 ? e : e + 1;
}
function ye(t, e = {}) {
  const r = M(e, ["lowerTail"], "normalQuantile").lowerTail ?? !0;
  if (Number.isNaN(t) || t < 0 || t > 1) return Number.NaN;
  if (t === 0) return r ? -1 / 0 : 1 / 0;
  if (t === 1) return r ? 1 / 0 : -1 / 0;
  const o = (r ? t : 0.5 - t + 0.5) - 0.5;
  if (Math.abs(o) <= 0.425) {
    const c = 0.180625 - o * o;
    return o * (((((((c * 2509.0809287301227 + 33430.57558358813) * c + 67265.7709270087) * c + 45921.95393154987) * c + 13731.69376550946) * c + 1971.5909503065513) * c + 133.14166789178438) * c + 3.3871328727963665) / (((((((c * 5226.495278852546 + 28729.085735721943) * c + 39307.89580009271) * c + 21213.794301586597) * c + 5394.196021424751) * c + 687.1870074920579) * c + 42.31333070160091) * c + 1);
  }
  let s;
  r ? s = o > 0 ? 0.5 - t + 0.5 : t : s = o > 0 ? t : 0.5 - t + 0.5;
  let i = Math.sqrt(-Math.log(s)), a;
  return i <= 5 ? (i -= 1.6, a = (((((((i * 7745450142783414e-19 + 0.022723844989269184) * i + 0.2417807251774506) * i + 1.2704582524523684) * i + 3.6478483247632045) * i + 5.769497221460691) * i + 4.630337846156546) * i + 1.4234371107496835) / (((((((i * 10507500716444169e-25 + 5475938084995345e-19) * i + 0.015198666563616457) * i + 0.14810397642748008) * i + 0.6897673349851) * i + 1.6763848301838038) * i + 2.053191626637759) * i + 1)) : (i -= 5, a = (((((((i * 20103343992922881e-23 + 27115555687434876e-21) * i + 0.0012426609473880784) * i + 0.026532189526576124) * i + 0.29656057182850487) * i + 1.7848265399172913) * i + 5.463784911164114) * i + 6.657904643501103) / (((((((i * 20442631033899397e-31 + 1421511758316446e-22) * i + 18463183175100548e-21) * i + 7868691311456133e-19) * i + 0.014875361290850615) * i + 0.1369298809227358) * i + 0.599832206555888) * i + 1)), o < 0 ? -a : a;
}
const le = [3.1611237438705655, 113.86415415105016, 377.485237685302, 3209.3775891384694, 0.18577770618460315], Ke = [23.601290952344122, 244.02463793444417, 1282.6165260773723, 2844.236833439171], ue = [
  0.5641884969886701,
  8.883149794388377,
  66.11919063714163,
  298.6351381974001,
  881.952221241769,
  1712.0476126340707,
  2051.0783778260716,
  1230.3393547979972,
  21531153547440383e-24
], De = [
  15.744926110709835,
  117.6939508913125,
  537.1811018620099,
  1621.3895745666903,
  3290.7992357334597,
  4362.619090143247,
  3439.3676741437216,
  1230.3393548037495
], fe = [0.30532663496123236, 0.36034489994980445, 0.12578172611122926, 0.016083785148742275, 6587491615298378e-19, 0.016315387137302097], Be = [2.568520192289822, 1.8729528499234673, 0.5279051029514285, 0.06051834131244132, 0.0023352049762686918], Jr = 0.5641895835477563, tn = 26.543;
function lo(t) {
  if (Number.isNaN(t)) return Number.NaN;
  const e = Math.abs(t);
  let r;
  if (e <= 0.46875) {
    let n = 0;
    e > ar && (n = e * e);
    let o = le[4] * n, s = n;
    for (let i = 0; i < 3; i += 1)
      o = (o + le[i]) * n, s = (s + Ke[i]) * n;
    return 1 - t * (o + le[3]) / (s + Ke[3]);
  }
  if (e <= 4) {
    let n = ue[8] * e, o = e;
    for (let s = 0; s < 7; s += 1)
      n = (n + ue[s]) * e, o = (o + De[s]) * e;
    r = (n + ue[7]) / (o + De[7]), r *= Ve(e);
  } else if (e >= tn)
    r = 0;
  else {
    const n = 1 / (e * e);
    let o = fe[5] * n, s = n;
    for (let i = 0; i < 4; i += 1)
      o = (o + fe[i]) * n, s = (s + Be[i]) * n;
    r = n * (o + fe[4]) / (s + Be[4]), r = (Jr - r) / e, r *= Ve(e);
  }
  return t < 0 ? 2 - r : r;
}
function Ve(t) {
  const e = Math.trunc(t * Yt) / Yt, r = (t - e) * (t + e);
  return Math.exp(-e * e) * Math.exp(-r);
}
const en = 1831565813, rn = 4294967296, nn = 2 * Math.PI;
function on(t) {
  if (!Number.isInteger(t)) throw new RangeError(`seed must be an integer, got ${String(t)}`);
  return t >>> 0;
}
function sn(t) {
  let e = on(t);
  return () => {
    e = e + en >>> 0;
    let r = e;
    return r = Math.imul(r ^ r >>> 15, r | 1), r ^= r + Math.imul(r ^ r >>> 7, r | 61), (r ^ r >>> 14) >>> 0;
  };
}
function ur(t) {
  const e = sn(t);
  return () => (e() + 0.5) / rn;
}
function an(t) {
  const e = ur(t);
  let r = 0, n = !1;
  return () => {
    if (n)
      return n = !1, r;
    const o = e(), s = e(), i = Math.sqrt(-2 * Math.log(o)), a = nn * s;
    return r = i * Math.sin(a), n = !0, i * Math.cos(a);
  };
}
function fr(t, e) {
  const r = ur(t), n = new Float64Array(hr(e));
  for (let o = 0; o < n.length; o += 1) n[o] = r();
  return n;
}
function te(t, e) {
  const r = an(t), n = new Float64Array(hr(e));
  for (let o = 0; o < n.length; o += 1) n[o] = r();
  return n;
}
function hr(t) {
  if (!Number.isInteger(t) || t < 0) throw new RangeError(`count must be a nonnegative integer, got ${String(t)}`);
  return t;
}
const yt = "−", lt = "NA", Le = "NA: no disclosure";
function ot(t) {
  return typeof t == "number" && Number.isFinite(t);
}
function _t(t, e, r = 0) {
  if (!Number.isInteger(e) || e < r || e > 100) throw new RangeError(`${t} must be an integer from ${r} to 100, got ${String(e)}`);
  return e;
}
const he = new DataView(new ArrayBuffer(8));
function cn(t, e) {
  if (t === 0) return 0n;
  he.setFloat64(0, t);
  const r = he.getUint32(0), n = he.getUint32(4), o = r >>> 20 & 2047;
  let s = BigInt(r & 1048575) << 32n | BigInt(n), i;
  o === 0 ? i = -1074 : (s |= 1n << 52n, i = o - 1075);
  let a = s, c = 1n;
  i >= 0 ? a <<= BigInt(i) : c <<= BigInt(-i), e >= 0 ? a *= 10n ** BigInt(e) : c *= 10n ** BigInt(-e);
  const u = a / c, l = 2n * (a % c);
  return l > c ? u + 1n : l < c || u % 2n === 0n ? u : u + 1n;
}
function Vt(t, e) {
  if (e >= 0 && e <= 20 && t < 1e21) {
    const r = t * 2 ** (e + 1), n = Number.isInteger(r) && r % 2 === 1;
    let o = BigInt(t.toFixed(e).replace(".", ""));
    return n && o % 2n === 1n && (o -= 1n), o;
  }
  return cn(t, e);
}
function Ht(t) {
  if (t.length <= 3) return t;
  const e = t.length % 3, r = e ? [t.slice(0, e)] : [];
  for (let n = e; n < t.length; n += 3) r.push(t.slice(n, n + 3));
  return r.join(",");
}
function wt(t, e, r, n) {
  if (e <= 0) {
    const a = t === 0n ? "0" : t.toString() + "0".repeat(-e);
    return n ? Ht(a) : a;
  }
  let o = t.toString();
  o.length <= e && (o = "0".repeat(e - o.length + 1) + o);
  let s = o.slice(0, o.length - e);
  const i = o.slice(o.length - e);
  return s === "0" && !r && (s = ""), (n ? Ht(s) : s) + "." + i;
}
function Lt(t, e, r) {
  return t < 0 && e !== 0n ? yt + r : r;
}
function mr(t, e = {}) {
  if (e = M(e, ["digits", "leadingZero", "group"], "formatDecimal"), !ot(t)) return lt;
  const r = _t("digits", e.digits ?? 2);
  if (t === 0) return "0";
  const n = Vt(Math.abs(t), r);
  return Lt(t, n, wt(n, r, e.leadingZero ?? !1, e.group ?? !0));
}
function wr(t, e, r, n, o = !1) {
  if (n && o && r !== !1 && (t === 0 || t === 1)) {
    const a = r === "symbols";
    return t === 0 ? (a ? "<" : "below ") + wt(1n, e, !1, !0) : (a ? ">" : "above ") + wt(10n ** BigInt(e) - 1n, e, !1, !0);
  }
  if (t === 0) return "0";
  if (n && t === 1) return "1";
  const s = Math.abs(t), i = Vt(s, e);
  if (r !== !1) {
    const a = r === "symbols";
    if (i === 0n) {
      const c = wt(1n, e, !1, !0);
      return t > 0 ? (a ? "<" : "below ") + c : (a ? ">" + yt : "above " + yt) + c;
    }
    if (n && t > 0 && t < 1 && i === 10n ** BigInt(e))
      return (a ? ">" : "above ") + wt(i - 1n, e, !1, !0);
  }
  return Lt(t, i, wt(i, e, !1, !0));
}
function gr(t, e = {}) {
  if (e = M(e, ["digits", "bounds", "open"], "formatProb"), !ot(t)) return lt;
  const r = e.open ?? !1;
  if (typeof r != "boolean") throw new RangeError(`formatProb: open must be true or false, got ${String(r)}`);
  return wr(t, _t("digits", e.digits ?? 3), e.bounds ?? !0, !0, r);
}
function uo(t, e = {}) {
  return e = M(e, ["digits", "bounds"], "formatRisk"), ot(t) ? wr(t, _t("digits", e.digits ?? 4), e.bounds ?? !0, !1) : lt;
}
function dr(t, e) {
  let r = e - 1 - Math.floor(Math.log10(t));
  const n = 10n ** BigInt(e - 1), o = n * 10n;
  for (let s = 0; s < 5; s += 1) {
    const i = Vt(t, r);
    if (i >= o) r -= 1;
    else if (i < n) r += 1;
    else return { d: r, q: i };
  }
  throw new Error("sigPlaces did not converge");
}
function pr(t, e = {}) {
  if (e = M(e, ["sig", "leadingZero", "group"], "formatSig"), !ot(t)) return lt;
  const r = _t("sig", e.sig ?? 3, 1);
  if (t === 0) return "0";
  const { d: n, q: o } = dr(Math.abs(t), r);
  return Lt(t, o, wt(o, n, e.leadingZero ?? !1, e.group ?? !0));
}
const ln = {
  0: "⁰",
  1: "¹",
  2: "²",
  3: "³",
  4: "⁴",
  5: "⁵",
  6: "⁶",
  7: "⁷",
  8: "⁸",
  9: "⁹"
};
function fo(t, e = {}) {
  if (e = M(e, ["sig", "trim", "style"], "formatSci"), !ot(t)) return lt;
  const r = _t("sig", e.sig ?? 3, 1);
  if (t === 0) return "0";
  const { d: n, q: o } = dr(Math.abs(t), r), s = r - 1 - n, i = o.toString();
  let a = i.length > 1 ? `${i[0]}.${i.slice(1)}` : i;
  e.trim && (a = a.replace(/\.?0+$/, ""));
  const c = t < 0 ? yt : "", u = String(Math.abs(s));
  if (e.style === "times") {
    const l = (s < 0 ? "⁻" : "") + [...u].map((f) => ln[f]).join("");
    return `${c}${a} × 10${l}`;
  }
  return `${c}${a}e${s < 0 ? yt : ""}${u}`;
}
function ho(t, e = {}) {
  if (e = M(e, ["digits", "bounds"], "formatPercent"), !ot(t)) return lt;
  const r = _t("digits", e.digits ?? 0);
  if (t === 0) return "0%";
  if (t === 1) return "100%";
  const n = Vt(Math.abs(t), r + 2), o = e.bounds ?? !0;
  if (o !== !1 && t > 0 && t < 1) {
    const s = o === "symbols";
    if (n === 0n) return `${s ? "<" : "below "}${wt(1n, r, !0, !0)}%`;
    if (n === 100n * 10n ** BigInt(r)) return `${s ? ">" : "above "}${wt(n - 1n, r, !0, !0)}%`;
  }
  return Lt(t, n, wt(n, r, !0, !0)) + "%";
}
function jt(t) {
  if (typeof t == "bigint") return (t < 0n ? yt : "") + Ht((t < 0n ? -t : t).toString());
  if (!ot(t)) return lt;
  if (!Number.isInteger(t)) throw new RangeError(`formatCount needs an integer, got ${t}`);
  if (!Number.isSafeInteger(t)) throw new RangeError(`formatCount: ${t} is above 2^53; pass a BigInt`);
  return t === 0 ? "0" : (t < 0 ? yt : "") + Ht(String(Math.abs(t)));
}
function un(t, e, r = {}) {
  return r = M(r, ["digits", "sig", "bounds"], "formatRatio"), !ot(t) || !ot(e) || e === 0 ? lt : br(t / e, r);
}
function br(t, e) {
  return e.sig !== void 0 ? pr(t, { sig: e.sig }) : gr(t, { digits: e.digits, bounds: e.bounds });
}
function mo(...t) {
  const [e, r, n] = t;
  if (t.length >= 2 && (r === null || typeof r != "object")) {
    const i = M(n, ["digits", "sig", "bounds"], "formatEoverN"), a = r;
    return ot(a) && a === 0 ? Le : un(e, a, i);
  }
  const o = M(r, ["digits", "sig", "bounds"], "formatEoverN"), s = (i) => i == null ? Le : ot(i) ? br(i, o) : lt;
  return e !== null && typeof e == "object" && typeof e.length == "number" ? Array.from(e, s) : s(e);
}
function wo(t, e = {}) {
  if (e = M(e, ["digits", "sig", "leadingZero"], "formatSigned"), !ot(t)) return lt;
  if (t === 0) return "0";
  const r = e.sig !== void 0 ? pr(Math.abs(t), { sig: e.sig, leadingZero: e.leadingZero }) : mr(Math.abs(t), { digits: e.digits ?? 3, leadingZero: e.leadingZero });
  return /[1-9]/.test(r) ? (t > 0 ? "+" : yt) + r : r;
}
function We(t, e) {
  if (typeof e == "bigint") return e;
  if (!Number.isSafeInteger(e)) throw new RangeError(`${t} must be a safe integer or a BigInt, got ${String(e)}`);
  return BigInt(e);
}
function fn(t, e) {
  for (; e !== 0n; ) [t, e] = [e, t % e];
  return t;
}
function Ee(t, e) {
  let r = We("num", t), n = We("den", e);
  if (n === 0n) return lt;
  if (n < 0n && (r = -r, n = -n), r === 0n) return "0";
  const o = r < 0n;
  o && (r = -r);
  const s = fn(r, n);
  return r /= s, n /= s, (o ? yt : "") + (n === 1n ? r.toString() : `${r}/${n}`);
}
function ve(t, e = {}) {
  if (e = M(e, ["maxDenominator", "tolerance"], "rationalApprox"), !ot(t)) return null;
  const r = e.maxDenominator ?? 1e3, n = (e.tolerance ?? 1e-12) * Math.max(1, Math.abs(t)), o = t < 0 ? -1 : 1, s = Math.abs(t);
  let i = s, a = 1, c = 0, u = 0, l = 1;
  for (let f = 0; f < 64; f += 1) {
    const h = Math.floor(i), m = h * a + c, g = h * u + l;
    if (g > r) return null;
    if (Math.abs(s - m / g) <= n) return { num: o * m, den: g };
    const d = i - h;
    if (d === 0) return null;
    i = 1 / d, c = a, a = m, l = u, u = g;
  }
  return null;
}
function go(t, e = {}) {
  if (e = M(e, ["maxDenominator", "tolerance"], "formatRational"), !ot(t)) return lt;
  const r = ve(t, e);
  if (!r) throw new RangeError(`formatRational: ${t} is not a fraction with denominator <= ${e.maxDenominator ?? 1e3}`);
  return Ee(r.num, r.den);
}
const hn = /* @__PURE__ */ new Set([1, 2, 3, 4, 6, 8, 12]);
function mn(t, e, r) {
  const n = Math.abs(t);
  for (let o = e; o <= r; o += 1) {
    const s = Vt(n, o);
    if (Math.abs(n - Number(s) / 10 ** o) <= 1e-12 * Math.max(1, n)) return Lt(t, s, wt(s, o, !1, !0));
  }
  return null;
}
function Ue(t, e) {
  if (Number.isInteger(t)) return (t < 0 ? yt : "") + String(Math.abs(t));
  const r = mn(t, e, 4);
  if (r !== null) return r;
  const n = ve(t, { maxDenominator: 12 });
  return n ? Ee(n.num, n.den) : mr(t, { digits: 4 });
}
function po(t) {
  if (t != null && typeof t == "object") {
    const e = Array.from(t);
    if (!e.every(ot)) return lt;
    const r = e.map((n) => ve(n, { maxDenominator: 12 }));
    return r.every((n) => n !== null && hn.has(n.den)) ? `(${r.map((n) => Ee(n.num, n.den)).join(", ")})` : `(${e.map((n) => Ue(n, 1)).join(", ")})`;
  }
  return ot(t) ? Ue(t, 2) : lt;
}
function yr(t, e, r) {
  const n = Array.from(e);
  for (const o of n) if (!Number.isInteger(o) || o < r) throw new RangeError(`${t}: entries must be integers >= ${r}, got ${String(o)}`);
  return n;
}
function bo(t) {
  return yr("formatGrades", t, 1).join("/");
}
function yo(t, e = {}) {
  e = M(e, ["label"], "formatSizes");
  const r = yr("formatSizes", t, 0).map((n) => jt(n)).join(", ");
  return e.label ?? !0 ? `sizes ${r}` : r;
}
function Eo(t, e = (r) => gr(r)) {
  return `(${Array.from(t, (r) => e(r)).join(", ")})`;
}
class q {
  constructor() {
    z(this, "s", 0);
    z(this, "c", 0);
  }
  add(e) {
    const r = this.s + e;
    Math.abs(this.s) >= Math.abs(e) ? this.c += this.s - r + e : this.c += e - r + this.s, this.s = r;
  }
  get value() {
    return this.s + this.c;
  }
}
function zt(t) {
  if (t <= 26) return Array.from({ length: t }, (r, n) => String.fromCharCode(65 + n));
  const e = String(t).length;
  return Array.from({ length: t }, (r, n) => `U${String(n + 1).padStart(e, "0")}`);
}
function wn(t) {
  return Array.from({ length: t }, (e, r) => `k${r + 1}`);
}
function Ye(t, e, r, n) {
  if (t === void 0) return n;
  if (!Array.isArray(t) || t.length !== e) throw new RangeError(`${r} must be ${e} strings`);
  if (!t.every((o) => typeof o == "string") || new Set(t).size !== t.length)
    throw new RangeError(`${r} must be distinct strings`);
  return [...t];
}
function It(t, e, r) {
  return {
    ids: Ye(t?.ids, e, "ids", zt(e)),
    criteria: Ye(t?.criteria, r, "criteria", wn(r))
  };
}
function Nt(t) {
  return Array.from({ length: t }, (e, r) => {
    const n = new Array(t).fill(0);
    return n[r] = Number.NaN, n;
  });
}
function gt(t, e) {
  if (t == null || typeof t != "object" || typeof t.length != "number" || t.length < 1)
    throw new RangeError(`${e} must be a nonempty array of units`);
  const r = t.length, n = t[0], o = typeof n == "number" ? 1 : n?.length;
  if (typeof o != "number" || o < 1) throw new RangeError(`${e}[0] must be a number or a nonempty array`);
  const s = new Float64Array(r * o);
  for (let i = 0; i < r; i += 1) {
    const a = t[i];
    if (typeof a == "number") {
      if (o !== 1) throw new RangeError(`${e}[${i}] must have ${o} criterion values`);
      s[i] = a;
    } else {
      if (a == null || typeof a != "object" || a.length !== o)
        throw new RangeError(`${e}[${i}] must have ${o} criterion values`);
      for (let c = 0; c < o; c += 1) s[i * o + c] = a[c];
    }
  }
  for (let i = 0; i < s.length; i += 1)
    if (!Number.isFinite(s[i])) throw new RangeError(`${e} must contain finite numbers only`);
  return { n: r, K: o, v: s };
}
function Zt(t, e) {
  if (typeof t != "number" || !Number.isFinite(t)) throw new RangeError(`${e} must be a finite number`);
}
function Qt(t, e) {
  if (typeof t != "number" || !Number.isFinite(t) || t < 0) throw new RangeError(`${e} must be a finite SD ≥ 0`);
}
function ee(t, e, r) {
  const n = t * t + e * e - 2 * r * t * e;
  if (!(n > 0))
    throw new RangeError(
      "the difference of the two targets has SD 0, so its direction is not a normal probability (use finiteLawPairwise for point masses)"
    );
  return Math.sqrt(n);
}
function Q(t, e) {
  if (t == null) {
    if (e === 1) return [1];
    throw new RangeError(`weights w are required when there are ${e} criteria`);
  }
  if (!Array.isArray(t) || t.length !== e) throw new RangeError(`w must hold ${e} weights`);
  const r = new q();
  for (const n of t) {
    if (typeof n != "number" || !Number.isFinite(n) || n < 0) throw new RangeError("weights must be finite and ≥ 0");
    r.add(n);
  }
  if (Math.abs(r.value - 1) > 1e-12) throw new RangeError("weights must sum to 1 (within 1e-12); they are not normalized");
  return [...t];
}
const me = (t) => t != null && typeof t == "object" && typeof t.length == "number";
function Bt(t, e) {
  if (!Array.isArray(t) || t.length < 1) throw new RangeError(`${e} must be a nonempty criterion-major array e[k][i][j] (K × n × n)`);
  const r = me(t[0]) ? t[0].length : 0;
  if (r < 2) throw new RangeError(`${e} must have at least two units`);
  for (let n = 0; n < t.length; n += 1) {
    const o = t[n];
    if (!me(o) || o.length !== r) throw new RangeError(`${e}[${n}] must be ${r} × ${r}`);
    for (let s = 0; s < r; s += 1) {
      const i = o[s];
      if (!me(i) || i.length !== r) throw new RangeError(`${e}[${n}] must be ${r} × ${r}`);
      for (let a = 0; a < r; a += 1)
        if (s !== a && (typeof i[a] != "number" || !Number.isFinite(i[a])))
          throw new RangeError(`${e}[${n}][${s}][${a}] must be a finite number`);
    }
  }
  return { n: r, K: t.length };
}
function tt(t, e = "E") {
  if (t == null || typeof t != "object") throw new RangeError(`${e} must be an ErrorArray { ids, criteria, e }`);
  return { ...Bt(t.e, `${e}.e`), e: t.e };
}
function rt(t, e, r, n) {
  if (t.length === 1) return e[0] * t[0][r][n];
  const o = new q();
  for (let s = 0; s < t.length; s += 1) o.add(e[s] * t[s][r][n]);
  return o.value;
}
function Ae(t, e) {
  const r = new q();
  for (let n = 0; n < t.length; n += 1) {
    const o = t[n];
    if (typeof o != "number" || !Number.isFinite(o) || o < 0) throw new RangeError(`${e} must be finite and ≥ 0`);
    r.add(o);
  }
  if (Math.abs(r.value - 1) > 1e-12) throw new RangeError(`${e} must sum to 1 (within 1e-12); they are not normalized`);
}
function Ft(t, e, r) {
  if (t == null || typeof t != "object" || typeof t.length != "number" || t.length < 1)
    throw new RangeError(`${r} must be a nonempty array of states`);
  const n = t.length, o = [];
  let s = 0, i = 0;
  for (let c = 0; c < n; c += 1) {
    const u = gt(t[c], `${r}[${c}]`);
    if (c === 0)
      s = u.n, i = u.K;
    else if (u.n !== s || u.K !== i)
      throw new RangeError(`${r}[${c}] must have ${s} units × ${i} criteria, as ${r}[0]`);
    o.push(u.v);
  }
  let a = null;
  if (e != null) {
    if (typeof e != "object" || e.length !== n) throw new RangeError(`probs must have one value per state (${n})`);
    Ae(e, "probs"), a = Float64Array.from(e);
  }
  return { S: n, n: s, K: i, states: o, p: a };
}
const Er = 0, Ne = 1, vr = 2, Re = 3, gn = 4;
function He(t, e, r) {
  switch (t) {
    case Er:
      return e < r;
    case Ne:
      return e === r;
    case vr:
      return e > r;
    case Re:
      return e <= r;
    default:
      return e !== r;
  }
}
function ke(t, e, r) {
  const { S: n, n: o, K: s, states: i, p: a } = t, c = e.map(() => Array.from({ length: s }, () => Nt(o))), u = new Float64Array(e.length), l = e.map(() => new q());
  for (let f = 0; f < s; f += 1)
    for (let h = 0; h < o; h += 1)
      for (let m = 0; m < o; m += 1) {
        if (h === m) continue;
        const g = h * s + f, d = m * s + f;
        if (a === null) {
          u.fill(0);
          for (let w = 0; w < n; w += 1) {
            const p = i[w][g], y = i[w][d];
            for (let E = 0; E < e.length; E += 1) He(e[E], p, y) && (u[E] += 1);
          }
          for (let w = 0; w < e.length; w += 1)
            r !== void 0 && (r[w][f][h][m] = u[w]), c[w][f][h][m] = u[w] / n;
        } else {
          for (let w = 0; w < e.length; w += 1) l[w] = new q();
          for (let w = 0; w < n; w += 1) {
            const p = i[w][g], y = i[w][d];
            for (let E = 0; E < e.length; E += 1) He(e[E], p, y) && l[E].add(a[w]);
          }
          for (let w = 0; w < e.length; w += 1) c[w][f][h][m] = l[w].value;
        }
      }
  return c;
}
function dn(t, e, r, n, o = {}) {
  Zt(t, "meanA"), Zt(r, "meanB"), Qt(e, "sdA"), Qt(n, "sdB");
  const s = M(o, ["corr"], "pairDirection").corr ?? 0;
  if (typeof s != "number" || !(s >= -1 && s <= 1)) throw new RangeError("corr must lie in [−1, 1]");
  return At((t - r) / ee(e, n, s));
}
function vo(t, e) {
  const r = gt(t, "means");
  if (r.K !== 1) throw new RangeError("directionMatrix takes one mean per unit");
  const n = r.n, o = typeof e == "number" ? new Float64Array(n).fill(e) : gt(e, "sds").v;
  if (o.length !== n) throw new RangeError(`sds must have ${n} values`);
  o.forEach((i, a) => Qt(i, `sds[${a}]`));
  const s = Nt(n);
  for (let i = 0; i < n; i += 1)
    for (let a = 0; a < n; a += 1)
      i !== a && (s[i][a] = At((r.v[i] - r.v[a]) / ee(o[i], o[a], 0)));
  return s;
}
function pn(t, e, r = {}) {
  r = M(r, ["ids", "criteria", "orient"], "errorArray");
  const n = gt(t, "means"), { n: o, K: s } = n;
  let i;
  if (typeof e == "number")
    i = new Float64Array(o * s).fill(e);
  else {
    const f = gt(e, "sds");
    if (f.n !== o || f.K !== s) throw new RangeError(`sds must be ${o} units × ${s} criteria, as means`);
    i = f.v;
  }
  i.forEach((f) => Qt(f, "sds"));
  const a = r.orient ?? new Array(s).fill(1);
  if (a.length !== s || !Array.from(a).every((f) => f === 1 || f === -1))
    throw new RangeError(`orient must hold ${s} values, each +1 or −1`);
  const { ids: c, criteria: u } = It(r, o, s), l = Array.from({ length: s }, () => Nt(o));
  for (let f = 0; f < s; f += 1)
    for (let h = 0; h < o; h += 1)
      for (let m = 0; m < o; m += 1) {
        if (h === m) continue;
        const g = ee(i[h * s + f], i[m * s + f], 0);
        l[f][h][m] = At(a[f] * (n.v[m * s + f] - n.v[h * s + f]) / g);
      }
  return { ids: c, criteria: u, e: l };
}
function bn(t, e, r = {}) {
  r = M(r, ["ids", "criteria"], "finiteLawPairwise");
  const n = Ft(t, e, "states"), { ids: o, criteria: s } = It(r, n.n, n.K), [i, a, c] = ke(n, [vr, Re, Ne]);
  return { ids: o, criteria: s, e: a, pi: i, t: c };
}
function Ao(t) {
  if (!Array.isArray(t) || t.length < 1) throw new RangeError("components must be a nonempty array");
  Ae(
    t.map((r) => r.w),
    "component weights w"
  );
  const e = new q();
  for (const r of t)
    e.add(r.w * dn(r.meanA, r.sdA, r.meanB, r.sdB, { corr: r.corr ?? 0 }));
  return e.value;
}
function Ar(t, e = {}) {
  e = M(e, ["ids", "criteria"], "drawErrors");
  const r = Ft(t, null, "draws"), { ids: n, criteria: o } = It(e, r.n, r.K), s = Array.from({ length: r.K }, () => Nt(r.n)), [i] = ke(r, [Re], [s]);
  return { ids: n, criteria: o, e: i, S: r.S, counts: s };
}
function No(t, e, r = {}) {
  r = M(r, ["ids", "criteria"], "tieLawPairwise");
  const n = Ft(t, e, "states"), { ids: o, criteria: s } = It(r, n.n, n.K), [i, a, c] = ke(n, [Er, Ne, gn]);
  return { ids: o, criteria: s, b: i, t: a, d: c };
}
function Ro(t, e, r = {}) {
  const n = M(r, ["ids", "criteria"], "finiteLawMargins"), o = Ft(t, e, "states"), { S: s, n: i, K: a, p: c } = o, u = It(n, i, a), l = [];
  for (let f = 0; f < i; f += 1) {
    const h = [];
    for (let m = 0; m < a; m += 1) {
      const g = /* @__PURE__ */ new Map();
      for (let w = 0; w < s; w += 1) {
        const p = o.states[w][f * a + m];
        g.set(p, (g.get(p) ?? 0) + (c === null ? 1 : c[w]));
      }
      const d = [...g.keys()].sort((w, p) => w - p);
      h.push({ values: d, probs: d.map((w) => c === null ? g.get(w) / s : g.get(w)) });
    }
    l.push(h);
  }
  return {
    ...n.ids !== void 0 ? { ids: u.ids } : {},
    ...n.criteria !== void 0 ? { criteria: u.criteria } : {},
    margins: l
  };
}
function yn(t, e) {
  const r = t ?? 1e-12;
  if (typeof r != "number" || !Number.isFinite(r) || r < 0) throw new RangeError(`${e}: tieTol must be a finite number ≥ 0, got ${String(r)}`);
  return r;
}
function ko(t, e = {}) {
  const r = M(e, ["w", "tieTol"], "majorityWins"), { n, K: o, e: s } = tt(t), i = Q(r.w, o), a = yn(r.tieTol, "majorityWins"), c = new Float64Array(n * n);
  for (let d = 0; d < n; d += 1) for (let w = 0; w < n; w += 1) d !== w && (c[d * n + w] = rt(s, i, d, w));
  const u = new Uint8Array(n * n), l = new Array(n).fill(0), f = new Array(n).fill(0);
  for (let d = 0; d < n; d += 1)
    for (let w = 0; w < n; w += 1) {
      if (d === w) continue;
      const p = c[d * n + w], y = c[w * n + d];
      p < y - a && (u[d * n + w] = 1, l[d] += 1), Math.abs(p - y) <= a && (f[d] += 1);
    }
  const h = l.map((d, w) => w).sort((d, w) => l[w] - l[d] || d - w), m = [];
  for (let d = 0; d < n; d += 1)
    for (let w = d + 1; w < n; w += 1)
      for (let p = w + 1; p < n; p += 1) {
        const y = u[d * n + w] && u[w * n + p] && u[p * n + d], E = u[d * n + p] && u[p * n + w] && u[w * n + d];
        y ? m.push([d, w, p]) : E && m.push([d, p, w]);
      }
  const g = m.length;
  return { wins: l, ties: f, order: h, cycles: g, strictOrder: g === 0 && f.every((d) => d === 0), cycleTriples: m };
}
function $o(t, e = {}) {
  const r = M(e, ["k", "w", "order"], "leastCertainPairs"), { n, K: o, e: s } = tt(t), i = Q(r.w, o), a = r.k ?? 10;
  if (typeof a != "number" || !Number.isSafeInteger(a) || a < 1) throw new RangeError(`leastCertainPairs: k must be a positive integer, got ${String(a)}`);
  let c = null;
  if (r.order !== void 0 && r.order !== null) {
    if (!Array.isArray(r.order) || r.order.length !== n) throw new RangeError(`leastCertainPairs: order must list all ${n} unit indices`);
    c = new Int32Array(n).fill(-1), r.order.forEach((f, h) => {
      if (typeof f != "number" || !Number.isInteger(f) || f < 0 || f >= n || c[f] !== -1)
        throw new RangeError(`leastCertainPairs: order must be a permutation of 0..${n - 1}`);
      c[f] = h;
    });
  }
  const u = [];
  for (let f = 0; f < n; f += 1)
    for (let h = f + 1; h < n; h += 1) {
      const m = rt(s, i, f, h), g = rt(s, i, h, f);
      u.push({ i: f, j: h, e: Math.min(m, g), above: m <= g ? f : h });
    }
  u.sort((f, h) => h.e - f.e);
  const l = u.slice(0, Math.min(a, u.length));
  if (c !== null) for (const f of l) f.apart = Math.abs(c[f.i] - c[f.j]);
  return l;
}
function Mo(t, e = {}) {
  const r = M(e, ["w", "thresholds"], "pairCertainty"), { n, K: o, e: s } = tt(t), i = Q(r.w, o), a = r.thresholds ?? [0.9, 0.99];
  if (!Array.isArray(a) || a.length < 1)
    throw new RangeError("pairCertainty: thresholds must be a nonempty array of numbers in (1/2, 1)");
  a.forEach((l, f) => {
    if (typeof l != "number" || !(l > 0.5 && l < 1)) throw new RangeError(`pairCertainty: thresholds must lie in (1/2, 1), got ${String(l)}`);
    if (f > 0 && !(l > a[f - 1])) throw new RangeError("pairCertainty: thresholds must be strictly increasing");
  });
  const c = a.map((l) => 1 - l), u = new Array(a.length).fill(0);
  for (let l = 0; l < n; l += 1)
    for (let f = l + 1; f < n; f += 1) {
      const h = Math.min(rt(s, i, l, f), rt(s, i, f, l));
      for (let m = 0; m < c.length; m += 1) h < c[m] && (u[m] += 1);
    }
  return { M: n * (n - 1) / 2, thresholds: [...a], counts: u };
}
function Io(t, e, r, n, o = {}) {
  const s = M(o, ["corr"], "pairDifference").corr ?? 0;
  Zt(t, "pairDifference: meanA"), Zt(r, "pairDifference: meanB");
  for (const [u, l] of [[e, "sdA"], [n, "sdB"]])
    if (typeof u != "number" || !Number.isFinite(u) || !(u > 0)) throw new RangeError(`pairDifference: ${l} must be a finite SD > 0, got ${String(u)}`);
  if (typeof s != "number" || !(s >= -1 && s <= 1)) throw new RangeError(`pairDifference: corr must be a number in [−1, 1], got ${String(s)}`);
  const i = t - r, a = ee(e, n, s), c = i / a;
  return { mean: i, sd: a, z: c, pi: At(c) };
}
function To(t, e, r) {
  const n = M(r, ["i", "j", "criterion"], "finiteLawCells", !0), o = Ft(t, e, "states"), { S: s, n: i, K: a, p: c } = o, u = (E, k, b, A) => {
    if (typeof E != "number" || !Number.isSafeInteger(E) || E < 0 || E >= b)
      throw new RangeError(`finiteLawCells: ${k} must be ${A} index, an integer in 0..${b - 1}, got ${String(E)}`);
    return E;
  }, l = u(n.i, "i", i, "a unit"), f = u(n.j, "j", i, "a unit");
  if (l === f) throw new RangeError(`finiteLawCells: i and j must be two different units, got ${l} for both`);
  const h = u(n.criterion ?? 0, "criterion", a, "a criterion"), m = (E) => [...new Set(o.states.map((k) => k[E * a + h]))].sort((k, b) => k - b), g = m(l), d = m(f), w = new Map(g.map((E, k) => [E, k])), p = new Map(d.map((E, k) => [E, k])), y = g.map(() => new Array(d.length).fill(0));
  for (let E = 0; E < s; E += 1) {
    const k = w.get(o.states[E][l * a + h]), b = p.get(o.states[E][f * a + h]);
    y[k][b] += c === null ? 1 : c[E];
  }
  if (c === null) for (const E of y) for (let k = 0; k < E.length; k += 1) E[k] /= s;
  return { rowValues: g, colValues: d, cells: y };
}
function En(t, e) {
  const r = tt(t, "Ehat"), n = tt(e, "E");
  if (r.n !== n.n || r.K !== n.K)
    throw new RangeError(`maxCoefficientError: Ehat and E must have the same shape (Ehat ${r.K} × ${r.n} × ${r.n}, E ${n.K} × ${n.n} × ${n.n})`);
  const { n: o, K: s } = r, i = [], a = [];
  for (let c = 0; c < s; c += 1) {
    let u = -1, l = { i: 0, j: 1 };
    for (let f = 0; f < o; f += 1)
      for (let h = 0; h < o; h += 1) {
        if (f === h) continue;
        const m = Math.abs(r.e[c][f][h] - n.e[c][f][h]);
        m > u && (u = m, l = { i: f, j: h });
      }
    i.push(u), a.push(l);
  }
  return { epsilon: i, at: a };
}
function Y(t) {
  if (typeof t != "number" || !(t > 0 && t <= 0.5))
    throw new RangeError(`tau must lie in (0, 1/2], got ${String(t)}`);
  return t;
}
function Ze(t, e, r) {
  Y(r);
  for (const [i, a] of [
    [t, "eIJ"],
    [e, "eJI"]
  ])
    if (typeof i != "number" || !Number.isFinite(i)) throw new RangeError(`${a} must be a finite number`);
  const n = { iAboveJ: t, jAboveI: e, withhold: r }, o = Math.min(t, e, r), s = ["iAboveJ", "jAboveI", "withhold"].filter((i) => n[i] - o <= 1e-12);
  return { costs: n, directionalMinimum: Math.min(t, e), best: s };
}
function U(t, e, r) {
  const n = M(r, ["tau", "w"], "evaluateReport", !0), { n: o, K: s, e: i } = tt(e), a = Y(n.tau), c = Q(n.w, s), u = X(t, o), { M: l, N: f, s: h, G: m } = Tt(u), g = [];
  for (let y = 0; y < s; y += 1) {
    const E = new q(), k = i[y];
    for (let b = 0; b < o; b += 1) for (let A = 0; A < o; A += 1) u[b] < u[A] && E.add(k[b][A]);
    g.push(E.value);
  }
  const d = new q();
  for (let y = 0; y < s; y += 1) d.add(c[y] * g[y]);
  const w = d.value, p = a * (l - f);
  return {
    M: l,
    N: f,
    s: h,
    G: m,
    E: g,
    EoverN: g.map((y) => f === 0 ? null : y / f),
    EoverM: g.map((y) => y / l),
    Rk: g.map((y) => (y + p) / l),
    Ew: w,
    risk: (w + p) / l,
    errorTerm: w / l,
    withholdingTerm: p / l
  };
}
function So(t, e) {
  const r = M(e, ["tau", "w"], "relaxedPairRisk", !0), { n, K: o, e: s } = tt(t), i = Y(r.tau), a = Q(r.w, o), c = new q();
  for (let u = 0; u < n; u += 1)
    for (let l = u + 1; l < n; l += 1) c.add(Math.min(rt(s, a, u, l), rt(s, a, l, u), i));
  return c.value / (n * (n - 1) / 2);
}
function xo(t, e, r = {}) {
  const n = M(r, ["w"], "betweenGradeErrors"), { n: o, K: s, e: i } = tt(e), a = Q(n.w, s), c = X(t, o), u = Tt(c).G, l = Array.from({ length: u }, () => Array.from({ length: u }, () => new q())), f = Array.from({ length: u }, () => new Array(u).fill(0)), h = Array.from({ length: u }, () => new Array(u).fill(Number.NEGATIVE_INFINITY));
  for (let g = 0; g < o; g += 1)
    for (let d = 0; d < o; d += 1) {
      if (!(c[g] < c[d])) continue;
      const w = rt(i, a, g, d), p = c[g] - 1, y = c[d] - 1;
      l[p][y].add(w), f[p][y] += 1, w > h[p][y] && (h[p][y] = w);
    }
  const m = [];
  for (let g = 0; g < u; g += 1)
    for (let d = g + 1; d < u; d += 1)
      m.push({ h: g + 1, hp: d + 1, pairs: f[g][d], meanError: l[g][d].value / f[g][d], maxError: h[g][d] });
  return m;
}
function Fo(t, e, r) {
  const n = M(r, ["tau", "w", "tieTol"], "statedAbove", !0), { n: o, K: s, e: i } = tt(e), a = Y(n.tau), c = Q(n.w, s), u = n.tieTol ?? 1e-12;
  if (typeof u != "number" || !Number.isFinite(u) || u < 0) throw new RangeError("tieTol must be a finite number ≥ 0");
  const l = X(t, o), f = [];
  let h = null;
  for (let m = 0; m < o; m += 1)
    for (let g = 0; g < o; g += 1) {
      if (!(l[m] < l[g])) continue;
      const d = rt(i, c, m, g);
      (h === null || d > h) && (h = d), d > a + u && f.push({ i: m, j: g, error: d });
    }
  return { pairs: f, count: f.length, max: h };
}
function Co(t, e, r) {
  const n = M(r, ["tau", "w"], "confidentPairs", !0), { n: o, K: s, e: i } = tt(e), a = Y(n.tau), c = Q(n.w, s), u = X(t, o), l = [];
  let f = 0;
  for (let h = 0; h < o; h += 1)
    for (let m = h + 1; m < o; m += 1) {
      if (!(Math.min(rt(i, c, h, m), rt(i, c, m, h)) < a)) continue;
      const g = u[h] === u[m];
      g && (f += 1), l.push({ i: h, j: m, withheld: g });
    }
  return { count: l.length, withheld: f, stated: l.length - f, pairs: l };
}
function Nr(t, e, r = {}) {
  const n = M(r, ["w"], "realizedWrong"), o = gt(e, "theta"), { n: s, K: i, v: a } = o, c = X(t, s), u = n.w === void 0 && i > 1 ? null : Q(n.w, i), l = Tt(c).N, f = new Array(i).fill(0), h = Array.from({ length: i }, () => []);
  for (let g = 0; g < i; g += 1)
    for (let d = 0; d < s; d += 1)
      for (let w = 0; w < s; w += 1)
        c[d] < c[w] && a[d * i + g] <= a[w * i + g] && (f[g] += 1, h[g].push({ i: d, j: w }));
  let m = null;
  if (u !== null) {
    const g = new q();
    for (let d = 0; d < i; d += 1) g.add(u[d] * f[d]);
    m = g.value;
  }
  return {
    N: l,
    D: f,
    DoverN: f.map((g) => l === 0 ? null : g / l),
    A: m,
    AoverN: m === null || l === 0 ? null : m / l,
    pairs: h
  };
}
function vn(t) {
  if (typeof t != "number" || !(t > 0 && t <= 1)) throw new RangeError(`lambda must lie in (0, 1], got ${String(t)}`);
  return t / (1 + t);
}
function An(t) {
  return Y(t), t / (1 - t);
}
function pe(t, e, r) {
  const n = M(r, ["lambda", "t"], "krwRisk", !0), { n: o, K: s, e: i } = tt(e);
  if (s !== 1) throw new RangeError("krwRisk takes one criterion (K = 1)");
  const a = n.lambda;
  if (typeof a != "number" || !(a >= 0 && a <= 1)) throw new RangeError(`lambda must lie in [0, 1], got ${String(a)}`);
  if (n.t !== void 0) {
    const d = Bt(n.t, "t");
    if (d.n !== o || d.K !== 1) throw new RangeError(`t must be one ${o} × ${o} matrix of equality probabilities (K = 1), as E`);
    for (let w = 0; w < o; w += 1)
      for (let p = 0; p < o; p += 1) if (w !== p && n.t[0][w][p] > 1e-15) throw new RangeError("the KRW correspondence needs a tie-free law");
  }
  const c = X(t, o), { M: u, N: l } = Tt(c), f = new q();
  for (let d = 0; d < o; d += 1) for (let w = 0; w < o; w += 1) c[d] < c[w] && f.add(i[0][d][w]);
  const h = f.value, m = h / u, g = (l - 2 * h) / u;
  return (1 - a) * m - a * g;
}
function Oo(t, e, r) {
  const n = M(r, ["tau", "w"], "equalityNeutralRisk", !0);
  if (e == null || typeof e != "object") throw new RangeError("tie must hold the arrays b and d");
  const { n: o, K: s } = Bt(e.b, "tie.b"), i = Bt(e.d, "tie.d");
  if (i.n !== o || i.K !== s) throw new RangeError("tie.b and tie.d must have the same shape");
  const a = Y(n.tau), c = Q(n.w, s), u = X(t, o), l = Tt(u).M, f = new q(), h = new q();
  for (let m = 0; m < s; m += 1) {
    const g = new q(), d = new q(), w = new q();
    for (let p = 0; p < o; p += 1)
      for (let y = 0; y < o; y += 1)
        u[p] < u[y] && g.add(e.b[m][p][y]), p < y && (w.add(e.d[m][p][y]), u[p] === u[y] && d.add(e.d[m][p][y]));
    f.add(c[m] * ((g.value + a * d.value) / l)), h.add(c[m] * (a * w.value / l));
  }
  return { risk: f.value, R0: h.value };
}
function Nn(t, e = {}) {
  if (e = M(e, ["M", "weights"], "disclosedErrorEstimands"), !Array.isArray(t) || t.length < 1) throw new RangeError("cases must be a nonempty array of { A, N }");
  const r = t.length, n = new q(), o = new q(), s = new q(), i = new q();
  let a = 0, c = !0;
  const u = /* @__PURE__ */ new Set(), l = [];
  for (const [h, m] of t.entries()) {
    const { A: g, N: d } = m ?? {};
    if (typeof g != "number" || !Number.isFinite(g) || g < 0) throw new RangeError(`cases[${h}].A must be finite and ≥ 0`);
    if (typeof d != "number" || !Number.isFinite(d) || d < 0) throw new RangeError(`cases[${h}].N must be finite and ≥ 0`);
    if (d === 0 && g !== 0) throw new RangeError(`cases[${h}] discloses nothing, so its wrong count must be 0`);
    n.add(g), o.add(d), d > 0 && (a += 1, s.add(g / d));
    const w = m.M ?? e.M;
    if (w === void 0) c = !1;
    else {
      if (typeof w != "number" || !Number.isFinite(w) || w <= 0 || d > w) throw new RangeError(`cases[${h}].M must be positive and ≥ N`);
      i.add(d / w), u.add(w), l.push(w);
    }
  }
  if (e.weights !== void 0 && e.weights !== null) {
    const h = e.weights;
    if (typeof h != "object" || typeof h.length != "number" || h.length !== r)
      throw new RangeError(`disclosedErrorEstimands: weights must hold one probability per case (${r})`);
    Ae(h, "disclosedErrorEstimands: weights");
    const m = c && u.size === 1 ? [...u][0] : null;
    let g = 0, d = 0, w = 0, p = 0, y = 0;
    for (let E = 0; E < r; E += 1) {
      const { A: k, N: b } = t[E], A = h[E];
      g += A * k, d += A * b, b > 0 && (w += A * k / b, p += A), c && (y += m !== null ? A * b : A * b / l[E]);
    }
    return {
      ERR: d > 0 ? g / d : null,
      meanFraction: p > 0 ? w / p : null,
      zeroImputed: w,
      positiveFrequency: p,
      meanDisclosure: c ? m !== null ? y / m : y : null
    };
  }
  const f = c ? u.size === 1 ? o.value / ([...u][0] * r) : i.value / r : null;
  return {
    ERR: o.value > 0 ? n.value / o.value : null,
    meanFraction: a > 0 ? s.value / a : null,
    zeroImputed: s.value / r,
    positiveFrequency: a / r,
    meanDisclosure: f
  };
}
function Go(t, e, r = {}) {
  const n = M(r, ["w"], "largestStatedError"), { n: o, K: s, e: i } = tt(e), a = Q(n.w, s), c = X(t, o);
  let u = null;
  for (let l = 0; l < o; l += 1)
    for (let f = 0; f < o; f += 1) {
      if (!(c[l] < c[f])) continue;
      const h = rt(i, a, l, f);
      (u === null || h > u.e) && (u = { e: h, i: l, j: f });
    }
  return u;
}
function Po(t, e, r, n = {}) {
  const o = M(n, ["w"], "wrongCountDistribution"), s = Ft(e, r, "states"), { S: i, n: a, K: c, p: u } = s, l = Q(o.w, c);
  if (t == null || typeof t != "object" || typeof t.length != "number")
    throw new RangeError("wrongCountDistribution: g must be an array of grade labels");
  for (let v = 0; v < t.length; v += 1) {
    const $ = t[v];
    if (typeof $ != "number" || !Number.isSafeInteger($) || $ < 1)
      throw new RangeError(`wrongCountDistribution: g must hold positive integer grade labels, got ${String($)}`);
  }
  const f = X(t, a), { N: h } = Tt(f);
  if (h === 0) return { N: h, values: [0], probs: [1], expected: 0, pNone: 1, pAllCriteriaRight: 1, unionBound: 1 };
  const m = new Float64Array(i), g = new Uint8Array(i);
  for (let v = 0; v < i; v += 1) {
    const { D: $ } = Nr(f, e[v], { w: l });
    let N = 0;
    for (let R = 0; R < c; R += 1) N += l[R] * $[R];
    m[v] = N, g[v] = $.every((R) => R === 0) ? 1 : 0;
  }
  const d = /* @__PURE__ */ new Map();
  let w = 0, p = 0, y = 0;
  for (let v = 0; v < i; v += 1) {
    const $ = u === null ? 1 : u[v], N = m[v];
    d.set(N, (d.get(N) ?? 0) + $), w += $ * N, N === 0 && (p += $), g[v] && (y += $);
  }
  const E = u === null ? i : 1, k = [...d.keys()].sort((v, $) => v - $), b = bn(e, r).e;
  let A = 0;
  for (let v = 0; v < a; v += 1)
    for (let $ = 0; $ < a; $ += 1) if (f[v] < f[$]) for (let N = 0; N < c; N += 1) A += b[N][v][$];
  return {
    N: h,
    values: k,
    probs: k.map((v) => d.get(v) / E),
    expected: w / E,
    pNone: p / E,
    pAllCriteriaRight: y / E,
    unionBound: Math.max(0, 1 - A)
  };
}
function jo(t, e, r = {}) {
  const n = M(r, ["w"], "claimsByDistance"), { n: o, K: s, e: i } = tt(e), a = Q(n.w, s);
  if (t == null || typeof t != "object" || typeof t.length != "number" || t.length !== o)
    throw new RangeError(`claimsByDistance: g must be a strict order of the ${o} units (a permutation of the grades 1..${o})`);
  const c = new Array(o).fill(-1);
  for (let l = 0; l < o; l += 1) {
    const f = t[l];
    if (typeof f != "number" || !Number.isSafeInteger(f) || f < 1 || f > o || c[f - 1] !== -1)
      throw new RangeError(`claimsByDistance: g must be a permutation of the grades 1..${o} (each grade once), got ${String(f)} at unit ${l}`);
    c[f - 1] = l;
  }
  const u = [];
  for (let l = 1; l < o; l += 1) {
    let f = 0, h = Number.NEGATIVE_INFINITY;
    for (let m = 1; m + l <= o; m += 1) {
      const g = rt(i, a, c[m - 1], c[m + l - 1]);
      f += g, g > h && (h = g);
    }
    u.push({ distance: l, count: o - l, expected: f, max: h });
  }
  return u;
}
function X(t, e) {
  const r = Ct(t);
  if (e !== void 0 && r.length !== e) throw new RangeError(`the grade vector must have one entry per unit (${e})`);
  if (r.length < 2) throw new RangeError("a report needs at least two units");
  return r;
}
function Tt(t) {
  const e = t.length;
  let r = 0;
  for (const a of t) a > r && (r = a);
  const n = new Array(r).fill(0);
  for (const a of t) n[a - 1] += 1;
  const o = Ot(e);
  let s = 0;
  for (const a of n) s += a * (a - 1) / 2;
  const i = o - s;
  return { M: o, N: i, s: i / o, G: r, sizes: n, withheld: o - i };
}
function St(t, e) {
  if (!Number.isSafeInteger(t)) throw new RangeError(`${e} must be an integer`);
}
const Rn = BigInt(Number.MAX_SAFE_INTEGER);
function kn(t) {
  return t <= Rn ? Number(t) : t;
}
function Qe(t) {
  let e = [1n];
  for (let r = 1; r <= t; r += 1) {
    const n = new Array(r + 1).fill(0n);
    for (let o = 1; o <= r; o += 1) n[o] = BigInt(o) * ((e[o] ?? 0n) + e[o - 1]);
    e = n;
  }
  return e;
}
function Xe(t, e) {
  if (e < 0 || e > t) return 0n;
  let r = 1n;
  const n = Math.min(e, t - e);
  for (let o = 1; o <= n; o += 1) r = r * BigInt(t - n + o) / BigInt(o);
  return r;
}
function Rr(t, e) {
  const r = Array.from(t), n = Array.from(e), o = Math.min(r.length, n.length);
  for (let s = 0; s < o; s += 1) {
    const i = r[s].codePointAt(0) - n[s].codePointAt(0);
    if (i !== 0) return i;
  }
  return r.length - n.length;
}
function Ct(t) {
  if (t == null || typeof t != "object" || typeof t.length != "number") throw new RangeError("g must be an array of grade labels");
  const e = Array.from(t);
  for (const o of e)
    if (typeof o != "number" || !Number.isSafeInteger(o)) throw new RangeError("grade labels must be integers");
  const r = [...new Set(e)].sort((o, s) => o - s), n = new Map(r.map((o, s) => [o, s + 1]));
  return e.map((o) => n.get(o));
}
function Ot(t) {
  if (St(t, "n"), t < 0) throw new RangeError("n must be ≥ 0");
  return t * (t - 1) / 2;
}
function _o(t) {
  return Tt(X(t));
}
function zo(t) {
  const e = Ct(t);
  return e.map((r) => e.map((n) => r < n ? 1 : r > n ? -1 : 0));
}
function qo(t) {
  const e = Ct(t), r = e.length;
  if (r < 1) throw new RangeError("g must hold at least one grade");
  const { sizes: n } = Tt(e), o = new Array(n.length + 1).fill(0);
  for (let u = 0; u < n.length; u += 1) o[u + 1] = o[u] + n[u];
  const s = e.map((u) => o[u - 1]), i = e.map((u) => n[u - 1] - 1), a = e.map((u, l) => r - 1 - i[l] - s[l]), c = a.map((u, l) => u + s[l]);
  return { n: r, partners: r - 1, above: a, below: s, stated: c, withheld: i };
}
function Ko(t) {
  const e = Ct(t), r = e.length, n = Nt(r);
  for (let i = 0; i < r; i += 1) for (let a = 0; a < r; a += 1) i !== a && (n[i][a] = e[i] <= e[a] ? 1 : 0);
  let o = !0;
  for (let i = 0; i < r && o; i += 1) for (let a = i + 1; a < r; a += 1) n[i][a] + n[a][i] < 1 && (o = !1);
  let s = !0;
  for (let i = 0; i < r && s; i += 1)
    for (let a = 0; a < r && s; a += 1)
      if (a !== i) {
        for (let c = 0; c < r; c += 1)
          if (!(c === i || c === a) && n[i][a] + n[a][c] - n[i][c] > 1) {
            s = !1;
            break;
          }
      }
  return { z: n, complete: o, transitive: s };
}
const $n = Object.freeze({
  all: ["kind"],
  atMost: ["kind", "G"],
  exactly: ["kind", "G"],
  order: ["kind", "order", "G", "exact", "blocks"]
});
function $e(t, e) {
  if (St(t, "n"), t < 1) throw new RangeError("n must be ≥ 1");
  if (e == null || typeof e != "object") throw new RangeError("family must be a family object");
  const r = $n[e.kind];
  if (r === void 0) throw new RangeError(`unknown family kind ${String(e.kind)}`);
  switch (xt(e, r, `family { kind: "${e.kind}" }`), e.kind) {
    case "all":
    case "atMost": {
      const n = e.kind === "all" ? t : e.G;
      St(n, "G");
      const o = Qe(t);
      let s = 0n;
      for (let i = 1; i <= Math.min(n, t); i += 1) s += o[i];
      return s;
    }
    case "exactly":
      return St(e.G, "G"), e.G < 1 || e.G > t ? 0n : Qe(t)[e.G];
    case "order": {
      const n = e.order;
      if (!Array.isArray(n) || n.length !== t) throw new RangeError(`order must list all ${t} unit indices`);
      const o = /* @__PURE__ */ new Set();
      for (const i of n) {
        if (!Number.isInteger(i) || i < 0 || i >= t || o.has(i)) throw new RangeError("order must be a permutation of 0..n−1");
        o.add(i);
      }
      let s = t;
      if (e.blocks !== void 0) {
        const i = e.blocks;
        if (!Array.isArray(i) || !i.every((a) => Number.isSafeInteger(a) && a >= 1) || i.reduce((a, c) => a + c, 0) !== t)
          throw new RangeError(`blocks must be positive block sizes along the order, summing to ${t}`);
        s = i.length;
      }
      if (e.exact !== void 0)
        return St(e.exact, "exact"), e.G !== void 0 && St(e.G, "G"), e.exact < 1 || e.exact > s || e.G !== void 0 && e.exact > e.G ? 0n : Xe(s - 1, e.exact - 1);
      if (e.G !== void 0) {
        St(e.G, "G");
        let i = 0n;
        for (let a = 1; a <= Math.min(e.G, s); a += 1) i += Xe(s - 1, a - 1);
        return i;
      }
      return 1n << BigInt(s - 1);
    }
    default:
      throw new RangeError(`unknown family kind ${String(e.kind)}`);
  }
}
function Do(t, e) {
  return kn($e(t, e));
}
function Mn(t, e = {}) {
  const r = M(e, ["direction", "ids"], "scoreOrder");
  if (t == null || typeof t != "object" || typeof t.length != "number" || t.length < 1)
    throw new RangeError("scores must be a nonempty array of numbers");
  const n = Array.from(t);
  if (!n.every((l) => typeof l == "number" && Number.isFinite(l))) throw new RangeError("scores must be finite numbers");
  const o = n.length, s = r.direction ?? "descending";
  if (s !== "descending" && s !== "ascending") throw new RangeError('direction must be "descending" or "ascending"');
  const i = r.ids === void 0 ? zt(o) : Array.from(r.ids);
  if (i.length !== o || !i.every((l) => typeof l == "string") || new Set(i).size !== o)
    throw new RangeError(`ids must be ${o} distinct strings`);
  const a = s === "descending" ? -1 : 1, c = n.map((l, f) => f).sort((l, f) => a * (n[l] - n[f]) || Rr(i[l], i[f])), u = [];
  for (let l = 0; l < o; l += 1)
    l > 0 && n[c[l]] === n[c[l - 1]] ? u[u.length - 1] += 1 : u.push(1);
  return { order: c, blocks: u };
}
function Bo(t, e = {}, r = "expected_rank") {
  M(e, ["ids", "expectedRank", "mean"], "reportCardRows summaries"), e = e ?? {};
  const n = Ct(t), o = n.length, s = e.ids === void 0 ? zt(o) : Array.from(e.ids);
  if (s.length !== o || !s.every((u) => typeof u == "string")) throw new RangeError(`summaries.ids must be ${o} strings`);
  const i = (u, l) => {
    const f = e[u];
    if (f == null || f.length !== o) throw new RangeError(`sort "${r}" needs summaries.${u} with ${o} values`);
    const h = Array.from(f, (m) => l * m);
    if (!h.every(Number.isFinite)) throw new RangeError(`summaries.${u} must be finite`);
    return h;
  };
  let a;
  switch (r) {
    case "grade":
      a = n.map((u, l) => l);
      break;
    case "expected_rank":
      a = i("expectedRank", 1);
      break;
    case "mean":
      a = i("mean", -1);
      break;
    case "label":
      a = new Array(o).fill(0);
      break;
    default:
      throw new RangeError('sort must be "grade", "expected_rank", "mean" or "label"');
  }
  const c = n.map((u, l) => l);
  return c.sort((u, l) => n[u] - n[l] || a[u] - a[l] || Rr(s[u], s[l]) || u - l), c;
}
function Vo(t, e, r = {}) {
  const n = M(r, ["direction"], "statedAgainst"), o = X(t), s = o.length;
  if (e == null || typeof e != "object" || typeof e.length != "number" || e.length !== s)
    throw new RangeError(`statedAgainst: scores must hold one number per unit (${s})`);
  const i = Array.from(e);
  if (!i.every((h) => typeof h == "number" && Number.isFinite(h))) throw new RangeError("statedAgainst: scores must be finite numbers");
  const a = n.direction ?? "descending";
  if (a !== "descending" && a !== "ascending") throw new RangeError('statedAgainst: direction must be "descending" or "ascending"');
  const c = a === "descending" ? (h, m) => i[h] > i[m] : (h, m) => i[h] < i[m], u = [], l = new Uint8Array(s);
  for (let h = 0; h < s; h += 1)
    for (let m = h + 1; m < s; m += 1) {
      if (o[h] === o[m]) continue;
      const g = o[h] < o[m] ? h : m, d = g === h ? m : h;
      c(d, g) && (u.push({ above: g, below: d }), l[d] = 1);
    }
  const f = [];
  for (let h = 0; h < s; h += 1) l[h] && f.push(h);
  return { count: u.length, pairs: u, units: f };
}
const Je = (t) => t > 0 ? "above" : t < 0 ? "below" : "withheld";
function In(t, e, r = null, n = {}) {
  const o = M(n, ["w"], "relationChange"), s = X(t), i = X(e, s.length), a = s.length;
  let c = null;
  if (r != null) {
    const { n: d, K: w, e: p } = tt(r);
    if (d !== a) throw new RangeError(`relationChange: E has ${d} units, the reports ${a}`);
    c = { e: p, w: Q(o.w, w) };
  } else if (o.w !== void 0)
    throw new RangeError("relationChange: w applies only together with E");
  let u = 0, l = 0, f = 0, h = 0;
  const m = [];
  for (let d = 0; d < a; d += 1)
    for (let w = d + 1; w < a; w += 1) {
      const p = Math.sign(s[w] - s[d]), y = Math.sign(i[w] - i[d]);
      if (p === y) {
        u += 1;
        continue;
      }
      p === 0 ? l += 1 : y === 0 ? f += 1 : h += 1;
      let E = null;
      c !== null && y !== 0 && (E = y > 0 ? rt(c.e, c.w, d, w) : rt(c.e, c.w, w, d)), m.push({ i: d, j: w, from: Je(p), to: Je(y), error: E });
    }
  const g = Ot(a);
  return { M: g, nSame: u, nNewDisclosed: l, nNewWithheld: f, nReversed: h, changed: m.length, changeShare: m.length / g, agreement: u / g, pairs: m };
}
function Lo(t, e, r = {}) {
  const n = M(r, ["order", "blocks"], "cutGrade");
  if (typeof t != "number" || !Number.isSafeInteger(t) || t < 2) throw new RangeError("cutGrade: n must be an integer ≥ 2");
  if (!Array.isArray(e)) throw new RangeError("cutGrade: cuts must be an array of positions");
  for (let c = 0; c < e.length; c += 1) {
    const u = e[c];
    if (typeof u != "number" || !Number.isSafeInteger(u) || u < 1 || u > t - 1)
      throw new RangeError(`cutGrade: cut ${String(u)} must be an integer in 1…${t - 1}`);
    if (c > 0 && !(u > e[c - 1])) throw new RangeError("cutGrade: cuts must be strictly increasing");
  }
  if (e.length + 1 > 127) throw new RangeError("cutGrade: at most 126 cuts (127 grades)");
  let o;
  if (n.order === void 0 || n.order === null) o = Array.from({ length: t }, (c, u) => u);
  else {
    if (!Array.isArray(n.order) || n.order.length !== t) throw new RangeError(`cutGrade: order must list all ${t} unit indices`);
    const c = new Uint8Array(t);
    for (const u of n.order) {
      if (typeof u != "number" || !Number.isInteger(u) || u < 0 || u >= t || c[u])
        throw new RangeError("cutGrade: order must be a permutation of 0…n−1");
      c[u] = 1;
    }
    o = Array.from(n.order);
  }
  if (n.blocks !== void 0 && n.blocks !== null) {
    if (!Array.isArray(n.blocks)) throw new RangeError("cutGrade: blocks must be a list of [from, to] position ranges");
    for (const c of n.blocks) {
      if (!(Array.isArray(c) && c.length === 2 && c.every((h) => typeof h == "number" && Number.isSafeInteger(h)) && c[0] >= 1 && c[0] <= c[1] && c[1] <= t)) throw new RangeError(`cutGrade: each block must be [from, to] with 1 ≤ from ≤ to ≤ ${t}`);
      const [l, f] = c;
      for (const h of e)
        if (l <= h && h < f)
          throw new RangeError(`cutGrade: cut ${h} falls inside block [${l}, ${f}] (positions ${l}…${f} must share a grade)`);
    }
  }
  const s = new Int8Array(t);
  let i = 1, a = 0;
  for (let c = 1; c <= t; c += 1) {
    for (; a < e.length && e[a] < c; )
      i += 1, a += 1;
    s[o[c - 1]] = i;
  }
  return s;
}
const Tn = Object.freeze({
  maxReports: 6e5,
  maxUnits: 20
}), Me = 5e3, Sn = 1e-12, xn = 1e-12, Fn = 20000000n;
function st(t, e) {
  const r = t?.e, n = Array.isArray(r) ? r[0] : void 0, o = n != null && typeof n == "object" && typeof n.length == "number" ? n.length : 0;
  U(new Array(Math.max(o, 0)).fill(1), t, { tau: 0.5, w: e });
  const s = t.e.length, i = Q(e, s), a = t.e.map((u) => {
    const l = new Float64Array(o * o);
    for (let f = 0; f < o; f += 1) for (let h = 0; h < o; h += 1) f !== h && (l[f * o + h] = u[f][h]);
    return l;
  }), c = new Float64Array(o * o);
  for (let u = 0; u < o; u += 1)
    for (let l = 0; l < o; l += 1)
      if (u !== l)
        if (s === 1) c[u * o + l] = i[0] * a[0][u * o + l];
        else {
          const f = new q();
          for (let h = 0; h < s; h += 1) f.add(i[h] * a[h][u * o + l]);
          c[u * o + l] = f.value;
        }
  return { n: o, K: s, M: Ot(o), w: i, ebar: c, ek: a };
}
function nt(t, e) {
  const r = t ?? Sn;
  if (typeof r != "number" || !Number.isFinite(r) || r < 0) throw new RangeError(`${e} must be a finite number ≥ 0`);
  return r;
}
const Cn = "₀₁₂₃₄₅₆₇₈₉", On = (t) => Array.from(String(t), (e) => Cn[Number(e)]).join("");
function Pt(t, e) {
  const r = { name: t.name, words: t.words, size: sr(e) };
  return t.baseSize !== void 0 && (r.baseSize = t.baseSize), t.budgets !== void 0 && (r.budgets = t.budgets), ir(r, "sizeExact", e);
}
function ut(t, e) {
  const r = $e(t, e), n = (o) => `${o} ${Dt(o, "grade")}`;
  switch (e.kind) {
    case "all":
      return Pt({ name: `𝒜${On(t)}`, words: `all reports on ${t} units` }, r);
    case "atMost":
      return Pt({ name: `𝒜_≤${e.G}`, words: `reports with at most ${n(e.G)}` }, r);
    case "exactly":
      return Pt({ name: `𝒜_=${e.G}`, words: `reports with exactly ${n(e.G)}` }, r);
    case "order": {
      let o = "𝒜ᵨ", s = "contiguous cuts of the declared order";
      return e.exact !== void 0 ? (o += `,=${e.exact}`, s += ` with exactly ${n(e.exact)}`) : e.G !== void 0 && (o += `,≤${e.G}`, s += ` with at most ${n(e.G)}`), e.blocks !== void 0 && e.blocks.some((i) => i > 1) && (s += ", equal order scores kept together"), Pt({ name: o, words: s }, r);
    }
    default:
      throw new RangeError("unknown family kind");
  }
}
function Gt(t, e) {
  if ($e(t, e) === 0n) return !1;
  switch (e.kind) {
    case "all":
    case "atMost":
      return !0;
    case "exactly":
      return e.G === 1;
    case "order":
      return e.exact === void 0 || e.exact === 1;
    default:
      return !1;
  }
}
function Rt(t, e) {
  return { empty: !0, family: t, containsAllWithheld: !1, label: e };
}
function Gn(t, e) {
  if (t === void 0) return [];
  if (!Array.isArray(t)) throw new RangeError("pairConstrainedOptimum: stating must be a list of [i, j] pairs");
  const r = [], n = /* @__PURE__ */ new Set();
  for (const o of t) {
    if (!Array.isArray(o) || o.length !== 2 || !o.every((i) => typeof i == "number" && Number.isInteger(i) && i >= 0 && i < e) || o[0] === o[1])
      throw new RangeError(`pairConstrainedOptimum: each stating entry must be [i, j] with distinct unit indices in 0…${e - 1}`);
    const s = `${o[0]},${o[1]}`;
    n.has(s) || (n.add(s), r.push([o[0], o[1]]));
  }
  return r;
}
function Wt(t, e, r) {
  return Pt({
    name: r ? `𝒜_S (${t.name})` : t.name,
    words: r ? `${t.words} satisfying the stated pair directions` : t.words,
    baseSize: t.size
  }, e);
}
function Pn(t, e, r) {
  const n = e.blocks ?? new Array(t).fill(1), o = n.length, s = new Int32Array(t);
  let i = 0;
  n.forEach((f, h) => {
    for (let m = 0; m < f; m += 1) s[e.order[i++]] = h;
  });
  const a = new Int32Array(o + 1);
  for (const [f, h] of r) {
    const m = s[f], g = s[h];
    if (m >= g) return { minStart: a, size: 0n };
    a[g + 1] = Math.max(a[g + 1], m + 1);
  }
  for (let f = 1; f <= o; f += 1) a[f] = Math.max(a[f], a[f - 1]);
  const c = e.exact ?? Math.min(e.G ?? o, o);
  let u = new Array(o + 1).fill(0n);
  u[0] = 1n;
  let l = 0n;
  for (let f = 1; f <= c; f += 1) {
    const h = new Array(o + 2).fill(0n);
    for (let g = 0; g <= o; g += 1) h[g + 1] = h[g] + u[g];
    const m = new Array(o + 1).fill(0n);
    for (let g = f; g <= o; g += 1) m[g] = h[g] - h[a[g]];
    (e.exact === void 0 || e.exact === f) && (l += m[o]), u = m;
  }
  return { minStart: a, size: l };
}
function jn(t) {
  switch (t.kind) {
    case "order":
      return "Use fixedOrderDP for a declared order (any n).";
    case "all":
      return "Use fixedOrderDP for a declared order, or the browser solver for the unrestricted family.";
    default:
      return "Use fixedOrderDP for a declared order with this grade count (the browser solver takes the unrestricted family only).";
  }
}
function mt(t, e, r) {
  const { maxReports: n, maxUnits: o } = Tn, s = e.sizeExact, i = `${jt(s)} ${Dt(s, "report")}`, a = `${e.name} (${e.words})`, c = r === void 0 ? "Use fixedOrderDP for a declared order." : jn(r);
  if (t > o)
    throw new RangeError(
      `exact enumeration covers at most ${o} units; ${a} is on n = ${t} ${Dt(t, "unit")} (${i}). ${c}`
    );
  if (s > BigInt(n))
    throw new RangeError(
      `exact enumeration covers at most ${jt(n)} reports; ${a} has ${i} on n = ${t} ${Dt(t, "unit")}. ${c}`
    );
}
class we {
  constructor(e, r, n, o) {
    z(this, "g");
    z(this, "N", 0);
    z(this, "n");
    z(this, "cap");
    z(this, "exact");
    z(this, "ch");
    z(this, "C");
    z(this, "cnt");
    z(this, "distinct", 0);
    z(this, "maxAt");
    z(this, "Nd");
    z(this, "Sd");
    z(this, "state", 0);
    this.n = e, this.cap = r, this.exact = n, this.ch = o, this.C = o.length, this.g = new Int8Array(e), this.cnt = new Int32Array(r + 2), this.maxAt = new Int32Array(e + 1), this.Nd = new Int32Array(e + 1), this.Sd = new Float64Array((e + 1) * Math.max(this.C, 1));
  }
  sum(e) {
    return this.Sd[this.n * this.C + e];
  }
  uncount(e) {
    this.cnt[e] -= 1, this.cnt[e] === 0 && (this.distinct -= 1);
  }
  next() {
    if (this.state === 2) return !1;
    const { n: e, cap: r, exact: n, g: o, cnt: s, maxAt: i, Nd: a, Sd: c, C: u, ch: l } = this;
    let f;
    for (this.state === 0 ? (this.state = 1, f = 0, o[0] = 0) : (f = e - 1, this.uncount(o[f])); ; ) {
      const h = e - 1 - f, m = i[f];
      let g = o[f] + 1;
      for (; g <= r; g += 1) {
        const w = this.distinct + (s[g] === 0 ? 1 : 0);
        if (n > 0 ? n - w <= h : (g > m ? g : m) - w <= h) break;
      }
      if (g > r) {
        if (o[f] = 0, f === 0)
          return this.state = 2, !1;
        f -= 1, this.uncount(o[f]);
        continue;
      }
      o[f] = g, s[g] += 1, s[g] === 1 && (this.distinct += 1), i[f + 1] = g > m ? g : m;
      let d = a[f];
      if (u === 1) {
        const w = l[0];
        let p = c[f];
        for (let y = 0; y < f; y += 1) {
          const E = o[y];
          E !== g && (d += 1, p += E < g ? w[y * e + f] : w[f * e + y]);
        }
        c[f + 1] = p;
      } else {
        const w = f * u, p = w + u;
        for (let y = 0; y < u; y += 1) c[p + y] = c[w + y];
        for (let y = 0; y < f; y += 1) {
          const E = o[y];
          if (E === g) continue;
          d += 1;
          const k = E < g ? y * e + f : f * e + y;
          for (let b = 0; b < u; b += 1) c[p + b] += l[b][k];
        }
      }
      if (a[f + 1] = d, f === e - 1)
        return this.N = d, !0;
      f += 1, o[f] = 0;
    }
  }
}
class _n {
  constructor(e, r, n) {
    z(this, "g");
    z(this, "N", 0);
    z(this, "n");
    z(this, "list");
    z(this, "ch");
    z(this, "sums");
    z(this, "at", -1);
    this.n = e, this.list = r, this.ch = n, this.g = new Int8Array(e), this.sums = new Float64Array(Math.max(n.length, 1));
  }
  sum(e) {
    return this.sums[e];
  }
  next() {
    if (this.at += 1, this.at >= this.list.length) return !1;
    const { n: e, g: r, ch: n, sums: o } = this;
    r.set(this.list[this.at]);
    let s = 0;
    o.fill(0);
    for (let i = 0; i < e; i += 1)
      for (let a = i + 1; a < e; a += 1) {
        if (r[i] === r[a]) continue;
        s += 1;
        const c = r[i] < r[a] ? i * e + a : a * e + i;
        for (let u = 0; u < n.length; u += 1) o[u] += n[u][c];
      }
    return this.N = s, !0;
  }
}
function Ut(t, e) {
  for (let r = 0; r < t.length; r += 1) if (t[r] !== e[r]) return t[r] - e[r];
  return 0;
}
function zn(t, e) {
  const r = e.blocks === void 0 ? new Array(t).fill(1) : Array.from(e.blocks), n = r.length, o = e.exact ?? 1, s = e.exact ?? Math.min(e.G ?? n, n), i = [];
  for (let a = 0; a < 2 ** (n - 1); a += 1) {
    let c = 1;
    for (let h = 0; h < n - 1; h += 1) a >> h & 1 && (c += 1);
    if (c < o || c > s) continue;
    const u = new Int8Array(t);
    let l = 1, f = 0;
    for (let h = 0; h < n; h += 1) {
      h > 0 && a >> h - 1 & 1 && (l += 1);
      for (let m = 0; m < r[h]; m += 1) u[e.order[f++]] = l;
    }
    i.push(u);
  }
  return i.sort(Ut);
}
function dt(t, e, r) {
  switch (e.kind) {
    case "all":
      return new we(t, t, 0, r);
    case "atMost":
      return new we(t, Math.min(e.G, t), 0, r);
    case "exactly":
      return new we(t, e.G, e.G, r);
    case "order":
      return new _n(t, zn(t, e), r);
    default:
      throw new RangeError("unknown family kind");
  }
}
function qt(t) {
  return t ?? { kind: "all" };
}
function qn(t, e) {
  if (t == null) return null;
  if (!Array.isArray(t) || t.length !== e) throw new RangeError(`q must hold ${e} ${Dt(e, "budget")} (null for none)`);
  const r = t.map((n, o) => {
    if (n == null) return null;
    if (typeof n != "number" || !Number.isFinite(n) || n < 0) throw new RangeError(`q[${o}] must be finite and ≥ 0, or null`);
    return n;
  });
  return r.some((n) => n !== null) ? r : null;
}
class re {
  constructor(e, r) {
    /** the smallest value pushed so far */
    z(this, "best", Number.POSITIVE_INFINITY);
    z(this, "n");
    z(this, "tol");
    z(this, "prunedAt", Number.POSITIVE_INFINITY);
    z(this, "len", 0);
    z(this, "g");
    z(this, "z");
    this.n = e, this.tol = r, this.g = new Int8Array(16 * e), this.z = new Float64Array(16);
  }
  push(e, r) {
    if (r < this.best && (this.best = r, r < this.prunedAt - this.tol && (this.compact(), this.prunedAt = r)), r <= this.best + this.tol) {
      if (this.len === this.z.length) {
        const n = new Float64Array(this.z.length * 2);
        n.set(this.z), this.z = n;
        const o = new Int8Array(this.g.length * 2);
        o.set(this.g), this.g = o;
      }
      this.z[this.len] = r, this.g.set(e, this.len * this.n), this.len += 1;
    }
  }
  compact() {
    const e = this.best + this.tol;
    let r = 0;
    for (let n = 0; n < this.len; n += 1)
      this.z[n] <= e && (r !== n && (this.z[r] = this.z[n], this.g.copyWithin(r * this.n, n * this.n, (n + 1) * this.n)), r += 1);
    this.len = r;
  }
  /** Visit every tied report (a view into the buffer) in walk order. */
  forEach(e) {
    const r = this.best + this.tol;
    for (let n = 0; n < this.len; n += 1) this.z[n] <= r && e(this.g.subarray(n * this.n, (n + 1) * this.n), this.z[n]);
  }
  /** The number of tied reports. */
  count() {
    const e = this.best + this.tol;
    let r = 0;
    for (let n = 0; n < this.len; n += 1) this.z[n] <= e && (r += 1);
    return r;
  }
  /** The first `max` tied reports as grade vectors. */
  first(e) {
    const r = this.best + this.tol, n = [];
    for (let o = 0; o < this.len && n.length < e; o += 1) this.z[o] <= r && n.push(Array.from(this.g.subarray(o * this.n, (o + 1) * this.n)));
    return n;
  }
}
class kr {
  constructor(e, r, n) {
    z(this, "n");
    z(this, "k");
    z(this, "tol");
    /** max-heap of the k smallest keys seen */
    z(this, "heap");
    z(this, "heapSize", 0);
    z(this, "len", 0);
    z(this, "compactAt", 1024);
    z(this, "g");
    z(this, "z");
    this.n = e, this.k = r, this.tol = n, this.heap = new Float64Array(Math.min(r, 1 << 20)), this.g = new Int8Array(64 * e), this.z = new Float64Array(64);
  }
  threshold() {
    if (this.heapSize < this.k) return Number.POSITIVE_INFINITY;
    const e = this.heap[0];
    return e + this.tol * (1 + Math.abs(e));
  }
  heapPush(e) {
    const r = this.heap;
    if (this.heapSize < this.k && this.heapSize < r.length) {
      let s = this.heapSize++;
      for (r[s] = e; s > 0; ) {
        const i = s - 1 >> 1;
        if (r[i] >= r[s]) break;
        const a = r[i];
        r[i] = r[s], r[s] = a, s = i;
      }
      return;
    }
    if (this.heapSize < this.k || !(e < r[0])) return;
    r[0] = e;
    let n = 0;
    const o = this.heapSize;
    for (; ; ) {
      const s = 2 * n + 1, i = s + 1;
      let a = n;
      if (s < o && r[s] > r[a] && (a = s), i < o && r[i] > r[a] && (a = i), a === n) break;
      const c = r[a];
      r[a] = r[n], r[n] = c, n = a;
    }
  }
  push(e, r) {
    if (this.heapPush(r), r <= this.threshold()) {
      if (this.len === this.z.length && (this.compact(), this.len === this.z.length)) {
        const n = new Float64Array(this.z.length * 2);
        n.set(this.z), this.z = n;
        const o = new Int8Array(this.g.length * 2);
        o.set(this.g), this.g = o;
      }
      this.z[this.len] = r, this.g.set(e, this.len * this.n), this.len += 1, this.len >= this.compactAt && (this.compact(), this.compactAt = Math.max(1024, 2 * this.len));
    }
  }
  compact() {
    const e = this.threshold();
    let r = 0;
    for (let n = 0; n < this.len; n += 1)
      this.z[n] <= e && (r !== n && (this.z[r] = this.z[n], this.g.copyWithin(r * this.n, n * this.n, (n + 1) * this.n)), r += 1);
    this.len = r;
  }
  /** The first k reports in the greedy tolerant order: { grade, key }. */
  result() {
    this.compact();
    const e = this.len, r = this.z, n = Array.from({ length: e }, (f, h) => h).sort((f, h) => r[f] - r[h] || f - h), o = new Uint8Array(e), s = [], i = (f) => {
      let h = s.length;
      for (s.push(f); h > 0; ) {
        const m = h - 1 >> 1;
        if (s[m] <= s[h]) break;
        [s[m], s[h]] = [s[h], s[m]], h = m;
      }
    }, a = () => {
      const f = s[0], h = s.pop();
      if (s.length > 0) {
        s[0] = h;
        let m = 0;
        for (; ; ) {
          const g = 2 * m + 1, d = g + 1;
          let w = m;
          if (g < s.length && s[g] < s[w] && (w = g), d < s.length && s[d] < s[w] && (w = d), w === m) break;
          [s[w], s[m]] = [s[m], s[w]], m = w;
        }
      }
      return f;
    }, c = [];
    let u = 0, l = 0;
    for (; c.length < this.k && c.length < e; ) {
      for (; o[n[u]]; ) u += 1;
      const f = r[n[u]], h = f + this.tol * (1 + Math.abs(f));
      for (; l < e && r[n[l]] <= h; ) i(n[l++]);
      const m = a();
      o[m] = 1, c.push({ grade: Array.from(this.g.subarray(m * this.n, (m + 1) * this.n)), key: r[m] });
    }
    return c;
  }
}
function $r(t, e) {
  const r = t ?? 1;
  if (typeof r != "number" || !Number.isSafeInteger(r) || r < 1) throw new RangeError(`${e}: k must be an integer ≥ 1, got ${String(r)}`);
  return r;
}
function Kn(t, e) {
  const r = [];
  for (let n = 1; n < e.length; n += 1) t[e[n]] !== t[e[n - 1]] && r.push(n);
  return r;
}
function Dn(t, e) {
  if (t.length !== e.length) return t.length < e.length;
  for (let r = 0; r < t.length; r += 1) if (t[r] !== e[r]) return t[r] < e[r];
  return !1;
}
function Mr(t, e, r, n, o) {
  const { n: s, M: i } = t, a = r * i, c = new Float64Array(i + 1).fill(Number.POSITIVE_INFINITY), u = new Float64Array(i + 1).fill(Number.NEGATIVE_INFINITY), l = new Float64Array(i + 1), f = new Float64Array(i + 1), h = new Int32Array(i + 1), m = new Int8Array((i + 1) * s), g = new Int8Array((i + 1) * s), d = new Uint8Array(i + 1), w = new Uint8Array(i + 1);
  let p = !1;
  const y = n ? [] : null, E = dt(s, e, [t.ebar]);
  for (; E.next(); ) {
    const b = E.N, A = E.sum(0);
    if (h[b] += 1, h[b] === 1)
      c[b] = A, u[b] = A, l[b] = A, f[b] = A, m.set(E.g, b * s), g.set(E.g, b * s);
    else {
      const v = c[b];
      A < v && (c[b] = A, (A < v - a || l[b] > A + a) && (A < v - a || (d[b] = 1, p = !0), l[b] = A, m.set(E.g, b * s)));
      const $ = u[b];
      A > $ && (u[b] = A, (A > $ + a || f[b] < A - a) && (A > $ + a || (w[b] = 1, p = !0), f[b] = A, g.set(E.g, b * s)));
    }
    y && y.push({ grade: Array.from(E.g), N: b, Ew: A }), o && o.push(E.g, A - 0.5 * b);
  }
  if (p) {
    const b = new Uint8Array(i + 1), A = new Uint8Array(i + 1), v = dt(s, e, [t.ebar]);
    for (; v.next(); ) {
      const $ = v.N, N = v.sum(0);
      d[$] && !b[$] && N <= c[$] + a && (m.set(v.g, $ * s), b[$] = 1), w[$] && !A[$] && N >= u[$] - a && (g.set(v.g, $ * s), A[$] = 1);
    }
  }
  const k = [];
  for (let b = 0; b <= i; b += 1)
    h[b] !== 0 && k.push({
      N: b,
      minEw: c[b],
      maxEw: u[b],
      count: h[b],
      minGrade: Array.from(m.subarray(b * s, b * s + s)),
      maxGrade: Array.from(g.subarray(b * s, b * s + s))
    });
  return { rows: k, points: y };
}
function ne(t, e, r) {
  const n = [];
  for (let o = 0; o < t.length; o += 1) {
    for (; n.length >= 2; ) {
      const s = n[n.length - 2], i = n[n.length - 1], c = ((t[i] - t[s]) * (e[o] - e[s]) - (e[i] - e[s]) * (t[o] - t[s])) / (t[o] - t[s]), u = r ?? 1e-12 * Math.max(1, Math.abs(e[s]), Math.abs(e[o]));
      if (c > u) break;
      n.pop();
    }
    n.push(o);
  }
  return n;
}
function Bn(t, e, r) {
  for (let n = 0; n < t.length; n += 1) if (t[n] !== r[n]) return t[n] < r[n];
  return e < r[t.length];
}
const Vn = ["order", "G", "exact", "blocks", "family", "scores", "direction", "ids"];
function Ir(t, e, r, n) {
  let o = e.order, s = e.blocks;
  if (e.scores !== void 0) {
    if (o !== void 0 || s !== void 0) throw new RangeError(`${n}: give scores, or order with blocks, not both`);
    if (e.scores?.length !== t) throw new RangeError(`${n}: scores must have one value per unit (${t})`);
    const u = e.ids ?? (Array.isArray(r?.ids) && r.ids.length === t ? r.ids : void 0), l = Mn(e.scores, { direction: e.direction, ids: u });
    o = l.order, s = l.blocks;
  } else if (e.direction !== void 0 || e.ids !== void 0)
    throw new RangeError(`${n}: direction and ids apply only together with scores`);
  let i = e.G, a = e.exact;
  const c = e.family;
  if (c !== void 0) {
    if (c === null || typeof c != "object") throw new RangeError(`${n}: family must be a family object`);
    switch (c.kind) {
      case "order":
        if (xt(c, ["kind", "order", "G", "exact", "blocks"], `${n}: family { kind: "order" }`), o !== void 0) throw new RangeError(`${n}: the order is given twice (family.order, and order or scores)`);
        if (i !== void 0 || a !== void 0 || s !== void 0)
          throw new RangeError(`${n}: give G, exact and blocks inside family { kind: "order" } or at the top level, not both`);
        o = c.order, i = c.G, a = c.exact, s = c.blocks;
        break;
      case "atMost":
      case "exactly":
        if (xt(c, ["kind", "G"], `${n}: family { kind: "${c.kind}" }`), i !== void 0 || a !== void 0) throw new RangeError(`${n}: the grade count is given twice (family and G or exact)`);
        c.kind === "atMost" ? i = c.G : a = c.G;
        break;
      case "all":
        xt(c, ["kind"], `${n}: family { kind: "all" }`);
        break;
      default:
        throw new RangeError(`${n}: unknown family kind ${String(c.kind)}`);
    }
  }
  if (o === void 0) throw new RangeError(`${n} needs a declared order: order, scores, or family { kind: "order", order }`);
  return {
    kind: "order",
    order: o,
    ...i !== void 0 ? { G: i } : {},
    ...a !== void 0 ? { exact: a } : {},
    ...s !== void 0 ? { blocks: s } : {}
  };
}
function tr(t, e = { kind: "all" }, r = {}) {
  const n = M(r, ["reuse"], "enumerateReports"), o = ut(t, e);
  o.sizeExact !== 0n && mt(t, o, e);
  const s = n.reuse === !0;
  function* i() {
    if (o.sizeExact === 0n) return;
    const a = dt(t, e, []);
    for (; a.next(); ) yield s ? a.g : a.g.slice();
  }
  return i();
}
function kt(t, e) {
  const r = M(e, ["tau", "w", "family", "q", "tieTol", "maxTies"], "exactOptimum", !0), n = Y(r.tau), o = st(t, r.w), { n: s, M: i } = o, a = qt(r.family), c = nt(r.tieTol, "tieTol"), u = Mt(r.maxTies, "exactOptimum"), l = ut(s, a), f = qn(r.q, o.K), h = (b) => f === null ? l : Pt(
    {
      name: `𝒜_q (${l.name})`,
      words: `${l.words} that meet the error budgets E_k ≤ q_k N`,
      baseSize: l.size,
      budgets: [...f]
    },
    BigInt(b)
  ), m = () => Rt(h(0), "exact-within-family");
  if (l.sizeExact === 0n) return m();
  mt(s, l, a);
  const g = [];
  f && f.forEach((b, A) => b !== null && g.push(A));
  const d = dt(s, a, [o.ebar, ...g.map((b) => o.ek[b])]), w = new re(s, c * i);
  let p = 0;
  for (; d.next(); ) {
    const b = d.N;
    if (g.length > 0) {
      let A = !0;
      for (let v = 0; v < g.length; v += 1)
        if (d.sum(v + 1) > f[g[v]] * b + xn) {
          A = !1;
          break;
        }
      if (!A) continue;
    }
    p += 1, w.push(d.g, d.sum(0) - n * b);
  }
  if (p === 0) return m();
  const y = w.first(u);
  let E = y[0];
  if (a.kind === "order") {
    let b = null;
    w.forEach((A) => {
      const v = Kn(A, a.order);
      (b === null || Dn(v, b)) && (b = v, E = Array.from(A));
    });
  }
  const k = U(E, t, { tau: n, w: o.w });
  return {
    empty: !1,
    grade: E,
    grades: y,
    tieCount: w.count(),
    risk: k.risk,
    N: k.N,
    G: k.G,
    Ew: k.Ew,
    E: k.E,
    EoverN: k.EoverN,
    evaluation: k,
    family: h(p),
    containsAllWithheld: Gt(s, a),
    tieTol: c,
    label: "exact-within-family"
  };
}
function Wo(t, e) {
  const r = M(e, ["tau", "w", "family", "stating", "tieTol", "maxTies"], "pairConstrainedOptimum", !0), n = Y(r.tau), o = st(t, r.w), { n: s, M: i } = o, a = qt(r.family), c = nt(r.tieTol, "tieTol"), u = Mt(r.maxTies, "pairConstrainedOptimum"), l = Gn(r.stating, s), f = ut(s, a), h = (k) => Object.assign(k, {
    family: Wt(f, k.family.sizeExact, l.length > 0),
    baseFamily: f,
    stating: l
  });
  if (a.kind === "order") return h(Tr(t, o, n, a, c, u, !1, l));
  if (l.length === 0) return h(kt(t, { tau: n, w: o.w, family: a, tieTol: c, maxTies: u }));
  const m = () => h(Rt(Wt(f, 0n, !0), "exact-within-family"));
  if (f.sizeExact === 0n) return m();
  mt(s, f, a);
  const g = dt(s, a, [o.ebar]), d = new re(s, c * i);
  let w = 0n;
  for (; g.next(); )
    l.every(([k, b]) => g.g[k] < g.g[b]) && (w += 1n, d.push(g.g, g.sum(0) - n * g.N));
  if (w === 0n) return m();
  const p = d.first(u), y = p[0], E = U(y, t, { tau: n, w: o.w });
  return h({
    empty: !1,
    grade: y,
    grades: p,
    tieCount: d.count(),
    risk: E.risk,
    N: E.N,
    G: E.G,
    Ew: E.Ew,
    E: E.E,
    EoverN: E.EoverN,
    evaluation: E,
    family: Wt(f, w, !0),
    containsAllWithheld: !1,
    tieTol: c,
    label: "exact-within-family"
  });
}
function Ln(t, e) {
  const r = M(e, [...Vn, "tau", "w", "trace", "tieTol", "maxTies"], "fixedOrderDP", !0), n = Y(r.tau), o = st(t, r.w), s = nt(r.tieTol, "tieTol"), i = Mt(r.maxTies, "fixedOrderDP"), a = Ir(o.n, r, t, "fixedOrderDP");
  return Tr(t, o, n, a, s, i, r.trace === !0);
}
function Tr(t, e, r, n, o, s, i, a = []) {
  const { n: c, M: u, ebar: l } = e, f = ut(c, n), h = a.length > 0 && f.sizeExact > 0n ? Pn(c, n, a) : null, m = a.length > 0 ? Wt(f, h?.size ?? 0n, !0) : f;
  if (m.sizeExact === 0n) return Rt(m, "optimal-within-order");
  const g = Array.from(n.order), d = n.blocks === void 0 ? new Array(c).fill(1) : Array.from(n.blocks), w = d.length, p = [0];
  for (const T of d) p.push(p[p.length - 1] + T);
  const y = c + 1, E = new Float64Array(y * y);
  for (let T = 1; T <= c; T += 1) {
    const C = g[T - 1];
    let _ = 0;
    for (let S = T - 1; S >= 0; S -= 1)
      E[S * y + T] = E[S * y + T - 1] + _, S >= 1 && (_ += l[g[S - 1] * c + C] - r);
  }
  const k = E[c], b = (T, C) => E[p[T] * y + p[C]], A = n.exact, v = A ?? Math.min(n.G ?? w, w), $ = o * u, N = Array.from({ length: v + 1 }, () => new Float64Array(w + 1).fill(Number.NEGATIVE_INFINITY)), R = Array.from({ length: v + 1 }, () => new Int32Array(w + 1).fill(-1)), O = Array.from({ length: v + 1 }, () => new Array(w + 1).fill(null));
  N[0][0] = 0, O[0][0] = new Int32Array(0);
  for (let T = 1; T <= v; T += 1)
    for (let C = T; C <= w; C += 1) {
      let _ = Number.NEGATIVE_INFINITY, S = -1;
      for (let G = T - 1; G < C; G += 1) {
        if (h !== null && G < h.minStart[C]) continue;
        const at = N[T - 1][G];
        if (at === Number.NEGATIVE_INFINITY) continue;
        const D = at + b(G, C);
        let ht = S < 0 || D > _ + $;
        if (!ht && T >= 2 && D >= _ - $ && (ht = Bn(O[T - 1][G], G, O[T][C])), ht)
          if (_ = D, S = G, T >= 2) {
            const Et = O[T - 1][G], bt = new Int32Array(T - 1);
            bt.set(Et), bt[T - 2] = G, O[T][C] = bt;
          } else O[T][C] = new Int32Array(0);
      }
      N[T][C] = _, R[T][C] = S;
    }
  let P, L = Number.NEGATIVE_INFINITY;
  const B = [];
  if (A !== void 0)
    P = A, B.push(A);
  else {
    for (let T = 1; T <= v; T += 1) N[T][w] > L && (L = N[T][w]);
    for (let T = 1; T <= v; T += 1) N[T][w] >= L - $ && B.push(T);
    P = B[0];
  }
  const H = Array.from(O[P][w]), et = H.map((T) => p[T]), x = (T) => {
    const C = new Array(c);
    let _ = 0;
    for (let S = 0; S < w; S += 1) {
      _ < T.length && T[_] === S && (_ += 1);
      for (let G = p[S]; G < p[S + 1]; G += 1) C[g[G]] = _ + 1;
    }
    return C;
  }, I = x(H), F = (T, C, _) => {
    if (h !== null && C < h.minStart[_]) return !1;
    const S = N[T - 1][C];
    return S !== Number.NEGATIVE_INFINITY && S + b(C, _) >= N[T][_] - $;
  }, j = (() => {
    let T = Array.from({ length: v + 1 }, () => new Float64Array(w + 1));
    T[0][0] = 1;
    let C = !1;
    for (let S = 1; S <= v && !C; S += 1)
      for (let G = S; G <= w; G += 1) {
        if (N[S][G] === Number.NEGATIVE_INFINITY) continue;
        let at = 0;
        for (let D = S - 1; D < G; D += 1) T[S - 1][D] > 0 && F(S, D, G) && (at += T[S - 1][D]);
        T[S][G] = at, at > 2 ** 52 && (C = !0);
      }
    if (!C) return B.reduce((S, G) => S + BigInt(T[G][w]), 0n);
    T = [];
    const _ = Array.from({ length: v + 1 }, () => new Array(w + 1).fill(0n));
    _[0][0] = 1n;
    for (let S = 1; S <= v; S += 1)
      for (let G = S; G <= w; G += 1) {
        if (N[S][G] === Number.NEGATIVE_INFINITY) continue;
        let at = 0n;
        for (let D = S - 1; D < G; D += 1) _[S - 1][D] > 0n && F(S, D, G) && (at += _[S - 1][D]);
        _[S][G] = at;
      }
    return B.reduce((S, G) => S + _[G][w], 0n);
  })(), V = (T) => {
    for (const C of B) {
      const _ = Array.from({ length: C + 1 }, () => new Uint8Array(w + 1));
      _[C][w] = 1;
      for (let D = C; D >= 1; D -= 1)
        for (let ht = D; ht <= w; ht += 1)
          if (_[D][ht])
            for (let Et = D - 1; Et < ht; Et += 1) F(D, Et, ht) && (_[D - 1][Et] = 1);
      const S = new Int32Array(Math.max(C - 1, 0));
      let G = !1;
      const at = (D, ht) => {
        if (D === C) {
          T(S) || (G = !0);
          return;
        }
        const Et = D + 1 === C;
        for (let bt = Et ? w : ht + 1; bt <= w && !G; bt += 1)
          !_[D + 1][bt] || !F(D + 1, ht, bt) || (Et || (S[D] = bt), at(D + 1, bt));
      };
      if (at(0, 0), G) return;
    }
  };
  let W = [], Z;
  if (j * BigInt(c) <= Fn)
    V((T) => {
      const C = x(T);
      if (W.length >= s && Ut(C, W[W.length - 1]) >= 0) return !0;
      let _ = 0, S = W.length;
      for (; _ < S; ) {
        const G = _ + S >> 1;
        Ut(W[G], C) < 0 ? _ = G + 1 : S = G;
      }
      return W.splice(_, 0, C), W.length > s && W.pop(), !0;
    }), Z = "lexicographic";
  else {
    const T = Math.min(s, Math.max(1, Math.floor(2e6 / c)));
    V((_) => (W.push(x(_)), W.length < T));
    const C = W.findIndex((_) => Ut(_, I) === 0);
    C !== 0 && (C > 0 && W.splice(C, 1), W.unshift(I), W.length > T && W.pop()), Z = "package";
  }
  const it = U(I, t, { tau: r, w: e.w }), ft = {
    empty: !1,
    grade: I,
    grades: W,
    gradesOrder: Z,
    tieCount: sr(j),
    risk: it.risk,
    N: it.N,
    G: it.G,
    Ew: it.Ew,
    E: it.E,
    EoverN: it.EoverN,
    evaluation: it,
    order: g,
    blocks: d,
    cuts: et,
    blockCuts: H,
    saving: N[P][w],
    family: m,
    containsAllWithheld: a.length === 0 && Gt(c, n),
    tieTol: o,
    label: "optimal-within-order"
  };
  if (ir(ft, "tieCountExact", j), i) {
    const T = (S) => S === Number.NEGATIVE_INFINITY ? null : S, C = [];
    let _ = w;
    for (let S = P; S >= 1; S -= 1)
      C.push({ h: S, c: _ }), _ = R[S][_];
    C.push({ h: 0, c: 0 }), C.reverse(), ft.trace = {
      M: u,
      T: k,
      blocks: d,
      boundaries: p,
      W: Array.from({ length: w + 1 }, (S, G) => Array.from({ length: w + 1 }, (at, D) => G <= D ? b(G, D) : null)),
      V: N.map((S) => Array.from(S, T)),
      pred: R.map((S, G) => Array.from(S, (at, D) => G === 0 || N[G][D] === Number.NEGATIVE_INFINITY ? null : at)),
      riskByG: Array.from({ length: v + 1 }, (S, G) => G === 0 || N[G][w] === Number.NEGATIVE_INFINITY ? null : r + (k - N[G][w]) / u),
      chosenG: P,
      path: C
    };
  }
  return ft;
}
function Uo(t, e = {}) {
  const r = M(e, ["w", "family", "tieTol", "maxTies"], "tauPath"), n = st(t, r.w), { n: o, M: s } = n, i = qt(r.family), a = nt(r.tieTol, "tieTol"), c = Mt(r.maxTies, "tauPath"), u = ut(o, i);
  if (u.sizeExact === 0n) return Rt(u, "exact-within-family");
  mt(o, u, i);
  const l = a * s, f = new re(o, l), { rows: h } = Mr(n, i, a, !1, f), g = ne(
    h.map((b) => b.N),
    h.map((b) => b.minEw),
    l
  ).map((b) => {
    const A = h[b].minGrade;
    return { grade: A, ev: U(A, t, { tau: 0.5, w: n.w }) };
  }), d = (b) => (g[b].ev.Ew - g[b - 1].ev.Ew) / (g[b].ev.N - g[b - 1].ev.N), w = (b, A, v) => {
    const { grade: $, ev: N } = g[b];
    return {
      tauFrom: A,
      tauTo: v,
      grade: $,
      N: N.N,
      G: N.G,
      Ew: N.Ew,
      E: N.E,
      EoverN: N.EoverN,
      EwOverN: N.N === 0 ? null : N.Ew / N.N,
      riskFrom: (N.Ew + A * (s - N.N)) / s,
      riskTo: (N.Ew + v * (s - N.N)) / s
    };
  }, p = g.map((b) => b.ev.Ew - 0.5 * b.ev.N), y = Math.min(...p), E = [];
  let k = -1;
  for (let b = 0; b < g.length; b += 1) {
    const A = b === 0 ? 0 : Math.max(0, d(b)), v = b === g.length - 1 ? 0.5 : Math.min(0.5, d(b + 1));
    A < v && (E.push(w(b, A, v)), k = b);
  }
  for (let b = k + 1; b < g.length; b += 1) p[b] <= y + l && E.push(w(b, 0.5, 0.5));
  return {
    empty: !1,
    intervals: E,
    endpointOptima: f.first(c),
    endpointTieCount: f.count(),
    family: u,
    containsAllWithheld: Gt(o, i),
    tieTol: a,
    label: "exact-within-family"
  };
}
function Sr(t, e, r) {
  const { n } = t, o = new Float64Array(r), s = new Float64Array(r), i = new Int32Array(r), a = new Int8Array(r * n), c = dt(n, e, [t.ek[0], t.ek[1]]);
  let u = 0;
  for (; c.next(); )
    o[u] = c.sum(0), s[u] = c.sum(1), i[u] = c.N, a.set(c.g, u * n), u += 1;
  return { E1: o, E2: s, Ns: i, G8: a, r: u };
}
function Yo(t, e) {
  const r = M(e, ["tau", "family", "grid", "tieTol", "maxTies"], "weightPath", !0), n = Y(r.tau);
  if ((Array.isArray(t?.e) ? t.e.length : 0) !== 2) throw new RangeError("weightPath needs two criteria (K = 2)");
  const s = st(t, [0.5, 0.5]), { n: i, M: a } = s, c = qt(r.family), u = nt(r.tieTol, "tieTol"), l = Mt(r.maxTies, "weightPath"), f = r.grid === void 0 ? Array.from({ length: 21 }, (E, k) => k / 20) : Array.from(r.grid);
  if (f.length < 1 || !f.every((E) => typeof E == "number" && E >= 0 && E <= 1))
    throw new RangeError("grid must hold first-criterion weights in [0, 1]");
  const h = ut(i, c);
  if (h.sizeExact === 0n) return Rt(h, "exact-within-family");
  mt(i, h, c);
  const { E1: m, E2: g, Ns: d, G8: w, r: p } = Sr(s, c, Number(h.sizeExact)), y = u * a;
  return f.map((E) => {
    const k = 1 - E;
    let b = Number.POSITIVE_INFINITY;
    for (let N = 0; N < p; N += 1) {
      const R = E * m[N] + k * g[N] - n * d[N];
      R < b && (b = R);
    }
    const A = [];
    let v = 0;
    for (let N = 0; N < p; N += 1)
      E * m[N] + k * g[N] - n * d[N] <= b + y && (v += 1, A.length < l && A.push(Array.from(w.subarray(N * i, N * i + i))));
    const $ = U(A[0], t, { tau: n, w: [E, k] });
    return { w1: E, w: [E, k], grade: A[0], grades: A, tieCount: v, risk: $.risk, N: $.N, G: $.G, Ew: $.Ew, E: $.E, EoverN: $.EoverN };
  });
}
function Wn(t, e) {
  const r = /* @__PURE__ */ new Map(), n = (a, c) => r.set(a, Math.min(r.get(a) ?? Number.POSITIVE_INFINITY, c));
  for (const a of t)
    n(a.wFrom, a.riskFrom), n(a.wTo, a.riskTo);
  let o = Number.NEGATIVE_INFINITY;
  for (const a of r.values()) o = Math.max(o, a);
  const s = [];
  for (const [a, c] of r) c >= o - e && s.push({ from: a, to: a });
  for (const a of t)
    a.wFrom < a.wTo && a.E[0] === a.E[1] && r.get(a.wFrom) >= o - e && r.get(a.wTo) >= o - e && s.push({ from: a.wFrom, to: a.wTo });
  s.sort((a, c) => a.from - c.from || a.to - c.to);
  const i = [];
  for (const a of s) {
    const c = i[i.length - 1];
    c !== void 0 && a.from <= c.to ? c.to = Math.max(c.to, a.to) : i.push({ ...a });
  }
  return { risk: o, intervals: i, tieTol: e };
}
function Ho(t, e) {
  const r = M(e, ["tau", "family", "tieTol"], "weightBreakpoints", !0), n = Y(r.tau);
  if ((Array.isArray(t?.e) ? t.e.length : 0) !== 2) throw new RangeError("weightBreakpoints needs two criteria (K = 2)");
  const s = st(t, [0.5, 0.5]), { n: i, M: a } = s, c = qt(r.family), u = nt(r.tieTol, "tieTol"), l = ut(i, c);
  if (l.sizeExact === 0n) return Rt(l, "exact-within-family");
  mt(i, l, c);
  const { E1: f, E2: h, Ns: m, G8: g, r: d } = Sr(s, c, Number(l.sizeExact)), w = u * a, p = new Float64Array(d), y = new Float64Array(d);
  for (let x = 0; x < d; x += 1)
    p[x] = h[x] - f[x], y[x] = h[x] - n * m[x];
  const E = Uint32Array.from({ length: d }, (x, I) => I).sort((x, I) => p[x] - p[I] || y[x] - y[I] || x - I), k = [], b = [], A = [];
  for (let x = 0; x < d; ) {
    let I = x, F = x;
    for (; I < d && p[E[I]] - p[E[x]] <= w; )
      y[E[I]] < y[E[F]] && (F = I), I += 1;
    let K = E[F];
    for (let j = x; j < I; j += 1) y[E[j]] <= y[E[F]] + w && E[j] < K && (K = E[j]);
    k.push(p[K]), b.push(y[K]), A.push(K), x = I;
  }
  const v = ne(k, b, w), $ = (x, I) => b[v[x]] - I * k[v[x]], N = (x) => (b[v[x]] - b[v[x - 1]]) / (k[v[x]] - k[v[x - 1]]), R = (x, I, F) => {
    const K = A[v[x]], j = Array.from(g.subarray(K * i, K * i + i)), V = U(j, t, { tau: n, w: [0.5, 0.5] }), W = (Z) => (Z * V.E[0] + (1 - Z) * V.E[1] + n * (a - V.N)) / a;
    return { wFrom: I, wTo: F, grade: j, N: V.N, G: V.G, E: V.E, EoverN: V.EoverN, riskFrom: W(I), riskTo: W(F) };
  }, O = Math.min(...v.map((x, I) => $(I, 0))), P = Math.min(...v.map((x, I) => $(I, 1))), L = [], B = [], H = [];
  for (let x = 0; x < v.length; x += 1) {
    const I = x === 0 ? 0 : Math.max(0, N(x)), F = x === v.length - 1 ? 1 : Math.min(1, N(x + 1));
    I < F ? B.push(R(x, I, F)) : F <= 0 && $(x, 0) <= O + w ? L.push(R(x, 0, 0)) : I >= 1 && $(x, 1) <= P + w && H.push(R(x, 1, 1));
  }
  const et = [...L, ...B, ...H];
  return {
    empty: !1,
    intervals: et,
    breakpoints: B.slice(1).map((x) => x.wFrom),
    envelopeMaximum: Wn(et, u),
    tau: n,
    family: l,
    containsAllWithheld: Gt(i, c),
    tieTol: u,
    label: "exact-within-family"
  };
}
function Zo(t, e) {
  const r = M(e, ["tau", "w", "family", "k", "stating", "tieTol"], "bestReports", !0), n = Y(r.tau), o = st(t, r.w), { n: s, M: i } = o, a = qt(r.family), c = $r(r.k, "bestReports"), u = nt(r.tieTol, "tieTol"), l = r.stating ?? [];
  if (!Array.isArray(l)) throw new RangeError("bestReports: stating must be a list of [i, j] pairs");
  const f = [], h = [];
  for (const b of l) {
    if (!(Array.isArray(b) && b.length === 2 && b.every((v) => typeof v == "number" && Number.isInteger(v) && v >= 0 && v < s) && b[0] !== b[1])) throw new RangeError(`bestReports: each stating entry must be [i, j] with distinct unit indices in 0…${s - 1}`);
    f.push(b[0]), h.push(b[1]);
  }
  const m = ut(s, a), g = (b, A) => ({ family: m, matched: b, reports: A, tieTol: u, label: "exact-within-family" });
  if (m.sizeExact === 0n) return g(0, []);
  mt(s, m, a);
  const d = dt(s, a, [o.ebar]), w = new kr(s, c, u), p = f.length, y = d.g;
  let E = 0;
  for (; d.next(); ) {
    let b = !0;
    for (let v = 0; v < p; v += 1)
      if (!(y[f[v]] < y[h[v]])) {
        b = !1;
        break;
      }
    if (!b) continue;
    E += 1;
    const A = d.N;
    w.push(y, (d.sum(0) + n * (i - A)) / i);
  }
  const k = w.result().map(({ grade: b }) => {
    const A = U(b, t, { tau: n, w: o.w });
    return { grade: b, risk: A.risk, N: A.N, Ew: A.Ew };
  });
  return g(E, k);
}
function xr(t, e) {
  const r = t.lambda !== void 0, n = t.tau !== void 0;
  if (r === n) throw new RangeError(`${e}: give exactly one numeric axis, lambda or tau`);
  let o, s;
  if (r) {
    if (o = t.lambda, typeof o != "number" || !Number.isFinite(o)) throw new RangeError(`${e}: lambda must be finite and in (0, 1]`);
    s = vn(o);
  } else {
    if (s = t.tau, typeof s != "number" || !Number.isFinite(s)) throw new RangeError(`${e}: tau must be finite and in (0, 1/2]`);
    o = An(s);
  }
  return { lambda: o, tau: s, cut: 1 / (1 + o), informedShare: 1 - 2 * s, slope: (1 - o) / o };
}
function Qo(t) {
  return xr(M(t, ["lambda", "tau"], "krwBridgeParameters", !0), "krwBridgeParameters");
}
function Xo(t, e) {
  const r = M(e, ["lambda", "tau", "family", "tieTol", "maxTies", "tieFree", "t"], "krwCorrespondence", !0), n = xr(r, "krwCorrespondence");
  if (r.tieFree !== !0) throw new RangeError("krwCorrespondence requires explicit tieFree: true");
  if (r.tieTol !== void 0 && (typeof r.tieTol != "number" || !Number.isFinite(r.tieTol) || r.tieTol < 0))
    throw new RangeError("krwCorrespondence: tieTol must be a finite number ≥ 0");
  if (r.maxTies !== void 0 && (!Number.isSafeInteger(r.maxTies) || r.maxTies < 1))
    throw new RangeError("krwCorrespondence: maxTies must be a positive integer");
  const { n: o, K: s, e: i } = tt(t);
  if (s !== 1) throw new RangeError("krwCorrespondence takes one criterion (K = 1)");
  for (let $ = 0; $ < o; $ += 1) for (let N = 0; N < o; N += 1) if ($ !== N) {
    if (i[0][$][N] < 0 || i[0][$][N] > 1) throw new RangeError("krwCorrespondence: off-diagonal probabilities must lie in [0, 1]");
    if (N > $ && Math.abs(i[0][$][N] + i[0][N][$] - 1) > 1e-12)
      throw new RangeError("krwCorrespondence: reverse probabilities must be complements within 1e-12");
  }
  const a = { lambda: n.lambda };
  if (r.t !== void 0) {
    const $ = Bt(r.t, "t");
    if ($.n !== o || $.K !== s) throw new RangeError("krwCorrespondence: t must have the same shape as E.e");
    for (let N = 0; N < o; N += 1) for (let R = 0; R < o; R += 1) if (N !== R && (r.t[0][N][R] < 0 || r.t[0][N][R] > 1))
      throw new RangeError("krwCorrespondence: off-diagonal equality probabilities must lie in [0, 1]");
    pe(new Array(o).fill(1), t, { ...a, t: r.t }), a.t = r.t;
  }
  const c = r.family ?? { kind: "all" }, { tau: u } = n, l = kt(t, { tau: u, family: c, tieTol: r.tieTol, maxTies: 1 / 0 });
  if (l.empty) return { parameters: n, family: l.family, reportsEnumerated: 0, postrank: l, krw: null, sameFullSet: null, maxAffineResidual: null };
  const f = r.maxTies ?? 100, h = { ...l, grades: l.grades.slice(0, f) }, m = Number(h.family.size), g = new Float64Array(m);
  let d = 0, w = 1 / 0, p = 0;
  for (const $ of tr(o, c, { reuse: !0 })) {
    const N = U($, t, { tau: u }).risk, R = pe($, t, a);
    g[d] = R, ++d, R < w && (w = R), p = Math.max(p, Math.abs(N - (u + (1 - u) * R)));
  }
  const y = h.tieTol / (1 - u), E = [];
  let k = 0, b = !0, A = 0, v = 0;
  for (const $ of tr(o, c, { reuse: !0 })) {
    const N = g[A] - w <= y, R = l.grades[v], O = R !== void 0 && $.every((P, L) => P === R[L]);
    O && ++v, N !== O && (b = !1), N && (++k, E.length < f && E.push(Array.from($))), ++A;
  }
  return {
    parameters: n,
    family: h.family,
    reportsEnumerated: d,
    postrank: h,
    krw: { grade: E[0], grades: E, tieCount: k, minRisk: w, tieTol: y },
    sameFullSet: b,
    maxAffineResidual: p
  };
}
const Un = Object.freeze({
  maxUnitsUncapped: 150,
  maxCells: 5e7
});
function Jo(t, e = {}) {
  const r = M(e, ["w", "family", "tieTol"], "reportCloud"), n = st(t, r.w), o = r.family ?? { kind: "all" }, s = nt(r.tieTol, "tieTol"), i = ut(n.n, o);
  if (i.sizeExact === 0n) return Rt(i, "exact-within-family");
  mt(n.n, i, o);
  const { rows: a, points: c } = Mr(n, o, s, i.sizeExact <= BigInt(Me));
  return {
    empty: !1,
    n: n.n,
    M: n.M,
    K: n.K,
    w: n.w,
    family: i,
    containsAllWithheld: Gt(n.n, o),
    byN: a,
    points: c,
    tieTol: s,
    label: "exact-within-family"
  };
}
function Yn(t) {
  if (!Array.isArray(t) && t?.empty === !0) return [];
  const e = Array.isArray(t) ? t : t?.byN;
  if (!Array.isArray(e)) throw new RangeError("lowerHull needs a reportCloud() result or an array of { N, Ew } points");
  const r = /* @__PURE__ */ new Map();
  for (const [n, o] of e.entries()) {
    const s = o?.N, i = o?.minEw ?? o?.Ew;
    if (typeof s != "number" || !Number.isFinite(s) || typeof i != "number" || !Number.isFinite(i))
      throw new RangeError(`point ${n} must have finite N and Ew (or minEw)`);
    const a = o.minGrade ?? o.grade ?? null, c = r.get(s);
    (c === void 0 || i < c.Ew) && r.set(s, { N: s, Ew: i, grade: a === null ? null : Array.from(a) });
  }
  return [...r.values()].sort((n, o) => n.N - o.N);
}
function Fr(t, e, r) {
  if (t !== void 0) {
    if (typeof t != "number" || !Number.isSafeInteger(t) || t < 1) throw new RangeError("M must be a positive integer (n(n − 1)/2)");
    return t;
  }
  const n = e?.M;
  if (!Array.isArray(e) && typeof n == "number") return n;
  const o = r.find((s) => Array.isArray(s.grade))?.grade;
  return o ? Ot(o.length) : null;
}
function ts(t, e = {}) {
  const r = M(e, ["tieTol", "M"], "lowerHull"), n = nt(r.tieTol, "tieTol"), o = Yn(t), s = Fr(r.M, t, o);
  return ne(
    o.map((i) => i.N),
    o.map((i) => i.Ew),
    s === null ? void 0 : n * s
  ).map((i) => o[i]);
}
function Ie(t) {
  if (!Array.isArray(t) || t.length < 1) throw new RangeError("hull must be a nonempty array of vertices");
  for (let e = 0; e < t.length; e += 1) {
    const r = t[e];
    if (!Number.isFinite(r?.N) || !Number.isFinite(r?.Ew)) throw new RangeError(`hull vertex ${e} must have finite N and Ew`);
    if (e > 0 && !(r.N > t[e - 1].N)) throw new RangeError("hull vertices must have increasing N");
  }
}
function es(t, e, r = {}) {
  const n = M(r, ["tieTol", "M"], "supportingVertex");
  Y(e), Ie(t);
  const o = nt(n.tieTol, "tieTol"), s = Fr(n.M, null, t);
  if (s === null) throw new RangeError("supportingVertex needs M (options.M) when the hull vertices carry no grade");
  const i = t.map((u) => u.Ew - e * u.N), a = Math.min(...i), c = t.filter((u, l) => i[l] <= a + o * s);
  return { vertex: c[0], vertices: c, value: a };
}
function rs(t, e, r) {
  Ie(e);
  const n = e[0].N, o = e[e.length - 1].N;
  if (typeof r != "number" || !Number.isFinite(r) || r < n || r > o)
    throw new RangeError(`N must lie between the smallest and largest disclosure of the family (${n} … ${o})`);
  let s = 0;
  for (; s < e.length - 1 && e[s + 1].N <= r; ) s += 1;
  const i = e[s], a = i.N === r ? i : e[s + 1], c = a === i ? 0 : (r - i.N) / (a.N - i.N), u = a === i ? i.Ew : (1 - c) * i.Ew + c * a.Ew;
  let l = null;
  const f = t?.byN?.find((h) => h.N === r);
  return f && (l = { grade: f.minGrade, Ew: f.minEw }), { N: r, H: u, psi: c, lower: i, upper: a, best: l, gap: l === null ? null : l.Ew - u };
}
function ns(t, e) {
  const r = M(
    e,
    ["order", "G", "exact", "blocks", "family", "scores", "direction", "ids", "w", "tieTol"],
    "orderHull",
    !0
  ), n = st(t, r.w), { n: o, M: s, ebar: i } = n, a = nt(r.tieTol, "tieTol"), c = Ir(o, r, t, "orderHull"), u = ut(o, c);
  if (u.sizeExact === 0n) return Rt(u, "optimal-within-order");
  const l = Array.from(c.order), f = c.blocks === void 0 ? new Array(o).fill(1) : Array.from(c.blocks), h = f.length, m = [0];
  for (const I of f) m.push(m[m.length - 1] + I);
  const g = c.exact, d = g !== void 0 || c.G !== void 0 && c.G < h, w = g ?? Math.min(c.G ?? h, h), { maxUnitsUncapped: p, maxCells: y } = Un;
  if (!d && o > p)
    throw new RangeError(
      `orderHull covers at most ${p} units without a grade cap; ${u.name} is on n = ${o} units. Use fixedOrderDP for the optimum at one τ, or give a cap G.`
    );
  if (d && w * h * s > y)
    throw new RangeError(
      `orderHull keeps a table of H·m·M cells, at most ${jt(y)}; ${u.name} needs ${jt(w * h * s)} (H = ${w} grade layers, m = ${h} blocks, M = ${jt(s)} pairs). Use fixedOrderDP for the optimum at one τ.`
    );
  const E = o + 1, k = new Float64Array(E * E);
  for (let I = 1; I <= o; I += 1) {
    const F = l[I - 1];
    let K = 0;
    for (let j = 1; j < I; j += 1)
      K += i[l[j - 1] * o + F], k[j * E + I] = k[j * E + I - 1] + K;
  }
  const b = d ? w + 1 : 1, A = s + 1, v = (I, F, K) => (I * (h + 1) + F) * A + K, $ = new Float64Array(b * (h + 1) * A).fill(Number.POSITIVE_INFINITY), N = h < 32768 ? new Int16Array(b * (h + 1) * A).fill(-1) : new Int32Array(b * (h + 1) * A).fill(-1), R = new Int32Array(b * (h + 1)).fill(A), O = new Int32Array(b * (h + 1)).fill(-1);
  $[v(0, 0, 0)] = 0, R[0] = 0, O[0] = 0;
  const P = (I, F, K, j) => {
    const V = I * (h + 1) + F;
    if (R[V] > O[V]) return;
    const W = m[j] - m[F], Z = W * (W - 1) / 2, it = k[m[F] * E + m[j]], ft = K * (h + 1) + j;
    for (let T = R[V]; T <= O[V]; T += 1) {
      const C = $[v(I, F, T)];
      if (C === Number.POSITIVE_INFINITY) continue;
      const _ = v(K, j, T + Z), S = C + it;
      S < $[_] && ($[_] = S, N[_] = F, T + Z < R[ft] && (R[ft] = T + Z), T + Z > O[ft] && (O[ft] = T + Z));
    }
  };
  if (d)
    for (let I = 1; I <= w; I += 1) for (let F = I; F <= h; F += 1) for (let K = I - 1; K < F; K += 1) P(I - 1, K, I, F);
  else
    for (let I = 1; I <= h; I += 1) for (let F = 0; F < I; F += 1) P(0, F, 0, I);
  const L = d ? g !== void 0 ? [g] : Array.from({ length: w }, (I, F) => F + 1) : [0], B = [], H = [], et = [];
  for (let I = s; I >= 0; I -= 1) {
    let F = Number.POSITIVE_INFINITY, K = -1;
    for (const j of L) {
      const V = $[v(j, h, I)];
      V < F && (F = V, K = j);
    }
    K < 0 || (B.push(s - I), H.push(F), et.push({ layer: K, wd: I }));
  }
  const x = (I, F) => {
    const K = new Array(o), j = [];
    let V = h, W = F, Z = I;
    for (; V > 0; ) {
      const it = N[v(Z, V, W)];
      j.push([it, V]);
      const ft = m[V] - m[it];
      W -= ft * (ft - 1) / 2, V = it, d && (Z -= 1);
    }
    return j.reverse(), j.forEach(([it, ft], T) => {
      for (let C = m[it]; C < m[ft]; C += 1) K[l[C]] = T + 1;
    }), K;
  };
  return ne(B, H, a * s).map((I) => ({ N: B[I], Ew: H[I], grade: x(et[I].layer, et[I].wd) }));
}
function os(t) {
  t != null && typeof t == "object" && xt(t, ["family", "tieFree", "positiveWeights"], "halfSlopeEligible input");
  const e = t?.family;
  if (e == null || typeof e != "object") throw new RangeError("family must be a family object");
  const r = t.tieFree;
  let n;
  if (typeof r == "boolean") n = r;
  else if (Array.isArray(r) && r.every((o) => typeof o == "boolean")) {
    const o = t.positiveWeights;
    if (o !== void 0 && (!Array.isArray(o) || o.length !== r.length))
      throw new RangeError("positiveWeights must have one entry per criterion");
    n = r.every((s, i) => s || o !== void 0 && !(o[i] === !0 || typeof o[i] == "number" && o[i] > 0));
  } else throw new RangeError("tieFree must be a boolean or one boolean per criterion");
  return e.kind === "all" && n;
}
function ss(t, e) {
  const r = M(e, ["w", "family", "N", "k", "tieTol"], "reportsAtN", !0), n = st(t, r.w), o = n.n, s = r.family ?? { kind: "all" }, i = r.N;
  if (typeof i != "number" || !Number.isSafeInteger(i) || i < 0)
    throw new RangeError(`reportsAtN: N must be an integer ≥ 0, got ${String(i)}`);
  const a = $r(r.k, "reportsAtN"), c = nt(r.tieTol, "tieTol"), u = ut(o, s), l = (d, w) => ({
    family: u,
    N: i,
    count: d,
    reports: w,
    tieTol: c,
    label: "exact-within-family"
  });
  if (u.sizeExact === 0n) return l(0, []);
  if (mt(o, u, s), i > n.M) return l(0, []);
  const f = dt(o, s, [n.ebar]), h = new kr(o, a, c);
  let m = 0;
  for (; f.next(); )
    f.N === i && (m += 1, h.push(f.g, f.sum(0)));
  const g = h.result().map(({ grade: d }) => ({ grade: d, Ew: U(d, t, { tau: 0.5, w: n.w }).Ew }));
  return l(m, g);
}
function is(t, e, r) {
  const n = M(r, ["w", "hull", "tieTol"], "ruleGap", !0), o = n.hull;
  Ie(o);
  const s = nt(n.tieTol, "tieTol"), i = U(t, e, { tau: 0.5, w: n.w }), { N: a, Ew: c, M: u } = i, l = o[0].N, f = o[o.length - 1].N;
  if (a < l || a > f)
    throw new RangeError(`ruleGap: the report states ${a} pairs, outside the hull's range (${l} … ${f})`);
  let h = 0;
  for (; h < o.length - 1 && o[h + 1].N <= a; ) h += 1;
  const m = o[h];
  let g = m, d = null, w = m.Ew;
  m.N !== a && (g = o[h + 1], d = (g.N - a) / (g.N - m.N), w = d * m.Ew + (1 - d) * g.Ew);
  const p = c - w, y = Math.abs(p) <= s * u ? 0 : p;
  return { N: a, Ew: c, H: w, gap: y, psi: d, lower: m, upper: g, onFrontier: y === 0 };
}
const Cr = 1e-12;
function Or(t) {
  const e = Array.isArray(t?.e) ? t.e.length : 0;
  return st(t, e <= 1 ? void 0 : new Array(e).fill(1 / e));
}
function Te(t, e) {
  return Array.isArray(t.criteria) && t.criteria.length === e ? [...t.criteria] : Array.from({ length: e }, (r, n) => `k${n + 1}`);
}
function Hn(t, e) {
  return Array.from({ length: t }, (r, n) => n === e ? 1 : 0);
}
function er(t, e) {
  const r = t.length;
  let n = 0, o = 0;
  for (let s = 0; s < r; s += 1)
    for (let i = s + 1; i < r; i += 1)
      o += 1, Math.sign(t[s] - t[i]) === Math.sign(e[s] - e[i]) && (n += 1);
  return n / o;
}
function Gr(t, e) {
  if (t == null) return new Array(e).fill(null);
  if (!Array.isArray(t) || t.length !== e) throw new RangeError(`q must hold ${e} budgets (null for none)`);
  return t.map((r, n) => {
    if (r == null) return null;
    if (typeof r != "number" || !Number.isFinite(r) || r < 0) throw new RangeError(`q[${n}] must be finite and ≥ 0, or null`);
    return r;
  });
}
function as(t, e = {}) {
  const r = M(e, ["tieTol"], "conflictPairs"), n = nt(r.tieTol, "tieTol"), o = Or(t), { n: s, K: i, ek: a } = o, c = [];
  for (let u = 0; u < s; u += 1)
    for (let l = u + 1; l < s; l += 1) {
      const f = [], h = [];
      for (let m = 0; m < i; m += 1) {
        const g = a[m][u * s + l] - a[m][l * s + u];
        g < -n ? f.push(m) : g > n && h.push(m);
      }
      f.length > 0 && h.length > 0 && c.push({ i: u, j: l, iAbove: f, jAbove: h });
    }
  return { count: c.length, pairs: c };
}
function Zn(t, e) {
  const r = st(t, e), n = Nt(r.n);
  for (let o = 0; o < r.n; o += 1) for (let s = 0; s < r.n; s += 1) o !== s && (n[o][s] = r.ebar[o * r.n + s]);
  return n;
}
function cs(t, e) {
  const r = M(e, ["tau", "w", "family", "tieTol", "maxTies"], "commonalityCost", !0), n = Y(r.tau), o = st(t, r.w), s = r.family ?? { kind: "all" }, i = nt(r.tieTol, "tieTol"), a = Mt(r.maxTies, "commonalityCost"), c = kt(t, { tau: n, w: o.w, family: s, tieTol: i, maxTies: a });
  if (c.empty) return c;
  const u = Te(t, o.K), l = [];
  for (let h = 0; h < o.K; h += 1) {
    const m = kt(t, { tau: n, w: Hn(o.K, h), family: s, tieTol: i, maxTies: a }), g = c.evaluation.Rk[h];
    l.push({
      k: h,
      criterion: u[h],
      weight: o.w[h],
      commonRk: g,
      ownGrade: m.grade,
      ownGrades: m.grades,
      ownTieCount: m.tieCount,
      ownRk: m.risk,
      ownN: m.N,
      ownG: m.G,
      delta: Math.max(0, g - m.risk),
      relationAgreement: er(m.grade, c.grade)
    });
  }
  const f = c.grades.map((h) => {
    const m = U(h, t, { tau: n, w: o.w }).Rk;
    return {
      grade: [...h],
      Rk: m,
      delta: l.map((g, d) => Math.max(0, m[d] - g.ownRk)),
      relationAgreement: l.map((g) => er(g.ownGrade, h))
    };
  });
  return { empty: !1, common: c, family: c.family, tau: n, w: o.w, criteria: l, commonReports: f, containsAllWithheld: c.containsAllWithheld, label: "exact-within-family" };
}
function ls(t, e) {
  const r = M(e, ["w", "a", "tau", "multiplier", "pair", "ids", "criteria"], "estimandCosts", !0), n = gt(t, "state"), { n: o, K: s, v: i } = n;
  if (o < 2) throw new RangeError("state must hold at least two units");
  const a = Y(r.tau), c = Q(r.w, s), u = r.a;
  if (!Array.isArray(u) || u.length !== s || !u.every((k) => typeof k == "number" && Number.isFinite(k)))
    throw new RangeError(`a must hold ${s} finite composite coefficients`);
  const l = r.multiplier ?? new Array(s).fill(1);
  if (!Array.isArray(l) || l.length !== s || !l.every((k) => typeof k == "number" && Number.isFinite(k) && k > 0))
    throw new RangeError(`multiplier must hold ${s} finite positive multipliers`);
  const f = r.pair ?? [0, 1], [h, m] = Array.isArray(f) ? f : [Number.NaN, Number.NaN];
  if (!Array.isArray(f) || f.length !== 2 || !Number.isInteger(h) || !Number.isInteger(m) || h < 0 || m < 0 || h >= o || m >= o || h === m)
    throw new RangeError(`pair must be two distinct unit indices in 0..${o - 1}`);
  const { ids: g, criteria: d } = It(r, o, s), w = Array.from({ length: o }, (k, b) => {
    const A = new q();
    for (let v = 0; v < s; v += 1) A.add(u[v] * (l[v] * i[b * s + v]));
    return A.value;
  }), p = Array.from({ length: s }, () => Nt(o)), y = [Nt(o)];
  for (let k = 0; k < o; k += 1)
    for (let b = 0; b < o; b += 1)
      if (k !== b) {
        for (let A = 0; A < s; A += 1) p[A][k][b] = i[k * s + A] <= i[b * s + A] ? 1 : 0;
        y[0][k][b] = w[k] <= w[b] ? 1 : 0;
      }
  const E = (k, b) => {
    const A = new q();
    for (let v = 0; v < s; v += 1) A.add(c[v] * p[v][k][b]);
    return A.value;
  };
  return {
    pair: [h, m],
    c: w,
    criterionLoss: Ze(E(h, m), E(m, h), a),
    compositeLoss: Ze(y[0][h][m], y[0][m][h], a),
    criterionE: { ids: g, criteria: d, e: p },
    compositeE: { ids: g, criteria: ["composite"], e: y }
  };
}
function us(t, e) {
  const r = M(e, ["tau", "w", "family", "q", "tieTol", "maxTies"], "budgetFamily", !0), n = Y(r.tau), o = st(t, r.w), { n: s } = o, i = r.family ?? { kind: "all" }, a = nt(r.tieTol, "tieTol"), c = Mt(r.maxTies, "budgetFamily"), u = Gr(r.q, o.K), l = kt(t, { tau: n, w: o.w, family: i, q: u, tieTol: a, maxTies: c }), f = ut(s, i), h = Number(l.family.size);
  let m = null;
  if (f.sizeExact !== 0n && f.sizeExact <= BigInt(Me)) {
    mt(s, f, i);
    const g = [];
    u.forEach((w, p) => w !== null && g.push(p));
    const d = dt(s, i, g.map((w) => o.ek[w]));
    for (m = []; d.next(); ) {
      let w = !0;
      for (let p = 0; p < g.length && w; p += 1) d.sum(p) > u[g[p]] * d.N + Cr && (w = !1);
      w && m.push(Array.from(d.g));
    }
    if (m.length !== h) throw new Error("internal: budget member count disagrees with exactOptimum");
  }
  return {
    empty: l.empty,
    size: h,
    baseSize: f.size,
    family: l.family,
    optimum: l.empty ? null : l,
    members: m,
    containsAllWithheld: !l.empty && Gt(s, i),
    label: "exact-within-family"
  };
}
function fs(t, e, r) {
  const n = Or(e);
  if (!Array.isArray(r)) throw new RangeError(`q must hold ${n.K} budgets (null for none)`);
  const o = Gr(r, n.K), s = U(t, e, { tau: 0.5, w: n.w }), i = Te(e, n.K), a = [];
  return o.forEach((c, u) => {
    if (c === null) return;
    const l = c * s.N;
    a.push({ k: u, criterion: i[u], q: c, E: s.E[u], N: s.N, qN: l, EoverN: s.EoverN[u], slack: l - s.E[u], meets: s.E[u] <= l + Cr });
  }), { rows: a, meets: a.every((c) => c.meets) };
}
function hs(t, e, r) {
  M(r, ["tau", "w"], "criterionMixtureRisk", !0);
  const n = U(t, e, r), o = Q(r?.w, n.Rk.length), s = new q();
  return n.Rk.forEach((i, a) => s.add(o[a] * i)), { risk: s.value, Rk: n.Rk, w: o, weightedRisk: n.risk, difference: s.value - n.risk };
}
function ms(t, e) {
  const r = M(e, ["tau", "w", "family", "criteria", "tieTol", "maxTies"], "minimaxChoice", !0), n = Y(r.tau), o = st(t, r.w), { n: s, K: i, M: a } = o, c = r.family ?? { kind: "all" }, u = nt(r.tieTol, "tieTol"), l = Mt(r.maxTies, "minimaxChoice"), f = ut(s, c);
  if (f.sizeExact === 0n) return Rt(f, "exact-within-family");
  mt(s, f, c);
  const h = Te(t, i);
  let m;
  if (r.criteria === void 0) m = Array.from({ length: i }, (v, $) => $);
  else {
    const v = r.criteria;
    if (!Array.isArray(v) || v.length < 1) throw new RangeError("criteria must list at least one criterion (index or id)");
    const $ = /* @__PURE__ */ new Set();
    for (const N of v) {
      const R = typeof N == "string" ? h.indexOf(N) : N;
      if (!Number.isInteger(R) || R < 0 || R >= i) throw new RangeError(`unknown criterion ${String(N)}`);
      $.add(R);
    }
    m = [...$].sort((N, R) => N - R);
  }
  const g = kt(t, { tau: n, w: o.w, family: c, tieTol: u, maxTies: l }), w = f.sizeExact <= BigInt(Me) ? [] : null, p = dt(s, c, o.ek), y = new re(s, u), E = new Float64Array(i);
  for (; p.next(); ) {
    const v = n * (a - p.N);
    let $ = Number.NEGATIVE_INFINITY;
    for (let N = 0; N < i; N += 1) E[N] = (p.sum(N) + v) / a;
    for (const N of m) E[N] > $ && ($ = E[N]);
    if (w) {
      const N = new q();
      for (let R = 0; R < i; R += 1) N.add(o.w[R] * E[R]);
      w.push({ grade: Array.from(p.g), N: p.N, Rk: Array.from(E), max: $, weighted: N.value });
    }
    y.push(p.g, $);
  }
  const k = y.first(l), b = U(k[0], t, { tau: n, w: o.w }), A = (v) => Math.max(...m.map(($) => v[$]));
  return {
    empty: !1,
    family: f,
    tau: n,
    w: o.w,
    included: m,
    reports: w,
    weighted: { grade: g.grade, grades: g.grades, tieCount: g.tieCount, risk: g.risk, Rk: g.evaluation.Rk, max: A(g.evaluation.Rk) },
    minimax: { grade: k[0], grades: k, tieCount: y.count(), value: A(b.Rk), Rk: b.Rk, weightedRisk: b.risk },
    containsAllWithheld: Gt(s, c),
    tieTol: u,
    label: "exact-within-family"
  };
}
function ws(t, e, r) {
  const n = M(r, ["tau"], "weightCrossing", !0), o = Y(n.tau);
  if ((Array.isArray(e?.e) ? e.e.length : 0) !== 2) throw new RangeError("weightCrossing needs two criteria (K = 2)");
  const i = U(X(t), e, { tau: o, w: [0.5, 0.5] }), a = i.E[0] - o * i.N, c = i.E[1] - o * i.N;
  if (a === c) return null;
  const u = c / (c - a);
  return u > 0 && u < 1 ? u : null;
}
function Xt(t, e = "scores") {
  if (t == null || typeof t != "object" || typeof t.length != "number" || t.length < 1)
    throw new RangeError(`${e} must be a nonempty array of numbers`);
  const r = Array.from(t);
  if (!r.every((n) => typeof n == "number" && Number.isFinite(n))) throw new RangeError(`${e} must be finite numbers`);
  return r;
}
function Pr(t) {
  const e = t?.direction ?? "descending";
  if (e !== "descending" && e !== "ascending") throw new RangeError('direction must be "descending" or "ascending"');
  return e === "descending" ? -1 : 1;
}
function jr(t, e) {
  const r = t.map((n, o) => o);
  return r.sort((n, o) => e * t[n] - e * t[o] || n - o), r;
}
function Qn(t, e) {
  const r = Array.from(t), n = Array.from(e), o = Math.min(r.length, n.length);
  for (let s = 0; s < o; s += 1) {
    const i = r[s].codePointAt(0) - n[s].codePointAt(0);
    if (i !== 0) return i;
  }
  return r.length - n.length;
}
function Xn(t, e = {}) {
  e = M(e, ["direction"], "strictOrder");
  const r = Xt(t), n = jr(r, Pr(e)), o = new Array(r.length);
  return n.forEach((s, i) => o[s] = i + 1), o;
}
function gs(t, e, r = {}) {
  r = M(r, ["direction"], "tierGrades");
  const n = Xt(t), o = n.length;
  if (!Number.isSafeInteger(e) || e < 1) throw new RangeError("G must be a positive integer");
  const s = Math.min(e, o), i = jr(n, Pr(r)), a = new Array(o);
  a[0] = 1;
  for (let d = 1; d < o; d += 1) a[d] = a[d - 1] + (n[i[d]] !== n[i[d - 1]] ? 1 : 0);
  const c = a[o - 1], u = Array.from({ length: o }, (d, w) => 1 + Math.floor(w * s / o)), l = Array.from({ length: s + 1 }, (d, w) => w), f = (d) => {
    for (; l[d] !== d; ) d = l[d];
    return d;
  };
  for (let d = 1; d <= c; d += 1) {
    const w = [...new Set(u.filter((p, y) => a[y] === d))];
    if (w.length > 1) {
      const p = f(Math.min(...w));
      for (const y of w) l[f(y)] = p;
    }
  }
  const h = u.map(f), m = new Array(c + 1);
  for (let d = o - 1; d >= 0; d -= 1) m[a[d]] = h[d];
  const g = new Array(o);
  return i.forEach((d, w) => g[d] = m[a[w]]), Ct(g);
}
function ds(t, e, r = {}) {
  r = M(r, ["ref", "crit"], "evidenceFlags");
  const n = Xt(t, "est"), o = n.length, s = typeof e == "number" ? new Array(o).fill(e) : Xt(e, "se");
  if (s.length !== o) throw new RangeError(`se must have ${o} values (or be one number)`);
  if (!s.every((l) => l > 0)) throw new RangeError("se must be positive");
  const i = r?.ref ?? 0, a = r?.crit ?? 1.96;
  if (typeof i != "number" || !Number.isFinite(i)) throw new RangeError("ref must be a finite number");
  if (typeof a != "number" || !Number.isFinite(a) || a < 0) throw new RangeError("crit must be a finite number ≥ 0");
  const c = n.map((l, f) => (l - i) / s[f]), u = c.map((l) => l > a ? 1 : l < -a ? 3 : 2);
  return { grade: Ct(u), z: c, labels: u };
}
function ps(t, e = {}) {
  e = M(e, ["w"], "expectedRank");
  const r = Array.isArray(t?.e) ? t.e.length : 0, n = e?.w ?? new Array(r).fill(1 / Math.max(r, 1)), o = st(t, n), { n: s, ek: i } = o, a = Array.isArray(t.ids) && t.ids.length === s ? t.ids : zt(s), c = a.map((l, f) => f).sort((l, f) => Qn(a[l], a[f]) || l - f), u = new Array(s).fill(0);
  for (let l = 0; l < s; l += 1) {
    let f = 0;
    for (let h = 0; h < o.K; h += 1) {
      let m = 0;
      for (const g of c) m += g === l ? 0 : i[h][l * s + g];
      f += (1 + m) * o.w[h];
    }
    u[l] = f;
  }
  return u;
}
const oe = 20261030;
function $t(t, e) {
  if (typeof t != "number" || !Number.isFinite(t)) throw new RangeError(`${e} must be a finite number`);
  return t;
}
function ct(t, e, r = 0) {
  if (!Number.isSafeInteger(t) || t < r) throw new RangeError(`${e} must be an integer ≥ ${r}`);
  return t;
}
function J(t, e) {
  if (t == null || typeof t != "object" || typeof t.length != "number" || t.length < 1) throw new RangeError(`${e} must be a nonempty array`);
  const r = Array.from(t);
  if (!r.every((n) => typeof n == "number" && Number.isFinite(n))) throw new RangeError(`${e} must be finite numbers`);
  return r;
}
function pt(t, e, r) {
  if (typeof t == "number") return new Array(e).fill($t(t, r));
  const n = J(t, r);
  if (n.length !== e) throw new RangeError(`${r} must have ${e} values (or be one number)`);
  return n;
}
function Kt(t, e) {
  if (!t.every((r) => r >= 0)) throw new RangeError(`${e} must be ≥ 0`);
}
function Jt(t) {
  return t.map((e, r) => r).sort((e, r) => t[r] - t[e] || e - r);
}
function _r(t) {
  const e = t.length;
  let r = 0;
  for (let s = 0; s < e; s += 1) r += t[s];
  let n = r / e;
  if (Number.isFinite(n)) {
    let s = 0;
    for (let i = 0; i < e; i += 1) s += t[i] - n;
    n += s / e;
  }
  let o = 0;
  for (let s = 0; s < e; s += 1) o += (t[s] - n) * (t[s] - n);
  return Math.sqrt(o / (e - 1));
}
function zr(t, e) {
  if (t == null || typeof t != "object" || typeof t.length != "number" || t.length < 1)
    throw new RangeError(`${e} must be a nonempty array of draws`);
  const r = t.length, n = gt(t[0], `${e}[0]`), { n: o, K: s } = n, i = new Float64Array(r * o * s);
  i.set(n.v, 0);
  for (let a = 1; a < r; a += 1) {
    const c = gt(t[a], `${e}[${a}]`);
    if (c.n !== o || c.K !== s) throw new RangeError(`${e}[${a}] must have ${o} units × ${s} criteria, as ${e}[0]`);
    i.set(c.v, a * o * s);
  }
  return { S: r, n: o, K: s, v: i };
}
function rr(t, e, r) {
  let n = !0;
  for (let o = 0; o < e; o += 1) {
    let s = 1;
    const i = t[o];
    for (let a = 0; a < e; a += 1)
      a !== o && (t[a] > i ? s += 1 : t[a] === i && (n = !1));
    r[o] = s;
  }
  return n;
}
function bs(t, e, r, n) {
  if ($t(t, "truth"), $t(e, "se") < 0) throw new RangeError("se must be ≥ 0");
  const o = te(n, ct(r, "count"));
  return Array.from(o, (s) => t + e * s);
}
function se() {
  const t = zt(30), e = [16, 64, 256], r = ["small", "medium", "large"], n = [], o = [], s = [], i = [], a = [];
  for (let c = 1; c <= 30; c += 1) {
    const u = (c - 1) % 3;
    n.push(e[u]), o.push(r[u]), s.push(0.8 / Math.sqrt(e[u]));
    const l = 19 * c % 31;
    a.push(l), i.push(0.15 * ye((l - 0.5) / 30));
  }
  return { ids: t, size: n, group: o, se: s, theta: i, rank: a };
}
function Se(t = oe) {
  const { theta: e, se: r } = se(), n = te(t, 30);
  return { seed: t, estimate: e.map((o, s) => o + r[s] * n[s]) };
}
function xe(t, e, r = {}) {
  r = M(r, ["priorMean", "priorSd"], "normalPosterior");
  const n = $t(r?.priorMean ?? 0, "priorMean"), o = r?.priorSd ?? 0.15;
  if (typeof o != "number" || !(o > 0)) throw new RangeError("priorSd must be > 0 (Infinity for a flat prior)");
  const s = typeof t == "number" && typeof e == "number", i = typeof t == "number" ? typeof e == "number" ? 1 : e.length : t.length, a = pt(t, i, "est"), c = pt(e, i, "se");
  Kt(c, "se");
  const u = o * o, l = c.map((m) => o === Number.POSITIVE_INFINITY ? 1 : u / (u + m * m)), f = a.map((m, g) => n + l[g] * (m - n)), h = c.map((m, g) => Math.sqrt(l[g]) * m);
  return s ? { mean: f[0], sd: h[0], shrink: l[0] } : { mean: f, sd: h, shrink: l };
}
function ys(t, e, r) {
  if (typeof r != "number" || !(r > 0 && r < 1)) throw new RangeError("level must lie in (0, 1)");
  const n = ye((1 + r) / 2), o = typeof t == "number" && typeof e == "number", s = typeof t == "number" ? typeof e == "number" ? 1 : e.length : t.length, i = pt(t, s, "mean"), a = pt(e, s, "sd");
  Kt(a, "sd");
  const c = i.map((l, f) => l - n * a[f]), u = i.map((l, f) => l + n * a[f]);
  return o ? { lower: c[0], upper: u[0] } : { lower: c, upper: u };
}
function Es(t, e, r = {}) {
  r = M(r, ["priorSd", "priorMean"], "expectedMisorderedPairs");
  const n = J(t, "theta"), o = n.length, s = pt(e, o, "se");
  Kt(s, "se");
  const i = r?.priorSd ?? null, a = $t(r?.priorMean ?? 0, "priorMean");
  let c;
  if (i === null) c = new Array(o).fill(1);
  else {
    if (typeof i != "number" || !(i > 0)) throw new RangeError("priorSd must be > 0 (or null for the estimate order)");
    c = s.map((l) => i === Number.POSITIVE_INFINITY ? 1 : i * i / (i * i + l * l));
  }
  const u = new q();
  for (let l = 0; l < o; l += 1)
    for (let f = l + 1; f < o; f += 1) {
      const h = Math.sign(n[l] - n[f]);
      if (h === 0) {
        u.add(1);
        continue;
      }
      const m = Math.hypot(c[l] * s[l], c[f] * s[f]), g = i === null ? Math.abs(n[l] - n[f]) : h * (c[l] * (n[l] - a) - c[f] * (n[f] - a));
      m === 0 ? u.add(g > 0 ? 0 : 1) : u.add(At(-g / m));
    }
  return u.value;
}
function Jn(t, e) {
  const r = J(t, "a"), n = J(e, "b");
  if (r.length !== n.length) throw new RangeError("a and b must have the same length");
  const o = [];
  for (let s = 0; s < r.length; s += 1)
    for (let i = s + 1; i < r.length; i += 1) Math.sign(r[s] - r[i]) !== Math.sign(n[s] - n[i]) && o.push({ i: s, j: i });
  return { count: o.length, pairs: o };
}
function to(t, e, r) {
  const n = J(t, "a"), o = J(e, "b");
  if (n.length !== o.length) throw new RangeError("a and b must have the same length");
  if (ct(r, "k"), r > n.length) throw new RangeError(`k must be at most ${n.length}`);
  const s = new Set(Jt(n).slice(0, r)), i = Jt(o).slice(0, r).filter((a) => s.has(a)).sort((a, c) => a - c);
  return { count: i.length, members: i };
}
function eo(t, e, r) {
  const n = J(t, "score"), o = n.length;
  if (e == null || e.length !== o || !Array.from(e).every((f) => typeof f == "string"))
    throw new RangeError(`group must hold ${o} group names`);
  if (ct(r, "k"), r > o) throw new RangeError(`k must be at most ${o}`);
  const s = [...new Set(Array.from(e))], i = () => Object.fromEntries(s.map((f) => [f, 0])), a = i(), c = i(), u = Jt(n);
  for (const f of u.slice(0, r)) a[e[f]] += 1;
  for (const f of u.slice(o - r)) c[e[f]] += 1;
  const l = Object.fromEntries(s.map((f) => [f, a[f] + c[f]]));
  return { k: r, top: a, bottom: c, total: l };
}
function vs(t = oe, e = {}) {
  if (e = M(e, ["replays", "k", "topK"], "leagueReplays"), !Number.isSafeInteger(t)) throw new RangeError("seed must be an integer");
  const r = ct(e.replays ?? 20, "replays", 1), n = ct(e.k ?? 5, "k"), o = ct(e.topK ?? 10, "topK"), s = se(), i = [...new Set(s.group)], a = [];
  for (let u = 1; u <= r; u += 1) {
    const { estimate: l } = Se(t + u);
    a.push({
      r: u,
      seed: t + u,
      estimate: l,
      extreme: eo(l, s.group, n),
      topOverlap: to(l, s.theta, o).count,
      misordered: Jn(l, s.theta).count
    });
  }
  const c = (u) => {
    let l = 0;
    for (const f of a) l += u(f);
    return l / r;
  };
  return {
    seed: t,
    replays: r,
    k: n,
    topK: o,
    seeds: a.map((u) => u.seed),
    draws: a,
    mean: {
      extreme: Object.fromEntries(i.map((u) => [u, c((l) => l.extreme.total[u])])),
      topOverlap: c((u) => u.topOverlap),
      misordered: c((u) => u.misordered)
    }
  };
}
function As(t, e, r) {
  const n = J(t, "probs");
  if (!n.every((c) => c >= 0 && c <= 1)) throw new RangeError("probs must lie in [0, 1]");
  if (ct(e, "S"), !Number.isSafeInteger(r)) throw new RangeError("seed must be an integer");
  const o = n.length, s = new Float64Array(o);
  s[0] = n[0];
  for (let c = 1; c < o; c += 1) s[c] = s[c - 1] + n[c];
  const i = fr(r, e), a = new Int32Array(e);
  for (let c = 0; c < e; c += 1) {
    let u = 0;
    for (; u < o && !(i[c] < s[u]); ) u += 1;
    a[c] = u < o ? u : o - 1;
  }
  return a;
}
function Ns(t) {
  if (t == null || typeof t != "object") throw new RangeError("law must be { states, probs }");
  const e = zr(t.states, "law.states");
  if (e.K !== 1) throw new RangeError("rankSummaries takes one value per unit");
  const { S: r, n, v: o } = e;
  let s = null;
  if (t.probs != null) {
    const i = J(t.probs, "law.probs");
    if (i.length !== r) throw new RangeError(`law.probs must have one value per state (${r})`);
    const a = new q();
    for (const c of i) {
      if (c < 0) throw new RangeError("law.probs must be ≥ 0");
      a.add(c);
    }
    if (Math.abs(a.value - 1) > 1e-12) throw new RangeError("law.probs must sum to 1 (within 1e-12); they are not normalized");
    s = i;
  }
  return qr(r, n, o, s);
}
function qr(t, e, r, n) {
  const o = new Int32Array(e);
  let s = !0;
  if (n === null) {
    const l = Array.from({ length: e }, () => new Float64Array(e)), f = Array.from({ length: e }, () => new q()), h = new Float64Array(e);
    for (let w = 0; w < t; w += 1) {
      const p = r.subarray(w * e, w * e + e);
      rr(p, e, o) || (s = !1);
      for (let y = 0; y < e; y += 1)
        l[o[y] - 1][y] += 1, h[y] += o[y], f[y].add(p[y]);
    }
    const m = l.map((w) => Array.from(w, (p) => p / t)), g = [], d = new Float64Array(e);
    for (let w = 0; w < e; w += 1) {
      for (let p = 0; p < e; p += 1) d[p] += l[w][p];
      g.push(Array.from(d, (p) => p / t));
    }
    return { n: e, means: f.map((w) => w.value / t), expectedRank: Array.from(h, (w) => w / t), rankProbs: m, pTop: g, tieFree: s };
  }
  const i = Array.from({ length: e }, () => Array.from({ length: e }, () => new q())), a = Array.from({ length: e }, () => Array.from({ length: e }, () => new q())), c = Array.from({ length: e }, () => new q()), u = Array.from({ length: e }, () => new q());
  for (let l = 0; l < t; l += 1) {
    const f = r.subarray(l * e, l * e + e);
    rr(f, e, o) || (s = !1);
    const h = n[l];
    for (let m = 0; m < e; m += 1) {
      i[o[m] - 1][m].add(h);
      for (let g = o[m] - 1; g < e; g += 1) a[g][m].add(h);
      c[m].add(h * f[m]), u[m].add(h * o[m]);
    }
  }
  return {
    n: e,
    means: c.map((l) => l.value),
    expectedRank: u.map((l) => l.value),
    rankProbs: i.map((l) => l.map((f) => f.value)),
    pTop: a.map((l) => l.map((f) => f.value)),
    tieFree: s
  };
}
function Rs(t, e, r, n) {
  const o = J(t, "means"), s = o.length, i = pt(e, s, "sds");
  Kt(i, "sds"), ct(r, "S", 1);
  const a = te(n, r * s), c = new Float64Array(r * s);
  for (let u = 0; u < r * s; u += 1) c[u] = o[u % s] + i[u % s] * a[u];
  return { ...qr(r, s, c, null), S: r, seed: n, label: "monte-carlo" };
}
function ks(t) {
  Y(t);
  const e = ye(t, { lowerTail: !1 }), r = 2 - Math.SQRT2 * e, n = Math.SQRT2 * e, o = At(Math.SQRT2), s = Zr(Math.SQRT2) <= t, i = !s || !(r < n);
  return { tau: t, empty: i, lower: i ? null : r, upper: i ? null : n, pi13: o, states13: s };
}
function $s(t, e, r, n) {
  const o = gt(t, "means"), { n: s, K: i } = o;
  let a;
  if (typeof e == "number") a = new Float64Array(s * i).fill($t(e, "sds"));
  else {
    const l = gt(e, "sds");
    if (l.n !== s || l.K !== i) throw new RangeError(`sds must be ${s} units × ${i} criteria, as means`);
    a = l.v;
  }
  if (!a.every((l) => l >= 0)) throw new RangeError("sds must be ≥ 0");
  ct(r, "S", 1);
  const c = te(n, r * s * i), u = new Array(r);
  for (let l = 0; l < r; l += 1) {
    const f = new Array(s);
    for (let h = 0; h < s; h += 1) {
      const m = new Array(i);
      for (let g = 0; g < i; g += 1) m[g] = o.v[h * i + g] + a[h * i + g] * c[(l * s + h) * i + g];
      f[h] = m;
    }
    u[l] = f;
  }
  return u;
}
function ro(t) {
  if (t == null || typeof t != "object" || typeof t.length != "number") throw new RangeError("trace must be an array of numbers");
  for (let e = 0; e < t.length; e += 1) $t(t[e], "trace values");
  return t.length < 2 ? null : _r(t) / Math.sqrt(t.length);
}
function Ms(t, e, r, n = "package", o = {}) {
  const s = M(o, ["K"], "envelopeRadius");
  if (typeof t != "number" || !Number.isFinite(t) || !(t >= 1)) throw new RangeError("M must be ≥ 1");
  if (typeof e != "number" || !Number.isFinite(e) || !(e > 0)) throw new RangeError("S must be > 0");
  if (typeof r != "number" || !(r > 0 && r < 1)) throw new RangeError("alpha must lie in (0, 1)");
  if (n !== "package" && n !== "book") throw new RangeError('form must be "package" or "book"');
  const i = s.K ?? 1;
  if (!Number.isSafeInteger(i) || i < 1) throw new RangeError("K must be a positive integer (the number of criteria)");
  return Math.sqrt(n === "package" ? (Math.log(2) + Math.log(t) - Math.log(r)) / (2 * e) : Math.log(4 * t * i / r) / (2 * e));
}
function Is(t, e) {
  e = M(e, ["tau", "w", "z", "screenMargin", "grade", "ids"], "fragilePairs", !0);
  const { S: r, n, K: o, v: s } = zr(t, "draws");
  if (n < 2) throw new RangeError("draws must hold at least two units");
  const i = Y(e?.tau), a = Q(e?.w, o), c = e?.z ?? 2;
  if (typeof c != "number" || !Number.isFinite(c) || !(c > 0)) throw new RangeError("z must be a positive number");
  const u = e?.screenMargin ?? c * 0.5 / Math.sqrt(Math.max(1, r - 1));
  if (typeof u != "number" || !(u > 0)) throw new RangeError("screenMargin must be a positive number");
  const l = e?.ids === void 0 ? zt(n) : Array.from(e.ids);
  if (l.length !== n) throw new RangeError(`ids must hold ${n} strings`);
  const f = e?.grade === void 0 ? null : X(e.grade, n), h = new Float64Array(r * n * o);
  for (let N = 0; N < r; N += 1) for (let R = 0; R < n * o; R += 1) h[R * r + N] = s[N * n * o + R];
  const m = (N, R) => h.subarray((N * o + R) * r, (N * o + R + 1) * r), g = new Float64Array(n * n);
  for (let N = 0; N < o; N += 1)
    for (let R = 0; R < n; R += 1) {
      const O = m(R, N);
      for (let P = 0; P < n; P += 1) {
        if (R === P) continue;
        const L = m(P, N);
        let B = 0;
        for (let et = 0; et < r; et += 1) O[et] <= L[et] && (B += 1);
        const H = a[N] * (B / r);
        g[R * n + P] = N === 0 ? H : g[R * n + P] + H;
      }
    }
  const d = [];
  let w = 0, p = 0, y = 0, E = 0, k = 0, b = 0;
  const A = new Float64Array(r);
  for (let N = 1; N < n; N += 1)
    for (let R = 0; R < N; R += 1) {
      w += 1;
      const O = g[R * n + N], P = g[N * n + R], L = O <= P, B = L ? O : P, H = Math.abs(B - i);
      if (!(H < u)) continue;
      p += 1;
      const et = L ? R : N, x = L ? N : R;
      A.fill(0);
      for (let j = 0; j < o; j += 1) {
        const V = m(et, j), W = m(x, j);
        for (let Z = 0; Z < r; Z += 1) A[Z] = A[Z] + a[j] * (V[Z] <= W[Z] ? 1 : 0);
      }
      const I = r > 1 ? _r(A) / Math.sqrt(r) : null, F = I === null ? null : H < c * I;
      I === null && (E += 1);
      const K = {
        i: R,
        j: N,
        idI: l[R],
        idJ: l[N],
        betterDirection: L ? "i_ahead" : "j_ahead",
        weightedError: B,
        margin: H,
        disclosePreferred: B < i,
        mcse: I,
        ratio: I === null ? null : H / I,
        fragile: F
      };
      if (f !== null) {
        const j = f[R] < f[N] ? 1 : f[R] > f[N] ? -1 : 0;
        K.relationInGrade = j === 0 ? "tied" : j === 1 === L ? "disclosed_better_direction" : "disclosed_reverse", F === !0 && (j === 0 ? b += 1 : k += 1);
      }
      F === !0 && (y += 1), d.push(K);
    }
  const v = p > 0 && E === p, $ = {
    pairs: w,
    traced: p,
    fragile: v ? null : y,
    fragileShare: v ? null : y / w,
    mcseUnavailable: E
  };
  return f !== null && ($.fragileDisclosed = v ? null : k, $.fragileTied = v ? null : b), { S: r, n, K: o, tau: i, w: a, z: c, screenMargin: u, regime: "iid", mcseMethod: "iid_sample_sd_over_sqrt_S", pairs: d, summary: $, label: "monte-carlo" };
}
function Fe(t, e) {
  if (typeof t != "number" || !Number.isSafeInteger(t)) throw new RangeError(`${e}: seed must be a safe integer, got ${String(t)}`);
  return t;
}
function Kr(t, e) {
  const r = t ?? "top";
  if (r !== "top" && r !== "bottom") throw new RangeError(`${e}: side must be "top" or "bottom", got ${String(r)}`);
  return r;
}
function Dr(t, e, r) {
  if (typeof t != "number" || !Number.isSafeInteger(t) || t < 1 || t > e) throw new RangeError(`${r}: k must be an integer in 1..${e}, got ${String(t)}`);
  return t;
}
function Ce(t, e) {
  const r = t ?? 0.15;
  if (typeof r != "number" || !(r > 0)) throw new RangeError(`${e}: priorSd must be > 0 (Infinity for a flat prior), got ${String(r)}`);
  return r;
}
function Oe(t, e) {
  for (const r of ["p01", "p10"]) {
    const n = t[r];
    if (typeof n != "number" || !(n > 0 && n <= 1)) throw new RangeError(`${e}: ${r} must lie in (0, 1], got ${String(n)}`);
  }
  return { p01: t.p01, p10: t.p10 };
}
function no(t, e, r) {
  const n = M(r, ["k", "side", "posterior"], "topKOvershoot", !0), o = J(t, "estimate"), s = o.length, i = J(e, "truth");
  if (i.length !== s) throw new RangeError(`topKOvershoot: truth must have ${s} values, as estimate`);
  let a = null;
  if (n.posterior !== void 0 && n.posterior !== null && (a = J(n.posterior, "posterior"), a.length !== s))
    throw new RangeError(`topKOvershoot: posterior must have ${s} values, as estimate`);
  const c = Dr(n.k, s, "topKOvershoot"), u = Kr(n.side, "topKOvershoot"), l = Jt(o), f = u === "top" ? l.slice(0, c) : l.slice(s - c), h = (m) => {
    let g = 0;
    for (const d of f) g += m[d] - i[d];
    return g / c;
  };
  return { k: c, side: u, units: f, overshoot: h(o), posteriorOvershoot: a === null ? null : h(a) };
}
function Ts(t = oe, e = {}) {
  const r = M(e, ["replays", "k", "side", "priorSd"], "leagueOvershoot");
  Fe(t, "leagueOvershoot");
  const n = ct(r.replays ?? 20, "replays", 1), o = Dr(r.k ?? 3, 30, "leagueOvershoot"), s = Kr(r.side, "leagueOvershoot"), i = Ce(r.priorSd, "leagueOvershoot"), a = se(), c = [];
  let u = 0, l = 0;
  for (let f = 1; f <= n; f += 1) {
    const { estimate: h } = Se(t + f), m = xe(h, a.se, { priorSd: i }), g = no(h, a.theta, { k: o, side: s, posterior: m.mean }), d = g.posteriorOvershoot;
    c.push({ r: f, seed: t + f, units: g.units, overshoot: g.overshoot, posteriorOvershoot: d }), u += g.overshoot, l += d;
  }
  return { seed: t, replays: n, k: o, side: s, priorSd: i, draws: c, mean: { overshoot: u / n, posteriorOvershoot: l / n } };
}
function Ss(t, e, r = {}) {
  const n = M(r, ["priorSd", "priorMean"], "expectedSquaredDistance"), o = J(t, "theta"), s = o.length, i = pt(e, s, "se");
  Kt(i, "se");
  const a = Ce(n.priorSd, "expectedSquaredDistance"), c = $t(n.priorMean ?? 0, "priorMean"), u = xe(o, i, { priorSd: a, priorMean: c }).shrink, l = o.map((m, g) => {
    const d = (1 - u[g]) * (c - m);
    return d * d + u[g] * u[g] * (i[g] * i[g]);
  });
  let f = 0;
  for (const m of l) f += m;
  let h = 0;
  for (const m of i) h += m * m;
  return { perUnit: l, mean: f / s, rawMean: h / s };
}
function oo(t, e) {
  const r = J(t, "eps");
  if (!r.every((s) => s >= 0)) throw new RangeError("weightedRadius: eps must be ≥ 0");
  const n = Q(e, r.length);
  let o = 0;
  for (let s = 0; s < r.length; s += 1) o += n[s] * r[s];
  return o;
}
function so(t) {
  const e = M(t, ["N", "Nstar", "M", "deltaW", "eta"], "regretBound", !0), r = e.M;
  if (typeof r != "number" || !Number.isSafeInteger(r) || r < 1) throw new RangeError(`regretBound: M must be a positive integer, got ${String(r)}`);
  for (const a of ["N", "Nstar"]) {
    const c = e[a];
    if (typeof c != "number" || !Number.isSafeInteger(c) || c < 0 || c > r) throw new RangeError(`regretBound: ${a} must be an integer in 0..${r}, got ${String(c)}`);
  }
  const n = e.eta ?? 0;
  for (const [a, c] of [["deltaW", e.deltaW], ["eta", n]])
    if (typeof c != "number" || !Number.isFinite(c) || c < 0) throw new RangeError(`regretBound: ${a} must be a finite number ≥ 0, got ${String(c)}`);
  const { N: o, Nstar: s, deltaW: i } = e;
  return { evaluation: o * i / r, regret: (o + s) * i / r + n, uniform: 2 * i + n };
}
function xs(t) {
  const e = M(t, ["p01", "p10", "S", "chains", "seed"], "twoStateChain", !0), { p01: r, p10: n } = Oe(e, "twoStateChain"), o = ct(e.S, "S", 1), s = ct(e.chains ?? 1, "chains", 1), i = Fe(e.seed, "twoStateChain"), a = r / (r + n), c = fr(i, s * o), u = [];
  for (let l = 0; l < s; l += 1) {
    const f = new Array(o);
    let h = c[l * o] < a ? 1 : 0;
    f[0] = h;
    for (let m = 1; m < o; m += 1) {
      const g = c[l * o + m];
      h === 0 ? h = g < r ? 1 : 0 : h = g < n ? 0 : 1, f[m] = h;
    }
    u.push(f);
  }
  return { p01: r, p10: n, S: o, seed: i, pi1: a, chains: u };
}
function Fs(t) {
  const e = M(t, ["p01", "p10", "S"], "chainMeanVariance", !0), { p01: r, p10: n } = Oe(e, "chainMeanVariance"), o = ct(e.S, "S", 1), s = 1 - r - n, i = r / (r + n), a = i * (1 - i);
  let c = 0;
  for (let l = 1; l <= o - 1; l += 1) {
    const f = Math.pow(s, l);
    if (f === 0) break;
    c += (o - l) * f;
  }
  const u = a / (o * o) * (o + 2 * c);
  return {
    pi1: i,
    rho: s,
    variance: u,
    iidVariance: a / o,
    equivalentDraws: a / u,
    asymptoticEquivalent: s === -1 ? null : o * (1 - s) / (1 + s),
    noSwitch: (1 - i) * Math.pow(1 - r, o - 1) + i * Math.pow(1 - n, o - 1)
  };
}
function Cs(t = oe, e = {}) {
  const r = M(e, ["replays", "priorSd", "tau", "cap"], "leagueGradingReplays");
  Fe(t, "leagueGradingReplays");
  const n = ct(r.replays ?? 20, "replays", 1), o = Ce(r.priorSd, "leagueGradingReplays"), s = Y(r.tau ?? 0.2), i = r.cap ?? 3;
  if (typeof i != "number" || !Number.isSafeInteger(i) || i < 1 || i > 30)
    throw new RangeError(`leagueGradingReplays: cap must be an integer in 1..30, got ${String(i)}`);
  const a = se(), c = [];
  for (let l = 1; l <= n; l += 1) {
    const { estimate: f } = Se(t + l), h = xe(f, a.se, { priorSd: o }), m = pn(h.mean, h.sd), g = new Array(a.ids.length);
    Xn(h.mean).forEach((E, k) => g[E - 1] = k);
    const d = Ln(m, { order: g, tau: s, G: i });
    if (d.empty) throw new RangeError("leagueGradingReplays: the order family is empty");
    const w = d.grade, p = U(w, m, { tau: s }), y = Nr(w, a.theta);
    c.push({ r: l, seed: t + l, grade: w, N: p.N, E: p.E[0], EoverN: p.EoverN[0], D: y.D[0], DoverN: y.DoverN[0], risk: p.risk });
  }
  const u = Nn(
    c.map((l) => ({ A: l.D, N: l.N })),
    { M: Ot(a.ids.length) }
  );
  return { seed: t, replays: n, priorSd: o, tau: s, cap: i, draws: c, estimands: u };
}
function Os(t, e = {}) {
  const r = M(e, ["transform", "k", "criterion"], "transformedMeans"), n = r.transform ?? "identity";
  if (n !== "identity" && n !== "sqrt" && n !== "log" && n !== "exp")
    throw new RangeError(`transformedMeans: transform must be "identity", "sqrt", "log" or "exp", got ${String(n)}`);
  const o = r.k ?? 1;
  if (typeof o != "number" || !Number.isFinite(o) || o === 0) throw new RangeError(`transformedMeans: k must be a finite nonzero number, got ${String(o)}`);
  const s = r.criterion ?? 0;
  if (typeof s != "number" || !Number.isSafeInteger(s) || s < 0)
    throw new RangeError(`transformedMeans: criterion must be a criterion index (an integer ≥ 0), got ${String(s)}`);
  if (t == null || typeof t != "object" || Array.isArray(t))
    throw new RangeError("transformedMeans: law must be { states, probs } (a finite law) or { means, sds } (normal posteriors)");
  let i;
  if ("states" in t) {
    xt(t, ["states", "probs"], "transformedMeans: law { states, probs }");
    const c = Ft(t.states, t.probs, "law.states");
    if (s >= c.K) throw new RangeError(`transformedMeans: criterion must be an integer in 0..${c.K - 1}, got ${s}`);
    const u = (l, f, h) => {
      switch (n) {
        case "sqrt":
          if (!(l >= 0)) throw new RangeError(`transformedMeans: "sqrt" needs θ ≥ 0, but unit ${f} is ${l} in state ${h}`);
          return Math.sqrt(l);
        case "log":
          if (!(l > 0)) throw new RangeError(`transformedMeans: "log" needs θ > 0, but unit ${f} is ${l} in state ${h}`);
          return Math.log(l);
        case "exp":
          return Math.exp(o * l);
        default:
          return l;
      }
    };
    i = new Array(c.n);
    for (let l = 0; l < c.n; l += 1) {
      let f = 0;
      for (let h = 0; h < c.S; h += 1) {
        const m = u(c.states[h][l * c.K + s], l, h);
        f += c.p === null ? m : c.p[h] * m;
      }
      i[l] = c.p === null ? f / c.S : f;
    }
  } else if ("means" in t) {
    xt(t, ["means", "sds"], "transformedMeans: law { means, sds }");
    const c = J(t.means, "law.means"), u = pt(t.sds, c.length, "law.sds");
    if (Kt(u, "law.sds"), s !== 0) throw new RangeError(`transformedMeans: normal posteriors have one criterion (criterion 0), got ${s}`);
    if (n === "identity") i = c.slice();
    else if (n === "exp") i = c.map((l, f) => Math.exp(o * l + o * o * (u[f] * u[f]) / 2));
    else throw new RangeError(`transformedMeans: normal posteriors take transform "identity" or "exp", not "${n}"`);
  } else
    throw new RangeError("transformedMeans: law must be { states, probs } (a finite law) or { means, sds } (normal posteriors)");
  const a = i.map((c, u) => u).sort((c, u) => i[u] > i[c] ? 1 : i[u] < i[c] ? -1 : c - u);
  return { means: i, order: a };
}
function Gs(t, e, r) {
  const n = M(r, ["tau", "w", "family"], "selectionOnDraws", !0), { n: o, K: s } = tt(e), i = Ar(t);
  if (i.ids.length !== o || i.e.length !== s)
    throw new RangeError(`selectionOnDraws: draws must be S × ${o} units × ${s} criteria, as E (got ${i.ids.length} × ${i.e.length})`);
  const a = { tau: n.tau, w: n.w, family: n.family }, c = kt(i, a);
  if (c.empty) throw new RangeError(`selectionOnDraws: the family ${c.family.name} is empty`);
  const u = kt(e, a);
  if (u.empty) throw new RangeError(`selectionOnDraws: the family ${u.family.name} is empty`);
  const l = Q(n.w, s), f = c.grade, h = U(f, i, { tau: n.tau, w: l }), m = U(f, e, { tau: n.tau, w: l }), g = En(i, e).epsilon, d = oo(g, l), w = so({ N: m.N, Nstar: u.N, M: m.M, deltaW: d });
  return {
    grade: f,
    N: m.N,
    inSample: h.risk,
    exact: m.risk,
    gap: h.risk - m.risk,
    epsilon: g,
    deltaW: d,
    bound: w.evaluation,
    best: u.risk,
    regret: m.risk - u.risk,
    regretBound: w.regret
  };
}
function Ps(t, e, r) {
  const n = M(r, ["ref", "crit"], "withinBand", !0), o = J(t, "withinBand: est"), s = o.length, i = pt(e, s, "withinBand: se");
  if (!i.every((f) => f > 0)) throw new RangeError("withinBand: se must be > 0");
  if (n.ref === void 0 || n.ref === null) throw new RangeError("withinBand: ref is required (one finite number, or one per unit)");
  const a = pt(n.ref, s, "withinBand: ref"), c = n.crit ?? 1;
  if (typeof c != "number" || !Number.isFinite(c) || c < 0) throw new RangeError(`withinBand: crit must be a finite number ≥ 0, got ${String(c)}`);
  let u = 0;
  for (let f = 0; f < s; f += 1) Math.abs((o[f] - a[f]) / i[f]) <= c && (u += 1);
  const l = Hr(c);
  return { within: u, n: s, share: l, expected: s * l };
}
function js(t, e, r) {
  const n = M(r, ["priorSd", "meanSd", "priorMean"], "sharedMeanPosterior", !0), o = J(t, "sharedMeanPosterior: est"), s = o.length, i = pt(e, s, "sharedMeanPosterior: se");
  if (!i.every((A) => A > 0)) throw new RangeError("sharedMeanPosterior: se must be > 0");
  const a = n.priorSd;
  if (typeof a != "number" || !Number.isFinite(a) || !(a > 0))
    throw new RangeError(`sharedMeanPosterior: priorSd must be a finite number > 0 (it is required), got ${String(a)}`);
  const c = n.meanSd ?? Number.POSITIVE_INFINITY;
  if (typeof c != "number" || !(c > 0))
    throw new RangeError(`sharedMeanPosterior: meanSd must be > 0 (Infinity for a flat prior on the mean), got ${String(c)}`);
  const u = n.priorMean ?? 0;
  if (typeof u != "number" || !Number.isFinite(u)) throw new RangeError(`sharedMeanPosterior: priorMean must be a finite number, got ${String(u)}`);
  const l = a * a, f = i.map((A) => l + A * A), h = f.map((A) => l / A);
  let m = 0, g = 0;
  for (let A = 0; A < s; A += 1)
    m += 1 / f[A], g += o[A] / f[A];
  const d = c === Number.POSITIVE_INFINITY, w = c * c, p = 1 / ((d ? 0 : 1 / w) + m), y = p * ((d ? 0 : u / w) + g), E = o.map((A, v) => (1 - h[v]) * y + h[v] * A), k = i.map((A, v) => {
    const $ = 1 - h[v];
    return Math.sqrt(l * (A * A) / f[v] + $ * $ * p);
  }), b = o.map(
    (A, v) => o.map(($, N) => v === N ? 1 : (1 - h[v]) * (1 - h[N]) * p / (k[v] * k[N]))
  );
  return { weight: h, muMean: y, muVar: p, means: E, sds: k, corr: b };
}
function _s(t, e) {
  if (typeof t != "number" || !(t >= 0 && t <= 1)) throw new RangeError(`binomialMcse: e must be a probability in [0, 1], got ${String(t)}`);
  if (typeof e != "number" || !Number.isSafeInteger(e) || e < 1) throw new RangeError(`binomialMcse: S must be an integer ≥ 1, got ${String(e)}`);
  return Math.sqrt(t * (1 - t) / e);
}
function zs(t) {
  const e = M(t, ["p01", "p10", "S", "radius"], "chainCountLaw", !0), { p01: r, p10: n } = Oe(e, "chainCountLaw"), o = e.S;
  if (typeof o != "number" || !Number.isSafeInteger(o) || o < 1 || o > 5e3) throw new RangeError(`chainCountLaw: S must be an integer in 1..5000, got ${String(o)}`);
  const s = e.radius ?? null;
  if (s !== null && (typeof s != "number" || !Number.isFinite(s) || s < 0))
    throw new RangeError(`chainCountLaw: radius must be null or a finite number ≥ 0, got ${String(s)}`);
  const i = r / (r + n), a = 1 - r, c = 1 - n, u = new Float64Array(o + 1), l = new Float64Array(o + 1);
  u[0] = 1 - i, l[1] = i;
  for (let m = 1; m < o; m += 1) {
    for (let g = m; g >= 0; g -= 1) {
      const d = u[g], w = l[g];
      l[g + 1] = d * r + w * c, u[g] = d * a + w * n;
    }
    l[0] = 0;
  }
  const f = new Array(o + 1);
  for (let m = 0; m <= o; m += 1) f[m] = u[m] + l[m];
  let h = null;
  if (s !== null) {
    h = 0;
    for (let m = 0; m <= o; m += 1) Math.abs(m / o - i) > s && (h += f[m]);
  }
  return { pi1: i, probs: f, outside: h };
}
function qs(t) {
  const e = J(t, "runningMean: trace"), r = new Float64Array(e.length);
  let n = 0;
  for (let o = 0; o < e.length; o += 1)
    n += e[o], r[o] = n / (o + 1);
  return r;
}
function vt(t, e) {
  if (t == null || typeof t != "object" || typeof t.length != "number" || t.length < 1) throw new RangeError(`${e} must be a nonempty array`);
  const r = Array.from(t);
  if (!r.every((n) => typeof n == "number" && Number.isFinite(n))) throw new RangeError(`${e} must be finite numbers`);
  return r;
}
function Ge(t, ...e) {
  for (const [r, n] of e) if (r.length !== t) throw new RangeError(`${n} must have ${t} values`);
}
function io(t) {
  const e = t.length;
  let r = 0;
  for (let o = 0; o < e; o += 1) r += t[o];
  let n = r / e;
  if (Number.isFinite(n)) {
    let o = 0;
    for (let s = 0; s < e; s += 1) o += t[s] - n;
    n += o / e;
  }
  return n;
}
function ge(t) {
  const e = vt(t, "values"), r = e.length, n = io(e);
  if (r < 2) return { n: r, mean: n, sd: null };
  let o = 0;
  for (let s = 0; s < r; s += 1) o += (e[s] - n) * (e[s] - n);
  return { n: r, mean: n, sd: Math.sqrt(o / (r - 1)) };
}
function Ks(t, e) {
  const r = vt(t, "a"), n = vt(e, "b");
  Ge(r.length, [n, "b"]);
  const o = new q();
  for (let s = 0; s < r.length; s += 1) o.add((r[s] - n[s]) * (r[s] - n[s]));
  return o.value / r.length;
}
function Ds(t, e, r) {
  const n = vt(t, "estimates"), o = vt(e, "posteriorMeans"), s = vt(r, "truth");
  Ge(n.length, [o, "posteriorMeans"], [s, "truth"]);
  const i = n.map((c, u) => Math.abs(o[u] - s[u]) > Math.abs(c - s[u])), a = i.flatMap((c, u) => c ? [u] : []);
  return { count: a.length, flags: i, units: a };
}
function Bs(t, e, r, n = {}) {
  n = M(n, ["threshold"], "intervalOverlapTally");
  const o = vt(t, "lower"), s = vt(e, "upper"), i = o.length;
  if (i < 2) throw new RangeError("intervalOverlapTally needs at least two units");
  Ge(i, [s, "upper"]), o.forEach((d, w) => {
    if (!(d <= s[w])) throw new RangeError(`lower[${w}] must be ≤ upper[${w}]`);
  });
  const a = n.threshold ?? 0.9;
  if (typeof a != "number" || !(a >= 0 && a <= 1)) throw new RangeError("threshold must lie in [0, 1]");
  if (r == null || typeof r != "object" || r.length !== i) throw new RangeError(`pi must be an ${i} × ${i} matrix`);
  const c = (d, w) => {
    const p = r[d];
    if (p == null || typeof p != "object" || p.length !== i) throw new RangeError(`pi must be an ${i} × ${i} matrix`);
    const y = p[w];
    if (typeof y != "number" || !(y >= 0 && y <= 1)) throw new RangeError(`pi[${d}][${w}] must be a probability`);
    return y;
  }, u = [];
  let l = 0, f = 0, h = 0, m = 0, g = null;
  for (let d = 0; d < i; d += 1)
    for (let w = d + 1; w < i; w += 1) {
      const p = c(d, w), y = c(w, d), [E, k, b] = p >= y ? [d, w, p] : [w, d, y], A = Math.max(o[d], o[w]) < Math.min(s[d], s[w]), v = A ? b > a ? "high" : "low" : "apart";
      v === "apart" ? l += 1 : v === "high" ? f += 1 : h += 1;
      const $ = Math.min(s[d], s[w]) - Math.max(o[d], o[w]), N = o[d] <= o[w] && s[w] <= s[d] || o[w] <= o[d] && s[d] <= s[w];
      N && (m += 1), u.push({ i: d, j: w, first: E, second: k, pi: b, overlap: A, class: v, amount: $, nested: N }), A && (g === null || b > g.pi) && (g = { i: d, j: w, first: E, second: k, pi: b });
    }
  return { n: i, M: i * (i - 1) / 2, threshold: a, apart: l, overlapping: f + h, high: f, low: h, pairs: u, best: g, nestedCount: m };
}
function Vs(t, e = {}) {
  e = M(e, ["level", "tieTol"], "rankIntervals");
  const r = e.level ?? 0.9;
  if (typeof r != "number" || !(r > 0 && r < 1)) throw new RangeError("level must lie in (0, 1)");
  const n = e.tieTol ?? 1e-12;
  if (typeof n != "number" || !(n >= 0)) throw new RangeError("tieTol must be ≥ 0");
  if (t == null || typeof t != "object" || typeof t.length != "number" || t.length < 1)
    throw new RangeError("pTop must be a nonempty array of rows");
  const o = t.length, s = Array.from({ length: o }, (h, m) => vt(t[m], `pTop[${m}]`)), i = s[0].length;
  s.forEach((h, m) => {
    if (h.length !== i) throw new RangeError(`pTop[${m}] must have ${i} values`);
  });
  const a = (1 - r) / 2, c = a - n, u = 1 - a - n, l = new Array(i).fill(null), f = new Array(i).fill(null);
  for (let h = 0; h < o; h += 1)
    for (let m = 0; m < i; m += 1)
      l[m] === null && s[h][m] >= c && (l[m] = h + 1), f[m] === null && s[h][m] >= u && (f[m] = h + 1);
  return { level: r, tail: a, lower: l, upper: f };
}
function Ls(t, e) {
  if (!Number.isInteger(t) || t < 2 || t > 30 || !Number.isInteger(e) || e < 1 || e > t)
    throw new RangeError("tierSizeDistribution: integer n in2..30 and G in1..n required");
  let r = /* @__PURE__ */ new Map([[0, /* @__PURE__ */ new Map([[0, 1]])]]);
  for (let u = 1; u <= e; u += 1) {
    const l = /* @__PURE__ */ new Map();
    for (const [f, h] of r) for (let m = 1; m <= t - f - (e - u); m += 1) {
      const g = f + m, d = m * (m - 1) / 2;
      let w = l.get(g);
      w || (w = /* @__PURE__ */ new Map(), l.set(g, w));
      for (const [p, y] of h) w.set(p + d, (w.get(p + d) ?? 0) + y);
    }
    r = l;
  }
  const n = Ot(t), o = r.get(t), s = Array.from(o.values()).reduce((u, l) => u + l, 0), i = Array.from(o, ([u, l]) => ({ N: n - u, withheld: u, count: l, probability: l / s })).sort((u, l) => u.N - l.N), a = Array.from({ length: e }, (u, l) => Math.floor(t / e) + (l < t % e ? 1 : 0)), c = i[i.length - 1].N;
  return { n: t, G: e, M: n, totalPatterns: s, distribution: i, maxN: c, maxShare: c / n, balancedSizes: a };
}
function Ws(t, e) {
  const r = -pe(t, e, { lambda: 1 });
  return r === 0 ? 0 : r;
}
function Us(t, e) {
  const r = M(e, ["tau", "w", "details"], "thresholdViolations", !0);
  if (!Number.isFinite(r.tau) || r.tau < 0 || r.tau > 0.5) throw new RangeError("thresholdViolations: tau must be in[0,.5]");
  if (r.details !== void 0 && typeof r.details != "boolean") throw new TypeError("thresholdViolations: details must be boolean");
  const n = Zn(t, r.w), o = n.length, s = Ot(o), i = Array.from({ length: o }, () => Array(o).fill(0)), a = [], c = Array(o).fill(0);
  for (let d = 0; d < o; d += 1) for (let w = d + 1; w < o; w += 1) {
    const p = n[d][w] < r.tau, y = n[w][d] < r.tau;
    if (p && y) throw new RangeError("thresholdViolations: both directions qualify for one pair");
    const E = p ? 1 : y ? -1 : 0;
    if (i[d][w] = E, i[w][d] = -E, E) {
      const k = p ? d : w;
      a.push({ above: k, below: p ? w : d, error: p ? n[d][w] : n[w][d] }), c[k] += 1;
    }
  }
  const u = { twoWithheld: 0, statedChain: 0, directedCycle: 0 }, l = r.details ? [] : null, f = Array(o).fill(0), h = Array.from({ length: o }, () => Array(o).fill(0));
  let m = 0, g = 0;
  for (let d = 0; d < o; d += 1) for (let w = d + 1; w < o; w += 1) for (let p = w + 1; p < o; p += 1) {
    m += 1;
    const y = i[d][w], E = i[w][p], k = i[d][p], b = +(y !== 0) + +(E !== 0) + +(k !== 0);
    let A = null;
    if (b === 1 ? A = "twoWithheld" : b === 2 ? (k === 0 && y === E || E === 0 && y === -k || y === 0 && E === -k) && (A = "statedChain") : b === 3 && y === E && y === -k && (A = "directedCycle"), A !== null) {
      g += 1, u[A] += 1, l?.push({ i: d, j: w, k: p, kind: A });
      for (const v of [d, w, p]) f[v] += 1;
      for (const [v, $] of [[d, w], [d, p], [w, p]])
        h[v][$] += 1, h[$][v] += 1;
    }
  }
  return { n: o, M: s, tau: r.tau, relation: i, statedPairs: a, statedCount: a.length, aboveCounts: c, triples: m, invalidCount: g, counts: u, printable: g === 0, unitIncidence: f, pairIncidence: h, violations: l };
}
function Ys(t, e, r, n) {
  const o = M(n, ["tau", "w", "tieTol"], "compareReportLosses", !0), s = o.tieTol ?? 1e-12;
  if (!Number.isFinite(s) || s < 0) throw new RangeError("compareReportLosses: tieTol must be finite and nonnegative");
  if (!Array.isArray(r) || r.length < 1) throw new RangeError("compareReportLosses: nonempty whole-state draws required");
  const i = X(t), a = X(e, i.length), c = [], u = [];
  for (const d of r) {
    const w = Ar([d]);
    c.push(U(i, w, { tau: o.tau, w: o.w }).risk), u.push(U(a, w, { tau: o.tau, w: o.w }).risk);
  }
  const l = u.map((d, w) => d - c[w]), f = r.length, h = l.filter((d) => d < -s).length, m = l.filter((d) => d > s).length, g = f - h - m;
  return {
    lossBest: c,
    lossRule: u,
    delta: l,
    meanBest: ge(c).mean,
    meanRule: ge(u).mean,
    meanDelta: ge(l).mean,
    mcseDelta: ro(l),
    ruleWins: h,
    bestWins: m,
    ties: g,
    ruleWinShare: h / f,
    bestWinShare: m / f,
    tieShare: g / f,
    S: f,
    tieTol: s
  };
}
function Hs(t, e) {
  const r = M(e, ["values", "pTop", "budget"], "allocationValue", !0), n = X(t), o = n.length, s = r.budget;
  if (!Array.isArray(r.values) || r.values.length !== o || !r.values.every(Number.isFinite)) throw new RangeError("allocationValue: n finite values required");
  if (!Array.isArray(r.pTop) || r.pTop.length !== o || !r.pTop.every((m) => Number.isFinite(m) && m >= 0 && m <= 1)) throw new RangeError("allocationValue: n probabilities in[0,1] required");
  if (!Number.isInteger(s) || s < 0 || s > o) throw new RangeError("allocationValue: integer budget in0..n required");
  if (Math.abs(r.pTop.reduce((m, g) => m + g, 0) - s) > 1e-10 * Math.max(1, o)) throw new RangeError("allocationValue: exact-cardinality pTop must sum to budget");
  const i = Array(o).fill(0);
  let a = null, c = [], u = 0, l = 0;
  if (s > 0) for (let m = 1; m <= Math.max(...n); m += 1) {
    const g = n.flatMap((d, w) => d === m ? [w] : []);
    if (l + g.length >= s) {
      a = m, c = g, u = s - l;
      for (const d of g) i[d] = u / g.length;
      break;
    }
    for (const d of g) i[d] = 1;
    l += g.length;
  }
  const f = i.reduce((m, g, d) => m + g * r.values[d], 0), h = i.reduce((m, g, d) => m + g * r.pTop[d], 0);
  return {
    inclusion: i,
    expectedValue: f,
    expectedOverlap: h,
    overlapShare: s === 0 ? null : h / s,
    selectedCount: i.reduce((m, g) => m + g, 0),
    budget: s,
    boundaryGrade: a,
    boundaryMembers: c,
    boundarySize: c.length,
    remaining: u,
    aboveCount: l
  };
}
function Zs(t, e) {
  const r = M(e, ["falsePositiveCost", "falseNegativeCost", "positive", "values"], "thresholdClassification", !0);
  if (!Array.isArray(t) || !t.length || !t.every((g) => Number.isFinite(g) && g >= 0 && g <= 1)) throw new RangeError("thresholdClassification: nonempty probabilities in[0,1] required");
  const n = r.falsePositiveCost, o = r.falseNegativeCost;
  if (!Number.isFinite(n) || !Number.isFinite(o) || n < 0 || o < 0 || !Number.isFinite(n + o) || n + o <= 0) throw new RangeError("thresholdClassification: finite nonnegative costs with positive sum required");
  const s = n / (n + o), i = t.map((g) => g >= s);
  if (r.positive !== void 0 && (!Array.isArray(r.positive) || r.positive.length !== t.length || !r.positive.every((g) => typeof g == "boolean" || g === 0 || g === 1))) throw new RangeError("thresholdClassification: positive must be a matching boolean or0/1 vector");
  const a = r.positive === void 0 ? i.slice() : r.positive.map(Boolean);
  if (r.values !== void 0 && (!Array.isArray(r.values) || r.values.length !== t.length || !r.values.every(Number.isFinite))) throw new RangeError("thresholdClassification: values must be matching finite values");
  const c = r.values === void 0 ? null : r.values.reduce((g, d, w) => g + (a[w] ? d : 0), 0), u = t.map((g) => n * (1 - g)), l = t.map((g) => o * g), f = t.reduce((g, d, w) => g + (a[w] ? 1 - d : 0), 0), h = t.reduce((g, d, w) => g + (a[w] ? 0 : d), 0), m = n * f + o * h;
  return {
    positive: a,
    bayesPositive: i,
    positiveCount: a.filter(Boolean).length,
    cutoff: s,
    positiveCost: u,
    negativeCost: l,
    expectedFalsePositives: f,
    expectedFalseNegatives: h,
    totalCost: m,
    meanCost: m / t.length,
    selectedValue: c
  };
}
function nr(t, e) {
  if (!Array.isArray(t) || t.length < 2) throw new RangeError(`${e} must be a rectangular array with at least two units`);
  const r = t[0]?.length;
  if (!Number.isSafeInteger(r) || r < 1) throw new RangeError(`${e} must have at least one criterion per unit`);
  for (let n = 0; n < t.length; n += 1) {
    const o = t[n];
    if (o === null || typeof o != "object" || o.length !== r) throw new RangeError(`${e}[${n}] must have ${r} criterion values`);
    for (let s = 0; s < r; s += 1)
      if (typeof o[s] != "number" || !Number.isFinite(o[s])) throw new RangeError(`${e} must contain finite numbers only`);
  }
  return { n: t.length, K: r };
}
function or(t, e, r) {
  const n = t === void 0 ? e : t;
  if (typeof n != "number" || !Number.isFinite(n) || n < 0) throw new RangeError(`${r} must be a finite number ≥ 0`);
  return n;
}
function Qs(t, e, r) {
  const n = M(r, ["a", "multiplier", "ids"], "normalComposite", !0), { n: o, K: s } = nr(t, "means"), i = nr(e, "sds");
  if (i.n !== o || i.K !== s) throw new RangeError(`sds must be ${o} units × ${s} criteria, as means`);
  const a = n.a;
  if (!Array.isArray(a) || a.length !== s || !a.every((m) => typeof m == "number" && Number.isFinite(m)))
    throw new RangeError(`a must hold ${s} finite composite coefficients`);
  const c = n.multiplier === void 0 ? new Array(s).fill(1) : n.multiplier;
  if (!Array.isArray(c) || c.length !== s || !c.every((m) => typeof m == "number" && Number.isFinite(m) && m > 0))
    throw new RangeError(`multiplier must hold ${s} finite positive multipliers`);
  const { ids: u } = It({ ids: n.ids }, o, 1), l = [], f = [];
  for (let m = 0; m < o; m += 1) {
    const g = new q(), d = new q();
    for (let w = 0; w < s; w += 1) {
      if (e[m][w] < 0) throw new RangeError("sds must contain SDs ≥ 0");
      const p = a[w] * c[w];
      g.add(p * t[m][w]);
      const y = p * e[m][w];
      d.add(y * y);
    }
    if (l.push(g.value), f.push(Math.sqrt(d.value)), !Number.isFinite(l[m]) || !Number.isFinite(f[m])) throw new RangeError("normalComposite: composite mean and SD must remain finite");
  }
  const h = Nt(o);
  for (let m = 0; m < o; m += 1)
    for (let g = 0; g < o; g += 1) {
      if (m === g) continue;
      const d = Math.hypot(f[m], f[g]);
      h[m][g] = d === 0 ? +(l[m] <= l[g]) : At((l[g] - l[m]) / d);
    }
  return { mean: l, sd: f, E: { ids: u, criteria: ["composite"], e: [h] } };
}
function Xs(t, e, r, n) {
  const o = M(n, ["tau", "w"], "compareReports", !0), { n: s, K: i, e: a } = tt(r), c = Y(o.tau), u = Q(o.w, i), l = X(t, s), f = X(e, s), h = U(l, r, { tau: c, w: u }), m = U(f, r, { tau: c, w: u }), g = [], d = (w, p, y) => w === 0 ? c : w > 0 ? rt(a, u, p, y) : rt(a, u, y, p);
  for (let w = 0; w < s; w += 1)
    for (let p = w + 1; p < s; p += 1) {
      const y = Math.sign(l[p] - l[w]), E = Math.sign(f[p] - f[w]);
      if (y === E) continue;
      const k = d(y, w, p), b = d(E, w, p), A = b - k;
      g.push({ i: w, j: p, beforeRelation: y, afterRelation: E, beforeCost: k, afterCost: b, costDifference: A, normalizedDifference: A / h.M });
    }
  return {
    before: h,
    after: m,
    deltaRisk: m.risk - h.risk,
    errorTermDelta: (m.Ew - h.Ew) / h.M,
    withholdingTermDelta: c * (h.N - m.N) / h.M,
    change: In(l, f, r, { w: u }),
    pairs: g
  };
}
function Js(t, e, r) {
  const n = M(r, ["q", "epsilon", "family", "tau", "w", "feasibilityTol", "coefficientTol"], "protectionEnvelopes", !0), o = tt(t, "Ehat"), s = tt(e, "Eexact"), { n: i, K: a } = o;
  if (s.n !== i || s.K !== a) throw new RangeError("Ehat and Eexact must have matching dimensions");
  for (const [R, O] of [[t, "Ehat"], [e, "Eexact"]]) {
    if (!Array.isArray(R.ids) || !Array.isArray(R.criteria)) throw new RangeError(`${O} must have ids and criteria arrays`);
    if (!Array.from(R.ids).every((P) => typeof P == "string") || !Array.from(R.criteria).every((P) => typeof P == "string"))
      throw new RangeError(`${O} ids and criteria must be strings`);
    It({ ids: R.ids, criteria: R.criteria }, i, a);
    for (let P = 0; P < a; P += 1)
      for (let L = 0; L < i; L += 1)
        for (let B = 0; B < i; B += 1)
          if (L !== B && (R.e[P][L][B] < 0 || R.e[P][L][B] > 1)) throw new RangeError(`${O}.e off-diagonal entries must lie in [0, 1]`);
  }
  if (t.ids.some((R, O) => R !== e.ids[O]) || t.criteria.some((R, O) => R !== e.criteria[O]))
    throw new RangeError("Ehat and Eexact must have matching ids and criteria in the same order");
  const c = Y(n.tau), u = Q(n.w, a);
  if (!Array.isArray(n.q) || n.q.length !== a) throw new RangeError(`q must hold ${a} protection thresholds (null for none)`);
  const l = Array.from(n.q, (R, O) => {
    if (R === null) return null;
    if (typeof R != "number" || !Number.isFinite(R) || R < 0 || R > 1) throw new RangeError(`q[${O}] must lie in [0, 1], or be null`);
    return R;
  }), f = typeof n.epsilon == "number" ? new Array(a).fill(n.epsilon) : n.epsilon;
  if (!Array.isArray(f) || f.length !== a || !Array.from(f).every((R) => typeof R == "number" && Number.isFinite(R) && R >= 0))
    throw new RangeError(`epsilon must be a finite nonnegative scalar or ${a} finite nonnegative radii`);
  const h = [...f], m = or(n.feasibilityTol, 0, "feasibilityTol"), g = or(n.coefficientTol, 1e-12, "coefficientTol"), d = l.map((R, O) => R === null ? null : R - h[O]), w = l.map((R, O) => R === null ? null : R + h[O]), p = n.family ?? { kind: "all" }, y = ut(i, p);
  mt(i, y, p);
  const E = new Array(a).fill(0);
  for (let R = 0; R < a; R += 1)
    for (let O = 0; O < i; O += 1)
      for (let P = 0; P < i; P += 1)
        O !== P && (E[R] = Math.max(E[R], Math.abs(o.e[R][O][P] - s.e[R][O][P])));
  const k = E.map((R, O) => R - h[O]), b = {
    maxAbs: E,
    excess: k,
    strictEnvelopeHolds: k.every((R) => R <= 0),
    withinCoefficientTolerance: k.every((R) => R <= g),
    coefficientTol: g
  }, A = [], v = { inner: 0, nominal: 0, exact: 0, outer: 0 }, $ = {
    innerSubsetExact: !0,
    exactSubsetOuter: !0,
    innerSubsetNominal: !0,
    nominalSubsetOuter: !0,
    counterexampleInnerExact: null,
    counterexampleExactOuter: null
  };
  if (y.sizeExact !== 0n) {
    const R = dt(i, p, []);
    for (; R.next(); ) {
      const O = Array.from(R.g), P = U(O, t, { tau: c, w: u }), L = U(O, e, { tau: c, w: u }), B = P.N, H = (F, K) => F.map((j, V) => j === null ? null : j * B - K[V]), et = {
        inner: H(d, P.E),
        nominal: H(l, P.E),
        exact: H(l, L.E),
        outer: H(w, P.E)
      }, x = (F, K) => F.every((j, V) => j === null || K[V] <= j * B + m), I = {
        inner: x(d, P.E),
        nominal: x(l, P.E),
        exact: x(l, L.E),
        outer: x(w, P.E)
      };
      for (const F of ["inner", "nominal", "exact", "outer"]) I[F] && (v[F] += 1);
      I.inner && !I.exact && ($.innerSubsetExact = !1, $.counterexampleInnerExact === null && ($.counterexampleInnerExact = [...O])), I.exact && !I.outer && ($.exactSubsetOuter = !1, $.counterexampleExactOuter === null && ($.counterexampleExactOuter = [...O])), I.inner && !I.nominal && ($.innerSubsetNominal = !1), I.nominal && !I.outer && ($.nominalSubsetOuter = !1), A.push({ grade: O, N: B, estimated: P, exact: L, membership: I, slack: et });
    }
  }
  const N = { inner: v.inner === 0, nominal: v.nominal === 0, exact: v.exact === 0, outer: v.outer === 0 };
  return { family: y, tau: c, w: u, q: l, epsilon: h, innerThreshold: d, outerThreshold: w, feasibilityTol: m, coefficientCheck: b, actualBracketInclusions: $, counts: v, empty: N, rows: A };
}
const ti = "0.1.0";
export {
  Tn as ENUMERATION_BUDGET,
  oe as LEAGUE_SEED,
  yt as MINUS,
  lt as NA,
  Le as NO_DISCLOSURE,
  Un as ORDER_HULL_BUDGET,
  ti as PR_CORE_VERSION,
  Hs as allocationValue,
  Zo as bestReports,
  xo as betweenGradeErrors,
  _s as binomialMcse,
  fs as budgetCheck,
  us as budgetFamily,
  Ct as canonicalGrade,
  zs as chainCountLaw,
  Fs as chainMeanVariance,
  jo as claimsByDistance,
  cs as commonalityCost,
  Ys as compareReportLosses,
  Xs as compareReports,
  Co as confidentPairs,
  as as conflictPairs,
  hs as criterionMixtureRisk,
  Lo as cutGrade,
  vo as directionMatrix,
  Nn as disclosedErrorEstimands,
  _o as disclosure,
  Ar as drawErrors,
  Se as drawLeague,
  tr as enumerateReports,
  Ms as envelopeRadius,
  Oo as equalityNeutralRisk,
  lo as erfc,
  pn as errorArray,
  ls as estimandCosts,
  U as evaluateReport,
  ds as evidenceFlags,
  kt as exactOptimum,
  Es as expectedMisorderedPairs,
  ps as expectedRank,
  Ss as expectedSquaredDistance,
  eo as extremeCounts,
  Do as familySize,
  Ds as fartherCount,
  To as finiteLawCells,
  As as finiteLawDraws,
  Ro as finiteLawMargins,
  bn as finiteLawPairwise,
  Ln as fixedOrderDP,
  jt as formatCount,
  mr as formatDecimal,
  mo as formatEoverN,
  Ee as formatFraction,
  bo as formatGrades,
  ho as formatPercent,
  gr as formatProb,
  un as formatRatio,
  go as formatRational,
  uo as formatRisk,
  fo as formatSci,
  po as formatSetting,
  pr as formatSig,
  wo as formatSigned,
  yo as formatSizes,
  Eo as formatTuple,
  Is as fragilePairs,
  $s as gaussianDraws,
  os as halfSlopeEligible,
  Bs as intervalOverlapTally,
  Qo as krwBridgeParameters,
  Xo as krwCorrespondence,
  ks as krwExample1Band,
  pe as krwRisk,
  vn as lambdaToTau,
  Go as largestStatedError,
  se as league30,
  Cs as leagueGradingReplays,
  Ts as leagueOvershoot,
  vs as leagueReplays,
  $o as leastCertainPairs,
  ts as lowerHull,
  ko as majorityWins,
  rs as matchedDisclosure,
  En as maxCoefficientError,
  ro as mcse,
  Ks as meanSquaredDistance,
  ms as minimaxChoice,
  Jn as misorderedPairs,
  Ao as mixturePairDirection,
  At as normalCdf,
  Qs as normalComposite,
  Hr as normalCoverage,
  ys as normalInterval,
  co as normalPdf,
  xe as normalPosterior,
  ye as normalQuantile,
  Zr as normalSf,
  an as normalStream,
  te as normals,
  ns as orderHull,
  Mo as pairCertainty,
  Wo as pairConstrainedOptimum,
  Ot as pairCount,
  Ze as pairDecision,
  Io as pairDifference,
  dn as pairDirection,
  Js as protectionEnvelopes,
  Vs as rankIntervals,
  Ns as rankSummaries,
  Rs as rankSummariesMC,
  ve as rationalApprox,
  Nr as realizedWrong,
  so as regretBound,
  In as relationChange,
  zo as relations,
  So as relaxedPairRisk,
  Bo as reportCardRows,
  Jo as reportCloud,
  Ws as reportInformation,
  ss as reportsAtN,
  ur as rng,
  sn as rngUint32,
  is as ruleGap,
  qs as runningMean,
  Mn as scoreOrder,
  Gs as selectionOnDraws,
  js as sharedMeanPosterior,
  bs as simulateEstimates,
  Fo as statedAbove,
  Vo as statedAgainst,
  Xn as strictOrder,
  ge as summaryStats,
  es as supportingVertex,
  Uo as tauPath,
  An as tauToLambda,
  Zs as thresholdClassification,
  Us as thresholdViolations,
  No as tieLawPairwise,
  gs as tierGrades,
  Ls as tierSizeDistribution,
  to as topKOverlap,
  no as topKOvershoot,
  Os as transformedMeans,
  xs as twoStateChain,
  fr as uniforms,
  qo as unitRelationCounts,
  Ko as weakRelation,
  Ho as weightBreakpoints,
  ws as weightCrossing,
  Yo as weightPath,
  Zn as weightedError,
  oo as weightedRadius,
  Ps as withinBand,
  Po as wrongCountDistribution
};
