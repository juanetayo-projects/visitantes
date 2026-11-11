import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icono } from './InicioWidgets'
import { erroresHomologacion, TIPOS_ERROR_HOMOLOGACION, type CensoInconsistencia } from '../lib/data'
import { ICONOS } from '../lib/iconos'

const VISIBLES = 4

// Card del inicio: avisa si la última sincronización del censo dejó errores de homologación
// (pacientes que no se pueden ubicar bien en el mapa). El administrador va directo a corregirlos;
// los demás roles copian un reporte para enviárselo.
export default function ErroresHomologacion({ esAdmin }: { esAdmin: boolean }) {
  const [rows, setRows] = useState<CensoInconsistencia[] | null>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    let vivo = true
    const cargar = () => { erroresHomologacion().then((r) => { if (vivo) setRows(r) }).catch(() => {}) }
    cargar()
    const t = window.setInterval(cargar, 60_000)
    return () => { vivo = false; window.clearInterval(t) }
  }, [])

  const porTipo = useMemo(() => {
    const m = new Map<string, number>()
    rows?.forEach((r) => m.set(r.tipo, (m.get(r.tipo) ?? 0) + 1))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [rows])

  if (rows == null) return null

  if (rows.length === 0) {
    return (
      <section aria-label="Homologación del censo" className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-neu-sm">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600"><Icono d={ICONOS.check} className="h-4 w-4" /></span>
        <p className="text-sm text-gray-700"><b className="text-emerald-700">Homologación del censo al día.</b> Todos los pacientes con cama quedaron ubicados en el mapa.</p>
      </section>
    )
  }

  const lugar = (r: CensoInconsistencia) => [r.censo_unidad, r.censo_area, r.censo_cama].filter(Boolean).join(' / ')

  async function copiarReporte() {
    const lineas = [
      `Errores de homologación del censo (${rows!.length}):`,
      ...rows!.map((r) => `- ${TIPOS_ERROR_HOMOLOGACION[r.tipo] ?? r.tipo}: ${lugar(r) || 'sin ubicación'}${r.num_ingreso ? ` · ingreso #${r.num_ingreso}` : ''}`),
    ]
    try {
      await navigator.clipboard.writeText(lineas.join('\n'))
      setCopiado(true); window.setTimeout(() => setCopiado(false), 2500)
    } catch { /* sin permiso de portapapeles: el usuario aún puede abrir el detalle */ }
  }

  return (
    <section aria-label="Errores de homologación del censo" className="rounded-2xl bg-white p-4 shadow-neu-sm ring-1 ring-rose-200">
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-rose-50 text-rose-600"><Icono d={ICONOS.alerta} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-gray-900">
            <span className="mr-1.5 text-2xl font-bold tabular-nums text-rose-600 align-middle">{rows.length}</span>
            {rows.length === 1 ? 'error de homologación del censo' : 'errores de homologación del censo'}
          </h2>
          <p className="mt-0.5 text-xs text-gray-600">
            {esAdmin
              ? 'Estos pacientes no se ubican correctamente en el mapa. Corrígelos en Homologación CENSO o en Sedes y ubicaciones.'
              : 'Estos pacientes no se ubican correctamente en el mapa. Reporta al administrador para que los corrija.'}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {porTipo.map(([t, n]) => (
              <span key={t} className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700">{TIPOS_ERROR_HOMOLOGACION[t] ?? t} · {n}</span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {esAdmin ? (
            <>
              <Link to="/admin/homologacion" className="rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white shadow-neu-xs transition hover:bg-brand-light">Corregir homologación</Link>
              <Link to="/admin/sync-censo" className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-brand shadow-neu-xs transition hover:bg-brand-50">Ver detalle</Link>
            </>
          ) : (
            <>
              <button onClick={copiarReporte} className="rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white shadow-neu-xs transition hover:bg-brand-light">{copiado ? '✓ Reporte copiado' : 'Copiar reporte'}</button>
              <Link to="/inconsistencias-censo" className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-brand shadow-neu-xs transition hover:bg-brand-50">Ver detalle</Link>
            </>
          )}
        </div>
      </div>
      <ul className="mt-3 divide-y divide-gray-100 rounded-xl bg-neu-inset/40 text-sm">
        {rows.slice(0, VISIBLES).map((r) => (
          <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-2">
            <span className="min-w-0 text-gray-800">{lugar(r) || 'Sin ubicación'}{r.num_ingreso && <span className="ml-1.5 text-xs text-gray-500">#{r.num_ingreso}</span>}</span>
            <span className="text-xs font-medium text-rose-700">{TIPOS_ERROR_HOMOLOGACION[r.tipo] ?? r.tipo}</span>
          </li>
        ))}
        {rows.length > VISIBLES && <li className="px-3 py-2 text-xs text-gray-500">y {rows.length - VISIBLES} más…</li>}
      </ul>
    </section>
  )
}
