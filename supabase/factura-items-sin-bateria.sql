-- La segunda línea del renglón decía con qué batería se evaluó y cuándo se
-- entregó el informe. Son datos del trabajo interno y no van en el papel del
-- cliente: la ruta dejó de escribirla el 3/10/2026 y acá se borra de los
-- renglones que ya la tenían. La del adicional BTSA (el dólar usado) se queda.
update public.factura_items
set detalle = null
where detalle ilike 'Batería%' or detalle ilike '%informe entregado%';

select count(*) as quedan from public.factura_items
where detalle ilike 'Batería%' or detalle ilike '%informe entregado%';
