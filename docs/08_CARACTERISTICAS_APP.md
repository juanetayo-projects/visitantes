# Control de Visitantes — Características de la aplicación

**Clínica de Alta Complejidad Santa Bárbara** · Documento de presentación (noviembre 2026)

> Este documento resume qué hace la aplicación, para quién y cómo funciona. Está
> pensado para servir de insumo a la creación de piezas de comunicación (flyer,
> presentación, video corto). Al final hay un *prompt* sugerido para generar el flyer.

---

## 1. En una frase

**Una sola aplicación para saber, en tiempo real, quién está visitando a cada paciente, dónde y en qué condiciones — conectada al censo hospitalario.**

## 2. El problema que resuelve

- En recepción no siempre se sabe en qué cama está un paciente ni cuántos acompañantes tiene dentro.
- Los cupos de visita, los horarios y los aislamientos se controlaban de memoria o en papel.
- Las tarjetas de acceso se perdían o no se sabía quién las tenía.
- No había un histórico confiable: la cama de hoy la ocupa mañana otro paciente.

## 3. Para quién es

| Rol | Qué hace en la app |
|---|---|
| **Orientador** (recepción) | Registra ingresos y salidas de visitantes, entrega y recibe tarjetas, consulta el mapa y los pacientes sin ubicación. Elige su sede de trabajo al iniciar sesión. |
| **Coordinador** | Supervisa: tablero de Inicio, mapa de calor, histórico, notas administrativas, inconsistencias del censo. |
| **Administrador** | Todo lo anterior + usuarios, sedes y ubicaciones, horarios de visita, tarjetas, festivos, homologación y sincronización del censo. |
| **Cirugía / Hemodinamia / Otro** | Atienden las solicitudes de información que llegan desde recepción para su área y las comentan. |

## 4. Cómo funciona (flujo del orientador)

1. **Elige el tipo de visitante:** familiar, proveedor o colaborador (en Urgencias también "sin tarjeta").
2. **Ubica al paciente:**
   - en el **mapa de habitaciones** del piso (cada cama, camilla, sillón, cubículo o habitación con su ícono y color de estado), o
   - **buscándolo por identificación**, o
   - en **Pacientes sin ubicación** (sala de espera, recuperación, observación…) con un botón directo a "Registrar visita".
3. **La app verifica en vivo con el censo** que el paciente siga en esa ubicación ("✓ Ubicación confirmada").
4. **Valida las reglas:** horario de visita del servicio, cupo simultáneo, máximo de visitas por día, aislamiento, y si el paciente es mayor de 65 o menor de 18 sugiere acompañante permanente. Si algo no cumple, pide **autorización** y la deja registrada.
5. **Registra al visitante** (cédula, nombre, celular), el tipo de acompañamiento y **asigna una tarjeta de acceso**.
6. **A la salida**, con un clic en la tarjeta en uso se registra la salida y se libera la tarjeta y el cupo.

## 5. Módulos

**Operación**
- **Inicio:** saludo, indicadores del día sobre la foto de la clínica (visitantes dentro, ingresos y salidas de hoy, tarjetas libres), accesos rápidos, tendencia de ingresos con comparación frente al periodo anterior, pacientes con acompañante, en aislamiento y sin cama (cada uno abre la lista de pacientes), visitantes por piso y estado de tarjetas.
- **Registrar visita:** flujo guiado con mapa, búsqueda y validaciones.
- **Pacientes sin ubicación:** pacientes del censo que no aparecen en el mapa, con motivo, acompañantes dentro y acceso directo a registrar la visita.
- **Mapa de habitaciones:** ocupación en tiempo real por sede, piso y área; colores por estado (acompañante permanente, visita en curso, paciente solo, libre), alerta de aislamiento, íconos por tipo de ubicación y ficha emergente con paciente y visitantes. Permite registrar notas administrativas.
- **Tarjetas de acceso:** inventario (disponibles, en uso, inactivas), quién tiene cada tarjeta y registro de salida.

**Consulta**
- **Visitas:** quién está dentro y quién salió, con salida en un clic.
- **Histórico:** todas las visitas con los datos del paciente y la ubicación **congelados al momento del registro** (no cambian aunque la cama la ocupe otro paciente); búsqueda en todo el historial.
- **Ingresos sin tarjeta** (Urgencias) y **Notas administrativas** (novedades por paciente o habitación, agrupadas por usuario).
- **Inconsistencias del censo:** qué pacientes no se pudieron ubicar en la última sincronización y por qué.
- **Mapa de calor:** afluencia de visitantes por día y hora (zona horaria Colombia, festivos y domingos), con detalle al hacer clic.

**Solicitudes de información**
- **Cirugía, Hemodinamia y Otro:** recepción registra lo que piden pacientes y familiares; el área responde, cambia el estado (recibido, atendido, revisado, pendiente) y deja comentarios.

**Administración**
- Usuarios y roles, sedes, pisos y ubicaciones, servicios y cargos, horarios de visita, catálogo de tarjetas, visitantes, festivos (incluye la Ley 2578 de 2026), homologación y sincronización del censo.

Todas las tablas exportan a **Excel y PDF** con los filtros aplicados.

## 6. Conexión con el censo hospitalario (GoMedisys)

- **Sincronización automática cada 15 minutos** (más un respaldo programado) y botón "Sincronizar ahora" para el administrador, con una vista de ejecución paso a paso.
- **Homologación inteligente:** cada cama del censo se relaciona con la ubicación real de la app por el identificador de la unidad, el área y la cama; los cambios de nombre de una unidad no rompen nada.
- **Verificación en vivo** del paciente al momento de registrar la visita.
- **Inconsistencias visibles:** camas sin homologar, unidades sin piso, pacientes sin cama, ubicaciones inactivas.

## 7. Seguridad y cumplimiento

- Acceso solo con usuario y contraseña institucional; recuperación de contraseña por correo.
- Permisos por rol y **seguridad a nivel de fila** en la base de datos (Supabase/PostgreSQL).
- Datos de pacientes tratados bajo la **Ley 1581 de 2012 (habeas data)**: nada de información personal en el código ni en repositorios.
- Trazabilidad: quién registró cada visita, cada autorización y cada nota.

## 8. Experiencia de uso

- Diseño institucional en **azul Santa Bárbara** (`#0D2D6B`, `#16468E`) con fondo gris azulado suave y tarjetas blancas en relieve (estilo neumórfico).
- Fotografías reales de la sede (fachada y Torre de Salud).
- Encabezados y filtros siempre visibles al desplazarse; barra lateral con indicadores que también filtran.
- Indicadores que cambian de color al pasar el mouse y abren el detalle con un clic.
- Funciona en computador y se adapta a pantallas más pequeñas.

## 9. Mensajes clave (para el flyer)

- **"Cada visita, en su lugar."**
- Ubicación del paciente **en tiempo real**, conectada al censo.
- **Mapa de habitaciones** con un vistazo: quién está acompañado, quién está solo, quién está en aislamiento.
- **Reglas de visita automáticas:** horarios, cupos y autorizaciones.
- **Tarjetas de acceso bajo control.**
- **Histórico confiable** aunque cambien los pacientes de cama.
- **Datos protegidos** (Ley 1581).

## 10. Cifras de referencia (noviembre 2026)

- 2 sedes (Torre de Salud y Urgencias), cerca de **380 ubicaciones**: 125 habitaciones, 111 sillones, 101 camillas, 40 cubículos y 2 camas.
- Alrededor de **300 pacientes** en el censo en un día típico.
- 6 roles de usuario y más de 15 módulos.

---

## Prompt sugerido para ChatGPT

> Diseña un flyer vertical (formato A4) para presentar internamente la aplicación
> **"Control de Visitantes"** de la **Clínica de Alta Complejidad Santa Bárbara**.
> Usa la paleta institucional azul oscuro `#0D2D6B` y azul `#16468E`, con acentos
> verde azulado para lo positivo y rojo suave para alertas, fondo claro gris azulado
> y tarjetas blancas con sombra suave. Estructura: (1) título con el lema
> "Cada visita, en su lugar"; (2) una franja con los 6 pasos del flujo del orientador
> (tipo de visitante → ubicar paciente → verificación con el censo → reglas de visita →
> registro y tarjeta → salida); (3) cuatro bloques con íconos: Mapa de habitaciones en
> tiempo real, Pacientes sin ubicación, Tarjetas de acceso, Histórico y mapa de calor;
> (4) una franja "Conectada al censo GoMedisys · sincroniza cada 15 minutos";
> (5) pie con "Datos protegidos · Ley 1581" y los roles (Orientador, Coordinador,
> Administrador, Cirugía, Hemodinamia). Estilo limpio, institucional y moderno, con
> íconos de línea; sin fotos de pacientes.
