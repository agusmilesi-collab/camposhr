import Test from './[token]/Test';
import { SERIES, serieDe } from '@/lib/raven';
import './[token]/raven.css';

export const dynamic = 'force-dynamic';

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

/** `?serie=12` muestra la serie corta; sin nada, la de 36. */
export default async function RavenPrueba(props: { searchParams: Promise<{ serie?: string }> }) {
  const serie = serieDe((await props.searchParams).serie);
  return (
    <Test
      token=""
      respuestas={{}}
      restan={SERIES[serie].minutos * 60}
      empezado={false}
      serie={serie}
      prueba
    />
  );
}
