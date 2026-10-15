import { NextResponse } from 'next/server';
import { NORMAS_VERSION } from '@/lib/centro-acceso';
import { inquilinoQueEscribe } from '@/lib/centro-sesion';
import { patch } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * El inquilino acepta las normas de convivencia, desde la tarjeta de Inicio.
 *
 * Hasta el 15/10/2026 se aceptaban al elegir la contraseña, antes de entrar;
 * ahora se leen adentro y se aceptan adentro. Queda registrada la versión y
 * el momento, en lugar de la firma en papel. La versión no viene del
 * navegador: es la que rige en el código.
 */
export async function POST() {
  const sesion = await inquilinoQueEscribe();
  if ('error' in sesion) {
    return NextResponse.json({ ok: false, motivo: sesion.error.motivo }, { status: sesion.error.status });
  }
  await patch('inquilinos', `id=eq.${sesion.yo.id}`, {
    normas_version: NORMAS_VERSION,
    normas_aceptadas_at: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true });
}
