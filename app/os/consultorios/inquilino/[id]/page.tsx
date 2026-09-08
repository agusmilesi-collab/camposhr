import { notFound } from 'next/navigation';
import Shell from '../../../Shell';
import { quienSoy } from '@/lib/identidad';
import { cuentasDeLaBarra } from '@/app/os/psicotecnicos/datos';
import {
  contratos as leerContratos,
  hoyISO,
  inquilinoPorId,
  listarEspacios,
  mesLargo,
  movimientosDe,
  periodoDe,
  reservasDe,
} from '@/lib/consultorios';
import { FIRMAS } from '@/lib/informe-textos';
import { firmaEnDatos } from '@/lib/firmas';
import Ficha from './Ficha';

export const dynamic = 'force-dynamic';

/**
 * La pantalla de un inquilino.
 *
 * La lista abría un panel debajo de la tabla y ahí vivía todo: los datos, la
 * cuenta del mes y el cobro. Con eso, para mirar a alguien había que perder de
 * vista a los demás, la dirección no decía a quién se estaba mirando (así que
 * no se podía compartir ni volver) y su historia no entraba en ningún lado.
 *
 * Acá cada persona tiene su dirección y su pantalla: qué alquila, cómo le fue
 * mes a mes, la cuenta del mes que se elija y el resumen que se le manda.
 */
export default async function InquilinoFicha({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { periodo?: string };
}) {
  const yo = await quienSoy();
  const cuentas = await cuentasDeLaBarra();
  const inquilino = await inquilinoPorId(params.id);
  if (!inquilino) notFound();

  const hoy = hoyISO();
  const periodo = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.periodo ?? '')
    ? (searchParams.periodo as string)
    : periodoDe(hoy);

  const [espacios, contratos, movimientos, reservas] = await Promise.all([
    listarEspacios(),
    leerContratos(),
    movimientosDe(params.id),
    reservasDe(params.id),
  ]);

  /**
   * La firma del recibo.
   *
   * **Siempre la de Lucila**, que es quien firma los recibos del Centro, y no
   * la de quien registró el pago: un pago lo puede cargar cualquiera del equipo
   * y el papel lo emite una sola persona. Quién lo cargó queda anotado en el
   * movimiento, que es donde sirve.
   *
   * Firma como titular del Centro y no con su matrícula: es el mismo trazo que
   * va en los informes, pero el cargo que lo acompaña es otro.
   *
   * Es la misma firma que va en los informes: vive en el bucket privado y entra
   * como `data:`, porque el recibo se guarda como PDF y una dirección firmada
   * que vence en una hora dejaría el papel sin firma al día siguiente.
   */
  const QUIEN_FIRMA = 'Lucila Campos';
  const suya = FIRMAS[QUIEN_FIRMA];
  const firma = suya
    ? {
        nombre: QUIEN_FIRMA,
        // Acá firma como dueña del Centro y no como psicóloga: la matrícula
        // avala un informe psicológico, no el recibo de un alquiler, y ponerla
        // en un comprobante de plata dice algo que no corresponde.
        cargo: 'Titular · Centro Integral Santiago',
        trazo: suya.trazo ? await firmaEnDatos(suya.trazo) : null,
      }
    : null;

  return (
    <Shell
      titulo="Consultorios"
      identidad={yo.nombre}
      cuentas={cuentas}
      nota={mesLargo(periodo)}
      ancho
    >
      <Ficha
        inquilino={inquilino}
        espacios={espacios}
        contratos={contratos.filter((c) => c.inquilino_id === params.id)}
        movimientos={movimientos}
        reservas={reservas}
        firma={firma}
        periodo={periodo}
        hoy={hoy}
      />
    </Shell>
  );
}
