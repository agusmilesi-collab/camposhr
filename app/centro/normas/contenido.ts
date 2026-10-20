/**
 * El compromiso y normas de convivencia del Centro Integral Santiago.
 *
 * Nace del documento que se firmaba en papel (marzo de 2024) y se actualizó en
 * octubre de 2026 con lo que el sistema hace cumplir: reservas por el sistema,
 * soltar y deshacer, pago del mes siguiente, feriados y renovación. Los
 * números salen de las constantes del motor, así las normas no pueden decir
 * una cosa y el sistema hacer otra.
 *
 * Cuando el texto cambie, se sube `NORMAS_VERSION` en `lib/centro-acceso.ts`
 * y se cambia `NORMAS_FECHA`: queda registrado qué versión aceptó cada uno.
 */
import {
  DIAS_PARA_SOLTAR,
  HORAS_LIBERABLES,
  MINUTOS_PARA_DESHACER,
} from '@/lib/consultorios-calculo';
import { DIA_DE_RENOVAR } from '@/lib/renovaciones';

export const NORMAS_FECHA = 'Octubre de 2026';

export type Bloque = {
  id: string;
  titulo: string;
  /** Cada ítem es una norma. */
  items: string[];
};

export const NORMAS: Bloque[] = [
  {
    id: 'empezar',
    titulo: 'Antes de empezar',
    items: [
      'Antes de usar el Centro se entrega constancia actualizada de matrícula profesional y copia del DNI. Mientras la matrícula no esté cargada en el sistema, no se puede reservar.',
      'La llave la entregan las propietarias. Está prohibido hacer copias.',
      'Las normas se aceptan en el sistema, desde Inicio, al entrar por primera vez y de nuevo cada vez que se actualizan. Hasta aceptarlas no se puede reservar. Queda registrado quién aceptó qué versión y cuándo, en lugar de la firma en papel.',
    ],
  },
  {
    id: 'reservas',
    titulo: 'Reservas',
    items: [
      'Las reservas se hacen en el sistema (centro.camposhr.com), no por mensaje. El calendario es la constancia de qué hora es de quién.',
      'Se usa solamente la sala reservada, en el horario reservado. Sin reserva no se usa ningún consultorio ni el SUM.',
      'Las reservas son siempre a nombre del profesional que las hace. No se cede el espacio, total ni parcialmente, gratis ni a cambio de dinero, ni se subalquila.',
      `Una hora reservada se puede soltar hasta ${DIAS_PARA_SOLTAR} días antes y queda como crédito para el mes siguiente, con un tope de ${HORAS_LIBERABLES} horas por mes. Fuera de ese plazo, la hora se cobra igual.`,
      `Una reserva hecha por error se puede deshacer dentro de los ${MINUTOS_PARA_DESHACER} minutos, sin cargo y sin contar para el tope.`,
      'Los feriados el Centro cierra: no se reservan ni se cobran. Quien quiera usar la sala un feriado lo elige al renovar el mes.',
      `A partir del ${DIA_DE_RENOVAR} de cada mes, el sistema pregunta en Inicio si se sigue con las mismas horas el mes siguiente. Se puede seguir igual, cambiar las horas o avisar que no se sigue, hasta el último día del mes. Quien no contesta sigue con las mismas horas: el día 1 se generan las reservas y el cargo del mes.`,
    ],
  },
  {
    id: 'precio-y-pago',
    titulo: 'Precio y pago',
    items: [
      'Se abona por hora reservada siempre, sin excepciones, en consultorios y SUM. Si el paciente, consultante o cliente no acudió, el profesional abona de todos modos.',
      'Cuantas más horas fijas por semana contratás, más barata sale cada hora. Los tramos son de 1 a 3, de 4 a 7, de 8 a 11, de 12 a 15 y de 16 o más horas por semana. Tus horas fijas te ubican en un tramo, y todas se cobran al precio de ese tramo en la sala que usás. Ejemplo: con 10 horas fijas pagás cada hora al precio del tramo de 8 a 11.',
      'Una hora suelta se cobra a precio de hora suelta, tengas o no horas fijas: según cuántas horas seguidas reservás ese día. 1 hora, al precio del tramo de 1 a 3; 5 horas seguidas, al precio del tramo de 4 a 7. Las horas sueltas no cambian el precio de tus horas fijas ni suman para cambiar de tramo.',
      'Los valores se actualizan cuatro veces al año, en enero, abril, julio y octubre, según la inflación. Cada reserva conserva el precio que tenía al hacerse.',
      'Cada mes se paga por adelantado, del 1 al 10 del mismo mes. Entre el 11 y el 20 lleva un 15 % de recargo; del 21 en adelante, un 25 %. El sistema muestra el importe al día y cuánto pasa a costar después de cada plazo.',
      'Se paga en efectivo o por transferencia bancaria. Al transferir, el comprobante se deja en Mi cuenta. Los datos bancarios se solicitan a las propietarias.',
    ],
  },
  {
    id: 'ingreso',
    titulo: 'Ingreso y seguridad',
    items: [
      'Al Centro se ingresa solamente en los horarios reservados, con puntualidad. De llegar antes, se espera en la sala de espera o en la cocina. Para entrar en otro horario, consultarlo con las propietarias.',
      'La puerta principal se cierra con llave siempre, cada vez que ingresa alguien, para la seguridad de todos los que trabajamos y de los pacientes.',
      'Cada consultorio tiene un timbre independiente. Avisar al paciente o cliente que toque solamente el timbre del espacio reservado.',
      'Está prohibido el ingreso de bicicletas al Centro. Hay estacionamientos a la redonda.',
      'Los impuestos o folletos que aparezcan en la puerta de entrada se dejan en la mesada de la cocina.',
    ],
  },
  {
    id: 'durante',
    titulo: 'Cuidado del espacio durante el uso',
    items: [
      'Cuidar el equipamiento: aire acondicionado siempre en 24 grados, pava eléctrica, portero eléctrico, sillas, sillones, mesas y escritorios.',
      'Al mover sillas, escritorio o camilla, cuidar de no rayar pisos ni paredes. Con fibrones y biromes, cuidar las mesas.',
      'Mantener cerradas las puertas de baños, consultorios, SUM y kitchenette.',
      'En los baños, los papeles y apósitos van al tacho de basura. Recordárselo a los pacientes: de lo contrario el baño puede quedar inutilizable.',
      'El Centro provee infusiones (yerba, té, mate cocido, café) para los profesionales. Si se ofrecen a los pacientes, las abastece el profesional.',
      'Si algo no funciona o tiene un desperfecto, comunicarlo a las propietarias.',
    ],
  },
  {
    id: 'retirarse',
    titulo: 'Al retirarse',
    items: [
      'Dejar el espacio limpio y ordenado, con los artefactos apagados y desenchufados. En la kitchenette hay elementos de limpieza.',
      'Lavar la vajilla y los utensilios usados y dejarlos limpios en la kitchenette.',
      'La yerba del mate y los desperdicios perecederos (cáscaras, potes de yogur) van siempre al cesto de la cocina. Si el cesto está lleno, sacar la bolsa: hay contenedores en la esquina de calle Mendoza y en la de calle 3 de Febrero.',
      'Quien se retira último apaga todas las luces del Centro (pasillos, salas de espera, baños, ingreso), el aire acondicionado y el equipo de música de la sala de espera. No dar por hecho que después viene otro profesional.',
    ],
  },
  {
    id: 'propio',
    titulo: 'Objetos propios, mejoras e incumplimiento',
    items: [
      'Los utensilios propios que se dejen deben quedar limpios y ordenados. El Centro no se responsabiliza por lo que se deje.',
      'Los elementos de trabajo que se dejen (desde insumos hasta maquinarias) quedan bajo la exclusiva responsabilidad del profesional: ni el Centro ni sus propietarias responden por roturas o pérdidas. Se recomienda asegurarlos, a costo del profesional.',
      'No se introducen mejoras en el Centro sin el consentimiento expreso de las propietarias. De autorizarse, el profesional restituye el estado anterior o las mejoras quedan a beneficio del inmueble sin cargo para las propietarias.',
      'El incumplimiento de cualquiera de estos puntos da derecho a las propietarias a dar por rescindido el alquiler del espacio.',
      'El profesional no guarda con las propietarias relación laboral bajo su dependencia.',
    ],
  },
];
