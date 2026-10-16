import { redirect } from 'next/navigation';
import { inquilinoDeLaSesion } from '@/lib/centro-sesion';
import HojaNormas from './Hoja';

export const dynamic = 'force-dynamic';

/**
 * Las normas de convivencia, completas, para quien todavía no entró: la hoja
 * sola, sin barra. Con sesión se leen y se aceptan en Documentos, así que
 * esta dirección lleva ahí.
 */
export default async function Normas() {
  const yo = await inquilinoDeLaSesion();
  if (yo) redirect('/centro/documentos?ver=normas');

  return (
    <main className="centro-cuerpo centro-cuerpo-hoja" style={{ gridColumn: '1 / -1', margin: '0 auto' }}>
      <HojaNormas />
    </main>
  );
}
