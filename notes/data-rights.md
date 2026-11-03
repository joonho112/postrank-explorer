# Data rights and public scope

Project author and maintainer: JoonHo Lee (jlee296@ua.edu).

The website distributes the scoped data assets listed in `data/released/data_contract.json`: 17 released assets
and one precomputed synthetic league. The contract records fields, source objects, structural checks, hashes,
licence scopes and attribution. The JavaScript copies contain the same data as the corresponding JSON files.
A source-specific licence applies to the data and figures derived from that source.

| Material | Source and scope | Conditions |
|---|---|---|
| Fictional sites, synthetic posterior laws and simulations | postrank 1.1.0 tutorial and example objects; calculations by JoonHo Lee | Author material, CC BY 4.0. No real unit records or fitted population models are implied. |
| Twelve California schools | California Department of Education, 2026 California School Dashboard chronic absenteeism data, academic year 2025–26; adapted in postrank 1.1.0 | CDE source conditions; attribution and changes retained; no CDE endorsement or logos. The subset is conditional on a statewide prior fitted to 5,834 eligible schools; prior-estimation uncertainty is not propagated. |
| Firm contact gaps and archived cards | Kline, Rose and Walters (2024), *A Discrimination Report Card*, doi:10.1257/aer.20230700; data and code deposit doi:10.3886/E198284V1 | CC-BY-NC as stated in the deposit, with no version specified; noncommercial use, attribution and change notice. Historical experiment data do not describe current firm conduct. |
| Alabama county outcomes | Chetty, Friedman, Hendren, Jones and Porter (2022), Opportunity Atlas replication, doi:10.7910/DVN/NKCQM1; Opportunity Insights and U.S. Census Bureau | CC BY 4.0; source attribution and changes retained. Historical conditional associations do not establish current conditions or causal effects. |
| Alabama county boundaries | U.S. Census Bureau Cartographic Boundary Files, 2025, 1:20m, via usmapdata 1.1.0 | Public-domain Census geometry; source attribution retained. |
| Restated finite examples and computed reference values | Examples described with their source chapters and recomputed using the included numerical code | Original computations and restatements by JoonHo Lee; source attribution retained. Original theory-book figure files and reproduction assets are excluded from this distribution and from the site's reuse grant. |

The source-specific notices accompany the applications and their downloads. CDE source conditions are available at
<https://www.cde.ca.gov/re/di/cr/index.asp>, with chronic absenteeism source files at
<https://www.cde.ca.gov/ta/ac/cm/chronicdatafiles.asp>. The package's `DATA-NOTICE.md` records the redistribution
conditions for its released cases. This repository preserves those conditions rather than granting new rights
to the underlying external material. Historical preparation flags inside source objects do not replace the later
source-specific notice; the website does not present those flags as current clearance status.

The publication files exclude private study outputs, statewide school pairwise matrices, raw school-level study
files, unpublished policy analyses, microdata, original paper or presentation figures, and development evidence.
Canonical fixtures derived from an empirical case retain that case's source-specific conditions. The included numerical fixtures are the expected values required by the verification suite; their
calculation scripts and checksum manifests are provided. They are distinct from local test execution reports.

Original code is covered by [LICENSE](../LICENSE), and original text and figures by
[LICENSE-DATA](../LICENSE-DATA). KRW-derived material retains its noncommercial conditions. Third-party libraries,
fonts and solver code retain their own licence and copyright notices. See
[the vendor record](../js/vendor/VENDOR.md) and notices retained in the solver bundles.
