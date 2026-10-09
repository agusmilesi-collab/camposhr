-- El WhatsApp de cada evaluadora, para el correo que recibe el candidato con
-- el día y la hora de su entrevista: es a quien le escribe si tiene que
-- cambiarla. Con código de país, como el de las personas ("+54 9 341 ...").
alter table evaluadoras add column if not exists telefono text;
