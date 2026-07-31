import { notFound } from 'next/navigation';
import { getLiderPorToken, listarEquipo } from '@/lib/supabase';
import { coordenadas, INFO, PERFILES, type Perfil, type Puntajes } from '@/lib/perfiles';
import { nombreCompleto, porApellido, soloNombre } from '@/lib/personas';
import MatrizBenziger, { type Punto } from '@/app/_components/MatrizBenziger';

export const dynamic = 'force-dynamic';

/** Fecha corta de la respuesta: 14/11/25. */
function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

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

  const equipo = (await listarEquipo(lider.id)).sort(porApellido);

  // Dónde cae cada persona del equipo en la matriz.
  const puntos: Punto[] = equipo.map((r) => {
    const { x, y } = coordenadas(r.totales as unknown as Puntajes);
    return { id: r.id, nombre: nombreCompleto(r), x, y };
  });

  return (
    <main className="wrap wrap-matriz">
      <section className="head">
        <div className="eyebrow">{lider.empresa?.nombre}</div>
        <p className="eq-saludo">Hola, {soloNombre(lider.nombre)}</p>
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
        <section className="eq-matriz">
          <MatrizBenziger puntos={puntos} conDescripciones />
          <p className="eq-matriz-pie">
            Cuanto más arriba, más trabaja con ideas; cuanto más abajo, con el
            detalle. A la izquierda, la lógica y el procedimiento; a la derecha,
            lo creativo y lo relacional.
          </p>
        </section>
      )}

      {equipo.length > 0 && (
        <section className="eq-tabla">
          <div className="card">
            <div className="inf-fila inf-th">
              <span>Persona</span>
              <span>Perfil</span>
              <span className="inf-nums">FI</span>
              <span className="inf-nums">FD</span>
              <span className="inf-nums">BI</span>
              <span className="inf-nums">BD</span>
              <span>Generación</span>
              <span>Fecha</span>
              <span />
            </div>

            {equipo.map((r) => {
              const totales = (r.totales ?? {}) as Record<string, number>;
              const perfil = (r.perfiles?.[0] ?? '') as Perfil;
              return (
                <div className="inf-fila" key={r.id}>
                  <span className="acc-name">{nombreCompleto(r)}</span>
                  <span className="inf-perfil">
                    {perfil ? INFO[perfil].nombre : '—'}
                  </span>
                  {PERFILES.map((p) => (
                    <span
                      className={p === perfil ? 'inf-nums inf-nums-on' : 'inf-nums'}
                      key={p}
                    >
                      {totales[p] ?? '—'}
                    </span>
                  ))}
                  <span className="inf-suave">{r.generacion ?? '—'}</span>
                  <span className="inf-suave">{fechaCorta(r.created_at)}</span>
                  <a className="inf-ver" href={`/l/${params.token}/${r.id}`}>
                    Playbook
                  </a>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <footer className="foot">
        <div>Campos HR · uso interno del equipo de {lider.nombre}.</div>
      </footer>
    </main>
  );
}
