'use client';

/**
 * Quién del cliente pidió esta evaluación, editable desde su ficha.
 *
 * Es un contacto de la empresa (o de su grupo). Cuando la evaluación no tiene
 * uno propio vale el del pedido, así que la primera opción es esa: dejarlo en
 * blanco y que rija el del pedido, que es lo que pasa con todo lo cargado
 * antes del 3/10/2026.
 *
 * Se cambia desde acá porque el que cargó al candidato por el portal no siempre
 * es el que lo pidió, y ese nombre sale en el encabezado del informe y decide
 * a quién le llegan los avisos por correo.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import Desplegable from '@/app/os/Desplegable';

export type ContactoOpcion = { id: string; nombre: string; cargo: string | null };

const DEL_PEDIDO = '';

export default function Solicitante({
  id,
  valor: inicial,
  delPedido,
  contactos,
}: {
  id: string;
  /** El contacto propio de la evaluación; null es "el del pedido". */
  valor: string | null;
  /** Cómo se llama el del pedido, si lo tiene. */
  delPedido: string | null;
  contactos: ContactoOpcion[];
}) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [valor, setValor] = useState(inicial ?? DEL_PEDIDO);
  useEffect(() => setValor(inicial ?? DEL_PEDIDO), [inicial]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cambiar(nuevo: string) {
    const antes = valor;
    setValor(nuevo);
    setError(null);
    setGuardando(true);
    try {
      const res = await fetch('/api/os/psicotecnicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, campo: 'solicitante', valor: nuevo || null }),
      });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) {
        setValor(antes);
        setError(r.motivo ?? 'No se pudo cambiar.');
        return;
      }
      empezar(() => router.refresh());
    } catch {
      setValor(antes);
      setError('No se pudo cambiar.');
    } finally {
      setGuardando(false);
    }
  }

  const opciones = [
    {
      valor: DEL_PEDIDO,
      texto: delPedido ? `El del pedido (${delPedido})` : 'Sin indicar',
    },
    ...contactos.map((c) => ({
      valor: c.id,
      texto: c.cargo ? `${c.nombre} · ${c.cargo}` : c.nombre,
    })),
  ];

  // Un contacto dado de baja no está en la lista: se muestra igual, con su
  // nombre, para que la ficha no diga otra cosa que el informe.
  return (
    <>
      <span className="os-control-suave">
        <Desplegable
          valor={valor}
          opciones={opciones}
          alElegir={cambiar}
          deshabilitado={guardando}
          etiqueta="Cambiar quién pidió la evaluación"
          vacio="Sin indicar"
        />
      </span>
      {error && <span className="os-form-error">{error}</span>}
    </>
  );
}
