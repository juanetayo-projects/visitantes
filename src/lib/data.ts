import { supabase } from './supabase'
import type {
  Sede, Piso, Ubicacion, Servicio, Cargo, Puerta, Tarjeta, Responsable,
  OcupacionUbicacion, VisitaResumen, TipoAislamiento, TipoUbicacion, TipoAcompanante,
} from './types'

export async function listSedes(): Promise<Sede[]> {
  const { data } = await supabase.from('sedes').select('*').eq('activo', true).order('orden')
  return data ?? []
}
export async function listPisos(sedeId?: string): Promise<Piso[]> {
  let q = supabase.from('pisos').select('*').eq('activo', true).order('orden')
  if (sedeId) q = q.eq('sede_id', sedeId)
  return (await q).data ?? []
}
export async function listPuertas(sedeId?: string): Promise<Puerta[]> {
  let q = supabase.from('puertas').select('*').eq('activo', true).order('nombre')
  if (sedeId) q = q.eq('sede_id', sedeId)
  return (await q).data ?? []
}
export async function listUbicaciones(pisoId: string): Promise<Ubicacion[]> {
  const { data } = await supabase.from('ubicaciones').select('*').eq('piso_id', pisoId).eq('activo', true).order('orden')
  return data ?? []
}
export async function listServicios(): Promise<Servicio[]> {
  const { data } = await supabase.from('servicios').select('*').eq('activo', true).order('nombre')
  return data ?? []
}
export async function listCargos(): Promise<Cargo[]> {
  const { data } = await supabase.from('cargos').select('*').eq('activo', true).order('nombre')
  return data ?? []
}
export async function listResponsables(): Promise<Responsable[]> {
  const { data } = await supabase.from('responsables').select('*').eq('activo', true).order('nombre_completo')
  return data ?? []
}
export async function tarjetasDisponibles(sedeId?: string): Promise<Tarjeta[]> {
  let q = supabase.from('tarjetas').select('*').eq('estado', 'disponible').order('codigo')
  if (sedeId) q = q.eq('sede_id', sedeId)
  return (await q).data ?? []
}

// ─── Inventario y tenencia de tarjetas ──────────────────────
export interface InventarioTarjetas {
  total: number; disponible: number; en_uso: number; inactiva: number
  porSede: { sede: string; total: number; disponible: number; en_uso: number; inactiva: number }[]
}
export async function inventarioTarjetas(): Promise<InventarioTarjetas> {
  const { data } = await supabase.from('tarjetas').select('estado, sede:sedes(nombre)')
  const rows = (data ?? []) as any[]
  const inv: InventarioTarjetas = { total: rows.length, disponible: 0, en_uso: 0, inactiva: 0, porSede: [] }
  const mapa = new Map<string, any>()
  rows.forEach((r) => {
    inv[r.estado as 'disponible' | 'en_uso' | 'inactiva']++
    const s = r.sede?.nombre ?? 'Sin sede'
    const m = mapa.get(s) ?? { sede: s, total: 0, disponible: 0, en_uso: 0, inactiva: 0 }
    m.total++; m[r.estado]++; mapa.set(s, m)
  })
  inv.porSede = Array.from(mapa.values()).sort((a, b) => a.sede.localeCompare(b.sede))
  return inv
}

export interface TarjetaEnUso {
  id: string
  codigo: string
  sede: string | null
  sede_id: string | null
  piso_id: string | null
  ubicacion_id: string | null
  visita_id: string | null
  visitante_nombre: string | null
  cedula: string | null
  celular: string | null
  tipo_visitante: string | null
  paciente_nombre: string | null
  ubicacion_etiqueta: string | null
  hora_ingreso: string | null
}

export interface FiltrosTarjeta {
  sedeId?: string
  pisoId?: string
  ubicacionId?: string
  tipo?: string
  desde?: string
  hasta?: string
  texto?: string
}

// ¿Quién tiene cada tarjeta en su poder? (tarjetas en uso + titular)
export async function tarjetasEnUso(f: FiltrosTarjeta = {}): Promise<TarjetaEnUso[]> {
  const { data } = await supabase.from('tarjetas')
    .select('id, codigo, sede_id, sede:sedes(nombre), visita:visitas!tarjetas_visita_fk(id, paciente_nombre, ubicacion_etiqueta, ubicacion_id, piso_id, created_at, tipo_visitante, visitante:visitantes(nombres_completos, cedula, celular))')
    .eq('estado', 'en_uso').order('codigo')
  let rows = (data ?? []).map((t: any) => ({
    id: t.id,
    codigo: t.codigo,
    sede: t.sede?.nombre ?? null,
    sede_id: t.sede_id ?? null,
    piso_id: t.visita?.piso_id ?? null,
    ubicacion_id: t.visita?.ubicacion_id ?? null,
    visita_id: t.visita?.id ?? null,
    visitante_nombre: t.visita?.visitante?.nombres_completos ?? null,
    cedula: t.visita?.visitante?.cedula ?? null,
    celular: t.visita?.visitante?.celular ?? null,
    tipo_visitante: t.visita?.tipo_visitante ?? null,
    paciente_nombre: t.visita?.paciente_nombre ?? null,
    ubicacion_etiqueta: t.visita?.ubicacion_etiqueta ?? null,
    hora_ingreso: t.visita?.created_at ?? null,
  })) as TarjetaEnUso[]

  if (f.sedeId) rows = rows.filter((r) => r.sede_id === f.sedeId)
  if (f.pisoId) rows = rows.filter((r) => r.piso_id === f.pisoId)
  if (f.ubicacionId) rows = rows.filter((r) => r.ubicacion_id === f.ubicacionId)
  if (f.tipo) rows = rows.filter((r) => r.tipo_visitante === f.tipo)
  if (f.desde) rows = rows.filter((r) => (r.hora_ingreso ?? '') >= f.desde + 'T00:00:00-05:00')
  if (f.hasta) rows = rows.filter((r) => (r.hora_ingreso ?? '') <= f.hasta + 'T23:59:59-05:00')
  if (f.texto) {
    const b = f.texto.toLowerCase()
    rows = rows.filter((r) =>
      r.codigo.toLowerCase().includes(b) ||
      r.visitante_nombre?.toLowerCase().includes(b) ||
      r.cedula?.includes(b) ||
      r.celular?.includes(b) ||
      r.paciente_nombre?.toLowerCase().includes(b) ||
      r.ubicacion_etiqueta?.toLowerCase().includes(b))
  }
  return rows
}

interface VisitaRow {
  id: string
  ubicacion_id: string | null
  tipo_acompanante: TipoAcompanante | null
  tipo_visitante: 'familiar' | 'proveedor' | 'colaborador'
  created_at: string
  visitante: { nombres_completos: string; celular: string | null } | null
  tarjeta: { codigo: string } | null
}

// Compone la ocupación de un piso: ubicaciones + paciente (espejo) + visitas activas.
export async function getOcupacionPiso(pisoId: string): Promise<OcupacionUbicacion[]> {
  const [ubicRes, pacRes, visRes] = await Promise.all([
    supabase.from('ubicaciones').select('*').eq('piso_id', pisoId).eq('activo', true).order('orden'),
    supabase.from('pacientes_ubicacion').select('*').eq('piso_id', pisoId),
    supabase.from('visitas')
      .select('id, ubicacion_id, tipo_acompanante, tipo_visitante, created_at, visitante:visitantes(nombres_completos, celular), tarjeta:tarjetas!visitas_tarjeta_id_fkey(codigo)')
      .eq('piso_id', pisoId).eq('estado', 'activa'),
  ])

  const ubicaciones = (ubicRes.data ?? []) as Ubicacion[]
  const pacientes = pacRes.data ?? []

  // Aislamientos de los ingresos presentes en este piso
  const ingresos = pacientes.map((p: any) => p.num_ingreso).filter(Boolean)
  let aislMap = new Map<string, TipoAislamiento>()
  if (ingresos.length) {
    const { data: ais } = await supabase.from('aislamientos').select('num_ingreso, tipo').in('num_ingreso', ingresos).eq('vigente', true)
    ais?.forEach((a: any) => aislMap.set(a.num_ingreso, a.tipo))
  }

  const pacByUbic = new Map<string, any>()
  pacientes.forEach((p: any) => { if (p.ubicacion_id) pacByUbic.set(p.ubicacion_id, p) })

  const visByUbic = new Map<string, VisitaResumen[]>()
  ;(visRes.data as unknown as VisitaRow[] | null)?.forEach((v) => {
    if (!v.ubicacion_id) return
    const arr = visByUbic.get(v.ubicacion_id) ?? []
    arr.push({
      visita_id: v.id,
      visitante_nombre: v.visitante?.nombres_completos ?? '—',
      celular: v.visitante?.celular ?? null,
      tipo_acompanante: v.tipo_acompanante,
      tipo_visitante: v.tipo_visitante,
      tarjeta_codigo: v.tarjeta?.codigo ?? null,
      hora_ingreso: v.created_at,
    })
    visByUbic.set(v.ubicacion_id, arr)
  })

  return ubicaciones.map((u) => {
    const pac = pacByUbic.get(u.id)
    return {
      ubicacion_id: u.id,
      etiqueta: u.etiqueta,
      tipo: u.tipo as TipoUbicacion,
      area: u.area,
      cupo: u.cupo_default,
      num_ingreso: pac?.num_ingreso ?? null,
      paciente_nombre: pac?.nombre ?? null,
      edad: pac?.edad ?? null,
      aislamiento: pac ? aislMap.get(pac.num_ingreso) ?? null : null,
      visitas: visByUbic.get(u.id) ?? [],
    }
  })
}

// ─── Listado de visitas (con filtros) ───────────────────────
export interface VisitaListado {
  id: string
  tipo_visitante: string
  tipo_acompanante: string | null
  paciente_nombre: string | null
  num_ingreso: string | null
  ubicacion_etiqueta: string | null
  aislamiento: string | null
  permiso_alimentos: boolean
  estado: string
  created_at: string
  salida_at: string | null
  visitante: { nombres_completos: string; cedula: string; celular: string | null } | null
  tarjeta: { codigo: string } | null
  responsable: { nombre_completo: string } | null
  sede: { nombre: string } | null
}

export interface FiltrosVisita {
  estado?: 'activa' | 'finalizada' | ''
  tipo?: string
  sedeId?: string
  pisoId?: string
  ubicacionId?: string
  numIngreso?: string
  desde?: string
  hasta?: string
  texto?: string
}

export async function listVisitas(f: FiltrosVisita = {}): Promise<VisitaListado[]> {
  let q = supabase.from('visitas')
    .select('id, tipo_visitante, tipo_acompanante, paciente_nombre, num_ingreso, ubicacion_etiqueta, aislamiento, permiso_alimentos, estado, created_at, sede_id, visitante:visitantes(nombres_completos, cedula, celular), tarjeta:tarjetas!visitas_tarjeta_id_fkey(codigo), responsable:responsables(nombre_completo), sede:sedes(nombre), eventos:visita_eventos(tipo, hora)')
    .order('created_at', { ascending: false }).limit(500)
  if (f.estado) q = q.eq('estado', f.estado)
  if (f.tipo) q = q.eq('tipo_visitante', f.tipo)
  if (f.sedeId) q = q.eq('sede_id', f.sedeId)
  if (f.pisoId) q = q.eq('piso_id', f.pisoId)
  if (f.ubicacionId) q = q.eq('ubicacion_id', f.ubicacionId)
  if (f.numIngreso) q = q.eq('num_ingreso', f.numIngreso)
  if (f.desde) q = q.gte('created_at', f.desde + 'T00:00:00-05:00')
  if (f.hasta) q = q.lte('created_at', f.hasta + 'T23:59:59-05:00')
  const { data } = await q
  let rows = (data ?? []).map((r: any) => ({
    ...r,
    salida_at: (r.eventos ?? []).filter((e: any) => e.tipo === 'salida').map((e: any) => e.hora).sort().pop() ?? null,
  })) as unknown as VisitaListado[]
  if (f.texto) {
    const t = f.texto.toLowerCase()
    rows = rows.filter((r) =>
      r.visitante?.nombres_completos?.toLowerCase().includes(t) ||
      r.visitante?.cedula?.includes(t) ||
      r.paciente_nombre?.toLowerCase().includes(t) ||
      r.ubicacion_etiqueta?.toLowerCase().includes(t))
  }
  return rows
}

// Datos crudos para estadísticas (fecha/hora de ingreso de eventos).
export async function eventosIngreso(desde?: string, hasta?: string) {
  let q = supabase.from('visita_eventos').select('hora, tipo').eq('tipo', 'ingreso').limit(5000)
  if (desde) q = q.gte('hora', desde + 'T00:00:00-05:00')
  if (hasta) q = q.lte('hora', hasta + 'T23:59:59-05:00')
  const { data } = await q
  return (data ?? []) as { hora: string; tipo: string }[]
}

// ─── Métricas del dashboard ─────────────────────────────────
export interface Metricas {
  activas: number
  ingresosHoy: number
  familiar: number
  proveedor: number
  colaborador: number
  tarjetasEnUso: number
  tarjetasDisp: number
  pacientes: number
  pacientesConAcomp: number
  enAislamiento: number
}

export async function metricasDashboard(hoy: string): Promise<Metricas> {
  const [act, tEnUso, tDisp, pac, ingHoy] = await Promise.all([
    supabase.from('visitas').select('tipo_visitante, ubicacion_id', { count: 'exact' }).eq('estado', 'activa'),
    supabase.from('tarjetas').select('id', { count: 'exact', head: true }).eq('estado', 'en_uso'),
    supabase.from('tarjetas').select('id', { count: 'exact', head: true }).eq('estado', 'disponible'),
    supabase.from('pacientes_ubicacion').select('id', { count: 'exact', head: true }),
    supabase.from('visita_eventos').select('id', { count: 'exact', head: true }).eq('tipo', 'ingreso').gte('hora', hoy + 'T00:00:00-05:00'),
  ])
  const rows = (act.data ?? []) as { tipo_visitante: string; ubicacion_id: string | null }[]
  const ubicConAcomp = new Set(rows.map((r) => r.ubicacion_id).filter(Boolean))
  const ais = await supabase.from('aislamientos').select('id', { count: 'exact', head: true }).eq('vigente', true)
  return {
    activas: act.count ?? rows.length,
    ingresosHoy: ingHoy.count ?? 0,
    familiar: rows.filter((r) => r.tipo_visitante === 'familiar').length,
    proveedor: rows.filter((r) => r.tipo_visitante === 'proveedor').length,
    colaborador: rows.filter((r) => r.tipo_visitante === 'colaborador').length,
    tarjetasEnUso: tEnUso.count ?? 0,
    tarjetasDisp: tDisp.count ?? 0,
    pacientes: pac.count ?? 0,
    pacientesConAcomp: ubicConAcomp.size,
    enAislamiento: ais.count ?? 0,
  }
}

// ─── Visitantes ─────────────────────────────────────────────
export async function buscarVisitante(cedula: string) {
  const { data } = await supabase.from('visitantes').select('*').eq('cedula', cedula.trim()).maybeSingle()
  return data
}
export async function upsertVisitante(v: { cedula: string; nombres_completos: string; celular?: string | null; email?: string | null }) {
  const { data, error } = await supabase.from('visitantes')
    .upsert({ ...v, cedula: v.cedula.trim() }, { onConflict: 'cedula' })
    .select('id').single()
  if (error) throw error
  return data.id as string
}

// ─── Registro de visita ─────────────────────────────────────
export interface NuevaVisita {
  tipo_visitante: 'familiar' | 'proveedor' | 'colaborador'
  visitante_id: string
  tipo_acompanante?: TipoAcompanante | null
  paciente_documento?: string | null
  paciente_nombre?: string | null
  num_ingreso?: string | null
  ubicacion_id?: string | null
  ubicacion_etiqueta?: string | null
  piso_id?: string | null
  servicio_paciente?: string | null
  aislamiento?: TipoAislamiento | null
  responsable_id?: string | null
  permiso_alimentos?: boolean
  permiso_otros?: string | null
  sede_id?: string | null
  puerta_id?: string | null
  tarjeta_id?: string | null
  registrado_por?: string | null
}

export async function registrarVisita(v: NuevaVisita): Promise<string> {
  const { data, error } = await supabase.from('visitas').insert({ ...v, estado: 'activa' }).select('id').single()
  if (error) throw error
  const visitaId = data.id as string
  await supabase.from('visita_eventos').insert({ visita_id: visitaId, tipo: 'ingreso', registrado_por: v.registrado_por ?? null })
  if (v.tarjeta_id) {
    await supabase.from('tarjetas').update({ estado: 'en_uso', visita_id: visitaId }).eq('id', v.tarjeta_id)
  }
  return visitaId
}

// Registra un movimiento (re-ingreso o salida intermedia) sin cerrar la visita.
export async function registrarEvento(visitaId: string, tipo: 'ingreso' | 'salida', registradoPor?: string | null) {
  await supabase.from('visita_eventos').insert({ visita_id: visitaId, tipo, registrado_por: registradoPor ?? null })
}

// Cierra la visita y libera la tarjeta (entrega de la tarjeta de acceso).
export async function finalizarVisita(visitaId: string, registradoPor?: string | null) {
  await supabase.from('visita_eventos').insert({ visita_id: visitaId, tipo: 'salida', registrado_por: registradoPor ?? null })
  await supabase.from('visitas').update({ estado: 'finalizada' }).eq('id', visitaId)
  await supabase.from('tarjetas').update({ estado: 'disponible', visita_id: null }).eq('visita_id', visitaId)
}

export type EstadoCelda = 'permanente' | 'visita' | 'solo' | 'libre'

export function estadoCelda(o: OcupacionUbicacion): EstadoCelda {
  if (!o.num_ingreso) return 'libre'
  if (o.visitas.some((v) => v.tipo_acompanante === 'permanente')) return 'permanente'
  if (o.visitas.length > 0) return 'visita'
  return 'solo'
}
