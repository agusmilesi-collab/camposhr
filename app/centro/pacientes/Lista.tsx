'use client';
/**
 * La lista de pacientes con un buscador, y el alta con lo mínimo: nombre,
 * apellido y teléfono. El resto de la ficha se completa adentro, cuando hace
 * falta: pedir doce campos para dar de alta es lo que hace que no se cargue.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Fila = {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
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

  const q = busca.trim().toLowerCase();
  const visibles = q
    ? pacientes.filter((p) => `${p.apellido} ${p.nombre} ${p.telefono ?? ''}`.toLowerCase().includes(q))
    : pacientes;

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
      <p className="centro-bajada">
        Las fichas de tu consulta: datos, antecedentes y la historia clínica de cada uno. Las ves
        solo vos.
      </p>
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
            {visibles.map((p) => (
              <li key={p.id}>
                <Link href={`/centro/pacientes/${p.id}`} className="centro-pacientes-nombre">
                  {p.apellido ? `${p.apellido}, ${p.nombre}` : p.nombre}
                </Link>
                <span className="centro-pacientes-dato">{p.telefono ?? ''}</span>
                <span className="centro-pacientes-dato">
                  {p.consultas === 0
                    ? 'Sin consultas'
                    : `${p.consultas} ${p.consultas === 1 ? 'consulta' : 'consultas'} · última ${fecha(p.ultima as string)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
