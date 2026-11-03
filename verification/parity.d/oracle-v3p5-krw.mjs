// R44 is independent base-R enumeration. This adapter calls the public engine only.
const decode = (value, cube = false) => {
  if (value === null) return cube ? NaN : null;
  if (Array.isArray(value)) return value.map(item => decode(item, cube));
  if (value && typeof value === 'object') {
    if (Object.hasOwn(value, '$num')) {
      const numbers = { Infinity, '-Infinity': -Infinity, NaN };
      if (!Object.hasOwn(numbers, value.$num)) throw new Error('Unknown R44 numeric token');
      return numbers[value.$num];
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item, key === 'e' || key === 't')]));
  }
  return value;
};
const shape = value => {
  if (typeof value === 'number' && !Number.isFinite(value)) return Number.isNaN(value) ? null : String(value);
  if (typeof value === 'bigint') return String(value);
  if (ArrayBuffer.isView(value) || Array.isArray(value)) return Array.from(value, shape);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, shape(item)]));
  return value;
};

export default {
  group: 'oracle-v3p5-krw',
  functions: ['krwBridgeParameters', 'krwCorrespondence'],
  default: { abs: 1e-14, rel: 1e-14 },
  tolerance: { maxAffineResidual: { abs: 5e-16, rel: 0 } },
  run(args, pc) {
    const a = decode(args);
    if (!['krwBridgeParameters', 'krwCorrespondence'].includes(a.fn)) throw new Error(`Unknown R44 function ${a.fn}`);
    let result;
    try {
      result = a.fn === 'krwBridgeParameters' ? pc.krwBridgeParameters(a.axis) : pc.krwCorrespondence(a.E, a.options);
    } catch (error) {
      if (error instanceof RangeError || error instanceof TypeError) return { error: true };
      throw error;
    }
    if (a.oracleView === 'cloud') {
      // Explicitly approved composition; cloud is not a krwCorrespondence return field.
      const { tau, lambda } = result.parameters;
      result = { ...result, cloud: Array.from(pc.enumerateReports(a.E.ids.length, a.options.family), grade => {
        const ev = pc.evaluateReport(grade, a.E, { tau });
        return { grade, N: ev.N, E: ev.E[0], DR: ev.EoverM[0], information: pc.reportInformation(grade, a.E), postrankRisk: ev.risk, krwRisk: pc.krwRisk(grade, a.E, { lambda }) };
      }) };
    } else if (a.oracleView !== undefined) throw new Error(`Unknown R44 view ${a.oracleView}`);
    return shape(result);
  },
};
