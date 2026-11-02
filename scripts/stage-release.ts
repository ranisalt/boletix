/**
 * Stages every @boletix package version that is not on npm yet. A staged version stays hidden
 * until a maintainer approves it with 2FA (`npm stage approve <id>` or the Staged Packages tab).
 *
 *   node scripts/stage-release.ts
 *
 * `changeset publish` cannot stage, so this packs with `changeset pack` (which turns `workspace:^`
 * into real ranges) and stages each tarball. npm hides staged versions, so the git tag
 * `<name>@<version>` marks a version as staged: tagged versions are skipped on later runs.
 * To re-stage after rejecting a version, delete its tag.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type Release = {
  kind: "publish" | "tag-only";
  name: string;
  version: string;
  access: string;
  tag: string;
  tarball?: { path: string };
};

const run = (command: string, args: string[]) =>
  execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });

const dir = mkdtempSync(join(tmpdir(), "stage-release-"));
try {
  run("pnpm", ["exec", "changeset", "pack", "--out-dir", dir]);
  const { plan } = JSON.parse(readFileSync(join(dir, "publish-plan.json"), "utf8")) as {
    plan: Release[][];
  };

  const tags = new Set(
    run("git", ["ls-remote", "--tags", "origin"])
      .split("\n")
      .map((line) => line.split("refs/tags/")[1]),
  );

  for (const release of plan.flat()) {
    if (release.kind !== "publish" || !release.tarball) continue;
    const gitTag = `${release.name}@${release.version}`;
    if (tags.has(gitTag)) {
      console.log(`${gitTag} is already staged, waiting for approval`);
      continue;
    }

    execFileSync(
      "npm",
      [
        "stage",
        "publish",
        join(dir, release.tarball.path),
        "--access",
        release.access,
        "--tag",
        release.tag,
      ],
      // Outside the repo: npm refuses to run under the root package.json's pnpm devEngines.
      { cwd: dir, stdio: "inherit" },
    );
    run("git", ["tag", gitTag]);
    run("git", ["push", "origin", `refs/tags/${gitTag}`]);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
