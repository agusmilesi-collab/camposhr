import { notFound } from 'next/navigation';
import {
  actividadesDelCiclo,
  getCiclo,
  listarAportes,
  listarAsistentes,
  resolverCiclo,
  type Aporte,
} from '@/lib/ciclo';
import { REPASOS } from '@/lib/resumen-charla';
import Yo from './Yo';
import Descargar from './Descargar';

/**
 * El repaso de la charla, en el teléfono de cada uno.
 *
 * Es el destino del código de la última placa. Trae tres cosas en este orden:
 * lo que escribió esa persona, el método, y lo que dejaron los que llevan años
 * en el rol.
 *
 * Lo propio va primero porque es lo único que no puede conseguir en otro lado:
 * su conversación preparada con la fecha en que dijo que la iba a tener. El
 * método abajo, para volver a leerlo el día que la tenga.
 *
 * Quién es se resuelve con la marca que el teléfono ya tiene de haber
 * respondido: no hay que volver a identificarse para leer lo propio.
 */

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Lo que te llevás — Campos HR',
  robots: { index: false, follow: false },
};

export default async function Resumen({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { a?: string };
}) {
  const ciclo = await resolverCiclo(params.slug);
  if (!ciclo) notFound();
  const { corrida } = ciclo;

  const elCiclo = await getCiclo(corrida.ciclo_id);
  const repaso = REPASOS[elCiclo?.nombre ?? ''] ?? null;

  const catalogo = await actividadesDelCiclo(corrida.ciclo_id);
  const dePregunta = catalogo.find((a) => a.clave === 'cd-pregunta');

  const [sala, preguntas] = await Promise.all([
    listarAsistentes(corrida.id),
    dePregunta ? listarAportes(corrida.id, dePregunta.id) : Promise.resolve([] as Aporte[]),
  ]);

  // Lo que dejaron los que llevan años: sin nombres, como se escribió.
  const porId = new Map(sala.map((a) => [a.id, a]));
  const delOficio = preguntas
    .filter((a) => porId.get(a.asistente_id)?.datos?.rol === 'Más de un año')
    .map((a) => (a.valor?.tipo === 'texto' ? a.valor.texto : ''))
    .filter((t) => t.trim() !== '');

  return (
    <main className="wrap rs">
      <header className="rs-head">
        {/* Las mismas dos marcas del cierre del encuentro: el resumen circula
            como PDF y tiene que decir de quién es. */}
        <div className="rs-marcas">
          <span className="rs-campos">Campos HR</span>
          <img src="/marcas/sentir.svg" alt="Sentir Mindfulness" />
        </div>
        <p className="eyebrow">Conversaciones difíciles</p>
        <h1>Lo que te llevás</h1>
        <Descargar />
      </header>

      {/* Lo propio se pide desde el teléfono, que es el que sabe quién sos. */}
      <Yo slug={params.slug} inicial={searchParams?.a ?? null} />

      {repaso && (
        <section className="rs-bloque">
          <h2>El camino de una conversación difícil</h2>
          {/* Lo que se enseñó, en el orden en que se hace. Los pasos se
              numeran corrido a través de las etapas. */}
          <div className="rs-camino">
            {(() => {
              let n = 0;
              return repaso.camino.map((etapa) => (
                <div className={`rs-etapa rs-etapa-${etapa.tono}`} key={etapa.nombre}>
                  <p className="rs-etapa-nombre">
                    {etapa.nombre}
                    {etapa.detalle && <span>{etapa.detalle}</span>}
                  </p>
                  <ol>
                    {etapa.pasos.map((p) => {
                      n += 1;
                      return (
                        <li key={p.titulo}>
                          <span className="rs-camino-num">{n}</span>
                          <div>
                            <b>{p.titulo}</b>
                            <p>{p.texto}</p>
                            {p.detalle?.map((d, k) => (
                              <div className="rs-paso-detalle" key={k}>
                                {d.titulo && <p className="rs-detalle-titulo">{d.titulo}</p>}
                                <ul>
                                  {d.items.map((it, j) => (
                                    <li key={j}>
                                      {it.juicio && <s className="rs-detalle-juicio">{it.juicio}</s>}
                                      {it.nombre && <strong>{it.nombre}. </strong>}
                                      {it.texto}
                                    </li>
                                  ))}
                                </ul>
                                {d.nota && <p className="rs-detalle-nota">{d.nota}</p>}
                              </div>
                            ))}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                  {etapa.nota && <p className="rs-etapa-nota">{etapa.nota}</p>}
                </div>
              ));
            })()}
          </div>
        </section>
      )}

      {repaso?.aparte && (
        <section className="rs-bloque">
          <div className="rs-aparte">
            <b>{repaso.aparte.titulo}</b>
            <p>{repaso.aparte.bajada}</p>
          </div>
        </section>
      )}

      {delOficio.length > 0 && (
        <section className="rs-bloque">
          <h2>Lo que dejaron los que llevan años</h2>
          <p className="rs-bajada">
            Lo escribió la sala, sin nombres. Es lo que nadie le explica al que
            recién empieza a liderar.
          </p>
          <ul className="rs-oficio">
            {delOficio.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </section>
      )}

      <footer className="rs-pie">
        <a href="https://www.camposhr.com">www.camposhr.com</a> · 24 de septiembre de 2026
      </footer>
    </main>
  );
}
