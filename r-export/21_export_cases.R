# Author: JoonHo Lee (jlee296@ua.edu)
# Released case summaries (data/released/): the three public cases of postrank 1.1.0, the KRW lambda grid and the
# Alabama county boundaries, each with its license_scope, attribution and change notice (notes/data-rights.md).
#   Rscript r-export/21_export_cases.R
# Sources (read-only): postrank 1.1.0 data/pr_case_cde.rda, pr_case_krw.rda, pr_case_alabama.rda and the cached
# analyses case_cde_12, case_krw_signed97, case_alabama67 (load_or_compute()); the KRW companion's lambda grid
# dump/ranking_results_log_dif_binary_{race,gender}.csv (KRW-derived, CC-BY-NC; joined to the firms by row position and
# checked by estimate and SE); U.S. Census Bureau Cartographic Boundary Files 2025 (1:20m) as stored in the R package
# usmapdata 1.1.0 (public domain). No downloads. The historical rights fields of the case objects are not exported
# (DATA-NOTICE.md describes the current conditions).
# Case arrays and geometry are runtime assets (CONTRACT 8.7): each .js twin <= 400 KB.
prx_export_lib_only <- TRUE
source("r-export/20_export_teaching.R")
rm(prx_export_lib_only)
krw_dump <- normalizePath(Sys.getenv("KRW_COMPANION_DUMP", file.path(prx_root, "..", "KRW-2024-companion-public", "dump")), mustWork = TRUE)

cat("21_export_cases: data/released (cases)\n")
entries <- list()
keep <- function(w) { entries[[basename(w$path)]] <<- w$entry; invisible(w) }
env <- new.env()
utils::data(list = c("pr_case_cde", "pr_case_krw", "pr_case_alabama"), package = "postrank", envir = env)
notice_ref <- sprintf("%s inst/extdata/case-studies/DATA-NOTICE.md", PKG)
case_meta <- function(key, title, level, scope, attribution, changes, notice, sources, upstream, primary, runtime_asset = TRUE)
  list(key = key, title = title, level = level, license_scope = scope, attribution = attribution, change_notice = changes, notice = notice,
       sources = sources, upstream = upstream, primary = primary, runtime_asset = runtime_asset)
by_ids <- function(v, ids) { stopifnot(identical(sort(names(v), method = "radix"), sort(ids, method = "radix"))); unname(v[ids]) }
summ <- function(x, k) x$input$summaries[[k]]

# ---- California chronic absence, 12 schools ---------------------------------------------------------------------------
cde <- env$pr_case_cde; ci <- cde$input; cu <- cde$units; cids <- ci$entity_ids
stopifnot(identical(cids, cu$entity_id), length(cids) == 12L, identical(ci$criterion_ids, "negative_chronic_absence"),
          identical(ci$summaries$level, 0.9), isTRUE(ci$zero_ties))
clab <- LETTERS[seq_along(cids)]                                   # A ... L in package order (vignette a2)
ca <- summ_analysis(load_or_compute("case_cde_12"), "case_cde_12")
sw <- cde$reference$statewide
CDE_ATTR <- paste0("Data: California Department of Education, 2026 California School Dashboard chronic absenteeism data, academic year 2025–26 ",
                   "(https://www.cde.ca.gov/ta/ac/cm/chronicdatafiles.asp), as adapted in postrank 1.1.0 (pr_case_cde). ",
                   "CDE source conditions apply (https://www.cde.ca.gov/re/di/cr/index.asp); the data are not relicensed.")
CDE_CHANGES <- paste0("Changes: a deliberately spread 12-school teaching subset of the 5,834 eligible schools; oriented target theta = -p ",
                      "(negative chronic-absence probability); posterior means, 90% marginal intervals and comparison probabilities from the ",
                      "case study's empirical-Bayes model (statewide prior not refitted); fixed reports, the archived statewide summary rows and ",
                      "the archived 12-school analysis as stored in postrank 1.1.0; numbers with 15 significant digits. Raw CDE files, full ",
                      "source tables, logos and the statewide pairwise matrix are not included.")
CDE_NOTICE <- "No CDE endorsement is implied. No CDE logos or Dashboard figures are used."
# The course's wording of pr_case_cde$provenance$conditioning (the prior's smoothing parameter is left out: S-01 does not
# show the prior-fit field, and the symbol lambda is reserved for KRW's withholding parameter).
CDE_CONDITIONING <- paste0("Conditional on a statewide prior fitted to 5,834 eligible schools; independent school binomial posteriors given that ",
                           "prior; the prior is not refitted for this teaching subset and its estimation uncertainty is not propagated.")
stopifnot(grepl("5,834 eligible schools", cde$provenance$conditioning, fixed = TRUE), grepl("not propagated", cde$provenance$conditioning, fixed = TRUE))
w_cde <- keep(write_released(list(
  facts = list(n = length(cids), M = choose(length(cids), 2), criterion = ci$criterion_ids, target = unname(ci$targets),
               orientation = cde$provenance$orientation, interval_level = ci$summaries$level, intervals = cde$provenance$marginal_intervals,
               conditioning = CDE_CONDITIONING, source_frame = cde$provenance$source_frame,
               selection_rule = cde$provenance$selection_rule, scientific_scope = cde$provenance$scientific_scope,
               source_version = "CDE Dashboard publication 2026, academic year 2025\u201326",
               reference_settings = list(tau = cde$reference$settings$tau, G_max = cde$reference$settings$G_max,
                                         weights = named(cde$reference$settings$weights), objective = cde$reference$settings$objective),
               statewide_schools = sw$schools, statewide_M = choose(sw$schools, 2), statewide_interpretation = sw$interpretation),
  tables = list(
    units = tbl(label = clab, cds_id = cids, chronic_absent_count = cu$chronic_absent_count, eligible_count = cu$eligible_count,
                observed_rate = cu$observed_rate, observed_rate_group = cu$observed_rate_group, denominator_group = cu$denominator_group,
                mean = summ(cde, "means")[, 1], lower = summ(cde, "lower")[, 1], upper = summ(cde, "upper")[, 1]),
    reports = tbl(label = clab, all_withheld = by_ids(cde$reference$actions$all_withheld, cids),
                  observed_rate_tertiles = by_ids(cde$reference$actions$observed_rate_tertiles, cids),
                  posterior_mean_tertiles = by_ids(cde$reference$actions$posterior_mean_tertiles, cids)),
    report_metrics = df_tbl(cde$reference$metrics),
    statewide = df_tbl(sw$metrics, c("action_id", "method", "order_name", "M", "N", "E", "N_over_M", "E_over_M", "E_over_N", "risk", "tau",
                                     "grade_cap", "grade_count", "risk_lower_bound", "absolute_relaxation_gap", "action_family",
                                     "selected_grade_sizes"))),
  arrays = list(error = error_array(ci$e, cids, ci$criterion_ids)),
  analyses = list(case_cde_12 = ca)),
  case_meta("case-cde", "California chronic absence: 12 schools", "school", "cde-source-conditions", CDE_ATTR, CDE_CHANGES, CDE_NOTICE,
            list(c(data_src("pr_case_cde"), fields = "units, input (e, summaries), reference (actions, metrics, settings, statewide$metrics), provenance (text fields)"),
                 list(object = "case_cde_12", path = cache_source("case_cde_12")$path, reader = cache_source("case_cde_12")$reader)),
            list(source = "California Department of Education, 2026 California School Dashboard chronic absenteeism downloadable data (academic year 2025–26)",
                 terms = sprintf("CDE source conditions (https://www.cde.ca.gov/re/di/cr/index.asp); not relicensed; see %s", notice_ref),
                 fields = I(c("tables.units.cds_id", "tables.units.chronic_absent_count", "tables.units.eligible_count", "tables.units.observed_rate"))),
            "tables.units")))

# ---- KRW firms, 97 x 2 -------------------------------------------------------------------------------------------------
krw <- env$pr_case_krw; ki <- krw$input; ku <- krw$units; kids <- ki$entity_ids; kk <- ki$criterion_ids
stopifnot(identical(kids, ku$entity_id), length(kids) == 97L, identical(kk, c("race_signed", "gender_signed")), identical(ki$summaries$level, 0.9),
          identical(unname(krw$alternatives$race$e[, , 1]), unname(ki$e[, , 1])), identical(unname(krw$alternatives$gender$e[, , 1]), unname(ki$e[, , 2])))
sc <- krw$reference$single_criterion
ka <- summ_analysis(load_or_compute("case_krw_signed97"), "case_krw_signed97")
stopifnot(identical(unname(krw$reference$signed_core$grade[kids]), as.integer(ka$tables$units$grade)))
KRW_CAPTION <- "KRW card computed by KRW's code under KRW's archived pair probabilities (KRW's solver tolerances)"
KRW_ATTR <- paste0("Data: Kline, Rose and Walters (2024), A Discrimination Report Card, American Economic Review, doi:10.1257/aer.20230700; ",
                   "deposit: Kline, Rose and Walters, Data and Code for: A Discrimination Report Card, AEA/ICPSR E198284V1, doi:10.3886/E198284V1; ",
                   "CC-BY-NC as stated by the deposit (no licence version stated); recomputed by postrank 1.1.0 (pr_case_krw).")
KRW_GRID_ATTR <- paste0("Data: Kline, Rose and Walters (2024), A Discrimination Report Card, American Economic Review, doi:10.1257/aer.20230700; ",
                        "deposit: Kline, Rose and Walters, Data and Code for: A Discrimination Report Card, AEA/ICPSR E198284V1, doi:10.3886/E198284V1; ",
                        "CC-BY-NC as stated by the deposit (no licence version stated); cards computed with KRW's code (KRW replication companion) ",
                        "under KRW's archived pair probabilities; joined to pr_case_krw (postrank 1.1.0) by row position.")
KRW_CHANGES <- paste0("Changes: fixed 97-firm extraction; continuous midpoint-cell comparison probabilities and matching central 90% marginal ",
                      "intervals (postrank adaptation of KRW's posterior grids); KRW's published single-criterion cards and their archive metrics; ",
                      "the common grade over race and gender recomputed by postrank; numbers with 15 significant digits. Full posterior grids ",
                      "and research files are not included.")
KRW_NOTICE <- paste0("Noncommercial use only (CC-BY-NC). No endorsement by the original authors is implied. The data describe KRW's ",
                     "correspondence experiment, not any firm's current conduct.")
kcell <- sc$cell_metrics
w_krw <- keep(write_released(list(
  facts = list(n = length(kids), M = choose(length(kids), 2), criteria = col(kk), targets = as.list(ki$targets),
               orientation = as.list(krw$provenance$orientation[kk]), interval_level = ki$summaries$level, intervals = krw$provenance$intervals,
               conditioning = krw$provenance$conditioning, selection_rule = krw$provenance$selection_rule,
               source_version = krw$provenance$source_version,
               card_lambda = sc$lambda, card_tau = sc$tau, card_scope = sc$interpretation, card_caption = KRW_CAPTION,
               common_settings = list(tau = krw$reference$signed_core$settings$tau, G_max = krw$reference$signed_core$settings$G_max,
                                      weights = named(krw$reference$signed_core$settings$weights),
                                      objective = krw$reference$signed_core$settings$objective)),
  tables = list(
    units = tbl(id = kids, firm_id = ku$firm_id, firm_name = ku$firm_name, industry = ku$industry,
                race_estimate = ku$race_estimate, race_se = ku$race_se, gender_estimate = ku$gender_estimate, gender_se = ku$gender_se,
                mean_race = summ(krw, "means")[, 1], lower_race = summ(krw, "lower")[, 1], upper_race = summ(krw, "upper")[, 1],
                mean_gender = summ(krw, "means")[, 2], lower_gender = summ(krw, "lower")[, 2], upper_gender = summ(krw, "upper")[, 2]),
    reports = tbl(id = kids, race_card = by_ids(sc$grade$race, kids), gender_card = by_ids(sc$grade$gender, kids)),
    card_metrics = df_tbl(sc$archive_metrics, c("criterion", "lambda", "policy_tau", "N", "M", "E", "DR", "tau_bar", "s", "conditional_DR", "G",
                                                "grade_sizes", "archive_risk")),
    card_evaluation = tbl(criterion = names(kcell), risk = vapply(kcell, `[[`, 0, "risk"), E = vapply(kcell, function(z) unname(z$E), 0),
                          N = vapply(kcell, function(z) as.numeric(z$N), 0), M = vapply(kcell, `[[`, 0, "M"),
                          G = vapply(kcell, function(z) as.numeric(z$G), 0), tau = vapply(kcell, `[[`, 0, "tau"))),
  arrays = list(error = error_array(ki$e, kids, kk)),
  analyses = list(case_krw_signed97 = ka)),
  case_meta("case-krw", "KRW firms: 97 firms, race and gender contact gaps", "firm", "cc-by-nc-krw", KRW_ATTR, KRW_CHANGES, KRW_NOTICE,
            list(c(data_src("pr_case_krw"), fields = "units, input (e, summaries, targets), reference$single_criterion (grade, archive_metrics, cell_metrics), reference$signed_core$settings, provenance (text fields)"),
                 list(object = "case_krw_signed97", path = cache_source("case_krw_signed97")$path, reader = cache_source("case_krw_signed97")$reader)),
            list(source = "Kline, Rose and Walters (2024) replication deposit E198284V1 (firm names, industry codes, estimates and SEs; published cards)",
                 terms = sprintf("CC-BY-NC as stated by the deposit README (no version); noncommercial; see %s", notice_ref),
                 fields = I(c("tables.units.firm_id", "tables.units.firm_name", "tables.units.industry", "tables.units.race_estimate",
                              "tables.units.race_se", "tables.units.gender_estimate", "tables.units.gender_se",
                              "tables.reports.race_card", "tables.reports.gender_card"))),
            "tables.units")))

# ---- the KRW lambda grid (KRW companion), joined by row position --------------------------------------------------------
read_grid <- function(crit) {
  g <- utils::read.csv(file.path(krw_dump, sprintf("ranking_results_log_dif_binary_%s.csv", crit)), check.names = FALSE)
  est <- ku[[paste0(crit, "_estimate")]]; se <- ku[[paste0(crit, "_se")]]
  if (nrow(g) != 97L || !identical(g$est, est) || !identical(g$se, se))
    stop("KRW grid ", crit, ": rows do not match pr_case_krw by position (estimate, SE)", call. = FALSE)
  lc <- grep("^grades_lamb", names(g), value = TRUE)
  lam <- as.numeric(sub("^grades_lamb", "", lc)); o <- order(lam); lc <- lc[o]; lam <- lam[o]
  stopifnot(length(lam) == 101L, isTRUE(all.equal(lam, seq(0, 1, by = 0.01))))
  grades <- lapply(lc, function(z) as.integer(g[[z]]))
  if (!identical(grades[[which(abs(lam - 0.25) < 1e-12)]], unname(sc$grade[[crit]][kids])))
    stop("KRW grid ", crit, ": lambda = .25 grades differ from pr_case_krw$reference$single_criterion$grade", call. = FALSE)
  cat(sprintf("  ok  KRW grid %s: 97 rows match pr_case_krw by position (estimate and SE identical); lambda = .25 grades = the published card\n", crit))
  list(lambda = round(lam, 2), grades = grades, est = g$est, se = g$se)
}
gr <- read_grid("race"); gg <- read_grid("gender"); stopifnot(identical(gr$lambda, gg$lambda))
w_grid <- keep(write_released(list(
  facts = list(lambda = col(gr$lambda), tau = col(gr$lambda / (1 + gr$lambda)), count = length(gr$lambda), card_lambda = sc$lambda,
               tau_range = "tau = lambda / (1 + lambda); lambda = 0 (tau = 0) lies outside the package's tau range (0, 1/2], so a tau axis starts at lambda = .01.",
               join = "Rows are joined to case-krw tables.units by position; estimate and SE are identical in both sources.",
               orientation = "Grade 1 = highest reporting priority on the package target (case-krw facts.targets); labels as written by KRW's code.",
               caption = KRW_CAPTION),
  tables = list(firms = tbl(position = seq_along(kids), id = kids, race_estimate = gr$est, race_se = gr$se,
                            gender_estimate = gg$est, gender_se = gg$se)),
  arrays = list(race = list(grade = gr$grades), gender = list(grade = gg$grades))),
  case_meta("krw-lambda-grid", "KRW lambda grid: grades of the 97 firms at 101 values of lambda", "firm", "cc-by-nc-krw", KRW_GRID_ATTR,
            paste0("Changes: grades per firm at 101 values of KRW's lambda (0 to 1 by .01), computed with KRW's code in the KRW companion ",
                   "(dump/ranking_results_log_dif_binary_race.csv and _gender.csv) under KRW's archived pair probabilities; matched to ",
                   "pr_case_krw by row position and checked by estimate and SE; the companion's posterior summaries are not included. ", KRW_CAPTION, "."),
            KRW_NOTICE,
            list(list(object = "KRW lambda grid", path = "KRW-2024-companion-public dump/ranking_results_log_dif_binary_race.csv",
                      fields = "est, se, grades_lamb0.0 ... grades_lamb1"),
                 list(object = "KRW lambda grid", path = "KRW-2024-companion-public dump/ranking_results_log_dif_binary_gender.csv",
                      fields = "est, se, grades_lamb0.0 ... grades_lamb1")),
            list(source = "Kline, Rose and Walters (2024) deposit E198284V1: KRW's grade code run on KRW's archived pair probabilities (KRW companion dump)",
                 terms = "CC-BY-NC as stated by the deposit (no version); KRW-derived values, not covered by the companion repository's code licence",
                 fields = I(c("tables.firms.race_estimate", "tables.firms.race_se", "tables.firms.gender_estimate", "tables.firms.gender_se",
                              "arrays.race.grade", "arrays.gender.grade"))),
            "tables.firms")))

# ---- Alabama counties, 67 x 2 ------------------------------------------------------------------------------------------
al <- env$pr_case_alabama; ai <- al$input; au <- al$units; aids <- ai$entity_ids; ak <- ai$criterion_ids
stopifnot(identical(aids, au$entity_id), length(aids) == 67L, identical(ak, c("income", "incarceration")), identical(ai$summaries$level, 0.95))
aa <- summ_analysis(load_or_compute("case_alabama67"), "case_alabama67")
stopifnot(identical(unname(al$reference$actions$P[aids]), as.integer(aa$tables$units$grade)))
ar <- al$reference
acts <- ar$actions; stopifnot(identical(names(acts), c("B0", "B1", "B2", "B3", "P", "D1", "D2")))
ATLAS_ATTR <- paste0("Data: Chetty, Friedman, Hendren, Jones and Porter (2022), Replication Data for: The Opportunity Atlas: Mapping the ",
                     "Childhood Roots of Social Mobility, Harvard Dataverse V1.0, doi:10.7910/DVN/NKCQM1; Opportunity Insights and U.S. Census ",
                     "Bureau; CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/); as adapted in postrank 1.1.0 (pr_case_alabama).")
ATLAS_CHANGES <- paste0("Changes: Alabama filtering (67 counties) with native identifiers and county names; point scales and orientation ",
                        "(income +100 times the household income rank fraction; incarceration -100 times the probability, so larger is more ",
                        "favorable); separate model posterior summaries (95% marginal intervals) and comparison probabilities by the case-study ",
                        "authors; archived reference reports and costs (postrank 0.9.0 with HiGHS) and the common grade as stored in postrank 1.1.0; ",
                        "numbers with 15 significant digits.")
ATLAS_NOTICE <- paste0("No endorsement by the data authors, Opportunity Insights or the U.S. Census Bureau is implied. Historical outcomes for ",
                       "children born in 1978–83, not current county conditions, causal effects of places or a measure of need.")
mcols <- c("method", "description", "N", "Goccupied", "tau", "G_max", "A_E_income", "A_E_incarceration", "A_Ew", "A_Ew_over_N", "A_Ew_over_M",
           "A_Rtau", "A_R_income", "A_R_incarceration", "A_solver_status", "A_solver_lower_bound", "A_solver_gap")
w_al <- keep(write_released(list(
  facts = list(n = length(aids), M = choose(length(aids), 2), criteria = col(ak), targets = as.list(ai$targets),
               orientation = as.list(al$provenance$orientation[ak]), outcome_dates = as.list(al$provenance$outcome_dates[ak]),
               cohort = al$provenance$cohort, interval_level = ai$summaries$level, intervals = al$provenance$marginal_intervals,
               conditioning = al$provenance$conditioning, dependence_scope = al$provenance$dependence_scope,
               source_version = al$provenance$source_version,
               reference_settings = list(tau = ar$settings$tau, G_max = ar$settings$G_max, weights = named(ar$settings$weights),
                                         objective = ar$settings$objective),
               archive_note = ar$interpretation[1], identical_reports_note = ar$interpretation[2]),
  tables = list(
    units = tbl(fips = aids, name = au$county_name,
                mean_income = summ(al, "means")[, 1], lower_income = summ(al, "lower")[, 1], upper_income = summ(al, "upper")[, 1],
                mean_incarceration = summ(al, "means")[, 2], lower_incarceration = summ(al, "lower")[, 2], upper_incarceration = summ(al, "upper")[, 2]),
    reports = do.call(tbl, c(list(fips = aids), lapply(acts, by_ids, aids))),
    reference_metrics = df_tbl(ar$metrics, mcols),
    single_criterion = df_tbl(ar$single_criterion, c("criterion", "method", "risk", "lower_bound", "gap", "normalized_status")),
    commonality = df_tbl(ar$commonality, c("criterion", "weight", "M", "N_common", "tau", "G_max", "common_criterion_risk_A",
                                            "single_incumbent_risk_A", "single_lower_bound_A", "cost_lower_A", "cost_upper_A",
                                            "single_solver_status", "common_solver_status", "common_solver_gap_A"))),
  arrays = list(error = error_array(ai$e, aids, ak)),
  analyses = list(case_alabama67 = aa)),
  case_meta("case-alabama", "Alabama counties: historical opportunity on two outcomes", "county", "cc-by-4.0-atlas", ATLAS_ATTR, ATLAS_CHANGES,
            ATLAS_NOTICE,
            list(c(data_src("pr_case_alabama"), fields = "units (FIPS, county names), input (e, summaries, targets), reference (actions, metrics, single_criterion, commonality, settings, interpretation), provenance (text fields)"),
                 list(object = "case_alabama67", path = cache_source("case_alabama67")$path, reader = cache_source("case_alabama67")$reader)),
            list(source = "Opportunity Atlas replication data (Harvard Dataverse V1.0, doi:10.7910/DVN/NKCQM1): county identifiers, names and the published estimates behind the model summaries",
                 terms = sprintf("CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/); see %s", notice_ref),
                 fields = I(c("tables.units.fips", "tables.units.name"))),
            "tables.units")))

# ---- Alabama county boundaries (Census, via usmapdata) ------------------------------------------------------------------
gpkg <- system.file("extdata", "2025", "us_counties.gpkg", package = "usmapdata", mustWork = TRUE)
umv <- as.character(utils::packageVersion("usmapdata")); rmv <- as.character(utils::packageVersion("rmapshaper"))
stopifnot(identical(umv, "1.1.0"))
cnty <- suppressMessages(sf::st_read(gpkg, quiet = TRUE))
cnty <- cnty[substr(cnty$fips, 1, 2) == "01", c("fips", "county")]
cnty <- cnty[order(cnty$fips, method = "radix"), ]
if (!identical(cnty$fips, aids)) stop("county FIPS in usmapdata differ from pr_case_alabama", call. = FALSE)
if (!identical(cnty$county, au$county_name)) stop("county names in usmapdata differ from pr_case_alabama", call. = FALSE)
src_crs <- sf::st_crs(cnty)$Name
wgs <- sf::st_transform(cnty, 4326)
KEEP_SHARE <- 0.5
simp <- suppressWarnings(sf::st_cast(rmapshaper::ms_simplify(wgs, keep = KEEP_SHARE, keep_shapes = TRUE), "MULTIPOLYGON"))
stopifnot(nrow(simp) == 67L, identical(simp$fips, aids), all(sf::st_is_valid(simp)))
ring_area <- function(m) { x <- m[, 1]; y <- m[, 2]; n <- nrow(m); sum(x[-n] * y[-1] - x[-1] * y[-n]) / 2 }
clean_ring <- function(m, exterior) {
  m <- round(unname(m[, 1:2, drop = FALSE]), 4)
  m <- m[c(TRUE, rowSums(abs(diff(m))) > 0), , drop = FALSE]           # drop repeated points after rounding
  if (any(m[1, ] != m[nrow(m), ])) m <- rbind(m, m[1, ])
  stopifnot(nrow(m) >= 4L)
  a <- ring_area(m)
  if ((exterior && a > 0) || (!exterior && a < 0)) m <- m[nrow(m):1, , drop = FALSE]   # exterior clockwise (d3-geo)
  m
}
features <- lapply(seq_len(nrow(simp)), function(i) {
  mp <- unclass(sf::st_geometry(simp)[[i]])
  coords <- lapply(mp, function(poly) lapply(seq_along(poly), function(r) clean_ring(poly[[r]], r == 1L)))
  list(type = "Feature", properties = list(fips = simp$fips[i], name = simp$county[i]), geometry = list(type = "MultiPolygon", coordinates = coords))
})
CENSUS_ATTR <- sprintf("County boundaries: U.S. Census Bureau, Cartographic Boundary Files, 2025 (1:20m), via usmapdata %s.", umv)
w_geo <- keep(write_released(list(type = "FeatureCollection",
  facts = list(count = length(features), crs = "longitude and latitude (WGS 84, EPSG:4326)", source_crs = src_crs,
               simplification = sprintf("rmapshaper %s ms_simplify(keep = %s, keep_shapes = TRUE); shared borders kept", rmv, KEEP_SHARE),
               precision = "coordinates rounded to 4 decimals",
               winding = "exterior rings clockwise, holes counterclockwise (the d3-geo spherical convention); reverse the rings for tools that require the RFC 7946 right-hand rule",
               join = "properties.fips = case-alabama tables.units.fips"),
  features = features),
  case_meta("census-geojson", "Alabama county boundaries (GeoJSON)", "county", "public-domain-census", CENSUS_ATTR,
            sprintf("Changes: Alabama's 67 counties from usmapdata %s (extdata/2025/us_counties.gpkg); reprojected from %s to longitude and latitude; simplified with rmapshaper (keep %s, shapes and shared borders kept); coordinates rounded to 4 decimals; rings wound for d3-geo.",
                    umv, src_crs, KEEP_SHARE),
            "U.S. federal government work, public domain (17 U.S.C. 105). The usmapdata package code is GPL-3; the geometry is Census data.",
            list(list(object = "us_counties", path = sprintf("usmapdata %s extdata/2025/us_counties.gpkg", umv), fields = "fips, county, geom (Alabama)")),
            list(source = "U.S. Census Bureau, Cartographic Boundary Files, 2025 (1:20,000,000), counties, as stored in the R package usmapdata",
                 terms = "public domain (17 U.S.C. 105); no licence required; source line kept",
                 fields = I(c("features.fips", "features.name", "features.geometry"))),
            "features")))
if (w_geo$entry$bytes > GEOJSON_MAX_BYTES) stop(sprintf("census-geojson.json %d bytes > %d", w_geo$entry$bytes, GEOJSON_MAX_BYTES), call. = FALSE)

update_contract(entries)

# ---- package documentation values and course numbers, read back from the exported files ---------------------------------
cat("checks (read back from data/released):\n")
cd <- read_released("case-cde"); c12 <- cd$analyses$case_cde_12
expect_identical_val(as.integer(c12$facts$sizes), c(3L, 6L, 3L), "CDE: case_cde_12 sizes 3/6/3 (tau .20, at most 3 grades)")
expect_equal_num(c(round(c12$facts$risk, 6), c12$facts$N, c12$facts$M), c(0.063774, 45, 66), 0, "CDE: risk .063774, N 45 of 66")
expect_identical_val(c(c12$facts$status, as.character(c12$facts$tau), as.character(c12$facts$G_max)), c("optimal", "0.2", "3"), "CDE: status optimal at tau .20, cap 3")
expect_equal_num(c(round(c12$facts$lower_bound, 6), c12$facts$gap < 1e-16), c(0.063774, 1), 0, "CDE: lower bound .063774, gap below 1e-16")
expect_equal_num(risk_from(c12$tables$units$grade, cd$arrays$error, 1, 0.2)$risk, c12$facts$risk, 1e-13, "CDE: archived risk recomputed from the exported array")
expect_identical_val(cd$tables$units$label[c12$tables$units$grade == 1], c("A", "B", "C"), "CDE: grade 1 = schools A, B, C")
tert <- risk_from(cd$tables$reports$observed_rate_tertiles, cd$arrays$error, 1, 0.2)
expect_equal_num(c(tert$N, round(tert$risk, 6), round(tert$E, 4)), c(48, 0.082255, 1.8288), 0, "CDE: tertiles N 48, risk .082255, E 1.8288")
expect_equal_num(tert$risk, cd$tables$report_metrics$risk[cd$tables$report_metrics$method == "observed_rate_tertiles"], 1e-13, "CDE: tertile risk = reference metrics")
expect_equal_num(round(1 - cd$arrays$error$e[1, 6, 9], 4), 0.9999, 0, "CDE: Pr(theta_F > theta_I) = .9999")
expect_equal_num(c(cd$facts$statewide_schools, cd$facts$statewide_M, length(cd$tables$statewide$M)), c(5834, 17014861, 6), 0, "CDE: statewide 5,834 schools, M 17,014,861, 6 rows")
kd <- read_released("case-krw"); kc <- kd$analyses$case_krw_signed97
expect_identical_val(as.integer(kc$facts$sizes), c(6L, 90L, 1L), "KRW: common grade 6/90/1 (tau .25, at most 4 grades, w = (1/2, 1/2))")
expect_equal_num(c(round(kc$facts$risk, 7), kc$facts$N, kc$facts$M), c(0.2454704, 636, 4656), 0, "KRW: common risk .2454704, N 636 of 4,656")
expect_equal_num(round(kc$tables$profile$E_over_N, 4), c(0.1963, 0.2374), 0, "KRW: common E/N .1963 (race) and .2374 (gender)")
expect_equal_num(risk_from(kc$tables$units$grade, kd$arrays$error, c(0.5, 0.5), 0.25)$risk, kc$facts$risk, 1e-13, "KRW: common risk recomputed from the exported array")
expect_identical_val(c(sizes_of(kd$tables$reports$race_card), sizes_of(kd$tables$reports$gender_card)), c(2L, 81L, 14L, 1L, 3L, 89L, 4L), "KRW: cards 2/81/14 and 1/3/89/4")
krace <- kd$arrays$error; krace$e <- krace$e[1, , , drop = FALSE]
rc <- risk_from(kd$tables$reports$race_card, krace, 1, 0.2)
expect_equal_num(c(rc$N, round(rc$N / 4656, 3), round(rc$risk, 4), round(rc$EoverN, 4)), c(1324, 0.284, 0.1818, 0.136), 0, "KRW: race card N 1,324, s .284, risk .1818, E/N .136 at tau .20")
expect_equal_num(rc$risk, kd$tables$card_evaluation$risk[1], 1e-13, "KRW: race card risk = stored cell metrics")
expect_equal_num(round(c(risk_from(kd$tables$reports$race_card, kd$arrays$error, c(0.5, 0.5), 0.25)$risk,
                         risk_from(kd$tables$reports$gender_card, kd$arrays$error, c(0.5, 0.5), 0.25)$risk), 6), c(0.269304, 0.265418), 0,
                 "KRW: cards under the common loss .269304 and .265418")
gd <- read_released("krw-lambda-grid")
expect_identical_val(c(length(gd$facts$lambda), dim(gd$arrays$race$grade), dim(gd$arrays$gender$grade)), c(101L, 101L, 97L, 101L, 97L), "KRW grid: 101 lambda values x 97 firms, race and gender")
l25 <- which(abs(gd$facts$lambda - 0.25) < 1e-12)
expect_identical_val(list(as.integer(gd$arrays$race$grade[l25, ]), as.integer(gd$arrays$gender$grade[l25, ])),
                     list(as.integer(kd$tables$reports$race_card), as.integer(kd$tables$reports$gender_card)), "KRW grid: lambda = .25 grades = the published cards (race and gender)")
expect_identical_val(c(gd$tables$firms$race_estimate, gd$tables$firms$race_se, gd$tables$firms$gender_estimate, gd$tables$firms$gender_se),
                     c(kd$tables$units$race_estimate, kd$tables$units$race_se, kd$tables$units$gender_estimate, kd$tables$units$gender_se),
                     "KRW grid: estimates and SEs identical to case-krw by position")
multi <- which(apply(gd$arrays$race$grade, 1, function(g) length(unique(g)) > 1))[1]
expect_identical_val(c(gd$facts$lambda[multi], sizes_of(gd$arrays$race$grade[multi, ])), c(0.08, 1, 96), "KRW grid: first race lambda with two grades .08, sizes 1/96")
ad <- read_released("case-alabama"); a67 <- ad$analyses$case_alabama67
expect_identical_val(as.integer(a67$facts$sizes), c(1L, 31L, 32L, 1L, 2L), "Alabama: common grade 1/31/32/1/2 (tau .20, at most 5 grades, w = (1/2, 1/2))")
expect_equal_num(c(round(a67$facts$risk, 6), a67$facts$N, a67$facts$M), c(0.150394, 1249, 2211), 0, "Alabama: risk .150394, N 1,249 of 2,211")
expect_equal_num(round(a67$tables$profile$E_over_N, 3), c(0.052, 0.172), 0, "Alabama: E/N .052 (income) and .172 (incarceration)")
expect_equal_num(risk_from(a67$tables$units$grade, ad$arrays$error, c(0.5, 0.5), 0.2)$risk, a67$facts$risk, 1e-13, "Alabama: risk recomputed from the exported array")
expect_equal_num(round(ad$tables$commonality$cost_lower_A[1:2], 4), c(0.0548, 0.0645), 0, "Alabama: costs .0548 (income) and .0645 (incarceration)")
d12 <- vapply(c("D1", "D2"), function(m) risk_from(ad$tables$reports[[m]], ad$arrays$error, c(0.5, 0.5), 0.2)$risk, 0)
expect_equal_num(d12, ad$tables$reference_metrics$A_Rtau[match(c("D1", "D2"), ad$tables$reference_metrics$method)], 1e-12, "Alabama: D1 and D2 risks recomputed = reference metrics")
expect_equal_num(round(d12, 4), c(0.1906, 0.1998), 0, "Alabama: D1 .1906, D2 .1998")
expect_identical_val(ad$tables$units$name[a67$tables$units$grade == 1], "Crenshaw County", "Alabama: grade 1 = Crenshaw County")
geo <- jsonlite::fromJSON(file.path(released_dir, "census-geojson.json"), simplifyVector = FALSE)
expect_identical_val(vapply(geo$features, function(f) f$properties$fips, ""), ad$tables$units$fips, "Census: 67 county polygons with the case FIPS, same order")
cat(sprintf("  ok  Census: census-geojson.json %d bytes (<= %d)\n", file.size(file.path(released_dir, "census-geojson.json")), GEOJSON_MAX_BYTES))
cat("21_export_cases: done\n")
