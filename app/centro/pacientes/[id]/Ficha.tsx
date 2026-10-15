'use client';
/**
 * La ficha: tres paneles.
 *
 *   Datos          identidad, contacto y cobertura. Se editan en el lugar y
 *                  se guardan al salir del campo.
 *   Antecedentes   lo que cualquier profesional pregunta la primera vez:
 *                  motivo de consulta, antecedentes, medicación, alergias.
 *   Historia       una entrada por consulta, la más nueva arriba. Se agrega,
 *                  se edita (texto y fecha) y se borra, con una confirmación
 *                  en el lugar.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Evolucion, Paciente } from '@/lib/pacientes';

function larga(iso: string): string {
  const t = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(`${iso}T12:00:00-03:00`)
  );
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function edad(nac: string | null, hoy: string): string | null {
  if (!nac) return null;
  const a = Number(hoy.slice(0, 4)) - Number(nac.slice(0, 4));
  const cumplio = hoy.slice(5) >= nac.slice(5);
  return `${cumplio ? a : a - 1} años`;
}

/** Los campos de Datos, en el orden en que se leen. */
/* En dos columnas se leen por filas: izquierda quién es, derecha cómo se lo
   ubica y quién paga. */
const DATOS: { campo: keyof Paciente; rotulo: string; tipo?: string }[] = [
  { campo: 'nombre', rotulo: 'Nombre' },
  { campo: 'telefono', rotulo: 'Teléfono', tipo: 'tel' },
  { campo: 'apellido', rotulo: 'Apellido' },
  { campo: 'correo', rotulo: 'Correo', tipo: 'email' },
  { campo: 'dni', rotulo: 'DNI' },
  { campo: 'direccion', rotulo: 'Dirección' },
  { campo: 'fecha_nacimiento', rotulo: 'Nacimiento', tipo: 'date' },
  { campo: 'cobertura', rotulo: 'Obra social o prepaga' },
  { campo: 'derivado_por', rotulo: 'Derivado por' },
  { campo: 'afiliado', rotulo: 'Número de afiliado' },
  { campo: 'contacto_emergencia', rotulo: 'Contacto de emergencia' },
];

const ANTECEDENTES: { campo: keyof Paciente; rotulo: string; pista: string }[] = [
  { campo: 'motivo_consulta', rotulo: 'Motivo de consulta', pista: 'Por qué consulta la primera vez.' },
  { campo: 'antecedentes', rotulo: 'Antecedentes', pista: 'Enfermedades, cirugías, tratamientos previos, antecedentes familiares.' },
  { campo: 'medicacion', rotulo: 'Medicación actual', pista: 'Qué toma y en qué dosis.' },
  { campo: 'alergias', rotulo: 'Alergias', pista: 'A medicamentos, alimentos u otros.' },
  { campo: 'notas', rotulo: 'Notas', pista: 'Lo que no entra en lo anterior.' },
];

export default function Ficha({
  paciente,
  evoluciones,
  hoy,
}: {
  paciente: Paciente;
  evoluciones: Evolucion[];
  hoy: string;
}) {
  const router = useRouter();
  const [p, setP] = useState(paciente);
  const [error, setError] = useState<string | null>(null);
  const [nueva, setNueva] = useState({ fecha: hoy, texto: '' });
  const [guardando, setGuardando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [edicion, setEdicion] = useState({ fecha: '', texto: '' });
  /** La entrada que está por borrarse: la pregunta se hace en el renglón. */
  const [borrando, setBorrando] = useState<string | null>(null);

  async function guardarCampo(campo: keyof Paciente) {
    const valor = p[campo];
    if (valor === paciente[campo]) return;
    const res = await fetch('/api/centro/pacientes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, [campo]: valor }),
    });
    const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
    if (!r.ok) return setError(r.motivo ?? 'No se pudo guardar.');
    setError(null);
    router.refresh();
  }

  async function agregar(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setGuardando(true);
    const res = await fetch('/api/centro/evoluciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pacienteId: p.id, fecha: nueva.fecha, texto: nueva.texto }),
    });
    const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
    setGuardando(false);
    if (!r.ok) return setError(r.motivo ?? 'No se pudo guardar.');
    setError(null);
    setNueva({ fecha: hoy, texto: '' });
    router.refresh();
  }

  async function editar(id: string) {
    const res = await fetch('/api/centro/evoluciones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, fecha: edicion.fecha, texto: edicion.texto }),
    });
    const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
    if (!r.ok) return setError(r.motivo ?? 'No se pudo guardar.');
    setError(null);
    setEditando(null);
    router.refresh();
  }

  async function borrar(id: string) {
    const res = await fetch('/api/centro/evoluciones', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
    if (!r.ok) return setError(r.motivo ?? 'No se pudo borrar.');
    setError(null);
    setBorrando(null);
    router.refresh();
  }

  const titulo = p.apellido ? `${p.apellido}, ${p.nombre}` : p.nombre;
  const anios = edad(p.fecha_nacimiento, hoy);

  return (
    <main className="centro-cuerpo">
      <p className="centro-nota" style={{ margin: '0 0 6px' }}>
        <Link href="/centro/pacientes" className="centro-bajar">
          ← Pacientes
        </Link>
      </p>
      <h1 className="centro-titulo">{titulo}</h1>
      <p className="centro-bajada">
        {[anios, p.cobertura].filter(Boolean).join(' · ') || 'Ficha sin datos todavía.'}
      </p>
      {error && <p className="centro-error">{error}</p>}

      {/* Datos y antecedentes en un solo panel, denso: un renglón por campo,
          rótulo a la izquierda y valor a la derecha, letra chica. Es una
          ficha para consultar de un vistazo, no un formulario para llenar. */}
      <section className="centro-panel centro-ficha">
        <h2>Ficha</h2>
        <h3 className="centro-ficha-sub">Datos</h3>
        <div className="centro-ficha-filas centro-ficha-filas-dos">
          {DATOS.map((d) => (
            <label key={d.campo}>
              <span>{d.rotulo}</span>
              <input
                className="centro-ficha-valor"
                type={d.tipo ?? 'text'}
                value={(p[d.campo] as string | null) ?? ''}
                onChange={(e) => setP({ ...p, [d.campo]: e.target.value })}
                onBlur={() => guardarCampo(d.campo)}
              />
            </label>
          ))}
        </div>
        <h3 className="centro-ficha-sub">Antecedentes</h3>
        <div className="centro-ficha-filas">
          {ANTECEDENTES.map((a) => (
            <label key={a.campo}>
              <span>{a.rotulo}</span>
              <textarea
                className="centro-ficha-valor centro-ficha-texto"
                placeholder={a.pista}
                value={(p[a.campo] as string | null) ?? ''}
                onChange={(e) => setP({ ...p, [a.campo]: e.target.value })}
                onBlur={() => guardarCampo(a.campo)}
                rows={1}
                onFocus={(e) => (e.currentTarget.rows = 3)}
                onBlurCapture={(e) => (e.currentTarget.rows = 1)}
              />
            </label>
          ))}
        </div>
        <p className="centro-nota" style={{ margin: '8px 0 0' }}>
          Se guarda al salir de cada campo.
        </p>
      </section>

      <section className="centro-panel">
        <h2>Historia clínica</h2>
        <form className="centro-evolucion-nueva" onSubmit={agregar}>
          <input
            className="centro-campo"
            type="date"
            value={nueva.fecha}
            max={hoy}
            onChange={(e) => setNueva({ ...nueva, fecha: e.target.value })}
            required
          />
          <textarea
            className="centro-campo centro-ficha-texto"
            placeholder="Qué trajo, qué evaluaste, qué hiciste o indicaste."
            value={nueva.texto}
            onChange={(e) => setNueva({ ...nueva, texto: e.target.value })}
            rows={3}
            required
          />
          <button className="centro-boton" type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Agregar consulta'}
          </button>
        </form>

        {evoluciones.length === 0 ? (
          <p className="centro-nota">Todavía no hay consultas anotadas.</p>
        ) : (
          <ol className="centro-evoluciones">
            {evoluciones.map((e) => (
              <li key={e.id}>
                {editando === e.id ? (
                  <div className="centro-evolucion-editar">
                    <input
                      className="centro-campo"
                      type="date"
                      value={edicion.fecha}
                      max={hoy}
                      onChange={(ev) => setEdicion({ ...edicion, fecha: ev.target.value })}
                      style={{ justifySelf: 'start' }}
                    />
                    <textarea
                      className="centro-campo centro-ficha-texto"
                      value={edicion.texto}
                      onChange={(ev) => setEdicion({ ...edicion, texto: ev.target.value })}
                      rows={4}
                      autoFocus
                    />
                    <div className="centro-fila">
                      <button type="button" className="centro-boton" onClick={() => editar(e.id)}>
                        Guardar
                      </button>
                      <button
                        type="button"
                        className="centro-boton centro-boton-suave"
                        onClick={() => setEditando(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="centro-evolucion-top">
                      <div className="centro-evolucion-fecha">{larga(e.fecha)}</div>
                      {borrando === e.id ? (
                        <span className="centro-evolucion-acciones">
                          <span>¿Borrar esta consulta?</span>
                          <button type="button" className="centro-enlace-texto" onClick={() => borrar(e.id)}>
                            Sí, borrar
                          </button>
                          <button type="button" className="centro-enlace-texto" onClick={() => setBorrando(null)}>
                            No
                          </button>
                        </span>
                      ) : (
                        <span className="centro-evolucion-acciones">
                          {/* Íconos y no palabras: son dos acciones chicas al
                              costado de cada consulta, y escritas competían
                              con el texto. El rótulo va en el title y para
                              el lector de pantalla. */}
                          <button
                            type="button"
                            className="centro-icono"
                            title="Editar"
                            aria-label="Editar esta consulta"
                            onClick={() => {
                              setBorrando(null);
                              setEditando(e.id);
                              setEdicion({ fecha: e.fecha, texto: e.texto });
                            }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
                              <path d="M13.5 6.5l3 3" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="centro-icono"
                            title="Borrar"
                            aria-label="Borrar esta consulta"
                            onClick={() => setBorrando(e.id)}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M4 7h16M10 11v6M14 11v6" />
                              <path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
                            </svg>
                          </button>
                        </span>
                      )}
                    </div>
                    <p className="centro-evolucion-texto">{e.texto}</p>
                  </>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
