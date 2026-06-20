-- ============================================================
--  Seed de catálogos — Control de Visitantes
-- ============================================================

-- ─── Sedes ──────────────────────────────────────────────────
insert into sedes (nombre, orden) values
  ('Torre de Salud', 1), ('Urgencias', 2)
on conflict (nombre) do nothing;

-- ─── Puertas ────────────────────────────────────────────────
insert into puertas (sede_id, nombre)
select s.id, v.nombre from sedes s
join (values ('Puerta BodyTech'), ('Puerta Ambulancias')) v(nombre) on true
where s.nombre = 'Torre de Salud'
  and not exists (select 1 from puertas p where p.sede_id = s.id and p.nombre = v.nombre);

insert into puertas (sede_id, nombre)
select s.id, v.nombre from sedes s
join (values ('Puerta Ambulancias'), ('Puerta Administración')) v(nombre) on true
where s.nombre = 'Urgencias'
  and not exists (select 1 from puertas p where p.sede_id = s.id and p.nombre = v.nombre);

-- ─── Pisos ──────────────────────────────────────────────────
insert into pisos (sede_id, numero, nombre, orden)
select s.id, v.numero, v.nombre, v.orden from sedes s
join (values
  (1,'Piso 1 Imágenes',1), (2,'Piso 2 Hospitalización HD',2), (5,'Piso 5 Cirugía',5),
  (6,'Piso 6 UCI',6), (6,'Piso 6 UCIN',7), (7,'Piso 7 Hospitalización',8),
  (8,'Piso 8 Hospitalización',9), (9,'Piso 9 Hospitalización',10)
) v(numero,nombre,orden) on true
where s.nombre = 'Torre de Salud'
  and not exists (select 1 from pisos p where p.sede_id = s.id and p.nombre = v.nombre);

insert into pisos (sede_id, numero, nombre, orden)
select s.id, 1, 'Piso 1 Urgencias', 1 from sedes s
where s.nombre = 'Urgencias'
  and not exists (select 1 from pisos p where p.sede_id = s.id and p.nombre = 'Piso 1 Urgencias');

-- ─── Ubicaciones ────────────────────────────────────────────
-- Piso 1 Imágenes
insert into ubicaciones (piso_id, tipo, etiqueta, cupo_default, orden)
select p.id, 'area', v.et, 1, v.o from pisos p
join (values ('Tomografía',1),('Ecografía',2),('Recuperación',3),('Mamografía',4),('Densitometría',5)) v(et,o) on true
where p.nombre = 'Piso 1 Imágenes'
  and not exists (select 1 from ubicaciones u where u.piso_id = p.id);

-- Piso 2 Hospitalización HD: Cubículos 1..36 + Sillones 1..24
insert into ubicaciones (piso_id, tipo, etiqueta, cupo_default, orden)
select p.id, 'cubiculo', 'Cubículo '||g, 1, g from pisos p, generate_series(1,36) g
where p.nombre = 'Piso 2 Hospitalización HD' and not exists (select 1 from ubicaciones u where u.piso_id = p.id);
insert into ubicaciones (piso_id, tipo, etiqueta, cupo_default, orden)
select p.id, 'sillon', 'Sillón '||g, 1, 100+g from pisos p, generate_series(1,24) g
where p.nombre = 'Piso 2 Hospitalización HD' and (select count(*) from ubicaciones u where u.piso_id = p.id) = 36;

-- Piso 5 Cirugía: Quirófanos 1..6 + Recuperación
insert into ubicaciones (piso_id, tipo, etiqueta, cupo_default, orden)
select p.id, 'area', 'Quirófano '||g, 1, g from pisos p, generate_series(1,6) g
where p.nombre = 'Piso 5 Cirugía' and not exists (select 1 from ubicaciones u where u.piso_id = p.id);
insert into ubicaciones (piso_id, tipo, etiqueta, cupo_default, orden)
select p.id, 'area', 'Recuperación', 1, 10 from pisos p
where p.nombre = 'Piso 5 Cirugía' and (select count(*) from ubicaciones u where u.piso_id = p.id) = 6;

-- Piso 6 UCI / UCIN: Cubículos 1..24
insert into ubicaciones (piso_id, tipo, etiqueta, cupo_default, orden)
select p.id, 'cubiculo', 'Cubículo '||g, 1, g from pisos p, generate_series(1,24) g
where p.nombre in ('Piso 6 UCI','Piso 6 UCIN') and not exists (select 1 from ubicaciones u where u.piso_id = p.id);

-- Piso 7 / 8 Hospitalización: 701A..730B / 801A..830B
insert into ubicaciones (piso_id, tipo, etiqueta, cupo_default, orden)
select p.id, 'habitacion', '7'||lpad(n::text,2,'0')||suf, 2, n*2 + (case suf when 'A' then 0 else 1 end)
from pisos p, generate_series(1,30) n, unnest(array['A','B']) suf
where p.nombre = 'Piso 7 Hospitalización' and not exists (select 1 from ubicaciones u where u.piso_id = p.id);
insert into ubicaciones (piso_id, tipo, etiqueta, cupo_default, orden)
select p.id, 'habitacion', '8'||lpad(n::text,2,'0')||suf, 2, n*2 + (case suf when 'A' then 0 else 1 end)
from pisos p, generate_series(1,30) n, unnest(array['A','B']) suf
where p.nombre = 'Piso 8 Hospitalización' and not exists (select 1 from ubicaciones u where u.piso_id = p.id);

-- Piso 9 Hospitalización: Sillones 1..24
insert into ubicaciones (piso_id, tipo, etiqueta, cupo_default, orden)
select p.id, 'sillon', 'Sillón '||g, 1, g from pisos p, generate_series(1,24) g
where p.nombre = 'Piso 9 Hospitalización' and not exists (select 1 from ubicaciones u where u.piso_id = p.id);

-- Urgencias Piso 1: Observación-1..4 + Pediatría × (Cama/Camilla/Sillón 1..12)
insert into ubicaciones (piso_id, area, tipo, etiqueta, cupo_default, orden)
select p.id, a.area, t.tp::tipo_ubicacion, t.lbl||' '||g, 1, a.ord*1000 + t.ord*100 + g
from pisos p
join (values ('Observación-1',1),('Observación-2',2),('Observación-3',3),('Observación-4',4),('Pediatría',5)) a(area,ord) on true
join (values ('cama','Cama',1),('camilla','Camilla',2),('sillon','Sillón',3)) t(tp,lbl,ord) on true
cross join generate_series(1,12) g
where p.nombre = 'Piso 1 Urgencias' and not exists (select 1 from ubicaciones u where u.piso_id = p.id);

-- ─── Servicios institucionales ──────────────────────────────
insert into servicios (nombre) values
  ('UCI'),('UCIN'),('Hospitalización'),('Cirugía'),('Imágenes Diagnósticas'),
  ('Urgencias'),('Hospital Día'),('Laboratorio Clínico'),('Farmacia'),
  ('Nutrición'),('Mantenimiento'),('Sistemas'),('Seguridad'),('Servicios Generales')
on conflict (nombre) do nothing;

-- ─── Cargos ─────────────────────────────────────────────────
insert into cargos (nombre) values
  ('Médico Especialista'),('Médico General'),('Enfermero(a) Jefe'),
  ('Auxiliar de Enfermería'),('Coordinador(a)'),('Terapeuta'),
  ('Tecnólogo'),('Auxiliar Administrativo'),('Proveedor')
on conflict (nombre) do nothing;

-- ─── Tarjetas de acceso ─────────────────────────────────────
insert into tarjetas (codigo, sede_id, estado)
select 'T-'||lpad(g::text,3,'0'), (select id from sedes where nombre='Torre de Salud'), 'disponible'
from generate_series(1,50) g
on conflict (codigo) do nothing;
insert into tarjetas (codigo, sede_id, estado)
select 'U-'||lpad(g::text,3,'0'), (select id from sedes where nombre='Urgencias'), 'disponible'
from generate_series(1,20) g
on conflict (codigo) do nothing;
