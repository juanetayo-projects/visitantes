import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="text-2xl font-semibold text-brand">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export type CardColor = 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'teal'

const GRAD: Record<CardColor, string> = {
  blue: 'from-[#0D2D6B] to-[#16468E]',
  green: 'from-emerald-500 to-emerald-600',
  red: 'from-rose-500 to-rose-600',
  amber: 'from-amber-400 to-amber-500',
  purple: 'from-violet-500 to-violet-600',
  teal: 'from-teal-500 to-cyan-600',
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

export function FilterBar({ children, onClear }: { children: ReactNode; onClear?: () => void }) {
  return (
    <div className="mb-5 rounded-2xl bg-white p-4 shadow-neu">
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
      <div className="flex flex-nowrap items-end gap-2 overflow-x-auto pb-1">{children}</div>
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

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white shadow-neu ${className}`}>{children}</div>
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
