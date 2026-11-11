import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { PageHeader, useDebounced, AvisoLimite, ContadorCircular, ConLateral, PanelIndicadores, Card, FilterBar, selectCls, Btn, Badge, FilasEstado } from '../components/ui'
import { LIMITE_VISITAS, listVisitas, listSedes, describirFiltros, type VisitaListado, type FiltrosVisita } from '../lib/data'
import { exportarExcel, exportarPDF, type Columna } from '../lib/exportar'
import type { Sede } from '../lib/types'
import { ICONOS_IND } from '../lib/iconos'

function horaCO(iso: string) { return new Date(new Date(iso).getTime() - 5 * 3_600_000).toISOString().replace('T', ' ').substring(0, 16) }

const COLS: Columna<VisitaListado>[] = [
  { header: 'Fecha/hora ingreso', get: (r) => horaCO(r.created_at) },
  { header: 'Fecha/hora salida', get: (r) => (r.salida_at ? horaCO(r.salida_at) : '') },
  { header: 'Visitante', get: (r) => r.visitante?.nombres_completos ?? '' },
  { header: 'Cédula', get: (r) => r.visitante?.cedula ?? '' },
  { header: 'Celular', get: (r) => r.visitante?.celular ?? '' },
  { header: 'Acompañante', get: (r) => r.tipo_acompanante ?? '' },
  { header: 'Sede', get: (r) => r.sede?.nombre ?? '' },
  { header: 'Estado', get: (r) => r.estado },
]

// Registros de ingreso sin tarjeta/ubicación asignada (paciente aún no ubicado). Ver también Histórico
// (que solo muestra ingresos vinculados a paciente+tarjeta).
export default function SinTarjeta() {
  const navigate = useNavigate()
  const { perfil, sedeTrabajo } = useAuth()
  // Registrar es de admin y orientador; «sin tarjeta» solo aplica en Urgencias, así que el
  // orientador de otra sede ve el botón deshabilitado con la explicación.
  const puedeRegistrar = perfil?.rol === 'admin' || perfil?.rol === 'orientador'
  const fueraDeUrgencias = perfil?.rol === 'orientador' && sedeTrabajo?.nombre !== 'Urgencias'
  const [rows, setRows] = useState<VisitaListado[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [loading, setLoading] = useState(false)
  const [f, setF] = useState<FiltrosVisita>({ estado: '' })
  // La búsqueda va al servidor (todas las visitas, no solo las 500 recientes), con un leve retardo al escribir.
  const textoBusqueda = useDebounced((f.texto ?? '').trim().length >= 3 ? f.texto : '')

  useEffect(() => { listSedes().then(setSedes) }, [])
  // Lo que se envía al servidor: filtros + texto con retardo (el que se teclea se filtra en pantalla).
  const consulta = useMemo<FiltrosVisita>(() => ({
    estado: f.estado, sedeId: f.sedeId, desde: f.desde, hasta: f.hasta, tipo: 'sin_tarjeta', texto: textoBusqueda,
  }), [f.estado, f.sedeId, f.desde, f.hasta, textoBusqueda])
  useEffect(() => {
    let vigente = true // descarta la respuesta si otra consulta la reemplazó
    setLoading(true)
    listVisitas(consulta, { buscarEnServidor: true })
      .then((r) => { if (vigente) setRows(r) })
      .finally(() => { if (vigente) setLoading(false) })
    return () => { vigente = false }
  }, [consulta])

  const filtrados = useMemo(() => {
    if (!f.texto) return rows
    const t = f.texto.toLowerCase()
    return rows.filter((r) => [r.visitante?.nombres_completos, r.visitante?.cedula].some((x) => x?.toLowerCase().includes(t)))
  }, [rows, f.texto])

  return (
    <div>
      <PageHeader title="Ingresos sin tarjeta" subtitle="Visitantes registrados sin ubicación/tarjeta asignada (paciente aún no ubicado)"
        contador={<ContadorCircular valor={loading ? '…' : filtrados.length} etiqueta={filtrados.length === 1 ? 'ingreso' : 'ingresos'} />}
        action={<div className="flex flex-wrap items-center gap-2">
          {puedeRegistrar && (
            <span title={fueraDeUrgencias ? 'Solo disponible en la sede Urgencias' : undefined}>
              <Btn disabled={fueraDeUrgencias} onClick={() => navigate('/registrar?tipo=sin_tarjeta')}>+ Registrar ingreso sin tarjeta</Btn>
            </span>
          )}
          <Btn variant="light" onClick={() => exportarExcel('Ingresos sin tarjeta', COLS, filtrados, describirFiltros({ ...f, tipo: 'sin_tarjeta' }, { sedes }))}>Excel</Btn>
          <Btn variant="light" onClick={() => exportarPDF('Ingresos sin tarjeta', COLS, filtrados, describirFiltros({ ...f, tipo: 'sin_tarjeta' }, { sedes }))}>PDF</Btn>
        </div>} />

      <ConLateral lateral={<>
        <PanelIndicadores titulo="Resumen" items={[
          { label: 'Total (filtro)', value: filtrados.length, icono: ICONOS_IND.total, color: 'blue' },
          { label: 'Activas (dentro)', value: filtrados.filter((r) => r.estado === 'activa').length, icono: ICONOS_IND.recibido, color: 'green' },
          { label: 'Finalizadas', value: filtrados.filter((r) => r.estado === 'finalizada').length, icono: ICONOS_IND.salida, color: 'red' },
        ]} />
      <FilterBar vertical onClear={() => setF({ estado: '' })}>
        <select className={selectCls} value={f.sedeId ?? ''} onChange={(e) => setF({ ...f, sedeId: e.target.value })}>
          <option value="">Todas las sedes</option>{sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <select className={selectCls} value={f.estado ?? ''} onChange={(e) => setF({ ...f, estado: e.target.value as any })}>
          <option value="">Todas (activas y finalizadas)</option><option value="activa">Activas</option><option value="finalizada">Finalizadas</option>
        </select>
        <input type="date" className={selectCls} value={f.desde ?? ''} onChange={(e) => setF({ ...f, desde: e.target.value })} />
        <input type="date" className={selectCls} value={f.hasta ?? ''} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
        <input aria-label="Buscar por nombre o cédula del visitante" className={selectCls} placeholder="Nombre o cédula del visitante…" value={f.texto ?? ''} onChange={(e) => setF({ ...f, texto: e.target.value })} />
      </FilterBar>
      </>}>

      <Card hover={false} className="overflow-hidden">
        <AvisoLimite n={rows.length} limite={LIMITE_VISITAS} />
        <div className="tabla-scroll">
          <table className="w-full text-sm">
            <thead className="bg-brand text-white"><tr>
              {['Ingreso', 'Salida', 'Visitante', 'Acompañante', 'Sede', 'Estado'].map((h) => <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              <FilasEstado cargando={loading} vacio={filtrados.length === 0} columnas={6} textoVacio="Sin registros — ajusta los filtros">
                {filtrados.map((r) => (
                  <tr key={r.id} className="hover:bg-brand-50/40">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{horaCO(r.created_at)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{r.salida_at ? horaCO(r.salida_at) : <span className="text-gray-300">— dentro —</span>}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-800">{r.visitante?.nombres_completos}</div>
                      <div className="text-xs text-gray-500">{r.visitante?.cedula}{r.visitante?.celular ? ` · ${r.visitante.celular}` : ''}</div>
                    </td>
                    <td className="px-3 py-2 text-gray-600 capitalize">{r.tipo_acompanante ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{r.sede?.nombre ?? '—'}</td>
                    <td className="px-3 py-2">{r.estado === 'activa' ? <Badge color="green">Dentro</Badge> : <Badge>Finalizada</Badge>}</td>
                  </tr>
                ))}
              </FilasEstado>
            </tbody>
          </table>
        </div>
      </Card>
      </ConLateral>
    </div>
  )
}
