'use client';

/**
 * Las nueve láminas que dibujó la persona, subidas juntas.
 *
 * Llegan por WhatsApp como nueve fotos de teléfono, una por lámina. Se eligen
 * las nueve de una vez y el navegador las achica y las une en una sola imagen
 * antes de que salgan de acá: subirlas enteras sería mandar unos treinta megas
 * para guardar menos de dos, y dejaría nueve archivos sueltos que hay que
 * volver a ordenar cada vez que se abre la evaluación.
 *
 * El orden es el de los nombres de archivo, que es el que trae WhatsApp. La
 * hoja sale rotulada con el nombre de cada lámina (A y 1 a 8), así que si
 * alguna quedó en el lugar equivocado se ve al mirarla y se vuelven a subir.
 */

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { componer } from '@/lib/imagen-cliente';
import SoltarArchivo from '@/app/os/SoltarArchivo';
import IconoSoltar from '@/app/os/IconoSoltar';

/** Cómo se llaman las láminas del Bender, en orden. */
const LAMINAS = ['A', '1', '2', '3', '4', '5', '6', '7', '8'];

export default function HojaBender({ id, hoja }: { id: string; hoja: string | null }) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const campo = useRef<HTMLInputElement>(null);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function subir(archivos: File[]) {
    setError(null);
    if (archivos.length > 9) {
      setError('Son nueve láminas como máximo.');
      return;
    }
    try {
      setTrabajando('Armando la hoja…');
      // Por nombre, que es el orden en que las mandó el teléfono.
      const orden = [...archivos].sort((a, b) =>
        a.name.localeCompare(b.name, 'es', { numeric: true })
      );
      const hoja = await componer(orden, { columnas: 3, rotulos: LAMINAS });

      setTrabajando('Subiendo…');
      const cuerpo = new FormData();
      cuerpo.append('evaluacionId', id);
      cuerpo.append('cuantas', String(orden.length));
      cuerpo.append('archivo', new File([hoja], 'bender.jpg', { type: 'image/jpeg' }));
      const res = await fetch('/api/os/bender', { method: 'POST', body: cuerpo });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) {
        setError(r.motivo ?? 'No se pudo subir.');
        return;
      }
      empezar(() => router.refresh());
    } catch {
      setError('No se pudo armar la hoja.');
    } finally {
      setTrabajando(null);
      if (campo.current) campo.current.value = '';
    }
  }

  return (
    <>
      <input
        ref={campo}
        className="os-oculto"
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => {
          const xs = Array.from(e.target.files ?? []);
          if (xs.length) subir(xs);
        }}
      />
      {/* Debajo de los botones de la lámina: arriba lo que se le muestra a la
          persona, abajo lo que dejó dibujado.

          Sin dibujos, en vez de un botón va la caja punteada: es la misma de la
          tarjeta de alta y dice de una las dos formas de cargarlo. Con dibujos
          ya cargados, el enlace para verlos y el botón de reemplazar, que es lo
          que se hace entonces. */}
      {hoja ? (
        <>
          <a
            className="os-boton os-bender-ver"
            href={`/api/os/bender?id=${id}`}
            target="_blank"
            rel="noreferrer"
            title={hoja}
          >
            Ver dibujo
          </a>
          <SoltarArchivo
            className="os-bender-subir"
            deshabilitado={Boolean(trabajando)}
            onArchivos={(xs) => subir(xs)}
            aviso="Soltá las fotos"
          >
            <button
              className="os-boton os-bender-subir"
              type="button"
              disabled={Boolean(trabajando)}
              onClick={() => campo.current?.click()}
              title="Elegí las nueve fotos juntas, o soltalas acá"
            >
              {trabajando ?? 'Reemplazar'}
            </button>
          </SoltarArchivo>
        </>
      ) : (
        <SoltarArchivo
          className="os-bender-caja"
          deshabilitado={Boolean(trabajando)}
          onArchivos={(xs) => subir(xs)}
          aviso="Soltá las fotos"
        >
          <button
            type="button"
            className="os-agregar-cv os-caja-archivo"
            disabled={Boolean(trabajando)}
            onClick={() => campo.current?.click()}
          >
            <IconoSoltar />
            {trabajando ?? 'Soltá las nueve fotos acá o elegilas'}
          </button>
        </SoltarArchivo>
      )}
      {error && <span className="os-form-error">{error}</span>}
    </>
  );
}
