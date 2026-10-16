import { notFound, redirect } from 'next/navigation';
import { inquilinoDeLaSesion } from '@/lib/centro-sesion';
import { hoyISO } from '@/lib/consultorios';
import { evolucionesDe, pacienteDe } from '@/lib/pacientes';
import { turnosDelPaciente } from '@/lib/turnos';
import Barra from '../../Barra';
import Ficha from './Ficha';

export const dynamic = 'force-dynamic';

/** La ficha de un paciente, en tres pestañas: datos, historia clínica y cuenta. */
export default async function PacientePagina(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ver?: string }>;
}) {
  const { id } = await props.params;
  const { ver } = await props.searchParams;
  const vista: 'ficha' | 'historia' | 'cuenta' = ver === 'historia' || ver === 'cuenta' ? ver : 'ficha';
  const yo = await inquilinoDeLaSesion();
  if (!yo) redirect('/centro/entrar');
  if (yo.mirando) redirect('/centro/pacientes');

  const paciente = await pacienteDe(yo.id, id);
  if (!paciente) notFound();
  const [evoluciones, turnos] = await Promise.all([evolucionesDe(yo.id, id), turnosDelPaciente(yo.id, id)]);

  return (
    <>
      <Barra nombre={yo.nombre} donde="/centro/pacientes" />
      <Ficha
        paciente={paciente}
        evoluciones={evoluciones}
        hoy={hoyISO()}
        vista={vista}
        turnos={turnos.map((t) => ({
          id: t.id,
          fecha: t.fecha,
          hora: Number(t.desde_hora.slice(0, 2)),
          pagado: t.pagado,
          cobrado: t.cobrado === null ? null : Number(t.cobrado),
        }))}
      />
    </>
  );
}
