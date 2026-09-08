import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { revalidateTag } from 'next/cache';
import { COOKIE, hayPuerta, huella, igual } from '@/lib/os-sesion';
import { quienSoy } from '@/lib/identidad';
import { anotarAcceso } from '@/lib/accesos';
import { insert, patch } from '@/lib/supabase';
import { HORAS_DEL_ENLACE, tokenDeAlta } from '@/lib/centro-acceso';
import {
  DIAS_CORTOS,
  contratos as leerContratos,
  cotizar,
  escalaVigente,
  hora,
  horasSemanalesTotales,
  listarEspacios,
  aperturas as leerAperturas,
  periodoDe,
  RUBROS,
} from '@/lib/consultorios';

export const runtime = 'nodejs';

/**
 * Lo que se puede mover de los consultorios sin tocar el código: qué incluye
 * cada sala, si está activa, la escala de precios y los cierres.
 *
 * Una sola ruta con `accion` adentro, porque son cambios de configuración de la
 * misma pantalla y separarlos en cinco rutas repetiría cinco veces la sesión,
 * el registro de acceso y la invalidación del caché.
 *
 * **La escala nueva no pisa la anterior.** Se guarda entera con su fecha de
 * vigencia, y las reservas ya cobradas conservan el importe que congelaron. Es
 * lo que hace que las cuatro actualizaciones del año no reescriban la historia.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^\d{2}:\d{2}(:\d{2})?$/;

async function conSesion(): Promise<boolean> {
  if (!hayPuerta()) return true;
  const clave = process.env.OS_CLAVE as string;
  const cookie = cookies().get(COOKIE)?.value;
  return Boolean(cookie && igual(cookie, await huella(clave)));
}

function mal(motivo: string, status = 400) {
  return NextResponse.json({ ok: false, motivo }, { status });
}

export async function POST(req: Request) {
  if (!(await conSesion())) return mal('Sin sesión.', 401);

  const datos = await req.json().catch(() => null);
  const accion = datos?.accion;
  const yo = await quienSoy();
  // Lo que la pantalla necesita de vuelta, hoy solo el id de un alta.
  let extra: Record<string, unknown> = {};

  try {
    switch (accion) {
      case 'incluye-agregar': {
        const espacioId = String(datos?.espacioId ?? '');
        const texto = String(datos?.texto ?? '').trim();
        if (!UUID.test(espacioId)) return mal('Espacio inválido.');
        if (texto.length === 0) return mal('Falta qué incluye.');
        const orden = Number(datos?.orden ?? 0);
        await insert('espacio_incluye', { espacio_id: espacioId, texto, orden });
        break;
      }

      case 'incluye-quitar': {
        const id = String(datos?.id ?? '');
        if (!UUID.test(id)) return mal('Elemento inválido.');
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_KEY as string;
        const res = await fetch(`${url}/rest/v1/espacio_incluye?id=eq.${id}`, {
          method: 'DELETE',
          headers: { apikey: key, Authorization: `Bearer ${key}` },
          cache: 'no-store',
        });
        if (!res.ok) return mal(`Supabase respondió ${res.status}.`);
        break;
      }

      case 'espacio-activo': {
        const id = String(datos?.id ?? '');
        if (!UUID.test(id)) return mal('Espacio inválido.');
        await patch('espacios', `id=eq.${id}`, { activo: Boolean(datos?.activo) });
        break;
      }

      case 'escala-nueva': {
        const desde = String(datos?.desde ?? '');
        const filas = datos?.filas;
        if (!FECHA.test(desde)) return mal('Falta desde cuándo rige.');
        if (!Array.isArray(filas) || filas.length === 0) return mal('La escala vino vacía.');
        const limpias = filas.map((f: Record<string, unknown>) => ({
          espacio_id: String(f.espacioId),
          horas_semana_desde: Number(f.horas),
          precio_hora: Number(f.precio),
          desde,
        }));
        if (limpias.some((f) => !UUID.test(f.espacio_id))) return mal('Sala inválida.');
        if (limpias.some((f) => !Number.isFinite(f.precio_hora) || f.precio_hora <= 0))
          return mal('Todos los precios tienen que ser números mayores a cero.');
        if (limpias.some((f) => !Number.isInteger(f.horas_semana_desde) || f.horas_semana_desde < 1))
          return mal('Los tramos tienen que ser horas enteras.');

        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_KEY as string;
        // Volver a guardar la misma fecha corrige esa escala en vez de fallar:
        // es lo que pasa cuando el porcentaje se cargó mal y se rehace en el
        // momento.
        const res = await fetch(
          `${url}/rest/v1/tarifas?on_conflict=espacio_id,horas_semana_desde,desde`,
          {
            method: 'POST',
            headers: {
              apikey: key,
              Authorization: `Bearer ${key}`,
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates,return=minimal',
            },
            body: JSON.stringify(limpias),
            cache: 'no-store',
          }
        );
        if (!res.ok) return mal(`Supabase respondió ${res.status}: ${await res.text()}`);
        break;
      }

      case 'precio-uno': {
        const espacioId = String(datos?.espacioId ?? '');
        const horas = Number(datos?.horas);
        const precio = Number(datos?.precio);
        const desde = String(datos?.desde ?? '');
        if (!UUID.test(espacioId)) return mal('Sala inválida.');
        if (!Number.isInteger(horas) || horas < 1) return mal('El tramo va en horas enteras.');
        if (!Number.isFinite(precio) || precio <= 0) return mal('El precio tiene que ser mayor a cero.');
        if (!FECHA.test(desde)) return mal('Falta desde cuándo rige.');
        // Cambia la escala que ya rige, así que vale desde la próxima reserva.
        // Lo cobrado antes conserva el importe que congeló en su fila.
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_KEY as string;
        const res = await fetch(
          `${url}/rest/v1/tarifas?on_conflict=espacio_id,horas_semana_desde,desde`,
          {
            method: 'POST',
            headers: {
              apikey: key,
              Authorization: `Bearer ${key}`,
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates,return=minimal',
            },
            body: JSON.stringify({
              espacio_id: espacioId,
              horas_semana_desde: horas,
              precio_hora: precio,
              desde,
            }),
            cache: 'no-store',
          }
        );
        if (!res.ok) return mal(`Supabase respondió ${res.status}: ${await res.text()}`);
        break;
      }

      case 'horario': {
        const espacioId = datos?.espacioId ? String(datos.espacioId) : null;
        const desdeHora = String(datos?.desdeHora ?? '');
        const hastaHora = String(datos?.hastaHora ?? '');
        if (espacioId && !UUID.test(espacioId)) return mal('Sala inválida.');
        if (!HORA.test(desdeHora) || !HORA.test(hastaHora)) return mal('Las horas van como 08:00.');
        if (hastaHora <= desdeHora) return mal('La hora de cierre va después de la de apertura.');

        // Sin sala: todas. Es el caso normal, porque el Centro abre parejo, y
        // por sala existe para la excepción.
        const espacios = await listarEspacios();
        const cuales = espacioId ? espacios.filter((e) => e.id === espacioId) : espacios;
        if (cuales.length === 0) return mal('No hay ninguna sala.');

        /*
         * Qué días abre. Sin la lista, todos los que hoy tenga cargados: así
         * cambiar la hora de cierre no reabre un sábado que estaba cerrado.
         *
         * Un día que se saca **borra su fila** y no la deja con horario cero:
         * la grilla lee "no hay apertura para ese día" como cerrado, y una fila
         * con desde igual a hasta pasaría por abierta con cero horas.
         */
        const dias: number[] | null = Array.isArray(datos?.dias)
          ? [...new Set((datos.dias as unknown[]).map(Number))].filter(
              (d) => Number.isInteger(d) && d >= 0 && d < DIAS_CORTOS.length
            )
          : null;
        if (dias && dias.length === 0) return mal('El Centro tiene que abrir algún día.');

        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_KEY as string;
        const cabeceras = { apikey: key, Authorization: `Bearer ${key}` };

        if (dias) {
          const fuera = DIAS_CORTOS.map((_, d) => d).filter((d) => !dias.includes(d));
          for (const e of cuales) {
            if (fuera.length === 0) continue;
            const res = await fetch(
              `${url}/rest/v1/apertura?espacio_id=eq.${e.id}&dia_semana=in.(${fuera.join(',')})`,
              { method: 'DELETE', headers: cabeceras, cache: 'no-store' }
            );
            if (!res.ok) return mal(`Supabase respondió ${res.status}: ${await res.text()}`);
          }
        }

        const aperturasDeHoy = dias ? null : await leerAperturas();
        const filas = cuales.flatMap((e) => {
          const cuales2 = dias ?? [
            ...new Set((aperturasDeHoy ?? []).filter((a) => a.espacio_id === e.id).map((a) => a.dia_semana)),
          ];
          return cuales2.map((d) => ({
            espacio_id: e.id,
            dia_semana: d,
            desde_hora: desdeHora,
            hasta_hora: hastaHora,
          }));
        });
        if (filas.length > 0) {
          const res = await fetch(`${url}/rest/v1/apertura?on_conflict=espacio_id,dia_semana`, {
            method: 'POST',
            headers: {
              ...cabeceras,
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates,return=minimal',
            },
            body: JSON.stringify(filas),
            cache: 'no-store',
          });
          if (!res.ok) return mal(`Supabase respondió ${res.status}: ${await res.text()}`);
        }
        break;
      }

      case 'cierre-alta': {
        const fechas: string[] = Array.isArray(datos?.fechas)
          ? datos.fechas.map(String)
          : [String(datos?.fecha ?? '')];
        const fecha = fechas[0];
        const motivo = String(datos?.motivo ?? '').trim();
        const espacioId = datos?.espacioId ? String(datos.espacioId) : null;
        const desdeHora = datos?.desdeHora ? String(datos.desdeHora) : null;
        const hastaHora = datos?.hastaHora ? String(datos.hastaHora) : null;
        if (!FECHA.test(fecha)) return mal('Falta la fecha.');
        if (motivo.length === 0) return mal('Falta el motivo.');
        if (espacioId && !UUID.test(espacioId)) return mal('Espacio inválido.');
        if ((desdeHora === null) !== (hastaHora === null))
          return mal('El cierre va con las dos horas o con ninguna.');
        if (desdeHora && (!HORA.test(desdeHora) || !HORA.test(hastaHora as string)))
          return mal('Las horas van en formato 08:00.');
        if (desdeHora && (hastaHora as string) <= desdeHora)
          return mal('La hora de fin va después de la de inicio.');
        if (fechas.length > 60) return mal('Son demasiadas fechas de una vez.');
        for (const f of fechas) {
          if (!FECHA.test(f)) return mal('Alguna fecha vino mal.');
          await insert('cierres', {
            espacio_id: espacioId,
            fecha: f,
            desde_hora: desdeHora,
            hasta_hora: hastaHora,
            motivo,
          });
        }
        extra = { creadas: fechas.length };
        break;
      }

      case 'cierre-baja': {
        const id = String(datos?.id ?? '');
        if (!UUID.test(id)) return mal('Cierre inválido.');
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_KEY as string;
        const res = await fetch(`${url}/rest/v1/cierres?id=eq.${id}`, {
          method: 'DELETE',
          headers: { apikey: key, Authorization: `Bearer ${key}` },
          cache: 'no-store',
        });
        if (!res.ok) return mal(`Supabase respondió ${res.status}.`);
        break;
      }

      case 'inquilino-alta': {
        const nombre = String(datos?.nombre ?? '').trim();
        const correo = String(datos?.correo ?? '').trim().toLowerCase() || null;
        const telefono = String(datos?.telefono ?? '').trim() || null;
        if (nombre.length === 0) return mal('Falta el nombre.');
        if (correo !== null && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo))
          return mal('El correo no parece válido.');
        // Nace sin contraseña y puede nacer sin correo: hay gente que alquila y
        // no va a entrar nunca al sistema. La cuenta corriente y las reservas no
        // dependen de que entre.
        const creado = await insert<{ id: string }>('inquilinos', { nombre, correo, telefono });
        extra = { id: creado.id };
        break;
      }

      case 'inquilino-editar': {
        const id = String(datos?.id ?? '');
        if (!UUID.test(id)) return mal('Inquilino inválido.');
        const cambios: Record<string, unknown> = {};
        if (typeof datos?.nombre === 'string') cambios.nombre = datos.nombre.trim();
        if (typeof datos?.correo === 'string') cambios.correo = datos.correo.trim().toLowerCase();
        if (typeof datos?.telefono === 'string') cambios.telefono = datos.telefono.trim() || null;
        if (typeof datos?.matricula === 'string') cambios.matricula = datos.matricula.trim() || null;
        if (typeof datos?.matriculaVence === 'string')
          cambios.matricula_vence = FECHA.test(datos.matriculaVence) ? datos.matriculaVence : null;
        if (typeof datos?.llaveEntregada === 'boolean') cambios.llave_entregada = datos.llaveEntregada;
        if (typeof datos?.activo === 'boolean') cambios.activo = datos.activo;
        if (Object.keys(cambios).length === 0) return mal('No vino ningún cambio.');
        await patch('inquilinos', `id=eq.${id}`, cambios);
        break;
      }

      case 'inquilino-enlace': {
        const id = String(datos?.id ?? '');
        if (!UUID.test(id)) return mal('Inquilino inválido.');
        // El enlace es de un solo uso y vence a las 48 horas: lo manda una
        // persona por WhatsApp, así que tiene que sobrevivir a que lo lean al
        // otro día, y no más que eso.
        const token = tokenDeAlta();
        const vence = new Date(Date.now() + HORAS_DEL_ENLACE * 3600 * 1000).toISOString();
        await patch('inquilinos', `id=eq.${id}`, { alta_token: token, alta_vence: vence });
        const host = req.headers.get('host') ?? '';
        const base = host.startsWith('localhost')
          ? `http://${host}`
          : 'https://centro.camposhr.com';
        extra = { enlace: `${base}/centro/clave/${token}` };
        break;
      }

      case 'reserva-alta': {
        const espacioId = String(datos?.espacioId ?? '');
        const inquilinoId = String(datos?.inquilinoId ?? '');
        // Una reserva que se repite manda todas sus fechas: la primera y las de
        // las semanas o días siguientes. Sin repetir viene una sola.
        const fechas: string[] = Array.isArray(datos?.fechas)
          ? datos.fechas.map(String)
          : [String(datos?.fecha ?? '')];
        const fecha = fechas[0];
        const desdeHora = String(datos?.desdeHora ?? '');
        const hastaHora = String(datos?.hastaHora ?? '');
        const origen = datos?.origen === 'contrato' ? 'contrato' : 'suelta';
        if (!UUID.test(espacioId)) return mal('Sala inválida.');
        if (!UUID.test(inquilinoId)) return mal('Falta a nombre de quién va la reserva.');
        if (fechas.length === 0 || fechas.some((f) => !FECHA.test(f))) return mal('Falta la fecha.');
        if (fechas.length > 60) return mal('Son demasiadas fechas de una vez.');
        if (!HORA.test(desdeHora) || !HORA.test(hastaHora)) return mal('Las horas van como 08:00.');
        if (hastaHora <= desdeHora) return mal('La hora de fin va después de la de inicio.');

        // El precio se congela acá: una actualización de la escala no vuelve a
        // tocar lo ya reservado.
        const [espacios, escala, todosLosContratos] = await Promise.all([
          listarEspacios(),
          escalaVigente(fecha),
          leerContratos(),
        ]);
        const espacio = espacios.find((e) => e.id === espacioId);
        if (!espacio) return mal('Esa sala no existe.');
        const horas = hora(hastaHora) - hora(desdeHora);
        // El tramo sale del volumen que ya tiene contratado, y nunca es menor
        // al de esta reserva: quien toma cuatro horas sueltas entra en el tramo
        // de cuatro aunque no tenga contrato.
        const tramo = Math.max(horasSemanalesTotales(todosLosContratos, inquilinoId, fecha), horas);
        const cotizacion = cotizar(escala.tarifas, espacio.categoria, tramo);
        const importe = cotizacion ? cotizacion.precioHora * horas : null;

        // Una fecha ocupada no cancela las demás: se guardan las que entran y
        // se avisa cuáles no. Abortando todo por una, había que ir sacando
        // fechas a mano hasta dar con la que chocaba.
        const chocaron: string[] = [];
        let creadas = 0;
        for (const f of fechas) {
          let reserva: { id: string };
          try {
            reserva = await insert<{ id: string }>('reservas', {
              espacio_id: espacioId,
              inquilino_id: inquilinoId,
              fecha: f,
              desde_hora: desdeHora,
              hasta_hora: hastaHora,
              origen,
              importe,
            });
          } catch (e) {
            const texto = e instanceof Error ? e.message : '';
            if (texto.includes('reservas_sin_solape')) {
              chocaron.push(f);
              continue;
            }
            throw e;
          }
          creadas++;

          // La reserva confirmada genera el cargo del mes al que pertenece. Sin
          // precio no hay cargo: es el caso del SUM mientras su tarifa esté sin
          // definir, y la reserva vale igual porque ocupa la sala.
          if (importe !== null) {
            await insert('movimientos', {
              inquilino_id: inquilinoId,
              tipo: 'cargo',
              fecha: f,
              periodo: periodoDe(f),
              importe,
              reserva_id: reserva.id,
              detalle: `${espacio.nombre}, ${desdeHora.slice(0, 5)} a ${hastaHora.slice(0, 5)}`,
              quien: yo.nombre,
            });
          }
        }
        if (creadas === 0) {
          return mal(
            fechas.length === 1
              ? 'Esa hora ya está reservada en esa sala.'
              : 'Todas esas fechas ya estaban reservadas.'
          );
        }
        extra = { creadas, chocaron };
        break;
      }

      case 'reserva-baja': {
        const id = String(datos?.id ?? '');
        const motivo = String(datos?.motivo ?? '').trim();
        const conCredito = Boolean(datos?.credito);
        if (!UUID.test(id)) return mal('Reserva inválida.');
        await patch('reservas', `id=eq.${id}`, { estado: 'liberada' });
        {
          const url = process.env.SUPABASE_URL;
          const key = process.env.SUPABASE_SERVICE_KEY as string;
          const res = await fetch(
            `${url}/rest/v1/movimientos?reserva_id=eq.${id}&tipo=eq.cargo&select=id,importe,periodo,inquilino_id,detalle`,
            { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' }
          );
          const cargos: { id: string; importe: number; periodo: string; inquilino_id: string; detalle: string | null }[] =
            res.ok ? await res.json() : [];

          /*
           * El cargo no se borra: la hora existió y quedó anotada.
           *
           * Con crédito, lo compensa un movimiento nuevo, que es lo que permite
           * el documento de convivencia cuando se suelta con tiempo. Sin
           * crédito, el cargo se queda solo, y entonces hay que decir por qué:
           * en la cuenta del inquilino aparece una hora que ya no está en su
           * calendario, y sin la aclaración parece un error del sistema.
           */
          if (!conCredito) {
            for (const c of cargos) {
              if (c.detalle?.includes('se cobra igual')) continue;
              await patch('movimientos', `id=eq.${c.id}`, {
                detalle: `${c.detalle ?? 'Reserva'} · se liberó fuera de plazo, se cobra igual`,
              });
            }
          }

          if (conCredito)
          for (const c of cargos) {
            await insert('movimientos', {
              inquilino_id: c.inquilino_id,
              tipo: 'credito',
              fecha: new Date().toISOString().slice(0, 10),
              periodo: c.periodo,
              importe: c.importe,
              reserva_id: id,
              detalle: motivo || 'Hora liberada',
              quien: yo.nombre,
            });
          }
        }
        break;
      }

      case 'pago-alta': {
        const inquilinoId = String(datos?.inquilinoId ?? '');
        const fecha = String(datos?.fecha ?? '');
        const periodo = String(datos?.periodo ?? '');
        const importe = Number(datos?.importe);
        const recargo = Number(datos?.recargo ?? 0);
        const detalle = String(datos?.detalle ?? '').trim() || null;
        if (!UUID.test(inquilinoId)) return mal('Inquilino inválido.');
        if (!FECHA.test(fecha)) return mal('Falta la fecha del pago.');
        if (!FECHA.test(periodo)) return mal('Falta el mes que se paga.');
        if (!Number.isFinite(importe) || importe <= 0) return mal('El importe tiene que ser mayor a cero.');
        if (recargo > 0) {
          await insert('movimientos', {
            inquilino_id: inquilinoId,
            tipo: 'recargo',
            fecha,
            periodo,
            importe: recargo,
            detalle: 'Recargo por pago fuera de término',
            quien: yo.nombre,
          });
        }
        await insert('movimientos', {
          inquilino_id: inquilinoId,
          tipo: 'pago',
          fecha,
          periodo,
          importe,
          detalle,
          quien: yo.nombre,
        });
        break;
      }

      case 'gasto-alta': {
        const fecha = String(datos?.fecha ?? '');
        const concepto = String(datos?.concepto ?? '').trim();
        const rubro = String(datos?.rubro ?? '');
        const importe = Number(datos?.importe);
        if (!FECHA.test(fecha)) return mal('La fecha va como 2026-09-01.');
        if (!concepto) return mal('Falta el concepto.');
        if (!RUBROS.includes(rubro as (typeof RUBROS)[number])) return mal('Rubro inválido.');
        if (!Number.isFinite(importe) || importe < 0) return mal('El importe va en números.');
        // El período lo pone el servidor y no la pantalla: es el mes al que el
        // gasto pertenece, y de él sale el resultado del mes.
        await insert('gastos', {
          fecha,
          periodo: String(datos?.periodo ?? '').match(/^\d{4}-\d{2}-\d{2}$/)
            ? datos.periodo
            : periodoDe(fecha),
          concepto,
          rubro,
          importe,
          fijo: datos?.fijo === true,
          quien: yo.nombre,
        });
        break;
      }

      case 'gasto-baja': {
        const id = String(datos?.id ?? '');
        if (!UUID.test(id)) return mal('Gasto inválido.');
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_KEY as string;
        const res = await fetch(`${url}/rest/v1/gastos?id=eq.${id}`, {
          method: 'DELETE',
          headers: { apikey: key, Authorization: `Bearer ${key}` },
          cache: 'no-store',
        });
        if (!res.ok) return mal(`Supabase respondió ${res.status}: ${await res.text()}`);
        break;
      }

      case 'movimiento-baja': {
        const id = String(datos?.id ?? '');
        if (!UUID.test(id)) return mal('Movimiento inválido.');
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_KEY as string;
        const res = await fetch(`${url}/rest/v1/movimientos?id=eq.${id}`, {
          method: 'DELETE',
          headers: { apikey: key, Authorization: `Bearer ${key}` },
          cache: 'no-store',
        });
        if (!res.ok) return mal(`Supabase respondió ${res.status}.`);
        break;
      }

      default:
        return mal('Acción desconocida.');
    }
  } catch (e) {
    return mal(e instanceof Error ? e.message : 'No se pudo guardar.');
  }

  revalidateTag('consultorios');
  await anotarAcceso({
    accion: 'escritura',
    recurso: 'consultorios',
    detalle: { accion, quien: yo.nombre },
  });
  return NextResponse.json({ ok: true, ...extra });
}
