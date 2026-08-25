import Shell from '../Shell';
import { BorrarCosto, NuevoCosto } from './Costos';
import {
  formatoFecha,
  formatoImporte,
  listarCostos,
  listarCotizaciones,
  resultadoDe,
} from '@/lib/cotizaciones';
import { quienSoy } from '@/lib/identidad';
import { listarEmisoras, listarFacturas, marchaMonotributo } from '@/lib/facturas';
import { empresas as listarEmpresas } from '@/lib/altas';
import Monotributo from './Monotributo';
import { Facturado, OtraFactura } from './Servicios';

export const dynamic = 'force-dynamic';

/**
 * Qué entró, qué costó y qué quedó.
 *
 * Solo entran las oportunidades aprobadas: lo que todavía no se cerró no es un
 * ingreso, y mezclarlo daría un resultado que no existe.
 *
 * **Acá no hay dueño: todos ven todo.** Es la otra mitad del dinero del
 * estudio. Lo de psicotécnicos lo factura y lo cobra cada evaluadora por
 * separado, y por eso esa pantalla muestra lo de cada una; lo que se cotiza y
 * se gana es del estudio y se reparte entre los tres, así que mirarlo por
 * persona no querría decir nada.
 */
export default async function Costos() {
  const [yo, cotizaciones, costos, marcha, facturas, emisoras, empresas] = await Promise.all([
    quienSoy(),
    listarCotizaciones(),
    listarCostos(),
    marchaMonotributo(),
    listarFacturas(),
    listarEmisoras(),
    listarEmpresas().catch(() => []),
  ]);

  /**
   * Las facturas de servicios: las que no cubren ninguna evaluación.
   *
   * No hace falta una marca: un comprobante de psicotécnicos siempre lleva sus
   * candidatos en los renglones, y uno de servicios no lleva ninguno. Se
   * reconocen por eso, que además es lo que ya distingue a los dos trabajos.
   */
  const servicios = facturas.filter(
    (f) => f.estado !== 'anulada' && f.renglones.every((r) => r.evaluacionId === null)
  );



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
        <p>
          Lo que se cotiza y se gana es del estudio y se reparte entre los tres, así que
          acá no hay dueño: todos ven todo. Los psicotécnicos van aparte, en Facturación,
          porque cada evaluadora emite y cobra los suyos.
        </p>
      </div>

      {/* Los psicotécnicos primero: es de donde sale el trabajo de todas las
          semanas, y la categoría de cada una condiciona lo que se puede
          facturar de lo demás. */}
      <Monotributo emisoras={marcha} />

      <div className="os-rotulo-bloque">Servicios Campos HR</div>

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

      <Facturado facturas={servicios} />

      <OtraFactura emisoras={emisoras} empresas={empresas} quien={yo.nombre} />

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
