// Genera una plantilla Excel con la estructura actual de Pisos y Ubicaciones
// para corregir y reimportar. Lee los datos reales desde Supabase (autenticado).
import { createClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'
import fs from 'fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/).filter((l) => l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
const { error: authErr } = await supabase.auth.signInWithPassword({
  email: 'juan.etayo@cacsantabarbara.co', password: 'admin123*',
})
if (authErr) { console.error('Auth:', authErr.message); process.exit(1) }

const { data: sedes } = await supabase.from('sedes').select('id,nombre,orden').order('orden')
const sedeName = Object.fromEntries(sedes.map((s) => [s.id, s.nombre]))
const { data: pisos } = await supabase.from('pisos').select('*').order('orden')
const pisoById = Object.fromEntries(pisos.map((p) => [p.id, p]))
const { data: ubic } = await supabase.from('ubicaciones').select('*')
ubic.sort((a, b) => {
  const pa = pisoById[a.piso_id]?.orden ?? 0, pb = pisoById[b.piso_id]?.orden ?? 0
  return pa - pb || (a.orden - b.orden)
})

const BRAND = 'FF0D2D6B'
const wb = new ExcelJS.Workbook()
wb.creator = 'Control de Visitantes — Clínica Santa Bárbara'

const styleHeader = (row, n) => {
  for (let i = 1; i <= n; i++) {
    const c = row.getCell(i)
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } }
    c.alignment = { vertical: 'middle' }
  }
}

// ── Instrucciones ──────────────────────────────────────────
const ins = wb.addWorksheet('Instrucciones')
ins.columns = [{ width: 110 }]
const lineas = [
  'PLANTILLA DE PISOS Y UBICACIONES — Control de Visitantes (Clínica Santa Bárbara)',
  '',
  'Cómo usarla:',
  '1) Edita las hojas "Pisos" y "Ubicaciones" con los datos correctos. Ya vienen precargadas con la estructura actual.',
  '2) No cambies los nombres de las columnas (la primera fila) ni el orden de las hojas.',
  '3) Puedes agregar filas nuevas, corregir o eliminar las que no apliquen.',
  '4) Guarda el archivo y reimpórtalo en la app: Administración → Sedes y ubicaciones → "Importar Excel".',
  '',
  'Reglas de las columnas:',
  '• Sede: debe coincidir EXACTAMENTE con una sede existente (' + sedes.map((s) => s.nombre).join(' / ') + ').',
  '• Pisos.Nombre: nombre único del piso dentro de la sede (ej. "Piso 7 Hospitalización").',
  '• Ubicaciones.Piso: debe coincidir EXACTAMENTE con un "Nombre" de la hoja Pisos.',
  '• Ubicaciones.Tipo: uno de: habitacion, cubiculo, sillon, cama, camilla, area.',
  '• Ubicaciones.Area: opcional (agrupador, ej. "Observación-1", "UCI"). Déjala vacía si no aplica.',
  '• Cupo: número de visitantes permitidos (ej. 2 hospitalización, 1 UCI/Urgencias).',
  '• Orden: número para ordenar la presentación (menor primero).',
  '• Activo: SI / NO.',
  '',
  'La importación ACTUALIZA por clave natural: Pisos por (Sede + Nombre), Ubicaciones por (Sede + Piso + Etiqueta).',
]
lineas.forEach((t, i) => {
  const r = ins.addRow([t])
  if (i === 0) r.getCell(1).font = { bold: true, size: 13, color: { argb: BRAND } }
  else if (t.endsWith(':')) r.getCell(1).font = { bold: true }
})

// ── Pisos ──────────────────────────────────────────────────
const wsP = wb.addWorksheet('Pisos')
wsP.columns = [
  { header: 'Sede', key: 'sede', width: 22 },
  { header: 'Numero', key: 'numero', width: 10 },
  { header: 'Nombre', key: 'nombre', width: 34 },
  { header: 'Orden', key: 'orden', width: 10 },
  { header: 'Activo', key: 'activo', width: 10 },
]
styleHeader(wsP.getRow(1), 5)
pisos.forEach((p) => wsP.addRow({
  sede: sedeName[p.sede_id], numero: p.numero, nombre: p.nombre, orden: p.orden, activo: p.activo ? 'SI' : 'NO',
}))
wsP.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 5 } }
wsP.views = [{ state: 'frozen', ySplit: 1 }]

// ── Ubicaciones ────────────────────────────────────────────
const wsU = wb.addWorksheet('Ubicaciones')
wsU.columns = [
  { header: 'Sede', key: 'sede', width: 22 },
  { header: 'Piso', key: 'piso', width: 34 },
  { header: 'Area', key: 'area', width: 18 },
  { header: 'Tipo', key: 'tipo', width: 14 },
  { header: 'Etiqueta', key: 'etiqueta', width: 18 },
  { header: 'Cupo', key: 'cupo', width: 8 },
  { header: 'Orden', key: 'orden', width: 8 },
  { header: 'Activo', key: 'activo', width: 8 },
]
styleHeader(wsU.getRow(1), 8)
ubic.forEach((u) => {
  const p = pisoById[u.piso_id]
  wsU.addRow({
    sede: sedeName[p?.sede_id], piso: p?.nombre, area: u.area ?? '', tipo: u.tipo,
    etiqueta: u.etiqueta, cupo: u.cupo_default, orden: u.orden, activo: u.activo ? 'SI' : 'NO',
  })
})
wsU.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 8 } }
wsU.views = [{ state: 'frozen', ySplit: 1 }]

// Validaciones (listas desplegables)
const tipoList = '"habitacion,cubiculo,sillon,cama,camilla,area"'
const siNo = '"SI,NO"'
for (let r = 2; r <= ubic.length + 200; r++) {
  wsU.getCell(`D${r}`).dataValidation = { type: 'list', allowBlank: false, formulae: [tipoList] }
  wsU.getCell(`H${r}`).dataValidation = { type: 'list', allowBlank: false, formulae: [siNo] }
}
for (let r = 2; r <= pisos.length + 100; r++) {
  wsP.getCell(`E${r}`).dataValidation = { type: 'list', allowBlank: false, formulae: [siNo] }
}

const out = new URL('../docs/Plantilla_Pisos_Ubicaciones.xlsx', import.meta.url)
await wb.xlsx.writeFile(out)
console.log(`OK → ${out.pathname}`)
console.log(`Pisos: ${pisos.length} · Ubicaciones: ${ubic.length}`)
