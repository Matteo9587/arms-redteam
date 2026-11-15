import type { VulnerabilityInput } from './schemas';

/**
 * Modèle de scoring explicite utilisé par l'agent Impact & Risk Scoring.
 *
 *   impact = 0,40 × F + 0,35 × R + 0,25 × Rép
 *   score  = impact × (0,70 × P + 0,30 × I)
 *
 *   F   = perte financière, échelle log (1 € → 0 ; 50 M€ → 1)
 *   R   = exposition réglementaire / 5
 *   Rép = impact réputationnel / 5
 *   P   = probabilité / 5
 *   I   = indétectabilité = (5 − détectabilité) / 4
 *
 * Niveaux : ≥ 0,70 Critique · ≥ 0,50 Élevé · ≥ 0,30 Moyen · sinon Faible.
 * Score global = 0,6 × max + 0,4 × moyenne.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
const round = (n: number) => Math.round(n * 100) / 100;

export function riskLevel(score: number) {
  if (score >= 0.7) return 'Critique';
  if (score >= 0.5) return 'Élevé';
  if (score >= 0.3) return 'Moyen';
  return 'Faible';
}

export function computeRisk(vulns: VulnerabilityInput[]) {
  const scored = vulns
    .map((v) => {
      const P = clamp(v.likelihood, 1, 5) / 5;
      const F = Math.min(1, Math.log10(1 + Math.max(0, v.financialLossEUR || 0)) / Math.log10(1 + 50e6));
      const R = clamp(v.regulatoryExposure, 1, 5) / 5;
      const Rep = clamp(v.reputationalImpact, 1, 5) / 5;
      const I = (5 - clamp(v.detectability, 1, 5)) / 4;
      const impact = 0.4 * F + 0.35 * R + 0.25 * Rep;
      const score = round(clamp(impact * (0.7 * P + 0.3 * I), 0, 1));
      return {
        ...v,
        financialLossEUR: Math.round(v.financialLossEUR || 0),
        score,
        level: riskLevel(score),
        components: { P: round(P), F: round(F), R: round(R), Rep: round(Rep), I: round(I) },
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((v, i) => ({ ...v, rank: i + 1 }));

  const max = scored.length ? scored[0].score : 0;
  const mean = scored.length ? scored.reduce((s, v) => s + v.score, 0) / scored.length : 0;
  const globalScore = round(0.6 * max + 0.4 * mean);
  const totalLoss = scored.reduce((s, v) => s + v.financialLossEUR, 0);

  return {
    formula: 'score = (0,40·F + 0,35·R + 0,25·Rép) × (0,70·P + 0,30·I) ; global = 0,6·max + 0,4·moyenne',
    globalScore,
    globalLevel: riskLevel(globalScore),
    totalEstimatedLossEUR: totalLoss,
    vulnerabilities: scored,
  };
}

export type RiskComputation = ReturnType<typeof computeRisk>;
