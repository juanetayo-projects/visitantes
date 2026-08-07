-- Módulo "Otro": control de conceptos distintos a Cirugía/Hemodinamia (mismo patrón).
create table if not exists solicitudes_otro (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  nombre_paciente text not null,
  documento_paciente text not null,
  eps text,
  persona_solicita text,
  concepto text,
  celular text,
  observaciones text,
  atendido_por uuid references perfiles(id) on delete set null,
  atendido_por_nombre text,
  estado estado_hemodinamia not null default 'recibido',
  registrado_por uuid references perfiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_sol_otro_fecha on solicitudes_otro(fecha);
create index if not exists idx_sol_otro_doc on solicitudes_otro(documento_paciente);
alter table solicitudes_otro enable row level security;
drop policy if exists sol_otro_sel on solicitudes_otro;
drop policy if exists sol_otro_ins on solicitudes_otro;
drop policy if exists sol_otro_upd on solicitudes_otro;
drop policy if exists sol_otro_del on solicitudes_otro;
create policy sol_otro_sel on solicitudes_otro for select using (auth.uid() is not null);
create policy sol_otro_ins on solicitudes_otro for insert with check (is_staff());
create policy sol_otro_upd on solicitudes_otro for update using (is_staff() or current_rol() = 'otro') with check (is_staff() or current_rol() = 'otro');
create policy sol_otro_del on solicitudes_otro for delete using (is_admin());

create table if not exists comentarios_otro (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references solicitudes_otro(id) on delete cascade,
  autor_id uuid references perfiles(id) on delete set null,
  comentario text not null,
  created_at timestamptz not null default now()
);
alter table comentarios_otro enable row level security;
drop policy if exists com_otro_sel on comentarios_otro;
drop policy if exists com_otro_ins on comentarios_otro;
create policy com_otro_sel on comentarios_otro for select using (auth.uid() is not null);
create policy com_otro_ins on comentarios_otro for insert with check (is_staff() or current_rol() = 'otro');
