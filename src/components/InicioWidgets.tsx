import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import type { FeedItem, PuntoEventos } from '../lib/data'

// Colores de identidad: validados con la herramienta de paleta (contraste y daltonismo).
export const COLOR_INGRESOS = '#2E6FD1'
export const COLOR_SALIDAS = '#0E9488'
const COLOR_NEUTRO = '#CBD5E1'

export function Icono({ d, className = 'h-5 w-5' }: { d: string; className?: string }) {
  return <svg className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={d} /></svg>
}

export const ICONOS = {
  personas: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1a4 4 0 100-8 4 4 0 000 8z',
  entrada: 'M11 16l4-4m0 0l-4-4m4 4H3m8-8h6a2 2 0 012 2v12a2 2 0 01-2 2h-6',
  salida: 'M17 16l4-4m0 0l-4-4m4 4H7m6 8H6a2 2 0 01-2-2V6a2 2 0 012-2h7',
  tarjeta: 'M3 10h18M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  check: 'M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z',
  alerta: 'M12 9v4m0 4h.01M10.3 3.86l-8 14A2 2 0 004 21h16a2 2 0 001.7-3.14l-8-14a2 2 0 00-3.4 0z',
  cama: 'M3 7v10M3 12h15a3 3 0 013 3v2M7 12V9a1 1 0 011-1h6a1 1 0 011 1v3',
  tendencia: 'M3 3v18h18M7 14l3-3 3 3 5-5',
  mapa: 'M9 20l-5-2V6l5 2m0 12l6-2m-6 2V8m6 10l5-2V4l-5 2m0 12V6',
  mas: 'M12 5v14M5 12h14',
  edificio: 'M4 21V5a2 2 0 012-2h8a2 2 0 012 2v16M16 9h2a2 2 0 012 2v10M3 21h18M8 7h4M8 11h4M8 15h4',
}

// ── Línea de tendencia pequeña, con el valor de cada día al pasar el cursor ──
function Sparkline({ serie, color, etiqueta }: { serie: { fecha: string; n: number }[]; color: string; etiqueta: string }) {
  const [activo, setActivo] = useState<number | null>(null)
  if (serie.length < 2) return null // aún cargando: no hay línea que dibujar
  const ANCHO = 120, ALTO = 44
  const max = Math.max(1, ...serie.map((p) => p.n))
  const puntos = serie.map((p, i) => [(i / Math.max(1, serie.length - 1)) * ANCHO, ALTO - 4 - (p.n / max) * (ALTO - 10)])
  const linea = puntos.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const p = activo != null ? serie[activo] : null
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="h-11 w-28" role="img" aria-label={`${etiqueta}: últimos ${serie.length} días`}
        onMouseLeave={() => setActivo(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setActivo(Math.min(serie.length - 1, Math.max(0, Math.round(((e.clientX - r.left) / r.width) * (serie.length - 1)))))
        }}>
        <path d={`${linea} L${ANCHO} ${ALTO} L0 ${ALTO} Z`} fill={color} fillOpacity={0.12} />
        <path d={linea} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {activo != null && <circle cx={puntos[activo][0]} cy={puntos[activo][1]} r={3.5} fill={color} stroke="#fff" strokeWidth={2} />}
      </svg>
      {p && (
        <div className="pointer-events-none absolute -top-8 right-0 z-10 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[11px] text-white">
          {p.fecha.slice(8)}/{p.fecha.slice(5, 7)}: <b>{p.n}</b>
        </div>
      )}
    </div>
  )
}

const TONO = {
  azul: 'bg-blue-100 text-blue-700',
  verde: 'bg-emerald-100 text-emerald-700',
  rojo: 'bg-rose-100 text-rose-700',
  ambar: 'bg-amber-100 text-amber-700',
  teal: 'bg-teal-100 text-teal-700',
  gris: 'bg-gray-100 text-gray-600',
}
const BARRA = { azul: 'bg-blue-500', verde: 'bg-emerald-500', rojo: 'bg-rose-500', ambar: 'bg-amber-500', teal: 'bg-teal-500', gris: 'bg-gray-400' }

// ── Tarjeta de indicador: ícono, valor y, si hay datos para ello, tendencia o proporción ──
export function KpiCard({ titulo, valor, detalle, icono, tono, serie, colorSerie, proporcion, onClick }: {
  titulo: string
  valor: ReactNode
  detalle?: string
  icono: string
  tono: keyof typeof TONO
  serie?: { fecha: string; n: number }[]
  colorSerie?: string
  proporcion?: number // 0..1
  onClick?: () => void
}) {
  const contenido = (
    <>
      <div className="flex items-start gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${TONO[tono]}`}><Icono d={icono} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-gray-500">{titulo}</div>
          <div className="text-[28px] font-bold leading-tight tabular-nums text-gray-900">{valor}</div>
          {detalle && <div className="mt-0.5 text-xs text-gray-500">{detalle}</div>}
        </div>
        {serie && <Sparkline serie={serie} color={colorSerie ?? COLOR_INGRESOS} etiqueta={titulo} />}
      </div>
      {proporcion != null && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100" role="presentation">
          <div className={`h-full rounded-full ${BARRA[tono]}`} style={{ width: `${Math.min(100, Math.round(proporcion * 100))}%` }} />
        </div>
      )}
    </>
  )
  const cls = 'block h-full w-full rounded-2xl bg-white p-4 text-left shadow-neu-sm'
  return onClick
    ? <button onClick={onClick} className={`${cls} transition hover:-translate-y-0.5 hover:shadow-neu`}>{contenido}</button>
    : <div className={cls}>{contenido}</div>
}

export function Panel({ titulo, icono, accion, children, className = '' }: { titulo: string; icono?: string; accion?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col rounded-2xl bg-white p-5 shadow-neu-sm ${className}`}>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
          {icono && <Icono d={icono} className="h-5 w-5 text-brand-light" />}{titulo}
        </h2>
        {accion}
      </header>
      {children}
    </section>
  )
}

// ── Panel principal: saludo e indicadores del día sobre la imagen ──
function saludo() {
  const h = new Date(Date.now() - 5 * 3_600_000).getUTCHours()
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
}

export function HeroInicio({ nombre, indicadores }: {
  nombre?: string | null
  indicadores: { titulo: string; valor: ReactNode; icono: string; color: string; to?: string }[]
}) {
  const fecha = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' })
  return (
    <section className="relative min-h-[240px] overflow-hidden rounded-2xl shadow-neu-sm xl:col-span-2">
      <img src={`${import.meta.env.BASE_URL}images/quirofano.webp`} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-[70%_35%]" />
      <div className="absolute inset-0 bg-gradient-to-r from-brand from-25% via-brand/85 via-55% to-brand/40" />
      <div className="relative flex h-full flex-col justify-between gap-5 p-6 text-white">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-sky-200">{saludo()}{nombre ? `, ${nombre.split(' ')[0]}` : ''}</p>
          <h1 className="mt-1 text-2xl font-bold leading-tight">Control de visitantes de hoy</h1>
          <p className="text-sm first-letter:uppercase text-white/80">{fecha}</p>
        </div>
        <div className="grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4">
          {indicadores.map((k) => {
            const interior = (
              <>
                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-white/85">
                  <span style={{ color: k.color }}><Icono d={k.icono} className="h-3.5 w-3.5" /></span> {k.titulo}
                </span>
                <span className="mt-0.5 block text-2xl font-bold tabular-nums">{k.valor}</span>
              </>
            )
            const cls = 'rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-sm'
            return k.to
              ? <Link key={k.titulo} to={k.to} className={`${cls} transition hover:bg-white/20`}>{interior}</Link>
              : <div key={k.titulo} className={cls}>{interior}</div>
          })}
        </div>
      </div>
    </section>
  )
}

// ── Últimos movimientos ──
function horaCorta(iso: string): string {
  const co = new Date(new Date(iso).getTime() - 5 * 3_600_000)
  const hoy = new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10)
  const dia = co.toISOString().slice(0, 10)
  let h = co.getUTCHours(); const m = String(co.getUTCMinutes()).padStart(2, '0')
  const ap = h < 12 ? 'a.m.' : 'p.m.'; h = h % 12 === 0 ? 12 : h % 12
  return `${dia === hoy ? 'Hoy' : `${dia.slice(8)}/${dia.slice(5, 7)}`} · ${h}:${m} ${ap}`
}

export function ListaMovimientos({ items }: { items: FeedItem[] }) {
  if (!items.length) return <p className="flex flex-1 items-center justify-center py-8 text-center text-sm text-gray-400">Todavía no hay movimientos registrados.</p>
  return (
    <ul className="-mx-2 flex-1 divide-y divide-gray-100">
      {items.map((e, i) => (
        <li key={`${e.hora}-${i}`} className="flex items-center gap-3 px-2 py-2">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${e.tipo === 'ingreso' ? TONO.azul : TONO.teal}`}><Icono d={e.tipo === 'ingreso' ? ICONOS.entrada : ICONOS.salida} className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-gray-800">{e.visitante}</span>
            <span className="block truncate text-xs text-gray-500">{horaCorta(e.hora)}{e.ubicacion ? ` · ${e.ubicacion}` : ''}</span>
          </span>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${e.tipo === 'ingreso' ? TONO.azul : TONO.teal}`}>{e.tipo === 'ingreso' ? 'Ingreso' : 'Salida'}</span>
        </li>
      ))}
    </ul>
  )
}

// ── Ingresos y salidas por día ──
const RANGOS = [7, 30, 90] as const
export function TendenciaVisitas({ serie }: { serie: PuntoEventos[] }) {
  const [dias, setDias] = useState<(typeof RANGOS)[number]>(30)
  const datos = useMemo(() => serie.slice(-dias), [serie, dias])
  const vacio = datos.every((d) => !d.ingresos && !d.salidas)
  const fmt = (f: string) => `${f.slice(8)}/${f.slice(5, 7)}`
  const opcion = useMemo(() => ({
    animation: false,
    grid: { left: 32, right: 12, top: 34, bottom: 24 },
    legend: { top: 0, right: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { color: '#475569', fontSize: 12 }, data: ['Ingresos', 'Salidas'] },
    tooltip: { trigger: 'axis', backgroundColor: '#111827', borderWidth: 0, textStyle: { color: '#fff', fontSize: 12 }, axisPointer: { type: 'line', lineStyle: { color: '#94A3B8' } } },
    xAxis: { type: 'category', boundaryGap: false, data: datos.map((d) => fmt(d.fecha)), axisLine: { lineStyle: { color: '#E2E8F0' } }, axisTick: { show: false }, axisLabel: { color: '#64748B', fontSize: 11, hideOverlap: true } },
    yAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: '#F1F5F9' } }, axisLabel: { color: '#64748B', fontSize: 11 } },
    series: [
      { name: 'Ingresos', type: 'line', data: datos.map((d) => d.ingresos), showSymbol: false, symbolSize: 8, lineStyle: { width: 2, color: COLOR_INGRESOS }, itemStyle: { color: COLOR_INGRESOS }, areaStyle: { color: COLOR_INGRESOS, opacity: 0.08 } },
      { name: 'Salidas', type: 'line', data: datos.map((d) => d.salidas), showSymbol: false, symbolSize: 8, lineStyle: { width: 2, color: COLOR_SALIDAS }, itemStyle: { color: COLOR_SALIDAS } },
    ],
  }), [datos])
  return (
    <Panel titulo="Ingresos y salidas de visitantes" icono={ICONOS.tendencia} className="xl:col-span-2"
      accion={
        <div role="group" aria-label="Periodo" className="flex gap-1 rounded-full bg-gray-100 p-1">
          {RANGOS.map((r) => (
            <button key={r} aria-pressed={dias === r} onClick={() => setDias(r)}
              className={`rounded-full px-3 py-0.5 text-xs font-medium transition ${dias === r ? 'bg-white text-brand shadow-sm' : 'text-gray-500 hover:text-brand'}`}>{r} días</button>
          ))}
        </div>
      }>
      <div className="relative">
        <ReactECharts option={opcion} notMerge style={{ height: 260 }} />
        {vacio && <div className="pointer-events-none absolute inset-0 grid place-items-center pt-6 text-center text-sm text-gray-500"><span className="rounded-lg bg-white/90 px-3 py-1.5">Sin ingresos ni salidas registrados en estos {dias} días.</span></div>}
      </div>
    </Panel>
  )
}

// ── Estado de las tarjetas de acceso ──
export function DonaTarjetas({ disponible, enUso, inactiva }: { disponible: number; enUso: number; inactiva: number }) {
  const total = disponible + enUso + inactiva
  const partes = [
    { label: 'Disponibles', n: disponible, color: COLOR_SALIDAS },
    { label: 'En uso', n: enUso, color: COLOR_INGRESOS },
    { label: 'Inactivas', n: inactiva, color: COLOR_NEUTRO },
  ]
  const R = 42, C = 2 * Math.PI * R
  const huecos = partes.filter((p) => p.n > 0).length > 1 ? 1.5 : 0
  let acumulado = 0
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={`${disponible} tarjetas disponibles de ${total}`}>
          <circle cx="50" cy="50" r={R} fill="none" stroke="#F1F5F9" strokeWidth="11" />
          {total > 0 && partes.map((p) => {
            const largo = (p.n / total) * C
            const seg = p.n > 0 && (
              <circle key={p.label} cx="50" cy="50" r={R} fill="none" stroke={p.color} strokeWidth="11"
                strokeDasharray={`${Math.max(0, largo - huecos)} ${C}`} strokeDashoffset={-acumulado}>
                <title>{p.label}: {p.n}</title>
              </circle>
            )
            acumulado += largo
            return seg
          })}
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <div className="text-2xl font-bold leading-none tabular-nums text-gray-900">{total ? Math.round((disponible / total) * 100) : 0}%</div>
          <div className="mt-0.5 text-[11px] text-gray-500">disponibles</div>
        </div>
      </div>
      <ul className="min-w-[130px] flex-1 space-y-2 text-sm">
        {partes.map((p) => (
          <li key={p.label} className="flex items-center justify-between gap-3 text-gray-600">
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />{p.label}</span>
            <b className="tabular-nums text-gray-900">{p.n}</b>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Visitantes dentro, por piso ──
export function ListaPisos({ pisos }: { pisos: { piso: string; n: number }[] }) {
  if (!pisos.length) return <p className="flex flex-1 items-center justify-center py-8 text-center text-sm text-gray-400">No hay visitantes dentro en este momento.</p>
  const max = Math.max(...pisos.map((p) => p.n))
  return (
    <ul className="flex-1 space-y-3">
      {pisos.map((p) => (
        <li key={p.piso}>
          <div className="mb-1 flex items-center justify-between text-sm"><span className="truncate text-gray-700">{p.piso}</span><b className="tabular-nums text-gray-900">{p.n}</b></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100" role="presentation"><div className="h-full rounded-full" style={{ width: `${(p.n / max) * 100}%`, background: COLOR_INGRESOS }} /></div>
        </li>
      ))}
    </ul>
  )
}
