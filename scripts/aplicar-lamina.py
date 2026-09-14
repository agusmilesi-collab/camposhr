#!/usr/bin/env python3
"""
Pasa los recintos trazados de una lámina a `areas-rorschach.py`.

    python3 scripts/aplicar-lamina.py VI

Lee la carpeta marcada con `leer-zonas-rorschach.py`, arma el bloque de esa
lámina en `ZONAS` (y en `ABIERTOS` las áreas de espacio, las que llevan S) y lo
escribe en su lugar. Después hay que generar:

    python3 scripts/areas-rorschach.py
    python3 scripts/auditar-areas.py VI

**El espejo se decide por dónde cayó el trazo**: el cuadernillo dibuja una sola
de las dos áreas laterales y la otra es su reflejo, así que un recinto que queda
entero de un lado del eje se refleja, y uno que cruza el eje no. Las que el
libro dibuja de a dos pero se trazaron pisando el eje hay que marcarlas a mano.
"""
import io, os, re, subprocess, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUENTE = os.path.join(RAIZ, 'scripts', 'areas-rorschach.py')
NUMERO = {'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6,
          'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10}


def medir(lamina):
    """Los recintos, como los devuelve el lector."""
    salida = subprocess.run(
        [sys.executable, os.path.join(RAIZ, 'scripts', 'leer-zonas-rorschach.py'), lamina],
        capture_output=True, text=True, check=True).stdout
    polis, nombre = {}, None
    for linea in salida.split('\n'):
        m = re.match(r"^    (\w+):\s+\(", linea)
        if m:
            nombre = m.group(1)
        m2 = re.search(r"'poli': \[(.*?)\], 'espejo'", linea)
        if m2 and nombre:
            polis[nombre] = [tuple(float(v) for v in p.split(','))
                             for p in re.findall(r'\(([-\d.]+, [-\d.]+)\)', m2.group(1))]
    abiertos = re.search(r'# Sin cerrar, no se midieron: (.+)\.', salida)
    return polis, (abiertos.group(1).split(', ') if abiertos else [])


def puntos(pts, sangria):
    return '\n'.join(sangria + ', '.join(f'({x}, {y})' for x, y in pts[i:i + 6]) + ','
                     for i in range(0, len(pts), 6))


def lateral(pts):
    """Si el recinto es de un lado. Con dos puntos de tolerancia sobre el eje:
    trazando a mano el borde interno de un área lateral se cruza el eje por un
    pelo, y sin la tolerancia esa área quedaba sin su par. Una central angosta
    entra en la tolerancia y se refleja sobre sí misma, que no cambia nada."""
    xs = [x for x, _ in pts]
    return max(xs) < 52 or min(xs) > 48


def main(lamina):
    polis, sin_cerrar = medir(lamina)
    if sin_cerrar:
        print(f'Sin cerrar y sin aplicar: {", ".join(sin_cerrar)}')
    if not polis:
        return
    espacios = [a for a in polis if 'S' in a[1:]]
    tinta = [a for a in polis if a not in espacios]

    lineas = [f"    '{lamina}': {{",
              "        # Trazadas sobre las imágenes de `zonas-por-area.py`, mirando los",
              "        # diagramas de localización del cuadernillo."]
    for area in sorted(tinta, key=lambda a: (a.startswith('Dd'), len(a), a)):
        lineas.append(f"        '{area}':".ljust(17) + "{'poli': [")
        lineas.append(puntos(polis[area], '                           '))
        lineas.append(f"                           ], 'espejo': {lateral(polis[area])}}},")
    lineas.append('    },')

    s = io.open(FUENTE, encoding='utf-8').read()
    fin = s.index('\n}\n\n# Los espacios blancos cerrados')
    s = s[:fin] + '\n' + '\n'.join(lineas) + s[fin:]

    if espacios:
        bloque = f"    '{lamina}': {{\n" + ''.join(
            f"        '{a}': {{'espejo': {lateral(polis[a])}, 'poli': [\n"
            f"{puntos(polis[a], '            ')}\n        ]}},\n" for a in espacios) + '    },\n'
        i = s.index('ABIERTOS = {')
        s = s[:i + len('ABIERTOS = {\n')] + bloque + s[i + len('ABIERTOS = {\n'):]

    s = s.replace("HUECOS = {\n", "HUECOS = {\n    '%s': {},\n" % lamina)
    if f"'{lamina}': {NUMERO[lamina]}" not in s:
        s = s.replace("NUMERO = {'I': 1", "NUMERO = {'%s': %d, 'I': 1" % (lamina, NUMERO[lamina]))
    orden = ['W'] + sorted(polis, key=lambda a: (a.startswith('Dd'),
                                                 int(''.join(c for c in a if c.isdigit()) or 0)))
    s = s.replace('ORDEN = {\n', "ORDEN = {\n    '%s': %r,\n" % (lamina, orden))
    io.open(FUENTE, 'w', encoding='utf-8').write(s)
    print(f'{lamina}: {len(tinta)} áreas de tinta y {len(espacios)} de espacio '
          f'· espejo en {sorted(a for a in polis if lateral(polis[a]))}')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'VI')
