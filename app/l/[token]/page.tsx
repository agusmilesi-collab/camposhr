import { notFound } from 'next/navigation';
import { getLiderPorToken, listarEquipo } from '@/lib/supabase';
import { INFO, type Perfil } from '@/lib/perfiles';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Tu equipo — Campos HR',
  robots: { index: false, follow: false },
};

/**
 * Portal del líder. Entra con su enlace, sin cuenta ni contraseña, y ve el
 * playbook de cada persona de su equipo. Nada más: ni otros equipos, ni la
 * pantalla interna del cuestionario.
 */
export default async function EquipoDelLider({
  params,
}: {
  params: { token: string };
}) {
  const lider = await getLiderPorToken(params.token);
  if (!lider) notFound();

  const equipo = await listarEquipo(lider.id);

  return (
    <main className="wrap pb-wrap">
      <section className="head">
        <div className="eyebrow">{lider.empresa?.nombre}</div>
        <h1>Tu equipo</h1>
        <p className="head-nota">
          {equipo.length === 0
            ? 'Todavía no hay respuestas cargadas para tu equipo.'
            : `${equipo.length} ${
                equipo.length === 1 ? 'persona' : 'personas'
              }. Entrá en cada una para ver cómo conducirla: qué la motiva, cómo darle feedback y una acción concreta por semana.`}
        </p>
      </section>

      {equipo.length > 0 && (
        <section className="eq-lista">
          {equipo.map((r) => {
            const perfil = (r.perfiles?.[0] ?? '') as Perfil;
            return (
              <a className="eq-persona" href={`/l/${params.token}/${r.id}`} key={r.id}>
                <span className="eq-nombre">{r.nombre}</span>
                <span className="eq-datos">
                  {perfil ? INFO[perfil].nombre : '—'}
                  {r.generacion && ` · ${r.generacion}`}
                </span>
                <span className="eq-flecha" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                </span>
              </a>
            );
          })}
        </section>
      )}

      <footer className="foot">
        <div>Campos HR · uso interno del equipo de {lider.nombre}.</div>
      </footer>
    </main>
  );
}
