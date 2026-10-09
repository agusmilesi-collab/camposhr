import Link from 'next/link';
import { leerPedido } from '@/lib/pedidos';
import { DEL_JEFE, DEL_PUESTO, puestoConCiudad, type Pregunta } from '@/lib/pedido-campos';
import { ESTRATOS, PREGUNTAS, enPalabras } from '@/lib/potencial';
import { fechaCorta } from '@/lib/hora';

/**
 * DPT: el descriptivo del puesto de trabajo, dentro de la ficha de la persona.
 *
 * Junta en una pestaña todo lo que se sabe del puesto para el que se la
 * evalúa: lo que pidió el cliente, el descriptivo que adjuntó, las nueve
 * respuestas del perfil del puesto y de quien lo conduce, y el nivel de trabajo
 * cuando la batería lo lleva. Todo eso vive en el pedido, y para leerlo había
 * que salir de la ficha y abrir el pedido en otra pantalla.
 *
 * Acá se lee y no se edita: se corrige en la ficha del pedido, que es de donde
 * sale, y el botón de arriba lleva hasta ahí. Con dos lugares para editar lo
 * mismo, el que no se tocó queda mostrando lo viejo.
 */

function Bloque({
  titulo,
  accion,
  children,
}: {
  titulo: string;
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="os-panel">
      <div className="os-panel-top">
        <h2>{titulo}</h2>
        {accion && <span className="os-panel-accion">{accion}</span>}
      </div>
      <div className="os-ficha-datos">{children}</div>
    </section>
  );
}

function Dato({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="os-ficha-dato">
      <div className="os-ficha-rotulo">{rotulo}</div>
      <div className="os-ficha-valor">{children}</div>
    </div>
  );
}

function Falta({ texto }: { texto: string }) {
  return <span className="os-dato-falta">{texto}</span>;
}

/** Un texto largo del cliente, con sus saltos de línea. */
function Parrafo({ texto }: { texto: string }) {
  return <span style={{ whiteSpace: 'pre-wrap' }}>{texto}</span>;
}

/** La respuesta a una pregunta del perfil, con lo que esa opción significa. */
function Respuesta({ pregunta, valor }: { pregunta: Pregunta; valor: string | null }) {
  if (!valor) return <Falta texto="sin contestar" />;
  const ayuda = pregunta.ayudas[pregunta.opciones.indexOf(valor)];
  return (
    <>
      <strong>{valor}</strong>
      {ayuda ? ` · ${ayuda}` : ''}
    </>
  );
}

export default async function Dpt({
  pedidoId,
  ciudad,
  solicitante,
}: {
  pedidoId: string | null;
  /** Para qué ciudad se evalúa a esta persona, en los clientes que la piden. */
  ciudad: string | null;
  /** Quién pidió a esta persona, que puede no ser quien abrió el pedido. */
  solicitante: string | null;
}) {
  const pedido = pedidoId ? await leerPedido(pedidoId).catch(() => null) : null;
  if (!pedido) {
    return <p className="os-vacio">Esta persona no tiene un pedido cargado.</p>;
  }

  const respuestas = pedido as unknown as Record<string, string | null>;
  const complejidad = pedido.complejidad ?? {};
  const hayNivel =
    pedido.timeSpanDias !== null ||
    pedido.estratoPuesto !== null ||
    Object.keys(complejidad).length > 0;
  const estrato = pedido.estratoPuesto ? ESTRATOS[pedido.estratoPuesto - 1] : null;

  return (
    <>
      <Bloque
        titulo="El pedido"
        accion={
          <Link className="os-boton" href={`/os/pedidos/${pedido.id}`}>
            Abrir el pedido
          </Link>
        }
      >
        <Dato rotulo="Puesto">{puestoConCiudad(pedido.puesto, ciudad)}</Dato>
        <Dato rotulo="Empresa">{pedido.empresa}</Dato>
        <Dato rotulo="Lo pidió">{solicitante ?? <Falta texto="sin cargar" />}</Dato>
        <Dato rotulo="Fecha del pedido">
          {pedido.fechaPedido ? fechaCorta(pedido.fechaPedido) : <Falta texto="sin fecha" />}
        </Dato>
        <Dato rotulo="Evaluación">
          {pedido.bateria ?? <Falta texto="sin batería" />}
          {pedido.conBenziger ? ' más evaluación de perfil (BTSA)' : ''}
        </Dato>
        <Dato rotulo="Descriptivo de puesto">
          {pedido.descriptivo ? (
            <a href={`/api/os/descriptivo/${pedido.id}`} target="_blank" rel="noreferrer">
              {pedido.descriptivo}
            </a>
          ) : (
            <Falta texto="el cliente no lo adjuntó" />
          )}
        </Dato>
        <Dato rotulo="Qué pidió el cliente">
          {pedido.notas ? <Parrafo texto={pedido.notas} /> : <Falta texto="sin cargar" />}
        </Dato>
        <Dato rotulo="Contexto y cultura">
          {pedido.contexto ? <Parrafo texto={pedido.contexto} /> : <Falta texto="sin cargar" />}
        </Dato>
      </Bloque>

      <Bloque titulo="Cómo es el puesto">
        {DEL_PUESTO.map((p) => (
          <Dato rotulo={p.rotulo} key={p.campo}>
            <Respuesta pregunta={p} valor={respuestas[p.campo] ?? null} />
          </Dato>
        ))}
      </Bloque>

      <Bloque titulo="Quién lo conduce">
        {DEL_JEFE.map((p) => (
          <Dato rotulo={p.rotulo} key={p.campo}>
            <Respuesta pregunta={p} valor={respuestas[p.campo] ?? null} />
          </Dato>
        ))}
      </Bloque>

      {/* El nivel de trabajo del puesto solo se pregunta en las baterías que
          llevan análisis de potencial: en las demás no hay nada que mostrar. */}
      {hayNivel && (
        <Bloque titulo="Nivel de trabajo del puesto">
          <Dato rotulo="Tarea de mayor alcance">
            {pedido.timeSpanDias !== null ? (
              enPalabras(pedido.timeSpanDias)
            ) : (
              <Falta texto="sin contestar" />
            )}
          </Dato>
          {PREGUNTAS.map((p) => {
            const si = complejidad[String(p.estrato)];
            return (
              <Dato rotulo={p.corto} key={p.estrato}>
                {si === undefined ? <Falta texto="sin contestar" /> : si ? 'Sí' : 'No'}
              </Dato>
            );
          })}
          <Dato rotulo="Estrato del puesto">
            {estrato ? (
              `${estrato.romano} · ${estrato.nombre}`
            ) : (
              <Falta texto="sin definir" />
            )}
          </Dato>
        </Bloque>
      )}
    </>
  );
}
