// Author: JoonHo Lee (jlee296@ua.edu).
import { fail } from './error.ts';
import { add, cmp, ONE, ZERO, parseExact, rational, toExact, type Rational } from './rational.ts';
import { strictRecord, exactKeys, nonblankString, exactArray, assertIdentity } from './validation.ts';
import type { MdomainDecision, MdomainInput } from './types.ts';

export interface ParsedDecision {
  decision: MdomainDecision;
  weights: Rational[];
  tau: Rational[];
  q: Rational[] | null;
  t: Rational[] | null;
  alpha: Rational;
}

export function bindDecision(input: MdomainInput, value: MdomainDecision): ParsedDecision {
  const code = 'mdomainPolicyInvalid' as const;
  const field = 'decision';
  const x = strictRecord(value, field, code);
  exactKeys(x, ['decisionId', 'domainIds', 'scope', 'weights', 'tau', 'q', 't', 'alpha'], field, code);
  const decisionId = nonblankString(x.decisionId, 'decision.decisionId', code);
  const domainIds = assertIdentity(x.domainIds, input.domainIds, 'decision.domainIds');
  if (x.scope !== 'all_pairs') fail('mdomainUnsupported', 'decision.scope', 'Only all-pair domain scopes are supported.');
  const D = domainIds.length;
  const vector = (raw: unknown, name: string): Rational[] => exactArray(raw, D, `decision.${name}`, code)
    .map((v, d) => parseExact(v, `decision.${name}[${d}]`, code));
  const weights = vector(x.weights, 'weights');
  if (cmp(weights.reduce(add, ZERO), ONE) !== 0)
    fail(code, 'decision.weights', 'Nonnegative weights must sum exactly to one.');
  const tau = vector(x.tau, 'tau');
  for (let d = 0; d < D; d += 1) {
    if (cmp(tau[d], ZERO) <= 0 || cmp(tau[d], rational(1n, 2n)) > 0)
      fail(code, `decision.tau[${d}]`, 'Withholding cost must lie in (0, 1/2].');
  }
  const bounded = (raw: unknown, name: string): Rational[] | null => {
    if (raw === null) return null;
    const values = vector(raw, name);
    for (let d = 0; d < D; d += 1) {
      if (cmp(values[d], ONE) > 0) fail(code, `decision.${name}[${d}]`, 'Probability guard must lie in [0, 1].');
    }
    return values;
  };
  const q = bounded(x.q, 'q');
  const t = bounded(x.t, 't');
  const alpha = parseExact(x.alpha, 'decision.alpha', code);
  if (cmp(alpha, ONE) > 0) fail(code, 'decision.alpha', 'Joint cap must lie in [0, 1].');
  const decision: MdomainDecision = {
    decisionId, domainIds, scope: 'all_pairs', weights: weights.map(toExact), tau: tau.map(toExact),
    q: q === null ? null : q.map(toExact), t: t === null ? null : t.map(toExact), alpha: toExact(alpha),
  };
  return { decision, weights, tau, q, t, alpha };
}
