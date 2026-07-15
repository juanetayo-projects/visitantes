-- Roles nuevos (Cirugía, Hemodinamia), tipo de visitante "sin tarjeta" y prefijo de código de tarjeta por sede.
alter type rol_usuario add value if not exists 'cirugia';
alter type rol_usuario add value if not exists 'hemodinamia';
alter type tipo_visitante add value if not exists 'sin_tarjeta';

do $$ begin
  create type estado_hemodinamia as enum ('recibido','atendido','revisado','pendiente');
exception when duplicate_object then null; end $$;

alter table sedes add column if not exists prefijo_tarjeta text;
update sedes set prefijo_tarjeta = 'T' where nombre = 'Torre de Salud';
update sedes set prefijo_tarjeta = 'U' where nombre = 'Urgencias';
