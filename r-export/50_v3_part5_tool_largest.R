# Author: JoonHo Lee (jlee296@ua.edu).
# Independent R50 direct pins for the seven frozen report-designer presets.
# Authority: spec-v3-part5-tools.md and the old public largestStatedError API.
# Only released case inputs and extracted, closed pure R definitions are used.
# No old writer, golden expectations, frontend/TS/JS output or postrank is run.
source('r-export/_paths.R')
source('r-export/_helpers.R')
source('r-export/_oracle.R')
assert_no_postrank()

write_json_stable <- function(x, path) {
  dir.create(dirname(path), recursive = TRUE, showWarnings = FALSE)
  writeLines(jsonlite::toJSON(x, auto_unbox = TRUE, digits = 17,
    na = 'null', null = 'null', pretty = 1), path, useBytes = TRUE)
  invisible(path)
}

# Evaluate only explicitly named definitions, never a producer's setup or rows.
extract <- function(path, names) {
  found <- character()
  for (expr in parse(path)) {
    if (is.call(expr) && identical(expr[[1]], as.name('<-')) &&
        is.symbol(expr[[2]]) && as.character(expr[[2]]) %in% names) {
      eval(expr, envir = .GlobalEnv)
      found <- c(found, as.character(expr[[2]]))
    }
  }
  stopifnot(setequal(found, names))
}
extract('r-export/35_v3_part4.R', c('vec', '%or%', 'Mof', 'lexsort',
  'gl', 'uncube', 'weights', 'evaluate', 'allreports', 'familyCache',
  'familyreports', 'optimum'))
extract('r-export/46_v3_part5_cases.R', c('num', 'ksum', 'rowSum',
  'weighted', 'rankOrder', 'orderDP'))
extract('r-export/49_v3_part5_tools.R', 'finish')
extract('r-export/17_v3_helpers.R', c('wsum', 'o_lse'))
assert_no_postrank()

# R17's loop is source-row-major and replaces the incumbent only on strict >.
# Its isNull marker is fixture infrastructure, projected here to API null.
largest <- function(g, e, w) {
  x <- o_lse(g, e, w)
  if (x$isNull) return(NULL)
  x[c('e', 'i', 'j')]
}

# Distinguish source row-major order from R's column-major matrix traversal.
test_e <- array(.2, c(3, 3, 2))
for (k in 1:2) diag(test_e[, , k]) <- NA_real_
test_g <- c(2L, 1L, 3L)
test_e[1, 3, 1] <- test_e[2, 1, 1] <- .8
stopifnot(identical(largest(test_g, test_e, c(1, 0)),
  list(e = .8, i = 0L, j = 2L)))
test_e[2, 1, 2] <- .9
stopifnot(identical(largest(test_g, test_e, c(0, 1)),
  list(e = .9, i = 1L, j = 0L)),
  is.null(largest(rep(1L, 3), test_e, c(1, 0))))
rm(test_e, test_g)

release <- function(key) jsonlite::fromJSON(
  file.path(released_dir, paste0(key, '.json')), simplifyVector = FALSE)
cases <- list(cde = release('case-cde'), krw = release('case-krw'),
  alabama = release('case-alabama'))
stopifnot(identical(vapply(cases, function(d) length(d$arrays$error$ids), 0L),
  c(cde = 12L, krw = 97L, alabama = 67L)))

# These are the frozen input presets, not values read from R49's output.
preset_ids <- c('cde', 'krw', 'alabama', 'cde-budget',
  'cde-cap2', 'cde-cap4', 'cde-withheld')
selection_cache <- new.env(parent = emptyenv())
select <- function(a) {
  key <- paste(a$case, a$tau, a$cap, paste(a$w, collapse = ','), sep = '|')
  if (exists(key, selection_cache, inherits = FALSE))
    return(get(key, selection_cache, inherits = FALSE))
  d <- cases[[a$case]]
  e <- uncube(d$arrays$error)
  ids <- unlist(d$arrays$error$ids, use.names = FALSE)
  w <- num(a$w)
  n <- length(ids)
  if (a$case == 'cde') {
    # All capped reports through cap3. Larger caps use the fixed mean order.
    method <- if (a$cap <= 3L) 'enumeration' else 'dp'
    ord <- list(order = vec(order(-num(d$tables$units$mean), ids,
      method = 'radix') - 1L), blocks = vec(rep(1L, n)))
  } else {
    method <- 'dp'
    ord <- rankOrder(e, w, ids)
  }
  selected <- finish(e, ids, w, a$tau, a$cap, method, ord)
  g <- num(selected$grade)
  N <- sum(outer(g, g, '<'))
  stopifnot(N == selected$evaluation$N, length(g) == n,
    max(g) <= a$cap, N >= 0L, N <= Mof(n))
  K <- dim(e)[3L]
  maxima <- lapply(seq_len(K), function(k) {
    onehot <- as.numeric(seq_len(K) == k)
    x <- largest(g, e, onehot)
    if (N == 0L) {
      stopifnot(is.null(x))
    } else {
      # Independently check every stated direction and its first strict maximum.
      ij <- which(outer(g, g, '<'), arr.ind = TRUE)
      ij <- ij[order(ij[, 1L], ij[, 2L]), , drop = FALSE]
      values <- e[, , k][ij]
      first <- which(values == max(values))[1L]
      stopifnot(!is.null(x), identical(x$e, values[first]),
        x$i == ij[first, 1L] - 1L, x$j == ij[first, 2L] - 1L,
        g[x$i + 1L] < g[x$j + 1L])
    }
    x
  })
  result <- list(grade = vec(g), N = N, largest = maxima)
  assign(key, result, selection_cache)
  result
}
rows <- lapply(preset_ids, function(id) {
  case <- if (grepl('^cde', id)) 'cde' else id
  K <- if (case == 'cde') 1L else 2L
  cap <- if (case == 'cde') 3L else if (case == 'krw') 4L else 5L
  if (id == 'cde-cap2') cap <- 2L
  if (id == 'cde-cap4') cap <- 4L
  if (id == 'cde-withheld') cap <- 1L
  a <- list(case = case, tau = if (case == 'krw') .25 else .2,
    cap = cap, w = vec(rep(1 / K, K)))
  list(id = paste0('tool-largest-', id),
    args = c(list(fn = 'toolDesignerLargest'), a), expect = select(a))
})
stopifnot(length(rows) == 7L,
  identical(rows[[1L]]$expect, rows[[4L]]$expect),
  rows[[7L]]$expect$N == 0L,
  identical(rows[[7L]]$expect$largest, list(NULL)))
assert_no_postrank()

write_golden('oracle-v3p5-tool-largest', rows,
  'r-export/50_v3_part5_tool_largest.R', uses_postrank = FALSE)
path <- file.path(golden_dir, 'oracle-v3p5-tool-largest.json')
written <- jsonlite::fromJSON(path, simplifyVector = FALSE)
manifest <- jsonlite::fromJSON(
  file.path(manifest_dir, 'oracle-v3p5-tool-largest.json'))
# Every finite input/output double, integer, array and null survives the text.
plain <- function(x) {
  if (is.list(x)) return(lapply(x, plain))
  if (inherits(x, 'AsIs') || length(x) > 1L)
    return(lapply(unclass(x), plain))
  if (is.numeric(x)) return(as.numeric(x))
  x
}
stopifnot(identical(manifest$sha256, sha256_file(path)),
  manifest$rows == length(rows), identical(manifest$uses_postrank, FALSE),
  identical(plain(rows), plain(written$rows)))
assert_no_postrank()
cat('oracle-v3p5-tool-largest: 7 rows; source-row-major strict maxima,',
  'one-hot criteria, N0 null, same-family selection, 17digit/checksum/',
  'independence PASS.\n')
