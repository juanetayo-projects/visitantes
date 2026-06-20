# Especificación funcional — Control de Visitantes

Clínica de Alta Complejidad Santa Bárbara · Colombia (GMT-5)

## 1. Propósito
Sistema para el control del ingreso de visitantes a la clínica. Permite a la portería
registrar quién entra, a qué paciente acompaña (o a qué proveedor/colaborador atiende),
asignar y liberar tarjetas de acceso, y consultar el flujo histórico con estadísticas.

## 2. Roles (usuarios del sistema)
| Rol | Permisos |
|-----|----------|
| **Administrador** | Todo + catálogos (CRUD de todas las tablas) + gestión de usuarios |
| **Orientador** | Registra visitas, consulta mapa y visitas, registra salidas |
| **Coordinador** | Solo consulta: mapa, visitas y estadísticas |

## 3. Tipos de visitante
- **Familiar** — acompaña a un paciente. Se selecciona la habitación en el mapa; se
  define el tipo de acompañante (**Permanente** 24h o **Visita** por franja).
- **Proveedor** — debe ser acompañado por un **responsable** autorizado (colaborador).
- **Colaborador** — personal interno; registra servicio/motivo.

## 4. Reglas de negocio
1. **Cupo por ubicación:** máximo configurable por ubicación (default **2** en
   hospitalización, **1** en UCI/Urgencias). Al intentar superar el cupo, se muestra un
   modal con los visitantes ya presentes y se bloquea el registro.
2. **Habitación sin paciente:** si se selecciona una ubicación sin paciente, se muestra
   un modal informativo y no se permite registrar (familiar).
3. **Snapshot del paciente:** los datos del paciente (nombre, # ingreso, ubicación) se
   copian en la visita al momento del registro, porque las habitaciones se reasignan.
4. **Tarjeta de acceso:** se asigna al ingreso (queda *en uso*) y se libera al registrar
   la salida (vuelve a *disponible*), liberando el cupo.
5. **Ingresos/salidas múltiples:** una visita puede tener varios eventos de entrada/salida.
6. **Visitante existente:** si la cédula ya existe, se traen sus datos y pueden actualizarse.
7. **Aislamiento:** proviene de CENSO; se muestra de forma destacada (banner/ícono rojo).
8. **Calendario Colombia:** domingos y festivos (Ley Emiliani) se consideran en gráficas
   y estadísticas. Zona horaria fija GMT-5.

## 5. Módulos
- **Inicio / Dashboard:** métricas operativas (dentro, ingresos hoy, con acompañante,
  aislamiento, por tipo, tarjetas).
- **Registrar visita:** flujo por tipo con mapa de habitaciones, validaciones y tarjeta.
- **Mapa de habitaciones:** vista global de ocupación por piso, con colores por estado
  y tooltips estilo Odoo (paciente destacado + visitantes diferenciados).
- **Visitas:** listado con filtros (estado, tipo, sede, piso, ubicación, fechas, texto),
  registro de salida y exportación Excel/PDF.
- **Estadísticas:** mapa de calor día×hora con filtros completos; clic en celda abre el
  detalle de las personas contabilizadas, exportable.
- **Administración (CRUD):** usuarios, responsables, sedes/puertas/pisos/ubicaciones,
  servicios/cargos, tarjetas, visitantes, festivos.

## 6. Integraciones externas (pendientes de scripts SQL)
- **GoMedisys** (Azure SQL): ubicación de pacientes → tabla espejo `pacientes_ubicacion`.
- **CENSO**: aislamientos → tabla espejo `aislamientos`.
- Ambas se alimentan por un sync horario (ver `05_DESPLIEGUE.md`).
