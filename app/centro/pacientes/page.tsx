import { redirect } from 'next/navigation';
import { inquilinoDeLaSesion } from '@/lib/centro-sesion';
import Barra from '../Barra';
import EnObra from '../EnObra';

export const dynamic = 'force-dynamic';

export default async function Pacientes() {
  const yo = await inquilinoDeLaSesion();
  if (!yo) redirect('/centro/entrar');

  return (
    <>
      <Barra nombre={yo.nombre} donde="/centro/pacientes" />
      <EnObra titulo="Pacientes" que="La ficha de cada uno, con su historia y sus turnos." />
    </>
  );
}
