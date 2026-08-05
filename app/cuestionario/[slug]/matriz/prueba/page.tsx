import { notFound } from 'next/navigation';
import { getEmpresaPorSlug, listarRespuestas } from '@/lib/supabase';
import {
  coordenadas,
  INFO,
  PERFILES,
  type Perfil,
  type Puntajes,
} from '@/lib/perfiles';
import MatrizBenziger, { type Punto } from '@/app/_components/MatrizBenziger';
import { nombreCompleto, porApellido } from '@/lib/personas';
import { MAXIMO_FICTICIAS, personasFicticias } from '@/lib/ficticias';

/**
 * La matriz de la empresa con personas inventadas encima, para ver cómo se
 * acomoda un grupo grande antes de tenerlo.
 *
 * Sólo corre en desarrollo y no escribe nada: las respuestas reales se leen
 * igual que en la pantalla del taller y las inventadas se suman en memoria.
 *
 * Uso: /cuestionario/pla/matriz/prueba?n=30
 */

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Matriz de prueba — Campos HR',
  robots: { index: false, follow: false },
};

export default async function MatrizDePrueba({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { n?: string };
}) {
  if (process.env.NODE_ENV === 'production') notFound();

  const empresa = await getEmpresaPorSlug(params.slug);
  if (!empresa) notFound();

  const pedidas = Number(searchParams?.n);
  const cuantas = Number.isFinite(pedidas)
    ? Math.max(0, Math.min(Math.trunc(pedidas), MAXIMO_FICTICIAS))
    : 30;

  const reales = await listarRespuestas(empresa.id, 'perfil');
  const inventadas = personasFicticias(cuantas);

  const gente = [
    ...reales.map((r) => ({
      id: r.id,
      apellido: r.apellido,
      nombre: r.nombre,
      totales: r.totales as unknown as Puntajes,
      perfiles: (r.perfiles ?? []) as Perfil[],
      real: true,
    })),
    ...inventadas.map((f) => ({ ...f, real: false })),
  ];

  const puntos: Punto[] = gente.map((p) => {
    const { x, y } = coordenadas(p.totales);
    return { id: p.id, nombre: nombreCompleto(p), x, y, foto: null };
  });

  const porCuadrante = new Map<Perfil, string[]>(PERFILES.map((p) => [p, []]));
  for (const p of [...gente].sort(porApellido)) {
    const principal = p.perfiles[0] ?? null;
    if (principal && porCuadrante.has(principal)) {
      porCuadrante
        .get(principal)!
        .push(p.real ? nombreCompleto(p) : `${nombreCompleto(p)} (inventada)`);
    }
  }

  return (
    <main className="wrap wrap-matriz">
      <section className="head no-print">
        <div className="eyebrow">Prueba de carga</div>
        <h1>{empresa.nombre}</h1>
        <p className="head-nota">
          {gente.length} personas en la matriz: {reales.length}{' '}
          {reales.length === 1 ? 'real' : 'reales'} y {inventadas.length}{' '}
          inventadas. Nada de esto se guarda. Cambiá la cantidad con{' '}
          <code>?n=</code>, hasta {MAXIMO_FICTICIAS}.
        </p>
      </section>

      <section className="mx-bloque">
        <MatrizBenziger puntos={puntos} conDescripciones />
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
