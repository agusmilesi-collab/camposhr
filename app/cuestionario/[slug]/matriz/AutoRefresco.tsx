'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/** Refresca la matriz mientras el grupo va respondiendo. */
export default function AutoRefresco({
  segundos = 15,
  /** Refresca sin mostrar los controles: la matriz embebida en una placa. */
  oculto = false,
}: {
  segundos?: number;
  oculto?: boolean;
}) {
  const router = useRouter();
  const [activo, setActivo] = useState(true);

  useEffect(() => {
    if (!activo) return;
    const id = setInterval(() => router.refresh(), segundos * 1000);
    return () => clearInterval(id);
  }, [activo, segundos, router]);

  if (oculto) return null;

  return (
    <div className="mx-refresco no-print">
      <button
        type="button"
        className="btn-ghost"
        onClick={() => router.refresh()}
      >
        Actualizar ahora
      </button>
      <label className="mx-auto">
        <input
          type="checkbox"
          checked={activo}
          onChange={(e) => setActivo(e.target.checked)}
        />
        Actualizar sola cada {segundos} s
      </label>
    </div>
  );
}
