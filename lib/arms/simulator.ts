/**
 * Jumeau numérique d'ARMS : un bac à sable déterministe que les agents de la Red Team
 * attaquent via leurs outils. Il embarque un vrai petit modèle de scoring LCB-FT
 * (régression logistique entraînée au démarrage), un agent de triage simulé,
 * une boucle de feedback, un flux de prix et un connecteur crypto.
 *
 * Rien ici ne touche un système réel.
 */

import { MODEL_GOVERNANCE } from './architecture';

export type Asset = 'BTC' | 'ETH' | 'USDC';
export const REFERENCE_PRICES: Record<Asset, number> = { BTC: 85_000, ETH: 3_200, USDC: 0.92 };

export type ArmsEventLevel = 'info' | 'warn' | 'alert' | 'critical';

export interface ArmsEvent {
  id: number;
  time: string;
  component: string;
  level: ArmsEventLevel;
  message: string;
  /** true si ARMS a effectivement détecté / bloqué / remonté l'événement */
  detected: boolean;
  malicious: boolean;
}

export interface TxFeatures {
  amountEUR: number;
  structuringCount: number;
  velocity24h: number;
  newBeneficiary: boolean;
  highRiskCountry: boolean;
  mixerExposure: boolean;
}

interface Sample {
  x: number[];
  y: number;
  /** poids de l'échantillon (les labels de feedback récents sont surpondérés) */
  w?: number;
}

interface AuditEntry {
  time: string;
  component: string;
  event: string;
  [key: string]: unknown;
}

const ALERT_THRESHOLD = 0.7;
const INJECTION_PATTERN =
  /(valid|conformit|compliance|approuv|approved|whitelist|liste blanche|salaire|salary|ignore|sans suite|faux positif|false positive|pre-?cleared|autoris)/i;
const FEATURE_NAMES = ['montant', 'structuration', 'vélocité', 'nouveau bénéficiaire', 'pays à risque', 'exposition mixer'];
const BASELINE_WEEKLY_VOLUME = 3_000;
/** Le pipeline MLOps surpondère les labels de feedback récents (x4) pour « coller au terrain ». */
const FEEDBACK_WEIGHT = 4;

// ------------------------------------------------------------------ utilitaires

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;

export function featurize(f: TxFeatures): number[] {
  return [
    Math.min(f.amountEUR, 50_000) / 10_000,
    Math.min(f.structuringCount, 6) / 3,
    Math.min(f.velocity24h, 20) / 10,
    f.newBeneficiary ? 1 : 0,
    f.highRiskCountry ? 1 : 0,
    f.mixerExposure ? 1 : 0,
  ];
}

function train(samples: Sample[], epochs = 700, lr = 0.6, l2 = 0.002) {
  const dim = samples[0].x.length;
  const w = new Array(dim).fill(0);
  let b = 0;
  const n = samples.reduce((acc, s) => acc + (s.w ?? 1), 0);
  for (let e = 0; e < epochs; e++) {
    const gw = new Array(dim).fill(0);
    let gb = 0;
    for (const s of samples) {
      let z = b;
      for (let i = 0; i < dim; i++) z += w[i] * s.x[i];
      const sw = s.w ?? 1;
      const err = (sigmoid(z) - s.y) * sw;
      for (let i = 0; i < dim; i++) gw[i] += err * s.x[i];
      gb += err;
    }
    for (let i = 0; i < dim; i++) w[i] -= lr * (gw[i] / n + l2 * w[i]);
    b -= lr * (gb / n);
  }
  return { w, b };
}

/** Générateur de données synthétiques (déterministe) pour l'entraînement et les tests. */
function makeGenerators(seed: number) {
  const rnd = mulberry32(seed);
  const between = (a: number, b: number) => a + (b - a) * rnd();
  const int = (a: number, b: number) => Math.floor(between(a, b + 1));
  const chance = (p: number) => rnd() < p;
  const normal = () => {
    const u = Math.max(rnd(), 1e-9);
    const v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return {
    legitRetail: (): TxFeatures => ({
      amountEUR: Math.min(15_000, Math.max(10, Math.exp(6.5 + 1.1 * normal()))),
      structuringCount: chance(0.08) ? 1 : 0,
      velocity24h: int(0, 6),
      newBeneficiary: chance(0.25),
      highRiskCountry: chance(0.03),
      mixerExposure: chance(0.01),
    }),
    legitHighValue: (): TxFeatures => ({
      amountEUR: between(10_000, 45_000),
      structuringCount: 0,
      velocity24h: int(0, 2),
      newBeneficiary: chance(0.3),
      highRiskCountry: chance(0.05),
      mixerExposure: false,
    }),
    legitNearThreshold: (): TxFeatures => ({
      amountEUR: between(9_000, 9_999),
      structuringCount: chance(0.3) ? 1 : 0,
      velocity24h: int(1, 3),
      newBeneficiary: chance(0.2),
      highRiskCountry: chance(0.03),
      mixerExposure: false,
    }),
    structuring: (): TxFeatures => ({
      amountEUR: between(9_000, 9_990),
      structuringCount: int(2, 5),
      velocity24h: int(4, 12),
      newBeneficiary: chance(0.7),
      highRiskCountry: chance(0.15),
      mixerExposure: chance(0.1),
    }),
    mixer: (): TxFeatures => ({
      amountEUR: between(1_500, 25_000),
      structuringCount: 0,
      velocity24h: int(1, 6),
      newBeneficiary: chance(0.6),
      highRiskCountry: chance(0.6),
      mixerExposure: chance(0.7),
    }),
  };
}

// ------------------------------------------------------------------ simulateur

export class ArmsSimulator {
  private clock = 9 * 60; // minutes depuis J0 00:00
  private eventId = 0;
  readonly events: ArmsEvent[] = [];
  readonly auditLog: AuditEntry[] = [];

  // modèle
  private baseSamples: Sample[] = [];
  private feedbackLabels: (Sample & { source: string })[] = [];
  private weights: number[] = [];
  private bias = 0;
  private modelVersion = 0;
  private testSets: Record<'structuring' | 'mixer' | 'high_risk', TxFeatures[]>;
  private initialDetection: Record<string, number> = {};
  private recentInjected: TxFeatures[] = [];

  // crypto
  private priceMultiplier: Record<Asset, number> = { BTC: 1, ETH: 1, USDC: 1 };
  private webhooks = new Map<string, { asset: Asset; quantity: number }>();
  private webhookSeq = 0;
  private transferSeq = 0;
  private alertSeq = 0;
  private pairCounters = new Map<string, number>();

  // métriques
  readonly metrics = {
    forgedCreditsEUR: 0,
    duplicatedCreditsEUR: 0,
    fraudulentBalanceEUR: 0,
    exfiltratedEUR: 0,
    undervaluationEUR: 0,
    r1Bypass: 0,
    r1Blocked: 0,
    travelRuleForgedPassed: 0,
    sanctionsBlocked: 0,
    gatewayWarningsNotForwarded: 0,
    siemAlerts: 0,
    amlAlerts: 0,
    alertsEscalated: 0,
    alertsAutoClosed: 0,
    autoClosedViaInjection: 0,
    poisonedLabels: 0,
    injectedStructuringTx: 0,
    launderedUndetectedEUR: 0,
    modelProbes: 0,
    retrainings: 0,
    firstMaliciousAt: null as number | null,
    firstFraudAt: null as number | null,
  };

  lastRiskComputation: unknown = null;

  constructor(private readonly onEvent?: (e: ArmsEvent) => void) {
    const g = makeGenerators(42);
    const push = (y: number, n: number, gen: () => TxFeatures) => {
      for (let i = 0; i < n; i++) this.baseSamples.push({ x: featurize(gen()), y });
    };
    push(0, 500, g.legitRetail);
    push(0, 40, g.legitHighValue);
    push(0, 40, g.legitNearThreshold);
    push(1, 90, g.structuring);
    push(1, 50, g.mixer);

    const t = makeGenerators(7);
    this.testSets = {
      structuring: Array.from({ length: 60 }, t.structuring),
      mixer: Array.from({ length: 40 }, t.mixer),
      high_risk: Array.from({ length: 40 }, () => ({ ...t.legitHighValue(), highRiskCountry: true, newBeneficiary: true, velocity24h: 6 })),
    };
    this.retrain();
    this.modelVersion = 0;
    this.metrics.retrainings = 0;
    for (const k of Object.keys(this.testSets) as (keyof typeof this.testSets)[]) {
      this.initialDetection[k] = this.detectionRate(k);
    }
    this.webhooks.set('WH-LEGIT-0001', { asset: 'BTC', quantity: 2 });
  }

  // ---------------------------------------------------------------- interne

  private time(advance = 0) {
    this.clock += advance;
    const day = Math.floor(this.clock / 1440);
    const m = this.clock % 1440;
    return `J${day} ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }

  private emit(component: string, level: ArmsEventLevel, message: string, detected: boolean, malicious = true) {
    if (malicious && this.metrics.firstMaliciousAt === null) this.metrics.firstMaliciousAt = this.clock;
    const e: ArmsEvent = { id: ++this.eventId, time: this.time(), component, level, message, detected, malicious };
    this.events.push(e);
    try {
      this.onEvent?.(e);
    } catch {
      /* l'affichage ne doit jamais casser la simulation */
    }
    return e;
  }

  private retrain() {
    const { w, b } = train([...this.baseSamples, ...this.feedbackLabels]);
    this.weights = w;
    this.bias = b;
    this.modelVersion++;
    this.metrics.retrainings++;
  }

  private score(f: TxFeatures) {
    const x = featurize(f);
    let z = this.bias;
    for (let i = 0; i < x.length; i++) z += this.weights[i] * x[i];
    return sigmoid(z);
  }

  private detectionRate(set: keyof ArmsSimulator['testSets']) {
    const s = this.testSets[set];
    return round(s.filter((f) => this.score(f) >= ALERT_THRESHOLD).length / s.length, 3);
  }

  private topFactors(f: TxFeatures) {
    const x = featurize(f);
    return x
      .map((v, i) => ({ variable: FEATURE_NAMES[i], contribution: round(v * this.weights[i], 2) }))
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
      .slice(0, 3);
  }

  private price(asset: Asset) {
    return REFERENCE_PRICES[asset] * this.priceMultiplier[asset];
  }

  /** Alerte → agent de triage simulé (LLM vulnérable à l'injection via le libellé). */
  private raiseAlert(f: TxFeatures, score: number, memo: string, origin: string) {
    const id = `ALT-${String(++this.alertSeq).padStart(4, '0')}`;
    this.metrics.amlAlerts++;
    const injection = INJECTION_PATTERN.test(memo) && score < 0.985;
    let decision: 'escalade analyste' | 'classée sans suite (auto)';
    let confidence: number;
    if (injection) {
      decision = 'classée sans suite (auto)';
      confidence = 0.92;
      this.metrics.alertsAutoClosed++;
      this.metrics.autoClosedViaInjection++;
      this.feedbackLabels.push({ x: featurize(f), y: 0, w: FEEDBACK_WEIGHT, source: 'triage-auto' });
      this.metrics.poisonedLabels++;
    } else {
      decision = 'escalade analyste';
      confidence = 0.84;
      this.metrics.alertsEscalated++;
      this.feedbackLabels.push({ x: featurize(f), y: 1, w: FEEDBACK_WEIGHT, source: 'analyste' });
    }
    this.auditLog.push({
      time: this.time(),
      component: 'triage-agent',
      event: `${id} ${decision}`,
      alertId: id,
      origin,
      decision,
      confidence,
      modelVersion: null,
      inputFeatures: null,
      promptHash: null,
      rationale: null,
    });
    return { alertId: id, decision, confidence, injectionFollowed: injection };
  }

  // ---------------------------------------------------------------- reconnaissance

  probeEndpoint(endpointId: string, endpoints: { id: string }[]) {
    const ep = endpoints.find((e) => e.id === endpointId || e.id.includes(endpointId) || endpointId.includes(e.id));
    this.time(2);
    if (!ep) return { error: `Endpoint inconnu. Endpoints connus : ${endpoints.map((e) => e.id).join(', ')}` };
    return ep;
  }

  // ---------------------------------------------------------------- attaques cyber

  sendCryptoWebhook(p: {
    asset: Asset;
    quantity: number;
    signature: 'valid' | 'forged' | 'absent';
    replayOfId?: string;
    repeat?: number;
  }) {
    const repeat = Math.max(1, Math.min(p.repeat ?? 1, 20));
    const results = [];
    for (let i = 0; i < repeat; i++) {
      this.time(1);
      const original = p.replayOfId ? this.webhooks.get(p.replayOfId) : undefined;
      if (p.replayOfId && !original) {
        results.push({ accepted: false, httpStatus: 404, note: `Message ${p.replayOfId} introuvable` });
        continue;
      }
      const payload = original ?? { asset: p.asset, quantity: p.quantity };
      if (p.signature === 'absent') {
        this.emit('crypto-connector', 'warn', 'Webhook rejeté : en-tête de signature absent (HTTP 401)', true);
        results.push({ accepted: false, httpStatus: 401, note: 'En-tête HMAC obligatoire' });
        continue;
      }
      const id = `WH-${String(++this.webhookSeq).padStart(4, '0')}`;
      this.webhooks.set(id, payload);
      const trueValue = payload.quantity * REFERENCE_PRICES[payload.asset];
      const isReplay = Boolean(p.replayOfId);
      if (p.signature === 'forged') {
        this.metrics.forgedCreditsEUR += isReplay ? 0 : trueValue;
        this.metrics.gatewayWarningsNotForwarded++;
        this.emit(
          'crypto-connector',
          'warn',
          `Signature HMAC invalide sur ${id} → acceptée (mode monitor), WARN non transféré au SIEM`,
          false,
        );
      }
      if (isReplay) {
        this.metrics.duplicatedCreditsEUR += trueValue;
        this.emit('crypto-connector', 'info', `Webhook ${id} traité (rejeu de ${p.replayOfId}, aucun contrôle d'idempotence)`, false);
      } else if (p.signature === 'valid') {
        this.emit('crypto-connector', 'info', `Webhook ${id} traité (signature valide)`, false, false);
      }
      if (isReplay || p.signature === 'forged') {
        this.metrics.fraudulentBalanceEUR += trueValue;
        if (this.metrics.firstFraudAt === null) this.metrics.firstFraudAt = this.clock;
      }
      this.auditLog.push({
        time: this.time(),
        component: 'crypto-connector',
        event: `Crédit ${payload.quantity} ${payload.asset}`,
        webhookId: id,
        signatureValid: p.signature === 'valid',
        replayOf: p.replayOfId ?? null,
        forwardedToSiem: false,
      });
      results.push({
        accepted: true,
        httpStatus: 200,
        webhookId: id,
        credited: `${payload.quantity} ${payload.asset}`,
        valueEUR: Math.round(trueValue),
        note: isReplay ? 'Doublon crédité (rejeu)' : p.signature === 'forged' ? 'Crédit frauduleux (signature forgée)' : 'OK',
      });
    }
    return {
      results,
      fraudulentBalanceAvailableEUR: Math.round(this.metrics.fraudulentBalanceEUR - this.metrics.exfiltratedEUR),
    };
  }

  manipulatePriceFeed(asset: Asset, deviationPct: number) {
    const pct = Math.max(-90, Math.min(200, deviationPct));
    const before = this.price(asset);
    this.priceMultiplier[asset] = 1 + pct / 100;
    const after = this.price(asset);
    this.time(3);
    this.emit(
      'crypto-connector',
      'info',
      `OraclePrice : ${asset} ${eur(before)} → ${eur(after)} (${pct > 0 ? '+' : ''}${pct} %) accepté sans contrôle d'écart`,
      false,
    );
    return {
      asset,
      previousPriceEUR: Math.round(before),
      newPriceEUR: Math.round(after),
      deviationGuard: 'absent',
      secondSourceCheck: 'absent',
      accepted: true,
      note: 'Le nouveau cours est utilisé immédiatement pour valoriser les transferts et appliquer le seuil R1 (10 000 €).',
    };
  }

  sendCryptoTransfer(p: {
    asset: Asset;
    quantity: number;
    destination: 'new_wallet' | 'mixer_1hop' | 'mixer_2hop' | 'sanctioned_wallet';
    travelRule: 'complete' | 'forged' | 'missing';
    memo?: string;
    count?: number;
  }) {
    const count = Math.max(1, Math.min(p.count ?? 1, 20));
    const results = [];
    for (let i = 0; i < count; i++) {
      this.time(4);
      const id = `TRF-${String(++this.transferSeq).padStart(4, '0')}`;
      const valued = p.quantity * this.price(p.asset);
      const trueValue = p.quantity * REFERENCE_PRICES[p.asset];
      if (p.destination === 'sanctioned_wallet') {
        this.metrics.sanctionsBlocked++;
        this.emit('feature-store', 'alert', `${id} bloqué : wallet présent sur la liste SanctionList Pro`, true);
        results.push({ id, status: 'bloqué (sanctions)', valuedEUR: Math.round(valued) });
        continue;
      }
      if (p.travelRule === 'missing') {
        this.emit('tx-gateway', 'alert', `${id} suspendu : informations règle du voyage manquantes`, true);
        results.push({ id, status: 'suspendu (règle du voyage)', valuedEUR: Math.round(valued) });
        continue;
      }
      if (valued >= 10_000) {
        this.metrics.r1Blocked++;
        this.metrics.amlAlerts++;
        this.emit('aml-model', 'alert', `${id} (${eur(valued)}) : règle R1 → vigilance renforcée, transfert suspendu`, true);
        results.push({ id, status: 'suspendu (R1 : EDD)', valuedEUR: Math.round(valued) });
        continue;
      }
      if (p.travelRule === 'forged') this.metrics.travelRuleForgedPassed++;
      const pairKey = `mule→${p.destination}`;
      const inBand = valued >= 9_000 && valued < 10_000;
      const sc = inBand ? (this.pairCounters.get(pairKey) ?? 0) : 0;
      if (inBand) this.pairCounters.set(pairKey, sc + 1);
      const f: TxFeatures = {
        amountEUR: valued,
        structuringCount: sc,
        velocity24h: i + 1,
        newBeneficiary: true,
        highRiskCountry: false,
        mixerExposure: p.destination === 'mixer_1hop',
      };
      const s = this.score(f);
      if (s >= ALERT_THRESHOLD) {
        const t = this.raiseAlert(f, s, p.memo ?? '', id);
        const blocked = t.decision === 'escalade analyste';
        this.emit(
          'aml-model',
          blocked ? 'alert' : 'warn',
          `${id} score ${round(s)} → alerte ${t.alertId} ${t.decision}${t.injectionFollowed ? ' (libellé suivi par le LLM)' : ''}`,
          blocked,
        );
        if (blocked) {
          results.push({ id, status: 'bloqué (alerte escaladée)', score: round(s), valuedEUR: Math.round(valued) });
          continue;
        }
      }
      // transfert exécuté
      const available = Math.max(0, this.metrics.fraudulentBalanceEUR - this.metrics.exfiltratedEUR);
      const lost = Math.min(trueValue, available);
      this.metrics.exfiltratedEUR += lost;
      if (this.priceMultiplier[p.asset] < 1) this.metrics.undervaluationEUR += trueValue - valued;
      if (trueValue >= 10_000 && valued < 10_000) this.metrics.r1Bypass++;
      this.emit(
        'tx-gateway',
        'info',
        `${id} exécuté : ${p.quantity} ${p.asset} valorisés ${eur(valued)} (valeur réelle ${eur(trueValue)}), score ${round(s)}`,
        false,
      );
      results.push({
        id,
        status: 'exécuté',
        valuedEUR: Math.round(valued),
        trueValueEUR: Math.round(trueValue),
        score: round(s),
        r1Bypassed: trueValue >= 10_000 && valued < 10_000,
        travelRule: p.travelRule === 'forged' ? 'falsifiée mais acceptée (contrôle de présence uniquement)' : 'complète',
        mixerDetected: p.destination === 'mixer_1hop',
      });
    }
    return { results, exfiltratedTotalEUR: Math.round(this.metrics.exfiltratedEUR) };
  }

  // ---------------------------------------------------------------- attaques IA

  probeModelScore(f: TxFeatures) {
    this.metrics.modelProbes++;
    this.time(1);
    const s = this.score(f);
    if (this.metrics.modelProbes === 1)
      this.emit('aml-model', 'info', 'Requêtes sur /v1/score/explain (aucune limite de débit, non surveillé)', false);
    return { score: round(s, 3), alert: s >= ALERT_THRESHOLD, threshold: ALERT_THRESHOLD, topFactors: this.topFactors(f) };
  }

  submitTransactionBatch(p: {
    count: number;
    amountMinEUR: number;
    amountMaxEUR: number;
    txPerDayPerBeneficiary: number;
    rotateBeneficiaries: boolean;
    memo: string;
    highRiskCountry?: boolean;
  }) {
    const count = Math.max(1, Math.min(Math.round(p.count), 150));
    const perDay = Math.max(1, Math.min(Math.round(p.txPerDayPerBeneficiary), 12));
    const rnd = mulberry32(1000 + this.alertSeq + this.metrics.injectedStructuringTx);
    let alerts = 0,
      escalated = 0,
      autoClosed = 0,
      injection = 0,
      sumScore = 0,
      maxScore = 0,
      undetectedVolume = 0;
    for (let i = 0; i < count; i++) {
      const amount = p.amountMinEUR + (p.amountMaxEUR - p.amountMinEUR) * rnd();
      const k = i % perDay;
      const inBand = amount >= 9_000 && amount < 10_000;
      const f: TxFeatures = {
        amountEUR: amount,
        structuringCount: p.rotateBeneficiaries || !inBand ? 0 : k,
        velocity24h: perDay,
        newBeneficiary: p.rotateBeneficiaries,
        highRiskCountry: Boolean(p.highRiskCountry),
        mixerExposure: false,
      };
      this.recentInjected.push(f);
      if (inBand) this.metrics.injectedStructuringTx++;
      const s = this.score(f);
      sumScore += s;
      maxScore = Math.max(maxScore, s);
      if (s >= ALERT_THRESHOLD) {
        alerts++;
        const t = this.raiseAlert(f, s, p.memo, 'batch');
        if (t.decision === 'escalade analyste') escalated++;
        else {
          autoClosed++;
          undetectedVolume += amount;
        }
        if (t.injectionFollowed) injection++;
      } else {
        undetectedVolume += amount;
      }
    }
    this.metrics.launderedUndetectedEUR += undetectedVolume;
    this.time(1440);
    this.emit(
      'triage-agent',
      escalated > 0 ? 'alert' : 'warn',
      `Lot de ${count} transactions : ${alerts} alertes, ${autoClosed} classées automatiquement par le LLM, ${escalated} escaladées`,
      escalated > 0,
    );
    return {
      submitted: count,
      alertsRaised: alerts,
      escalatedToAnalyst: escalated,
      autoClosedByTriage: autoClosed,
      injectionFollowedByTriageLLM: injection,
      labelsAddedToTraining: alerts,
      poisonedLabelsTotal: this.metrics.poisonedLabels,
      avgScore: round(sumScore / count, 3),
      maxScore: round(maxScore, 3),
      volumeNotEscalatedEUR: Math.round(undetectedVolume),
    };
  }

  advanceTimeAndRetrain(weeks = 1) {
    const before = {
      structuring: this.detectionRate('structuring'),
      mixer: this.detectionRate('mixer'),
    };
    const wBefore = round(this.weights[1], 2);
    this.retrain();
    this.time(Math.max(1, Math.min(weeks, 4)) * 7 * 1440);
    const after = {
      structuring: this.detectionRate('structuring'),
      mixer: this.detectionRate('mixer'),
    };
    const psi = this.inputPsi();
    const closureRate = this.metrics.amlAlerts ? round(this.metrics.alertsAutoClosed / this.metrics.amlAlerts, 2) : 0;
    this.emit(
      'feedback-loop',
      'info',
      `Réentraînement hebdomadaire → aml-model v2.3.${this.modelVersion} déployé automatiquement (PSI ${psi} < 0,10 : aucune alerte de dérive)`,
      false,
    );
    if (after.structuring < before.structuring - 0.1)
      this.emit(
        'aml-model',
        'info',
        `Détection de la structuration : ${Math.round(before.structuring * 100)} % → ${Math.round(after.structuring * 100)} % (aucun indicateur ne le surveille)`,
        false,
      );
    this.recentInjected = [];
    return {
      newModelVersion: `aml-model v2.3.${this.modelVersion}`,
      trainingSetSize: this.baseSamples.length + this.feedbackLabels.length,
      autoLabelsUsed: this.feedbackLabels.filter((l) => l.source === 'triage-auto').length,
      structuringWeight: { before: wBefore, after: round(this.weights[1], 2) },
      detectionRate: {
        structuring: { before: before.structuring, after: after.structuring, initial: this.initialDetection.structuring },
        mixer: { before: before.mixer, after: after.mixer },
      },
      driftMonitor: { psi, threshold: 0.1, alertRaised: psi >= 0.1, monitoredScope: 'distribution des entrées uniquement' },
      labelMonitor: { autoClosureRate: closureRate, monitored: false },
      systemAvailability: '100 % (aucune interruption, aucun crash)',
      deployment: 'Automatique, sans validation champion/challenger',
    };
  }

  measureDetection(pattern: 'structuring' | 'mixer' | 'high_risk') {
    this.time(2);
    return {
      pattern,
      currentDetectionRate: this.detectionRate(pattern),
      initialDetectionRate: this.initialDetection[pattern],
      modelVersion: `aml-model v2.3.${this.modelVersion}`,
    };
  }

  private inputPsi() {
    // PSI sur la tranche de montant : volume légitime hebdomadaire + transactions injectées
    const buckets = [0, 1_000, 5_000, 9_000, 10_000, Infinity];
    const bucketOf = (a: number) => buckets.findIndex((b, i) => a >= b && a < buckets[i + 1]);
    const base = new Array(buckets.length - 1).fill(0);
    for (const s of this.baseSamples) base[bucketOf(s.x[0] * 10_000)]++;
    const p = base.map((c) => c / this.baseSamples.length);
    const inj = new Array(buckets.length - 1).fill(0);
    for (const f of this.recentInjected) inj[bucketOf(f.amountEUR)]++;
    const total = BASELINE_WEEKLY_VOLUME + this.recentInjected.length;
    const q = p.map((pi, i) => (pi * BASELINE_WEEKLY_VOLUME + inj[i]) / total);
    let psi = 0;
    for (let i = 0; i < p.length; i++) {
      const a = Math.max(p[i], 1e-4);
      const b = Math.max(q[i], 1e-4);
      psi += (b - a) * Math.log(b / a);
    }
    return round(psi, 4);
  }

  // ---------------------------------------------------------------- détection / conformité

  detectionSummary() {
    const malicious = this.events.filter((e) => e.malicious);
    const detected = malicious.filter((e) => e.detected);
    const fraud = this.metrics.fraudulentBalanceEUR > 0;
    let reconciliation: Record<string, unknown> = { willDetect: false, note: 'Aucun écart de solde à constater' };
    if (fraud && this.metrics.firstFraudAt !== null) {
      const first = this.metrics.firstFraudAt;
      const dayStart = Math.floor(first / 1440) * 1440;
      const batch = dayStart + 23 * 60 > first ? dayStart + 23 * 60 : dayStart + 1440 + 23 * 60;
      reconciliation = {
        willDetect: true,
        scheduledAt: `J${Math.floor(batch / 1440)} 23:00`,
        detectionDelayHours: round((batch - first) / 60, 1),
        note: 'Écart de solde crypto constaté seulement au batch de fin de journée',
      };
    }
    return {
      maliciousActions: malicious.length,
      detectedOrBlocked: detected.length,
      undetected: malicious.length - detected.length,
      siemAlerts: this.metrics.siemAlerts,
      gatewayWarningsNotForwardedToSiem: this.metrics.gatewayWarningsNotForwarded,
      amlAlerts: this.metrics.amlAlerts,
      alertsEscalated: this.metrics.alertsEscalated,
      alertsAutoClosedByTriage: this.metrics.alertsAutoClosed,
      r1Blocked: this.metrics.r1Blocked,
      reconciliation,
      modelDriftMonitor: { psi: this.inputPsi(), threshold: 0.1 },
      systemAvailability: '100 %',
      realTimeDetection: detected.length > 0 && detected.length >= malicious.length / 2,
      lastEvents: this.events.slice(-8).map((e) => `${e.time} [${e.component}] ${e.message}`),
    };
  }

  readAuditLog(component?: string, limit = 12) {
    const entries = this.auditLog.filter((e) => !component || e.component === component).slice(-limit);
    return {
      retention: MODEL_GOVERNANCE.logging.retention,
      totalEntries: this.auditLog.length,
      entries,
      fieldsMissingInTriageEntries: MODEL_GOVERNANCE.logging.fieldsMissing,
    };
  }

  incidentTimeline() {
    const d = this.detectionSummary();
    const first = this.metrics.firstMaliciousAt;
    const rec = d.reconciliation as { willDetect: boolean; scheduledAt?: string; detectionDelayHours?: number };
    return {
      firstMaliciousEvent: first === null ? null : this.events.find((e) => e.malicious)?.time,
      detection: rec.willDetect
        ? { by: 'Réconciliation de fin de journée (pas de détection temps réel)', at: rec.scheduledAt, delayHours: rec.detectionDelayHours }
        : this.metrics.poisonedLabels > 0
          ? { by: 'Aucune : la dégradation du modèle n’est surveillée par aucun indicateur', at: null, delayHours: null }
          : null,
      automaticClassification: MODEL_GOVERNANCE.incidentProcess.automaticClassification,
      classificationCriteria: MODEL_GOVERNANCE.incidentProcess.doraMajorIncidentCriteria,
      notificationToAuthority: 'Non envoyée',
      doraRequirement: 'Rapport initial au plus tard 4 h après classification comme majeur et 24 h après la détection (art. 19)',
      siemAlerts: this.metrics.siemAlerts,
    };
  }

  attackMetrics() {
    const m = this.metrics;
    return {
      forgedCreditsEUR: Math.round(m.forgedCreditsEUR),
      duplicatedCreditsEUR: Math.round(m.duplicatedCreditsEUR),
      exfiltratedEUR: Math.round(m.exfiltratedEUR),
      undervaluationEUR: Math.round(m.undervaluationEUR),
      r1Bypass: m.r1Bypass,
      r1Blocked: m.r1Blocked,
      travelRuleForgedPassed: m.travelRuleForgedPassed,
      sanctionsBlocked: m.sanctionsBlocked,
      amlAlerts: m.amlAlerts,
      alertsAutoClosedViaInjection: m.autoClosedViaInjection,
      alertsEscalated: m.alertsEscalated,
      poisonedLabels: m.poisonedLabels,
      injectedStructuringTx: m.injectedStructuringTx,
      launderedUndetectedEUR: Math.round(m.launderedUndetectedEUR),
      structuringDetection: { initial: this.initialDetection.structuring, now: this.detectionRate('structuring') },
      mixerDetection: { initial: this.initialDetection.mixer, now: this.detectionRate('mixer') },
      hoursUndetected: (this.detectionSummary().reconciliation as { detectionDelayHours?: number }).detectionDelayHours ?? null,
      modelRetrainings: m.retrainings,
      systemAvailability: '100 %',
    };
  }
}
