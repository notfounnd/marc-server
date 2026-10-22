import {
  admits,
  bandOf,
  probabilityOf,
  type Band,
  type ProcedureFit
} from "./fit-model.js";

/**
 * The cheap model's scores of one thread: p, semanticOnly, admission at the low
 * cut and the band of p. The predictions of fit-predictions.json and the gate of
 * H3_C both call this function, so the two paths cannot drift apart.
 */
export type CheapScores = {
  p: number;
  semanticOnly: number;
  admitted: boolean;
  band: Band | null;
};

/** The cheap scores of one vector and its semanticOnly vector (lexical features at 0). */
export function cheapScoresOf(
  vector: readonly number[],
  semanticVector: readonly number[],
  cheap: ProcedureFit
): CheapScores {
  const p = probabilityOf(cheap, vector);
  const semanticOnly = probabilityOf(cheap, semanticVector);
  return {
    p,
    semanticOnly,
    admitted: admits(semanticOnly, cheap.cuts.low),
    band: bandOf(p, cheap.cuts) ?? null
  };
}
