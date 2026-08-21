'use client';

/**
 * La recomendación con la que cierra la evaluación, y por qué.
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
 * El fundamento es el resumen del informe. Escrito, sale tal cual en el
 * documento que lee el cliente; vacío, lo arma el motor con las lecturas del
 * sumario. El motor redacta correcto pero genérico, así que quien tenga algo
 * que decir del caso lo escribe acá y reemplaza al automático.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { CONCLUSIONES } from '@/lib/informe-textos';

export default function Conclusion({
  id,
  recomendacion,
  notas,
  children,
}: {
  id: string;
  recomendacion: string | null;
  notas: string | null;
  /** Qué se le administró, para saber si el informe puede salir. */
  children?: React.ReactNode;
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
      {/* Los cuatro niveles a la vista y con su color, en vez de un desplegable:
          se elige apretando el que corresponde y dice exactamente lo que el
          informe va a decir. Lo que se guarda sigue siendo el valor del
          pipeline, que es lo que ya está cargado y lo que lee el portal. */}
      <div className="os-conclusion-niveles">
        {CONCLUSIONES.map(({ valor: v, nivel }) => {
          const puesto = valor === v;
          return (
            <button
              key={v}
              type="button"
              className={`os-nivel-opcion ${nivel.color}${puesto ? ' puesta' : ''}`}
              aria-pressed={puesto}
              onClick={() => {
                // Volver a apretar el que ya está puesto lo saca: una
                // evaluación puede volver a quedar sin cerrar.
                setValor(puesto ? '' : v);
                setHecho(false);
              }}
            >
              {/* Solo el título: el texto de cada nivel está abajo, en el
                  informe, y repetirlo acá alargaba la columna sin agregar. */}
              <span className="os-nivel-titulo">{nivel.titulo}</span>
            </button>
          );
        })}
      </div>

      <label className="os-conclusion-notas">
        <span className="os-dato-rotulo">
          Fundamento <em>· es el resumen del informe</em>
        </span>
        <textarea
          className="os-campo"
          value={texto}
          rows={6}
          maxLength={4000}
          placeholder="Lo que escribas acá sale como resumen en el informe que lee el cliente. Vacío, lo escribe el sistema con lo que dio la evaluación."
          onChange={(e) => {
            setTexto(e.target.value);
            setHecho(false);
          }}
        />
      </label>

      <div className="os-conclusion-pie">
        {/* Lo que se le tomó, a la izquierda del botón: antes de generar el
            informe hay que poder ver si falta administrar algo. */}
        {children && (
          <div className="os-conclusion-tests">
            <span className="os-dato-rotulo">Tests administrados</span>
            {children}
          </div>
        )}
        <button
          className="os-boton os-boton-firme"
          type="button"
          onClick={cargar}
          disabled={guardando || sinCambios}
        >
          {guardando ? 'Generando…' : 'Generar informe'}
        </button>
        {error ? (
          <span className="os-form-error">{error}</span>
        ) : hecho ? (
          <span className="os-form-ok">Informe generado.</span>
        ) : (
          !sinCambios && <span className="os-columna-monto">Hay cambios sin cargar.</span>
        )}
      </div>
    </div>
  );
}
