# Known gaps

Parsing accepts some inputs the manual rules out. A BU is only accepted after its signature, hash
chain and certificate are verified, and a properly signed BU comes from a real urna, so these can't
be exploited today. They are written down so they aren't forgotten if that assumption changes.

## BU format (`src/lib/bu/format`)

- `LEGC` is accepted on majoritarian cargos (manual: only included for proportional ones), where
  absence is read as 0 legenda votes.
- `HIQT` isn't checked against the number of `HICA` entries.
- `CSEC` is parsed but not stored.

## Name files (`scripts/tse-names.ts`, `src/lib/elections/names.ts`)

- Blank or non-numeric rows aren't skipped.

## Server (`src/lib/server`)

- `storeBu` checks for an existing BU per plei and section without filtering on `fase`. With
  `ALLOW_TEST_FASES=true` on a D1 shared with production, a simulated or training BU could take the
  official BU's slot. Keep the flag `"false"` wherever the database is shared.
- P-521 signatures are verified with `lowS: false`, so `(r, n-s)` also passes. Urnas don't
  normalise S, so `lowS: true` would reject genuine BUs. Both forms sign the same content. The R2
  original is written before the D1 batch, so two simultaneous submissions of the same BU may
  leave either signature form in R2.
