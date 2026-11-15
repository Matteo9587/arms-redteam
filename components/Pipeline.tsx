import type { CSSProperties } from 'react';
import { AGENTS, type AgentId } from '@/lib/types';

export type AgentStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped';
export interface AgentState {
  status: AgentStatus;
  tools: number;
  ms?: number;
  error?: string;
}

const LABEL: Record<AgentStatus, string> = {
  pending: 'en attente',
  running: 'en cours',
  done: 'terminé',
  error: 'erreur',
  skipped: 'non mobilisé',
};

function Node({ id, state }: { id: AgentId; state: AgentState }) {
  const meta = AGENTS.find((a) => a.id === id)!;
  return (
    <div className={`agent-node ${state.status}`} style={{ '--c': meta.color } as CSSProperties}>
      <div className="an-head">
        <span className="an-name">{meta.name}</span>
        <span className={`status-tag ${state.status}`}>{LABEL[state.status]}</span>
      </div>
      <div className="an-role">{meta.output}</div>
      <div className="an-stats">
        {state.tools} appel{state.tools > 1 ? 's' : ''} d’outils
        {state.ms ? ` · ${(state.ms / 1000).toFixed(1)} s` : ''}
      </div>
    </div>
  );
}

export function Pipeline({ states, armsStats }: { states: Record<AgentId, AgentState>; armsStats: { detected: number; blind: number } }) {
  return (
    <div className="panel">
      <div className="panel-title">
        <span>Architecture de la Red Team — orchestration des 5 agents</span>
        <span className="muted small" style={{ textTransform: 'none', letterSpacing: 0 }}>
          Vercel AI SDK · ToolLoopAgent
        </span>
      </div>
      <div className="pipeline">
        <div className="pipe-col">
          <Node id="recon" state={states.recon} />
        </div>
        <div className="arrow">→</div>
        <div className="pipe-col">
          <Node id="attacker" state={states.attacker} />
          <Node id="adversary" state={states.adversary} />
        </div>
        <div className="arrow">→</div>
        <div className="pipe-col">
          <Node id="compliance" state={states.compliance} />
        </div>
        <div className="arrow">→</div>
        <div className="pipe-col">
          <Node id="impact" state={states.impact} />
        </div>
      </div>
      <div className="twin">
        <span>
          🎯 Cible : <b>jumeau numérique d’ARMS</b> (passerelle, connecteur crypto, modèle LCB-FT, triage LLM, boucle de feedback,
          SIEM)
        </span>
        <span>
          Réaction d’ARMS : <b style={{ color: '#86efac' }}>{armsStats.detected} détectés</b> ·{' '}
          <b style={{ color: '#fda4af' }}>{armsStats.blind} non détectés</b>
        </span>
      </div>
    </div>
  );
}
