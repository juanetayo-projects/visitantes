-- Fix Urgencias Adultos / Zona D (27-ago-2026): el Excel "ubicaciones ago2026.xlsx" nombra
-- estos puestos "Silla 78/79/80/81" (GoMedisys), mientras el catálogo tenía "Sillón ..." con
-- espacios dobles inconsistentes. También había una fila duplicada de "Sillón 78" (sin
-- ninguna referencia en visitas/notas_administrativas/homologacion_ubicaciones) con
-- cupo_default=2; se fusiona ese cupo en la fila canónica antes de eliminar el duplicado.

update ubicaciones set etiqueta = 'Silla 78', cupo_default = 2 where id = 'a8001749-57e7-4db4-ad25-efd456d938ce';
update ubicaciones set etiqueta = 'Silla 79' where id = '5ea5e26c-ceef-41d5-aeb5-67abe4c7ac93';
update ubicaciones set etiqueta = 'Silla 80' where id = '23be4097-7c22-4b11-9feb-0074a88d0420';
update ubicaciones set etiqueta = 'Silla 81' where id = '20f803dc-0020-4c2a-8df3-eb068ac8bfe6';

delete from ubicaciones where id = '7ae0fb99-96aa-40d0-a952-802ab5b89151';
