import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { MAXIMO_CV, leerCvs } from '@/lib/cv-lectura';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * El lector de CV del OS: el mismo motor que usa el portal del cliente.
 *
 * Una evaluadora que carga candidatos desde el tablero de Entrevistas está
 * haciendo lo mismo que el cliente cuando manda un pedido: tiene el archivo y
 * tendría que transcribir a mano el nombre y el teléfono que ya están adentro.
 * Lo que lee vive en `lib/cv-lectura.ts`, compartido con
 * `app/api/portal/cv/route.ts`; acá cambia solo la puerta, que es la sesión del
 * OS en vez del token del cliente.
 *
 * No guarda nada: el CV se sube con el alta del candidato.
 */
export async function POST(req: Request) {
  if (hayPuerta()) {
    const clave = process.env.OS_CLAVE as string;
    const cookie = cookies().get(COOKIE)?.value;
    if (!cookie || !igual(cookie, await huella(clave))) {
      return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
    }
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el formulario.' }, { status: 400 });
  }

  const archivos = form.getAll('cv').filter((a): a is File => a instanceof File);
  if (archivos.length === 0) {
    return NextResponse.json({ error: 'No llegó ningún archivo.' }, { status: 400 });
  }
  if (archivos.length > MAXIMO_CV) {
    return NextResponse.json({ error: `De a ${MAXIMO_CV} como mucho.` }, { status: 400 });
  }

  return NextResponse.json({ leidos: await leerCvs(archivos) });
}
