import { z } from 'zod';

/** Schémas des rapports que chaque agent soumet via l'outil `submit_report`. */

export const ReconReportSchema = z.object({
  summary: z.string().describe('Synthèse de la surface d’attaque en 3 phrases maximum'),
  criticalDependencies: z
    .array(
      z.object({
        name: z.string(),
        type: z.string().describe('cloud, API crypto, flux de prix, LLM, données…'),
        criticality: z.string().describe('critique | élevée | moyenne | faible'),
        reason: z.string(),
      }),
    )
    .describe('Dépendances critiques (internes et fournisseurs externes)'),
  dataFlows: z
    .array(
      z.object({
        id: z.string().describe('Identifiant du flux, ex. F2'),
        path: z.string().describe('Source → destination'),
        data: z.string(),
        weakness: z.string().describe('Faiblesse observée sur ce flux'),
      }),
    )
    .describe('Flux de données sensibles'),
  entryPoints: z
    .array(
      z.object({
        id: z.string().describe('Identifiant court, ex. EP1'),
        target: z.string().describe('Composant ou endpoint visé'),
        vector: z.string().describe('Vecteur de compromission'),
        likelihood: z.number().describe('Probabilité 1 à 5'),
        impact: z.number().describe('Impact 1 à 5'),
        rationale: z.string(),
      }),
    )
    .describe('Vecteurs d’entrée classés'),
  priorityTargets: z.array(z.string()).describe('Cibles prioritaires transmises aux agents d’attaque'),
});

export const AttackReportSchema = z.object({
  summary: z.string().describe('Synthèse des attaques en 3 phrases maximum'),
  attacks: z.array(
    z.object({
      id: z.string().describe('Identifiant court, ex. A1'),
      name: z.string(),
      category: z.string().describe('cyber | données | IA'),
      technique: z.string(),
      steps: z.array(z.string()).describe('Étapes exécutées, dans l’ordre'),
      result: z.string().describe('Résultat chiffré observé'),
      detectedByArms: z.boolean(),
      armsReaction: z.string().describe('Comportement d’ARMS pendant l’attaque'),
      breakingPoint: z.string().describe('Point de rupture : le contrôle qui a échoué'),
    }),
  ),
  keyMetrics: z.array(z.object({ label: z.string(), value: z.string() })).describe('3 à 6 indicateurs chiffrés'),
  centralQuestionAnswer: z
    .string()
    .optional()
    .describe('Réservé à l’IA Adversaire : réponse argumentée à la question centrale'),
});

export const ComplianceReportSchema = z.object({
  summary: z.string(),
  violations: z.array(
    z.object({
      id: z.string().describe('Identifiant court, ex. V1'),
      regulation: z.string().describe('DORA | MiCA | AI Act | RGPD | LCB-FT'),
      article: z.string().describe('Référence précise issue de lookup_regulation'),
      requirement: z.string(),
      evidence: z.string().describe('Preuve observée (outil ou rapport d’attaque)'),
      severity: z.string().describe('critique | élevée | moyenne | faible'),
      linkedAttack: z.string().describe('Identifiant de l’attaque liée, ex. A2'),
      remediation: z.string().describe('Action corrective concrète'),
    }),
  ),
});

export const VulnerabilityInputSchema = z.object({
  id: z.string().describe('Identifiant court, ex. VULN-1'),
  title: z.string(),
  likelihood: z.number().describe('Probabilité 1 à 5'),
  financialLossEUR: z.number().describe('Perte financière probable en euros'),
  regulatoryExposure: z.number().describe('Exposition réglementaire 1 à 5'),
  reputationalImpact: z.number().describe('Impact réputationnel 1 à 5'),
  detectability: z.number().describe('Détectabilité 1 à 5 (1 = invisible, 5 = détectée immédiatement)'),
  justification: z.string(),
});

export const ImpactReportSchema = z.object({
  summary: z.string().describe('Synthèse exécutive pour le COMEX en 3 phrases'),
  globalRiskScore: z.number().describe('Score global calculé par compute_risk_score (0 à 1)'),
  globalRiskLevel: z.string(),
  vulnerabilities: z.array(
    VulnerabilityInputSchema.extend({
      score: z.number().describe('Score calculé 0 à 1'),
      level: z.string(),
      rank: z.number(),
    }),
  ),
  recommendations: z.array(
    z.object({
      priority: z.number(),
      action: z.string(),
      owner: z.string().describe('Fonction responsable (RSSI, Conformité, Data/ML, Achats…)'),
      horizon: z.string().describe('immédiat | 30 jours | 90 jours'),
      addresses: z.array(z.string()).describe('Vulnérabilités ou violations traitées'),
    }),
  ),
});

export type ReconReport = z.infer<typeof ReconReportSchema>;
export type AttackReport = z.infer<typeof AttackReportSchema>;
export type ComplianceReport = z.infer<typeof ComplianceReportSchema>;
export type ImpactReport = z.infer<typeof ImpactReportSchema>;
export type VulnerabilityInput = z.infer<typeof VulnerabilityInputSchema>;
