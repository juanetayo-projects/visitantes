-- Claves naturales para importar Pisos/Ubicaciones por upsert desde Excel.
do $$ begin
  alter table pisos add constraint pisos_sede_nombre_uk unique (sede_id, nombre);
exception when others then null; end $$;
do $$ begin
  alter table ubicaciones add constraint ubic_piso_area_etiqueta_uk unique nulls not distinct (piso_id, area, etiqueta);
exception when others then null; end $$;
