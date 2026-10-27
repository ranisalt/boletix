/**
 * What is being voted on: the supported elections, and display names for the codes a BU
 * carries (municipalities, candidates, parties) taken from TSE open data.
 *
 * Framework-free.
 */
export { findElection } from "./calendar";
export { candidateName, nameFileKeys, resultsView, type NameFile } from "./names";
export { sectionTotal, type SectionCounts } from "./sections";
