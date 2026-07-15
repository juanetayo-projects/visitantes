-- Notas administrativas (puntos 9-12)
create table if not exists notas_administrativas (
  id uuid primary key default gen_random_uuid(),
  ubicacion_id uuid references ubicaciones(id) on delete set null,
  piso_id uuid references pisos(id) on delete set null,
  num_ingreso text,
  paciente_documento text,
  paciente_nombre text,
  comentario text not null,
  registrado_por uuid references perfiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_notas_adm_fecha on notas_administrativas(created_at);
create index if not exists idx_notas_adm_doc on notas_administrativas(paciente_documento);
alter table notas_administrativas enable row level security;
drop policy if exists notas_adm_sel on notas_administrativas;
drop policy if exists notas_adm_ins on notas_administrativas;
create policy notas_adm_sel on notas_administrativas for select using (auth.uid() is not null);
create policy notas_adm_ins on notas_administrativas for insert with check (is_staff());

-- Cirugía (puntos 13-14) — replica el flujo real: el orientador registra la solicitud
-- de información que trae el paciente/familiar en recepción; el rol "cirugia" no edita
-- esos campos, solo diligencia su propia revisión/observación (una por solicitud).
create table if not exists solicitudes_cirugia (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  nombre_paciente text not null,
  documento_paciente text not null,
  eps text,
  persona_solicita text,
  procedimiento text,
  celular text,
  observaciones text,
  atendido_por uuid references perfiles(id) on delete set null,
  revisado_por_cirugia uuid references perfiles(id) on delete set null,
  observacion_cirugia text,
  revisado_at timestamptz,
  registrado_por uuid references perfiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_sol_cir_fecha on solicitudes_cirugia(fecha);
create index if not exists idx_sol_cir_doc on solicitudes_cirugia(documento_paciente);
alter table solicitudes_cirugia enable row level security;
drop policy if exists sol_cir_sel on solicitudes_cirugia;
drop policy if exists sol_cir_ins on solicitudes_cirugia;
drop policy if exists sol_cir_upd on solicitudes_cirugia;
drop policy if exists sol_cir_del on solicitudes_cirugia;
create policy sol_cir_sel on solicitudes_cirugia for select using (auth.uid() is not null);
create policy sol_cir_ins on solicitudes_cirugia for insert with check (is_staff());
create policy sol_cir_upd on solicitudes_cirugia for update using (is_staff() or current_rol() = 'cirugia') with check (is_staff() or current_rol() = 'cirugia');
create policy sol_cir_del on solicitudes_cirugia for delete using (is_admin());

-- Hemodinamia (puntos 15-16)
create table if not exists solicitudes_hemodinamia (
  id uuid primary key default gen_random_uuid(),
  fecha_hora timestamptz not null default now(),
  cedula_paciente text not null,
  nombre_paciente text not null,
  procedimiento text not null,
  documentos text,
  estado estado_hemodinamia not null default 'recibido',
  registrado_por uuid references perfiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_sol_hem_fecha on solicitudes_hemodinamia(fecha_hora);
create index if not exists idx_sol_hem_ced on solicitudes_hemodinamia(cedula_paciente);
create table if not exists comentarios_hemodinamia (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references solicitudes_hemodinamia(id) on delete cascade,
  autor_id uuid references perfiles(id) on delete set null,
  comentario text not null,
  created_at timestamptz not null default now()
);
alter table solicitudes_hemodinamia enable row level security;
alter table comentarios_hemodinamia enable row level security;
drop policy if exists sol_hem_sel on solicitudes_hemodinamia;
drop policy if exists sol_hem_iu on solicitudes_hemodinamia;
drop policy if exists sol_hem_i on solicitudes_hemodinamia;
drop policy if exists sol_hem_d on solicitudes_hemodinamia;
drop policy if exists com_hem_sel on comentarios_hemodinamia;
drop policy if exists com_hem_ins on comentarios_hemodinamia;
create policy sol_hem_sel on solicitudes_hemodinamia for select using (auth.uid() is not null);
create policy sol_hem_i   on solicitudes_hemodinamia for insert with check (is_staff());
create policy sol_hem_u   on solicitudes_hemodinamia for update using (is_staff() or current_rol() = 'hemodinamia') with check (is_staff() or current_rol() = 'hemodinamia');
create policy sol_hem_d   on solicitudes_hemodinamia for delete using (is_admin());
create policy com_hem_sel on comentarios_hemodinamia for select using (auth.uid() is not null);
create policy com_hem_ins on comentarios_hemodinamia for insert with check (is_staff() or current_rol() = 'hemodinamia');
