import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'

;(pdfMake as any).vfs = (pdfFonts as any).vfs ?? (pdfFonts as any).pdfMake?.vfs

export interface Columna<T> { header: string; get: (row: T) => string | number }

export async function exportarExcel<T>(nombre: string, columnas: Columna<T>[], filas: T[]) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Datos')
  ws.columns = columnas.map((c) => ({ header: c.header, key: c.header, width: Math.max(14, c.header.length + 4) }))
  ws.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D2D6B' } }
    cell.alignment = { vertical: 'middle' }
  })
  filas.forEach((f) => ws.addRow(columnas.map((c) => c.get(f))))
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } }
  const buf = await wb.xlsx.writeBuffer()
  saveAs(new Blob([buf]), `${nombre}.xlsx`)
}

export function exportarPDF<T>(titulo: string, columnas: Columna<T>[], filas: T[]) {
  const body = [
    columnas.map((c) => ({ text: c.header, bold: true, color: 'white', fillColor: '#0D2D6B' })),
    ...filas.map((f) => columnas.map((c) => String(c.get(f)))),
  ]
  const doc: any = {
    pageOrientation: 'landscape',
    content: [
      { text: titulo, style: 'h', color: '#0D2D6B' },
      { text: `Generado: ${new Date().toLocaleString('es-CO')} · Clínica Santa Bárbara`, fontSize: 8, color: '#666', margin: [0, 0, 0, 8] },
      { table: { headerRows: 1, widths: columnas.map(() => 'auto'), body }, layout: { fillColor: (r: number) => (r % 2 === 0 ? null : '#F4F6FB') } },
    ],
    styles: { h: { fontSize: 16, bold: true, margin: [0, 0, 0, 2] } },
    defaultStyle: { fontSize: 8 },
  }
  pdfMake.createPdf(doc).download(`${titulo}.pdf`)
}
