// Edge Function: sincroniza el CENSO Hospitalario → Supabase.
// Se puede invocar:
//   • desde la app (admin autenticado) con supabase.functions.invoke('censo-sync')
//   • desde el cron (GitHub Actions) con Authorization: Bearer <service_role>
//   • desde pg_cron (cada 15 min) con el encabezado x-cron-token (secreto en Vault)
//   • desde Registrar visita (admin/orientador) con { action: 'verificar', num_ingreso | documento }:
//     consulta el censo EN VIVO para confirmar la ubicación real de un solo paciente.
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
// El CENSO manda a veces la cama con el piso pegado al nombre (ej. "Camilla 15 Piso 2"),
// mientras el catálogo interno guarda solo "Camilla 15" → se quita el sufijo para poder emparejar.
const normCama = (s: unknown) => norm(s).replace(/\sPISO\s*\d+$/, '').trim()
// Reglas de nomenclatura del censo: "CI 03" (UCI) y "CE 03" (UCIN) corresponden a "Cubículo 03" en la app.
const etiquetaDeCama = (s: unknown) => {
  const c = normCama(s)
  const m = c.match(/^C[IE]\s*(\d+)$/)
  return m ? `CUBICULO ${m[1].padStart(2, '0')}` : c
}
const key3 = (u: unknown, a: unknown, c: unknown) => `${norm(u)}|${norm(a)}|${normCama(c)}`
const keyId = (id: unknown, a: unknown, c: unknown) => `${String(id ?? '')}|${norm(a)}|${normCama(c)}`
const camaDe = (r: any) => (r.Cama && String(r.Cama).trim()) || (r.UbicacionNombre && String(r.UbicacionNombre).trim()) || null
const parseEdad = (v: unknown) => { const n = parseInt(String(v ?? '').replace(/[^\d]/g, ''), 10); return Number.isFinite(n) ? n : null }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// La API del CENSO a veces responde 200 sin access_token (reinicio / rate-limit del Laravel).
// Reintenta antes de darse por vencida: el 500 resultante hacía fallar el cron de GitHub.
async function loginCenso(base: string, user_name: string, password: string, intentos = 3): Promise<string> {
  let ultimo = 'sin detalle'
  for (let i = 1; i <= intentos; i++) {
    try {
      const lr = await fetch(`${base}/api/v1/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ user_name, password }),
      })
      if (!lr.ok) {
        ultimo = `HTTP ${lr.status}`
      } else {
        const body = await lr.json().catch(() => null)
        const token = body?.access_token
        if (token) return token
        ultimo = `respuesta sin access_token${body?.message ? ` («${body.message}»)` : ''}`
      }
    } catch (e) {
      ultimo = `error de red: ${String(e)}`
    }
    if (i < intentos) await sleep(3000)
  }
  throw new Error(`Login CENSO falló tras ${intentos} intentos · ${ultimo}`)
}

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

// Lectura del censo con caché corta: cada verificación desde Registrar evita golpear la API
// (que tiene rate-limit) si otra consulta acaba de traer los mismos datos.
const CACHE_MS = 45_000
let cacheCenso: { at: number; data: any[] } | null = null
async function leerCenso(usarCache: boolean): Promise<any[]> {
  if (usarCache && cacheCenso && Date.now() - cacheCenso.at < CACHE_MS) return cacheCenso.data
  const base = (Deno.env.get('CENSO_API_BASE_URL') || 'https://censo-hospitalario.cacsb.net').replace(/\/$/, '')
  const user_name = Deno.env.get('CENSO_API_USER')
  const password = Deno.env.get('CENSO_API_PASSWORD')
  if (!user_name || !password) throw new Error('Faltan secrets CENSO_API_USER / CENSO_API_PASSWORD en la función.')
  const token = await loginCenso(base, user_name, password)
  const cr = await fetch(`${base}/api/external/censo`, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } })
  if (!cr.ok) throw new Error(`Censo HTTP ${cr.status}`)
  const censoJson = await cr.json()
  const censo: any[] = Array.isArray(censoJson) ? censoJson : censoJson?.data ?? censoJson?.censo ?? []
  if (!censo.length) throw new Error('Censo sin registros')
  cacheCenso = { at: Date.now(), data: censo }
  return censo
}

async function cargarCatalogos(admin: any) {
  const [{ data: homol }, { data: ubic }, { data: unidades }, { data: pisos }] = await Promise.all([
    admin.from('homologacion_ubicaciones').select('id, censo_unidad, censo_unidad_id, censo_area, censo_cama, ubicacion_id').eq('activo', true),
    admin.from('ubicaciones').select('id, piso_id, etiqueta, servicio, area, activo, cupo_default'),
    admin.from('censo_unidades').select('id_gomedisys, nombre, piso_id'),
    admin.from('pisos').select('id, nombre'),
  ])
  return { homol: homol ?? [], ubic: ubic ?? [], unidades: unidades ?? [], pisos: pisos ?? [] }
}

// Resuelve una fila del censo a una ubicación de la app. Orden:
//  1) Homologación por ID de unidad + área + cama (sobrevive a que renombren la unidad en GoMedisys).
//  2) Homologación por nombre de unidad + área + cama.
//  3) Coincidencia automática, SOLO dentro del piso al que pertenece la unidad y solo entre
//     ubicaciones activas. Nunca se empareja por nombre entre pisos: "Sillon 18" del piso 9 no
//     puede terminar en "Sillón 18" del piso 2.
function crearResolutor(cat: Awaited<ReturnType<typeof cargarCatalogos>>) {
  const porId = new Map<string, any>(), porNombre = new Map<string, any>()
  for (const h of cat.homol) {
    porNombre.set(key3(h.censo_unidad, h.censo_area, h.censo_cama), h)
    if (h.censo_unidad_id) porId.set(keyId(h.censo_unidad_id, h.censo_area, h.censo_cama), h)
  }
  const ubicMap = new Map<string, any>(cat.ubic.map((u: any) => [u.id, u]))
  const unidadMap = new Map<string, any>(cat.unidades.map((u: any) => [String(u.id_gomedisys), u]))
  const pisoPorEtiqueta = new Map<string, any[]>()
  for (const u of cat.ubic) {
    if (!u.activo) continue
    const k = `${u.piso_id}|${norm(u.etiqueta)}`
    const a = pisoPorEtiqueta.get(k) ?? []; a.push(u); pisoPorEtiqueta.set(k, a)
  }

  return function resolver(r: any) {
    const cama = camaDe(r)
    const idUnidad = r.IdUbicacionGomedisys != null ? String(r.IdUbicacionGomedisys) : null
    const unidad = idUnidad ? unidadMap.get(idUnidad) : null
    if (!cama) return { cama, unidad, h: null, u: null, auto: false }
    const h = (idUnidad && porId.get(keyId(idUnidad, r.UbicacionArea, cama))) || porNombre.get(key3(r.UbicacionActual, r.UbicacionArea, cama)) || null
    if (h?.ubicacion_id && ubicMap.has(h.ubicacion_id)) return { cama, unidad, h, u: ubicMap.get(h.ubicacion_id), auto: false }
    if (unidad?.piso_id) {
      let cands = pisoPorEtiqueta.get(`${unidad.piso_id}|${etiquetaDeCama(cama)}`) ?? []
      if (cands.length > 1 && r.UbicacionArea) cands = cands.filter((u: any) => norm(u.area) === norm(r.UbicacionArea))
      if (cands.length === 1) return { cama, unidad, h, u: cands[0], auto: true }
    }
    return { cama, unidad, h, u: null, auto: false }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const t0 = Date.now()
  const url = Deno.env.get('SUPABASE_URL')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const admin = createClient(url, service)
  let body: any = {}
  try {
    body = await req.json().catch(() => ({}))

    // ── Autorización: llamada de sistema (service_role / pg_cron) o usuario con rol permitido ──
    const authHeader = req.headers.get('Authorization') ?? ''
    const bearer = authHeader.replace(/^Bearer\s+/i, '')
    const jwtRole = (t: string) => { try { return JSON.parse(atob(t.split('.')[1] ?? '')).role ?? null } catch { return null } }
    let sistema = bearer === service || jwtRole(bearer) === 'service_role'
    const cronToken = req.headers.get('x-cron-token')
    if (!sistema && cronToken) {
      const { data } = await admin.rpc('censo_cron_token_ok', { t: cronToken })
      sistema = data === true
    }
    if (!sistema) {
      const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
      const { data: { user } } = await userClient.auth.getUser()
      if (!user) return json({ error: 'No autenticado' }, 401)
      const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', user.id).single()
      const permitidos = body?.action === 'verificar' ? ['admin', 'orientador'] : ['admin']
      if (!permitidos.includes(perfil?.rol)) return json({ error: 'No tienes permiso para ejecutar esta acción.' }, 403)
    }

    // ── Modo chequeo: confirma presencia de secrets sin consumir la API ──
    if (body?.action === 'check') {
      return json({ ok: true, check: true,
        CENSO_API_BASE_URL: !!Deno.env.get('CENSO_API_BASE_URL'),
        CENSO_API_USER: !!Deno.env.get('CENSO_API_USER'),
        CENSO_API_PASSWORD: !!Deno.env.get('CENSO_API_PASSWORD') })
    }

    // ── Verificación en vivo de un paciente (Registrar visita) ──
    if (body?.action === 'verificar') {
      const numIngreso = body.num_ingreso ? String(body.num_ingreso).trim() : ''
      const documento = body.documento ? String(body.documento).trim() : ''
      if (!numIngreso && !documento) return json({ ok: false, error: 'Falta num_ingreso o documento.' }, 400)
      let censo: any[]
      // Si la API del censo no responde no se borra nada: la app avisa y usa el último dato conocido.
      try { censo = await leerCenso(true) }
      catch (e) { return json({ ok: false, disponible: false, error: String(e) }) }
      const r = censo.find((x) => (numIngreso && String(x.Ingreso) === numIngreso) || (!numIngreso && documento && String(x.Identificacion ?? '').trim() === documento))
      if (!r) {
        // Ya no está en el censo: egresó. Se retira del espejo para que no siga apareciendo en el mapa.
        if (numIngreso) {
          await admin.from('pacientes_ubicacion').delete().eq('num_ingreso', numIngreso)
          await admin.from('aislamientos').delete().eq('num_ingreso', numIngreso)
        }
        return json({ ok: true, disponible: true, encontrado: false })
      }
      const cat = await cargarCatalogos(admin)
      const res = crearResolutor(cat)(r)
      const pisoNombre = res.u ? cat.pisos.find((p: any) => p.id === res.u.piso_id)?.nombre ?? null : null
      const aisl = mapAislamiento(r.TipoDeAislamiento)
      const aislamiento = aisl === '__desc__' ? null : aisl
      const now = new Date().toISOString()
      await admin.from('pacientes_ubicacion').upsert({
        num_ingreso: r.Ingreso, documento: r.Identificacion ?? null, nombre: r.Paciente ?? null, edad: parseEdad(r.edad),
        ubicacion_id: res.u?.id ?? null, piso_id: res.u?.piso_id ?? null, ubicacion_etiqueta: res.u?.etiqueta ?? null,
        servicio: r.UbicacionActual ?? null, censo_unidad_id: r.IdUbicacionGomedisys != null ? String(r.IdUbicacionGomedisys) : null,
        censo_area: r.UbicacionArea ?? null, censo_cama: res.cama ?? null,
        fecha_ingreso: r.FechaHoraIngreso ? String(r.FechaHoraIngreso).substring(0, 10) : null, sync_at: now,
      }, { onConflict: 'num_ingreso' })
      await admin.from('aislamientos').delete().eq('num_ingreso', r.Ingreso)
      if (aislamiento) await admin.from('aislamientos').insert({ num_ingreso: r.Ingreso, tipo: aislamiento, vigente: true, sync_at: now })
      return json({
        ok: true, disponible: true, encontrado: true,
        num_ingreso: r.Ingreso, documento: r.Identificacion ?? null, nombre: r.Paciente ?? null, edad: parseEdad(r.edad),
        unidad: r.UbicacionActual ?? null, area: r.UbicacionArea ?? null, cama: res.cama ?? null,
        ubicacion_id: res.u?.id ?? null, etiqueta: res.u?.etiqueta ?? null, piso_id: res.u?.piso_id ?? null, piso_nombre: pisoNombre,
        ubicacion_area: res.u?.area ?? null, servicio: res.u?.servicio ?? null, cupo: res.u?.cupo_default ?? null,
        ubicacion_activa: res.u ? !!res.u.activo : null, aislamiento,
      })
    }

    // ── 1) Datos del censo (siempre frescos en una sincronización) ──
    const censo = await leerCenso(false)

    // ── 2) Catálogos ──
    const [cat, { data: existentes }] = await Promise.all([
      cargarCatalogos(admin),
      admin.from('pacientes_ubicacion').select('num_ingreso'),
    ])
    const resolver = crearResolutor(cat)
    const previos = new Set((existentes ?? []).map((p: any) => p.num_ingreso))
    const unidadMap = new Map<string, any>(cat.unidades.map((u: any) => [String(u.id_gomedisys), u]))

    // ── 3) Transformar ──
    const pacientes: any[] = [], aislamientos: any[] = [], incons: any[] = []
    const vistos = new Set<string>(), dedup = new Set<string>()
    const homolVistas = new Set<string>(), nuevasHomol = new Map<string, any>(), completarHomol = new Map<string, any>()
    const unidadesVistas = new Map<string, string>(), ocupantes = new Map<string, any[]>()
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
      const idUnidad = r.IdUbicacionGomedisys != null ? String(r.IdUbicacionGomedisys) : null
      if (idUnidad && r.UbicacionActual) unidadesVistas.set(idUnidad, r.UbicacionActual)
      const { cama, unidad, h, u, auto } = resolver(r)
      if (h?.id) homolVistas.add(h.id)
      if (!cama) {
        pushIncon('sin_cama', r, null, 'Sin cama asignada en el CENSO (sala de espera / sin ubicación física).')
      } else {
        const fila = { censo_unidad: r.UbicacionActual ?? null, censo_unidad_id: idUnidad, censo_area: r.UbicacionArea || null, censo_cama: cama, activo: true }
        const k = key3(r.UbicacionActual, r.UbicacionArea, cama)
        if (u && auto && h?.id) completarHomol.set(h.id, u.id)
        else if (u && auto && !nuevasHomol.has(k)) nuevasHomol.set(k, { ...fila, ubicacion_id: u.id, origen: 'auto', ultimo_visto: now })
        else if (!u && !h && !nuevasHomol.has(k)) nuevasHomol.set(k, { ...fila, ubicacion_id: null, origen: 'auto', ultimo_visto: now })
        if (!u) {
          if (!unidad?.piso_id) pushIncon('unidad_desconocida', r, cama, `La unidad «${r.UbicacionActual ?? '?'}» (ID ${idUnidad ?? '—'}) no tiene piso asignado. Asígnalo en Sedes y ubicaciones → Censo vs app.`)
          else pushIncon('ubicacion_no_homologada', r, cama, `Sin homologar: «${r.UbicacionActual ?? '?'}»${r.UbicacionArea ? ' / ' + r.UbicacionArea : ''} / cama «${cama}». Asígnala en Homologación CENSO.`)
        } else {
          if (!u.activo) pushIncon('ubicacion_inactiva', r, cama, `El censo reporta un paciente en «${u.etiqueta}», que está inactiva en la app: no se ve en el mapa. Actívala o corrige la homologación.`)
          if (unidad?.piso_id && u.piso_id !== unidad.piso_id) pushIncon('piso_incoherente', r, cama, `La unidad «${r.UbicacionActual}» pertenece a otro piso que «${u.etiqueta}». Revisa la homologación.`)
          const arr = ocupantes.get(u.id) ?? []; arr.push({ r, cama, etiqueta: u.etiqueta }); ocupantes.set(u.id, arr)
        }
      }
      pacientes.push({
        num_ingreso: numIngreso, documento: r.Identificacion ?? null, nombre: r.Paciente ?? null, edad: parseEdad(r.edad),
        ubicacion_id: u?.id ?? null, piso_id: u?.piso_id ?? null, ubicacion_etiqueta: u?.etiqueta ?? null,
        servicio: r.UbicacionActual ?? null, censo_unidad_id: idUnidad, censo_area: r.UbicacionArea ?? null, censo_cama: cama ?? null,
        fecha_ingreso: r.FechaHoraIngreso ? String(r.FechaHoraIngreso).substring(0, 10) : null, sync_at: now,
      })
      const aisl = mapAislamiento(r.TipoDeAislamiento)
      if (aisl === '__desc__') pushIncon('aislamiento_desconocido', r, cama, `Tipo de aislamiento no contemplado: «${r.TipoDeAislamiento}».`)
      else if (aisl) aislamientos.push({ num_ingreso: numIngreso, tipo: aisl, vigente: true, sync_at: now })
    }
    // Dos pacientes en la misma ubicación: el mapa solo puede mostrar uno, así que se reporta.
    for (const arr of ocupantes.values()) {
      if (arr.length > 1) for (const o of arr) pushIncon('cama_duplicada', o.r, o.cama, `${arr.length} pacientes del censo quedan en «${o.etiqueta}»; el mapa solo muestra uno. Revisa la homologación.`)
    }
    const egresos = [...previos].filter((n) => !vistos.has(n as string))

    // ── 4) Escribir ──
    // Unidades: detecta nuevas (quedan sin piso hasta que el admin lo asigne) y cambios de nombre.
    const renombradas: string[] = []
    const filasUnidad = [...unidadesVistas].map(([id, nombre]) => {
      const prev = unidadMap.get(id)
      if (prev && norm(prev.nombre) !== norm(nombre)) renombradas.push(`${prev.nombre} → ${nombre}`)
      return { id_gomedisys: id, nombre, ultimo_visto: now }
    })
    if (filasUnidad.length) await admin.from('censo_unidades').upsert(filasUnidad, { onConflict: 'id_gomedisys' })

    // Homologación: las nuevas quedan guardadas (con ubicación si hubo coincidencia, o pendientes para el admin).
    if (nuevasHomol.size) await admin.from('homologacion_ubicaciones').upsert([...nuevasHomol.values()], { onConflict: 'censo_unidad,censo_area,censo_cama', ignoreDuplicates: true })
    for (const [id, ubicacion_id] of completarHomol) await admin.from('homologacion_ubicaciones').update({ ubicacion_id, origen: 'auto' }).eq('id', id)
    if (homolVistas.size) await admin.from('homologacion_ubicaciones').update({ ultimo_visto: now }).in('id', [...homolVistas])
    for (const [id, nombre] of unidadesVistas) await admin.from('homologacion_ubicaciones').update({ censo_unidad_id: id }).eq('censo_unidad', nombre).is('censo_unidad_id', null)

    if (pacientes.length) { const { error } = await admin.from('pacientes_ubicacion').upsert(pacientes, { onConflict: 'num_ingreso' }); if (error) throw new Error('upsert pacientes: ' + error.message) }
    if (egresos.length) await admin.from('pacientes_ubicacion').delete().in('num_ingreso', egresos as string[])
    await admin.from('aislamientos').delete().neq('num_ingreso', '__none__')
    if (aislamientos.length) { const { error } = await admin.from('aislamientos').insert(aislamientos); if (error) throw new Error('insert aislamientos: ' + error.message) }
    await admin.from('censo_inconsistencias').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (incons.length) { const { error } = await admin.from('censo_inconsistencias').insert(incons); if (error) throw new Error('insert inconsistencias: ' + error.message) }

    const autoN = [...nuevasHomol.values()].filter((h) => h.ubicacion_id).length + completarHomol.size
    const notas = [autoN ? `${autoN} auto-homologadas` : '', renombradas.length ? `Unidades renombradas: ${renombradas.join('; ')}` : ''].filter(Boolean).join(' · ')
    const resumen = { ok: true, total_censo: censo.length, pacientes_upsert: pacientes.length, altas: egresos.length, aislamientos: aislamientos.length, inconsistencias: incons.length, duracion_ms: Date.now() - t0, mensaje: notas ? `OK · ${notas}` : 'OK' }
    await admin.from('censo_sync_log').insert(resumen)
    return json({ ...resumen, auto_homologadas: autoN })
  } catch (e) {
    if (body?.action === 'verificar') return json({ ok: false, disponible: false, error: String(e) })
    await admin.from('censo_sync_log').insert({ ok: false, duracion_ms: Date.now() - t0, mensaje: String(e) })
    return json({ ok: false, error: String(e) }, 500)
  }
})
