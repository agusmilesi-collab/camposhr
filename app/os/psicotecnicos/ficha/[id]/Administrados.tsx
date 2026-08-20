'use client';

/**
 * Qué se le administró además de las manchas.
 *
 * El Bender y el Gráfico de dos personas no producen puntajes en el OS: lo
 * único que hace falta saber es si se tomaron, porque de eso depende que el
 * informe pueda hablar de lo que muestran.
 *
 * Guarda al elegir, como el resto del pipeline. Y son tres estados y no un
 * tilde: "sin marcar" no es lo mismo que "no se tomó", y con un tilde solo no
 * se distingue lo que falta cargar de lo que no se hizo.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

const TESTS: { campo: string; texto: string }[] = [
  { campo: 'benderAdministrado', texto: 'Bender' },
  { campo: 'graficoAdministrado', texto: 'Gráfico 2 personas' },
];

export default function Administrados({
  id,
  bender,
  grafico,
}: {
  id: string;
  bender: boolean;
  grafico: boolean;
}) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [valores, setValores] = useState<Record<string, boolean>>({
    benderAdministrado: bender,
    graficoAdministrado: grafico,
  });
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function elegir(campo: string, valor: boolean) {
    const antes = valores[campo];
    setValores((v) => ({ ...v, [campo]: valor }));
    setError(null);
    setGuardando(campo);
    try {
      const res = await fetch('/api/os/psicotecnicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, campo, valor }),
      });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) {
        setValores((v) => ({ ...v, [campo]: antes }));
        setError(r.motivo ?? 'No se pudo guardar.');
        return;
      }
      empezar(() => router.refresh());
    } catch {
      setValores((v) => ({ ...v, [campo]: antes }));
      setError('No se pudo guardar.');
    } finally {
      setGuardando(null);
    }
  }

  return (
    <div className="os-administrados">
      {TESTS.map((t) => (
        <div key={t.campo} className="os-administrado">
          <span className="os-dato-rotulo">{t.texto}</span>
          <div className="os-ingreso-opciones" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {[
              { v: true, texto: 'Sí' },
              { v: false, texto: 'No' },
            ].map((o) => (
              <button
                key={o.texto}
                type="button"
                className={`os-ingreso-opcion${valores[t.campo] === o.v ? ' puesta' : ''}`}
                aria-pressed={valores[t.campo] === o.v}
                disabled={guardando === t.campo}
                onClick={() => elegir(t.campo, o.v)}
              >
                {o.texto}
              </button>
            ))}
          </div>
        </div>
      ))}
      {error && <p className="os-form-error">{error}</p>}
    </div>
  );
}
