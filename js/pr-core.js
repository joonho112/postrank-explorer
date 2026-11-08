var Nr = Object.defineProperty;
var $r = (t, e, n) => e in t ? Nr(t, e, { enumerable: !0, configurable: !0, writable: !0, value: n }) : t[e] = n;
var z = (t, e, n) => $r(t, typeof e != "symbol" ? e + "" : e, n);
const kr = Object.freeze({ scale: "multiplier", tol: "tieTol" });
function Rr(t) {
  return typeof t == "string" ? JSON.stringify(t) : Array.isArray(t) ? "an array" : ArrayBuffer.isView(t) ? "a typed array" : String(t);
}
function R(t, e, n, r = !1) {
  const o = `{${e.join(", ")}}`;
  if (t == null) {
    if (r) throw new TypeError(`${n}: options object expected: ${o}`);
    return {};
  }
  if (typeof t != "object" || Array.isArray(t) || ArrayBuffer.isView(t))
    throw new TypeError(`${n}: options object expected: ${o}, got ${Rr(t)}`);
  for (const i of Object.keys(t))
    if (!e.includes(i)) {
      const s = kr[i], a = s !== void 0 && e.includes(s) ? ` (it is now called ${s})` : "";
      throw new TypeError(`${n}: unknown option "${i}"${a}; the options are ${o}`);
    }
  return t;
}
function Dt(t, e, n) {
  for (const r of Object.keys(t))
    if (!e.includes(r)) throw new TypeError(`${n}: unknown key "${r}"; the keys are {${e.join(", ")}}`);
}
const xr = 2n ** 53n;
function jn(t) {
  return t <= xr ? Number(t) : t.toString();
}
function Gn(t, e, n) {
  return Object.defineProperty(t, e, { value: n, enumerable: !1, writable: !1, configurable: !0 }), t;
}
function re(t, e, n = `${e}s`) {
  return String(t) === "1" ? e : n;
}
function Ot(t, e) {
  const n = t ?? 100;
  if (typeof n != "number" || !(n === Number.POSITIVE_INFINITY || Number.isSafeInteger(n) && n >= 1))
    throw new RangeError(`${e}: maxTies must be a positive integer (or Infinity), got ${String(n)}`);
  return n;
}
const Mr = 5.656854249492381, _e = 0.3989422804014327, On = Number.EPSILON * 0.5, me = 16, Re = [2.2352520354606837, 161.02823106855587, 1067.6894854603709, 18154.98125334356, 0.06568233791820745], sn = [47.202581904688245, 976.0985517377767, 10260.932208618979, 45507.78933502673], xe = [
  0.39894151208813466,
  8.883149794388377,
  93.50665613217785,
  597.2702763948002,
  2494.5375852903726,
  6848.190450536283,
  11602.65143764735,
  9842.714838383978,
  10765576773720192e-24
], an = [
  22.266688044328117,
  235.387901782625,
  1519.3775994075547,
  6485.558298266761,
  18615.571640885097,
  34900.95272114598,
  38912.00328609327,
  19685.429676859992
], Me = [0.215898534057957, 0.12740116116024736, 0.022235277870649807, 0.0014216191932278934, 29112874951168793e-21, 0.023073441764940174], cn = [1.284260096144911, 0.4682382124808651, 0.06598813786892856, 0.0037823963320275824, 7297515550839662e-20], ze = 37.5193, Pn = 8.2924;
function _n(t) {
  const e = Math.abs(t);
  if (e <= 0.67448975) {
    let r = 0, o = 0;
    if (e > On) {
      const s = t * t;
      r = Re[4] * s, o = s;
      for (let a = 0; a < 3; a += 1)
        r = (r + Re[a]) * s, o = (o + sn[a]) * s;
    }
    const i = t * (r + Re[3]) / (o + sn[3]);
    return [0.5 + i, 0.5 - i];
  }
  let n;
  if (e <= Mr) {
    let r = xe[8] * e, o = e;
    for (let s = 0; s < 7; s += 1)
      r = (r + xe[s]) * e, o = (o + an[s]) * e;
    const i = (r + xe[7]) / (o + an[7]);
    n = ln(e) * i;
  } else if (e < ze) {
    const r = 1 / (t * t);
    let o = Me[5] * r, i = r;
    for (let a = 0; a < 4; a += 1)
      o = (o + Me[a]) * r, i = (i + cn[a]) * r;
    let s = r * (o + Me[4]) / (i + cn[4]);
    s = (_e - s) / e, n = ln(t) * s;
  } else
    n = 0;
  return t > 0 ? [1 - n, n] : [n, 1 - n];
}
function ln(t) {
  const e = Math.trunc(t * me) / me, n = (t - e) * (t + e);
  return Math.exp(-e * (e * 0.5)) * Math.exp(-(n * 0.5));
}
function St(t) {
  return Number.isNaN(t) ? Number.NaN : t <= -ze ? 0 : t >= Pn ? 1 : _n(t)[0];
}
function Sr(t) {
  if (typeof t != "number" || !(t >= 0)) throw new RangeError(`normalCoverage: k must be a number ≥ 0 (or Infinity), got ${String(t)}`);
  return t === Number.POSITIVE_INFINITY ? 1 : St(t) - St(-t);
}
function Tr(t) {
  return Number.isNaN(t) ? Number.NaN : t >= ze ? 0 : t <= -Pn ? 1 : _n(t)[1];
}
const Fr = Math.sqrt(-2 * Math.LN2 * -1073), un = 65536;
function si(t) {
  if (Number.isNaN(t)) return Number.NaN;
  const e = Math.abs(t);
  if (e === 1 / 0) return 0;
  if (e < 5) return _e * Math.exp(-0.5 * e * e);
  if (e > Fr) return 0;
  const n = Cr(e * un) / un, r = e - n;
  return _e * (Math.exp(-0.5 * n * n) * Math.exp((-0.5 * r - n) * r));
}
function Cr(t) {
  const e = Math.floor(t), n = t - e;
  return n > 0.5 ? e + 1 : n < 0.5 || e % 2 === 0 ? e : e + 1;
}
function De(t, e = {}) {
  const n = R(e, ["lowerTail"], "normalQuantile").lowerTail ?? !0;
  if (Number.isNaN(t) || t < 0 || t > 1) return Number.NaN;
  if (t === 0) return n ? -1 / 0 : 1 / 0;
  if (t === 1) return n ? 1 / 0 : -1 / 0;
  const o = (n ? t : 0.5 - t + 0.5) - 0.5;
  if (Math.abs(o) <= 0.425) {
    const c = 0.180625 - o * o;
    return o * (((((((c * 2509.0809287301227 + 33430.57558358813) * c + 67265.7709270087) * c + 45921.95393154987) * c + 13731.69376550946) * c + 1971.5909503065513) * c + 133.14166789178438) * c + 3.3871328727963665) / (((((((c * 5226.495278852546 + 28729.085735721943) * c + 39307.89580009271) * c + 21213.794301586597) * c + 5394.196021424751) * c + 687.1870074920579) * c + 42.31333070160091) * c + 1);
  }
  let i;
  n ? i = o > 0 ? 0.5 - t + 0.5 : t : i = o > 0 ? t : 0.5 - t + 0.5;
  let s = Math.sqrt(-Math.log(i)), a;
  return s <= 5 ? (s -= 1.6, a = (((((((s * 7745450142783414e-19 + 0.022723844989269184) * s + 0.2417807251774506) * s + 1.2704582524523684) * s + 3.6478483247632045) * s + 5.769497221460691) * s + 4.630337846156546) * s + 1.4234371107496835) / (((((((s * 10507500716444169e-25 + 5475938084995345e-19) * s + 0.015198666563616457) * s + 0.14810397642748008) * s + 0.6897673349851) * s + 1.6763848301838038) * s + 2.053191626637759) * s + 1)) : (s -= 5, a = (((((((s * 20103343992922881e-23 + 27115555687434876e-21) * s + 0.0012426609473880784) * s + 0.026532189526576124) * s + 0.29656057182850487) * s + 1.7848265399172913) * s + 5.463784911164114) * s + 6.657904643501103) / (((((((s * 20442631033899397e-31 + 1421511758316446e-22) * s + 18463183175100548e-21) * s + 7868691311456133e-19) * s + 0.014875361290850615) * s + 0.1369298809227358) * s + 0.599832206555888) * s + 1)), o < 0 ? -a : a;
}
const Se = [3.1611237438705655, 113.86415415105016, 377.485237685302, 3209.3775891384694, 0.18577770618460315], fn = [23.601290952344122, 244.02463793444417, 1282.6165260773723, 2844.236833439171], Te = [
  0.5641884969886701,
  8.883149794388377,
  66.11919063714163,
  298.6351381974001,
  881.952221241769,
  1712.0476126340707,
  2051.0783778260716,
  1230.3393547979972,
  21531153547440383e-24
], mn = [
  15.744926110709835,
  117.6939508913125,
  537.1811018620099,
  1621.3895745666903,
  3290.7992357334597,
  4362.619090143247,
  3439.3676741437216,
  1230.3393548037495
], Fe = [0.30532663496123236, 0.36034489994980445, 0.12578172611122926, 0.016083785148742275, 6587491615298378e-19, 0.016315387137302097], dn = [2.568520192289822, 1.8729528499234673, 0.5279051029514285, 0.06051834131244132, 0.0023352049762686918], jr = 0.5641895835477563, Gr = 26.543;
function ai(t) {
  if (Number.isNaN(t)) return Number.NaN;
  const e = Math.abs(t);
  let n;
  if (e <= 0.46875) {
    let r = 0;
    e > On && (r = e * e);
    let o = Se[4] * r, i = r;
    for (let s = 0; s < 3; s += 1)
      o = (o + Se[s]) * r, i = (i + fn[s]) * r;
    return 1 - t * (o + Se[3]) / (i + fn[3]);
  }
  if (e <= 4) {
    let r = Te[8] * e, o = e;
    for (let i = 0; i < 7; i += 1)
      r = (r + Te[i]) * e, o = (o + mn[i]) * e;
    n = (r + Te[7]) / (o + mn[7]), n *= hn(e);
  } else if (e >= Gr)
    n = 0;
  else {
    const r = 1 / (e * e);
    let o = Fe[5] * r, i = r;
    for (let s = 0; s < 4; s += 1)
      o = (o + Fe[s]) * r, i = (i + dn[s]) * r;
    n = r * (o + Fe[4]) / (i + dn[4]), n = (jr - n) / e, n *= hn(e);
  }
  return t < 0 ? 2 - n : n;
}
function hn(t) {
  const e = Math.trunc(t * me) / me, n = (t - e) * (t + e);
  return Math.exp(-e * e) * Math.exp(-n);
}
const Or = 1831565813, Pr = 4294967296, _r = 2 * Math.PI;
function qr(t) {
  if (!Number.isInteger(t)) throw new RangeError(`seed must be an integer, got ${String(t)}`);
  return t >>> 0;
}
function zr(t) {
  let e = qr(t);
  return () => {
    e = e + Or >>> 0;
    let n = e;
    return n = Math.imul(n ^ n >>> 15, n | 1), n ^= n + Math.imul(n ^ n >>> 7, n | 61), (n ^ n >>> 14) >>> 0;
  };
}
function qn(t) {
  const e = zr(t);
  return () => (e() + 0.5) / Pr;
}
function Dr(t) {
  const e = qn(t);
  let n = 0, r = !1;
  return () => {
    if (r)
      return r = !1, n;
    const o = e(), i = e(), s = Math.sqrt(-2 * Math.log(o)), a = _r * i;
    return n = s * Math.sin(a), r = !0, s * Math.cos(a);
  };
}
function zn(t, e) {
  const n = qn(t), r = new Float64Array(Dn(e));
  for (let o = 0; o < r.length; o += 1) r[o] = n();
  return r;
}
function ve(t, e) {
  const n = Dr(t), r = new Float64Array(Dn(e));
  for (let o = 0; o < r.length; o += 1) r[o] = n();
  return r;
}
function Dn(t) {
  if (!Number.isInteger(t) || t < 0) throw new RangeError(`count must be a nonnegative integer, got ${String(t)}`);
  return t;
}
const kt = "−", dt = "NA", gn = "NA: no disclosure";
function ct(t) {
  return typeof t == "number" && Number.isFinite(t);
}
function Jt(t, e, n = 0) {
  if (!Number.isInteger(e) || e < n || e > 100) throw new RangeError(`${t} must be an integer from ${n} to 100, got ${String(e)}`);
  return e;
}
const Ce = new DataView(new ArrayBuffer(8));
function Kr(t, e) {
  if (t === 0) return 0n;
  Ce.setFloat64(0, t);
  const n = Ce.getUint32(0), r = Ce.getUint32(4), o = n >>> 20 & 2047;
  let i = BigInt(n & 1048575) << 32n | BigInt(r), s;
  o === 0 ? s = -1074 : (i |= 1n << 52n, s = o - 1075);
  let a = i, c = 1n;
  s >= 0 ? a <<= BigInt(s) : c <<= BigInt(-s), e >= 0 ? a *= 10n ** BigInt(e) : c *= 10n ** BigInt(-e);
  const u = a / c, l = 2n * (a % c);
  return l > c ? u + 1n : l < c || u % 2n === 0n ? u : u + 1n;
}
function se(t, e) {
  if (e >= 0 && e <= 20 && t < 1e21) {
    const n = t * 2 ** (e + 1), r = Number.isInteger(n) && n % 2 === 1;
    let o = BigInt(t.toFixed(e).replace(".", ""));
    return r && o % 2n === 1n && (o -= 1n), o;
  }
  return Kr(t, e);
}
function de(t) {
  if (t.length <= 3) return t;
  const e = t.length % 3, n = e ? [t.slice(0, e)] : [];
  for (let r = e; r < t.length; r += 3) n.push(t.slice(r, r + 3));
  return n.join(",");
}
function vt(t, e, n, r) {
  if (e <= 0) {
    const a = t === 0n ? "0" : t.toString() + "0".repeat(-e);
    return r ? de(a) : a;
  }
  let o = t.toString();
  o.length <= e && (o = "0".repeat(e - o.length + 1) + o);
  let i = o.slice(0, o.length - e);
  const s = o.slice(o.length - e);
  return i === "0" && !n && (i = ""), (r ? de(i) : i) + "." + s;
}
function ae(t, e, n) {
  return t < 0 && e !== 0n ? kt + n : n;
}
function Kn(t, e = {}) {
  if (e = R(e, ["digits", "leadingZero", "group"], "formatDecimal"), !ct(t)) return dt;
  const n = Jt("digits", e.digits ?? 2);
  if (t === 0) return "0";
  const r = se(Math.abs(t), n);
  return ae(t, r, vt(r, n, e.leadingZero ?? !1, e.group ?? !0));
}
function Bn(t, e, n, r, o = !1) {
  if (r && o && n !== !1 && (t === 0 || t === 1)) {
    const a = n === "symbols";
    return t === 0 ? (a ? "<" : "below ") + vt(1n, e, !1, !0) : (a ? ">" : "above ") + vt(10n ** BigInt(e) - 1n, e, !1, !0);
  }
  if (t === 0) return "0";
  if (r && t === 1) return "1";
  const i = Math.abs(t), s = se(i, e);
  if (n !== !1) {
    const a = n === "symbols";
    if (s === 0n) {
      const c = vt(1n, e, !1, !0);
      return t > 0 ? (a ? "<" : "below ") + c : (a ? ">" + kt : "above " + kt) + c;
    }
    if (r && t > 0 && t < 1 && s === 10n ** BigInt(e))
      return (a ? ">" : "above ") + vt(s - 1n, e, !1, !0);
  }
  return ae(t, s, vt(s, e, !1, !0));
}
function Ln(t, e = {}) {
  if (e = R(e, ["digits", "bounds", "open"], "formatProb"), !ct(t)) return dt;
  const n = e.open ?? !1;
  if (typeof n != "boolean") throw new RangeError(`formatProb: open must be true or false, got ${String(n)}`);
  return Bn(t, Jt("digits", e.digits ?? 3), e.bounds ?? !0, !0, n);
}
function ci(t, e = {}) {
  return e = R(e, ["digits", "bounds"], "formatRisk"), ct(t) ? Bn(t, Jt("digits", e.digits ?? 4), e.bounds ?? !0, !1) : dt;
}
function Vn(t, e) {
  let n = e - 1 - Math.floor(Math.log10(t));
  const r = 10n ** BigInt(e - 1), o = r * 10n;
  for (let i = 0; i < 5; i += 1) {
    const s = se(t, n);
    if (s >= o) n -= 1;
    else if (s < r) n += 1;
    else return { d: n, q: s };
  }
  throw new Error("sigPlaces did not converge");
}
function Wn(t, e = {}) {
  if (e = R(e, ["sig", "leadingZero", "group"], "formatSig"), !ct(t)) return dt;
  const n = Jt("sig", e.sig ?? 3, 1);
  if (t === 0) return "0";
  const { d: r, q: o } = Vn(Math.abs(t), n);
  return ae(t, o, vt(o, r, e.leadingZero ?? !1, e.group ?? !0));
}
const Br = {
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
function li(t, e = {}) {
  if (e = R(e, ["sig", "trim", "style"], "formatSci"), !ct(t)) return dt;
  const n = Jt("sig", e.sig ?? 3, 1);
  if (t === 0) return "0";
  const { d: r, q: o } = Vn(Math.abs(t), n), i = n - 1 - r, s = o.toString();
  let a = s.length > 1 ? `${s[0]}.${s.slice(1)}` : s;
  e.trim && (a = a.replace(/\.?0+$/, ""));
  const c = t < 0 ? kt : "", u = String(Math.abs(i));
  if (e.style === "times") {
    const l = (i < 0 ? "⁻" : "") + [...u].map((f) => Br[f]).join("");
    return `${c}${a} × 10${l}`;
  }
  return `${c}${a}e${i < 0 ? kt : ""}${u}`;
}
function ui(t, e = {}) {
  if (e = R(e, ["digits", "bounds"], "formatPercent"), !ct(t)) return dt;
  const n = Jt("digits", e.digits ?? 0);
  if (t === 0) return "0%";
  if (t === 1) return "100%";
  const r = se(Math.abs(t), n + 2), o = e.bounds ?? !0;
  if (o !== !1 && t > 0 && t < 1) {
    const i = o === "symbols";
    if (r === 0n) return `${i ? "<" : "below "}${vt(1n, n, !0, !0)}%`;
    if (r === 100n * 10n ** BigInt(n)) return `${i ? ">" : "above "}${vt(r - 1n, n, !0, !0)}%`;
  }
  return ae(t, r, vt(r, n, !0, !0)) + "%";
}
function Zt(t) {
  if (typeof t == "bigint") return (t < 0n ? kt : "") + de((t < 0n ? -t : t).toString());
  if (!ct(t)) return dt;
  if (!Number.isInteger(t)) throw new RangeError(`formatCount needs an integer, got ${t}`);
  if (!Number.isSafeInteger(t)) throw new RangeError(`formatCount: ${t} is above 2^53; pass a BigInt`);
  return t === 0 ? "0" : (t < 0 ? kt : "") + de(String(Math.abs(t)));
}
function Lr(t, e, n = {}) {
  return n = R(n, ["digits", "sig", "bounds"], "formatRatio"), !ct(t) || !ct(e) || e === 0 ? dt : Un(t / e, n);
}
function Un(t, e) {
  return e.sig !== void 0 ? Wn(t, { sig: e.sig }) : Ln(t, { digits: e.digits, bounds: e.bounds });
}
function fi(...t) {
  const [e, n, r] = t;
  if (t.length >= 2 && (n === null || typeof n != "object")) {
    const s = R(r, ["digits", "sig", "bounds"], "formatEoverN"), a = n;
    return ct(a) && a === 0 ? gn : Lr(e, a, s);
  }
  const o = R(n, ["digits", "sig", "bounds"], "formatEoverN"), i = (s) => s == null ? gn : ct(s) ? Un(s, o) : dt;
  return e !== null && typeof e == "object" && typeof e.length == "number" ? Array.from(e, i) : i(e);
}
function mi(t, e = {}) {
  if (e = R(e, ["digits", "sig", "leadingZero"], "formatSigned"), !ct(t)) return dt;
  if (t === 0) return "0";
  const n = e.sig !== void 0 ? Wn(Math.abs(t), { sig: e.sig, leadingZero: e.leadingZero }) : Kn(Math.abs(t), { digits: e.digits ?? 3, leadingZero: e.leadingZero });
  return /[1-9]/.test(n) ? (t > 0 ? "+" : kt) + n : n;
}
function wn(t, e) {
  if (typeof e == "bigint") return e;
  if (!Number.isSafeInteger(e)) throw new RangeError(`${t} must be a safe integer or a BigInt, got ${String(e)}`);
  return BigInt(e);
}
function Vr(t, e) {
  for (; e !== 0n; ) [t, e] = [e, t % e];
  return t;
}
function Ke(t, e) {
  let n = wn("num", t), r = wn("den", e);
  if (r === 0n) return dt;
  if (r < 0n && (n = -n, r = -r), n === 0n) return "0";
  const o = n < 0n;
  o && (n = -n);
  const i = Vr(n, r);
  return n /= i, r /= i, (o ? kt : "") + (r === 1n ? n.toString() : `${n}/${r}`);
}
function Be(t, e = {}) {
  if (e = R(e, ["maxDenominator", "tolerance"], "rationalApprox"), !ct(t)) return null;
  const n = e.maxDenominator ?? 1e3, r = (e.tolerance ?? 1e-12) * Math.max(1, Math.abs(t)), o = t < 0 ? -1 : 1, i = Math.abs(t);
  let s = i, a = 1, c = 0, u = 0, l = 1;
  for (let f = 0; f < 64; f += 1) {
    const m = Math.floor(s), d = m * a + c, g = m * u + l;
    if (g > n) return null;
    if (Math.abs(i - d / g) <= r) return { num: o * d, den: g };
    const w = s - m;
    if (w === 0) return null;
    s = 1 / w, c = a, a = d, l = u, u = g;
  }
  return null;
}
function di(t, e = {}) {
  if (e = R(e, ["maxDenominator", "tolerance"], "formatRational"), !ct(t)) return dt;
  const n = Be(t, e);
  if (!n) throw new RangeError(`formatRational: ${t} is not a fraction with denominator <= ${e.maxDenominator ?? 1e3}`);
  return Ke(n.num, n.den);
}
const Wr = /* @__PURE__ */ new Set([1, 2, 3, 4, 6, 8, 12]);
function Ur(t, e, n) {
  const r = Math.abs(t);
  for (let o = e; o <= n; o += 1) {
    const i = se(r, o);
    if (Math.abs(r - Number(i) / 10 ** o) <= 1e-12 * Math.max(1, r)) return ae(t, i, vt(i, o, !1, !0));
  }
  return null;
}
function pn(t, e) {
  if (Number.isInteger(t)) return (t < 0 ? kt : "") + String(Math.abs(t));
  const n = Ur(t, e, 4);
  if (n !== null) return n;
  const r = Be(t, { maxDenominator: 12 });
  return r ? Ke(r.num, r.den) : Kn(t, { digits: 4 });
}
function hi(t) {
  if (t != null && typeof t == "object") {
    const e = Array.from(t);
    if (!e.every(ct)) return dt;
    const n = e.map((r) => Be(r, { maxDenominator: 12 }));
    return n.every((r) => r !== null && Wr.has(r.den)) ? `(${n.map((r) => Ke(r.num, r.den)).join(", ")})` : `(${e.map((r) => pn(r, 1)).join(", ")})`;
  }
  return ct(t) ? pn(t, 2) : dt;
}
function Yn(t, e, n) {
  const r = Array.from(e);
  for (const o of r) if (!Number.isInteger(o) || o < n) throw new RangeError(`${t}: entries must be integers >= ${n}, got ${String(o)}`);
  return r;
}
function gi(t) {
  return Yn("formatGrades", t, 1).join("/");
}
function wi(t, e = {}) {
  e = R(e, ["label"], "formatSizes");
  const n = Yn("formatSizes", t, 0).map((r) => Zt(r)).join(", ");
  return e.label ?? !0 ? `sizes ${n}` : n;
}
function pi(t, e = (n) => Ln(n)) {
  return `(${Array.from(t, (n) => e(n)).join(", ")})`;
}
class K {
  constructor() {
    z(this, "s", 0);
    z(this, "c", 0);
  }
  add(e) {
    const n = this.s + e;
    Math.abs(this.s) >= Math.abs(e) ? this.c += this.s - n + e : this.c += e - n + this.s, this.s = n;
  }
  get value() {
    return this.s + this.c;
  }
}
function Xt(t) {
  if (t <= 26) return Array.from({ length: t }, (n, r) => String.fromCharCode(65 + r));
  const e = String(t).length;
  return Array.from({ length: t }, (n, r) => `U${String(r + 1).padStart(e, "0")}`);
}
function Yr(t) {
  return Array.from({ length: t }, (e, n) => `k${n + 1}`);
}
function bn(t, e, n, r) {
  if (t === void 0) return r;
  if (!Array.isArray(t) || t.length !== e) throw new RangeError(`${n} must be ${e} strings`);
  if (!t.every((o) => typeof o == "string") || new Set(t).size !== t.length)
    throw new RangeError(`${n} must be distinct strings`);
  return [...t];
}
function Pt(t, e, n) {
  return {
    ids: bn(t?.ids, e, "ids", Xt(e)),
    criteria: bn(t?.criteria, n, "criteria", Yr(n))
  };
}
function Tt(t) {
  return Array.from({ length: t }, (e, n) => {
    const r = new Array(t).fill(0);
    return r[n] = Number.NaN, r;
  });
}
function Et(t, e) {
  if (t == null || typeof t != "object" || typeof t.length != "number" || t.length < 1)
    throw new RangeError(`${e} must be a nonempty array of units`);
  const n = t.length, r = t[0], o = typeof r == "number" ? 1 : r?.length;
  if (typeof o != "number" || o < 1) throw new RangeError(`${e}[0] must be a number or a nonempty array`);
  const i = new Float64Array(n * o);
  for (let s = 0; s < n; s += 1) {
    const a = t[s];
    if (typeof a == "number") {
      if (o !== 1) throw new RangeError(`${e}[${s}] must have ${o} criterion values`);
      i[s] = a;
    } else {
      if (a == null || typeof a != "object" || a.length !== o)
        throw new RangeError(`${e}[${s}] must have ${o} criterion values`);
      for (let c = 0; c < o; c += 1) i[s * o + c] = a[c];
    }
  }
  for (let s = 0; s < i.length; s += 1)
    if (!Number.isFinite(i[s])) throw new RangeError(`${e} must contain finite numbers only`);
  return { n, K: o, v: i };
}
function he(t, e) {
  if (typeof t != "number" || !Number.isFinite(t)) throw new RangeError(`${e} must be a finite number`);
}
function ge(t, e) {
  if (typeof t != "number" || !Number.isFinite(t) || t < 0) throw new RangeError(`${e} must be a finite SD ≥ 0`);
}
function Ee(t, e, n) {
  const r = t * t + e * e - 2 * n * t * e;
  if (!(r > 0))
    throw new RangeError(
      "the difference of the two targets has SD 0, so its direction is not a normal probability (use finiteLawPairwise for point masses)"
    );
  return Math.sqrt(r);
}
function X(t, e) {
  if (t == null) {
    if (e === 1) return [1];
    throw new RangeError(`weights w are required when there are ${e} criteria`);
  }
  if (!Array.isArray(t) || t.length !== e) throw new RangeError(`w must hold ${e} weights`);
  const n = new K();
  for (const r of t) {
    if (typeof r != "number" || !Number.isFinite(r) || r < 0) throw new RangeError("weights must be finite and ≥ 0");
    n.add(r);
  }
  if (Math.abs(n.value - 1) > 1e-12) throw new RangeError("weights must sum to 1 (within 1e-12); they are not normalized");
  return [...t];
}
const je = (t) => t != null && typeof t == "object" && typeof t.length == "number";
function oe(t, e) {
  if (!Array.isArray(t) || t.length < 1) throw new RangeError(`${e} must be a nonempty criterion-major array e[k][i][j] (K × n × n)`);
  const n = je(t[0]) ? t[0].length : 0;
  if (n < 2) throw new RangeError(`${e} must have at least two units`);
  for (let r = 0; r < t.length; r += 1) {
    const o = t[r];
    if (!je(o) || o.length !== n) throw new RangeError(`${e}[${r}] must be ${n} × ${n}`);
    for (let i = 0; i < n; i += 1) {
      const s = o[i];
      if (!je(s) || s.length !== n) throw new RangeError(`${e}[${r}] must be ${n} × ${n}`);
      for (let a = 0; a < n; a += 1)
        if (i !== a && (typeof s[a] != "number" || !Number.isFinite(s[a])))
          throw new RangeError(`${e}[${r}][${i}][${a}] must be a finite number`);
    }
  }
  return { n, K: t.length };
}
function rt(t, e = "E") {
  if (t == null || typeof t != "object") throw new RangeError(`${e} must be an ErrorArray { ids, criteria, e }`);
  return { ...oe(t.e, `${e}.e`), e: t.e };
}
function ot(t, e, n, r) {
  if (t.length === 1) return e[0] * t[0][n][r];
  const o = new K();
  for (let i = 0; i < t.length; i += 1) o.add(e[i] * t[i][n][r]);
  return o.value;
}
function Le(t, e) {
  const n = new K();
  for (let r = 0; r < t.length; r += 1) {
    const o = t[r];
    if (typeof o != "number" || !Number.isFinite(o) || o < 0) throw new RangeError(`${e} must be finite and ≥ 0`);
    n.add(o);
  }
  if (Math.abs(n.value - 1) > 1e-12) throw new RangeError(`${e} must sum to 1 (within 1e-12); they are not normalized`);
}
function Bt(t, e, n) {
  if (t == null || typeof t != "object" || typeof t.length != "number" || t.length < 1)
    throw new RangeError(`${n} must be a nonempty array of states`);
  const r = t.length, o = [];
  let i = 0, s = 0;
  for (let c = 0; c < r; c += 1) {
    const u = Et(t[c], `${n}[${c}]`);
    if (c === 0)
      i = u.n, s = u.K;
    else if (u.n !== i || u.K !== s)
      throw new RangeError(`${n}[${c}] must have ${i} units × ${s} criteria, as ${n}[0]`);
    o.push(u.v);
  }
  let a = null;
  if (e != null) {
    if (typeof e != "object" || e.length !== r) throw new RangeError(`probs must have one value per state (${r})`);
    Le(e, "probs"), a = Float64Array.from(e);
  }
  return { S: r, n: i, K: s, states: o, p: a };
}
const Hn = 0, Ve = 1, Zn = 2, We = 3, Hr = 4;
function yn(t, e, n) {
  switch (t) {
    case Hn:
      return e < n;
    case Ve:
      return e === n;
    case Zn:
      return e > n;
    case We:
      return e <= n;
    default:
      return e !== n;
  }
}
function Ue(t, e, n) {
  const { S: r, n: o, K: i, states: s, p: a } = t, c = e.map(() => Array.from({ length: i }, () => Tt(o))), u = new Float64Array(e.length), l = e.map(() => new K());
  for (let f = 0; f < i; f += 1)
    for (let m = 0; m < o; m += 1)
      for (let d = 0; d < o; d += 1) {
        if (m === d) continue;
        const g = m * i + f, w = d * i + f;
        if (a === null) {
          u.fill(0);
          for (let h = 0; h < r; h += 1) {
            const p = s[h][g], b = s[h][w];
            for (let y = 0; y < e.length; y += 1) yn(e[y], p, b) && (u[y] += 1);
          }
          for (let h = 0; h < e.length; h += 1)
            n !== void 0 && (n[h][f][m][d] = u[h]), c[h][f][m][d] = u[h] / r;
        } else {
          for (let h = 0; h < e.length; h += 1) l[h] = new K();
          for (let h = 0; h < r; h += 1) {
            const p = s[h][g], b = s[h][w];
            for (let y = 0; y < e.length; y += 1) yn(e[y], p, b) && l[y].add(a[h]);
          }
          for (let h = 0; h < e.length; h += 1) c[h][f][m][d] = l[h].value;
        }
      }
  return c;
}
function Zr(t, e, n, r, o = {}) {
  he(t, "meanA"), he(n, "meanB"), ge(e, "sdA"), ge(r, "sdB");
  const i = R(o, ["corr"], "pairDirection").corr ?? 0;
  if (typeof i != "number" || !(i >= -1 && i <= 1)) throw new RangeError("corr must lie in [−1, 1]");
  return St((t - n) / Ee(e, r, i));
}
function bi(t, e) {
  const n = Et(t, "means");
  if (n.K !== 1) throw new RangeError("directionMatrix takes one mean per unit");
  const r = n.n, o = typeof e == "number" ? new Float64Array(r).fill(e) : Et(e, "sds").v;
  if (o.length !== r) throw new RangeError(`sds must have ${r} values`);
  o.forEach((s, a) => ge(s, `sds[${a}]`));
  const i = Tt(r);
  for (let s = 0; s < r; s += 1)
    for (let a = 0; a < r; a += 1)
      s !== a && (i[s][a] = St((n.v[s] - n.v[a]) / Ee(o[s], o[a], 0)));
  return i;
}
function Qr(t, e, n = {}) {
  n = R(n, ["ids", "criteria", "orient"], "errorArray");
  const r = Et(t, "means"), { n: o, K: i } = r;
  let s;
  if (typeof e == "number")
    s = new Float64Array(o * i).fill(e);
  else {
    const f = Et(e, "sds");
    if (f.n !== o || f.K !== i) throw new RangeError(`sds must be ${o} units × ${i} criteria, as means`);
    s = f.v;
  }
  s.forEach((f) => ge(f, "sds"));
  const a = n.orient ?? new Array(i).fill(1);
  if (a.length !== i || !Array.from(a).every((f) => f === 1 || f === -1))
    throw new RangeError(`orient must hold ${i} values, each +1 or −1`);
  const { ids: c, criteria: u } = Pt(n, o, i), l = Array.from({ length: i }, () => Tt(o));
  for (let f = 0; f < i; f += 1)
    for (let m = 0; m < o; m += 1)
      for (let d = 0; d < o; d += 1) {
        if (m === d) continue;
        const g = Ee(s[m * i + f], s[d * i + f], 0);
        l[f][m][d] = St(a[f] * (r.v[d * i + f] - r.v[m * i + f]) / g);
      }
  return { ids: c, criteria: u, e: l };
}
function Jr(t, e, n = {}) {
  n = R(n, ["ids", "criteria"], "finiteLawPairwise");
  const r = Bt(t, e, "states"), { ids: o, criteria: i } = Pt(n, r.n, r.K), [s, a, c] = Ue(r, [Zn, We, Ve]);
  return { ids: o, criteria: i, e: a, pi: s, t: c };
}
function yi(t) {
  if (!Array.isArray(t) || t.length < 1) throw new RangeError("components must be a nonempty array");
  Le(
    t.map((n) => n.w),
    "component weights w"
  );
  const e = new K();
  for (const n of t)
    e.add(n.w * Zr(n.meanA, n.sdA, n.meanB, n.sdB, { corr: n.corr ?? 0 }));
  return e.value;
}
function Qn(t, e = {}) {
  e = R(e, ["ids", "criteria"], "drawErrors");
  const n = Bt(t, null, "draws"), { ids: r, criteria: o } = Pt(e, n.n, n.K), i = Array.from({ length: n.K }, () => Tt(n.n)), [s] = Ue(n, [We], [i]);
  return { ids: r, criteria: o, e: s, S: n.S, counts: i };
}
function Ii(t, e, n = {}) {
  n = R(n, ["ids", "criteria"], "tieLawPairwise");
  const r = Bt(t, e, "states"), { ids: o, criteria: i } = Pt(n, r.n, r.K), [s, a, c] = Ue(r, [Hn, Ve, Hr]);
  return { ids: o, criteria: i, b: s, t: a, d: c };
}
function vi(t, e, n = {}) {
  const r = R(n, ["ids", "criteria"], "finiteLawMargins"), o = Bt(t, e, "states"), { S: i, n: s, K: a, p: c } = o, u = Pt(r, s, a), l = [];
  for (let f = 0; f < s; f += 1) {
    const m = [];
    for (let d = 0; d < a; d += 1) {
      const g = /* @__PURE__ */ new Map();
      for (let h = 0; h < i; h += 1) {
        const p = o.states[h][f * a + d];
        g.set(p, (g.get(p) ?? 0) + (c === null ? 1 : c[h]));
      }
      const w = [...g.keys()].sort((h, p) => h - p);
      m.push({ values: w, probs: w.map((h) => c === null ? g.get(h) / i : g.get(h)) });
    }
    l.push(m);
  }
  return {
    ...r.ids !== void 0 ? { ids: u.ids } : {},
    ...r.criteria !== void 0 ? { criteria: u.criteria } : {},
    margins: l
  };
}
function Xr(t, e) {
  const n = t ?? 1e-12;
  if (typeof n != "number" || !Number.isFinite(n) || n < 0) throw new RangeError(`${e}: tieTol must be a finite number ≥ 0, got ${String(n)}`);
  return n;
}
function Ei(t, e = {}) {
  const n = R(e, ["w", "tieTol"], "majorityWins"), { n: r, K: o, e: i } = rt(t), s = X(n.w, o), a = Xr(n.tieTol, "majorityWins"), c = new Float64Array(r * r);
  for (let w = 0; w < r; w += 1) for (let h = 0; h < r; h += 1) w !== h && (c[w * r + h] = ot(i, s, w, h));
  const u = new Uint8Array(r * r), l = new Array(r).fill(0), f = new Array(r).fill(0);
  for (let w = 0; w < r; w += 1)
    for (let h = 0; h < r; h += 1) {
      if (w === h) continue;
      const p = c[w * r + h], b = c[h * r + w];
      p < b - a && (u[w * r + h] = 1, l[w] += 1), Math.abs(p - b) <= a && (f[w] += 1);
    }
  const m = l.map((w, h) => h).sort((w, h) => l[h] - l[w] || w - h), d = [];
  for (let w = 0; w < r; w += 1)
    for (let h = w + 1; h < r; h += 1)
      for (let p = h + 1; p < r; p += 1) {
        const b = u[w * r + h] && u[h * r + p] && u[p * r + w], y = u[w * r + p] && u[p * r + h] && u[h * r + w];
        b ? d.push([w, h, p]) : y && d.push([w, p, h]);
      }
  const g = d.length;
  return { wins: l, ties: f, order: m, cycles: g, strictOrder: g === 0 && f.every((w) => w === 0), cycleTriples: d };
}
function Ai(t, e = {}) {
  const n = R(e, ["k", "w", "order"], "leastCertainPairs"), { n: r, K: o, e: i } = rt(t), s = X(n.w, o), a = n.k ?? 10;
  if (typeof a != "number" || !Number.isSafeInteger(a) || a < 1) throw new RangeError(`leastCertainPairs: k must be a positive integer, got ${String(a)}`);
  let c = null;
  if (n.order !== void 0 && n.order !== null) {
    if (!Array.isArray(n.order) || n.order.length !== r) throw new RangeError(`leastCertainPairs: order must list all ${r} unit indices`);
    c = new Int32Array(r).fill(-1), n.order.forEach((f, m) => {
      if (typeof f != "number" || !Number.isInteger(f) || f < 0 || f >= r || c[f] !== -1)
        throw new RangeError(`leastCertainPairs: order must be a permutation of 0..${r - 1}`);
      c[f] = m;
    });
  }
  const u = [];
  for (let f = 0; f < r; f += 1)
    for (let m = f + 1; m < r; m += 1) {
      const d = ot(i, s, f, m), g = ot(i, s, m, f);
      u.push({ i: f, j: m, e: Math.min(d, g), above: d <= g ? f : m });
    }
  u.sort((f, m) => m.e - f.e);
  const l = u.slice(0, Math.min(a, u.length));
  if (c !== null) for (const f of l) f.apart = Math.abs(c[f.i] - c[f.j]);
  return l;
}
function Ni(t, e = {}) {
  const n = R(e, ["w", "thresholds"], "pairCertainty"), { n: r, K: o, e: i } = rt(t), s = X(n.w, o), a = n.thresholds ?? [0.9, 0.99];
  if (!Array.isArray(a) || a.length < 1)
    throw new RangeError("pairCertainty: thresholds must be a nonempty array of numbers in (1/2, 1)");
  a.forEach((l, f) => {
    if (typeof l != "number" || !(l > 0.5 && l < 1)) throw new RangeError(`pairCertainty: thresholds must lie in (1/2, 1), got ${String(l)}`);
    if (f > 0 && !(l > a[f - 1])) throw new RangeError("pairCertainty: thresholds must be strictly increasing");
  });
  const c = a.map((l) => 1 - l), u = new Array(a.length).fill(0);
  for (let l = 0; l < r; l += 1)
    for (let f = l + 1; f < r; f += 1) {
      const m = Math.min(ot(i, s, l, f), ot(i, s, f, l));
      for (let d = 0; d < c.length; d += 1) m < c[d] && (u[d] += 1);
    }
  return { M: r * (r - 1) / 2, thresholds: [...a], counts: u };
}
function $i(t, e, n, r, o = {}) {
  const i = R(o, ["corr"], "pairDifference").corr ?? 0;
  he(t, "pairDifference: meanA"), he(n, "pairDifference: meanB");
  for (const [u, l] of [[e, "sdA"], [r, "sdB"]])
    if (typeof u != "number" || !Number.isFinite(u) || !(u > 0)) throw new RangeError(`pairDifference: ${l} must be a finite SD > 0, got ${String(u)}`);
  if (typeof i != "number" || !(i >= -1 && i <= 1)) throw new RangeError(`pairDifference: corr must be a number in [−1, 1], got ${String(i)}`);
  const s = t - n, a = Ee(e, r, i), c = s / a;
  return { mean: s, sd: a, z: c, pi: St(c) };
}
function ki(t, e, n) {
  const r = R(n, ["i", "j", "criterion"], "finiteLawCells", !0), o = Bt(t, e, "states"), { S: i, n: s, K: a, p: c } = o, u = (y, N, I, E) => {
    if (typeof y != "number" || !Number.isSafeInteger(y) || y < 0 || y >= I)
      throw new RangeError(`finiteLawCells: ${N} must be ${E} index, an integer in 0..${I - 1}, got ${String(y)}`);
    return y;
  }, l = u(r.i, "i", s, "a unit"), f = u(r.j, "j", s, "a unit");
  if (l === f) throw new RangeError(`finiteLawCells: i and j must be two different units, got ${l} for both`);
  const m = u(r.criterion ?? 0, "criterion", a, "a criterion"), d = (y) => [...new Set(o.states.map((N) => N[y * a + m]))].sort((N, I) => N - I), g = d(l), w = d(f), h = new Map(g.map((y, N) => [y, N])), p = new Map(w.map((y, N) => [y, N])), b = g.map(() => new Array(w.length).fill(0));
  for (let y = 0; y < i; y += 1) {
    const N = h.get(o.states[y][l * a + m]), I = p.get(o.states[y][f * a + m]);
    b[N][I] += c === null ? 1 : c[y];
  }
  if (c === null) for (const y of b) for (let N = 0; N < y.length; N += 1) y[N] /= i;
  return { rowValues: g, colValues: w, cells: b };
}
function to(t, e) {
  const n = rt(t, "Ehat"), r = rt(e, "E");
  if (n.n !== r.n || n.K !== r.K)
    throw new RangeError(`maxCoefficientError: Ehat and E must have the same shape (Ehat ${n.K} × ${n.n} × ${n.n}, E ${r.K} × ${r.n} × ${r.n})`);
  const { n: o, K: i } = n, s = [], a = [];
  for (let c = 0; c < i; c += 1) {
    let u = -1, l = { i: 0, j: 1 };
    for (let f = 0; f < o; f += 1)
      for (let m = 0; m < o; m += 1) {
        if (f === m) continue;
        const d = Math.abs(n.e[c][f][m] - r.e[c][f][m]);
        d > u && (u = d, l = { i: f, j: m });
      }
    s.push(u), a.push(l);
  }
  return { epsilon: s, at: a };
}
function Z(t) {
  if (typeof t != "number" || !(t > 0 && t <= 0.5))
    throw new RangeError(`tau must lie in (0, 1/2], got ${String(t)}`);
  return t;
}
function In(t, e, n) {
  Z(n);
  for (const [s, a] of [
    [t, "eIJ"],
    [e, "eJI"]
  ])
    if (typeof s != "number" || !Number.isFinite(s)) throw new RangeError(`${a} must be a finite number`);
  const r = { iAboveJ: t, jAboveI: e, withhold: n }, o = Math.min(t, e, n), i = ["iAboveJ", "jAboveI", "withhold"].filter((s) => r[s] - o <= 1e-12);
  return { costs: r, directionalMinimum: Math.min(t, e), best: i };
}
function H(t, e, n) {
  const r = R(n, ["tau", "w"], "evaluateReport", !0), { n: o, K: i, e: s } = rt(e), a = Z(r.tau), c = X(r.w, i), u = tt(t, o), { M: l, N: f, s: m, G: d } = _t(u), g = [];
  for (let b = 0; b < i; b += 1) {
    const y = new K(), N = s[b];
    for (let I = 0; I < o; I += 1) for (let E = 0; E < o; E += 1) u[I] < u[E] && y.add(N[I][E]);
    g.push(y.value);
  }
  const w = new K();
  for (let b = 0; b < i; b += 1) w.add(c[b] * g[b]);
  const h = w.value, p = a * (l - f);
  return {
    M: l,
    N: f,
    s: m,
    G: d,
    E: g,
    EoverN: g.map((b) => f === 0 ? null : b / f),
    EoverM: g.map((b) => b / l),
    Rk: g.map((b) => (b + p) / l),
    Ew: h,
    risk: (h + p) / l,
    errorTerm: h / l,
    withholdingTerm: p / l
  };
}
function Ri(t, e) {
  const n = R(e, ["tau", "w"], "relaxedPairRisk", !0), { n: r, K: o, e: i } = rt(t), s = Z(n.tau), a = X(n.w, o), c = new K();
  for (let u = 0; u < r; u += 1)
    for (let l = u + 1; l < r; l += 1) c.add(Math.min(ot(i, a, u, l), ot(i, a, l, u), s));
  return c.value / (r * (r - 1) / 2);
}
function xi(t, e, n = {}) {
  const r = R(n, ["w"], "betweenGradeErrors"), { n: o, K: i, e: s } = rt(e), a = X(r.w, i), c = tt(t, o), u = _t(c).G, l = Array.from({ length: u }, () => Array.from({ length: u }, () => new K())), f = Array.from({ length: u }, () => new Array(u).fill(0)), m = Array.from({ length: u }, () => new Array(u).fill(Number.NEGATIVE_INFINITY));
  for (let g = 0; g < o; g += 1)
    for (let w = 0; w < o; w += 1) {
      if (!(c[g] < c[w])) continue;
      const h = ot(s, a, g, w), p = c[g] - 1, b = c[w] - 1;
      l[p][b].add(h), f[p][b] += 1, h > m[p][b] && (m[p][b] = h);
    }
  const d = [];
  for (let g = 0; g < u; g += 1)
    for (let w = g + 1; w < u; w += 1)
      d.push({ h: g + 1, hp: w + 1, pairs: f[g][w], meanError: l[g][w].value / f[g][w], maxError: m[g][w] });
  return d;
}
function Mi(t, e, n) {
  const r = R(n, ["tau", "w", "tieTol"], "statedAbove", !0), { n: o, K: i, e: s } = rt(e), a = Z(r.tau), c = X(r.w, i), u = r.tieTol ?? 1e-12;
  if (typeof u != "number" || !Number.isFinite(u) || u < 0) throw new RangeError("tieTol must be a finite number ≥ 0");
  const l = tt(t, o), f = [];
  let m = null;
  for (let d = 0; d < o; d += 1)
    for (let g = 0; g < o; g += 1) {
      if (!(l[d] < l[g])) continue;
      const w = ot(s, c, d, g);
      (m === null || w > m) && (m = w), w > a + u && f.push({ i: d, j: g, error: w });
    }
  return { pairs: f, count: f.length, max: m };
}
function Si(t, e, n) {
  const r = R(n, ["tau", "w"], "confidentPairs", !0), { n: o, K: i, e: s } = rt(e), a = Z(r.tau), c = X(r.w, i), u = tt(t, o), l = [];
  let f = 0;
  for (let m = 0; m < o; m += 1)
    for (let d = m + 1; d < o; d += 1) {
      if (!(Math.min(ot(s, c, m, d), ot(s, c, d, m)) < a)) continue;
      const g = u[m] === u[d];
      g && (f += 1), l.push({ i: m, j: d, withheld: g });
    }
  return { count: l.length, withheld: f, stated: l.length - f, pairs: l };
}
function Jn(t, e, n = {}) {
  const r = R(n, ["w"], "realizedWrong"), o = Et(e, "theta"), { n: i, K: s, v: a } = o, c = tt(t, i), u = r.w === void 0 && s > 1 ? null : X(r.w, s), l = _t(c).N, f = new Array(s).fill(0), m = Array.from({ length: s }, () => []);
  for (let g = 0; g < s; g += 1)
    for (let w = 0; w < i; w += 1)
      for (let h = 0; h < i; h += 1)
        c[w] < c[h] && a[w * s + g] <= a[h * s + g] && (f[g] += 1, m[g].push({ i: w, j: h }));
  let d = null;
  if (u !== null) {
    const g = new K();
    for (let w = 0; w < s; w += 1) g.add(u[w] * f[w]);
    d = g.value;
  }
  return {
    N: l,
    D: f,
    DoverN: f.map((g) => l === 0 ? null : g / l),
    A: d,
    AoverN: d === null || l === 0 ? null : d / l,
    pairs: m
  };
}
function eo(t) {
  if (typeof t != "number" || !(t > 0 && t <= 1)) throw new RangeError(`lambda must lie in (0, 1], got ${String(t)}`);
  return t / (1 + t);
}
function no(t) {
  return Z(t), t / (1 - t);
}
function qe(t, e, n) {
  const r = R(n, ["lambda", "t"], "krwRisk", !0), { n: o, K: i, e: s } = rt(e);
  if (i !== 1) throw new RangeError("krwRisk takes one criterion (K = 1)");
  const a = r.lambda;
  if (typeof a != "number" || !(a >= 0 && a <= 1)) throw new RangeError(`lambda must lie in [0, 1], got ${String(a)}`);
  if (r.t !== void 0) {
    const w = oe(r.t, "t");
    if (w.n !== o || w.K !== 1) throw new RangeError(`t must be one ${o} × ${o} matrix of equality probabilities (K = 1), as E`);
    for (let h = 0; h < o; h += 1)
      for (let p = 0; p < o; p += 1) if (h !== p && r.t[0][h][p] > 1e-15) throw new RangeError("the KRW correspondence needs a tie-free law");
  }
  const c = tt(t, o), { M: u, N: l } = _t(c), f = new K();
  for (let w = 0; w < o; w += 1) for (let h = 0; h < o; h += 1) c[w] < c[h] && f.add(s[0][w][h]);
  const m = f.value, d = m / u, g = (l - 2 * m) / u;
  return (1 - a) * d - a * g;
}
function Ti(t, e, n) {
  const r = R(n, ["tau", "w"], "equalityNeutralRisk", !0);
  if (e == null || typeof e != "object") throw new RangeError("tie must hold the arrays b and d");
  const { n: o, K: i } = oe(e.b, "tie.b"), s = oe(e.d, "tie.d");
  if (s.n !== o || s.K !== i) throw new RangeError("tie.b and tie.d must have the same shape");
  const a = Z(r.tau), c = X(r.w, i), u = tt(t, o), l = _t(u).M, f = new K(), m = new K();
  for (let d = 0; d < i; d += 1) {
    const g = new K(), w = new K(), h = new K();
    for (let p = 0; p < o; p += 1)
      for (let b = 0; b < o; b += 1)
        u[p] < u[b] && g.add(e.b[d][p][b]), p < b && (h.add(e.d[d][p][b]), u[p] === u[b] && w.add(e.d[d][p][b]));
    f.add(c[d] * ((g.value + a * w.value) / l)), m.add(c[d] * (a * h.value / l));
  }
  return { risk: f.value, R0: m.value };
}
function ro(t, e = {}) {
  if (e = R(e, ["M", "weights"], "disclosedErrorEstimands"), !Array.isArray(t) || t.length < 1) throw new RangeError("cases must be a nonempty array of { A, N }");
  const n = t.length, r = new K(), o = new K(), i = new K(), s = new K();
  let a = 0, c = !0;
  const u = /* @__PURE__ */ new Set(), l = [];
  for (const [m, d] of t.entries()) {
    const { A: g, N: w } = d ?? {};
    if (typeof g != "number" || !Number.isFinite(g) || g < 0) throw new RangeError(`cases[${m}].A must be finite and ≥ 0`);
    if (typeof w != "number" || !Number.isFinite(w) || w < 0) throw new RangeError(`cases[${m}].N must be finite and ≥ 0`);
    if (w === 0 && g !== 0) throw new RangeError(`cases[${m}] discloses nothing, so its wrong count must be 0`);
    r.add(g), o.add(w), w > 0 && (a += 1, i.add(g / w));
    const h = d.M ?? e.M;
    if (h === void 0) c = !1;
    else {
      if (typeof h != "number" || !Number.isFinite(h) || h <= 0 || w > h) throw new RangeError(`cases[${m}].M must be positive and ≥ N`);
      s.add(w / h), u.add(h), l.push(h);
    }
  }
  if (e.weights !== void 0 && e.weights !== null) {
    const m = e.weights;
    if (typeof m != "object" || typeof m.length != "number" || m.length !== n)
      throw new RangeError(`disclosedErrorEstimands: weights must hold one probability per case (${n})`);
    Le(m, "disclosedErrorEstimands: weights");
    const d = c && u.size === 1 ? [...u][0] : null;
    let g = 0, w = 0, h = 0, p = 0, b = 0;
    for (let y = 0; y < n; y += 1) {
      const { A: N, N: I } = t[y], E = m[y];
      g += E * N, w += E * I, I > 0 && (h += E * N / I, p += E), c && (b += d !== null ? E * I : E * I / l[y]);
    }
    return {
      ERR: w > 0 ? g / w : null,
      meanFraction: p > 0 ? h / p : null,
      zeroImputed: h,
      positiveFrequency: p,
      meanDisclosure: c ? d !== null ? b / d : b : null
    };
  }
  const f = c ? u.size === 1 ? o.value / ([...u][0] * n) : s.value / n : null;
  return {
    ERR: o.value > 0 ? r.value / o.value : null,
    meanFraction: a > 0 ? i.value / a : null,
    zeroImputed: i.value / n,
    positiveFrequency: a / n,
    meanDisclosure: f
  };
}
function Fi(t, e, n = {}) {
  const r = R(n, ["w"], "largestStatedError"), { n: o, K: i, e: s } = rt(e), a = X(r.w, i), c = tt(t, o);
  let u = null;
  for (let l = 0; l < o; l += 1)
    for (let f = 0; f < o; f += 1) {
      if (!(c[l] < c[f])) continue;
      const m = ot(s, a, l, f);
      (u === null || m > u.e) && (u = { e: m, i: l, j: f });
    }
  return u;
}
function Ci(t, e, n, r = {}) {
  const o = R(r, ["w"], "wrongCountDistribution"), i = Bt(e, n, "states"), { S: s, n: a, K: c, p: u } = i, l = X(o.w, c);
  if (t == null || typeof t != "object" || typeof t.length != "number")
    throw new RangeError("wrongCountDistribution: g must be an array of grade labels");
  for (let v = 0; v < t.length; v += 1) {
    const $ = t[v];
    if (typeof $ != "number" || !Number.isSafeInteger($) || $ < 1)
      throw new RangeError(`wrongCountDistribution: g must hold positive integer grade labels, got ${String($)}`);
  }
  const f = tt(t, a), { N: m } = _t(f);
  if (m === 0) return { N: m, values: [0], probs: [1], expected: 0, pNone: 1, pAllCriteriaRight: 1, unionBound: 1 };
  const d = new Float64Array(s), g = new Uint8Array(s);
  for (let v = 0; v < s; v += 1) {
    const { D: $ } = Jn(f, e[v], { w: l });
    let A = 0;
    for (let k = 0; k < c; k += 1) A += l[k] * $[k];
    d[v] = A, g[v] = $.every((k) => k === 0) ? 1 : 0;
  }
  const w = /* @__PURE__ */ new Map();
  let h = 0, p = 0, b = 0;
  for (let v = 0; v < s; v += 1) {
    const $ = u === null ? 1 : u[v], A = d[v];
    w.set(A, (w.get(A) ?? 0) + $), h += $ * A, A === 0 && (p += $), g[v] && (b += $);
  }
  const y = u === null ? s : 1, N = [...w.keys()].sort((v, $) => v - $), I = Jr(e, n).e;
  let E = 0;
  for (let v = 0; v < a; v += 1)
    for (let $ = 0; $ < a; $ += 1) if (f[v] < f[$]) for (let A = 0; A < c; A += 1) E += I[A][v][$];
  return {
    N: m,
    values: N,
    probs: N.map((v) => w.get(v) / y),
    expected: h / y,
    pNone: p / y,
    pAllCriteriaRight: b / y,
    unionBound: Math.max(0, 1 - E)
  };
}
function ji(t, e, n = {}) {
  const r = R(n, ["w"], "claimsByDistance"), { n: o, K: i, e: s } = rt(e), a = X(r.w, i);
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
    let f = 0, m = Number.NEGATIVE_INFINITY;
    for (let d = 1; d + l <= o; d += 1) {
      const g = ot(s, a, c[d - 1], c[d + l - 1]);
      f += g, g > m && (m = g);
    }
    u.push({ distance: l, count: o - l, expected: f, max: m });
  }
  return u;
}
function tt(t, e) {
  const n = Lt(t);
  if (e !== void 0 && n.length !== e) throw new RangeError(`the grade vector must have one entry per unit (${e})`);
  if (n.length < 2) throw new RangeError("a report needs at least two units");
  return n;
}
function _t(t) {
  const e = t.length;
  let n = 0;
  for (const a of t) a > n && (n = a);
  const r = new Array(n).fill(0);
  for (const a of t) r[a - 1] += 1;
  const o = Vt(e);
  let i = 0;
  for (const a of r) i += a * (a - 1) / 2;
  const s = o - i;
  return { M: o, N: s, s: s / o, G: n, sizes: r, withheld: o - s };
}
function qt(t, e) {
  if (!Number.isSafeInteger(t)) throw new RangeError(`${e} must be an integer`);
}
const oo = BigInt(Number.MAX_SAFE_INTEGER);
function io(t) {
  return t <= oo ? Number(t) : t;
}
function vn(t) {
  let e = [1n];
  for (let n = 1; n <= t; n += 1) {
    const r = new Array(n + 1).fill(0n);
    for (let o = 1; o <= n; o += 1) r[o] = BigInt(o) * ((e[o] ?? 0n) + e[o - 1]);
    e = r;
  }
  return e;
}
function En(t, e) {
  if (e < 0 || e > t) return 0n;
  let n = 1n;
  const r = Math.min(e, t - e);
  for (let o = 1; o <= r; o += 1) n = n * BigInt(t - r + o) / BigInt(o);
  return n;
}
function Xn(t, e) {
  const n = Array.from(t), r = Array.from(e), o = Math.min(n.length, r.length);
  for (let i = 0; i < o; i += 1) {
    const s = n[i].codePointAt(0) - r[i].codePointAt(0);
    if (s !== 0) return s;
  }
  return n.length - r.length;
}
function Lt(t) {
  if (t == null || typeof t != "object" || typeof t.length != "number") throw new RangeError("g must be an array of grade labels");
  const e = Array.from(t);
  for (const o of e)
    if (typeof o != "number" || !Number.isSafeInteger(o)) throw new RangeError("grade labels must be integers");
  const n = [...new Set(e)].sort((o, i) => o - i), r = new Map(n.map((o, i) => [o, i + 1]));
  return e.map((o) => r.get(o));
}
function Vt(t) {
  if (qt(t, "n"), t < 0) throw new RangeError("n must be ≥ 0");
  return t * (t - 1) / 2;
}
function Gi(t) {
  return _t(tt(t));
}
function Oi(t) {
  const e = Lt(t);
  return e.map((n) => e.map((r) => n < r ? 1 : n > r ? -1 : 0));
}
function Pi(t) {
  const e = Lt(t), n = e.length;
  if (n < 1) throw new RangeError("g must hold at least one grade");
  const { sizes: r } = _t(e), o = new Array(r.length + 1).fill(0);
  for (let u = 0; u < r.length; u += 1) o[u + 1] = o[u] + r[u];
  const i = e.map((u) => o[u - 1]), s = e.map((u) => r[u - 1] - 1), a = e.map((u, l) => n - 1 - s[l] - i[l]), c = a.map((u, l) => u + i[l]);
  return { n, partners: n - 1, above: a, below: i, stated: c, withheld: s };
}
function _i(t) {
  const e = Lt(t), n = e.length, r = Tt(n);
  for (let s = 0; s < n; s += 1) for (let a = 0; a < n; a += 1) s !== a && (r[s][a] = e[s] <= e[a] ? 1 : 0);
  let o = !0;
  for (let s = 0; s < n && o; s += 1) for (let a = s + 1; a < n; a += 1) r[s][a] + r[a][s] < 1 && (o = !1);
  let i = !0;
  for (let s = 0; s < n && i; s += 1)
    for (let a = 0; a < n && i; a += 1)
      if (a !== s) {
        for (let c = 0; c < n; c += 1)
          if (!(c === s || c === a) && r[s][a] + r[a][c] - r[s][c] > 1) {
            i = !1;
            break;
          }
      }
  return { z: r, complete: o, transitive: i };
}
const so = Object.freeze({
  all: ["kind"],
  atMost: ["kind", "G"],
  exactly: ["kind", "G"],
  order: ["kind", "order", "G", "exact", "blocks"]
});
function Ye(t, e) {
  if (qt(t, "n"), t < 1) throw new RangeError("n must be ≥ 1");
  if (e == null || typeof e != "object") throw new RangeError("family must be a family object");
  const n = so[e.kind];
  if (n === void 0) throw new RangeError(`unknown family kind ${String(e.kind)}`);
  switch (Dt(e, n, `family { kind: "${e.kind}" }`), e.kind) {
    case "all":
    case "atMost": {
      const r = e.kind === "all" ? t : e.G;
      qt(r, "G");
      const o = vn(t);
      let i = 0n;
      for (let s = 1; s <= Math.min(r, t); s += 1) i += o[s];
      return i;
    }
    case "exactly":
      return qt(e.G, "G"), e.G < 1 || e.G > t ? 0n : vn(t)[e.G];
    case "order": {
      const r = e.order;
      if (!Array.isArray(r) || r.length !== t) throw new RangeError(`order must list all ${t} unit indices`);
      const o = /* @__PURE__ */ new Set();
      for (const s of r) {
        if (!Number.isInteger(s) || s < 0 || s >= t || o.has(s)) throw new RangeError("order must be a permutation of 0..n−1");
        o.add(s);
      }
      let i = t;
      if (e.blocks !== void 0) {
        const s = e.blocks;
        if (!Array.isArray(s) || !s.every((a) => Number.isSafeInteger(a) && a >= 1) || s.reduce((a, c) => a + c, 0) !== t)
          throw new RangeError(`blocks must be positive block sizes along the order, summing to ${t}`);
        i = s.length;
      }
      if (e.exact !== void 0)
        return qt(e.exact, "exact"), e.G !== void 0 && qt(e.G, "G"), e.exact < 1 || e.exact > i || e.G !== void 0 && e.exact > e.G ? 0n : En(i - 1, e.exact - 1);
      if (e.G !== void 0) {
        qt(e.G, "G");
        let s = 0n;
        for (let a = 1; a <= Math.min(e.G, i); a += 1) s += En(i - 1, a - 1);
        return s;
      }
      return 1n << BigInt(i - 1);
    }
    default:
      throw new RangeError(`unknown family kind ${String(e.kind)}`);
  }
}
function qi(t, e) {
  return io(Ye(t, e));
}
function ao(t, e = {}) {
  const n = R(e, ["direction", "ids"], "scoreOrder");
  if (t == null || typeof t != "object" || typeof t.length != "number" || t.length < 1)
    throw new RangeError("scores must be a nonempty array of numbers");
  const r = Array.from(t);
  if (!r.every((l) => typeof l == "number" && Number.isFinite(l))) throw new RangeError("scores must be finite numbers");
  const o = r.length, i = n.direction ?? "descending";
  if (i !== "descending" && i !== "ascending") throw new RangeError('direction must be "descending" or "ascending"');
  const s = n.ids === void 0 ? Xt(o) : Array.from(n.ids);
  if (s.length !== o || !s.every((l) => typeof l == "string") || new Set(s).size !== o)
    throw new RangeError(`ids must be ${o} distinct strings`);
  const a = i === "descending" ? -1 : 1, c = r.map((l, f) => f).sort((l, f) => a * (r[l] - r[f]) || Xn(s[l], s[f])), u = [];
  for (let l = 0; l < o; l += 1)
    l > 0 && r[c[l]] === r[c[l - 1]] ? u[u.length - 1] += 1 : u.push(1);
  return { order: c, blocks: u };
}
function zi(t, e = {}, n = "expected_rank") {
  R(e, ["ids", "expectedRank", "mean"], "reportCardRows summaries"), e = e ?? {};
  const r = Lt(t), o = r.length, i = e.ids === void 0 ? Xt(o) : Array.from(e.ids);
  if (i.length !== o || !i.every((u) => typeof u == "string")) throw new RangeError(`summaries.ids must be ${o} strings`);
  const s = (u, l) => {
    const f = e[u];
    if (f == null || f.length !== o) throw new RangeError(`sort "${n}" needs summaries.${u} with ${o} values`);
    const m = Array.from(f, (d) => l * d);
    if (!m.every(Number.isFinite)) throw new RangeError(`summaries.${u} must be finite`);
    return m;
  };
  let a;
  switch (n) {
    case "grade":
      a = r.map((u, l) => l);
      break;
    case "expected_rank":
      a = s("expectedRank", 1);
      break;
    case "mean":
      a = s("mean", -1);
      break;
    case "label":
      a = new Array(o).fill(0);
      break;
    default:
      throw new RangeError('sort must be "grade", "expected_rank", "mean" or "label"');
  }
  const c = r.map((u, l) => l);
  return c.sort((u, l) => r[u] - r[l] || a[u] - a[l] || Xn(i[u], i[l]) || u - l), c;
}
function Di(t, e, n = {}) {
  const r = R(n, ["direction"], "statedAgainst"), o = tt(t), i = o.length;
  if (e == null || typeof e != "object" || typeof e.length != "number" || e.length !== i)
    throw new RangeError(`statedAgainst: scores must hold one number per unit (${i})`);
  const s = Array.from(e);
  if (!s.every((m) => typeof m == "number" && Number.isFinite(m))) throw new RangeError("statedAgainst: scores must be finite numbers");
  const a = r.direction ?? "descending";
  if (a !== "descending" && a !== "ascending") throw new RangeError('statedAgainst: direction must be "descending" or "ascending"');
  const c = a === "descending" ? (m, d) => s[m] > s[d] : (m, d) => s[m] < s[d], u = [], l = new Uint8Array(i);
  for (let m = 0; m < i; m += 1)
    for (let d = m + 1; d < i; d += 1) {
      if (o[m] === o[d]) continue;
      const g = o[m] < o[d] ? m : d, w = g === m ? d : m;
      c(w, g) && (u.push({ above: g, below: w }), l[w] = 1);
    }
  const f = [];
  for (let m = 0; m < i; m += 1) l[m] && f.push(m);
  return { count: u.length, pairs: u, units: f };
}
const An = (t) => t > 0 ? "above" : t < 0 ? "below" : "withheld";
function co(t, e, n = null, r = {}) {
  const o = R(r, ["w"], "relationChange"), i = tt(t), s = tt(e, i.length), a = i.length;
  let c = null;
  if (n != null) {
    const { n: w, K: h, e: p } = rt(n);
    if (w !== a) throw new RangeError(`relationChange: E has ${w} units, the reports ${a}`);
    c = { e: p, w: X(o.w, h) };
  } else if (o.w !== void 0)
    throw new RangeError("relationChange: w applies only together with E");
  let u = 0, l = 0, f = 0, m = 0;
  const d = [];
  for (let w = 0; w < a; w += 1)
    for (let h = w + 1; h < a; h += 1) {
      const p = Math.sign(i[h] - i[w]), b = Math.sign(s[h] - s[w]);
      if (p === b) {
        u += 1;
        continue;
      }
      p === 0 ? l += 1 : b === 0 ? f += 1 : m += 1;
      let y = null;
      c !== null && b !== 0 && (y = b > 0 ? ot(c.e, c.w, w, h) : ot(c.e, c.w, h, w)), d.push({ i: w, j: h, from: An(p), to: An(b), error: y });
    }
  const g = Vt(a);
  return { M: g, nSame: u, nNewDisclosed: l, nNewWithheld: f, nReversed: m, changed: d.length, changeShare: d.length / g, agreement: u / g, pairs: d };
}
function Ki(t, e, n = {}) {
  const r = R(n, ["order", "blocks"], "cutGrade");
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
  if (r.order === void 0 || r.order === null) o = Array.from({ length: t }, (c, u) => u);
  else {
    if (!Array.isArray(r.order) || r.order.length !== t) throw new RangeError(`cutGrade: order must list all ${t} unit indices`);
    const c = new Uint8Array(t);
    for (const u of r.order) {
      if (typeof u != "number" || !Number.isInteger(u) || u < 0 || u >= t || c[u])
        throw new RangeError("cutGrade: order must be a permutation of 0…n−1");
      c[u] = 1;
    }
    o = Array.from(r.order);
  }
  if (r.blocks !== void 0 && r.blocks !== null) {
    if (!Array.isArray(r.blocks)) throw new RangeError("cutGrade: blocks must be a list of [from, to] position ranges");
    for (const c of r.blocks) {
      if (!(Array.isArray(c) && c.length === 2 && c.every((m) => typeof m == "number" && Number.isSafeInteger(m)) && c[0] >= 1 && c[0] <= c[1] && c[1] <= t)) throw new RangeError(`cutGrade: each block must be [from, to] with 1 ≤ from ≤ to ≤ ${t}`);
      const [l, f] = c;
      for (const m of e)
        if (l <= m && m < f)
          throw new RangeError(`cutGrade: cut ${m} falls inside block [${l}, ${f}] (positions ${l}…${f} must share a grade)`);
    }
  }
  const i = new Int8Array(t);
  let s = 1, a = 0;
  for (let c = 1; c <= t; c += 1) {
    for (; a < e.length && e[a] < c; )
      s += 1, a += 1;
    i[o[c - 1]] = s;
  }
  return i;
}
const lo = Object.freeze({
  maxReports: 6e5,
  maxUnits: 20
}), He = 5e3, uo = 1e-12, fo = 1e-12, mo = 20000000n;
function lt(t, e) {
  const n = t?.e, r = Array.isArray(n) ? n[0] : void 0, o = r != null && typeof r == "object" && typeof r.length == "number" ? r.length : 0;
  H(new Array(Math.max(o, 0)).fill(1), t, { tau: 0.5, w: e });
  const i = t.e.length, s = X(e, i), a = t.e.map((u) => {
    const l = new Float64Array(o * o);
    for (let f = 0; f < o; f += 1) for (let m = 0; m < o; m += 1) f !== m && (l[f * o + m] = u[f][m]);
    return l;
  }), c = new Float64Array(o * o);
  for (let u = 0; u < o; u += 1)
    for (let l = 0; l < o; l += 1)
      if (u !== l)
        if (i === 1) c[u * o + l] = s[0] * a[0][u * o + l];
        else {
          const f = new K();
          for (let m = 0; m < i; m += 1) f.add(s[m] * a[m][u * o + l]);
          c[u * o + l] = f.value;
        }
  return { n: o, K: i, M: Vt(o), w: s, ebar: c, ek: a };
}
function it(t, e) {
  const n = t ?? uo;
  if (typeof n != "number" || !Number.isFinite(n) || n < 0) throw new RangeError(`${e} must be a finite number ≥ 0`);
  return n;
}
const ho = "₀₁₂₃₄₅₆₇₈₉", go = (t) => Array.from(String(t), (e) => ho[Number(e)]).join("");
function Yt(t, e) {
  const n = { name: t.name, words: t.words, size: jn(e) };
  return t.baseSize !== void 0 && (n.baseSize = t.baseSize), t.budgets !== void 0 && (n.budgets = t.budgets), Gn(n, "sizeExact", e);
}
function ht(t, e) {
  const n = Ye(t, e), r = (o) => `${o} ${re(o, "grade")}`;
  switch (e.kind) {
    case "all":
      return Yt({ name: `𝒜${go(t)}`, words: `all reports on ${t} units` }, n);
    case "atMost":
      return Yt({ name: `𝒜_≤${e.G}`, words: `reports with at most ${r(e.G)}` }, n);
    case "exactly":
      return Yt({ name: `𝒜_=${e.G}`, words: `reports with exactly ${r(e.G)}` }, n);
    case "order": {
      let o = "𝒜ᵨ", i = "contiguous cuts of the declared order";
      return e.exact !== void 0 ? (o += `,=${e.exact}`, i += ` with exactly ${r(e.exact)}`) : e.G !== void 0 && (o += `,≤${e.G}`, i += ` with at most ${r(e.G)}`), e.blocks !== void 0 && e.blocks.some((s) => s > 1) && (i += ", equal order scores kept together"), Yt({ name: o, words: i }, n);
    }
    default:
      throw new RangeError("unknown family kind");
  }
}
function Wt(t, e) {
  if (Ye(t, e) === 0n) return !1;
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
function Ft(t, e) {
  return { empty: !0, family: t, containsAllWithheld: !1, label: e };
}
function wo(t, e) {
  if (t === void 0) return [];
  if (!Array.isArray(t)) throw new RangeError("pairConstrainedOptimum: stating must be a list of [i, j] pairs");
  const n = [], r = /* @__PURE__ */ new Set();
  for (const o of t) {
    if (!Array.isArray(o) || o.length !== 2 || !o.every((s) => typeof s == "number" && Number.isInteger(s) && s >= 0 && s < e) || o[0] === o[1])
      throw new RangeError(`pairConstrainedOptimum: each stating entry must be [i, j] with distinct unit indices in 0…${e - 1}`);
    const i = `${o[0]},${o[1]}`;
    r.has(i) || (r.add(i), n.push([o[0], o[1]]));
  }
  return n;
}
function le(t, e, n) {
  return Yt({
    name: n ? `𝒜_S (${t.name})` : t.name,
    words: n ? `${t.words} satisfying the stated pair directions` : t.words,
    baseSize: t.size
  }, e);
}
function po(t, e, n) {
  const r = e.blocks ?? new Array(t).fill(1), o = r.length, i = new Int32Array(t);
  let s = 0;
  r.forEach((f, m) => {
    for (let d = 0; d < f; d += 1) i[e.order[s++]] = m;
  });
  const a = new Int32Array(o + 1);
  for (const [f, m] of n) {
    const d = i[f], g = i[m];
    if (d >= g) return { minStart: a, size: 0n };
    a[g + 1] = Math.max(a[g + 1], d + 1);
  }
  for (let f = 1; f <= o; f += 1) a[f] = Math.max(a[f], a[f - 1]);
  const c = e.exact ?? Math.min(e.G ?? o, o);
  let u = new Array(o + 1).fill(0n);
  u[0] = 1n;
  let l = 0n;
  for (let f = 1; f <= c; f += 1) {
    const m = new Array(o + 2).fill(0n);
    for (let g = 0; g <= o; g += 1) m[g + 1] = m[g] + u[g];
    const d = new Array(o + 1).fill(0n);
    for (let g = f; g <= o; g += 1) d[g] = m[g] - m[a[g]];
    (e.exact === void 0 || e.exact === f) && (l += d[o]), u = d;
  }
  return { minStart: a, size: l };
}
function bo(t) {
  switch (t.kind) {
    case "order":
      return "Use fixedOrderDP for a declared order (any n).";
    case "all":
      return "Use fixedOrderDP for a declared order, or the browser solver for the unrestricted family.";
    default:
      return "Use fixedOrderDP for a declared order with this grade count (the browser solver takes the unrestricted family only).";
  }
}
function It(t, e, n) {
  const { maxReports: r, maxUnits: o } = lo, i = e.sizeExact, s = `${Zt(i)} ${re(i, "report")}`, a = `${e.name} (${e.words})`, c = n === void 0 ? "Use fixedOrderDP for a declared order." : bo(n);
  if (t > o)
    throw new RangeError(
      `exact enumeration covers at most ${o} units; ${a} is on n = ${t} ${re(t, "unit")} (${s}). ${c}`
    );
  if (i > BigInt(r))
    throw new RangeError(
      `exact enumeration covers at most ${Zt(r)} reports; ${a} has ${s} on n = ${t} ${re(t, "unit")}. ${c}`
    );
}
class Ge {
  constructor(e, n, r, o) {
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
    this.n = e, this.cap = n, this.exact = r, this.ch = o, this.C = o.length, this.g = new Int8Array(e), this.cnt = new Int32Array(n + 2), this.maxAt = new Int32Array(e + 1), this.Nd = new Int32Array(e + 1), this.Sd = new Float64Array((e + 1) * Math.max(this.C, 1));
  }
  sum(e) {
    return this.Sd[this.n * this.C + e];
  }
  uncount(e) {
    this.cnt[e] -= 1, this.cnt[e] === 0 && (this.distinct -= 1);
  }
  next() {
    if (this.state === 2) return !1;
    const { n: e, cap: n, exact: r, g: o, cnt: i, maxAt: s, Nd: a, Sd: c, C: u, ch: l } = this;
    let f;
    for (this.state === 0 ? (this.state = 1, f = 0, o[0] = 0) : (f = e - 1, this.uncount(o[f])); ; ) {
      const m = e - 1 - f, d = s[f];
      let g = o[f] + 1;
      for (; g <= n; g += 1) {
        const h = this.distinct + (i[g] === 0 ? 1 : 0);
        if (r > 0 ? r - h <= m : (g > d ? g : d) - h <= m) break;
      }
      if (g > n) {
        if (o[f] = 0, f === 0)
          return this.state = 2, !1;
        f -= 1, this.uncount(o[f]);
        continue;
      }
      o[f] = g, i[g] += 1, i[g] === 1 && (this.distinct += 1), s[f + 1] = g > d ? g : d;
      let w = a[f];
      if (u === 1) {
        const h = l[0];
        let p = c[f];
        for (let b = 0; b < f; b += 1) {
          const y = o[b];
          y !== g && (w += 1, p += y < g ? h[b * e + f] : h[f * e + b]);
        }
        c[f + 1] = p;
      } else {
        const h = f * u, p = h + u;
        for (let b = 0; b < u; b += 1) c[p + b] = c[h + b];
        for (let b = 0; b < f; b += 1) {
          const y = o[b];
          if (y === g) continue;
          w += 1;
          const N = y < g ? b * e + f : f * e + b;
          for (let I = 0; I < u; I += 1) c[p + I] += l[I][N];
        }
      }
      if (a[f + 1] = w, f === e - 1)
        return this.N = w, !0;
      f += 1, o[f] = 0;
    }
  }
}
class yo {
  constructor(e, n, r) {
    z(this, "g");
    z(this, "N", 0);
    z(this, "n");
    z(this, "list");
    z(this, "ch");
    z(this, "sums");
    z(this, "at", -1);
    this.n = e, this.list = n, this.ch = r, this.g = new Int8Array(e), this.sums = new Float64Array(Math.max(r.length, 1));
  }
  sum(e) {
    return this.sums[e];
  }
  next() {
    if (this.at += 1, this.at >= this.list.length) return !1;
    const { n: e, g: n, ch: r, sums: o } = this;
    n.set(this.list[this.at]);
    let i = 0;
    o.fill(0);
    for (let s = 0; s < e; s += 1)
      for (let a = s + 1; a < e; a += 1) {
        if (n[s] === n[a]) continue;
        i += 1;
        const c = n[s] < n[a] ? s * e + a : a * e + s;
        for (let u = 0; u < r.length; u += 1) o[u] += r[u][c];
      }
    return this.N = i, !0;
  }
}
function ue(t, e) {
  for (let n = 0; n < t.length; n += 1) if (t[n] !== e[n]) return t[n] - e[n];
  return 0;
}
function Io(t, e) {
  const n = e.blocks === void 0 ? new Array(t).fill(1) : Array.from(e.blocks), r = n.length, o = e.exact ?? 1, i = e.exact ?? Math.min(e.G ?? r, r), s = [];
  for (let a = 0; a < 2 ** (r - 1); a += 1) {
    let c = 1;
    for (let m = 0; m < r - 1; m += 1) a >> m & 1 && (c += 1);
    if (c < o || c > i) continue;
    const u = new Int8Array(t);
    let l = 1, f = 0;
    for (let m = 0; m < r; m += 1) {
      m > 0 && a >> m - 1 & 1 && (l += 1);
      for (let d = 0; d < n[m]; d += 1) u[e.order[f++]] = l;
    }
    s.push(u);
  }
  return s.sort(ue);
}
function At(t, e, n) {
  switch (e.kind) {
    case "all":
      return new Ge(t, t, 0, n);
    case "atMost":
      return new Ge(t, Math.min(e.G, t), 0, n);
    case "exactly":
      return new Ge(t, e.G, e.G, n);
    case "order":
      return new yo(t, Io(t, e), n);
    default:
      throw new RangeError("unknown family kind");
  }
}
function te(t) {
  return t ?? { kind: "all" };
}
function vo(t, e) {
  if (t == null) return null;
  if (!Array.isArray(t) || t.length !== e) throw new RangeError(`q must hold ${e} ${re(e, "budget")} (null for none)`);
  const n = t.map((r, o) => {
    if (r == null) return null;
    if (typeof r != "number" || !Number.isFinite(r) || r < 0) throw new RangeError(`q[${o}] must be finite and ≥ 0, or null`);
    return r;
  });
  return n.some((r) => r !== null) ? n : null;
}
class Ae {
  constructor(e, n) {
    /** the smallest value pushed so far */
    z(this, "best", Number.POSITIVE_INFINITY);
    z(this, "n");
    z(this, "tol");
    z(this, "prunedAt", Number.POSITIVE_INFINITY);
    z(this, "len", 0);
    z(this, "g");
    z(this, "z");
    this.n = e, this.tol = n, this.g = new Int8Array(16 * e), this.z = new Float64Array(16);
  }
  push(e, n) {
    if (n < this.best && (this.best = n, n < this.prunedAt - this.tol && (this.compact(), this.prunedAt = n)), n <= this.best + this.tol) {
      if (this.len === this.z.length) {
        const r = new Float64Array(this.z.length * 2);
        r.set(this.z), this.z = r;
        const o = new Int8Array(this.g.length * 2);
        o.set(this.g), this.g = o;
      }
      this.z[this.len] = n, this.g.set(e, this.len * this.n), this.len += 1;
    }
  }
  compact() {
    const e = this.best + this.tol;
    let n = 0;
    for (let r = 0; r < this.len; r += 1)
      this.z[r] <= e && (n !== r && (this.z[n] = this.z[r], this.g.copyWithin(n * this.n, r * this.n, (r + 1) * this.n)), n += 1);
    this.len = n;
  }
  /** Visit every tied report (a view into the buffer) in walk order. */
  forEach(e) {
    const n = this.best + this.tol;
    for (let r = 0; r < this.len; r += 1) this.z[r] <= n && e(this.g.subarray(r * this.n, (r + 1) * this.n), this.z[r]);
  }
  /** The number of tied reports. */
  count() {
    const e = this.best + this.tol;
    let n = 0;
    for (let r = 0; r < this.len; r += 1) this.z[r] <= e && (n += 1);
    return n;
  }
  /** The first `max` tied reports as grade vectors. */
  first(e) {
    const n = this.best + this.tol, r = [];
    for (let o = 0; o < this.len && r.length < e; o += 1) this.z[o] <= n && r.push(Array.from(this.g.subarray(o * this.n, (o + 1) * this.n)));
    return r;
  }
}
class tr {
  constructor(e, n, r) {
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
    this.n = e, this.k = n, this.tol = r, this.heap = new Float64Array(Math.min(n, 1 << 20)), this.g = new Int8Array(64 * e), this.z = new Float64Array(64);
  }
  threshold() {
    if (this.heapSize < this.k) return Number.POSITIVE_INFINITY;
    const e = this.heap[0];
    return e + this.tol * (1 + Math.abs(e));
  }
  heapPush(e) {
    const n = this.heap;
    if (this.heapSize < this.k && this.heapSize < n.length) {
      let i = this.heapSize++;
      for (n[i] = e; i > 0; ) {
        const s = i - 1 >> 1;
        if (n[s] >= n[i]) break;
        const a = n[s];
        n[s] = n[i], n[i] = a, i = s;
      }
      return;
    }
    if (this.heapSize < this.k || !(e < n[0])) return;
    n[0] = e;
    let r = 0;
    const o = this.heapSize;
    for (; ; ) {
      const i = 2 * r + 1, s = i + 1;
      let a = r;
      if (i < o && n[i] > n[a] && (a = i), s < o && n[s] > n[a] && (a = s), a === r) break;
      const c = n[a];
      n[a] = n[r], n[r] = c, r = a;
    }
  }
  push(e, n) {
    if (this.heapPush(n), n <= this.threshold()) {
      if (this.len === this.z.length && (this.compact(), this.len === this.z.length)) {
        const r = new Float64Array(this.z.length * 2);
        r.set(this.z), this.z = r;
        const o = new Int8Array(this.g.length * 2);
        o.set(this.g), this.g = o;
      }
      this.z[this.len] = n, this.g.set(e, this.len * this.n), this.len += 1, this.len >= this.compactAt && (this.compact(), this.compactAt = Math.max(1024, 2 * this.len));
    }
  }
  compact() {
    const e = this.threshold();
    let n = 0;
    for (let r = 0; r < this.len; r += 1)
      this.z[r] <= e && (n !== r && (this.z[n] = this.z[r], this.g.copyWithin(n * this.n, r * this.n, (r + 1) * this.n)), n += 1);
    this.len = n;
  }
  /** The first k reports in the greedy tolerant order: { grade, key }. */
  result() {
    this.compact();
    const e = this.len, n = this.z, r = Array.from({ length: e }, (f, m) => m).sort((f, m) => n[f] - n[m] || f - m), o = new Uint8Array(e), i = [], s = (f) => {
      let m = i.length;
      for (i.push(f); m > 0; ) {
        const d = m - 1 >> 1;
        if (i[d] <= i[m]) break;
        [i[d], i[m]] = [i[m], i[d]], m = d;
      }
    }, a = () => {
      const f = i[0], m = i.pop();
      if (i.length > 0) {
        i[0] = m;
        let d = 0;
        for (; ; ) {
          const g = 2 * d + 1, w = g + 1;
          let h = d;
          if (g < i.length && i[g] < i[h] && (h = g), w < i.length && i[w] < i[h] && (h = w), h === d) break;
          [i[h], i[d]] = [i[d], i[h]], d = h;
        }
      }
      return f;
    }, c = [];
    let u = 0, l = 0;
    for (; c.length < this.k && c.length < e; ) {
      for (; o[r[u]]; ) u += 1;
      const f = n[r[u]], m = f + this.tol * (1 + Math.abs(f));
      for (; l < e && n[r[l]] <= m; ) s(r[l++]);
      const d = a();
      o[d] = 1, c.push({ grade: Array.from(this.g.subarray(d * this.n, (d + 1) * this.n)), key: n[d] });
    }
    return c;
  }
}
function er(t, e) {
  const n = t ?? 1;
  if (typeof n != "number" || !Number.isSafeInteger(n) || n < 1) throw new RangeError(`${e}: k must be an integer ≥ 1, got ${String(n)}`);
  return n;
}
function Eo(t, e) {
  const n = [];
  for (let r = 1; r < e.length; r += 1) t[e[r]] !== t[e[r - 1]] && n.push(r);
  return n;
}
function Ao(t, e) {
  if (t.length !== e.length) return t.length < e.length;
  for (let n = 0; n < t.length; n += 1) if (t[n] !== e[n]) return t[n] < e[n];
  return !1;
}
function nr(t, e, n, r, o) {
  const { n: i, M: s } = t, a = n * s, c = new Float64Array(s + 1).fill(Number.POSITIVE_INFINITY), u = new Float64Array(s + 1).fill(Number.NEGATIVE_INFINITY), l = new Float64Array(s + 1), f = new Float64Array(s + 1), m = new Int32Array(s + 1), d = new Int8Array((s + 1) * i), g = new Int8Array((s + 1) * i), w = new Uint8Array(s + 1), h = new Uint8Array(s + 1);
  let p = !1;
  const b = r ? [] : null, y = At(i, e, [t.ebar]);
  for (; y.next(); ) {
    const I = y.N, E = y.sum(0);
    if (m[I] += 1, m[I] === 1)
      c[I] = E, u[I] = E, l[I] = E, f[I] = E, d.set(y.g, I * i), g.set(y.g, I * i);
    else {
      const v = c[I];
      E < v && (c[I] = E, (E < v - a || l[I] > E + a) && (E < v - a || (w[I] = 1, p = !0), l[I] = E, d.set(y.g, I * i)));
      const $ = u[I];
      E > $ && (u[I] = E, (E > $ + a || f[I] < E - a) && (E > $ + a || (h[I] = 1, p = !0), f[I] = E, g.set(y.g, I * i)));
    }
    b && b.push({ grade: Array.from(y.g), N: I, Ew: E }), o && o.push(y.g, E - 0.5 * I);
  }
  if (p) {
    const I = new Uint8Array(s + 1), E = new Uint8Array(s + 1), v = At(i, e, [t.ebar]);
    for (; v.next(); ) {
      const $ = v.N, A = v.sum(0);
      w[$] && !I[$] && A <= c[$] + a && (d.set(v.g, $ * i), I[$] = 1), h[$] && !E[$] && A >= u[$] - a && (g.set(v.g, $ * i), E[$] = 1);
    }
  }
  const N = [];
  for (let I = 0; I <= s; I += 1)
    m[I] !== 0 && N.push({
      N: I,
      minEw: c[I],
      maxEw: u[I],
      count: m[I],
      minGrade: Array.from(d.subarray(I * i, I * i + i)),
      maxGrade: Array.from(g.subarray(I * i, I * i + i))
    });
  return { rows: N, points: b };
}
function Ne(t, e, n) {
  const r = [];
  for (let o = 0; o < t.length; o += 1) {
    for (; r.length >= 2; ) {
      const i = r[r.length - 2], s = r[r.length - 1], c = ((t[s] - t[i]) * (e[o] - e[i]) - (e[s] - e[i]) * (t[o] - t[i])) / (t[o] - t[i]), u = n ?? 1e-12 * Math.max(1, Math.abs(e[i]), Math.abs(e[o]));
      if (c > u) break;
      r.pop();
    }
    r.push(o);
  }
  return r;
}
function No(t, e, n) {
  for (let r = 0; r < t.length; r += 1) if (t[r] !== n[r]) return t[r] < n[r];
  return e < n[t.length];
}
const $o = ["order", "G", "exact", "blocks", "family", "scores", "direction", "ids"];
function rr(t, e, n, r) {
  let o = e.order, i = e.blocks;
  if (e.scores !== void 0) {
    if (o !== void 0 || i !== void 0) throw new RangeError(`${r}: give scores, or order with blocks, not both`);
    if (e.scores?.length !== t) throw new RangeError(`${r}: scores must have one value per unit (${t})`);
    const u = e.ids ?? (Array.isArray(n?.ids) && n.ids.length === t ? n.ids : void 0), l = ao(e.scores, { direction: e.direction, ids: u });
    o = l.order, i = l.blocks;
  } else if (e.direction !== void 0 || e.ids !== void 0)
    throw new RangeError(`${r}: direction and ids apply only together with scores`);
  let s = e.G, a = e.exact;
  const c = e.family;
  if (c !== void 0) {
    if (c === null || typeof c != "object") throw new RangeError(`${r}: family must be a family object`);
    switch (c.kind) {
      case "order":
        if (Dt(c, ["kind", "order", "G", "exact", "blocks"], `${r}: family { kind: "order" }`), o !== void 0) throw new RangeError(`${r}: the order is given twice (family.order, and order or scores)`);
        if (s !== void 0 || a !== void 0 || i !== void 0)
          throw new RangeError(`${r}: give G, exact and blocks inside family { kind: "order" } or at the top level, not both`);
        o = c.order, s = c.G, a = c.exact, i = c.blocks;
        break;
      case "atMost":
      case "exactly":
        if (Dt(c, ["kind", "G"], `${r}: family { kind: "${c.kind}" }`), s !== void 0 || a !== void 0) throw new RangeError(`${r}: the grade count is given twice (family and G or exact)`);
        c.kind === "atMost" ? s = c.G : a = c.G;
        break;
      case "all":
        Dt(c, ["kind"], `${r}: family { kind: "all" }`);
        break;
      default:
        throw new RangeError(`${r}: unknown family kind ${String(c.kind)}`);
    }
  }
  if (o === void 0) throw new RangeError(`${r} needs a declared order: order, scores, or family { kind: "order", order }`);
  return {
    kind: "order",
    order: o,
    ...s !== void 0 ? { G: s } : {},
    ...a !== void 0 ? { exact: a } : {},
    ...i !== void 0 ? { blocks: i } : {}
  };
}
function Nn(t, e = { kind: "all" }, n = {}) {
  const r = R(n, ["reuse"], "enumerateReports"), o = ht(t, e);
  o.sizeExact !== 0n && It(t, o, e);
  const i = r.reuse === !0;
  function* s() {
    if (o.sizeExact === 0n) return;
    const a = At(t, e, []);
    for (; a.next(); ) yield i ? a.g : a.g.slice();
  }
  return s();
}
function Ct(t, e) {
  const n = R(e, ["tau", "w", "family", "q", "tieTol", "maxTies"], "exactOptimum", !0), r = Z(n.tau), o = lt(t, n.w), { n: i, M: s } = o, a = te(n.family), c = it(n.tieTol, "tieTol"), u = Ot(n.maxTies, "exactOptimum"), l = ht(i, a), f = vo(n.q, o.K), m = (I) => f === null ? l : Yt(
    {
      name: `𝒜_q (${l.name})`,
      words: `${l.words} that meet the error budgets E_k ≤ q_k N`,
      baseSize: l.size,
      budgets: [...f]
    },
    BigInt(I)
  ), d = () => Ft(m(0), "exact-within-family");
  if (l.sizeExact === 0n) return d();
  It(i, l, a);
  const g = [];
  f && f.forEach((I, E) => I !== null && g.push(E));
  const w = At(i, a, [o.ebar, ...g.map((I) => o.ek[I])]), h = new Ae(i, c * s);
  let p = 0;
  for (; w.next(); ) {
    const I = w.N;
    if (g.length > 0) {
      let E = !0;
      for (let v = 0; v < g.length; v += 1)
        if (w.sum(v + 1) > f[g[v]] * I + fo) {
          E = !1;
          break;
        }
      if (!E) continue;
    }
    p += 1, h.push(w.g, w.sum(0) - r * I);
  }
  if (p === 0) return d();
  const b = h.first(u);
  let y = b[0];
  if (a.kind === "order") {
    let I = null;
    h.forEach((E) => {
      const v = Eo(E, a.order);
      (I === null || Ao(v, I)) && (I = v, y = Array.from(E));
    });
  }
  const N = H(y, t, { tau: r, w: o.w });
  return {
    empty: !1,
    grade: y,
    grades: b,
    tieCount: h.count(),
    risk: N.risk,
    N: N.N,
    G: N.G,
    Ew: N.Ew,
    E: N.E,
    EoverN: N.EoverN,
    evaluation: N,
    family: m(p),
    containsAllWithheld: Wt(i, a),
    tieTol: c,
    label: "exact-within-family"
  };
}
function Bi(t, e) {
  const n = R(e, ["tau", "w", "family", "stating", "tieTol", "maxTies"], "pairConstrainedOptimum", !0), r = Z(n.tau), o = lt(t, n.w), { n: i, M: s } = o, a = te(n.family), c = it(n.tieTol, "tieTol"), u = Ot(n.maxTies, "pairConstrainedOptimum"), l = wo(n.stating, i), f = ht(i, a), m = (N) => Object.assign(N, {
    family: le(f, N.family.sizeExact, l.length > 0),
    baseFamily: f,
    stating: l
  });
  if (a.kind === "order") return m(or(t, o, r, a, c, u, !1, l));
  if (l.length === 0) return m(Ct(t, { tau: r, w: o.w, family: a, tieTol: c, maxTies: u }));
  const d = () => m(Ft(le(f, 0n, !0), "exact-within-family"));
  if (f.sizeExact === 0n) return d();
  It(i, f, a);
  const g = At(i, a, [o.ebar]), w = new Ae(i, c * s);
  let h = 0n;
  for (; g.next(); )
    l.every(([N, I]) => g.g[N] < g.g[I]) && (h += 1n, w.push(g.g, g.sum(0) - r * g.N));
  if (h === 0n) return d();
  const p = w.first(u), b = p[0], y = H(b, t, { tau: r, w: o.w });
  return m({
    empty: !1,
    grade: b,
    grades: p,
    tieCount: w.count(),
    risk: y.risk,
    N: y.N,
    G: y.G,
    Ew: y.Ew,
    E: y.E,
    EoverN: y.EoverN,
    evaluation: y,
    family: le(f, h, !0),
    containsAllWithheld: !1,
    tieTol: c,
    label: "exact-within-family"
  });
}
function ko(t, e) {
  const n = R(e, [...$o, "tau", "w", "trace", "tieTol", "maxTies"], "fixedOrderDP", !0), r = Z(n.tau), o = lt(t, n.w), i = it(n.tieTol, "tieTol"), s = Ot(n.maxTies, "fixedOrderDP"), a = rr(o.n, n, t, "fixedOrderDP");
  return or(t, o, r, a, i, s, n.trace === !0);
}
function or(t, e, n, r, o, i, s, a = []) {
  const { n: c, M: u, ebar: l } = e, f = ht(c, r), m = a.length > 0 && f.sizeExact > 0n ? po(c, r, a) : null, d = a.length > 0 ? le(f, m?.size ?? 0n, !0) : f;
  if (d.sizeExact === 0n) return Ft(d, "optimal-within-order");
  const g = Array.from(r.order), w = r.blocks === void 0 ? new Array(c).fill(1) : Array.from(r.blocks), h = w.length, p = [0];
  for (const M of w) p.push(p[p.length - 1] + M);
  const b = c + 1, y = new Float64Array(b * b);
  for (let M = 1; M <= c; M += 1) {
    const O = g[M - 1];
    let q = 0;
    for (let T = M - 1; T >= 0; T -= 1)
      y[T * b + M] = y[T * b + M - 1] + q, T >= 1 && (q += l[g[T - 1] * c + O] - n);
  }
  const N = y[c], I = (M, O) => y[p[M] * b + p[O]], E = r.exact, v = E ?? Math.min(r.G ?? h, h), $ = o * u, A = Array.from({ length: v + 1 }, () => new Float64Array(h + 1).fill(Number.NEGATIVE_INFINITY)), k = Array.from({ length: v + 1 }, () => new Int32Array(h + 1).fill(-1)), C = Array.from({ length: v + 1 }, () => new Array(h + 1).fill(null));
  A[0][0] = 0, C[0][0] = new Int32Array(0);
  for (let M = 1; M <= v; M += 1)
    for (let O = M; O <= h; O += 1) {
      let q = Number.NEGATIVE_INFINITY, T = -1;
      for (let P = M - 1; P < O; P += 1) {
        if (m !== null && P < m.minStart[O]) continue;
        const ft = A[M - 1][P];
        if (ft === Number.NEGATIVE_INFINITY) continue;
        const L = ft + I(P, O);
        let pt = T < 0 || L > q + $;
        if (!pt && M >= 2 && L >= q - $ && (pt = No(C[M - 1][P], P, C[M][O])), pt)
          if (q = L, T = P, M >= 2) {
            const xt = C[M - 1][P], $t = new Int32Array(M - 1);
            $t.set(xt), $t[M - 2] = P, C[M][O] = $t;
          } else C[M][O] = new Int32Array(0);
      }
      A[M][O] = q, k[M][O] = T;
    }
  let j, V = Number.NEGATIVE_INFINITY;
  const D = [];
  if (E !== void 0)
    j = E, D.push(E);
  else {
    for (let M = 1; M <= v; M += 1) A[M][h] > V && (V = A[M][h]);
    for (let M = 1; M <= v; M += 1) A[M][h] >= V - $ && D.push(M);
    j = D[0];
  }
  const U = Array.from(C[j][h]), et = U.map((M) => p[M]), F = (M) => {
    const O = new Array(c);
    let q = 0;
    for (let T = 0; T < h; T += 1) {
      q < M.length && M[q] === T && (q += 1);
      for (let P = p[T]; P < p[T + 1]; P += 1) O[g[P]] = q + 1;
    }
    return O;
  }, x = F(U), G = (M, O, q) => {
    if (m !== null && O < m.minStart[q]) return !1;
    const T = A[M - 1][O];
    return T !== Number.NEGATIVE_INFINITY && T + I(O, q) >= A[M][q] - $;
  }, _ = (() => {
    let M = Array.from({ length: v + 1 }, () => new Float64Array(h + 1));
    M[0][0] = 1;
    let O = !1;
    for (let T = 1; T <= v && !O; T += 1)
      for (let P = T; P <= h; P += 1) {
        if (A[T][P] === Number.NEGATIVE_INFINITY) continue;
        let ft = 0;
        for (let L = T - 1; L < P; L += 1) M[T - 1][L] > 0 && G(T, L, P) && (ft += M[T - 1][L]);
        M[T][P] = ft, ft > 2 ** 52 && (O = !0);
      }
    if (!O) return D.reduce((T, P) => T + BigInt(M[P][h]), 0n);
    M = [];
    const q = Array.from({ length: v + 1 }, () => new Array(h + 1).fill(0n));
    q[0][0] = 1n;
    for (let T = 1; T <= v; T += 1)
      for (let P = T; P <= h; P += 1) {
        if (A[T][P] === Number.NEGATIVE_INFINITY) continue;
        let ft = 0n;
        for (let L = T - 1; L < P; L += 1) q[T - 1][L] > 0n && G(T, L, P) && (ft += q[T - 1][L]);
        q[T][P] = ft;
      }
    return D.reduce((T, P) => T + q[P][h], 0n);
  })(), W = (M) => {
    for (const O of D) {
      const q = Array.from({ length: O + 1 }, () => new Uint8Array(h + 1));
      q[O][h] = 1;
      for (let L = O; L >= 1; L -= 1)
        for (let pt = L; pt <= h; pt += 1)
          if (q[L][pt])
            for (let xt = L - 1; xt < pt; xt += 1) G(L, xt, pt) && (q[L - 1][xt] = 1);
      const T = new Int32Array(Math.max(O - 1, 0));
      let P = !1;
      const ft = (L, pt) => {
        if (L === O) {
          M(T) || (P = !0);
          return;
        }
        const xt = L + 1 === O;
        for (let $t = xt ? h : pt + 1; $t <= h && !P; $t += 1)
          !q[L + 1][$t] || !G(L + 1, pt, $t) || (xt || (T[L] = $t), ft(L + 1, $t));
      };
      if (ft(0, 0), P) return;
    }
  };
  let Y = [], Q;
  if (_ * BigInt(c) <= mo)
    W((M) => {
      const O = F(M);
      if (Y.length >= i && ue(O, Y[Y.length - 1]) >= 0) return !0;
      let q = 0, T = Y.length;
      for (; q < T; ) {
        const P = q + T >> 1;
        ue(Y[P], O) < 0 ? q = P + 1 : T = P;
      }
      return Y.splice(q, 0, O), Y.length > i && Y.pop(), !0;
    }), Q = "lexicographic";
  else {
    const M = Math.min(i, Math.max(1, Math.floor(2e6 / c)));
    W((q) => (Y.push(F(q)), Y.length < M));
    const O = Y.findIndex((q) => ue(q, x) === 0);
    O !== 0 && (O > 0 && Y.splice(O, 1), Y.unshift(x), Y.length > M && Y.pop()), Q = "package";
  }
  const ut = H(x, t, { tau: n, w: e.w }), gt = {
    empty: !1,
    grade: x,
    grades: Y,
    gradesOrder: Q,
    tieCount: jn(_),
    risk: ut.risk,
    N: ut.N,
    G: ut.G,
    Ew: ut.Ew,
    E: ut.E,
    EoverN: ut.EoverN,
    evaluation: ut,
    order: g,
    blocks: w,
    cuts: et,
    blockCuts: U,
    saving: A[j][h],
    family: d,
    containsAllWithheld: a.length === 0 && Wt(c, r),
    tieTol: o,
    label: "optimal-within-order"
  };
  if (Gn(gt, "tieCountExact", _), s) {
    const M = (T) => T === Number.NEGATIVE_INFINITY ? null : T, O = [];
    let q = h;
    for (let T = j; T >= 1; T -= 1)
      O.push({ h: T, c: q }), q = k[T][q];
    O.push({ h: 0, c: 0 }), O.reverse(), gt.trace = {
      M: u,
      T: N,
      blocks: w,
      boundaries: p,
      W: Array.from({ length: h + 1 }, (T, P) => Array.from({ length: h + 1 }, (ft, L) => P <= L ? I(P, L) : null)),
      V: A.map((T) => Array.from(T, M)),
      pred: k.map((T, P) => Array.from(T, (ft, L) => P === 0 || A[P][L] === Number.NEGATIVE_INFINITY ? null : ft)),
      riskByG: Array.from({ length: v + 1 }, (T, P) => P === 0 || A[P][h] === Number.NEGATIVE_INFINITY ? null : n + (N - A[P][h]) / u),
      chosenG: j,
      path: O
    };
  }
  return gt;
}
function Li(t, e = {}) {
  const n = R(e, ["w", "family", "tieTol", "maxTies"], "tauPath"), r = lt(t, n.w), { n: o, M: i } = r, s = te(n.family), a = it(n.tieTol, "tieTol"), c = Ot(n.maxTies, "tauPath"), u = ht(o, s);
  if (u.sizeExact === 0n) return Ft(u, "exact-within-family");
  It(o, u, s);
  const l = a * i, f = new Ae(o, l), { rows: m } = nr(r, s, a, !1, f), g = Ne(
    m.map((I) => I.N),
    m.map((I) => I.minEw),
    l
  ).map((I) => {
    const E = m[I].minGrade;
    return { grade: E, ev: H(E, t, { tau: 0.5, w: r.w }) };
  }), w = (I) => (g[I].ev.Ew - g[I - 1].ev.Ew) / (g[I].ev.N - g[I - 1].ev.N), h = (I, E, v) => {
    const { grade: $, ev: A } = g[I];
    return {
      tauFrom: E,
      tauTo: v,
      grade: $,
      N: A.N,
      G: A.G,
      Ew: A.Ew,
      E: A.E,
      EoverN: A.EoverN,
      EwOverN: A.N === 0 ? null : A.Ew / A.N,
      riskFrom: (A.Ew + E * (i - A.N)) / i,
      riskTo: (A.Ew + v * (i - A.N)) / i
    };
  }, p = g.map((I) => I.ev.Ew - 0.5 * I.ev.N), b = Math.min(...p), y = [];
  let N = -1;
  for (let I = 0; I < g.length; I += 1) {
    const E = I === 0 ? 0 : Math.max(0, w(I)), v = I === g.length - 1 ? 0.5 : Math.min(0.5, w(I + 1));
    E < v && (y.push(h(I, E, v)), N = I);
  }
  for (let I = N + 1; I < g.length; I += 1) p[I] <= b + l && y.push(h(I, 0.5, 0.5));
  return {
    empty: !1,
    intervals: y,
    endpointOptima: f.first(c),
    endpointTieCount: f.count(),
    family: u,
    containsAllWithheld: Wt(o, s),
    tieTol: a,
    label: "exact-within-family"
  };
}
function ir(t, e, n) {
  const { n: r } = t, o = new Float64Array(n), i = new Float64Array(n), s = new Int32Array(n), a = new Int8Array(n * r), c = At(r, e, [t.ek[0], t.ek[1]]);
  let u = 0;
  for (; c.next(); )
    o[u] = c.sum(0), i[u] = c.sum(1), s[u] = c.N, a.set(c.g, u * r), u += 1;
  return { E1: o, E2: i, Ns: s, G8: a, r: u };
}
function Vi(t, e) {
  const n = R(e, ["tau", "family", "grid", "tieTol", "maxTies"], "weightPath", !0), r = Z(n.tau);
  if ((Array.isArray(t?.e) ? t.e.length : 0) !== 2) throw new RangeError("weightPath needs two criteria (K = 2)");
  const i = lt(t, [0.5, 0.5]), { n: s, M: a } = i, c = te(n.family), u = it(n.tieTol, "tieTol"), l = Ot(n.maxTies, "weightPath"), f = n.grid === void 0 ? Array.from({ length: 21 }, (y, N) => N / 20) : Array.from(n.grid);
  if (f.length < 1 || !f.every((y) => typeof y == "number" && y >= 0 && y <= 1))
    throw new RangeError("grid must hold first-criterion weights in [0, 1]");
  const m = ht(s, c);
  if (m.sizeExact === 0n) return Ft(m, "exact-within-family");
  It(s, m, c);
  const { E1: d, E2: g, Ns: w, G8: h, r: p } = ir(i, c, Number(m.sizeExact)), b = u * a;
  return f.map((y) => {
    const N = 1 - y;
    let I = Number.POSITIVE_INFINITY;
    for (let A = 0; A < p; A += 1) {
      const k = y * d[A] + N * g[A] - r * w[A];
      k < I && (I = k);
    }
    const E = [];
    let v = 0;
    for (let A = 0; A < p; A += 1)
      y * d[A] + N * g[A] - r * w[A] <= I + b && (v += 1, E.length < l && E.push(Array.from(h.subarray(A * s, A * s + s))));
    const $ = H(E[0], t, { tau: r, w: [y, N] });
    return { w1: y, w: [y, N], grade: E[0], grades: E, tieCount: v, risk: $.risk, N: $.N, G: $.G, Ew: $.Ew, E: $.E, EoverN: $.EoverN };
  });
}
function Ro(t, e) {
  const n = /* @__PURE__ */ new Map(), r = (a, c) => n.set(a, Math.min(n.get(a) ?? Number.POSITIVE_INFINITY, c));
  for (const a of t)
    r(a.wFrom, a.riskFrom), r(a.wTo, a.riskTo);
  let o = Number.NEGATIVE_INFINITY;
  for (const a of n.values()) o = Math.max(o, a);
  const i = [];
  for (const [a, c] of n) c >= o - e && i.push({ from: a, to: a });
  for (const a of t)
    a.wFrom < a.wTo && a.E[0] === a.E[1] && n.get(a.wFrom) >= o - e && n.get(a.wTo) >= o - e && i.push({ from: a.wFrom, to: a.wTo });
  i.sort((a, c) => a.from - c.from || a.to - c.to);
  const s = [];
  for (const a of i) {
    const c = s[s.length - 1];
    c !== void 0 && a.from <= c.to ? c.to = Math.max(c.to, a.to) : s.push({ ...a });
  }
  return { risk: o, intervals: s, tieTol: e };
}
function Wi(t, e) {
  const n = R(e, ["tau", "family", "tieTol"], "weightBreakpoints", !0), r = Z(n.tau);
  if ((Array.isArray(t?.e) ? t.e.length : 0) !== 2) throw new RangeError("weightBreakpoints needs two criteria (K = 2)");
  const i = lt(t, [0.5, 0.5]), { n: s, M: a } = i, c = te(n.family), u = it(n.tieTol, "tieTol"), l = ht(s, c);
  if (l.sizeExact === 0n) return Ft(l, "exact-within-family");
  It(s, l, c);
  const { E1: f, E2: m, Ns: d, G8: g, r: w } = ir(i, c, Number(l.sizeExact)), h = u * a, p = new Float64Array(w), b = new Float64Array(w);
  for (let F = 0; F < w; F += 1)
    p[F] = m[F] - f[F], b[F] = m[F] - r * d[F];
  const y = Uint32Array.from({ length: w }, (F, x) => x).sort((F, x) => p[F] - p[x] || b[F] - b[x] || F - x), N = [], I = [], E = [];
  for (let F = 0; F < w; ) {
    let x = F, G = F;
    for (; x < w && p[y[x]] - p[y[F]] <= h; )
      b[y[x]] < b[y[G]] && (G = x), x += 1;
    let B = y[G];
    for (let _ = F; _ < x; _ += 1) b[y[_]] <= b[y[G]] + h && y[_] < B && (B = y[_]);
    N.push(p[B]), I.push(b[B]), E.push(B), F = x;
  }
  const v = Ne(N, I, h), $ = (F, x) => I[v[F]] - x * N[v[F]], A = (F) => (I[v[F]] - I[v[F - 1]]) / (N[v[F]] - N[v[F - 1]]), k = (F, x, G) => {
    const B = E[v[F]], _ = Array.from(g.subarray(B * s, B * s + s)), W = H(_, t, { tau: r, w: [0.5, 0.5] }), Y = (Q) => (Q * W.E[0] + (1 - Q) * W.E[1] + r * (a - W.N)) / a;
    return { wFrom: x, wTo: G, grade: _, N: W.N, G: W.G, E: W.E, EoverN: W.EoverN, riskFrom: Y(x), riskTo: Y(G) };
  }, C = Math.min(...v.map((F, x) => $(x, 0))), j = Math.min(...v.map((F, x) => $(x, 1))), V = [], D = [], U = [];
  for (let F = 0; F < v.length; F += 1) {
    const x = F === 0 ? 0 : Math.max(0, A(F)), G = F === v.length - 1 ? 1 : Math.min(1, A(F + 1));
    x < G ? D.push(k(F, x, G)) : G <= 0 && $(F, 0) <= C + h ? V.push(k(F, 0, 0)) : x >= 1 && $(F, 1) <= j + h && U.push(k(F, 1, 1));
  }
  const et = [...V, ...D, ...U];
  return {
    empty: !1,
    intervals: et,
    breakpoints: D.slice(1).map((F) => F.wFrom),
    envelopeMaximum: Ro(et, u),
    tau: r,
    family: l,
    containsAllWithheld: Wt(s, c),
    tieTol: u,
    label: "exact-within-family"
  };
}
function Ui(t, e) {
  const n = R(e, ["tau", "w", "family", "k", "stating", "tieTol"], "bestReports", !0), r = Z(n.tau), o = lt(t, n.w), { n: i, M: s } = o, a = te(n.family), c = er(n.k, "bestReports"), u = it(n.tieTol, "tieTol"), l = n.stating ?? [];
  if (!Array.isArray(l)) throw new RangeError("bestReports: stating must be a list of [i, j] pairs");
  const f = [], m = [];
  for (const I of l) {
    if (!(Array.isArray(I) && I.length === 2 && I.every((v) => typeof v == "number" && Number.isInteger(v) && v >= 0 && v < i) && I[0] !== I[1])) throw new RangeError(`bestReports: each stating entry must be [i, j] with distinct unit indices in 0…${i - 1}`);
    f.push(I[0]), m.push(I[1]);
  }
  const d = ht(i, a), g = (I, E) => ({ family: d, matched: I, reports: E, tieTol: u, label: "exact-within-family" });
  if (d.sizeExact === 0n) return g(0, []);
  It(i, d, a);
  const w = At(i, a, [o.ebar]), h = new tr(i, c, u), p = f.length, b = w.g;
  let y = 0;
  for (; w.next(); ) {
    let I = !0;
    for (let v = 0; v < p; v += 1)
      if (!(b[f[v]] < b[m[v]])) {
        I = !1;
        break;
      }
    if (!I) continue;
    y += 1;
    const E = w.N;
    h.push(b, (w.sum(0) + r * (s - E)) / s);
  }
  const N = h.result().map(({ grade: I }) => {
    const E = H(I, t, { tau: r, w: o.w });
    return { grade: I, risk: E.risk, N: E.N, Ew: E.Ew };
  });
  return g(y, N);
}
function sr(t, e) {
  const n = t.lambda !== void 0, r = t.tau !== void 0;
  if (n === r) throw new RangeError(`${e}: give exactly one numeric axis, lambda or tau`);
  let o, i;
  if (n) {
    if (o = t.lambda, typeof o != "number" || !Number.isFinite(o)) throw new RangeError(`${e}: lambda must be finite and in (0, 1]`);
    i = eo(o);
  } else {
    if (i = t.tau, typeof i != "number" || !Number.isFinite(i)) throw new RangeError(`${e}: tau must be finite and in (0, 1/2]`);
    o = no(i);
  }
  return { lambda: o, tau: i, cut: 1 / (1 + o), informedShare: 1 - 2 * i, slope: (1 - o) / o };
}
function Yi(t) {
  return sr(R(t, ["lambda", "tau"], "krwBridgeParameters", !0), "krwBridgeParameters");
}
function Hi(t, e) {
  const n = R(e, ["lambda", "tau", "family", "tieTol", "maxTies", "tieFree", "t"], "krwCorrespondence", !0), r = sr(n, "krwCorrespondence");
  if (n.tieFree !== !0) throw new RangeError("krwCorrespondence requires explicit tieFree: true");
  if (n.tieTol !== void 0 && (typeof n.tieTol != "number" || !Number.isFinite(n.tieTol) || n.tieTol < 0))
    throw new RangeError("krwCorrespondence: tieTol must be a finite number ≥ 0");
  if (n.maxTies !== void 0 && (!Number.isSafeInteger(n.maxTies) || n.maxTies < 1))
    throw new RangeError("krwCorrespondence: maxTies must be a positive integer");
  const { n: o, K: i, e: s } = rt(t);
  if (i !== 1) throw new RangeError("krwCorrespondence takes one criterion (K = 1)");
  for (let $ = 0; $ < o; $ += 1) for (let A = 0; A < o; A += 1) if ($ !== A) {
    if (s[0][$][A] < 0 || s[0][$][A] > 1) throw new RangeError("krwCorrespondence: off-diagonal probabilities must lie in [0, 1]");
    if (A > $ && Math.abs(s[0][$][A] + s[0][A][$] - 1) > 1e-12)
      throw new RangeError("krwCorrespondence: reverse probabilities must be complements within 1e-12");
  }
  const a = { lambda: r.lambda };
  if (n.t !== void 0) {
    const $ = oe(n.t, "t");
    if ($.n !== o || $.K !== i) throw new RangeError("krwCorrespondence: t must have the same shape as E.e");
    for (let A = 0; A < o; A += 1) for (let k = 0; k < o; k += 1) if (A !== k && (n.t[0][A][k] < 0 || n.t[0][A][k] > 1))
      throw new RangeError("krwCorrespondence: off-diagonal equality probabilities must lie in [0, 1]");
    qe(new Array(o).fill(1), t, { ...a, t: n.t }), a.t = n.t;
  }
  const c = n.family ?? { kind: "all" }, { tau: u } = r, l = Ct(t, { tau: u, family: c, tieTol: n.tieTol, maxTies: 1 / 0 });
  if (l.empty) return { parameters: r, family: l.family, reportsEnumerated: 0, postrank: l, krw: null, sameFullSet: null, maxAffineResidual: null };
  const f = n.maxTies ?? 100, m = { ...l, grades: l.grades.slice(0, f) }, d = Number(m.family.size), g = new Float64Array(d);
  let w = 0, h = 1 / 0, p = 0;
  for (const $ of Nn(o, c, { reuse: !0 })) {
    const A = H($, t, { tau: u }).risk, k = qe($, t, a);
    g[w] = k, ++w, k < h && (h = k), p = Math.max(p, Math.abs(A - (u + (1 - u) * k)));
  }
  const b = m.tieTol / (1 - u), y = [];
  let N = 0, I = !0, E = 0, v = 0;
  for (const $ of Nn(o, c, { reuse: !0 })) {
    const A = g[E] - h <= b, k = l.grades[v], C = k !== void 0 && $.every((j, V) => j === k[V]);
    C && ++v, A !== C && (I = !1), A && (++N, y.length < f && y.push(Array.from($))), ++E;
  }
  return {
    parameters: r,
    family: m.family,
    reportsEnumerated: w,
    postrank: m,
    krw: { grade: y[0], grades: y, tieCount: N, minRisk: h, tieTol: b },
    sameFullSet: I,
    maxAffineResidual: p
  };
}
const xo = Object.freeze({
  maxUnitsUncapped: 150,
  maxCells: 5e7
});
function Zi(t, e = {}) {
  const n = R(e, ["w", "family", "tieTol"], "reportCloud"), r = lt(t, n.w), o = n.family ?? { kind: "all" }, i = it(n.tieTol, "tieTol"), s = ht(r.n, o);
  if (s.sizeExact === 0n) return Ft(s, "exact-within-family");
  It(r.n, s, o);
  const { rows: a, points: c } = nr(r, o, i, s.sizeExact <= BigInt(He));
  return {
    empty: !1,
    n: r.n,
    M: r.M,
    K: r.K,
    w: r.w,
    family: s,
    containsAllWithheld: Wt(r.n, o),
    byN: a,
    points: c,
    tieTol: i,
    label: "exact-within-family"
  };
}
function Mo(t) {
  if (!Array.isArray(t) && t?.empty === !0) return [];
  const e = Array.isArray(t) ? t : t?.byN;
  if (!Array.isArray(e)) throw new RangeError("lowerHull needs a reportCloud() result or an array of { N, Ew } points");
  const n = /* @__PURE__ */ new Map();
  for (const [r, o] of e.entries()) {
    const i = o?.N, s = o?.minEw ?? o?.Ew;
    if (typeof i != "number" || !Number.isFinite(i) || typeof s != "number" || !Number.isFinite(s))
      throw new RangeError(`point ${r} must have finite N and Ew (or minEw)`);
    const a = o.minGrade ?? o.grade ?? null, c = n.get(i);
    (c === void 0 || s < c.Ew) && n.set(i, { N: i, Ew: s, grade: a === null ? null : Array.from(a) });
  }
  return [...n.values()].sort((r, o) => r.N - o.N);
}
function ar(t, e, n) {
  if (t !== void 0) {
    if (typeof t != "number" || !Number.isSafeInteger(t) || t < 1) throw new RangeError("M must be a positive integer (n(n − 1)/2)");
    return t;
  }
  const r = e?.M;
  if (!Array.isArray(e) && typeof r == "number") return r;
  const o = n.find((i) => Array.isArray(i.grade))?.grade;
  return o ? Vt(o.length) : null;
}
function Qi(t, e = {}) {
  const n = R(e, ["tieTol", "M"], "lowerHull"), r = it(n.tieTol, "tieTol"), o = Mo(t), i = ar(n.M, t, o);
  return Ne(
    o.map((s) => s.N),
    o.map((s) => s.Ew),
    i === null ? void 0 : r * i
  ).map((s) => o[s]);
}
function Ze(t) {
  if (!Array.isArray(t) || t.length < 1) throw new RangeError("hull must be a nonempty array of vertices");
  for (let e = 0; e < t.length; e += 1) {
    const n = t[e];
    if (!Number.isFinite(n?.N) || !Number.isFinite(n?.Ew)) throw new RangeError(`hull vertex ${e} must have finite N and Ew`);
    if (e > 0 && !(n.N > t[e - 1].N)) throw new RangeError("hull vertices must have increasing N");
  }
}
function Ji(t, e, n = {}) {
  const r = R(n, ["tieTol", "M"], "supportingVertex");
  Z(e), Ze(t);
  const o = it(r.tieTol, "tieTol"), i = ar(r.M, null, t);
  if (i === null) throw new RangeError("supportingVertex needs M (options.M) when the hull vertices carry no grade");
  const s = t.map((u) => u.Ew - e * u.N), a = Math.min(...s), c = t.filter((u, l) => s[l] <= a + o * i);
  return { vertex: c[0], vertices: c, value: a };
}
function Xi(t, e, n) {
  Ze(e);
  const r = e[0].N, o = e[e.length - 1].N;
  if (typeof n != "number" || !Number.isFinite(n) || n < r || n > o)
    throw new RangeError(`N must lie between the smallest and largest disclosure of the family (${r} … ${o})`);
  let i = 0;
  for (; i < e.length - 1 && e[i + 1].N <= n; ) i += 1;
  const s = e[i], a = s.N === n ? s : e[i + 1], c = a === s ? 0 : (n - s.N) / (a.N - s.N), u = a === s ? s.Ew : (1 - c) * s.Ew + c * a.Ew;
  let l = null;
  const f = t?.byN?.find((m) => m.N === n);
  return f && (l = { grade: f.minGrade, Ew: f.minEw }), { N: n, H: u, psi: c, lower: s, upper: a, best: l, gap: l === null ? null : l.Ew - u };
}
function ts(t, e) {
  const n = R(
    e,
    ["order", "G", "exact", "blocks", "family", "scores", "direction", "ids", "w", "tieTol"],
    "orderHull",
    !0
  ), r = lt(t, n.w), { n: o, M: i, ebar: s } = r, a = it(n.tieTol, "tieTol"), c = rr(o, n, t, "orderHull"), u = ht(o, c);
  if (u.sizeExact === 0n) return Ft(u, "optimal-within-order");
  const l = Array.from(c.order), f = c.blocks === void 0 ? new Array(o).fill(1) : Array.from(c.blocks), m = f.length, d = [0];
  for (const x of f) d.push(d[d.length - 1] + x);
  const g = c.exact, w = g !== void 0 || c.G !== void 0 && c.G < m, h = g ?? Math.min(c.G ?? m, m), { maxUnitsUncapped: p, maxCells: b } = xo;
  if (!w && o > p)
    throw new RangeError(
      `orderHull covers at most ${p} units without a grade cap; ${u.name} is on n = ${o} units. Use fixedOrderDP for the optimum at one τ, or give a cap G.`
    );
  if (w && h * m * i > b)
    throw new RangeError(
      `orderHull keeps a table of H·m·M cells, at most ${Zt(b)}; ${u.name} needs ${Zt(h * m * i)} (H = ${h} grade layers, m = ${m} blocks, M = ${Zt(i)} pairs). Use fixedOrderDP for the optimum at one τ.`
    );
  const y = o + 1, N = new Float64Array(y * y);
  for (let x = 1; x <= o; x += 1) {
    const G = l[x - 1];
    let B = 0;
    for (let _ = 1; _ < x; _ += 1)
      B += s[l[_ - 1] * o + G], N[_ * y + x] = N[_ * y + x - 1] + B;
  }
  const I = w ? h + 1 : 1, E = i + 1, v = (x, G, B) => (x * (m + 1) + G) * E + B, $ = new Float64Array(I * (m + 1) * E).fill(Number.POSITIVE_INFINITY), A = m < 32768 ? new Int16Array(I * (m + 1) * E).fill(-1) : new Int32Array(I * (m + 1) * E).fill(-1), k = new Int32Array(I * (m + 1)).fill(E), C = new Int32Array(I * (m + 1)).fill(-1);
  $[v(0, 0, 0)] = 0, k[0] = 0, C[0] = 0;
  const j = (x, G, B, _) => {
    const W = x * (m + 1) + G;
    if (k[W] > C[W]) return;
    const Y = d[_] - d[G], Q = Y * (Y - 1) / 2, ut = N[d[G] * y + d[_]], gt = B * (m + 1) + _;
    for (let M = k[W]; M <= C[W]; M += 1) {
      const O = $[v(x, G, M)];
      if (O === Number.POSITIVE_INFINITY) continue;
      const q = v(B, _, M + Q), T = O + ut;
      T < $[q] && ($[q] = T, A[q] = G, M + Q < k[gt] && (k[gt] = M + Q), M + Q > C[gt] && (C[gt] = M + Q));
    }
  };
  if (w)
    for (let x = 1; x <= h; x += 1) for (let G = x; G <= m; G += 1) for (let B = x - 1; B < G; B += 1) j(x - 1, B, x, G);
  else
    for (let x = 1; x <= m; x += 1) for (let G = 0; G < x; G += 1) j(0, G, 0, x);
  const V = w ? g !== void 0 ? [g] : Array.from({ length: h }, (x, G) => G + 1) : [0], D = [], U = [], et = [];
  for (let x = i; x >= 0; x -= 1) {
    let G = Number.POSITIVE_INFINITY, B = -1;
    for (const _ of V) {
      const W = $[v(_, m, x)];
      W < G && (G = W, B = _);
    }
    B < 0 || (D.push(i - x), U.push(G), et.push({ layer: B, wd: x }));
  }
  const F = (x, G) => {
    const B = new Array(o), _ = [];
    let W = m, Y = G, Q = x;
    for (; W > 0; ) {
      const ut = A[v(Q, W, Y)];
      _.push([ut, W]);
      const gt = d[W] - d[ut];
      Y -= gt * (gt - 1) / 2, W = ut, w && (Q -= 1);
    }
    return _.reverse(), _.forEach(([ut, gt], M) => {
      for (let O = d[ut]; O < d[gt]; O += 1) B[l[O]] = M + 1;
    }), B;
  };
  return Ne(D, U, a * i).map((x) => ({ N: D[x], Ew: U[x], grade: F(et[x].layer, et[x].wd) }));
}
function es(t) {
  t != null && typeof t == "object" && Dt(t, ["family", "tieFree", "positiveWeights"], "halfSlopeEligible input");
  const e = t?.family;
  if (e == null || typeof e != "object") throw new RangeError("family must be a family object");
  const n = t.tieFree;
  let r;
  if (typeof n == "boolean") r = n;
  else if (Array.isArray(n) && n.every((o) => typeof o == "boolean")) {
    const o = t.positiveWeights;
    if (o !== void 0 && (!Array.isArray(o) || o.length !== n.length))
      throw new RangeError("positiveWeights must have one entry per criterion");
    r = n.every((i, s) => i || o !== void 0 && !(o[s] === !0 || typeof o[s] == "number" && o[s] > 0));
  } else throw new RangeError("tieFree must be a boolean or one boolean per criterion");
  return e.kind === "all" && r;
}
function ns(t, e) {
  const n = R(e, ["w", "family", "N", "k", "tieTol"], "reportsAtN", !0), r = lt(t, n.w), o = r.n, i = n.family ?? { kind: "all" }, s = n.N;
  if (typeof s != "number" || !Number.isSafeInteger(s) || s < 0)
    throw new RangeError(`reportsAtN: N must be an integer ≥ 0, got ${String(s)}`);
  const a = er(n.k, "reportsAtN"), c = it(n.tieTol, "tieTol"), u = ht(o, i), l = (w, h) => ({
    family: u,
    N: s,
    count: w,
    reports: h,
    tieTol: c,
    label: "exact-within-family"
  });
  if (u.sizeExact === 0n) return l(0, []);
  if (It(o, u, i), s > r.M) return l(0, []);
  const f = At(o, i, [r.ebar]), m = new tr(o, a, c);
  let d = 0;
  for (; f.next(); )
    f.N === s && (d += 1, m.push(f.g, f.sum(0)));
  const g = m.result().map(({ grade: w }) => ({ grade: w, Ew: H(w, t, { tau: 0.5, w: r.w }).Ew }));
  return l(d, g);
}
function rs(t, e, n) {
  const r = R(n, ["w", "hull", "tieTol"], "ruleGap", !0), o = r.hull;
  Ze(o);
  const i = it(r.tieTol, "tieTol"), s = H(t, e, { tau: 0.5, w: r.w }), { N: a, Ew: c, M: u } = s, l = o[0].N, f = o[o.length - 1].N;
  if (a < l || a > f)
    throw new RangeError(`ruleGap: the report states ${a} pairs, outside the hull's range (${l} … ${f})`);
  let m = 0;
  for (; m < o.length - 1 && o[m + 1].N <= a; ) m += 1;
  const d = o[m];
  let g = d, w = null, h = d.Ew;
  d.N !== a && (g = o[m + 1], w = (g.N - a) / (g.N - d.N), h = w * d.Ew + (1 - w) * g.Ew);
  const p = c - h, b = Math.abs(p) <= i * u ? 0 : p;
  return { N: a, Ew: c, H: h, gap: b, psi: w, lower: d, upper: g, onFrontier: b === 0 };
}
const cr = 1e-12;
function lr(t) {
  const e = Array.isArray(t?.e) ? t.e.length : 0;
  return lt(t, e <= 1 ? void 0 : new Array(e).fill(1 / e));
}
function Qe(t, e) {
  return Array.isArray(t.criteria) && t.criteria.length === e ? [...t.criteria] : Array.from({ length: e }, (n, r) => `k${r + 1}`);
}
function So(t, e) {
  return Array.from({ length: t }, (n, r) => r === e ? 1 : 0);
}
function $n(t, e) {
  const n = t.length;
  let r = 0, o = 0;
  for (let i = 0; i < n; i += 1)
    for (let s = i + 1; s < n; s += 1)
      o += 1, Math.sign(t[i] - t[s]) === Math.sign(e[i] - e[s]) && (r += 1);
  return r / o;
}
function ur(t, e) {
  if (t == null) return new Array(e).fill(null);
  if (!Array.isArray(t) || t.length !== e) throw new RangeError(`q must hold ${e} budgets (null for none)`);
  return t.map((n, r) => {
    if (n == null) return null;
    if (typeof n != "number" || !Number.isFinite(n) || n < 0) throw new RangeError(`q[${r}] must be finite and ≥ 0, or null`);
    return n;
  });
}
function os(t, e = {}) {
  const n = R(e, ["tieTol"], "conflictPairs"), r = it(n.tieTol, "tieTol"), o = lr(t), { n: i, K: s, ek: a } = o, c = [];
  for (let u = 0; u < i; u += 1)
    for (let l = u + 1; l < i; l += 1) {
      const f = [], m = [];
      for (let d = 0; d < s; d += 1) {
        const g = a[d][u * i + l] - a[d][l * i + u];
        g < -r ? f.push(d) : g > r && m.push(d);
      }
      f.length > 0 && m.length > 0 && c.push({ i: u, j: l, iAbove: f, jAbove: m });
    }
  return { count: c.length, pairs: c };
}
function To(t, e) {
  const n = lt(t, e), r = Tt(n.n);
  for (let o = 0; o < n.n; o += 1) for (let i = 0; i < n.n; i += 1) o !== i && (r[o][i] = n.ebar[o * n.n + i]);
  return r;
}
function is(t, e) {
  const n = R(e, ["tau", "w", "family", "tieTol", "maxTies"], "commonalityCost", !0), r = Z(n.tau), o = lt(t, n.w), i = n.family ?? { kind: "all" }, s = it(n.tieTol, "tieTol"), a = Ot(n.maxTies, "commonalityCost"), c = Ct(t, { tau: r, w: o.w, family: i, tieTol: s, maxTies: a });
  if (c.empty) return c;
  const u = Qe(t, o.K), l = [];
  for (let m = 0; m < o.K; m += 1) {
    const d = Ct(t, { tau: r, w: So(o.K, m), family: i, tieTol: s, maxTies: a }), g = c.evaluation.Rk[m];
    l.push({
      k: m,
      criterion: u[m],
      weight: o.w[m],
      commonRk: g,
      ownGrade: d.grade,
      ownGrades: d.grades,
      ownTieCount: d.tieCount,
      ownRk: d.risk,
      ownN: d.N,
      ownG: d.G,
      delta: Math.max(0, g - d.risk),
      relationAgreement: $n(d.grade, c.grade)
    });
  }
  const f = c.grades.map((m) => {
    const d = H(m, t, { tau: r, w: o.w }).Rk;
    return {
      grade: [...m],
      Rk: d,
      delta: l.map((g, w) => Math.max(0, d[w] - g.ownRk)),
      relationAgreement: l.map((g) => $n(g.ownGrade, m))
    };
  });
  return { empty: !1, common: c, family: c.family, tau: r, w: o.w, criteria: l, commonReports: f, containsAllWithheld: c.containsAllWithheld, label: "exact-within-family" };
}
function ss(t, e) {
  const n = R(e, ["w", "a", "tau", "multiplier", "pair", "ids", "criteria"], "estimandCosts", !0), r = Et(t, "state"), { n: o, K: i, v: s } = r;
  if (o < 2) throw new RangeError("state must hold at least two units");
  const a = Z(n.tau), c = X(n.w, i), u = n.a;
  if (!Array.isArray(u) || u.length !== i || !u.every((N) => typeof N == "number" && Number.isFinite(N)))
    throw new RangeError(`a must hold ${i} finite composite coefficients`);
  const l = n.multiplier ?? new Array(i).fill(1);
  if (!Array.isArray(l) || l.length !== i || !l.every((N) => typeof N == "number" && Number.isFinite(N) && N > 0))
    throw new RangeError(`multiplier must hold ${i} finite positive multipliers`);
  const f = n.pair ?? [0, 1], [m, d] = Array.isArray(f) ? f : [Number.NaN, Number.NaN];
  if (!Array.isArray(f) || f.length !== 2 || !Number.isInteger(m) || !Number.isInteger(d) || m < 0 || d < 0 || m >= o || d >= o || m === d)
    throw new RangeError(`pair must be two distinct unit indices in 0..${o - 1}`);
  const { ids: g, criteria: w } = Pt(n, o, i), h = Array.from({ length: o }, (N, I) => {
    const E = new K();
    for (let v = 0; v < i; v += 1) E.add(u[v] * (l[v] * s[I * i + v]));
    return E.value;
  }), p = Array.from({ length: i }, () => Tt(o)), b = [Tt(o)];
  for (let N = 0; N < o; N += 1)
    for (let I = 0; I < o; I += 1)
      if (N !== I) {
        for (let E = 0; E < i; E += 1) p[E][N][I] = s[N * i + E] <= s[I * i + E] ? 1 : 0;
        b[0][N][I] = h[N] <= h[I] ? 1 : 0;
      }
  const y = (N, I) => {
    const E = new K();
    for (let v = 0; v < i; v += 1) E.add(c[v] * p[v][N][I]);
    return E.value;
  };
  return {
    pair: [m, d],
    c: h,
    criterionLoss: In(y(m, d), y(d, m), a),
    compositeLoss: In(b[0][m][d], b[0][d][m], a),
    criterionE: { ids: g, criteria: w, e: p },
    compositeE: { ids: g, criteria: ["composite"], e: b }
  };
}
function as(t, e) {
  const n = R(e, ["tau", "w", "family", "q", "tieTol", "maxTies"], "budgetFamily", !0), r = Z(n.tau), o = lt(t, n.w), { n: i } = o, s = n.family ?? { kind: "all" }, a = it(n.tieTol, "tieTol"), c = Ot(n.maxTies, "budgetFamily"), u = ur(n.q, o.K), l = Ct(t, { tau: r, w: o.w, family: s, q: u, tieTol: a, maxTies: c }), f = ht(i, s), m = Number(l.family.size);
  let d = null;
  if (f.sizeExact !== 0n && f.sizeExact <= BigInt(He)) {
    It(i, f, s);
    const g = [];
    u.forEach((h, p) => h !== null && g.push(p));
    const w = At(i, s, g.map((h) => o.ek[h]));
    for (d = []; w.next(); ) {
      let h = !0;
      for (let p = 0; p < g.length && h; p += 1) w.sum(p) > u[g[p]] * w.N + cr && (h = !1);
      h && d.push(Array.from(w.g));
    }
    if (d.length !== m) throw new Error("internal: budget member count disagrees with exactOptimum");
  }
  return {
    empty: l.empty,
    size: m,
    baseSize: f.size,
    family: l.family,
    optimum: l.empty ? null : l,
    members: d,
    containsAllWithheld: !l.empty && Wt(i, s),
    label: "exact-within-family"
  };
}
function cs(t, e, n) {
  const r = lr(e);
  if (!Array.isArray(n)) throw new RangeError(`q must hold ${r.K} budgets (null for none)`);
  const o = ur(n, r.K), i = H(t, e, { tau: 0.5, w: r.w }), s = Qe(e, r.K), a = [];
  return o.forEach((c, u) => {
    if (c === null) return;
    const l = c * i.N;
    a.push({ k: u, criterion: s[u], q: c, E: i.E[u], N: i.N, qN: l, EoverN: i.EoverN[u], slack: l - i.E[u], meets: i.E[u] <= l + cr });
  }), { rows: a, meets: a.every((c) => c.meets) };
}
function ls(t, e, n) {
  R(n, ["tau", "w"], "criterionMixtureRisk", !0);
  const r = H(t, e, n), o = X(n?.w, r.Rk.length), i = new K();
  return r.Rk.forEach((s, a) => i.add(o[a] * s)), { risk: i.value, Rk: r.Rk, w: o, weightedRisk: r.risk, difference: i.value - r.risk };
}
function us(t, e) {
  const n = R(e, ["tau", "w", "family", "criteria", "tieTol", "maxTies"], "minimaxChoice", !0), r = Z(n.tau), o = lt(t, n.w), { n: i, K: s, M: a } = o, c = n.family ?? { kind: "all" }, u = it(n.tieTol, "tieTol"), l = Ot(n.maxTies, "minimaxChoice"), f = ht(i, c);
  if (f.sizeExact === 0n) return Ft(f, "exact-within-family");
  It(i, f, c);
  const m = Qe(t, s);
  let d;
  if (n.criteria === void 0) d = Array.from({ length: s }, (v, $) => $);
  else {
    const v = n.criteria;
    if (!Array.isArray(v) || v.length < 1) throw new RangeError("criteria must list at least one criterion (index or id)");
    const $ = /* @__PURE__ */ new Set();
    for (const A of v) {
      const k = typeof A == "string" ? m.indexOf(A) : A;
      if (!Number.isInteger(k) || k < 0 || k >= s) throw new RangeError(`unknown criterion ${String(A)}`);
      $.add(k);
    }
    d = [...$].sort((A, k) => A - k);
  }
  const g = Ct(t, { tau: r, w: o.w, family: c, tieTol: u, maxTies: l }), h = f.sizeExact <= BigInt(He) ? [] : null, p = At(i, c, o.ek), b = new Ae(i, u), y = new Float64Array(s);
  for (; p.next(); ) {
    const v = r * (a - p.N);
    let $ = Number.NEGATIVE_INFINITY;
    for (let A = 0; A < s; A += 1) y[A] = (p.sum(A) + v) / a;
    for (const A of d) y[A] > $ && ($ = y[A]);
    if (h) {
      const A = new K();
      for (let k = 0; k < s; k += 1) A.add(o.w[k] * y[k]);
      h.push({ grade: Array.from(p.g), N: p.N, Rk: Array.from(y), max: $, weighted: A.value });
    }
    b.push(p.g, $);
  }
  const N = b.first(l), I = H(N[0], t, { tau: r, w: o.w }), E = (v) => Math.max(...d.map(($) => v[$]));
  return {
    empty: !1,
    family: f,
    tau: r,
    w: o.w,
    included: d,
    reports: h,
    weighted: { grade: g.grade, grades: g.grades, tieCount: g.tieCount, risk: g.risk, Rk: g.evaluation.Rk, max: E(g.evaluation.Rk) },
    minimax: { grade: N[0], grades: N, tieCount: b.count(), value: E(I.Rk), Rk: I.Rk, weightedRisk: I.risk },
    containsAllWithheld: Wt(i, c),
    tieTol: u,
    label: "exact-within-family"
  };
}
function fs(t, e, n) {
  const r = R(n, ["tau"], "weightCrossing", !0), o = Z(r.tau);
  if ((Array.isArray(e?.e) ? e.e.length : 0) !== 2) throw new RangeError("weightCrossing needs two criteria (K = 2)");
  const s = H(tt(t), e, { tau: o, w: [0.5, 0.5] }), a = s.E[0] - o * s.N, c = s.E[1] - o * s.N;
  if (a === c) return null;
  const u = c / (c - a);
  return u > 0 && u < 1 ? u : null;
}
function we(t, e = "scores") {
  if (t == null || typeof t != "object" || typeof t.length != "number" || t.length < 1)
    throw new RangeError(`${e} must be a nonempty array of numbers`);
  const n = Array.from(t);
  if (!n.every((r) => typeof r == "number" && Number.isFinite(r))) throw new RangeError(`${e} must be finite numbers`);
  return n;
}
function fr(t) {
  const e = t?.direction ?? "descending";
  if (e !== "descending" && e !== "ascending") throw new RangeError('direction must be "descending" or "ascending"');
  return e === "descending" ? -1 : 1;
}
function mr(t, e) {
  const n = t.map((r, o) => o);
  return n.sort((r, o) => e * t[r] - e * t[o] || r - o), n;
}
function Fo(t, e) {
  const n = Array.from(t), r = Array.from(e), o = Math.min(n.length, r.length);
  for (let i = 0; i < o; i += 1) {
    const s = n[i].codePointAt(0) - r[i].codePointAt(0);
    if (s !== 0) return s;
  }
  return n.length - r.length;
}
function Co(t, e = {}) {
  e = R(e, ["direction"], "strictOrder");
  const n = we(t), r = mr(n, fr(e)), o = new Array(n.length);
  return r.forEach((i, s) => o[i] = s + 1), o;
}
function ms(t, e, n = {}) {
  n = R(n, ["direction"], "tierGrades");
  const r = we(t), o = r.length;
  if (!Number.isSafeInteger(e) || e < 1) throw new RangeError("G must be a positive integer");
  const i = Math.min(e, o), s = mr(r, fr(n)), a = new Array(o);
  a[0] = 1;
  for (let w = 1; w < o; w += 1) a[w] = a[w - 1] + (r[s[w]] !== r[s[w - 1]] ? 1 : 0);
  const c = a[o - 1], u = Array.from({ length: o }, (w, h) => 1 + Math.floor(h * i / o)), l = Array.from({ length: i + 1 }, (w, h) => h), f = (w) => {
    for (; l[w] !== w; ) w = l[w];
    return w;
  };
  for (let w = 1; w <= c; w += 1) {
    const h = [...new Set(u.filter((p, b) => a[b] === w))];
    if (h.length > 1) {
      const p = f(Math.min(...h));
      for (const b of h) l[f(b)] = p;
    }
  }
  const m = u.map(f), d = new Array(c + 1);
  for (let w = o - 1; w >= 0; w -= 1) d[a[w]] = m[w];
  const g = new Array(o);
  return s.forEach((w, h) => g[w] = d[a[h]]), Lt(g);
}
function ds(t, e, n = {}) {
  n = R(n, ["ref", "crit"], "evidenceFlags");
  const r = we(t, "est"), o = r.length, i = typeof e == "number" ? new Array(o).fill(e) : we(e, "se");
  if (i.length !== o) throw new RangeError(`se must have ${o} values (or be one number)`);
  if (!i.every((l) => l > 0)) throw new RangeError("se must be positive");
  const s = n?.ref ?? 0, a = n?.crit ?? 1.96;
  if (typeof s != "number" || !Number.isFinite(s)) throw new RangeError("ref must be a finite number");
  if (typeof a != "number" || !Number.isFinite(a) || a < 0) throw new RangeError("crit must be a finite number ≥ 0");
  const c = r.map((l, f) => (l - s) / i[f]), u = c.map((l) => l > a ? 1 : l < -a ? 3 : 2);
  return { grade: Lt(u), z: c, labels: u };
}
function hs(t, e = {}) {
  e = R(e, ["w"], "expectedRank");
  const n = Array.isArray(t?.e) ? t.e.length : 0, r = e?.w ?? new Array(n).fill(1 / Math.max(n, 1)), o = lt(t, r), { n: i, ek: s } = o, a = Array.isArray(t.ids) && t.ids.length === i ? t.ids : Xt(i), c = a.map((l, f) => f).sort((l, f) => Fo(a[l], a[f]) || l - f), u = new Array(i).fill(0);
  for (let l = 0; l < i; l += 1) {
    let f = 0;
    for (let m = 0; m < o.K; m += 1) {
      let d = 0;
      for (const g of c) d += g === l ? 0 : s[m][l * i + g];
      f += (1 + d) * o.w[m];
    }
    u[l] = f;
  }
  return u;
}
const $e = 20261030;
function jt(t, e) {
  if (typeof t != "number" || !Number.isFinite(t)) throw new RangeError(`${e} must be a finite number`);
  return t;
}
function mt(t, e, n = 0) {
  if (!Number.isSafeInteger(t) || t < n) throw new RangeError(`${e} must be an integer ≥ ${n}`);
  return t;
}
function nt(t, e) {
  if (t == null || typeof t != "object" || typeof t.length != "number" || t.length < 1) throw new RangeError(`${e} must be a nonempty array`);
  const n = Array.from(t);
  if (!n.every((r) => typeof r == "number" && Number.isFinite(r))) throw new RangeError(`${e} must be finite numbers`);
  return n;
}
function Nt(t, e, n) {
  if (typeof t == "number") return new Array(e).fill(jt(t, n));
  const r = nt(t, n);
  if (r.length !== e) throw new RangeError(`${n} must have ${e} values (or be one number)`);
  return r;
}
function ee(t, e) {
  if (!t.every((n) => n >= 0)) throw new RangeError(`${e} must be ≥ 0`);
}
function pe(t) {
  return t.map((e, n) => n).sort((e, n) => t[n] - t[e] || e - n);
}
function dr(t) {
  const e = t.length;
  let n = 0;
  for (let i = 0; i < e; i += 1) n += t[i];
  let r = n / e;
  if (Number.isFinite(r)) {
    let i = 0;
    for (let s = 0; s < e; s += 1) i += t[s] - r;
    r += i / e;
  }
  let o = 0;
  for (let i = 0; i < e; i += 1) o += (t[i] - r) * (t[i] - r);
  return Math.sqrt(o / (e - 1));
}
function hr(t, e) {
  if (t == null || typeof t != "object" || typeof t.length != "number" || t.length < 1)
    throw new RangeError(`${e} must be a nonempty array of draws`);
  const n = t.length, r = Et(t[0], `${e}[0]`), { n: o, K: i } = r, s = new Float64Array(n * o * i);
  s.set(r.v, 0);
  for (let a = 1; a < n; a += 1) {
    const c = Et(t[a], `${e}[${a}]`);
    if (c.n !== o || c.K !== i) throw new RangeError(`${e}[${a}] must have ${o} units × ${i} criteria, as ${e}[0]`);
    s.set(c.v, a * o * i);
  }
  return { S: n, n: o, K: i, v: s };
}
function kn(t, e, n) {
  let r = !0;
  for (let o = 0; o < e; o += 1) {
    let i = 1;
    const s = t[o];
    for (let a = 0; a < e; a += 1)
      a !== o && (t[a] > s ? i += 1 : t[a] === s && (r = !1));
    n[o] = i;
  }
  return r;
}
function gs(t, e, n, r) {
  if (jt(t, "truth"), jt(e, "se") < 0) throw new RangeError("se must be ≥ 0");
  const o = ve(r, mt(n, "count"));
  return Array.from(o, (i) => t + e * i);
}
function ke() {
  const t = Xt(30), e = [16, 64, 256], n = ["small", "medium", "large"], r = [], o = [], i = [], s = [], a = [];
  for (let c = 1; c <= 30; c += 1) {
    const u = (c - 1) % 3;
    r.push(e[u]), o.push(n[u]), i.push(0.8 / Math.sqrt(e[u]));
    const l = 19 * c % 31;
    a.push(l), s.push(0.15 * De((l - 0.5) / 30));
  }
  return { ids: t, size: r, group: o, se: i, theta: s, rank: a };
}
function Je(t = $e) {
  const { theta: e, se: n } = ke(), r = ve(t, 30);
  return { seed: t, estimate: e.map((o, i) => o + n[i] * r[i]) };
}
function Xe(t, e, n = {}) {
  n = R(n, ["priorMean", "priorSd"], "normalPosterior");
  const r = jt(n?.priorMean ?? 0, "priorMean"), o = n?.priorSd ?? 0.15;
  if (typeof o != "number" || !(o > 0)) throw new RangeError("priorSd must be > 0 (Infinity for a flat prior)");
  const i = typeof t == "number" && typeof e == "number", s = typeof t == "number" ? typeof e == "number" ? 1 : e.length : t.length, a = Nt(t, s, "est"), c = Nt(e, s, "se");
  ee(c, "se");
  const u = o * o, l = c.map((d) => o === Number.POSITIVE_INFINITY ? 1 : u / (u + d * d)), f = a.map((d, g) => r + l[g] * (d - r)), m = c.map((d, g) => Math.sqrt(l[g]) * d);
  return i ? { mean: f[0], sd: m[0], shrink: l[0] } : { mean: f, sd: m, shrink: l };
}
function ws(t, e, n) {
  if (typeof n != "number" || !(n > 0 && n < 1)) throw new RangeError("level must lie in (0, 1)");
  const r = De((1 + n) / 2), o = typeof t == "number" && typeof e == "number", i = typeof t == "number" ? typeof e == "number" ? 1 : e.length : t.length, s = Nt(t, i, "mean"), a = Nt(e, i, "sd");
  ee(a, "sd");
  const c = s.map((l, f) => l - r * a[f]), u = s.map((l, f) => l + r * a[f]);
  return o ? { lower: c[0], upper: u[0] } : { lower: c, upper: u };
}
function ps(t, e, n = {}) {
  n = R(n, ["priorSd", "priorMean"], "expectedMisorderedPairs");
  const r = nt(t, "theta"), o = r.length, i = Nt(e, o, "se");
  ee(i, "se");
  const s = n?.priorSd ?? null, a = jt(n?.priorMean ?? 0, "priorMean");
  let c;
  if (s === null) c = new Array(o).fill(1);
  else {
    if (typeof s != "number" || !(s > 0)) throw new RangeError("priorSd must be > 0 (or null for the estimate order)");
    c = i.map((l) => s === Number.POSITIVE_INFINITY ? 1 : s * s / (s * s + l * l));
  }
  const u = new K();
  for (let l = 0; l < o; l += 1)
    for (let f = l + 1; f < o; f += 1) {
      const m = Math.sign(r[l] - r[f]);
      if (m === 0) {
        u.add(1);
        continue;
      }
      const d = Math.hypot(c[l] * i[l], c[f] * i[f]), g = s === null ? Math.abs(r[l] - r[f]) : m * (c[l] * (r[l] - a) - c[f] * (r[f] - a));
      d === 0 ? u.add(g > 0 ? 0 : 1) : u.add(St(-g / d));
    }
  return u.value;
}
function jo(t, e) {
  const n = nt(t, "a"), r = nt(e, "b");
  if (n.length !== r.length) throw new RangeError("a and b must have the same length");
  const o = [];
  for (let i = 0; i < n.length; i += 1)
    for (let s = i + 1; s < n.length; s += 1) Math.sign(n[i] - n[s]) !== Math.sign(r[i] - r[s]) && o.push({ i, j: s });
  return { count: o.length, pairs: o };
}
function Go(t, e, n) {
  const r = nt(t, "a"), o = nt(e, "b");
  if (r.length !== o.length) throw new RangeError("a and b must have the same length");
  if (mt(n, "k"), n > r.length) throw new RangeError(`k must be at most ${r.length}`);
  const i = new Set(pe(r).slice(0, n)), s = pe(o).slice(0, n).filter((a) => i.has(a)).sort((a, c) => a - c);
  return { count: s.length, members: s };
}
function Oo(t, e, n) {
  const r = nt(t, "score"), o = r.length;
  if (e == null || e.length !== o || !Array.from(e).every((f) => typeof f == "string"))
    throw new RangeError(`group must hold ${o} group names`);
  if (mt(n, "k"), n > o) throw new RangeError(`k must be at most ${o}`);
  const i = [...new Set(Array.from(e))], s = () => Object.fromEntries(i.map((f) => [f, 0])), a = s(), c = s(), u = pe(r);
  for (const f of u.slice(0, n)) a[e[f]] += 1;
  for (const f of u.slice(o - n)) c[e[f]] += 1;
  const l = Object.fromEntries(i.map((f) => [f, a[f] + c[f]]));
  return { k: n, top: a, bottom: c, total: l };
}
function bs(t = $e, e = {}) {
  if (e = R(e, ["replays", "k", "topK"], "leagueReplays"), !Number.isSafeInteger(t)) throw new RangeError("seed must be an integer");
  const n = mt(e.replays ?? 20, "replays", 1), r = mt(e.k ?? 5, "k"), o = mt(e.topK ?? 10, "topK"), i = ke(), s = [...new Set(i.group)], a = [];
  for (let u = 1; u <= n; u += 1) {
    const { estimate: l } = Je(t + u);
    a.push({
      r: u,
      seed: t + u,
      estimate: l,
      extreme: Oo(l, i.group, r),
      topOverlap: Go(l, i.theta, o).count,
      misordered: jo(l, i.theta).count
    });
  }
  const c = (u) => {
    let l = 0;
    for (const f of a) l += u(f);
    return l / n;
  };
  return {
    seed: t,
    replays: n,
    k: r,
    topK: o,
    seeds: a.map((u) => u.seed),
    draws: a,
    mean: {
      extreme: Object.fromEntries(s.map((u) => [u, c((l) => l.extreme.total[u])])),
      topOverlap: c((u) => u.topOverlap),
      misordered: c((u) => u.misordered)
    }
  };
}
function ys(t, e, n) {
  const r = nt(t, "probs");
  if (!r.every((c) => c >= 0 && c <= 1)) throw new RangeError("probs must lie in [0, 1]");
  if (mt(e, "S"), !Number.isSafeInteger(n)) throw new RangeError("seed must be an integer");
  const o = r.length, i = new Float64Array(o);
  i[0] = r[0];
  for (let c = 1; c < o; c += 1) i[c] = i[c - 1] + r[c];
  const s = zn(n, e), a = new Int32Array(e);
  for (let c = 0; c < e; c += 1) {
    let u = 0;
    for (; u < o && !(s[c] < i[u]); ) u += 1;
    a[c] = u < o ? u : o - 1;
  }
  return a;
}
function Is(t) {
  if (t == null || typeof t != "object") throw new RangeError("law must be { states, probs }");
  const e = hr(t.states, "law.states");
  if (e.K !== 1) throw new RangeError("rankSummaries takes one value per unit");
  const { S: n, n: r, v: o } = e;
  let i = null;
  if (t.probs != null) {
    const s = nt(t.probs, "law.probs");
    if (s.length !== n) throw new RangeError(`law.probs must have one value per state (${n})`);
    const a = new K();
    for (const c of s) {
      if (c < 0) throw new RangeError("law.probs must be ≥ 0");
      a.add(c);
    }
    if (Math.abs(a.value - 1) > 1e-12) throw new RangeError("law.probs must sum to 1 (within 1e-12); they are not normalized");
    i = s;
  }
  return gr(n, r, o, i);
}
function gr(t, e, n, r) {
  const o = new Int32Array(e);
  let i = !0;
  if (r === null) {
    const l = Array.from({ length: e }, () => new Float64Array(e)), f = Array.from({ length: e }, () => new K()), m = new Float64Array(e);
    for (let h = 0; h < t; h += 1) {
      const p = n.subarray(h * e, h * e + e);
      kn(p, e, o) || (i = !1);
      for (let b = 0; b < e; b += 1)
        l[o[b] - 1][b] += 1, m[b] += o[b], f[b].add(p[b]);
    }
    const d = l.map((h) => Array.from(h, (p) => p / t)), g = [], w = new Float64Array(e);
    for (let h = 0; h < e; h += 1) {
      for (let p = 0; p < e; p += 1) w[p] += l[h][p];
      g.push(Array.from(w, (p) => p / t));
    }
    return { n: e, means: f.map((h) => h.value / t), expectedRank: Array.from(m, (h) => h / t), rankProbs: d, pTop: g, tieFree: i };
  }
  const s = Array.from({ length: e }, () => Array.from({ length: e }, () => new K())), a = Array.from({ length: e }, () => Array.from({ length: e }, () => new K())), c = Array.from({ length: e }, () => new K()), u = Array.from({ length: e }, () => new K());
  for (let l = 0; l < t; l += 1) {
    const f = n.subarray(l * e, l * e + e);
    kn(f, e, o) || (i = !1);
    const m = r[l];
    for (let d = 0; d < e; d += 1) {
      s[o[d] - 1][d].add(m);
      for (let g = o[d] - 1; g < e; g += 1) a[g][d].add(m);
      c[d].add(m * f[d]), u[d].add(m * o[d]);
    }
  }
  return {
    n: e,
    means: c.map((l) => l.value),
    expectedRank: u.map((l) => l.value),
    rankProbs: s.map((l) => l.map((f) => f.value)),
    pTop: a.map((l) => l.map((f) => f.value)),
    tieFree: i
  };
}
function vs(t, e, n, r) {
  const o = nt(t, "means"), i = o.length, s = Nt(e, i, "sds");
  ee(s, "sds"), mt(n, "S", 1);
  const a = ve(r, n * i), c = new Float64Array(n * i);
  for (let u = 0; u < n * i; u += 1) c[u] = o[u % i] + s[u % i] * a[u];
  return { ...gr(n, i, c, null), S: n, seed: r, label: "monte-carlo" };
}
function Es(t) {
  Z(t);
  const e = De(t, { lowerTail: !1 }), n = 2 - Math.SQRT2 * e, r = Math.SQRT2 * e, o = St(Math.SQRT2), i = Tr(Math.SQRT2) <= t, s = !i || !(n < r);
  return { tau: t, empty: s, lower: s ? null : n, upper: s ? null : r, pi13: o, states13: i };
}
function As(t, e, n, r) {
  const o = Et(t, "means"), { n: i, K: s } = o;
  let a;
  if (typeof e == "number") a = new Float64Array(i * s).fill(jt(e, "sds"));
  else {
    const l = Et(e, "sds");
    if (l.n !== i || l.K !== s) throw new RangeError(`sds must be ${i} units × ${s} criteria, as means`);
    a = l.v;
  }
  if (!a.every((l) => l >= 0)) throw new RangeError("sds must be ≥ 0");
  mt(n, "S", 1);
  const c = ve(r, n * i * s), u = new Array(n);
  for (let l = 0; l < n; l += 1) {
    const f = new Array(i);
    for (let m = 0; m < i; m += 1) {
      const d = new Array(s);
      for (let g = 0; g < s; g += 1) d[g] = o.v[m * s + g] + a[m * s + g] * c[(l * i + m) * s + g];
      f[m] = d;
    }
    u[l] = f;
  }
  return u;
}
function Po(t) {
  if (t == null || typeof t != "object" || typeof t.length != "number") throw new RangeError("trace must be an array of numbers");
  for (let e = 0; e < t.length; e += 1) jt(t[e], "trace values");
  return t.length < 2 ? null : dr(t) / Math.sqrt(t.length);
}
function Ns(t, e, n, r = "package", o = {}) {
  const i = R(o, ["K"], "envelopeRadius");
  if (typeof t != "number" || !Number.isFinite(t) || !(t >= 1)) throw new RangeError("M must be ≥ 1");
  if (typeof e != "number" || !Number.isFinite(e) || !(e > 0)) throw new RangeError("S must be > 0");
  if (typeof n != "number" || !(n > 0 && n < 1)) throw new RangeError("alpha must lie in (0, 1)");
  if (r !== "package" && r !== "book") throw new RangeError('form must be "package" or "book"');
  const s = i.K ?? 1;
  if (!Number.isSafeInteger(s) || s < 1) throw new RangeError("K must be a positive integer (the number of criteria)");
  return Math.sqrt(r === "package" ? (Math.log(2) + Math.log(t) - Math.log(n)) / (2 * e) : Math.log(4 * t * s / n) / (2 * e));
}
function $s(t, e) {
  e = R(e, ["tau", "w", "z", "screenMargin", "grade", "ids"], "fragilePairs", !0);
  const { S: n, n: r, K: o, v: i } = hr(t, "draws");
  if (r < 2) throw new RangeError("draws must hold at least two units");
  const s = Z(e?.tau), a = X(e?.w, o), c = e?.z ?? 2;
  if (typeof c != "number" || !Number.isFinite(c) || !(c > 0)) throw new RangeError("z must be a positive number");
  const u = e?.screenMargin ?? c * 0.5 / Math.sqrt(Math.max(1, n - 1));
  if (typeof u != "number" || !(u > 0)) throw new RangeError("screenMargin must be a positive number");
  const l = e?.ids === void 0 ? Xt(r) : Array.from(e.ids);
  if (l.length !== r) throw new RangeError(`ids must hold ${r} strings`);
  const f = e?.grade === void 0 ? null : tt(e.grade, r), m = new Float64Array(n * r * o);
  for (let A = 0; A < n; A += 1) for (let k = 0; k < r * o; k += 1) m[k * n + A] = i[A * r * o + k];
  const d = (A, k) => m.subarray((A * o + k) * n, (A * o + k + 1) * n), g = new Float64Array(r * r);
  for (let A = 0; A < o; A += 1)
    for (let k = 0; k < r; k += 1) {
      const C = d(k, A);
      for (let j = 0; j < r; j += 1) {
        if (k === j) continue;
        const V = d(j, A);
        let D = 0;
        for (let et = 0; et < n; et += 1) C[et] <= V[et] && (D += 1);
        const U = a[A] * (D / n);
        g[k * r + j] = A === 0 ? U : g[k * r + j] + U;
      }
    }
  const w = [];
  let h = 0, p = 0, b = 0, y = 0, N = 0, I = 0;
  const E = new Float64Array(n);
  for (let A = 1; A < r; A += 1)
    for (let k = 0; k < A; k += 1) {
      h += 1;
      const C = g[k * r + A], j = g[A * r + k], V = C <= j, D = V ? C : j, U = Math.abs(D - s);
      if (!(U < u)) continue;
      p += 1;
      const et = V ? k : A, F = V ? A : k;
      E.fill(0);
      for (let _ = 0; _ < o; _ += 1) {
        const W = d(et, _), Y = d(F, _);
        for (let Q = 0; Q < n; Q += 1) E[Q] = E[Q] + a[_] * (W[Q] <= Y[Q] ? 1 : 0);
      }
      const x = n > 1 ? dr(E) / Math.sqrt(n) : null, G = x === null ? null : U < c * x;
      x === null && (y += 1);
      const B = {
        i: k,
        j: A,
        idI: l[k],
        idJ: l[A],
        betterDirection: V ? "i_ahead" : "j_ahead",
        weightedError: D,
        margin: U,
        disclosePreferred: D < s,
        mcse: x,
        ratio: x === null ? null : U / x,
        fragile: G
      };
      if (f !== null) {
        const _ = f[k] < f[A] ? 1 : f[k] > f[A] ? -1 : 0;
        B.relationInGrade = _ === 0 ? "tied" : _ === 1 === V ? "disclosed_better_direction" : "disclosed_reverse", G === !0 && (_ === 0 ? I += 1 : N += 1);
      }
      G === !0 && (b += 1), w.push(B);
    }
  const v = p > 0 && y === p, $ = {
    pairs: h,
    traced: p,
    fragile: v ? null : b,
    fragileShare: v ? null : b / h,
    mcseUnavailable: y
  };
  return f !== null && ($.fragileDisclosed = v ? null : N, $.fragileTied = v ? null : I), { S: n, n: r, K: o, tau: s, w: a, z: c, screenMargin: u, regime: "iid", mcseMethod: "iid_sample_sd_over_sqrt_S", pairs: w, summary: $, label: "monte-carlo" };
}
function tn(t, e) {
  if (typeof t != "number" || !Number.isSafeInteger(t)) throw new RangeError(`${e}: seed must be a safe integer, got ${String(t)}`);
  return t;
}
function wr(t, e) {
  const n = t ?? "top";
  if (n !== "top" && n !== "bottom") throw new RangeError(`${e}: side must be "top" or "bottom", got ${String(n)}`);
  return n;
}
function pr(t, e, n) {
  if (typeof t != "number" || !Number.isSafeInteger(t) || t < 1 || t > e) throw new RangeError(`${n}: k must be an integer in 1..${e}, got ${String(t)}`);
  return t;
}
function en(t, e) {
  const n = t ?? 0.15;
  if (typeof n != "number" || !(n > 0)) throw new RangeError(`${e}: priorSd must be > 0 (Infinity for a flat prior), got ${String(n)}`);
  return n;
}
function nn(t, e) {
  for (const n of ["p01", "p10"]) {
    const r = t[n];
    if (typeof r != "number" || !(r > 0 && r <= 1)) throw new RangeError(`${e}: ${n} must lie in (0, 1], got ${String(r)}`);
  }
  return { p01: t.p01, p10: t.p10 };
}
function _o(t, e, n) {
  const r = R(n, ["k", "side", "posterior"], "topKOvershoot", !0), o = nt(t, "estimate"), i = o.length, s = nt(e, "truth");
  if (s.length !== i) throw new RangeError(`topKOvershoot: truth must have ${i} values, as estimate`);
  let a = null;
  if (r.posterior !== void 0 && r.posterior !== null && (a = nt(r.posterior, "posterior"), a.length !== i))
    throw new RangeError(`topKOvershoot: posterior must have ${i} values, as estimate`);
  const c = pr(r.k, i, "topKOvershoot"), u = wr(r.side, "topKOvershoot"), l = pe(o), f = u === "top" ? l.slice(0, c) : l.slice(i - c), m = (d) => {
    let g = 0;
    for (const w of f) g += d[w] - s[w];
    return g / c;
  };
  return { k: c, side: u, units: f, overshoot: m(o), posteriorOvershoot: a === null ? null : m(a) };
}
function ks(t = $e, e = {}) {
  const n = R(e, ["replays", "k", "side", "priorSd"], "leagueOvershoot");
  tn(t, "leagueOvershoot");
  const r = mt(n.replays ?? 20, "replays", 1), o = pr(n.k ?? 3, 30, "leagueOvershoot"), i = wr(n.side, "leagueOvershoot"), s = en(n.priorSd, "leagueOvershoot"), a = ke(), c = [];
  let u = 0, l = 0;
  for (let f = 1; f <= r; f += 1) {
    const { estimate: m } = Je(t + f), d = Xe(m, a.se, { priorSd: s }), g = _o(m, a.theta, { k: o, side: i, posterior: d.mean }), w = g.posteriorOvershoot;
    c.push({ r: f, seed: t + f, units: g.units, overshoot: g.overshoot, posteriorOvershoot: w }), u += g.overshoot, l += w;
  }
  return { seed: t, replays: r, k: o, side: i, priorSd: s, draws: c, mean: { overshoot: u / r, posteriorOvershoot: l / r } };
}
function Rs(t, e, n = {}) {
  const r = R(n, ["priorSd", "priorMean"], "expectedSquaredDistance"), o = nt(t, "theta"), i = o.length, s = Nt(e, i, "se");
  ee(s, "se");
  const a = en(r.priorSd, "expectedSquaredDistance"), c = jt(r.priorMean ?? 0, "priorMean"), u = Xe(o, s, { priorSd: a, priorMean: c }).shrink, l = o.map((d, g) => {
    const w = (1 - u[g]) * (c - d);
    return w * w + u[g] * u[g] * (s[g] * s[g]);
  });
  let f = 0;
  for (const d of l) f += d;
  let m = 0;
  for (const d of s) m += d * d;
  return { perUnit: l, mean: f / i, rawMean: m / i };
}
function qo(t, e) {
  const n = nt(t, "eps");
  if (!n.every((i) => i >= 0)) throw new RangeError("weightedRadius: eps must be ≥ 0");
  const r = X(e, n.length);
  let o = 0;
  for (let i = 0; i < n.length; i += 1) o += r[i] * n[i];
  return o;
}
function zo(t) {
  const e = R(t, ["N", "Nstar", "M", "deltaW", "eta"], "regretBound", !0), n = e.M;
  if (typeof n != "number" || !Number.isSafeInteger(n) || n < 1) throw new RangeError(`regretBound: M must be a positive integer, got ${String(n)}`);
  for (const a of ["N", "Nstar"]) {
    const c = e[a];
    if (typeof c != "number" || !Number.isSafeInteger(c) || c < 0 || c > n) throw new RangeError(`regretBound: ${a} must be an integer in 0..${n}, got ${String(c)}`);
  }
  const r = e.eta ?? 0;
  for (const [a, c] of [["deltaW", e.deltaW], ["eta", r]])
    if (typeof c != "number" || !Number.isFinite(c) || c < 0) throw new RangeError(`regretBound: ${a} must be a finite number ≥ 0, got ${String(c)}`);
  const { N: o, Nstar: i, deltaW: s } = e;
  return { evaluation: o * s / n, regret: (o + i) * s / n + r, uniform: 2 * s + r };
}
function xs(t) {
  const e = R(t, ["p01", "p10", "S", "chains", "seed"], "twoStateChain", !0), { p01: n, p10: r } = nn(e, "twoStateChain"), o = mt(e.S, "S", 1), i = mt(e.chains ?? 1, "chains", 1), s = tn(e.seed, "twoStateChain"), a = n / (n + r), c = zn(s, i * o), u = [];
  for (let l = 0; l < i; l += 1) {
    const f = new Array(o);
    let m = c[l * o] < a ? 1 : 0;
    f[0] = m;
    for (let d = 1; d < o; d += 1) {
      const g = c[l * o + d];
      m === 0 ? m = g < n ? 1 : 0 : m = g < r ? 0 : 1, f[d] = m;
    }
    u.push(f);
  }
  return { p01: n, p10: r, S: o, seed: s, pi1: a, chains: u };
}
function Ms(t) {
  const e = R(t, ["p01", "p10", "S"], "chainMeanVariance", !0), { p01: n, p10: r } = nn(e, "chainMeanVariance"), o = mt(e.S, "S", 1), i = 1 - n - r, s = n / (n + r), a = s * (1 - s);
  let c = 0;
  for (let l = 1; l <= o - 1; l += 1) {
    const f = Math.pow(i, l);
    if (f === 0) break;
    c += (o - l) * f;
  }
  const u = a / (o * o) * (o + 2 * c);
  return {
    pi1: s,
    rho: i,
    variance: u,
    iidVariance: a / o,
    equivalentDraws: a / u,
    asymptoticEquivalent: i === -1 ? null : o * (1 - i) / (1 + i),
    noSwitch: (1 - s) * Math.pow(1 - n, o - 1) + s * Math.pow(1 - r, o - 1)
  };
}
function Ss(t = $e, e = {}) {
  const n = R(e, ["replays", "priorSd", "tau", "cap"], "leagueGradingReplays");
  tn(t, "leagueGradingReplays");
  const r = mt(n.replays ?? 20, "replays", 1), o = en(n.priorSd, "leagueGradingReplays"), i = Z(n.tau ?? 0.2), s = n.cap ?? 3;
  if (typeof s != "number" || !Number.isSafeInteger(s) || s < 1 || s > 30)
    throw new RangeError(`leagueGradingReplays: cap must be an integer in 1..30, got ${String(s)}`);
  const a = ke(), c = [];
  for (let l = 1; l <= r; l += 1) {
    const { estimate: f } = Je(t + l), m = Xe(f, a.se, { priorSd: o }), d = Qr(m.mean, m.sd), g = new Array(a.ids.length);
    Co(m.mean).forEach((y, N) => g[y - 1] = N);
    const w = ko(d, { order: g, tau: i, G: s });
    if (w.empty) throw new RangeError("leagueGradingReplays: the order family is empty");
    const h = w.grade, p = H(h, d, { tau: i }), b = Jn(h, a.theta);
    c.push({ r: l, seed: t + l, grade: h, N: p.N, E: p.E[0], EoverN: p.EoverN[0], D: b.D[0], DoverN: b.DoverN[0], risk: p.risk });
  }
  const u = ro(
    c.map((l) => ({ A: l.D, N: l.N })),
    { M: Vt(a.ids.length) }
  );
  return { seed: t, replays: r, priorSd: o, tau: i, cap: s, draws: c, estimands: u };
}
function Ts(t, e = {}) {
  const n = R(e, ["transform", "k", "criterion"], "transformedMeans"), r = n.transform ?? "identity";
  if (r !== "identity" && r !== "sqrt" && r !== "log" && r !== "exp")
    throw new RangeError(`transformedMeans: transform must be "identity", "sqrt", "log" or "exp", got ${String(r)}`);
  const o = n.k ?? 1;
  if (typeof o != "number" || !Number.isFinite(o) || o === 0) throw new RangeError(`transformedMeans: k must be a finite nonzero number, got ${String(o)}`);
  const i = n.criterion ?? 0;
  if (typeof i != "number" || !Number.isSafeInteger(i) || i < 0)
    throw new RangeError(`transformedMeans: criterion must be a criterion index (an integer ≥ 0), got ${String(i)}`);
  if (t == null || typeof t != "object" || Array.isArray(t))
    throw new RangeError("transformedMeans: law must be { states, probs } (a finite law) or { means, sds } (normal posteriors)");
  let s;
  if ("states" in t) {
    Dt(t, ["states", "probs"], "transformedMeans: law { states, probs }");
    const c = Bt(t.states, t.probs, "law.states");
    if (i >= c.K) throw new RangeError(`transformedMeans: criterion must be an integer in 0..${c.K - 1}, got ${i}`);
    const u = (l, f, m) => {
      switch (r) {
        case "sqrt":
          if (!(l >= 0)) throw new RangeError(`transformedMeans: "sqrt" needs θ ≥ 0, but unit ${f} is ${l} in state ${m}`);
          return Math.sqrt(l);
        case "log":
          if (!(l > 0)) throw new RangeError(`transformedMeans: "log" needs θ > 0, but unit ${f} is ${l} in state ${m}`);
          return Math.log(l);
        case "exp":
          return Math.exp(o * l);
        default:
          return l;
      }
    };
    s = new Array(c.n);
    for (let l = 0; l < c.n; l += 1) {
      let f = 0;
      for (let m = 0; m < c.S; m += 1) {
        const d = u(c.states[m][l * c.K + i], l, m);
        f += c.p === null ? d : c.p[m] * d;
      }
      s[l] = c.p === null ? f / c.S : f;
    }
  } else if ("means" in t) {
    Dt(t, ["means", "sds"], "transformedMeans: law { means, sds }");
    const c = nt(t.means, "law.means"), u = Nt(t.sds, c.length, "law.sds");
    if (ee(u, "law.sds"), i !== 0) throw new RangeError(`transformedMeans: normal posteriors have one criterion (criterion 0), got ${i}`);
    if (r === "identity") s = c.slice();
    else if (r === "exp") s = c.map((l, f) => Math.exp(o * l + o * o * (u[f] * u[f]) / 2));
    else throw new RangeError(`transformedMeans: normal posteriors take transform "identity" or "exp", not "${r}"`);
  } else
    throw new RangeError("transformedMeans: law must be { states, probs } (a finite law) or { means, sds } (normal posteriors)");
  const a = s.map((c, u) => u).sort((c, u) => s[u] > s[c] ? 1 : s[u] < s[c] ? -1 : c - u);
  return { means: s, order: a };
}
function Fs(t, e, n) {
  const r = R(n, ["tau", "w", "family"], "selectionOnDraws", !0), { n: o, K: i } = rt(e), s = Qn(t);
  if (s.ids.length !== o || s.e.length !== i)
    throw new RangeError(`selectionOnDraws: draws must be S × ${o} units × ${i} criteria, as E (got ${s.ids.length} × ${s.e.length})`);
  const a = { tau: r.tau, w: r.w, family: r.family }, c = Ct(s, a);
  if (c.empty) throw new RangeError(`selectionOnDraws: the family ${c.family.name} is empty`);
  const u = Ct(e, a);
  if (u.empty) throw new RangeError(`selectionOnDraws: the family ${u.family.name} is empty`);
  const l = X(r.w, i), f = c.grade, m = H(f, s, { tau: r.tau, w: l }), d = H(f, e, { tau: r.tau, w: l }), g = to(s, e).epsilon, w = qo(g, l), h = zo({ N: d.N, Nstar: u.N, M: d.M, deltaW: w });
  return {
    grade: f,
    N: d.N,
    inSample: m.risk,
    exact: d.risk,
    gap: m.risk - d.risk,
    epsilon: g,
    deltaW: w,
    bound: h.evaluation,
    best: u.risk,
    regret: d.risk - u.risk,
    regretBound: h.regret
  };
}
function Cs(t, e, n) {
  const r = R(n, ["ref", "crit"], "withinBand", !0), o = nt(t, "withinBand: est"), i = o.length, s = Nt(e, i, "withinBand: se");
  if (!s.every((f) => f > 0)) throw new RangeError("withinBand: se must be > 0");
  if (r.ref === void 0 || r.ref === null) throw new RangeError("withinBand: ref is required (one finite number, or one per unit)");
  const a = Nt(r.ref, i, "withinBand: ref"), c = r.crit ?? 1;
  if (typeof c != "number" || !Number.isFinite(c) || c < 0) throw new RangeError(`withinBand: crit must be a finite number ≥ 0, got ${String(c)}`);
  let u = 0;
  for (let f = 0; f < i; f += 1) Math.abs((o[f] - a[f]) / s[f]) <= c && (u += 1);
  const l = Sr(c);
  return { within: u, n: i, share: l, expected: i * l };
}
function js(t, e, n) {
  const r = R(n, ["priorSd", "meanSd", "priorMean"], "sharedMeanPosterior", !0), o = nt(t, "sharedMeanPosterior: est"), i = o.length, s = Nt(e, i, "sharedMeanPosterior: se");
  if (!s.every((E) => E > 0)) throw new RangeError("sharedMeanPosterior: se must be > 0");
  const a = r.priorSd;
  if (typeof a != "number" || !Number.isFinite(a) || !(a > 0))
    throw new RangeError(`sharedMeanPosterior: priorSd must be a finite number > 0 (it is required), got ${String(a)}`);
  const c = r.meanSd ?? Number.POSITIVE_INFINITY;
  if (typeof c != "number" || !(c > 0))
    throw new RangeError(`sharedMeanPosterior: meanSd must be > 0 (Infinity for a flat prior on the mean), got ${String(c)}`);
  const u = r.priorMean ?? 0;
  if (typeof u != "number" || !Number.isFinite(u)) throw new RangeError(`sharedMeanPosterior: priorMean must be a finite number, got ${String(u)}`);
  const l = a * a, f = s.map((E) => l + E * E), m = f.map((E) => l / E);
  let d = 0, g = 0;
  for (let E = 0; E < i; E += 1)
    d += 1 / f[E], g += o[E] / f[E];
  const w = c === Number.POSITIVE_INFINITY, h = c * c, p = 1 / ((w ? 0 : 1 / h) + d), b = p * ((w ? 0 : u / h) + g), y = o.map((E, v) => (1 - m[v]) * b + m[v] * E), N = s.map((E, v) => {
    const $ = 1 - m[v];
    return Math.sqrt(l * (E * E) / f[v] + $ * $ * p);
  }), I = o.map(
    (E, v) => o.map(($, A) => v === A ? 1 : (1 - m[v]) * (1 - m[A]) * p / (N[v] * N[A]))
  );
  return { weight: m, muMean: b, muVar: p, means: y, sds: N, corr: I };
}
function Gs(t, e) {
  if (typeof t != "number" || !(t >= 0 && t <= 1)) throw new RangeError(`binomialMcse: e must be a probability in [0, 1], got ${String(t)}`);
  if (typeof e != "number" || !Number.isSafeInteger(e) || e < 1) throw new RangeError(`binomialMcse: S must be an integer ≥ 1, got ${String(e)}`);
  return Math.sqrt(t * (1 - t) / e);
}
function Os(t) {
  const e = R(t, ["p01", "p10", "S", "radius"], "chainCountLaw", !0), { p01: n, p10: r } = nn(e, "chainCountLaw"), o = e.S;
  if (typeof o != "number" || !Number.isSafeInteger(o) || o < 1 || o > 5e3) throw new RangeError(`chainCountLaw: S must be an integer in 1..5000, got ${String(o)}`);
  const i = e.radius ?? null;
  if (i !== null && (typeof i != "number" || !Number.isFinite(i) || i < 0))
    throw new RangeError(`chainCountLaw: radius must be null or a finite number ≥ 0, got ${String(i)}`);
  const s = n / (n + r), a = 1 - n, c = 1 - r, u = new Float64Array(o + 1), l = new Float64Array(o + 1);
  u[0] = 1 - s, l[1] = s;
  for (let d = 1; d < o; d += 1) {
    for (let g = d; g >= 0; g -= 1) {
      const w = u[g], h = l[g];
      l[g + 1] = w * n + h * c, u[g] = w * a + h * r;
    }
    l[0] = 0;
  }
  const f = new Array(o + 1);
  for (let d = 0; d <= o; d += 1) f[d] = u[d] + l[d];
  let m = null;
  if (i !== null) {
    m = 0;
    for (let d = 0; d <= o; d += 1) Math.abs(d / o - s) > i && (m += f[d]);
  }
  return { pi1: s, probs: f, outside: m };
}
function Ps(t) {
  const e = nt(t, "runningMean: trace"), n = new Float64Array(e.length);
  let r = 0;
  for (let o = 0; o < e.length; o += 1)
    r += e[o], n[o] = r / (o + 1);
  return n;
}
function Mt(t, e) {
  if (t == null || typeof t != "object" || typeof t.length != "number" || t.length < 1) throw new RangeError(`${e} must be a nonempty array`);
  const n = Array.from(t);
  if (!n.every((r) => typeof r == "number" && Number.isFinite(r))) throw new RangeError(`${e} must be finite numbers`);
  return n;
}
function rn(t, ...e) {
  for (const [n, r] of e) if (n.length !== t) throw new RangeError(`${r} must have ${t} values`);
}
function Do(t) {
  const e = t.length;
  let n = 0;
  for (let o = 0; o < e; o += 1) n += t[o];
  let r = n / e;
  if (Number.isFinite(r)) {
    let o = 0;
    for (let i = 0; i < e; i += 1) o += t[i] - r;
    r += o / e;
  }
  return r;
}
function Oe(t) {
  const e = Mt(t, "values"), n = e.length, r = Do(e);
  if (n < 2) return { n, mean: r, sd: null };
  let o = 0;
  for (let i = 0; i < n; i += 1) o += (e[i] - r) * (e[i] - r);
  return { n, mean: r, sd: Math.sqrt(o / (n - 1)) };
}
function _s(t, e) {
  const n = Mt(t, "a"), r = Mt(e, "b");
  rn(n.length, [r, "b"]);
  const o = new K();
  for (let i = 0; i < n.length; i += 1) o.add((n[i] - r[i]) * (n[i] - r[i]));
  return o.value / n.length;
}
function qs(t, e, n) {
  const r = Mt(t, "estimates"), o = Mt(e, "posteriorMeans"), i = Mt(n, "truth");
  rn(r.length, [o, "posteriorMeans"], [i, "truth"]);
  const s = r.map((c, u) => Math.abs(o[u] - i[u]) > Math.abs(c - i[u])), a = s.flatMap((c, u) => c ? [u] : []);
  return { count: a.length, flags: s, units: a };
}
function zs(t, e, n, r = {}) {
  r = R(r, ["threshold"], "intervalOverlapTally");
  const o = Mt(t, "lower"), i = Mt(e, "upper"), s = o.length;
  if (s < 2) throw new RangeError("intervalOverlapTally needs at least two units");
  rn(s, [i, "upper"]), o.forEach((w, h) => {
    if (!(w <= i[h])) throw new RangeError(`lower[${h}] must be ≤ upper[${h}]`);
  });
  const a = r.threshold ?? 0.9;
  if (typeof a != "number" || !(a >= 0 && a <= 1)) throw new RangeError("threshold must lie in [0, 1]");
  if (n == null || typeof n != "object" || n.length !== s) throw new RangeError(`pi must be an ${s} × ${s} matrix`);
  const c = (w, h) => {
    const p = n[w];
    if (p == null || typeof p != "object" || p.length !== s) throw new RangeError(`pi must be an ${s} × ${s} matrix`);
    const b = p[h];
    if (typeof b != "number" || !(b >= 0 && b <= 1)) throw new RangeError(`pi[${w}][${h}] must be a probability`);
    return b;
  }, u = [];
  let l = 0, f = 0, m = 0, d = 0, g = null;
  for (let w = 0; w < s; w += 1)
    for (let h = w + 1; h < s; h += 1) {
      const p = c(w, h), b = c(h, w), [y, N, I] = p >= b ? [w, h, p] : [h, w, b], E = Math.max(o[w], o[h]) < Math.min(i[w], i[h]), v = E ? I > a ? "high" : "low" : "apart";
      v === "apart" ? l += 1 : v === "high" ? f += 1 : m += 1;
      const $ = Math.min(i[w], i[h]) - Math.max(o[w], o[h]), A = o[w] <= o[h] && i[h] <= i[w] || o[h] <= o[w] && i[w] <= i[h];
      A && (d += 1), u.push({ i: w, j: h, first: y, second: N, pi: I, overlap: E, class: v, amount: $, nested: A }), E && (g === null || I > g.pi) && (g = { i: w, j: h, first: y, second: N, pi: I });
    }
  return { n: s, M: s * (s - 1) / 2, threshold: a, apart: l, overlapping: f + m, high: f, low: m, pairs: u, best: g, nestedCount: d };
}
function Ds(t, e = {}) {
  e = R(e, ["level", "tieTol"], "rankIntervals");
  const n = e.level ?? 0.9;
  if (typeof n != "number" || !(n > 0 && n < 1)) throw new RangeError("level must lie in (0, 1)");
  const r = e.tieTol ?? 1e-12;
  if (typeof r != "number" || !(r >= 0)) throw new RangeError("tieTol must be ≥ 0");
  if (t == null || typeof t != "object" || typeof t.length != "number" || t.length < 1)
    throw new RangeError("pTop must be a nonempty array of rows");
  const o = t.length, i = Array.from({ length: o }, (m, d) => Mt(t[d], `pTop[${d}]`)), s = i[0].length;
  i.forEach((m, d) => {
    if (m.length !== s) throw new RangeError(`pTop[${d}] must have ${s} values`);
  });
  const a = (1 - n) / 2, c = a - r, u = 1 - a - r, l = new Array(s).fill(null), f = new Array(s).fill(null);
  for (let m = 0; m < o; m += 1)
    for (let d = 0; d < s; d += 1)
      l[d] === null && i[m][d] >= c && (l[d] = m + 1), f[d] === null && i[m][d] >= u && (f[d] = m + 1);
  return { level: n, tail: a, lower: l, upper: f };
}
function Ks(t, e) {
  if (!Number.isInteger(t) || t < 2 || t > 30 || !Number.isInteger(e) || e < 1 || e > t)
    throw new RangeError("tierSizeDistribution: integer n in2..30 and G in1..n required");
  let n = /* @__PURE__ */ new Map([[0, /* @__PURE__ */ new Map([[0, 1]])]]);
  for (let u = 1; u <= e; u += 1) {
    const l = /* @__PURE__ */ new Map();
    for (const [f, m] of n) for (let d = 1; d <= t - f - (e - u); d += 1) {
      const g = f + d, w = d * (d - 1) / 2;
      let h = l.get(g);
      h || (h = /* @__PURE__ */ new Map(), l.set(g, h));
      for (const [p, b] of m) h.set(p + w, (h.get(p + w) ?? 0) + b);
    }
    n = l;
  }
  const r = Vt(t), o = n.get(t), i = Array.from(o.values()).reduce((u, l) => u + l, 0), s = Array.from(o, ([u, l]) => ({ N: r - u, withheld: u, count: l, probability: l / i })).sort((u, l) => u.N - l.N), a = Array.from({ length: e }, (u, l) => Math.floor(t / e) + (l < t % e ? 1 : 0)), c = s[s.length - 1].N;
  return { n: t, G: e, M: r, totalPatterns: i, distribution: s, maxN: c, maxShare: c / r, balancedSizes: a };
}
function Bs(t, e) {
  const n = -qe(t, e, { lambda: 1 });
  return n === 0 ? 0 : n;
}
function Ls(t, e) {
  const n = R(e, ["tau", "w", "details"], "thresholdViolations", !0);
  if (!Number.isFinite(n.tau) || n.tau < 0 || n.tau > 0.5) throw new RangeError("thresholdViolations: tau must be in[0,.5]");
  if (n.details !== void 0 && typeof n.details != "boolean") throw new TypeError("thresholdViolations: details must be boolean");
  const r = To(t, n.w), o = r.length, i = Vt(o), s = Array.from({ length: o }, () => Array(o).fill(0)), a = [], c = Array(o).fill(0);
  for (let w = 0; w < o; w += 1) for (let h = w + 1; h < o; h += 1) {
    const p = r[w][h] < n.tau, b = r[h][w] < n.tau;
    if (p && b) throw new RangeError("thresholdViolations: both directions qualify for one pair");
    const y = p ? 1 : b ? -1 : 0;
    if (s[w][h] = y, s[h][w] = -y, y) {
      const N = p ? w : h;
      a.push({ above: N, below: p ? h : w, error: p ? r[w][h] : r[h][w] }), c[N] += 1;
    }
  }
  const u = { twoWithheld: 0, statedChain: 0, directedCycle: 0 }, l = n.details ? [] : null, f = Array(o).fill(0), m = Array.from({ length: o }, () => Array(o).fill(0));
  let d = 0, g = 0;
  for (let w = 0; w < o; w += 1) for (let h = w + 1; h < o; h += 1) for (let p = h + 1; p < o; p += 1) {
    d += 1;
    const b = s[w][h], y = s[h][p], N = s[w][p], I = +(b !== 0) + +(y !== 0) + +(N !== 0);
    let E = null;
    if (I === 1 ? E = "twoWithheld" : I === 2 ? (N === 0 && b === y || y === 0 && b === -N || b === 0 && y === -N) && (E = "statedChain") : I === 3 && b === y && b === -N && (E = "directedCycle"), E !== null) {
      g += 1, u[E] += 1, l?.push({ i: w, j: h, k: p, kind: E });
      for (const v of [w, h, p]) f[v] += 1;
      for (const [v, $] of [[w, h], [w, p], [h, p]])
        m[v][$] += 1, m[$][v] += 1;
    }
  }
  return { n: o, M: i, tau: n.tau, relation: s, statedPairs: a, statedCount: a.length, aboveCounts: c, triples: d, invalidCount: g, counts: u, printable: g === 0, unitIncidence: f, pairIncidence: m, violations: l };
}
function Vs(t, e, n, r) {
  const o = R(r, ["tau", "w", "tieTol"], "compareReportLosses", !0), i = o.tieTol ?? 1e-12;
  if (!Number.isFinite(i) || i < 0) throw new RangeError("compareReportLosses: tieTol must be finite and nonnegative");
  if (!Array.isArray(n) || n.length < 1) throw new RangeError("compareReportLosses: nonempty whole-state draws required");
  const s = tt(t), a = tt(e, s.length), c = [], u = [];
  for (const w of n) {
    const h = Qn([w]);
    c.push(H(s, h, { tau: o.tau, w: o.w }).risk), u.push(H(a, h, { tau: o.tau, w: o.w }).risk);
  }
  const l = u.map((w, h) => w - c[h]), f = n.length, m = l.filter((w) => w < -i).length, d = l.filter((w) => w > i).length, g = f - m - d;
  return {
    lossBest: c,
    lossRule: u,
    delta: l,
    meanBest: Oe(c).mean,
    meanRule: Oe(u).mean,
    meanDelta: Oe(l).mean,
    mcseDelta: Po(l),
    ruleWins: m,
    bestWins: d,
    ties: g,
    ruleWinShare: m / f,
    bestWinShare: d / f,
    tieShare: g / f,
    S: f,
    tieTol: i
  };
}
function Ws(t, e) {
  const n = R(e, ["values", "pTop", "budget"], "allocationValue", !0), r = tt(t), o = r.length, i = n.budget;
  if (!Array.isArray(n.values) || n.values.length !== o || !n.values.every(Number.isFinite)) throw new RangeError("allocationValue: n finite values required");
  if (!Array.isArray(n.pTop) || n.pTop.length !== o || !n.pTop.every((d) => Number.isFinite(d) && d >= 0 && d <= 1)) throw new RangeError("allocationValue: n probabilities in[0,1] required");
  if (!Number.isInteger(i) || i < 0 || i > o) throw new RangeError("allocationValue: integer budget in0..n required");
  if (Math.abs(n.pTop.reduce((d, g) => d + g, 0) - i) > 1e-10 * Math.max(1, o)) throw new RangeError("allocationValue: exact-cardinality pTop must sum to budget");
  const s = Array(o).fill(0);
  let a = null, c = [], u = 0, l = 0;
  if (i > 0) for (let d = 1; d <= Math.max(...r); d += 1) {
    const g = r.flatMap((w, h) => w === d ? [h] : []);
    if (l + g.length >= i) {
      a = d, c = g, u = i - l;
      for (const w of g) s[w] = u / g.length;
      break;
    }
    for (const w of g) s[w] = 1;
    l += g.length;
  }
  const f = s.reduce((d, g, w) => d + g * n.values[w], 0), m = s.reduce((d, g, w) => d + g * n.pTop[w], 0);
  return {
    inclusion: s,
    expectedValue: f,
    expectedOverlap: m,
    overlapShare: i === 0 ? null : m / i,
    selectedCount: s.reduce((d, g) => d + g, 0),
    budget: i,
    boundaryGrade: a,
    boundaryMembers: c,
    boundarySize: c.length,
    remaining: u,
    aboveCount: l
  };
}
function Us(t, e) {
  const n = R(e, ["falsePositiveCost", "falseNegativeCost", "positive", "values"], "thresholdClassification", !0);
  if (!Array.isArray(t) || !t.length || !t.every((g) => Number.isFinite(g) && g >= 0 && g <= 1)) throw new RangeError("thresholdClassification: nonempty probabilities in[0,1] required");
  const r = n.falsePositiveCost, o = n.falseNegativeCost;
  if (!Number.isFinite(r) || !Number.isFinite(o) || r < 0 || o < 0 || !Number.isFinite(r + o) || r + o <= 0) throw new RangeError("thresholdClassification: finite nonnegative costs with positive sum required");
  const i = r / (r + o), s = t.map((g) => g >= i);
  if (n.positive !== void 0 && (!Array.isArray(n.positive) || n.positive.length !== t.length || !n.positive.every((g) => typeof g == "boolean" || g === 0 || g === 1))) throw new RangeError("thresholdClassification: positive must be a matching boolean or0/1 vector");
  const a = n.positive === void 0 ? s.slice() : n.positive.map(Boolean);
  if (n.values !== void 0 && (!Array.isArray(n.values) || n.values.length !== t.length || !n.values.every(Number.isFinite))) throw new RangeError("thresholdClassification: values must be matching finite values");
  const c = n.values === void 0 ? null : n.values.reduce((g, w, h) => g + (a[h] ? w : 0), 0), u = t.map((g) => r * (1 - g)), l = t.map((g) => o * g), f = t.reduce((g, w, h) => g + (a[h] ? 1 - w : 0), 0), m = t.reduce((g, w, h) => g + (a[h] ? 0 : w), 0), d = r * f + o * m;
  return {
    positive: a,
    bayesPositive: s,
    positiveCount: a.filter(Boolean).length,
    cutoff: i,
    positiveCost: u,
    negativeCost: l,
    expectedFalsePositives: f,
    expectedFalseNegatives: m,
    totalCost: d,
    meanCost: d / t.length,
    selectedValue: c
  };
}
function Rn(t, e) {
  if (!Array.isArray(t) || t.length < 2) throw new RangeError(`${e} must be a rectangular array with at least two units`);
  const n = t[0]?.length;
  if (!Number.isSafeInteger(n) || n < 1) throw new RangeError(`${e} must have at least one criterion per unit`);
  for (let r = 0; r < t.length; r += 1) {
    const o = t[r];
    if (o === null || typeof o != "object" || o.length !== n) throw new RangeError(`${e}[${r}] must have ${n} criterion values`);
    for (let i = 0; i < n; i += 1)
      if (typeof o[i] != "number" || !Number.isFinite(o[i])) throw new RangeError(`${e} must contain finite numbers only`);
  }
  return { n: t.length, K: n };
}
function xn(t, e, n) {
  const r = t === void 0 ? e : t;
  if (typeof r != "number" || !Number.isFinite(r) || r < 0) throw new RangeError(`${n} must be a finite number ≥ 0`);
  return r;
}
function Ys(t, e, n) {
  const r = R(n, ["a", "multiplier", "ids"], "normalComposite", !0), { n: o, K: i } = Rn(t, "means"), s = Rn(e, "sds");
  if (s.n !== o || s.K !== i) throw new RangeError(`sds must be ${o} units × ${i} criteria, as means`);
  const a = r.a;
  if (!Array.isArray(a) || a.length !== i || !a.every((d) => typeof d == "number" && Number.isFinite(d)))
    throw new RangeError(`a must hold ${i} finite composite coefficients`);
  const c = r.multiplier === void 0 ? new Array(i).fill(1) : r.multiplier;
  if (!Array.isArray(c) || c.length !== i || !c.every((d) => typeof d == "number" && Number.isFinite(d) && d > 0))
    throw new RangeError(`multiplier must hold ${i} finite positive multipliers`);
  const { ids: u } = Pt({ ids: r.ids }, o, 1), l = [], f = [];
  for (let d = 0; d < o; d += 1) {
    const g = new K(), w = new K();
    for (let h = 0; h < i; h += 1) {
      if (e[d][h] < 0) throw new RangeError("sds must contain SDs ≥ 0");
      const p = a[h] * c[h];
      g.add(p * t[d][h]);
      const b = p * e[d][h];
      w.add(b * b);
    }
    if (l.push(g.value), f.push(Math.sqrt(w.value)), !Number.isFinite(l[d]) || !Number.isFinite(f[d])) throw new RangeError("normalComposite: composite mean and SD must remain finite");
  }
  const m = Tt(o);
  for (let d = 0; d < o; d += 1)
    for (let g = 0; g < o; g += 1) {
      if (d === g) continue;
      const w = Math.hypot(f[d], f[g]);
      m[d][g] = w === 0 ? +(l[d] <= l[g]) : St((l[g] - l[d]) / w);
    }
  return { mean: l, sd: f, E: { ids: u, criteria: ["composite"], e: [m] } };
}
function Hs(t, e, n, r) {
  const o = R(r, ["tau", "w"], "compareReports", !0), { n: i, K: s, e: a } = rt(n), c = Z(o.tau), u = X(o.w, s), l = tt(t, i), f = tt(e, i), m = H(l, n, { tau: c, w: u }), d = H(f, n, { tau: c, w: u }), g = [], w = (h, p, b) => h === 0 ? c : h > 0 ? ot(a, u, p, b) : ot(a, u, b, p);
  for (let h = 0; h < i; h += 1)
    for (let p = h + 1; p < i; p += 1) {
      const b = Math.sign(l[p] - l[h]), y = Math.sign(f[p] - f[h]);
      if (b === y) continue;
      const N = w(b, h, p), I = w(y, h, p), E = I - N;
      g.push({ i: h, j: p, beforeRelation: b, afterRelation: y, beforeCost: N, afterCost: I, costDifference: E, normalizedDifference: E / m.M });
    }
  return {
    before: m,
    after: d,
    deltaRisk: d.risk - m.risk,
    errorTermDelta: (d.Ew - m.Ew) / m.M,
    withholdingTermDelta: c * (m.N - d.N) / m.M,
    change: co(l, f, n, { w: u }),
    pairs: g
  };
}
function Zs(t, e, n) {
  const r = R(n, ["q", "epsilon", "family", "tau", "w", "feasibilityTol", "coefficientTol"], "protectionEnvelopes", !0), o = rt(t, "Ehat"), i = rt(e, "Eexact"), { n: s, K: a } = o;
  if (i.n !== s || i.K !== a) throw new RangeError("Ehat and Eexact must have matching dimensions");
  for (const [k, C] of [[t, "Ehat"], [e, "Eexact"]]) {
    if (!Array.isArray(k.ids) || !Array.isArray(k.criteria)) throw new RangeError(`${C} must have ids and criteria arrays`);
    if (!Array.from(k.ids).every((j) => typeof j == "string") || !Array.from(k.criteria).every((j) => typeof j == "string"))
      throw new RangeError(`${C} ids and criteria must be strings`);
    Pt({ ids: k.ids, criteria: k.criteria }, s, a);
    for (let j = 0; j < a; j += 1)
      for (let V = 0; V < s; V += 1)
        for (let D = 0; D < s; D += 1)
          if (V !== D && (k.e[j][V][D] < 0 || k.e[j][V][D] > 1)) throw new RangeError(`${C}.e off-diagonal entries must lie in [0, 1]`);
  }
  if (t.ids.some((k, C) => k !== e.ids[C]) || t.criteria.some((k, C) => k !== e.criteria[C]))
    throw new RangeError("Ehat and Eexact must have matching ids and criteria in the same order");
  const c = Z(r.tau), u = X(r.w, a);
  if (!Array.isArray(r.q) || r.q.length !== a) throw new RangeError(`q must hold ${a} protection thresholds (null for none)`);
  const l = Array.from(r.q, (k, C) => {
    if (k === null) return null;
    if (typeof k != "number" || !Number.isFinite(k) || k < 0 || k > 1) throw new RangeError(`q[${C}] must lie in [0, 1], or be null`);
    return k;
  }), f = typeof r.epsilon == "number" ? new Array(a).fill(r.epsilon) : r.epsilon;
  if (!Array.isArray(f) || f.length !== a || !Array.from(f).every((k) => typeof k == "number" && Number.isFinite(k) && k >= 0))
    throw new RangeError(`epsilon must be a finite nonnegative scalar or ${a} finite nonnegative radii`);
  const m = [...f], d = xn(r.feasibilityTol, 0, "feasibilityTol"), g = xn(r.coefficientTol, 1e-12, "coefficientTol"), w = l.map((k, C) => k === null ? null : k - m[C]), h = l.map((k, C) => k === null ? null : k + m[C]), p = r.family ?? { kind: "all" }, b = ht(s, p);
  It(s, b, p);
  const y = new Array(a).fill(0);
  for (let k = 0; k < a; k += 1)
    for (let C = 0; C < s; C += 1)
      for (let j = 0; j < s; j += 1)
        C !== j && (y[k] = Math.max(y[k], Math.abs(o.e[k][C][j] - i.e[k][C][j])));
  const N = y.map((k, C) => k - m[C]), I = {
    maxAbs: y,
    excess: N,
    strictEnvelopeHolds: N.every((k) => k <= 0),
    withinCoefficientTolerance: N.every((k) => k <= g),
    coefficientTol: g
  }, E = [], v = { inner: 0, nominal: 0, exact: 0, outer: 0 }, $ = {
    innerSubsetExact: !0,
    exactSubsetOuter: !0,
    innerSubsetNominal: !0,
    nominalSubsetOuter: !0,
    counterexampleInnerExact: null,
    counterexampleExactOuter: null
  };
  if (b.sizeExact !== 0n) {
    const k = At(s, p, []);
    for (; k.next(); ) {
      const C = Array.from(k.g), j = H(C, t, { tau: c, w: u }), V = H(C, e, { tau: c, w: u }), D = j.N, U = (G, B) => G.map((_, W) => _ === null ? null : _ * D - B[W]), et = {
        inner: U(w, j.E),
        nominal: U(l, j.E),
        exact: U(l, V.E),
        outer: U(h, j.E)
      }, F = (G, B) => G.every((_, W) => _ === null || B[W] <= _ * D + d), x = {
        inner: F(w, j.E),
        nominal: F(l, j.E),
        exact: F(l, V.E),
        outer: F(h, j.E)
      };
      for (const G of ["inner", "nominal", "exact", "outer"]) x[G] && (v[G] += 1);
      x.inner && !x.exact && ($.innerSubsetExact = !1, $.counterexampleInnerExact === null && ($.counterexampleInnerExact = [...C])), x.exact && !x.outer && ($.exactSubsetOuter = !1, $.counterexampleExactOuter === null && ($.counterexampleExactOuter = [...C])), x.inner && !x.nominal && ($.innerSubsetNominal = !1), x.nominal && !x.outer && ($.nominalSubsetOuter = !1), E.push({ grade: C, N: D, estimated: j, exact: V, membership: x, slack: et });
    }
  }
  const A = { inner: v.inner === 0, nominal: v.nominal === 0, exact: v.exact === 0, outer: v.outer === 0 };
  return { family: b, tau: c, w: u, q: l, epsilon: m, innerThreshold: w, outerThreshold: h, feasibilityTol: d, coefficientCheck: I, actualBracketInclusions: $, counts: v, empty: A, rows: E };
}
function Ko(t) {
  const e = /* @__PURE__ */ new Set(), n = (r) => {
    if (r === null || typeof r == "boolean" || typeof r == "string" || typeof r == "number" && Number.isFinite(r)) return r;
    if (typeof r != "object") throw new TypeError("Non-JSON diagnostic value.");
    if (e.has(r)) throw new TypeError("Cyclic diagnostic value.");
    e.add(r);
    try {
      if (Array.isArray(r)) return r.map(n);
      if (Object.getPrototypeOf(r) !== Object.prototype && Object.getPrototypeOf(r) !== null)
        throw new TypeError("Non-JSON diagnostic object.");
      return Object.fromEntries(Object.entries(r).map(([o, i]) => [o, n(i)]));
    } finally {
      e.delete(r);
    }
  };
  try {
    return n(t);
  } catch {
    return;
  }
}
class on extends Error {
  constructor(n, r, o, i) {
    super(o);
    z(this, "code");
    z(this, "field");
    z(this, "details");
    if (this.name = "MdomainError", this.code = n, this.field = r, i !== void 0) {
      const s = Ko(i);
      s !== void 0 && (this.details = s);
    }
  }
  toJSON() {
    return {
      code: this.code,
      field: this.field,
      message: this.message,
      ...this.details === void 0 ? {} : { details: this.details }
    };
  }
}
function S(t, e, n, r) {
  throw new on(t, e, n, r);
}
const Rt = Object.freeze({ n: 0n, d: 1n }), fe = Object.freeze({ n: 1n, d: 1n });
function Mn(t) {
  return t < 0n ? -t : t;
}
function be(t, e) {
  for (t = Mn(t), e = Mn(e); e !== 0n; ) {
    const n = t % e;
    t = e, e = n;
  }
  return t;
}
function Gt(t, e = 1n) {
  if ((typeof t != "bigint" || typeof e != "bigint") && S("mdomainPolicyInvalid", "rational", "Internal numerator and denominator must be BigInt."), e === 0n && S("mdomainPolicyInvalid", "rational.denominator", "A fraction denominator cannot be zero."), t === 0n) return Rt;
  e < 0n && (t = -t, e = -e);
  const n = be(t, e);
  return { n: t / n, d: e / n };
}
function Ht(t) {
  return typeof t == "bigint" ? Gt(t) : ((typeof t != "number" || !Number.isSafeInteger(t)) && S("mdomainPolicyInvalid", "integer", "Expected an exact safe integer or a BigInt."), Gt(BigInt(t)));
}
function at(t) {
  return t.d === 1n ? String(t.n) : `${t.n}/${t.d}`;
}
function ye(t, e = "exact", n = "mdomainPolicyInvalid") {
  (typeof t != "string" || t.length === 0 || t.length > 256) && S(n, e, "Expected canonical nonnegative fraction text of at most 256 characters.");
  const r = /^(0|[1-9][0-9]*)(?:\/([1-9][0-9]*))?$/.exec(t);
  r || S(n, e, "Expected canonical nonnegative integer or fraction text.");
  const o = Gt(BigInt(r[1]), r[2] === void 0 ? 1n : BigInt(r[2]));
  return at(o) !== t && S(n, e, "Fraction text must be reduced, with zero and integers written without a denominator."), o;
}
function Kt(t, e) {
  const n = be(t.d, e.d);
  return Gt(t.n * (e.d / n) + e.n * (t.d / n), t.d / n * e.d);
}
function Qt(t, e) {
  if (t.n === 0n || e.n === 0n) return Rt;
  const n = be(t.n, e.d), r = be(e.n, t.d);
  return Gt(t.n / n * (e.n / r), t.d / r * (e.d / n));
}
function Sn(t, e) {
  return e.n === 0n && S("mdomainPolicyInvalid", "rational.divisor", "Cannot divide by zero."), Qt(t, Gt(e.d, e.n));
}
function bt(t, e) {
  const n = t.n * e.d - e.n * t.d;
  return n < 0n ? -1 : n > 0n ? 1 : 0;
}
function Bo(t) {
  const e = t.n / t.d;
  return t.n < 0n && t.n % t.d !== 0n ? e - 1n : e;
}
function wt(t, e, n) {
  (typeof t != "object" || t === null || Array.isArray(t)) && S(n, e, "An ordinary object is required.");
  const r = Object.getPrototypeOf(t);
  r !== Object.prototype && r !== null && S(n, e, "An ordinary object is required.");
  const o = /* @__PURE__ */ Object.create(null);
  for (const i of Reflect.ownKeys(t)) {
    typeof i != "string" && S(n, e, "Symbol properties are not transport fields.");
    const s = Object.getOwnPropertyDescriptor(t, i);
    (!s || !("value" in s) || !s.enumerable) && S(n, `${e}.${i}`, "Transport fields must be enumerable data properties."), o[i] = s.value;
  }
  return o;
}
function yt(t, e, n, r) {
  const o = new Set(e);
  for (const i of Object.keys(t))
    o.has(i) || S(r, `${n}.${i}`, "Unknown transport field.");
}
function st(t, e, n) {
  return (typeof t != "string" || t.trim().length === 0) && S(n, e, "A nonblank string is required."), t;
}
function J(t, e, n, r) {
  (!Array.isArray(t) || t.length !== e) && S(r, n, "An array of the exact declared length is required.", { expectedLength: e });
  for (let o = 0; o < e; o += 1) {
    const i = Object.getOwnPropertyDescriptor(t, String(o));
    (!i || !("value" in i) || !i.enumerable) && S(r, `${n}[${o}]`, "Dense array entries must be enumerable data properties.");
  }
  for (const o of Reflect.ownKeys(t))
    o !== "length" && (typeof o != "string" || !/^(0|[1-9]\d*)$/.test(o) || Number(o) >= e) && S(r, n, "Array properties outside the declared entries are not supported.");
  return t;
}
function Ie(t, e, n) {
  Array.isArray(t) || S(n, e, "An ordered ID array is required.");
  const r = J(t, t.length, e, n), o = [], i = /* @__PURE__ */ new Set();
  for (let s = 0; s < r.length; s += 1) {
    const a = st(r[s], `${e}[${s}]`, n);
    i.has(a) && S(n, `${e}[${s}]`, "IDs must be unique within their ordered vector."), i.add(a), o.push(a);
  }
  return o;
}
function ie(t, e, n) {
  const r = J(t, e.length, n, "mdomainIdentityMismatch"), o = Ie(r, n, "mdomainIdentityMismatch");
  return o.some((i, s) => i !== e[s]) && S("mdomainIdentityMismatch", n, "IDs must match the input's declared order exactly.", {
    expected: [...e],
    actual: o
  }), o;
}
const Lo = ["inputId", "lawId", "representation", "coupling", "unitIds", "domainIds", "stateIds", "states", "masses", "targets", "provenance"], Vo = ["domainId", "definition", "units", "orientation", "equalityClasses", "equalityProvenance"], Wo = ["producer", "conditioningInfo", "jointGeneration", "finiteSupportOrigin", "properLaw"];
function Pe(t, e, n, r) {
  return (!Array.isArray(t) || t.length < n) && S("mdomainInputInvalid", e, "The declared dimension is too small.", { minimum: n }), t.length > r && S("mdomainResourceCap", e, "The declared dimension exceeds the browser limit.", { maximum: r }), Ie(t, e, "mdomainInputInvalid");
}
function ne(t) {
  const e = wt(t, "input", "mdomainInputInvalid");
  yt(e, Lo, "input", "mdomainInputInvalid"), e.representation !== "exact_finite_law" && S("mdomainUnsupported", "input.representation", "Only complete exact finite laws are supported."), e.coupling !== "supplied_joint" && S("mdomainUnsupported", "input.coupling", "An explicit supplied joint-state coupling is required.");
  const n = st(e.inputId, "input.inputId", "mdomainInputInvalid"), r = st(e.lawId, "input.lawId", "mdomainInputInvalid"), o = Pe(e.unitIds, "input.unitIds", 2, 4), i = Pe(e.domainIds, "input.domainIds", 1, 2), s = Pe(e.stateIds, "input.stateIds", 1, 8), a = o.length, c = i.length, u = s.length, l = J(e.masses, u, "input.masses", "mdomainInputInvalid").map((p, b) => ye(p, `input.masses[${b}]`, "mdomainInputInvalid")), f = l.reduce((p, b) => Kt(p, b), Rt);
  bt(f, fe) !== 0 && S("mdomainInputInvalid", "input.masses", "Finite-law masses must sum exactly to one.");
  const m = [], d = J(e.states, u, "input.states", "mdomainInputInvalid");
  for (let p = 0; p < u; p += 1) {
    const b = J(d[p], a, `input.states[${p}]`, "mdomainInputInvalid"), y = [];
    for (let N = 0; N < a; N += 1) {
      const I = J(b[N], c, `input.states[${p}][${N}]`, "mdomainInputInvalid"), E = [];
      for (let v = 0; v < c; v += 1) {
        const $ = I[v];
        (typeof $ != "number" || !Number.isFinite($) || Math.abs($) > Number.MAX_SAFE_INTEGER) && S("mdomainInputInvalid", `input.states[${p}][${N}][${v}]`, "A finite binary64 target within the safe magnitude bound is required."), E.push($);
      }
      y.push(E);
    }
    m.push(y);
  }
  const g = [], w = J(e.targets, c, "input.targets", "mdomainInputInvalid");
  for (let p = 0; p < c; p += 1) {
    const b = `input.targets[${p}]`, y = wt(w[p], b, "mdomainInputInvalid");
    yt(y, Vo, b, "mdomainInputInvalid");
    const N = st(y.domainId, `${b}.domainId`, "mdomainInputInvalid");
    N !== i[p] && S("mdomainIdentityMismatch", `${b}.domainId`, "Targets must follow the input's domain order."), y.orientation !== "larger_is_higher" && S("mdomainInputInvalid", `${b}.orientation`, "Targets must already be oriented larger-is-higher.");
    const I = J(y.equalityClasses, a, `${b}.equalityClasses`, "mdomainInputInvalid").map((E, v) => st(E, `${b}.equalityClasses[${v}]`, "mdomainInputInvalid"));
    for (let E = 0; E < u; E += 1) {
      if (bt(l[E], Rt) === 0) continue;
      const v = /* @__PURE__ */ new Map();
      for (let $ = 0; $ < a; $ += 1) {
        const A = I[$];
        v.has(A) && v.get(A) !== m[E][$][p] && S("mdomainInputInvalid", `${b}.equalityClasses`, "A declared structural identity is violated in a positive-mass state.", { stateId: s[E] }), v.set(A, m[E][$][p]);
      }
    }
    g.push({
      domainId: N,
      definition: st(y.definition, `${b}.definition`, "mdomainInputInvalid"),
      units: st(y.units, `${b}.units`, "mdomainInputInvalid"),
      orientation: "larger_is_higher",
      equalityClasses: I,
      equalityProvenance: st(y.equalityProvenance, `${b}.equalityProvenance`, "mdomainInputInvalid")
    });
  }
  const h = wt(e.provenance, "input.provenance", "mdomainInputInvalid");
  return yt(h, Wo, "input.provenance", "mdomainInputInvalid"), h.properLaw !== !0 && S("mdomainInputInvalid", "input.provenance.properLaw", "The producer must explicitly declare a proper complete finite law."), {
    inputId: n,
    lawId: r,
    representation: "exact_finite_law",
    coupling: "supplied_joint",
    unitIds: o,
    domainIds: i,
    stateIds: s,
    states: m,
    masses: l.map(at),
    targets: g,
    provenance: {
      producer: st(h.producer, "input.provenance.producer", "mdomainInputInvalid"),
      conditioningInfo: st(h.conditioningInfo, "input.provenance.conditioningInfo", "mdomainInputInvalid"),
      jointGeneration: st(h.jointGeneration, "input.provenance.jointGeneration", "mdomainInputInvalid"),
      finiteSupportOrigin: st(h.finiteSupportOrigin, "input.provenance.finiteSupportOrigin", "mdomainInputInvalid"),
      properLaw: !0
    }
  };
}
function br(t, e, n, r = "grades") {
  (!Number.isInteger(n) || n < 0 || n >= t.domainIds.length) && S("mdomainGradesInvalid", r, "A declared domain index is required.");
  const o = J(e, t.unitIds.length, r, "mdomainGradesInvalid"), i = [];
  for (let f = 0; f < o.length; f += 1) {
    const m = o[f];
    (typeof m != "number" || !Number.isSafeInteger(m)) && S("mdomainGradesInvalid", `${r}[${f}]`, "Raw grade labels must be safe integers."), i.push(m);
  }
  const s = [...new Set(i)].sort((f, m) => f < m ? -1 : f > m ? 1 : 0), a = new Map(s.map((f, m) => [f, m + 1])), c = i.map((f) => a.get(f)), u = t.targets[n].equalityClasses, l = /* @__PURE__ */ new Map();
  for (let f = 0; f < c.length; f += 1) {
    const m = u[f];
    l.has(m) && l.get(m) !== c[f] && S("mdomainGradesInvalid", `${r}[${f}]`, "Units in a declared structural class must receive the same grade."), l.set(m, c[f]);
  }
  return c;
}
function Uo(t, e) {
  const n = ne(t), r = wt(e, "grades", "mdomainGradesInvalid");
  yt(r, ["unitIds", "domainIds", "values"], "grades", "mdomainGradesInvalid");
  const o = ie(r.unitIds, n.unitIds, "grades.unitIds"), i = ie(r.domainIds, n.domainIds, "grades.domainIds"), a = J(r.values, o.length, "grades.values", "mdomainGradesInvalid").map((l, f) => J(l, i.length, `grades.values[${f}]`, "mdomainGradesInvalid")), c = i.map((l, f) => br(n, a.map((m) => m[f]), f, `grades.column[${f}]`)), u = o.map((l, f) => i.map((m, d) => c[d][f]));
  return { unitIds: o, domainIds: i, values: u };
}
const Yo = ["familyId", "unitIds", "domainIds", "maxGrades", "maxActions", "banks"], Ho = ["sourceSpec", "constructionInput", "banks", "candidateCount"];
function Zo(t, e) {
  for (let n = 0; n < t.length; n += 1) {
    if (t[n] < e[n]) return -1;
    if (t[n] > e[n]) return 1;
  }
  return 0;
}
function Qo(t, e, n, r) {
  try {
    return br(t, e, n, r);
  } catch (o) {
    throw o instanceof on && o.code === "mdomainGradesInvalid" && S("mdomainFamilyInvalid", o.field, o.message, o.details), o;
  }
}
function Jo(t, e) {
  const n = ne(t), r = wt(e, "family", "mdomainFamilyInvalid");
  yt(r, Yo, "family", "mdomainFamilyInvalid");
  const o = st(r.familyId, "family.familyId", "mdomainFamilyInvalid"), i = ie(r.unitIds, n.unitIds, "family.unitIds"), s = ie(r.domainIds, n.domainIds, "family.domainIds"), a = i.length, c = s.length, u = J(r.maxGrades, c, "family.maxGrades", "mdomainFamilyInvalid").map((h, p) => ((typeof h != "number" || !Number.isSafeInteger(h) || h < 1 || h > a) && S("mdomainFamilyInvalid", `family.maxGrades[${p}]`, "The grade cap must be a positive safe integer no larger than the unit count."), h)), l = r.maxActions;
  (typeof l != "number" || !Number.isSafeInteger(l) || l < 1) && S("mdomainFamilyInvalid", "family.maxActions", "A positive safe integer action limit is required."), l > 256 && S("mdomainResourceCap", "family.maxActions", "The browser action limit cannot exceed 256.", { maximum: 256 });
  const f = J(r.banks, c, "family.banks", "mdomainFamilyInvalid"), m = [], d = [];
  let g = 1;
  for (let h = 0; h < c; h += 1) {
    const p = `family.banks[${h}]`, b = wt(f[h], p, "mdomainFamilyInvalid");
    yt(b, ["domainId", "columns"], p, "mdomainFamilyInvalid");
    const y = st(b.domainId, `${p}.domainId`, "mdomainFamilyInvalid");
    y !== s[h] && S("mdomainIdentityMismatch", `${p}.domainId`, "Banks must match the input's domain order exactly."), Array.isArray(b.columns) || S("mdomainFamilyInvalid", `${p}.columns`, "An explicit column array is required."), b.columns.length > 256 && S("mdomainResourceCap", `${p}.columns`, "A raw bank cannot contain more than 256 supplied columns.", { maximum: 256 });
    const N = J(b.columns, b.columns.length, `${p}.columns`, "mdomainFamilyInvalid"), I = [], E = /* @__PURE__ */ new Set(), v = /* @__PURE__ */ new Map();
    for (let C = 0; C < N.length; C += 1) {
      const j = `${p}.columns[${C}]`, V = wt(N[C], j, "mdomainFamilyInvalid");
      yt(V, ["columnId", "grades"], j, "mdomainFamilyInvalid");
      const D = st(V.columnId, `${j}.columnId`, "mdomainFamilyInvalid");
      E.has(D) && S("mdomainFamilyInvalid", `${j}.columnId`, "Supplied column IDs must be unique within each bank."), E.add(D);
      const U = Qo(n, V.grades, h, `${j}.grades`);
      Math.max(...U) > u[h] && S("mdomainFamilyInvalid", `${j}.grades`, "A supplied column exceeds its declared grade cap.");
      const et = J(V.grades, a, `${j}.grades`, "mdomainFamilyInvalid").map((G) => G);
      I.push({ columnId: D, grades: et });
      const F = `g:${U.join(",")}`, x = v.get(F);
      x ? x.aliases.push(D) : v.set(F, { columnId: F, aliases: [D], grades: U });
    }
    const $ = new Array(a).fill(1), A = `g:${$.join(",")}`;
    v.has(A) || v.set(A, { columnId: A, aliases: [], grades: $ });
    const k = [...v.values()].sort((C, j) => Zo(C.grades, j.grades));
    g *= k.length, (g > l || g > 256) && S("mdomainResourceCap", "family.maxActions", "The complete canonical product exceeds the action limit; no cards were enumerated.", {
      candidateCount: g,
      maxActions: l
    }), m.push({ domainId: y, columns: k }), d.push({ domainId: y, columns: I });
  }
  return { sourceSpec: { familyId: o, unitIds: i, domainIds: s, maxGrades: u, maxActions: l, banks: d }, constructionInput: n, banks: m, candidateCount: g };
}
function yr(t) {
  try {
    return ne(t);
  } catch (e) {
    throw e instanceof on && S("mdomainFamilyInvalid", "family.constructionInput", "The stored construction input is invalid; rebuild the family.", {
      causeCode: e.code,
      causeField: e.field
    }), e;
  }
}
function Xo(t, e, n) {
  const r = J(t, e.length, "family.banks", "mdomainFamilyInvalid");
  for (let o = 0; o < e.length; o += 1) {
    const i = `family.banks[${o}]`, s = wt(r[o], i, "mdomainFamilyInvalid");
    yt(s, ["domainId", "columns"], i, "mdomainFamilyInvalid"), s.domainId !== e[o].domainId && S("mdomainIdentityMismatch", `${i}.domainId`, "Stored canonical bank identities have changed.");
    const a = J(s.columns, e[o].columns.length, `${i}.columns`, "mdomainFamilyInvalid");
    for (let c = 0; c < a.length; c += 1) {
      const u = `${i}.columns[${c}]`, l = wt(a[c], u, "mdomainFamilyInvalid");
      yt(l, ["columnId", "aliases", "grades"], u, "mdomainFamilyInvalid");
      const f = e[o].columns[c];
      l.columnId !== f.columnId && S("mdomainFamilyInvalid", `${u}.columnId`, "The canonical column ID or order has changed."), J(l.aliases, f.aliases.length, `${u}.aliases`, "mdomainFamilyInvalid").some((g, w) => g !== f.aliases[w]) && S("mdomainFamilyInvalid", `${u}.aliases`, "Canonical aliases do not match the supplied source columns."), J(l.grades, n, `${u}.grades`, "mdomainFamilyInvalid").some((g, w) => g !== f.grades[w]) && S("mdomainFamilyInvalid", `${u}.grades`, "Canonical grades do not match the supplied source columns.");
    }
  }
}
function Ir(t, e) {
  const n = ne(t), r = wt(e, "family", "mdomainFamilyInvalid");
  yt(r, Ho, "family", "mdomainFamilyInvalid");
  const o = yr(r.constructionInput);
  JSON.stringify(o) !== JSON.stringify(n) && S("mdomainIdentityMismatch", "family.constructionInput", "This family was constructed for a different input specification; rebuild it.");
  const i = Jo(n, r.sourceSpec);
  return r.candidateCount !== i.candidateCount && S("mdomainFamilyInvalid", "family.candidateCount", "The stored candidate count has changed."), Xo(r.banks, i.banks, n.unitIds.length), i;
}
function ti(t) {
  let e, n, r;
  if (Array.isArray(t))
    e = t, n = t.length, r = Array.isArray(t[0]) ? t[0].length : 0;
  else {
    const s = wt(t, "grades", "mdomainGradesInvalid");
    yt(s, ["unitIds", "domainIds", "values"], "grades", "mdomainGradesInvalid"), n = Ie(s.unitIds, "grades.unitIds", "mdomainGradesInvalid").length, r = Ie(s.domainIds, "grades.domainIds", "mdomainGradesInvalid").length, e = s.values;
  }
  (n < 2 || n > 4 || r < 1 || r > 2) && S("mdomainGradesInvalid", "grades.values", "A canonical matrix within the declared dimensions is required.");
  const o = J(e, n, "grades.values", "mdomainGradesInvalid").map((s, a) => J(s, r, `grades.values[${a}]`, "mdomainGradesInvalid")), i = [];
  for (let s = 0; s < r; s += 1) {
    const a = [];
    for (let c = 0; c < n; c += 1) {
      const u = o[c][s];
      (typeof u != "number" || !Number.isSafeInteger(u) || u < 1 || u > n) && S("mdomainGradesInvalid", `grades.values[${c}][${s}]`, "Candidate keys require canonical positive integer grades."), a.push(u);
    }
    new Set(a).size !== Math.max(...a) && S("mdomainGradesInvalid", `grades.column[${s}]`, "Candidate key grades must use every occupied label from one."), i.push(a.join(","));
  }
  return `p:${i.join("|")}`;
}
function ei(t) {
  const e = wt(t, "family", "mdomainFamilyInvalid"), n = Ir(yr(e.constructionInput), t), { unitIds: r, domainIds: o } = n.constructionInput, i = [], s = [], a = (c) => {
    if (c === o.length) {
      s.push({
        unitIds: [...r],
        domainIds: [...o],
        values: r.map((u, l) => o.map((f, m) => i[m][l]))
      });
      return;
    }
    for (const u of n.banks[c].columns)
      i[c] = u.grades, a(c + 1);
  };
  return a(0), s;
}
function vr(t, e) {
  const n = "mdomainPolicyInvalid", r = "decision", o = wt(e, r, n);
  yt(o, ["decisionId", "domainIds", "scope", "weights", "tau", "q", "t", "alpha"], r, n);
  const i = st(o.decisionId, "decision.decisionId", n), s = ie(o.domainIds, t.domainIds, "decision.domainIds");
  o.scope !== "all_pairs" && S("mdomainUnsupported", "decision.scope", "Only all-pair domain scopes are supported.");
  const a = s.length, c = (h, p) => J(h, a, `decision.${p}`, n).map((b, y) => ye(b, `decision.${p}[${y}]`, n)), u = c(o.weights, "weights");
  bt(u.reduce(Kt, Rt), fe) !== 0 && S(n, "decision.weights", "Nonnegative weights must sum exactly to one.");
  const l = c(o.tau, "tau");
  for (let h = 0; h < a; h += 1)
    (bt(l[h], Rt) <= 0 || bt(l[h], Gt(1n, 2n)) > 0) && S(n, `decision.tau[${h}]`, "Withholding cost must lie in (0, 1/2].");
  const f = (h, p) => {
    if (h === null) return null;
    const b = c(h, p);
    for (let y = 0; y < a; y += 1)
      bt(b[y], fe) > 0 && S(n, `decision.${p}[${y}]`, "Probability guard must lie in [0, 1].");
    return b;
  }, m = f(o.q, "q"), d = f(o.t, "t"), g = ye(o.alpha, "decision.alpha", n);
  return bt(g, fe) > 0 && S(n, "decision.alpha", "Joint cap must lie in [0, 1]."), { decision: {
    decisionId: i,
    domainIds: s,
    scope: "all_pairs",
    weights: u.map(at),
    tau: l.map(at),
    q: m === null ? null : m.map(at),
    t: d === null ? null : d.map(at),
    alpha: at(g)
  }, weights: u, tau: l, q: m, t: d, alpha: g };
}
function ni(t, e, n, r, o) {
  const i = r.length, s = r.map((d, g) => t.q === null ? null : bt(o[g], Qt(t.q[g], Ht(d))) <= 0), a = r.map((d, g) => t.t === null ? null : Number(Bo(Qt(t.t[g], Ht(d)))) + 1), c = r.map((d, g) => t.t !== null && d > 0 && a[g] <= d), u = n.map((d) => d.map((g, w) => c[w] && g >= a[w])), l = u.map((d) => d.some(Boolean)), f = Array.from({ length: i }, (d, g) => t.t === null ? null : e.reduce((w, h, p) => u[p][g] ? Kt(w, h) : w, Rt)), m = e.reduce((d, g, w) => l[w] ? Kt(d, g) : d, Rt);
  return {
    meanGuards: s,
    meanFeasible: s.every((d) => d !== !1),
    cutoffs: a,
    active: c,
    exceedances: u,
    unions: l,
    probabilities: f,
    joint: m,
    jointFeasible: bt(m, t.alpha) <= 0,
    jointStatus: t.t === null ? "disabled" : c.some(Boolean) ? "evaluated" : "analytic_zero"
  };
}
function Er(t, e, n) {
  const r = t.unitIds.length, o = t.domainIds.length, i = r * (r - 1) / 2, s = t.masses.map((g, w) => ye(g, `input.masses[${w}]`, "mdomainInputInvalid")), a = Array(o).fill(0), c = t.states.map(() => Array(o).fill(0));
  for (let g = 0; g < r; g += 1)
    for (let w = g + 1; w < r; w += 1)
      for (let h = 0; h < o; h += 1) {
        if (e.values[g][h] === e.values[w][h]) continue;
        a[h] += 1;
        const p = e.values[g][h] < e.values[w][h] ? g : w, b = p === g ? w : g;
        for (let y = 0; y < t.states.length; y += 1)
          t.states[y][p][h] <= t.states[y][b][h] && (c[y][h] += 1);
      }
  const u = t.domainIds.map((g, w) => s.reduce(
    (h, p, b) => Kt(h, Qt(p, Ht(c[b][w]))),
    Rt
  )), l = ni(n, s, c, a, u);
  let f = Rt;
  const m = t.domainIds.map((g, w) => {
    const h = a[w], p = Sn(Kt(u[w], Qt(n.tau[w], Ht(i - h))), Ht(i)), b = Qt(n.weights[w], p);
    f = Kt(f, b);
    const y = l.probabilities[w];
    return {
      domainId: g,
      gradeCount: new Set(e.values.map((N) => N[w])).size,
      disclosedPairs: h,
      withheldPairs: i - h,
      expectedFalseCountExact: at(u[w]),
      expectedFalseProportionExact: h === 0 ? null : at(Sn(u[w], Ht(h))),
      lossExact: at(p),
      weightedLossExact: at(b),
      meanGuardSatisfied: l.meanGuards[w],
      thresholdExact: n.t === null ? null : at(n.t[w]),
      firstExceedanceCount: l.cutoffs[w],
      eventProbabilityExact: y === null ? null : at(y),
      eventActive: l.active[w]
    };
  });
  return { evaluation: {
    inputId: t.inputId,
    lawId: t.lawId,
    decisionId: n.decision.decisionId,
    grades: { unitIds: [...e.unitIds], domainIds: [...e.domainIds], values: e.values.map((g) => [...g]) },
    originalPairs: i,
    riskExact: at(f),
    jointProbabilityExact: at(l.joint),
    meanFeasible: l.meanFeasible,
    jointFeasible: l.jointFeasible,
    feasible: l.meanFeasible && l.jointFeasible,
    jointStatus: l.jointStatus,
    domains: m,
    states: t.stateIds.map((g, w) => ({
      stateId: g,
      falseCounts: [...c[w]],
      exceedances: [...l.exceedances[w]],
      unionExceeded: l.unions[w]
    })),
    assurance: {
      arithmetic: "exact_represented_finite_law",
      properLawStatus: "producer_declaration",
      numericalGuarantee: !1,
      intendedPosteriorFeasibilityCertified: !1,
      searchOptimality: "fixed_card"
    }
  }, risk: f };
}
function Qs(t, e, n) {
  const r = ne(t);
  return Er(r, Uo(r, e), vr(r, n)).evaluation;
}
function Js(t, e, n) {
  const r = ne(t), o = Ir(r, e), i = vr(r, n), s = ei(o), a = s.map((g) => Er(r, g, i));
  let c = null;
  for (const g of a)
    g.evaluation.feasible && (c === null || bt(g.risk, c) < 0) && (c = g.risk);
  c === null && S("mdomainFamilyInvalid", "family", "No feasible member remains in the declared product.");
  const u = c, l = a.flatMap((g, w) => g.evaluation.feasible && bt(g.risk, u) === 0 ? [w] : []), f = l[0], m = a[f].evaluation, d = a.map((g, w) => {
    const h = g.evaluation;
    return {
      candidateId: ti(h.grades),
      grades: h.grades,
      riskExact: h.riskExact,
      jointProbabilityExact: h.jointProbabilityExact,
      meanFeasible: h.meanFeasible,
      jointFeasible: h.jointFeasible,
      feasible: h.feasible,
      disclosedCounts: h.domains.map((p) => p.disclosedPairs),
      gradeCounts: h.domains.map((p) => p.gradeCount),
      optimal: h.feasible && bt(g.risk, u) === 0,
      selected: w === f
    };
  });
  return {
    inputId: r.inputId,
    lawId: r.lawId,
    decisionId: i.decision.decisionId,
    familyId: o.sourceSpec.familyId,
    candidateTable: d,
    optimizerIds: l.map((g) => d[g].candidateId),
    selectedId: d[f].candidateId,
    selectedGrades: {
      unitIds: [...m.grades.unitIds],
      domainIds: [...m.grades.domainIds],
      values: m.grades.values.map((g) => [...g])
    },
    riskExact: m.riskExact,
    jointProbabilityExact: m.jointProbabilityExact,
    searchScope: {
      type: "declared_cartesian_product",
      candidateCount: s.length,
      examinedActions: s.length,
      fullProductExamined: !0,
      unrestrictedOptimalityClaim: !1
    },
    assurance: {
      arithmetic: "exact_represented_finite_law",
      properLawStatus: "producer_declaration",
      numericalGuarantee: !1,
      intendedPosteriorFeasibilityCertified: !1,
      searchOptimality: "candidate_restricted"
    }
  };
}
const Tn = ["1/20", "1/10", "1/4"], ri = ["0", "1/40", "1/20", "3/40", "1/10", "1/8", "3/20"], Ar = {
  common: ["law", "tauIndex", "weightIndex"],
  separable: ["couplingIndex", "zeroWeight", "protected"],
  dependence: ["couplingIndex"],
  resolution: ["noiseIndex", "budgetIndex"]
};
function oi(t, e) {
  if (e === void 0) return {};
  (e === null || typeof e != "object" || Array.isArray(e)) && S("mdomainInputInvalid", "options", "Teaching-example options must be an object.");
  const n = Object.getPrototypeOf(e);
  n !== Object.prototype && n !== null && S("mdomainInputInvalid", "options", "Teaching-example options must be a plain object.");
  const r = e;
  for (const o of Reflect.ownKeys(r)) {
    typeof o != "string" && S("mdomainInputInvalid", "options", "Teaching-example controls require string keys."), Ar[t].includes(o) || S("mdomainInputInvalid", `options.${o}`, `Unknown ${t} example option: ${o}.`);
    const i = Object.getOwnPropertyDescriptor(r, o);
    i && ("get" in i || "set" in i) && S("mdomainInputInvalid", `options.${o}`, "Teaching-example controls must be plain data values.");
  }
  return r;
}
function Ut(t, e, n, r, o) {
  const i = t[e] === void 0 ? n : t[e];
  return (typeof i != "number" || !Number.isSafeInteger(i) || i < r || i > o) && S("mdomainInputInvalid", `options.${e}`, `${e} must be an integer from ${r} to ${o}.`), i;
}
function Fn(t, e, n) {
  const r = t[e] === void 0 ? n : t[e];
  return typeof r != "boolean" && S("mdomainInputInvalid", `options.${e}`, `${e} must be a boolean.`), r;
}
function zt(t, e) {
  return at(Gt(BigInt(t), BigInt(e)));
}
function Cn(t) {
  return [
    zt(80 + t, 100),
    zt(10 - t, 100),
    zt(10 - t, 100),
    zt(t, 100)
  ];
}
function ce(t, e, n, r, o, i, s) {
  const a = ["A", "B"], c = ["S", "C"], u = `example-${t}-${e}`;
  return {
    schemaVersion: "postrank-explorer-mdomain-v1",
    fixtureId: u,
    description: `Complete two-unit, two-domain finite teaching law for the ${t} illustration.`,
    input: {
      inputId: `${n}-input`,
      lawId: n,
      representation: "exact_finite_law",
      coupling: "supplied_joint",
      unitIds: [...a],
      domainIds: [...c],
      stateIds: [...r],
      states: o.map((l) => [[...l], [0, 0]]),
      masses: [...i],
      targets: c.map((l) => ({
        domainId: l,
        definition: `Fictional ${l} priority coordinate`,
        units: "illustrative score",
        orientation: "larger_is_higher",
        equalityClasses: [...a],
        equalityProvenance: "The model declares no shared target identity between A and B."
      })),
      provenance: {
        producer: "JoonHo Lee: self-contained fictional teaching law",
        conditioningInfo: "Specified finite law; no fitted observations or sampled posterior draws.",
        jointGeneration: "Each labelled state contains both units and both domains together.",
        finiteSupportOrigin: "The listed matrices exhaust this declared law, including zero-mass rows.",
        properLaw: !0
      }
    },
    decision: {
      decisionId: `${u}-policy`,
      domainIds: [...c],
      scope: "all_pairs",
      weights: [...s.weights],
      tau: [...s.tau],
      q: null,
      t: s.t === null ? null : [...s.t],
      alpha: s.alpha
    },
    family: {
      familyId: "teaching-two-domain-nine-cards",
      unitIds: [...a],
      domainIds: [...c],
      maxGrades: [2, 2],
      maxActions: 9,
      banks: c.map((l) => ({ domainId: l, columns: [
        { columnId: "withhold", grades: [1, 1] },
        { columnId: "forward", grades: [1, 2] },
        { columnId: "reverse", grades: [2, 1] }
      ] }))
    }
  };
}
function Xs(t, e) {
  (typeof t != "string" || !Object.hasOwn(Ar, t)) && S("mdomainInputInvalid", "kind", "Unknown multidomain teaching example.");
  const n = oi(t, e);
  if (t === "common") {
    const i = n.law === void 0 ? "crossed" : n.law;
    i !== "aligned" && i !== "crossed" && S("mdomainInputInvalid", "options.law", "law must be aligned or crossed.");
    const s = Ut(n, "tauIndex", 2, 0, 2), a = Ut(n, "weightIndex", 0, 0, 1);
    return ce(
      t,
      `${i}-t${s}-w${a}`,
      `common-${i}-law`,
      ["usual", "reversal"],
      i === "aligned" ? [[1, 1], [-1, -1]] : [[1, -1], [-1, 1]],
      ["9/10", "1/10"],
      {
        weights: a === 0 ? ["1/2", "1/2"] : ["9/10", "1/10"],
        tau: [Tn[s], Tn[s]],
        t: null,
        alpha: "3/20"
      }
    );
  }
  if (t === "separable") {
    const i = Ut(n, "couplingIndex", 10, 0, 10);
    [0, 1, 10].includes(i) || S("mdomainInputInvalid", "options.couplingIndex", "Separable couplingIndex must be 0, 1 or 10.");
    const s = Fn(n, "zeroWeight", !1), a = Fn(n, "protected", !1);
    return ce(
      t,
      `c${i}-z${Number(s)}-p${Number(a)}`,
      `separable-c${i}-law`,
      ["++", "-+", "+-", "--"],
      [[1, 1], [-1, 1], [1, -1], [-1, -1]],
      Cn(i),
      {
        weights: s ? ["0", "1"] : ["1/2", "1/2"],
        tau: ["1/4", "1/4"],
        t: a ? ["0", "0"] : null,
        alpha: "3/20"
      }
    );
  }
  if (t === "dependence") {
    const i = Ut(n, "couplingIndex", 10, 0, 10);
    return ce(
      t,
      `c${i}`,
      `dependence-c${i}-law`,
      ["++", "-+", "+-", "--"],
      [[1, 1], [-1, 1], [1, -1], [-1, -1]],
      Cn(i),
      {
        weights: ["1/2", "1/2"],
        tau: ["1/4", "1/4"],
        t: ["0", "0"],
        alpha: "3/20"
      }
    );
  }
  const r = Ut(n, "noiseIndex", 1, 0, 2), o = Ut(n, "budgetIndex", 3, 0, 6);
  return ce(
    "resolution",
    `k${r}-a${o}`,
    `resolution-k${r}-law`,
    ["s1", "s2", "s3"],
    [[1, 1], [-1, 1], [1, -1]],
    [zt(20 - 3 * r, 20), zt(r, 20), zt(r, 10)],
    {
      weights: ["1/4", "3/4"],
      tau: ["1/4", "1/4"],
      t: ["0", "0"],
      alpha: ri[o]
    }
  );
}
const ta = "0.1.0";
export {
  lo as ENUMERATION_BUDGET,
  $e as LEAGUE_SEED,
  kt as MINUS,
  dt as NA,
  gn as NO_DISCLOSURE,
  xo as ORDER_HULL_BUDGET,
  ta as PR_CORE_VERSION,
  Ws as allocationValue,
  Ui as bestReports,
  xi as betweenGradeErrors,
  Gs as binomialMcse,
  cs as budgetCheck,
  as as budgetFamily,
  Lt as canonicalGrade,
  Os as chainCountLaw,
  Ms as chainMeanVariance,
  ji as claimsByDistance,
  is as commonalityCost,
  Vs as compareReportLosses,
  Hs as compareReports,
  Si as confidentPairs,
  os as conflictPairs,
  ls as criterionMixtureRisk,
  Ki as cutGrade,
  bi as directionMatrix,
  ro as disclosedErrorEstimands,
  Gi as disclosure,
  Qn as drawErrors,
  Je as drawLeague,
  Nn as enumerateReports,
  Ns as envelopeRadius,
  Ti as equalityNeutralRisk,
  ai as erfc,
  Qr as errorArray,
  ss as estimandCosts,
  H as evaluateReport,
  ds as evidenceFlags,
  Ct as exactOptimum,
  ps as expectedMisorderedPairs,
  hs as expectedRank,
  Rs as expectedSquaredDistance,
  Oo as extremeCounts,
  qi as familySize,
  qs as fartherCount,
  ki as finiteLawCells,
  ys as finiteLawDraws,
  vi as finiteLawMargins,
  Jr as finiteLawPairwise,
  ko as fixedOrderDP,
  Zt as formatCount,
  Kn as formatDecimal,
  fi as formatEoverN,
  Ke as formatFraction,
  gi as formatGrades,
  ui as formatPercent,
  Ln as formatProb,
  Lr as formatRatio,
  di as formatRational,
  ci as formatRisk,
  li as formatSci,
  hi as formatSetting,
  Wn as formatSig,
  mi as formatSigned,
  wi as formatSizes,
  pi as formatTuple,
  $s as fragilePairs,
  As as gaussianDraws,
  es as halfSlopeEligible,
  zs as intervalOverlapTally,
  Yi as krwBridgeParameters,
  Hi as krwCorrespondence,
  Es as krwExample1Band,
  qe as krwRisk,
  eo as lambdaToTau,
  Fi as largestStatedError,
  ke as league30,
  Ss as leagueGradingReplays,
  ks as leagueOvershoot,
  bs as leagueReplays,
  Ai as leastCertainPairs,
  Qi as lowerHull,
  Ei as majorityWins,
  Xi as matchedDisclosure,
  to as maxCoefficientError,
  Po as mcse,
  Qs as mdomainEvaluate,
  Xs as mdomainExample,
  Jo as mdomainFamily,
  Uo as mdomainGrades,
  ne as mdomainInput,
  Js as mdomainSolve,
  _s as meanSquaredDistance,
  us as minimaxChoice,
  jo as misorderedPairs,
  yi as mixturePairDirection,
  St as normalCdf,
  Ys as normalComposite,
  Sr as normalCoverage,
  ws as normalInterval,
  si as normalPdf,
  Xe as normalPosterior,
  De as normalQuantile,
  Tr as normalSf,
  Dr as normalStream,
  ve as normals,
  ts as orderHull,
  Ni as pairCertainty,
  Bi as pairConstrainedOptimum,
  Vt as pairCount,
  In as pairDecision,
  $i as pairDifference,
  Zr as pairDirection,
  Zs as protectionEnvelopes,
  Ds as rankIntervals,
  Is as rankSummaries,
  vs as rankSummariesMC,
  Be as rationalApprox,
  Jn as realizedWrong,
  zo as regretBound,
  co as relationChange,
  Oi as relations,
  Ri as relaxedPairRisk,
  zi as reportCardRows,
  Zi as reportCloud,
  Bs as reportInformation,
  ns as reportsAtN,
  qn as rng,
  zr as rngUint32,
  rs as ruleGap,
  Ps as runningMean,
  ao as scoreOrder,
  Fs as selectionOnDraws,
  js as sharedMeanPosterior,
  gs as simulateEstimates,
  Mi as statedAbove,
  Di as statedAgainst,
  Co as strictOrder,
  Oe as summaryStats,
  Ji as supportingVertex,
  Li as tauPath,
  no as tauToLambda,
  Us as thresholdClassification,
  Ls as thresholdViolations,
  Ii as tieLawPairwise,
  ms as tierGrades,
  Ks as tierSizeDistribution,
  Go as topKOverlap,
  _o as topKOvershoot,
  Ts as transformedMeans,
  xs as twoStateChain,
  zn as uniforms,
  Pi as unitRelationCounts,
  _i as weakRelation,
  Wi as weightBreakpoints,
  fs as weightCrossing,
  Vi as weightPath,
  To as weightedError,
  qo as weightedRadius,
  Cs as withinBand,
  Ci as wrongCountDistribution
};
