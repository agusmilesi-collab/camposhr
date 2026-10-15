import { notFound, redirect } from 'next/navigation';
import { inquilinoDeLaSesion } from '@/lib/centro-sesion';
import { hoyISO } from '@/lib/consultorios';
import { evolucionesDe, pacienteDe } from '@/lib/pacientes';
import Barra from '../../Barra';
import Ficha from './Ficha';

export const dynamic = 'force-dynamic';

/** La ficha de un paciente: datos, antecedentes e historia clínica. */
export default async function PacientePagina(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const yo = await inquilinoDeLaSesion();
  if (!yo) redirect('/centro/entrar');
  if (yo.mirando) redirect('/centro/pacientes');

  const paciente = await pacienteDe(yo.id, id);
  if (!paciente) notFound();
  const evoluciones = await evolucionesDe(yo.id, id);

  return (
    <>
      <Barra nombre={yo.nombre} donde="/centro/pacientes" />
      <Ficha paciente={paciente} evoluciones={evoluciones} hoy={hoyISO()} />
    </>
  );
}
