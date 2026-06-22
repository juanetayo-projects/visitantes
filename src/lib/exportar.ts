import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'

;(pdfMake as any).vfs = (pdfFonts as any).vfs ?? (pdfFonts as any).pdfMake?.vfs

export interface Columna<T> { header: string; get: (row: T) => string | number }

export interface ExportMeta {
  sede?: string        // sede consultada (o "Todas las sedes")
  filtros?: string     // descripción legible de los filtros aplicados
}

const fechaCO = () => {
  const co = new Date(Date.now() - 5 * 3_600_000)
  return co.toISOString().replace('T', ' ').substring(0, 16) + ' (GMT-5)'
}

// Carga el logo de la clínica como dataURL (cacheado) para incrustarlo en los archivos.
let _logoCache: string | null | undefined
async function loadLogoDataUrl(): Promise<string | null> {
  if (_logoCache !== undefined) return _logoCache
  try {
    const url = `${import.meta.env.BASE_URL}images/logo_cacsb2.png`
    const res = await fetch(url)
    const blob = await res.blob()
    _logoCache = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result))
      fr.onerror = reject
      fr.readAsDataURL(blob)
    })
  } catch {
    _logoCache = null
  }
  return _logoCache
}

export async function exportarExcel<T>(titulo: string, columnas: Columna<T>[], filas: T[], meta: ExportMeta = {}) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Datos')
  const nCols = columnas.length

  // Logo (anclado arriba a la izquierda)
  const logo = await loadLogoDataUrl()
  if (logo) {
    const imgId = wb.addImage({ base64: logo, extension: 'png' })
    ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: 150, height: 46 } })
  }

  const cInicio = nCols > 2 ? 3 : 1   // si hay columnas suficientes, el texto va a la derecha del logo
  const colLetra = (n: number) => ws.getColumn(n).letter
  const merge = (fila: number, txt: string, opts: Partial<ExcelJS.Font> = {}) => {
    ws.mergeCells(`${colLetra(cInicio)}${fila}:${colLetra(Math.max(cInicio, nCols))}${fila}`)
    const cell = ws.getCell(`${colLetra(cInicio)}${fila}`)
    cell.value = txt
    cell.font = { name: 'Segoe UI', ...opts }
  }
  merge(1, `Clínica Santa Bárbara — ${titulo}`, { bold: true, size: 14, color: { argb: 'FF0D2D6B' } })
  merge(2, `Sede: ${meta.sede ?? 'Todas las sedes'}`, { size: 10, color: { argb: 'FF555555' } })
  merge(3, `Filtros: ${meta.filtros && meta.filtros.trim() ? meta.filtros : 'Sin filtros (todos los registros)'}`, { size: 10, color: { argb: 'FF555555' } })
  merge(4, `Generado: ${fechaCO()} · ${filas.length} registro(s)`, { size: 9, color: { argb: 'FF888888' } })

  // Encabezado de tabla en la fila 6
  const HEADER_ROW = 6
  const hr = ws.getRow(HEADER_ROW)
  columnas.forEach((c, i) => {
    const cell = hr.getCell(i + 1)
    cell.value = c.header
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D2D6B' } }
    cell.alignment = { vertical: 'middle' }
  })
  hr.commit?.()

  // Datos
  filas.forEach((f) => {
    const row = ws.addRow(columnas.map((c) => c.get(f)))
    row.eachCell((cell) => { cell.alignment = { vertical: 'middle' } })
  })

  // Anchos y autofiltro
  columnas.forEach((c, i) => { ws.getColumn(i + 1).width = Math.max(14, c.header.length + 4) })
  ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW, column: nCols } }
  ws.views = [{ state: 'frozen', ySplit: HEADER_ROW }]

  const buf = await wb.xlsx.writeBuffer()
  saveAs(new Blob([buf]), `${titulo}.xlsx`)
}

export async function exportarPDF<T>(titulo: string, columnas: Columna<T>[], filas: T[], meta: ExportMeta = {}) {
  const logo = await loadLogoDataUrl()
  const body = [
    columnas.map((c) => ({ text: c.header, bold: true, color: 'white', fillColor: '#0D2D6B' })),
    ...filas.map((f) => columnas.map((c) => String(c.get(f)))),
  ]

  const encabezado: any = {
    columns: [
      logo ? { image: logo, width: 120, margin: [0, 0, 0, 0] } : { text: '', width: 120 },
      {
        width: '*',
        stack: [
          { text: 'Clínica de Alta Complejidad Santa Bárbara', color: '#16468E', fontSize: 10, alignment: 'right' },
          { text: titulo, style: 'h', color: '#0D2D6B', alignment: 'right' },
        ],
      },
    ],
    margin: [0, 0, 0, 6],
  }

  const doc: any = {
    pageOrientation: 'landscape',
    pageMargins: [28, 28, 28, 28],
    content: [
      encabezado,
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 780, y2: 0, lineWidth: 1, lineColor: '#0D2D6B' }], margin: [0, 0, 0, 6] },
      { text: `Sede: ${meta.sede ?? 'Todas las sedes'}`, fontSize: 9, color: '#444' },
      { text: `Filtros: ${meta.filtros && meta.filtros.trim() ? meta.filtros : 'Sin filtros (todos los registros)'}`, fontSize: 9, color: '#444' },
      { text: `Generado: ${fechaCO()} · ${filas.length} registro(s)`, fontSize: 8, color: '#888', margin: [0, 0, 0, 8] },
      { table: { headerRows: 1, widths: columnas.map(() => 'auto'), body }, layout: { fillColor: (r: number) => (r % 2 === 0 ? null : '#F4F6FB') } },
    ],
    styles: { h: { fontSize: 16, bold: true } },
    defaultStyle: { fontSize: 8 },
  }
  pdfMake.createPdf(doc).download(`${titulo}.pdf`)
}
