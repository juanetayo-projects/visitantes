-- ============================================================
--  Control de Visitantes — Clínica Santa Bárbara
--  Esquema base + RLS
-- ============================================================

-- ─── Tipos enumerados ───────────────────────────────────────
do $$ begin
  create type rol_usuario       as enum ('admin','orientador','coordinador');
  create type tipo_ubicacion    as enum ('habitacion','cubiculo','sillon','cama','camilla','area');
  create type tipo_visitante     as enum ('familiar','proveedor','colaborador');
  create type tipo_acompanante   as enum ('permanente','visita');
  create type estado_visita      as enum ('activa','finalizada');
  create type estado_tarjeta     as enum ('disponible','en_uso','inactiva');
  create type tipo_aislamiento   as enum ('contacto','gotas','aereo','protector','estricto');
  create type tipo_evento_visita as enum ('ingreso','salida');
exception when duplicate_object then null; end $$;

-- ─── Perfiles (usuarios del sistema) ────────────────────────
create table if not exists perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null default '',
  email      text not null,
  rol        rol_usuario not null default 'orientador',
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Helpers de rol (security definer para evitar recursión de RLS)
create or replace function current_rol() returns rol_usuario
  language sql stable security definer set search_path = public as $$
  select rol from perfiles where id = auth.uid()
$$;
create or replace function is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select rol = 'admin' from perfiles where id = auth.uid()), false)
$$;
create or replace function is_staff() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select rol in ('admin','orientador') from perfiles where id = auth.uid()), false)
$$;

-- ─── Catálogos institucionales ──────────────────────────────
create table if not exists servicios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activo boolean not null default true
);
create table if not exists cargos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activo boolean not null default true
);

create table if not exists sedes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  orden int not null default 0,
  activo boolean not null default true
);
create table if not exists puertas (
  id uuid primary key default gen_random_uuid(),
  sede_id uuid not null references sedes(id) on delete cascade,
  nombre text not null,
  activo boolean not null default true
);
create table if not exists pisos (
  id uuid primary key default gen_random_uuid(),
  sede_id uuid not null references sedes(id) on delete cascade,
  numero int not null,
  nombre text not null,
  orden int not null default 0,
  activo boolean not null default true
);
create table if not exists ubicaciones (
  id uuid primary key default gen_random_uuid(),
  piso_id uuid not null references pisos(id) on delete cascade,
  area text,
  tipo tipo_ubicacion not null,
  etiqueta text not null,
  cupo_default int not null default 2,
  orden int not null default 0,
  activo boolean not null default true
);
create index if not exists idx_ubic_piso on ubicaciones(piso_id);

-- ─── Personas ───────────────────────────────────────────────
create table if not exists responsables (
  id uuid primary key default gen_random_uuid(),
  nombre_completo text not null,
  numero_documento text not null,
  servicio_id uuid references servicios(id) on delete set null,
  cargo_id uuid references cargos(id) on delete set null,
  telefono text,
  email text,
  activo boolean not null default true
);

create table if not exists visitantes (
  id uuid primary key default gen_random_uuid(),
  cedula text not null unique,
  nombres_completos text not null,
  celular text,
  email text,
  created_at timestamptz not null default now()
);

-- ─── Espejos de sistemas externos (GoMedisys / CENSO) ───────
create table if not exists pacientes_ubicacion (
  id uuid primary key default gen_random_uuid(),
  num_ingreso text not null unique,
  documento text,
  nombre text,
  edad int,
  ubicacion_id uuid references ubicaciones(id) on delete set null,
  piso_id uuid references pisos(id) on delete set null,
  ubicacion_etiqueta text,
  servicio text,
  fecha_ingreso date,
  sync_at timestamptz default now()
);
create index if not exists idx_pac_ubic on pacientes_ubicacion(ubicacion_id);

create table if not exists aislamientos (
  id uuid primary key default gen_random_uuid(),
  num_ingreso text not null,
  tipo tipo_aislamiento not null,
  vigente boolean not null default true,
  sync_at timestamptz default now()
);
create index if not exists idx_ais_ingreso on aislamientos(num_ingreso);

-- ─── Tarjetas de acceso ─────────────────────────────────────
create table if not exists tarjetas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  sede_id uuid references sedes(id) on delete set null,
  estado estado_tarjeta not null default 'disponible',
  visita_id uuid
);

-- ─── Control de ingreso (visitas) ───────────────────────────
create table if not exists visitas (
  id uuid primary key default gen_random_uuid(),
  tipo_visitante tipo_visitante not null,
  visitante_id uuid not null references visitantes(id) on delete restrict,
  tipo_acompanante tipo_acompanante,
  -- snapshot del paciente
  paciente_documento text,
  paciente_nombre text,
  num_ingreso text,
  ubicacion_id uuid references ubicaciones(id) on delete set null,
  ubicacion_etiqueta text,
  piso_id uuid references pisos(id) on delete set null,
  servicio_paciente text,
  aislamiento tipo_aislamiento,
  -- proveedor
  responsable_id uuid references responsables(id) on delete set null,
  -- permisos
  permiso_alimentos boolean not null default false,
  permiso_otros text,
  -- acceso
  sede_id uuid references sedes(id) on delete set null,
  puerta_id uuid references puertas(id) on delete set null,
  tarjeta_id uuid references tarjetas(id) on delete set null,
  estado estado_visita not null default 'activa',
  registrado_por uuid references perfiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_visitas_ubic   on visitas(ubicacion_id);
create index if not exists idx_visitas_estado on visitas(estado);
create index if not exists idx_visitas_fecha  on visitas(created_at);

alter table tarjetas
  drop constraint if exists tarjetas_visita_fk,
  add constraint tarjetas_visita_fk foreign key (visita_id) references visitas(id) on delete set null;

create table if not exists visita_eventos (
  id uuid primary key default gen_random_uuid(),
  visita_id uuid not null references visitas(id) on delete cascade,
  tipo tipo_evento_visita not null,
  hora timestamptz not null default now(),
  registrado_por uuid references perfiles(id) on delete set null
);
create index if not exists idx_evt_visita on visita_eventos(visita_id);

-- ─── Festivos (overrides; el front también los calcula) ─────
create table if not exists festivos (
  fecha date primary key,
  nombre text not null
);

-- ============================================================
--  Row Level Security
-- ============================================================
alter table perfiles            enable row level security;
alter table servicios           enable row level security;
alter table cargos              enable row level security;
alter table sedes               enable row level security;
alter table puertas             enable row level security;
alter table pisos               enable row level security;
alter table ubicaciones         enable row level security;
alter table responsables        enable row level security;
alter table visitantes          enable row level security;
alter table pacientes_ubicacion enable row level security;
alter table aislamientos        enable row level security;
alter table tarjetas            enable row level security;
alter table visitas             enable row level security;
alter table visita_eventos      enable row level security;
alter table festivos            enable row level security;

-- Perfiles: cada quien ve su perfil; admin ve/gestiona todos.
create policy perfiles_sel  on perfiles for select using (id = auth.uid() or is_admin() or current_rol() is not null);
create policy perfiles_ins  on perfiles for insert with check (is_admin());
create policy perfiles_upd  on perfiles for update using (is_admin() or id = auth.uid());
create policy perfiles_del  on perfiles for delete using (is_admin());

-- Catálogos de solo lectura para autenticados; escritura admin.
do $$
declare t text;
begin
  foreach t in array array['servicios','cargos','sedes','puertas','pisos','ubicaciones','responsables','festivos']
  loop
    execute format('create policy %1$s_sel on %1$s for select using (auth.uid() is not null);', t);
    execute format('create policy %1$s_ins on %1$s for insert with check (is_admin());', t);
    execute format('create policy %1$s_upd on %1$s for update using (is_admin());', t);
    execute format('create policy %1$s_del on %1$s for delete using (is_admin());', t);
  end loop;
end $$;

-- Espejos externos: lectura autenticados; escritura admin (el sync usa service_role y omite RLS).
do $$
declare t text;
begin
  foreach t in array array['pacientes_ubicacion','aislamientos']
  loop
    execute format('create policy %1$s_sel on %1$s for select using (auth.uid() is not null);', t);
    execute format('create policy %1$s_all on %1$s for all using (is_admin()) with check (is_admin());', t);
  end loop;
end $$;

-- Visitantes: lectura autenticados; escritura staff (admin/orientador).
create policy visitantes_sel on visitantes for select using (auth.uid() is not null);
create policy visitantes_ins on visitantes for insert with check (is_staff());
create policy visitantes_upd on visitantes for update using (is_staff());

-- Tarjetas: lectura autenticados; escritura staff (asignar/liberar) y gestión admin.
create policy tarjetas_sel on tarjetas for select using (auth.uid() is not null);
create policy tarjetas_ins on tarjetas for insert with check (is_admin());
create policy tarjetas_upd on tarjetas for update using (is_staff());
create policy tarjetas_del on tarjetas for delete using (is_admin());

-- Visitas y eventos: lectura autenticados; escritura staff.
create policy visitas_sel on visitas for select using (auth.uid() is not null);
create policy visitas_ins on visitas for insert with check (is_staff());
create policy visitas_upd on visitas for update using (is_staff());
create policy visitas_del on visitas for delete using (is_admin());

create policy evt_sel on visita_eventos for select using (auth.uid() is not null);
create policy evt_ins on visita_eventos for insert with check (is_staff());

-- ─── Alta automática de perfil al registrarse en Auth ───────
create or replace function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, email, nombre, rol)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nombre',''), 'orientador')
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();
