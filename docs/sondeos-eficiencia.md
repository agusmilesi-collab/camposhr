# Revisión del costo de los sondeos, antes del 24 de septiembre

Lectura de código, sin correr la prueba de carga. La regla de referencia es la
del 7 de agosto de 2026: **el presupuesto es de dos consultas por sondeo**, y la
cuenta que decide todo es

```
consultas por segundo = (personas / intervalo de sondeo) x consultas por sondeo
```

Ese día, 33 personas cada 12 segundos con 12 consultas por sondeo dieron 33
consultas por segundo y la base devolvió 1821 errores.

## Lo que cuesta hoy cada sondeo, por tipo de consigna

Con 80 teléfonos y el intervalo actual de 12 segundos son 6,7 sondeos por
segundo.

| Consigna abierta | Consultas por sondeo | Consultas por segundo |
| :-- | :-: | :-: |
| `texto`, `opcion`, `campos` | 2 | 13 |
| `ensayo` (las tres rondas) | 2 | 13 |
| `cruce` | 2 | 13 |
| **`monedas` (el bloque final)** | **5** | **33** |

Las dos consultas de base son la corrida (`resolverCiclo`, que lee
`actividad_abierta_id` y no se puede servir vieja) y los aportes propios
(`aportesDeEn`). El catálogo de actividades, la lista de la sala y las firmas de
las selfies ya salen de memoria.

**La prueba del 11 de septiembre no midió el bloque caro.** El script abre una
actividad de tipo `texto` (`scripts/carga-ciclo.mjs:173`), que es la rama de dos
consultas, y sondea cada 20 segundos. Lo que midió fueron 10 consultas por
segundo. El bloque de monedas, tal como está el código, da 33.

---

## 1 · El bloque de monedas: de cinco consultas a dos

`app/api/ciclo/[slug]/estado/route.ts:250-256` llama a `paraVotar` y a `pozoDe`
en cada sondeo de cada teléfono.

| Llamada | Qué hace hoy | Consultas |
| :-- | :-- | :-: |
| `paraVotar` | `listarAportes` de las preguntas de la sala, entera, por teléfono | 1 |
| `pozoDe` | `getAporteDe` de la pregunta propia | 1 |
| `pozoDe` | `listarAportes` de los repartos de monedas | 1 |

Tres arreglos, y los tres son locales:

1. **La pregunta propia ya puede viajar en la consulta que el sondeo hace igual.**
   `aportesDeEn` ya acepta varias actividades y el sondeo lo usa así para
   `deAntes` (línea 152). Sumando el id de la actividad de origen a esa lista,
   `getAporteDe` desaparece. **Ahorra una consulta.**
2. **La lista que se vota es la misma para toda la sala.** Lo único propio es el
   orden, que `barajar` calcula en memoria, y que no aparezca la propia, que es
   un filtro en memoria. Envolviendo la lectura en `recordar('votar:<corrida>:<actividad>', 8, ...)`
   pasa de una consulta por teléfono a una cada ocho segundos para los ochenta.
   **Ahorra una consulta.**
3. **El ranking de los repartos también es de la sala.** Mismo caché de ocho
   segundos, y conviene guardar el resumen ya calculado en vez del listado
   crudo, porque hoy `resumir` se ejecuta una vez por teléfono. **Ahorra una
   consulta.**

Con eso el bloque final queda en dos consultas por sondeo, que es el
presupuesto, y baja de 33 a 13 consultas por segundo.

**Efecto secundario que conviene igual.** Hoy cada teléfono se trae los ochenta
textos de las preguntas en cada sondeo. Con el caché se leen una vez cada ocho
segundos del lado del servidor, aunque se sigan enviando al teléfono.

---

## 2 · El intervalo de sondeo está en 12 segundos y el diseño dice 20

`app/ciclo/[slug]/Asistente.tsx:187` tiene `SONDEO_MS = 12000`. La sección 13 del
diseño dice "sondeo definido en 20 segundos para este encuentro", y la prueba de
carga se corrió con 20.

Subirlo a 20 baja toda la carga un 40 %, en todos los bloques a la vez, y es un
número. Lo que se paga es que la consigna puede tardar hasta ocho segundos más en
aparecer, que es menos de lo que tarda la expositora en terminar de decirla.

---

## 3 · La corrida, cacheada dos segundos

`resolverCiclo` (`lib/ciclo.ts:400`) lee la corrida en cada sondeo y también en
cada escritura. Es la mitad del presupuesto de base y hoy no se puede evitar
porque ahí vive qué actividad está abierta.

Con `recordar('corrida:<empresa>', 2, ...)` esa consulta cae alrededor de un 85 %,
y el peor caso es que un teléfono vea la consigna dos segundos más tarde, dentro
de un intervalo de sondeo de doce o veinte.

**La excepción que hay que dejar escrita:** el panel de control tiene que leer sin
caché. La expositora abre una consigna y necesita ver el cambio en su pantalla en
el acto, y el panel ya se distingue porque pide `total=1`.

Con los puntos 2 y 3 juntos, el sondeo de base queda alrededor de 4 consultas por
segundo con la sala entera adentro.

---

## 4 · El reparto del ensayo disparado desde ochenta teléfonos

`ensayoDe` (`app/api/ciclo/[slug]/estado/route.ts:427`) llama a `repartirEnsayo`
cuando el teléfono que pregunta no tiene puesto. `repartirEnsayo`
(`lib/ciclo.ts:1136`) hace cuatro lecturas antes de decidir si escribe.

Mientras el reparto se haya hecho desde el panel con la sala sentada, esto no
corre nunca. El problema es el caso en que no se hizo: los ochenta teléfonos
entran juntos a la misma función, son 320 consultas, y si la sala tiene menos de
nueve personas la función vuelve sin escribir nada, así que se repite en el
sondeo siguiente y en todos los que siguen.

**El arreglo es un cerrojo en memoria:** guardar la promesa en curso por corrida
y actividad, para que la segunda llamada espere a la primera en lugar de repetir
el trabajo. Vale igual para `repartirFrases` y para `repartirCruce`, que entran
por el mismo camino.

---

## 5 · Las pantallas proyectadas

`app/ciclo/[slug]/actividad/page.tsx` refresca la vista de conteo cada tres
segundos (línea 295) y el resto cada cinco. Cada refresco es un render de
servidor completo, y en esa página la lista de la sala se pide con
`listarAsistentes`, que no cachea, en lugar de `asistentesDeLaSala`, que sí.

Dos cambios:

- Usar `asistentesDeLaSala` en esa página. **Ahorra una consulta por refresco.**
- Subir el conteo de tres a seis segundos. Es el número que la expositora mira de
  reojo para saber si puede avanzar, y tres segundos no le dan más información
  que seis.

Son pocas pantallas, pero corren justo en los minutos en que los ochenta
teléfonos escriben.

---

## 6 · El panel de control, cada cuatro segundos

`app/ciclo/[slug]/control/Control.tsx:60` sondea cada cuatro segundos con
`total=1`, que agrega `contarAvance` y, durante el ensayo, `listarAportes` de la
ronda. Son unas cuatro consultas cada cuatro segundos, una por segundo sostenida.

Subirlo a ocho segundos lo deja en medio, y el número que ella mira se mueve
igual de rápido de lo que la sala responde.

---

## 7 · Escrituras que devuelven la fila sin que nadie la use

`guardarAporte` (`lib/ciclo.ts:948`) usa `upsert`, que pide
`Prefer: return=representation` (`lib/supabase.ts:96`). El endpoint de aporte no
usa la fila devuelta: responde con el valor que ya tenía en la mano.

Un `return=minimal` en ese camino ahorra el trabajo de devolver y serializar la
fila justo en la ráfaga de escritura, que es donde está el techo medido de 6,7
por segundo. Es la mejora más chica de la lista y la más barata de hacer.

---

## Lo que no hace falta tocar

- **Los índices están bien.** `aportes (corrida_id, actividad_id)`,
  `aportes (actividad_id)` y el único `(actividad_id, asistente_id)` cubren
  exactamente las tres consultas del sondeo (`supabase/ciclo-corridas.sql:99`,
  `supabase/ciclo.sql:79-82`).
- **Las firmas de las selfies ya se piden en lote y se guardan una semana en
  memoria** (`lib/supabase.ts:372`). En el ensayo no cuestan nada.
- **El camino de escritura ya está en dos idas.** Catálogo y sala salen de
  memoria, y la lectura del asistente a la base quedó solo para quien se
  registró hace menos de lo que dura el caché.
- **El cliente ya reintenta** con esperas de 0, 1,2 y 3 segundos.

---

## Orden sugerido

| # | Cambio | Qué baja | Riesgo |
| :-: | :-- | :-- | :-- |
| 1 | Monedas, de cinco consultas a dos | 33 a 13 por segundo en el bloque final | Bajo, es caché de ocho segundos |
| 2 | Sondeo a 20 segundos | 40 % de todo | Ninguno, es el número del diseño |
| 3 | Corrida cacheada dos segundos | La mitad del piso | Bajo, con la excepción del panel |
| 4 | Cerrojo en los repartos | Un pico que hoy no tiene tope | Bajo |
| 5 | Pantallas proyectadas | Una consulta por refresco, y menos refrescos | Ninguno |
| 6 | Panel a ocho segundos | Una consulta por segundo | Ninguno |
| 7 | `return=minimal` al guardar | Trabajo en la ráfaga de escritura | Ninguno |

Con 1, 2 y 3 el peor bloque del encuentro queda debajo de lo que la prueba del 11
de septiembre ya midió sin un error, en lugar de tres veces por encima.

---

## Lo aplicado, 21 de septiembre de 2026

Los siete puntos están hechos. Dónde quedó cada uno:

| # | Dónde | Qué cambió |
| :-: | :-- | :-- |
| 1 | `app/api/ciclo/[slug]/estado/route.ts`, `lib/ciclo.ts` | `pozoDe` recibe la pregunta propia que el sondeo ya leyó y corta antes de consultar cuando no la hay; `paraVotar` y el reparto de monedas leen con `aportesDeLaSala`, ocho segundos de memoria |
| 2 | `app/ciclo/[slug]/Asistente.tsx` | `SONDEO_MS` de 12000 a 20000 |
| 3 | `lib/ciclo.ts`, `lib/memoria.ts` | `resolverCiclo` cachea la corrida dos segundos y acepta `fresco`; `abrirActividad`, `pasarFase` y `cerrarActividades` invalidan con `olvidar` |
| 4 | `lib/memoria.ts`, `app/api/ciclo/[slug]/estado/route.ts` | `unaVez` para que los tres repartos disparados por el sondeo corran uno a la vez |
| 5 | `app/ciclo/[slug]/actividad/page.tsx` | La lista de la sala sale de memoria y el conteo refresca cada seis segundos |
| 6 | `app/ciclo/[slug]/control/Control.tsx` | El panel, de cuatro a ocho segundos |
| 7 | `lib/supabase.ts`, `lib/ciclo.ts`, `.../aporte/route.ts` | `upsert` acepta `devolver`, y el aporte del teléfono se guarda con `return=minimal` |

### Cómo queda la cuenta

Con 80 teléfonos y el sondeo en 20 segundos son 4 sondeos por segundo.

| Consigna abierta | Antes | Ahora |
| :-- | :-: | :-: |
| `texto`, `opcion`, `campos` | 13 consultas por segundo | 4 |
| `ensayo` | 13 | 4 |
| `monedas` | 33 | 4 |

El piso baja de dos consultas por sondeo a poco más de una, porque la corrida se
sirve de memoria dos segundos y sólo una de cada diez vueltas llega a la base.

### Qué se probó y qué no

**Probado contra la base real, con la corrida de John Deere y los asistentes de
prueba:** el sondeo del teléfono y el del panel, el sondeo con `cd-monedas`
abierta para los tres casos (quien escribió pregunta y está en el podio, quien
escribió y no entró, y quien no tenía pregunta), las dos pantallas proyectadas,
el panel con su clave, y una escritura completa por el endpoint del teléfono, que
se borró después. La corrida quedó como estaba, con `cd-reconocimiento` abierta.

**No probado:** la cantidad de consultas no está medida, está leída del código.
La prueba de carga con cien teléfonos sigue pendiente y es la que confirma los
números de arriba. Cuando se corra, conviene abrir `cd-monedas` en lugar de una
actividad de tipo `texto`, que es lo que el script hace hoy
(`scripts/carga-ciclo.mjs:173`): probar la rama barata fue lo que dejó el bloque
caro sin medir.
