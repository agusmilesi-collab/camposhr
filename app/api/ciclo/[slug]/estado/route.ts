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
  frasesDeLaSala,
  repartirFrases,
  salaDelCruce,
  type Actividad,
  type Aporte,
  type Corrida,
} from '@/lib/ciclo';
import { firmarSelfies } from '@/lib/supabase';
import { INFO, PERFILES, type Perfil } from '@/lib/perfiles';
import { motivoEntre, type Motivo } from '@/lib/cruce';
import { CASOS, REACCIONES, type Rol } from '@/lib/ensayo';
import {
  COLORES,
  CONSIGNA,
  DEL_EJERCICIO,
  FILAS,
  NOMBRE_DE_MITAD,
  direccionDe,
  type Direccion,
  type Mitad,
} from '@/lib/frases';

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

/**
 * Consignas que necesitan a la vista algo que la persona escribió antes.
 *
 * Se indexa por grupo o por clave suelta. Las tres del conflicto preguntan por
 * "el que pensaste al principio" y el cierre pide desarmar esa misma tensión;
 * entre la placa 2 y la 27 pasa más de una hora, así que sin tenerlo delante
 * media sala contesta sobre otra cosa.
 *
 * La clave apuntada tiene que ser de tipo texto y de la misma charla, para que
 * su id ya esté en el catálogo que se sirve de memoria.
 */
const RECUERDAN: Record<string, string> = {
  'c5-conflicto': 'c5-tension',
  'c5-desarmar': 'c5-tension',
};

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

  /*
   * Lo que esa persona escribió antes, cuando la consigna abierta lo necesita a
   * la vista. Las tres del conflicto preguntan por "el que pensaste al
   * principio" y a esa altura pasó más de una hora de charla.
   *
   * Viaja con su id sumado al mismo in.(...) que ya trae los aportes del grupo,
   * así que el sondeo sigue costando dos consultas.
   */
  const recuerda = RECUERDAN[actividad.grupo ?? ''] ?? RECUERDAN[actividad.clave];
  const deAntes =
    recuerda && recuerda !== actividad.clave
      ? catalogo.find((a) => a.clave === recuerda)
      : undefined;

  // Todo lo que respondió esta persona en la consigna abierta, de una sola
  // consulta: es lo único que el sondeo de un teléfono necesita preguntar.
  const pedidos = enFila.length ? enFila.map((a) => a.id) : [actividad.id];
  const propios = asistenteId
    ? await aportesDeEn(
        deAntes ? [...pedidos, deAntes.id] : pedidos,
        asistenteId
      )
    : new Map<string, Aporte>();
  const mio = propios.get(actividad.id) ?? null;

  const antes = deAntes ? propios.get(deAntes.id)?.valor : undefined;

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

  /*
   * En el ejercicio de las frases mira otra cosa: cuántos equipos tienen las
   * dos mitades listas, que es cuándo pedir que se lean. Sale de la lectura
   * que ya está en memoria para todos, así que no cuesta una consulta más.
   */
  const frasesConteo =
    parametros.get('total') === '1' && actividad.tipo === 'frases'
      ? resumir(
          actividad,
          await frasesDeLaSala(ciclo.corrida.id, actividad.id)
        )
      : null;

  return NextResponse.json({
    actividad: publica(actividad),
    // En qué momento de la actividad está la sala. Lo mueve el panel.
    fase: ciclo.corrida.fase ?? 0,
    ensayoConteo: ensayoConteo?.tipo === 'ensayo' ? ensayoConteo : null,
    frasesConteo: frasesConteo?.tipo === 'frases' ? frasesConteo : null,
    // Si ya respondió, el teléfono le muestra su respuesta y la opción de
    // corregirla, en vez de un formulario vacío que invita a responder dos veces.
    respondida: Boolean(mio),
    mio: mio?.valor ?? null,
    // Los que terminaron la consigna entera, no los que tocaron la primera.
    total: avance?.terminaron ?? 0,
    empezaron: avance?.empezaron ?? 0,
    enFila: enFila.length,
    grupo,
    // Lo que escribió al abrir la charla, para tenerlo a la vista mientras
    // contesta sobre eso mismo.
    antes: antes?.tipo === 'texto' ? antes.texto : null,
    cruce:
      actividad.tipo === 'cruce' && asistenteId
        ? await cruceDe(ciclo.corrida, actividad, asistenteId, mio)
        : null,
    ensayo:
      actividad.tipo === 'ensayo' && asistenteId
        ? await ensayoDe(ciclo.corrida, catalogo, actividad, asistenteId, mio)
        : null,
    frases:
      actividad.tipo === 'frases' && asistenteId
        ? await frasesDe(ciclo.corrida, actividad, asistenteId, mio)
        : null,
  });
}

/** El equipo de esta persona en el ejercicio de las frases, listo para la pantalla. */
type Frases = {
  /** Cómo se llama el equipo en voz alta: "Equipo Rojo". */
  color: string;
  mitad: Mitad;
  nombreDeMitad: string;
  nombreDeEnfrente: string;
  /**
   * Una por frase: a dónde hay que llegar, qué frase les tocó y de qué partió
   * la mitad de enfrente. Va por frase y no por mitad porque cada una hace las
   * dos direcciones, dos frases de cada una.
   */
  frases: {
    direccion: Direccion;
    consigna: { de: string; a: string; como: string };
    parte: string;
    /** De dónde partió la mitad de enfrente. Es la respuesta que buscaban. */
    partioEnfrente: string;
  }[];
  escribe: boolean;
  con: { nombre: string; apellido: string; foto: string | null; escribe: boolean }[];
  enfrente: { nombre: string; apellido: string; foto: string | null; escribe: boolean }[];
  /** Lo que ya escribió su mitad, y lo que escribió la de enfrente. */
  mias: string[] | null;
  suyas: string[] | null;
};

async function frasesDe(
  corrida: Corrida,
  actividad: Actividad,
  asistenteId: string,
  yaLeido: Aporte | null
): Promise<Frases | null> {
  // El puesto propio ya vino con el resto del sondeo, igual que en el ensayo.
  let aporte = yaLeido;

  // Se registró después de que la expositora abriera el ejercicio: entra ahora,
  // en el equipo más chico, sin tocar a los que ya están trabajando.
  if (!aporte) {
    await repartirFrases(corrida, actividad);
    aporte = await getAporteDe(actividad.id, asistenteId);
  }
  if (aporte?.valor?.tipo !== 'frases') return null;
  const puesto = aporte.valor;

  // Quiénes están, de memoria, y los puestos del ejercicio también: sin esto
  // la lectura cruzada costaría dos consultas por teléfono y por sondeo.
  const [porId, todos] = await Promise.all([
    asistentesDeLaSala(corrida.id).then((as) => new Map(as.map((a) => [a.id, a]))),
    frasesDeLaSala(corrida.id, actividad.id),
  ]);

  const otraMitad: Mitad = puesto.mitad === 'a' ? 'b' : 'a';
  const escribeDe = (m: Mitad) =>
    todos.find(
      (a) =>
        a.valor?.tipo === 'frases' &&
        a.valor.color === puesto.color &&
        a.valor.mitad === m &&
        a.valor.escribe
    );
  const respuestasDe = (m: Mitad) => {
    const quien = escribeDe(m);
    const v = quien?.valor?.tipo === 'frases' ? quien.valor.respuestas : undefined;
    return v && v.some((t) => t.length > 0) ? v : null;
  };

  const gente = (lista: { id: string; escribe: boolean }[]) => {
    const con = lista
      .map((o) => ({ quien: porId.get(o.id), escribe: o.escribe }))
      .filter((c): c is { quien: NonNullable<typeof c.quien>; escribe: boolean } =>
        Boolean(c.quien)
      );
    return con;
  };
  const suyos = gente(puesto.con);
  const otros = gente(puesto.enfrente);
  const fotos = await firmarSelfies(
    [...suyos, ...otros]
      .map((c) => c.quien.foto_path)
      .filter((p): p is string => Boolean(p))
  );
  const conFoto = (lista: ReturnType<typeof gente>) =>
    lista.map((c) => ({
      nombre: c.quien.nombre,
      apellido: c.quien.apellido,
      foto: c.quien.foto_path ? fotos.get(c.quien.foto_path) ?? null : null,
      escribe: c.escribe,
    }));

  /*
   * Frase por frase, porque la dirección cambia a mitad de camino: cada mitad
   * hace dos hacia el hecho y dos hacia la interpretación. Quien va hacia el
   * hecho parte de la interpretación, y al revés.
   */
  const desde = (d: Direccion, i: number) =>
    d === 'objetivo' ? FILAS[i].interpretacion : FILAS[i].hecho;

  return {
    color: COLORES[puesto.color] ?? COLORES[0],
    mitad: puesto.mitad,
    nombreDeMitad: NOMBRE_DE_MITAD[puesto.mitad],
    nombreDeEnfrente: NOMBRE_DE_MITAD[otraMitad],
    frases: DEL_EJERCICIO.map((fila, i) => {
      const direccion = direccionDe(puesto.mitad, i);
      const deEnfrente = direccionDe(otraMitad, i);
      return {
        direccion,
        consigna: CONSIGNA[direccion],
        parte: desde(direccion, fila),
        partioEnfrente: desde(deEnfrente, fila),
      };
    }),
    escribe: puesto.escribe,
    con: conFoto(suyos),
    enfrente: conFoto(otros),
    mias: respuestasDe(puesto.mitad),
    suyas: respuestasDe(otraMitad),
  };
}

/** El puesto de esta persona en esta ronda, listo para la pantalla. */
type Ensayo = {
  ronda: number;
  grupo: number;
  rol: Rol;
  /**
   * El caso, contado como le sirve a este rol. A quien comunica le llegan los
   * datos sueltos para que arme él cómo decirlo; a quien recibe, sólo quién es
   * y que lo llamaron, sin la decisión; a quien observa, todo.
   */
  caso: { titulo: string; ficha: [string, string][]; situacion: string | null };
  /** Sólo para quien recibe la noticia. Los otros dos no tienen que verla. */
  reaccion: { nombre: string; instruccion: string; guion: string[] } | null;
  con: { nombre: string; apellido: string; foto: string | null; rol: Rol }[];
  /** Lo que ya anotó, para que la pantalla no vuelva a preguntarlo. */
  anotado: {
    sostuvo: 'escucho' | 'explico' | null;
    motivo: 'hecho' | 'juicio' | 'ninguno' | null;
    porque: boolean | null;
    cuando: boolean | null;
  };
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
    caso: (() => {
      const c = CASOS[puesto.caso] ?? CASOS[0];
      if (puesto.rol === 'recibe') {
        return { titulo: c.titulo, ficha: [], situacion: c.paraQuienRecibe };
      }
      return {
        titulo: c.titulo,
        ficha: c.ficha.map(([q, r]) => [q, r] as [string, string]),
        situacion: null,
      };
    })(),
    reaccion:
      puesto.rol === 'recibe' && REACCIONES[puesto.reaccion]
        ? {
            nombre: REACCIONES[puesto.reaccion].nombre,
            instruccion: REACCIONES[puesto.reaccion].instruccion,
            guion: [...REACCIONES[puesto.reaccion].guion],
          }
        : null,
    con: companeros.map((c) => ({
      nombre: c.quien.nombre,
      apellido: c.quien.apellido,
      foto: c.quien.foto_path ? fotos.get(c.quien.foto_path) ?? null : null,
      rol: c.rol,
    })),
    anotado: {
      sostuvo: puesto.sostuvo ?? null,
      motivo: puesto.motivo ?? null,
      porque: puesto.porque ?? null,
      cuando: puesto.cuando ?? null,
    },
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
