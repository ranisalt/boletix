import type { NameFile } from "../elections";

/** Fetches the static TSE name files; a missing or failed file just leaves those numbers unnamed. */
export async function loadNameFiles(areas: string[]): Promise<NameFile[]> {
  const files = await Promise.all(
    areas.map((area) =>
      fetch(new URL(`/tse/2026/${area}.json`, location.href))
        .then((response) => (response.ok ? (response.json() as Promise<NameFile>) : undefined))
        .catch(() => undefined),
    ),
  );
  return files.filter((file): file is NameFile => file !== undefined);
}
