import { notFound } from 'next/navigation';
import {
  firmarSelfies,
  getEmpresaPorSlug,
  listarLideres,
  listarRespuestas,
  type Variante,
} from '@/lib/supabase';
import { INFO, PERFILES, type Perfil } from '@/lib/perfiles';
import MatrizBenziger, { type Punto } from '@/app/_components/MatrizBenziger';
import AutoRefresco from './AutoRefresco';
import PantallaCompleta from './PantallaCompleta';
import Filtros from './Filtros';

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
  searchParams: { lider?: string; v?: string };
}) {
  const empresa = await getEmpresaPorSlug(params.slug);
  if (!empresa) notFound();

  const variante: Variante | '' =
    searchParams.v === 'perfil' || searchParams.v === 'generaciones'
      ? searchParams.v
      : '';
  const lider = searchParams.lider ?? '';

  const [todas, lideres] = await Promise.all([
    listarRespuestas(empresa.id, variante || undefined),
    listarLideres(empresa.id),
  ]);

  const respuestas = lider
    ? todas.filter((r) => r.lider_id === lider)
    : todas;

  const fotos = await firmarSelfies(
    respuestas.map((r) => r.foto_path).filter((p): p is string => Boolean(p))
  );

  const puntos: Punto[] = respuestas.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    x: r.eje_x,
    y: r.eje_y,
    foto: r.foto_path ? fotos.get(r.foto_path) ?? null : null,
  }));

  // Cada persona se cuenta en el cuadrante que encabeza su resultado.
  type Ficha = { nombre: string; detalle: string | null };
  const porCuadrante = new Map<Perfil, Ficha[]>(PERFILES.map((p) => [p, []]));
  for (const r of respuestas) {
    const principal = (r.perfiles?.[0] ?? null) as Perfil | null;
    if (principal && porCuadrante.has(principal)) {
      const partes = [r.generacion, r.lider_nombre].filter(Boolean);
      porCuadrante.get(principal)!.push({
        nombre: r.nombre,
        detalle: partes.length > 0 ? partes.join(' · ') : null,
      });
    }
  }

  const nombreLider = lideres.find((l) => l.id === lider)?.nombre;
  const filtrando = Boolean(lider || variante);

  function resumen(): string {
    if (respuestas.length === 0) {
      return filtrando
        ? 'Nadie responde a este filtro todavía.'
        : 'Todavía no respondió nadie. La matriz se completa a medida que el equipo termina el cuestionario.';
    }
    const cuantos = `${respuestas.length} ${
      respuestas.length === 1 ? 'persona' : 'personas'
    }`;
    const equipo = nombreLider ? ` del equipo de ${nombreLider}` : '';
    if (!filtrando) return `${cuantos}. La pantalla se actualiza sola.`;
    return `${cuantos}${equipo}. La pantalla se actualiza sola.`;
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
        <p className="head-nota">{resumen()}</p>

        <Filtros
          slug={empresa.slug}
          lideres={lideres.map((l) => ({ id: l.id, nombre: l.nombre }))}
          liderActual={lider}
          varianteActual={variante}
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
              {(porCuadrante.get(p) ?? []).map((ficha, i) => (
                <li key={`${ficha.nombre}-${i}`}>
                  {ficha.nombre}
                  {ficha.detalle && <em className="mx-detalle">{ficha.detalle}</em>}
                </li>
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
