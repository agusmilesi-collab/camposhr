import Link from 'next/link';
import { notFound } from 'next/navigation';
import { guionDe } from '@/lib/guion';
import Editor from './Editor';

export const dynamic = 'force-dynamic';

/**
 * El guion del expositor, editable.
 *
 * Un solo campo de texto: se escribe y se lee de corrido, sin atarlo a cada
 * placa. La primera vez aparece cargado con las notas que trae el deck, para
 * corregir sobre algo en vez de arrancar de cero.
 */
export default async function Guion({ params }: { params: { token: string } }) {
  const guion = await guionDe(params.token);
  if (!guion) notFound();

  return (
    <main className="wrap wrap-ancho">
      <section className="head">
        <div className="head-top">
          <div className="eyebrow">Notas del orador</div>
          <Link href={`/presentaciones/charla/${params.token}`} className="volver">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
            Encuentro
          </Link>
        </div>
        <h1>Guion</h1>
        <p className="head-nota">
          {guion.propio
            ? 'Se guarda al salir del campo, y con el botón.'
            : 'Arranca con las notas que trae el deck, una entrada por placa. Editalo como quieras: desde que lo guardes, manda este texto.'}
        </p>
      </section>

      <Editor token={params.token} inicial={guion.texto} propio={guion.propio} />
    </main>
  );
}
