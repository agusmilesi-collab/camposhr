/**
 * La batería de una evaluación, en un sello.
 *
 * "Batería 1" ocupaba una columna entera para decir un número, y en una tabla
 * donde todas las filas dicen lo mismo el ojo no distingue una de otra. El
 * código corto con su punto de color se reconoce sin leerlo: azul la básica,
 * violeta la estándar, verde la ejecutiva, que es el orden en que crecen.
 *
 * El Benziger va pegado al mismo sello y no en columna aparte: no está en
 * ninguna batería, lo agrega el pedido, y saberlo cambia lo que hay que
 * administrar en la entrevista. Va en azul y en negrita porque es la excepción,
 * y una excepción que no se ve no sirve de nada.
 */

const CORTO: Record<string, string> = {
  'Batería 1': 'B1',
  'Batería 2': 'B2',
  'Batería 3': 'B3',
};

const COLOR: Record<string, string> = {
  'Batería 1': 'os-azul',
  'Batería 2': 'os-violeta',
  'Batería 3': 'os-verde',
};

export default function Bateria({
  codigo,
  conBenziger = false,
}: {
  codigo: string | null;
  conBenziger?: boolean;
}) {
  if (!codigo) return <span className="os-tabla-flojo">a definir</span>;
  // Una batería que no esté en la lista se muestra tal cual: es preferible un
  // sello largo a esconder que hay una batería nueva sin código corto.
  const corto = CORTO[codigo] ?? codigo;
  const color = COLOR[codigo] ?? 'os-gris';
  return (
    <span className={`os-sello-estado os-bateria ${color}`} title={codigo}>
      {corto}
      {conBenziger && <b className="os-bateria-mas">+ bzg</b>}
    </span>
  );
}
