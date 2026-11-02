# Changesets

This folder holds pending version bumps for the `@boletix/*` packages in `packages/`.

- Add a changeset with `pnpm changeset` and pick the packages and bump level.
- The root app (`boletix`) is ignored by changesets and is never published.
- Merging to `main` makes the release workflow open a "Version Packages" PR. Merging that PR stages the new versions on npm through Trusted Publishing, and tags each one as `<name>@<version>`.
- A staged version goes live once a maintainer approves it with 2FA: `npm stage approve <id>` or the Staged Packages tab on npmjs.com. Approve `@boletix/ed521` before the packages that depend on it.
- To re-stage a version after rejecting it, delete its tag.
