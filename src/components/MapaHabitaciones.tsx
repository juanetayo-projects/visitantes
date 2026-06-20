import { useEffect, useMemo, useRef, useState } from 'react'
import { getOcupacionPiso, estadoCelda, type EstadoCelda } from '../lib/data'
import type { OcupacionUbicacion, TipoAislamiento } from '../lib/types'

const ESTILO: Record<EstadoCelda, { bg: string; bd: string; tx: string; icon: string; label: string }> = {
  permanente: { bg: 'bg-emerald-50', bd: 'border-emerald-500', tx: 'text-emerald-800', icon: 'M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z', label: 'Acompañante permanente' },
  visita:     { bg: 'bg-amber-50',   bd: 'border-amber-500',   tx: 'text-amber-800',   icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', label: 'Visita en curso' },
  solo:       { bg: 'bg-brand-50',   bd: 'border-brand-light', tx: 'text-brand',       icon: 'M3 12h18M3 7h18M3 17h18', label: 'Paciente solo (cupo libre)' },
  libre:      { bg: 'bg-gray-100',   bd: 'border-gray-300',    tx: 'text-gray-500',    icon: 'M5 12h14', label: 'Cama / cupo libre' },
}

const AISL_LABEL: Record<TipoAislamiento, string> = {
  contacto: 'Contacto', gotas: 'Gotas', aereo: 'Aéreo', protector: 'Protector', estricto: 'Estricto',
}

function horaCorta(iso: string | null): string {
  if (!iso) return '—'
  const co = new Date(new Date(iso).getTime() - 5 * 3_600_000)
  return co.toISOString().substring(11, 16)
}

function Icono({ d, className }: { d: string; className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={d} /></svg>
}

const ICON_VIRUS = 'M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10l2 2m0-14l-2 2M7 17l-2 2M12 8a4 4 0 100 8 4 4 0 000-8z'

export default function MapaHabitaciones({ pisoId, onSelect, refreshKey = 0 }: {
  pisoId: string
  onSelect?: (o: OcupacionUbicacion) => void
  refreshKey?: number
}) {
  const [ocup, setOcup] = useState<OcupacionUbicacion[]>([])
  const [loading, setLoading] = useState(true)
  const [tip, setTip] = useState<{ o: OcupacionUbicacion; x: number; y: number } | null>(null)
  const cont = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let vivo = true
    setLoading(true)
    getOcupacionPiso(pisoId).then((d) => { if (vivo) { setOcup(d); setLoading(false) } })
    return () => { vivo = false }
  }, [pisoId, refreshKey])

  // Agrupa por área (Urgencias) o un único grupo
  const grupos = useMemo(() => {
    const m = new Map<string, OcupacionUbicacion[]>()
    ocup.forEach((o) => {
      const k = o.area ?? '__'
      const arr = m.get(k) ?? []; arr.push(o); m.set(k, arr)
    })
    return Array.from(m.entries())
  }, [ocup])

  function mostrarTip(o: OcupacionUbicacion, el: HTMLElement) {
    if (!o.num_ingreso || !cont.current) return
    const cb = cont.current.getBoundingClientRect()
    const eb = el.getBoundingClientRect()
    let x = eb.left - cb.left
    const y = eb.top - cb.top + eb.height + 8
    if (x + 260 > cb.width) x = Math.max(4, cb.width - 264)
    setTip({ o, x, y })
  }

  if (loading) return <div className="grid place-items-center py-16 text-brand text-sm">Cargando mapa…</div>

  return (
    <div ref={cont} className="relative">
      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4 text-xs text-gray-600">
        {(['permanente', 'visita', 'solo', 'libre'] as EstadoCelda[]).map((e) => (
          <span key={e} className="flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded-sm border-2 ${ESTILO[e].bg} ${ESTILO[e].bd}`} />
            {ESTILO[e].label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-rose-600">
          <Icono d={ICON_VIRUS} className="h-4 w-4" /> Aislamiento
        </span>
      </div>

      {grupos.map(([area, items]) => (
        <div key={area} className="mb-5">
          {area !== '__' && <div className="mb-2 text-sm font-semibold text-brand">{area}</div>}
          <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))' }}>
            {items.map((o) => {
              const est = estadoCelda(o)
              const s = ESTILO[est]
              return (
                <button
                  key={o.ubicacion_id}
                  onMouseEnter={(e) => mostrarTip(o, e.currentTarget)}
                  onMouseLeave={() => setTip(null)}
                  onClick={() => onSelect?.(o)}
                  className={`relative text-left rounded-lg border-2 ${s.bg} ${s.bd} px-2.5 py-2 transition hover:-translate-y-0.5 hover:shadow-card ${o.aislamiento ? 'ring-2 ring-rose-500 ring-offset-1' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[13px] font-semibold ${s.tx}`}>{o.etiqueta}</span>
                    {o.aislamiento
                      ? <Icono d={ICON_VIRUS} className="h-4 w-4 text-rose-600" />
                      : <Icono d={s.icon} className={`h-4 w-4 ${s.tx} opacity-80`} />}
                  </div>
                  {est !== 'libre'
                    ? <>
                        <div className={`mt-0.5 text-[11px] ${s.tx} truncate`}>{o.paciente_nombre}</div>
                        <div className="mt-1 flex gap-1">
                          {Array.from({ length: o.cupo }).map((_, i) => (
                            <span key={i} className={`h-1.5 w-1.5 rounded-full border ${ESTILO[est].bd} ${i < o.visitas.length ? 'bg-current ' + s.tx : ''}`} />
                          ))}
                        </div>
                      </>
                    : <div className="mt-0.5 text-[11px] text-gray-400">Disponible</div>}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {/* Tooltip estilo Odoo */}
      {tip && (
        <div className="hab-tip absolute z-30 w-64 rounded-lg border border-gray-200 bg-white p-3 pointer-events-none"
          style={{ left: tip.x, top: tip.y }}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-brand">{tip.o.etiqueta}</span>
            {tip.o.aislamiento && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700">
                <Icono d={ICON_VIRUS} className="h-3 w-3" /> Aislamiento {AISL_LABEL[tip.o.aislamiento]}
              </span>
            )}
          </div>
          <div className="mt-1 text-[12px] font-medium text-gray-800">{tip.o.paciente_nombre}{tip.o.edad ? ` · ${tip.o.edad} a.` : ''}</div>
          <div className="text-[11px] text-gray-500"># ingreso {tip.o.num_ingreso}</div>
          <div className="mt-2 space-y-1.5">
            {tip.o.visitas.length === 0
              ? <div className="border-t border-gray-100 pt-1.5 text-[12px] text-gray-500">Sin visitantes · cupo libre</div>
              : tip.o.visitas.map((v) => (
                <div key={v.visita_id} className="flex items-center justify-between gap-2 border-t border-gray-100 pt-1.5">
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium text-gray-800 truncate">{v.visitante_nombre}</div>
                    <div className="text-[11px] text-gray-500">{horaCorta(v.hora_ingreso)} · {v.tarjeta_codigo ?? 'sin tarjeta'}</div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${v.tipo_acompanante === 'permanente' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {v.tipo_acompanante === 'permanente' ? 'Permanente' : 'Visita'}
                  </span>
                </div>
              ))}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
            <span>Cupo {tip.o.visitas.length}/{tip.o.cupo}</span>
            {onSelect && <span className="text-brand-light">Clic para registrar</span>}
          </div>
        </div>
      )}
    </div>
  )
}
