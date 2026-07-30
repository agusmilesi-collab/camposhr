import { notFound } from 'next/navigation';
import {
  firmarSelfies,
  getEmpresaPorSlug,
  listarRespuestas,
} from '@/lib/supabase';
import {
  coordenadas,
  INFO,
  PERFILES,
  type Perfil,
  type Puntajes,
} from '@/lib/perfiles';
import MatrizBenziger, { type Punto } from '@/app/_components/MatrizBenziger';
import AutoRefresco from './AutoRefresco';
import PantallaCompleta from './PantallaCompleta';
import Tandas from '../informes/Tandas';
import { filtrarTanda } from '@/lib/tandas';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Matriz de perfiles — Campos HR',
  robots: { index: false, follow: false },
};

export default async function MatrizEmpresa({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { tanda?: string };
}) {
  const empresa = await getEmpresaPorSlug(params.slug);
  if (!empresa) notFound();

  // La matriz es la pantalla del taller: muestra el cuestionario de perfil.
  // Lo que responde el de liderazgo alimenta los informes, no esta vista.
  const todas = await listarRespuestas(empresa.id, 'perfil');
  const { tanda, filtradas: respuestas, tandas } = filtrarTanda(
    todas,
    searchParams.tanda
  );

  const fotos = await firmarSelfies(
    respuestas.map((r) => r.foto_path).filter((p): p is string => Boolean(p))
  );

  // La posición se deriva de los totales, no de las columnas guardadas: así
  // un cambio de criterio reubica también las respuestas ya cargadas.
  const puntos: Punto[] = respuestas.map((r) => {
    const { x, y } = coordenadas(r.totales as unknown as Puntajes);
    return {
      id: r.id,
      nombre: r.nombre,
      x,
      y,
      foto: r.foto_path ? fotos.get(r.foto_path) ?? null : null,
    };
  });

  // Cada persona se cuenta en el cuadrante que encabeza su resultado.
  const porCuadrante = new Map<Perfil, string[]>(PERFILES.map((p) => [p, []]));
  for (const r of respuestas) {
    const principal = (r.perfiles?.[0] ?? null) as Perfil | null;
    if (principal && porCuadrante.has(principal)) {
      porCuadrante.get(principal)!.push(r.nombre);
    }
  }

  return (
    <main className="wrap wrap-matriz">
      <section className="head no-print">
        <div className="head-top">
          <div className="eyebrow">Cuestionario de perfil</div>
          <a href="/cuestionario" className="volver">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
            Empresas
          </a>
        </div>
        <h1>{empresa.nombre}</h1>
        <p className="head-nota">
          {respuestas.length === 0
            ? 'Todavía no respondió nadie. La matriz se completa a medida que el equipo termina el cuestionario.'
            : `${respuestas.length} ${
                respuestas.length === 1 ? 'persona' : 'personas'
              }. La pantalla se actualiza sola.`}
        </p>
        <Tandas
          base={`/cuestionario/${empresa.slug}/matriz`}
          tandas={tandas}
          actual={tanda}
        />
        <AutoRefresco />
      </section>

      <section className="mx-bloque">
        <PantallaCompleta>
          <MatrizBenziger puntos={puntos} conDescripciones />
        </PantallaCompleta>
      </section>

      <section className="mx-listas">
        {PERFILES.map((p) => (
          <div className="mx-lista" key={p}>
            <h2>{INFO[p].nombre}</h2>
            <ul>
              {(porCuadrante.get(p) ?? []).map((nombre, i) => (
                <li key={`${nombre}-${i}`}>{nombre}</li>
              ))}
            </ul>
            {(porCuadrante.get(p) ?? []).length === 0 && (
              <p className="mx-vacio">Nadie por ahora.</p>
            )}
          </div>
        ))}
      </section>
    </main>
  );
}
