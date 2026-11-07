import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FilterBar, selectCls, Modal, Badge } from '../components/ui'
import EstadoSyncCenso from '../components/EstadoSyncCenso'
import { HeroInicio, KpiCard, Panel, ListaMovimientos, TendenciaVisitas, DonaTarjetas, ListaPisos, Icono, ICONOS, COLOR_INGRESOS } from '../components/InicioWidgets'
import { useAuth } from '../auth/AuthProvider'
import {
  listVisitas, listSedes, listPisos, inventarioTarjetas, pacientesSinCama, monitoreoResumen, feedReciente, ocupacionPorPiso, serieEventos, pacientesEnAislamiento,
  type PacienteAislado, type VisitaListado, type FiltrosVisita, type InventarioTarjetas, type PacienteSinCama, type ResumenMonitoreo, type FeedItem, type PisoOcup, type PuntoEventos,
} from '../lib/data'
import { hoyColombia } from '../lib/festivosColombia'
import { AISLAMIENTO_LABEL, type Sede, type Piso } from '../lib/types'

const ACCESOS = [
  { to: '/registrar', titulo: 'Registrar visita', detalle: 'Familiar, proveedor o colaborador', icono: ICONOS.mas, roles: ['admin', 'orientador'] },
  { to: '/mapa', titulo: 'Mapa de habitaciones', detalle: 'Ocupación y acompañantes', icono: ICONOS.mapa },
  { to: '/tarjetas', titulo: 'Tarjetas y salidas', detalle: 'Inventario y devolución', icono: ICONOS.tarjeta },
]

export default function Dashboard() {
  const { perfil } = useAuth()
  const [rows, setRows] = useState<VisitaListado[]>([])
  const [inv, setInv] = useState<InventarioTarjetas | null>(null)
  const [sedes, setSedes] = useState<Sede[]>([])
  const [pisos, setPisos] = useState<Piso[]>([])
  const [f, setF] = useState<FiltrosVisita>({ estado: '' })
  const [sinCama, setSinCama] = useState<PacienteSinCama[]>([])
  const [verSinCama, setVerSinCama] = useState(false)
  const [resumen, setResumen] = useState<ResumenMonitoreo | null>(null)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [porPiso, setPorPiso] = useState<PisoOcup[]>([])
  const [serie, setSerie] = useState<PuntoEventos[]>([])
  const [aislados, setAislados] = useState<PacienteAislado[] | null>(null)
  const [verAislados, setVerAislados] = useState(false)
  const [buscaAislado, setBuscaAislado] = useState('')

  // La lista se consulta al abrir el modal: siempre la foto más reciente del censo.
  function abrirAislados() {
    setVerAislados(true); setBuscaAislado(''); setAislados(null)
    pacientesEnAislamiento().then(setAislados)
  }
  const aisladosFiltrados = useMemo(() => {
    const t = buscaAislado.trim().toLowerCase()
    if (!aislados || !t) return aislados ?? []
    return aislados.filter((p) => [p.paciente, p.documento, p.ubicacion, p.piso, AISLAMIENTO_LABEL[p.tipo]].some((x) => x?.toLowerCase().includes(t)))
  }, [aislados, buscaAislado])

  // Lo que pasa ahora: no depende de los filtros de la consulta y se refresca solo.
  useEffect(() => {
    function cargar() {
      monitoreoResumen(hoyColombia()).then(setResumen)
      feedReciente(6).then(setFeed)
      ocupacionPorPiso().then(setPorPiso)
      inventarioTarjetas().then(setInv)
      pacientesSinCama().then(setSinCama)
      serieEventos(90).then(setSerie)
    }
    cargar()
    const t = setInterval(cargar, 60_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => { listSedes().then(setSedes) }, [])
  useEffect(() => { if (f.sedeId) listPisos(f.sedeId).then(setPisos); else setPisos([]) }, [f.sedeId])
  useEffect(() => { listVisitas(f).then(setRows) }, [f.estado, f.tipo, f.sedeId, f.pisoId, f.desde, f.hasta])

  const m = useMemo(() => {
    const filtr = f.texto
      ? rows.filter((r) => [r.visitante?.nombres_completos, r.visitante?.cedula, r.paciente_nombre, r.ubicacion_etiqueta]
          .some((x) => x?.toLowerCase().includes(f.texto!.toLowerCase())))
      : rows
    const activas = filtr.filter((r) => r.estado === 'activa').length
    const porTipo = (t: string) => filtr.filter((r) => r.tipo_visitante === t).length
    return { total: filtr.length, activas, finalizadas: filtr.length - activas, familiar: porTipo('familiar'), proveedor: porTipo('proveedor'), colaborador: porTipo('colaborador') }
  }, [rows, f.texto])

  const hoy = serie[serie.length - 1]
  const ultimos14 = useMemo(() => serie.slice(-14).map((p) => ({ fecha: p.fecha, n: p.ingresos })), [serie])
  const ingresos14 = ultimos14.reduce((a, p) => a + p.n, 0)
  const ayer = serie[serie.length - 2]?.ingresos
  // Variación de los últimos 14 días frente a los 14 anteriores (la serie trae 90 días).
  const previos14 = serie.length >= 28 ? serie.slice(-28, -14).reduce((a, p) => a + p.ingresos, 0) : 0
  const varIngresos = previos14 ? Math.round(((ingresos14 - previos14) / previos14) * 100) : null
  const pacientes = resumen?.pacientes ?? 0
  const prop = (n?: number) => (pacientes && n != null ? n / pacientes : 0)
  const accesos = ACCESOS.filter((a) => !a.roles || a.roles.includes(perfil?.rol ?? ''))

  return (
    <div className="space-y-5">
      <EstadoSyncCenso soloSiDesactualizado />

      {/* Accesos rápidos arriba: es lo primero que busca quien entra a trabajar */}
      {accesos.length > 0 && (
        <nav aria-label="Accesos rápidos" className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
          {accesos.map((a) => (
            <Link key={a.to} to={a.to} className="group flex items-center gap-3 rounded-2xl bg-white p-3 shadow-neu-sm transition hover:bg-brand hover:text-white">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand transition group-hover:bg-white/15 group-hover:text-white"><Icono d={a.icono} /></span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-gray-900 group-hover:text-white">{a.titulo}</span>
                <span className="block truncate text-xs text-gray-500 group-hover:text-white/80">{a.detalle}</span>
              </span>
            </Link>
          ))}
        </nav>
      )}

      <div className="grid gap-5 xl:grid-cols-3">
        <HeroInicio nombre={perfil?.nombre} indicadores={[
          { titulo: 'Visitantes dentro', valor: resumen?.activas ?? '—', icono: ICONOS.personas, color: '#7DD3FC', to: '/visitas' },
          { titulo: 'Ingresos hoy', valor: resumen?.ingresosHoy ?? '—', icono: ICONOS.entrada, color: '#FCD34D' },
          { titulo: 'Salidas hoy', valor: hoy?.salidas ?? '—', icono: ICONOS.salida, color: '#6EE7B7' },
          { titulo: 'Tarjetas libres', valor: inv?.disponible ?? '—', icono: ICONOS.tarjeta, color: '#FCA5A5', to: '/tarjetas' },
        ]} />
        <Panel titulo="Últimos movimientos" icono={ICONOS.entrada} accion={<Link to="/visitas" className="text-xs font-medium text-brand-light hover:underline">Ver todos →</Link>}>
          <ListaMovimientos items={feed.slice(0, 4)} />
        </Panel>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard titulo="Ingresos" valor={ingresos14} detalle={`Últimos 14 días${ayer != null ? ` · ayer: ${ayer}` : ''}`} icono={ICONOS.entrada} tono="azul" serie={ultimos14} colorSerie={COLOR_INGRESOS}
          variacion={{ pct: varIngresos, texto: 'vs. los 14 días anteriores' }} />
        <KpiCard titulo="Pacientes con acompañante" valor={resumen?.conAcomp ?? '—'} icono={ICONOS.check} tono="verde" proporcion={prop(resumen?.conAcomp)}
          detalle={resumen ? `de ${pacientes} en el censo · ${Math.max(0, pacientes - resumen.conAcomp)} sin acompañante` : undefined} />
        <KpiCard titulo="En aislamiento" valor={resumen?.aislamiento ?? '—'} icono={ICONOS.alerta} tono="rojo" proporcion={prop(resumen?.aislamiento)}
          detalle={resumen ? `de ${pacientes} en el censo · clic para ver los pacientes →` : undefined} onClick={abrirAislados} />
        <KpiCard titulo="Sin cama asignada" valor={sinCama.length} detalle="Clic para ver los pacientes →" icono={ICONOS.cama} tono="ambar" proporcion={prop(sinCama.length)} onClick={() => setVerSinCama(true)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
        <TendenciaVisitas serie={serie} />
        <Panel titulo="Visitantes dentro, por piso" icono={ICONOS.edificio} accion={<span className="text-xs text-gray-500">{resumen?.activas ?? 0} en total</span>}>
          <ListaPisos pisos={porPiso} />
        </Panel>
        <Panel titulo="Tarjetas de acceso" icono={ICONOS.tarjeta}>
          <DonaTarjetas disponible={inv?.disponible ?? 0} enUso={inv?.en_uso ?? 0} inactiva={inv?.inactiva ?? 0} />
        </Panel>
      </div>

      <section aria-label="Consulta de visitas">
        <h2 className="mb-2 text-base font-semibold text-gray-900">Consulta de visitas</h2>
        <FilterBar onClear={() => setF({ estado: '' })}>
          <select className={selectCls} value={f.estado ?? ''} onChange={(e) => setF({ ...f, estado: e.target.value as any })}>
            <option value="">Todos los estados</option><option value="activa">Activas (dentro)</option><option value="finalizada">Finalizadas</option>
          </select>
          <select className={selectCls} value={f.tipo ?? ''} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
            <option value="">Todos los tipos</option><option value="familiar">Familiar</option><option value="proveedor">Proveedor</option><option value="colaborador">Colaborador</option>
          </select>
          <select className={selectCls} value={f.sedeId ?? ''} onChange={(e) => setF({ ...f, sedeId: e.target.value, pisoId: '' })}>
            <option value="">Todas las sedes</option>{sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
          <select className={selectCls} value={f.pisoId ?? ''} disabled={!f.sedeId} onChange={(e) => setF({ ...f, pisoId: e.target.value })}>
            <option value="">{f.sedeId ? 'Todos los pisos' : 'Elige sede'}</option>{pisos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <input type="date" aria-label="Desde" className={selectCls} value={f.desde ?? ''} onChange={(e) => setF({ ...f, desde: e.target.value })} />
          <input type="date" aria-label="Hasta" className={selectCls} value={f.hasta ?? ''} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
          <input className={selectCls} placeholder="Buscar nombre, cédula, paciente…" value={f.texto ?? ''} onChange={(e) => setF({ ...f, texto: e.target.value })} />
        </FilterBar>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {[['Visitas', m.total], ['Activas', m.activas], ['Finalizadas', m.finalizadas], ['Familiares', m.familiar], ['Proveedores', m.proveedor], ['Colaboradores', m.colaborador]].map(([k, v]) => (
            <div key={k as string} className="rounded-xl bg-white px-4 py-3 shadow-neu-xs transition-colors hover:bg-brand-50">
              <div className="text-xs text-gray-500">{k}</div>
              <div className="text-xl font-bold tabular-nums text-gray-900">{v}</div>
            </div>
          ))}
        </div>
      </section>

      <Modal open={verSinCama} onClose={() => setVerSinCama(false)} title="Pacientes sin cama asignada" maxWidth="max-w-3xl">
        <p className="mb-3 text-sm text-gray-600">
          Pacientes que el CENSO reporta <b>sin ubicación física</b> (sala de espera de urgencias, recuperación, etc.).
          Búscalos por su número de identificación al registrar una visita.
        </p>
        <div className="max-h-[60vh] overflow-auto rounded-lg ring-1 ring-gray-100">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-brand text-white"><tr>
              {['Paciente', 'Edad', 'Unidad CENSO', '# Ingreso'].map((h) => <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {sinCama.length === 0
                ? <tr><td colSpan={4} className="py-8 text-center text-emerald-600">✓ Todos los pacientes tienen cama asignada.</td></tr>
                : sinCama.map((p) => (
                  <tr key={p.num_ingreso} className="hover:bg-brand-50/40">
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-800">{p.paciente ?? '—'}</div>
                      <div className="text-xs text-gray-500">ID {p.documento ?? '—'}</div>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{p.edad ?? '—'}</td>
                    <td className="px-3 py-2"><Badge color="amber"><span className="whitespace-nowrap">{p.unidad ?? '—'}</span></Badge></td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{p.num_ingreso}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-right text-xs text-gray-400">{sinCama.length} paciente(s)</div>
      </Modal>

      <Modal open={verAislados} onClose={() => setVerAislados(false)} title="Pacientes en aislamiento" maxWidth="max-w-4xl">
        <p className="mb-3 text-sm text-gray-600">
          Pacientes con <b>aislamiento vigente</b> según el CENSO. Antes de autorizar una visita, recuerda al acompañante las
          precauciones del tipo de aislamiento.
        </p>
        {aislados && aislados.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {/* Resumen por tipo: clic para buscar solo ese tipo */}
            {Object.entries(aislados.reduce<Record<string, number>>((m, p) => { const k = AISLAMIENTO_LABEL[p.tipo] ?? p.tipo; m[k] = (m[k] ?? 0) + 1; return m }, {}))
              .sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                <button key={k} onClick={() => setBuscaAislado(buscaAislado === k ? '' : k)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${buscaAislado === k ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'}`}>
                  {k} · {n}
                </button>
              ))}
            <input className={`${selectCls} ml-auto w-60`} placeholder="Buscar paciente, cédula, ubicación…" value={buscaAislado} onChange={(e) => setBuscaAislado(e.target.value)} />
          </div>
        )}
        <div className="max-h-[60vh] overflow-auto rounded-lg ring-1 ring-gray-100">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-brand text-white"><tr>
              {['Paciente', 'Edad', 'Ubicación', 'Aislamiento', '# Ingreso'].map((h) => <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {aislados == null
                ? <tr><td colSpan={5} className="py-8 text-center text-gray-400">Cargando…</td></tr>
                : aisladosFiltrados.length === 0
                  ? <tr><td colSpan={5} className="py-8 text-center text-emerald-600">{aislados.length ? 'Sin resultados para esta búsqueda.' : '✓ No hay pacientes en aislamiento.'}</td></tr>
                  : aisladosFiltrados.map((p) => (
                    <tr key={`${p.num_ingreso}-${p.tipo}`} className="hover:bg-brand-50/40">
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-800">{p.paciente ?? '—'}</div>
                        <div className="text-xs text-gray-500">ID {p.documento ?? '—'}</div>
                      </td>
                      <td className="px-3 py-2 text-gray-600">{p.edad ?? '—'}</td>
                      <td className="px-3 py-2">
                        <div className="text-gray-800">{p.ubicacion ?? 'Sin cama asignada'}</div>
                        <div className="text-xs text-gray-500">{p.piso ?? p.servicio ?? '—'}</div>
                      </td>
                      <td className="px-3 py-2"><Badge color="red"><span className="whitespace-nowrap">{AISLAMIENTO_LABEL[p.tipo] ?? p.tipo}</span></Badge></td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{p.num_ingreso}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-right text-xs text-gray-400">{aisladosFiltrados.length}{aislados && aisladosFiltrados.length !== aislados.length ? ` de ${aislados.length}` : ''} paciente(s)</div>
      </Modal>
    </div>
  )
}
