'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BateriaDelPortal } from '@/lib/baterias';
import type { Busqueda } from '@/lib/airtable';

/**
 * Alta de pedido desde el portal del cliente.
 *
 * Se abre en un cajón lateral y no en una pantalla aparte: el cliente estaba
 * mirando el estado de sus búsquedas y vuelve ahí sin perder el lugar. Va sobre
 * <dialog> nativo, que ya trae lo que un cajón necesita y suele reimplementarse
 * mal a mano: el foco queda encerrado adentro, Escape cierra, el fondo no se
 * puede tocar y el resto de la página queda anunciada como inerte para el
 * lector de pantalla.
 *
 * El scroll del cuerpo se bloquea mientras está abierto, así el fondo no se
 * mueve detrás del cajón.
 */
/** El valor del selector que abre una búsqueda nueva. */
const NUEVA = 'nueva';

/** Cuántos candidatos se pueden cargar de una vez. */
const MAXIMO = 12;

type Fila = { id: number };

export default function NuevoPedido({
  empresa,
  token,
  baterias,
  busquedas = [],
}: {
  empresa: string;
  /** Viaja con el formulario: el servidor lo resuelve a la empresa. */
  token: string;
  /** Como están cargadas hoy: se editan en el OS y se leen del servidor. */
  baterias: BateriaDelPortal[];
  /**
   * Las búsquedas que el cliente ya tiene.
   *
   * Los candidatos pueden entrar a una abierta, a una que ya se entregó entera
   * (y entonces se reabre con la fecha del día), o a una nueva.
   */
  busquedas?: Busqueda[];
}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState<{ texto: string; guardado: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState(NUEVA);
  const [filas, setFilas] = useState<Fila[]>([{ id: 0 }]);
  const [proxima, setProxima] = useState(1);

  const abiertas = busquedas.filter((b) => b.estado !== 'Finalizado');
  const entregadas = busquedas.filter((b) => b.estado === 'Finalizado');
  const elegida = busquedas.find((b) => b.id === busqueda);

  const hoy = new Date().toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  function abrir() {
    setHecho(null);
    setError(null);
    setBusqueda(NUEVA);
    setFilas([{ id: 0 }]);
    setProxima(1);
    ref.current?.showModal();
    setAbierto(true);
  }

  function cerrar() {
    ref.current?.close();
    setAbierto(false);
  }

  useEffect(() => {
    document.body.style.overflow = abierto ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [abierto]);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setEnviando(true);
    setError(null);
    try {
      const r = await fetch('/api/pedidos', {
        method: 'POST',
        body: new FormData(form),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? 'No se pudo enviar el pedido.');
      setHecho({ texto: data.resumen as string, guardado: Boolean(data.guardado) });
      form.reset();
      setFilas([{ id: 0 }]);
      setProxima(1);
      // El pedido nuevo tiene que aparecer en el listado de atrás sin que el
      // cliente recargue: el cajón se cierra sobre la pantalla ya actualizada.
      if (data.guardado) router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el pedido.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <button type="button" className="btn-primario" onClick={abrir}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
        Nuevo pedido
      </button>

      <dialog
        className="cajon"
        ref={ref}
        onCancel={() => setAbierto(false)}
        onClose={() => setAbierto(false)}
        aria-labelledby="cajon-titulo"
      >
        <div className="cajon-head">
          <div>
            <div className="eyebrow">{empresa}</div>
            <h2 id="cajon-titulo">Nuevo pedido de evaluación</h2>
          </div>
          <button
            type="button"
            className="cajon-cerrar"
            onClick={cerrar}
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </button>
        </div>

        {hecho ? (
          <div className="cajon-body">
            {/* Guardado y sin guardar no pueden decir lo mismo: el segundo caso
                es el prototipo sin token de escritura, y prometer que lo tomamos
                cuando el pedido no quedó en ningún lado es peor que no decir
                nada. */}
            <div className={hecho.guardado ? 'cajon-ok' : 'cajon-aviso'}>
              <div className="cajon-ok-t">
                {hecho.guardado ? 'Pedido recibido' : 'El pedido no se guardó'}
              </div>
              <p>{hecho.texto}</p>
              <p className="cajon-ok-n">
                {hecho.guardado
                  ? 'Lo tomamos y coordinamos la entrevista. Ya aparece en el listado de atrás.'
                  : 'Los datos son correctos y el formulario funciona; falta conectar la escritura en Airtable.'}
              </p>
            </div>
            <div className="cajon-pie">
              <button type="button" className="btn-sec" onClick={cerrar}>
                Cerrar
              </button>
              <button type="button" className="btn-primario" onClick={() => setHecho(null)}>
                Cargar otro
              </button>
            </div>
          </div>
        ) : (
          <form className="cajon-body" onSubmit={enviar}>
            <input type="hidden" name="token" value={token} />

            {/* Primero para qué búsqueda entran, como en la tarjeta del OS: lo
                que se define antes que nada es a qué puesto se suman. Puede ser
                una que ya está, incluso una entregada entera, que vuelve a
                abrirse con la fecha de hoy. */}
            <div className="campo">
              <label htmlFor="busqueda">Búsqueda</label>
              <select
                id="busqueda"
                name="pedidoId"
                value={busqueda === NUEVA ? '' : busqueda}
                onChange={(e) => setBusqueda(e.target.value || NUEVA)}
              >
                <option value="">Nueva búsqueda</option>
                {abiertas.length > 0 && (
                  <optgroup label="En curso">
                    {abiertas.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.puesto}
                      </option>
                    ))}
                  </optgroup>
                )}
                {entregadas.length > 0 && (
                  <optgroup label="Entregadas · sumar candidatos las reabre">
                    {entregadas.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.puesto}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <span className="ayuda">
                {elegida
                  ? `Se evalúan con ${elegida.bateria ?? 'la batería de esa búsqueda'}${
                      elegida.conBenziger ? ' más la evaluación de perfil' : ''
                    }, que es lo acordado para ese puesto.`
                  : 'Si el puesto es nuevo, se carga acá abajo.'}
              </span>
            </div>

            {/* Con una búsqueda elegida, el alcance ya está acordado y no se
                vuelve a preguntar: los que entran al mismo puesto se miden con
                lo mismo, o sus informes no se pueden comparar. */}
            {!elegida && (
              <>
                <div className="campo">
                  <label htmlFor="puesto">Puesto</label>
                  <input
                    id="puesto"
                    name="puesto"
                    required
                    maxLength={120}
                    placeholder="Jefe de Depósito"
                    autoComplete="off"
                  />
                  <span className="ayuda">El puesto que se va a cubrir.</span>
                </div>

                <fieldset className="campo campo-fs">
                  <legend>Batería</legend>
                  {baterias.map((b, i) => (
                    <label className="opcion" key={b.codigo}>
                      <input
                        type="radio"
                        name="bateria"
                        value={b.codigo}
                        defaultChecked={i === 1}
                        required
                      />
                      <span className="opcion-cuerpo">
                        <span className="opcion-t">
                          {b.codigo}
                          {b.minutos && <span className="opcion-min">{b.minutos} min</span>}
                        </span>
                        <span className="opcion-d">{b.paraQuien}</span>
                        <span className="opcion-x">{b.queIncluye}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>

                {/* La evaluación de perfil va marcada: es lo que se recomienda
                    para todo puesto que conduce gente, y quien no lo quiera lo
                    destilda. Se dice qué agrega, no que "está disponible". */}
                <label className="opcion opcion-suma">
                  <input type="checkbox" name="benziger" value="si" defaultChecked />
                  <span className="opcion-cuerpo">
                    <span className="opcion-t">Sumar evaluación de perfil</span>
                    <span className="opcion-d">
                      Cómo piensa y cómo decide la persona, y qué le cuesta sostener.
                    </span>
                    <span className="opcion-x">
                      Es lo que permite decir cómo va a trabajar con su jefe y con su
                      equipo, y no solo si el puesto le queda. Diez minutos más de
                      administración.
                    </span>
                  </span>
                </label>

                <div className="campo">
                  <label htmlFor="descripcion">Descripción del puesto</label>
                  <textarea
                    id="descripcion"
                    name="descripcion"
                    rows={4}
                    maxLength={4000}
                    placeholder="Qué hace, de quién depende, a cuántas personas conduce, qué decide."
                  />
                  <span className="ayuda">
                    Cuanto más concreto, más se puede medir a la persona contra el
                    puesto y no contra una impresión.
                  </span>
                </div>
              </>
            )}

            {/* Los candidatos, que suelen venir de a tandas para el mismo
                puesto: se agregan filas en vez de abrir el formulario una vez
                por persona. */}
            <div className="campo campo-fs">
              <div className="gente-top">
                <span className="gente-t">
                  {filas.length === 1 ? 'Candidato' : `Candidatos (${filas.length})`}
                </span>
                {filas.length < MAXIMO && (
                  <button
                    type="button"
                    className="btn-sec btn-chico"
                    onClick={() => {
                      setFilas((f) => [...f, { id: proxima }]);
                      setProxima((n) => n + 1);
                    }}
                  >
                    + Agregar otro
                  </button>
                )}
              </div>

              {filas.map((f, n) => (
                <div className="gente-fila" key={f.id}>
                  <div className="gente-fila-top">
                    <span className="gente-n">{n + 1}</span>
                    {filas.length > 1 && (
                      <button
                        type="button"
                        className="gente-sacar"
                        onClick={() => setFilas((x) => x.filter((y) => y.id !== f.id))}
                        aria-label={`Sacar el candidato ${n + 1}`}
                      >
                        Sacar
                      </button>
                    )}
                  </div>

                  <div className="campo">
                    <label htmlFor={`nombre-${f.id}`}>Nombre y apellido</label>
                    <input
                      id={`nombre-${f.id}`}
                      name={`nombre-${f.id}`}
                      required
                      maxLength={120}
                      autoComplete="off"
                    />
                  </div>

                  <div className="campo-par">
                    <div className="campo">
                      <label htmlFor={`telefono-${f.id}`}>Teléfono</label>
                      <input
                        id={`telefono-${f.id}`}
                        name={`telefono-${f.id}`}
                        type="tel"
                        inputMode="tel"
                        maxLength={40}
                        placeholder="341 555 1234"
                      />
                    </div>
                    <div className="campo">
                      <label htmlFor={`mail-${f.id}`}>Mail</label>
                      <input
                        id={`mail-${f.id}`}
                        name={`mail-${f.id}`}
                        type="email"
                        maxLength={120}
                        placeholder="nombre@empresa.com"
                      />
                    </div>
                  </div>

                  <div className="campo">
                    <label htmlFor={`cv-${f.id}`}>CV</label>
                    <input
                      id={`cv-${f.id}`}
                      name={`cv-${f.id}`}
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf"
                    />
                  </div>
                </div>
              ))}

              <span className="ayuda">
                De cada uno alcanza con el teléfono o el mail: es por donde se lo
                cita. El CV es opcional, PDF o Word hasta 10 MB.
              </span>
            </div>

            <div className="campo">
              <label htmlFor="comentarios">Comentarios</label>
              <textarea
                id="comentarios"
                name="comentarios"
                rows={3}
                maxLength={2000}
                placeholder="Urgencias, disponibilidad de los candidatos, lo que quieras avisarnos."
              />
            </div>

            <p className="cajon-fecha">
              Fecha de solicitud: <b>{hoy}</b>. Se carga sola.
            </p>

            {error && <p className="cajon-error">{error}</p>}

            <div className="cajon-pie">
              <button type="button" className="btn-sec" onClick={cerrar}>
                Cancelar
              </button>
              <button type="submit" className="btn-primario" disabled={enviando}>
                {enviando ? 'Enviando…' : 'Enviar pedido'}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
