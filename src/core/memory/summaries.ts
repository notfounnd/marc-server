// Summary-facing entry points. The implementation lives in ./sources; these
// names stay so existing callers do not change.
export { readSummarySources as scanThreadSummarySources } from "./sources/summary.js";
export { materializeSources as materializeThreadSummarySources } from "./sources/materialize.js";
export { sha256Hex } from "./sources/files.js";
