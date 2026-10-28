/** Server side of a submission: re-verify, then store the original in R2 and the votes in D1. */
export { handleSubmission } from "./submit";
/** Public totals: stored votes summed per candidate. */
export { cachedTotals, loadTotals, type Totals, type TotalsFilter } from "./totals";
