import { redirect } from 'next/navigation';
import { inquilinoDeLaSesion } from '@/lib/centro-sesion';
import Barra from '../Barra';
import EnObra from '../EnObra';

export const dynamic = 'force-dynamic';

export default async function Turnos() {
  const yo = await inquilinoDeLaSesion();
  if (!yo) redirect('/centro/entrar');

  return (
    <>
      <Barra nombre={yo.nombre} donde="/centro/turnos" />
      <EnObra
        titulo="Mis turnos"
        que="La agenda de tus pacientes adentro de las horas que alquilás, para no llevarla en otro lado."
      />
    </>
  );
}
