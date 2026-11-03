// Reproduce the applied local input and displayed report, preserving binary doubles through R's JSON reader.
import {rString} from './your-data-input.js';
const scalar = value => value===null||value===undefined?'NULL':typeof value==='string'?rString(value)
  :typeof value==='boolean'?value?'TRUE':'FALSE':Number.isNaN(value)?'NA_real_':value===Infinity?'Inf':value===-Infinity?'-Inf'
  :`jsonlite::fromJSON(${rString(JSON.stringify(value))})`;
const vector = values => {
 const a=Array.from(values);
 if(!a.length)return 'numeric(0)';
 if(a.every(v=>typeof v==='number'&&v!==Infinity&&v!==-Infinity))return `jsonlite::fromJSON(${rString(JSON.stringify(a))})`;
 return `c(${a.map(scalar).join(', ')})`;
};
const literal = value => Array.isArray(value)
 ?value.every(v=>v!==null&&typeof v!=='object')?vector(value):`list(${value.map(literal).join(', ')})`
 :value&&typeof value==='object'?`setNames(list(${Object.values(value).map(literal).join(', ')}), ${vector(Object.keys(value))})`:scalar(value);

/** model is the applied snapshot, never the editor draft. runSearch=false supports fixed-evaluation replay. */
export function yourDataR(model,grade,{runSearch=true}={}) {
 const {E,settings:s}=model,n=E.ids.length,K=E.criteria.length;
 const cells=[];for(let k=0;k<K;k++)for(let j=0;j<n;j++)for(let i=0;i<n;i++)cells.push(E.e[k][i][j]);
 const source=model.input.source??{kind:'analytic_reference',description:'Normal comparisons computed from the entered posterior or stated prior and estimates.',conditioning:'Units are independent given the entered Normal model; values and conditioning are supplied by the user.'};
 const lines=['library(postrank)','if (!requireNamespace("jsonlite", quietly = TRUE)) stop("Install jsonlite to read the exact exported doubles.")',
  '# Applied inputs, settings and report; user text is quoted data. JSON parsing preserves the exported doubles.',
  `entered_input <- ${literal(model.input)}`,`applied_settings <- ${literal(s)}`,`ids <- ${vector(E.ids)}`,`criteria <- ${vector(E.criteria)}`,
  `e <- array(${vector(cells)}, c(length(ids), length(ids), length(criteria)), dimnames = list(ids, ids, criteria))`];
 if(model.posterior){
  const matrix=x=>`matrix(${vector(E.criteria.flatMap((_,k)=>x.map(row=>row[k])))}, nrow = length(ids), ncol = length(criteria), dimnames = list(ids, criteria))`;
  lines.push(`posterior_mean_raw <- ${matrix(model.posterior.mean)}`,`posterior_sd_raw <- ${matrix(model.posterior.sd)}`,`lower_raw <- ${matrix(model.posterior.lower)}`,`upper_raw <- ${matrix(model.posterior.upper)}`,`orient <- ${vector(s.orient)}`,
   'supplied_summaries <- list(means = sweep(posterior_mean_raw, 2, orient, "*"), same_targets = TRUE, description = "The applied Normal posterior summaries, oriented to the declared priority targets", lower = lower_raw, upper = upper_raw, level = .90)',
   'for (k in seq_along(criteria)) if (orient[k] < 0) { supplied_summaries$lower[, k] <- -upper_raw[, k]; supplied_summaries$upper[, k] <- -lower_raw[, k] }');
 }else lines.push('supplied_summaries <- NULL # No marginal means or intervals were supplied.');
 lines.push(`x <- postrank_probabilities(e, event = "directional_error", zero_ties = TRUE, margin = 0, correction = "none", source = list(kind = ${rString(source.kind)}, description = ${rString(source.description)}, conditioning = ${rString(source.conditioning)}), targets = setNames(${vector(E.criteria.map((c,k)=>`${c}: ${s.orient[k]<0?'reversed':'as-entered'} priority direction`))}, criteria), summaries = supplied_summaries)`,
  'validate_postrank_probabilities(x)',`weights <- setNames(${vector(s.weights)}, criteria)`,
  `settings <- postrank_settings(weights = weights, tau = ${scalar(s.tau)}, G_max = ${s.cap==='all'?n:Number(s.cap)}L)`,
  `browser_grade <- setNames(${vector(grade)}, ids)`,`browser_evaluation <- postrank_evaluate(browser_grade, x, weights = weights, tau = ${scalar(s.tau)})`);
 if(model.method==='weighted-expected-rank-order'){
  if(!Array.isArray(model.order)||!Array.isArray(model.blocks)||model.order.length!==n||model.blocks.reduce((a,b)=>a+b,0)!==n)throw new TypeError('A fixed-order export requires the complete browser order and score blocks');
  lines.push('expected_rank <- postrank_expected_rank(x, weights)',`browser_order <- ids[${vector(model.order.map(i=>i+1))}]`,`browser_blocks <- ${vector(model.blocks)}`,
   '# Freeze the browser order and its exact-score blocks: these define the same comparison family.',
   'family_scores <- setNames(numeric(length(ids)), ids)','family_scores[browser_order] <- rep(seq_along(browser_blocks), browser_blocks)');
 }
 if(runSearch){
  if(model.method==='weighted-expected-rank-order')lines.push('fit <- postrank_cuts(family_scores, x, settings, direction = "ascending", rule = "optimal", method = "frozen_browser_expected_rank_order")');
  else{const limit=Math.min(3,Math.max(.1,Number.isFinite(s.timeLimit)?s.timeLimit:1));lines.push(`fit <- postrank(x, settings = settings, backend = "highs", control = postrank_control(time_limit = ${scalar(limit)}, threads = 1L, seed = 20261030L), report_card = ${model.posterior?'TRUE':'FALSE'}, fragility = FALSE, crossfit = FALSE, diagnostics = FALSE)`);}
  lines.push('fit','get_grades(fit)',`search_evaluation <- postrank_evaluate(get_grades(fit), x, weights = weights, tau = ${scalar(s.tau)})`,'search_evaluation',
   '# Repeated selection may choose another tied report or stop with a numerical gap. The printed result retains its own status and bound.');
 }
 lines.push('browser_evaluation');return lines.join('\n')+'\n';
}
