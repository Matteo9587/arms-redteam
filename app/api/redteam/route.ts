import { runRedTeam } from '@/lib/orchestrator';
import { SCENARIOS, type RedTeamEvent, type Scenario } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 800;

/**
 * Lance une campagne et diffuse les événements en NDJSON (un événement JSON par ligne)
 * pour l'affichage temps réel dans la console.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { scenario?: Scenario };
  const scenario: Scenario = body.scenario && SCENARIOS[body.scenario] ? body.scenario : 'full';
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (e: RedTeamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
        } catch {
          closed = true;
        }
      };
      try {
        await runRedTeam(scenario, send);
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : String(err) });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
