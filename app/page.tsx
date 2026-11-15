'use client';

import { useMemo, useRef, useState } from 'react';
import { AgentFeed, ArmsFeed } from '@/components/Feeds';
import { Pipeline, type AgentState } from '@/components/Pipeline';
import { Results } from '@/components/Results';
import { SCENARIOS, type AgentId, type ArmsEventView, type FinalReport, type RedTeamEvent, type Scenario } from '@/lib/types';

type Status = 'idle' | 'running' | 'replay' | 'done' | 'error';
const ALL: AgentId[] = ['recon', 'attacker', 'adversary', 'compliance', 'impact'];
const SPEEDS = { '1x': 450, '2x': 220, '4x': 90 } as const;

function deriveAgents(events: RedTeamEvent[], scenario: Scenario): Record<AgentId, AgentState> {
  const planned = (events.find((e) => e.type === 'run-start') as { agents?: AgentId[] } | undefined)?.agents ?? SCENARIOS[scenario].agents;
  const st = Object.fromEntries(
    ALL.map((id) => [id, { status: planned.includes(id) ? 'pending' : 'skipped', tools: 0 } as AgentState]),
  ) as Record<AgentId, AgentState>;
  for (const e of events) {
    if (e.type === 'agent-start') st[e.agent].status = 'running';
    else if (e.type === 'tool-call') st[e.agent].tools++;
    else if (e.type === 'agent-end') {
      st[e.agent].status = 'done';
      st[e.agent].ms = e.durationMs;
    } else if (e.type === 'agent-error') {
      st[e.agent].status = 'error';
      st[e.agent].error = e.error;
    }
  }
  return st;
}

export default function Home() {
  const [scenario, setScenario] = useState<Scenario>('full');
  const [events, setEvents] = useState<RedTeamEvent[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [speed, setSpeed] = useState<keyof typeof SPEEDS>('1x');
  const abortRef = useRef<AbortController | null>(null);
  const replayToken = useRef(0);

  const busy = status === 'running' || status === 'replay';
  const push = (e: RedTeamEvent) => setEvents((prev) => [...prev, e]);

  const agentStates = useMemo(() => deriveAgents(events, scenario), [events, scenario]);
  const armsEvents = useMemo(
    () => events.filter((e): e is Extract<RedTeamEvent, { type: 'arms-event' }> => e.type === 'arms-event').map((e) => e.event as ArmsEventView),
    [events],
  );
  const final = useMemo(
    () => (events.find((e) => e.type === 'run-end') as { report?: FinalReport } | undefined)?.report,
    [events],
  );
  const model = (events.find((e) => e.type === 'run-start') as { model?: string } | undefined)?.model;
  const armsStats = {
    detected: armsEvents.filter((e) => e.malicious && e.detected).length,
    blind: armsEvents.filter((e) => e.malicious && !e.detected).length,
  };

  async function launch() {
    replayToken.current++;
    setEvents([]);
    setError(null);
    setStatus('running');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch('/api/redteam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let failed: string | null = null;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line) continue;
          const evt = JSON.parse(line) as RedTeamEvent;
          if (evt.type === 'error') failed = evt.message;
          push(evt);
        }
      }
      if (failed) {
        setError(failed);
        setStatus('error');
      } else setStatus('done');
    } catch (err) {
      if ((err as Error).name === 'AbortError') setStatus('idle');
      else {
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      }
    }
  }

  function stop() {
    abortRef.current?.abort();
    replayToken.current++;
    setStatus(final ? 'done' : 'idle');
  }

  async function replay() {
    setError(null);
    const res = await fetch('/api/reports/latest');
    if (!res.ok) {
      setError('Aucune campagne enregistrée : lance d’abord une campagne réelle.');
      return;
    }
    const report = (await res.json()) as FinalReport;
    const recorded = report.events ?? [];
    if (!recorded.length) {
      setError('La dernière campagne ne contient pas de journal à rejouer.');
      return;
    }
    const token = ++replayToken.current;
    setScenario(report.scenario);
    setEvents([]);
    setStatus('replay');
    for (const e of recorded) {
      if (replayToken.current !== token) return;
      push(e.type === 'run-end' ? { ...e, report: { ...report, events: undefined } } : e);
      const wait = e.type === 'arms-event' ? SPEEDS[speed] * 0.6 : e.type === 'tool-result' ? SPEEDS[speed] * 0.5 : SPEEDS[speed];
      await new Promise((r) => setTimeout(r, wait));
    }
    if (replayToken.current === token) setStatus('done');
  }

  return (
    <main className="app">
      <header className="header">
        <div className="brand">
          <div className="brand-logo">🛡️</div>
          <div>
            <h1>ARMS Red Team Console</h1>
            <p>Red Team agentique (5 agents IA) · exercice de résilience type TLPT · DORA · MiCA · AI Act</p>
          </div>
        </div>
        <div className="header-right">
          {model && <span className="pill">🧠 {model}</span>}
          {status === 'running' && <span className="pill live">Campagne en cours</span>}
          {status === 'replay' && <span className="pill live">Rejeu</span>}
          {status === 'done' && <span className="pill done">✔ Campagne terminée</span>}
          <span className="pill">🎯 Jumeau numérique ARMS v2.3.0-rc</span>
        </div>
      </header>

      <section className="controls">
        {(Object.keys(SCENARIOS) as Scenario[]).map((s) => (
          <button key={s} className={`scenario ${scenario === s ? 'active' : ''}`} onClick={() => setScenario(s)} disabled={busy}>
            <strong>{SCENARIOS[s].title}</strong>
            <span>{SCENARIOS[s].subtitle}</span>
          </button>
        ))}
        <div className="actions">
          {busy ? (
            <button className="btn" onClick={stop}>
              ■ Arrêter
            </button>
          ) : (
            <button className="btn primary" onClick={launch}>
              ▶ Lancer la campagne
            </button>
          )}
          <div className="replay-row">
            <button className="btn ghost" onClick={replay} disabled={busy}>
              ↻ Rejouer la dernière
            </button>
            <select className="speed" value={speed} onChange={(e) => setSpeed(e.target.value as keyof typeof SPEEDS)} aria-label="Vitesse du rejeu">
              {Object.keys(SPEEDS).map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {error && <div className="error-box">⚠ {error}</div>}

      <Pipeline states={agentStates} armsStats={armsStats} />

      <section className="feeds">
        <AgentFeed events={events} />
        <ArmsFeed events={armsEvents} />
      </section>

      {final && <Results report={final} />}

      <footer className="footer">
        Exercice pédagogique : ARMS est simulé par un jumeau numérique déterministe. Aucun système réel n’est attaqué.
      </footer>
    </main>
  );
}
