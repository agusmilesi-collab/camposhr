-- El nivel de ajuste se guarda con el nombre que sale en el informe.
--
-- Hasta hoy la columna admitía "Apto", "Apto con observaciones", "Apto con
-- alertas" y "No apto", más los cuatro de "Encaja" de un juego anterior,
-- mientras la pantalla y el informe decían "Ajuste alto", "Ajuste con aspectos
-- a desarrollar", "Ajuste con alertas" y "Ajuste bajo". El dato se guardaba con
-- un nombre y se mostraba con otro, así que había que traducirlo en cada
-- lectura y quien miraba la tabla veía algo distinto de lo que firmó la
-- psicóloga.
--
-- "Encaja si cambia el puesto" pasa a "Ajuste bajo": lo que decía es que en ese
-- puesto la persona no encaja. "Sin puesto contra el cual medir" no tiene
-- equivalente y queda sin nivel, para completarlo a mano.

alter table evaluaciones drop constraint if exists evaluaciones_recomendacion_check;

update evaluaciones set recomendacion = 'Ajuste alto'
  where recomendacion in ('Apto', 'Encaja con el puesto');
update evaluaciones set recomendacion = 'Ajuste con aspectos a desarrollar'
  where recomendacion in ('Apto con observaciones', 'Encaja, con desarrollo');
update evaluaciones set recomendacion = 'Ajuste con alertas'
  where recomendacion = 'Apto con alertas';
update evaluaciones set recomendacion = 'Ajuste bajo'
  where recomendacion in ('No apto', 'Encaja si cambia el puesto');
update evaluaciones set recomendacion = null
  where recomendacion = 'Sin puesto contra el cual medir';

alter table evaluaciones add constraint evaluaciones_recomendacion_check
  check (recomendacion = any (array[
    'Ajuste alto',
    'Ajuste con aspectos a desarrollar',
    'Ajuste con alertas',
    'Ajuste bajo'
  ]::text[]));
