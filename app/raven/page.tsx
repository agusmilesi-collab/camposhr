import Test from './[token]/Test';
import { MINUTOS } from '@/lib/raven';
import './[token]/raven.css';

export const dynamic = 'force-static';

/**
 * El test de Raven, para mirarlo.
 *
 * Es la misma pantalla que ve el candidato, sin sesión y sin token: no guarda
 * nada ni corrige. Sirve para que el equipo sepa qué está mandando antes de
 * mandarlo, y para mostrárselo a un cliente que pregunta cómo es la prueba.
 */
export const metadata = {
  title: 'Test de razonamiento · vista de prueba',
  robots: { index: false, follow: false },
};

export default function RavenPrueba() {
  return <Test token="" respuestas={{}} restan={MINUTOS * 60} empezado={false} prueba />;
}
