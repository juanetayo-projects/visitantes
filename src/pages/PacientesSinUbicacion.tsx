import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, ContadorCircular, ConLateral, PanelIndicadores, ICONOS_IND, FilterBar, Card, Badge, Btn, selectCls, inputCls } from '../components/ui'
import EstadoSyncCenso from '../components/EstadoSyncCenso'
import { useAuth } from '../auth/AuthProvider'
import { pacientesSinUbicacion, type PacienteSinUbicacion } from '../lib/data'
import { exportarExcel, type Columna } from '../lib/exportar'
import { AISLAMIENTO_LABEL } from '../lib/types'

// Por qué la app no puede mostrar al paciente en el mapa.
const MOTIVO: Record<string, { label: string; hint: string; color: 'amber' | 'red' }> = {
  sin_cama: { label: 'Sin cama asignada', hint: 'Sala de espera, recuperación, observación…', color: 'amber' },
  ubicacion_no_homologada: { label: 'Cama sin homologar', hint: 'El administrador debe homologarla', color: 'red' },
  unidad_desconocida: { label: 'Unidad sin piso', hint: 'El administrador debe asignarle piso', color: 'red' },
  ubicacion_inactiva: { label: 'Ubicación inactiva', hint: 'Revisar el catálogo de ubicaciones', color: 'red' },
  piso_incoherente: { label: 'Homologada a otro piso', hint: 'Revisar la homologación', color: 'red' },
}
const motivo = (m: string) => MOTIVO[m] ?? { label: m, hint: '', color: 'amber' as const }

const COLS: Columna<PacienteSinUbicacion>[] = [
  { header: 'Paciente', get: (r) => r.paciente ?? '' },
  { header: 'Identificación', get: (r) => r.documento ?? '' },
  { header: 'Edad', get: (r) => r.edad ?? '' },
  { header: 'Unidad CENSO', get: (r) => r.unidad ?? '' },
  { header: 'Área', get: (r) => r.area ?? '' },
  { header: 'Motivo', get: (r) => motivo(r.motivo).label },
  { header: 'Acompañantes dentro', get: (r) => r.acompanantes },
  { header: '# Ingreso', get: (r) => r.num_ingreso },
]

export default function PacientesSinUbicacion() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const puedeRegistrar = perfil?.rol === 'admin' || perfil?.rol === 'orientador'
  const [rows, setRows] = useState<PacienteSinUbicacion[]>([])
  const [loading, setLoading] = useState(true)
  const [f, setF] = useState({ motivo: '', unidad: '', texto: '' })

  useEffect(() => {
    function cargar() { pacientesSinUbicacion().then((r) => { setRows(r); setLoading(false) }) }
    cargar()
    const t = setInterval(cargar, 60_000) // el censo se sincroniza cada 15 min; refresco liviano
    return () => clearInterval(t)
  }, [])

  const unidades = useMemo(() => [...new Set(rows.map((r) => r.unidad).filter(Boolean))].sort() as string[], [rows])
  const porMotivo = useMemo(() => {
    const m = new Map<string, number>()
    rows.forEach((r) => m.set(r.motivo, (m.get(r.motivo) ?? 0) + 1))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [rows])
  const filtrados = useMemo(() => {
    const t = f.texto.trim().toLowerCase()
    return rows.filter((r) => (!f.motivo || r.motivo === f.motivo) && (!f.unidad || r.unidad === f.unidad) &&
      (!t || [r.paciente, r.documento, r.num_ingreso, r.area].some((x) => x?.toLowerCase().includes(t))))
  }, [rows, f])
  const sinAcomp = filtrados.filter((r) => r.acompanantes === 0).length

  function registrar(r: PacienteSinUbicacion) {
    navigate(`/registrar?doc=${encodeURIComponent(r.documento ?? r.num_ingreso)}`)
  }

  return (
    <div>
      <PageHeader title="Pacientes sin ubicación" subtitle="Pacientes del CENSO que no aparecen en el mapa. Si no encuentras al paciente al registrar una visita, búscalo aquí."
        contador={<ContadorCircular valor={loading ? '…' : filtrados.length} etiqueta={filtrados.length === 1 ? 'paciente' : 'pacientes'} de={filtrados.length !== rows.length ? rows.length : undefined} />}
        action={<Btn variant="light" onClick={() => exportarExcel('Pacientes sin ubicación', COLS, filtrados)} disabled={!filtrados.length}>Excel</Btn>} />
      <EstadoSyncCenso soloSiDesactualizado />

      <ConLateral lateral={<>
        <PanelIndicadores titulo="Por motivo" items={porMotivo.map(([m, n]) => ({
          label: motivo(m).label, hint: motivo(m).hint, value: n, icono: m === 'sin_cama' ? ICONOS_IND.cama : ICONOS_IND.alerta, color: motivo(m).color,
          activo: f.motivo === m, onClick: () => setF({ ...f, motivo: f.motivo === m ? '' : m }),
        }))}>
          {!loading && rows.length === 0 && <p className="text-sm text-emerald-600">✓ Todos los pacientes del censo están ubicados en el mapa.</p>}
        </PanelIndicadores>
        <PanelIndicadores titulo="Acompañamiento" items={[
          { label: 'Sin acompañante', value: sinAcomp, icono: ICONOS_IND.personas, color: sinAcomp ? 'amber' : 'green' },
          { label: 'Con acompañante dentro', value: filtrados.length - sinAcomp, icono: ICONOS_IND.atendido, color: 'green' },
        ]} />
        <FilterBar vertical onClear={() => setF({ motivo: '', unidad: '', texto: '' })}>
          <input aria-label="Buscar por nombre, identificación, # ingreso" className={inputCls} placeholder="Nombre, identificación, # ingreso…" value={f.texto} onChange={(e) => setF({ ...f, texto: e.target.value })} autoFocus />
          <select className={selectCls} value={f.unidad} onChange={(e) => setF({ ...f, unidad: e.target.value })}>
            <option value="">Todas las unidades</option>
            {unidades.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <select className={selectCls} value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })}>
            <option value="">Todos los motivos</option>
            {porMotivo.map(([m]) => <option key={m} value={m}>{motivo(m).label}</option>)}
          </select>
        </FilterBar>
      </>}>
        <Card hover={false} className="overflow-hidden">
          <div className="tabla-scroll">
            <table className="w-full text-sm">
              <thead className="bg-brand text-white"><tr>
                {['Paciente', 'Edad', 'Unidad / área CENSO', 'Motivo', 'Acompañantes', '# Ingreso'].map((h) => <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>)}
                {puedeRegistrar && <th className="sticky right-0 bg-brand px-3 py-2.5" />}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? <tr><td colSpan={7} className="py-10 text-center text-gray-400">Cargando…</td></tr>
                  : filtrados.length === 0 ? <tr><td colSpan={7} className="py-10 text-center text-gray-400">{rows.length ? 'Sin resultados — ajusta la búsqueda o los filtros' : '✓ No hay pacientes sin ubicación.'}</td></tr>
                  : filtrados.map((r) => (
                    <tr key={r.num_ingreso} className="group hover:bg-brand-50/40">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5 font-medium text-gray-800">
                          {r.paciente ?? '—'}
                          {r.aislamiento && <Badge color="red">Aislamiento {AISLAMIENTO_LABEL[r.aislamiento]}</Badge>}
                        </div>
                        <div className="text-xs text-gray-500">ID {r.documento ?? '—'}</div>
                      </td>
                      <td className="px-3 py-2 text-gray-600">{r.edad ?? '—'}</td>
                      <td className="px-3 py-2">
                        <div className="text-gray-700">{r.unidad ?? '—'}</div>
                        {(r.area || r.cama) && <div className="text-xs text-gray-500">{[r.area, r.cama].filter(Boolean).join(' · ')}</div>}
                      </td>
                      <td className="px-3 py-2"><Badge color={motivo(r.motivo).color}><span className="whitespace-nowrap">{motivo(r.motivo).label}</span></Badge></td>
                      <td className="px-3 py-2">
                        {r.acompanantes
                          ? <span className="font-medium text-emerald-700">{r.acompanantes} dentro</span>
                          : <span className="text-gray-400">Ninguno</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-600">{r.num_ingreso}</td>
                      {puedeRegistrar && (
                        <td className="sticky right-0 bg-white px-3 py-2 text-right group-hover:bg-brand-50">
                          <Btn onClick={() => registrar(r)} className="whitespace-nowrap">Registrar visita →</Btn>
                        </td>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      </ConLateral>
    </div>
  )
}
