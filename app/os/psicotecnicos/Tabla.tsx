'use client';

/**
 * Una sección del pipeline, como tabla.
 *
 * Cada sección tiene sus columnas: las que hacen falta para hacer ese tramo del
 * trabajo y ninguna más. Es la diferencia con la interfaz de Airtable, donde
 * cada fila abre las mismas veinticinco columnas esté donde esté.
 *
 * Los campos se editan adentro de la celda y guardan solos: un botón de
 * guardar suelto es un cambio que se pierde.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import Desplegable from '@/app/os/Desplegable';
import Bateria from './Bateria';
import type { Evaluacion } from '@/lib/psicotecnicos';
import { nivelDeConclusion } from '@/lib/informe-textos';
import {
  desdeInput,
  diaDeLaSemana,
  enDias,
  fechaCorta,
  fechaHora,
  haceCuanto,
  paraInput,
} from '@/lib/hora';



/**
 * Las columnas de cada sección, en orden. La última siempre es la acción.
 *
 * Entrevistas junta citar y entrevistar en una sola tabla: son el mismo
 * trabajo de la misma persona, y separarlas obligaba a saltar de una lista a
 * la otra para seguir a un candidato. Cada fila muestra su estado y su propia
 * acción según la etapa en la que está.
 */
const COLUMNAS: Record<string, string[]> = {
  // Sin la columna Batería: va pegada a la empresa, en la celda del pedido.
  'sin-asignar': ['Candidato', 'Pedido', 'Ingresó', 'Esperando', ''],
  // Entrevistas va en dos tablas, una por etapa: citar necesita el teléfono y
  // el estado del contacto; una entrevista ya agendada necesita saber qué se
  // administró. Juntas, las ocho columnas no entraban en la pantalla.
  'entrevistas:Por citar': ['Candidato', 'Pedido', 'Batería', 'Teléfono', 'Contacto', 'Entrevista', 'Modalidad', ''],
  /**
   * Agendadas arranca por la entrevista y no por el candidato: acá lo que se
   * mira es qué viene y cuándo, no a quién hay que buscar. El pedido queda al
   * final, que es el dato que menos se consulta con la fecha ya puesta.
   *
   * No repite lo que se decidió al citar: la fecha, la modalidad y el estado
   * del contacto se editan arriba y acá solo se leen. Editarlos en dos lugares
   * es tener dos verdades del mismo dato.
   */
  'entrevistas:Por entrevistar': [
    'Entrevista',
    'Modalidad',
    'Candidato',
    'Batería',
    'Teléfono',
    'Pedido',
    '',
  ],
  'por-analizar': ['Candidato', 'Pedido', 'Batería', 'Espera', ''],
  entregados: ['Candidato', 'Pedido', 'Evaluadora', 'Entregado', 'Conclusión', 'Informe', ''],
  seguimiento: ['Candidato', 'Pedido', 'Evaluadora', 'Entregado', 'Ingresó', 'Seguimiento', ''],
};

/**
 * Cuánto mide cada columna, por el nombre del campo.
 *
 * Fijo y por campo, no por posición: así "Candidato" mide lo mismo en las
 * cuatro tablas y pasar de una sección a otra no mueve nada de lugar. Sin
 * esto, cada tabla repartía el ancho según su contenido y las mismas columnas
 * quedaban de distinto tamaño en cada pantalla.
 *
 * El pedido es el único que puede ocupar dos renglones, porque trae la empresa
 * arriba y el puesto abajo. El resto se recorta con puntos suspensivos: una
 * fila de dos renglones desalinea toda la tabla.
 *
 * Los valores están calibrados para que ninguna tabla pase de 1200 px, que es
 * lo que entra sin desplazar en una pantalla de trabajo. La más ancha es "Por
 * citar", con ocho columnas, y da exactamente 1200.
 */
const ANCHO: Record<string, number> = {
  Candidato: 154,
  Pedido: 190,
  /* Lo que mide "B1 + bzg", que es el sello más largo. */
  Batería: 92,
  Teléfono: 158,
  /* Lo que mide el botón "Sin contactar", que es el estado de texto más largo.
     Con 124 el botón no entraba: perdía su padding derecho y el texto quedaba
     contra el borde, que es lo que se veía como descentrado. Los veinte píxeles
     salieron de la columna de acciones y de Candidato, que sobraban. */
  Contacto: 144,
  Entrevista: 174,
  Modalidad: 122,
  /* El botón que copia el enlace del test, con lugar para el aviso de que se
     copió. Va en su columna y no con las acciones: apretado ahí, la tabla se
     pasaba de los 1200 px que miden todas. */
  Esperando: 110,
  Espera: 120,
  Informe: 118,
  Conclusión: 222,
  Entregado: 110,
  Evaluadora: 140,
  Ingresó: 118,
  Seguimiento: 150,
  /* El botón más ancho ("Informe listo") con la flecha de volver al lado. */
  '': 166,
};

/**
 * Secciones donde todas las tablas miden lo mismo.
 *
 * Entrevistas son dos tablas una debajo de la otra, y "Agendadas" tiene una
 * columna menos porque el contacto se marca al citar. Con los anchos por campo
 * quedaría 124 px más angosta que la de arriba, y dos tablas apiladas de
 * distinto ancho se leen como si no tuvieran que ver entre sí.
 */
const ANCHO_PAREJO: Record<string, number> = {
  entrevistas: 1200,
};

/**
 * El ancho de cada columna, ya repartido el sobrante de la sección.
 *
 * La diferencia se reparte en partes iguales entre las columnas de datos, así
 * la tabla más corta queda con los campos espaciados igual que la larga. La
 * columna de la acción no participa: su botón mide lo que mide y el aire de
 * más lo alejaría de la fila.
 */
function anchos(columnas: string[], seccion: string): number[] {
  const base = columnas.map((c) => ANCHO[c] ?? 140);
  const total = ANCHO_PAREJO[seccion];
  if (!total) return base;

  const sobra = total - base.reduce((n, x) => n + x, 0);
  const datos = columnas.map((c, i) => (c === '' ? -1 : i)).filter((i) => i >= 0);
  if (sobra <= 0 || datos.length === 0) return base;

  const salida = [...base];
  const parte = Math.floor(sobra / datos.length);
  datos.forEach((i) => (salida[i] += parte));
  // Lo que no entra en la división va a la primera, que es la que se lee.
  salida[datos[0]] += sobra - parte * datos.length;
  return salida;
}

function soloDigitos(t: string): string {
  return t.replace(/[^0-9]/g, '');
}

function Falta({ texto = 'falta' }: { texto?: string }) {
  return <span className="os-dato-falta">{texto}</span>;
}

/**
 * El nombre lleva a donde se va a trabajar con esa persona.
 *
 * Con la entrevista agendada eso es la hoja de la entrevista, que tiene la
 * herramienta de cada test a un clic. En el resto de las etapas es la ficha,
 * que es donde se carga y se lee lo suyo.
 */
function Persona({ e, seccion }: { e: Evaluacion; seccion: string }) {
  if (e.origen !== 'supabase') return <div className="os-tabla-nombre">{e.nombre}</div>;
  const agendada = seccion === 'entrevistas' && e.etapa === 'Por entrevistar';
  return (
    <Link
      className="os-tabla-nombre os-tabla-ficha"
      href={
        agendada
          ? `/os/psicotecnicos/entrevista/${e.id}`
          : `/os/psicotecnicos/ficha/${e.id}?desde=${seccion}`
      }
    >
      {e.nombre}
    </Link>
  );
}


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

/**
 * El pedido: empresa arriba, puesto abajo.
 *
 * Los dos renglones van adentro de una caja y no sueltos en la celda porque en
 * el teléfono la celda es flexible y ahí, sin caja, empresa y puesto se
 * acomodan uno al lado del otro y el puesto se recorta.
 */
function Busqueda({
  e,
  conEvaluadora,
  conBateria = false,
}: {
  e: Evaluacion;
  conEvaluadora: boolean;
  conBateria?: boolean;
}) {
  return (
    <div className="os-tabla-pedido">
      <div className="os-tabla-empresa">
        <span className="os-tabla-recorta">{e.empresa}</span>
        {/* Al lado de la empresa y no en columna propia: en Sin asignar la
            batería se mira junto con el pedido, para saber qué se va a tomar,
            y una columna entera para decir "B1" es ancho que le hace falta al
            resto de la tabla. */}
        {conBateria && (
          <>
            <span className="os-tabla-punto">·</span>
            <Bateria codigo={e.bateria} conBenziger={e.conBenziger} />
          </>
        )}
      </div>
      <div className="os-tabla-flojo">
        {e.puesto}
        {conEvaluadora && (e.evaluadora ? ` · ${e.evaluadora}` : ' · sin evaluadora')}
      </div>
    </div>
  );
}

function Fila({ e, seccion }: { e: Evaluacion; seccion: string }) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retroceder() {
    // Vuelve desde donde está esa fila, no desde la sección: en Entrevistas
    // conviven las dos etapas y cada una retrocede a la suya.
    const destino = ANTERIOR[e.etapa];
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

  const volver = ANTERIOR[e.etapa] ? (
    // La caja es la que trae la línea que lo separa de la acción principal: el
    // botón es redondo y un borde propio le rompería el círculo.
    <span className="os-volver-caja">
      <button
        className="os-boton os-boton-volver"
        disabled={trabajando}
        onClick={retroceder}
        title={`Volver a ${ANTERIOR[e.etapa]}`}
        aria-label={`Volver a ${ANTERIOR[e.etapa]}`}
      >
        ←
      </button>
    </span>
  ) : null;
  const columnas = COLUMNAS[`${seccion}:${e.etapa}`] ?? COLUMNAS[seccion] ?? COLUMNAS['sin-asignar'];

  // Agendadas arma sus propias celdas, en su orden. Las demás secciones
  // arrancan siempre por candidato y pedido.
  const agendada = seccion === 'entrevistas' && e.etapa === 'Por entrevistar';

  return (
    <>
      <tr>
        {!agendada && (
          <>
            <td data-campo="Candidato">
              <Persona e={e} seccion={seccion} />
            </td>
            <td data-campo="Pedido">
              <Busqueda e={e} conEvaluadora={false} conBateria={seccion === 'sin-asignar'} />
            </td>
          </>
        )}

        {seccion === 'sin-asignar' && (
          <>
            <td data-campo="Ingresó">{fechaHora(e.fechaIngreso) ?? <Falta texto="sin fecha" />}</td>
            <td data-campo="Esperando" className="os-tabla-num">{enDias(e.diasEsperando)}</td>
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

        {seccion === 'entrevistas' && e.etapa === 'Por citar' && (
          <>
            <td data-campo="Batería">
              <Bateria codigo={e.bateria} conBenziger={e.conBenziger} />
            </td>
            <td data-campo="Teléfono" className="os-tabla-telefono">
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
            <td data-campo="Contacto" className="os-tabla-contacto">
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
            <td data-campo="Entrevista">
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
            <td data-campo="Modalidad" className="os-tabla-modalidad">
              <Desplegable
                valor={e.modalidad ?? ''}
                opciones={[
                  { valor: '', texto: 'Sin definir' },
                  { valor: 'Presencial', texto: 'Presencial' },
                  { valor: 'Online', texto: 'Online' },
                ]}
                alElegir={(v) => guardar('modalidad', v || null)}
                deshabilitado={trabajando}
                etiqueta="Modalidad"
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

        {agendada && (
          <>
            {/* El día adelante: al mirar la agenda se busca primero qué día
                cae, y recién después la hora. */}
            <td data-campo="Entrevista" className="os-tabla-cuando">
              {e.fechaEntrevista ? (
                `${diaDeLaSemana(e.fechaEntrevista)} ${fechaHora(e.fechaEntrevista)}`
              ) : (
                <Falta texto="sin fecha" />
              )}
            </td>
            <td data-campo="Modalidad">{e.modalidad ?? <Falta texto="sin definir" />}</td>
            <td data-campo="Candidato">
              <Persona e={e} seccion={seccion} />
            </td>
            <td data-campo="Batería">
              <Bateria codigo={e.bateria} conBenziger={e.conBenziger} />
            </td>
            <td data-campo="Teléfono" className="os-tabla-telefono">
              {e.telefono ? (
                <a href={`tel:${soloDigitos(e.telefono)}`}>{e.telefono}</a>
              ) : (
                <Falta />
              )}
            </td>
            <td data-campo="Pedido">
              <Busqueda e={e} conEvaluadora={false} />
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

        {seccion === 'por-analizar' && (
          <>
            <td data-campo="Batería">
              <Bateria codigo={e.bateria} conBenziger={e.conBenziger} />
            </td>
            {/* Los días desde la entrevista: el reloj del análisis. En rojo
                pasada la semana, que es cuando el informe se está demorando. */}
            <td data-campo="Espera" className={`os-tabla-num${(e.dias ?? 0) > 7 ? ' os-dato-falta' : ''}`}>
              {haceCuanto(e.dias)}
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

        {seccion === 'seguimiento' && (
          <>
            <td data-campo="Evaluadora">{e.evaluadora ?? <Falta texto="sin asignar" />}</td>
            <td data-campo="Entregado">{fechaCorta(e.fechaEntrega) ?? <Falta texto="sin fecha" />}</td>
            {/* Si entró a trabajar. Es lo que después permite medir el acierto
                de cada evaluación contra lo que pasó de verdad. */}
            <td data-campo="Ingresó">
              {e.ingreso === null ? (
                <Falta texto="sin saber" />
              ) : (
                <span className={`os-sello-estado ${e.ingreso ? 'os-verde' : 'os-gris'}`}>
                  {e.ingreso ? 'Sí' : 'No'}
                </span>
              )}
            </td>
            <td data-campo="Seguimiento">
              {fechaCorta(e.seguimientoAl) ?? <Falta texto="sin fecha" />}
            </td>
            <td className="os-tabla-accion">{volver}</td>
          </>
        )}

        {seccion === 'entregados' && (
          <>
            <td data-campo="Evaluadora">{e.evaluadora ?? <Falta texto="sin asignar" />}</td>
            <td data-campo="Entregado">{fechaCorta(e.fechaEntrega) ?? <Falta texto="sin fecha" />}</td>
            <td data-campo="Conclusión">
              {nivelDeConclusion(e.recomendacion)?.titulo ??
                e.recomendacion ?? <Falta texto="sin cargar" />}
            </td>
            {/* El informe se arma con los datos, así que se abre en vez de
                decir si está cargado. */}
            <td data-campo="Informe">
              {e.origen === 'supabase' ? (
                <Link
                  className="os-boton os-boton-firme"
                  href={`/os/psicotecnicos/informe/${e.id}`}
                  target="_blank"
                >
                  Ver informe
                </Link>
              ) : e.tieneInforme ? (
                'cargado'
              ) : (
                <Falta texto="sin cargar" />
              )}
            </td>
            <td className="os-tabla-accion">
              {seccion === 'entregados' && (
                <button
                  className="os-boton"
                  disabled={trabajando}
                  onClick={() => guardar('etapa', 'Seguimiento')}
                >
                  Seguimiento
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
  seccion,
}: {
  filas: Evaluacion[];
  seccion: string;
}) {
  // Cada bloque de Entrevistas trae filas de una sola etapa, así que la
  // primera alcanza para saber qué columnas van.
  const clave = filas[0] ? `${seccion}:${filas[0].etapa}` : seccion;
  const columnas = COLUMNAS[clave] ?? COLUMNAS[seccion] ?? COLUMNAS['sin-asignar'];
  const medidas = anchos(columnas, seccion);

  return (
    <div className="os-tabla-marco">
      {/* El ancho total es la suma de las columnas, puesto a mano: con `auto`
          o `max-content` la tabla toma el ancho de su contenido (el campo de
          fecha, los botones) y reparte el sobrante, y los anchos declarados
          dejan de cumplirse.

          Va como variable y no como `width` directo porque en el teléfono la
          tabla se desarma en fichas y ahí el ancho lo pone la pantalla: un
          estilo en línea le gana a la hoja y no habría forma de soltarlo. */}
      <table
        className="os-tabla os-tabla-trabajo os-tabla-fija"
        style={
          { '--os-tabla-ancho': `${medidas.reduce((n, x) => n + x, 0)}px` } as React.CSSProperties
        }
      >
        {/* El ancho lo fija la columna, no su contenido: una tabla que se
            reacomoda al escribir es una tabla que no se puede recorrer.

            Va en proporción y no en píxeles: mientras la ventana da el ancho
            declarado, cada columna mide exactamente lo suyo, y cuando no lo da
            se reparten lo que hay sin cambiar el orden ni las proporciones. Con
            píxeles la tabla no podía achicarse y el panel terminaba
            desplazándose de costado, que esconde columnas enteras sin avisar. */}
        <colgroup>
          {columnas.map((c, i) => (
            <col
              key={c || `accion-${i}`}
              style={{ width: `${(medidas[i] / medidas.reduce((n, x) => n + x, 0)) * 100}%` }}
            />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columnas.map((c, i) => (
              <th
                key={c || `accion-${i}`}
                className={
                  c === ''
                    ? 'os-tabla-accion'
                    : // El rótulo lleva el mismo aire que su celda, o queda corrido.
                      c === 'Contacto'
                      ? 'os-tabla-contacto'
                      : undefined
                }
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((e) => (
            <Fila key={e.id} e={e} seccion={seccion} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
