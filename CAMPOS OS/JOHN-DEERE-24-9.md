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

- `/ciclo/john-deere/actividad?vista=antes-despues`: la medición del día
- `/ciclo/john-deere/actividad?vista=rotan&clave=cd-pregunta&de=Más de un año`
- `/ciclo/john-deere/actividad?clave=cd-monedas`: la 3ª y la 2ª más votadas (placa 28)
- `/ciclo/john-deere/actividad?clave=cd-monedas&vista=primera`: la 1ª sola, con la card de quien la escribió (placa 29)
- `/ciclo/john-deere/actividad?vista=cierre`: los números del role play

**El deck**: `public/pres/johndeere-conversaciones.html`, **32 placas** en el
orden del reloj. `data/presentaciones.json` declara 32. Se abre desde el hub, que
le pasa el cliente en el enlace (`?c=john-deere`).

En qué placa se abre cada actividad está en la columna `placa` de `actividades`
y en `supabase/ciclo-actividades-john-deere.sql`, ya aplicado: reconocimiento en
la 4, traducido en la 8, conversación en la 9, traducción en la 19, las tres
rondas del ensayo en 22, 23 y 24, la pregunta en la 26, las monedas en la 27, el
reparto en la 30 y la encuesta final en la 32. La apuesta ("¿es un hecho?") se
sacó el 23/9, con su placa.

**El panel numera las actividades del 1 al 11** y el aviso de cada placa dice
cuál abrir o cerrar ("Abrir actividad 9", "Cerrar actividad 9").

**El hub del encuentro**: `tools.camposhr.com/presentaciones/charla/johndeere-conversaciones`.
Presentación, guion, admin y código QR. El guion vive en
`~/Desktop/Codigo Proyectos/Pla/Charla John Deere 24-9 - Guion de sala.md` y está
cargado en la tabla `guiones` con las 32 placas: cada cambio al archivo se vuelve
a cargar ahí.

**La clave del panel de control** está en la fila de la corrida, en la tabla
`corridas`. No se versiona: el repositorio es público.

### El bloque de las preguntas (placas 26 a 30)

- **26**: cada uno escribe su pregunta en el teléfono.
- **27**: se abren los Deer Coins y la sala vota mientras pasan las respuestas de
  los que llevan años.
- **28**, teléfonos cerrados: llega con la 3ª más votada; el botón "Mostrar la 2ª"
  suma la 2ª. Una persona contesta cada una.
- **29**: la 1ª sola, en dos cards. **Llegar a esta placa es lo que la revela** y
  cierra la votación. Se reabren los Deer Coins desde el panel: a todos les dice
  que la votación cerró, y solo quien escribió la 1ª ve "Reclamar el premio". Si
  reclama, su nombre y su selfie aparecen en la card de la derecha.
- **30**: el reparto de las que quedaron.

El paso del ranking vive en `corridas.revelado` (0 la 3ª, 1 hasta la 2ª, 2 la
1ª) y **solo avanza**. Abrir la pantalla de la placa 29 en cualquier navegador
lo pone en 2.

---

## 4. Lo que falta antes del 24

- **Volver el ranking a 0** después de cualquier ensayo:
  `update corridas set revelado = 0 where id = '<corrida>'`. Si no, la charla
  arranca con la votación cerrada.
- **Borrar los asistentes de prueba** (`ZZPRUEBA`, "Junior", "Senior",
  "Encuesta") y sus aportes, en ese orden.
- **El documento de una carilla para el cliente** está listo y lo manda Agustín.

Lo hecho y comprobado: la prueba de carga con cien teléfonos y selfies (cero
errores, limpiada después), la revisión del costo de los sondeos, y el guion
cargado en el hub.

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
