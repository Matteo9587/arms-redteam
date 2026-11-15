'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { AGENTS, type AgentId, type ArmsEventView, type RedTeamEvent } from '@/lib/types';

const meta = (id: AgentId) => AGENTS.find((a) => a.id === id)!;

function short(v: unknown, n = 150) {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  if (!s || s === '{}') return '';
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function pretty(v: unknown) {
  if (typeof v === 'string') {
    try {
      return JSON.stringify(JSON.parse(v), null, 2);
    } catch {
      return v;
    }
  }
  return JSON.stringify(v, null, 2);
}

function useAutoScroll(dep: number) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [dep]);
  return ref;
}

function Badge({ id }: { id: AgentId }) {
  const m = meta(id);
  return (
    <span className="badge" style={{ '--c': m.color } as CSSProperties}>
      {m.short}
    </span>
  );
}

export function AgentFeed({ events }: { events: RedTeamEvent[] }) {
  const items = events.filter((e) =>
    ['agent-start', 'thought', 'tool-call', 'tool-result', 'agent-end', 'agent-error'].includes(e.type),
  );
  const ref = useAutoScroll(items.length);
  return (
    <div className="panel">
      <div className="panel-title">
        <span>Journal des agents (temps réel)</span>
        <span className="muted small" style={{ textTransform: 'none', letterSpacing: 0 }}>
          {events.filter((e) => e.type === 'tool-call').length} appels d’outils
        </span>
      </div>
      <div className="feed" ref={ref}>
        {items.length === 0 && <div className="feed-empty">Choisis un scénario puis lance la campagne.</div>}
        {items.map((e, i) => {
          if (!('agent' in e)) return null;
          switch (e.type) {
            case 'agent-start':
              return (
                <div className="fe" key={i}>
                  <Badge id={e.agent} />
                  <div className="fe-start">
                    ▶ {e.title} : {e.mission}
                  </div>
                </div>
              );
            case 'thought':
              return (
                <div className="fe" key={i}>
                  <Badge id={e.agent} />
                  <div className="fe-thought">💭 {e.text}</div>
                </div>
              );
            case 'tool-call':
              return (
                <div className="fe" key={i}>
                  <Badge id={e.agent} />
                  <div>
                    <span className="fe-tool">⚙ {e.tool}</span> <span className="fe-input">{short(e.input)}</span>
                  </div>
                </div>
              );
            case 'tool-result':
              return (
                <div className="fe" key={i}>
                  <span />
                  <details>
                    <summary className={e.ok ? '' : 'fe-err'}>
                      {e.ok ? 'résultat' : 'erreur'} de {e.tool} : {short(e.output, 110)}
                    </summary>
                    <pre>{pretty(e.output)}</pre>
                  </details>
                </div>
              );
            case 'agent-end':
              return (
                <div className="fe" key={i}>
                  <Badge id={e.agent} />
                  <div className="fe-end">
                    ✔ Rapport soumis ({(e.durationMs / 1000).toFixed(1)} s, {e.steps} pas de raisonnement)
                  </div>
                </div>
              );
            case 'agent-error':
              return (
                <div className="fe" key={i}>
                  <Badge id={e.agent} />
                  <div className="fe-err">✖ {e.error}</div>
                </div>
              );
            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}

export function ArmsFeed({ events }: { events: ArmsEventView[] }) {
  const ref = useAutoScroll(events.length);
  const mal = events.filter((e) => e.malicious);
  const detected = mal.filter((e) => e.detected).length;
  return (
    <div className="panel">
      <div className="panel-title">
        <span>Réaction d’ARMS</span>
        <span className="arms-counters">
          <span className="counter ok">🛡 {detected} détectés</span>
          <span className="counter ko">⚠ {mal.length - detected} non détectés</span>
        </span>
      </div>
      <div className="feed" ref={ref}>
        {events.length === 0 && <div className="feed-empty">Les événements du système ciblé apparaîtront ici.</div>}
        {events.map((e) => (
          <div key={e.id} className={`ae ${!e.malicious ? 'neutral' : e.detected ? 'ok' : 'ko'}`}>
            <span>{!e.malicious ? '·' : e.detected ? '🛡' : '⚠'}</span>
            <div>
              <div className="ae-meta">
                {e.time} · {e.component} · {!e.malicious ? 'normal' : e.detected ? 'DÉTECTÉ / BLOQUÉ' : 'NON DÉTECTÉ'}
              </div>
              <div className="ae-msg">{e.message}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
