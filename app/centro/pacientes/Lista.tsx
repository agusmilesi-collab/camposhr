'use client';
/**
 * La lista de pacientes con un buscador, y el alta con lo mínimo: nombre,
 * apellido y teléfono. El resto de la ficha se completa adentro, cuando hace
 * falta: pedir doce campos para dar de alta es lo que hace que no se cargue.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { enlaceWhatsapp } from '@/lib/whatsapp';

type Fila = {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  activo: boolean;
  consultas: number;
  ultima: string | null;
};

function fecha(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'numeric', year: '2-digit' }).format(
    new Date(`${iso}T12:00:00-03:00`)
  );
}

export default function Lista({ pacientes }: { pacientes: Fila[] }) {
  const router = useRouter();
  const [busca, setBusca] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [alta, setAlta] = useState(false);

  const [cambiando, setCambiando] = useState<string | null>(null);

  const q = busca.trim().toLowerCase();
  // Los activos primero y los inactivos debajo, cada grupo en su orden.
  const visibles = pacientes
    .filter((p) => !q || `${p.apellido} ${p.nombre} ${p.telefono ?? ''}`.toLowerCase().includes(q))
    .sort((a, b) => Number(b.activo) - Number(a.activo));

  /** Activo o no, desde la lista: una ficha inactiva no se ofrece al anotar
   *  turnos ni cuenta, pero no se borra. */
  async function activar(p: Fila, activo: boolean) {
    setCambiando(p.id);
    setError(null);
    const res = await fetch('/api/centro/pacientes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, activo }),
    });
    const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
    setCambiando(null);
    if (!r.ok) return setError(r.motivo ?? 'No se pudo guardar.');
    router.refresh();
  }

  async function crear(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const d = new FormData(ev.currentTarget);
    setGuardando(true);
    const res = await fetch('/api/centro/pacientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: d.get('nombre'),
        apellido: d.get('apellido'),
        telefono: d.get('telefono'),
      }),
    });
    const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
    setGuardando(false);
    if (!r.ok) return setError(r.motivo ?? 'No se pudo dar de alta.');
    setError(null);
    router.push(`/centro/pacientes/${r.id}`);
  }

  return (
    <main className="centro-cuerpo">
      <h1 className="centro-titulo">Pacientes</h1>
      {error && <p className="centro-error">{error}</p>}

      <div className="centro-fila" style={{ marginBottom: 14 }}>
        <input
          className="centro-campo"
          style={{ flex: 1 }}
          placeholder="Buscar por apellido, nombre o teléfono"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <button type="button" className="centro-boton" onClick={() => setAlta((v) => !v)}>
          {alta ? 'Cerrar' : 'Nuevo paciente'}
        </button>
      </div>

      {alta && (
        <form className="centro-panel" onSubmit={crear} autoComplete="off">
          <h2>Nuevo paciente</h2>
          <div className="centro-fila">
            <input className="centro-campo" name="nombre" placeholder="Nombre" required autoFocus />
            <input className="centro-campo" name="apellido" placeholder="Apellido" />
            <input className="centro-campo" name="telefono" placeholder="Teléfono" inputMode="tel" />
          </div>
          <p className="centro-nota">El resto de la ficha se completa adentro.</p>
          <button className="centro-boton" type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Crear la ficha'}
          </button>
        </form>
      )}

      <div className="centro-panel">
        {pacientes.length === 0 ? (
          <p className="centro-nota" style={{ margin: 0 }}>
            Todavía no cargaste a nadie. Empezá con "Nuevo paciente".
          </p>
        ) : visibles.length === 0 ? (
          <p className="centro-nota" style={{ margin: 0 }}>
            Nadie coincide con la búsqueda.
          </p>
        ) : (
          <ul className="centro-pacientes-lista">
            {visibles.map((p, i) => (
              <li
                key={p.id}
                className={
                  p.activo ? undefined : `inactivo${i > 0 && visibles[i - 1].activo ? ' primero' : ''}`
                }
              >
                <Link href={`/centro/pacientes/${p.id}`} className="centro-pacientes-nombre">
                  {p.apellido ? `${p.apellido}, ${p.nombre}` : p.nombre}
                </Link>
                <span className="centro-pacientes-dato">
                  {p.telefono && enlaceWhatsapp(p.telefono) ? (
                    <a
                      href={enlaceWhatsapp(p.telefono) as string}
                      className="centro-whatsapp"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Escribirle por WhatsApp"
                    >
                      <img src="/correo/whatsapp.png" alt="" aria-hidden="true" />
                      {p.telefono}
                    </a>
                  ) : (
                    p.telefono ?? ''
                  )}
                </span>
                <span className="centro-pacientes-dato">
                  {p.consultas === 0
                    ? 'Sin consultas'
                    : `${p.consultas} ${p.consultas === 1 ? 'consulta' : 'consultas'} · última ${fecha(p.ultima as string)}`}
                </span>
                <button
                  type="button"
                  className={`centro-activo${p.activo ? ' si' : ''}`}
                  role="switch"
                  aria-checked={p.activo}
                  title={p.activo ? 'Activo. Tocá para darlo de baja' : 'Inactivo. Tocá para volver a activarlo'}
                  onClick={() => activar(p, !p.activo)}
                  disabled={cambiando === p.id}
                >
                  <i />
                  {p.activo ? 'Activo' : 'Inactivo'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
