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
 *
 * Hay un botón por serie, 36 y 12 láminas: la evaluadora elige cuál le manda.
 * Donde se puede elegir (la Batería 1), antes de copiar pregunta si está segura
 * de la serie: los dos botones están juntos y uno equivocado le toma al
 * candidato otro test. Es un cartel propio y no el `confirm` del navegador:
 * después de cerrar ese, el portapapeles puede negarse a copiar.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LinkRaven({
  evaluacionId,
  laminas = 36,
  confirmar = false,
}: {
  evaluacionId: string;
  laminas?: 12 | 36;
  /** Preguntar antes de copiar: en la Batería 1, donde hay dos series. */
  confirmar?: boolean;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState<'quieto' | 'pidiendo' | 'copiado' | 'empezado'>('quieto');
  const [error, setError] = useState<string | null>(null);
  const [preguntando, setPreguntando] = useState(false);

  async function copiar() {
    setError(null);
    setEstado('pidiendo');
    try {
      const res = await fetch('/api/os/raven-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluacionId, laminas }),
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
      // La hoja vuelve a leer la sesión: el reloj tiene que contar los minutos
      // de la serie que se acaba de elegir.
      router.refresh();
      setTimeout(() => setEstado('quieto'), 4000);
    } catch {
      setError('No se pudo copiar.');
      setEstado('quieto');
    }
  }

  return (
    <span className="os-link-raven">
      <button
        className="os-boton os-boton-azul"
        onClick={() => (confirmar ? setPreguntando(true) : copiar())}
        disabled={estado === 'pidiendo'}
      >
        {estado === 'pidiendo' ? 'Generando…' : `Copiar link ${laminas}`}
      </button>
      {estado === 'copiado' && <span className="os-form-ok">Copiado</span>}
      {estado === 'empezado' && <span className="os-columna-monto">Copiado · ya lo empezó</span>}
      {error && <span className="os-form-error">{error}</span>}
      {preguntando && (
        <div className="os-aviso-raven" role="alertdialog" aria-modal="true" aria-labelledby={`aviso-raven-${laminas}`}>
          <div className="os-aviso-raven-caja">
            <p id={`aviso-raven-${laminas}`}>
              ¿Está segura de que quiere administrar el <strong>Raven de {laminas} láminas</strong>?
            </p>
            <div className="os-aviso-raven-botones">
              <button className="os-boton" onClick={() => setPreguntando(false)} autoFocus>
                Cancelar
              </button>
              <button
                className="os-boton os-boton-firme"
                onClick={() => {
                  setPreguntando(false);
                  copiar();
                }}
              >
                Sí, copiar link {laminas}
              </button>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
