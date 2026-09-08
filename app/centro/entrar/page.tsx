import { redirect } from 'next/navigation';
import { inquilinoDeLaSesion } from '@/lib/centro-sesion';
import Entrar from './Entrar';

export const dynamic = 'force-dynamic';

/** La puerta. Quien ya tiene sesión no la ve. */
export default async function Puerta() {
  const yo = await inquilinoDeLaSesion();
  if (yo) redirect('/centro');
  return <Entrar />;
}
