-- Nadie recibe todavía el aviso de informe listo: los informes se entregan por
-- fuera del OS y el aviso está apagado (`AVISA_INFORME` en
-- `lib/correo-avisos.ts`). El tilde queda destildado en todos para que la ficha
-- del cliente diga lo que pasa, y los contactos nuevos nacen sin él.
--
-- El día que se prenda hay que volver a tildarlo a quien corresponda.

update public.contactos set recibe_informe = false where recibe_informe;
alter table public.contactos alter column recibe_informe set default false;
