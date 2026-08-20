'use client';

/**
 * Con qué cierra la evaluación y por qué.
 *
 * Vive acá y no en la lista de "Por analizar" porque se decide leyendo el
 * sumario y el informe, que están a una pestaña de distancia. Elegirla desde
 * una tabla obligaba a decidir sin tener delante lo que la sostiene.
 *
 * A diferencia del resto del pipeline, acá se carga con un botón y no al
 * soltar cada campo: la conclusión y su fundamento son una sola cosa que se
 * escribe, se relee y recién entonces se sube. Guardar a mitad de una frase
 * dejaría en la base media decisión.
 *
 * El fundamento es lo que permite releer una decisión meses después y lo que
 * el seguimiento contrasta cuando la persona ya entró a trabajar: "Apto" solo
 * no dice nada de por qué.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { COLOR_RECOMENDACION } from '@/lib/psicotecnicos-tipos';

/** Con qué puede cerrar una evaluación. */
const RECOMENDACIONES = ['Apto', 'Apto con observaciones', 'Apto con alertas', 'No apto'];

export default function Conclusion({
  id,
  recomendacion,
  notas,
}: {
  id: string;
  recomendacion: string | null;
  notas: string | null;
}) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [valor, setValor] = useState(recomendacion ?? '');
  const [texto, setTexto] = useState(notas ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState(false);

  const sinCambios = valor === (recomendacion ?? '') && texto === (notas ?? '');

  async function cargar() {
    setError(null);
    setHecho(false);
    setGuardando(true);
    try {
      const res = await fetch('/api/os/psicotecnicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          // Los dos juntos: es una sola decisión, no dos campos sueltos.
          cambios: { recomendacion: valor || null, recomendacionNotas: texto.trim() || null },
        }),
      });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) {
        setError(r.motivo ?? 'No se pudo cargar.');
        return;
      }
      setHecho(true);
      empezar(() => router.refresh());
    } catch {
      setError('No se pudo cargar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="os-conclusion">
      {/* El selector y el sello en el mismo renglón: se elige y se ve puesta. */}
      <div className="os-conclusion-elegida">
        <select
          className="os-campo"
          value={valor}
          onChange={(e) => {
            setValor(e.target.value);
            setHecho(false);
          }}
          aria-label="Conclusión"
        >
          <option value="">Sin cerrar</option>
          {RECOMENDACIONES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        {recomendacion && (
          <span className={`os-sello-estado ${COLOR_RECOMENDACION[recomendacion] ?? 'os-gris'}`}>
            {recomendacion}
          </span>
        )}
      </div>

      <label className="os-conclusion-notas">
        <span className="os-dato-rotulo">Fundamento</span>
        <textarea
          className="os-campo"
          value={texto}
          rows={6}
          maxLength={4000}
          placeholder="Qué sostiene esta conclusión: lo que se vio en la entrevista, en el sumario y en los tests."
          onChange={(e) => {
            setTexto(e.target.value);
            setHecho(false);
          }}
        />
      </label>

      <div className="os-conclusion-pie">
        <button
          className="os-boton os-boton-firme"
          type="button"
          onClick={cargar}
          disabled={guardando || sinCambios}
        >
          {guardando ? 'Cargando…' : 'Cargar'}
        </button>
        {error ? (
          <span className="os-form-error">{error}</span>
        ) : hecho ? (
          <span className="os-form-ok">Cargado.</span>
        ) : (
          !sinCambios && <span className="os-columna-monto">Hay cambios sin cargar.</span>
        )}
      </div>
    </div>
  );
}
