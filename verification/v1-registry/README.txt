verification/v1-registry/ : postrank Explorer v1's numbers registry, frozen

These files are v1's frozen values. v3 uses them only as expected values in the read-out check
(verification/check_readouts.mjs): a read-out case may compare a number an app shows with a v1 registry key
("source": "registry", "ref": "<key>"). The site never reads them. No app, page, embed or bundle imports anything
from this folder, and v3 shows no number from a registry: every number an app shows comes from the engine or a data
file.

What is here, retained from postrank-explorer-v1 on 2026-11-01 (its main branch was at 6f61f5f):

  numbers.json         v1 data/numbers.json: engine values, key -> { type, value, display, tolerance, settings,
                       source, license_scope, owner }
  numbers-cases.json   v1 data/numbers-cases.json: case values that R wrote from the released data files
  schema.json          v1 numbers/schema.json: the schema of the specs and of the two files above
  spec/*.json          v1 numbers/spec/: how each engine key was computed (fn, args, field) and its format;
                       check_readouts.mjs uses that format as the key's own formatter
  build_numbers.mjs    v1 scripts/build_numbers.mjs, the builder that wrote numbers.json. A record: it is not run in
                       v3, and its imports point at v1's folders
  registry.mjs         v1 scripts/registry.mjs, the lookup module. A record: not run in v3
  captions.json        v1 verification/captions.json, v1's result labels and captions. A record: read-out literals
                       take their label and caption strings from js/shared/labels.js (v3 rewords the
                       teaching-posterior caption); the check reads this file only to name the v3 wording when a
                       literal still quotes v1's
  contract-rows.json   specification identifiers required by literal checks; development commentary omitted
  MANIFEST.json        the SHA-256 of every file above; check_readouts.mjs fails when a file no longer matches it

Do not edit these files. A number that v3 changes on purpose (a correction) gets a golden row as its source
(postrank 1.1.0 or the base-R oracle, verification/golden/), with the reason in the case's "about"; the frozen value
stays as it was. The read-out check fails when any file here differs from MANIFEST.json.

The numerical values are unchanged. The public contract-rows file retains all original
identifiers and omits development commentary. Its hash and the pinned manifest hash
reflect this metadata-only reduction. Numerical reference files retain their hashes.
