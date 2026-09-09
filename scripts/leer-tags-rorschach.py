#!/usr/bin/env python3
"""
Mide los puntos con los que se marcó dónde va el nombre de cada área.

    python3 scripts/leer-tags-rorschach.py

Lee `~/Desktop/tags-rorschach.png` con las marcas encima, busca la mancha azul
de cada recuadro y la pasa a porcentaje de la caja de la mancha, que es la
unidad en la que el capturador guarda las posiciones. Imprime la tabla lista
para pegar en `Capturador.tsx`.
"""
import io, os, subprocess
import numpy as np
from PIL import Image
from scipy import ndimage

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MARCADA = os.path.expanduser('~/Desktop/tags-rorschach.png')
ORDEN = ['W', 'D1', 'Dd24', 'D2', 'D3', 'Dd22', 'Dd28', 'D4', 'Dd23', 'Dd25',
         'D7', 'Dd21', 'Dd33', 'Dd34', 'Dd35', 'Dd27', 'DdS29', 'DdS30',
         'Dd31', 'DdS26', 'DdS32']


def lamina():
    env = {}
    with io.open(os.path.join(RAIZ, '.env.local'), encoding='utf-8') as f:
        for linea in f:
            if '=' in linea and not linea.strip().startswith('#'):
                k, v = linea.split('=', 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    url = f"{env['SUPABASE_URL']}/storage/v1/object/psicotecnicos/laminas/rorschach/1.png"
    key = env['SUPABASE_SERVICE_KEY']
    out = subprocess.run(['curl', '-s', url, '-H', f'apikey: {key}',
                          '-H', f'Authorization: Bearer {key}'],
                         capture_output=True, check=True).stdout
    return Image.open(io.BytesIO(out))


def main():
    im = lamina()
    w, h = im.size
    esc = 300 / w
    tw, th = int(w * esc), int(h * esc)
    cols = 4

    M = np.array(Image.open(MARCADA).convert('RGB')).astype(int)
    azul = (M[:, :, 2] > 110) & (M[:, :, 2] - M[:, :, 0] > 60) & (M[:, :, 2] - M[:, :, 1] > 60)

    print('  // Medido sobre la hoja marcada, en fracción de la imagen.')
    for k, nombre in enumerate(ORDEN):
        x, y = (k % cols) * tw, (k // cols) * th
        sub = azul[y:y + th, x:x + tw]
        if sub.sum() < 60:
            continue
        l, n = ndimage.label(sub, structure=np.ones((3, 3)))
        tam = ndimage.sum(sub, l, range(1, n + 1))
        i = int(np.argmax(tam)) + 1
        yy, xx = np.where(l == i)
        cx = (xx.min() + xx.max()) / 2 / tw
        cy = (yy.min() + yy.max()) / 2 / th
        print(f"  {nombre}: [{cx:.3f}, {cy:.3f}],")


if __name__ == '__main__':
    main()
