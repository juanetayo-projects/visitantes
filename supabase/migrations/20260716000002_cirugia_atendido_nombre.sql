-- Nombre de quien atendió la solicitud, como texto libre. Para registros nuevos se
-- guarda junto con atendido_por (FK); para la carga histórica (planilla previa a la
-- app) no hay usuario del sistema que vincular, así que solo queda el nombre.
alter table solicitudes_cirugia add column if not exists atendido_por_nombre text;
