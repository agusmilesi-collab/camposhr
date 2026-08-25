import Shell from '../Shell';
import { BorrarCosto, NuevoCosto } from './Costos';
import {
  formatoFecha,
  formatoImporte,
  listarCostos,
  listarCotizaciones,
  resultadoDe,
} from '@/lib/cotizaciones';
import { esMia, quienSoy } from '@/lib/identidad';
import { marchaMonotributo } from '@/lib/facturas';
import Monotributo from './Monotributo';

export const dynamic = 'force-dynamic';

/**
 * Qué entró, qué costó y qué quedó.
 *
 * Solo entran las oportunidades aprobadas: lo que todavía no se cerró no es un
 * ingreso, y mezclarlo daría un resultado que no existe.
 */
export default async function Costos() {
  const [yo, cotizaciones, costos, marcha] = await Promise.all([
    quienSoy(),
    listarCotizaciones(),
    listarCostos(),
    marchaMonotributo(),
  ]);

  // Cada una ve lo suyo. Quien tiene alcance de todo ve las dos, porque las dos
  // categorías son una sola decisión: qué le conviene facturar a cada una.
  const mias = marcha.filter((m) => esMia(m.nombre, yo));

  const ganadas = cotizaciones.filter((c) => c.estado === 'Aprobada');
  const deLa = (id: string) => costos.filter((x) => x.cotizacionId === id);

  const total = resultadoDe(
    ganadas.reduce((n, c) => n + c.importe, 0),
    ganadas.reduce((n, c) => n + deLa(c.id).reduce((m, x) => m + x.importe, 0), 0)
  );

  return (
    <Shell titulo="Costos" identidad={yo.nombre} nota={`${ganadas.length} aprobadas`}>
      <div className="os-encabezado">
        <h1>Costos</h1>
      </div>

      <div className="os-cifras">
        <div className="os-cifra">
          <div className="os-cifra-rotulo">Ingreso</div>
          <div className="os-cifra-valor">{formatoImporte(total.ingreso)}</div>
          <div className="os-cifra-pie">Suma de lo aprobado.</div>
        </div>
        <div className="os-cifra">
          <div className="os-cifra-rotulo">Costos</div>
          <div className="os-cifra-valor">{formatoImporte(total.costo)}</div>
          <div className="os-cifra-pie">{costos.length} cargados.</div>
        </div>
        <div className="os-cifra">
          <div className="os-cifra-rotulo">Resultado</div>
          <div className="os-cifra-valor">{formatoImporte(total.resultado)}</div>
          <div className="os-cifra-pie">Ingreso menos costos.</div>
        </div>
        <div className="os-cifra">
          <div className="os-cifra-rotulo">Margen</div>
          <div className="os-cifra-valor">
            {total.margen === null ? '—' : `${Math.round(total.margen)}%`}
          </div>
          <div className="os-cifra-pie">Del ingreso.</div>
        </div>
      </div>

      <Monotributo emisoras={mias} />

      {ganadas.length === 0 && (
        <div className="os-panel">
          <p className="os-vacio">
            Todavía no hay ninguna oportunidad aprobada. Se aprueban en Cotizaciones.
          </p>
        </div>
      )}

      {ganadas.map((c) => {
        const suyos = deLa(c.id);
        const r = resultadoDe(c.importe, suyos.reduce((n, x) => n + x.importe, 0));
        return (
          <section className="os-panel" key={c.id}>
            <div className="os-panel-top">
              <h2>{c.cliente}</h2>
              <span className="os-enlace">
                {c.concepto} · {formatoFecha(c.fecha)}
              </span>
            </div>

            <div className="os-resumen-linea">
              <span>
                <span className="os-dato-rotulo">Ingreso</span>
                {formatoImporte(r.ingreso, c.moneda)}
              </span>
              <span>
                <span className="os-dato-rotulo">Costos</span>
                {formatoImporte(r.costo, c.moneda)}
              </span>
              <span className={r.resultado < 0 ? 'os-resultado-rojo' : undefined}>
                <span className="os-dato-rotulo">Resultado</span>
                {formatoImporte(r.resultado, c.moneda)}
              </span>
              <span
                className={r.margen !== null && r.margen < 0 ? 'os-resultado-rojo' : undefined}
              >
                <span className="os-dato-rotulo">Margen</span>
                {r.margen === null ? '—' : `${Math.round(r.margen)}%`}
              </span>
            </div>

            {suyos.map((x) => (
              <div className="os-gasto" key={x.id}>
                <span className="os-gasto-concepto">{x.concepto}</span>
                <span className="os-gasto-fecha">{formatoFecha(x.fecha)}</span>
                <span className="os-gasto-importe">{formatoImporte(x.importe, c.moneda)}</span>
                <span className="os-gasto-baja">
                  <BorrarCosto id={x.id} />
                </span>
              </div>
            ))}

            {suyos.length === 0 && (
              <p className="os-panel-nota">Sin costos cargados: el resultado es el ingreso entero.</p>
            )}

            <div className="os-panel-cuerpo">
              <NuevoCosto cotizacionId={c.id} />
            </div>
          </section>
        );
      })}
    </Shell>
  );
}
