-- El DNI del inquilino, como dato y no solo como archivo.
--
-- `dni_archivo` guarda la foto del documento para el legajo. El número hace
-- falta aparte: es lo que identifica a la persona en la factura cuando no tiene
-- CUIT cargado. Se guarda solo con dígitos, sin puntos.
alter table public.inquilinos add column if not exists dni text;
