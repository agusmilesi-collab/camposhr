/**
 * Achicar y unir fotos en el navegador, antes de que salgan del teléfono.
 *
 * Las fotos llegan por WhatsApp desde el celular de la persona evaluada y pesan
 * entre tres y cinco megas cada una. Comprimirlas del lado del servidor
 * significaría subir treinta megas para tirar veintiocho: se hace acá, y lo que
 * viaja es el resultado.
 *
 * Lo que hay que poder ver es el trazo del lápiz y la deformación de la figura,
 * no el grano del papel. Con el lado largo en 860 píxeles una hoja A4 queda a
 * unos cien puntos por pulgada, que es de sobra para leer un Bender.
 */

/** Cuánto mide el lado más largo de cada foto después de achicarla. */
export const LADO = 860;
/** Cuánto se comprime. Más abajo el lápiz claro empieza a desaparecer. */
export const CALIDAD = 0.72;

/**
 * La imagen decodificada, o null si el navegador no puede con ese formato.
 *
 * Un iPhone puede mandar HEIC, que Chrome no sabe leer. En ese caso no se
 * rompe nada: quien llama sube el archivo tal como vino.
 */
async function leer(archivo: File): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(archivo);
  } catch {
    return null;
  }
}

function aBlob(lienzo: HTMLCanvasElement, calidad: number): Promise<Blob> {
  return new Promise((listo, falla) => {
    lienzo.toBlob(
      (b) => (b ? listo(b) : falla(new Error('No se pudo armar la imagen.'))),
      'image/jpeg',
      calidad
    );
  });
}

/** Dibuja la imagen adentro de un cuadro, entera y centrada. */
function encajar(
  ctx: CanvasRenderingContext2D,
  img: ImageBitmap,
  x: number,
  y: number,
  ancho: number,
  alto: number
) {
  const escala = Math.min(ancho / img.width, alto / img.height);
  const w = img.width * escala;
  const h = img.height * escala;
  ctx.drawImage(img, x + (ancho - w) / 2, y + (alto - h) / 2, w, h);
}

/**
 * Una foto sola, más chica.
 *
 * Devuelve el archivo original si el navegador no pudo decodificarlo: es
 * preferible subir cinco megas que perder el dibujo.
 */
export async function achicar(archivo: File, lado = 1600, calidad = 0.75): Promise<Blob> {
  const img = await leer(archivo);
  if (!img) return archivo;

  const escala = Math.min(1, lado / Math.max(img.width, img.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(img.width * escala);
  lienzo.height = Math.round(img.height * escala);
  const ctx = lienzo.getContext('2d');
  if (!ctx) return archivo;
  // Blanco abajo: un JPEG no tiene transparencia y una foto girada dejaría
  // bandas negras a los costados.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
  img.close();
  return aBlob(lienzo, calidad);
}

/**
 * Varias fotos en una sola imagen, en grilla y numeradas.
 *
 * El número va impreso sobre cada casilla porque la hoja se mira meses después
 * de la entrevista: sin él, hay que reconocer la lámina por el dibujo, que es
 * justamente lo que puede estar deformado.
 */
export async function componer(
  archivos: File[],
  opciones: { columnas?: number; lado?: number; calidad?: number; rotulos?: string[] } = {}
): Promise<Blob> {
  const columnas = opciones.columnas ?? 3;
  const lado = opciones.lado ?? LADO;
  const calidad = opciones.calidad ?? CALIDAD;
  const filas = Math.ceil(archivos.length / columnas);

  const lienzo = document.createElement('canvas');
  lienzo.width = columnas * lado;
  lienzo.height = filas * lado;
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('No se pudo armar la imagen.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.imageSmoothingQuality = 'high';

  for (let i = 0; i < archivos.length; i++) {
    const x = (i % columnas) * lado;
    const y = Math.floor(i / columnas) * lado;
    const img = await leer(archivos[i]);
    if (img) {
      encajar(ctx, img, x + 8, y + 8, lado - 16, lado - 16);
      img.close();
    }

    // La línea que separa una hoja de la siguiente, y su número.
    ctx.strokeStyle = '#d8d4cc';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, lado - 2, lado - 2);
    const rotulo = opciones.rotulos?.[i] ?? String(i + 1);
    ctx.font = `600 ${Math.round(lado * 0.045)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 10, y + 10, ctx.measureText(rotulo).width + 20, Math.round(lado * 0.07));
    ctx.fillStyle = '#16202b';
    ctx.textBaseline = 'middle';
    ctx.fillText(rotulo, x + 20, y + 10 + Math.round(lado * 0.035));
  }

  return aBlob(lienzo, calidad);
}
