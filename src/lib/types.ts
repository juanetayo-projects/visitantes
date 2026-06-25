// ─── Usuarios / roles ───────────────────────────────────────────────
export type Rol = 'admin' | 'orientador' | 'coordinador'

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
}

// ─── Catálogos institucionales ──────────────────────────────────────
export interface Servicio { id: string; nombre: string; activo: boolean }
export interface Cargo { id: string; nombre: string; activo: boolean }

export interface Sede { id: string; nombre: string; orden: number; activo: boolean }

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

export type TipoAislamiento = 'contacto' | 'gotas' | 'aereo' | 'protector' | 'estricto'

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
export type TipoVisitante = 'familiar' | 'proveedor' | 'colaborador'
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
  // datos del paciente (espejo)
  num_ingreso: string | null
  paciente_nombre: string | null
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
