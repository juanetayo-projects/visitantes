// ─────────────────────────────────────────────────────────────────────────
// Sync horario CENSO Hospitalario → Supabase (pacientes_ubicacion + aislamientos)
//
//   node scripts/sync/censo.mjs            # ejecuta y escribe en Supabase
//   node scripts/sync/censo.mjs --dry-run  # NO escribe; solo reporta el plan
//
// Lee configuración de variables de entorno (GitHub Actions) o de .env.local:
//   CENSO_API_BASE_URL, CENSO_API_USER, CENSO_API_PASSWORD
//   SUPABASE_URL (o VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
// El service_role omite RLS (proceso backend) — NUNCA exponer esta clave.
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DRY = process.argv.includes('--dry-run')

// ── Config (env del sistema con prioridad; si no, .env.local) ──
function cfg() {
  const env = { ...process.env }
  const f = join(__dirname, '..', '..', '.env.local')
  if (existsSync(f)) {
    for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && env[m[1]] == null) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
  return env
}
const env = cfg()
const BASE = (env.CENSO_API_BASE_URL || 'https://censo-hospitalario.cacsb.net').replace(/\/$/, '')
const SUPA_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL
const SUPA_KEY = env.SUPABASE_SERVICE_ROLE_KEY

const norm = (s) => (s ?? '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().replace(/\s+/g, ' ').trim()
const key3 = (u, a, c) => `${norm(u)}|${norm(a)}|${norm(c)}`

const AISL_MAP = {
  'CONTACTO': 'contacto',
  'RESPIRATORIO': 'respiratorio',
  'PROTECTOR': 'protector',
  'COHORTIZACION': 'cohortizacion',
  'RESPIRATORIO / CONTACTO': 'respiratorio_contacto',
  'RESPIRATORIO/CONTACTO': 'respiratorio_contacto',
  'NO APLICA': null,
}
function mapAislamiento(v) {
  const n = norm(v)
  if (!n || n === 'NO APLICA') return undefined          // sin aislamiento
  if (n in AISL_MAP) return AISL_MAP[n] ?? undefined
  return '__desconocido__'                                // valor nuevo no contemplado
}
function parseEdad(v) { const n = parseInt(String(v ?? '').replace(/[^\d]/g, ''), 10); return Number.isFinite(n) ? n : null }

async function censoLogin() {
  const r = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ user_name: env.CENSO_API_USER, password: env.CENSO_API_PASSWORD }),
  })
  if (!r.ok) throw new Error(`Login CENSO HTTP ${r.status}`)
  const j = await r.json()
  if (!j.access_token) throw new Error('Login CENSO sin access_token')
  return j.access_token
}
async function censoData(token) {
  const r = await fetch(`${BASE}/api/external/censo`, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } })
  if (!r.ok) throw new Error(`Censo HTTP ${r.status}`)
  const j = await r.json()
  const arr = Array.isArray(j) ? j : j?.data ?? j?.censo ?? null
  if (!arr) throw new Error('Respuesta de censo sin arreglo de datos')
  return arr
}

async function main() {
  const t0 = Date.now()
  if (!SUPA_URL || !SUPA_KEY) {
    console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.', DRY ? '(en --dry-run se requieren para leer homologación)' : '')
    process.exit(1)
  }
  const sb = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })

  // 1) Datos del CENSO
  const token = await censoLogin()
  const censo = await censoData(token)
  console.log(`CENSO: ${censo.length} registros`)

  // 2) Catálogos de homologación / ubicaciones
  const [{ data: homol }, { data: ubic }, { data: existentes }] = await Promise.all([
    sb.from('homologacion_ubicaciones').select('censo_unidad, censo_area, censo_cama, ubicacion_id').eq('activo', true),
    sb.from('ubicaciones').select('id, piso_id, etiqueta, servicio, area'),
    sb.from('pacientes_ubicacion').select('num_ingreso'),
  ])
  const homolMap = new Map((homol ?? []).map((h) => [key3(h.censo_unidad, h.censo_area, h.censo_cama), h.ubicacion_id]))
  const ubicMap = new Map((ubic ?? []).map((u) => [u.id, u]))
  const previos = new Set((existentes ?? []).map((p) => p.num_ingreso))

  // 3) Transformar
  const pacientes = []
  const aislamientos = []
  const incons = []
  const vistos = new Set()
  const dedup = new Set()
  const pushIncon = (tipo, r, cama, detalle) => {
    const k = `${tipo}|${r.Ingreso ?? ''}|${norm(r.UbicacionActual)}|${norm(cama)}`
    if (dedup.has(k)) return; dedup.add(k)
    incons.push({ tipo, num_ingreso: r.Ingreso ?? null, paciente: r.Paciente ?? null,
      censo_unidad: r.UbicacionActual ?? null, censo_area: r.UbicacionArea ?? null, censo_cama: cama ?? null, detalle })
  }
  // El identificador de cama llega en `Cama` (hospitalización/UCI) o en `UbicacionNombre` (urgencias/sillones).
  const camaDe = (r) => (r.Cama && String(r.Cama).trim()) || (r.UbicacionNombre && String(r.UbicacionNombre).trim()) || null

  for (const r of censo) {
    const numIngreso = r.Ingreso
    if (!numIngreso) continue
    vistos.add(numIngreso)

    const cama = camaDe(r)
    let ubicacionId = null, u = null
    if (!cama) {
      pushIncon('sin_cama', r, null, 'Sin cama asignada en el CENSO (sala de espera / sin ubicación física).')
    } else {
      ubicacionId = homolMap.get(key3(r.UbicacionActual, r.UbicacionArea, cama)) ?? null
      u = ubicacionId ? ubicMap.get(ubicacionId) : null
      if (!ubicacionId || !u) {
        pushIncon('ubicacion_no_homologada', r, cama,
          `Sin homologar: «${r.UbicacionActual ?? '?'}»${r.UbicacionArea ? ' / ' + r.UbicacionArea : ''} / cama «${cama}». Agrégala en Homologación CENSO.`)
      }
    }

    pacientes.push({
      num_ingreso: numIngreso,
      documento: r.Identificacion ?? null,
      nombre: r.Paciente ?? null,
      edad: parseEdad(r.edad),
      ubicacion_id: ubicacionId ?? null,
      piso_id: u?.piso_id ?? null,
      ubicacion_etiqueta: u?.etiqueta ?? null,
      servicio: r.UbicacionActual ?? null,
      fecha_ingreso: r.FechaHoraIngreso ? String(r.FechaHoraIngreso).substring(0, 10) : null,
      sync_at: new Date().toISOString(),
    })

    const aisl = mapAislamiento(r.TipoDeAislamiento)
    if (aisl === '__desconocido__') {
      pushIncon('aislamiento_desconocido', r, cama, `Tipo de aislamiento no contemplado: «${r.TipoDeAislamiento}».`)
    } else if (aisl) {
      aislamientos.push({ num_ingreso: numIngreso, tipo: aisl, vigente: true, sync_at: new Date().toISOString() })
    }
  }

  const egresos = [...previos].filter((n) => !vistos.has(n))

  console.log(`Plan: upsert ${pacientes.length} pacientes · ${aislamientos.length} aislamientos vigentes · ` +
    `${egresos.length} egresos a eliminar · ${incons.length} inconsistencias`)
  const porTipo = incons.reduce((m, i) => ((m[i.tipo] = (m[i.tipo] || 0) + 1), m), {})
  console.log('Inconsistencias por tipo:', JSON.stringify(porTipo))

  if (DRY) {
    console.log('\n--dry-run: no se escribió nada. Muestra de inconsistencias:')
    console.log(incons.slice(0, 12).map((i) => `  · [${i.tipo}] ${i.censo_unidad ?? ''} / cama ${i.censo_cama ?? ''} (#${i.num_ingreso})`).join('\n'))
    return
  }

  // 4) Escribir (orden: pacientes → aislamientos → inconsistencias → log)
  let ok = true, mensaje = 'OK'
  try {
    if (pacientes.length) {
      const { error } = await sb.from('pacientes_ubicacion').upsert(pacientes, { onConflict: 'num_ingreso' })
      if (error) throw new Error('upsert pacientes: ' + error.message)
    }
    if (egresos.length) await sb.from('pacientes_ubicacion').delete().in('num_ingreso', egresos)

    // aislamientos: espejo completo
    await sb.from('aislamientos').delete().neq('num_ingreso', '__none__')
    if (aislamientos.length) {
      const { error } = await sb.from('aislamientos').insert(aislamientos)
      if (error) throw new Error('insert aislamientos: ' + error.message)
    }

    // inconsistencias: snapshot actual
    await sb.from('censo_inconsistencias').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (incons.length) await sb.from('censo_inconsistencias').insert(incons)
  } catch (e) {
    ok = false; mensaje = e.message
    console.error('ERROR sync:', e.message)
  }

  await sb.from('censo_sync_log').insert({
    ok, total_censo: censo.length, pacientes_upsert: pacientes.length, altas: egresos.length,
    aislamientos: aislamientos.length, inconsistencias: incons.length, duracion_ms: Date.now() - t0, mensaje,
  })
  console.log(ok ? `✓ Sync OK en ${Date.now() - t0} ms` : `✗ Sync con errores: ${mensaje}`)
  if (!ok) process.exit(1)
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1) })
