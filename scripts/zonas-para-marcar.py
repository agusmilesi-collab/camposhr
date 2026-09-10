#!/usr/bin/env python3
"""
La hoja donde se redibujan las zonas de las áreas de una lámina.

    python3 scripts/zonas-para-marcar.py III

Deja `~/Desktop/zonas-lamina3-para-marcar.png` con un recuadro por área: la
mancha en negro pleno, recortada con el mismo umbral con el que
`areas-rorschach.py` traza las áreas, y la zona que hoy tiene cada una marcada
con un rectángulo gris.

Encima de esa hoja se dibuja **en azul** el rectángulo que debería tener cada
área, y `leer-zonas-rorschach.py` lo mide. Se dibuja solo el de las que hay que
corregir: las que quedan sin azul no se tocan.

La mancha va en negro pleno y no en la foto en grises porque lo que se está
marcando es hasta dónde llega la tinta, y sobre la foto el borde se pierde en
el trasluz del papel. La geometría de la hoja queda escrita al lado, en
`zonas-lamina3-geometria.json`, para que el lector no tenga que adivinarla.
"""
import io, json, os, re, sys, urllib.request
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NUMERO = {'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6,
          'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10}
ANCHO_RECUADRO = 600
COLUMNAS = 4
ALTO_ROTULO = 34


def entorno():
    env = {}
    with io.open(os.path.join(RAIZ, '.env.local'), encoding='utf-8') as f:
        for linea in f:
            if '=' in linea and not linea.strip().startswith('#'):
                k, v = linea.split('=', 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def bajar(n):
    env = entorno()
    url = f"{env['SUPABASE_URL']}/storage/v1/object/psicotecnicos/laminas/rorschach/{n}.png"
    key = env['SUPABASE_SERVICE_KEY']
    pedido = urllib.request.Request(url, headers={'apikey': key, 'Authorization': f'Bearer {key}'})
    return Image.open(io.BytesIO(urllib.request.urlopen(pedido).read()))


def cortes():
    """El umbral y el mínimo de pieza con los que se trazan las áreas."""
    fuente = io.open(os.path.join(RAIZ, 'scripts/areas-rorschach.py'), encoding='utf-8').read()
    umbral = int(re.search(r'^UMBRAL = (\d+)', fuente, re.M).group(1))
    minimo = int(re.search(r'^MINIMO_PIEZA = (\d+)', fuente, re.M).group(1))
    por_lamina = eval(re.search(r'^MINIMO_POR_LAMINA = (\{.*\})', fuente, re.M).group(1))
    return umbral, minimo, por_lamina


def zonas_declaradas(lamina):
    """Lo que hoy dice el programa: {área: (x0, y0, x1, y1)}, para el gris de referencia."""
    fuente = io.open(os.path.join(RAIZ, 'scripts/areas-rorschach.py'), encoding='utf-8').read()
    out = {}
    ini = re.search(r"^ZONAS = \{$", fuente, re.M).end()
    bloque = fuente[ini:fuente.index('\n}\n', ini)]
    m = re.search(r"^    '%s': \{$" % lamina, bloque, re.M)
    if m:
        cuerpo = bloque[m.end():bloque.index('\n    },', m.end())]
        for a in re.finditer(r"^        '([A-Za-z0-9]+)':\s*\{'zonas': \[(\(.*?\))\]", cuerpo, re.M):
            out[a.group(1)] = eval(a.group(2))
    ab = re.search(r"^ABIERTOS = \{$", fuente, re.M)
    cuerpo = fuente[ab.end():fuente.index('\n}\n', ab.end())]
    m = re.search(r"^    '%s': (\{.*\}),$" % lamina, cuerpo, re.M)
    if m:
        out.update(eval(m.group(1)))
    return out


def main(lamina='III'):
    im = bajar(NUMERO[lamina])
    ancho, alto = im.size

    umbral, minimo, por_lamina = cortes()
    tinta = np.array(im.convert('L')) < umbral
    lab, n = ndimage.label(tinta)
    tam = ndimage.sum(tinta, lab, range(1, n + 1))
    corte = por_lamina.get(lamina, minimo)
    mancha = np.isin(lab, [i + 1 for i in range(n) if tam[i] > corte])
    ys, xs = np.where(mancha)
    cx0, cx1, cy0, cy1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())

    negro = Image.fromarray(np.where(mancha[:, :, None], 0, 255).astype('uint8').repeat(3, 2))
    esc = ANCHO_RECUADRO / ancho
    rw, rh = ANCHO_RECUADRO, int(alto * esc)
    negro = negro.resize((rw, rh), Image.LANCZOS)

    declaradas = zonas_declaradas(lamina)
    nombres = sorted(declaradas, key=lambda x: (x[:2] != 'Dd', len(x), x))
    filas = (len(nombres) + COLUMNAS - 1) // COLUMNAS
    hoja = Image.new('RGB', (COLUMNAS * rw, filas * (rh + ALTO_ROTULO) + 46), 'white')
    d = ImageDraw.Draw(hoja)

    def tipografia(tam, negrita=False):
        cual = 'Arial Bold.ttf' if negrita else 'Arial.ttf'
        try:
            return ImageFont.truetype('/System/Library/Fonts/Supplemental/' + cual, tam)
        except OSError:
            return ImageFont.load_default()

    d.text((10, 12), f'Lámina {lamina} · dibujar EN AZUL el rectángulo de cada zona a corregir; '
                     f'el gris es la que tiene hoy', fill='black', font=tipografia(24, True))

    recuadros = []
    for k, nombre in enumerate(nombres):
        x = (k % COLUMNAS) * rw
        y = 46 + (k // COLUMNAS) * (rh + ALTO_ROTULO)
        d.text((x + 8, y + 7), nombre, fill='black', font=tipografia(22, True))
        py = y + ALTO_ROTULO
        hoja.paste(negro, (x, py))
        d.rectangle([x, py, x + rw - 1, py + rh - 1], outline='#cccccc')

        # La zona de hoy, en gris: el lector solo mira el azul, así que no
        # estorba, y muestra de dónde se parte.
        zx0, zy0, zx1, zy1 = declaradas[nombre]
        ux0 = (cx0 + (cx1 - cx0) * zx0 / 100) * esc
        ux1 = (cx0 + (cx1 - cx0) * zx1 / 100) * esc
        uy0 = (cy0 + (cy1 - cy0) * zy0 / 100) * esc
        uy1 = (cy0 + (cy1 - cy0) * zy1 / 100) * esc
        d.rectangle([x + min(ux0, ux1), py + uy0, x + max(ux0, ux1), py + uy1],
                    outline='#b0b0b0', width=2)

        recuadros.append({'nombre': nombre, 'x': x, 'y': py, 'w': rw, 'h': rh})

    salida = os.path.expanduser(f'~/Desktop/zonas-lamina{NUMERO[lamina]}-para-marcar.png')
    hoja.save(salida)
    geometria = {
        'lamina': lamina,
        'escala': esc,
        'caja': [cx0, cy0, cx1, cy1],
        'recuadros': recuadros,
    }
    io.open(salida.replace('-para-marcar.png', '-geometria.json'), 'w', encoding='utf-8').write(
        json.dumps(geometria, indent=2, ensure_ascii=False))
    print(salida, hoja.size, len(nombres), 'áreas')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'III')
