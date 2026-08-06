import { NextResponse } from 'next/server';
import {
  getEmpresaPorSlug,
  guardarRespuesta,
  listarLideres,
  subirSelfie,
  type Variante,
} from '@/lib/supabase';
import { getAsistente, resolverCiclo } from '@/lib/ciclo';
import { PLACAS } from '@/lib/cuestionario';
import { calcular, PERFILES, type Perfil, type Puntajes } from '@/lib/perfiles';
import { calcularGeneracion, PLACAS_GENERACIONES } from '@/lib/generaciones';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FOTO = 3 * 1024 * 1024; // 3 MB

type RespuestaCruda =
  | { tipo: 'descriptiva'; valor: unknown }
  | { tipo: 'frases'; seleccion: unknown };

function ceros(): Puntajes {
  return { FI: 0, FD: 0, BI: 0, BD: 0 };
}

/**
 * Recalcula el puntaje desde las respuestas crudas. Nunca se confía en lo que
 * manda el navegador: el total que se guarda sale de acá.
 */
function puntuar(respuestas: RespuestaCruda[]) {
  const likert = ceros();
  const checklist = ceros();

  PLACAS.forEach((placa, i) => {
    const cruda = respuestas[i];
    if (!cruda || cruda.tipo !== placa.tipo) {
      throw new Error(`Respuesta ${i + 1} inválida`);
    }

    if (placa.tipo === 'descriptiva') {
      const valor = Number((cruda as { valor: unknown }).valor);
      if (!Number.isInteger(valor) || valor < 0 || valor > 5) {
        throw new Error(`Escala ${i + 1} fuera de rango`);
      }
      likert[placa.perfil] += valor;
    } else {
      const seleccion = (cruda as { seleccion: unknown }).seleccion;
      if (!Array.isArray(seleccion)) throw new Error(`Selección ${i + 1} inválida`);
      const unicas = new Set(
        seleccion
          .map((n) => Number(n))
          .filter((n) => Number.isInteger(n) && n >= 0 && n < placa.frases.length)
      );
      checklist[placa.perfil] += unicas.size;
    }
  });

  return { likert, checklist };
}

export async function POST(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const empresa = await getEmpresaPorSlug(params.slug);
  if (!empresa) {
    return new NextResponse('Empresa no encontrada', { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return new NextResponse('Formato inválido', { status: 400 });
  }

  let datos: {
    apellido?: unknown;
    nombre?: unknown;
    respuestas?: unknown;
    autopercepcion?: unknown;
    variante?: unknown;
    liderId?: unknown;
    generaciones?: unknown;
    asistenteId?: unknown;
  };
  try {
    datos = JSON.parse(String(form.get('datos') ?? '{}'));
  } catch {
    return new NextResponse('Datos ilegibles', { status: 400 });
  }

  /**
   * Respondido desde el encuentro, quién es no lo dice el navegador.
   *
   * El teléfono manda el id del asistente y de ahí salen el nombre, el
   * apellido y la selfie que ya cargó al entrar al ciclo. Si el id no
   * pertenece a la corrida en curso, se sigue por el camino de siempre.
   */
  let asistente = null;
  let corridaId: string | null = null;
  if (typeof datos.asistenteId === 'string' && datos.asistenteId) {
    const ciclo = await resolverCiclo(params.slug);
    if (ciclo) asistente = await getAsistente(ciclo.corrida.id, datos.asistenteId);
    if (!asistente) return new NextResponse('Asistente inválido', { status: 400 });
    corridaId = asistente.corrida_id;
  }

  const nombre = (asistente?.nombre ?? String(datos.nombre ?? '')).trim().slice(0, 80);
  const apellido = (asistente?.apellido ?? String(datos.apellido ?? ''))
    .trim()
    .slice(0, 80);
  if (nombre.length < 2) {
    return new NextResponse('Falta el nombre', { status: 400 });
  }
  if (apellido.length < 2) {
    return new NextResponse('Falta el apellido', { status: 400 });
  }

  if (!Array.isArray(datos.respuestas) || datos.respuestas.length !== PLACAS.length) {
    return new NextResponse('Respuestas incompletas', { status: 400 });
  }

  let likert: Puntajes;
  let checklist: Puntajes;
  try {
    ({ likert, checklist } = puntuar(datos.respuestas as RespuestaCruda[]));
  } catch (e) {
    return new NextResponse((e as Error).message, { status: 400 });
  }

  const autopercepcion = PERFILES.includes(datos.autopercepcion as Perfil)
    ? (datos.autopercepcion as Perfil)
    : null;

  const variante: Variante =
    datos.variante === 'generaciones' ? 'generaciones' : 'perfil';

  // El líder se pide en la variante de generaciones (de ahí salen los informes
  // agrupados por equipo). Se valida contra los líderes de esta empresa, y se
  // exige solo si la empresa tiene líderes cargados.
  let liderId: string | null = null;
  let liderNombre: string | null = null;
  if (datos.liderId || variante === 'generaciones') {
    const lideres = await listarLideres(empresa.id);

    if (datos.liderId) {
      const lider = lideres.find((l) => l.id === datos.liderId);
      if (!lider) return new NextResponse('Líder inválido', { status: 400 });
      liderId = lider.id;
      liderNombre = lider.nombre;
    }

    if (variante === 'generaciones' && !liderId && lideres.length > 0) {
      return new NextResponse('Falta el líder', { status: 400 });
    }
  }

  const resultado = calcular(likert, checklist);

  // --- Bloque de generaciones (solo en su variante) ---
  let extra: Record<string, unknown> = {};
  let generacion: string | null = null;
  if (variante === 'generaciones') {
    const crudas = Array.isArray(datos.generaciones) ? datos.generaciones : [];
    const elecciones = PLACAS_GENERACIONES.map((placa, i) => {
      const valor = Number(crudas[i]);
      const valida =
        Number.isInteger(valor) && valor >= 0 && valor < placa.opciones.length;
      return valida ? valor : null;
    });

    const gen = calcularGeneracion(elecciones);
    extra = { generaciones: { elecciones, puntajes: gen.puntajes } };
    generacion = gen.etiqueta || null;
  }

  // --- Selfie (opcional) ---
  // La del ciclo alcanza: la persona se la sacó hace un rato, en esta misma
  // sala, y pedírsela otra vez para la misma matriz no agrega nada.
  let fotoPath: string | null = asistente?.foto_path ?? null;
  const foto = form.get('foto');
  if (foto instanceof File && foto.size > 0) {
    if (foto.size > MAX_FOTO || !foto.type.startsWith('image/')) {
      return new NextResponse('Foto inválida', { status: 400 });
    }
    try {
      const ruta = `${empresa.slug}/${crypto.randomUUID()}.jpg`;
      fotoPath = await subirSelfie(ruta, await foto.arrayBuffer(), foto.type);
    } catch {
      fotoPath = null; // si falla la foto, igual se guarda la respuesta
    }
  }

  try {
    await guardarRespuesta({
      empresa_id: empresa.id,
      variante,
      lider_id: liderId,
      lider_nombre: liderNombre,
      apellido,
      nombre,
      likert,
      checklist,
      totales: resultado.totales,
      detalle: { respuestas: datos.respuestas, autopercepcion },
      perfiles: resultado.perfiles,
      resultado: resultado.tipo,
      eje_x: resultado.ejeX,
      eje_y: resultado.ejeY,
      // El bloque de generaciones viaja aparte: no toca el puntaje de perfiles.
      extra,
      generacion,
      foto_path: fotoPath,
      // Queda atada al dictado: la misma empresa puede recorrer el ciclo otra
      // vez, y lo de un grupo no tiene por qué contarse en el del siguiente.
      corrida_id: corridaId,
    });
  } catch {
    return new NextResponse('No se pudo guardar', { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    resultado: {
      totales: resultado.totales,
      perfiles: resultado.perfiles,
      tipo: resultado.tipo,
      ejeX: resultado.ejeX,
      ejeY: resultado.ejeY,
    },
  });
}
