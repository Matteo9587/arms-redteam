import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';

/**
 * Sélection du modèle de langage.
 * - OpenRouter (défaut) : OPENROUTER_API_KEY + OPENROUTER_MODEL
 * - Ollama (local)      : LLM_PROVIDER=ollama + OLLAMA_MODEL
 * Les deux passent par le fournisseur « OpenAI-compatible » officiel de l'AI SDK.
 */
export function getModel(): { model: LanguageModel; label: string } {
  const provider = (process.env.LLM_PROVIDER ?? 'openrouter').toLowerCase();

  if (provider === 'ollama') {
    const modelId = process.env.OLLAMA_MODEL ?? 'qwen3:8b';
    const ollama = createOpenAICompatible({
      name: 'ollama',
      baseURL: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1',
    });
    return { model: ollama.chatModel(modelId), label: `ollama/${modelId}` };
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey.includes('colle-ta-cle')) {
    throw new Error(
      'OPENROUTER_API_KEY manquante : copie .env.example vers .env.local et colle ta clé OpenRouter (https://openrouter.ai/keys).',
    );
  }
  const modelId = process.env.OPENROUTER_MODEL ?? 'anthropic/claude-haiku-5.5';
  // Modèles de repli OpenRouter (paramètre `models`) : utiles avec les modèles gratuits parfois saturés.
  const fallbacks = (process.env.OPENROUTER_FALLBACK_MODELS ?? '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  const openrouter = createOpenAICompatible({
    name: 'openrouter',
    baseURL: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
    apiKey,
    headers: { 'X-Title': 'ARMS Red Team' },
    includeUsage: true,
    transformRequestBody: fallbacks.length ? (body) => ({ ...body, models: [modelId, ...fallbacks] }) : undefined,
  });
  return { model: openrouter.chatModel(modelId), label: fallbacks.length ? `${modelId} (+${fallbacks.length} repli)` : modelId };
}
