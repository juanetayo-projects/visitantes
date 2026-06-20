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

## Registrar salida y devolver tarjeta
Dos caminos:
- **Tarjetas de acceso:** busca la tarjeta por su código (o por titular/paciente), pulsa
  **Registrar salida** y confirma. La tarjeta vuelve a *disponible* y se libera el cupo.
- **Visitas:** filtra por *Activas* y usa **Registrar salida** en la fila correspondiente.

## Tarjetas de acceso
- **Inventario:** total, disponibles, en uso e inactivas, con desglose por sede.
- **¿Quién tiene cada tarjeta?:** lista de tarjetas en uso con el titular, el paciente/ubicación
  y la hora de ingreso. Útil para saber en poder de quién está una tarjeta. Exportable.

## Histórico
Consulta todas las visitas (activas y finalizadas) filtrando por **habitación/ubicación**
(sede → piso → ubicación) y/o por **paciente** (nombre, # de ingreso o cédula). Muestra la
**fecha/hora de ingreso y de salida** (devolución de la tarjeta). Exportable a Excel/PDF.
Como el dato del paciente queda congelado en cada visita, el histórico se mantiene aunque la
habitación se reasigne a otro paciente.

## Consultas y reportes
- **Visitas:** filtra por estado, tipo, sede, piso, ubicación, fechas y texto.
  Exporta a **Excel** o **PDF**.
- **Mapa de calor:** visitas por día y hora (con festivos/domingos). Aplica filtros (tipo,
  estado, sede, piso, fechas) y haz **clic en una celda** para ver el detalle de las personas
  de ese día/horario (exportable).

## Administración (solo Administrador)
CRUD completo de: Usuarios, Responsables, Sedes y ubicaciones, Servicios y cargos,
Tarjetas de acceso, Visitantes y Festivos (con generación automática por año).
