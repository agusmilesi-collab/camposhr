'use client';

import { useRouter } from 'next/navigation';

/**
 * Filtros de la matriz. Con toda la empresa junta la pantalla es ilegible:
 * lo útil es mirar un equipo por vez, o una de las dos variantes.
 */
export default function Filtros({
  slug,
  lideres,
  liderActual,
  varianteActual,
}: {
  slug: string;
  lideres: { id: string; nombre: string }[];
  liderActual: string;
  varianteActual: string;
}) {
  const router = useRouter();

  function ir(cambios: { lider?: string; v?: string }) {
    const p = new URLSearchParams();
    const lider = cambios.lider ?? liderActual;
    const v = cambios.v ?? varianteActual;
    if (lider) p.set('lider', lider);
    if (v) p.set('v', v);
    const qs = p.toString();
    router.push(`/cuestionario/${slug}/matriz${qs ? `?${qs}` : ''}`);
  }

  return (
    <div className="mx-filtros no-print">
      <div className="mx-chips">
        {[
          { valor: '', texto: 'Todos' },
          { valor: 'perfil', texto: 'Perfil' },
          { valor: 'generaciones', texto: 'Generaciones' },
        ].map((o) => (
          <button
            key={o.valor}
            type="button"
            className={varianteActual === o.valor ? 'mx-chip mx-chip-on' : 'mx-chip'}
            onClick={() => ir({ v: o.valor })}
          >
            {o.texto}
          </button>
        ))}
      </div>

      {lideres.length > 0 && (
        <select
          className="mx-select"
          value={liderActual}
          onChange={(e) => ir({ lider: e.target.value })}
          aria-label="Filtrar por líder"
        >
          <option value="">Todos los equipos</option>
          {lideres.map((l) => (
            <option key={l.id} value={l.id}>
              Equipo de {l.nombre}
            </option>
          ))}
        </select>
      )}

      {(liderActual || varianteActual) && (
        <button
          type="button"
          className="mx-limpiar"
          onClick={() => router.push(`/cuestionario/${slug}/matriz`)}
        >
          Limpiar
        </button>
      )}
    </div>
  );
}
