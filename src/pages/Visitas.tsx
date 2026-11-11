import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PageHeader, useDebounced, AvisoLimite, ContadorCircular, ConLateral, PanelIndicadores, Card, FilterBar, selectCls, Btn, Badge, FilasEstado } from '../components/ui'
import ModalSalida, { type DatosSalida } from '../components/ModalSalida'
import { SelectsUbicacion, useUbicacionesFiltro } from '../components/SelectsUbicacion'
import { useAuth } from '../auth/AuthProvider'
import { LIMITE_VISITAS, listVisitas, finalizarVisita, describirFiltros, type VisitaListado, type FiltrosVisita } from '../lib/data'
import { exportarExcel, exportarPDF, type Columna } from '../lib/exportar'
import { ICONOS_IND } from '../lib/iconos'

function horaCO(iso: string) {
  return new Date(new Date(iso).getTime() - 5 * 3_600_000).toISOString().replace('T', ' ').substring(0, 16)
}
const TIPO_LABEL: Record<string, string> = { familiar: 'Familiar', proveedor: 'Proveedor', colaborador: 'Colaborador', sin_tarjeta: 'Sin tarjeta' }

const COLS: Columna<VisitaListado>[] = [
  { header: 'Fecha/hora', get: (r) => horaCO(r.created_at) },
  { header: 'Visitante', get: (r) => r.visitante?.nombres_completos ?? '' },
  { header: 'Cédula', get: (r) => r.visitante?.cedula ?? '' },
  { header: 'Tipo', get: (r) => TIPO_LABEL[r.tipo_visitante] ?? r.tipo_visitante },
  { header: 'Acompañante', get: (r) => r.tipo_acompanante ?? '' },
  { header: 'Paciente', get: (r) => r.paciente_nombre ?? '' },
  { header: 'Ubicación', get: (r) => r.ubicacion_etiqueta ?? '' },
  { header: 'Sede', get: (r) => r.sede?.nombre ?? '' },
  { header: 'Responsable', get: (r) => r.responsable?.nombre_completo ?? '' },
  { header: 'Tarjeta', get: (r) => r.tarjeta?.codigo ?? '' },
  { header: 'Aislamiento', get: (r) => r.aislamiento ?? '' },
  { header: 'Estado', get: (r) => r.estado },
]

// Datos de la confirmación de salida a partir de una visita.
function datosSalida(v: VisitaListado): DatosSalida {
  const paciente = v.paciente_nombre ? `${v.paciente_nombre} · ${v.ubicacion_etiqueta ?? ''}`
    : v.responsable?.nombre_completo ? `Resp.: ${v.responsable.nombre_completo}` : 'Sin paciente asociado'
  return {
    visitante: v.visitante?.nombres_completos ?? null, cedula: v.visitante?.cedula ?? null, celular: v.visitante?.celular ?? null,
    tarjeta: v.tarjeta?.codigo ?? '— sin tarjeta —', tipo: TIPO_LABEL[v.tipo_visitante] ?? v.tipo_visitante,
    paciente, ingreso: horaCO(v.created_at),
  }
}

export default function Visitas() {
  const { perfil } = useAuth()
  const esStaff = perfil?.rol === 'admin' || perfil?.rol === 'orientador'
  const [rows, setRows] = useState<VisitaListado[]>([])
  const [loading, setLoading] = useState(true)
  const [f, setF] = useState<FiltrosVisita>({ estado: 'activa' })
  const { sedes, pisos, ubicaciones } = useUbicacionesFiltro(f.sedeId, f.pisoId)
  // La búsqueda va al servidor (todas las visitas, no solo las 500 recientes), con un leve retardo al escribir.
  const textoBusqueda = useDebounced((f.texto ?? '').trim().length >= 3 ? f.texto : '')
  const [confirmar, setConfirmar] = useState<VisitaListado | null>(null)

  // Solo la búsqueda más reciente escribe estado: al teclear o cambiar filtros rápido, una
  // respuesta vieja no reemplaza la lista nueva. El indicador de carga se apaga en finally.
  const pedido = useRef(0)
  // Lo que se envía al servidor: los filtros y el texto CON retardo (no el que se está tecleando,
  // que se filtra en pantalla). Solo cambia cuando cambia alguno de estos campos.
  const consulta = useMemo<FiltrosVisita>(() => ({
    estado: f.estado, tipo: f.tipo, sedeId: f.sedeId, pisoId: f.pisoId, ubicacionId: f.ubicacionId,
    desde: f.desde, hasta: f.hasta, texto: textoBusqueda,
  }), [f.estado, f.tipo, f.sedeId, f.pisoId, f.ubicacionId, f.desde, f.hasta, textoBusqueda])
  const cargar = useCallback(async () => {
    const id = ++pedido.current
    setLoading(true)
    try {
      const r = await listVisitas(consulta, { buscarEnServidor: true })
      if (id === pedido.current) setRows(r)
    } finally {
      if (id === pedido.current) setLoading(false)
    }
  }, [consulta])
  useEffect(() => { cargar() }, [cargar])

  async function salida() {
    if (!confirmar) return
    await finalizarVisita(confirmar.id, perfil?.id)
    setConfirmar(null); cargar()
  }

  const filtrados = f.texto
    ? rows.filter((r) => [r.visitante?.nombres_completos, r.visitante?.cedula, r.paciente_nombre, r.ubicacion_etiqueta]
        .some((x) => x?.toLowerCase().includes(f.texto!.toLowerCase())))
    : rows

  return (
    <div>
      <PageHeader title="Visitas" subtitle="Visitantes registrados: quién está dentro y quién ya salió"
        contador={<ContadorCircular valor={loading ? '…' : filtrados.length} etiqueta={filtrados.length === 1 ? 'visita' : 'visitas'} />} action={
        <div className="flex gap-2">
          <Btn variant="light" onClick={() => exportarExcel('Visitas', COLS, filtrados, describirFiltros(f, { sedes, pisos, ubicaciones }))}>Excel</Btn>
          <Btn variant="light" onClick={() => exportarPDF('Visitas', COLS, filtrados, describirFiltros(f, { sedes, pisos, ubicaciones }))}>PDF</Btn>
        </div>
      } />

      <ConLateral lateral={<>
        <PanelIndicadores titulo="Resumen" items={[
          { label: 'Total (filtro)', value: filtrados.length, icono: ICONOS_IND.total, color: 'blue' },
          { label: 'Activas (dentro)', value: filtrados.filter((r) => r.estado === 'activa').length, icono: ICONOS_IND.recibido, color: 'green' },
          { label: 'Finalizadas', value: filtrados.filter((r) => r.estado === 'finalizada').length, icono: ICONOS_IND.salida, color: 'red' },
          { label: 'Familiares', value: filtrados.filter((r) => r.tipo_visitante === 'familiar').length, icono: ICONOS_IND.personas, color: 'teal' },
          { label: 'Proveedores', value: filtrados.filter((r) => r.tipo_visitante === 'proveedor').length, icono: ICONOS_IND.base, color: 'amber' },
          { label: 'Colaboradores', value: filtrados.filter((r) => r.tipo_visitante === 'colaborador').length, icono: ICONOS_IND.personas, color: 'purple' },
        ]} />
      <FilterBar vertical onClear={() => setF({ estado: '' })}>
        <select className={selectCls} value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value as any })}>
          <option value="">Todos los estados</option>
          <option value="activa">Activas (dentro)</option>
          <option value="finalizada">Finalizadas</option>
        </select>
        <select className={selectCls} value={f.tipo ?? ''} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
          <option value="">Todos los tipos</option>
          <option value="familiar">Familiar</option>
          <option value="proveedor">Proveedor</option>
          <option value="colaborador">Colaborador</option>
        </select>
        <SelectsUbicacion valor={f} onCambio={(c) => setF({ ...f, ...c })} sedes={sedes} pisos={pisos} ubicaciones={ubicaciones} />
        <input type="date" className={selectCls} value={f.desde ?? ''} onChange={(e) => setF({ ...f, desde: e.target.value })} />
        <input type="date" className={selectCls} value={f.hasta ?? ''} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
        <input aria-label="Buscar por nombre, cédula, paciente" className={selectCls} placeholder="Buscar nombre, cédula, paciente…" value={f.texto ?? ''} onChange={(e) => setF({ ...f, texto: e.target.value })} />
      </FilterBar>
      </>}>

      <Card hover={false} className="overflow-hidden">
        <AvisoLimite n={rows.length} limite={LIMITE_VISITAS} />
        <div className="tabla-scroll">
          <table className="w-full text-sm">
            <thead className="bg-brand text-white">
              <tr>
                {['Ingreso', 'Visitante', 'Tipo', 'Paciente / ubicación', 'Sede', 'Tarjeta', 'Estado', ''].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <FilasEstado cargando={loading} vacio={filtrados.length === 0} columnas={8} textoVacio="Sin registros">
                {filtrados.map((r) => (
                  <tr key={r.id} className="hover:bg-brand-50/40">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">{horaCO(r.created_at)}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-800">{r.visitante?.nombres_completos}</div>
                      <div className="text-xs text-gray-500">{r.visitante?.cedula}{r.visitante?.celular ? ` · ${r.visitante.celular}` : ''}</div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge color={r.tipo_visitante === 'familiar' ? 'blue' : r.tipo_visitante === 'proveedor' ? 'amber' : 'gray'}>{TIPO_LABEL[r.tipo_visitante]}</Badge>
                      {r.tipo_acompanante && <div className="mt-0.5 text-xs capitalize text-gray-500">{r.tipo_acompanante}</div>}
                    </td>
                    <td className="px-3 py-2">
                      {r.paciente_nombre
                        ? <div><div className="text-gray-800">{r.paciente_nombre}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-1">{r.ubicacion_etiqueta}{r.aislamiento && <Badge color="red">{r.aislamiento}</Badge>}</div></div>
                        : r.responsable?.nombre_completo
                          ? <span className="text-xs text-gray-500">Resp.: {r.responsable.nombre_completo}</span>
                          : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{r.sede?.nombre ?? '—'}</td>
                    <td className="px-3 py-2">{r.tarjeta?.codigo ? <Badge color="blue">{r.tarjeta.codigo}</Badge> : <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2">{r.estado === 'activa' ? <Badge color="green">Dentro</Badge> : <Badge>Finalizada</Badge>}</td>
                    <td className="px-3 py-2 text-right">
                      {esStaff && r.estado === 'activa' &&
                        <button onClick={() => setConfirmar(r)} className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-700 whitespace-nowrap">
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7M13 16v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                          Registrar salida
                        </button>}
                    </td>
                  </tr>
                ))}
              </FilasEstado>
            </tbody>
          </table>
        </div>
      </Card>
      </ConLateral>

      {/* Modal de confirmación de salida */}
      <ModalSalida datos={confirmar ? datosSalida(confirmar) : null} onConfirmar={salida} onCerrar={() => setConfirmar(null)}
        aviso={<>Al confirmar, se registra la salida, la tarjeta queda <b>disponible</b> y se libera el cupo de la habitación.</>} />
    </div>
  )
}
