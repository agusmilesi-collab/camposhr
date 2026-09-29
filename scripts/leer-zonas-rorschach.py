#!/usr/bin/env python3
"""
Mide las zonas redibujadas sobre la hoja de `zonas-para-marcar.py`.

    python3 scripts/leer-zonas-rorschach.py III

Lee las marcas azules de dos lugares: la carpeta `~/Desktop/Lámina 3/`, con una
imagen por área (la que deja `zonas-por-area.py`), o la hoja de una página
`~/Desktop/zonas-lamina3-para-marcar.png`. Si la carpeta está, gana ella. De cada recuadro toma
todo lo azul, se queda con la caja que lo encierra y la pasa a porcentaje de la
caja de la mancha, que es la unidad de `ZONAS` y `ABIERTOS`. Imprime las líneas
listas para pegar en `areas-rorschach.py`.

Las áreas sin azul no salen: se marcan solo las que hay que corregir.

Se mide la caja del trazo, con su grosor incluido, así que el rectángulo se
dibuja pisando el borde que se quiere, no por fuera.

**El trazo no tiene que ser un rectángulo.** Cuando la zona se declara con un
rectángulo y adentro cae tinta que no es del área (un ala que se separa del
cuerpo por una diagonal, como D7 de la I), se rodea el área con un contorno
libre: el programa lo mide igual y devuelve, además de la caja, la línea
`'poli'` con el contorno en porcentaje. Se pega la que corresponda.
""" 
import io, json, os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from skimage import measure

NUMERO = {'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6,
          'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10}
MINIMO_AZUL = 60


def extremos(mascara):
    """Las dos puntas del trazo, siguiéndolo: dos recorridos en anchura, como
    el diámetro de un árbol. En un trazo cerrado caen pegadas y la línea que
    las une no cambia nada; en uno abierto, es lo que lo cierra."""
    idx = np.argwhere(mascara)
    if len(idx) == 0:
        return None, None

    def lejos_de(inicio):
        dist = -np.ones(mascara.shape, dtype=int)
        dist[inicio] = 0
        frente = [inicio]
        while frente:
            nuevos = []
            for y, x in frente:
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = y + dy, x + dx
                        if (0 <= ny < mascara.shape[0] and 0 <= nx < mascara.shape[1]
                                and mascara[ny, nx] and dist[ny, nx] < 0):
                            dist[ny, nx] = dist[y, x] + 1
                            nuevos.append((ny, nx))
            frente = nuevos
        return np.unravel_index(int(np.argmax(dist)), dist.shape)

    a = lejos_de(tuple(idx[0]))
    return a, lejos_de(a)


def encerrado(trazo):
    """Lo que el trazo encierra, contando los bordes de la imagen: un recinto
    grande se traza siguiendo el contorno de la mancha y se sale por abajo, y
    ahí no hay hueco cerrado que rellenar. Afuera es lo que se alcanza desde las
    cuatro esquinas sin cruzar el trazo."""
    libre, cuantas = ndimage.label(~trazo)
    alto, ancho = trazo.shape
    esquinas = [(0, 0), (0, ancho - 1), (alto - 1, 0), (alto - 1, ancho - 1)]
    fuera = {libre[y, x] for y, x in esquinas if libre[y, x] > 0}
    if not fuera:
        return ndimage.binary_fill_holes(trazo)
    return ~np.isin(libre, list(fuera))


def azul_de(imagen):
    """El mismo corte de azul que usa `leer-tags-rorschach.py`, para marcar
    todas las hojas con el mismo lápiz."""
    M = np.array(imagen.convert('RGB')).astype(int)
    return (M[:, :, 2] > 110) & (M[:, :, 2] - M[:, :, 0] > 60) & (M[:, :, 2] - M[:, :, 1] > 60)


def piezas_a_leer(lamina):
    """De dónde salen las marcas: la carpeta con una imagen por área, si está,
    y si no la hoja de una página. Devuelve (geometría, [(nombre, máscara)])."""
    n = NUMERO[lamina]
    # Listar el Escritorio lo bloquea macOS, así que la carpeta se busca por
    # nombre entre las formas en que se suele copiar, y si no, se pasa su ruta
    # como segundo argumento.
    candidatas = [os.path.expanduser(f'~/Desktop/Lámina {n}{sufijo}')
                  for sufijo in (' con dibujo', ' 2', ' marcada', ' copia', '')]
    if len(sys.argv) > 2:
        candidatas.insert(0, os.path.expanduser(sys.argv[2]))
    posibles = [c for c in candidatas
                if os.path.isdir(c) and os.path.exists(os.path.join(c, 'geometria.json'))]
    carpeta = posibles[0] if posibles else ''
    if carpeta:
        geo = json.load(io.open(os.path.join(carpeta, 'geometria.json'), encoding='utf-8'))
        piezas = []
        for nombre in geo['areas']:
            archivo = os.path.join(carpeta, f'{nombre}.png')
            if not os.path.exists(archivo):
                continue
            im = Image.open(archivo)
            # La imagen marcada puede volver de otro tamaño: varios programas de
            # dibujo la guardan reescalada. La escala sale del archivo que llegó
            # y no de la que tenía al generarse, o el trazo cae corrido.
            factor = im.size[0] / geo['tamano'][0]
            piezas.append((nombre, azul_de(im), geo['escala'] * factor))
        print(f'# Leído de {carpeta}')
        return geo, piezas
    marcada = os.path.expanduser(f'~/Desktop/zonas-lamina{n}-para-marcar.png')
    geo = json.load(io.open(marcada.replace('-para-marcar.png', '-geometria.json'), encoding='utf-8'))
    azul = azul_de(Image.open(marcada))
    piezas = [(r['nombre'], azul[r['y']:r['y'] + r['h'], r['x']:r['x'] + r['w']], geo['escala'])
              for r in geo['recuadros']]
    print(f'# Leído de {marcada}')
    return geo, piezas


def main(lamina='III'):
    geo, piezas = piezas_a_leer(lamina)

    cx0, cy0, cx1, cy1 = geo['caja']
    ancho_caja, alto_caja = cx1 - cx0, cy1 - cy0

    salidas = []
    abiertos = []
    for nombre, sub, esc in piezas:
        if sub.sum() < MINIMO_AZUL:
            continue
        yy, xx = np.where(sub)
        # De píxel de la hoja a píxel de la lámina, y de ahí a porcentaje de la
        # caja de la mancha.
        a = ((xx.min() / esc) - cx0) / ancho_caja * 100
        b = ((yy.min() / esc) - cy0) / alto_caja * 100
        c = ((xx.max() / esc) - cx0) / ancho_caja * 100
        e = ((yy.max() / esc) - cy0) / alto_caja * 100
        trozos = ndimage.label(sub, structure=np.ones((3, 3)))[1]

        # El contorno, para cuando el trazo no es un rectángulo. Se rellena lo
        # que encierra y se toma su borde: así vale igual un óvalo, una
        # diagonal o una L.
        # El trazo, cerrado por sus dos puntas y con lo de adentro relleno.
        # Un área puede venir en varios recintos (DdS22 de la X: el cuerpo, los
        # amarillos y el verde) o con un recinto adentro de otro, que es un
        # hueco (DdS29 de la X deja afuera la figurita amarilla). Cada recinto se
        # rellena por separado y se combinan pares-impares: lo que queda adentro
        # de dos recintos se descuenta. Los pedazos de trazo chicos al lado del
        # mayor son manchas del lápiz y no cuentan.
        cerrado_todo = ndimage.binary_closing(sub, np.ones((5, 5)))
        piezas_trazo, cuantas_trazo = ndimage.label(cerrado_todo, structure=np.ones((3, 3)))
        tam_trazo = ndimage.sum(cerrado_todo, piezas_trazo, range(1, cuantas_trazo + 1))
        relleno = np.zeros_like(cerrado_todo)
        trazo_valido = np.zeros_like(cerrado_todo)
        for k in range(cuantas_trazo):
            if tam_trazo[k] < 0.02 * tam_trazo.max():
                continue
            cerrado = piezas_trazo == k + 1
            chico = np.array(Image.fromarray((cerrado * 255).astype('uint8')).resize(
                (max(1, cerrado.shape[1] // 4), max(1, cerrado.shape[0] // 4)), Image.NEAREST)) > 128
            punta1, punta2 = extremos(chico)
            if punta1 is not None and punta2 is not None:
                lienzo = Image.fromarray((cerrado * 255).astype('uint8'))
                ImageDraw.Draw(lienzo).line(
                    [(punta2[1] * 4, punta2[0] * 4), (punta1[1] * 4, punta1[0] * 4)],
                    fill=255, width=9)
                cerrado = np.array(lienzo) > 128
            relleno ^= encerrado(cerrado)
            trazo_valido |= cerrado
        cerrado = trazo_valido

        yy, xx = np.where(cerrado)
        caja_px = (xx.max() - xx.min() + 1) * (yy.max() - yy.min() + 1)
        # Medido sobre las láminas ya trazadas: un recinto llena entre el 22 %
        # y el 88 % de su caja. Menos que eso es un trazo que no encierra nada.
        if relleno.sum() / caja_px < 0.20:
            abiertos.append(nombre)
            continue
        recto = relleno.sum() / caja_px > 0.9
        poli = None
        if not recto:
            bordes = [b for b in measure.find_contours(relleno.astype(float), 0.5) if len(b) > 20]
            polis = []
            for borde in sorted(bordes, key=len, reverse=True):
                # El contorno sigue al trazo, no lo convierte en una figura: se
                # simplifica lo justo para que no queden mil puntos pegados, y
                # si aun así son muchos se afloja de a poco. Una mancha no tiene
                # lados rectos, así que con tolerancia alta el área dejaba de
                # ser la que se dibujó.
                aprox = measure.approximate_polygon(borde, tolerance=1.5)
                tolerancia = 1.5
                while len(aprox) > 120 and tolerancia < 12:
                    tolerancia += 1.5
                    aprox = measure.approximate_polygon(borde, tolerance=tolerancia)
                pts = [
                    (
                        round(((px_ / esc) - cx0) / ancho_caja * 100, 1),
                        round(((py_ / esc) - cy0) / alto_caja * 100, 1),
                    )
                    for py_, px_ in aprox
                ]
                # Sin el punto repetido del cierre: el generador cierra solo.
                if len(pts) > 2 and pts[0] == pts[-1]:
                    pts = pts[:-1]
                if len(pts) > 2:
                    polis.append(pts)
            poli = polis if len(polis) > 1 else (polis[0] if polis else None)
        salidas.append(
            (nombre, (round(a), round(b), round(c), round(e)), int(sub.sum()), trozos, poli)
        )

    if abiertos:
        print(f'# Sin cerrar, no se midieron: {", ".join(abiertos)}.')
        print('# El recinto tiene que cerrar; puede salirse de la mancha, pero no quedar abierto.\n')
    if not salidas:
        print('No hay ninguna marca azul en la hoja.')
        return

    print(f'# Medido sobre la hoja marcada de la lámina {lamina}.')
    print(f'# {len(salidas)} área(s) con marca, en porcentaje de la caja de la mancha.\n')
    for nombre, z, px, trozos, poli in salidas:
        abierto = nombre.startswith('DdS')
        donde = "ABIERTOS['%s']" % lamina if abierto else "ZONAS['%s']" % lamina
        print(f"    {nombre + ':':8} {z}    # {donde}, {px} px de trazo en {trozos} pieza(s)")
        if poli and isinstance(poli[0], list):
            # Varios contornos, que se combinan pares-impares en el generador.
            partes = ', '.join('[' + ', '.join(f'({x}, {y})' for x, y in p) + ']' for p in poli)
            print(f"    #   trazo libre en {len(poli)} contornos: {{'polis': [{partes}], 'espejo': True}}")
        elif poli:
            puntos = ', '.join(f'({x}, {y})' for x, y in poli)
            print(f"    #   trazo libre, {len(poli)} puntos: {{'poli': [{puntos}], 'espejo': True}}")


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'III')
