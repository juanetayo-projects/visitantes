// Prueba de conexión a la API del Censo Hospitalario.
// Lee credenciales de .env.local y NO imprime usuario/contraseña ni PII de pacientes:
// solo estado HTTP, conteo y estructura de campos (para diseñar el sync/homologación).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv() {
  const txt = readFileSync(join(__dirname, '..', '.env.local'), 'utf8')
  const env = {}
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

// Enmascara cualquier valor que pueda ser PII para mostrar solo la "forma" del dato.
function mask(v) {
  if (v == null) return v
  if (typeof v === 'number') return '«num»'
  if (typeof v === 'boolean') return v
  const s = String(v)
  if (!s) return ''
  return `«${typeof v}:${s.length}c»`
}

const env = loadEnv()
const base = (env.CENSO_API_BASE_URL || 'https://censo-hospitalario.cacsb.net').replace(/\/$/, '')

console.log('Base URL:', base)
console.log('Usuario presente:', !!env.CENSO_API_USER, '· Password presente:', !!env.CENSO_API_PASSWORD)

// ── Paso 1: login ──
const loginRes = await fetch(`${base}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({ user_name: env.CENSO_API_USER, password: env.CENSO_API_PASSWORD }),
})
console.log('\n[Login] HTTP', loginRes.status, loginRes.statusText)
let loginJson
try { loginJson = await loginRes.json() } catch { console.log('[Login] respuesta no-JSON'); process.exit(1) }
console.log('[Login] success:', loginJson.success, '· token recibido:', !!loginJson.access_token,
  '· longitud token:', loginJson.access_token ? loginJson.access_token.length : 0)
if (!loginJson.access_token) { console.log('[Login] mensaje:', loginJson.message); process.exit(1) }
const token = loginJson.access_token

// ── Paso 2: censo ──
const censoRes = await fetch(`${base}/api/external/censo`, {
  headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
})
console.log('\n[Censo] HTTP', censoRes.status, censoRes.statusText)
let censo
try { censo = await censoRes.json() } catch { console.log('[Censo] respuesta no-JSON'); process.exit(1) }

// Detectar dónde está el arreglo de registros
const arr = Array.isArray(censo) ? censo
  : Array.isArray(censo?.data) ? censo.data
  : Array.isArray(censo?.censo) ? censo.censo
  : null
console.log('[Censo] tipo respuesta:', Array.isArray(censo) ? 'array' : 'objeto, claves: ' + Object.keys(censo || {}).join(', '))
if (!arr) { console.log('[Censo] no se encontró arreglo de registros'); process.exit(0) }
console.log('[Censo] total registros:', arr.length)

if (arr.length) {
  const campos = Object.keys(arr[0])
  console.log('\n[Estructura] campos del registro:\n', campos.join(', '))
  console.log('\n[Muestra enmascarada del primer registro]:')
  console.log(JSON.stringify(Object.fromEntries(campos.map((k) => [k, mask(arr[0][k])])), null, 2))

  // Valores estructurales (NO-PII) útiles para la homologación
  const structCampos = campos.filter((k) => /ubicac|servicio|area|cama|piso|estado|aislam|sexo|tipo|unidad/i.test(k))
  for (const k of structCampos) {
    const vals = [...new Set(arr.map((r) => r[k]).filter((v) => v != null && v !== ''))]
    if (vals.length <= 40) console.log(`\n[Distintos] ${k} (${vals.length}):`, vals.sort())
    else console.log(`\n[Distintos] ${k}: ${vals.length} valores (demasiados para listar)`)
  }
}
