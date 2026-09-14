#!/usr/bin/env python3
"""
Mide los puntos con los que se marcó dónde va el nombre de cada área.

    python3 scripts/leer-tags-rorschach.py         # la hoja de una página
    python3 scripts/leer-tags-rorschach.py IV      # la carpeta de esa lámina

De la hoja de una página lee el punto **azul** de cada recuadro. De la carpeta
`~/Desktop/Lámina <n> con dibujo` lee el punto **verde** de cada imagen, que es
el color con el que se marca el nombre cuando el trazo del área va en azul.

En los dos casos imprime la tabla lista para pegar en `Capturador.tsx`, en
fracción de la imagen de la lámina.
"""
import io, os, subprocess, sys
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


def verde(imagen):
    """El color con el que se marca dónde va el nombre, para no confundirlo con
    el trazo del área, que va en azul."""
    M = np.array(imagen.convert('RGB')).astype(int)
    return (M[:, :, 1] > 110) & (M[:, :, 1] - M[:, :, 0] > 60) & (M[:, :, 1] - M[:, :, 2] > 60)


def centro(mascara):
    """El centro de la marca más grande, en fracción de la imagen."""
    l, n = ndimage.label(mascara, structure=np.ones((3, 3)))
    if n == 0:
        return None
    tam = ndimage.sum(mascara, l, range(1, n + 1))
    yy, xx = np.where(l == int(np.argmax(tam)) + 1)
    alto, ancho = mascara.shape
    return ((xx.min() + xx.max()) / 2 / ancho, (yy.min() + yy.max()) / 2 / alto)


def de_la_carpeta(lamina_romana):
    """Los puntos verdes de la carpeta con una imagen por área."""
    import json
    n = {'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6,
         'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10}[lamina_romana]
    # Listar el Escritorio lo bloquea macOS, así que la carpeta se busca por
    # nombre entre las formas en que se suele copiar, y si no, se pasa su ruta
    # como segundo argumento.
    candidatas = [os.path.expanduser(f'~/Desktop/Lámina {n}{sufijo}')
                  for sufijo in (' con dibujo', ' 2', ' marcada', ' copia', '')]
    if len(sys.argv) > 2:
        candidatas.insert(0, os.path.expanduser(sys.argv[2]))
    carpetas = [c for c in candidatas
                if os.path.isdir(c) and os.path.exists(os.path.join(c, 'geometria.json'))]
    if not carpetas:
        print(f'No está la carpeta de la lámina {lamina_romana}.')
        return
    carpeta = carpetas[0]
    geo = json.load(io.open(os.path.join(carpeta, 'geometria.json'), encoding='utf-8'))
    print(f'  // Medido sobre {carpeta}, en fracción de la imagen.')
    print(f'  {lamina_romana}: {{')
    for nombre in geo['areas']:
        archivo = os.path.join(carpeta, f'{nombre}.png')
        if not os.path.exists(archivo):
            continue
        punto = centro(verde(Image.open(archivo)))
        if punto is None:
            continue
        print(f'    {nombre}: [{punto[0]:.3f}, {punto[1]:.3f}],')
    print('  },')


def main():
    if len(sys.argv) > 1:
        return de_la_carpeta(sys.argv[1])
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
