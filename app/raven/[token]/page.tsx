import { notFound } from 'next/navigation';
import Test from './Test';
import { seAcabo, segundosRestantes, sesionPorToken } from '@/lib/raven-test';
import { esPruebaDeRaven } from '@/lib/laminas-enlace';
import { SERIES, serieDe } from '@/lib/raven';
import './raven.css';

export const dynamic = 'force-dynamic';

/**
 * El test de Raven, servido por su enlace.
 *
 * Sin sesión del OS: quien entra es la persona evaluada. El token es toda la
 * credencial, así que la página no dice de quién es la evaluación ni de qué
 * empresa: si el enlace se comparte por error, no expone a nadie.
 */
export const metadata = {
  title: 'Test de razonamiento',
  robots: { index: false, follow: false },
};

export default async function RavenPagina(props: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ serie?: string }>;
}) {
  const params = await props.params;
  // El enlace de prueba que se copia desde Herramientas: el mismo test, sin
  // guardar nada. El token va para que las láminas abran sin sesión del OS.
  if (params.token.startsWith('lm_')) {
    if (!(await esPruebaDeRaven(params.token))) notFound();
    // En la prueba se elige la serie por la dirección (`?serie=12`).
    const serie = serieDe((await props.searchParams).serie);
    return (
      <Test
        token={params.token}
        respuestas={{}}
        restan={SERIES[serie].minutos * 60}
        empezado={false}
        serie={serie}
        prueba
      />
    );
  }

  const s = await sesionPorToken(params.token);
  if (!s) notFound();

  if (s.terminado_at || seAcabo(s)) {
    return (
      <main className="rv rv-centrado">
        <h1>Este test ya se entregó</h1>
        <p>Gracias por tu tiempo. Si creés que hubo un error, escribile a quien te lo mandó.</p>
      </main>
    );
  }

  return (
    <Test
      token={s.token}
      respuestas={s.respuestas ?? {}}
      restan={segundosRestantes(s.iniciado_at, s.laminas)}
      empezado={s.iniciado_at !== null}
      serie={s.laminas}
    />
  );
}
