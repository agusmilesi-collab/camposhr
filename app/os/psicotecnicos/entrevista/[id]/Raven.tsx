'use client';

/**
 * El Raven en la hoja de la entrevista: en qué anda, cuánto le queda y qué dio.
 *
 * El test lo responde la persona sola por su enlace, así que **la pantalla se
 * entera por sí misma**: la evaluadora le manda el enlace y se pone a escribir
 * la entrevista, y no puede quedarse recargando para ver si arrancó. Cada pocos
 * segundos se pregunta el estado, y la respuesta trae también cuándo abrió y,
 * si ya entregó, cuánto tardó y qué puntaje sacó.
 *
 * **Lo que se dibuja sale del sondeo y no de la prop del servidor.** Antes el
 * sondeo solo avisaba que algo había cambiado y pedía la pantalla de nuevo:
 * cuando ese redibujo no llegaba, el reloj recién aparecía si alguien recargaba
 * a mano. Ahora el dato viaja en la misma respuesta y el servidor solo pone lo
 * que se ve en la primera pintura.
 *
 * **El reloj se cuenta contra el momento en que abrió la primera lámina**, que
 * lo fijó el servidor, y no descontando un segundo por vuelta: con la pestaña
 * en segundo plano el navegador frena el temporizador y la cuenta se atrasa.
 *
 * Se deja de preguntar cuando ya no hay nada que esperar: terminado es el
 * final, y sin enlace quiere decir que todavía no se mandó, cosa que pasa desde
 * esta misma pantalla.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { EstadoRaven } from '@/lib/raven-estado';
import { MINUTOS, RAVEN_MAXIMO, duracion } from '@/lib/raven';
import LinkRaven from '../../LinkRaven';

/**
 * Cada cuánto se pregunta: una vez por minuto.
 *
 * Lo que se está esperando tarda: que la persona abra el enlace y que entregue
 * cincuenta minutos después. Preguntando cada seis segundos eran seiscientas
 * consultas por entrevista para enterarse antes de algo que igual se mira de
 * reojo mientras se escribe la entrevista; por minuto son cincuenta, y el reloj
 * arranca a lo sumo un minuto después de que la persona abrió.
 *
 * Al volver a la pestaña se pregunta de una, así que el minuto no se nota
 * cuando alguien vuelve a mirar.
 */
const CADA = 60_000;

type Medida = { raw: number | null; percentil: number | null; resultado: string | null };

export default function Raven({
  id,
  estado: delServidor,
  iniciado: iniciadoServidor,
  duracionSegundos,
  medida,
}: {
  id: string;
  estado: EstadoRaven;
  iniciado: string | null;
  duracionSegundos: number | null;
  medida: Medida | null;
}) {
  const router = useRouter();

  const [estado, setEstado] = useState(delServidor);
  const [iniciado, setIniciado] = useState(iniciadoServidor);
  const [tardo, setTardo] = useState(duracionSegundos);
  const [resultado, setResultado] = useState<Medida | null>(medida);
  /** Segundos que le quedan. Null hasta que corre en el navegador. */
  const [restan, setRestan] = useState<number | null>(null);

  // Lo que manda el servidor gana cuando la pantalla se vuelve a dibujar: es el
  // caso de generar el enlace desde acá, que no pasa por el sondeo.
  useEffect(() => {
    setEstado(delServidor);
    setIniciado(iniciadoServidor);
    setTardo(duracionSegundos);
    setResultado(medida);
  }, [delServidor, iniciadoServidor, duracionSegundos, medida]);

  // En una referencia y no en el efecto: así el temporizador del sondeo no se
  // rearma en cada dibujo, que es lo que haría empezar la cuenta de nuevo.
  const mostrando = useRef(estado);
  mostrando.current = estado;

  useEffect(() => {
    if (estado !== 'sin abrir' && estado !== 'empezado') return;

    let vivo = true;
    const mirar = async () => {
      try {
        const res = await fetch(`/api/os/raven-estado?evaluacion=${id}`, { cache: 'no-store' });
        const r = await res.json();
        if (!vivo || !r.ok) return;

        setIniciado(r.iniciado ?? null);
        setTardo(r.duracion ?? null);
        setResultado(r.resultado ?? null);
        if (r.estado !== mostrando.current) {
          setEstado(r.estado);
          // Y se pide la pantalla de nuevo, porque el resto de la hoja también
          // cambia: la evaluación pasa a Por analizar cuando este era el último
          // test que faltaba.
          router.refresh();
        }
      } catch {
        // Sin conexión no se hace nada: en la vuelta siguiente se vuelve a
        // preguntar y mientras tanto queda lo que ya se estaba mostrando.
      }
    };

    mirar();
    const t = setInterval(mirar, CADA);
    // Al volver a la pestaña se pregunta de una: el navegador frena los
    // temporizadores en segundo plano y puede haber pasado media hora.
    const alVolver = () => document.visibilityState === 'visible' && mirar();
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      vivo = false;
      clearInterval(t);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [id, estado, router]);

  // El reloj, contra la hora de arranque que fijó el servidor.
  useEffect(() => {
    if (!iniciado) {
      setRestan(null);
      return;
    }
    const fin = new Date(iniciado).getTime() + MINUTOS * 60 * 1000;
    const leer = () => setRestan(Math.max(0, Math.round((fin - Date.now()) / 1000)));
    leer();
    const t = setInterval(leer, 1000);
    return () => clearInterval(t);
  }, [iniciado]);

  return (
    <div className="os-herramienta-accion">
      {/* La celda del estado queda vacía: en qué anda el Raven se dice al lado
          del título, con el sello que pone el servidor. Se deja igual para que
          el botón caiga en la misma columna que en el resto de los tests. */}
      <span />

      {/* El orden de las columnas es el mismo en todos los tests: estado, lo que
          se mira, y la acción. Acá lo que se mira es cuánto le queda mientras
          responde y qué dio cuando entregó. */}
      <span className="os-raven-medida">
        {estado === 'terminado' ? (
          <>
            {tardo !== null && (
              <span className="os-raven-reloj" title="Lo que tardó en responderlo">
                Tardó {duracion(tardo)}
              </span>
            )}
            {/* Las respuestas correctas y nada más: el percentil y el rango son
                lectura del informe y se leen en su pestaña. Acá lo que se quiere
                saber al terminar es cuántas sacó; el rango queda en el título,
                para quien lo quiera de paso. */}
            {resultado !== null && resultado.raw !== null && (
              <span
                className="os-sello-estado os-azul os-raven-puntaje"
                title={resultado.resultado ?? 'Sin rango'}
              >
                {resultado.raw}/{RAVEN_MAXIMO}
              </span>
            )}
          </>
        ) : (
          <Reloj iniciado={iniciado} restan={restan} />
        )}
      </span>

      <LinkRaven evaluacionId={id} />
    </div>
  );
}

function Reloj({ iniciado, restan }: { iniciado: string | null; restan: number | null }) {
  // Sin abrir todavía: el tiempo está entero y quieto. Se muestra igual, para
  // saber de cuánto dispone cuando empiece.
  if (!iniciado) {
    return (
      <span className="os-raven-reloj" title="Todavía no lo abrió">
        {MINUTOS}:00
      </span>
    );
  }
  // Null hasta que corre en el navegador: el servidor y el cliente dibujan en
  // instantes distintos y el número no puede coincidir entre los dos.
  if (restan === null) return <span className="os-raven-reloj" />;
  if (restan === 0) return <span className="os-raven-reloj urge">Se acabó</span>;

  const m = Math.floor(restan / 60);
  const s = restan % 60;
  return (
    <span
      className={`os-raven-reloj${restan <= 5 * 60 ? ' urge' : ''}`}
      title="Tiempo que le queda"
    >
      Quedan {m}:{String(s).padStart(2, '0')}
    </span>
  );
}
