-- Alinea Cirugía con el mismo patrón de estado + hilo de comentarios de Hemodinamia
-- (antes tenía una sola "revisión"; ahora admite estado + múltiples comentarios).
alter table solicitudes_cirugia add column if not exists estado estado_hemodinamia not null default 'recibido';

create table if not exists comentarios_cirugia (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references solicitudes_cirugia(id) on delete cascade,
  autor_id uuid references perfiles(id) on delete set null,
  comentario text not null,
  created_at timestamptz not null default now()
);
alter table comentarios_cirugia enable row level security;
drop policy if exists com_cir_sel on comentarios_cirugia;
drop policy if exists com_cir_ins on comentarios_cirugia;
create policy com_cir_sel on comentarios_cirugia for select using (auth.uid() is not null);
create policy com_cir_ins on comentarios_cirugia for insert with check (is_staff() or current_rol() = 'cirugia');

-- Migra la revisión única existente al nuevo hilo de comentarios + estado.
insert into comentarios_cirugia (solicitud_id, autor_id, comentario, created_at)
select id, revisado_por_cirugia, observacion_cirugia, coalesce(revisado_at, created_at)
from solicitudes_cirugia
where observacion_cirugia is not null and observacion_cirugia <> '';

update solicitudes_cirugia set estado = 'revisado' where revisado_por_cirugia is not null;

alter table solicitudes_cirugia drop column if exists revisado_por_cirugia;
alter table solicitudes_cirugia drop column if exists observacion_cirugia;
alter table solicitudes_cirugia drop column if exists revisado_at;
