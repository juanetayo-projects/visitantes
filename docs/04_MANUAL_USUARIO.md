# Manual de usuario — Control de Visitantes

App: https://juanetayo-projects.github.io/visitantes/

## Acceso
Ingresa con tu correo institucional y contraseña. Si la olvidaste, usa
**¿Olvidaste tu contraseña?** (te llega un enlace por correo).

### Usuarios iniciales
| Rol | Usuario | Contraseña |
|-----|---------|------------|
| Administrador | juan.etayo@cacsantabarbara.co | admin123* |
| Orientador | orientador@cacsantabarbara.co | orientador123* |
| Coordinador | martha.arevalo@cacsantabarbara.co | coor123* |

> Se recomienda cambiar las contraseñas en el primer ingreso.

## Registrar una visita
1. **Registrar visita** → elige el **tipo** (Familiar / Proveedor / Colaborador).
2. **Familiar:**
   - Elige sede y piso; en el **mapa** haz clic en la habitación del paciente.
   - Si la habitación no tiene paciente, aparece un aviso.
   - Si ya tiene el máximo de visitantes, aparece un aviso con quiénes están adentro.
   - Escribe la **cédula** (si ya existe, se cargan sus datos y puedes actualizarlos),
     define **Permanente** o **Visita**, permisos (alimentos/otros), puerta y **tarjeta**.
3. **Proveedor:** datos del visitante + **responsable** que lo acompaña + tarjeta.
4. **Colaborador:** datos + servicio/motivo + tarjeta.
5. **Registrar ingreso**.

## Mapa de habitaciones
Vista global por piso. Colores: 🟢 acompañante permanente · 🟡 visita en curso ·
🔵 paciente solo (cupo libre) · ⚪ libre · borde rojo = aislamiento. Pasa el mouse por una
habitación para ver el **tooltip**: paciente destacado y la lista de visitantes con su
tipo, hora y tarjeta.

## Registrar salida
En **Visitas**, filtra por *Activas* y usa **Registrar salida**: cierra la visita y libera
la tarjeta (queda disponible y se libera el cupo).

## Consultas y reportes
- **Visitas:** filtra por estado, tipo, sede, piso, ubicación, fechas y texto.
  Exporta a **Excel** o **PDF**.
- **Estadísticas:** mapa de calor de visitas por día y hora (con festivos/domingos).
  Aplica filtros (tipo, estado, sede, piso, fechas) y haz **clic en una celda** para ver
  el detalle de las personas de ese día/horario (exportable).

## Administración (solo Administrador)
CRUD completo de: Usuarios, Responsables, Sedes y ubicaciones, Servicios y cargos,
Tarjetas de acceso, Visitantes y Festivos (con generación automática por año).
