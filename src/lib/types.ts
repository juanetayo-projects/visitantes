// ─── Usuarios / roles ───────────────────────────────────────────────
export type Rol = 'admin' | 'orientador' | 'coordinador' | 'cirugia' | 'hemodinamia'

export interface Perfil {
  id: string
  nombre: string
  email: string
  rol: Rol
  activo: boolean
}

export const ROL_LABEL: Record<Rol, string> = {
  admin: 'Administrador',
  orientador: 'Orientador',
  coordinador: 'Coordinador',
  cirugia: 'Cirugía',
  hemodinamia: 'Hemodinamia',
}

// ─── Catálogos institucionales ──────────────────────────────────────
export interface Servicio { id: string; nombre: string; activo: boolean }
export interface Cargo { id: string; nombre: string; activo: boolean }

export interface Sede { id: string; nombre: string; orden: number; activo: boolean; prefijo_tarjeta: string | null }

export interface Puerta {
  id: string
  sede_id: string
  nombre: string
  activo: boolean
}

export interface Piso {
  id: string
  sede_id: string
  numero: number
  nombre: string
  orden: number
  activo: boolean
}

export type TipoUbicacion =
  | 'habitacion' | 'cubiculo' | 'sillon' | 'cama' | 'camilla' | 'area'

export interface Ubicacion {
  id: string
  piso_id: string
  area: string | null          // p.ej. "Zona A", "Pediatria" (Urgencias / agrupador)
  servicio: string | null      // descripción/servicio (p.ej. "HOSPITALIZACION 7 PISO")
  tipo: TipoUbicacion
  etiqueta: string             // "701A", "Cubículo 12", "Cama 3", "Tomografía"
  cupo_default: number
  orden: number
  activo: boolean
}

// ─── Horarios de visita por servicio (política 6.1) ─────────────────
export interface HorarioVisita {
  id: string
  servicio: string
  match_censo: string | null
  aplica_aislamiento: boolean
  ventana1_inicio: string          // "HH:MM" / "HH:MM:SS"
  ventana1_fin: string
  ventana2_inicio: string | null
  ventana2_fin: string | null
  duracion_horas: number | null
  max_por_dia: number
  max_simultaneo: number | null    // null ⇒ usa el cupo de la ubicación
  prioridad: number
  notas: string | null
  activo: boolean
}

// ─── Personas ───────────────────────────────────────────────────────
export interface Responsable {
  id: string
  nombre_completo: string
  numero_documento: string
  servicio_id: string | null
  cargo_id: string | null
  telefono: string | null
  email: string | null
  activo: boolean
}

export interface Visitante {
  id: string
  cedula: string
  nombres_completos: string
  celular: string | null
  email: string | null
  created_at?: string
}

// ─── Espejos de sistemas externos (GoMedisys / CENSO) ───────────────
export interface PacienteUbicacion {
  id: string
  num_ingreso: string
  documento: string | null
  nombre: string | null
  edad: number | null
  ubicacion_id: string | null
  piso_id: string | null
  ubicacion_etiqueta: string | null
  servicio: string | null
  fecha_ingreso: string | null
  sync_at: string | null
}

export type TipoAislamiento =
  | 'contacto' | 'gotas' | 'aereo' | 'protector' | 'estricto'
  | 'respiratorio' | 'cohortizacion' | 'respiratorio_contacto'

// Etiquetas legibles de cada tipo de aislamiento (incluye las categorías del CENSO).
export const AISLAMIENTO_LABEL: Record<TipoAislamiento, string> = {
  contacto: 'Contacto', gotas: 'Gotas', aereo: 'Aéreo', protector: 'Protector', estricto: 'Estricto',
  respiratorio: 'Respiratorio', cohortizacion: 'Cohortización', respiratorio_contacto: 'Respiratorio / Contacto',
}

export interface Aislamiento {
  id: string
  num_ingreso: string
  tipo: TipoAislamiento
  vigente: boolean
  sync_at: string | null
}

// ─── Tarjetas de acceso ─────────────────────────────────────────────
export type EstadoTarjeta = 'disponible' | 'en_uso' | 'inactiva'

export interface Tarjeta {
  id: string
  codigo: string
  sede_id: string | null
  estado: EstadoTarjeta
  visita_id: string | null
}

// ─── Control de ingreso (visita) ────────────────────────────────────
export type TipoVisitante = 'familiar' | 'proveedor' | 'colaborador' | 'sin_tarjeta'
export type TipoAcompanante = 'permanente' | 'visita'
export type EstadoVisita = 'activa' | 'finalizada'

export interface Visita {
  id: string
  tipo_visitante: TipoVisitante
  visitante_id: string
  // Familiar
  tipo_acompanante: TipoAcompanante | null
  // Snapshot del paciente (la habitación se reasigna con el tiempo → se congela)
  paciente_documento: string | null
  paciente_nombre: string | null
  num_ingreso: string | null
  ubicacion_id: string | null
  ubicacion_etiqueta: string | null
  piso_id: string | null
  servicio_paciente: string | null
  aislamiento: TipoAislamiento | null
  // Proveedor
  responsable_id: string | null
  // Autorización excepcional (fuera de horario / excede cupo)
  autorizado_por_id: string | null
  autorizacion_motivo: string | null
  // Permisos
  permiso_alimentos: boolean
  permiso_otros: string | null
  // Acceso
  sede_id: string | null
  puerta_id: string | null
  tarjeta_id: string | null
  estado: EstadoVisita
  registrado_por: string | null
  created_at: string
}

export interface VisitaEvento {
  id: string
  visita_id: string
  tipo: 'ingreso' | 'salida'
  hora: string            // timestamptz
  registrado_por: string | null
}

// ─── Tipos compuestos para UI ───────────────────────────────────────
export interface OcupacionUbicacion {
  ubicacion_id: string
  etiqueta: string
  tipo: TipoUbicacion
  area: string | null
  servicio: string | null
  cupo: number
  piso_id?: string | null
  // datos del paciente (espejo)
  num_ingreso: string | null
  paciente_nombre: string | null
  paciente_documento?: string | null
  edad: number | null
  aislamiento: TipoAislamiento | null
  // visitas activas
  visitas: VisitaResumen[]
}

export interface VisitaResumen {
  visita_id: string
  visitante_nombre: string
  celular: string | null
  tipo_acompanante: TipoAcompanante | null
  tipo_visitante: TipoVisitante
  tarjeta_codigo: string | null
  hora_ingreso: string | null
}

// ─── Notas administrativas ──────────────────────────────────────────
export interface NotaAdministrativa {
  id: string
  ubicacion_id: string | null
  piso_id: string | null
  num_ingreso: string | null
  paciente_documento: string | null
  paciente_nombre: string | null
  comentario: string
  registrado_por: string | null
  created_at: string
}

// ─── Estados compartidos por Cirugía y Hemodinamia (recepción → gestión) ───
export type EstadoHemodinamia = 'recibido' | 'atendido' | 'revisado' | 'pendiente'

export const ESTADO_HEMODINAMIA_LABEL: Record<EstadoHemodinamia, string> = {
  recibido: 'Recibido', atendido: 'Atendido', revisado: 'Revisado', pendiente: 'Pendiente',
}

// ─── Cirugía: solicitudes de información en recepción ───────────────
export interface SolicitudCirugia {
  id: string
  fecha: string
  nombre_paciente: string
  documento_paciente: string
  eps: string | null
  persona_solicita: string | null
  procedimiento: string | null
  celular: string | null
  observaciones: string | null
  atendido_por: string | null
  estado: EstadoHemodinamia
  registrado_por: string | null
  created_at: string
}

export interface ComentarioCirugia {
  id: string
  solicitud_id: string
  autor_id: string | null
  comentario: string
  created_at: string
}

// ─── Hemodinamia: solicitudes de información / documentos ───────────
export interface SolicitudHemodinamia {
  id: string
  fecha_hora: string
  cedula_paciente: string
  nombre_paciente: string
  procedimiento: string
  documentos: string | null
  estado: EstadoHemodinamia
  registrado_por: string | null
  created_at: string
}

export interface ComentarioHemodinamia {
  id: string
  solicitud_id: string
  autor_id: string | null
  comentario: string
  created_at: string
}
