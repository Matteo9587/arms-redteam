/**
 * Test rapide (1 requête) : vérifie la clé, le modèle et l'appel d'outils.
 *   npm run smoke
 */
import { existsSync } from 'node:fs';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { getModel } from '../lib/agents/model';

for (const f of ['.env.local', '.env']) {
  if (existsSync(f)) {
    process.loadEnvFile(f);
    break;
  }
}

async function main() {
const { model, label } = getModel();
console.log(`Modèle : ${label}`);
const t0 = Date.now();
const res = await generateText({
  model,
  prompt: 'Appelle l’outil ping avec le message "ARMS".',
  tools: {
    ping: tool({
      description: 'Outil de test',
      inputSchema: z.object({ message: z.string() }),
    }),
  },
  toolChoice: { type: 'tool', toolName: 'ping' },
  maxRetries: 2,
});
const call = res.toolCalls[0];
console.log(call ? `✅ Appel d'outils OK : ping(${JSON.stringify(call.input)})` : `❌ Pas d'appel d'outil. Réponse : ${res.text}`);
console.log(`Modèle effectivement servi : ${res.response.modelId ?? '?'} · ${Date.now() - t0} ms · tokens ${res.usage.inputTokens ?? '?'}→${res.usage.outputTokens ?? '?'}`);
}

main().catch((err) => {
  console.error(`❌ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
