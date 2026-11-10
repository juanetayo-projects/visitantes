-- Fecha y hora de ingreso del paciente (FechaHoraIngreso del CENSO, hora local de Colombia)
-- en cada inconsistencia, para facilitar la revisión.
alter table censo_inconsistencias add column if not exists fecha_hora_ingreso timestamp without time zone;
