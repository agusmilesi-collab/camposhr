#!/usr/bin/env python3
"""
Una imagen por área, grande, para trazar la zona con precisión.

    python3 scripts/zonas-por-area.py I

Deja `~/Desktop/Lámina 1/` con un PNG por área (`D3.png`, `Dd22.png`, …), cada
uno con la lámina entera, tal cual es, a un tamaño que deja ver sus matices, y
el borde de la tinta marcado con una línea fina: ese borde es hasta dónde va a
recortar el programa, y sobre la foto sola se pierde en el trasluz del papel. Se abre el que se quiera corregir,
se hace zoom y se traza **en azul** el recinto del área: un rectángulo si
alcanza, o el contorno libre si el rectángulo se lleva tinta de otra.

Las quince imágenes comparten el mismo encuadre, así que la geometría es una
sola y vive en `geometria.json`, al lado. `leer-zonas-rorschach.py` lee esa
carpeta si existe, y si no, la hoja de una página de `zonas-para-marcar.py`.

Lo que se traza es el recinto, no el borde del área: el contorno final lo pone
la tinta de la mancha al recortarse contra él. Lo que importa del trazo es que
no se lleve tinta vecina que sea de otra locación.
"""
import io, json, os, re, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RAIZ, 'scripts'))
import importlib.util

ESCALA = 3          # el triple de la lámina: 4500 x 3000 para la I
NUMERO = {'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6,
          'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10}
# La página de localización del cuadernillo, para tener la referencia al lado
# mientras se traza. Se copia a la carpeta con el nombre `_cuadernillo.png`.
CUADERNILLO = os.path.expanduser('~/Desktop/Entrevistador')


# Las áreas de cada lámina, leídas de la página de localización del cuadernillo
# (las fotos y los PDF de `~/Desktop/Entrevistador`). Sirven para armar la
# carpeta de una lámina que todavía no tiene ninguna zona declarada: cada área
# se traza de cero sobre su propia imagen.
SIN_TRAZAR = {
    'IV': ['W', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7',
           'Dd21', 'Dd22', 'Dd23', 'DdS24', 'Dd25', 'Dd26', 'Dd27', 'Dd28',
           'DdS29', 'Dd30', 'Dd31', 'Dd32', 'Dd33'],
    'V': ['W', 'D1', 'D4', 'D6', 'D7', 'D9', 'D10',
          'Dd22', 'Dd23', 'Dd24', 'Dd25', 'Dd26', 'DdS27', 'DdS28', 'DdS29',
          'Dd30', 'Dd31', 'Dd32', 'Dd33', 'Dd34', 'Dd35'],
    'VI': ['W', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D8', 'D12',
           'Dd21', 'Dd22', 'Dd23', 'Dd24', 'Dd25', 'Dd26', 'Dd27', 'Dd28',
           'Dd29', 'DdS30', 'Dd31', 'Dd32', 'Dd33'],
    'VII': ['W', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'DS7', 'D8', 'D9', 'DS10',
            'Dd21', 'Dd22', 'Dd23', 'Dd24', 'Dd25', 'Dd26', 'Dd27', 'Dd28'],
    'VIII': ['W', 'D1', 'D2', 'D3', 'DS3', 'D4', 'D5', 'D6', 'D7', 'D8',
             'Dd21', 'Dd22', 'Dd23', 'Dd24', 'Dd25', 'Dd26', 'Dd27', 'DdS28',
             'DdS29', 'Dd30', 'Dd31', 'DdS32', 'Dd33'],
    'IX': ['W', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D8', 'DS8', 'D9', 'D11', 'D12',
           'Dd21', 'Dd22', 'DdS22', 'DdS23', 'Dd24', 'Dd25', 'Dd26', 'Dd27',
           'Dd28', 'DdS29', 'Dd30', 'Dd31', 'DdS32', 'Dd33', 'Dd34', 'Dd35'],
    'X': ['W', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10',
          'D11', 'D12', 'D13', 'D14', 'D15',
          'Dd21', 'DdS22', 'Dd25', 'Dd26', 'Dd27', 'Dd28', 'DdS29', 'DdS30',
          'Dd31', 'Dd32', 'Dd33', 'Dd34', 'Dd35'],
}


def hoja():
    """Reusa lo que ya sabe la hoja de una página: bajar, cortes y zonas."""
    spec = importlib.util.spec_from_file_location(
        'zpm', os.path.join(RAIZ, 'scripts', 'zonas-para-marcar.py'))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def tipografia(tam, negrita=False):
    cual = 'Arial Bold.ttf' if negrita else 'Arial.ttf'
    try:
        return ImageFont.truetype('/System/Library/Fonts/Supplemental/' + cual, tam)
    except OSError:
        return ImageFont.load_default()


def main(lamina='I'):
    z = hoja()
    im = z.bajar(NUMERO[lamina])
    ancho, alto = im.size

    umbral, minimo, por_lamina = z.cortes()
    tinta = np.array(im.convert('L')) < umbral
    lab, n = ndimage.label(tinta)
    tam = ndimage.sum(tinta, lab, range(1, n + 1))
    corte = por_lamina.get(lamina, minimo)
    mancha = np.isin(lab, [i + 1 for i in range(n) if tam[i] > corte])
    ys, xs = np.where(mancha)
    cx0, cx1, cy0, cy1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())

    # La lámina como es, no su silueta: lo que se traza son recintos sobre la
    # mancha, y en negro pleno no se ven los matices que separan una zona de la
    # de al lado. El borde de la tinta va encima, en una línea fina, porque es
    # el corte con el que el programa va a recortar.
    grande = im.convert('RGB').resize((ancho * ESCALA, alto * ESCALA), Image.LANCZOS)
    borde = ndimage.binary_dilation(mancha, np.ones((3, 3))) & ~ndimage.binary_erosion(mancha, np.ones((3, 3)))
    borde = np.array(Image.fromarray((borde * 255).astype('uint8')).resize(
        (ancho * ESCALA, alto * ESCALA), Image.NEAREST)) > 128
    pixeles = np.array(grande)
    pixeles[borde] = (235, 120, 40)
    negro = Image.fromarray(pixeles)

    declaradas = z.zonas_declaradas(lamina)
    nombres = sorted(declaradas, key=lambda x: (x[:2] != 'Dd', len(x), x))
    if not nombres:
        # La lámina todavía no tiene zonas declaradas: las áreas salen de la
        # lista del cuadernillo y cada una se traza de cero.
        nombres = SIN_TRAZAR.get(lamina, [])

    carpeta = os.path.expanduser(f'~/Desktop/Lámina {NUMERO[lamina]}')
    os.makedirs(carpeta, exist_ok=True)

    for nombre in nombres:
        hoja_area = negro.copy()
        d = ImageDraw.Draw(hoja_area)
        if nombre in declaradas:
            zx0, zy0, zx1, zy1 = declaradas[nombre]
            ux0 = (cx0 + (cx1 - cx0) * zx0 / 100) * ESCALA
            ux1 = (cx0 + (cx1 - cx0) * zx1 / 100) * ESCALA
            uy0 = (cy0 + (cy1 - cy0) * zy0 / 100) * ESCALA
            uy1 = (cy0 + (cy1 - cy0) * zy1 / 100) * ESCALA
            # La zona de hoy, en gris: el lector solo mira el azul, así que no
            # estorba, y muestra de dónde se parte.
            d.rectangle([min(ux0, ux1), uy0, max(ux0, ux1), uy1], outline='#9a9a9a', width=4)
        d.text((24, 20), f'Lámina {lamina} · {nombre}', fill='#2b4468', font=tipografia(64, True))
        d.text((24, 96), 'el recinto en azul, dónde va el nombre en verde', fill='#6b7280', font=tipografia(38))
        hoja_area.save(os.path.join(carpeta, f'{nombre}.png'))

    geometria = {'lamina': lamina, 'escala': float(ESCALA), 'caja': [cx0, cy0, cx1, cy1],
                 'areas': nombres, 'tamano': [ancho * ESCALA, alto * ESCALA]}
    io.open(os.path.join(carpeta, 'geometria.json'), 'w', encoding='utf-8').write(
        json.dumps(geometria, indent=2, ensure_ascii=False))
    print(f'{carpeta} · {len(nombres)} áreas · {ancho * ESCALA} x {alto * ESCALA} cada una')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'I')
