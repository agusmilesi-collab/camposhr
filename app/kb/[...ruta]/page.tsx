import Link from 'next/link';
import { notFound } from 'next/navigation';
import { leerKb } from '@/lib/kb';
import { markdown } from '@/lib/markdown';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Campos HR — Knowledge base',
  robots: { index: false, follow: false },
};

/** Un documento de la base, tal como está escrito en el repo. */
export default async function Documento({ params }: { params: { ruta: string[] } }) {
  const doc = await leerKb(params.ruta.join('/'));
  if (!doc) notFound();

  return (
    <main className="wrap wrap-ancho">
      <section className="head">
        <div className="head-top">
          <div className="eyebrow">
            {doc.clase === 'tema'
              ? 'Tema'
              : doc.clase === 'ejercicio'
                ? 'Ejercicio'
                : doc.clase === 'armado'
                  ? 'Armado'
                  : 'Base de conocimiento'}
          </div>
          <Link href="/kb" className="volver">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
            Knowledge base
          </Link>
        </div>
        <h1>{doc.titulo}</h1>
      </section>

      {/* El texto sale del Markdown del repo: acá no se edita, se lee. */}
      <article className="card kb-doc" dangerouslySetInnerHTML={{ __html: markdown(doc.contenido) }} />

      <p className="precios-nota kb-pie">
        Se edita en el repo <code>campos-kb</code>, en <code>{doc.ruta}.md</code>, y se sube con{' '}
        <code>node scripts/kb-sync.mjs</code>.
      </p>
    </main>
  );
}
