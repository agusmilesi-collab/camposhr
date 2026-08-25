'use client';

/**
 * Cuánto lleva facturado cada una y cuánto le queda antes de pasarse.
 *
 * Vive en Costos y no en Facturación porque no es una tarea del día: es la
 * salud del año. Facturación resuelve qué se emite y qué se cobra; acá se mira
 * qué deja el trabajo y hasta dónde se puede facturar sin cambiar de régimen.
 *
 * El monotributo no avisa: se pasa el tope de los últimos doce meses y hay que
 * salir del régimen, con IVA y ganancias desde el mes siguiente. El número que
 * decide es el de doce meses corridos, que es el que mira ARCA; el mes y el año
 * están para saber cómo viene el trabajo.
 *
 * **La cuenta es sobre lo emitido en el OS.** Lo que se facturó antes entra
 * cuando se carguen esas facturas, así que mientras dure la migración el número
 * es un piso y no el total. Por eso la pantalla lo dice en vez de dejar creer
 * que es la cuenta completa.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Desplegable from '@/app/os/Desplegable';
import { CATEGORIAS_SERVICIOS, margen } from '@/lib/monotributo';
import { formatoImporte, type Marcha } from '@/lib/facturas-tipos';

async function mandar(cuerpo: unknown) {
  const res = await fetch('/api/os/facturas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  const datos = await res.json().catch(() => ({ error: 'Sin respuesta.' }));
  if (!res.ok) throw new Error(datos.error ?? 'No se pudo guardar.');
  return datos;
}

export default function Monotributo({ emisoras }: { emisoras: Marcha[] }) {
  if (emisoras.length === 0) return null;
  return (
    <>
      {/* "Psicotécnicos" y no "Monotributo": lo que se ve es lo que factura
          cada una, y el monotributo es contra qué se lo mide. */}
      <div className="os-rotulo-bloque">Psicotécnicos</div>
      <div className="os-monotributo">
        {emisoras.map((e) => (
          <Escala key={e.emisorId} e={e} />
        ))}
      </div>
    </>
  );
}

function Escala({ e }: { e: Marcha }) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const m = margen(e.categoria, e.doce);

  async function elegir(letra: string) {
    setGuardando(true);
    setError(null);
    try {
      await mandar({ accion: 'categoria', emisorId: e.emisorId, categoria: letra || null });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="os-panel">
      <div className="os-panel-top">
        <h2>{e.nombre.split(' ')[0]}</h2>
        {/* La categoría se elige acá: es de cada una y cambia dos veces al año,
            cuando toca recategorizar. */}
        <Desplegable
          valor={e.categoria ?? ''}
          opciones={[
            { valor: '', texto: 'Sin categoría', color: 'os-gris' },
            ...CATEGORIAS_SERVICIOS.map((c) => ({
              valor: c.letra,
              texto: `Categoría ${c.letra}`,
              color: 'os-azul',
            })),
          ]}
          alElegir={elegir}
          deshabilitado={guardando}
          etiqueta={`Categoría de monotributo de ${e.nombre}`}
        />
      </div>

      <div className="os-panel-cuerpo">
        <div className="os-marcha">
          <div>
            <span className="os-dato-rotulo">Este mes</span>
            <strong>{formatoImporte(e.mes)}</strong>
          </div>
          <div>
            <span className="os-dato-rotulo">Este año</span>
            <strong>{formatoImporte(e.anio)}</strong>
          </div>
          <div>
            {/* El que decide la categoría: son los doce meses corridos, no el
                año calendario. */}
            <span className="os-dato-rotulo">Últimos 12 meses</span>
            <strong>{formatoImporte(e.doce)}</strong>
          </div>
        </div>

        {m === null ? (
          <p className="os-escala-pie">Elegí la categoría para saber cuánto queda hasta el tope.</p>
        ) : (
          <>
            <div className="os-escala">
              <div
                className={`os-escala-lleno${m.usado > 0.85 ? ' al-limite' : ''}`}
                style={{ width: `${Math.round(m.usado * 100)}%` }}
              />
            </div>
            <p className={`os-escala-pie${m.sobra < 0 ? ' pasada' : ''}`}>
              {m.sobra >= 0 ? (
                <>
                  Quedan <strong>{formatoImporte(m.sobra)}</strong> para el tope de la{' '}
                  {m.categoria} ({formatoImporte(m.tope)} en doce meses).
                </>
              ) : m.seVa ? (
                <>
                  Se pasó del tope de la H por {formatoImporte(-m.sobra)}: arriba de esa
                  categoría no hay monotributo para servicios.
                </>
              ) : (
                <>
                  Se pasó de la {m.categoria} por {formatoImporte(-m.sobra)}: con lo
                  facturado le corresponde la {m.siguiente}.
                </>
              )}
            </p>
          </>
        )}

        <Barras meses={e.meses} />

        <p className="os-form-nota">
          Sobre lo emitido en el OS. {e.enDolares > 0 && 'No entra lo facturado en dólares. '}
          Las facturas anteriores suman recién cuando se carguen.
        </p>
        {error && <p className="os-form-error">{error}</p>}
      </div>
    </section>
  );
}

/**
 * El monto de un mes, corto.
 *
 * En una columna de treinta píxeles no entra "ARS 814.120", y cortado con
 * puntos suspensivos no dice nada. Abreviado se lee de un vistazo, y el monto
 * exacto está en el título de la barra, con sus dos mitades.
 */
function corto(n: number): string {
  if (n === 0) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} M`;
  return `${Math.round(n / 1000)} k`;
}

/**
 * Lo facturado mes a mes, en barras, de enero a diciembre.
 *
 * Los tres números de arriba dicen cuánto, y esto dice cuándo y de qué: cada
 * barra se parte en lo que salió de los psicotécnicos y lo que salió de los
 * servicios de Campos HR, que es lo que cada una necesita para saber de dónde
 * le vino el mes. Va por año comercial, así dos años se comparan mes contra
 * mes; la cuenta del tope va por los doce meses corridos, que es otra pregunta.
 *
 * **Todas se miden contra el mes más alto**, no contra el tope de la categoría:
 * la escala del tope aplasta un año de trabajo en una línea de nada. Los meses
 * que no llegaron van apagados, para no leerlos como meses sin trabajo.
 */
function Barras({ meses }: { meses: Marcha['meses'] }) {
  const techo = Math.max(...meses.map((m) => m.total), 0);
  if (techo === 0) {
    return <p className="os-escala-pie">Sin facturas emitidas este año.</p>;
  }

  /** Un tramo de la barra: lo mínimo que se ve es dos píxeles. */
  const alto = (n: number) => (n === 0 ? '0' : `${Math.max((n / techo) * 100, 2)}%`);

  return (
    <>
      <div className="os-meses" role="img" aria-label="Facturado por mes, de enero a diciembre">
        {meses.map((m) => (
          <div
            className={`os-mes${m.futuro ? ' futuro' : ''}`}
            key={m.clave}
            title={m.futuro ? m.etiqueta : `${m.etiqueta}: ${formatoImporte(m.total)} en total`}
          >
            <span className="os-mes-monto">{corto(m.total)}</span>
            <div className="os-mes-caja">
              {/* Un mes sin facturas no dibuja nada: con una barra mínima, doce
                  meses vacíos se leían como doce meses con algo. Los dos tramos
                  van apilados, con los servicios arriba porque son la
                  excepción y así se los ve aunque sean pocos. */}
              {m.total > 0 && (
                <div className="os-mes-pila">
                  {/* Cada tramo dice lo suyo: parándose encima de un color se
                      lee cuánto salió de ese trabajo, sin tener que restar. El
                      título del tramo le gana al de la columna, que sigue
                      diciendo el total del mes. */}
                  {m.servicios > 0 && (
                    <div
                      className="os-mes-lleno servicios"
                      style={{ height: alto(m.servicios) }}
                      title={`${m.etiqueta} · Campos HR: ${formatoImporte(m.servicios)}`}
                    />
                  )}
                  {m.psico > 0 && (
                    <div
                      className="os-mes-lleno psico"
                      style={{ height: alto(m.psico) }}
                      title={`${m.etiqueta} · Psicotécnicos: ${formatoImporte(m.psico)}`}
                    />
                  )}
                </div>
              )}
            </div>
            <span className="os-mes-rotulo">{m.etiqueta}</span>
          </div>
        ))}
      </div>

      <p className="os-referencias">
        <span className="os-referencia">
          <i className="os-referencia-color psico" /> Psicotécnicos
        </span>
        <span className="os-referencia">
          <i className="os-referencia-color servicios" /> Campos HR
        </span>
      </p>
    </>
  );
}
