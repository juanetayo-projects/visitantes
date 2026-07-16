-- La necesidad de tarjeta de acceso depende de la puerta de ingreso (no solo del tipo de visitante).
-- P.ej. en Urgencias: por Puerta Administración sí se asigna tarjeta; por Puerta Pacientes, no.
alter table puertas add column if not exists requiere_tarjeta boolean not null default true;

update puertas set requiere_tarjeta = false
where nombre = 'Puerta Pacientes'
  and sede_id = (select id from sedes where nombre = 'Urgencias');
