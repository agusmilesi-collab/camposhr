import 'server-only';
import { cookies } from 'next/headers';
import { listarEvaluaciones, type Evaluacion } from '@/lib/psicotecnicos';
import { SECCIONES, type Seccion } from '@/lib/psicotecnicos-tipos';
import { anotarAcceso } from '@/lib/accesos';
import {
  baterias as listarBaterias,
  empresas as listarEmpresas,
  evaluadoras as listarEvaluadoras,
  pedidosAbiertos,
} from '@/lib/altas';
import { equipo, esMia, quienSoy, type Miembro } from '@/lib/identidad';
import { CLIENTE_POR_DEFECTO, COOKIE_EMPRESA, TODAS } from '@/lib/filtro-empresa';
import { DIAS_SEGUIMIENTO, listarCotizaciones } from '@/lib/cotizaciones';
import { diasEntre } from '@/lib/comercial-tipos';
import { diaDe, hoy as diaDeHoy } from '@/lib/hora';
import { comprobantesSinRegistrar } from '@/lib/comprobantes-pago';

/**
 * Qué ve cada quien, por sección.
 *
 * **Lo que no tiene evaluadora lo ve el equipo entero**, esté en la etapa que
 * esté: el trabajo ahí es repartir, y una persona que quedó sin dueño en Por
 * citar necesita el mismo reparto que una recién cargada. Si saliera en su
 * etapa aparecería en la pantalla de todas las evaluadoras y no sería trabajo
 * de ninguna. Es la columna Sin asignar de Entrevistas.
 *
 * **Lo que ya tiene dueño sale para su dueña**, y esas son las otras tres
 * columnas: citar, agendar y analizar muestran lo de quien mira (o todo, si
 * tiene alcance `todo`).
 *
 * **Lo entregado lo ve el equipo entero**, sea de quien sea: ahí no hay trabajo
 * que repartir, se va a consultar, y la consulta llega por el candidato o por
 * el cliente sin saber cuál de las dos lo evaluó.
 */
const CERRADAS = new Set(['Entregado', 'Seguimiento']);

/** Sin dueño y todavía abierta: es lo que hay que repartir. */
export function sinDuena(f: Evaluacion): boolean {
  return !f.evaluadora && !CERRADAS.has(f.etapa) && !f.baja;
}

export function visiblesEn(filas: Evaluacion[], seccion: Seccion, yo: Miembro): Evaluacion[] {
  const etapas = new Set<string>(seccion.etapas);
  const cerrada = seccion.etapas.every((e) => CERRADAS.has(e));
  return filas.filter((f) =>
    // Una baja ya no es trabajo de nadie: sale de los tableros y queda en
    // Entregados, que es donde se consulta lo que terminó.
    f.baja
      ? seccion.ruta === 'entregados'
      : sinDuena(f)
      ? seccion.ruta === 'entrevistas'
      : etapas.has(f.etapa) && (cerrada || (f.evaluadora && esMia(f.evaluadora, yo)))
  );
}

/**
 * Qué cliente está filtrando, según la cookie.
 *
 * Uno que ya no aparece en los datos no puede dejar la pantalla vacía para
 * siempre: se cae a mostrar todo.
 */
function empresaElegida(empresas: string[]): string {
  const guardada = cookies().get(COOKIE_EMPRESA)?.value;
  const elegida = guardada ? decodeURIComponent(guardada) : CLIENTE_POR_DEFECTO;
  return elegida === TODAS || !empresas.includes(elegida) ? TODAS : elegida;
}

/**
 * Los dos números de la barra lateral, y los dos reclaman algo.
 *
 * Antes llevaba uno por sección y era una foto del sistema: cuántas entrevistas
 * hay, cuántos informes se entregaron, cuánto falta facturar. Todos ciertos y
 * ninguno pedía nada, y entre cuatro números el que sí pide algo no se
 * distinguía.
 *
 * Quedan dos. En Entrevistas, lo que está sin repartir: un candidato entró y no
 * lo tomó nadie; lo ve el equipo entero. En Inicio, cuántas cosas hay en la
 * columna Hoy de quien mira: desde cualquier pantalla se ve que entró algo para
 * hoy (un comprobante, una entrevista, una propuesta por seguir) sin tener que
 * volver a Inicio a fijarse.
 */
export async function cuentasDeLaBarra(): Promise<Record<string, number>> {
  const { filas } = await listarEvaluaciones();
  const hoy = await cuantoHayHoy(filas).catch((e) => {
    // La barra no puede tumbar la pantalla que se estaba abriendo.
    console.error('barra: no se pudo contar lo de hoy', e);
    return 0;
  });
  return { ...avisoDeReparto(filas), ...(hoy > 0 ? { '/os': hoy } : {}) };
}

/**
 * Cuántas tarjetas tiene la columna Hoy de Inicio para quien mira.
 *
 * **Son las mismas reglas que arma `app/os/page.tsx` para dibujar esa columna,
 * y tienen que seguir siéndolo**: un número que no coincide con lo que se ve al
 * entrar no sirve. Lo que entra: las evaluaciones propias puestas en Hoy o con
 * entrevista hoy sin tomar, las propuestas que hay que seguir, el aviso de
 * candidatos sin evaluadora (uno, sean los que sean) y los comprobantes de los
 * inquilinos del Centro que esperan su pago.
 */
async function cuantoHayHoy(filas: Evaluacion[]): Promise<number> {
  const [yo, cotizaciones] = await Promise.all([quienSoy(), listarCotizaciones()]);
  const dia = diaDeHoy();

  const enCurso = filas.filter((e) => ABIERTAS_DE_INICIO.has(e.etapa) && !e.baja);
  const mias =
    yo.alcance === 'todo'
      ? enCurso
      : enCurso.filter((p) => (yo.evaluadora ? (p.evaluadora ?? '').includes(yo.evaluadora) : false));
  const enHoy = mias.filter(
    (e) =>
      e.tablero === 'hoy' ||
      (diaDe(e.fechaEntrevista) === dia && (e.etapa === 'Por citar' || e.etapa === 'Por entrevistar'))
  ).length;

  const seguimientos = cotizaciones.filter(
    (c) => c.estado === 'Enviada' && diasEntre(c.seguimientoEl ?? c.fecha, dia) >= DIAS_SEGUIMIENTO
  ).length;

  const sinAsignar = enCurso.some((e) => !e.evaluadora) ? 1 : 0;

  const comprobantes =
    yo.nombre.startsWith('Lucila') || yo.alcance === 'todo'
      ? (await comprobantesSinRegistrar()).length
      : 0;

  return enHoy + seguimientos + sinAsignar + comprobantes;
}

/** Las etapas que todavía piden trabajo: las que entran al tablero de Inicio. */
const ABIERTAS_DE_INICIO = new Set(['Sin asignar', 'Por citar', 'Por entrevistar', 'Por analizar']);

/** Dónde se muestra: la sección que tiene la columna de sin asignar. */
export const SIN_ASIGNAR = '/os/psicotecnicos/entrevistas';

/** El aviso, para quien ya tiene las filas leídas. */
function avisoDeReparto(filas: Evaluacion[]): Record<string, number> {
  const sinDueno = filas.filter(sinDuena).length;
  return sinDueno > 0 ? { [SIN_ASIGNAR]: sinDueno } : {};
}

/** Lo que necesitan todas las pantallas de la sección, con una sola lectura. */
export async function cargar() {
  const yo = await quienSoy();
  const { filas: crudas, fallaron } = await listarEvaluaciones();

  // Lo que necesita la tarjeta de alta del tablero. Va con el resto de la
  // lectura para no sumarle un viaje a la pantalla.
  const [pedidos, evaluadorasAlta, empresasAlta, bateriasAlta] = await Promise.all([
    pedidosAbiertos().catch(() => []),
    listarEvaluadoras().catch(() => []),
    // Los clientes y las baterías son para el pedido que se carga desde la
    // misma tarjeta cuando el candidato llega antes que su búsqueda.
    listarEmpresas().catch(() => []),
    listarBaterias().catch(() => []),
  ]);

  // Con qué nombre figura cada una en las evaluaciones: es el nombre por el
  // que se arma su columna en el reparto, y no siempre es el del equipo.
  const evaluadoras = (await equipo())
    .map((m) => m.evaluadora)
    .filter((n): n is string => Boolean(n));

  const empresas = [...new Set(crudas.map((f) => f.empresa))].sort((a, b) =>
    a.localeCompare(b)
  );

  const empresa = empresaElegida(empresas);

  const todas = empresa === TODAS ? crudas : crudas.filter((f) => f.empresa === empresa);
  const ocultas = crudas.length - todas.length;

  await anotarAcceso({
    quien: yo.nombre,
    accion: 'lectura',
    recurso: 'pipeline_psicotecnicos',
    detalle: { filas: todas.length, alcance: yo.alcance, empresa, fallaron },
  });

  // El aviso de la barra sale de las filas ya leídas, sin volver a pedirlas.
  const cuentas = avisoDeReparto(crudas);

  /**
   * Cuántas tiene encima cada evaluadora, para poder repartir con eso a la
   * vista.
   *
   * Se cuenta sobre todas las filas y no sobre las que quedaron después del
   * filtro por cliente: la carga de una persona no cambia porque uno esté
   * mirando un cliente, y filtrada diría que está libre alguien que tiene doce
   * de otra empresa.
   */
  const carga: Record<string, number> = {};
  for (const n of evaluadoras) carga[n] = 0;
  for (const f of crudas) {
    if (!f.evaluadora || CERRADAS.has(f.etapa)) continue;
    carga[f.evaluadora] = (carga[f.evaluadora] ?? 0) + 1;
  }

  return {
    todas,
    carga,
    yo,
    cuentas,
    fallaron,
    empresas,
    empresa,
    ocultas,
    evaluadoras,
    pedidos,
    evaluadorasAlta,
    empresasAlta,
    bateriasAlta,
  };
}

/** Lo más viejo arriba: es lo que hay que mirar primero. */
export function porEspera(filas: Evaluacion[]): Evaluacion[] {
  return [...filas].sort((a, b) => {
    const espera = (x: Evaluacion) => x.dias ?? x.diasEsperando ?? -1;
    return espera(b) - espera(a) || a.nombre.localeCompare(b.nombre);
  });
}
