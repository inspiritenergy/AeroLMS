import { NextResponse } from 'next/server';

/**
 * GET /api/health
 *
 * Liveness sonda pro orchestrátor a monitoring: odpovídá, že proces aplikace žije
 * a obsluhuje požadavky. Záměrně nesahá do databáze a nevrací žádné údaje
 * o prostředí, proto smí být dostupná bez přihlášení (viz výjimka v middleware.ts).
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(
    { status: 'ok' },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
