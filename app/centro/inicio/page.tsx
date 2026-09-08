import { redirect } from 'next/navigation';
import { inquilinoDeLaSesion } from '@/lib/centro-sesion';
import Barra from '../Barra';
import EnObra from '../EnObra';

export const dynamic = 'force-dynamic';

export default async function Inicio() {
  const yo = await inquilinoDeLaSesion();
  if (!yo) redirect('/centro/entrar');

  return (
    <>
      <Barra nombre={yo.nombre} donde="/centro/inicio" />
      <EnObra
        titulo="Inicio"
        que="Lo que tenés hoy, lo que debés y lo que viene, en una pantalla."
      />
    </>
  );
}
