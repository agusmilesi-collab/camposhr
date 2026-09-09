#!/usr/bin/env python3
"""
La hoja para decidir dónde va el nombre de cada área.

    python3 scripts/tags-rorschach.py

Dibuja las veinte áreas, una por recuadro, con el nombre en el lugar que hoy le
da el capturador. Agustín marca con un punto dónde quiere que vaya, y
`leer-tags-rorschach.py` mide esos puntos y los pasa a porcentaje de la caja de
la mancha, que es la unidad en la que el componente los guarda.

Es el mismo camino que sirvió para corregir las áreas: marcar sobre la imagen y
medir, en vez de estimar la posición a ojo.
"""
import io, os, subprocess
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.expanduser('~/Desktop/tags-rorschach.png')
AIRE = 0.1
AIRE_X = 0.05
DONDE = {'Dd25': 'derecha', 'Dd24': 'dentro', 'D2': 'dentro-derecha'}
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


def areas():
    """Los polígonos de `lib/rorschach-areas.ts`, en 0..1 sobre la imagen."""
    import json, re
    t = io.open(os.path.join(RAIZ, 'lib', 'rorschach-areas.ts'), encoding='utf-8').read()
    cuerpo = t[t.index('export const AREAS'):t.index('export const ADYACENTES')]
    salida = {}
    for m in re.finditer(r'\n  ([A-Za-z0-9]+): \[\n(.*?)\n  \],', cuerpo, re.S):
        salida[m.group(1)] = [json.loads(p) for p in re.findall(r'\[\[.*?\]\]', m.group(2), re.S)]
    return salida


def donde(partes, como):
    """El mismo cálculo que hace el capturador, para dibujar el nombre igual."""
    mayor = max(partes, key=lambda p: abs(sum(
        p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1]
        for i in range(len(p)))) / 2)
    if como in ('derecha', 'dentro-derecha'):
        mayor = max(partes, key=lambda p: sum(q[0] for q in p) / len(p))
    x = sum(q[0] for q in mayor) / len(mayor)
    arriba = min(q[1] for q in mayor)
    abajo = max(q[1] for q in mayor)
    medio = (arriba + abajo) / 2
    if como == 'dentro-derecha':
        return x, medio
    if como == 'derecha':
        return max(q[0] for q in mayor) + AIRE_X, medio
    if como == 'dentro':
        return x, min(arriba + AIRE, medio)
    return (x, arriba - AIRE) if arriba - AIRE >= 0.06 else (x, min(arriba + AIRE, medio))


def main():
    im = lamina()
    A = areas()
    w, h = im.size
    esc = 300 / w
    tw, th = int(w * esc), int(h * esc)
    cols = 4
    filas = (len(ORDEN) + cols - 1) // cols
    hoja = Image.new('RGB', (tw * cols, th * filas), 'white')
    base = im.convert('RGB').resize((tw, th))
    d0 = ImageDraw.Draw(hoja)
    for k, nombre in enumerate(ORDEN):
        partes = A.get(nombre) or []
        if not partes:
            continue
        tile = base.copy()
        d = ImageDraw.Draw(tile, 'RGBA')
        for parte in partes:
            d.polygon([(px * tw, py * th) for px, py in parte], fill=(220, 30, 30, 110),
                      outline=(200, 20, 20, 255))
        x, y = donde(partes, DONDE.get(nombre))
        # La caja del nombre se mide a mano: la fuente de respaldo de PIL no
        # sabe medirse sola en todas las versiones.
        cx, cy = x * tw, y * th
        ancho, alto = len(nombre) * 6 + 8, 13
        d.rectangle([cx - ancho / 2, cy - alto / 2, cx + ancho / 2, cy + alto / 2],
                    fill=(255, 255, 255, 235))
        d.text((cx - ancho / 2 + 4, cy - 5), nombre, fill=(20, 20, 20))
        px, py = (k % cols) * tw, (k // cols) * th
        hoja.paste(tile, (px, py))
        d0.rectangle([px, py, px + tw - 1, py + th - 1], outline=(210, 210, 210))
        d0.text((px + 6, py + 6), nombre, fill=(0, 0, 0))
    hoja.save(SALIDA)
    print(f'escrito {SALIDA}')


if __name__ == '__main__':
    main()
