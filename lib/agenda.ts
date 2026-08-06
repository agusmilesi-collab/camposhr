/**
 * El evento que el teléfono agenda con el compromiso de la charla 1.
 *
 * Es un archivo de calendario común: el iPhone lo abre en "Agregar al
 * calendario" y Android en Google Calendar. Nada de esto necesita permisos ni
 * cuenta, y la alarma la pone el propio calendario.
 *
 * El sentido está en el guion: "un plan con hora y lugar se cumple mucho más
 * que una buena intención". El papel se pierde y el mensaje se archiva; el
 * evento aparece solo el día y la hora que la persona eligió.
 */

/** Cuánto dura la pausa en el calendario. */
const MINUTOS = 5;

/**
 * La fecha del próximo día de la semana pedido, a partir de hoy.
 *
 * Si hoy es viernes y eligió el lunes, cae en el lunes siguiente. Si eligió el
 * mismo día de hoy, se va a la semana que viene: la charla ocupa la jornada y
 * el compromiso es para después.
 */
export function proximoDia(dia: number, desde: Date): Date {
  // getDay: 0 domingo, 1 lunes. `dia` viene de 1 (lunes) a 5 (viernes).
  const hoy = desde.getDay();
  let faltan = dia - hoy;
  if (faltan <= 0) faltan += 7;
  const fecha = new Date(desde);
  fecha.setDate(desde.getDate() + faltan);
  return fecha;
}

/** Los caracteres que el formato reserva. */
function escapar(texto: string): string {
  return texto
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function sello(fecha: Date, hora: string): string {
  const dos = (n: number) => String(n).padStart(2, '0');
  const [hh, mm] = hora.split(':');
  return (
    `${fecha.getFullYear()}${dos(fecha.getMonth() + 1)}${dos(fecha.getDate())}` +
    `T${hh}${mm}00`
  );
}

function sumarMinutos(hora: string, minutos: number): string {
  const [hh, mm] = hora.split(':').map(Number);
  const total = (hh * 60 + mm + minutos) % (24 * 60);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dos(Math.floor(total / 60))}:${dos(total % 60)}`;
}

/**
 * El evento, en el formato que entienden los calendarios.
 *
 * La hora va sin zona horaria a propósito: así cada teléfono la interpreta en
 * la suya y las 7:10 son las 7:10 para todos, sin importar dónde esté cargado
 * el servidor que lo genera.
 */
export function eventoDelPlan(opciones: {
  dia: number;
  hora: string;
  texto: string;
  empresa: string;
  desde: Date;
  id: string;
}): string {
  const { dia, hora, texto, empresa, desde, id } = opciones;
  const fecha = proximoDia(dia, desde);
  const fin = sumarMinutos(hora, MINUTOS);

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Campos HR//Liderazgos Humanos//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${id}@camposhr.com`,
    `DTSTAMP:${sello(desde, '00:00')}Z`,
    `DTSTART:${sello(fecha, hora)}`,
    `DTEND:${sello(fecha, fin)}`,
    'SUMMARY:Pausa para meditar',
    `DESCRIPTION:${escapar(texto)}`,
    `LOCATION:${escapar(empresa)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Pausa para meditar',
    'TRIGGER:PT0S',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
