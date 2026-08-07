-- Nuevo rol "otro" (rol de gestión del módulo Otro, mismo patrón que cirugia/hemodinamia).
-- Separado en su propia migración: un valor de enum agregado con ALTER TYPE no puede
-- usarse como literal dentro de la misma transacción en que se agrega (ver enum_valores.sql).
alter type rol_usuario add value if not exists 'otro';
