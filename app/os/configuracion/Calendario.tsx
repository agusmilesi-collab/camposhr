import { select } from '@/lib/supabase';
import { conexiones, hayGoogle } from '@/lib/google-calendario';

/**
 * Quién tiene su Google Calendar conectado.
 *
 * La misma conexión sirve para agendar al candidato en sus contactos
 * (`lib/google-contactos.ts`); una conexión anterior a ese permiso lo dice y
 * ofrece "Sumar contactos", que vuelve a pasar por Google.
 *
 * **Cada una se conecta desde su propia computadora.** El permiso lo da la
 * cuenta de Google que esté abierta en ese navegador: apretar "Conectar" en la
 * fila de otra pone las entrevistas de ella en el calendario de quien apretó.
 * Por eso la fila conectada muestra de qué cuenta es.
 *
 * Conectar y cortar son un enlace y un formulario, sin componente de cliente:
 * las dos salen de la pantalla (a Google, o a la ruta que corta) y vuelven con
 * el resultado en la dirección (`&google=ok`).
 */

const RESULTADO: Record<string, string> = {
  ok: 'Calendario conectado. Las entrevistas que ya estaban agendadas para adelante ya están en él.',
  cortado: 'Conexión cortada. Los eventos ya creados quedan en el calendario.',
  rechazado: 'En la pantalla de Google se canceló el permiso, así que no se conectó nada.',
  'sin-permiso':
    'Faltó tildar el permiso para ver y editar eventos del calendario en la pantalla de Google. Sin ese permiso el sistema no puede agendar: hay que conectar de nuevo y dejarlo tildado.',
  fallo: 'No se pudo completar la conexión con Google. Se puede volver a intentar.',
};

export default async function Calendario({ resultado }: { resultado?: string }) {
  const [evaluadoras, conectadas] = await Promise.all([
    select<{ id: string; nombre: string }>(
      'evaluadoras',
      'select=id,nombre&activa=is.true&order=nombre.asc'
    ),
    conexiones().catch(() => []),
  ]);
  const de = new Map(conectadas.map((c) => [c.evaluadoraId, c]));
  const listo = hayGoogle();

  return (
    <>
      {!listo && (
        <div className="os-aviso">
          Falta cargar las credenciales de Google en el servidor (GOOGLE_CLIENT_ID y
          GOOGLE_CLIENT_SECRET). Hasta entonces no se puede conectar ningún calendario.
        </div>
      )}
      {resultado && RESULTADO[resultado] && <div className="os-aviso">{RESULTADO[resultado]}</div>}

      <section className="os-panel">
        <div className="os-panel-top">
          <h2>Google Calendar de cada evaluadora</h2>
        </div>
        <div className="os-tabla-marco">
          <table className="os-tabla">
            <thead>
              <tr>
                <th>Evaluadora</th>
                <th>Estado</th>
                <th>Cuenta de Google</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {evaluadoras.map((ev) => {
                const c = de.get(ev.id);
                return (
                  <tr key={ev.id}>
                    <td data-campo="Evaluadora">{ev.nombre}</td>
                    <td data-campo="Estado">
                      {!c ? (
                        <span className="os-tabla-flojo">Sin conectar</span>
                      ) : c.caida ? (
                        'Google dejó de aceptar el permiso: hay que volver a conectar'
                      ) : c.contactos ? (
                        'Conectado, con contactos'
                      ) : (
                        'Conectado, sin el permiso de contactos: al escribirle a un candidato no se lo agenda'
                      )}
                    </td>
                    <td data-campo="Cuenta de Google">
                      {c?.cuenta ?? <span className="os-tabla-flojo">Ninguna</span>}
                    </td>
                    <td className="os-tabla-accion">
                      {c && !c.caida ? (
                        <form method="post" action="/api/os/google/desconectar">
                          <input type="hidden" name="evaluadora" value={ev.id} />
                          {/* Una conexión de antes del permiso de contactos se
                              completa volviendo a pasar por Google: no hace
                              falta cortarla primero. */}
                          {!c.contactos && listo && (
                            <a
                              className="os-boton os-boton-firme"
                              href={`/api/os/google/conectar?evaluadora=${ev.id}`}
                            >
                              Sumar contactos
                            </a>
                          )}{' '}
                          <button type="submit" className="os-boton">
                            Desconectar
                          </button>
                        </form>
                      ) : listo ? (
                        <a
                          className="os-boton os-boton-firme"
                          href={`/api/os/google/conectar?evaluadora=${ev.id}`}
                        >
                          {c ? 'Volver a conectar' : 'Conectar'}
                        </a>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="os-form-nota">
        Cada una aprieta Conectar desde su computadora, con su cuenta de Google abierta en ese
        navegador: el permiso lo da la cuenta que esté abierta. El sistema solo crea, mueve y
        borra los eventos de sus entrevistas, y agenda como contacto al candidato cuando se le
        escribe por WhatsApp desde la tarjeta de Por citar. No lee ni modifica los contactos que
        ya existen.
      </p>
    </>
  );
}
