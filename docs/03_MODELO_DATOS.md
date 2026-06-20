# Modelo de datos — Control de Visitantes

Proyecto Supabase `visitantes` (ref `unukkkyvbkfhpvtkjuxd`). Migraciones en
`supabase/migrations/`. Todas las tablas con RLS activo.

## Tipos enumerados
- `rol_usuario`: admin · orientador · coordinador
- `tipo_ubicacion`: habitacion · cubiculo · sillon · cama · camilla · area
- `tipo_visitante`: familiar · proveedor · colaborador
- `tipo_acompanante`: permanente · visita
- `estado_visita`: activa · finalizada
- `estado_tarjeta`: disponible · en_uso · inactiva
- `tipo_aislamiento`: contacto · gotas · aereo · protector · estricto
- `tipo_evento_visita`: ingreso · salida

## Tablas

### perfiles
Usuarios del sistema (1:1 con `auth.users`). `id, nombre, email, rol, activo`.
Trigger `handle_new_user` crea el perfil al registrarse (rol inicial: orientador).

### Catálogos
- **servicios** / **cargos**: `id, nombre, activo`.
- **sedes**: `id, nombre, orden, activo` (Torre de Salud, Urgencias).
- **puertas**: `id, sede_id→sedes, nombre, activo`.
- **pisos**: `id, sede_id→sedes, numero, nombre, orden, activo`.
- **ubicaciones**: `id, piso_id→pisos, area, tipo, etiqueta, cupo_default, orden, activo`
  (habitaciones, cubículos, camas, camillas, sillones, áreas).
- **festivos**: `id, fecha (unique), nombre`.

### Personas
- **responsables**: `id, nombre_completo, numero_documento, servicio_id, cargo_id, telefono, email, activo`.
- **visitantes**: `id, cedula (unique), nombres_completos, celular, email, created_at`.

### Espejos externos (alimentados por el sync)
- **pacientes_ubicacion** (GoMedisys): `id, num_ingreso (unique), documento, nombre, edad,
  ubicacion_id→ubicaciones, piso_id→pisos, ubicacion_etiqueta, servicio, fecha_ingreso, sync_at`.
- **aislamientos** (CENSO): `id, num_ingreso, tipo, vigente, sync_at`.

### Operación
- **tarjetas**: `id, codigo (unique), sede_id, estado, visita_id`.
- **visitas** (registro central):
  `id, tipo_visitante, visitante_id→visitantes, tipo_acompanante,`
  `paciente_documento, paciente_nombre, num_ingreso, ubicacion_id, ubicacion_etiqueta,`
  `piso_id, servicio_paciente, aislamiento  (← snapshot del paciente),`
  `responsable_id→responsables, permiso_alimentos, permiso_otros,`
  `sede_id, puerta_id, tarjeta_id→tarjetas, estado, registrado_por→perfiles, created_at`.
- **visita_eventos**: `id, visita_id→visitas, tipo (ingreso/salida), hora, registrado_por`.

## Seed inicial
2 sedes · 4 puertas · 9 pisos · **444 ubicaciones** · 14 servicios · 9 cargos · 70 tarjetas.
Seed de demostración (`20260620000003_seed_demo.sql`): 8 pacientes en Piso 7 + 7 visitas
activas. **Borrar al activar el sync real.**

## RLS (resumen)
- Catálogos/espejos: SELECT autenticado; escritura admin (espejos: service role).
- visitantes/tarjetas/visitas/visita_eventos: SELECT autenticado; INSERT/UPDATE staff;
  DELETE admin.
- perfiles: ve el propio + admin gestiona todos.
