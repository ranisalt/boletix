/**
 * What is being voted on: the supported elections, and display names for the codes a BU
 * carries (municipalities, candidates, parties) taken from TSE open data.
 *
 * Framework-free.
 */
export {
  cargoScope,
  dataUrl,
  ELECTIONS,
  findElection,
  getElection,
  latestPleito,
  type ElectionDef,
  type Scope,
} from "./calendar";
export { candidateName, nameFileArea, nameFileKeys, resultsView, type NameFile } from "./names";
export { sectionTotal, type SectionCounts } from "./sections";
