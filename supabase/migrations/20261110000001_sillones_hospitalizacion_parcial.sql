-- Hospitalización Parcial (unidad CENSO 217) tiene sillones físicos propios, distintos de los
-- Sillón 1-20 de HOSPITALIZACION 9 PISO (confirmado por el usuario, 10-nov-2026).
-- La homologación SILL01-SILL12 apuntaba a los Sillón 1-12 del Piso 9, de modo que cuando el
-- censo traía pacientes en ambas unidades el sync reportaba «Dos pacientes en una ubicación».
--
-- 1) Crea Sillón P01-P12 en el Piso 9 con servicio HOSPITALIZACION PARCIAL.
-- 2) Reapunta la homologación de SILL01-SILL12 a esos sillones (origen manual).
-- El histórico de visitas no se toca: cada visita guarda su propia copia de ubicación y paciente.

insert into ubicaciones (piso_id, area, tipo, etiqueta, cupo_default, orden, activo, servicio)
select p.id, null, 'sillon', 'Sillón P' || lpad(n::text, 2, '0'), 1, 252 + n, true, 'HOSPITALIZACION PARCIAL'
from pisos p cross join generate_series(1, 12) as n
where p.nombre = 'Piso 9 Hospitalización'
  and not exists (
    select 1 from ubicaciones u
    where u.piso_id = p.id and u.etiqueta = 'Sillón P' || lpad(n::text, 2, '0')
  );

update homologacion_ubicaciones h set ubicacion_id = u.id, origen = 'manual'
from ubicaciones u join pisos p on p.id = u.piso_id
where (h.censo_unidad_id = '217' or h.censo_unidad = 'HOSPITALIZACION PARCIAL')
  and h.censo_cama ~* '^sill\d+$'
  and p.nombre = 'Piso 9 Hospitalización'
  and u.etiqueta = 'Sillón P' || lpad(regexp_replace(h.censo_cama, '\D', '', 'g')::int::text, 2, '0');
