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
   * La firma de quien registró cada pago, para su recibo.
   *
   * Es la misma que va en los informes: vive en el bucket privado y entra como
   * `data:`, porque el recibo se guarda como PDF y una dirección firmada que
   * vence en una hora dejaría el papel sin firma al día siguiente. Se piden
   * solo las de quienes cobraron en esta ficha, y `firmaEnDatos` las deja en
   * memoria: son quince kilobytes que no cambian.
   *
   * Quien no tenga trazo cargado deja la línea en blanco, para firmar a mano.
   */
  const quienes = [...new Set(movimientos.filter((m) => m.tipo === 'pago').map((m) => m.quien))];
  const firmas: Record<string, { titulo: string; matricula: string; trazo: string | null }> = {};
  for (const quien of quienes) {
    const f = quien ? FIRMAS[quien] : null;
    if (!quien || !f) continue;
    firmas[quien] = {
      titulo: f.titulo,
      matricula: f.matricula,
      trazo: f.trazo ? await firmaEnDatos(f.trazo) : null,
    };
  }

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
        firmas={firmas}
        periodo={periodo}
        hoy={hoy}
      />
    </Shell>
  );
}
