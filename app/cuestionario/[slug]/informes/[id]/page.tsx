import { notFound } from 'next/navigation';
import { getEmpresaPorSlug, listarRespuestas } from '@/lib/supabase';
import VistaPlaybook from '@/app/_components/VistaPlaybook';
import { detalleDe } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Playbook — Campos HR',
  robots: { index: false, follow: false },
};

export default async function PlaybookPersona({
  params,
}: {
  params: { slug: string; id: string };
}) {
  const empresa = await getEmpresaPorSlug(params.slug);
  if (!empresa) notFound();

  const respuestas = await listarRespuestas(empresa.id, 'generaciones');
  const persona = respuestas.find((r) => r.id === params.id);
  if (!persona) notFound();

  // Las frases que marcó viven en el detalle crudo, aparte del listado.
  const detalle = await detalleDe(persona.id);

  return (
    <main className="wrap pb-wrap">
      <section className="head no-print">
        <div className="head-top">
          <div className="eyebrow">Playbook de conducción</div>
          <a href={`/cuestionario/${empresa.slug}/informes`} className="volver">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
            Informes
          </a>
        </div>
      </section>

      <VistaPlaybook persona={{ ...persona, detalle }} />
    </main>
  );
}
