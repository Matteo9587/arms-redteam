/**
 * Lancement de la Red Team en ligne de commande.
 *   npm run redteam                    → campagne complète (5 agents)
 *   npm run redteam -- --scenario cyber
 *   npm run redteam -- --scenario ai
 */
import { existsSync } from 'node:fs';
import { runRedTeam } from '../lib/orchestrator';
import { AGENTS, SCENARIOS, type Scenario } from '../lib/types';

for (const f of ['.env.local', '.env']) {
  if (existsSync(f)) {
    process.loadEnvFile(f);
    break;
  }
}

const arg = process.argv.indexOf('--scenario');
const scenario = (arg > -1 ? process.argv[arg + 1] : 'full') as Scenario;
if (!SCENARIOS[scenario]) {
  console.error(`Scénario inconnu "${scenario}". Valeurs possibles : cyber | ai | full`);
  process.exit(1);
}

const c = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
};
const name = (id: string) => AGENTS.find((a) => a.id === id)?.short ?? id;
const short = (v: unknown, n = 160) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

console.log(c.bold(`\n🛡  ARMS Red Team — ${SCENARIOS[scenario].title}\n`));

runRedTeam(scenario, (e) => {
  switch (e.type) {
    case 'run-start':
      console.log(c.dim(`Modèle : ${e.model} · agents : ${e.agents.join(' → ')}\n`));
      break;
    case 'agent-start':
      console.log(c.bold(c.cyan(`\n▶ [${name(e.agent)}] ${e.title} — ${e.mission}`)));
      break;
    case 'tool-call':
      console.log(`  ${c.yellow('⚙')} ${e.tool} ${c.dim(short(e.input, 120))}`);
      break;
    case 'tool-result':
      console.log(`    ${e.ok ? c.dim('↳') : c.red('✗')} ${c.dim(short(e.output))}`);
      break;
    case 'thought':
      console.log(`  ${c.dim('💭 ' + short(e.text, 220))}`);
      break;
    case 'arms-event':
      console.log(`    ${e.event.detected ? c.green('🛡 ARMS DÉTECTE') : c.red('⚠ ARMS AVEUGLE')} ${c.dim(e.event.time)} ${e.event.message}`);
      break;
    case 'agent-end':
      console.log(c.green(`  ✔ ${name(e.agent)} terminé en ${(e.durationMs / 1000).toFixed(1)} s (${e.steps} pas)`));
      break;
    case 'agent-error':
      console.log(c.red(`  ✖ ${name(e.agent)} en erreur : ${e.error}`));
      break;
    case 'run-end': {
      const risk = e.report.risk as { globalScore: number; globalLevel: string } | null;
      console.log(c.bold(`\n✅ Campagne terminée en ${e.report.durationSec} s`));
      if (risk) console.log(c.bold(c.red(`   Score de risque global : ${risk.globalScore} (${risk.globalLevel})`)));
      console.log(c.dim(`   Rapport : reports/${e.report.id}.md\n`));
      break;
    }
  }
}).catch((err) => {
  console.error(c.red(`\nErreur : ${err instanceof Error ? err.message : String(err)}`));
  process.exit(1);
});
