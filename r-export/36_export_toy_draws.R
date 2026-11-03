# Author: JoonHo Lee (jlee296@ua.edu)
# Export the actual fixed 32 complete toy states; original public package sources stay read-only.
# Rscript r-export/36_export_toy_draws.R
prx_export_lib_only <- TRUE
source("r-export/20_export_teaching.R")
# This raw-coordinate asset preserves source doubles rather than summary rounding.
json_text <- function(x) as.character(jsonlite::toJSON(x, auto_unbox = TRUE, digits = 17, na = "null", null = "null"))
source_file <- file.path(dirname(prx_root), "postrank-R-package-public", "inst", "examples", "synthetic-iid.json")
src <- jsonlite::fromJSON(source_file, simplifyVector = FALSE)
ids <- unlist(src$entity_ids, use.names = FALSE); criteria <- unlist(src$criterion_ids, use.names = FALSE)
tensor <- src$joint_draws$tensor
stopifnot(identical(unlist(tensor$axis_order, use.names = FALSE), c("draw", "entity", "criterion")),
          length(tensor$values) == 32L, length(ids) == 3L, length(criteria) == 2L)
values <- tensor$values
stopifnot(all(vapply(values, length, 0L) == 3L), all(vapply(unlist(values, recursive = FALSE), length, 0L) == 2L))
parsed <- array(0, c(32L, 3L, 2L))
for (s in 1:32) for (i in 1:3) parsed[s,i,] <- unlist(values[[s]][[i]], use.names = FALSE)
env <- new.env(); utils::data("postrank_toy", package = "postrank", envir = env)
stopifnot(identical(ids, env$postrank_toy$entity_ids), identical(criteria, env$postrank_toy$criterion_ids))
expect_equal_num(parsed, unname(env$postrank_toy$joint_draws$tensor$values), 0, "public source tensor equals installed postrank_toy")
# Direct weak-error counts verify axes and published released coefficients without an engine call.
E <- read_released("toy")$arrays$draws$e
for (k in 1:2) for (i in 1:3) for (j in 1:3) if (i != j) {
  expect_equal_num(mean(parsed[,i,k] <= parsed[,j,k]), E[k,i,j], 0, "original32 count equals released coefficient")
}
source_hash <- sha256_file(source_file)
meta <- author_meta("toy-joint-draws", "The package toy's 32 complete joint states", "tables.draws",
  list(list(object = "postrank_toy$joint_draws$tensor", path = "postrank 1.1.0 inst/examples/synthetic-iid.json",
            sha256 = source_hash, fields = "joint_draws.tensor.values, entity_ids, criterion_ids, joint_draws.draw_index")),
  changes = "Extracted the complete 32 by 3 by 2 tensor from the public postrank 1.1.0 example, checked against postrank_toy. Values and whole-state order retained; existing coefficient and summary assets unchanged.")
meta$runtime_asset <- TRUE
out <- write_released(list(
  facts = list(description = "A fixed sample of 32 complete IID states from the package's specified Normal law; an empirical input sample, not an enumerated finite posterior law.",
               draws = 32L, n = 3L, K = 2L, M = 3L, seed = 20261019L,
               axis_order = col(c("draw", "entity", "criterion")), source_sha256 = source_hash,
               precision = "Original source double precision retained with 17-digit serialization.",
               conditioning = "Synthetic specified Normal target law; no real units or fitted scientific model. Each state retains all entities and criteria together."),
  tables = list(draws = tbl(draw = 1:32, source_draw_id = vapply(src$joint_draws$draw_index, function(x) x$original_draw_id, ""))),
  arrays = list(joint = list(ids = col(ids), criteria = col(criteria), values = values))), meta)
back_values <- out$json$arrays$joint$values
back_array <- array(0, c(32L, 3L, 2L))
for (s in 1:32) for (i in 1:3) back_array[s,i,] <- unlist(back_values[[s]][[i]], use.names = FALSE)
expect_equal_num(back_array, parsed, 0, "serialized released tensor retains every original double")
# All old dataset bytes stay untouched; the existing manifest merges this one new asset.
update_contract(setNames(list(out$entry), "toy-joint-draws.json"))
cat("toy joint export: source/package values identical; all 12 off-diagonal coefficients equal released toy.json\n")
