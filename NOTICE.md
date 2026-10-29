# Licensing

Boletix uses different terms for different parts of this repository. The licenses below cover the code in this repository. Material from the Tribunal Superior Eleitoral (TSE) keeps its own terms.

| Path                                                                                                               | Terms                                                                         |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Everything not listed below                                                                                        | [AGPL-3.0-only](LICENSE)                                                      |
| [`packages/bu-qr`](packages/bu-qr), [`packages/bu-verify`](packages/bu-verify), [`packages/ed521`](packages/ed521) | BSD-3-Clause, in each package's `LICENSE`                                     |
| [`static/tse`](static/tse)                                                                                         | Derived from TSE open data, CC BY. See below                                  |
| [`docs/tse`](docs/tse) (the manual PDF)                                                                            | TSE publication. Not covered by these licenses                                |
| [`fixtures/tse-roots`](fixtures/tse-roots)                                                                         | TSE certificate authority certificates. Not covered by these licenses         |
| [`fixtures/2026`](fixtures/2026)                                                                                   | Text of the QR codes urnas print on public BUs. Not covered by these licenses |

## TSE open data

The candidate, party, municipality and section files in `static/tse` are built by [`scripts/tse-names.ts`](scripts/tse-names.ts) from the [Portal de Dados Abertos do TSE](https://dadosabertos.tse.jus.br), which publishes them under [Creative Commons Attribution](http://www.opendefinition.org/licenses/cc-by).

Source: Tribunal Superior Eleitoral, Portal de Dados Abertos. The script selects and reshapes the fields. The TSE does not endorse Boletix.

## Name and logo

The licenses cover the code. They don't grant use of the Boletix name or logo for a modified version.
