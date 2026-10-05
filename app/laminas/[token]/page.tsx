import { TESTS } from '@/lib/laminas';
import { testDelToken } from '@/lib/laminas-enlace';
import Placas from '@/app/os/laminas/[test]/Placas';
import '@/app/os/laminas/[test]/placas.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Láminas — Campos HR', robots: { index: false, follow: false } };

/**
 * Las láminas en la pantalla de la persona evaluada.
 *
 * Es la misma pantalla que usa la evaluadora (`/os/laminas/<test>`), abierta
 * con un token en vez de la clave del equipo: en la encuesta la persona señala
 * dónde vio cada cosa, y para eso necesita la lámina con su propio cursor.
 *
 * No se mueve sola con la pantalla de codificación: ese aviso viaja entre
 * pestañas de un mismo navegador y acá hay dos máquinas. La persona pasa de
 * lámina cuando la evaluadora se lo pide.
 */
export default async function Laminas({ params }: { params: { token: string } }) {
  const test = await testDelToken(params.token);
  if (!test) {
    return (
      <main style={{ maxWidth: 420, margin: '18vh auto', padding: '0 24px', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>Este enlace ya no está disponible</h1>
        <p style={{ color: '#555', lineHeight: 1.5 }}>
          Los enlaces de las láminas duran un día. Pedile uno nuevo a quien te está entrevistando.
        </p>
      </main>
    );
  }
  return <Placas test={test} total={TESTS[test].laminas} fuente={`/api/laminas/${params.token}`} />;
}
