# Migrar Airtable a Supabase

Airtable se apaga cuando esto termine. Hasta entonces el OS lee de los dos lados
y escribe solo en Supabase (ver `CLAUDE.md`, "Airtable no se toca").

## Qué hay que traer

Contado el 25/8/2026 contra la base `appGhbo58t44fOIGe`.

| Tabla de Airtable | Registros | Ya en Supabase | Falta |
| --- | ---: | ---: | ---: |
| Empresas | 10 | 3 | 7 |
| Pedidos | 44 | 2 | 42 |
| Individuo (expedientes) | 72 | 2 | 70 |
| Tests Proyectivos (respuestas) | 712 | 9 | 703 |
| Benziger | 39 | 2 | 37 |
| Facturas | 24 | 0 | 24 |
| Evaluadoras | 2 | 2 | — |
| Baterías | 3 | 3 | — |

Las dos evaluaciones migradas son Alfredo Miguel Toriggino y Florencia
Iacopetta, hechas a mano: son la prueba de que el camino completo funciona y el
molde de lo que hace el script.

## Qué trae cada expediente

De los 72:

| | |
| ---: | --- |
| 55 | con pedido (17 sin: **ver "Lo que hay que decidir"**) |
| 52 | con evaluadora |
| 54 | con teléfono, 38 con email |
| 40 | con respuestas de manchas |
| 39 | con sumario cargado |
| 38 | con PDF de Benziger |
| 36 | con Raven |
| 13 | con conclusión escrita |
| 12 | con un PDF de informe viejo |

Por etapa: 42 entregados, 18 sin asignar, 6 por analizar, 4 por entrevistar, 2
por citar.

## El orden

Cada paso necesita el anterior, así que no se puede paralelizar:

1. **Empresas.** Por nombre; las que ya están se completan, no se duplican.
   Cinco de las diez traen CUIT.
2. **Pedidos.** Cuelgan de su empresa. Los 44 están "En curso" en Airtable, pero
   el OS cierra solo los que tienen todos sus informes entregados
   (`lib/pedido-completo.ts`), así que al terminar la migración varios van a
   quedar finalizados, que es lo correcto.
3. **Personas y evaluaciones.** Una evaluación por expediente, con su etapa, su
   evaluadora, sus fechas y sus marcas de administrado.
4. **Respuestas de manchas.** Las 712, cada una a su evaluación.
5. **Sumarios.** **No se copian: se recalculan** con el motor del OS desde las
   respuestas recién cargadas, y se comparan contra el `Sumario JSON` de
   Airtable. Un sumario que no coincida es una respuesta mal migrada, y es el
   único control que lo detecta.
6. **Benziger.** Los 67 campos ya están tabulados en su tabla, así que **no hace
   falta releer los PDF**: se traen los números. El PDF no se guarda (ver
   `CLAUDE.md`).
7. **Raven.** Puntaje, percentil, desvíos y resultado, tal cual.
8. **Facturas.** Las 24, con sus renglones apuntando a las evaluaciones que ya
   existen. Van últimas porque necesitan todo lo anterior.

## Cómo se corre

    node scripts/migrar-airtable.mjs              # ensayo: no escribe nada
    node scripts/migrar-airtable.mjs --de-verdad  # escribe

En ensayo lee Airtable, arma todo, informa qué haría y no escribe nada. Cada fila
lleva su `airtable_id` y el script busca por ese id antes de insertar, así que
correrlo dos veces no duplica: completa lo que falta. Eso lo vuelve retomable, que
es lo que hace falta cuando algo se corta en el medio de setenta expedientes.

El ensayo del 25/8/2026 da: 7 empresas, 39 pedidos más el de "Mapeo
organizacional", 67 expedientes, 677 respuestas de manchas, 36 Benziger y 24
facturas. Lo que no entra son las tres cosas de Distribuidora Andina y lo que ya
está migrado, y las cuentas cierran contra el total de cada tabla.

**El servidor tiene que estar levantado** cuando se corre de verdad: los sumarios
los calcula el OS por su propia ruta, y el script se autentica solo con la clave
del entorno.

## Lo que hay que decidir

1. **Los 17 candidatos de Laruso sin pedido** entran en un pedido nuevo,
   "Mapeo organizacional". Ahí el trabajo no fue una selección sino un mapeo de
   la gente que ya está adentro, y por eso nadie abrió un pedido por persona.
   Los otros 8 pedidos de Laruso tienen su puesto propio y quedan como están.
2. **De Distribuidora Andina no se trae nada**: es la empresa de prueba. Sus 3
   pedidos y sus expedientes se saltean, y los 14 candidatos inventados que hay
   en Supabase quedan, que son con los que se prueba.
3. **Los informes PDF viejos no se traen.** El informe se arma desde los datos y
   después se contrastan los dos, para ver cuánto varía respecto de lo que
   escribieron las psicólogas.

## Qué pasa después

Con esto adentro, el OS deja de leer Airtable y las pantallas dejan de tener
filas marcadas "sin migrar". Recién ahí se apaga la base.
