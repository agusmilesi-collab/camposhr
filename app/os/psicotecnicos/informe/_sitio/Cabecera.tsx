import type { Informe } from '@/lib/informe';
import { Encabezado, Marca } from '../_doc/Marco';

/**
 * Quién es, para qué puesto y quién lo pidió.
 *
 * Abre el informe en las dos pantallas: en el portal, arriba de todo; en la
 * ficha, arriba de las secciones. Son los datos que fechan el informe y lo atan
 * a una búsqueda.
 *
 * **Es la misma cabecera del documento**, con su marca y su lista de datos: el
 * informe se lee en pantalla y se descarga en PDF, y no tiene por qué abrir de
 * dos maneras distintas.
 */
export default function Cabecera({ inf }: { inf: Informe }) {
  return (
    <header className="sitio-cabecera">
      <Marca />
      <Encabezado inf={inf} />
    </header>
  );
}
