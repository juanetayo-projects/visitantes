-- Actualización de catálogo de ubicaciones según "ubicaciones ago2026.xlsx" (export GoMedisys)
-- Decisiones confirmadas con el usuario (27-ago-2026):
--  1) Piso 9 Hospitalización: la lista real y vigente pasó a ser Sillón 60-84 (25 puestos),
--     reemplazando el listado anterior (Camilla 1 + Sillón 1-12).
--  2) Piso 2 Hospitalización: Sillón 1-9 y Camilla 18 son reconversión de mobiliario en el
--     mismo puesto (no alta+baja): Sillón N -> Camilla N (N=1..9) y Camilla 18 -> Sillón 18.
--  3) Piso 2 Hospitalización: Camilla Soat 1/2 y Sala Proc. Camilla 1/2 pasan a inactivas
--     (el Excel las reporta con Estado=I).
--  4) Piso 2 Hospitalización: se agregan como nuevas Camilla 1-9 (ya cubierto por la
--     reconversión del punto 2), Camilla 45 y Camilla 49-59.

-- 1) Reconversión de mobiliario Piso 2: Sillón 1-9 -> Camilla 1-9
update ubicaciones set etiqueta = 'Camilla 1', tipo = 'camilla' where id = '74d5f111-3777-4381-b5e7-bf0b03b63e0c';
update ubicaciones set etiqueta = 'Camilla 2', tipo = 'camilla' where id = 'cf20260e-9705-45ad-b335-09e9a2edd425';
update ubicaciones set etiqueta = 'Camilla 3', tipo = 'camilla' where id = '16f19c16-8dda-4202-b991-e62a6f589c4b';
update ubicaciones set etiqueta = 'Camilla 4', tipo = 'camilla' where id = 'd93d4886-a1df-4b72-92b1-6be0f56f3c8d';
update ubicaciones set etiqueta = 'Camilla 5', tipo = 'camilla' where id = '2aaa2814-6125-418b-bb71-bb8c425fdd99';
update ubicaciones set etiqueta = 'Camilla 6', tipo = 'camilla' where id = 'fd2e83f9-f1bc-4ddf-9064-638695192eee';
update ubicaciones set etiqueta = 'Camilla 7', tipo = 'camilla' where id = '0d858207-b375-46b9-9412-9a6f569c349f';
update ubicaciones set etiqueta = 'Camilla 8', tipo = 'camilla' where id = '3f083deb-a68e-423a-bdc3-9bf3a5ee3b68';
update ubicaciones set etiqueta = 'Camilla 9', tipo = 'camilla' where id = '47422234-9d03-421d-a9a7-bf0a5951270a';

-- Reconversión Piso 2: Camilla 18 -> Sillón 18
update ubicaciones set etiqueta = 'Sillón 18', tipo = 'sillon' where id = 'd2703e46-214d-4311-b7aa-06958b04d3e1';

-- 2) Piso 2: desactivar puestos que el Excel reporta como Estado=I
update ubicaciones set activo = false where id in (
  '92f3d1c1-3d33-4151-a728-e51109941a76', -- Camilla Soat 1
  '86f10295-bf1f-47b9-b2a9-a873f7f11ceb', -- Camilla Soat 2
  '890b01fa-cde7-4eae-8cc6-1eac165d5330', -- Sala Proc. Camilla 1
  '97c5bb2b-13eb-4ea1-8cba-4110f4a23430'  -- Sala Proc. Camilla 2
);

-- 3) Piso 2: nuevas camillas (Camilla 45, 49-59)
insert into ubicaciones (piso_id, area, tipo, etiqueta, cupo_default, orden, activo, servicio)
values
  ('d9fb5565-8434-404f-a3c5-24c99352ff72', null, 'camilla', 'Camilla 45', 1, 53, true, 'HOSPITALIZACION'),
  ('d9fb5565-8434-404f-a3c5-24c99352ff72', null, 'camilla', 'Camilla 49', 1, 54, true, 'HOSPITALIZACION'),
  ('d9fb5565-8434-404f-a3c5-24c99352ff72', null, 'camilla', 'Camilla 50', 1, 55, true, 'HOSPITALIZACION'),
  ('d9fb5565-8434-404f-a3c5-24c99352ff72', null, 'camilla', 'Camilla 51', 1, 56, true, 'HOSPITALIZACION'),
  ('d9fb5565-8434-404f-a3c5-24c99352ff72', null, 'camilla', 'Camilla 52', 1, 57, true, 'HOSPITALIZACION'),
  ('d9fb5565-8434-404f-a3c5-24c99352ff72', null, 'camilla', 'Camilla 53', 1, 58, true, 'HOSPITALIZACION'),
  ('d9fb5565-8434-404f-a3c5-24c99352ff72', null, 'camilla', 'Camilla 54', 1, 59, true, 'HOSPITALIZACION'),
  ('d9fb5565-8434-404f-a3c5-24c99352ff72', null, 'camilla', 'Camilla 55', 1, 60, true, 'HOSPITALIZACION'),
  ('d9fb5565-8434-404f-a3c5-24c99352ff72', null, 'camilla', 'Camilla 56', 1, 61, true, 'HOSPITALIZACION'),
  ('d9fb5565-8434-404f-a3c5-24c99352ff72', null, 'camilla', 'Camilla 57', 1, 62, true, 'HOSPITALIZACION'),
  ('d9fb5565-8434-404f-a3c5-24c99352ff72', null, 'camilla', 'Camilla 58', 1, 63, true, 'HOSPITALIZACION'),
  ('d9fb5565-8434-404f-a3c5-24c99352ff72', null, 'camilla', 'Camilla 59', 1, 64, true, 'HOSPITALIZACION');

-- 4) Piso 9: desactivar el listado anterior (Camilla 1 + Sillón 1-12), obsoleto
update ubicaciones set activo = false where id in (
  '11bf63ed-7595-420f-8d84-1603bb86ffd3', -- Camilla 1
  '34a99fe2-241c-4f9f-a780-622a45002d8d', -- Sillón 1
  'd6bc9625-6e94-49af-a25e-8bc67d70aa0a', -- Sillón 2
  '6680e5a3-0f04-43c2-9fd0-02d84ec0333a', -- Sillón 3
  '31518c58-5311-4468-b8f8-8a8e6eb29203', -- Sillón 4
  'c07ab022-a66c-40c0-b6ff-599cadc95153', -- Sillón 5
  '71d370f3-62bc-462d-9855-5fa7a470b3b3', -- Sillón 6
  'a4adbd2e-be88-473c-8ca2-896ae1bb72f4', -- Sillón 7
  '9f4281e2-3a71-49bf-81f3-e519736d83f3', -- Sillón 8
  '3d3a43ed-a71e-4986-bf38-7bfac254b178', -- Sillón 9
  '3a1a3d55-ac75-4d58-a788-63e2d87384a8', -- Sillón 10
  '298291f6-3e78-4c16-9fdf-9264d8ca6d3e', -- Sillón 11
  'afc9c148-db92-4f2b-9898-a5b92e3424ac'  -- Sillón 12
);

-- 5) Piso 9: nuevo listado vigente Sillón 60-84 (25 puestos)
insert into ubicaciones (piso_id, area, tipo, etiqueta, cupo_default, orden, activo, servicio)
select '654ca66e-2692-4294-9357-103c0bd9d780', null, 'sillon', 'Sillón ' || n, 1, 227 + (n - 59), true, 'HOSPITALIZACION PARCIAL'
from generate_series(60, 84) as n;
