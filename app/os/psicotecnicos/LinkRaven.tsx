'use client';

/**
 * El enlace del test de Raven, listo para pegar.
 *
 * Se copia en la entrevista, mientras se está hablando con la persona, y se
 * manda por donde sea que se esté conversando. Por eso es un botón que copia y
 * no una pantalla con el enlace escrito: entre mirar un enlace y pegarlo hay
 * un paso donde se pierde un carácter.
 *
 * Si el candidato ya tiene un enlace sin usar, devuelve el mismo: dos enlaces
 * para la misma evaluación son dos tests, y el segundo pisaría al primero.
 */

import { useState } from 'react';

export default function LinkRaven({ evaluacionId }: { evaluacionId: string }) {
  const [estado, setEstado] = useState<'quieto' | 'pidiendo' | 'copiado' | 'empezado'>('quieto');
  const [error, setError] = useState<string | null>(null);

  async function copiar() {
    setError(null);
    setEstado('pidiendo');
    try {
      const res = await fetch('/api/os/raven-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluacionId }),
      });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) {
        setError(r.motivo ?? 'No se pudo generar.');
        setEstado('quieto');
        return;
      }
      await navigator.clipboard.writeText(r.enlace);
      // Si ya lo abrió, conviene saberlo antes de volver a mandarlo.
      setEstado(r.empezado ? 'empezado' : 'copiado');
      setTimeout(() => setEstado('quieto'), 4000);
    } catch {
      setError('No se pudo copiar.');
      setEstado('quieto');
    }
  }

  return (
    <span className="os-link-raven">
      <button className="os-boton" onClick={copiar} disabled={estado === 'pidiendo'}>
        {estado === 'pidiendo' ? 'Generando…' : 'Copiar link'}
      </button>
      {estado === 'copiado' && <span className="os-form-ok">Copiado</span>}
      {estado === 'empezado' && <span className="os-columna-monto">Copiado · ya lo empezó</span>}
      {error && <span className="os-form-error">{error}</span>}
    </span>
  );
}
