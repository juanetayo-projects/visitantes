-- Agrega columna id a festivos para permitir CRUD genérico por id (PK pasa a id, fecha queda unique).
alter table festivos add column if not exists id uuid default gen_random_uuid();
update festivos set id = gen_random_uuid() where id is null;
do $$ begin
  if exists (select 1 from pg_constraint where conname='festivos_pkey') then
    alter table festivos drop constraint festivos_pkey;
  end if;
exception when others then null; end $$;
alter table festivos alter column id set not null;
do $$ begin alter table festivos add constraint festivos_pkey primary key (id); exception when others then null; end $$;
do $$ begin alter table festivos add constraint festivos_fecha_key unique (fecha); exception when others then null; end $$;
