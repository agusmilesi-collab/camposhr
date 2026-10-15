'use client';

/**
 * Lo que se ve apenas se toca otra sección, mientras el servidor lee las
 * evaluaciones.
 *
 * Sin esto la pantalla anterior quedaba quieta hasta que llegaba la nueva, y el
 * clic parecía no haber hecho nada. El título sale de la dirección, que ya
 * cambió, y las filas son renglones grises hasta que llegan las de verdad.
 */

import { usePathname } from 'next/navigation';
import Shell from '../../Shell';
import { SECCION_DE_RUTA } from '@/lib/psicotecnicos-tipos';

export default function Cargando() {
  const ruta = usePathname() ?? '';
  const seccion = SECCION_DE_RUTA[ruta.split('/').pop() ?? ''];
  const texto = seccion?.texto ?? 'Psicotécnicos';

  return (
    <Shell titulo={`Psicotécnicos · ${texto}`} ancho>
      <div className="os-encabezado">
        <h1>{texto}</h1>
      </div>
      <div className="os-esqueleto" aria-busy="true" aria-label="Cargando">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="os-esqueleto-fila" />
        ))}
      </div>
    </Shell>
  );
}
