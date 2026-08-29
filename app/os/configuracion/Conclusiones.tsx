'use client';

/**
 * Las conclusiones del potencial, editables.
 *
 * El modelo no interpreta: compara el nivel de trabajo que el puesto pide con
 * el que la persona alcanza, y de esa comparación salen unos pocos casos. Cada
 * caso tiene su texto escrito de antemano, y lo escribe quien firma los
 * informes. Nada se redacta al vuelo.
 *
 * Lo único que cambia de un informe a otro son los datos que entran en los
 * huecos: `{estrato}` es el que pide el puesto, `{siguiente}` el que viene
 * después y `{edad}` la edad a la que la banda de maduración llega. Un hueco
 * que el sistema no sepa llenar se rechaza al guardar, porque saldría escrito
 * con llaves en el informe de una persona.
 *
 * **Se guarda la diferencia y no todo**: lo que quedó igual al código no se
 * guarda, así que una corrección que mañana entre por ahí llega a quien no tocó
 * nada.
 */

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  CUANDO_LA_CONCLUSION,
  HUECOS_DE_CONCLUSION,
  LARGO_MAXIMO,
  type CasoDeConclusion,
} from '@/lib/discursivo';

/** Los dos momentos que separa la conclusión, con sus casos. */
const MOMENTOS: { titulo: string; bajada: string; casos: CasoDeConclusion[] }[] = [
  {
    titulo: 'Hoy',
    bajada: 'Sale de comparar los dos estratos, el del puesto y el de la persona.',
    casos: ['hoy_alcanza', 'hoy_sobra', 'hoy_falta'],
  },
  {
    titulo: 'Más adelante',
    bajada:
      'Sale de la banda de maduración: hasta dónde llega esa capacidad con los años. Sin edad o sin horizonte cargados, este renglón no sale.',
    casos: [
      'luego_falta_llega',
      'luego_falta_no_llega',
      'luego_sobra',
      'luego_alcanza_estable',
      'luego_alcanza_borde',
      'luego_alcanza_supera',
    ],
  },
];

export default function Conclusiones({
  textos: puestos,
  originales,
  tocado,
}: {
  textos: Record<CasoDeConclusion, string>;
  originales: Record<CasoDeConclusion, string>;
  tocado: boolean;
}) {
  const router = useRouter();
  const firma = useMemo(() => JSON.stringify(puestos), [puestos]);

  const [textos, setTextos] = useState(puestos);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guardar vuelve a dibujar del servidor, pero eso no reinicia el estado de un
  // componente de cliente.
  const [ultima, setUltima] = useState(firma);
  if (ultima !== firma) {
    setUltima(firma);
    setTextos(puestos);
  }

  const casos = MOMENTOS.flatMap((m) => m.casos);
  const sinGuardar = casos.filter((c) => textos[c] !== puestos[c]);
  const cambiado = sinGuardar.length > 0;
  const vacios = casos.filter((c) => !textos[c].trim());
  /** Un hueco que el sistema no sabe llenar saldría con llaves en el informe. */
  const conHuecoRaro = casos.filter((c) =>
    (textos[c].match(/\{[a-z]+\}/g) ?? []).some((h) => !HUECOS_DE_CONCLUSION.includes(h))
  );

  async function guardar(valor: unknown) {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch('/api/os/ajustes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave: 'discursivo_conclusiones', valor }),
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

  /** Solo lo que quedó distinto de lo que trae el código. */
  function diferencias(): Record<string, string> {
    const d: Record<string, string> = {};
    for (const c of casos) {
      const escrito = textos[c].trim();
      if (escrito !== originales[c]) d[c] = escrito;
    }
    return d;
  }

  return (
    <>
      {MOMENTOS.map((m) => (
        <section className="os-panel os-indice-panel" key={m.titulo}>
          <div className="os-panel-top">
            <h3 className="os-indice-nombre-titulo">{m.titulo}</h3>
            <span className="os-columna-monto">{m.bajada}</span>
          </div>
          <div className="os-rama">
            <div className="os-redaccion os-redaccion-estratos">
              {m.casos.map((c) => (
                <div className="os-redaccion-campo" key={c}>
                  <label className="os-etiqueta-campo" htmlFor={`conclusion-${c}`}>
                    {CUANDO_LA_CONCLUSION[c]}
                    {textos[c].trim() !== originales[c] && (
                      <span className="os-dato-falta">reescrito</span>
                    )}
                  </label>
                  <textarea
                    id={`conclusion-${c}`}
                    className="os-campo os-campo-estrato"
                    rows={3}
                    maxLength={LARGO_MAXIMO}
                    value={textos[c]}
                    onChange={(e) => setTextos((t) => ({ ...t, [c]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="os-panel">
        <div className="os-panel-cuerpo">
          <p className="os-form-nota">
            Estos textos son la conclusión que se lee en la pestaña Potencial de cada ficha y
            en el informe del cliente. El sistema elige cuál entra comparando los dos
            estratos: no redacta nada.
          </p>
          <p className="os-form-nota">
            Los huecos que sabe llenar son {HUECOS_DE_CONCLUSION.join(', ')}. Cualquier otro
            se rechaza al guardar, porque saldría con llaves en el informe de una persona.
          </p>

          {tocado && !cambiado && (
            <div className="os-barra-acciones">
              <button
                className="os-boton"
                disabled={guardando}
                onClick={() => guardar(null)}
                title="Borra lo que se escribió y deja los textos originales"
              >
                Volver a los originales
              </button>
            </div>
          )}
          {error && !cambiado && <p className="os-form-error">{error}</p>}
        </div>
      </section>

      {cambiado && (
        <div className="os-guardar-barra">
          <span className="os-guardar-cuenta">
            {error ? (
              <span className="os-form-error">{error}</span>
            ) : vacios.length > 0 ? (
              <span className="os-form-error">
                {vacios.length === 1 ? 'Una conclusión sin texto' : `${vacios.length} sin texto`}
              </span>
            ) : conHuecoRaro.length > 0 ? (
              <span className="os-form-error">Hay un hueco que el sistema no sabe llenar</span>
            ) : (
              `${sinGuardar.length} ${sinGuardar.length === 1 ? 'conclusión' : 'conclusiones'} sin guardar`
            )}
          </span>
          <button
            className="os-boton"
            disabled={guardando}
            onClick={() => setTextos(puestos)}
          >
            Descartar
          </button>
          <button
            className="os-boton os-boton-firme"
            disabled={guardando || vacios.length > 0 || conHuecoRaro.length > 0}
            onClick={() => guardar(diferencias())}
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      )}
    </>
  );
}
