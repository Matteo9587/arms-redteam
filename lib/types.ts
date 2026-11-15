/** Types partagés entre le serveur (orchestrateur) et l'interface. Aucun import serveur ici. */

export type AgentId = 'recon' | 'attacker' | 'adversary' | 'compliance' | 'impact';
export type Scenario = 'cyber' | 'ai' | 'full';

export interface ArmsEventView {
  id: number;
  time: string;
  component: string;
  level: 'info' | 'warn' | 'alert' | 'critical';
  message: string;
  detected: boolean;
  malicious: boolean;
}

export type RedTeamEvent =
  | { type: 'run-start'; scenario: Scenario; model: string; agents: AgentId[]; startedAt: string }
  | { type: 'agent-start'; agent: AgentId; title: string; mission: string }
  | { type: 'thought'; agent: AgentId; text: string }
  | { type: 'tool-call'; agent: AgentId; tool: string; input: unknown }
  | { type: 'tool-result'; agent: AgentId; tool: string; output: unknown; ok: boolean }
  | { type: 'arms-event'; event: ArmsEventView }
  | { type: 'agent-end'; agent: AgentId; report: unknown; durationMs: number; steps: number }
  | { type: 'agent-error'; agent: AgentId; error: string }
  | { type: 'run-end'; report: FinalReport }
  | { type: 'error'; message: string };

export interface AgentMeta {
  id: AgentId;
  name: string;
  short: string;
  role: string;
  output: string;
  color: string;
}

export const AGENTS: AgentMeta[] = [
  {
    id: 'recon',
    name: 'Reconnaissance',
    short: 'RECON',
    role: 'Cartographie dépendances critiques, flux de données et vecteurs d’entrée',
    output: 'Carte des surfaces d’attaque',
    color: '#3b82f6',
  },
  {
    id: 'attacker',
    name: 'Attaquant',
    short: 'ATK',
    role: 'Simule des attaques cyber à forte probabilité (webhooks, flux de prix, contournement LCB-FT)',
    output: 'Journal d’attaques + réaction ARMS',
    color: '#ef4444',
  },
  {
    id: 'adversary',
    name: 'IA Adversaire',
    short: 'ADV-IA',
    role: 'Évasion, injection de prompt et empoisonnement de la boucle de feedback du modèle',
    output: 'Dégradation mesurée du modèle',
    color: '#a855f7',
  },
  {
    id: 'compliance',
    name: 'Compliance Breaker',
    short: 'COMPL',
    role: 'Qualifie les infractions DORA, MiCA, AI Act, RGPD, LCB-FT avec preuves',
    output: 'Registre des non-conformités',
    color: '#f59e0b',
  },
  {
    id: 'impact',
    name: 'Impact & Risk Scoring',
    short: 'SCORE',
    role: 'Chiffre pertes, risque réglementaire et réputationnel, hiérarchise',
    output: 'Score 0–1 + priorisation',
    color: '#10b981',
  },
];

export const SCENARIOS: Record<Scenario, { title: string; subtitle: string; agents: AgentId[] }> = {
  cyber: {
    title: 'Scénario 1 — Attaque cyber conventionnelle',
    subtitle: 'Rejeu de webhooks crypto, signature forgée, manipulation du flux de prix, contournement du seuil R1',
    agents: ['recon', 'attacker', 'compliance', 'impact'],
  },
  ai: {
    title: 'Scénario 2 — Attaque IA / données',
    subtitle: 'Évasion du modèle, injection de prompt dans le triage LLM, empoisonnement de la boucle de feedback',
    agents: ['recon', 'adversary', 'compliance', 'impact'],
  },
  full: {
    title: 'Campagne complète (5 agents)',
    subtitle: 'Les deux scénarios enchaînés sur le même jumeau numérique',
    agents: ['recon', 'attacker', 'adversary', 'compliance', 'impact'],
  },
};

export interface FinalReport {
  id: string;
  scenario: Scenario;
  model: string;
  startedAt: string;
  finishedAt: string;
  durationSec: number;
  reports: Partial<Record<AgentId, unknown>>;
  errors: Partial<Record<AgentId, string>>;
  detection: unknown;
  incident: unknown;
  metrics: unknown;
  risk: unknown;
  armsEvents: ArmsEventView[];
  markdown: string;
  events?: RedTeamEvent[];
}
