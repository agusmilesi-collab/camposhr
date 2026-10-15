/**
 * El enlace de WhatsApp para un teléfono escrito a mano, con la convención de
 * la Argentina: wa.me espera el número internacional sin signos, y para un
 * celular argentino va 54, un 9, el código de área sin el 0 y el número sin
 * el 15. Devuelve null si no parece un teléfono.
 */
export function enlaceWhatsapp(telefono: string | null | undefined): string | null {
  let d = (telefono ?? '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('54')) {
    d = d.slice(2);
    if (d.startsWith('9')) d = d.slice(1);
  }
  if (d.startsWith('0')) d = d.slice(1);
  if (d.length < 8 || d.length > 12) return null;
  return `https://wa.me/549${d}`;
}
