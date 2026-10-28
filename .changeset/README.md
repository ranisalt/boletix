# Changesets

This folder holds pending version bumps for the `@boletix/*` packages in `packages/`.

- Add a changeset with `pnpm changeset` and pick the packages and bump level.
- The root app (`boletix`) is ignored by changesets and is never published.
- Merging to `main` makes the release workflow open a "Version Packages" PR. Merging that PR publishes to npm through Trusted Publishing.
