'use client';

import { useState } from 'react';

/** Una fila ya resuelta por el servidor: acá solo se ordena y se dibuja. */
export type FilaEntregada = {
  id: string;
  /** Fecha del pedido en ISO, para ordenar. */
  fechaOrden: string;
  fechaTexto: string | null;
  puesto: string;
  nombre: string;
  evaluadora: string | null;
  /** Texto corto de la recomendación (el largo va en el título). */
  recoTexto: string | null;
  recoCompleta: string | null;
  recoClase: string;
  /** Posición de la recomendación al ordenar: del apto al no apto. */
  recoOrden: number;
  /** Enlace al PDF, o null si todavía no está cargado. */
  informe: string | null;
};

type Clave = 'fecha' | 'pedido' | 'candidato' | 'evaluadora' | 'reco';

const COLUMNAS: { clave: Clave; titulo: string }[] = [
  { clave: 'fecha', titulo: 'Fecha' },
  { clave: 'pedido', titulo: 'Pedido' },
  { clave: 'candidato', titulo: 'Candidato' },
  { clave: 'evaluadora', titulo: 'Evaluadora' },
  { clave: 'reco', titulo: 'Recomendación' },
];

/** Las columnas de texto arrancan de la A a la Z; fecha y recomendación
 *  arrancan al revés: lo más reciente y lo más apto primero. */
const ARRANCA_ASC: Record<Clave, boolean> = {
  fecha: false,
  pedido: true,
  candidato: true,
  evaluadora: true,
  reco: true,
};

function comparar(a: FilaEntregada, b: FilaEntregada, col: Clave): number {
  const texto = (x: string | null) => x ?? '';
  switch (col) {
    case 'fecha':
      return texto(a.fechaOrden).localeCompare(texto(b.fechaOrden));
    case 'pedido':
      return a.puesto.localeCompare(b.puesto, 'es');
    case 'candidato':
      return a.nombre.localeCompare(b.nombre, 'es');
    case 'evaluadora':
      return texto(a.evaluadora).localeCompare(texto(b.evaluadora), 'es');
    case 'reco':
      return a.recoOrden - b.recoOrden;
  }
}

export default function TablaEntregados({ filas }: { filas: FilaEntregada[] }) {
  const [orden, setOrden] = useState<{ col: Clave; asc: boolean }>({
    col: 'fecha',
    asc: false,
  });

  // A igualdad de valor manda el nombre, así el orden no baila entre clics.
  const ordenadas = [...filas].sort((a, b) => {
    const d = comparar(a, b, orden.col);
    if (d !== 0) return orden.asc ? d : -d;
    return a.nombre.localeCompare(b.nombre, 'es');
  });

  const alClic = (col: Clave) =>
    setOrden((prev) =>
      prev.col === col
        ? { col, asc: !prev.asc }
        : { col, asc: ARRANCA_ASC[col] }
    );

  return (
    <div className="tabla entregados">
      <div className="tr th">
        {COLUMNAS.map(({ clave, titulo }) => {
          const activa = orden.col === clave;
          return (
            <span
              key={clave}
              aria-sort={
                activa ? (orden.asc ? 'ascending' : 'descending') : 'none'
              }
            >
              <button
                type="button"
                className={`th-orden${activa ? ' th-orden-activa' : ''}`}
                onClick={() => alClic(clave)}
              >
                {titulo}
                <span className="th-flecha" aria-hidden="true">
                  {activa ? (orden.asc ? '↑' : '↓') : '↕'}
                </span>
              </button>
            </span>
          );
        })}
        <span>Informe</span>
      </div>

      {ordenadas.map((f) => (
        <div className="tr" key={f.id}>
          <span className="c-fecha" data-label="Fecha">
            {f.fechaTexto ?? <span className="dash">—</span>}
          </span>
          <span className="c-pedido" data-label="Pedido">
            {f.puesto}
          </span>
          <span className="c-name">{f.nombre}</span>
          <span className="c-evaluadora" data-label="Evaluadora">
            {f.evaluadora ?? <span className="dash">—</span>}
          </span>
          <span className="c-reco" data-label="Recomendación">
            {f.recoTexto ? (
              <>
                <i className={`dot ${f.recoClase}`} />
                <span className="reco-txt" title={f.recoCompleta ?? undefined}>
                  {f.recoTexto}
                </span>
              </>
            ) : (
              <span className="dash">—</span>
            )}
          </span>
          {/* El botón todavía no abre el PDF: al pasar el cursor avisa que la
              descarga viene después. El enlace real vive en f.informe y se
              enchufa cambiando este span por un <a href={f.informe}>. */}
          <span className="c-informe" data-label="Informe">
            {f.informe ? (
              <span className="btn-informe btn-informe-pronto">
                <span className="bi-texto">Ver informe</span>
                <span className="bi-pronto">Próximamente</span>
              </span>
            ) : (
              <span className="dash">—</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
