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
  pedidosCerrados,
} from '@/lib/altas';
import { equipo, esMia, quienSoy, type Miembro } from '@/lib/identidad';
import { listarAFacturar } from '@/lib/facturas';
import { CLIENTE_POR_DEFECTO, COOKIE_EMPRESA, TODAS } from '@/lib/filtro-empresa';

/**
 * Qué ve cada quien, por sección.
 *
 * **"Sin asignar" es todo lo que no tiene evaluadora**, esté en la etapa que
 * esté. La pantalla la ve el equipo entero porque el trabajo ahí es repartir, y
 * una persona que quedó sin dueño en Por citar necesita el mismo reparto que
 * una recién cargada: si se mostrara en su etapa, aparecería en la pantalla de
 * todas las evaluadoras y no sería trabajo de ninguna.
 *
 * **Las demás muestran lo que ya tiene dueño**, y de eso lo de quien mira. Una
 * sección puede juntar varias etapas: Entrevistas trae las de citar y las ya
 * agendadas. Lo entregado no se reparte, así que sale por su etapa como
 * siempre.
 */
const CERRADAS = new Set(['Entregado', 'Seguimiento']);

export function visiblesEn(filas: Evaluacion[], seccion: Seccion, yo: Miembro): Evaluacion[] {
  if (seccion.ruta === 'sin-asignar') {
    return filas.filter((f) => !f.evaluadora && !CERRADAS.has(f.etapa));
  }
  const etapas = new Set<string>(seccion.etapas);
  const cerrada = seccion.etapas.every((e) => CERRADAS.has(e));
  return filas.filter(
    (f) => etapas.has(f.etapa) && (cerrada || f.evaluadora) && esMia(f.evaluadora, yo)
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
 * Los números de la barra lateral.
 *
 * Los calcula cualquier pantalla del OS y no solo las del pipeline: entrar a
 * una ficha o a Facturación apagaba todos los demás, y la barra pasaba de decir
 * cuánto hay en cada sección a decirlo solo en la que uno ya está mirando.
 *
 * Dicen cuántas se van a ver al entrar, no cuántas existen: por eso respetan el
 * filtro por cliente y el alcance de quien mira. Un número que no coincide con
 * la pantalla no sirve para nada.
 */
export async function cuentasDeLaBarra(): Promise<Record<string, number>> {
  const yo = await quienSoy();
  const [{ filas }, aFacturar] = await Promise.all([
    listarEvaluaciones(),
    listarAFacturar().catch(() => []),
  ]);
  return cuentasDe(filas, yo, aFacturar.filter((p) => esMia(p.evaluadora, yo)).length);
}

/** El mismo cálculo, para quien ya tiene las filas leídas. */
function cuentasDe(filas: Evaluacion[], yo: Miembro, aFacturar: number): Record<string, number> {
  const empresas = [...new Set(filas.map((f) => f.empresa))];
  const empresa = empresaElegida(empresas);
  const suyas = empresa === TODAS ? filas : filas.filter((f) => f.empresa === empresa);

  const cuentas: Record<string, number> = {};
  for (const s of SECCIONES) {
    cuentas[`/os/psicotecnicos/${s.ruta}`] = visiblesEn(suyas, s, yo).length;
  }
  // La facturación no filtra por cliente: la cola es de quien factura y se
  // arma con todo lo que entrevistó, sea de la empresa que sea.
  cuentas['/os/psicotecnicos/facturacion'] = aFacturar;
  return cuentas;
}

/** Lo que necesitan todas las pantallas de la sección, con una sola lectura. */
export async function cargar() {
  const yo = await quienSoy();
  const { filas: crudas, fallaron } = await listarEvaluaciones();

  // Lo que necesita la tarjeta de alta del tablero. Va con el resto de la
  // lectura para no sumarle un viaje a la pantalla.
  const [pedidos, cerrados, evaluadorasAlta, empresasAlta, bateriasAlta] = await Promise.all([
    pedidosAbiertos().catch(() => []),
    // Los que ya se entregaron enteros van aparte en el selector: elegir uno
    // reabre el pedido, que es lo que pasa cuando el cliente pide más
    // evaluaciones para la misma búsqueda.
    pedidosCerrados().catch(() => []),
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

  // Las de la barra salen de las filas ya leídas, sin volver a pedirlas.
  const aFacturar = (await listarAFacturar().catch(() => [])).filter((p) =>
    esMia(p.evaluadora, yo)
  ).length;
  const cuentas = cuentasDe(crudas, yo, aFacturar);

  return {
    todas,
    yo,
    cuentas,
    fallaron,
    empresas,
    empresa,
    ocultas,
    evaluadoras,
    pedidos,
    cerrados,
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
