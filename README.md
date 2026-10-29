<div align="center">

<img src="src/lib/assets/favicon.svg" alt="Boletix" width="72" height="72">

# Boletix

Scan, verify and pool the vote tallies Brazilian voting machines print when the polls close.

[boletix.rsa.sh](https://boletix.rsa.sh) · [Como funciona](https://boletix.rsa.sh/como-funciona) · [Totais](https://boletix.rsa.sh/totais)

</div>

When the polls close in Brazil, every voting machine (_urna_) prints a _boletim de urna_ (BU): the vote count for its section. One copy stays posted at the polling place, and its QR codes are signed by the urna. Anyone can photograph it.

Boletix turns that into a public count. You point your phone at the QR codes, Boletix checks on your phone that the urna really signed them, and then it adds the BU to a shared total that anyone can follow.

The app is in Brazilian Portuguese and made for phones first.

## Features

- Reads the QR codes in any order and shows which ones are still missing.
- Checks the urna's signature and certificate in the browser, the same check the official TSE app (Boletim na Mão) does. TSE is Brazil's electoral court.
- Checks everything again on the server before saving a BU, and keeps the original QR text.
- Shows live totals by election, round, office and state, and how many of the TSE's sections they cover.
- Remembers on your phone which BUs you sent.

> [!NOTE]
> Boletix only reads the QR layout of the 2026 elections (VRQR 6.0). Its totals are partial and unofficial, because they only count the BUs people sent.

## How it works

```
camera ─► @boletix/bu-qr ─► @boletix/bu-verify ─► POST /api/submissions ─► D1 + R2
          (parse QR)         (signature, chain,     (verify again, rate      │
                              certificate)           limit, store)           ▼
                                                                         /totais
```

The app is a SvelteKit site on Cloudflare Workers. D1 stores each BU and updates the totals in the same write, R2 keeps the original QR text, and Sentry records errors.

Reading and checking the QR codes happens in three packages that also work on their own:

| Package                                    | What it does                                                                |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| [`@boletix/bu-qr`](packages/bu-qr)         | Parses BU QR codes into typed data and assembles multi-QR BUs               |
| [`@boletix/bu-verify`](packages/bu-verify) | Checks a parsed BU against the urna signature and the TSE certificate chain |
| [`@boletix/ed521`](packages/ed521)         | Ed521 signatures, which newer urnas use                                     |

They run in browsers, Node, Deno and Workers.

## Getting started

You need Node.js and pnpm 12 (the `devEngines` field downloads it if missing).

```sh
pnpm install
pnpm exec wrangler d1 migrations apply boletix --local
pnpm dev
```

`pnpm dev` builds the packages and starts Vite with local copies of D1 and R2. To run the built Worker in the real Workers runtime instead:

```sh
pnpm build
pnpm exec wrangler dev
```

> [!WARNING]
> `ALLOW_TEST_FASES` lets in BUs from simulated and training urnas. Leave it `"false"` on any database that production also uses, or a test BU can take the place of the official one. See [docs/known-gaps.md](docs/known-gaps.md).

## Scripts

| Command                     | Description                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                  | Start the dev server                                                                                          |
| `pnpm test`                 | Run all tests (packages, Workers runtime and jsdom)                                                           |
| `pnpm check`                | Compile messages and type-check                                                                               |
| `pnpm lint`                 | Lint and fix                                                                                                  |
| `pnpm format`               | Format with oxfmt                                                                                             |
| `pnpm build`                | Build the packages and the Worker                                                                             |
| `node scripts/tse-names.ts` | Regenerate candidate, party and municipality names and section counts in `static/tse/2026` from TSE open data |

> [!TIP]
> Re-run `scripts/tse-names.ts` before each round. Candidacies can change until election day.

## Deploying

The build reads the Sentry settings, so copy `.env.example` to `.env` and fill it in first. Without a DSN, nothing is sent to Sentry. Without `SENTRY_AUTH_TOKEN`, no source maps are uploaded.

```sh
pnpm exec wrangler d1 migrations apply boletix --remote
pnpm build
pnpm exec wrangler deploy
```

## License

The app is [AGPL-3.0-only](LICENSE): if you run a modified version for others, you must publish its source. The three packages are BSD-3-Clause, so you can reuse them in any project. TSE data, certificates and documents in this repository keep their own terms, and the data in `static/tse` is CC BY. [NOTICE.md](NOTICE.md) lists what covers each path.

To contribute, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Documentation

- [`docs/tse/2026`](docs/tse/2026) has the TSE manual for the QR codes and findings from real BUs.
- [`docs/known-gaps.md`](docs/known-gaps.md) lists inputs the parser accepts although the manual forbids them, and why that is safe for now.
