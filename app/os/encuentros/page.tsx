import Link from 'next/link';
import Shell from '../Shell';
import { quienSoy } from '@/lib/identidad';
import { listarCorridas } from '@/lib/ciclo';
import { contarRespuestas, listarEmpresas } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Lo que se dicta en una sala: los ciclos de encuentros y el cuestionario de
 * perfil. Los dos viven en Supabase y entran por QR desde el teléfono, así que
 * lo que interesa acá es qué corrida está activa y cuánta gente respondió.
 */
export default async function Encuentros() {
  const yo = await quienSoy();
  let corridas: Awaited<ReturnType<typeof listarCorridas>> = [];
  let empresas: Awaited<ReturnType<typeof listarEmpresas>> = [];
  let error = false;
  try {
    [corridas, empresas] = await Promise.all([listarCorridas(), listarEmpresas()]);
  } catch {
    error = true;
  }

  const conteos = await Promise.all(
    empresas.map(async (e) => {
      try {
        return await contarRespuestas(e.id);
      } catch {
        return 0;
      }
    })
  );

  return (
    <Shell identidad={yo.nombre} titulo="Encuentros" nota={`${corridas.length} corridas activas`}>
      <div className="os-encabezado">
        <h1>Lo que se dicta en la sala</h1>
        <p>
          Los ciclos en curso y el cuestionario de perfil de cada empresa. Se
          responden por QR desde el teléfono y se proyectan desde el panel de
          control del encuentro.
        </p>
      </div>

      {error && (
        <div className="os-panel">
          <p className="os-vacio">No se pudo leer Supabase.</p>
        </div>
      )}

      <section className="os-panel">
        <div className="os-panel-top">
          <h2>Ciclos activos</h2>
        </div>
        {corridas.length === 0 ? (
          <p className="os-vacio">No hay ninguna corrida activa.</p>
        ) : (
          corridas.map((c) => (
            <Link className="os-fila" key={c.id} href={`/ciclo/${c.empresas?.slug ?? ''}/control`}>
              <div className="os-fila-cuerpo">
                <div className="os-fila-titulo">{c.empresas?.nombre ?? 'Empresa'}</div>
                <div className="os-fila-detalle">
                  {c.ciclos?.nombre ?? 'Ciclo'} ·{' '}
                  {c.actividad_abierta_id ? 'con una actividad abierta' : 'sin actividad abierta'}
                </div>
              </div>
              <div className="os-fila-lado">Abrir el control</div>
            </Link>
          ))
        )}
      </section>

      <section className="os-panel">
        <div className="os-panel-top">
          <h2>Cuestionario de perfil</h2>
          <Link className="os-enlace" href="/cuestionario">
            Ver las empresas
          </Link>
        </div>
        {empresas.length === 0 ? (
          <p className="os-vacio">Todavía no hay empresas cargadas.</p>
        ) : (
          empresas.map((e, i) => (
            <Link className="os-fila" key={e.id} href={`/cuestionario/${e.slug}/matriz`}>
              <div className="os-fila-cuerpo">
                <div className="os-fila-titulo">{e.nombre}</div>
                <div className="os-fila-detalle">
                  {conteos[i]} {conteos[i] === 1 ? 'respuesta' : 'respuestas'}
                </div>
              </div>
              <div className="os-fila-lado">Ver la matriz</div>
            </Link>
          ))
        )}
      </section>
    </Shell>
  );
}
