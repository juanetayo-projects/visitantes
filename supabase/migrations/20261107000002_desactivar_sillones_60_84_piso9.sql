-- El censo reporta el Piso 9 Hospitalización con Sillón 1-20; Sillón 60-84 (Excel de ago-2026) ya no aparece.
-- Confirmado por el usuario (nov-2026). Se desactivan, no se borran, y Urgencias conserva sus sillones 60-84.
-- Sus homologaciones se conservan: si el censo volviera a reportarlos, el sync genera «ubicacion_inactiva».
update ubicaciones u set activo = false
from pisos p
where p.id = u.piso_id and p.nombre = 'Piso 9 Hospitalización'
  and u.etiqueta ~ '^Sillón (6[0-9]|7[0-9]|8[0-4])$';
