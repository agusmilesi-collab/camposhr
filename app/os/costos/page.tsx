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
import { esDeServicios } from '@/lib/facturas-tipos';
import { empresas as listarEmpresas } from '@/lib/altas';
import Monotributo from './Monotributo';
import { Facturado, OtraFactura } from './Servicios';
import Trabajos, { type Trabajo } from './Trabajos';

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

  const ganadas = cotizaciones.filter((c) => c.estado === 'Aprobada');
  const deLa = (id: string) => costos.filter((x) => x.cotizacionId === id);

  /**
   * Las facturas de servicios: las que cobran algo que no son evaluaciones.
   *
   * El criterio vive en `lib/facturas-tipos.ts` y lo usan las tres pantallas
   * que parten la caja en dos, para que ninguna factura aparezca en las dos ni
   * en ninguna.
   */
  const servicios = facturas.filter((f) => f.estado !== 'anulada' && esDeServicios(f));

  /**
   * Cada trabajo con lo suyo: lo cotizado, lo facturado contra eso y lo que
   * costó hacerlo. Las tres cosas juntas son la única forma de saber qué quedó.
   */
  const trabajos: Trabajo[] = ganadas.map((c) => {
    const suyas = servicios.filter((f) => f.cotizacionId === c.id);
    const gastos = deLa(c.id);
    return {
      id: c.id,
      cliente: c.cliente,
      concepto: c.concepto,
      fecha: c.fecha,
      moneda: c.moneda,
      cotizado: c.importe,
      facturado: suyas.reduce((n, f) => n + (f.importe ?? 0), 0),
      cobrado: suyas.filter((f) => f.cobradaAt).reduce((n, f) => n + (f.importe ?? 0), 0),
      costo: gastos.reduce((n, x) => n + x.importe, 0),
      gastos: gastos.map((x) => ({
        id: x.id,
        concepto: x.concepto,
        fecha: x.fecha,
        importe: x.importe,
      })),
      facturas: suyas,
    };
  });

  /** Las que no salieron de ninguna cotización: se listan aparte. */
  const sueltas = servicios.filter((f) => f.cotizacionId === null);




  const total = resultadoDe(
    ganadas.reduce((n, c) => n + c.importe, 0),
    ganadas.reduce((n, c) => n + deLa(c.id).reduce((m, x) => m + x.importe, 0), 0)
  );

  return (
    <Shell titulo="Costos" identidad={yo.nombre} nota={`${ganadas.length} aprobadas`}>
      <div className="os-encabezado">
        <h1>Costos</h1>
      </div>

      {/* Los psicotécnicos primero: es de donde sale el trabajo de todas las
          semanas, y la categoría de cada una condiciona lo que se puede
          facturar de lo demás. */}
      <Monotributo emisoras={marcha} />

      <div className="os-rotulo-seccion">Servicios Campos HR</div>

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

      <Trabajos trabajos={trabajos} />

      <OtraFactura
        emisoras={emisoras}
        empresas={empresas}
        trabajos={ganadas.map((c) => ({ id: c.id, cliente: c.cliente, concepto: c.concepto }))}
        quien={yo.nombre}
      />

      {sueltas.length > 0 && <Facturado facturas={sueltas} />}
    </Shell>
  );
}
