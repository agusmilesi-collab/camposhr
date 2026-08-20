'use client';

/**
 * Cargar y borrar costos de una oportunidad ganada.
 *
 * El costo vive al lado del ingreso que lo justifica: la pregunta que contesta
 * esta pantalla es "de esto que vendí, qué me quedó", y para eso los dos
 * números tienen que estar en la misma fila.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';

async function mandar(cuerpo: unknown) {
  const res = await fetch('/api/os/comercial', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  const datos = await res.json().catch(() => ({ error: 'Sin respuesta.' }));
  if (!res.ok) throw new Error(datos.error ?? 'No se pudo guardar.');
  return datos;
}

export function NuevoCosto({ cotizacionId }: { cotizacionId: string }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = Object.fromEntries(new FormData(form).entries());
    setEnviando(true);
    setError(null);
    try {
      await mandar({ accion: 'costo', cotizacionId, ...datos });
      form.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="os-form os-form-linea" onSubmit={enviar}>
      <div className="os-campo-bloque">
        <label className="os-etiqueta-campo">Concepto</label>
        <input className="os-campo" name="concepto" required maxLength={160} placeholder="Honorarios de la psicóloga" />
      </div>
      <div className="os-campo-bloque">
        <label className="os-etiqueta-campo">Importe</label>
        <input className="os-campo" name="importe" type="number" min="0" step="1000" required />
      </div>
      <div className="os-campo-bloque">
        <label className="os-etiqueta-campo">Fecha</label>
        <input className="os-campo" name="fecha" type="date" />
      </div>
      <div className="os-campo-bloque os-campo-boton">
        <button className="os-boton os-boton-firme" type="submit" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Sumar costo'}
        </button>
      </div>
      {error && <p className="os-form-error os-campo-entero">{error}</p>}
    </form>
  );
}

export function BorrarCosto({ id }: { id: string }) {
  const router = useRouter();
  const [borrando, setBorrando] = useState(false);

  return (
    <button
      className="os-enlace-boton"
      disabled={borrando}
      onClick={async () => {
        setBorrando(true);
        try {
          await mandar({ accion: 'borrarCosto', id });
          router.refresh();
        } finally {
          setBorrando(false);
        }
      }}
    >
      Quitar
    </button>
  );
}
