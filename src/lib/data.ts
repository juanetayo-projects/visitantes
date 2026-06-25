import { supabase } from './supabase'
import type {
  Sede, Piso, Ubicacion, Servicio, Cargo, Puerta, Tarjeta, Responsable, HorarioVisita,
  OcupacionUbicacion, VisitaResumen, TipoAislamiento, TipoUbicacion, TipoAcompanante,
} from './types'

// Normaliza texto para comparaciones (sin acentos, mayúsculas, espacios colapsados).
const sinTildes = (s: string) => (s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().replace(/\s+/g, ' ').trim()

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

// ─── Importación de estructura (Pisos / Ubicaciones) ────────
export interface FilaPiso { sede: string; numero: number; nombre: string; orden: number; activo: boolean }
export interface FilaUbic { sede: string; piso: string; area: string | null; servicio?: string | null; tipo: string; etiqueta: string; cupo: number; orden: number; activo: boolean }
export interface ResultadoImport { pisos: number; ubicaciones: number; pisosDesactivados: number; ubicDesactivadas: number; errores: string[] }

const norm = (s: string) => (s ?? '').toString().trim().toLowerCase()

// Ordena las áreas de forma natural: "Zona A".."Zona E" primero, luego el resto (Pediatría…).
export function ordenarAreas(areas: string[]): string[] {
  const esZona = (a: string) => /^zona\b/i.test(a.trim())
  return [...areas].sort((a, b) => {
    const ra = esZona(a) ? 0 : 1, rb = esZona(b) ? 0 : 1
    if (ra !== rb) return ra - rb
    return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' })
  })
}

export async function importarEstructura(
  pisosRows: FilaPiso[], ubicRows: FilaUbic[], opts: { desactivarFaltantes?: boolean } = {},
): Promise<ResultadoImport> {
  const errores: string[] = []
  const { data: sedes } = await supabase.from('sedes').select('id, nombre')
  const sedeId = new Map((sedes ?? []).map((s: any) => [norm(s.nombre), s.id]))

  // Pisos
  const pisosPayload = pisosRows.map((r) => {
    const sid = sedeId.get(norm(r.sede))
    if (!sid) { errores.push(`Piso "${r.nombre}": sede "${r.sede}" no existe.`); return null }
    return { sede_id: sid, numero: r.numero, nombre: r.nombre, orden: r.orden, activo: r.activo }
  }).filter(Boolean) as any[]
  if (pisosPayload.length) {
    const { error } = await supabase.from('pisos').upsert(pisosPayload, { onConflict: 'sede_id,nombre' })
    if (error) errores.push('Pisos: ' + error.message)
  }

  // Mapa (sede_id|nombre) → piso_id
  const { data: pisos } = await supabase.from('pisos').select('id, sede_id, nombre')
  const pisoKey = new Map((pisos ?? []).map((p: any) => [p.sede_id + '|' + norm(p.nombre), p.id]))

  // Ubicaciones
  const ubicPayload = ubicRows.map((r) => {
    const sid = sedeId.get(norm(r.sede))
    const pid = sid ? pisoKey.get(sid + '|' + norm(r.piso)) : null
    if (!pid) { errores.push(`Ubicación "${r.etiqueta}": piso "${r.piso}" (sede "${r.sede}") no existe.`); return null }
    return { piso_id: pid, area: r.area && r.area.trim() ? r.area.trim() : null, servicio: r.servicio && r.servicio.trim() ? r.servicio.trim() : null, tipo: r.tipo, etiqueta: r.etiqueta, cupo_default: r.cupo, orden: r.orden, activo: r.activo }
  }).filter(Boolean) as any[]
  if (ubicPayload.length) {
    const { error } = await supabase.from('ubicaciones').upsert(ubicPayload, { onConflict: 'piso_id,area,etiqueta' })
    if (error) errores.push('Ubicaciones: ' + error.message)
  }

  // Desactivar lo que no vino en el archivo (opcional)
  let pisosDesactivados = 0, ubicDesactivadas = 0
  if (opts.desactivarFaltantes) {
    const keyP = new Set(pisosPayload.map((p) => p.sede_id + '|' + norm(p.nombre)))
    const faltP = (pisos ?? []).filter((p: any) => !keyP.has(p.sede_id + '|' + norm(p.nombre))).map((p: any) => p.id)
    if (faltP.length) { await supabase.from('pisos').update({ activo: false }).in('id', faltP); pisosDesactivados = faltP.length }

    const keyU = new Set(ubicPayload.map((u) => u.piso_id + '|' + norm(u.area ?? '') + '|' + norm(u.etiqueta)))
    const { data: allU } = await supabase.from('ubicaciones').select('id, piso_id, area, etiqueta')
    const faltU = (allU ?? []).filter((u: any) => !keyU.has(u.piso_id + '|' + norm(u.area ?? '') + '|' + norm(u.etiqueta))).map((u: any) => u.id)
    if (faltU.length) { await supabase.from('ubicaciones').update({ activo: false }).in('id', faltU); ubicDesactivadas = faltU.length }
  }

  return { pisos: pisosPayload.length, ubicaciones: ubicPayload.length, pisosDesactivados, ubicDesactivadas, errores }
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

export interface TarjetaDetalle {
  id: string
  codigo: string
  estado: string
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
  estado?: string
  sedeId?: string
  pisoId?: string
  ubicacionId?: string
  tipo?: string
  desde?: string
  hasta?: string
  texto?: string
}

// Listado de tarjetas con su titular (cuando están en uso). Filtrable por estado/sede/etc.
export async function listTarjetasDetalle(f: FiltrosTarjeta = {}): Promise<TarjetaDetalle[]> {
  let q = supabase.from('tarjetas')
    .select('id, codigo, estado, sede_id, sede:sedes(nombre), visita:visitas!tarjetas_visita_fk(id, paciente_nombre, ubicacion_etiqueta, ubicacion_id, piso_id, created_at, tipo_visitante, visitante:visitantes(nombres_completos, cedula, celular))')
    .order('codigo')
  if (f.estado) q = q.eq('estado', f.estado)
  const { data } = await q
  let rows = (data ?? []).map((t: any) => ({
    id: t.id,
    codigo: t.codigo,
    estado: t.estado,
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
  })) as TarjetaDetalle[]

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
      servicio: (u as any).servicio ?? null,
      cupo: u.cupo_default,
      num_ingreso: pac?.num_ingreso ?? null,
      paciente_nombre: pac?.nombre ?? null,
      edad: pac?.edad ?? null,
      aislamiento: pac ? aislMap.get(pac.num_ingreso) ?? null : null,
      visitas: visByUbic.get(u.id) ?? [],
    }
  })
}

// ─── Descripción legible de filtros (para encabezados de export) ──
const ESTADO_LBL: Record<string, string> = {
  activa: 'Activas (dentro)', finalizada: 'Finalizadas',
  disponible: 'Disponibles', en_uso: 'En uso', inactiva: 'Inactivas',
}
const TIPO_LBL: Record<string, string> = { familiar: 'Familiar', proveedor: 'Proveedor', colaborador: 'Colaborador' }

export function describirFiltros(
  f: { estado?: string; tipo?: string; sedeId?: string; pisoId?: string; ubicacionId?: string; desde?: string; hasta?: string; texto?: string; numIngreso?: string },
  ctx: { sedes?: { id: string; nombre: string }[]; pisos?: { id: string; nombre: string }[]; ubicaciones?: { id: string; etiqueta: string }[] } = {},
): { sede: string; filtros: string } {
  const sede = f.sedeId ? (ctx.sedes?.find((s) => s.id === f.sedeId)?.nombre ?? 'Sede seleccionada') : 'Todas las sedes'
  const p: string[] = []
  if (f.estado) p.push(`Estado: ${ESTADO_LBL[f.estado] ?? f.estado}`)
  if (f.tipo) p.push(`Tipo: ${TIPO_LBL[f.tipo] ?? f.tipo}`)
  if (f.pisoId) p.push(`Piso: ${ctx.pisos?.find((x) => x.id === f.pisoId)?.nombre ?? f.pisoId}`)
  if (f.ubicacionId) p.push(`Ubicación: ${ctx.ubicaciones?.find((x) => x.id === f.ubicacionId)?.etiqueta ?? f.ubicacionId}`)
  if (f.numIngreso) p.push(`# ingreso: ${f.numIngreso}`)
  if (f.desde) p.push(`Desde: ${f.desde}`)
  if (f.hasta) p.push(`Hasta: ${f.hasta}`)
  if (f.texto) p.push(`Búsqueda: "${f.texto}"`)
  return { sede, filtros: p.join(' · ') }
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
    .select('id, tipo_visitante, tipo_acompanante, paciente_nombre, num_ingreso, ubicacion_etiqueta, aislamiento, permiso_alimentos, estado, created_at, sede_id, visitante:visitantes(nombres_completos, cedula, celular), tarjeta:tarjetas!visitas_tarjeta_id_fkey(codigo), responsable:responsables!visitas_responsable_id_fkey(nombre_completo), sede:sedes(nombre), eventos:visita_eventos(tipo, hora)')
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

// ─── Centro de monitoreo ────────────────────────────────────
export interface ResumenMonitoreo { activas: number; conAcomp: number; pacientes: number; aislamiento: number; ingresosHoy: number }
export async function monitoreoResumen(hoy: string): Promise<ResumenMonitoreo> {
  const [act, pac, ais, hoyEv] = await Promise.all([
    supabase.from('visitas').select('num_ingreso').eq('estado', 'activa'),
    supabase.from('pacientes_ubicacion').select('id', { count: 'exact', head: true }),
    supabase.from('aislamientos').select('id', { count: 'exact', head: true }).eq('vigente', true),
    supabase.from('visita_eventos').select('id', { count: 'exact', head: true }).eq('tipo', 'ingreso').gte('hora', hoy + 'T00:00:00-05:00'),
  ])
  const rows = (act.data ?? []) as { num_ingreso: string | null }[]
  return {
    activas: rows.length,
    conAcomp: new Set(rows.map((r) => r.num_ingreso).filter(Boolean)).size,
    pacientes: pac.count ?? 0,
    aislamiento: ais.count ?? 0,
    ingresosHoy: hoyEv.count ?? 0,
  }
}


export interface FeedItem {
  hora: string
  tipo: 'ingreso' | 'salida'
  visitante: string
  ubicacion: string | null
  tipo_visitante: string | null
  tipo_acompanante: string | null
}
export async function feedReciente(limit = 14): Promise<FeedItem[]> {
  const { data } = await supabase.from('visita_eventos')
    .select('tipo, hora, visita:visitas(tipo_visitante, tipo_acompanante, ubicacion_etiqueta, visitante:visitantes(nombres_completos))')
    .order('hora', { ascending: false }).limit(limit)
  return (data ?? []).map((e: any) => ({
    hora: e.hora,
    tipo: e.tipo,
    visitante: e.visita?.visitante?.nombres_completos ?? '—',
    ubicacion: e.visita?.ubicacion_etiqueta ?? null,
    tipo_visitante: e.visita?.tipo_visitante ?? null,
    tipo_acompanante: e.visita?.tipo_acompanante ?? null,
  })) as FeedItem[]
}

export interface PisoOcup { piso: string; orden: number; n: number }
export async function ocupacionPorPiso(): Promise<PisoOcup[]> {
  const { data } = await supabase.from('visitas')
    .select('piso_id, piso:pisos(nombre, orden)').eq('estado', 'activa')
  const m = new Map<string, PisoOcup>()
  ;(data ?? []).forEach((v: any) => {
    const nombre = v.piso?.nombre ?? 'Sin piso'
    const cur = m.get(nombre) ?? { piso: nombre, orden: v.piso?.orden ?? 99, n: 0 }
    cur.n++; m.set(nombre, cur)
  })
  return Array.from(m.values()).sort((a, b) => a.orden - b.orden)
}

// Matriz 7×24 (día×hora, Colombia GMT-5) de ingresos para el mapa de calor del monitoreo.
export async function heatmapDiaHora(): Promise<{ matriz: number[][]; max: number }> {
  const evs = await eventosIngreso()
  const m: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
  let max = 0
  evs.forEach((e) => {
    const co = new Date(new Date(e.hora).getTime() - 5 * 3_600_000)
    const dow = (co.getUTCDay() + 6) % 7
    m[dow][co.getUTCHours()]++
  })
  m.forEach((r) => r.forEach((v) => { if (v > max) max = v }))
  return { matriz: m, max }
}

// ─── Sincronización CENSO: inconsistencias y bitácora ───────
export interface CensoInconsistencia {
  id: string; tipo: string; num_ingreso: string | null; paciente: string | null
  censo_unidad: string | null; censo_area: string | null; censo_cama: string | null
  detalle: string | null; primera_vez: string; ultima_vez: string
}
export interface CensoSyncLog {
  id: string; run_at: string; ok: boolean; total_censo: number | null; pacientes_upsert: number | null
  altas: number | null; aislamientos: number | null; inconsistencias: number | null; duracion_ms: number | null; mensaje: string | null
}
export async function listInconsistencias(): Promise<CensoInconsistencia[]> {
  const { data } = await supabase.from('censo_inconsistencias').select('*').order('tipo').order('censo_unidad')
  return (data ?? []) as CensoInconsistencia[]
}
export async function ultimoSync(): Promise<CensoSyncLog | null> {
  const { data } = await supabase.from('censo_sync_log').select('*').order('run_at', { ascending: false }).limit(1).maybeSingle()
  return (data ?? null) as CensoSyncLog | null
}
// Ejecuta el sync del CENSO bajo demanda (Edge Function censo-sync; solo admin).
export async function ejecutarSyncCenso(): Promise<{ ok: boolean; resumen?: any; error?: string }> {
  const { data, error } = await supabase.functions.invoke('censo-sync', { method: 'POST' })
  if (error) {
    // intenta extraer el mensaje del cuerpo de la respuesta de error
    let msg = error.message
    try { const ctx = (error as any).context; if (ctx?.json) { const b = await ctx.json(); msg = b?.error ?? msg } } catch { /* noop */ }
    return { ok: false, error: msg }
  }
  if (data && data.ok === false) return { ok: false, error: data.error ?? 'Error en la sincronización' }
  return { ok: true, resumen: data }
}

// ─── Horarios de visita (política 6.1) ──────────────────────
export async function listHorarios(): Promise<HorarioVisita[]> {
  const { data } = await supabase.from('horarios_visita').select('*').eq('activo', true).order('prioridad')
  return (data ?? []) as HorarioVisita[]
}

// "13:00:00" → "1:00 p.m."  (formato Colombia, 12h)
function horaAmPm(t: string): string {
  const [hRaw, m] = t.split(':')
  const h = parseInt(hRaw, 10)
  const ap = h < 12 ? 'a.m.' : 'p.m.'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${(m ?? '00').padStart(2, '0')} ${ap}`
}
function franja(ini: string, fin: string): string { return `${horaAmPm(ini)} – ${horaAmPm(fin)}` }

export function ventanasTexto(h: HorarioVisita): string {
  const partes = [franja(h.ventana1_inicio, h.ventana1_fin)]
  if (h.ventana2_inicio && h.ventana2_fin) partes.push(franja(h.ventana2_inicio, h.ventana2_fin))
  return partes.join('  /  ')
}

// Minutos transcurridos del día (hora Colombia GMT-5) a partir de "HH:MM[:SS]".
const minutosDe = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0) }
function ahoraMinutosCO(): number {
  const co = new Date(Date.now() - 5 * 3_600_000)
  return co.getUTCHours() * 60 + co.getUTCMinutes()
}
function dentroDeVentanas(h: HorarioVisita): boolean {
  const now = ahoraMinutosCO()
  const en = (i?: string | null, f?: string | null) => !!i && !!f && now >= minutosDe(i) && now <= minutosDe(f)
  return en(h.ventana1_inicio, h.ventana1_fin) || en(h.ventana2_inicio, h.ventana2_fin)
}

// Elige el horario que aplica a un paciente según su servicio (texto del CENSO) y si está aislado.
export function horarioAplicable(horarios: HorarioVisita[], servicioTexto: string | null, aislado: boolean): HorarioVisita | null {
  const orden = [...horarios].sort((a, b) => a.prioridad - b.prioridad)
  if (aislado) { const r = orden.find((h) => h.aplica_aislamiento); if (r) return r }
  const s = sinTildes(servicioTexto ?? '')
  if (s) { const r = orden.find((h) => h.match_censo && !h.aplica_aislamiento && s.includes(sinTildes(h.match_censo))); if (r) return r }
  return orden.find((h) => !h.match_censo && !h.aplica_aislamiento) ?? null
}

// Cuenta visitas (familiares) registradas hoy para un mismo ingreso/paciente.
export async function visitasHoyPaciente(numIngreso: string): Promise<number> {
  const hoyCO = new Date(Date.now() - 5 * 3_600_000).toISOString().substring(0, 10)
  const { count } = await supabase.from('visitas')
    .select('id', { count: 'exact', head: true })
    .eq('num_ingreso', numIngreso).eq('tipo_visitante', 'familiar')
    .gte('created_at', hoyCO + 'T00:00:00-05:00')
  return count ?? 0
}

export interface EvalRestriccion {
  horario: HorarioVisita | null
  fueraHorario: boolean       // true ⇒ hay un horario definido y NO estamos dentro
  ventanas: string
  limiteSimultaneo: number
  excedeSimultaneo: boolean    // registrar uno más superaría el simultáneo
  maxPorDia: number | null
  visitasHoy: number
  excedeDia: boolean           // registrar uno más superaría el máximo por día
}

// Evalúa horario + cupos para una habitación antes de registrar un familiar.
export async function evaluarRestricciones(o: OcupacionUbicacion): Promise<EvalRestriccion> {
  const horarios = await listHorarios()
  const h = horarioAplicable(horarios, o.servicio ?? o.area, !!o.aislamiento)
  const limiteSimultaneo = h?.max_simultaneo ?? o.cupo
  const visitasHoy = o.num_ingreso ? await visitasHoyPaciente(o.num_ingreso) : 0
  const maxPorDia = h?.max_por_dia ?? null
  return {
    horario: h,
    fueraHorario: !!h && !dentroDeVentanas(h),
    ventanas: h ? ventanasTexto(h) : '',
    limiteSimultaneo,
    excedeSimultaneo: o.visitas.length >= limiteSimultaneo,
    maxPorDia,
    visitasHoy,
    excedeDia: maxPorDia != null && visitasHoy >= maxPorDia,
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
  autorizado_por_id?: string | null
  autorizacion_motivo?: string | null
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
