import { NextResponse } from 'next/server';
import { inquilinoDeLaSesion } from '@/lib/centro-sesion';
import { select } from '@/lib/supabase';
import { archivoDelRecibo, pdfDelRecibo } from '@/lib/recibo-centro-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PERIODO = /^\d{4}-\d{2}-01$/;

type Fila = {
  id: string;
  inquilino_id: string;
  tipo: string;
  fecha: string;
  periodo: string | null;
  importe: string | number;
  detalle: string | null;
};

/**
 * El recibo propio, en PDF.
 *
 * Se pide de dos maneras: con el identificador de un pago, y sale el recibo de
 * ese pago; o con un mes ("2026-09-01"), y sale uno solo que junta todos los
 * pagos de ese mes. Un mes pagado en cuatro transferencias es un papel y no
 * cuatro.
 *
 * Existe cuando el equipo registró el pago: el recibo dice que la plata se
 * recibió, y eso no lo puede decir quien la mandó. Siempre se filtra por la
 * persona de la cookie firmada: el pago de otro no existe para quien pregunta.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const yo = await inquilinoDeLaSesion();
  if (!yo) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  const filtro = PERIODO.test(params.id)
    ? `periodo=eq.${params.id}`
    : UUID.test(params.id)
      ? `id=eq.${params.id}`
      : null;
  if (!filtro) return NextResponse.json({ error: 'Ese pago no existe.' }, { status: 404 });

  const filas = await select<Fila>(
    'movimientos',
    `select=id,inquilino_id,tipo,fecha,periodo,importe,detalle&${filtro}&inquilino_id=eq.${yo.id}&tipo=eq.pago`
  );
  if (filas.length === 0) return NextResponse.json({ error: 'Ese pago no existe.' }, { status: 404 });

  const recibo = {
    inquilino: yo.nombre,
    periodo: filas[0].periodo,
    pagos: filas.map((m) => ({
      id: m.id,
      fecha: m.fecha,
      importe: Number(m.importe),
      detalle: m.detalle,
    })),
  };
  return new NextResponse(Buffer.from(await pdfDelRecibo(recibo)), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${archivoDelRecibo(recibo)}"`,
      'Cache-Control': 'no-store',
    },
  });
}
