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
        <p className="eyebrow">Conversaciones difíciles</p>
        <h1>Lo que te llevás</h1>
      </header>

      {/* Lo propio se pide desde el teléfono, que es el que sabe quién sos. */}
      <Yo slug={params.slug} inicial={searchParams?.a ?? null} />

      {repaso && (
        <>
          <section className="rs-bloque">
            <h2>Los tres conceptos</h2>
            <ol className="rs-conceptos">
              {repaso.conceptos.map((c) => (
                <li key={c.titulo}>
                  <b>{c.titulo}</b>
                  <p>{c.bajada}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="rs-bloque">
            <h2>Los cinco momentos</h2>
            <ol className="rs-momentos">
              {repaso.momentos.map((m) => (
                <li key={m.numero}>
                  <span className="rs-momento-num">{m.numero}</span>
                  <div>
                    <b>{m.nombre}</b>
                    <p>{m.que}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="rs-bloque">
            <h2>De adjetivo a hecho</h2>
            <div className="rs-traducciones">
              {repaso.traducciones.map((t) => (
                <div className="rs-traduccion" key={t.juicio}>
                  <p className="rs-juicio">{t.juicio}</p>
                  <p className="rs-hecho">{t.hecho}</p>
                </div>
              ))}
            </div>
            <p className="rs-remate">Un adjetivo no se puede repetir, un hecho sí.</p>
          </section>
        </>
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

      <footer className="rs-pie">Campos HR · 24 de septiembre de 2026</footer>
    </main>
  );
}
