'use client';

/**
 * Lo entregado, como registro: una tabla con todo junto.
 *
 * Es la única sección de psicotécnicos que no es un tablero, y a propósito. En
 * las otras el trabajo es mover una ficha de columna; acá el trabajo terminó y
 * lo que se hace es consultar: qué salió, cuándo, con qué conclusión y quién lo
 * firmó. Eso se recorre en filas, no en tarjetas.
 *
 * **Seguimiento dejó de ser una pantalla aparte y es una columna.** A los
 * noventa días de que la persona entró se llama al cliente para preguntar cómo
 * le fue, y con esa etapa en su propia sección la segunda mitad del circuito
 * vivía donde nadie entra salvo que se acuerde. Acá se ve en la misma fila que
 * el informe que se entregó, que es contra lo que se compara la respuesta.
 *
 * **La facturación no está acá.** Vive entera en su sección, que es donde se
 * emite el comprobante y se marca el cobro: un comprobante junta a varios
 * candidatos de un cliente, así que dos columnas de Sí y No por persona no
 * dicen a cuál de todos hay que ir a reclamarle.
 *
 * **Acá no se edita nada.** Todo lo que la fila muestra es dato: el
 * seguimiento se prende y se contesta desde la ficha de la persona, que es
 * donde están la fecha de ingreso que lo agenda y lo que contó la empresa. Una
 * tabla de consulta con controles adentro invita a cambiar de a un campo lo que
 * se carga junto, y deja la mitad del seguimiento sin cargar.
 */

import Link from 'next/link';
import { useState } from 'react';
import type { Evaluacion } from '@/lib/psicotecnicos';
import { fechaCorta } from '@/lib/hora';
import { Cuenta, Falta, columnas } from './piezas';

/** El color con el que se reconoce cada respuesta sin leerla. */
const COLOR_RESULTADO: Record<string, string> = {
  Bien: 'os-verde',
  Regular: 'os-ambar',
  Mal: 'os-rojo',
};

/**
 * Las columnas, con los anchos que declara `piezas.tsx`.
 *
 * Un campo mide lo mismo en cualquier tabla del sistema, así pasar de una
 * pantalla a otra no mueve nada de lugar.
 */
const COLUMNAS = [
  // La fecha adelante: un registro se recorre por cuándo pasó cada cosa.
  'Fecha',
  'Candidato',
  'Empresa',
  'Puesto',
  'Evaluadora',
  'Ficha',
  'Seguimiento',
  'Cómo le fue',
];
const MEDIDAS = columnas(COLUMNAS);

/**
 * Con qué se ordena cada columna.
 *
 * El valor sale como texto o como número según qué sea, y se compara con el
 * mismo criterio en las dos direcciones. Las columnas que no están acá (la de
 * la ficha) no se ordenan: su contenido es un botón, no un dato.
 */
const CLAVE: Record<string, (e: Evaluacion) => string | number> = {
  Fecha: (e) => e.fechaEntrega ?? '',
  Candidato: (e) => e.nombre.toLocaleLowerCase('es'),
  Empresa: (e) => e.empresa.toLocaleLowerCase('es'),
  Puesto: (e) => e.puesto.toLocaleLowerCase('es'),
  Evaluadora: (e) => (e.evaluadora ?? '').toLocaleLowerCase('es'),
  // Primero lo que vence antes, y lo que no está en seguimiento al final.
  Seguimiento: (e) => (e.etapa === 'Seguimiento' ? e.seguimientoAl ?? '9998' : '9999'),
  'Cómo le fue': (e) => e.seguimientoResultado ?? '',
};

/** Lo que se escribe en el buscador se compara contra esto. */
function textoDe(e: Evaluacion): string {
  return [e.nombre, e.empresa, e.puesto, e.evaluadora ?? '']
    .join(' ')
    .toLocaleLowerCase('es');
}

/**
 * Saca tildes y pasa a minúsculas.
 *
 * Sin esto, un apellido con tilde no aparece si se lo escribe sin ella, y el
 * buscador solo sirve para quien ya sabe cómo se cargó el nombre.
 */
function llano(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');
}

function Fila({ e }: { e: Evaluacion }) {
  const enSeguimiento = e.etapa === 'Seguimiento';

  return (
    <tr>
      <td data-campo="Fecha">{fechaCorta(e.fechaEntrega) ?? <Falta texto="sin fecha" />}</td>
      <td data-campo="Candidato" className="os-tabla-nombre">
        {e.nombre}
      </td>
      {/* Empresa y puesto en columnas propias: se ordena y se lee por cliente,
          y la fila queda en un renglón como todas las del sistema. */}
      <td data-campo="Empresa" className="os-tabla-recorta">
        {e.empresa}
      </td>
      <td data-campo="Puesto" className="os-tabla-flojo">
        {e.puesto}
      </td>
      {/* Solo el nombre de pila: son dos y las dos se apellidan Campos, así que
          el apellido no distingue nada y le comía ancho a la empresa. */}
      <td data-campo="Evaluadora" className="os-tabla-flojo" title={e.evaluadora ?? undefined}>
        {e.evaluadora ? e.evaluadora.split(' ')[0] : <Falta texto="sin asignar" />}
      </td>
      {/* La ficha y no el informe: desde ahí se llega al informe con un clic y
          además a todo lo que lo sostiene, que es lo que se viene a consultar
          cuando alguien pregunta por una evaluación vieja. */}
      <td data-campo="Ficha">
        {e.origen === 'supabase' ? (
          <Link
            className="os-boton os-boton-firme"
            href={`/os/psicotecnicos/ficha/${e.id}?desde=entregados`}
          >
            Ver ficha
          </Link>
        ) : (
          <Falta texto="fuera del sistema" />
        )}
      </td>
      {/* Cuánto queda para los noventa días, o que todavía no hay reloj. Se
          lee y no se toca: el seguimiento se prende desde la ficha, donde
          están la fecha de ingreso que lo agenda y lo que contó la empresa. */}
      <td data-campo="Seguimiento">
        {enSeguimiento ? (
          <Cuenta al={e.seguimientoAl} ingreso={e.ingreso} />
        ) : (
          <span className="os-sello-estado os-gris">Sin seguir</span>
        )}
      </td>
      {/* Lo que contestó la empresa: es el final del circuito y lo único que
          dice si la evaluación acertó. Sin seguimiento prendido no hay nada
          que preguntar todavía. */}
      <td data-campo="Cómo le fue">
        {!enSeguimiento ? (
          <span className="os-tabla-flojo">—</span>
        ) : e.seguimientoResultado ? (
          <span className={`os-sello-estado ${COLOR_RESULTADO[e.seguimientoResultado] ?? 'os-gris'}`}>
            {e.seguimientoResultado}
          </span>
        ) : (
          <span className="os-sello-estado os-gris">Sin preguntar</span>
        )}
      </td>
    </tr>
  );
}

export default function Entregados({ filas }: { filas: Evaluacion[] }) {
  const [busca, setBusca] = useState('');
  // Arranca por fecha y de lo último a lo primero, que es como se consulta un
  // registro cuando uno no busca a nadie en particular.
  const [orden, setOrden] = useState<{ campo: string; desc: boolean }>({
    campo: 'Fecha',
    desc: true,
  });

  /** Un clic ordena por esa columna; el siguiente da vuelta la dirección. */
  function ordenarPor(campo: string) {
    setOrden((o) => (o.campo === campo ? { campo, desc: !o.desc } : { campo, desc: false }));
  }

  const buscado = llano(busca.trim());
  const visibles = buscado ? filas.filter((e) => llano(textoDe(e)).includes(buscado)) : filas;
  const clave = CLAVE[orden.campo] ?? CLAVE.Fecha;
  const ordenadas = [...visibles].sort((a, b) => {
    const x = clave(a);
    const y = clave(b);
    const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es');
    return orden.desc ? -cmp : cmp;
  });
  const siguiendo = filas.filter((e) => e.etapa === 'Seguimiento');
  // Los que hay que llamar hoy: entraron, ya pasaron los noventa días y todavía
  // no se preguntó. Es la única acción pendiente de esta pantalla.
  const vencidos = siguiendo.filter(
    (e) =>
      e.ingreso === true &&
      !e.seguimientoResultado &&
      e.seguimientoAl !== null &&
      e.seguimientoAl <= new Date().toISOString().slice(0, 10)
  ).length;

  if (filas.length === 0) {
    return (
      <div className="os-panel">
        <p className="os-vacio">Todavía no salió ningún informe.</p>
      </div>
    );
  }

  return (
    <>
      {vencidos > 0 && (
        <div className="os-aviso">
          {vencidos === 1
            ? 'Hay 1 seguimiento vencido: pasaron los noventa días y falta preguntar cómo le fue.'
            : `Hay ${vencidos} seguimientos vencidos: pasaron los noventa días y falta preguntar cómo les fue.`}
        </div>
      )}

      <div className="os-barra-acciones os-barra-filtro">
        <input
          className="os-campo os-buscador"
          type="search"
          value={busca}
          onChange={(ev) => setBusca(ev.target.value)}
          placeholder="Buscar por candidato, empresa, puesto o evaluadora"
          aria-label="Buscar en lo entregado"
        />
        {buscado && (
          <span className="os-columna-monto">
            {visibles.length === 1 ? '1 resultado' : `${visibles.length} resultados`}
          </span>
        )}
      </div>

      <div className="os-panel">
        <div className="os-tabla-marco">
          <table className="os-tabla os-tabla-trabajo os-tabla-fija">
            <colgroup>
              {COLUMNAS.map((c, i) => (
                <col key={c} style={{ width: MEDIDAS[i] }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {COLUMNAS.map((c) =>
                  CLAVE[c] ? (
                    <th key={c}>
                      <button
                        type="button"
                        className={`os-tabla-orden${orden.campo === c ? ' puesto' : ''}`}
                        onClick={() => ordenarPor(c)}
                        title={`Ordenar por ${c.toLocaleLowerCase('es')}`}
                      >
                        {c}
                        <span aria-hidden="true">
                          {orden.campo === c ? (orden.desc ? '↓' : '↑') : ''}
                        </span>
                      </button>
                    </th>
                  ) : (
                    <th key={c}>{c}</th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {ordenadas.length === 0 && (
                <tr>
                  <td colSpan={COLUMNAS.length} className="os-vacio">
                    Nada coincide con “{busca.trim()}”.
                  </td>
                </tr>
              )}
              {ordenadas.map((e) => (
                <Fila key={e.id} e={e} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
