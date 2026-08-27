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
 * tiene alcance `todo`). Lo entregado no se reparte, así que sale por su etapa
 * como siempre.
 */
const CERRADAS = new Set(['Entregado', 'Seguimiento']);

/** Sin dueño y todavía abierta: es lo que hay que repartir. */
export function sinDuena(f: Evaluacion): boolean {
  return !f.evaluadora && !CERRADAS.has(f.etapa);
}

export function visiblesEn(filas: Evaluacion[], seccion: Seccion, yo: Miembro): Evaluacion[] {
  const etapas = new Set<string>(seccion.etapas);
  const cerrada = seccion.etapas.every((e) => CERRADAS.has(e));
  return filas.filter((f) =>
    sinDuena(f)
      ? seccion.ruta === 'entrevistas'
      : etapas.has(f.etapa) && (cerrada || f.evaluadora) && esMia(f.evaluadora, yo)
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
 * El único número de la barra lateral: lo que está sin repartir.
 *
 * Antes llevaba uno por sección y era una foto del sistema: cuántas entrevistas
 * hay, cuántos informes se entregaron, cuánto falta facturar. Todos ciertos y
 * ninguno pedía nada, y entre cuatro números el que sí pide algo no se
 * distinguía.
 *
 * Queda el que reclama: un candidato entró y no lo tomó nadie. Sale en rojo, lo
 * ve el equipo entero (repartir es trabajo de todas) y desaparece cuando no hay
 * ninguno, que es lo normal.
 */
export async function cuentasDeLaBarra(): Promise<Record<string, number>> {
  const { filas } = await listarEvaluaciones();
  return avisoDeReparto(filas);
}

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
