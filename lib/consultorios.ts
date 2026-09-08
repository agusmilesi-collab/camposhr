/**
 * Los consultorios del Centro: lo que se lee de la base.
 *
 * Todo server-side con la service key, como el resto del sistema. Este módulo
 * no puede importarse desde un componente de cliente; las cuentas que sí
 * necesita el navegador (precio, grilla, saldos) viven en
 * `lib/consultorios-calculo.ts` y se reexportan de acá para que quien lee del
 * servidor tenga todo en un solo import.
 *
 * Dos ideas sostienen el resto:
 *
 *   la disponibilidad no se guarda   Es la apertura, menos los cierres, menos
 *                                    lo reservado. Una columna de "libre" es
 *                                    una que puede quedar vieja.
 *
 *   el precio depende del volumen    La escala cobra por hora según cuántas
 *                                    horas semanales tenga contratadas la
 *                                    persona.
 *
 * El spec completo está en `CAMPOS OS/SPECS-consultorios.md`.
 */

import 'server-only';

import { select } from '@/lib/supabase';
import type {
  Apertura,
  Cierre,
  Contrato,
  Espacio,
  Gasto,
  Inquilino,
  Movimiento,
  Reserva,
  Tarifa,
} from '@/lib/consultorios-calculo';

export * from '@/lib/consultorios-calculo';

export async function listarEspacios(): Promise<Espacio[]> {
  const filas = await select<
    Omit<Espacio, 'incluye'> & { espacio_incluye: { id: string; texto: string; orden: number }[] }
  >(
    'espacios',
    'select=id,nombre,tipo,categoria,orden,activo,espacio_incluye(id,texto,orden)&order=orden.asc',
    'consultorios'
  );
  return filas.map((e) => ({
    ...e,
    incluye: (e.espacio_incluye ?? [])
      .sort((a, b) => a.orden - b.orden)
      .map((i) => ({ id: i.id, texto: i.texto })),
  }));
}

/**
 * La escala que rige a una fecha.
 *
 * **Sin caché**, igual que los contratos: de las dos sale el precio que se
 * congela en la reserva, y cobrar con una escala de hace cinco minutos es
 * cobrar mal. Lo que se lee muchas veces y casi no cambia (las salas, la
 * apertura) sí queda cacheado.
 *
 * Puede haber varias cargadas: la vigente y la del trimestre que viene, dejada
 * lista de antemano. De todas las que ya empezaron se toma la última.
 */
export async function escalaVigente(al: string): Promise<{ desde: string | null; tarifas: Tarifa[] }> {
  const filas = await select<Tarifa>(
    'tarifas',
    `select=espacio_id,horas_semana_desde,precio_hora,desde&desde=lte.${al}&order=desde.desc,horas_semana_desde.asc`
  );
  if (filas.length === 0) return { desde: null, tarifas: [] };
  const desde = filas[0].desde;
  return {
    desde,
    tarifas: filas
      .filter((t) => t.desde === desde)
      .map((t) => ({ ...t, precio_hora: Number(t.precio_hora) })),
  };
}

/** Todas las escalas cargadas, para la historia y para lo que empieza después. */
export async function escalas(): Promise<Tarifa[]> {
  const filas = await select<Tarifa>(
    'tarifas',
    'select=espacio_id,horas_semana_desde,precio_hora,desde&order=desde.desc,horas_semana_desde.asc',
    'consultorios'
  );
  return filas.map((t) => ({ ...t, precio_hora: Number(t.precio_hora) }));
}

export async function aperturas(): Promise<Apertura[]> {
  return select<Apertura>(
    'apertura',
    'select=espacio_id,dia_semana,desde_hora,hasta_hora',
    'consultorios'
  );
}

export async function cierresEntre(desde: string, hasta: string): Promise<Cierre[]> {
  return select<Cierre>(
    'cierres',
    `select=id,espacio_id,fecha,desde_hora,hasta_hora,motivo&fecha=gte.${desde}&fecha=lte.${hasta}&order=fecha.asc`,
    'consultorios'
  );
}

export async function reservasEntre(desde: string, hasta: string): Promise<Reserva[]> {
  return select<Reserva>(
    'reservas',
    `select=id,espacio_id,inquilino_id,fecha,desde_hora,hasta_hora,origen,estado,importe,created_at,inquilinos(nombre)` +
      `&fecha=gte.${desde}&fecha=lte.${hasta}&estado=eq.activa&order=fecha.asc,desde_hora.asc`
  );
}

export async function listarInquilinos(): Promise<Inquilino[]> {
  return select<Inquilino>(
    'inquilinos',
    'select=id,nombre,correo,telefono,activo,hash,matricula,matricula_vence,dni_archivo,' +
      'matricula_archivo,llave_entregada,normas_version,normas_aceptadas_at,created_at&order=nombre.asc',
    'consultorios'
  );
}

export async function contratos(): Promise<Contrato[]> {
  return select<Contrato>(
    'contratos',
    'select=id,inquilino_id,espacio_id,dia_semana,desde_hora,hasta_hora,vigente_desde,vigente_hasta&order=dia_semana.asc,desde_hora.asc'
  );
}

export async function movimientos(periodo?: string): Promise<Movimiento[]> {
  const filtro = periodo ? `&periodo=eq.${periodo}` : '';
  const filas = await select<Movimiento>(
    'movimientos',
    `select=id,inquilino_id,tipo,fecha,periodo,importe,reserva_id,detalle,quien${filtro}&order=fecha.desc`
  );
  return filas.map((m) => ({ ...m, importe: Number(m.importe) }));
}

/**
 * Una persona sola, para su pantalla.
 *
 * Se pide por id en vez de filtrar la lista entera: la ficha se abre desde
 * cualquier lado (un enlace guardado, la vuelta del navegador) y traer las
 * cincuenta para quedarse con una es trabajo que crece con el tiempo.
 */
export async function inquilinoPorId(id: string): Promise<Inquilino | null> {
  const filas = await select<Inquilino>(
    'inquilinos',
    'select=id,nombre,correo,telefono,activo,hash,matricula,matricula_vence,dni_archivo,' +
      `matricula_archivo,llave_entregada,normas_version,normas_aceptadas_at&id=eq.${id}`
  );
  return filas[0] ?? null;
}

/**
 * Todas las reservas de una persona, de siempre.
 *
 * Es de donde sale su historia de horas: cuántas usó cada mes, que no es lo
 * mismo que cuántas tiene contratadas hoy. Las liberadas quedan afuera porque
 * son horas que soltó y no ocupó.
 */
export async function reservasDe(inquilinoId: string): Promise<Reserva[]> {
  return select<Reserva>(
    'reservas',
    `select=id,espacio_id,inquilino_id,fecha,desde_hora,hasta_hora,origen,estado,importe,inquilinos(nombre)` +
      `&inquilino_id=eq.${inquilinoId}&estado=eq.activa&order=fecha.asc,desde_hora.asc`
  );
}

/** Su cuenta entera, de todos los meses: el saldo que se arrastra sale de acá. */
export async function movimientosDe(inquilinoId: string): Promise<Movimiento[]> {
  const filas = await select<Movimiento>(
    'movimientos',
    'select=id,inquilino_id,tipo,fecha,periodo,importe,reserva_id,detalle,quien' +
      `&inquilino_id=eq.${inquilinoId}&order=fecha.desc`
  );
  return filas.map((m) => ({ ...m, importe: Number(m.importe) }));
}

/**
 * Los gastos del Centro.
 *
 * Sin filtro trae todos: el resultado se mira mes a mes y el gráfico del año
 * los necesita a todos. Son unas pocas decenas por mes.
 */
export async function gastos(periodo?: string): Promise<Gasto[]> {
  const filtro = periodo ? `&periodo=eq.${periodo}` : '';
  const filas = await select<Gasto>(
    'gastos',
    `select=id,fecha,periodo,concepto,rubro,importe,fijo,quien${filtro}&order=fecha.desc`
  );
  return filas.map((g) => ({ ...g, importe: Number(g.importe) }));
}
