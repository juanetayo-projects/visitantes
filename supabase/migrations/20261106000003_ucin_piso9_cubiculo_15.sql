-- El censo reportó un paciente en CE 15 de CUIDADOS INTERMEDIOS PISO 9, que no estaba en el catálogo.
insert into ubicaciones (piso_id, area, tipo, etiqueta, cupo_default, orden, activo, servicio)
select p.id, null, 'cubiculo', 'Cubículo 15', 1, 15, true, 'CUIDADOS INTERMEDIOS PISO 9'
from pisos p where p.nombre = 'Piso 9 UCIN'
on conflict do nothing;
