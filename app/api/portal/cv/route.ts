import { NextResponse } from 'next/server';
import { empresaDelToken } from '@/lib/portal-supabase';
import { esDemo } from '@/lib/portal-demo';
import { leerCvs } from '@/lib/cv-lectura';
import { traerEntrante } from '@/lib/entrantes';
import { registrarError } from '@/lib/portal-errores';

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
  const empresa = esDemo(token) ? null : await empresaDelToken(token);
  if (!esDemo(token) && !empresa) {
    return NextResponse.json({ error: 'No disponible.' }, { status: 404 });
  }

  // Lo normal es que lleguen las rutas de lo que el navegador ya subió al
  // bucket (`lib/entrantes.ts`): el archivo no pasa por acá. Los archivos
  // sueltos quedan para un formulario abierto desde antes del cambio.
  const rutas = form.getAll('ruta').map(String);
  const nombres = form.getAll('nombre').map(String);
  const archivos = rutas.length
    ? await Promise.all(rutas.map((r, i) => traerEntrante(r, nombres[i] ?? '')))
    : form.getAll('cv').filter((a): a is File => a instanceof File);
  if (archivos.length === 0) {
    return NextResponse.json({ error: 'No llegó ningún archivo.' }, { status: 400 });
  }
  const perdidos = archivos.filter((a) => !a).length;
  if (perdidos > 0) {
    await registrarError({
      empresaId: empresa?.id ?? null,
      paso: 'lectura',
      motivo: `El lector no encontró ${perdidos} de los ${archivos.length} CV subidos.`,
      detalle: { rutas, nombres },
    });
  }

  // Uno que no se encontró vuelve vacío, en su lugar: el orden tiene que
  // coincidir con el de los archivos que eligió el cliente.
  const leidos = await leerCvs(archivos.filter((a): a is File => Boolean(a)));
  let k = 0;
  const enOrden = archivos.map((a) =>
    a ? leidos[k++] : { nombre: '', mail: '', telefono: '', archivo: '' }
  );

  return NextResponse.json({ leidos: enOrden });
}
