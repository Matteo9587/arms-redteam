import { generateText, hasToolCall, isStepCount, tool, ToolLoopAgent, type LanguageModel, type ModelMessage, type ToolSet } from 'ai';
import type { z } from 'zod';
import type { AgentId, RedTeamEvent } from '../types';

export type Emit = (e: RedTeamEvent) => void;

interface RunAgentOptions<S extends z.ZodType> {
  id: AgentId;
  model: LanguageModel;
  instructions: string;
  prompt: string;
  tools: ToolSet;
  reportSchema: S;
  maxSteps?: number;
  emit: Emit;
}

const SUBMIT = 'submit_report';

/** Tronque les sorties d'outils pour l'affichage temps réel. */
function preview(value: unknown, max = 1800): unknown {
  try {
    const s = JSON.stringify(value);
    if (s.length <= max) return value;
    return `${s.slice(0, max)}… (${s.length} caractères)`;
  } catch {
    return String(value);
  }
}

interface LooseToolCall {
  toolName: string;
  input: unknown;
}

function findSubmission(steps: { toolCalls: LooseToolCall[] }[]): unknown {
  for (let i = steps.length - 1; i >= 0; i--) {
    const call = [...steps[i].toolCalls].reverse().find((c) => c.toolName === SUBMIT);
    if (call) return call.input;
  }
  return undefined;
}

/**
 * Exécute un agent de la Red Team :
 *  - boucle d'outils `ToolLoopAgent` (AI SDK 7) ;
 *  - le rapport final est rendu via un outil `submit_report` sans `execute`, dont
 *    le schéma zod garantit une sortie structurée ;
 *  - au dernier pas autorisé, l'appel de `submit_report` est forcé ;
 *  - chaque appel d'outil est diffusé en temps réel via `emit`.
 */
export async function runAgent<S extends z.ZodType>(opts: RunAgentOptions<S>): Promise<{ report: z.infer<S>; steps: number }> {
  const { id, model, instructions, prompt, reportSchema, emit } = opts;
  const maxSteps = opts.maxSteps ?? 9;

  const submitTool = tool({
    description:
      'Soumet le rapport final structuré de l’agent. À appeler UNE seule fois, en dernier, quand les investigations sont terminées.',
    inputSchema: reportSchema,
  });
  const tools = { ...opts.tools, [SUBMIT]: submitTool } as ToolSet;

  const agent = new ToolLoopAgent({
    id,
    model,
    instructions,
    tools,
    temperature: 0.2,
    maxRetries: 4,
    // les outils d'un même pas s'exécutent dans l'ordre où l'agent les a demandés
    toolCallConcurrency: 1,
    stopWhen: [isStepCount(maxSteps), hasToolCall(SUBMIT)],
    prepareStep: ({ stepNumber }) =>
      stepNumber >= maxSteps - 1 ? { toolChoice: { type: 'tool', toolName: SUBMIT } as const } : {},
    onToolExecutionStart: (e) => {
      emit({ type: 'tool-call', agent: id, tool: e.toolCall.toolName, input: e.toolCall.input });
    },
    onToolExecutionEnd: (e) => {
      const ok = e.toolOutput.type === 'tool-result';
      const out = ok ? (e.toolOutput as { output: unknown }).output : String((e.toolOutput as { error: unknown }).error);
      emit({ type: 'tool-result', agent: id, tool: e.toolCall.toolName, output: preview(out), ok });
    },
    onStepEnd: (step) => {
      const text = step.text?.trim();
      if (text) emit({ type: 'thought', agent: id, text: text.slice(0, 1200) });
      const submitted = (step.toolCalls as LooseToolCall[]).find((c) => c.toolName === SUBMIT);
      if (submitted) emit({ type: 'tool-call', agent: id, tool: SUBMIT, input: '(rapport final structuré)' });
    },
  });

  const result = await agent.generate({ prompt });
  let raw = findSubmission(result.steps as unknown as { toolCalls: LooseToolCall[] }[]);
  let steps = result.steps.length;

  if (raw === undefined) {
    // Filet de sécurité : on force la soumission du rapport avec tout l'historique.
    const messages: ModelMessage[] = [
      { role: 'user', content: prompt },
      ...(result.response.messages as ModelMessage[]),
      { role: 'user', content: 'Soumets maintenant ton rapport final complet via l’outil submit_report.' },
    ];
    const forced = await generateText({
      model,
      system: instructions,
      messages,
      tools: { [SUBMIT]: submitTool },
      toolChoice: { type: 'tool', toolName: SUBMIT },
      temperature: 0.2,
      maxRetries: 4,
    });
    steps += 1;
    raw = (forced.toolCalls as LooseToolCall[]).find((c) => c.toolName === SUBMIT)?.input;
  }

  const parsed = reportSchema.safeParse(raw);
  if (!parsed.success) {
    if (raw && typeof raw === 'object') {
      // Rapport partiellement conforme : on le garde tel quel plutôt que de tout perdre.
      return { report: raw as z.infer<S>, steps };
    }
    throw new Error(`Rapport de l'agent ${id} invalide : ${parsed.error.message.slice(0, 300)}`);
  }
  return { report: parsed.data, steps };
}
