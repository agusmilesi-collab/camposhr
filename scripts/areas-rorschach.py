#!/usr/bin/env python3
"""
Traza las áreas de localización del Rorschach sobre la lámina real.

    python3 scripts/areas-rorschach.py

Qué hace y por qué así. Las áreas (W, D, Dd) son convenciones perceptuales: no
hay nada en la imagen que las separe, así que hay que decir dónde está cada una.
Dibujarlas a mano contorno por contorno sale impreciso y no coincide con la
tinta. En vez de eso, acá se declara una **zona aproximada** por área (un
rectángulo o un polígono grueso, leído de los diagramas del cuadernillo) y el
programa la recorta contra la tinta real de la lámina. El contorno que sale es
el de la mancha, no el que dibujó nadie.

De dónde salen las zonas: de los seis diagramas de localización del cuadernillo
(fotos en ~/Desktop/Entrevistador, `Lamina 1-1.png`, páginas 2 y 3), leídos uno
por uno. Los porcentajes son sobre la caja de la mancha, no sobre la imagen: así
las zonas siguen valiendo si la lámina se vuelve a escanear con otro margen.

Los espacios en blanco (las áreas con S) no se declaran: se detectan solos como
huecos cerrados adentro de la mancha.

La lámina no está en el repositorio (es material con derechos, vive en el bucket
privado). El programa la baja con la service key de `.env.local`.

Salida: `lib/rorschach-areas.ts` con los polígonos en coordenadas 0..1 sobre la
imagen, y `/tmp/.../control-areas.png` para mirar que cada área cayó donde va.
"""

import io
import os
import json
import subprocess
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from skimage import measure, morphology

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA_TS = os.path.join(RAIZ, 'lib', 'rorschach-areas.ts')
CONTROL = os.path.join(os.environ.get('TMPDIR', '/tmp'), 'control-areas.png')

# Umbral de tinta. El fondo del escaneo ronda 230 y la tinta 90-190.
UMBRAL = 190

# ---------------------------------------------------------------- las zonas
#
# Cada área es una lista de zonas, en porcentaje de la caja de la mancha
# (x0, y0, x1, y1). Varias zonas cuando el área son varias partes: D1 son las
# dos garras, DdS26 son los cuatro espacios.
#
# `espejo` significa que el área existe de los dos lados: se declara un lado y
# el programa refleja sobre el eje de simetría de la mancha. La lámina es
# simétrica y la persona puede ver la respuesta de cualquiera de los dos lados.

ZONAS = {
    # -- centro, de arriba hacia abajo
    'D1':    {'zonas': [(39, 18, 61, 27)],   'espejo': False},   # las dos garras superiores
    'Dd22':  {'zonas': [(43, 25, 57, 33)],   'espejo': False},   # los dos bultos bajo las garras
    'Dd21':  {'zonas': [(39, 18, 61, 45)],   'espejo': False},   # el cuerpo central superior con cuernos
    'D4':    {'zonas': [(38, 17, 62, 100)],  'espejo': False},   # la columna central entera
    'Dd27':  {'zonas': [(45, 39, 55, 55)],   'espejo': False},   # la franja entre los dos espacios de arriba
    'D3':    {'zonas': [(41, 55, 59, 92)],   'espejo': False},   # el cuerpo central inferior
    'Dd31':  {'zonas': [(43, 84, 57, 93)],   'espejo': False},   # el bloque del pie
    'Dd24':  {'zonas': [(44, 91, 56, 101)],  'espejo': False},   # la punta final

    # -- laterales, se declaran a la izquierda y se reflejan
    'D2':    {'zonas': [(0, 0, 44, 72)],     'espejo': True},    # la mitad lateral entera
    # El ala se separa del cuerpo por una diagonal, así que va como polígono:
    # con un rectángulo el recorte cortaba el ala en vertical y se notaba.
    'D7':    {'poli': [(0, 24), (10, 16), (22, 14), (32, 19), (36, 30),
                       (30, 41), (14, 43), (1, 36)],             'espejo': True},
    'Dd34':  {'zonas': [(0, 26, 13, 41)],    'espejo': True},    # la punta externa del ala
    'Dd28':  {'zonas': [(16, -1, 31, 11)],   'espejo': True},    # la punta superior externa
    'Dd35':  {'zonas': [(13, 37, 24, 50)],   'espejo': True},    # bajo el ala
    'Dd33':  {'zonas': [(28, 56, 38, 68)],   'espejo': True},    # la protuberancia lateral baja
    'Dd25':  {'zonas': [(31, 40, 38, 48)],   'espejo': True},    # la manchita suelta al costado del centro
}

# El espacio blanco de arriba del centro no es un hueco cerrado (se abre hacia
# arriba), así que no lo encuentra la detección de huecos: se recorta a mano
# como el blanco que queda adentro de esta zona.
ZONA_DdS32 = (30, 6, 70, 20)

# Dd23 son las salpicaduras: los pedazos de tinta separados de la mancha.
AREA_SALPICADURA = 'Dd23'

# Cómo se reparten los cuatro huecos cerrados. Los dos de arriba son altos y
# angostos (el libro lista "pulmones", "árboles", "figura humana"); los dos de
# abajo son triangulares ("pirámides", "tiendas de campaña", "triángulos").
# En el diagrama las dos líneas guía se cruzan y no se puede leer cuál es cuál,
# así que esta asignación sale de las listas de respuestas.
#
#   PENDIENTE DE CONFIRMAR CON LAS EVALUADORAS.
#
HUECOS = {
    'DdS30': 'arriba',      # los dos espacios altos, a los lados del centro
    'DdS29': 'abajo',       # los dos espacios triangulares de abajo
    'DdS26': 'todos',       # los cuatro juntos
}


def laminaI():
    """Baja la lámina I del bucket privado."""
    env = {}
    with io.open(os.path.join(RAIZ, '.env.local'), encoding='utf-8') as f:
        for linea in f:
            if '=' in linea and not linea.strip().startswith('#'):
                k, v = linea.split('=', 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    url = f"{env['SUPABASE_URL']}/storage/v1/object/psicotecnicos/laminas/rorschach/1.png"
    key = env['SUPABASE_SERVICE_KEY']
    out = subprocess.run(
        ['curl', '-s', url, '-H', f'apikey: {key}', '-H', f'Authorization: Bearer {key}'],
        capture_output=True, check=True).stdout
    return Image.open(io.BytesIO(out))


def contornos(mascara, minimo=150):
    """Los contornos de una máscara, en polígonos simplificados."""
    if mascara.sum() < minimo:
        return []
    # Cierra los poros del escaneo para que el contorno no salga dentado.
    m = ndimage.binary_closing(mascara, np.ones((5, 5)))
    m = ndimage.binary_fill_holes(m)
    salida = []
    for c in measure.find_contours(m.astype(float), 0.5):
        if len(c) < 8:
            continue
        p = measure.approximate_polygon(c, tolerance=2.0)
        if len(p) < 4:
            continue
        area = 0.5 * abs(sum(p[i][1] * p[i - 1][0] - p[i - 1][1] * p[i][0] for i in range(len(p))))
        if area < minimo:
            continue
        salida.append(p)
    return salida


def main():
    im = laminaI().convert('L')
    a = np.array(im)
    alto, ancho = a.shape
    tinta = a < UMBRAL

    lab, n = ndimage.label(tinta)
    tam = ndimage.sum(tinta, lab, range(1, n + 1))
    principal = np.argmax(tam) + 1
    mancha = lab == principal

    ys, xs = np.where(mancha)
    cx0, cx1, cy0, cy1 = xs.min(), xs.max(), ys.min(), ys.max()
    caja = (cx1 - cx0, cy1 - cy0)
    eje = (cx0 + cx1) / 2
    print(f'mancha: {mancha.sum()} px · caja x {cx0}-{cx1} y {cy0}-{cy1} · eje x={eje:.1f}')

    def px(x, y, reflejar=False):
        """Un punto en porcentaje de la caja, a píxeles de la imagen."""
        u = cx0 + caja[0] * x / 100
        if reflejar:
            u = 2 * eje - u
        return u, cy0 + caja[1] * y / 100

    def zona_a_mascara(z, reflejar=False):
        x0, y0, x1, y1 = z
        (px0, py0), (px1, py1) = px(x0, y0, reflejar), px(x1, y1, reflejar)
        if px0 > px1:
            px0, px1 = px1, px0
        m = np.zeros_like(mancha)
        m[max(0, int(py0)):int(py1), max(0, int(px0)):int(px1)] = True
        return m

    def poli_a_mascara(puntos, reflejar=False):
        lienzo = Image.new('1', (ancho, alto), 0)
        ImageDraw.Draw(lienzo).polygon([px(x, y, reflejar) for x, y in puntos], fill=1)
        return np.array(lienzo, dtype=bool)

    areas = {}

    # --- áreas de tinta
    for nombre, cfg in ZONAS.items():
        m = np.zeros_like(mancha)
        for z in cfg.get('zonas', []):
            m |= zona_a_mascara(z)
            if cfg['espejo']:
                m |= zona_a_mascara(z, reflejar=True)
        if 'poli' in cfg:
            m |= poli_a_mascara(cfg['poli'])
            if cfg['espejo']:
                m |= poli_a_mascara(cfg['poli'], reflejar=True)
        areas[nombre] = m & mancha

    # --- los cuatro espacios cerrados
    lleno = ndimage.binary_fill_holes(mancha)
    huecos = lleno & ~mancha
    hl, hn = ndimage.label(huecos)
    ht = ndimage.sum(huecos, hl, range(1, hn + 1))
    grandes = [i + 1 for i in range(hn) if ht[i] > 1000]
    centros = {i: ndimage.center_of_mass(huecos, hl, i)[0] for i in grandes}
    orden = sorted(grandes, key=lambda i: centros[i])
    arriba, abajo = orden[:2], orden[2:]
    print(f'espacios cerrados: {len(grandes)} · arriba {arriba} · abajo {abajo}')
    reparto = {'arriba': arriba, 'abajo': abajo, 'todos': grandes}
    for nombre, cual in HUECOS.items():
        m = np.zeros_like(mancha)
        for i in reparto[cual]:
            m |= hl == i
        areas[nombre] = m

    # --- el espacio abierto de arriba
    #
    # No es un hueco cerrado: se abre hacia arriba, entre las dos jorobas, así
    # que la detección de huecos no lo ve. Sale como el blanco que queda entre
    # la mancha y su casco convexo, recortado a la zona superior central. El
    # casco es lo que "tapa" la entrante de arriba y la vuelve medible.
    casco = morphology.convex_hull_image(mancha)
    areas['DdS32'] = zona_a_mascara(ZONA_DdS32) & casco & ~tinta

    # --- las salpicaduras
    m = tinta & ~mancha
    ml, mn = ndimage.label(m)
    mt = ndimage.sum(m, ml, range(1, mn + 1))
    chicas = np.zeros_like(mancha)
    for i in range(mn):
        if mt[i] > 60:
            chicas |= ml == i + 1
    areas[AREA_SALPICADURA] = chicas

    # --- a polígonos normalizados
    salida = {}
    for nombre, m in areas.items():
        minimo = 60 if nombre == AREA_SALPICADURA else 150
        polis = contornos(m, minimo)
        salida[nombre] = [
            [[round(float(p[1]) / ancho, 4), round(float(p[0]) / alto, 4)] for p in poli]
            for poli in polis
        ]
        print(f'  {nombre:>6}: {m.sum():>7} px · {len(polis)} parte(s)')

    # --- W es la mancha entera
    salida['W'] = [
        [[round(float(p[1]) / ancho, 4), round(float(p[0]) / alto, 4)] for p in poli]
        for poli in contornos(mancha)
    ]
    print(f"  {'W':>6}: {mancha.sum():>7} px · {len(salida['W'])} parte(s)")

    escribir_ts(salida, vecindad(areas, mancha.shape))
    control(im, areas, mancha)


def vecindad(areas, forma):
    """
    Qué áreas se tocan y cuáles están una adentro de otra.

    Es lo que separa ZA de ZD: integrar dos áreas **adyacentes** puntúa distinto
    que integrar dos **distantes**, y eso lo dice la lámina, no el criterio de
    quien codifica. Se mide acá, sobre las mismas máscaras con que se trazaron
    las áreas, en vez de escribirlo a mano área por área.

    `contenidas` es el reparo necesario: Dd21 está adentro de D4, así que elegir
    las dos no es integrar dos áreas, es nombrar la misma zona dos veces, y no
    hay Z de organización por eso.
    """
    # Un uno por ciento del ancho de la lámina. Con menos, dos áreas que se
    # tocan quedan separadas por el borde blanco del recorte; con más, empiezan
    # a tocarse áreas que tienen otra en el medio.
    tol = max(6, int(forma[1] * 0.01))
    nombres = [n for n in areas if areas[n].sum() > 0]
    adyacentes, contenidas = {}, {}
    for a in nombres:
        crecida = ndimage.binary_dilation(areas[a], np.ones((tol, tol)))
        vecinas, dentro = [], []
        for b in nombres:
            if a == b:
                continue
            comun = (areas[a] & areas[b]).sum()
            menor = min(areas[a].sum(), areas[b].sum())
            if menor and comun / menor > 0.6:
                dentro.append(b)
            elif (crecida & areas[b]).sum() > 40:
                vecinas.append(b)
        adyacentes[a] = sorted(vecinas)
        contenidas[a] = sorted(dentro)
    return adyacentes, contenidas


def escribir_ts(areas, vecinos):
    orden = ['W', 'D1', 'D2', 'D3', 'D4', 'D7', 'Dd21', 'Dd22', 'Dd23', 'Dd24',
             'Dd25', 'DdS26', 'Dd27', 'Dd28', 'DdS29', 'DdS30', 'Dd31', 'DdS32',
             'Dd33', 'Dd34', 'Dd35']
    cuerpo = []
    for nombre in orden:
        partes = areas.get(nombre, [])
        ps = ',\n'.join(
            '    [' + ', '.join(f'[{x}, {y}]' for x, y in parte) + ']' for parte in partes)
        cuerpo.append(f"  {nombre}: [\n{ps},\n  ],")
    ady = ',\n'.join(f'  {k}: {v!r}'.replace("'", "'") for k, v in sorted(vecinos[0].items()))
    cont = ',\n'.join(f'  {k}: {v!r}' for k, v in sorted(vecinos[1].items()))
    adyacentes = '{\n' + ady.replace("'", '\"') + ',\n}'
    contenidas = '{\n' + cont.replace("'", '\"') + ',\n}'
    texto = f'''/**
 * Dónde está cada área de localización sobre la lámina.
 *
 * GENERADO por `scripts/areas-rorschach.py`, no se edita a mano: los contornos
 * salen de recortar la tinta real de la lámina contra las zonas declaradas en
 * ese programa. Para corregir un área se mueve su zona allá y se vuelve a
 * generar, mirando la imagen de control que deja.
 *
 * Cada área es una lista de partes, y cada parte una lista de puntos [x, y] en
 * 0..1 sobre la imagen de la lámina. Son varias partes cuando el área son
 * varios pedazos: D1 son las dos garras, DdS26 los cuatro espacios, Dd23 las
 * salpicaduras.
 *
 * Sirven para dos cosas a la vez: dibujar el mapa donde la evaluadora elige el
 * área, y ubicar contra qué área cae lo que señaló la persona. Por eso se
 * trazan sobre la lámina que ella ve y no sobre los diagramas del cuadernillo,
 * que tienen otra proporción.
 */

export type Punto = [number, number];
export type Parte = Punto[];

export const AREAS: Record<string, Parte[]> = {{
{chr(10).join(cuerpo)}
}};

/**
 * Qué áreas se tocan. Separa ZA de ZD: integrar dos áreas adyacentes puntúa
 * distinto que integrar dos distantes, y eso lo dice la lámina.
 */
export const ADYACENTES: Record<string, string[]> = {adyacentes};

/**
 * Qué áreas están adentro de otra. Elegir D4 y Dd21 no es integrar dos áreas:
 * Dd21 es una parte de D4, y nombrar la misma zona dos veces no organiza nada.
 */
export const CONTENIDAS: Record<string, string[]> = {contenidas};

/** Si un punto en 0..1 cae adentro de un área. */
export function caeEn(area: Parte[], x: number, y: number): boolean {{
  let adentro = false;
  for (const parte of area) {{
    for (let i = 0, j = parte.length - 1; i < parte.length; j = i++) {{
      const [xi, yi] = parte[i];
      const [xj, yj] = parte[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) adentro = !adentro;
    }}
  }}
  return adentro;
}}

/** Las áreas que contienen un punto, de la más chica a la más grande. */
export function areasEn(x: number, y: number): string[] {{
  return Object.entries(AREAS)
    .filter(([, a]) => caeEn(a, x, y))
    .sort((a, b) => superficie(a[1]) - superficie(b[1]))
    .map(([n]) => n);
}}

function superficie(area: Parte[]): number {{
  let total = 0;
  for (const parte of area) {{
    let s = 0;
    for (let i = 0, j = parte.length - 1; i < parte.length; j = i++) {{
      s += parte[j][0] * parte[i][1] - parte[i][0] * parte[j][1];
    }}
    total += Math.abs(s / 2);
  }}
  return total;
}}
'''
    with io.open(SALIDA_TS, 'w', encoding='utf-8') as f:
        f.write(texto)
    print(f'\nescrito {SALIDA_TS}')


def control(im, areas, mancha):
    """Una imagen con cada área pintada, para mirar que cayó donde va."""
    orden = [n for n in areas if n]
    cols = 6
    filas = (len(orden) + cols - 1) // cols
    w, h = im.size
    esc = 260 / w
    tw, th = int(w * esc), int(h * esc)
    hoja = Image.new('RGB', (tw * cols, th * filas), 'white')
    base = im.convert('RGB').resize((tw, th))
    d0 = ImageDraw.Draw(hoja)
    for k, nombre in enumerate(orden):
        tile = base.copy()
        capa = Image.fromarray((areas[nombre] * 255).astype(np.uint8)).resize((tw, th))
        rojo = Image.new('RGB', (tw, th), (220, 30, 30))
        tile = Image.composite(Image.blend(tile, rojo, 0.55), tile, capa)
        x, y = (k % cols) * tw, (k // cols) * th
        hoja.paste(tile, (x, y))
        d0.text((x + 6, y + 6), nombre, fill=(0, 0, 0))
    hoja.save(CONTROL)
    print(f'control {CONTROL}')


if __name__ == '__main__':
    main()
