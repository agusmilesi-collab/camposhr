#!/usr/bin/env python3
"""
Mide las zonas redibujadas sobre la hoja de `zonas-para-marcar.py`.

    python3 scripts/leer-zonas-rorschach.py III

Lee `~/Desktop/zonas-lamina3-para-marcar.png` con los rectángulos azules
encima, y la geometría que dejó el generador al lado. De cada recuadro toma
todo lo azul, se queda con la caja que lo encierra y la pasa a porcentaje de la
caja de la mancha, que es la unidad de `ZONAS` y `ABIERTOS`. Imprime las líneas
listas para pegar en `areas-rorschach.py`.

Las áreas sin azul no salen: se marcan solo las que hay que corregir.

Se mide la caja del trazo, con su grosor incluido, así que el rectángulo se
dibuja pisando el borde que se quiere, no por fuera.
"""
import io, json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

NUMERO = {'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6,
          'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10}
MINIMO_AZUL = 60


def main(lamina='III'):
    n = NUMERO[lamina]
    marcada = os.path.expanduser(f'~/Desktop/zonas-lamina{n}-para-marcar.png')
    geo = json.load(io.open(marcada.replace('-para-marcar.png', '-geometria.json'), encoding='utf-8'))

    M = np.array(Image.open(marcada).convert('RGB')).astype(int)
    # El mismo corte de azul que usa `leer-tags-rorschach.py`, para marcar las
    # dos hojas con el mismo lápiz.
    azul = (M[:, :, 2] > 110) & (M[:, :, 2] - M[:, :, 0] > 60) & (M[:, :, 2] - M[:, :, 1] > 60)

    cx0, cy0, cx1, cy1 = geo['caja']
    esc = geo['escala']
    ancho_caja, alto_caja = cx1 - cx0, cy1 - cy0

    salidas = []
    for r in geo['recuadros']:
        sub = azul[r['y']:r['y'] + r['h'], r['x']:r['x'] + r['w']]
        if sub.sum() < MINIMO_AZUL:
            continue
        yy, xx = np.where(sub)
        # De píxel de la hoja a píxel de la lámina, y de ahí a porcentaje de la
        # caja de la mancha.
        a = ((xx.min() / esc) - cx0) / ancho_caja * 100
        b = ((yy.min() / esc) - cy0) / alto_caja * 100
        c = ((xx.max() / esc) - cx0) / ancho_caja * 100
        e = ((yy.max() / esc) - cy0) / alto_caja * 100
        piezas = ndimage.label(sub, structure=np.ones((3, 3)))[1]
        salidas.append((r['nombre'], (round(a), round(b), round(c), round(e)), int(sub.sum()), piezas))

    if not salidas:
        print('No hay ninguna marca azul en la hoja.')
        return

    print(f'# Medido sobre la hoja marcada de la lámina {lamina}.')
    print(f'# {len(salidas)} área(s) con marca, en porcentaje de la caja de la mancha.\n')
    for nombre, z, px, piezas in salidas:
        abierto = nombre.startswith('DdS')
        donde = "ABIERTOS['%s']" % lamina if abierto else "ZONAS['%s']" % lamina
        print(f"    {nombre + ':':8} {z}    # {donde}, {px} px de trazo en {piezas} pieza(s)")


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'III')
