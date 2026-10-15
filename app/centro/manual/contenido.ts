/**
 * El manual del inquilino: cómo se usa el sistema y qué reglas hace cumplir.
 *
 * Es texto, no datos: se edita acá y sale publicado con el sitio. Los números
 * (días para soltar, tope de horas, minutos para deshacer) se leen de las
 * constantes del motor, así el manual no puede decir una cosa y el sistema
 * hacer otra.
 */
import {
  DIAS_PARA_SOLTAR,
  HORAS_LIBERABLES,
  MINUTOS_PARA_DESHACER,
} from '@/lib/consultorios-calculo';
import { HORAS_DEL_ENLACE } from '@/lib/centro-acceso';
import { DIA_DE_RENOVAR } from '@/lib/renovaciones';

export type Captura = {
  /** Archivo en `public/centro/manual/`. Son pantallas de la cuenta de prueba de Agustín: nada de otra persona. */
  archivo: string;
  /** Qué muestra, para quien no la ve. */
  alt: string;
  /** Ancho máximo en píxeles, para una captura chica (una tarjeta) que no
   *  tiene que estirarse al ancho de la hoja. */
  ancho?: number;
};

export type Seccion = {
  id: string;
  titulo: string;
  /** Cada párrafo es un renglón corto. */
  parrafos: string[];
  /** Las pantallas de las que habla la sección, después del texto. */
  capturas?: Captura[];
};

export const SECCIONES: Seccion[] = [
  {
    id: 'entrar',
    titulo: 'Entrar',
    parrafos: [
      'Se entra con tu correo y una contraseña que elegís vos.',
      `Para elegirla, o si te la olvidaste, tocá "¿Olvidaste tu contraseña?" en la pantalla de entrar. Te llega un correo con un enlace que vale ${HORAS_DEL_ENLACE} horas y se usa una sola vez.`,
      'La primera vez que entrás, en Inicio te espera una tarjeta para leer las normas de convivencia y aceptarlas. Hasta aceptarlas no podés reservar. Ahí también está el enlace a este manual.',
    ],
    capturas: [
      { archivo: 'entrar.jpg', alt: 'La pantalla de entrar: correo, contraseña y el enlace "¿Olvidaste tu contraseña?".' },
      { archivo: 'olvidaste.jpg', alt: 'El pedido del enlace: se escribe el correo y se toca "Mandarme el enlace".' },
      { archivo: 'clave.jpg', alt: 'La pantalla del enlace: se elige la contraseña y se repite.' },
    ],
  },
  {
    id: 'reservar',
    titulo: 'Reservar',
    parrafos: [
      'En Reservar ves las próximas semanas, con las salas una al lado de la otra o una sola.',
      'Tocá la hora donde querés empezar y arrastrá hasta la hora donde terminás. Antes de confirmar ves cuánto sale.',
      'Lo que está en gris ya está tomado o el Centro está cerrado.',
      'Toda hora reservada se cobra, aunque no la uses.',
    ],
    capturas: [
      { archivo: 'reservar.jpg', alt: 'Reservar: la semana con las tres salas por día y las horas de 8 a 20; lo gris está tomado o cerrado.' },
    ],
  },
  {
    id: 'soltar',
    titulo: 'Soltar una hora',
    parrafos: [
      `Podés soltar una hora reservada hasta ${DIAS_PARA_SOLTAR} días antes. Queda como crédito para el mes siguiente.`,
      `El tope es de ${HORAS_LIBERABLES} horas por mes.`,
      `Si te equivocaste al reservar, tenés ${MINUTOS_PARA_DESHACER} minutos para deshacerla sin condiciones: se borra el cargo y no cuenta para el tope.`,
      'Una hora soltada fuera de plazo se cobra igual y queda marcada en tu cuenta.',
    ],
  },
  {
    id: 'precio',
    titulo: 'Cuánto sale',
    parrafos: [
      'El precio por hora depende de la sala y de las horas fijas por semana que tenés contratadas.',
      'Hay tramos de 1, 4, 8, 12, 16 y 20 horas semanales. Se paga el precio del último tramo que alcanzás: con 10 horas fijas, el de 8.',
      'Una hora suelta se cobra a precio de hora suelta, tengas o no horas fijas: 1 hora al precio del tramo de 1 a 3, 6 seguidas al precio de 4 a 7. Sumar sueltas no cambia el precio de tus horas fijas.',
      'La escala vigente se ve en Reservar, al elegir las horas.',
    ],
  },
  {
    id: 'pagar',
    titulo: 'Pagar',
    parrafos: [
      'El alquiler se abona por adelantado, del 1 al 10 del mes que usás.',
      'Del 11 al 20 lleva un recargo del 15 %. Después del 20, del 25 %.',
      'En Mi cuenta ves cada hora usada con su día, sala y precio, lo que pagaste y el saldo, con los tres plazos ya calculados.',
      'Cuando se registra tu pago, aparece en Inicio y en Mi cuenta, con el recibo.',
    ],
    capturas: [
      { archivo: 'cuenta.jpg', alt: 'Mi cuenta: el mes con lo que se debe y su recargo, las horas usadas, los plazos y cómo se paga.' },
      { archivo: 'inicio.jpg', alt: 'Inicio: lo de hoy, lo de mañana y los próximos días, con el aviso del mes a pagar.' },
    ],
  },
  {
    id: 'renovar',
    titulo: 'Renovar el mes',
    parrafos: [
      `A partir del ${DIA_DE_RENOVAR} de cada mes, en Inicio te preguntamos si seguís con las mismas horas el mes que viene.`,
      'Podés seguir igual, cambiar las horas o avisar que no seguís, hasta el último día del mes.',
      'Si no contestás, seguís con las mismas horas: el día 1 se generan las reservas y el cargo del mes.',
      'Los feriados el Centro cierra y no se reservan ni se cobran. Si querés usar la sala un feriado, lo elegís al renovar.',
    ],
    capturas: [
      { archivo: 'renovar.jpg', alt: 'Inicio desde el 25: la pregunta de si renovás el mes que viene, con Sí, No y Editar horas.', ancho: 360 },
    ],
  },
  {
    id: 'consulta',
    titulo: 'Mis turnos y Pacientes',
    parrafos: [
      'Mis turnos es la agenda de tu consulta adentro de las horas que reservaste: un renglón por hora, con la sala.',
      'Escribí en cada hora a quién atendés y una nota si querés. Se guarda al salir del campo o con Enter. Borrar el nombre borra el turno.',
      'Lo que no está reservado no aparece: primero se reserva la hora en Reservar.',
      'Pacientes son las fichas de tu consulta: datos, antecedentes e historia clínica. Se da de alta con nombre, apellido y teléfono; el resto se completa adentro y se guarda al salir de cada campo.',
      'La historia clínica es una entrada por consulta, con fecha y texto. Cada entrada se puede editar o borrar.',
      'Si en Mis turnos escribís el nombre tal como está en la ficha, el turno queda atado a ella y desde la agenda abrís la historia.',
      'Lo que anotás en Mis turnos y Pacientes lo ves solo vos. El Centro no accede, ni siquiera desde el OS.',
    ],
    capturas: [
      { archivo: 'turnos.jpg', alt: 'Mis turnos: un renglón por hora reservada, con la sala, el paciente, el ícono de su ficha y la nota.' },
      { archivo: 'paciente.jpg', alt: 'La ficha de un paciente: datos, antecedentes y la historia clínica por consulta.' },
    ],
  },
];
