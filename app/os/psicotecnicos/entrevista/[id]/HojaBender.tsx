'use client';

/**
 * Lo que la persona dibujó del Bender, en una imagen.
 *
 * Hoy las nueve figuras vienen hechas en una misma hoja, así que es una foto y
 * a lo sumo dos. Antes eran nueve, una por lámina, y por eso esto compone: si
 * llegan varias se unen en una sola imagen antes de subirlas, y si llega una va
 * derecho. En los dos casos el navegador la achica primero, que es lo que evita
 * mandar treinta megas para guardar menos de dos.
 *
 * Ya no se rotula cada figura: el rótulo tenía sentido cuando cada foto era una
 * lámina suelta y había que ver si alguna quedó fuera de orden. Sobre una hoja
 * con las nueve, escribiría encima del dibujo.
 */

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { achicar, componer } from '@/lib/imagen-cliente';

/** El ancho de casilla que usa `componer` por defecto. */
const LADO_HOJA = 860;
import SoltarArchivo from '@/app/os/SoltarArchivo';
import IconoSoltar from '@/app/os/IconoSoltar';

export default function HojaBender({ id, hoja }: { id: string; hoja: string | null }) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const campo = useRef<HTMLInputElement>(null);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function subir(archivos: File[]) {
    setError(null);
    if (archivos.length > 9) {
      setError('Son nueve fotos como máximo.');
      return;
    }
    try {
      setTrabajando(archivos.length > 1 ? 'Armando la hoja…' : 'Achicando…');
      // Por nombre, que es el orden en que las mandó el teléfono.
      const orden = [...archivos].sort((a, b) =>
        a.name.localeCompare(b.name, 'es', { numeric: true })
      );
      // Una sola foto va tal cual, solo achicada: componerla la metía en una
      // casilla cuadrada de una grilla de tres, y la imagen guardada quedaba
      // con dos tercios de blanco al lado del dibujo. Varias sí se componen,
      // una debajo de otra mientras sean pocas, porque son hojas enteras y en
      // tres columnas quedarían del tamaño de una estampilla.
      const hoja =
        orden.length === 1
          ? await achicar(orden[0])
          : await componer(orden, {
              columnas: orden.length > 4 ? 3 : 1,
              // Una hoja A4 es más alta que ancha: en casilla cuadrada quedaba
              // una franja de blanco a cada lado.
              alto: orden.length > 4 ? undefined : Math.round(LADO_HOJA * 1.35),
            });

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
          {/* La miniatura, que es lo que dice de una si el dibujo está y cuál
              es: el botón de ver obligaba a abrirlo para saberlo. Se aprieta y
              abre la imagen entera. */}
          <a
            className="os-papel-mini"
            href={`/api/os/bender?id=${id}`}
            target="_blank"
            rel="noreferrer"
            title={hoja}
          >
            <img src={`/api/os/bender?id=${id}`} alt="Lo que dibujó" />
          </a>
          <SoltarArchivo
            className="os-bender-subir"
            deshabilitado={Boolean(trabajando)}
            onArchivos={(xs) => subir(xs)}
            aviso="Soltá la foto"
          >
            <button
              className="os-boton os-bender-subir"
              type="button"
              disabled={Boolean(trabajando)}
              onClick={() => campo.current?.click()}
              title="Elegí la foto de la hoja, o soltala acá"
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
          aviso="Soltá la foto"
        >
          <button
            type="button"
            className="os-agregar-cv os-caja-archivo"
            disabled={Boolean(trabajando)}
            onClick={() => campo.current?.click()}
          >
            <IconoSoltar />
            {trabajando ?? 'Soltá la hoja acá o elegila'}
          </button>
        </SoltarArchivo>
      )}
      {error && <span className="os-form-error">{error}</span>}
    </>
  );
}
