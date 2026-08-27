'use client';

/**
 * Envuelve cualquier control de archivos para que también reciba lo que se le
 * suelte encima.
 *
 * Los archivos llegan de a montones: las nueve fotos del Bender, el dibujo, el
 * informe del Benziger, el CV. Abrir el buscador de archivos y caminar hasta la
 * carpeta es el paso que sobra cuando el archivo ya está a la vista en el
 * escritorio o en el chat.
 *
 * **No reemplaza al botón: lo acompaña.** Adentro sigue estando el control de
 * siempre, así que se puede elegir o soltar. El marco punteado aparece al
 * arrastrar algo encima, que es cuando hay que decir dónde soltarlo.
 *
 * Quien lo usa decide qué hacer con los archivos: acá no se sube nada.
 */

import { useState } from 'react';

export default function SoltarArchivo({
  onArchivos,
  children,
  className,
  deshabilitado = false,
  /** Qué decir mientras se arrastra encima. */
  aviso = 'Soltalo acá',
}: {
  onArchivos: (archivos: File[]) => void;
  children: React.ReactNode;
  className?: string;
  deshabilitado?: boolean;
  aviso?: string;
}) {
  const [encima, setEncima] = useState(false);

  return (
    <div
      className={`os-soltar${encima ? ' encima' : ''}${className ? ` ${className}` : ''}`}
      onDragOver={(e) => {
        if (deshabilitado) return;
        // Sin frenarlo el navegador abre el archivo en la pestaña, que es
        // perder de vista la pantalla donde se estaba trabajando.
        e.preventDefault();
        setEncima(true);
      }}
      onDragLeave={(e) => {
        // Solo cuando el puntero se va de la caja entera: pasar de un hijo a
        // otro dispara `dragleave` y el marco parpadearía.
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setEncima(false);
      }}
      onDrop={(e) => {
        if (deshabilitado) return;
        e.preventDefault();
        setEncima(false);
        const xs = Array.from(e.dataTransfer.files ?? []);
        if (xs.length) onArchivos(xs);
      }}
    >
      {children}
      {encima && <span className="os-soltar-aviso">{aviso}</span>}
    </div>
  );
}
