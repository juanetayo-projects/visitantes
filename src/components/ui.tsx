import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function PageHeader({ title, subtitle, action, contador }: { title: string; subtitle?: string; action?: ReactNode; contador?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold text-brand">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {(contador || action) && <div className="flex items-center gap-4">{contador}{action}</div>}
    </div>
  )
}

// Tarjeta circular con el número de registros de la tabla (va en el encabezado de la página).
export function ContadorCircular({ valor, etiqueta, de }: { valor: ReactNode; etiqueta: string; de?: number }) {
  return (
    <div title={de !== undefined ? `${valor} de ${de} ${etiqueta}` : `${valor} ${etiqueta}`}
      className="grid h-[84px] w-[84px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#0D2D6B] to-[#16468E] p-[3px] shadow-neu transition hover:from-[#16468E] hover:to-[#2563A8]">
      <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white text-center transition-colors hover:bg-brand-50">
        <span className="text-xl font-bold leading-none text-brand">{valor}</span>
        <span className="mt-1 text-[10px] font-medium uppercase leading-tight tracking-wide text-gray-500">{etiqueta}</span>
        {de !== undefined && <span className="text-[10px] leading-tight text-gray-400">de {de}</span>}
      </div>
    </div>
  )
}

export type CardColor = 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'teal'

const GRAD: Record<CardColor, string> = {
  blue: 'from-[#0D2D6B] to-[#16468E] hover:from-[#16468E] hover:to-[#2563A8]',
  green: 'from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700',
  red: 'from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700',
  amber: 'from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600',
  purple: 'from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700',
  teal: 'from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700',
}

export function MetricCard({ label, value, hint, color = 'blue', icon }: {
  label: string; value: ReactNode; hint?: string; color?: CardColor; icon?: ReactNode
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${GRAD[color]} p-5 text-white shadow-neu`}>
      <div className="pointer-events-none absolute -right-6 -bottom-8 h-28 w-28 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute right-6 -bottom-2 h-16 w-16 rounded-full bg-white/10" />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-white/90">{label}</p>
          <p className="mt-1 text-3xl font-bold leading-tight">{value}</p>
          {hint && <p className="mt-0.5 text-xs text-white/80">{hint}</p>}
        </div>
        {icon && <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/20">{icon}</div>}
      </div>
    </div>
  )
}

export function FilterBar({ children, onClear, vertical = false }: { children: ReactNode; onClear?: () => void; vertical?: boolean }) {
  return (
    <div className={vertical ? 'rounded-2xl bg-white p-4 shadow-neu-sm' : 'mb-5 rounded-2xl bg-white p-4 shadow-neu'}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-brand font-semibold text-sm">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18l-7 9v6l-4 2v-8z" /></svg>
          Filtros
        </div>
        {onClear && (
          <button onClick={onClear} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 transition hover:text-brand active:shadow-neu-inset-sm">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 9a8 8 0 0114-3M20 15a8 8 0 01-14 3" /></svg>
            Limpiar
          </button>
        )}
      </div>
      <div className={vertical ? 'filtros-columna' : 'filtros-linea'}>{children}</div>
    </div>
  )
}

export const selectCls = 'rounded-xl bg-neu-inset px-3 py-2 text-sm text-gray-700 shadow-neu-inset-sm focus:shadow-neu-inset focus:ring-1 focus:ring-brand-light/40 outline-none min-w-[140px] shrink-0 transition-shadow'
export const inputCls = 'rounded-xl bg-neu-inset px-3 py-2 text-sm text-gray-700 shadow-neu-inset-sm focus:shadow-neu-inset focus:ring-1 focus:ring-brand-light/40 outline-none w-full transition-shadow'
export const textareaCls = inputCls + ' resize-none'

// Combobox con buscador. Escribes para filtrar; teclado ↑↓/Enter/Esc. El panel
// se renderiza en portal con posición fija para que el modal no lo recorte.
export function SearchableSelect({ value, onChange, options, placeholder = '— Selecciona —' }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const sel = options.find((o) => o.value === value)

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (t ? options.filter((o) => o.label.toLowerCase().includes(t)) : options).slice(0, 200)
  }, [q, options])

  const place = () => { const el = boxRef.current; if (el) { const r = el.getBoundingClientRect(); setRect({ left: r.left, top: r.bottom + 4, width: r.width }) } }
  const abrir = () => { setQ(''); setHi(0); place(); setOpen(true) }
  const pick = (v: string) => { onChange(v); setOpen(false) }

  useEffect(() => {
    if (!open) return
    const reposo = () => place()
    const onDown = (e: MouseEvent) => {
      if (boxRef.current?.contains(e.target as Node) || popRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    window.addEventListener('scroll', reposo, true); window.addEventListener('resize', reposo); document.addEventListener('mousedown', onDown)
    return () => { window.removeEventListener('scroll', reposo, true); window.removeEventListener('resize', reposo); document.removeEventListener('mousedown', onDown) }
  }, [open])

  const onKey = (e: any) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) abrir(); else setHi((h: number) => Math.min(h + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h: number) => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { if (open && filtered[hi]) { e.preventDefault(); pick(filtered[hi].value) } }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  return (
    <div ref={boxRef} className="relative">
      <input className={`${inputCls} pr-8`} value={open ? q : (sel?.label ?? '')} placeholder={sel?.label ?? placeholder}
        onFocus={abrir} onChange={(e) => { setQ(e.target.value); setHi(0); if (!open) abrir() }} onKeyDown={onKey} />
      <span className="pointer-events-none absolute inset-y-0 right-2 grid place-items-center text-gray-400">
        <svg className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" /></svg>
      </span>
      {open && rect && createPortal(
        <div ref={popRef} style={{ position: 'fixed', left: rect.left, top: rect.top, width: rect.width, zIndex: 60 }}
          className="max-h-64 overflow-y-auto rounded-xl bg-white shadow-neu">
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick('')} className="block w-full px-3 py-1.5 text-left text-sm text-gray-400 hover:bg-gray-50">— Sin asignar —</button>
          {filtered.map((o, i) => (
            <button key={o.value} type="button" onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setHi(i)} onClick={() => pick(o.value)}
              className={`block w-full px-3 py-1.5 text-left text-sm ${i === hi ? 'bg-brand-50 text-brand' : 'text-gray-700'} ${o.value === value ? 'font-medium' : ''}`}>{o.label}</button>
          ))}
          {filtered.length === 0 && <div className="px-3 py-2 text-sm text-gray-400">Sin coincidencias</div>}
        </div>, document.body)}
    </div>
  )
}

export function Btn({ children, onClick, type = 'button', variant = 'primary', disabled, className = '' }: {
  children: ReactNode; onClick?: () => void; type?: 'button' | 'submit'; variant?: 'primary' | 'ghost' | 'danger' | 'light'; disabled?: boolean; className?: string
}) {
  const base = 'rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none'
  const v = {
    primary: 'bg-brand text-white shadow-neu-sm hover:shadow-neu hover:brightness-110 active:scale-[0.97] active:shadow-neu-xs',
    light: 'bg-white text-brand shadow-neu-sm hover:shadow-neu active:shadow-neu-inset-sm',
    ghost: 'bg-white text-gray-600 shadow-neu-sm hover:shadow-neu active:shadow-neu-inset-sm',
    danger: 'bg-red-600 text-white shadow-neu-sm hover:shadow-neu hover:brightness-110 active:scale-[0.97] active:shadow-neu-xs',
  }[variant]
  return <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${v} ${className}`}>{children}</button>
}

export function Tabs<T extends string>({ tabs, value, onChange }: {
  tabs: { value: T; label: string; badge?: number }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div role="tablist" className="mb-5 flex flex-wrap gap-2">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm transition-all duration-150 ${value === t.value ? 'bg-brand font-medium text-white shadow-neu-sm' : 'bg-white text-gray-600 shadow-neu-xs hover:shadow-neu-sm hover:text-brand'}`}>
          {t.label}
          {!!t.badge && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${value === t.value ? 'bg-white/25 text-white' : 'bg-rose-100 text-rose-700'}`}>{t.badge}</span>}
        </button>
      ))}
    </div>
  )
}

// hover={false} en las que contienen tablas o formularios: el color de fondo distraería al leerlas.
export function Card({ children, className = '', hover = true, style }: { children: ReactNode; className?: string; hover?: boolean; style?: CSSProperties }) {
  return <div style={style} className={`rounded-2xl bg-white shadow-neu ${hover ? 'transition-colors hover:bg-brand-50/60' : ''} ${className}`}>{children}</div>
}

// Contenido principal a la izquierda y barra lateral derecha con indicadores y filtros.
// La barra queda fija al desplazar la página; en pantallas angostas pasa arriba del contenido.
export function ConLateral({ lateral, children }: { lateral: ReactNode; children: ReactNode }) {
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="order-2 min-w-0 xl:order-1">{children}</div>
      <aside className="order-1 min-w-0 space-y-4 xl:sticky xl:top-[68px] xl:order-2 xl:max-h-[calc(100vh-84px)] xl:overflow-y-auto xl:overscroll-contain xl:p-1">{lateral}</aside>
    </div>
  )
}

const TONO_IND: Record<CardColor, string> = {
  blue: 'bg-blue-100 text-blue-700', green: 'bg-emerald-100 text-emerald-700', red: 'bg-rose-100 text-rose-700',
  amber: 'bg-amber-100 text-amber-700', purple: 'bg-violet-100 text-violet-700', teal: 'bg-teal-100 text-teal-700',
}
export const ICONOS_IND = {
  total: 'M4 6h16M4 12h16M4 18h16',
  recibido: 'M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4m16 0h-5l-1 2h-4l-1-2H4',
  atendido: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  pendiente: 'M12 7v5l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z',
  calendario: 'M8 3v4m8-4v4M4 11h16M5 7h14a1 1 0 011 1v11a2 2 0 01-2 2H6a2 2 0 01-2-2V8a1 1 0 011-1z',
  pico: 'M3 17l5-5 4 4 8-9',
  alerta: 'M12 9v4m0 4h.01M10.3 3.86l-8 14A2 2 0 004 21h16a2 2 0 001.7-3.14l-8-14a2 2 0 00-3.4 0z',
  personas: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1a4 4 0 100-8 4 4 0 000 8z',
  actualizar: 'M4 4v5h5M20 20v-5h-5M4 9a8 8 0 0114-3M20 15a8 8 0 01-14 3',
  salida: 'M17 16l4-4m0 0l-4-4m4 4H7m6 8H6a2 2 0 01-2-2V6a2 2 0 012-2h7',
  cama: 'M3 7v10M3 12h15a3 3 0 013 3v2M7 12V9a1 1 0 011-1h6a1 1 0 011 1v3',
  base: 'M4 7c0 1.7 3.6 3 8 3s8-1.3 8-3-3.6-3-8-3-8 1.3-8 3zm0 0v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
}
export interface IndicadorItem { label: string; value: ReactNode; hint?: ReactNode; color?: CardColor; icono?: string; onClick?: () => void; activo?: boolean }

// Lista de indicadores para la barra lateral: cada fila cambia de color al pasar el mouse.
export function PanelIndicadores({ titulo, accion, items, children }: { titulo: string; accion?: ReactNode; items: IndicadorItem[]; children?: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-neu-sm">
      <header className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">{titulo}</h2>
        {accion}
      </header>
      {children}
      <ul className="-mx-1.5 space-y-0.5">
        {items.map((i) => {
          const contenido = (
            <>
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${TONO_IND[i.color ?? 'blue']}`}>
                <svg className="h-4 w-4" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={i.icono ?? ICONOS_IND.total} /></svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-gray-700">{i.label}</span>
                {i.hint && <span className="block text-xs text-gray-500">{i.hint}</span>}
              </span>
              <span className="shrink-0 text-lg font-bold tabular-nums text-gray-900">{i.value}</span>
            </>
          )
          const cls = `flex w-full items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-left transition-colors hover:bg-brand-50 ${i.activo ? 'bg-brand-50 ring-1 ring-brand-light/40' : ''}`
          return (
            <li key={i.label}>
              {i.onClick ? <button onClick={i.onClick} aria-pressed={i.activo} className={cls}>{contenido}</button> : <div className={cls}>{contenido}</div>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-md' }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; maxWidth?: string
}) {
  if (!open) return null
  return (
    <div className="modal-overlay fixed inset-0 z-50 grid place-items-center bg-[#061536]/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className={`modal-panel w-full ${maxWidth} overflow-hidden rounded-2xl bg-white shadow-neu`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-brand to-brand-light px-5 py-3.5">
          <div className="text-base font-semibold text-white">{title}</div>
          <button onClick={onClose} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white/80 transition hover:bg-white/20 hover:text-white" aria-label="Cerrar">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" /></svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function Badge({ children, color = 'gray' }: { children: ReactNode; color?: 'gray' | 'blue' | 'green' | 'amber' | 'red' }) {
  const c = {
    gray: 'bg-gray-100 text-gray-700',
    blue: 'bg-brand-50 text-brand',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-rose-50 text-rose-700',
  }[color]
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium shadow-neu-xs ${c}`}>{children}</span>
}

export interface ComentarioResumen { autor_nombre: string | null; comentario: string; created_at: string }

// Fecha/hora corta en Colombia (GMT-5) para el tooltip de comentarios: "16/07 03:49 p.m."
function fechaCortaCO(iso: string): string {
  const co = new Date(new Date(iso).getTime() - 5 * 3_600_000)
  const dd = String(co.getUTCDate()).padStart(2, '0'), mm = String(co.getUTCMonth() + 1).padStart(2, '0')
  let h = co.getUTCHours(); const min = String(co.getUTCMinutes()).padStart(2, '0')
  const ap = h < 12 ? 'a.m.' : 'p.m.'; h = h % 12 === 0 ? 12 : h % 12
  return `${dd}/${mm} ${h}:${min} ${ap}`
}

// Badge con la cantidad de comentarios/notas de un registro; al pasar el mouse muestra
// un tooltip con el detalle (autor, fecha, texto) de cada uno. El tooltip se pinta en un
// portal con posición fija (mismo truco que SearchableSelect) para que el overflow-x-auto
// de la tabla contenedora no lo recorte, especialmente en las últimas filas.
export function ComentariosBadge({ items }: { items: ComentarioResumen[] }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number; arriba: boolean } | null>(null)

  if (!items.length) return null

  function mostrar() {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const arriba = window.innerHeight - r.bottom < 220
    let left = r.left
    if (left + 288 > window.innerWidth) left = Math.max(4, window.innerWidth - 292)
    setPos({ left, top: arriba ? r.top - 6 : r.bottom + 6, arriba })
  }

  return (
    <>
      <span ref={ref} onMouseEnter={mostrar} onMouseLeave={() => setPos(null)}
        className="inline-flex cursor-default items-center gap-1 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white align-middle">
        <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8-1.06 0-2.077-.163-3.02-.463L3 21l1.395-3.72C3.512 16.132 3 14.62 3 13c0-4.418 4.03-8 9-8s9 3.582 9 7z" /></svg>
        {items.length}
      </span>
      {pos && createPortal(
        <div style={{ position: 'fixed', left: pos.left, top: pos.top, transform: pos.arriba ? 'translateY(-100%)' : undefined, zIndex: 60 }}
          className="pointer-events-none w-72 rounded-xl bg-white p-2 shadow-neu ring-1 ring-brand/20">
          <div className="max-h-56 space-y-1.5 overflow-y-auto pr-0.5 text-left">
            {items.map((c, i) => (
              <div key={i} className="rounded-lg border-l-4 border-brand-light bg-brand-50/60 px-2 py-1.5">
                <div className="flex items-center justify-between gap-2 text-[10px] text-gray-500">
                  <span className="font-medium text-gray-700">{c.autor_nombre ?? 'Usuario'}</span>
                  <span className="whitespace-nowrap">{fechaCortaCO(c.created_at)}</span>
                </div>
                <div className="mt-0.5 text-xs text-gray-700">{c.comentario}</div>
              </div>
            ))}
          </div>
        </div>, document.body)}
    </>
  )
}
