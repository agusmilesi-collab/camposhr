'use client';

/**
 * El dibujo de dos personas, subido desde la entrevista.
 *
 * Se toma en papel, así que lo que entra al sistema es una foto o un escaneo.
 * Subirlo acá y no después es lo que evita el sobre con dibujos sueltos que
 * hay que emparejar con nombres semanas más tarde.
 *
 * Se sube apenas se elige el archivo: es un paso solo y un botón de confirmar
 * en el medio es un paso donde quedarse.
 *
 * La foto se achica antes de salir del navegador. Una del celular pesa cuatro
 * megas y lo que hay que ver es el trazo, no el grano del papel. Un PDF va tal
 * cual: puede ser un escaneo de varias hojas.
 */

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { achicar } from '@/lib/imagen-cliente';
import SoltarArchivo from '@/app/os/SoltarArchivo';
import IconoSoltar from '@/app/os/IconoSoltar';

export default function Grafico({ id, nombre }: { id: string; nombre: string | null }) {
  const router = useRouter();
  const [, empezar] = useTransition();
  const campo = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subir(archivo: File) {
    setError(null);
    setSubiendo(true);
    try {
      const liviano =
        archivo.type === 'application/pdf'
          ? archivo
          : new File([await achicar(archivo)], archivo.name, { type: 'image/jpeg' });
      const cuerpo = new FormData();
      cuerpo.append('evaluacionId', id);
      cuerpo.append('archivo', liviano);
      const res = await fetch('/api/os/grafico', { method: 'POST', body: cuerpo });
      const r = await res.json().catch(() => ({ ok: false, motivo: 'Sin respuesta.' }));
      if (!r.ok) {
        setError(r.motivo ?? 'No se pudo subir.');
        return;
      }
      empezar(() => router.refresh());
    } catch {
      setError('No se pudo subir.');
    } finally {
      setSubiendo(false);
      if (campo.current) campo.current.value = '';
    }
  }

  return (
    <>
      <input
        ref={campo}
        className="os-oculto"
        type="file"
        accept="image/*,application/pdf,.pdf"
        onChange={(e) => {
          const a = e.target.files?.[0];
          if (a) subir(a);
        }}
      />
      {/* Sin dibujo, la caja punteada dice de una las dos formas de cargarlo, y
          es la misma de la tarjeta de alta. Con dibujo, el enlace para verlo y
          el botón de reemplazar. */}
      {nombre ? (
        <>
          <a
            className="os-boton os-bender-ver"
            href={`/api/os/grafico?id=${id}`}
            target="_blank"
            rel="noreferrer"
            title={nombre}
          >
            Ver dibujo
          </a>
          <SoltarArchivo
            className="os-bender-subir"
            deshabilitado={subiendo}
            onArchivos={(xs) => subir(xs[0])}
            aviso="Soltá el dibujo"
          >
            <button
              className="os-boton os-bender-subir"
              type="button"
              disabled={subiendo}
              onClick={() => campo.current?.click()}
              title="Elegí el archivo, o soltalo acá"
            >
              {subiendo ? 'Subiendo…' : 'Reemplazar'}
            </button>
          </SoltarArchivo>
        </>
      ) : (
        <SoltarArchivo
          className="os-bender-caja"
          deshabilitado={subiendo}
          onArchivos={(xs) => subir(xs[0])}
          aviso="Soltá el dibujo"
        >
          <button
            type="button"
            className="os-agregar-cv os-caja-archivo"
            disabled={subiendo}
            onClick={() => campo.current?.click()}
          >
            <IconoSoltar />
            {subiendo ? 'Subiendo…' : 'Soltá el dibujo acá o elegí el archivo'}
          </button>
        </SoltarArchivo>
      )}
      {error && <span className="os-form-error">{error}</span>}
    </>
  );
}
