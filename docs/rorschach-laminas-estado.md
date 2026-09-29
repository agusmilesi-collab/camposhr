# Estado de las láminas del Rorschach

Qué lámina está cargada en el capturador y cuál tiene el ok final de Agustín.
Se actualiza cada vez que se toca una lámina.

**Última actualización: 29/9/2026.**

## Los tres estados

- **Encaminada**: las áreas, los nombres y los recuadros están cargados y la
  lámina se puede usar en la encuesta. Falta que Agustín la revise en pantalla.
- **En revisión**: Agustín la está revisando y pidiendo cambios.
- **Ok final**: revisada y aprobada. No se toca sin un pedido.

## Tablero

| Lámina | Tabla A | Áreas en pantalla | Estado | Lo que queda |
| --- | --- | --- | --- | --- |
| I | sí | sí | **Ok final** (29/9) | Nada |
| II | sí | sí | **A retrazar** | Agustín las dibuja de nuevo sobre `~/Desktop/Lámina 2` (17 áreas, DS5 incluida) |
| III | sí | sí | **A retrazar** | Agustín las dibuja de nuevo sobre `~/Desktop/Lámina 3` (22 áreas). DdS24 estaba mal: se llevaba el 59 % de la lámina |
| IV | sí | sí | **Ok final** (29/9) | Nada |
| V | sí | sí | **Ok final** (29/9) | Nada |
| VI | sí | sí | **Ok final** (29/9) | Nada |
| VII | sí | sí | **Ok final** (29/9) | Nada |
| VIII | sí | sí | **Ok final** (29/9) | Nada |
| IX | sí | no | Falta trazar | Dibujar las 28 áreas. Dd22/DdS22 y D8/DS8 van juntas, como D3/DS3 de la VIII |
| X | sí | sí | **En revisión** | Seguir con lo que marque Agustín |

Los avisos de las láminas I a VII salen de `python3 scripts/auditar-areas.py`.
Los ENORME de esas láminas son áreas grandes de verdad (D2 de la I, D7 de la IV)
y no se anotan como pendientes.

## Lámina I: cambios pedidos en la revisión

Cerrada el 29/9/2026 con el ok de Agustín.

| Fecha | Pedido | Hecho |
| --- | --- | --- |
| 29/9 | Sin espejo, y cada una de un solo lado: D2, D7, Dd33 y Dd25 a la derecha; Dd28, Dd34 y Dd35 a la izquierda | Sí. D2, D7, Dd33 y Dd25 estaban trazadas a la izquierda, y Dd34 a la derecha: de esas cinco queda solo el reflejo (`'reflejado'`) |
| 29/9 | D7 a la izquierda y Dd34 a la derecha | Sí. Quedan del lado en que se trazaron |

## Lámina X: carga (29/9)

Trazada por Agustín en `~/Desktop/Entrevistador/Lámina 10 redibujada`; los recuadros salen de la foto `Lamina 10.heic`.

- Ninguna área se espeja.
- El amarillo en gris queda casi como el papel: en la X la tinta suma lo que tiene color (`SATURACION`), y el mínimo de pieza baja a 150 px porque D3 y Dd33 son pedazos sueltos chicos.
- El lector ahora lee todos los recintos de un área y los combina pares-impares (`'polis'`): DdS29 y DdS30 dejan afuera las figuritas que rodeaste aparte, y DdS22 son cuatro recintos.
- DdS22 lleva la tinta y el blanco que encierra (`'con_tinta'`). DdS29 y DdS30 toman todo el blanco de su trazo.

| Fecha | Pedido | Hecho |
| --- | --- | --- |
| 29/9 | Los nombres de Dd25 y D12 se pisan | Sí. Dd25 subió y D12 se corrió a la derecha |
| 29/9 | DdS22 incluye también el espacio vacío de adentro | Sí (`'rellenar'`): suma el hueco del centro, con la figurita amarilla adentro |
| 29/9 | DdS22 también con el espacio vacío de abajo | Sí: suma DdS30, que es el hueco del centro más el blanco entre las patas |

## Lámina VII: cambios pedidos en la revisión

Cerrada el 29/9/2026 con el ok de Agustín.

| Fecha | Pedido | Hecho |
| --- | --- | --- |
| 29/9 | No espejar nada | Sí. Eran diez; cada una queda del lado en que se trazó |

## Lámina VI: cambios pedidos en la revisión

Cerrada el 29/9/2026 con el ok de Agustín.

| Fecha | Pedido | Hecho |
| --- | --- | --- |
| 29/9 | No espejar nada, para ver cómo queda | Sí. Eran nueve: D4, Dd21, Dd22, Dd24, Dd25, Dd26, Dd28, Dd29 y Dd31. Cada una queda del lado en que se trazó |
| 29/9 | Dd21 sí va espejada | Sí. Es la única de la VI que se espeja |

La VI está declarada dos veces en `ZONAS` y en `ABIERTOS` de `areas-rorschach.py`: vale la segunda, y la primera no se usa.

## Lámina V: cambios pedidos en la revisión

Cerrada el 29/9/2026 con el ok de Agustín.

| Fecha | Pedido | Hecho |
| --- | --- | --- |
| 29/9 | Sin espejo, cada una de su lado: D1, D10, Dd23, Dd24, Dd26, Dd32 y Dd33 a la derecha; D4, Dd22, Dd25, DdS29 y Dd35 a la izquierda | Sí. Todas estaban trazadas de ese lado |

## Lámina IV: cambios pedidos en la revisión

Cerrada el 29/9/2026 con el ok de Agustín.

| Fecha | Pedido | Hecho |
| --- | --- | --- |
| 29/9 | Sin espejo, cada una de su lado: D2, D6, Dd22, Dd23, Dd27 y Dd32 a la derecha; Dd21, Dd28 y Dd31 a la izquierda | Sí |
| 29/9 | D4 a la izquierda, sin el espacio vacío | Sí. El blanco del gancho queda como hueco (`'huecos'`) y en pantalla se ve vacío |
| 29/9 | DdS29 a la izquierda, con el espacio de arriba | Sí. Toma las dos ranuras blancas de ese lado (`'todo'`) |
| 29/9 | DdS24 es el blanco de abajo más DdS29, a la izquierda | Sí (`'suma'`) |

## Lámina VIII: cambios pedidos en la revisión

Cerrada el 29/9/2026 con el ok de Agustín.

| Fecha | Pedido | Hecho |
| --- | --- | --- |
| 25/9 | A W le faltaban los dos cuernitos de abajo | Sí. También aparecen en D2, D6, D7 y Dd26 |
| 25/9 | A D2 le faltaban los mismos cuernitos | Sí |
| 25/9 | D3 y DS3 son la misma área, con un solo nombre | Sí. El nombre dice "D3/DS3" y al codificar ofrece los códigos con S y sin S |
| 25/9 | No espejar ninguna área (empezó por Dd31) | Sí. D1 queda de un solo lado, como se trazó |
| 29/9 | D6: las dos formas van unidas por el palito del medio | Sí. D6 = D2 + D4 + D5 + Dd21 |
| 29/9 | Espejar DdS32 | Sí. Es la única excepción a "no espejar" |
| 29/9 | A DdS28 le faltaba el espacio de arriba | Sí. El programa tomaba solo el blanco más grande del trazo. En la VIII ahora toma todo el blanco que encierra cada trazo, en las cuatro áreas de espacio. D3/DS3 también sumó el blanco entre las costillas |

Ajustes que se hicieron sin pedido, al cargarla:

- D6 = D2 + D4 + D5 y D8 = D4 + D5. Estaban dibujadas en varios recintos separados.
- Dd21 se redibujó a mano sobre el eje, desde el pico hasta donde empieza el
  rosa, como en el diagrama del libro. La trazada cortaba a un tercio.
