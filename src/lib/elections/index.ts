/**
 * What is being voted on: the supported elections, and display names for the codes a BU
 * carries (municipalities, candidates, parties) taken from TSE open data.
 *
 * Framework-free.
 */
export { ELECTIONS, findElection, type ElectionDef } from "./calendar";
export {
  buildNameFiles,
  nameFileKeys,
  parseTseCsv,
  resultsView,
  type CandidateRow,
  type CargoView,
  type NameFile,
  type ResultsView,
  type TseRow,
} from "./names";
