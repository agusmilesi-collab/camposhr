import 'server-only';
import { cookies } from 'next/headers';
import { ETAPAS, RUTA, listarEvaluaciones, type Evaluacion } from '@/lib/psicotecnicos';
import { anotarAcceso } from '@/lib/accesos';
import { equipo, esMia, quienSoy, type Miembro } from '@/lib/identidad';
import { CLIENTE_POR_DEFECTO, COOKIE_EMPRESA, TODAS } from '@/lib/filtro-empresa';

/**
 * Qué ve cada quien, por etapa.
 *
 * **"Sin asignar" es todo lo que no tiene evaluadora**, esté en la etapa que
 * esté. La pantalla la ve el equipo entero porque el trabajo ahí es repartir, y
 * una persona que quedó sin dueño en Por citar necesita el mismo reparto que
 * una recién cargada: si se mostrara en su etapa, aparecería en la pantalla de
 * todas las evaluadoras y no sería trabajo de ninguna.
 *
 * **Las demás etapas muestran lo que ya tiene dueño**, y de eso lo de quien
 * mira. Lo entregado no se reparte, así que sale por su etapa como siempre.
 */
const CERRADAS = new Set(['Entregado', 'Seguimiento']);

export function visiblesEn(filas: Evaluacion[], etapa: string, yo: Miembro): Evaluacion[] {
  if (etapa === 'Sin asignar') {
    return filas.filter((f) => !f.evaluadora && !CERRADAS.has(f.etapa));
  }
  return filas.filter(
    (f) => f.etapa === etapa && (CERRADAS.has(etapa) || f.evaluadora) && esMia(f.evaluadora, yo)
  );
}

/** Lo que necesitan todas las pantallas de la sección, con una sola lectura. */
export async function cargar() {
  const yo = await quienSoy();
  const { filas: crudas, fallaron } = await listarEvaluaciones();

  // Con qué nombre figura cada una en las evaluaciones: es el nombre por el
  // que se arma su columna en el reparto, y no siempre es el del equipo.
  const evaluadoras = (await equipo())
    .map((m) => m.evaluadora)
    .filter((n): n is string => Boolean(n));

  const empresas = [...new Set(crudas.map((f) => f.empresa))].sort((a, b) =>
    a.localeCompare(b)
  );

  const guardada = cookies().get(COOKIE_EMPRESA)?.value;
  const elegida = guardada ? decodeURIComponent(guardada) : CLIENTE_POR_DEFECTO;
  // Un cliente que ya no aparece en los datos no puede dejar la pantalla vacía
  // para siempre: se cae a mostrar todo.
  const empresa = elegida === TODAS || !empresas.includes(elegida) ? TODAS : elegida;

  const todas = empresa === TODAS ? crudas : crudas.filter((f) => f.empresa === empresa);
  const ocultas = crudas.length - todas.length;

  await anotarAcceso({
    quien: yo.nombre,
    accion: 'lectura',
    recurso: 'pipeline_psicotecnicos',
    detalle: { filas: todas.length, alcance: yo.alcance, empresa, fallaron },
  });

  // Las cuentas de la barra dicen cuántas se van a ver al entrar, no cuántas
  // existen: un número que no coincide con la pantalla no sirve para nada.
  const cuentas = ETAPAS.filter((e) => e !== 'Seguimiento').map((etapa) => ({
    etapa,
    ruta: RUTA[etapa],
    texto: etapa,
    n: visiblesEn(todas, etapa, yo).length,
  }));

  return { todas, yo, cuentas, fallaron, empresas, empresa, ocultas, evaluadoras };
}

/** Lo más viejo arriba: es lo que hay que mirar primero. */
export function porEspera(filas: Evaluacion[]): Evaluacion[] {
  return [...filas].sort((a, b) => {
    const espera = (x: Evaluacion) => x.dias ?? x.diasEsperando ?? -1;
    return espera(b) - espera(a) || a.nombre.localeCompare(b.nombre);
  });
}
