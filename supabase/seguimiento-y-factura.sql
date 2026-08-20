-- El seguimiento a los noventa días, y el número de factura.
--
-- ## Para qué el seguimiento
--
-- Una recomendación no se puede evaluar el día que se entrega: se evalúa
-- después, viendo si a la persona le fue bien en el puesto. Guardar esa
-- respuesta es lo que permite calcular, más adelante:
--
--   · el porcentaje de acierto de cada evaluadora, cruzando lo que recomendó
--     contra cómo le fue a la persona;
--   · qué perfil funciona en cada familia de puesto y cada nivel, cruzando el
--     resultado con `pedidos.familia` y `pedidos.seniority`, que ya existen;
--   · qué indicadores del sumario acompañan a los que anduvieron bien, cruzando
--     contra `sumario_exner`.
--
-- Nada de eso se puede calcular sin el dato, y el dato solo existe si alguien
-- lo carga a los tres meses. Por eso `seguimiento_al` guarda cuándo toca
-- preguntarlo: una fecha calculada al vuelo no se puede consultar ni ordenar.
--
-- ## Por qué tres resultados y no un tilde
--
-- "Bien", "Regular" y "Mal" son grados, y el caso más informativo para el
-- modelo es justamente el del medio: alguien que entró, no fracasó, pero
-- tampoco rindió. Con un tilde ese caso se pierde en uno de los dos extremos.
--
-- Sin fila cargada es "todavía no se preguntó", que no es lo mismo que
-- "regular".

alter table public.evaluaciones
  add column if not exists numero_factura text,
  add column if not exists seguimiento_al date,
  add column if not exists seguimiento_resultado text
    check (seguimiento_resultado in ('Bien', 'Regular', 'Mal')),
  add column if not exists seguimiento_notas text;

-- Para la pantalla que va a listar los seguimientos que vencieron.
create index if not exists evaluaciones_seguimiento_idx
  on public.evaluaciones (seguimiento_al)
  where seguimiento_resultado is null;

comment on column public.evaluaciones.numero_factura is
  'Número de la factura emitida. Solo tiene sentido con facturado = true.';
comment on column public.evaluaciones.seguimiento_al is
  'Cuándo toca preguntar cómo le fue: noventa días desde que entró a trabajar.';
comment on column public.evaluaciones.seguimiento_resultado is
  'Cómo le fue en el puesto. Null = todavía no se preguntó.';
