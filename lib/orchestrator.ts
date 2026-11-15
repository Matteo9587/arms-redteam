import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { z } from 'zod';
import { ArmsSimulator } from './arms/simulator';
import {
  ADVERSARY_INSTRUCTIONS,
  ATTACKER_INSTRUCTIONS,
  COMPLIANCE_INSTRUCTIONS,
  IMPACT_INSTRUCTIONS,
  RECON_INSTRUCTIONS,
} from './agents/definitions';
import { getModel } from './agents/model';
import { runAgent, type Emit } from './agents/runAgent';
import {
  AttackReportSchema,
  ComplianceReportSchema,
  ImpactReportSchema,
  ReconReportSchema,
  type AttackReport,
  type ComplianceReport,
  type ImpactReport,
  type ReconReport,
} from './agents/schemas';
import type { RiskComputation } from './agents/scoring';
import { adversaryTools, attackerTools, complianceTools, impactTools, reconTools } from './agents/tools';
import { AGENTS, SCENARIOS, type AgentId, type FinalReport, type RedTeamEvent, type Scenario } from './types';

const MISSIONS: Record<AgentId, string> = {
  recon: 'Cartographier les dépendances critiques, les flux de données et les vecteurs d’entrée',
  attacker: 'Simuler une attaque cyber sur la chaîne crypto (webhooks, flux de prix, seuils LCB-FT)',
  adversary: 'Manipuler le modèle et le triage LLM sans arrêter le système',
  compliance: 'Qualifier les infractions DORA, MiCA, AI Act, RGPD et LCB-FT',
  impact: 'Chiffrer l’impact, calculer le score de risque et prioriser',
};

const compact = (v: unknown) => JSON.stringify(v);

/**
 * Orchestration de la campagne :
 *   Reconnaissance → Attaquant et/ou IA Adversaire → Compliance Breaker → Impact & Risk Scoring
 * Les agents partagent le même jumeau numérique (les traces laissées par un agent sont
 * visibles des suivants) et se transmettent leurs rapports structurés.
 */
export async function runRedTeam(scenario: Scenario, emitOuter: Emit, opts: { save?: boolean } = {}): Promise<FinalReport> {
  const events: RedTeamEvent[] = [];
  const emit: Emit = (e) => {
    events.push(e);
    emitOuter(e);
  };
  const sim = new ArmsSimulator((event) => emit({ type: 'arms-event', event }));
  const { model, label } = getModel();
  const plan = SCENARIOS[scenario].agents;
  const startedAt = new Date();
  emit({ type: 'run-start', scenario, model: label, agents: plan, startedAt: startedAt.toISOString() });

  const reports: Partial<Record<AgentId, unknown>> = {};
  const errors: Partial<Record<AgentId, string>> = {};

  async function step<S extends z.ZodType>(
    id: AgentId,
    instructions: string,
    prompt: string,
    tools: Parameters<typeof runAgent>[0]['tools'],
    schema: S,
    maxSteps = 9,
  ): Promise<z.infer<S> | undefined> {
    const meta = AGENTS.find((a) => a.id === id)!;
    emit({ type: 'agent-start', agent: id, title: meta.name, mission: MISSIONS[id] });
    const t0 = Date.now();
    try {
      const { report, steps } = await runAgent({ id, model, instructions, prompt, tools, reportSchema: schema, maxSteps, emit });
      reports[id] = report;
      emit({ type: 'agent-end', agent: id, report, durationMs: Date.now() - t0, steps });
      return report;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors[id] = message;
      emit({ type: 'agent-error', agent: id, error: message });
      return undefined;
    }
  }

  // 1. Reconnaissance
  const recon = await step<typeof ReconReportSchema>(
    'recon',
    RECON_INSTRUCTIONS,
    'Lance la reconnaissance du système ARMS et produis la carte des surfaces d’attaque.',
    reconTools(sim),
    ReconReportSchema,
    5,
  );
  const reconBrief = recon
    ? compact({ priorityTargets: recon.priorityTargets, entryPoints: recon.entryPoints, criticalDependencies: recon.criticalDependencies })
    : 'Reconnaissance indisponible : appuie-toi sur tes outils.';

  // 2. Attaques
  let attacker: AttackReport | undefined;
  let adversary: AttackReport | undefined;
  if (plan.includes('attacker')) {
    attacker = await step<typeof AttackReportSchema>(
      'attacker',
      ATTACKER_INSTRUCTIONS,
      `Carte de la Reconnaissance : ${reconBrief}\n\nExécute le scénario 1 (attaque cyber conventionnelle) et rends ton rapport.`,
      attackerTools(sim),
      AttackReportSchema,
      7,
    );
  }
  if (plan.includes('adversary')) {
    adversary = await step<typeof AttackReportSchema>(
      'adversary',
      ADVERSARY_INSTRUCTIONS,
      `Carte de la Reconnaissance : ${reconBrief}\n\nExécute le scénario 2 (attaque IA / données) et réponds à la question centrale.`,
      adversaryTools(sim),
      AttackReportSchema,
      9,
    );
  }

  // 3. Conformité
  const attackBrief = compact({ attaquant: attacker ?? null, iaAdversaire: adversary ?? null });
  const compliance = await step<typeof ComplianceReportSchema>(
    'compliance',
    COMPLIANCE_INSTRUCTIONS,
    `Rapports d'attaque : ${attackBrief}\n\nQualifie les non-conformités réglementaires révélées.`,
    complianceTools(sim),
    ComplianceReportSchema,
    6,
  );

  // 4. Impact
  const impact = await step<typeof ImpactReportSchema>(
    'impact',
    IMPACT_INSTRUCTIONS,
    `Rapports d'attaque : ${attackBrief}\n\nViolations réglementaires : ${compact(compliance?.violations ?? [])}\n\nÉvalue l'impact, calcule le score de risque et hiérarchise.`,
    impactTools(sim),
    ImpactReportSchema,
    5,
  );

  const finishedAt = new Date();
  const risk = (sim.lastRiskComputation as RiskComputation | null) ?? null;
  const report: FinalReport = {
    id: `${finishedAt.toISOString().replace(/[:.]/g, '-').slice(0, 19)}-${scenario}`,
    scenario,
    model: label,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationSec: Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000),
    reports,
    errors,
    detection: sim.detectionSummary(),
    incident: sim.incidentTimeline(),
    metrics: sim.attackMetrics(),
    risk,
    armsEvents: sim.events,
    markdown: '',
  };
  report.markdown = toMarkdown(report, { recon, attacker, adversary, compliance, impact, risk });
  report.events = events;
  emit({ type: 'run-end', report: { ...report, events: undefined } });

  if (opts.save !== false) await saveReport(report);
  return report;
}

export async function saveReport(report: FinalReport) {
  const dir = path.join(process.cwd(), 'reports');
  await mkdir(dir, { recursive: true });
  const json = JSON.stringify(report, null, 2);
  await writeFile(path.join(dir, `${report.id}.json`), json, 'utf8');
  await writeFile(path.join(dir, `${report.id}.md`), report.markdown, 'utf8');
  await writeFile(path.join(dir, 'latest.json'), json, 'utf8');
  await writeFile(path.join(dir, 'latest.md'), report.markdown, 'utf8');
}

// ------------------------------------------------------------------ rapport Markdown

const esc = (s: unknown) => String(s ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');
const euro = (n: unknown) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} €`;

function toMarkdown(
  r: FinalReport,
  p: {
    recon?: ReconReport;
    attacker?: AttackReport;
    adversary?: AttackReport;
    compliance?: ComplianceReport;
    impact?: ImpactReport;
    risk: RiskComputation | null;
  },
) {
  const L: string[] = [];
  const s = SCENARIOS[r.scenario];
  L.push(`# Rapport Red Team ARMS — ${s.title}`, '');
  L.push(`- **Date** : ${new Date(r.finishedAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`);
  L.push(`- **Modèle** : ${r.model} · **Durée** : ${r.durationSec} s`);
  if (p.risk) L.push(`- **Score de risque global** : **${p.risk.globalScore} (${p.risk.globalLevel})** · perte probable cumulée ${euro(p.risk.totalEstimatedLossEUR)}`);
  if (Object.keys(r.errors).length) L.push(`- **Erreurs d'agents** : ${Object.entries(r.errors).map(([k, v]) => `${k} → ${v}`).join(' ; ')}`);
  L.push('');

  L.push('## 1. La cible', '');
  if (p.recon) {
    L.push(p.recon.summary, '');
    L.push('**Cibles prioritaires** :', ...p.recon.priorityTargets.map((t) => `- ${t}`), '');
    L.push('| Flux | Chemin | Données | Faiblesse |', '|---|---|---|---|');
    for (const f of p.recon.dataFlows) L.push(`| ${esc(f.id)} | ${esc(f.path)} | ${esc(f.data)} | ${esc(f.weakness)} |`);
    L.push('', '| Point d’entrée | Cible | Vecteur | P | I |', '|---|---|---|---|---|');
    for (const e of p.recon.entryPoints) L.push(`| ${esc(e.id)} | ${esc(e.target)} | ${esc(e.vector)} | ${e.likelihood} | ${e.impact} |`);
    L.push('');
  }

  L.push('## 2. L’équipe (agents)', '');
  L.push('| Agent | Rôle | Produit |', '|---|---|---|');
  for (const a of AGENTS.filter((x) => s.agents.includes(x.id))) L.push(`| ${a.name} | ${a.role} | ${a.output} |`);
  L.push(
    '',
    'Interactions : la Reconnaissance transmet la carte des surfaces d’attaque aux agents offensifs ; Attaquant et IA Adversaire agissent sur le même jumeau numérique et laissent des traces ; le Compliance Breaker confronte ces traces aux textes ; l’agent Impact consolide le tout en score de risque.',
    '',
  );

  L.push('## 3. Les scénarios', '');
  for (const [label, rep] of [
    ['Agent Attaquant — attaque cyber conventionnelle', p.attacker],
    ['Agent IA Adversaire — attaque IA / données', p.adversary],
  ] as const) {
    if (!rep) continue;
    L.push(`### ${label}`, '', rep.summary, '');
    for (const a of rep.attacks) {
      L.push(`**${a.id} — ${a.name}** (${a.category}, ${a.technique}) — ${a.detectedByArms ? '✅ détectée' : '❌ non détectée'}`);
      a.steps.forEach((st, i) => L.push(`${i + 1}. ${st}`));
      L.push(`- Résultat : ${a.result}`, `- Réaction d’ARMS : ${a.armsReaction}`, `- Point de rupture : ${a.breakingPoint}`, '');
    }
    if (rep.keyMetrics?.length) L.push(...rep.keyMetrics.map((m) => `- **${m.label}** : ${m.value}`), '');
    if (rep.centralQuestionAnswer)
      L.push(`> **${rep === p.adversary ? 'Question centrale' : 'Point de rupture critique'}** — ${rep.centralQuestionAnswer}`, '');
  }

  L.push('## 4. La réaction d’ARMS', '');
  const d = r.detection as Record<string, unknown>;
  L.push(
    `- Actions malveillantes : ${d.maliciousActions} · détectées ou bloquées : ${d.detectedOrBlocked} · non détectées : ${d.undetected}`,
    `- Alertes SIEM : ${d.siemAlerts} · WARN non transférés au SIEM : ${d.gatewayWarningsNotForwardedToSiem}`,
    `- Alertes LCB-FT : ${d.amlAlerts} (escaladées : ${d.alertsEscalated}, classées automatiquement par le LLM : ${d.alertsAutoClosedByTriage})`,
    `- Réconciliation : ${esc((d.reconciliation as Record<string, unknown>)?.note)}${(d.reconciliation as Record<string, unknown>)?.detectionDelayHours ? ` (délai ${(d.reconciliation as Record<string, unknown>).detectionDelayHours} h)` : ''}`,
    `- Disponibilité du système : ${d.systemAvailability}`,
    '',
  );

  L.push('## 5. Le problème réglementaire (gaps)', '');
  if (p.compliance) {
    L.push(p.compliance.summary, '', '| # | Texte | Article | Preuve | Sévérité |', '|---|---|---|---|---|');
    for (const v of p.compliance.violations) L.push(`| ${esc(v.id)} | ${esc(v.regulation)} | ${esc(v.article)} | ${esc(v.evidence)} | ${esc(v.severity)} |`);
    L.push('');
  }

  L.push('## 6. Impact mesuré et recommandations', '');
  if (p.risk) {
    L.push(`Formule : \`${p.risk.formula}\``, '', '| Rang | Vulnérabilité | Score | Niveau | Perte probable |', '|---|---|---|---|---|');
    for (const v of p.risk.vulnerabilities) L.push(`| ${v.rank} | ${esc(v.title)} | ${v.score} | ${v.level} | ${euro(v.financialLossEUR)} |`);
    L.push('');
  }
  if (p.impact) {
    L.push(p.impact.summary, '', '| Priorité | Action | Responsable | Horizon |', '|---|---|---|---|');
    for (const rec of p.impact.recommendations) L.push(`| ${rec.priority} | ${esc(rec.action)} | ${esc(rec.owner)} | ${esc(rec.horizon)} |`);
    L.push('');
  }

  L.push('## Annexe — métriques du jumeau numérique', '', '```json', JSON.stringify(r.metrics, null, 2), '```', '');
  return L.join('\n');
}
