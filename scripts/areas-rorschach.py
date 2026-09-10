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
    'I': {
        # -- centro, de arriba hacia abajo
        # Las dos antenitas y nada más: los dos trazos finos que salen del bloque
        # central hacia arriba, entre el 20 % y el 28 % de alto. Se declara una y
        # se refleja. Una zona más ancha se lleva el borde superior del cuerpo y
        # sale una franja horizontal, y una que llegue al centro se lleva los dos
        # cuernos internos, que son parte de Dd21.
        'D1':    {'zonas': [(42, 20, 46, 28)],   'espejo': True},    # las dos antenitas
        'Dd22':  {'zonas': [(46, 18, 54, 35)],   'espejo': False},   # los dos bultos bajo las garras
        'Dd21':  {'zonas': [(41, 17, 59, 49)],   'espejo': False},   # el cuerpo central superior con cuernos
        'D4':    {'zonas': [(40, 9, 59, 103)],   'espejo': False},   # la columna central entera
        'Dd27':  {'zonas': [(47, 45, 53, 53)],   'espejo': False},   # la franja entre los dos espacios de arriba
        'D3':    {'zonas': [(44, 60, 54, 98)],   'espejo': False},   # el cuerpo central inferior
        'Dd31':  {'zonas': [(46, 90, 53, 102)],  'espejo': False},   # el bloque del pie
        # La campana central baja con su punta, y no solo la punta: la lista del
        # libro para esta área son "violonchelo", "figura humana entera",
        # "campana" y "falda", que no se ven en un pedacito. Confirmado por
        # Agustín el 9/9/2026 sobre la hoja de control.
        'Dd24':  {'zonas': [(40, 45, 59, 102)],  'espejo': False},   # la campana central baja

        # -- laterales, se declaran a la izquierda y se reflejan
        'D2':    {'zonas': [(0, -3, 43, 79)],    'espejo': True},    # la mitad lateral entera
        # El ala se separa del cuerpo por una diagonal, así que va como polígono:
        # con un rectángulo el recorte cortaba el ala en vertical y se notaba.
        'D7':    {'poli': [(1, 18), (7, 2), (20, -3), (31, 9), (40, 27),
                           (31, 40), (12, 41), (0, 32)],             'espejo': True},
        'Dd34':  {'zonas': [(0, 17, 22, 36)],    'espejo': True},    # la punta externa del ala
        'Dd28':  {'zonas': [(16, -1, 31, 11)],   'espejo': True},    # la punta superior externa
        'Dd35':  {'zonas': [(15, 35, 25, 63)],   'espejo': True},    # bajo el ala
        'Dd33':  {'zonas': [(17, 66, 26, 80)],   'espejo': True},    # la protuberancia lateral baja
        'Dd25':  {'zonas': [(11, 36, 22, 53)],   'espejo': True},    # la manchita suelta adentro del ala
    },
    'II': {
        # La lámina II tiene dos tintas y las áreas siguen el color: D1 y D6 son
        # lo gris, D2 y D3 lo rojo. Sin eso, el recorte de D1 se lleva medio D3,
        # porque el rojo de abajo toca el cuerpo gris.
        #
        # Las zonas salieron de que Agustín marcara sobre la hoja de control el
        # 9/9/2026. D1 va de un lado solo: es una mitad lateral, y dibujada con
        # espejo quedaba igual que D6, que son las dos juntas.
        'D1':    {'zonas': [(46, 18, 101, 89)],  'espejo': False, 'tinta': 'gris'},
        'D2':    {'zonas': [(25, -2, 42, 26)],   'espejo': False, 'tinta': 'rojo'},
        'D3':    {'zonas': [(30, 60, 70, 100)],  'espejo': False, 'tinta': 'rojo'},
        'D4':    {'zonas': [(45, 20, 55, 34)],   'espejo': False, 'tinta': 'gris'},
        'D6':    {'zonas': [(0, 25, 100, 100)],  'espejo': False, 'tinta': 'gris'},
        'Dd21':  {'zonas': [(54, 26, 99, 54)],   'espejo': False, 'tinta': 'gris'},
        'Dd22':  {'zonas': [(-3, 75, 14, 91)],   'espejo': False, 'tinta': 'gris'},
        'Dd23':  {'zonas': [(66, 76, 84, 89)],   'espejo': False, 'tinta': 'gris'},
        'Dd24':  {'zonas': [(47, 69, 52, 85)],   'espejo': False},
        'Dd25':  {'zonas': [(35, 72, 49, 101)],  'espejo': False},
        'Dd26':  {'zonas': [(70, 28, 89, 36)],   'espejo': False, 'tinta': 'rojizo'},
        'Dd27':  {'zonas': [(40, 41, 59, 46)],   'espejo': False, 'tinta': 'gris'},
        'Dd28':  {'zonas': [(50, 64, 70, 87)],   'espejo': False, 'tinta': 'rojizo'},
        'Dd31':  {'zonas': [(91, 40, 100, 58)],  'espejo': False, 'tinta': 'gris'},
    },
    'III': {
        # Zonas marcadas por Agustín el 10/9/2026 sobre la hoja de control. La
        # lámina está fragmentada y casi todas las áreas van de un lado solo:
        # dibujadas con espejo se confundirían con W, que es la mancha entera.
        'D1':    {'zonas': [(10, 18, 90, 100)],  'espejo': False, 'tinta': 'gris'},
        'D2':    {'zonas': [(-1, -6, 15, 34)],   'espejo': False, 'tinta': 'rojo'},
        'D3':    {'zonas': [(37, 37, 63, 58)],   'espejo': False, 'tinta': 'rojo'},
        'D5':    {'zonas': [(58, 50, 82, 88)],   'espejo': False, 'tinta': 'gris'},
        'D7':    {'zonas': [(38, 56, 62, 82)],   'espejo': False, 'tinta': 'gris'},
        'D8':    {'zonas': [(40, 68, 62, 96)],   'espejo': False, 'tinta': 'gris'},
        'D9':    {'zonas': [(2, 10, 48, 101)],   'espejo': False, 'tinta': 'gris'},
        'Dd21':  {'zonas': [(78, 36, 98, 60)],   'espejo': False, 'tinta': 'gris'},
        'Dd22':  {'zonas': [(22, 22, 50, 58)],   'espejo': False, 'tinta': 'gris'},
        'Dd25':  {'zonas': [(90, -4, 99, 21)],   'espejo': False, 'tinta': 'rojo'},
        'Dd26':  {'zonas': [(73, 67, 87, 76)],   'espejo': False, 'tinta': 'gris'},
        'Dd27':  {'zonas': [(60, 30, 76, 50)],   'espejo': False, 'tinta': 'gris'},
        'Dd28':  {'zonas': [(43, 36, 57, 52)],   'espejo': False},
        'Dd29':  {'zonas': [(52, 36, 62, 57)],   'espejo': False, 'tinta': 'rojo'},
        'Dd30':  {'zonas': [(54, 42, 74, 62)],   'espejo': False, 'tinta': 'gris'},
        'Dd31':  {'zonas': [(50, 60, 68, 82)],   'espejo': False, 'tinta': 'gris'},
        'Dd32':  {'zonas': [(58, 14, 74, 38)],   'espejo': False, 'tinta': 'gris'},
        'Dd33':  {'zonas': [(62, 82, 90, 101)],  'espejo': False, 'tinta': 'gris'},
        'Dd34':  {'zonas': [(18, 12, 46, 52)],   'espejo': False, 'tinta': 'gris'},
        'Dd35':  {'zonas': [(26, 15, 74, 100)],  'espejo': False, 'tinta': 'gris'},
    },
}

# Los espacios blancos cerrados de cada lámina, y cómo se reparten.
#
# En la I las dos líneas guía del cuadernillo se cruzan y no se puede leer cuál
# es cuál, así que el reparto se dedujo de las listas de respuestas: los dos de
# arriba son altos y angostos, y el libro lista ahí "pulmones", "árboles",
# "figura humana"; los dos de abajo son triangulares, y lista "pirámides",
# "tiendas de campaña", "triángulos". Confirmado por la evaluadora el 25/8/2026.
#
# La II tiene uno solo, el rombo del medio.
HUECOS = {
    'I': {'DdS30': 'arriba', 'DdS29': 'abajo', 'DdS26': 'todos'},
    'II': {'DS5': 'todos'},
    'III': {},
}

# Los espacios que no cierran: se abren hacia afuera y la detección de huecos no
# los ve. Salen como el blanco que queda entre la mancha y su casco convexo,
# recortado a la zona declarada, y de ahí se toma el pedazo más grande: son el
# espacio contenido y no las esquirlas de blanco que quedan alrededor.
ABIERTOS = {
    'I': {'DdS32': (29, 1, 69, 27)},
    'II': {'DdS29': (43, 35, 57, 45), 'DdS30': (29, 20, 48, 34)},
    'III': {'DdS23': (56, 50, 80, 84), 'DdS24': (33, 12, 67, 64)},
}

# Las salpicaduras: los pedazos de tinta separados de la mancha, y en qué zona
# valen. En la I son solo las de abajo, las que el cuadernillo señala con sus
# tres flechas; sin acotarlo entraban dos manchitas de media altura que no son
# Dd23. Marcado por Agustín el 9/9/2026 sobre la hoja de control.
SALPICADURAS = {
    'I': ('Dd23', (64, 68, 86, 92)),
}

def bajar(numero):
    """Baja una lámina del bucket privado."""
    env = {}
    with io.open(os.path.join(RAIZ, '.env.local'), encoding='utf-8') as f:
        for linea in f:
            if '=' in linea and not linea.strip().startswith('#'):
                k, v = linea.split('=', 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    url = f"{env['SUPABASE_URL']}/storage/v1/object/psicotecnicos/laminas/rorschach/{numero}.png"
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


# En qué número de archivo vive cada lámina, y cuánto tiene que medir un pedazo
# de tinta para contar como parte de la mancha y no como salpicadura.
NUMERO = {'I': 1, 'II': 2, 'III': 3}
MINIMO_PIEZA = 2000
# La III está fragmentada: sus piezas rojas rondan los diez mil píxeles y las
# salpicaduras, los cientos.
MINIMO_POR_LAMINA = {'III': 1500}


def main(lamina='I'):
    color = bajar(NUMERO[lamina]).convert('RGB')
    im = color.convert('L')
    a = np.array(im)
    rgb = np.array(color).astype(int)
    alto, ancho = a.shape
    tinta = a < UMBRAL

    # La tinta roja de la lámina II: lo que tiene rojo bastante más alto que el
    # verde y el azul. Las áreas de esa lámina siguen el color, así que hay que
    # poder separar una capa de la otra.
    diferencia = rgb[:, :, 0] - np.maximum(rgb[:, :, 1], rgb[:, :, 2])
    rojo = tinta & (diferencia > 40)
    gris = tinta & ~rojo
    # Los rojos de adentro del gris están apagados por la tinta que tienen
    # encima: con el corte del rojo pleno no los ve ninguno.
    rojizo = tinta & (diferencia > 6)
    capa = {'rojo': rojo, 'gris': gris, 'rojizo': rojizo}

    # La mancha son todos los pedazos grandes y no solo el mayor: en la II una
    # de las dos manchas rojas de arriba está separada del cuerpo, y con la
    # componente principal sola quedaba afuera de W.
    lab, n = ndimage.label(tinta)
    tam = ndimage.sum(tinta, lab, range(1, n + 1))
    minimo = MINIMO_POR_LAMINA.get(lamina, MINIMO_PIEZA)
    piezas = [i + 1 for i in range(n) if tam[i] > minimo]
    mancha = np.isin(lab, piezas)

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
    for nombre, cfg in ZONAS[lamina].items():
        m = np.zeros_like(mancha)
        for z in cfg.get('zonas', []):
            m |= zona_a_mascara(z)
            if cfg['espejo']:
                m |= zona_a_mascara(z, reflejar=True)
        if 'poli' in cfg:
            m |= poli_a_mascara(cfg['poli'])
            if cfg['espejo']:
                m |= poli_a_mascara(cfg['poli'], reflejar=True)
        areas[nombre] = m & mancha & capa.get(cfg.get('tinta'), mancha)

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
    for nombre, cual in HUECOS[lamina].items():
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
    casco = morphology.binary_closing(morphology.convex_hull_image(mancha))
    for nombre, zona in ABIERTOS.get(lamina, {}).items():
        m = (zona_a_mascara(zona) | zona_a_mascara(zona, reflejar=True)) & casco & ~tinta
        el, en = ndimage.label(m)
        if en > 1:
            et = ndimage.sum(m, el, range(1, en + 1))
            m = el == int(np.argmax(et)) + 1
        areas[nombre] = m

    # --- las salpicaduras
    salpica = SALPICADURAS.get(lamina)
    if salpica:
        nombre, zona = salpica
        dentro = zona_a_mascara(zona) | zona_a_mascara(zona, reflejar=True)
        m = tinta & ~mancha
        ml, mn = ndimage.label(m)
        mt = ndimage.sum(m, ml, range(1, mn + 1))
        chicas = np.zeros_like(mancha)
        for i in range(mn):
            pieza = ml == i + 1
            if mt[i] > 60 and (pieza & dentro).any():
                chicas |= pieza
        areas[nombre] = chicas

    # --- a polígonos normalizados
    salida = {}
    for nombre, m in areas.items():
        minimo = 60 if salpica and nombre == salpica[0] else 150
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

    return salida, vecindad(areas, mancha.shape), color, areas


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


ORDEN = {
    'I': ['W', 'D1', 'D2', 'D3', 'D4', 'D7', 'Dd21', 'Dd22', 'Dd23', 'Dd24',
          'Dd25', 'DdS26', 'Dd27', 'Dd28', 'DdS29', 'DdS30', 'Dd31', 'DdS32',
          'Dd33', 'Dd34', 'Dd35'],
    'II': ['W', 'D1', 'D2', 'D3', 'D4', 'DS5', 'D6', 'Dd21', 'Dd22', 'Dd23',
           'Dd24', 'Dd25', 'Dd26', 'Dd27', 'Dd28', 'DdS29', 'DdS30', 'Dd31'],
    'III': ['W', 'D1', 'D2', 'D3', 'D5', 'D7', 'D8', 'D9', 'Dd21', 'Dd22',
            'DdS23', 'DdS24', 'Dd25', 'Dd26', 'Dd27', 'Dd28', 'Dd29', 'Dd30',
            'Dd31', 'Dd32', 'Dd33', 'Dd34', 'Dd35'],
}


def bloque(areas, orden, sangria='    '):
    cuerpo = []
    for nombre in orden:
        partes = areas.get(nombre, [])
        # Un área sin partes se escribe vacía y en un renglón: con la coma de
        # separación quedaba un agujero en el arreglo y el archivo no compilaba.
        if not partes:
            cuerpo.append(f'{sangria}{nombre}: [],')
            continue
        ps = ',\n'.join(
            sangria + '  [' + ', '.join(f'[{x}, {y}]' for x, y in parte) + ']'
            for parte in partes)
        cuerpo.append(f"{sangria}{nombre}: [\n{ps},\n{sangria}],")
    return '\n'.join(cuerpo)


def mapa(d, sangria='  '):
    filas = ',\n'.join(f'{sangria}{k}: {v!r}'.replace("'", '"') for k, v in sorted(d.items()))
    return '{\n' + filas + ',\n}'


def escribir_ts(por_lamina):
    """`por_lamina` es {lámina: (áreas, (adyacentes, contenidas))}."""
    areas = '\n'.join(
        f"  {lamina}: {{\n{bloque(a, ORDEN[lamina])}\n  }},"
        for lamina, (a, _) in por_lamina.items())
    ady = '\n'.join(
        f"  {lamina}: {mapa(v[0], '    ')[:-2]}\n  }},".replace('{\n', '{\n')
        for lamina, (_, v) in por_lamina.items())
    cont = '\n'.join(
        f"  {lamina}: {mapa(v[1], '    ')[:-2]}\n  }},"
        for lamina, (_, v) in por_lamina.items())
    texto = f'''/**
 * Dónde está cada área de localización sobre cada lámina.
 *
 * GENERADO por `scripts/areas-rorschach.py`, no se edita a mano: los contornos
 * salen de recortar la tinta real de la lámina contra las zonas declaradas en
 * ese programa. Para corregir un área se mueve su zona allá y se vuelve a
 * generar, mirando la imagen de control que deja.
 *
 * Cada área es una lista de partes, y cada parte una lista de puntos [x, y] en
 * 0..1 sobre la imagen de la lámina. Son varias partes cuando el área son
 * varios pedazos: en la I, D1 son las dos antenitas y DdS26 los cuatro
 * espacios.
 *
 * Sirven para dos cosas a la vez: dibujar el mapa donde la evaluadora elige la
 * locación, y ubicar contra qué área cae lo que señaló la persona. Por eso se
 * trazan sobre la lámina que ella ve y no sobre los diagramas del cuadernillo,
 * que tienen otra proporción.
 */

export type Punto = [number, number];
export type Parte = Punto[];

export const AREAS: Record<string, Record<string, Parte[]>> = {{
{areas}
}};

/**
 * Qué áreas se tocan. Separa ZA de ZD: integrar dos áreas adyacentes puntúa
 * distinto que integrar dos distantes, y eso lo dice la lámina.
 */
export const ADYACENTES: Record<string, Record<string, string[]>> = {{
{ady}
}};

/**
 * Qué áreas están adentro de otra. Elegir D4 y Dd21 no es integrar dos áreas:
 * Dd21 es una parte de D4, y nombrar la misma zona dos veces no organiza nada.
 */
export const CONTENIDAS: Record<string, Record<string, string[]>> = {{
{cont}
}};

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

/** La superficie de un área, para elegir la más chica cuando dos se superponen. */
export function superficie(area: Parte[]): number {{
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


def control(im, areas, lamina):
    """Una imagen con cada área pintada, para mirar que cayó donde va."""
    orden = [n for n in areas if n]
    cols = 6
    filas = (len(orden) + cols - 1) // cols
    w, h = im.size
    esc = 260 / w
    tw, th = int(w * esc), int(h * esc)
    hoja = Image.new('RGB', (tw * cols, th * filas), 'white')
    # En grises, como el mapa de la pantalla: sobre la tinta roja de la II no se
    # distingue el área pintada de la mancha.
    base = im.convert('L').convert('RGB').resize((tw, th))
    d0 = ImageDraw.Draw(hoja)
    for k, nombre in enumerate(orden):
        tile = base.copy()
        capa = Image.fromarray((areas[nombre] * 255).astype(np.uint8)).resize((tw, th))
        rojo = Image.new('RGB', (tw, th), (220, 30, 30))
        tile = Image.composite(Image.blend(tile, rojo, 0.55), tile, capa)
        x, y = (k % cols) * tw, (k // cols) * th
        hoja.paste(tile, (x, y))
        d0.text((x + 6, y + 6), nombre, fill=(0, 0, 0))
    salida = CONTROL.replace('.png', f'-{lamina}.png')
    hoja.save(salida)
    print(f'control {salida}')


if __name__ == '__main__':
    # Las dos láminas en la misma corrida: el archivo de salida las lleva a las
    # dos, así que generar una sola borraría la otra.
    resultado = {}
    for lamina in ZONAS:
        print(f'\n── lámina {lamina}')
        salida, vecinos, color, mascaras = main(lamina)
        resultado[lamina] = (salida, vecinos)
        control(color.convert('L'), mascaras, lamina)
    escribir_ts(resultado)
