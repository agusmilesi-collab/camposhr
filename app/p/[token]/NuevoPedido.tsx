'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BateriaDelPortal } from '@/lib/baterias';

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
export default function NuevoPedido({
  empresa,
  token,
  baterias,
}: {
  empresa: string;
  /** Viaja con el formulario: el endpoint sólo acepta el del cliente de prueba. */
  token: string;
  /** Como están cargadas hoy: se editan en el OS y se leen del servidor. */
  baterias: BateriaDelPortal[];
}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState<{ texto: string; guardado: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hoy = new Date().toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  function abrir() {
    setHecho(null);
    setError(null);
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
            <div className="campo">
              <label htmlFor="puesto">Pedido</label>
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

            <div className="campo">
              <label htmlFor="candidato">Candidato</label>
              <input
                id="candidato"
                name="candidato"
                required
                maxLength={120}
                placeholder="Nombre y apellido"
                autoComplete="off"
              />
            </div>

            <div className="campo-par">
              <div className="campo">
                <label htmlFor="telefono">Teléfono</label>
                <input
                  id="telefono"
                  name="telefono"
                  type="tel"
                  inputMode="tel"
                  maxLength={40}
                  placeholder="341 555 1234"
                />
              </div>
              <div className="campo">
                <label htmlFor="mail">Mail</label>
                <input
                  id="mail"
                  name="mail"
                  type="email"
                  maxLength={120}
                  placeholder="nombre@empresa.com"
                />
              </div>
            </div>
            <p className="ayuda ayuda-suelta">
              Con el teléfono o el mail alcanza: es por donde se cita al
              candidato.
            </p>

            <div className="campo">
              <label htmlFor="cv">CV</label>
              <input
                id="cv"
                name="cv"
                type="file"
                accept=".pdf,.doc,.docx,application/pdf"
              />
              <span className="ayuda">PDF o Word, hasta 10 MB.</span>
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

            <div className="campo">
              <label htmlFor="comentarios">Comentarios</label>
              <textarea
                id="comentarios"
                name="comentarios"
                rows={3}
                maxLength={2000}
                placeholder="Urgencias, disponibilidad del candidato, lo que quieras avisarnos."
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
