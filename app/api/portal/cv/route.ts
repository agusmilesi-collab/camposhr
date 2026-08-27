import { NextResponse } from 'next/server';
import { empresaDelToken } from '@/lib/portal-supabase';
import { esDemo } from '@/lib/portal-demo';
import { leerCvs } from '@/lib/cv-lectura';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * El lector de CV del portal del cliente.
 *
 * Lo que lee está en `lib/cv.ts`, compartido con el tablero de Entrevistas: las
 * evaluadoras cargan candidatos igual que el cliente y el motor tiene que ser
 * el mismo. Acá queda solo la puerta: quién puede pedirlo.
 */

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el formulario.' }, { status: 400 });
  }

  // El token no da acceso a nada de acá, pero sin él esto sería un lector de
  // PDF abierto a cualquiera: se exige que resuelva a un cliente.
  const token = (form.get('token') ?? '').toString().trim();
  if (!esDemo(token) && !(await empresaDelToken(token))) {
    return NextResponse.json({ error: 'No disponible.' }, { status: 404 });
  }

  const archivos = form.getAll('cv').filter((a): a is File => a instanceof File);
  if (archivos.length === 0) {
    return NextResponse.json({ error: 'No llegó ningún archivo.' }, { status: 400 });
  }

  const leidos = await leerCvs(archivos);

  return NextResponse.json({ leidos });
}
