import {
  GANADOS,
  listarCostos,
  type listarCotizaciones,
} from '@/lib/cotizaciones';
import { equipo as listarEquipo } from '@/lib/identidad';
import { listarEmisoras, listarFacturas } from '@/lib/facturas';
import { esDeServicios } from '@/lib/facturas-tipos';
import { empresas as listarEmpresas } from '@/lib/altas';
import { Facturado, OtraFactura } from '@/app/os/costos/Servicios';
import Trabajos, { type Trabajo } from '@/app/os/costos/Trabajos';
import MesAMes, { type MesDeServicios } from '@/app/os/costos/MesAMes';
import { mesesDelAnio } from '@/lib/monotributo';

/**
 * Qué entró, qué costó y qué quedó de los servicios de Campos HR.
 *
 * Solo entran las oportunidades aprobadas: lo que todavía no se cerró no es un
 * ingreso, y mezclarlo daría un resultado que no existe.
 *
 * Va debajo del embudo porque es su continuación: lo que llega a Aprobada o a
 * Entregada arriba es un trabajo acá abajo. **No hay dueño: todos ven todo.**
 * Lo que se cotiza y se gana es del estudio y se reparte entre los tres.
 */
export default async function ServiciosCamposHR({
  cotizaciones,
  quien,
}: {
  cotizaciones: Awaited<ReturnType<typeof listarCotizaciones>>;
  quien: string;
}) {
  const [costos, facturas, emisoras, empresas, miembros] = await Promise.all([
    listarCostos(),
    listarFacturas(),
    listarEmisoras(),
    listarEmpresas().catch(() => []),
    listarEquipo(),
  ]);

  /* Entre quiénes se parte lo que deja cada trabajo: el equipo entero, que hoy
     son tres. Sale de la tabla y no de una lista escrita acá, así que el día
     que entre o salga alguien el reparto lo sigue solo. */
  const socios = miembros.map((m) => m.nombre);

  const ganadas = cotizaciones.filter((c) => GANADOS.includes(c.estado));
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
      repartidoEl: c.repartidoEl,
      facturado: suyas.reduce((n, f) => n + (f.importe ?? 0), 0),
      cobrado: suyas.filter((f) => f.cobradaAt).reduce((n, f) => n + (f.importe ?? 0), 0),
      costo: gastos.reduce((n, x) => n + x.importe, 0),
      gastos: gastos.map((x) => ({
        id: x.id,
        concepto: x.concepto,
        fecha: x.fecha,
        importe: x.importe,
        pagadoPor: x.pagadoPor,
      })),
      facturas: suyas,
    };
  });

  /** Las que no salieron de ninguna cotización: se listan aparte. */
  const sueltas = servicios.filter((f) => f.cotizacionId === null);




  /**
   * El año en barras: cada trabajo cae entero en el mes en que se aprobó, con
   * lo que costó hacerlo.
   *
   * El gasto va al mes del trabajo y no al mes en que se hizo: un ciclo que se
   * aprobó en julio se sigue gastando en agosto y en septiembre, y con la fecha
   * del gasto esos meses mostraban un costo sin ningún ingreso al lado. Lo que
   * la barra contesta es qué dejó cada trabajo, no qué se pagó cada mes.
   */
  const mesesDeServicios: MesDeServicios[] = mesesDelAnio(new Date()).map((m) => {
    const delMes = ganadas.filter((c) => c.fecha.slice(0, 7) === m.clave);
    return {
      ...m,
      aprobado: delMes.reduce((n, c) => n + c.importe, 0),
      costo: delMes.reduce((n, c) => n + deLa(c.id).reduce((s, x) => s + x.importe, 0), 0),
    };
  });

  return (
    <>
      <div className="os-rotulo-seccion">Realizados</div>

      <Trabajos trabajos={trabajos} equipo={socios} />

      <MesAMes meses={mesesDeServicios} />

      <OtraFactura
        emisoras={emisoras}
        empresas={empresas}
        trabajos={ganadas.map((c) => ({ id: c.id, cliente: c.cliente, concepto: c.concepto }))}
        quien={quien}
      />

      {sueltas.length > 0 && <Facturado facturas={sueltas} />}
    </>
  );
}
