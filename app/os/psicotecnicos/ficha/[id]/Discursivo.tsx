'use client';

/**
 * El análisis discursivo, en la ficha.
 *
 * La evaluadora ubica a la persona en uno de los cuatro escalones de la
 * pirámide. El sistema no deduce el nivel: se toma sobre unos cinco minutos de
 * discurso y lo ubica quien lo escuchó.
 *
 * El capítulo del informe sale del catálogo de estratos, así que los dos campos
 * de texto son agregados sobre esta persona en particular y pueden quedar
 * vacíos.
 *
 * **La pirámide es la misma que sale impresa**, con sus colores y su recuadro,
 * así se elige mirando lo que el cliente va a ver y no una lista suelta de
 * cuatro nombres.
 *
 * El escalón se guarda al apretarlo, que es un dato solo. Los textos se
 * guardan al soltar el campo, como el resto de la ficha.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Piramide from '../../informe/_doc/Piramide';
import { estirar } from '../../piezas';
import type { NivelDiscursivo } from '@/lib/discursivo';

export default function Discursivo({
  id,
  nivel,
  actual,
  futura,
  escalones,
}: {
  id: string;
  nivel: string | null;
  actual: string | null;
  futura: string | null;
  /** Qué dice cada escalón, con lo que rige desde Configuración → Potencial. */
  escalones: Record<string, string>;
}) {
  const router = useRouter();
  const [puesto, setPuesto] = useState({
    nivel,
    actual: actual ?? '',
    futura: futura ?? '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(cambio: Partial<typeof puesto>) {
    const nuevo = { ...puesto, ...cambio };
    setPuesto(nuevo);
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch('/api/os/discursivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluacionId: id, ...nuevo }),
      });
      const r = await res.json();
      if (!r.ok) throw new Error(r.motivo ?? 'No se pudo guardar.');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="os-discursivo">
      <p className="os-form-nota">
        El nivel de complejidad de trabajo que puede abordar hoy. Se elige el escalón; el que
        está marcado es el que sale en el informe, con la descripción de su estrato y la del
        nivel siguiente, que se escriben en Configuración → Potencial.
      </p>

      <Piramide
        textos={escalones}
        nivel={puesto.nivel}
        elegir={(n: NivelDiscursivo) =>
          // Volver a apretar el que ya estaba lo desmarca: es la forma de
          // corregir sin tener que elegir otro que no corresponde.
          guardar({ nivel: puesto.nivel === n ? null : n })
        }
      />

      <div className="os-redaccion">
        {/* Los dos campos son agregados sobre esta persona: el capítulo del
            informe ya sale completo con los textos del estrato, y lo que se
            escriba acá va después de ellos. En blanco no falta nada. */}
        <label className="os-etiqueta-campo" htmlFor={`actual-${id}`}>
          Qué agregar sobre su capacidad actual
        </label>
        <textarea
          id={`actual-${id}`}
          className="os-campo"
          rows={1}
          ref={estirar}
          value={puesto.actual}
          onChange={(e) => {
            estirar(e.target);
            setPuesto((p) => ({ ...p, actual: e.target.value }));
          }}
          onBlur={(e) => e.target.value !== (actual ?? '') && guardar({ actual: e.target.value })}
        />

        <label className="os-etiqueta-campo" htmlFor={`futura-${id}`}>
          Qué agregar sobre su proyección
        </label>
        <textarea
          id={`futura-${id}`}
          className="os-campo"
          rows={1}
          ref={estirar}
          value={puesto.futura}
          onChange={(e) => {
            estirar(e.target);
            setPuesto((p) => ({ ...p, futura: e.target.value }));
          }}
          onBlur={(e) => e.target.value !== (futura ?? '') && guardar({ futura: e.target.value })}
        />
      </div>

      {guardando && <p className="os-form-nota">Guardando…</p>}
      {error && <p className="os-form-error">{error}</p>}
    </div>
  );
}
