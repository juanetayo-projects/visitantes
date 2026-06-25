import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

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
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${GRAD[color]} p-5 text-white shadow-card`}>
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
    <div className="mb-5 rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-brand font-semibold text-sm">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18l-7 9v6l-4 2v-8z" /></svg>
          Filtros
        </div>
        {onClear && (
          <button onClick={onClear} className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 9a8 8 0 0114-3M20 15a8 8 0 01-14 3" /></svg>
            Limpiar
          </button>
        )}
      </div>
      <div className="flex flex-nowrap items-end gap-2 overflow-x-auto pb-1">{children}</div>
    </div>
  )
}

export const selectCls = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-light focus:ring-1 focus:ring-brand-light outline-none min-w-[140px] shrink-0'
export const inputCls = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-light focus:ring-1 focus:ring-brand-light outline-none w-full'

// Select con buscador (combobox). Útil para listas largas (p.ej. ubicaciones).
export function SearchableSelect({ value, onChange, options, placeholder = '— Selecciona —' }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const sel = options.find((o) => o.value === value)
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? options.filter((o) => o.label.toLowerCase().includes(t)) : options
  }, [q, options])
  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc); return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => { setOpen((o) => !o); setQ('') }} className={`${inputCls} flex items-center justify-between gap-2 text-left`}>
        <span className={`truncate ${sel ? 'text-gray-700' : 'text-gray-400'}`}>{sel?.label ?? placeholder}</span>
        <svg className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
          <div className="p-2">
            <input autoFocus className={inputCls} placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="max-h-60 overflow-y-auto pb-1">
            <button type="button" onClick={() => { onChange(''); setOpen(false) }} className="block w-full px-3 py-1.5 text-left text-sm text-gray-400 hover:bg-gray-50">— Sin asignar —</button>
            {filtered.map((o) => (
              <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false) }}
                className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-brand-50 ${o.value === value ? 'bg-brand-50 font-medium text-brand' : 'text-gray-700'}`}>{o.label}</button>
            ))}
            {filtered.length === 0 && <div className="px-3 py-2 text-sm text-gray-400">Sin coincidencias</div>}
          </div>
        </div>
      )}
    </div>
  )
}

export function Btn({ children, onClick, type = 'button', variant = 'primary', disabled, className = '' }: {
  children: ReactNode; onClick?: () => void; type?: 'button' | 'submit'; variant?: 'primary' | 'ghost' | 'danger' | 'light'; disabled?: boolean; className?: string
}) {
  const base = 'rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-60'
  const v = {
    primary: 'bg-brand text-white hover:bg-brand-light shadow',
    light: 'bg-brand-50 text-brand hover:bg-brand-100',
    ghost: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  }[variant]
  return <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${v} ${className}`}>{children}</button>
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white shadow-card ring-1 ring-black/5 ${className}`}>{children}</div>
}

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-md' }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; maxWidth?: string
}) {
  if (!open) return null
  return (
    <div className="modal-overlay fixed inset-0 z-50 grid place-items-center bg-[#061536]/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className={`modal-panel w-full ${maxWidth} overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5`} onClick={(e) => e.stopPropagation()}>
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
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${c}`}>{children}</span>
}
