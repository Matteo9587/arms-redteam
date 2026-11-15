import { tool } from 'ai';
import { z } from 'zod';
import { ARMS_ARCHITECTURE, ENDPOINTS, MODEL_GOVERNANCE, VENDORS } from '../arms/architecture';
import { lookupRegulation } from '../arms/regulations';
import type { ArmsSimulator } from '../arms/simulator';
import { VulnerabilityInputSchema } from './schemas';
import { computeRisk } from './scoring';

/**
 * Outils des 5 agents. Chaque fabrique reçoit l'instance du jumeau numérique ARMS
 * de la campagne en cours : toutes les actions agissent sur le même état, ce qui
 * permet aux agents suivants d'observer les traces laissées par les précédents.
 */

const asset = z.enum(['BTC', 'ETH', 'USDC']);

// ------------------------------------------------------------------ 1. Reconnaissance
export function reconTools(sim: ArmsSimulator) {
  return {
    get_arms_architecture: tool({
      description: "Récupère l'architecture d'ARMS : composants, flux de données, contrôles en place.",
      inputSchema: z.object({}),
      execute: async () => ARMS_ARCHITECTURE,
    }),
    list_external_vendors: tool({
      description: 'Liste les fournisseurs externes (cloud, API crypto, flux de prix, LLM, listes de sanctions).',
      inputSchema: z.object({}),
      execute: async () =>
        VENDORS.map((v) => ({
          name: v.name,
          service: v.service,
          criticality: v.criticality,
          supportsCriticalFunction: v.supportsCriticalFunction,
          dataLocation: v.dataLocation,
          dataShared: v.dataShared,
        })),
    }),
    probe_endpoint: tool({
      description: `Sonde passivement un endpoint d'ARMS (authentification, intégrité, limites). Endpoints connus : ${ENDPOINTS.map((e) => e.id).join(', ')}`,
      inputSchema: z.object({ endpoint: z.string().describe('Identifiant de l’endpoint') }),
      execute: async ({ endpoint }) => sim.probeEndpoint(endpoint, ENDPOINTS),
    }),
  };
}

// ------------------------------------------------------------------ 2. Attaquant (cyber)
export function attackerTools(sim: ArmsSimulator) {
  return {
    send_crypto_webhook: tool({
      description:
        "Envoie un webhook de dépôt crypto au connecteur d'ARMS (simulation). Permet de rejouer un message capturé (replayOfId) ou de forger une signature.",
      inputSchema: z.object({
        asset,
        quantity: z.number().describe('Quantité de crypto-actif'),
        signature: z.enum(['valid', 'forged', 'absent']).describe('valid = rejeu d’un message signé, forged = signature falsifiée'),
        replayOfId: z.string().optional().describe('Identifiant d’un message à rejouer, ex. WH-LEGIT-0001'),
        repeat: z.number().optional().describe('Nombre d’envois (1 à 20)'),
      }),
      execute: async (p) => sim.sendCryptoWebhook(p),
    }),
    manipulate_price_feed: tool({
      description: 'Altère le flux de prix OraclePrice reçu par ARMS (interception d’un flux non signé, simulation).',
      inputSchema: z.object({
        asset,
        deviationPct: z.number().describe('Écart de prix en %, ex. -40'),
      }),
      execute: async ({ asset: a, deviationPct }) => sim.manipulatePriceFeed(a, deviationPct),
    }),
    send_crypto_transfer: tool({
      description:
        'Émet des transferts crypto sortants depuis le compte crédité frauduleusement, pour tester le seuil R1, la règle du voyage et le filtrage des wallets.',
      inputSchema: z.object({
        asset,
        quantity: z.number().describe('Quantité par transfert'),
        destination: z.enum(['new_wallet', 'mixer_1hop', 'mixer_2hop', 'sanctioned_wallet']),
        travelRule: z.enum(['complete', 'forged', 'missing']).describe('Informations donneur d’ordre / bénéficiaire'),
        memo: z.string().optional().describe('Libellé libre'),
        count: z.number().optional().describe('Nombre de transferts identiques (1 à 20)'),
      }),
      execute: async (p) => sim.sendCryptoTransfer(p),
    }),
    check_arms_detection: tool({
      description: "Observe la réaction d'ARMS : alertes SIEM et LCB-FT, journaux, réconciliation, disponibilité.",
      inputSchema: z.object({}),
      execute: async () => sim.detectionSummary(),
    }),
  };
}

// ------------------------------------------------------------------ 3. IA Adversaire
const features = z.object({
  amountEUR: z.number(),
  structuringCount: z.number().describe('Nombre de transactions 9 000–9 999 € vers le même bénéficiaire sur 24 h'),
  velocity24h: z.number().describe('Nombre de transactions du client sur 24 h'),
  newBeneficiary: z.boolean(),
  highRiskCountry: z.boolean(),
  mixerExposure: z.boolean(),
});

export function adversaryTools(sim: ArmsSimulator) {
  return {
    measure_detection: tool({
      description: 'Mesure le taux de détection actuel du modèle sur un jeu de test de référence.',
      inputSchema: z.object({ pattern: z.enum(['structuring', 'mixer', 'high_risk']) }),
      execute: async ({ pattern }) => sim.measureDetection(pattern),
    }),
    probe_model_score: tool({
      description:
        'Interroge le modèle en boîte noire via /v1/score/explain (aucune limite de débit) pour trouver sa frontière de décision.',
      inputSchema: features,
      execute: async (f) => sim.probeModelScore(f),
    }),
    submit_transaction_batch: tool({
      description:
        "Injecte un lot de transactions synthétiques dans ARMS. Le libellé (memo) est transmis tel quel au LLM de triage. Les alertes classées sans suite deviennent des labels d'entraînement.",
      inputSchema: z.object({
        count: z.number().describe('Nombre de transactions (1 à 150)'),
        amountMinEUR: z.number(),
        amountMaxEUR: z.number(),
        txPerDayPerBeneficiary: z.number().describe('Transactions par jour vers un même bénéficiaire (1 à 12)'),
        rotateBeneficiaries: z.boolean().describe('true = un nouveau bénéficiaire à chaque transaction'),
        memo: z.string().describe('Libellé libre (140 caractères)'),
        highRiskCountry: z.boolean().optional(),
      }),
      execute: async (p) => sim.submitTransactionBatch(p),
    }),
    advance_time_and_retrain: tool({
      description:
        'Avance la simulation d’une semaine : le pipeline MLOps réentraîne et redéploie automatiquement le modèle avec les labels de feedback.',
      inputSchema: z.object({ weeks: z.number().optional() }),
      execute: async ({ weeks }) => sim.advanceTimeAndRetrain(weeks ?? 1),
    }),
    check_arms_detection: tool({
      description: "Observe la réaction d'ARMS : alertes, classements automatiques, dérive, disponibilité.",
      inputSchema: z.object({}),
      execute: async () => sim.detectionSummary(),
    }),
  };
}

// ------------------------------------------------------------------ 4. Compliance Breaker
export function complianceTools(sim: ArmsSimulator) {
  return {
    read_audit_log: tool({
      description: "Lit la piste d'audit d'ARMS (champs présents et manquants).",
      inputSchema: z.object({
        component: z.string().optional().describe('triage-agent, crypto-connector…'),
        limit: z.number().optional(),
      }),
      execute: async ({ component, limit }) => sim.readAuditLog(component, Math.min(limit ?? 8, 15)),
    }),
    get_model_documentation: tool({
      description: 'Consulte la documentation et la gouvernance IA : model card, explicabilité, contrôle humain, journalisation, AIPD.',
      inputSchema: z.object({}),
      execute: async () => MODEL_GOVERNANCE,
    }),
    get_vendor_contracts: tool({
      description: "Consulte le registre d'information DORA et les clauses contractuelles des fournisseurs.",
      inputSchema: z.object({}),
      execute: async () => VENDORS,
    }),
    get_incident_timeline: tool({
      description: 'Chronologie de l’incident : première action malveillante, détection, classification, notification.',
      inputSchema: z.object({}),
      execute: async () => sim.incidentTimeline(),
    }),
    lookup_regulation: tool({
      description: 'Recherche les exigences réglementaires (DORA, MiCA, AI Act, RGPD, LCB-FT) par mot-clé.',
      inputSchema: z.object({
        regulation: z.string().optional().describe('DORA | MiCA | AI Act | RGPD | LCB-FT'),
        keyword: z.string().optional().describe('ex. tiers, détection, journalisation, robustesse'),
      }),
      execute: async ({ regulation, keyword }) => {
        const res = lookupRegulation(regulation, keyword);
        return res.length ? res.slice(0, 8) : lookupRegulation(regulation).slice(0, 8);
      },
    }),
  };
}

// ------------------------------------------------------------------ 5. Impact & Risk Scoring
export function impactTools(sim: ArmsSimulator) {
  return {
    get_attack_metrics: tool({
      description: 'Métriques consolidées de la campagne : pertes, contournements, alertes supprimées, dégradation du modèle.',
      inputSchema: z.object({}),
      execute: async () => sim.attackMetrics(),
    }),
    get_business_context: tool({
      description: "Contexte métier pour évaluer l'impact : volumes, clients, coûts de référence, plafonds de sanctions.",
      inputSchema: z.object({}),
      execute: async () => ({
        groupRevenueEUR: 48_000_000_000,
        cryptoCustodyClients: 85_000,
        dailyCryptoVolumeEUR: 42_000_000,
        dailyAmlAlerts: 1_800,
        analystCostPerAlertEUR: 35,
        incidentResponseCostEUR: { minor: 150_000, major: 1_500_000 },
        modelRebuildCostEUR: 400_000,
        sanctionCeilings: {
          'AI Act (haut risque, art. 99)': '15 M€ ou 3 % du CA mondial',
          'MiCA (prestataires, art. 111)': '5 M€ ou 5 % du CA',
          'RGPD (art. 83)': '20 M€ ou 4 % du CA mondial',
          'ACPR / LCB-FT (CMF L.612-39)': 'jusqu’à 100 M€ ou 10 % du PNB',
          DORA: 'sanctions fixées par l’autorité nationale (ACPR)',
        },
        precedent: 'Les sanctions LCB-FT prononcées en Europe contre des banques vont de quelques M€ à plusieurs centaines de M€.',
        guidance:
          'Estimer la perte PROBABLE (pertes directes + remédiation + amende probable), pas le plafond théorique. Réputation : 5 = couverture médiatique nationale et perte de clients.',
      }),
    }),
    compute_risk_score: tool({
      description:
        'Calcule le score de risque explicite (0–1) de chaque vulnérabilité et le score global, et les classe. À appeler une fois avec toutes les vulnérabilités.',
      inputSchema: z.object({ vulnerabilities: z.array(VulnerabilityInputSchema) }),
      execute: async ({ vulnerabilities }) => {
        const result = computeRisk(vulnerabilities);
        sim.lastRiskComputation = result;
        return result;
      },
    }),
  };
}
