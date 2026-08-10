'use client';

import { useEffect, useState } from 'react';

/**
 * La pantalla de la expositora, en su propio teléfono.
 *
 * Es lo único que se toca durante la charla: abrir la actividad cuando llega el
 * momento y cerrarla cuando termina. El deck no le avisa nada al servidor, así
 * sigue funcionando sin internet.
 *
 * El cierre es la señal de guardar el teléfono, y por eso el botón de cerrar
 * está siempre a la vista mientras hay algo abierto.
 */

type ActividadControl = {
  id: string;
  clave: string;
  charla: number;
  tipo: string;
  titulo: string;
  /** Las del mismo grupo se abren juntas, con un solo toque. */
  grupo: string | null;
  /** En qué placa del deck se abre. Es lo que la expositora está proyectando. */
  placa: number | null;
  abierta: boolean;
};

/**
 * Lo que mira mientras corre el ejercicio de las frases. Los equipos completos
 * son los que ya pueden leerse, y es la señal de cuándo pedirlo en voz alta.
 */
type ConteoFrases = {
  equipos: number;
  mitades: number;
  escribieron: number;
  completos: number;
};

/** Lo que la expositora mira mientras corre una ronda del ensayo. */
type ConteoEnsayo = {
  grupos: number;
  observan: number;
  contestaron: number;
  sostuvo: { escucho: number; explico: number };
  motivo: { hecho: number; juicio: number; ninguno: number };
  reciben: number;
  contestaronReciben: number;
  dijoPorque: number;
  dijoCuando: number;
};

/** Minutos y segundos, para los dos relojes del ensayo. */
function reloj(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

const SONDEO_MS = 4000;

export default function Control({
  slug,
  empresa,
  actividades,
  clave,
  registrados,
}: {
  slug: string;
  empresa: string;
  actividades: ActividadControl[];
  clave: string;
  registrados: number;
}) {
  const [abiertaId, setAbiertaId] = useState<string | null>(
    actividades.find((a) => a.abierta)?.id ?? null
  );
  const [total, setTotal] = useState(0);
  /** Los que respondieron algo pero todavía no llegaron al final. */
  const [empezaron, setEmpezaron] = useState(0);
  /** Cuántas consignas se abrieron juntas, para saber si hay un final al que llegar. */
  const [enFila, setEnFila] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Durante el ensayo: cuántos observadores contestaron y qué contestaron. */
  const [ensayo, setEnsayo] = useState<ConteoEnsayo | null>(null);
  /** Durante el ejercicio de las frases: cuántas mitades y equipos terminaron. */
  const [frases, setFrases] = useState<ConteoFrases | null>(null);
  /*
   * Los dos relojes del ensayo. No son para apurar a nadie: en el teléfono y
   * en lo proyectado un cronómetro haría que nadie sostenga el silencio, que es
   * el paso que el ejercicio entrena. Acá sirven para otra cosa, que es saber
   * si la ronda se está estirando y cuánto lleva el bloque entero contra lo
   * previsto.
   *
   * Corren en el navegador y no consultan nada. Si ella recarga el panel, el de
   * la ronda arranca de nuevo.
   */
  const [desdeRonda, setDesdeRonda] = useState<number | null>(null);
  const [desdeEnsayo, setDesdeEnsayo] = useState<number | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());

  // El conteo en vivo: es lo que le dice a la expositora si puede seguir o si
  // todavía falta gente. Sale del mismo endpoint que mira el teléfono.
  useEffect(() => {
    let vivo = true;
    async function mirar() {
      try {
        // El conteo se pide sólo desde acá: es el dato de la expositora y en el
        // teléfono del asistente no se muestra en ninguna pantalla.
        const res = await fetch(`/api/ciclo/${slug}/estado?total=1`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const json = await res.json();
        if (!vivo) return;
        setAbiertaId(json.actividad?.id ?? null);
        setTotal(json.total ?? 0);
        setEmpezaron(json.empezaron ?? 0);
        setEnFila(json.enFila ?? 0);
        setEnsayo(json.ensayoConteo ?? null);
        setFrases(json.frasesConteo ?? null);
      } catch {
        // Sin conexión: reintenta solo en el próximo tic.
      }
    }
    mirar();
    const id = setInterval(mirar, SONDEO_MS);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, [slug]);

  async function mandar(cuerpo: Record<string, unknown>) {
    setOcupado(true);
    setError(null);
    try {
      const res = await fetch(`/api/ciclo/${slug}/control`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...cuerpo, clave }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      if (json.ok) {
        setAbiertaId(cuerpo.accion === 'abrir' ? String(cuerpo.actividadId) : null);
        setTotal(0);
      }
    } catch {
      setError('No se pudo. Fijate la conexión y probá otra vez.');
    } finally {
      setOcupado(false);
    }
  }

  const abierta = actividades.find((a) => a.id === abiertaId) ?? null;
  const enEnsayo = abierta?.tipo === 'ensayo';
  const enFrases = abierta?.tipo === 'frases';

  /*
   * Los relojes arrancan solos: el de la ronda cada vez que cambia la consigna
   * abierta, y el del ensayo la primera vez que se abre una ronda. El del
   * ensayo no se reinicia entre rondas a propósito, porque lo que ella necesita
   * saber es cuánto lleva el bloque entero.
   */
  useEffect(() => {
    if (!enEnsayo && !enFrases) {
      setDesdeRonda(null);
      return;
    }
    setDesdeRonda(Date.now());
    if (enEnsayo) setDesdeEnsayo((previo) => previo ?? Date.now());
  }, [enEnsayo, enFrases, abiertaId]);

  useEffect(() => {
    if (!enEnsayo && !enFrases) return;
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [enEnsayo, enFrases]);

  /**
   * Las que se abren juntas ocupan un solo botón.
   *
   * Con cinco consignas seguidas en la misma charla, cinco botones son cinco
   * oportunidades de tocar el que no era mientras se está dictando. Se abre la
   * primera y el teléfono de cada uno recorre el resto.
   */
  const enLista: ActividadControl[] = [];
  const cuantasEnGrupo = new Map<string, number>();
  for (const a of actividades) {
    if (!a.grupo) {
      enLista.push(a);
      continue;
    }
    const vistas = cuantasEnGrupo.get(a.grupo) ?? 0;
    cuantasEnGrupo.set(a.grupo, vistas + 1);
    if (vistas === 0) enLista.push(a);
  }

  const porCharla = new Map<number, ActividadControl[]>();
  for (const a of enLista) {
    porCharla.set(a.charla, [...(porCharla.get(a.charla) ?? []), a]);
  }

  return (
    <div className="ct">
      <header className="ct-top">
        <span className="brand">
          Campos HR <span>· control</span>
        </span>
        <span className="ct-empresa">
          {empresa} · {registrados} {registrados === 1 ? 'persona' : 'personas'}
        </span>
      </header>

      <div className={`ct-estado ${abierta ? 'ct-estado-on' : ''}`}>
        {abierta ? (
          <>
            <div className="ct-estado-texto">
              <strong>{abierta.titulo}</strong>
              {/* Con varias consignas seguidas el número que importa es cuántos
                  llegaron al final: contar la primera hace creer que está hecho
                  cuando la mayoría quedó por la mitad. */}
              <span>
                {enEnsayo && ensayo ? (
                  /* Los tríos no terminan todos juntos, así que el reloj no
                     dice cuándo cerrar y este número sí: cuando contestaron
                     casi todos los observadores, la ronda terminó. */
                  <>
                    Anotaron {ensayo.contestaron} de {ensayo.observan}{' '}
                    observadores y {ensayo.contestaronReciben} de{' '}
                    {ensayo.reciben} que recibieron
                    {ensayo.contestaron > 0 && (
                      <b className="ct-a-medias">
                        {' '}· se quedaron escuchando {ensayo.sostuvo.escucho} de{' '}
                        {ensayo.contestaron} · motivo con un hecho en{' '}
                        {ensayo.motivo.hecho}
                      </b>
                    )}
                    {ensayo.contestaronReciben > 0 && (
                      <b className="ct-a-medias">
                        {' '}· dijeron por qué {ensayo.dijoPorque}, dijeron cuándo{' '}
                        {ensayo.dijoCuando}
                      </b>
                    )}
                    {desdeRonda !== null && (
                      <b className="ct-reloj">
                        {' '}· ronda {reloj(ahora - desdeRonda)}
                        {desdeEnsayo !== null &&
                          ` · ensayo ${reloj(ahora - desdeEnsayo)}`}
                      </b>
                    )}
                  </>
                ) : enFrases && frases ? (
                  /* Los equipos no terminan todos juntos: cuando la mayoría
                     tiene las dos mitades escritas, se pide que se lean. */
                  <>
                    Escribieron {frases.escribieron} de {frases.mitades}{' '}
                    mitades
                    <b className="ct-a-medias">
                      {' '}· {frases.completos} de {frases.equipos} equipos ya
                      pueden leerse
                    </b>
                    {desdeRonda !== null && (
                      <b className="ct-reloj"> · {reloj(ahora - desdeRonda)}</b>
                    )}
                  </>
                ) : enFila > 1 ? (
                  <>
                    {total} de {registrados} terminaron
                    {empezaron > total && (
                      <b className="ct-a-medias">
                        {' '}
                        · {empezaron - total} van por la mitad
                      </b>
                    )}
                  </>
                ) : (
                  <>
                    {total} {total === 1 ? 'respuesta' : 'respuestas'} de{' '}
                    {registrados}
                  </>
                )}
              </span>
            </div>
            <button
              className="ct-cerrar"
              disabled={ocupado}
              onClick={() => mandar({ accion: 'cerrar' })}
            >
              Cerrar
            </button>
          </>
        ) : (
          <div className="ct-estado-texto">
            <strong>Nada abierto</strong>
            <span>Los teléfonos están guardados.</span>
          </div>
        )}
      </div>

      {error && <p className="cq-error ct-error">{error}</p>}

      <main className="ct-lista">
        {[...porCharla.entries()].map(([charla, items]) => (
          <section key={charla} className="ct-charla">
            <h2>Charla {charla}</h2>
            {items.map((a) => (
              <button
                key={a.id}
                className={`ct-item ${a.id === abiertaId ? 'ct-item-on' : ''}`}
                disabled={ocupado}
                onClick={() =>
                  a.id === abiertaId
                    ? mandar({ accion: 'cerrar' })
                    : mandar({ accion: 'abrir', actividadId: a.id })
                }
              >
                <span className="ct-item-titulo">{a.titulo}</span>
                {/* La placa manda: mientras dicta, lo que la expositora tiene
                    delante es el deck, y el número le dice si está parada donde
                    corresponde. Cuando no está cargada queda el tipo. */}
                <span className="ct-item-tipo">
                  {a.placa
                    ? `Placa ${a.placa}`
                    : a.grupo
                      ? `${cuantasEnGrupo.get(a.grupo)} seguidas`
                      : a.tipo}
                </span>
              </button>
            ))}
          </section>
        ))}

        {actividades.length === 0 && (
          <p className="ct-vacio">
            Todavía no hay actividades cargadas para este ciclo.
          </p>
        )}
      </main>
    </div>
  );
}
