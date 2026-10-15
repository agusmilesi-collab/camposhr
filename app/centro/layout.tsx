import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { COOKIE_MIRANDO } from '@/lib/centro-cookie';
import './centro.css';

export const metadata: Metadata = {
  title: 'Centro Integral Santiago',
  description: 'Reservá tu consultorio.',
  robots: { index: false, follow: false },
};

/**
 * La banda de "mirando": quien entró con un pase desde el OS ve la zona tal
 * como la ve la persona, con este aviso arriba para que no se confunda con
 * su propia sesión. Nada de lo que toque se guarda.
 */
export default async function LayoutCentro({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const mirando = jar.get(COOKIE_MIRANDO)?.value === '1';
  return (
    <>
      {mirando && (
        <div className="centro-mirando">
          Estás mirando esta pantalla desde el OS, como la ve el inquilino. No se puede cambiar
          nada desde acá.
        </div>
      )}
      <div className="centro">{children}</div>
    </>
  );
}
