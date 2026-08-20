'use client';

/**
 * El test de Raven como lo ve quien lo rinde.
 *
 * Una lámina a la vez y abajo la tira de las treinta y seis para moverse a
 * cualquiera. La tira marca cuáles quedaron sin responder: al final del test
 * lo que hace falta saber es a cuál volver, y contarlas de memoria es tiempo
 * perdido.
 *
 * Las ocho opciones vienen dibujadas y numeradas dentro de la propia lámina,
 * así que acá solo se elige el número. Por eso los botones son números y no
 * figuras: la figura ya está arriba.
 *
 * Se puede cambiar cualquier respuesta mientras quede tiempo. Vale lo que esté
 * cargado cuando el reloj llega a cero.
 *
 * El reloj se puede ocultar. A algunas personas verlo las ordena y a otras las
 * apura, y el test mide razonamiento y no tolerancia al cronómetro.
 *
 * El resultado no se muestra: quien rinde no ve su puntaje ni acá ni después.
 *
 * En modo prueba no se guarda nada ni se corrige: es para que el equipo vea
 * cómo se ve el test antes de mandarlo. Se avisa en pantalla, porque una
 * pantalla igual a la real que no guarda es la forma más fácil de perder el
 * trabajo de alguien.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AVISO_MINUTOS, MINUTOS, OPCIONES, RAVEN_MAXIMO } from '@/lib/raven';

function reloj(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function Test({
  token,
  respuestas: iniciales,
  restan: restanInicial,
  empezado,
  prueba = false,
}: {
  token: string;
  respuestas: Record<string, number>;
  restan: number;
  empezado: boolean;
  /** Para mirar el test sin tomárselo a nadie: no guarda ni corrige. */
  prueba?: boolean;
}) {
  const [arrancado, setArrancado] = useState(empezado);
  const [lamina, setLamina] = useState(1);
  const [respuestas, setRespuestas] = useState(iniciales);
  const [restan, setRestan] = useState(restanInicial);
  const [entregado, setEntregado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cerrando = useRef(false);

  const pedir = useCallback(
    async (cuerpo: Record<string, unknown>) => {
      // En prueba no se toca el servidor: el reloj corre en pantalla y las
      // respuestas viven mientras dure la visita.
      if (prueba) return { ok: true, restan: restanInicial };
      const res = await fetch('/api/raven', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...cuerpo }),
      });
      return res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
    },
    [token, prueba, restanInicial]
  );

  const terminar = useCallback(async () => {
    if (cerrando.current) return;
    cerrando.current = true;
    await pedir({ accion: 'terminar' });
    setEntregado(true);
  }, [pedir]);

  // El reloj de pantalla: la cuenta que vale es la del servidor, que se
  // consulta en cada respuesta. Este solo la muestra.
  useEffect(() => {
    if (!arrancado || entregado) return;
    const t = setInterval(() => {
      setRestan((s) => {
        if (s <= 1) {
          terminar();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [arrancado, entregado, terminar]);

  async function empezar() {
    const r = await pedir({ accion: 'empezar' });
    if (!r.ok) {
      setError(r.motivo ?? 'No se pudo empezar.');
      return;
    }
    if (!prueba) setRestan(r.restan);
    setArrancado(true);
  }

  async function responder(opcion: number) {
    // Tocar la que ya estaba elegida la borra.
    const elegida = respuestas[String(lamina)] === opcion ? null : opcion;
    const antes = respuestas;
    setRespuestas((v) => {
      const x = { ...v };
      if (elegida === null) delete x[String(lamina)];
      else x[String(lamina)] = elegida;
      return x;
    });
    const r = await pedir({ accion: 'responder', lamina, opcion: elegida });
    if (prueba) return;
    if (!r.ok) {
      setRespuestas(antes);
      if (r.motivo === 'Se terminó el tiempo.') {
        setRestan(0);
        setEntregado(true);
        return;
      }
      setError(r.motivo ?? 'No se pudo guardar.');
      return;
    }
    setRestan(r.restan);
    setError(null);
  }

  if (entregado) {
    return (
      <main className="rv rv-centrado">
        <h1>Terminaste</h1>
        {prueba ? (
          <p>Así termina el test. Esto fue una prueba, no se guardó ninguna respuesta.</p>
        ) : (
          <>
            <p>
              Gracias por tu tiempo. Tus respuestas quedaron guardadas y las va a revisar la
              psicóloga a cargo de tu evaluación.
            </p>
            <p className="rv-suave">Ya podés cerrar esta pantalla.</p>
          </>
        )}
      </main>
    );
  }

  if (!arrancado) {
    return (
      <main className="rv rv-centrado">
        {prueba && (
          <p className="rv-prueba">
            Estás viendo el test como lo ve el candidato. Nada de lo que respondas se guarda.
          </p>
        )}
        <h1>Test de razonamiento</h1>
        {/* La consigna va destacada: es lo único que hay que entender para
            empezar, y lo demás son detalles de cómo funciona la pantalla. */}
        <p className="rv-consigna">
          Vas a ver {RAVEN_MAXIMO} láminas. En cada una falta una pieza y tenés que elegir
          cuál de las {OPCIONES} opciones la completa.
        </p>
        <ol className="rv-instrucciones">
          {/* El tiempo y su aviso van juntos: son una sola cosa que saber. */}
          <li>
            Tenés {MINUTOS} minutos en total, y arrancan cuando toques Empezar. Cuando
            queden {AVISO_MINUTOS} minutos te vamos a avisar, para que puedas cerrar lo que
            estés resolviendo y revisar lo que te falte.
          </li>
          <li>
            Arriba vas a tener un cronómetro con el tiempo que queda. Lo podés ocultar y
            volver a mostrar cuando quieras: sigue corriendo igual.
          </li>
          {/* Volver y cambiar es lo mismo: poder moverse por las láminas. */}
          <li>
            Podés volver a cualquier lámina y cambiar lo que respondiste. Si una no te sale,
            seguí y volvé después.
          </li>
        </ol>
        <button className="rv-boton rv-firme" onClick={empezar}>
          Empezar
        </button>
        {error && <p className="rv-error">{error}</p>}
      </main>
    );
  }

  const sinResponder = Array.from({ length: RAVEN_MAXIMO }, (_, i) => i + 1).filter(
    (n) => respuestas[String(n)] === undefined
  );
  const avisando = restan <= AVISO_MINUTOS * 60;

  return (
    <main className="rv">
      {prueba && (
        <p className="rv-prueba">
          Estás viendo el test como lo ve el candidato. Nada de lo que respondas se guarda.
        </p>
      )}

      <header className="rv-top">
        <span className="rv-cuenta">
          Lámina {lamina} de {RAVEN_MAXIMO}
        </span>
        <Cronometro restan={restan} avisando={avisando} />
      </header>

      {avisando && (
        <p className="rv-aviso">
          Quedan {Math.ceil(restan / 60)} minutos. Es buen momento para revisar las láminas
          que dejaste sin responder.
        </p>
      )}

      <figure className="rv-lamina">
        {/* Las láminas se sirven por número. Mientras no estén escaneadas,
            todas muestran la misma de muestra. */}
        <img src="/raven/laminas/muestra.svg" alt={`Lámina ${lamina}`} />
      </figure>

      <div className="rv-opciones">
        {Array.from({ length: OPCIONES }, (_, i) => i + 1).map((o) => (
          <button
            key={o}
            className={`rv-opcion${respuestas[String(lamina)] === o ? ' elegida' : ''}`}
            aria-pressed={respuestas[String(lamina)] === o}
            onClick={() => responder(o)}
          >
            {o}
          </button>
        ))}
      </div>

      <nav className="rv-pasos">
        <button
          className="rv-boton"
          disabled={lamina === 1}
          onClick={() => setLamina((n) => Math.max(1, n - 1))}
        >
          Anterior
        </button>
        <button
          className="rv-boton"
          disabled={lamina === RAVEN_MAXIMO}
          onClick={() => setLamina((n) => Math.min(RAVEN_MAXIMO, n + 1))}
        >
          Siguiente
        </button>
      </nav>

      {/* La tira: dónde está parado y qué le falta. */}
      <div className="rv-tira">
        {Array.from({ length: RAVEN_MAXIMO }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            className={`rv-paso${n === lamina ? ' aca' : ''}${
              respuestas[String(n)] !== undefined ? ' hecha' : ''
            }`}
            onClick={() => setLamina(n)}
            aria-label={`Lámina ${n}${respuestas[String(n)] !== undefined ? ', respondida' : ', sin responder'}`}
          >
            {n}
          </button>
        ))}
      </div>

      <footer className="rv-pie">
        <span className="rv-suave">
          {sinResponder.length === 0
            ? 'Respondiste las 36.'
            : `Te faltan ${sinResponder.length}: ${sinResponder.slice(0, 12).join(', ')}${
                sinResponder.length > 12 ? '…' : ''
              }`}
        </span>
        <button className="rv-boton rv-firme" onClick={terminar}>
          Entregar
        </button>
      </footer>

      {error && <p className="rv-error">{error}</p>}
    </main>
  );
}

/** El reloj, que se puede ocultar sin dejar de correr. */
function Cronometro({ restan, avisando }: { restan: number; avisando: boolean }) {
  const [visible, setVisible] = useState(true);
  return (
    <span className="rv-reloj">
      {visible && <span className={avisando ? 'rv-tiempo urge' : 'rv-tiempo'}>{reloj(restan)}</span>}
      <button className="rv-enlace" onClick={() => setVisible((v) => !v)}>
        {visible ? 'Ocultar el tiempo' : 'Ver el tiempo'}
      </button>
    </span>
  );
}
