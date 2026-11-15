'use client';

import { useState } from 'react';
import type { AttackReport, ComplianceReport, ImpactReport, ReconReport } from '@/lib/agents/schemas';
import type { RiskComputation } from '@/lib/agents/scoring';
import type { FinalReport } from '@/lib/types';

type Tab = 'synthese' | 'surface' | 'attaques' | 'conformite' | 'score' | 'rapport';
const TABS: [Tab, string][] = [
  ['synthese', 'Synthèse'],
  ['surface', 'Surface d’attaque'],
  ['attaques', 'Attaques & point de rupture'],
  ['conformite', 'Non-conformités'],
  ['score', 'Score & priorités'],
  ['rapport', 'Rapport'],
];

const euro = (n: unknown) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} €`;
const pct = (n: unknown) => `${Math.round((Number(n) || 0) * 100)} %`;

function sevClass(s: string | undefined) {
  const v = (s ?? '').toLowerCase();
  if (v.startsWith('crit')) return 'critique';
  if (v.startsWith('él') || v.startsWith('el') || v.startsWith('high') || v.startsWith('haut')) return 'eleve';
  if (v.startsWith('moy') || v.startsWith('med')) return 'moyen';
  return 'faible';
}
const levelColor = (level: string) =>
  ({ critique: '#f43f5e', eleve: '#f59e0b', moyen: '#60a5fa', faible: '#22c55e' })[sevClass(level)];

function Gauge({ value, level }: { value: number; level: string }) {
  const v = Math.max(0, Math.min(1, value));
  const r = 80;
  const cx = 100;
  const cy = 95;
  const angle = Math.PI * (1 - v);
  const x = cx + r * Math.cos(angle);
  const y = cy - r * Math.sin(angle);
  const color = levelColor(level);
  return (
    <div className="gauge-wrap">
      <svg width="220" height="120" viewBox="0 0 200 110" role="img" aria-label={`Score de risque ${v}`}>
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#1f2a3c" strokeWidth="14" strokeLinecap="round" />
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${x} ${y}`} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" />
        <text x={cx} y={cy - 18} textAnchor="middle" fill="#e5e9f0" fontSize="30" fontWeight="700">
          {v.toFixed(2)}
        </text>
        <text x={cx} y={cy + 2} textAnchor="middle" fill="#8b97ab" fontSize="11">
          score global (0–1)
        </text>
      </svg>
      <div className="gauge-level" style={{ color }}>
        Risque {level}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="kpi">
      <div className="k-label">{label}</div>
      <div className="k-value" style={color ? { color } : undefined}>
        {value}
      </div>
      {sub && <div className="k-sub">{sub}</div>}
    </div>
  );
}

function AttackList({ title, rep, questionLabel }: { title: string; rep?: AttackReport; questionLabel: string }) {
  if (!rep) return null;
  return (
    <div>
      <div className="panel-title">{title}</div>
      <p className="muted" style={{ marginTop: 0 }}>
        {rep.summary}
      </p>
      {rep.attacks?.map((a) => (
        <div className="attack-card" key={a.id}>
          <h4>
            <span>
              {a.id} — {a.name}
            </span>
            <span className={`sev ${a.detectedByArms ? 'faible' : 'critique'}`}>{a.detectedByArms ? '✅ détectée' : '❌ non détectée'}</span>
          </h4>
          <div className="meta">
            {a.category} · {a.technique}
          </div>
          <ol>{a.steps?.map((s, i) => <li key={i}>{s}</li>)}</ol>
          <div className="meta">
            <b>Résultat :</b> {a.result}
          </div>
          <div className="meta">
            <b>Réaction d’ARMS :</b> {a.armsReaction}
          </div>
          <div className="breaking">💥 Point de rupture : {a.breakingPoint}</div>
        </div>
      ))}
      {rep.centralQuestionAnswer && (
        <div className="quote">
          <b>{questionLabel} :</b> {rep.centralQuestionAnswer}
        </div>
      )}
    </div>
  );
}

export function Results({ report }: { report: FinalReport }) {
  const [tab, setTab] = useState<Tab>('synthese');
  const recon = report.reports.recon as ReconReport | undefined;
  const attacker = report.reports.attacker as AttackReport | undefined;
  const adversary = report.reports.adversary as AttackReport | undefined;
  const compliance = report.reports.compliance as ComplianceReport | undefined;
  const impact = report.reports.impact as ImpactReport | undefined;
  const risk = report.risk as RiskComputation | null;
  const m = (report.metrics ?? {}) as Record<string, any>;
  const d = (report.detection ?? {}) as Record<string, any>;
  const globalScore = risk?.globalScore ?? impact?.globalRiskScore ?? 0;
  const globalLevel = risk?.globalLevel ?? impact?.globalRiskLevel ?? '—';
  const vulns = risk?.vulnerabilities ?? impact?.vulnerabilities ?? [];

  function download() {
    const blob = new Blob([report.markdown], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rapport-redteam-${report.id}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="panel results">
      <div className="tabs">
        {TABS.map(([id, label]) => (
          <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'synthese' && (
        <div>
          <div className="grid-3">
            <div className="kpi" style={{ display: 'grid', placeItems: 'center' }}>
              <Gauge value={globalScore} level={globalLevel} />
              <div className="muted small" style={{ marginTop: 6 }}>
                Perte probable cumulée : <b style={{ color: '#e5e9f0' }}>{euro(risk?.totalEstimatedLossEUR)}</b>
              </div>
            </div>
            <div className="kpis">
              <Kpi label="Actions malveillantes non détectées" value={`${d.undetected ?? 0} / ${d.maliciousActions ?? 0}`} sub={`${d.siemAlerts ?? 0} alerte SIEM`} color="#fda4af" />
              <Kpi label="Crédits frauduleux (rejeu + signature forgée)" value={euro((m.duplicatedCreditsEUR ?? 0) + (m.forgedCreditsEUR ?? 0))} sub={`dont exfiltré : ${euro(m.exfiltratedEUR)}`} />
              <Kpi label="Contournements du seuil R1" value={String(m.r1Bypass ?? 0)} sub={`règle du voyage falsifiée acceptée : ${m.travelRuleForgedPassed ?? 0}`} />
              <Kpi label="Délai de détection" value={m.hoursUndetected != null ? `${m.hoursUndetected} h` : m.poisonedLabels ? 'jamais' : '—'} sub="réconciliation de fin de journée" color="#fcd34d" />
              <Kpi label="Détection de la structuration" value={`${pct(m.structuringDetection?.initial)} → ${pct(m.structuringDetection?.now)}`} sub="après empoisonnement du modèle" color="#d8b4fe" />
              <Kpi label="Alertes classées par injection de prompt" value={String(m.alertsAutoClosedViaInjection ?? 0)} sub={`${m.poisonedLabels ?? 0} labels empoisonnés`} />
              <Kpi label="Non-conformités qualifiées" value={String(compliance?.violations?.length ?? 0)} sub="DORA · MiCA · AI Act · RGPD · LCB-FT" />
              <Kpi label="Disponibilité d’ARMS" value={m.systemAvailability ?? '100 %'} sub="aucun arrêt : attaque silencieuse" color="#86efac" />
            </div>
          </div>
          {impact?.summary && (
            <div className="quote" style={{ borderLeftColor: '#10b981', background: 'rgba(16,185,129,0.08)' }}>
              <b style={{ color: '#6ee7b7' }}>Synthèse pour le COMEX :</b> {impact.summary}
            </div>
          )}
          {adversary?.centralQuestionAnswer && (
            <div className="quote">
              <b>Peut-on manipuler l’IA sans arrêter le système ?</b> {adversary.centralQuestionAnswer}
            </div>
          )}
          {Object.keys(report.errors ?? {}).length > 0 && (
            <div className="error-box" style={{ marginTop: 12 }}>
              Agents en erreur : {Object.entries(report.errors).map(([k, v]) => `${k} (${v})`).join(' ; ')}
            </div>
          )}
        </div>
      )}

      {tab === 'surface' && recon && (
        <div>
          <p className="muted" style={{ marginTop: 0 }}>
            {recon.summary}
          </p>
          <div className="grid-2">
            <div>
              <div className="panel-title">Points d’entrée</div>
              <table className="t">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Cible</th>
                    <th>Vecteur</th>
                    <th>P</th>
                    <th>I</th>
                  </tr>
                </thead>
                <tbody>
                  {recon.entryPoints?.map((e) => (
                    <tr key={e.id}>
                      <td>{e.id}</td>
                      <td>{e.target}</td>
                      <td>{e.vector}</td>
                      <td>{e.likelihood}</td>
                      <td>{e.impact}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <div className="panel-title">Flux de données</div>
              <table className="t">
                <thead>
                  <tr>
                    <th>Flux</th>
                    <th>Chemin</th>
                    <th>Faiblesse</th>
                  </tr>
                </thead>
                <tbody>
                  {recon.dataFlows?.map((f) => (
                    <tr key={f.id + f.path}>
                      <td>{f.id}</td>
                      <td>{f.path}</td>
                      <td>{f.weakness}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="panel-title" style={{ marginTop: 14 }}>
                Dépendances critiques
              </div>
              <table className="t">
                <tbody>
                  {recon.criticalDependencies?.map((c) => (
                    <tr key={c.name}>
                      <td>
                        <b>{c.name}</b>
                        <div className="muted small">{c.type}</div>
                      </td>
                      <td>
                        <span className={`sev ${sevClass(c.criticality)}`}>{c.criticality}</span>
                      </td>
                      <td>{c.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'attaques' && (
        <div className={attacker && adversary ? 'grid-2' : ''}>
          <AttackList title="Agent Attaquant — attaque cyber conventionnelle" rep={attacker} questionLabel="Point de rupture critique" />
          <AttackList title="Agent IA Adversaire — attaque IA / données" rep={adversary} questionLabel="Question centrale" />
        </div>
      )}

      {tab === 'conformite' && compliance && (
        <div>
          <p className="muted" style={{ marginTop: 0 }}>
            {compliance.summary}
          </p>
          <table className="t">
            <thead>
              <tr>
                <th>#</th>
                <th>Texte</th>
                <th>Article</th>
                <th>Exigence</th>
                <th>Preuve observée</th>
                <th>Sévérité</th>
                <th>Remédiation</th>
              </tr>
            </thead>
            <tbody>
              {compliance.violations?.map((v) => (
                <tr key={v.id}>
                  <td>{v.id}</td>
                  <td>
                    <b>{v.regulation}</b>
                  </td>
                  <td className="small">{v.article}</td>
                  <td>{v.requirement}</td>
                  <td>{v.evidence}</td>
                  <td>
                    <span className={`sev ${sevClass(v.severity)}`}>{v.severity}</span>
                  </td>
                  <td>{v.remediation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'score' && (
        <div className="grid-2">
          <div>
            <div className="panel-title">Hiérarchisation des vulnérabilités</div>
            {vulns.map((v) => (
              <div className="bar-row" key={v.id}>
                <div className="bar-rank">#{v.rank}</div>
                <div>
                  <div className="bar-title">{v.title}</div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${Math.round(v.score * 100)}%`, background: levelColor(v.level) }} />
                  </div>
                </div>
                <div className="bar-meta">
                  <span>{v.score.toFixed(2)}</span>
                  <span className={`sev ${sevClass(v.level)}`}>{v.level}</span>
                  <span>{euro(v.financialLossEUR)}</span>
                </div>
              </div>
            ))}
            {risk && <p className="muted small">Formule : {risk.formula}</p>}
          </div>
          <div>
            <div className="panel-title">Recommandations priorisées</div>
            <table className="t">
              <thead>
                <tr>
                  <th>P</th>
                  <th>Action</th>
                  <th>Responsable</th>
                  <th>Horizon</th>
                </tr>
              </thead>
              <tbody>
                {impact?.recommendations?.map((r) => (
                  <tr key={r.priority + r.action}>
                    <td>{r.priority}</td>
                    <td>{r.action}</td>
                    <td>{r.owner}</td>
                    <td>{r.horizon}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'rapport' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span className="muted small">
              Campagne {report.id} · modèle {report.model} · {report.durationSec} s
            </span>
            <button className="btn" onClick={download}>
              ⬇ Télécharger le rapport (.md)
            </button>
          </div>
          <div className="md">{report.markdown}</div>
        </div>
      )}
    </div>
  );
}
