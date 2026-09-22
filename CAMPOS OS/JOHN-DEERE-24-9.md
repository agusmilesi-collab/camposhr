# John Deere, 24 de septiembre · dónde retomar

Contexto para seguir en otra terminal. Última actualización: **21 de septiembre
de 2026, 16:45**. El encuentro es el **jueves 24, de 8:45 a 10:30**, y quedan
tres días.

---

## 1. Lo primero que hay que leer

| Qué | Dónde |
|:--|:--|
| El diseño completo, con el reloj y el motivo de cada decisión | `~/Desktop/Codigo Proyectos/Pla/Charla John Deere 24-9 - Diseño.md`, **empezar por la sección 0.01** |
| Lo que el cliente pidió el 18/9 | Sección 0.01 del mismo archivo, doce puntos |
| El texto comprometido con el cliente | `~/Desktop/Codigo Proyectos/Pla/Charla John Deere 24-9 - Texto para validar con el cliente.html` |
| La propuesta aprobada | `~/Desktop/Codigo Proyectos/Pla/Propuesta John Deere - Conversaciones dificiles.html` (el PDF de al lado quedó viejo) |

El repositorio es este, `~/Documents/camposhr-site`, y se abre por su `CLAUDE.md`.

---

## 2. Cómo se trabaja

**Agustín corrige mirando localhost.** El dev server queda levantado en el 3000 y
él recorre las pantallas y pide cambios. Dos cosas que conviene tener presentes:

- **Los cambios de contenido pegan en producción al instante**, porque la base es
  una sola para local y para el sitio publicado. Los de código, solo en local
  hasta que se hace push.
- **Si algo se ve viejo en la pantalla, es la pestaña**: recarga dura. El dev
  server recompila pero el navegador se queda con el JavaScript anterior. Ya
  pasó dos veces, y una de ellas le hizo creer que un campo no existía.
- **El dev server se traba** cuando lleva días corriendo: escucha el puerto y no
  contesta. Se mata y se levanta de nuevo.

**Nunca `git add -A`.** El repositorio es público y tiene datos de personas
reales. Se agrega archivo por archivo. Además hay cambios de otro trabajo (el
velocímetro: `app/os/configuracion/`, `lib/competencias.ts`, `lib/escalas.ts`,
`docs/`, `scripts/auditar-velocimetro.mjs`) que **no van** en los commits de
John Deere.

---

## 3. Qué está construido

Todo el sistema del encuentro, probado de punta a punta contra la base real y
desplegado. El último commit es `4472d17`, y `main` está igual que `origin/main`.
Lo que hay sin commitear son ajustes de esta tarde que se listan en la sección
4.4.

**Las once actividades** (`supabase/ciclo-actividades-john-deere.sql`), en el
orden del reloj:

| Clave | Tipo | Qué hace |
|:--|:--|:--|
| `cd-reconocimiento` | texto | El último reconocimiento que dio, como salió |
| `cd-reconocimiento-traducido` | campos | Qué hizo · cuándo · qué se consiguió |
| `cd-conversacion` | texto | La conversación pendiente, campo libre y sin ayuda |
| `cd-es-hecho` | opcion | La apuesta: ¿lo que escribiste es un hecho? |
| `cd-traduccion` | campos | Su propia frase rota en seis campos |
| `cd-ensayo-1/2/3` | ensayo | Las tres rondas del role play |
| `cd-pregunta` | texto | El enunciado cambia según el tiempo en el rol |
| `cd-monedas` | monedas | Diez monedas entre las preguntas de los que empiezan |
| `cd-reparto` | reparto | Las que quedaron sin contestar, a quien lleva años |

**Tres tipos de actividad nuevos**, con su configuración en la columna `config`
de `actividades` y no en el código: `campos`, `monedas` y `reparto`. El motivo
está escrito en `supabase/ciclo-tipos-campos-monedas.sql`.

**Las pantallas que se proyectan**, todas con `?placa=1` para ir dentro del deck:

- `/ciclo/john-deere/actividad?vista=antes-despues` — la medición del día
- `/ciclo/john-deere/actividad?vista=rotan&clave=cd-pregunta&de=Más de un año`
- `/ciclo/john-deere/actividad?clave=cd-monedas` — el ranking con los pozos
- `/ciclo/john-deere/actividad?vista=cierre` — los números del role play
- `/ciclo/john-deere/qr?destino=resumen` — el código de la última placa

**El deck**: `public/pres/johndeere-conversaciones.html`, 33 placas en el orden
del reloj, cinco de ellas con el marco que se llena con lo que responde la sala.
Se abre desde el hub, que le pasa el cliente en el enlace. El de prueba, de 17
placas, quedó al lado sin uso.

En qué placa se abre cada actividad está en la columna `placa` de `actividades`,
con la numeración de 33 ya aplicada en la base: reconocimiento en la 4,
traducido en la 7, conversación en la 8, la apuesta en la 9, traducción en la 17,
las tres rondas del ensayo en 22, 23 y 24, la pregunta en la 26, las monedas en
la 28 y el reparto en la 29.

**El hub del encuentro**: `tools.camposhr.com/presentaciones/charla/johndeere-conversaciones`.
Presentación, guion, admin y código QR.

**La clave del panel de control** está en la fila de la corrida, en la tabla
`corridas`. No se versiona: el repositorio es público.

---

## 4. Lo que falta

### 4.1 El guion de las expositoras

**Está escrito y falta pegarlo en el hub.** La versión nueva, contra el deck de
33 placas, es
`~/Desktop/Codigo Proyectos/Pla/Charla John Deere 24-9 - Guion de sala.md`. Lo
que hoy tiene la tabla `guiones` es la versión anterior, la de 34 placas, así que
la pantalla del hub todavía muestra esa.

Lo que sigue ahí es repasarlo placa por placa contra el deck actual y pegarlo.

**La consigna fue reciclar todo lo que se pudiera**: Lorena y Lucila no tienen que
aprender contenido nuevo a tres días del encuentro. Lo que ya saben decir se
mantiene tal cual, y lo nuevo se limita a lo que el cliente pidió el 18/9 y no
existe en el material de Pla: el vocabulario (GPM, conversaciones de
desarrollo), los tres casos del role play, y el bloque de las preguntas.

Dónde se escribe: la pantalla del guion ya existe y es editable, en el hub →
**Guion**. Arranca cargada con las notas del orador que trae el deck, una
entrada por placa. Lo que se guarda vive en la tabla `guiones`.

El material de Pla está en `~/Desktop/Codigo Proyectos/Pla/`, en los archivos
`GUION Charla 4 - expositoras.md` y `GUION Charla 5 - expositoras.md`, que son
los dos más cercanos a esta charla.

### 4.2 Revisión de código para bajar el costo de los sondeos

Después del guion. El objetivo es que el encuentro entre cómodo en la base, no
que entre justo.

Dos arreglos ya están hechos y son la referencia de lo que se busca:

- El camino de escritura (`app/api/ciclo/[slug]/aporte/route.ts`) lee de memoria
  lo que el sondeo ya cachea. Pasó de cuatro o cinco idas a la base a dos, y las
  escrituras quedaron en unos 230 ms.
- La pantalla del teléfono avanza al tocar sin esperar al servidor, y reintenta
  por atrás.

Lo que hay que mirar: el sondeo de `estado` con ochenta teléfonos cada veinte
segundos, cuántas consultas cuesta cada uno, y qué más se puede servir del
catálogo que ya está en memoria. El cuidado es siempre el mismo: lo que se
cachea no puede ser lo que cambia durante el encuentro, y quien se registra
tarde tiene que poder responder igual.

### 4.3 La prueba de carga, al final de todo

**No correrla antes.** Agustín lo pidió explícitamente: primero se cierra la
versión, después se bombardea la base. Correrla sobre algo que todavía cambia no
mide nada y deja basura en producción.

Cuando toque, la corrida es con **cien teléfonos**, y esta vez tiene que incluir
lo que la prueba del 11/9 no cubrió: **cien selfies subiendo al mismo tiempo**.
El script es `scripts/carga-ciclo.mjs` y la medición anterior está en la sección
13 del diseño (techo de 6,7 escrituras por segundo, sondeo de 20 segundos).

Al terminar, **borrar los aportes de prueba, los asistentes y la corrida de
prueba, en ese orden**.

### 4.4 Lo que está en local y sin commitear

Se viene trabajando así: se edita, Agustín mira localhost, y el commit se arma al
final del lote cuando él lo pide.

| Archivo | Qué cambió |
|:--|:--|
| `public/pres/johndeere-conversaciones.html` | Se sacó la placa "De qué conversaciones hablamos hoy" y cambió la frase de apertura |
| `data/presentaciones.json` | El deck declara 33 placas |
| `supabase/ciclo-actividades-john-deere.sql` | El mapeo actividad a placa corrido uno, ya aplicado en la base |
| `lib/ciclo.ts` | Los repartos de ensayo, cruce y frases excluyen a las expositoras |
| `app/ciclo/[slug]/Asistente.tsx`, `app/globals.css` | Ajustes de la pantalla del teléfono |

**El deck publicado todavía tiene 34 placas**, porque es un archivo del
repositorio y espera el push. Hasta que se suba, el número de placa que muestra
el panel en producción está corrido uno respecto de lo que proyecta la sala.

---

## 5. Lo que hay en la base ahora mismo

- **Agustín Milesi**, registrado de verdad: Branch, grado 9, menos de un año, con
  selfie. Tiene respondidas varias consignas.
- **Doce asistentes de prueba** con apellido `ZZPRUEBA`, con sus preguntas y sus
  votos, para que las pantallas se vean llenas.
- **Lucila y Lore Campos**, marcadas con `expositora = true`. Se registran como
  todas porque necesitan el teléfono para ver lo que ve la sala, y `delTaller()`
  en `lib/ciclo.ts` las deja fuera de los repartos y de los contadores. **No se
  borran.**

**Todo eso hay que borrarlo antes del 24.** Si queda, entra al reparto de tríos y
ocupa lugares con gente que no está en la sala.

```sql
delete from asistentes a using corridas c, empresas e
 where a.corrida_id = c.id and c.empresa_id = e.id
   and e.slug = 'john-deere'
   and a.apellido ilike '%ZZPRUEBA%';
```

Los aportes se van con ellos por la cascada. La corrida y las actividades quedan.

---

## 6. Lo único pendiente con el cliente

**El texto de validación no se mandó.** Está escrito y esperando. Adentro van las
consignas textuales, los cuatro ejemplos, los tres casos del role play y las dos
preguntas del bloque final, para que confirmen la redacción y la alineación con
el GPM.

Es lo último que queda del pedido del 18/9 sin cumplir, y cuanto más tarde
salga, menos margen hay para corregir lo que devuelvan.
