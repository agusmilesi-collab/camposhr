'use client';

/**
 * El botón que corre el motor Exner sobre la codificación cargada.
 *
 * Se aprieta a mano y no se dispara al guardar cada celda: un protocolo a medio
 * codificar produce un sumario que parece válido y no lo es, y el número que
 * quedó en pantalla se lee después como si estuviera cerrado.
 *
 * Los avisos del motor (láminas fuera del test, códigos de localización que no
 * reconoce) se muestran acá mismo, porque son cosas que hay que arreglar en la
 * grilla antes de dar el sumario por bueno.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export default function Calcular({ evaluacionId }: { evaluacionId: string }) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [salida, setSalida] = useState<{ test: string; R: number; avisos: string[] } | null>(null);

  async function calcular() {
    setError(null);
    setSalida(null);
    setTrabajando(true);
    try {
      const res = await fetch('/api/os/sumario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluacionId }),
      });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) {
        setError(r.motivo ?? 'No se pudo calcular.');
        return;
      }
      setSalida({ test: r.test, R: r.R, avisos: r.avisos ?? [] });
      empezar(() => router.refresh());
    } catch {
      setError('No se pudo calcular.');
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <div className="os-calcular">
      <button className="os-boton os-boton-firme" disabled={trabajando} onClick={calcular}>
        {trabajando ? 'Calculando…' : 'Calcular sumario'}
      </button>

      {error && <p className="os-form-error">{error}</p>}

      {salida && (
        <p className="os-form-ok">
          {salida.test}: sumario calculado sobre {salida.R}{' '}
          {salida.R === 1 ? 'respuesta' : 'respuestas'}.
        </p>
      )}

      {salida && salida.avisos.length > 0 && (
        <div className="os-aviso">
          <div>
            <strong>Revisar codificación</strong>
            <ul className="os-lista-avisos">
              {salida.avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
