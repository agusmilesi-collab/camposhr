'use client';

/**
 * Una etapa como tabla.
 *
 * Cada etapa tiene sus columnas: las que hacen falta para hacer ese tramo del
 * trabajo y ninguna más. Es la diferencia con la interfaz de Airtable, donde
 * cada fila abre las mismas veinticinco columnas esté donde esté.
 *
 * Los campos se editan adentro de la celda y guardan solos: un botón de
 * guardar suelto es un cambio que se pierde.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { Evaluacion } from '@/lib/psicotecnicos';
import { desdeInput, enDias, fechaHora, haceCuanto, paraInput } from '@/lib/hora';
import { RUTA } from '@/lib/psicotecnicos-tipos';

const RECOMENDACIONES = ['Apto', 'Apto con observaciones', 'Apto con alertas', 'No apto'];


/** Las columnas de cada etapa, en orden. La última siempre es la acción. */
const COLUMNAS: Record<string, string[]> = {
  'Sin asignar': ['Candidato', 'Pedido', 'Batería', 'Ingresó', 'Esperando', ''],
  'Por citar': ['Candidato', 'Pedido', 'Teléfono', 'Contacto', 'Modalidad', 'Entrevista', ''],
  'Por entrevistar': ['Candidato', 'Pedido', 'Entrevista', 'Modalidad', 'Teléfono', 'Raven', 'Bender', 'Gráfico', ''],
  'Por analizar': ['Candidato', 'Pedido', 'Entrevista', 'Espera', 'Administrado', 'Informe', 'Conclusión', ''],
  Entregado: ['Candidato', 'Pedido', 'Entregado', 'Conclusión', 'Informe', ''],
  Seguimiento: ['Candidato', 'Pedido', 'Entregado', 'Conclusión', 'Informe', ''],
};

function soloDigitos(t: string): string {
  return t.replace(/[^0-9]/g, '');
}

function Falta({ texto = 'falta' }: { texto?: string }) {
  return <span className="os-dato-falta">{texto}</span>;
}

function Persona({ e, etapa }: { e: Evaluacion; etapa: string }) {
  if (e.origen !== 'supabase') return <div className="os-tabla-nombre">{e.nombre}</div>;
  return (
    <Link
      className="os-tabla-nombre os-tabla-ficha"
      href={`/os/psicotecnicos/ficha/${e.id}?desde=${RUTA[etapa] ?? ''}`}
    >
      {e.nombre}
    </Link>
  );
}

const CERRADAS = new Set(['Entregado', 'Seguimiento']);

/**
 * A qué etapa vuelve cada una cuando se retrocede.
 *
 * El pipeline avanza con los botones de cada pantalla, pero una entrevista se
 * suspende, un informe se reabre y una fecha se carga en la fila equivocada.
 * Sin camino de vuelta esos casos había que arreglarlos en la base.
 *
 * "Sin asignar" no tiene anterior: es el principio.
 */
const ANTERIOR: Record<string, string> = {
  'Por citar': 'Sin asignar',
  'Por entrevistar': 'Por citar',
  'Por analizar': 'Por entrevistar',
  Entregado: 'Por analizar',
  Seguimiento: 'Entregado',
};

function Busqueda({ e, conEvaluadora }: { e: Evaluacion; conEvaluadora: boolean }) {
  return (
    <>
      <div>{e.empresa}</div>
      <div className="os-tabla-flojo">
        {e.puesto}
        {conEvaluadora && (e.evaluadora ? ` · ${e.evaluadora}` : ' · sin evaluadora')}
      </div>
    </>
  );
}

function Fila({ e, etapa }: { e: Evaluacion; etapa: string }) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retroceder() {
    const destino = ANTERIOR[etapa];
    if (!destino) return;
    // "Sin asignar" es lo que no tiene dueño: volver ahí sin soltar la
    // evaluadora dejaría la ficha sin aparecer en ninguna pantalla.
    await guardar(
      'etapa',
      destino,
      destino === 'Sin asignar' ? { etapa: destino, evaluadora: null } : undefined
    );
  }

  async function guardar(
    campo: string,
    valor: string | boolean | null,
    cambios?: Record<string, string | boolean | null>
  ) {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch('/api/os/psicotecnicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          cambios ? { id: e.id, cambios } : { id: e.id, campo, valor }
        ),
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

  const trabajando = guardando || pendiente;

  const volver = ANTERIOR[etapa] ? (
    // La caja es la que trae la línea que lo separa de la acción principal: el
    // botón es redondo y un borde propio le rompería el círculo.
    <span className="os-volver-caja">
      <button
        className="os-boton os-boton-volver"
        disabled={trabajando}
        onClick={retroceder}
        title={`Volver a ${ANTERIOR[etapa]}`}
        aria-label={`Volver a ${ANTERIOR[etapa]}`}
      >
        ←
      </button>
    </span>
  ) : null;
  const columnas = COLUMNAS[etapa] ?? COLUMNAS['Sin asignar'];

  return (
    <>
      <tr>
        <td>
          <Persona e={e} etapa={etapa} />
        </td>
        <td>
          <Busqueda e={e} conEvaluadora={CERRADAS.has(etapa)} />
        </td>

        {etapa === 'Sin asignar' && (
          <>
            <td>{e.bateria ?? <Falta texto="a definir" />}</td>
            <td>{fechaHora(e.fechaIngreso) ?? <Falta texto="sin fecha" />}</td>
            <td className="os-tabla-num">{enDias(e.diasEsperando)}</td>
            <td className="os-tabla-accion">
              <button
                className="os-boton os-boton-firme"
                disabled={trabajando}
                onClick={() => guardar('etapa', 'Por citar')}
              >
                Pasar a citar
              </button>
              {volver}
            </td>
          </>
        )}

        {etapa === 'Por citar' && (
          <>
            <td className="os-tabla-telefono">
              {e.telefono ? (
                <a
                  href={`https://wa.me/${soloDigitos(e.telefono)}`}
                  target="_blank"
                  rel="noreferrer"
                  title="Escribir por WhatsApp"
                >
                  {e.telefono}
                </a>
              ) : (
                <Falta />
              )}
            </td>
            <td className="os-tabla-contacto">
              {e.mensaje === 'Esperando respuesta' ? (
                <button
                  className="os-boton os-boton-marcado os-sello-estado os-ambar"
                  disabled={trabajando}
                  onClick={() => guardar('mensaje', 'Sin contactar')}
                  title="Ya se la contactó y se espera respuesta. Tocar para volver atrás."
                >
                  Esperando
                </button>
              ) : (
                <button
                  className="os-boton os-boton-marcado os-sello-estado os-gris"
                  disabled={trabajando}
                  onClick={() => guardar('mensaje', 'Esperando respuesta')}
                  title="Todavía no se la contactó. Tocar para marcar que se la contactó."
                >
                  Sin contactar
                </button>
              )}
            </td>
            <td>
              <select
                className="os-campo"
                defaultValue={e.modalidad ?? ''}
                disabled={trabajando}
                onChange={(ev) => guardar('modalidad', ev.target.value || null)}
                aria-label="Modalidad"
              >
                <option value="">Sin definir</option>
                <option value="Presencial">Presencial</option>
                <option value="Online">Online</option>
              </select>
            </td>
            <td>
              <input
                className="os-campo"
                type="datetime-local"
                defaultValue={paraInput(e.fechaEntrevista)}
                disabled={trabajando}
                onChange={(ev) => {
                  const iso = desdeInput(ev.target.value);
                  if (iso) guardar('fechaEntrevista', iso);
                }}
                aria-label="Fecha de la entrevista"
              />
            </td>
            <td className="os-tabla-accion">
              <button
                className="os-boton os-boton-firme"
                disabled={trabajando || !e.fechaEntrevista}
                onClick={() => guardar('etapa', 'Por entrevistar')}
                title={e.fechaEntrevista ? '' : 'Primero poné la fecha de la entrevista.'}
              >
                Agendar
              </button>
              {volver}
            </td>
          </>
        )}

        {etapa === 'Por entrevistar' && (
          <>
            <td>{fechaHora(e.fechaEntrevista) ?? <Falta texto="sin fecha" />}</td>
            <td>{e.modalidad ?? <Falta texto="sin definir" />}</td>
            <td>
              {e.telefono ? <a href={`tel:${soloDigitos(e.telefono)}`}>{e.telefono}</a> : <Falta />}
            </td>
            <td>
              {e.linkRaven ? (
                <a href={e.linkRaven} target="_blank" rel="noreferrer">
                  Abrir
                </a>
              ) : (
                <span className="os-tabla-flojo">—</span>
              )}
            </td>
            <td className="os-tabla-num">
              <input
                type="checkbox"
                checked={e.benderAdministrado}
                disabled={trabajando}
                onChange={(ev) => guardar('benderAdministrado', ev.target.checked)}
                aria-label="Bender administrado"
              />
            </td>
            <td className="os-tabla-num">
              <input
                type="checkbox"
                checked={e.graficoAdministrado}
                disabled={trabajando}
                onChange={(ev) => guardar('graficoAdministrado', ev.target.checked)}
                aria-label="Gráfico administrado"
              />
            </td>
            <td className="os-tabla-accion">
              <button
                className="os-boton os-boton-firme"
                disabled={trabajando}
                onClick={() => guardar('etapa', 'Por analizar')}
              >
                Tomada
              </button>
              {volver}
            </td>
          </>
        )}

        {etapa === 'Por analizar' && (
          <>
            <td>{fechaHora(e.fechaEntrevista) ?? <Falta texto="sin fecha" />}</td>
            <td className={`os-tabla-num${(e.dias ?? 0) > 7 ? ' os-dato-falta' : ''}`}>
              {haceCuanto(e.dias)}
            </td>
            <td>
              {[e.benderAdministrado ? 'Bender' : null, e.graficoAdministrado ? 'Gráfico' : null]
                .filter(Boolean)
                .join(' · ') || <Falta texto="nada marcado" />}
            </td>
            <td>{e.tieneInforme ? 'cargado' : <Falta texto="sin cargar" />}</td>
            <td>
              <select
                className="os-campo"
                defaultValue={e.recomendacion ?? ''}
                disabled={trabajando}
                onChange={(ev) => guardar('recomendacion', ev.target.value || null)}
                aria-label="Conclusión"
              >
                <option value="">Sin cerrar</option>
                {RECOMENDACIONES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </td>
            <td className="os-tabla-accion">
              <button
                className="os-boton os-boton-firme"
                disabled={trabajando || !e.recomendacion}
                onClick={() => guardar('etapa', 'Entregado')}
                title={e.recomendacion ? '' : 'Primero elegí la conclusión.'}
              >
                Entregar
              </button>
              {volver}
            </td>
          </>
        )}

        {(etapa === 'Entregado' || etapa === 'Seguimiento') && (
          <>
            <td>{fechaHora(e.fechaEntrega) ?? <Falta texto="sin fecha" />}</td>
            <td>{e.recomendacion ?? <Falta texto="sin cargar" />}</td>
            <td>{e.tieneInforme ? 'cargado' : <Falta texto="sin cargar" />}</td>
            <td className="os-tabla-accion">
              {etapa === 'Entregado' && (
                <button
                  className="os-boton"
                  disabled={trabajando}
                  onClick={() => guardar('etapa', 'Seguimiento')}
                >
                  Pasar a seguimiento
                </button>
              )}
              {volver}
            </td>
          </>
        )}
      </tr>

      {error && (
        <tr>
          <td colSpan={columnas.length} className="os-tabla-error">
            {error}
          </td>
        </tr>
      )}
    </>
  );
}

export default function TablaEtapa({
  filas,
  etapa,
}: {
  filas: Evaluacion[];
  etapa: string;
}) {
  const columnas = COLUMNAS[etapa] ?? COLUMNAS['Sin asignar'];

  return (
    <div className="os-tabla-marco">
      <table className="os-tabla os-tabla-trabajo">
        <thead>
          <tr>
            {columnas.map((c, i) => (
              <th key={c || `accion-${i}`} className={c === '' ? 'os-tabla-accion' : undefined}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((e) => (
            <Fila key={e.id} e={e} etapa={etapa} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
