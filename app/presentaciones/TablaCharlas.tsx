'use client';

import { useEffect, useState } from 'react';

/**
 * Las charlas de un ciclo.
 *
 * Cuando el ciclo tiene clientes corriendo, arriba va para cuál se está
 * proyectando. Las cinco charlas son las mismas para todos y lo que cambia es
 * de dónde salen las respuestas, así que abrir una sin decir para quién es
 * abriría la de cualquiera: el enlace llevaría al primero de la lista y en la
 * sala nadie se enteraría de que las palabras proyectadas son de otro grupo.
 */

const BASE = 'https://tools.camposhr.com/pres';

export type Charla = {
  token: string | null;
  archivo: string | null;
  titulo: string;
  subtitulo: string;
  orden: number;
  placas: number;
  fechaTexto: string;
  cliente: string | null;
};

export type Cliente = { slug: string; empresa: string };

export default function TablaCharlas({
  charlas,
  clientes,
}: {
  charlas: Charla[];
  /** Vacío en los ciclos sin actividades desde el teléfono. */
  clientes: Cliente[];
}) {
  const [elegido, setElegido] = useState<string>('');

  // Se recuerda entre visitas: durante un encuentro se entra varias veces a
  // buscar la charla siguiente, y volver a elegir cada vez invita a errarle.
  useEffect(() => {
    if (clientes.length === 0) return;
    let guardado = '';
    try {
      guardado = localStorage.getItem('pres-cliente') ?? '';
    } catch {
      // Navegador sin almacenamiento: se elige a mano cada vez.
    }
    if (clientes.some((c) => c.slug === guardado)) {
      setElegido(guardado);
      return;
    }
    // Con un solo cliente corriendo el ciclo no hay nada que elegir: el paso
    // sobra y se hace en la sala, con la charla por empezar.
    setElegido(clientes.length === 1 ? clientes[0].slug : '');
  }, [clientes]);

  function elegir(slug: string) {
    setElegido(slug);
    try {
      localStorage.setItem('pres-cliente', slug);
    } catch {
      // Sin almacenamiento sigue valiendo para esta visita.
    }
  }

  const conClientes = clientes.length > 0;
  const enlace = (token: string) =>
    elegido ? `${BASE}/${token}?c=${elegido}` : `${BASE}/${token}`;

  return (
    <>
      {conClientes && (
        <div className="pres-para">
          <label htmlFor="pres-cliente">Proyectar para</label>
          <select
            id="pres-cliente"
            className="cq-select"
            value={elegido}
            onChange={(e) => elegir(e.target.value)}
          >
            <option value="">Elegí el cliente…</option>
            {clientes.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.empresa}
              </option>
            ))}
          </select>
          {!elegido && (
            <span className="pres-para-aviso">
              Sin esto la charla abre sin saber de quién son las respuestas.
            </span>
          )}
        </div>
      )}

      {/* En el ciclo con clientes, la fecha y el cliente de cada fila no dicen
          nada: el material es el mismo para todos y quién lo va a proyectar se
          elige arriba. Las fechas que trae el índice son las del primer cliente
          que lo recorrió. */}
      <div className={`card pres-tabla ${conClientes ? 'pres-tabla-sola' : ''}`}>
        <div className="pres-row pres-th">
          {!conClientes && <span>Fecha</span>}
          {!conClientes && <span>Cliente</span>}
          <span>Charla</span>
          <span className="pres-num">Placas</span>
          <span />
          {!conClientes && <span />}
        </div>

        {charlas.map((p) => (
          <div className="pres-row" key={`${p.orden}-${p.titulo}`}>
            {!conClientes && <span className="cot-fecha">{p.fechaTexto}</span>}
            {!conClientes && (
              <span>
                {p.cliente && <em className="chip chip-cliente">{p.cliente}</em>}
              </span>
            )}
            <span className="pres-charla">
              <b>
                {p.orden}. {p.titulo}
              </b>
              <em>{p.subtitulo}</em>
            </span>
            <span className="pres-num">{p.placas}</span>

            {p.token ? (
              <>
                <span className="pres-accion">
                  <a
                    className={`copiar pres-ver ${
                      conClientes && !elegido ? 'pres-ver-frenado' : ''
                    }`}
                    href={enlace(p.token)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => {
                      // Mejor no abrir que abrir para el cliente equivocado.
                      if (conClientes && !elegido) {
                        e.preventDefault();
                        // El clic no queda en la nada: el foco va a lo que falta.
                        document.getElementById('pres-cliente')?.focus();
                      }
                    }}
                  >
                    Ver presentación
                  </a>
                </span>
                {/* La descarga es el respaldo del plan A, que es autosuficiente
                    y se dicta igual sin internet. En el plan B el archivo
                    bajado abre marcos vacíos: ahí no se ofrece. */}
                {!conClientes && (
                  <span className="pres-accion">
                    <a className="copiar" href={`/pres/${p.archivo}`} download>
                      Descargar
                    </a>
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="pres-accion">
                  <em className="pres-pendiente">Sin publicar</em>
                </span>
                {!conClientes && <span />}
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
