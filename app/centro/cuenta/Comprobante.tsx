'use client';

/**
 * Donde el inquilino deja el comprobante de su transferencia.
 *
 * Una caja que se toca para elegir el archivo o recibe el que se le suelte
 * encima, y lo sube en el acto: no hay nada más que completar, así que un botón
 * de enviar sería un paso para olvidarse.
 *
 * Las fotos se achican acá antes de salir, como el resto de las que se suben al
 * sistema: una captura de pantalla del banco pesa varios megas y lo que hay que
 * poder leer son los números.
 */

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { achicar } from '@/lib/imagen-cliente';

type Subido = { id: string; nombre: string; cuando: string };

export default function Comprobante({
  periodo,
  mes,
  subidos,
}: {
  periodo: string;
  /** El mes escrito, para decir a cuál corresponde lo que se sube. */
  mes: string;
  subidos: Subido[];
}) {
  const router = useRouter();
  const campo = useRef<HTMLInputElement>(null);
  const [encima, setEncima] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subir(archivo: File) {
    setError(null);
    setSubiendo(true);
    try {
      let cuerpo: Blob = archivo;
      let nombre = archivo.name;
      if (archivo.type.startsWith('image/')) {
        cuerpo = await achicar(archivo);
        // Si se pudo achicar salió un JPEG; si no, viaja tal como vino.
        if (cuerpo !== archivo) nombre = nombre.replace(/\.[^.]*$/, '') + '.jpg';
      }
      const datos = new FormData();
      datos.set('archivo', new File([cuerpo], nombre, { type: cuerpo.type || archivo.type }));
      datos.set('periodo', periodo);
      const res = await fetch('/api/centro/comprobante', { method: 'POST', body: datos });
      const r = await res.json().catch(() => null);
      if (!res.ok || !r?.ok) {
        setError(r?.motivo ?? 'No se pudo subir. Probá de nuevo.');
        return;
      }
      router.refresh();
    } catch {
      setError('No se pudo subir. Probá de nuevo.');
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <>
      <div
        className={`centro-soltar${encima ? ' encima' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => !subiendo && campo.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !subiendo) campo.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setEncima(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setEncima(false);
          const archivo = e.dataTransfer.files?.[0];
          if (archivo && !subiendo) subir(archivo);
        }}
      >
        <b>{subiendo ? 'Subiendo…' : 'Soltá acá el comprobante de la transferencia'}</b>
        <span>
          {subiendo ? 'Un momento.' : `O tocá para elegirlo. PDF o foto, de ${mes}.`}
        </span>
        <input
          ref={campo}
          type="file"
          accept="application/pdf,image/*"
          hidden
          onChange={(e) => {
            const archivo = e.target.files?.[0];
            e.target.value = '';
            if (archivo) subir(archivo);
          }}
        />
      </div>

      {error && <p className="centro-nota centro-soltar-error">{error}</p>}

      {subidos.length > 0 && (
        <ul className="centro-lista">
          {subidos.map((s) => (
            <li className="centro-item" key={s.id}>
              <div>
                <a href={`/api/centro/comprobante?id=${s.id}`} target="_blank" rel="noreferrer">
                  {s.nombre}
                </a>
                <small>Subido el {s.cuando}. Lorena o Lucila registran el pago cuando lo ven.</small>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
