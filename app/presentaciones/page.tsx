import Link from 'next/link';
import {
  listarPresentaciones,
  formatoFecha,
  slugDeCiclo,
  type Presentacion,
} from '@/lib/presentaciones';
import { diasDesde, hoy as hoyISO } from '@/lib/hora';
import { encuentrosEnCurso } from '@/lib/presentaciones-encuentros';

export const dynamic = 'force-dynamic';

// Relativo y no con el host escrito: en tools.camposhr.com lleva al mismo
// lugar, y en local abre el deck que se está probando en vez de mandar al sitio
// publicado.
const BASE = '/pres';

/**
 * El índice del material: una fila por cosa que se dicta.
 *
 * Una charla suelta es una fila y un ciclo también, aunque adentro tenga cinco
 * charlas: lo que se dictó fue el ciclo, para un cliente y en unos días, y
 * entrar a él es ver sus charlas. Con las cinco sueltas en el índice, elegir
 * cuál abrir era elegir entre versiones del mismo material.
 *
 * Arriba va la próxima, sola: el día del encuentro es lo único que se busca acá.
 */

/**
 * Cuánto falta, dicho como se dice en voz alta.
 *
 * El día del encuentro la tarjeta dice "Hoy". Los días previos dice cuántos
 * faltan, que es cuando se prepara el material: con un "Hoy" a secas, el día
 * anterior había que buscarlo en la lista y ahí se abre lo que no es.
 */
function cuantoFalta(fecha: string): string {
  const faltan = -(diasDesde(fecha) ?? 0);
  if (faltan <= 0) return 'Hoy';
  if (faltan === 1) return 'Mañana';
  return `En ${faltan} días`;
}

/** Una fila del índice: una charla suelta o un ciclo entero. */
type Fila = {
  clave: string;
  /** Con la que se ordena: la del encuentro, o la primera del ciclo. */
  fecha: string;
  fechaTexto: string;
  cliente: string | null;
  titulo: string;
  bajada: string;
  /** "17 placas" en una charla, "5 charlas · 115 placas" en un ciclo. */
  tamano: string;
  /** Adónde lleva: la presentación, o la pantalla del ciclo. */
  href: string | null;
  /** La presentación se abre en otra pestaña; el ciclo, en la misma. */
  externo: boolean;
};

export default async function Presentaciones() {
  const todas = listarPresentaciones();
  const { porMaterial } = await encuentrosEnCurso();

  const sueltas = todas.filter((p) => !p.ciclo);
  const ciclos = todas
    .filter((p) => p.ciclo)
    .reduce<{ nombre: string; filas: Presentacion[] }[]>((acc, p) => {
      const grupo = acc.find((g) => g.nombre === p.ciclo);
      if (grupo) grupo.filas.push(p);
      else acc.push({ nombre: p.ciclo as string, filas: [p] });
      return acc;
    }, []);

  const filas: Fila[] = [
    ...sueltas.map((p) => ({
      clave: `charla-${p.titulo}-${p.fecha}`,
      fecha: p.fecha,
      fechaTexto: formatoFecha(p.fecha),
      cliente: p.cliente,
      titulo: p.titulo,
      bajada: p.subtitulo,
      tamano: p.placas > 0 ? `${p.placas} placas` : 'Sin material',
      href: p.token ? `${BASE}/${p.token}` : null,
      externo: true,
    })),
    ...ciclos.map((c) => {
      // Para quién se dictó sale de las corridas y no del índice: el material
      // del ciclo es el mismo para todos, y quién lo recorrió vive en la base.
      const clientes = (porMaterial.get(c.nombre) ?? []).map((e) => e.empresa);
      const fechas = c.filas.map((p) => p.fecha);
      return {
        clave: `ciclo-${c.nombre}`,
        fecha: [...fechas].sort()[0],
        // La del primer encuentro: el rango de fechas hacía de la columna
        // la más ancha de la tabla para decir algo que se ve entrando al ciclo.
        fechaTexto: formatoFecha([...fechas].sort()[0]),
        cliente: clientes.join(', ') || null,
        titulo: c.nombre,
        bajada: `Ciclo de ${c.filas.length} charlas`,
        tamano: `${c.filas.reduce((n, p) => n + p.placas, 0)} placas`,
        href: `/presentaciones/${slugDeCiclo(c.nombre)}`,
        externo: false,
      };
    }),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha));

  const hoy = hoyISO();
  const proxima =
    [...filas].filter((f) => f.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha))[0] ??
    null;

  return (
    <main className="wrap wrap-ancho">
      <section className="head">
        <div className="head-top">
          <div className="eyebrow">Material de los encuentros</div>
          <a href="/" className="volver">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
            Herramientas
          </a>
        </div>
        <h1>Presentaciones</h1>
      </section>

      {proxima && (
        <section className={`pres-proxima${cuantoFalta(proxima.fecha) === 'Hoy' ? ' es-hoy' : ''}`}>
          <span className="pres-proxima-cuando">{cuantoFalta(proxima.fecha)}</span>
          <div className="pres-proxima-que">
            <b>{proxima.titulo}</b>
            <span>{[proxima.cliente, proxima.fechaTexto].filter(Boolean).join(' · ')}</span>
          </div>
          {proxima.href ? (
            proxima.externo ? (
              <a className="copiar pres-ver" href={proxima.href} target="_blank" rel="noreferrer">
                Ver presentación
              </a>
            ) : (
              <Link className="copiar pres-ver" href={proxima.href}>
                Ver las charlas
              </Link>
            )
          ) : (
            <em className="pres-pendiente">Sin material cargado</em>
          )}
        </section>
      )}

      <section className="presentaciones">
        <div className="card pres-tabla pres-indice">
          <div className="pres-row pres-th">
            <span>Fecha</span>
            <span>Cliente</span>
            <span>Qué es</span>
            <span className="pres-num">Tamaño</span>
          </div>

          {filas.map((f) => (
            <div className="pres-row" key={f.clave}>
              <span className="cot-fecha">{f.fechaTexto}</span>
              <span className="pres-cliente">{f.cliente}</span>
              {/* El título es el enlace: un botón al final de la fila repetía
                  el mismo destino en dos lugares. Sin material, no lleva a
                  ningún lado y la fila lo dice al lado del título. */}
              <span className="pres-charla">
                {f.href ? (
                  f.externo ? (
                    <a className="pres-entrar" href={f.href} target="_blank" rel="noreferrer">
                      {f.titulo}
                    </a>
                  ) : (
                    <Link className="pres-entrar" href={f.href}>
                      {f.titulo}
                    </Link>
                  )
                ) : (
                  <b>
                    {f.titulo} <em className="pres-pendiente">Sin publicar</em>
                  </b>
                )}
                <em>{f.bajada}</em>
              </span>
              <span className="pres-num">{f.tamano}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
