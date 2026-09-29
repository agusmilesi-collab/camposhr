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
| II | sí | sí | Encaminada | Revisión final. Dd24 sale casi rectangular (llena el 92 % de su caja) |
| III | sí | sí | Encaminada | Revisión final. **DdS24 está mal**: se lleva el 59 % de la lámina y casi no toca blanco. Hace falta otro criterio de recorte |
| IV | sí | sí | **Ok final** (29/9) | Nada |
| V | sí | sí | Encaminada | Revisión final |
| VI | sí | sí | Encaminada | Revisión final |
| VII | sí | sí | Encaminada | Revisión final |
| VIII | sí | sí | **Ok final** (29/9) | Nada |
| IX | sí | no | Falta trazar | Dibujar las 28 áreas. Dd22/DdS22 y D8/DS8 van juntas, como D3/DS3 de la VIII |
| X | sí | no | Falta trazar | Dibujar las 29 áreas |

Los avisos de las láminas I a VII salen de `python3 scripts/auditar-areas.py`.
Los ENORME de esas láminas son áreas grandes de verdad (D2 de la I, D7 de la IV)
y no se anotan como pendientes.

## Lámina I: cambios pedidos en la revisión

Cerrada el 29/9/2026 con el ok de Agustín.

| Fecha | Pedido | Hecho |
| --- | --- | --- |
| 29/9 | Sin espejo, y cada una de un solo lado: D2, D7, Dd33 y Dd25 a la derecha; Dd28, Dd34 y Dd35 a la izquierda | Sí. D2, D7, Dd33 y Dd25 estaban trazadas a la izquierda, y Dd34 a la derecha: de esas cinco queda solo el reflejo (`'reflejado'`) |
| 29/9 | D7 a la izquierda y Dd34 a la derecha | Sí. Quedan del lado en que se trazaron |

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
