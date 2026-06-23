import { useRef, useState } from 'react'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { Card, Btn } from './ui'
import { supabase } from '../lib/supabase'
import { importarEstructura, type FilaPiso, type FilaUbic, type ResultadoImport } from '../lib/data'

const BRAND = 'FF0D2D6B'
const siNo = (v: any) => String(v ?? '').trim().toUpperCase() !== 'NO'
const num = (v: any) => { const n = Number(v); return isNaN(n) ? 0 : n }

// Índice de columnas por encabezado (insensible a may/min y acentos básicos)
function colIndex(ws: ExcelJS.Worksheet): Record<string, number> {
  const idx: Record<string, number> = {}
  const header = ws.getRow(1)
  header.eachCell((cell, col) => { idx[String(cell.value ?? '').trim().toLowerCase()] = col })
  return idx
}

export default function ImportarEstructura({ onDone }: { onDone?: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [desactivar, setDesactivar] = useState(false)
  const [res, setRes] = useState<ResultadoImport | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function descargarPlantilla() {
    setErr(null)
    const { data: sedes } = await supabase.from('sedes').select('id,nombre').order('orden')
    const sedeName = Object.fromEntries((sedes ?? []).map((s: any) => [s.id, s.nombre]))
    const { data: pisos } = await supabase.from('pisos').select('*').order('orden')
    const pisoById = Object.fromEntries((pisos ?? []).map((p: any) => [p.id, p]))
    const { data: ubic } = await supabase.from('ubicaciones').select('*')
    ;(ubic ?? []).sort((a: any, b: any) => (pisoById[a.piso_id]?.orden ?? 0) - (pisoById[b.piso_id]?.orden ?? 0) || a.orden - b.orden)

    const wb = new ExcelJS.Workbook()
    const head = (ws: ExcelJS.Worksheet, n: number) => ws.getRow(1).eachCell((c, i) => { if (i <= n) { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } } } })

    const wsP = wb.addWorksheet('Pisos')
    wsP.columns = [{ header: 'Sede', width: 22 }, { header: 'Numero', width: 10 }, { header: 'Nombre', width: 34 }, { header: 'Orden', width: 10 }, { header: 'Activo', width: 10 }]
    head(wsP, 5)
    ;(pisos ?? []).forEach((p: any) => wsP.addRow([sedeName[p.sede_id], p.numero, p.nombre, p.orden, p.activo ? 'SI' : 'NO']))
    wsP.views = [{ state: 'frozen', ySplit: 1 }]

    const wsU = wb.addWorksheet('Ubicaciones')
    wsU.columns = [{ header: 'Sede', width: 22 }, { header: 'Piso', width: 34 }, { header: 'Area', width: 16 }, { header: 'Servicio', width: 26 }, { header: 'Tipo', width: 14 }, { header: 'Etiqueta', width: 18 }, { header: 'Cupo', width: 8 }, { header: 'Orden', width: 8 }, { header: 'Activo', width: 8 }]
    head(wsU, 9)
    ;(ubic ?? []).forEach((u: any) => { const p = pisoById[u.piso_id]; wsU.addRow([sedeName[p?.sede_id], p?.nombre, u.area ?? '', u.servicio ?? '', u.tipo, u.etiqueta, u.cupo_default, u.orden, u.activo ? 'SI' : 'NO']) })
    wsU.views = [{ state: 'frozen', ySplit: 1 }]

    const buf = await wb.xlsx.writeBuffer()
    saveAs(new Blob([buf]), 'Plantilla_Pisos_Ubicaciones.xlsx')
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setBusy(true); setRes(null); setErr(null)
    try {
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(await file.arrayBuffer())
      const wsP = wb.getWorksheet('Pisos'), wsU = wb.getWorksheet('Ubicaciones')
      if (!wsP || !wsU) throw new Error('El archivo debe tener las hojas "Pisos" y "Ubicaciones".')

      const ip = colIndex(wsP)
      const pisosRows: FilaPiso[] = []
      wsP.eachRow((row, n) => {
        if (n === 1) return
        const sede = String(row.getCell(ip['sede']).value ?? '').trim()
        const nombre = String(row.getCell(ip['nombre']).value ?? '').trim()
        if (!sede || !nombre) return
        pisosRows.push({ sede, numero: num(row.getCell(ip['numero']).value), nombre, orden: num(row.getCell(ip['orden']).value), activo: siNo(row.getCell(ip['activo']).value) })
      })

      const iu = colIndex(wsU)
      const ubicRows: FilaUbic[] = []
      wsU.eachRow((row, n) => {
        if (n === 1) return
        const sede = String(row.getCell(iu['sede']).value ?? '').trim()
        const piso = String(row.getCell(iu['piso']).value ?? '').trim()
        const etiqueta = String(row.getCell(iu['etiqueta']).value ?? '').trim()
        if (!sede || !piso || !etiqueta) return
        const area = String(row.getCell(iu['area']).value ?? '').trim()
        const servicio = iu['servicio'] ? String(row.getCell(iu['servicio']).value ?? '').trim() : ''
        ubicRows.push({ sede, piso, area: area || null, servicio: servicio || null, tipo: String(row.getCell(iu['tipo']).value ?? '').trim().toLowerCase(), etiqueta, cupo: num(row.getCell(iu['cupo']).value) || 1, orden: num(row.getCell(iu['orden']).value), activo: siNo(row.getCell(iu['activo']).value) })
      })

      const r = await importarEstructura(pisosRows, ubicRows, { desactivarFaltantes: desactivar })
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
      <div className="font-semibold text-brand mb-1">Importar / actualizar estructura por Excel</div>
      <p className="text-sm text-gray-500 mb-3">Descarga la plantilla con los datos actuales, corrígela y vuelve a cargarla. Se actualiza por clave natural (Pisos: sede + nombre · Ubicaciones: sede + piso + área + etiqueta).</p>
      <div className="flex flex-wrap items-center gap-3">
        <Btn variant="light" onClick={descargarPlantilla}>Descargar plantilla</Btn>
        <input ref={fileRef} type="file" accept=".xlsx" onChange={onFile} className="hidden" />
        <Btn onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? 'Importando…' : 'Importar Excel'}</Btn>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={desactivar} onChange={(e) => setDesactivar(e.target.checked)} />
          Desactivar los pisos/ubicaciones que no estén en el archivo
        </label>
      </div>
      {err && <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}
      {res && (
        <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Importación completada: {res.pisos} piso(s) y {res.ubicaciones} ubicación(es) procesadas.
          {res.pisosDesactivados + res.ubicDesactivadas > 0 && ` Desactivados: ${res.pisosDesactivados} piso(s), ${res.ubicDesactivadas} ubicación(es).`}
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
