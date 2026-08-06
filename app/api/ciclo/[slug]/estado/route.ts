import { NextResponse } from 'next/server';
import {
  getActividadAbierta,
  getAporteDe,
  listarAportes,
  listarAsistentes,
  marcarIngreso,
  repartirCruce,
  resolverCiclo,
  type Actividad,
  type Corrida,
} from '@/lib/ciclo';
import { firmarSelfies, perfilesDeCorrida } from '@/lib/supabase';
import { INFO, PERFILES, type Perfil } from '@/lib/perfiles';
import { motivoEntre, type Motivo } from '@/lib/cruce';

/**
 * Qué actividad está abierta en este momento.
 *
 * Lo consulta el teléfono de cada persona cada pocos segundos. Es la única vía
 * por la que el asistente se entera de que hay algo para responder: no hay menú
 * ni lista, justo para que nadie se adelante ni se pierda.
 *
 * Devuelve el enunciado y las opciones, nunca las respuestas de los demás. Lo
 * que responde el grupo se ve proyectado, no en el teléfono.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function publica(a: Actividad) {
  return {
    id: a.id,
    clave: a.clave,
    tipo: a.tipo,
    titulo: a.titulo,
    enunciado: a.enunciado,
    opciones: a.opciones,
  };
}

export async function GET(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const ciclo = await resolverCiclo(params.slug);
  if (!ciclo) return new NextResponse('Ciclo no encontrado', { status: 404 });

  // Este sondeo es la señal de que alguien está adentro con ese nombre: el
  // teléfono lo repite mientras la pantalla esté abierta. Con eso alcanza para
  // sacar su cara de la grilla de los demás, sin un endpoint aparte.
  const asistenteId = new URL(req.url).searchParams.get('asistente') ?? '';
  if (asistenteId) await marcarIngreso(asistenteId);

  const actividad = await getActividadAbierta(ciclo.corrida);
  if (!actividad) {
    return NextResponse.json({ actividad: null, respondida: false, total: 0 });
  }
  const [mio, todos] = await Promise.all([
    asistenteId ? getAporteDe(actividad.id, asistenteId) : Promise.resolve(null),
    listarAportes(ciclo.corrida.id, actividad.id),
  ]);

  return NextResponse.json({
    actividad: publica(actividad),
    // Si ya respondió, el teléfono le muestra su respuesta y la opción de
    // corregirla, en vez de un formulario vacío que invita a responder dos veces.
    respondida: Boolean(mio),
    mio: mio?.valor ?? null,
    total: todos.length,
    cruce:
      actividad.tipo === 'cruce' && asistenteId
        ? await cruceDe(ciclo.corrida, actividad, asistenteId)
        : null,
  });
}

/** Con quién le toca juntarse a esta persona, con lo que necesita para ubicarla. */
type Cruce = {
  /** El cuadrante propio, para que la pantalla lo diga sin que tenga que recordarlo. */
  miPerfil: { corto: Perfil; nombre: string } | null;
  con: {
    nombre: string;
    apellido: string;
    foto: string | null;
    perfil: { corto: Perfil; nombre: string; descripcion: string } | null;
    motivo: Motivo;
  }[];
};

async function cruceDe(
  corrida: Corrida,
  actividad: Actividad,
  asistenteId: string
): Promise<Cruce | null> {
  let aporte = await getAporteDe(actividad.id, asistenteId);

  // Se registró después de que la expositora abriera la consigna: se reparte
  // ahora, sin tocar los grupos que ya están conversando.
  if (!aporte) {
    await repartirCruce(corrida, actividad);
    aporte = await getAporteDe(actividad.id, asistenteId);
  }
  if (aporte?.valor?.tipo !== 'cruce') return null;

  const [asistentes, perfiles] = await Promise.all([
    listarAsistentes(corrida.id),
    perfilesDeCorrida(corrida.id),
  ]);
  const porId = new Map(asistentes.map((a) => [a.id, a]));
  const perfilDe = (id: string): Perfil | null => {
    const p = perfiles.get(id);
    return PERFILES.includes(p as Perfil) ? (p as Perfil) : null;
  };

  const mio = perfilDe(asistenteId);
  const pares = aporte.valor.conIds
    .map((id) => porId.get(id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  // La cara del compañero es lo que resuelve el problema real de la consigna:
  // encontrar a alguien por su nombre entre treinta personas paradas.
  const fotos = await firmarSelfies(
    pares.map((p) => p.foto_path).filter((p): p is string => Boolean(p))
  );

  return {
    miPerfil: mio ? { corto: mio, nombre: INFO[mio].nombre } : null,
    con: pares.map((p) => {
      const suyo = perfilDe(p.id);
      return {
        nombre: p.nombre,
        apellido: p.apellido,
        foto: p.foto_path ? fotos.get(p.foto_path) ?? null : null,
        perfil: suyo
          ? { corto: suyo, nombre: INFO[suyo].nombre, descripcion: INFO[suyo].descripcion }
          : null,
        motivo: motivoEntre(mio, suyo),
      };
    }),
  };
}
