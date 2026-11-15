import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Renvoie la dernière campagne enregistrée (mode « rejouer » de la console). */
export async function GET() {
  for (const file of ['reports/latest.json', 'docs/sample-report.json']) {
    try {
      const json = await readFile(path.join(process.cwd(), file), 'utf8');
      return new Response(json, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    } catch {
      /* fichier suivant */
    }
  }
  return Response.json({ error: 'Aucune campagne enregistrée pour le moment.' }, { status: 404 });
}
