import 'server-only';
import { select } from '@/lib/supabase';

/**
 * Lo que hace falta para tener la entrevista, y nada más.
 *
 * La ficha del candidato guarda todo lo suyo y se lee después, sentada, para
 * codificar y escribir el informe. Esto es otra cosa: la hoja que se abre en la
 * sala, con la persona enfrente, para saber qué se le toma y con qué se le
 * toma. Por eso no lee manchas, ni sumario, ni puntajes de competencias: nada
 * de eso se mira mientras se administra.
 *
 * Lo que sí trae es lo escrito de la entrevista por competencias, que se toma
 * hablando y se escribe en el momento: no hay otra pantalla donde eso exista.
 *
 * Qué tests van sale de la batería que se le vendió al cliente, que es la que
 * fija el alcance de la evaluación. El Benziger va aparte: no lo declara la
 * batería sino el pedido, porque es opcional en las tres.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Fila = {
  id: string;
  estado: string;
  modalidad: string | null;
  fecha_entrevista: string | null;
  enlace_entrevista: string | null;
  proyectivo_administrado: boolean;
  bender_administrado: boolean;
  bender_observaciones: string | null;
  bender_nombre: string | null;
  entrevista_competencias: string | null;
  benziger_administrado: boolean;
  /** El orden elegido para esta entrevista. Null: el de la batería. */
  orden_tests: string[] | null;
  grafico_2_personas_administrado: boolean;
  grafico_2_personas_nombre: string | null;
  grafico_2_personas_observaciones: string | null;
  personas: { nombre: string; email: string | null; telefono: string | null } | null;
  evaluadoras: { nombre: string } | null;
  pedidos: {
    puesto: string;
    con_benziger: boolean;
    empresas: { nombre: string } | null;
    baterias: { codigo: string; nombre: string | null; tests: string[] | null } | null;
  } | null;
};

/** En qué anda el Raven, que es el único test que la persona hace sola. */
export type EstadoRaven = 'sin enlace' | 'sin abrir' | 'empezado' | 'terminado';

export type Entrevista = {
  id: string;
  estado: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  puesto: string | null;
  empresa: string | null;
  evaluadora: string | null;
  cuando: string | null;
  modalidad: string | null;
  /** El enlace de la videollamada, cuando la entrevista es online. */
  enlace: string | null;
  bateria: string | null;
  bateriaNombre: string | null;
  /** Los tests de la batería, en el orden en que están declarados. */
  tests: string[];
  conBenziger: boolean;
  /** Si ya se le tomó el Benziger, que va aparte de la batería. */
  benzigerAdministrado: boolean;
  /** Si ya se le tomó el test de manchas de su batería. */
  proyectivoAdministrado: boolean;
  benderAdministrado: boolean;
  benderObservaciones: string | null;
  /** Qué dice la hoja del Bender ya subida, o null si todavía no hay. */
  benderHoja: string | null;
  graficoAdministrado: boolean;
  graficoObservaciones: string | null;
  /** Cómo se llama el dibujo cargado, si hay uno. */
  graficoNombre: string | null;
  raven: EstadoRaven;
  /** Cuándo abrió la primera lámina, para saber cuánto le queda. */
  ravenIniciado: string | null;
  /** Cuánto tardó, si ya lo terminó. */
  ravenDuracion: number | null;
  /** En qué escalón de la pirámide quedó, si ya se lo ubicó. */
  discursivo: string | null;
  /**
   * Lo escrito de la entrevista por competencias.
   *
   * Es de los pocos datos de la persona que esta pantalla sí guarda: la
   * entrevista por competencias no deja más rastro que su redacción, y se
   * escribe mientras se toma.
   */
  competencias: string | null;
};

const CAMPOS =
  'id,estado,modalidad,fecha_entrevista,enlace_entrevista,' +
  'proyectivo_administrado,bender_administrado,bender_observaciones,bender_nombre,' +
  'benziger_administrado,orden_tests,entrevista_competencias,' +
  'grafico_2_personas_administrado,' +
  'grafico_2_personas_nombre,grafico_2_personas_observaciones,' +
  'personas(nombre,email,telefono),evaluadoras(nombre),' +
  'pedidos(puesto,con_benziger,empresas(nombre),baterias(codigo,nombre,tests))';

/**
 * Los tests en el orden que eligió quien toma la entrevista.
 *
 * Lo que no está en el orden guardado va al final, en el de la batería: sumarle
 * un test a la batería no puede esconderlo de las entrevistas que ya tenían su
 * orden elegido. Y un nombre guardado que ya no está en la batería se descarta,
 * porque ese test dejó de tomarse.
 */
function ordenar(tests: string[], guardado: string[] | null | undefined): string[] {
  if (!guardado?.length) return tests;
  const elegidos = guardado.filter((t) => tests.includes(t));
  return [...elegidos, ...tests.filter((t) => !elegidos.includes(t))];
}

export async function entrevistaDe(id: string): Promise<Entrevista | null> {
  if (!UUID.test(id)) return null;

  const [filas, sesiones, discursivos] = await Promise.all([
    select<Fila>('evaluaciones', `select=${CAMPOS}&id=eq.${id}`),
    select<{ iniciado_at: string | null; terminado_at: string | null }>(
      'raven_sesiones',
      `select=iniciado_at,terminado_at&evaluacion_id=eq.${id}&order=creado_at.desc&limit=1`
    ),
    select<{ nivel: string | null }>(
      'analisis_discursivo',
      `select=nivel&evaluacion_id=eq.${id}`
    ).catch(() => []),
  ]);

  const f = filas[0];
  if (!f) return null;

  const s = sesiones[0];
  const raven: EstadoRaven = !s
    ? 'sin enlace'
    : s.terminado_at
      ? 'terminado'
      : s.iniciado_at
        ? 'empezado'
        : 'sin abrir';

  return {
    id: f.id,
    estado: f.estado,
    nombre: f.personas?.nombre ?? 'Sin nombre',
    email: f.personas?.email ?? null,
    telefono: f.personas?.telefono ?? null,
    puesto: f.pedidos?.puesto ?? null,
    empresa: f.pedidos?.empresas?.nombre ?? null,
    evaluadora: f.evaluadoras?.nombre ?? null,
    cuando: f.fecha_entrevista,
    modalidad: f.modalidad,
    enlace: f.enlace_entrevista,
    bateria: f.pedidos?.baterias?.codigo ?? null,
    bateriaNombre: f.pedidos?.baterias?.nombre ?? null,
    tests: ordenar(f.pedidos?.baterias?.tests ?? [], f.orden_tests),
    conBenziger: f.pedidos?.con_benziger ?? false,
    benzigerAdministrado: f.benziger_administrado,
    proyectivoAdministrado: f.proyectivo_administrado,
    benderAdministrado: f.bender_administrado,
    benderObservaciones: f.bender_observaciones,
    benderHoja: f.bender_nombre,
    graficoAdministrado: f.grafico_2_personas_administrado,
    graficoObservaciones: f.grafico_2_personas_observaciones,
    graficoNombre: f.grafico_2_personas_nombre,
    raven,
    discursivo: discursivos[0]?.nivel ?? null,
    competencias: f.entrevista_competencias,
    ravenIniciado: s?.terminado_at ? null : (s?.iniciado_at ?? null),
    ravenDuracion:
      s?.terminado_at && s.iniciado_at
        ? Math.max(
            0,
            Math.round(
              (new Date(s.terminado_at).getTime() - new Date(s.iniciado_at).getTime()) / 1000
            )
          )
        : null,
  };
}
