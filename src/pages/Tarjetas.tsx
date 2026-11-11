import { useCallback, useEffect, useRef, useState } from 'react'
import { PageHeader, ContadorCircular, ConLateral, PanelIndicadores, Card, Badge, Btn, FilterBar, selectCls, FilasEstado, type CardColor } from '../components/ui'
import ModalSalida, { type DatosSalida } from '../components/ModalSalida'
import { SelectsUbicacion, useUbicacionesFiltro } from '../components/SelectsUbicacion'
import { useAuth } from '../auth/AuthProvider'
import { inventarioTarjetas, listTarjetasDetalle, finalizarVisita, describirFiltros, type InventarioTarjetas, type TarjetaDetalle, type FiltrosTarjeta } from '../lib/data'
import { exportarExcel, exportarPDF, type Columna } from '../lib/exportar'
import { ICONOS_IND } from '../lib/iconos'

const TIPO_LABEL: Record<string, string> = { familiar: 'Familiar', proveedor: 'Proveedor', colaborador: 'Colaborador', sin_tarjeta: 'Sin tarjeta' }
const ESTADO_LABEL: Record<string, string> = { disponible: 'Disponible', en_uso: 'En uso', inactiva: 'Inactiva' }
const ESTADO_COLOR: Record<string, any> = { disponible: 'green', en_uso: 'amber', inactiva: 'gray' }
function horaCO(iso: string | null) {
  if (!iso) return '—'
  return new Date(new Date(iso).getTime() - 5 * 3_600_000).toISOString().replace('T', ' ').substring(0, 16)
}

const COLS: Columna<TarjetaDetalle>[] = [
  { header: 'Tarjeta', get: (r) => r.codigo },
  { header: 'Estado', get: (r) => ESTADO_LABEL[r.estado] ?? r.estado },
  { header: 'Titular', get: (r) => r.visitante_nombre ?? '' },
  { header: 'Cédula', get: (r) => r.cedula ?? '' },
  { header: 'Teléfono', get: (r) => r.celular ?? '' },
  { header: 'Tipo', get: (r) => TIPO_LABEL[r.tipo_visitante ?? ''] ?? '' },
  { header: 'Paciente', get: (r) => r.paciente_nombre ?? '' },
  { header: 'Ubicación', get: (r) => r.ubicacion_etiqueta ?? '' },
  { header: 'Desde', get: (r) => horaCO(r.hora_ingreso) },
]

// Las cuatro cifras del inventario; cada una filtra la tabla por su estado ('' = todas).
const CIFRAS_INVENTARIO: { estado: string; label: string; campo: 'total' | 'disponible' | 'en_uso' | 'inactiva'; icono: string; color: CardColor; accion: string }[] = [
  { estado: '', label: 'Total tarjetas', campo: 'total', icono: ICONOS_IND.total, color: 'blue', accion: 'Ver todas' },
  { estado: 'disponible', label: 'Disponibles', campo: 'disponible', icono: ICONOS_IND.atendido, color: 'green', accion: 'Filtrar' },
  { estado: 'en_uso', label: 'En uso', campo: 'en_uso', icono: ICONOS_IND.personas, color: 'amber', accion: 'Filtrar' },
  { estado: 'inactiva', label: 'Inactivas', campo: 'inactiva', icono: ICONOS_IND.alerta, color: 'purple', accion: 'Filtrar' },
]
function PanelInventario({ inv, estado, onEstado }: { inv: InventarioTarjetas | null; estado: string; onEstado: (e: string) => void }) {
  return (
    <PanelIndicadores titulo="Inventario" items={CIFRAS_INVENTARIO.map((c) => ({
      label: c.label, value: inv?.[c.campo] ?? '—', hint: estado === c.estado ? 'Filtro activo' : c.accion,
      icono: c.icono, color: c.color, activo: estado === c.estado, onClick: () => onEstado(c.estado),
    }))} />
  )
}

// Datos de la confirmación de salida a partir de una tarjeta en uso.
function datosSalida(t: TarjetaDetalle): DatosSalida {
  return {
    visitante: t.visitante_nombre ?? null, cedula: t.cedula ?? null, celular: t.celular ?? null,
    tarjeta: t.codigo, tipo: t.tipo_visitante ? TIPO_LABEL[t.tipo_visitante] : '—',
    paciente: t.paciente_nombre ? `${t.paciente_nombre} · ${t.ubicacion_etiqueta}` : 'Sin paciente asociado',
    ingreso: horaCO(t.hora_ingreso),
  }
}

export default function Tarjetas() {
  const { perfil } = useAuth()
  const esStaff = perfil?.rol === 'admin' || perfil?.rol === 'orientador'
  const [inv, setInv] = useState<InventarioTarjetas | null>(null)
  const [rows, setRows] = useState<TarjetaDetalle[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmar, setConfirmar] = useState<TarjetaDetalle | null>(null)
  const [f, setF] = useState<FiltrosTarjeta>({ estado: 'en_uso' })
  const { sedes, pisos, ubicaciones } = useUbicacionesFiltro(f.sedeId, f.pisoId)

  // Una sola carga (inventario + lista) que se repite al cambiar cualquier filtro. Antes eran dos
  // efectos que pedían la misma lista y podían responder en desorden. Solo la petición más
  // reciente escribe estado, y el indicador de carga se apaga en finally aunque falle.
  const pedido = useRef(0)
  const cargar = useCallback(async () => {
    const id = ++pedido.current
    // «Cargando…» solo en la primera carga (loading arranca en true): al filtrar o escribir en la
    // búsqueda la tabla se actualiza en su lugar, sin parpadear.
    try {
      const [i, u] = await Promise.all([inventarioTarjetas(), listTarjetasDetalle(f)])
      if (id !== pedido.current) return
      setInv(i); setRows(u)
    } finally {
      if (id === pedido.current) setLoading(false)
    }
  }, [f])
  useEffect(() => { cargar() }, [cargar])

  async function devolver() {
    if (!confirmar?.visita_id) { setConfirmar(null); return }
    await finalizarVisita(confirmar.visita_id, perfil?.id)
    setConfirmar(null); cargar()
  }

  // Filtra por estado en las tarjetas métricas para resaltar el seleccionado
  function setEstado(e: string) { setF({ ...f, estado: e }) }

  return (
    <div>
      <PageHeader title="Tarjetas de acceso" subtitle="Inventario, tenencia y devolución de tarjetas"
        contador={<ContadorCircular valor={loading ? '…' : rows.length} etiqueta={rows.length === 1 ? 'tarjeta' : 'tarjetas'} />}
        action={<div className="flex gap-2">
          <Btn variant="light" onClick={() => exportarExcel('Tarjetas de acceso', COLS, rows, describirFiltros(f, { sedes, pisos, ubicaciones }))}>Excel</Btn>
          <Btn variant="light" onClick={() => exportarPDF('Tarjetas de acceso', COLS, rows, describirFiltros(f, { sedes, pisos, ubicaciones }))}>PDF</Btn>
        </div>} />

      <ConLateral lateral={<>
      {/* Inventario — clic para filtrar por estado */}
      <PanelInventario inv={inv} estado={f.estado ?? ''} onEstado={setEstado} />

      {/* Filtros completos */}
      <FilterBar vertical onClear={() => setF({})}>
        <select className={selectCls} value={f.estado ?? ''} onChange={(e) => setF({ ...f, estado: e.target.value })}>
          <option value="">Todos los estados</option>
          <option value="disponible">Disponibles</option>
          <option value="en_uso">En uso</option>
          <option value="inactiva">Inactivas</option>
        </select>
        <SelectsUbicacion valor={f} onCambio={(c) => setF({ ...f, ...c })} sedes={sedes} pisos={pisos} ubicaciones={ubicaciones} />
        <select className={selectCls} value={f.tipo ?? ''} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
          <option value="">Todos los tipos</option><option value="familiar">Familiar</option><option value="proveedor">Proveedor</option><option value="colaborador">Colaborador</option>
        </select>
        <input type="date" className={selectCls} value={f.desde ?? ''} onChange={(e) => setF({ ...f, desde: e.target.value })} />
        <input type="date" className={selectCls} value={f.hasta ?? ''} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
        <input aria-label="Buscar por tarjeta, titular, cédula, teléfono" className={selectCls} placeholder="Buscar tarjeta, titular, cédula, teléfono…" value={f.texto ?? ''} onChange={(e) => setF({ ...f, texto: e.target.value })} />
      </FilterBar>
      {esStaff && <p className="px-1 text-xs text-gray-500">Para una salida, busca la tarjeta en uso y pulsa «Registrar salida y devolver».</p>}
      </>}>

      <Card hover={false} className="overflow-hidden">
        <div className="tabla-scroll">
          <table className="w-full text-sm">
            <thead className="bg-brand text-white"><tr>
              {['Tarjeta', 'Estado', 'Titular', 'Teléfono', 'Tipo', 'Paciente / ubicación', 'Desde', esStaff ? 'Acción' : ''].map((h) => <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              <FilasEstado cargando={loading} vacio={rows.length === 0} columnas={8} textoVacio="Sin tarjetas para el filtro">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-brand-50/40">
                    <td className="px-3 py-2 font-semibold text-gray-800">{r.codigo}</td>
                    <td className="px-3 py-2"><Badge color={ESTADO_COLOR[r.estado]}>{ESTADO_LABEL[r.estado]}</Badge></td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-800">{r.visitante_nombre ?? '—'}</div>
                      <div className="text-xs text-gray-500">{r.cedula}</div>
                    </td>
                    <td className="px-3 py-2">
                      {r.celular
                        ? <a href={`tel:${r.celular}`} className="inline-flex items-center gap-1 text-brand-light hover:underline">
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h2.3a1 1 0 01.95.68l1 3a1 1 0 01-.27 1.05l-1.2 1.2a14 14 0 006.3 6.3l1.2-1.2a1 1 0 011.05-.27l3 1a1 1 0 01.68.95V19a2 2 0 01-2 2A16 16 0 013 5z" /></svg>
                            {r.celular}
                          </a>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{r.tipo_visitante ? TIPO_LABEL[r.tipo_visitante] : <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2">
                      {r.paciente_nombre ? <><div className="text-gray-800">{r.paciente_nombre}</div><div className="text-xs text-gray-500">{r.ubicacion_etiqueta}</div></> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{r.estado === 'en_uso' ? horaCO(r.hora_ingreso) : '—'}</td>
                    {esStaff && <td className="px-3 py-2">
                      {r.estado === 'en_uso' && r.visita_id
                        ? <button onClick={() => setConfirmar(r)} className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-700 whitespace-nowrap">
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7M13 16v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                            Registrar salida y devolver
                          </button>
                        : <span className="text-gray-300">—</span>}
                    </td>}
                  </tr>
                ))}
              </FilasEstado>
            </tbody>
          </table>
        </div>
      </Card>
      </ConLateral>

      {/* Modal de confirmación de salida con datos del visitante + iconos */}
      <ModalSalida datos={confirmar ? datosSalida(confirmar) : null} onConfirmar={devolver} onCerrar={() => setConfirmar(null)}
        aviso={<>Al confirmar, la tarjeta <b>{confirmar?.codigo}</b> vuelve a estar <b>disponible</b> y la habitación queda libre.</>} />
    </div>
  )
}
