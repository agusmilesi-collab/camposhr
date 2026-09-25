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
import Desplegable from '@/app/os/Desplegable';

/* En el desplegable va el nombre de pila: "Lucila Campos" no entra en el ancho
   del renglón de un gasto y se leía cortado. Lo que se guarda sigue siendo el
   nombre entero, que es el que figura en el equipo. */
function corto(nombre: string) {
  return nombre.split(' ')[0];
}

/** Quiénes pueden haber puesto la plata: el estudio o cada uno del equipo. */
function opcionesDePago(equipo: string[]) {
  return [
    { valor: '', texto: 'El estudio', color: 'os-gris' },
    ...equipo.map((n) => ({ valor: n, texto: corto(n), color: 'os-azul' })),
  ];
}

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

export function NuevoCosto({
  cotizacionId,
  equipo,
}: {
  cotizacionId: string;
  /** Los nombres entre los que se reparte la plata del estudio. */
  equipo: string[];
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* Quién pagó viaja aparte del formulario: el desplegable del OS es un botón
     con su lista, no un campo del navegador. */
  const [pagadoPor, setPagadoPor] = useState('');

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = Object.fromEntries(new FormData(form).entries());
    setEnviando(true);
    setError(null);
    try {
      await mandar({ accion: 'costo', cotizacionId, ...datos, pagadoPor });
      form.reset();
      setPagadoPor('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setEnviando(false);
    }
  }

  /* Los campos caen en las mismas columnas que los gastos de arriba: lo que se
     escribe queda debajo de lo que va a ser. */
  return (
    <form className="os-form os-gasto os-gasto-pagado os-gasto-alta" onSubmit={enviar}>
      <div className="os-campo-bloque">
        <label className="os-etiqueta-campo">Concepto</label>
        <input className="os-campo" name="concepto" required maxLength={160} placeholder="Honorarios de la psicóloga" />
      </div>
      {/* Quién puso la plata: al repartir, ese gasto se le devuelve antes de
          partir lo que queda. Sin elegir queda a cuenta del estudio. */}
      <div className="os-campo-bloque">
        <label className="os-etiqueta-campo">Pagó</label>
        <Desplegable
          valor={pagadoPor}
          opciones={opcionesDePago(equipo)}
          alElegir={setPagadoPor}
          deshabilitado={enviando}
          etiqueta="Quién pone la plata de este gasto"
          vacio="El estudio"
          ancho={124}
        />
      </div>
      <div className="os-campo-bloque">
        <label className="os-etiqueta-campo">Fecha</label>
        <input className="os-campo" name="fecha" type="date" />
      </div>
      <div className="os-campo-bloque">
        <label className="os-etiqueta-campo">Importe</label>
        {/* Sin saltos de mil: un gasto real es 8900, no 8000 ni 9000, y el
            navegador rechazaba todo lo que no fuera múltiplo. */}
        <input
          className="os-campo os-campo-importe"
          name="importe"
          type="number"
          min="0"
          step="any"
          required
        />
      </div>
      <div className="os-campo-bloque os-campo-boton">
        <button className="os-boton os-boton-firme" type="submit" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Sumar'}
        </button>
      </div>
      {error && <p className="os-form-error os-campo-entero">{error}</p>}
    </form>
  );
}

/**
 * Quién pagó un gasto ya cargado.
 *
 * Guarda al elegir, como el resto de los selectores del OS: el clic ya es la
 * decisión y un botón de confirmar no agrega nada.
 */
export function QuienPago({
  id,
  valor,
  equipo,
}: {
  id: string;
  valor: string | null;
  equipo: string[];
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);

  return (
    <Desplegable
      valor={valor ?? ''}
      opciones={opcionesDePago(equipo)}
      deshabilitado={guardando}
      etiqueta="Quién puso la plata de este gasto"
      vacio="El estudio"
      ancho={124}
      alElegir={async (pagadoPor) => {
        setGuardando(true);
        try {
          await mandar({ accion: 'pagadorCosto', id, pagadoPor });
          router.refresh();
        } finally {
          setGuardando(false);
        }
      }}
    />
  );
}

/**
 * El importe de un gasto, editable donde se lee.
 *
 * Se escribe encima del número y guarda al salir del campo, como los precios de
 * los consultorios: un gasto se carga apurado y el número se corrige después,
 * mirando el ticket.
 */
export function ImporteCosto({
  id,
  importe,
  moneda,
}: {
  id: string;
  importe: number;
  moneda: string;
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);

  /* Se lee con los puntos de mil, como el resto de los importes, y se escribe
     igual: al guardar se sacan los puntos y la coma pasa a ser el decimal. */
  const escrito = (n: number) => new Intl.NumberFormat('es-AR').format(n);
  const leer = (texto: string) => Number(texto.replace(/[^\d,-]/g, '').replace(',', '.'));

  return (
    <span className="os-gasto-monto">
      <span className="os-gasto-moneda">{moneda}</span>
      <input
        className="os-campo os-campo-suave os-gasto-numero"
        inputMode="decimal"
        defaultValue={escrito(importe)}
        disabled={guardando}
        aria-label="Importe del gasto"
        onFocus={(e) => e.currentTarget.select()}
        onBlur={async (e) => {
          const valor = leer(e.target.value);
          if (!Number.isFinite(valor) || valor < 0 || valor === importe) {
            e.target.value = escrito(importe);
            return;
          }
          /* Con los puntos de mil ya puestos: lo que se escribió a mano queda
             escrito como se lee en el resto de la columna. */
          e.target.value = escrito(valor);
          setGuardando(true);
          try {
            await mandar({ accion: 'importeCosto', id, importe: valor });
            router.refresh();
          } finally {
            setGuardando(false);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            e.currentTarget.value = escrito(importe);
            e.currentTarget.blur();
          }
        }}
      />
    </span>
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
