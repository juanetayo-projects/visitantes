import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FilterBar, selectCls } from '../components/ui'
import { SelectsUbicacion, useUbicacionesFiltro } from '../components/SelectsUbicacion'
import EstadoSyncCenso from '../components/EstadoSyncCenso'
import ErroresHomologacion from '../components/ErroresHomologacion'
import { ModalSinCama, ModalAislados } from '../components/ModalesPacientes'
import { HeroInicio, KpiCard, Panel, ListaMovimientos, TendenciaVisitas, DonaTarjetas, ListaPisos, Icono, COLOR_INGRESOS } from '../components/InicioWidgets'
import { useAuth } from '../auth/AuthProvider'
import {
  listVisitas, inventarioTarjetas, pacientesSinCama, monitoreoResumen, feedReciente, ocupacionPorPiso, serieEventos,
  type VisitaListado, type FiltrosVisita, type InventarioTarjetas, type PacienteSinCama, type ResumenMonitoreo, type FeedItem, type PisoOcup, type PuntoEventos,
} from '../lib/data'
import { hoyColombia } from '../lib/festivosColombia'
import { ICONOS } from '../lib/iconos'

const ACCESOS = [
  { to: '/registrar', titulo: 'Registrar visita', detalle: 'Familiar, proveedor o colaborador', icono: ICONOS.mas, roles: ['admin', 'orientador'] },
  { to: '/mapa', titulo: 'Mapa de habitaciones', detalle: 'Ocupación y acompañantes', icono: ICONOS.mapa },
  { to: '/tarjetas', titulo: 'Tarjetas y salidas', detalle: 'Inventario y devolución', icono: ICONOS.tarjeta },
]

// Ingresos de los últimos 14 días, el de ayer y la variación frente a los 14 anteriores
// (la serie trae 90 días; null si no hay con qué comparar).
function useTendenciaIngresos(serie: PuntoEventos[]) {
  return useMemo(() => {
    const ultimos14 = serie.slice(-14).map((p) => ({ fecha: p.fecha, n: p.ingresos }))
    const ingresos14 = ultimos14.reduce((a, p) => a + p.n, 0)
    const previos14 = serie.length >= 28 ? serie.slice(-28, -14).reduce((a, p) => a + p.ingresos, 0) : 0
    return {
      hoy: serie[serie.length - 1] as PuntoEventos | undefined,
      ayer: serie[serie.length - 2]?.ingresos,
      ultimos14, ingresos14,
      varIngresos: previos14 ? Math.round(((ingresos14 - previos14) / previos14) * 100) : null,
    }
  }, [serie])
}

// Fila de indicadores: ingresos con tendencia y proporciones sobre los pacientes del censo.
function FilaKpis({ tendencia, resumen, sinCama, onAislados, onSinCama }: {
  tendencia: ReturnType<typeof useTendenciaIngresos>; resumen: ResumenMonitoreo | null; sinCama: number
  onAislados: () => void; onSinCama: () => void
}) {
  const pacientes = resumen?.pacientes ?? 0
  const prop = (n?: number) => (pacientes && n != null ? n / pacientes : 0)
  const { ultimos14, ingresos14, ayer, varIngresos } = tendencia
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard titulo="Ingresos" valor={ingresos14} detalle={`Últimos 14 días${ayer != null ? ` · ayer: ${ayer}` : ''}`} icono={ICONOS.entrada} tono="azul" serie={ultimos14} colorSerie={COLOR_INGRESOS}
        variacion={{ pct: varIngresos, texto: 'vs. los 14 días anteriores' }} />
      <KpiCard titulo="Pacientes con acompañante" valor={resumen?.conAcomp ?? '—'} icono={ICONOS.check} tono="verde" proporcion={prop(resumen?.conAcomp)}
        detalle={resumen ? `de ${pacientes} en el censo · ${Math.max(0, pacientes - resumen.conAcomp)} sin acompañante` : undefined} />
      <KpiCard titulo="En aislamiento" valor={resumen?.aislamiento ?? '—'} icono={ICONOS.alerta} tono="rojo" proporcion={prop(resumen?.aislamiento)}
        detalle={resumen ? `de ${pacientes} en el censo · clic para ver los pacientes →` : undefined} onClick={onAislados} />
      <KpiCard titulo="Sin cama asignada" valor={sinCama} detalle="Clic para ver los pacientes →" icono={ICONOS.cama} tono="ambar" proporcion={prop(sinCama)} onClick={onSinCama} />
    </div>
  )
}

// «Consulta de visitas»: filtros propios y conteos de la consulta. No comparte estado con el resto del Inicio.
function ConsultaVisitas() {
  const [rows, setRows] = useState<VisitaListado[]>([])
  const [f, setF] = useState<FiltrosVisita>({ estado: '' })
  const { sedes, pisos } = useUbicacionesFiltro(f.sedeId, f.pisoId)
  // Sin el texto: se filtra en pantalla (ver `m`). Antes se pasaba `f` completo, y el texto que
  // hubiera al momento de consultar se quedaba "pegado" en la lista aunque luego se borrara.
  const consulta = useMemo<FiltrosVisita>(() => ({
    estado: f.estado, tipo: f.tipo, sedeId: f.sedeId, pisoId: f.pisoId, desde: f.desde, hasta: f.hasta,
  }), [f.estado, f.tipo, f.sedeId, f.pisoId, f.desde, f.hasta])
  useEffect(() => {
    let vigente = true
    listVisitas(consulta).then((r) => { if (vigente) setRows(r) })
    return () => { vigente = false }
  }, [consulta])
  const m = useMemo(() => {
    const t = f.texto?.toLowerCase()
    const filtr = t
      ? rows.filter((r) => [r.visitante?.nombres_completos, r.visitante?.cedula, r.paciente_nombre, r.ubicacion_etiqueta].some((x) => x?.toLowerCase().includes(t)))
      : rows
    const activas = filtr.filter((r) => r.estado === 'activa').length
    const porTipo = (tipo: string) => filtr.filter((r) => r.tipo_visitante === tipo).length
    return { total: filtr.length, activas, finalizadas: filtr.length - activas, familiar: porTipo('familiar'), proveedor: porTipo('proveedor'), colaborador: porTipo('colaborador') }
  }, [rows, f.texto])
  return (
      <section aria-label="Consulta de visitas">
        <h2 className="mb-2 text-base font-semibold text-gray-900">Consulta de visitas</h2>
        <FilterBar onClear={() => setF({ estado: '' })}>
          <select aria-label="Estado de la visita" className={selectCls} value={f.estado ?? ''} onChange={(e) => setF({ ...f, estado: e.target.value as any })}>
            <option value="">Todos los estados</option><option value="activa">Activas (dentro)</option><option value="finalizada">Finalizadas</option>
          </select>
          <select aria-label="Tipo de visitante" className={selectCls} value={f.tipo ?? ''} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
            <option value="">Todos los tipos</option><option value="familiar">Familiar</option><option value="proveedor">Proveedor</option><option value="colaborador">Colaborador</option>
          </select>
          <SelectsUbicacion valor={f} onCambio={(c) => setF({ ...f, ...c })} sedes={sedes} pisos={pisos} />
          <input type="date" aria-label="Desde" className={selectCls} value={f.desde ?? ''} onChange={(e) => setF({ ...f, desde: e.target.value })} />
          <input type="date" aria-label="Hasta" className={selectCls} value={f.hasta ?? ''} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
          <input aria-label="Buscar por nombre, cédula, paciente" className={selectCls} placeholder="Buscar nombre, cédula, paciente…" value={f.texto ?? ''} onChange={(e) => setF({ ...f, texto: e.target.value })} />
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
  )
}

export default function Dashboard() {
  const { perfil } = useAuth()
  const [inv, setInv] = useState<InventarioTarjetas | null>(null)
  const [sinCama, setSinCama] = useState<PacienteSinCama[]>([])
  const [verSinCama, setVerSinCama] = useState(false)
  const [resumen, setResumen] = useState<ResumenMonitoreo | null>(null)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [porPiso, setPorPiso] = useState<PisoOcup[]>([])
  const [serie, setSerie] = useState<PuntoEventos[]>([])
  const [verAislados, setVerAislados] = useState(false)

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

  const tendencia = useTendenciaIngresos(serie)
  const accesos = ACCESOS.filter((a) => !a.roles || a.roles.includes(perfil?.rol ?? ''))

  return (
    <div className="space-y-5">
      <EstadoSyncCenso soloSiDesactualizado />
      <ErroresHomologacion esAdmin={perfil?.rol === 'admin'} />

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
          { titulo: 'Salidas hoy', valor: tendencia.hoy?.salidas ?? '—', icono: ICONOS.salida, color: '#6EE7B7' },
          { titulo: 'Tarjetas libres', valor: inv?.disponible ?? '—', icono: ICONOS.tarjeta, color: '#FCA5A5', to: '/tarjetas' },
        ]} />
        <Panel titulo="Últimos movimientos" icono={ICONOS.entrada} accion={<Link to="/visitas" className="text-xs font-medium text-brand-light hover:underline">Ver todos →</Link>}>
          <ListaMovimientos items={feed.slice(0, 4)} />
        </Panel>
      </div>

      <FilaKpis tendencia={tendencia} resumen={resumen} sinCama={sinCama.length}
        onAislados={() => setVerAislados(true)} onSinCama={() => setVerSinCama(true)} />

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
        <TendenciaVisitas serie={serie} />
        <Panel titulo="Visitantes dentro, por piso" icono={ICONOS.edificio} accion={<span className="text-xs text-gray-500">{resumen?.activas ?? 0} en total</span>}>
          <ListaPisos pisos={porPiso} />
        </Panel>
        <Panel titulo="Tarjetas de acceso" icono={ICONOS.tarjeta}>
          <DonaTarjetas disponible={inv?.disponible ?? 0} enUso={inv?.en_uso ?? 0} inactiva={inv?.inactiva ?? 0} />
        </Panel>
      </div>


      <ConsultaVisitas />

      <ModalSinCama abierto={verSinCama} pacientes={sinCama} onCerrar={() => setVerSinCama(false)} />
      {verAislados && <ModalAislados onCerrar={() => setVerAislados(false)} />}
    </div>
  )
}
