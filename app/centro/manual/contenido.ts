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
      'El enlace abre una pantalla donde escribís la contraseña dos veces y entrás.',
      'La primera vez que entrás, en Inicio te espera una tarjeta para leer las normas de convivencia y aceptarlas. Hasta aceptarlas no podés reservar.',
    ],
    capturas: [
      { archivo: 'entrar.jpg', alt: 'La pantalla de entrar: correo, contraseña y el enlace "¿Olvidaste tu contraseña?".', ancho: 600 },
      { archivo: 'olvidaste.jpg', alt: 'El pedido del enlace: se escribe el correo y se toca "Mandarme el enlace".', ancho: 600 },
      { archivo: 'clave.jpg', alt: 'La pantalla del enlace: se escribe la contraseña, se repite y se toca "Guardar y entrar".', ancho: 600 },
    ],
  },
  {
    id: 'inicio',
    titulo: 'Inicio',
    parrafos: [
      'Inicio tiene tres columnas: Hoy, Mañana y Próximos días.',
      'En Hoy aparece cada paciente anotado con su hora y su sala. El circulito de la derecha marca si vino: un toque lo pone en verde, otro en rojo, otro lo vuelve a vaciar.',
      'Las horas reservadas que todavía no tienen paciente aparecen como "Sin anotar", con un botón que te lleva a Turnos.',
      'Debajo de los turnos van los avisos: normas por aceptar, el mes a pagar, la pregunta de renovación y los turnos que quedaron sin sala.',
      'Los turnos que ya pasaron quedan al final, en gris.',
    ],
    capturas: [
      { archivo: 'inicio.jpg', alt: 'Inicio: la columna Hoy con los pacientes del día y las horas sin anotar, Mañana vacía y los Próximos días.' },
    ],
  },
  {
    id: 'reservar',
    titulo: 'Reservar',
    parrafos: [
      'En Reservar ves las semanas que quedan del mes, con las tres salas por día o una sola.',
      'Tocá la hora donde querés empezar. Con el mouse arrastrá hasta la última; en el teléfono elegís hasta cuándo en la burbuja. Antes de confirmar ves cuánto sale.',
      'Lo blanco está libre. Lo verde es tuyo. Lo gris está ocupado por otra persona o ya pasó, y lo rayado es el Centro cerrado.',
      'El mes que viene se abre el día 1: hasta fin de mes renuevan quienes tienen horas fijas, y recién ahí se sabe qué queda libre.',
      'Toda hora reservada se cobra, aunque no la uses.',
    ],
    capturas: [
      { archivo: 'reservar.jpg', alt: 'Reservar: dos semanas con las tres salas por día y las horas de 8 a 20; las propias en verde, las ocupadas en gris, y la leyenda al pie.' },
    ],
  },
  {
    id: 'soltar',
    titulo: 'Soltar una hora',
    parrafos: [
      'Tocá una hora tuya en Reservar: se abre una burbuja con el día, las horas, el precio y el botón "Soltar la hora".',
      `Podés soltar una reserva hasta ${DIAS_PARA_SOLTAR} días antes. Queda como crédito para el mes siguiente.`,
      `El tope es de ${HORAS_LIBERABLES} horas por mes. Se suelta la reserva entera, así que una reserva de más horas que el tope no se puede soltar.`,
      `Si te equivocaste al reservar, tenés ${MINUTOS_PARA_DESHACER} minutos para deshacerla sin condiciones: se borra el cargo y no cuenta para el tope.`,
      'Una hora soltada fuera de plazo se cobra igual y queda marcada en tu cuenta.',
    ],
    capturas: [
      { archivo: 'soltar.jpg', alt: 'La burbuja de una hora propia: sala, día, horario, precio, las condiciones para soltar y el botón "Soltar la hora".', ancho: 460 },
    ],
  },
  {
    id: 'precio',
    titulo: 'Cuánto sale',
    parrafos: [
      'El precio por hora depende de la sala y de las horas fijas por semana que tenés contratadas.',
      'Hay tramos de 1, 4, 8, 12 y 16 horas semanales. Se paga el precio del último tramo que alcanzás: con 10 horas fijas, el de 8.',
      'Una hora suelta se cobra a precio de hora suelta, tengas o no horas fijas: 1 hora al precio del tramo de 1 a 3, 6 seguidas al precio de 4 a 7. Sumar sueltas no cambia el precio de tus horas fijas.',
      'La escala vigente está en Documentos, dentro de las normas, y en Reservar la ves al elegir las horas.',
    ],
    capturas: [
      { archivo: 'precio.jpg', alt: 'La tabla de precios de las normas: el precio por hora de cada consultorio según las horas fijas por semana.', ancho: 720 },
    ],
  },
  {
    id: 'pagar',
    titulo: 'Pagar',
    parrafos: [
      'El alquiler se abona por adelantado, del 1 al 10 del mes que usás.',
      'Del 11 al 20 lleva un recargo del 15 %. Después del 20, del 25 %.',
      'En Mi cuenta ves cada hora del mes con su día, sala y precio. Al pie están los pagos registrados, el recargo que corresponde al día de hoy y el saldo a pagar.',
      'Si debés un mes anterior, aparece arriba en rojo y va antes que el mes en curso.',
      'Se paga en efectivo o por transferencia a la cuenta que figura debajo de la tabla. Cuando transferís, dejá el comprobante en la misma pantalla.',
      'Cuando se registra tu pago, aparece en Mi cuenta con el recibo. La pestaña Meses anteriores guarda la historia.',
    ],
    capturas: [
      { archivo: 'cuenta.jpg', alt: 'Mi cuenta: la deuda del mes anterior en rojo, las horas del mes con su precio, los pagos, el recargo del día y el saldo a pagar hoy.' },
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
      { archivo: 'renovar.jpg', alt: `Inicio desde el ${DIA_DE_RENOVAR}: la pregunta de si renovás el mes que viene, con Sí, No y Editar horas.`, ancho: 360 },
    ],
  },
  {
    id: 'turnos',
    titulo: 'Turnos',
    parrafos: [
      'Turnos es la agenda de tu consulta sobre las horas que reservaste. Se ve por semana o por mes.',
      'Cada hora reservada es una pastilla: azul con el nombre de quien atendés, verde si está libre. Tocala y escribí el nombre; se guarda con Enter o al salir. La cruz del desplegable borra el turno.',
      'Al escribir, el desplegable te sugiere tus pacientes. Si elegís uno, el turno queda atado a su ficha y el ícono de la izquierda la abre.',
      'Las horas rayadas son tus horas fijas del mes que viene: ya podés anotar turnos, y se confirman el día 1 cuando se renueva el mes.',
      'Un turno en rojo quedó sin sala: la hora se soltó o el mes no se renovó. Inicio también lo avisa.',
      'Lo que no está reservado se ve en gris y no admite turnos: primero se reserva la hora en Reservar.',
    ],
    capturas: [
      { archivo: 'turnos-semana.jpg', alt: 'Turnos por semana: cinco columnas con las horas de 8 a 20; las reservadas en azul con el paciente o en verde si están libres.' },
      { archivo: 'turnos-mes.jpg', alt: 'Turnos por mes: la grilla del mes con las horas reservadas de cada día.' },
    ],
  },
  {
    id: 'pacientes',
    titulo: 'Pacientes',
    parrafos: [
      'Pacientes son las fichas de tu consulta. La lista se busca por apellido, nombre o teléfono, y el ícono verde abre WhatsApp.',
      'Se da de alta con nombre, apellido y teléfono. Un paciente que dejó de venir se pasa a inactivo con el interruptor: baja al final de la lista y deja de sugerirse en Turnos.',
      'La ficha tiene tres pestañas. En Ficha van los datos y los antecedentes; cada campo se guarda al salir de él.',
      'En Historia clínica anotás una entrada por consulta, con fecha y texto. Cada entrada se puede editar o borrar.',
      'En Pagos cargás el costo de la consulta y marcás, turno por turno, si te pagó. Arriba ves lo cobrado y lo pendiente.',
      'Lo que anotás en Turnos y Pacientes lo ves solo vos. El Centro no accede.',
    ],
    capturas: [
      { archivo: 'pacientes.jpg', alt: 'La lista de pacientes: nombre, WhatsApp, cuántas consultas tuvo y el interruptor de activo; los inactivos al final.' },
      { archivo: 'paciente.jpg', alt: 'La pestaña Ficha de un paciente: datos y antecedentes, con el botón para volver a Pacientes.' },
      { archivo: 'historia.jpg', alt: 'La pestaña Historia clínica: la fecha y el texto de la consulta nueva, y debajo las anteriores.' },
      { archivo: 'pagos.jpg', alt: 'La pestaña Pagos: el costo de la consulta, lo cobrado y lo pendiente, y cada turno con su interruptor de pagó.' },
    ],
  },
  {
    id: 'documentos',
    titulo: 'Documentos',
    parrafos: [
      'En Documentos están las normas de convivencia, con la tabla de precios, y este manual.',
      'Cuando las normas cambian, Inicio te avisa y al pie de las normas aparece el botón para aceptarlas. Hasta aceptarlas no podés reservar.',
    ],
    capturas: [
      { archivo: 'documentos.jpg', alt: 'Documentos: las pestañas Normas y Manual, con las normas de convivencia abiertas.' },
    ],
  },
];
