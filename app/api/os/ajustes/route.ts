import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { CACHE_PSICOTECNICOS } from '@/lib/etiquetas';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { anotarAcceso } from '@/lib/accesos';
import { quienSoy } from '@/lib/identidad';
import { rangosValidos } from '@/lib/raven';
import { pesosValidos } from '@/lib/competencias';
import { textosValidos } from '@/lib/redacciones';

export const runtime = 'nodejs';

/** Por qué se rechazó, dicho en los términos de la pantalla que lo mandó. */
const MOTIVO = {
  raven_rangos:
    'Los cortes tienen que ser cinco números enteros de 0 a 36, y cada rango tiene que empezar más arriba que el de abajo.',
  competencias_pesos:
    'Los pesos tienen que ser números enteros de 0 a 5, y ninguna competencia puede quedar con todos sus indicadores en cero.',
  redacciones_textos:
    'Cada texto tiene que ser de una lectura que exista y de hasta 1200 caracteres, y ninguna lectura puede quedarse sin lo que dice.',
};
export const dynamic = 'force-dynamic';

/**
 * Guarda lo que se movió desde Sistema.
 *
 * **Lo que llega se valida acá, no en la pantalla.** Un baremo con dos rangos
 * que se cruzan deja puntajes que caen en dos y otros que no caen en ninguno, y
 * eso rompería todos los informes a la vez: la pantalla puede ayudar, pero la
 * que no puede dejar pasar es la ruta.
 *
 * **Guardar lo de fábrica borra la clave.** Así "volver a lo de siempre" no
 * congela los valores del día que se apretó el botón: si mañana cambian en el
 * código, el que no tocó nada los recibe.
 */
export async function POST(req: Request) {
  if (hayPuerta()) {
    const clave = process.env.OS_CLAVE as string;
    const cookie = cookies().get(COOKIE)?.value;
    if (!cookie || !igual(cookie, await huella(clave))) {
      return NextResponse.json({ ok: false, motivo: 'Sin sesión.' }, { status: 401 });
    }
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    return NextResponse.json({ ok: false, motivo: 'Falta la configuración.' }, { status: 500 });
  }

  const datos = await req.json().catch(() => null);
  const clave = datos?.clave;
  const valor = datos?.valor;

  const CLAVES = ['raven_rangos', 'competencias_pesos', 'redacciones_textos'];
  if (!CLAVES.includes(clave)) {
    return NextResponse.json({ ok: false, motivo: 'Ajuste desconocido.' }, { status: 400 });
  }

  const cabeceras = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  const yo = await quienSoy();

  // Volver a lo de fábrica es borrar la fila, no guardar los valores del código.
  if (valor === null) {
    await fetch(`${url}/rest/v1/ajustes?clave=eq.${clave}`, {
      method: 'DELETE',
      headers: cabeceras,
      cache: 'no-store',
    });
    await anotarAcceso({
      quien: yo.nombre,
      accion: 'escritura',
      recurso: 'ajuste',
      recursoId: clave,
      detalle: { vuelve: 'a los valores de fábrica' },
    });
    revalidateTag(CACHE_PSICOTECNICOS);
    return NextResponse.json({ ok: true });
  }

  const limpios =
    clave === 'raven_rangos'
      ? rangosValidos(valor)
      : clave === 'competencias_pesos'
        ? pesosValidos(valor)
        : textosValidos(valor);
  if (!limpios) {
    return NextResponse.json(
      {
        ok: false,
        motivo: MOTIVO[clave as keyof typeof MOTIVO],
      },
      { status: 400 }
    );
  }

  const res = await fetch(`${url}/rest/v1/ajustes?on_conflict=clave`, {
    method: 'POST',
    headers: { ...cabeceras, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ clave, valor: limpios, quien: yo.nombre }),
    cache: 'no-store',
  });
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, motivo: `No se pudo guardar (${res.status}).` },
      { status: 400 }
    );
  }

  await anotarAcceso({
    quien: yo.nombre,
    accion: 'escritura',
    recurso: 'ajuste',
    recursoId: clave,
    detalle: Array.isArray(limpios)
      ? { cortes: limpios.map((r) => `${r.numeral}:${r.desde}`).join(' ') }
      : { cambiadas: Object.keys(limpios).join(' ') },
  });
  revalidateTag(CACHE_PSICOTECNICOS);
  return NextResponse.json({ ok: true });
}
