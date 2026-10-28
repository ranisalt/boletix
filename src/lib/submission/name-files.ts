import type { Bu } from "../bu";
import { dataUrl, findElection, nameFileKeys, type NameFile } from "../elections";

/**
 * Fetches the static TSE name files covering a BU; a missing or failed file, or an election not
 * registered here, just leaves those numbers unnamed.
 */
export async function loadNameFiles(bu: Bu): Promise<NameFile[]> {
  const { proc, plei, turno } = bu.header;
  const election = findElection(proc, plei, turno);
  if (!election) return [];
  const files = await Promise.all(
    nameFileKeys(election, bu).map((area) =>
      fetch(new URL(dataUrl(election, area), location.href))
        .then((response) => (response.ok ? (response.json() as Promise<NameFile>) : undefined))
        .catch(() => undefined),
    ),
  );
  return files.filter((file): file is NameFile => file !== undefined);
}
