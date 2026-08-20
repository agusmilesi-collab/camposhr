import { NextResponse } from 'next/server';
import { equipo } from '@/lib/identidad';

export const runtime = 'nodejs';

/** El equipo para el selector de identidad. Son nombres y nada más. */
export async function GET() {
  return NextResponse.json({ equipo: (await equipo()).map((m) => m.nombre) });
}
