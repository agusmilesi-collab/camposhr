import { notFound } from 'next/navigation';
import { getEmpresaPorSlug, listarRespuestas } from '@/lib/supabase';
import { INFO, PERFILES, type Perfil, type Puntajes, MAXIMO } from '@/lib/perfiles';
import { GENERACIONES, INFO_GENERACION, type Generacion } from '@/lib/generaciones';
import { armarPlaybook, opuesto, ranking } from '@/lib/playbook';
import Playbook from './Playbook';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Playbook — Campos HR',
  robots: { index: false, follow: false },
};

/** De la etiqueta guardada ("X", "Boomer/Y") al código de la primera generación. */
function generacionDe(etiqueta: string | null): Generacion | null {
  const corto = (etiqueta ?? '').split('/')[0];
  return GENERACIONES.find((g) => INFO_GENERACION[g].corto === corto) ?? null;
}

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

  const totales = persona.totales as unknown as Puntajes;
  const perfil = (persona.perfiles?.[0] ?? 'BD') as Perfil;
  const generacion = generacionDe(persona.generacion);
  const playbook = armarPlaybook(perfil, generacion);

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

      {/* Encabezado: quién es y su perfil de un vistazo */}
      <section className="pb-cabecera">
        <div>
          <h1>{persona.nombre}</h1>
          {persona.lider_nombre && (
            <p className="pb-lider">Líder: {persona.lider_nombre}</p>
          )}
        </div>
        <div className="pb-chips">
          <span className="pb-chip pb-chip-fuerte">
            {INFO[perfil].nombre} · {totales[perfil]}
          </span>
          {generacion && (
            <span className="pb-chip">{INFO_GENERACION[generacion].nombre}</span>
          )}
        </div>
      </section>

      {/* Los cuatro puntajes */}
      <section className="pb-puntajes">
        {PERFILES.map((p) => (
          <div className={p === perfil ? 'pb-puntaje pb-puntaje-on' : 'pb-puntaje'} key={p}>
            <span className="pb-puntaje-n">{totales[p]}</span>
            <span className="pb-puntaje-l">{INFO[p].nombre}</span>
            <span className="pb-barra">
              <span style={{ width: `${(totales[p] / MAXIMO) * 100}%` }} />
            </span>
          </div>
        ))}
      </section>

      <p className="pb-lectura">
        Su cuadrante dominante es <b>{INFO[perfil].nombre}</b>. El opuesto en
        diagonal, <b>{INFO[opuesto(perfil)].nombre}</b> ({totales[opuesto(perfil)]} puntos),
        es el que más energía le consume: las tareas de ese tipo le cuestan el doble
        aunque pueda hacerlas.
      </p>

      <Playbook
        dimensiones={playbook.dimensiones}
        semanas={playbook.semanas}
        faltantes={playbook.faltantes.length}
      />

      <section className="pb-orden no-print">
        <h2>Orden de sus cuadrantes</h2>
        <ol>
          {ranking(totales).map((r) => (
            <li key={r.perfil}>
              {INFO[r.perfil].nombre} <em>{r.total}</em>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
