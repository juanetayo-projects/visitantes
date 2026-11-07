-- Paralelismo App ↔ CENSO (nov-2026). Hallazgos de la auditoría contra el censo en vivo:
--  • El censo renombró unidades (HOSPITALIZACION → HOSPITALIZACION 2 PISO / 9 PISO;
--    CUIDADOS INTERMEDIOS → CUIDADOS INTERMEDIOS PISO 5 / PISO 9), lo que rompió la homologación
--    basada en nombres.
--  • La coincidencia automática emparejó por nombre entre pisos (Sillon 18 del piso 9 → Sillón 18 del piso 2).
-- Solución de fondo: la unidad se identifica por su ID estable de GoMedisys y cada unidad pertenece a un piso.

-- 1) Unidades del censo y su piso
create table if not exists censo_unidades (
  id_gomedisys text primary key,
  nombre text not null,
  piso_id uuid references pisos(id) on delete set null,
  ultimo_visto timestamptz,
  created_at timestamptz not null default now()
);
alter table censo_unidades enable row level security;
create policy censo_unidades_sel on censo_unidades for select using (auth.uid() is not null);
create policy censo_unidades_all on censo_unidades for all using (is_admin()) with check (is_admin());

insert into censo_unidades (id_gomedisys, nombre, piso_id)
select v.id, v.nombre, (select p.id from pisos p where p.nombre = v.piso)
from (values
  ('56',  'CUIDADO INTENSIVO 5 PISO',    'Piso 5 UCI'),
  ('57',  'CUIDADOS INTERMEDIOS PISO 5', 'Piso 5 UCIN'),
  ('58',  'HOSPITALIZACION 7 PISO',      'Piso 7 Hospitalización'),
  ('73',  'RECUPERACIÓN QUIROFANO',      'Piso 6 Cirugía'),
  ('97',  'HOSPITALIZACION 8 PISO',      'Piso 8 Hospitalización'),
  ('127', 'URGENCIAS ADULTOS URG',       'Piso 1 Urgencias'),
  ('128', 'URGENCIAS PEDIATRÍA URG',     'Piso 1 Urgencias'),
  ('217', 'HOSPITALIZACION PARCIAL',     'Piso 9 Hospitalización'),
  ('225', 'URGENCIAS HD',                null),
  ('232', 'HOSPITALIZACION 2 PISO',      'Piso 2 Hospitalización'),
  ('238', 'HOSPITALIZACION 9 PISO',      'Piso 9 Hospitalización'),
  ('240', 'CUIDADOS INTERMEDIOS PISO 9', 'Piso 9 UCIN')
) as v(id, nombre, piso)
on conflict (id_gomedisys) do nothing;

-- 2) Columnas de trazabilidad
alter table homologacion_ubicaciones
  add column if not exists censo_unidad_id text,
  add column if not exists ultimo_visto timestamptz;
alter table pacientes_ubicacion
  add column if not exists censo_unidad_id text,
  add column if not exists censo_area text,
  add column if not exists censo_cama text;

update homologacion_ubicaciones h set censo_unidad_id = c.id_gomedisys
from censo_unidades c where h.censo_unidad = c.nombre and h.censo_unidad_id is null;

-- 3) Catálogo: lo que el censo reporta hoy y la app no tiene
-- Piso 9 Hospitalización: el censo usa Sillón 1-20. Se reactivan 1-12 y se crean 13-20.
-- (Sillón 60-84 se deja activo: el retiro queda pendiente de confirmación de la clínica.)
update ubicaciones u set activo = true, servicio = 'HOSPITALIZACION 9 PISO', orden = 215 + (regexp_replace(u.etiqueta, '\D', '', 'g'))::int
from pisos p where p.id = u.piso_id and p.nombre = 'Piso 9 Hospitalización' and u.etiqueta ~ '^Sillón ([1-9]|1[0-2])$';

insert into ubicaciones (piso_id, area, tipo, etiqueta, cupo_default, orden, activo, servicio)
select p.id, null, 'sillon', 'Sillón ' || n, 1, 215 + n, true, 'HOSPITALIZACION 9 PISO'
from pisos p cross join generate_series(13, 20) n where p.nombre = 'Piso 9 Hospitalización'
on conflict do nothing;

-- Piso 9 UCIN: unidad nueva del censo (CE 16-20). El piso existía sin ubicaciones.
insert into ubicaciones (piso_id, area, tipo, etiqueta, cupo_default, orden, activo, servicio)
select p.id, null, 'cubiculo', 'Cubículo ' || n, 1, n, true, 'CUIDADOS INTERMEDIOS PISO 9'
from pisos p cross join generate_series(16, 20) n where p.nombre = 'Piso 9 UCIN'
on conflict do nothing;

-- Piso 2: reconversión de mobiliario en el mismo puesto (mismo criterio de ago-2026) y Camilla 60 nueva.
update ubicaciones u set etiqueta = replace(u.etiqueta, 'Sillón', 'Camilla'), tipo = 'camilla'
from pisos p where p.id = u.piso_id and p.nombre = 'Piso 2 Hospitalización' and u.etiqueta in ('Sillón 10', 'Sillón 11');

insert into ubicaciones (piso_id, area, tipo, etiqueta, cupo_default, orden, activo, servicio)
select p.id, null, 'camilla', 'Camilla 60', 1, (select max(x.orden) + 1 from ubicaciones x where x.piso_id = p.id), true, 'HOSPITALIZACION'
from pisos p where p.nombre = 'Piso 2 Hospitalización'
on conflict do nothing;

-- Piso 8: la habitación 803 ahora se divide en 803A / 803B / 803C.
update ubicaciones u set etiqueta = '803A'
from pisos p where p.id = u.piso_id and p.nombre = 'Piso 8 Hospitalización' and u.etiqueta = '803';

insert into ubicaciones (piso_id, area, tipo, etiqueta, cupo_default, orden, activo, servicio)
select p.id, null, b.tipo, v.e, b.cupo_default, b.orden, true, b.servicio
from pisos p join ubicaciones b on b.piso_id = p.id and b.etiqueta = '803A'
cross join (values ('803B'), ('803C')) as v(e)
where p.nombre = 'Piso 8 Hospitalización'
on conflict do nothing;

-- 4) Homologación: corrige los cruces entre pisos
-- HOSPITALIZACION 9 PISO / Sillon N → Sillón N del Piso 9 (estaban en el Piso 2).
update homologacion_ubicaciones h set ubicacion_id = u.id, origen = 'regla'
from ubicaciones u join pisos p on p.id = u.piso_id
where h.censo_unidad = 'HOSPITALIZACION 9 PISO' and h.censo_cama ~* '^sill[oó]n\s+\d+$'
  and p.nombre = 'Piso 9 Hospitalización'
  and u.etiqueta = 'Sillón ' || regexp_replace(h.censo_cama, '\D', '', 'g');

-- CI 03 pertenece a la UCI, no a la UCIN.
update homologacion_ubicaciones h set ubicacion_id = u.id, origen = 'regla'
from ubicaciones u join pisos p on p.id = u.piso_id
where h.censo_unidad = 'CUIDADO INTENSIVO 5 PISO' and h.censo_cama = 'CI 03'
  and p.nombre = 'Piso 5 UCI' and u.etiqueta = 'Cubículo 03';

-- Nombres de unidad que el censo ya no envía: se conservan como histórico, inactivos.
update homologacion_ubicaciones set activo = false
where censo_unidad in ('HOSPITALIZACION', 'CUIDADOS INTERMEDIOS');

-- 5) Festivos: incluye el nuevo festivo de la Ley 2578 de 2026 (Virgen de Chiquinquirá)
insert into festivos (fecha, nombre) values
  ('2026-01-01', 'Año Nuevo'),
  ('2026-01-12', 'Reyes Magos'),
  ('2026-03-23', 'Día de San José'),
  ('2026-04-02', 'Jueves Santo'),
  ('2026-04-03', 'Viernes Santo'),
  ('2026-05-01', 'Día del Trabajo'),
  ('2026-05-18', 'Ascensión del Señor'),
  ('2026-06-08', 'Corpus Christi'),
  ('2026-06-15', 'Sagrado Corazón'),
  ('2026-06-29', 'San Pedro y San Pablo'),
  ('2026-07-13', 'Nuestra Señora del Rosario de Chiquinquirá'),
  ('2026-07-20', 'Día de la Independencia'),
  ('2026-08-07', 'Batalla de Boyacá'),
  ('2026-08-17', 'Asunción de la Virgen'),
  ('2026-10-12', 'Día de la Raza'),
  ('2026-11-02', 'Todos los Santos'),
  ('2026-11-16', 'Independencia de Cartagena'),
  ('2026-12-08', 'Inmaculada Concepción'),
  ('2026-12-25', 'Navidad'),
  ('2027-01-01', 'Año Nuevo'),
  ('2027-01-11', 'Reyes Magos'),
  ('2027-03-22', 'Día de San José'),
  ('2027-03-25', 'Jueves Santo'),
  ('2027-03-26', 'Viernes Santo'),
  ('2027-05-01', 'Día del Trabajo'),
  ('2027-05-10', 'Ascensión del Señor'),
  ('2027-05-31', 'Corpus Christi'),
  ('2027-06-07', 'Sagrado Corazón'),
  ('2027-07-05', 'San Pedro y San Pablo'),
  ('2027-07-12', 'Nuestra Señora del Rosario de Chiquinquirá'),
  ('2027-07-20', 'Día de la Independencia'),
  ('2027-08-07', 'Batalla de Boyacá'),
  ('2027-08-16', 'Asunción de la Virgen'),
  ('2027-10-18', 'Día de la Raza'),
  ('2027-11-01', 'Todos los Santos'),
  ('2027-11-15', 'Independencia de Cartagena'),
  ('2027-12-08', 'Inmaculada Concepción'),
  ('2027-12-25', 'Navidad')
on conflict (fecha) do update set nombre = excluded.nombre;

-- 6) UCIN: el censo nombra las camas "CE nn" bajo las unidades renombradas; corresponden a "Cubículo nn".
insert into homologacion_ubicaciones (censo_unidad, censo_unidad_id, censo_area, censo_cama, ubicacion_id, origen, activo)
select v.unidad, v.id, null, 'CE ' || lpad(n::text, 2, '0'), u.id, 'regla', true
from (values ('CUIDADOS INTERMEDIOS PISO 5', '57', 'Piso 5 UCIN', 1, 14), ('CUIDADOS INTERMEDIOS PISO 9', '240', 'Piso 9 UCIN', 16, 20)) as v(unidad, id, piso, desde, hasta)
cross join lateral generate_series(v.desde, v.hasta) n
join pisos p on p.nombre = v.piso
join ubicaciones u on u.piso_id = p.id and u.etiqueta = 'Cubículo ' || lpad(n::text, 2, '0')
on conflict do nothing;
