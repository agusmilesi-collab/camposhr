import { NextResponse } from 'next/server';
import {
  actividadesDelCiclo,
  aportesDeEn,
  asistentesDeLaSala,
  contarAvance,
  getAporteDe,
  listarAportes,
  marcarIngreso,
  repartirCruce,
  repartirEnsayo,
  resolverCiclo,
  resumir,
  rondasDelEnsayo,
  salaDelCruce,
  type Actividad,
  type Aporte,
  type Corrida,
} from '@/lib/ciclo';
import { firmarSelfies } from '@/lib/supabase';
import { INFO, PERFILES, type Perfil } from '@/lib/perfiles';
import { motivoEntre, type Motivo } from '@/lib/cruce';
import { CASOS, REACCIONES, type Rol } from '@/lib/ensayo';

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
  const parametros = new URL(req.url).searchParams;
  const asistenteId = parametros.get('asistente') ?? '';
  // Sólo en el primer sondeo de la sesión: escrito una vez queda escrito, y
  // repetirlo cada pocos segundos por cada teléfono es carga pura contra la
  // base en el momento en que toda la sala está mirando la pantalla.
  if (asistenteId && parametros.get('entrando') === '1') {
    await marcarIngreso(asistenteId);
  }

  // El catálogo del ciclo sale de memoria: cuál está abierta la dice la
  // corrida, que sí se acaba de leer. Así el sondeo no vuelve a pedir a la
  // base ni la actividad ni las que se abren con ella.
  const catalogo = await actividadesDelCiclo(ciclo.corrida.ciclo_id);
  const actividad =
    catalogo.find((a) => a.id === ciclo.corrida.actividad_abierta_id) ?? null;
  if (!actividad) {
    return NextResponse.json({ actividad: null, respondida: false, total: 0 });
  }

  /**
   * Las que se abren juntas viajan todas.
   *
   * La expositora abre una sola vez y el teléfono las recorre en fila. Cada
   * una guarda su respuesta por separado, así que los contadores y las placas
   * proyectadas siguen funcionando de a una.
   */
  const enFila = actividad.grupo
    ? catalogo.filter((a) => a.grupo === actividad.grupo)
    : [];

  // Todo lo que respondió esta persona en la consigna abierta, de una sola
  // consulta: es lo único que el sondeo de un teléfono necesita preguntar.
  const propios = asistenteId
    ? await aportesDeEn(
        enFila.length ? enFila.map((a) => a.id) : [actividad.id],
        asistenteId
      )
    : new Map<string, Aporte>();
  const mio = propios.get(actividad.id) ?? null;

  const grupo = enFila.length
    ? enFila.map((a) => {
        const propio = propios.get(a.id) ?? null;
        return {
          ...publica(a),
          respondida: Boolean(propio),
          mio: propio?.valor ?? null,
        };
      })
    : null;

  /*
   * Cuántos respondieron es de la expositora, no del asistente: en el teléfono
   * no se muestra en ninguna pantalla. Contarlo para los treinta teléfonos era
   * traer todas las respuestas de la sala treinta veces por minuto.
   */
  const avance =
    parametros.get('total') === '1'
      ? await contarAvance(
          ciclo.corrida.id,
          enFila.length ? enFila.map((a) => a.id) : [actividad.id]
        )
      : null;

  /*
   * Durante el ensayo la expositora mira otra cosa: cuántos observadores ya
   * contestaron, que es cuándo cerrar la ronda, y qué contestaron, que es con
   * lo que arranca la puesta en común. Los tríos no terminan todos juntos, así
   * que el reloj no sirve para decidir y este número sí.
   *
   * Va sólo con `total=1`, igual que el resto de los conteos: es de ella y en
   * el teléfono del asistente no se muestra en ninguna pantalla.
   */
  const ensayoConteo =
    parametros.get('total') === '1' && actividad.tipo === 'ensayo'
      ? resumir(actividad, await listarAportes(ciclo.corrida.id, actividad.id))
      : null;

  return NextResponse.json({
    actividad: publica(actividad),
    ensayoConteo: ensayoConteo?.tipo === 'ensayo' ? ensayoConteo : null,
    // Si ya respondió, el teléfono le muestra su respuesta y la opción de
    // corregirla, en vez de un formulario vacío que invita a responder dos veces.
    respondida: Boolean(mio),
    mio: mio?.valor ?? null,
    // Los que terminaron la consigna entera, no los que tocaron la primera.
    total: avance?.terminaron ?? 0,
    empezaron: avance?.empezaron ?? 0,
    enFila: enFila.length,
    grupo,
    cruce:
      actividad.tipo === 'cruce' && asistenteId
        ? await cruceDe(ciclo.corrida, actividad, asistenteId, mio)
        : null,
    ensayo:
      actividad.tipo === 'ensayo' && asistenteId
        ? await ensayoDe(ciclo.corrida, catalogo, actividad, asistenteId, mio)
        : null,
  });
}

/** El puesto de esta persona en esta ronda, listo para la pantalla. */
type Ensayo = {
  ronda: number;
  grupo: number;
  rol: Rol;
  caso: { titulo: string; situacion: string };
  /** Sólo para quien recibe la noticia. Los otros dos no tienen que verla. */
  reaccion: { nombre: string; instruccion: string } | null;
  con: { nombre: string; apellido: string; foto: string | null; rol: Rol }[];
  /** Lo que ya contestó, si observó y ya tocó el botón. */
  hablo: 'comunica' | 'recibe' | null;
};

async function ensayoDe(
  corrida: Corrida,
  catalogo: Actividad[],
  actividad: Actividad,
  asistenteId: string,
  yaLeido: Aporte | null
): Promise<Ensayo | null> {
  // El puesto propio ya vino con el resto del sondeo, igual que en el cruce.
  let aporte = yaLeido;

  // Se registró después de que la expositora abriera la ronda: entra ahora,
  // como segundo observador, sin tocar los tríos que ya están conversando.
  if (!aporte) {
    await repartirEnsayo(corrida, rondasDelEnsayo(catalogo));
    aporte = await getAporteDe(actividad.id, asistenteId);
  }
  if (aporte?.valor?.tipo !== 'ensayo') return null;
  const puesto = aporte.valor;

  const ronda = rondasDelEnsayo(catalogo).findIndex((r) => r.id === actividad.id);

  // Quiénes están, de memoria: esto lo pide cada teléfono en cada sondeo. Va
  // por la lista liviana y no por la del cruce, que además lee los perfiles.
  const porId = new Map(
    (await asistentesDeLaSala(corrida.id)).map((a) => [a.id, a])
  );
  const companeros = puesto.con
    .map((o) => ({ quien: porId.get(o.id), rol: o.rol }))
    .filter((c): c is { quien: NonNullable<typeof c.quien>; rol: Rol } =>
      Boolean(c.quien)
    );

  const fotos = await firmarSelfies(
    companeros.map((c) => c.quien.foto_path).filter((p): p is string => Boolean(p))
  );

  return {
    ronda: ronda < 0 ? 0 : ronda,
    grupo: puesto.grupo,
    rol: puesto.rol,
    caso: CASOS[puesto.caso] ?? CASOS[0],
    reaccion: puesto.rol === 'recibe' ? REACCIONES[puesto.reaccion] ?? null : null,
    con: companeros.map((c) => ({
      nombre: c.quien.nombre,
      apellido: c.quien.apellido,
      foto: c.quien.foto_path ? fotos.get(c.quien.foto_path) ?? null : null,
      rol: c.rol,
    })),
    hablo: puesto.hablo ?? null,
  };
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
  asistenteId: string,
  yaLeido: Aporte | null
): Promise<Cruce | null> {
  // El reparto propio ya vino con el resto del sondeo: volver a pedirlo era
  // una consulta más por teléfono cada vez.
  let aporte = yaLeido;

  // Se registró después de que la expositora abriera la consigna: se reparte
  // ahora, sin tocar los grupos que ya están conversando.
  if (!aporte) {
    await repartirCruce(corrida, actividad);
    aporte = await getAporteDe(actividad.id, asistenteId);
  }
  if (aporte?.valor?.tipo !== 'cruce') return null;

  // La sala entera, de memoria: esto lo pide cada teléfono en cada sondeo.
  const { asistentes, perfiles } = await salaDelCruce(corrida.id);
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
