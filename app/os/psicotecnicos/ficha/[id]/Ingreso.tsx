'use client';

/**
 * Si la persona entró a trabajar, y cómo le fue a los noventa días.
 *
 * Es el final del recorrido y lo único que dice si la recomendación acertó.
 * Cargarlo es lo que después permite calcular el porcentaje de acierto de cada
 * evaluadora, y cruzar el resultado contra la familia del puesto, el nivel y
 * los indicadores del sumario. Sin este dato nada de eso se puede calcular.
 *
 * Tres estados y no un tilde, en las dos preguntas: "sin respuesta" no es lo
 * mismo que "no", y "regular" es el caso más informativo para el modelo, el de
 * alguien que entró, no fracasó, pero tampoco rindió.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import Opciones from '@/app/os/Opciones';

/** El seguimiento se hace a los noventa días de que empezó. */
function noventaDias(desde: string): string {
  const d = new Date(`${desde}T12:00:00`);
  d.setDate(d.getDate() + 90);
  const dd = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`;
}

function comoQueda(fecha: string | null): { texto: string; clase: string } | null {
  if (!fecha) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dia = new Date(`${fecha}T12:00:00`);
  const dias = Math.round((dia.getTime() - hoy.getTime()) / 86_400_000);
  if (dias > 0) return { texto: `en ${dias} ${dias === 1 ? 'día' : 'días'}`, clase: 'os-suave' };
  if (dias === 0) return { texto: 'hoy', clase: 'os-vence' };
  return { texto: `hace ${-dias} ${dias === -1 ? 'día' : 'días'}`, clase: 'os-vence' };
}

/**
 * Un grupo de respuestas, todas del mismo ancho.
 *
 * Con el ancho del texto, "Sin respuesta" quedaba tres veces más grande que
 * "Sí" y el grupo se leía como si una opción pesara más que las otras. La
 * grilla les da a todas la misma medida.
 */

export default function Ingreso({
  id,
  ingreso,
  fecha,
  seguimientoAl,
  resultado,
  notas,
}: {
  id: string;
  ingreso: boolean | null;
  fecha: string | null;
  seguimientoAl: string | null;
  resultado: string | null;
  notas: string | null;
}) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const [valor, setValor] = useState(ingreso);
  const [desde, setDesde] = useState(fecha);
  const [comoFue, setComoFue] = useState(resultado);
  const [error, setError] = useState<string | null>(null);

  async function guardar(campos: Record<string, unknown>) {
    setError(null);
    try {
      const res = await fetch('/api/os/psicotecnicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, cambios: campos }),
      });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) {
        setError(r.motivo ?? 'No se pudo guardar.');
        return false;
      }
      empezar(() => router.refresh());
      return true;
    } catch {
      setError('No se pudo guardar.');
      return false;
    }
  }

  async function responder(v: boolean | null) {
    const antes = valor;
    setValor(v);
    // Si no entró, la fecha y el seguimiento dejan de tener sentido.
    const ok = await guardar(
      v === true
        ? { ingreso: v }
        : {
            ingreso: v,
            fechaIngresoEmpresa: null,
            seguimientoAl: null,
            seguimientoResultado: null,
          }
    );
    if (!ok) setValor(antes);
    else if (v !== true) {
      setDesde(null);
      setComoFue(null);
    }
  }

  /** Al poner desde cuándo trabaja queda agendado el seguimiento. */
  async function ponerDesde(v: string) {
    setDesde(v || null);
    await guardar({
      fechaIngresoEmpresa: v || null,
      seguimientoAl: v ? noventaDias(v) : null,
    });
  }

  const vence = comoQueda(seguimientoAl);
  // Entró o no, las cuatro filas se ven siempre: si aparecieran recién al
  // contestar, no se sabría qué queda por cargar hasta tocar la de arriba.
  // Lo que no corresponde queda apagado, no escondido.
  const trabaja = valor === true;

  return (
    <div className="os-seguimiento">
      <div className="os-seguimiento-fila">
        <span className="os-dato-rotulo">Entró a trabajar</span>
        <Opciones
          valor={valor}
          opciones={[
            { v: true, texto: 'Sí' },
            { v: false, texto: 'No' },
            { v: null, texto: 'Sin respuesta' },
          ]}
          alElegir={responder}
        />
      </div>

      <div className={`os-seguimiento-fila${trabaja ? '' : ' apagada'}`}>
        <span className="os-dato-rotulo">Desde</span>
        <input
          className="os-campo os-ingreso-fecha"
          type="date"
          value={desde ?? ''}
          disabled={!trabaja}
          onChange={(e) => ponerDesde(e.target.value)}
          aria-label="Desde cuándo trabaja"
        />
      </div>

      <div className={`os-seguimiento-fila${trabaja && seguimientoAl ? '' : ' apagada'}`}>
        <span className="os-dato-rotulo">A los 90 días</span>
        {trabaja && seguimientoAl ? (
          <span>
            {new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long' }).format(
              new Date(`${seguimientoAl}T12:00:00`)
            )}
            {vence && <span className={`os-seguimiento-cuando ${vence.clase}`}>{vence.texto}</span>}
          </span>
        ) : (
          <span className="os-dato-falta">se agenda al poner la fecha</span>
        )}
      </div>

      <div className={`os-seguimiento-fila${trabaja ? '' : ' apagada'}`}>
        <span className="os-dato-rotulo">Cómo le fue</span>
        <Opciones
          valor={comoFue}
          desactivado={!trabaja}
          opciones={[
            { v: 'Bien', texto: 'Bien' },
            { v: 'Regular', texto: 'Regular' },
            { v: 'Mal', texto: 'Mal' },
            { v: null, texto: 'Sin preguntar' },
          ]}
          alElegir={(v) => {
            setComoFue(v);
            guardar({ seguimientoResultado: v });
          }}
        />
      </div>

      <div className={`os-seguimiento-fila${trabaja && comoFue ? '' : ' apagada'}`}>
        <span className="os-dato-rotulo">Qué dijeron</span>
        <textarea
          className="os-campo os-seguimiento-notas"
          defaultValue={notas ?? ''}
          rows={2}
          disabled={!trabaja || !comoFue}
          placeholder="Lo que contó la empresa: qué anduvo y qué no."
          onBlur={(e) => guardar({ seguimientoNotas: e.target.value || null })}
          aria-label="Qué dijeron"
        />
      </div>

      {error && <p className="os-form-error">{error}</p>}
    </div>
  );
}
