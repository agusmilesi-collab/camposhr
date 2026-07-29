import { notFound } from 'next/navigation';
import { getLiderPorToken, listarEquipo } from '@/lib/supabase';
import VistaPlaybook from '@/app/_components/VistaPlaybook';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Playbook — Campos HR',
  robots: { index: false, follow: false },
};

export default async function PlaybookDelEquipo({
  params,
}: {
  params: { token: string; id: string };
}) {
  const lider = await getLiderPorToken(params.token);
  if (!lider) notFound();

  // Sólo su propia gente: el id tiene que pertenecer a este equipo.
  const persona = (await listarEquipo(lider.id)).find((r) => r.id === params.id);
  if (!persona) notFound();

  return (
    <main className="wrap pb-wrap">
      <section className="head no-print">
        <div className="head-top">
          <div className="eyebrow">Playbook de conducción</div>
          <a href={`/l/${params.token}`} className="volver">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
            Tu equipo
          </a>
        </div>
      </section>

      <VistaPlaybook persona={persona} />
    </main>
  );
}
