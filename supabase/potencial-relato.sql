-- Lo que la persona contó, tal como lo contó.
--
-- El análisis se toma escuchando: se le pide que cuente dos o tres cosas del
-- trabajo que le costaron resolver, y de ahí salen las dos lecturas (cuánto
-- duraban y qué le exigían). Ese material se anota mientras habla y se codifica
-- después, que es la misma división que ya tienen las manchas: se administra en
-- la hoja de la entrevista y se codifica en la ficha.
--
-- Sin esto, entre la entrevista y la codificación hay solo memoria.
alter table analisis_discursivo
  add column if not exists relato text;

comment on column analisis_discursivo.relato is
  'Las asignaciones que contó el candidato, con qué le exigieron y cuánto duró cada una. Se anota en la entrevista y de acá sale la codificación.';
