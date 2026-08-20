'use client';

/**
 * El puntaje del Raven y lo que sale de él.
 *
 * Se carga el puntaje directo, que es la cantidad de aciertos sobre treinta y
 * seis, y el percentil, los desvíos y el rango se calculan solos. Los tres son
 * derivados: cargarlos a mano sería tres formas de equivocarse.
 *
 * Guarda al soltar el campo. Vaciarlo borra la medición, que no es lo mismo
 * que un cero: un cero es haber rendido y no acertar nada.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { calcularRaven, RAVEN_MAXIMO, SIN_MEDICION } from '@/lib/raven';

export default function Raven({
  id,
  raw,
  percentil,
  desvios,
  resultado,
}: {
  id: string;
  raw: number | null;
  percentil: number | null;
  desvios: number | null;
  resultado: string | null;
}) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [valor, setValor] = useState(raw === null ? '' : String(raw));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lo que se ve mientras se escribe sale del mismo cálculo que el servidor va
  // a guardar: así el número no aparece un segundo después de escribirlo.
  const enPantalla = calcularRaven(valor === '' ? null : Number(valor));

  async function guardar(texto: string) {
    if (texto === (raw === null ? '' : String(raw))) return;
    setError(null);
    setGuardando(true);
    try {
      const res = await fetch('/api/os/raven', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluacionId: id, raw: texto === '' ? null : Number(texto) }),
      });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) {
        setError(r.motivo ?? 'No se pudo guardar.');
        return;
      }
      empezar(() => router.refresh());
    } catch {
      setError('No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="os-raven">
      <div className="os-raven-carga">
        <label className="os-raven-campo">
          <span className="os-dato-rotulo">Puntaje directo</span>
          <span className="os-raven-entrada">
            <input
              className="os-campo"
              type="number"
              min={0}
              max={RAVEN_MAXIMO}
              value={valor}
              disabled={guardando}
              onChange={(e) => setValor(e.target.value)}
              onBlur={(e) => guardar(e.target.value)}
            />
            <span className="os-raven-sobre">de {RAVEN_MAXIMO}</span>
          </span>
        </label>

        <div className="os-raven-derivados">
          <span className="os-hoja-par">
            <span className="os-hoja-rotulo">Percentil</span>
            <span className="os-hoja-valor">{enPantalla?.percentil ?? percentil ?? '—'}</span>
          </span>
          <span className="os-hoja-par">
            <span className="os-hoja-rotulo">Desvíos</span>
            <span className="os-hoja-valor">
              {(enPantalla?.desvios ?? desvios) === null
                ? '—'
                : (enPantalla?.desvios ?? desvios)!.toFixed(1)}
            </span>
          </span>
        </div>
      </div>

      <p className="os-raven-rango">{enPantalla?.resultado ?? resultado ?? SIN_MEDICION}</p>

      {error ? (
        <p className="os-form-error">{error}</p>
      ) : (
        <p className="os-benziger-aviso">
          El percentil sale del baremo del manual y los desvíos de la media 18,19 con
          desvío 6,32. Por encima de 28 aciertos el percentil es extrapolación.
        </p>
      )}
    </div>
  );
}
