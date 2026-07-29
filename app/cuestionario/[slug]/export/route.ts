import { NextResponse } from 'next/server';
import { exportarRespuestas, getEmpresaPorSlug } from '@/lib/supabase';
import { PERFILES } from '@/lib/perfiles';
import { GENERACIONES, type PuntajesGeneracion } from '@/lib/generaciones';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Exporta las respuestas de una empresa en CSV, para armar los informes.
 * Una fila por persona, con los cuatro puntajes abiertos.
 */
export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const empresa = await getEmpresaPorSlug(params.slug);
  if (!empresa) return new NextResponse('Empresa no encontrada', { status: 404 });

  const filas = await exportarRespuestas(empresa.id);

  const encabezado = [
    'fecha',
    'empresa',
    'variante',
    'lider',
    'apellido',
    'nombre',
    'generacion',
    ...PERFILES.map((p) => `total_${p}`),
    'perfil_1',
    'perfil_2',
    'tipo_resultado',
    'autopercepcion',
    ...GENERACIONES.map((g) => `gen_${g}`),
    'con_foto',
  ];

  const lineas = filas.map((r) => {
    const detalle = (r.detalle ?? {}) as { autopercepcion?: string };
    const totales = (r.totales ?? {}) as Record<string, number>;
    const extra = (r.extra ?? {}) as {
      generaciones?: { puntajes?: PuntajesGeneracion };
    };
    const puntajesGen = extra.generaciones?.puntajes;
    return [
      r.created_at,
      empresa.nombre,
      r.variante,
      r.lider_nombre ?? '',
      r.apellido ?? '',
      r.nombre,
      r.generacion ?? '',
      ...PERFILES.map((p) => String(totales[p] ?? '')),
      r.perfiles?.[0] ?? '',
      r.perfiles?.[1] ?? '',
      r.resultado,
      detalle.autopercepcion ?? '',
      ...GENERACIONES.map((g) =>
        puntajesGen ? String(puntajesGen[g] ?? 0) : ''
      ),
      r.foto_path ? 'sí' : 'no',
    ];
  });

  const csv = [encabezado, ...lineas]
    .map((fila) => fila.map(celda).join(','))
    .join('\n');

  return new NextResponse(`﻿${csv}`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="cuestionario-${empresa.slug}.csv"`,
    },
  });
}

/** Escapa una celda para CSV. */
function celda(valor: string): string {
  const texto = String(valor ?? '');
  return /[",\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}
