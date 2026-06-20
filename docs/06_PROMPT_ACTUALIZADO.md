# Prompt actualizado — Control de Visitantes (Clínica Santa Bárbara)

> Prompt de construcción consolidado, con todas las decisiones y ajustes aplicados.
> Sirve para reconstruir o continuar la aplicación desde cero.

## Objetivo
Construir una app SaaS de **Control de Ingreso de Visitantes** para la Clínica de Alta
Complejidad Santa Bárbara (Colombia, GMT-5), profesional y comercializable.

## Infraestructura
- **Ruta local:** `C:\Users\Juan Carlos Etayo\visitantes`
- **GitHub:** repo público `visitantes` + GitHub Pages (deploy por Actions en cada push).
- **Supabase:** proyecto `visitantes` (Postgres + Auth + RLS + Edge Functions).
- **Resend:** API key `notificacionprogturnos` (recuperación de contraseña / notificaciones).
- **Logos:** `public/images/logo_cacsb2.png` y `logo_cacsb_blanc.png`.

## Branding
- Azul principal `#0D2D6B`, contraste `#16468E`.
- Cards de métricas con fondo de color según necesidad; cards/tablas/filtros con bordes
  sombreados. Máximo de filtros posibles. Exportación Excel y PDF. Estadísticas completas.
- Mapa de calor de flujo de visitantes por sede/piso/servicio, día de semana y hora.
- Zona horaria Colombia (GMT-5). Calendario de Colombia: domingos y festivos (Ley Emiliani)
  para gráficas, mapa de calor e informes.

## Roles
Administrador (todo + catálogos + usuarios), Orientador (registra), Coordinador (consulta).
Login institucional con recuperación de contraseña.

## Stack
React + Vite + TS + Tailwind · Supabase · ECharts · ExcelJS/pdfmake. (Reutiliza el modelo de
login y componentes de los proyectos previos del usuario.)

## Tablas (todas con CRUD de gestión y RLS)
- **Usuarios del sistema** (perfiles: admin/orientador/coordinador).
- **Responsables** (colaborador que atiende proveedores): persona, servicio, cargo, contacto.
- **Tipos de visitante:** familiar, proveedor, colaborador.
- **Sedes:** Torre de Salud (puertas: BodyTech, Ambulancias) y Urgencias (Ambulancias,
  Administración).
- **Pisos y ubicaciones:**
  - Torre: P1 Imágenes (Tomografía, Ecografía, Recuperación, Mamografía, Densitometría);
    P2 Hospitalización HD (Cubículo 1–36, Sillón 1–24); P5 Cirugía (Quirófanos + Recuperación);
    **P6 UCI** y **P6 UCIN** (Cubículo 1–24 c/u); P7 y P8 Hospitalización (701A/B…730A/B,
    801A/B…830A/B); P9 (Sillón 1–24).
  - Urgencias P1: Observación-1..4 y Pediatría, cada una con Cama/Camilla/Sillón 1–12.
  - *(UCI/UCIN quedó en Piso 6; la especificación original se contradecía con Piso 5 — editable
    en el catálogo.)*
- **Visitantes:** cédula, nombres, celular, email (opcional).
- **Tarjetas de acceso:** inventario numerado (estado disponible/en_uso/inactiva).
- **Control de ingreso (visitas):** snapshot del paciente (cédula, # ingreso, ubicación) traído
  de GoMedisys; visitante; horas de ingreso/salida (eventos múltiples); tipo de permiso
  (alimentos/otros); tipo de aislamiento (de CENSO); responsable (proveedor); tarjeta.
- **Festivos:** calendario Colombia (con generación automática por año).

## Reglas de negocio (incluye AJUSTES)
1. **Cupo:** configurable por ubicación (2 hospitalización / 1 UCI-Urgencias). **Máximo 2
   visitantes por paciente**; al intentar registrar el tercero, mostrar **modal de advertencia
   con los datos de los visitantes ya registrados**.
2. **Habitación sin paciente:** si el orientador hace clic por error en una ubicación sin
   paciente, mostrar **modal informativo** y no permitir el registro.
3. **Campo cédula:** sin autocompletado de correos del navegador (autoComplete off, modo
   numérico).
4. **Visitante/proveedor/colaborador existente:** al digitar la cédula, si ya está en la base
   de datos, **traer sus datos y permitir actualizarlos** al registrar.
5. **Snapshot del paciente:** congelar datos en la visita (la habitación se reasigna).
6. **Tarjeta:** se asigna al ingreso y se libera con la salida (libera el cupo).

## Vista de registro (super profesional)
Mostrar la distribución de los pisos del servicio seleccionado con las habitaciones
representadas por íconos/colores. **Vista global de habitaciones** con identificación por
color y **tooltips estilo Odoo (mouseover)**: al pasar el mouse, ver el detalle de cada
habitación. **AJUSTE:** destacar el nombre del paciente y diferenciar visualmente los datos
de los visitantes.

## Mapa de habitaciones
Estados por color: permanente (verde), visita (ámbar), paciente solo (azul), libre (gris);
borde rojo para aislamiento. Puntos de cupo. Tooltip con paciente destacado + visitantes.

## Módulo Visitas
Listado con **todos los filtros**: estado, tipo, sede, **piso, ubicación** (AJUSTE), fechas y
texto. Registro de salida + exportación Excel/PDF.

## Módulo Estadísticas (AJUSTES)
- **Todos los filtros posibles** (tipo, estado, sede, piso, rango de fechas).
- Mapa de calor de visitas por día×hora (GMT-5; festivos/domingos).
- **Clic en una celda → modal con vista profesional de las personas** contabilizadas en ese
  día/horario (tabla con visitante, tipo, paciente/ubicación), exportable a Excel/PDF.

## Integraciones (pendientes de scripts SQL del usuario)
- **GoMedisys (Azure SQL):** ubicación de pacientes → `pacientes_ubicacion` (mismas
  credenciales del proyecto Mapa de Calor de Urgencias; sync horario por GitHub Actions).
- **CENSO:** aislamientos → `aislamientos` (script SQL a suministrar).

## Gestión de usuarios
Edge Function `admin-usuarios` (service role) para crear/eliminar/cambiar contraseña; valida
rol admin. Usuarios iniciales:
- admin — juan.etayo@cacsantabarbara.co / admin123* — Juan Carlos Etayo
- orientador — orientador@cacsantabarbara.co / orientador123* — Orientador 1
- coordinador — martha.arevalo@cacsantabarbara.co / coor123* — Martha Arevalo
