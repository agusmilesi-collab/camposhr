/**
 * Los datos que mira el equipo desde el OS.
 *
 * No accede a ninguna fuente por su cuenta: arma el panorama llamando a los
 * módulos que ya existen (Airtable para evaluaciones, el JSON de cotizaciones,
 * Supabase para los encuentros). Es la forma que pide el spec de arquitectura:
 * la pantalla no sabe de dónde sale el dato, y el día que psicotécnicos se
 * mude a Postgres se reemplaza el módulo de abajo y esto no se entera.
 *
 * Regla que se hereda de `lib/airtable.ts`: acá no entra ningún dato clínico.
 * Lo que se cuenta es en qué etapa está cada evaluación, nunca su contenido.
 */

import 'server-only';
import { getDatosCliente, listarClientesConToken } from '@/lib/airtable';
import { listarCotizaciones, type Cotizacion } from '@/lib/cotizaciones';
import { informeDe, serviciosDe } from '@/lib/servicios';
import { diasDesde } from '@/lib/hora';

/** Etapas del pipeline de una evaluación, en el orden en que ocurren. */
export const ETAPAS = [
  'Sin asignar',
  'Por citar',
  'Por entrevistar',
  'Por analizar',
  'Entregado',
  'Seguimiento',
] as const;

/** Las etapas que cuentan como trabajo abierto. */
const ABIERTAS = new Set(['Sin asignar', 'Por citar', 'Por entrevistar', 'Por analizar']);

export type PersonaEnCurso = {
  nombre: string;
  cliente: string;
  puesto: string;
  etapa: string;
  evaluadora: string | null;
  fechaEntrevista: string | null;
  /** Días desde la entrevista, cuando ya se tomó. */
  dias: number | null;
};

export type ClienteOS = {
  nombre: string;
  token: string;
  empresaId: string | null;
  /** Servicios con documentos entregados, del cableado de lib/servicios.ts. */
  servicios: { titulo: string; documentos: number }[];
  busquedas: number;
  personas: number;
  entregadas: number;
  abiertas: number;
  informesEscritos: number;
  /** Fecha del pedido más reciente, para ordenar por actividad. */
  ultimoPedido: string | null;
  /** No se pudo leer Airtable para este cliente. */
  error: boolean;
};

export type Panorama = {
  clientes: ClienteOS[];
  enCurso: PersonaEnCurso[];
  cotizaciones: Cotizacion[];
  totales: {
    clientes: number;
    abiertas: number;
    entregadas: number;
    documentos: number;
  };
};

/**
 * El nombre de una empresa reducido a una clave comparable.
 *
 * Existe porque la misma empresa se escribe distinto en cada fuente: Airtable
 * la tiene como "Laruso" y el índice de cotizaciones como "Laruso SRL". Saca
 * tildes, puntos y la forma societaria, que es lo que suele diferir. Es un
 * puente hasta que exista la tabla de clientes del spec de arquitectura, y no
 * un reemplazo de ella.
 */
export function claveEmpresa(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(srl|sa|sas|sac|sh|scs|ltda|inc|s de rl)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * El panorama completo, con un pedido a Airtable por cliente.
 *
 * Los clientes son pocos y la respuesta se cachea un minuto, así que sale en
 * paralelo y sin paginar. Un cliente que falla queda marcado y no tira la
 * pantalla entera: es un panel de trabajo, no un informe.
 */
export async function panorama(): Promise<Panorama> {
  const hoy = new Date();
  const registrados = await listarClientesConToken();

  const clientes: ClienteOS[] = [];
  const enCurso: PersonaEnCurso[] = [];

  const leidos = await Promise.all(
    registrados.map(async (c) => {
      try {
        return { c, datos: await getDatosCliente(c.token) };
      } catch {
        return { c, datos: null };
      }
    })
  );

  for (const { c, datos } of leidos) {
    const servicios = serviciosDe(c.empresaId, c.token).map((s) => ({
      titulo: s.titulo,
      documentos: s.documentos.length,
    }));

    if (!datos) {
      clientes.push({
        nombre: c.nombre,
        token: c.token,
        empresaId: c.empresaId,
        servicios,
        busquedas: 0,
        personas: 0,
        entregadas: 0,
        abiertas: 0,
        informesEscritos: 0,
        ultimoPedido: null,
        error: true,
      });
      continue;
    }

    let personas = 0;
    let entregadas = 0;
    let abiertas = 0;
    let informesEscritos = 0;
    let ultimoPedido: string | null = null;

    for (const b of datos.busquedas) {
      if (b.fecha && (!ultimoPedido || b.fecha > ultimoPedido)) ultimoPedido = b.fecha;
      for (const p of b.candidatos) {
        personas += 1;
        if (p.estado === 'Entregado') entregadas += 1;
        if (ABIERTAS.has(p.estado)) {
          abiertas += 1;
          enCurso.push({
            nombre: p.nombre,
            cliente: datos.empresa,
            puesto: b.puesto,
            etapa: p.estado,
            evaluadora: p.evaluadora,
            fechaEntrevista: p.fechaEntrevista,
            dias: diasDesde(p.fechaEntrevista, hoy),
          });
        }
        if (informeDe(c.empresaId, p.nombre)) informesEscritos += 1;
      }
    }

    clientes.push({
      nombre: datos.empresa || c.nombre,
      token: c.token,
      empresaId: c.empresaId,
      servicios,
      busquedas: datos.busquedas.length,
      personas,
      entregadas,
      abiertas,
      informesEscritos,
      ultimoPedido,
      error: false,
    });
  }

  clientes.sort((a, b) => a.nombre.localeCompare(b.nombre));

  // Lo más viejo primero: lo que espera hace más días es lo que hay que mirar.
  const orden = ETAPAS as readonly string[];
  enCurso.sort((a, b) => {
    const porDias = (b.dias ?? -1) - (a.dias ?? -1);
    if (porDias !== 0) return porDias;
    return orden.indexOf(b.etapa) - orden.indexOf(a.etapa);
  });

  const cotizaciones = await listarCotizaciones();

  return {
    clientes,
    enCurso,
    cotizaciones,
    totales: {
      clientes: clientes.length,
      abiertas: clientes.reduce((n, c) => n + c.abiertas, 0),
      entregadas: clientes.reduce((n, c) => n + c.entregadas, 0),
      documentos: clientes.reduce(
        (n, c) => n + c.servicios.reduce((m, s) => m + s.documentos, 0) + c.informesEscritos,
        0
      ),
    },
  };
}
