#!/usr/bin/env python3
"""
Audita las áreas trazadas contra la tinta de la lámina.

    python3 auditar-areas.py I II III

De cada área mide su tamaño, en cuántas piezas quedó, cuánta de ella cae sobre
tinta y cuánto llena su propia caja. Marca las sospechosas:

  - RECTA: llena más del 85 % de su caja, o sea el recorte contra la tinta no
    hizo nada y quedó el rectángulo declarado (el caso de DdS24).
  - VACIA: menos de 300 px.
  - ENORME: más del 60 % de la mancha sin ser W.
  - SIN TINTA: menos del 40 % del área cae sobre tinta, y no es un área de
    espacio (las S son blanco por definición).
  - PARTIDA: más de seis piezas sin ser una de salpicaduras.
"""
import io, os, re, sys, json, urllib.request
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NUMERO = {'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7}
UMBRAL = 190
MINIMO_PIEZA = 2000
MINIMO_POR_LAMINA = {'III': 1500}


def entorno():
    env = {}
    with io.open(os.path.join(RAIZ, '.env.local'), encoding='utf-8') as f:
        for linea in f:
            if '=' in linea and not linea.strip().startswith('#'):
                k, v = linea.split('=', 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def bajar(n):
    import subprocess
    env = entorno()
    url = f"{env['SUPABASE_URL']}/storage/v1/object/psicotecnicos/laminas/rorschach/{n}.png"
    key = env['SUPABASE_SERVICE_KEY']
    out = subprocess.run(['curl', '-s', url, '-H', f'apikey: {key}', '-H', f'Authorization: Bearer {key}'],
                         capture_output=True, check=True).stdout
    return Image.open(io.BytesIO(out))


def areas_del_ts():
    """El objeto AREAS entero, pasado a JSON: el archivo es TS pero su valor es
    un literal, así que alcanza con entrecomillar las claves."""
    texto = io.open(os.path.join(RAIZ, 'lib', 'rorschach-areas.ts'), encoding='utf-8').read()
    cuerpo = texto[texto.index('export const AREAS'):]
    cuerpo = cuerpo[cuerpo.index('{'):cuerpo.index('\n};') + 2]
    cuerpo = re.sub(r'([\{,]\s*)([A-Za-z][A-Za-z0-9]*)\s*:', r'\1"\2":', cuerpo)
    cuerpo = re.sub(r',(\s*[\}\]])', r'\1', cuerpo)
    return json.loads(cuerpo)


def main(laminas):
    todas = areas_del_ts()
    for lamina in laminas:
        im = bajar(NUMERO[lamina]).convert('L')
        a = np.array(im)
        alto, ancho = a.shape
        tinta = a < UMBRAL
        lab, n = ndimage.label(tinta)
        tam = ndimage.sum(tinta, lab, range(1, n + 1))
        minimo = MINIMO_POR_LAMINA.get(lamina, MINIMO_PIEZA)
        mancha = np.isin(lab, [i + 1 for i in range(n) if tam[i] > minimo])
        total = mancha.sum()
        print(f'\n=== Lámina {lamina} · mancha {total} px ===')
        print(f"{'área':9} {'px':>8} {'% mancha':>9} {'piezas':>7} {'% tinta':>8} {'% caja':>7}  aviso")
        for area, partes in sorted(todas[lamina].items()):
            lienzo = Image.new('1', (ancho, alto), 0)
            d = ImageDraw.Draw(lienzo)
            if partes and partes[0] and isinstance(partes[0][0], (int, float)):
                partes = [partes]
            for p in partes:
                d.polygon([(x * ancho, y * alto) for x, y in p], fill=1)
            m = np.array(lienzo, dtype=bool)
            px = m.sum()
            if px == 0:
                print(f'{area:9} {0:>8} {"":>9} {"":>7} {"":>8} {"":>7}  VACIA')
                continue
            _, piezas = ndimage.label(m)
            sobre = (m & tinta).sum() / px * 100
            ys, xs = np.where(m)
            caja = (xs.max() - xs.min() + 1) * (ys.max() - ys.min() + 1)
            llena = px / caja * 100
            avisos = []
            espacio = 'S' in area
            if llena > 85: avisos.append('RECTA')
            if px < 300: avisos.append('VACIA')
            if area != 'W' and px > total * 0.6: avisos.append('ENORME')
            if not espacio and sobre < 40: avisos.append('SIN TINTA')
            if espacio and sobre > 40: avisos.append('CON TINTA')
            if piezas > 6: avisos.append(f'PARTIDA({piezas})')
            print(f'{area:9} {px:>8} {px/total*100:>8.1f}% {piezas:>7} {sobre:>7.0f}% {llena:>6.0f}%  {" ".join(avisos)}')


if __name__ == '__main__':
    main(sys.argv[1:] or ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'])
