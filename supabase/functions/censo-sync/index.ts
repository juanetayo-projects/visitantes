// Edge Function: sincroniza el CENSO Hospitalario → Supabase.
// Se puede invocar:
//   • desde la app (admin autenticado) con supabase.functions.invoke('censo-sync')
//   • desde el cron (GitHub Actions) con Authorization: Bearer <service_role>
// Secrets requeridos (supabase secrets set): CENSO_API_BASE_URL, CENSO_API_USER, CENSO_API_PASSWORD
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

const norm = (s: unknown) => (s ?? '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().replace(/\s+/g, ' ').trim()
const key3 = (u: unknown, a: unknown, c: unknown) => `${norm(u)}|${norm(a)}|${norm(c)}`
const camaDe = (r: any) => (r.Cama && String(r.Cama).trim()) || (r.UbicacionNombre && String(r.UbicacionNombre).trim()) || null
const parseEdad = (v: unknown) => { const n = parseInt(String(v ?? '').replace(/[^\d]/g, ''), 10); return Number.isFinite(n) ? n : null }

const AISL_MAP: Record<string, string | null> = {
  'CONTACTO': 'contacto', 'RESPIRATORIO': 'respiratorio', 'PROTECTOR': 'protector', 'COHORTIZACION': 'cohortizacion',
  'RESPIRATORIO / CONTACTO': 'respiratorio_contacto', 'RESPIRATORIO/CONTACTO': 'respiratorio_contacto', 'NO APLICA': null,
}
function mapAislamiento(v: unknown): string | null | '__desc__' {
  const n = norm(v)
  if (!n || n === 'NO APLICA') return null
  if (n in AISL_MAP) return AISL_MAP[n] ?? null
  return '__desc__'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const t0 = Date.now()
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const admin = createClient(url, service)

    // ── Autorización: admin autenticado o llamada de sistema (service_role) ──
    const authHeader = req.headers.get('Authorization') ?? ''
    const bearer = authHeader.replace(/^Bearer\s+/i, '')
    let autorizado = bearer === service
    if (!autorizado) {
      const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
      const { data: { user } } = await userClient.auth.getUser()
      if (!user) return json({ error: 'No autenticado' }, 401)
      const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', user.id).single()
      if (perfil?.rol !== 'admin') return json({ error: 'Solo administradores pueden ejecutar la sincronización.' }, 403)
      autorizado = true
    }

    // ── Config CENSO ──
    const base = (Deno.env.get('CENSO_API_BASE_URL') || 'https://censo-hospitalario.cacsb.net').replace(/\/$/, '')
    const user_name = Deno.env.get('CENSO_API_USER')
    const password = Deno.env.get('CENSO_API_PASSWORD')
    if (!user_name || !password) return json({ error: 'Faltan secrets CENSO_API_USER / CENSO_API_PASSWORD en la función.' }, 500)

    // ── 1) Login + datos ──
    const lr = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ user_name, password }),
    })
    if (!lr.ok) throw new Error(`Login CENSO HTTP ${lr.status}`)
    const token = (await lr.json()).access_token
    if (!token) throw new Error('Login CENSO sin access_token')
    const cr = await fetch(`${base}/api/external/censo`, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } })
    if (!cr.ok) throw new Error(`Censo HTTP ${cr.status}`)
    const censoJson = await cr.json()
    const censo: any[] = Array.isArray(censoJson) ? censoJson : censoJson?.data ?? censoJson?.censo ?? []
    if (!censo.length) throw new Error('Censo sin registros')

    // ── 2) Catálogos ──
    const [{ data: homol }, { data: ubic }, { data: existentes }] = await Promise.all([
      admin.from('homologacion_ubicaciones').select('censo_unidad, censo_area, censo_cama, ubicacion_id').eq('activo', true),
      admin.from('ubicaciones').select('id, piso_id, etiqueta, servicio, area'),
      admin.from('pacientes_ubicacion').select('num_ingreso'),
    ])
    const homolMap = new Map((homol ?? []).map((h: any) => [key3(h.censo_unidad, h.censo_area, h.censo_cama), h.ubicacion_id]))
    const ubicMap = new Map((ubic ?? []).map((u: any) => [u.id, u]))
    const previos = new Set((existentes ?? []).map((p: any) => p.num_ingreso))

    // ── 3) Transformar ──
    const pacientes: any[] = [], aislamientos: any[] = [], incons: any[] = []
    const vistos = new Set<string>(), dedup = new Set<string>()
    const now = new Date().toISOString()
    const pushIncon = (tipo: string, r: any, cama: string | null, detalle: string) => {
      const k = `${tipo}|${r.Ingreso ?? ''}|${norm(r.UbicacionActual)}|${norm(cama)}`
      if (dedup.has(k)) return; dedup.add(k)
      incons.push({ tipo, num_ingreso: r.Ingreso ?? null, paciente: r.Paciente ?? null, censo_unidad: r.UbicacionActual ?? null, censo_area: r.UbicacionArea ?? null, censo_cama: cama ?? null, detalle })
    }
    for (const r of censo) {
      const numIngreso = r.Ingreso
      if (!numIngreso) continue
      vistos.add(numIngreso)
      const cama = camaDe(r)
      let ubicacionId: string | null = null, u: any = null
      if (!cama) {
        pushIncon('sin_cama', r, null, 'Sin cama asignada en el CENSO (sala de espera / sin ubicación física).')
      } else {
        ubicacionId = homolMap.get(key3(r.UbicacionActual, r.UbicacionArea, cama)) ?? null
        u = ubicacionId ? ubicMap.get(ubicacionId) : null
        if (!ubicacionId || !u) pushIncon('ubicacion_no_homologada', r, cama, `Sin homologar: «${r.UbicacionActual ?? '?'}»${r.UbicacionArea ? ' / ' + r.UbicacionArea : ''} / cama «${cama}». Agrégala en Homologación CENSO.`)
      }
      pacientes.push({
        num_ingreso: numIngreso, documento: r.Identificacion ?? null, nombre: r.Paciente ?? null, edad: parseEdad(r.edad),
        ubicacion_id: ubicacionId ?? null, piso_id: u?.piso_id ?? null, ubicacion_etiqueta: u?.etiqueta ?? null,
        servicio: r.UbicacionActual ?? null, fecha_ingreso: r.FechaHoraIngreso ? String(r.FechaHoraIngreso).substring(0, 10) : null, sync_at: now,
      })
      const aisl = mapAislamiento(r.TipoDeAislamiento)
      if (aisl === '__desc__') pushIncon('aislamiento_desconocido', r, cama, `Tipo de aislamiento no contemplado: «${r.TipoDeAislamiento}».`)
      else if (aisl) aislamientos.push({ num_ingreso: numIngreso, tipo: aisl, vigente: true, sync_at: now })
    }
    const egresos = [...previos].filter((n) => !vistos.has(n as string))

    // ── 4) Escribir ──
    if (pacientes.length) { const { error } = await admin.from('pacientes_ubicacion').upsert(pacientes, { onConflict: 'num_ingreso' }); if (error) throw new Error('upsert pacientes: ' + error.message) }
    if (egresos.length) await admin.from('pacientes_ubicacion').delete().in('num_ingreso', egresos as string[])
    await admin.from('aislamientos').delete().neq('num_ingreso', '__none__')
    if (aislamientos.length) { const { error } = await admin.from('aislamientos').insert(aislamientos); if (error) throw new Error('insert aislamientos: ' + error.message) }
    await admin.from('censo_inconsistencias').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (incons.length) await admin.from('censo_inconsistencias').insert(incons)

    const resumen = { ok: true, total_censo: censo.length, pacientes_upsert: pacientes.length, altas: egresos.length, aislamientos: aislamientos.length, inconsistencias: incons.length, duracion_ms: Date.now() - t0, mensaje: 'OK' }
    await admin.from('censo_sync_log').insert(resumen)
    return json(resumen)
  } catch (e) {
    const cli = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    await cli.from('censo_sync_log').insert({ ok: false, duracion_ms: Date.now() - t0, mensaje: String(e) })
    return json({ ok: false, error: String(e) }, 500)
  }
})
