import { useRef, useState } from 'react'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { Card, Btn } from './ui'
import { supabase } from '../lib/supabase'
import { importarResponsables, type FilaResponsable, type ResultadoImportResp } from '../lib/data'

const BRAND = 'FF0D2D6B'
const siNo = (v: any) => String(v ?? '').trim().toUpperCase() !== 'NO'

function colIndex(ws: ExcelJS.Worksheet): Record<string, number> {
  const idx: Record<string, number> = {}
  ws.getRow(1).eachCell((cell, col) => { idx[String(cell.value ?? '').trim().toLowerCase()] = col })
  return idx
}
const val = (cell: ExcelJS.Cell) => {
  const v: any = cell.value
  if (v && typeof v === 'object' && 'text' in v) return String(v.text).trim()      // hipervínculos / rich text
  if (v && typeof v === 'object' && 'result' in v) return String(v.result).trim()  // fórmulas
  return String(v ?? '').trim()
}

export default function ImportarResponsables({ onDone }: { onDone?: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<ResultadoImportResp | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function descargarPlantilla() {
    setErr(null)
    const [{ data: serv }, { data: carg }, { data: resp }] = await Promise.all([
      supabase.from('servicios').select('id, nombre').eq('activo', true).order('nombre'),
      supabase.from('cargos').select('id, nombre').eq('activo', true).order('nombre'),
      supabase.from('responsables').select('*').order('nombre_completo'),
    ])
    const servName = Object.fromEntries((serv ?? []).map((s: any) => [s.id, s.nombre]))
    const cargName = Object.fromEntries((carg ?? []).map((c: any) => [c.id, c.nombre]))

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Responsables')
    ws.columns = [
      { header: 'Nombre', width: 32 }, { header: 'Documento', width: 16 }, { header: 'Servicio', width: 24 },
      { header: 'Cargo', width: 24 }, { header: 'Telefono', width: 16 }, { header: 'Email', width: 28 }, { header: 'Activo', width: 10 },
    ]
    ws.getRow(1).eachCell((c, i) => { if (i <= 7) { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } } } })
    ;(resp ?? []).forEach((r: any) => ws.addRow([r.nombre_completo, r.numero_documento, servName[r.servicio_id] ?? '', cargName[r.cargo_id] ?? '', r.telefono ?? '', r.email ?? '', r.activo ? 'SI' : 'NO']))
    if (!(resp ?? []).length) ws.addRow(['Juan Pérez García', '1098765432', serv?.[0]?.nombre ?? '', carg?.[0]?.nombre ?? '', '3001234567', 'correo@dominio.com', 'SI'])
    ws.views = [{ state: 'frozen', ySplit: 1 }]

    // Hoja de referencia con los catálogos válidos
    const wsR = wb.addWorksheet('Catálogos')
    wsR.columns = [{ header: 'Servicios válidos', width: 28 }, { header: 'Cargos válidos', width: 28 }]
    wsR.getRow(1).eachCell((c) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } } })
    const maxN = Math.max(serv?.length ?? 0, carg?.length ?? 0)
    for (let i = 0; i < maxN; i++) wsR.addRow([serv?.[i]?.nombre ?? '', carg?.[i]?.nombre ?? ''])

    saveAs(new Blob([await wb.xlsx.writeBuffer()]), 'Plantilla_Responsables.xlsx')
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setBusy(true); setRes(null); setErr(null)
    try {
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(await file.arrayBuffer())
      const ws = wb.getWorksheet('Responsables') ?? wb.worksheets[0]
      if (!ws) throw new Error('El archivo no tiene datos.')
      const ix = colIndex(ws)
      if (ix['nombre'] == null || ix['documento'] == null) throw new Error('La hoja debe tener al menos las columnas "Nombre" y "Documento".')
      const rows: FilaResponsable[] = []
      ws.eachRow((row, n) => {
        if (n === 1) return
        const nombre_completo = val(row.getCell(ix['nombre']))
        const numero_documento = val(row.getCell(ix['documento']))
        if (!nombre_completo || !numero_documento) return
        rows.push({
          nombre_completo, numero_documento,
          servicio: ix['servicio'] ? val(row.getCell(ix['servicio'])) || null : null,
          cargo: ix['cargo'] ? val(row.getCell(ix['cargo'])) || null : null,
          telefono: ix['telefono'] ? val(row.getCell(ix['telefono'])) || null : null,
          email: ix['email'] ? val(row.getCell(ix['email'])) || null : null,
          activo: ix['activo'] ? siNo(val(row.getCell(ix['activo']))) : true,
        })
      })
      if (!rows.length) throw new Error('No se encontraron filas con Nombre y Documento.')
      const r = await importarResponsables(rows)
      setRes(r)
      onDone?.()
    } catch (e: any) {
      setErr(e.message ?? String(e))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Card className="p-5">
      <div className="font-semibold text-brand mb-1">Importar / actualizar responsables por Excel</div>
      <p className="text-sm text-gray-500 mb-3">Descarga la plantilla (incluye los responsables actuales y la hoja «Catálogos» con los servicios y cargos válidos), complétala y vuelve a cargarla. Se actualiza por número de documento.</p>
      <div className="flex flex-wrap items-center gap-3">
        <Btn variant="light" onClick={descargarPlantilla}>Descargar plantilla</Btn>
        <input ref={fileRef} type="file" accept=".xlsx" onChange={onFile} className="hidden" />
        <Btn onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? 'Importando…' : 'Importar Excel'}</Btn>
      </div>
      {err && <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}
      {res && (
        <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Importación completada: {res.creados} creado(s), {res.actualizados} actualizado(s).
          {res.errores.length > 0 && (
            <div className="mt-1 text-amber-700">
              <div className="font-medium">Avisos ({res.errores.length}):</div>
              <ul className="list-disc pl-5">{res.errores.slice(0, 8).map((x, i) => <li key={i}>{x}</li>)}</ul>
              {res.errores.length > 8 && <div>… y {res.errores.length - 8} más.</div>}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
