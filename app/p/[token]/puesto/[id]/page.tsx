import { notFound } from 'next/navigation';
import { empresaDelToken } from '@/lib/portal-supabase';
import { select } from '@/lib/supabase';
import { llevaDiscursivo } from '@/lib/discursivo';
import { DEL_JEFE, DEL_PUESTO } from '@/lib/pedido-campos';
import Puesto from './Puesto';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Campos HR — Cómo es el puesto',
  robots: { index: false, follow: false },
};

/**
 * El perfil del puesto y su alcance, para que los complete el cliente.
 *
 * Es el mismo dato que el equipo carga en la ficha del pedido, pestañas
 * "Perfil del puesto" y "Potencial": se le manda este enlace a quien pidió la
 * búsqueda y lo contesta él, que es quien conoce el puesto y a su jefe. Lo que
 * ya esté cargado aparece marcado, así se completa o se corrige.
 *
 * **Se cuelga del enlace del portal del cliente**: el pedido tiene que ser de
 * la empresa de ese enlace, y si no, la página no existe.
 */

type Fila = {
  id: string;
  puesto: string;
  time_span_dias: number | null;
  complejidad: Record<string, boolean> | null;
  baterias: { tests: string[] | null } | null;
} & Record<string, unknown>;

export default async function CompletarPuesto({
  params,
}: {
  params: { token: string; id: string };
}) {
  const empresa = await empresaDelToken(params.token);
  if (!empresa) notFound();

  const campos = [...DEL_PUESTO, ...DEL_JEFE].map((p) => p.campo).join(',');
  const filas = await select<Fila>(
    'pedidos',
    `select=id,puesto,time_span_dias,complejidad,baterias(tests),${campos}` +
      `&id=eq.${encodeURIComponent(params.id)}&empresa_id=eq.${empresa.id}&limit=1`
  ).catch(() => []);
  const pedido = filas[0];
  if (!pedido) notFound();

  const perfil: Record<string, string> = {};
  for (const p of [...DEL_PUESTO, ...DEL_JEFE]) {
    const v = pedido[p.campo];
    if (typeof v === 'string' && v) perfil[p.campo] = v;
  }

  return (
    <Puesto
      token={params.token}
      pedidoId={pedido.id}
      empresa={empresa.nombre}
      puesto={pedido.puesto}
      delPuesto={DEL_PUESTO}
      delJefe={DEL_JEFE}
      perfilInicial={perfil}
      conPotencial={llevaDiscursivo(pedido.baterias?.tests ?? null)}
      diasInicial={pedido.time_span_dias}
      complejidadInicial={pedido.complejidad ?? {}}
    />
  );
}
