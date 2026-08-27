/**
 * El nombre de una empresa como parte de una dirección.
 *
 * Es también la clave con la que la base impide dos veces el mismo cliente, así
 * que quien da de alta una empresa (la pantalla de Clientes, el alta de pedido,
 * el embudo) tiene que calcularlo igual. Vivía escrito adentro de la ruta de
 * clientes y el que quisiera crear una empresa desde otro lado lo copiaba.
 */
export function slugDeEmpresa(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
