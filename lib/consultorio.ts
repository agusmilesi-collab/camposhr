/**
 * Dónde se toman las entrevistas presenciales. Es lo que dice el evento del
 * calendario y el correo que recibe el candidato.
 */
export const CONSULTORIO = 'Santiago 1269, Rosario';

/**
 * La dirección como se le escribe al candidato, con el timbre que tiene que
 * tocar: es un edificio de consultorios y sin eso se queda en la puerta.
 * `CONSULTORIO` queda sin el timbre para el lugar de los calendarios, que
 * buscan la dirección en el mapa.
 */
export const CONSULTORIO_CON_TIMBRE = 'Santiago 1269 (TIMBRE 5), Rosario';

/**
 * La ficha del consultorio en Google Maps (Centro Integral Santiago): es el
 * botón del correo al candidato. Es el enlace del lugar y no una búsqueda de
 * la dirección, que caía en otro punto de la cuadra.
 */
export const CONSULTORIO_MAPA = 'https://maps.app.goo.gl/Ef62sPwbYcLAsWsW7';
