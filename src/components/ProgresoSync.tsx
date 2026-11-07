import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ejecutarSyncCenso } from '../lib/data'

// Vista de ejecución de la sincronización con el censo: cronómetro con anillo de avance,
// etapas y termómetro (mismo diseño que la consulta a GoMedisys de programacion_cx).
//
// La sincronización es una sola llamada a la Edge Function y no reporta etapas: mientras
// corre, el avance y las etapas se estiman por el tiempo transcurrido, y nunca llegan al
// 100 % ni a «Resultados» hasta que la función responde. Las cifras finales sí son reales.

export type EstadoSync = 'corriendo' | 'listo' | 'error'
export interface ResumenSync { total_censo?: number; pacientes_upsert?: number; altas?: number; aislamientos?: number; inconsistencias?: number }

const I = {
  enviar: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8',
  censo: 'M21 21l-4.3-4.3M11 19a8 8 0 100-16 8 8 0 000 16z',
  base: 'M4 7c0 1.7 3.6 3 8 3s8-1.3 8-3-3.6-3-8-3-8 1.3-8 3zm0 0v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  ok: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  error: 'M10 14l4-4m0 4l-4-4m11 2a9 9 0 11-18 0 9 9 0 0118 0z',
}
const Svg = ({ d, className = 'h-4 w-4' }: { d: string; className?: string }) => (
  <svg className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={d} /></svg>
)
const Giro = () => (
  <svg className="h-4 w-4 animate-spin" aria-hidden fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".3" strokeWidth="3" /><path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
)

const ETAPAS = [
  { icono: I.enviar, texto: 'Solicitud enviada' },
  { icono: I.censo, texto: 'Consultando el censo' },
  { icono: I.base, texto: 'Actualizando la base' },
  { icono: I.ok, texto: 'Resultados' },
]
const MENSAJES = [
  'Conectando con el censo hospitalario…',
  'Leyendo pacientes y ubicaciones…',
  'Cruzando camas con la homologación…',
  'Actualizando aislamientos y egresos…',
]

const mmss = (seg: number) => `${String(Math.floor(seg / 60)).padStart(2, '0')}:${String(seg % 60).padStart(2, '0')}`

export function ProgresoSync({ estado, inicio, fin, resumen, error, onCerrar }: {
  estado: EstadoSync; inicio: number; fin?: number; resumen?: ResumenSync; error?: string; onCerrar: () => void
}) {
  const [ahora, setAhora] = useState(Date.now())
  const cerrarRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (estado !== 'corriendo') { cerrarRef.current?.focus(); return }
    const t = setInterval(() => setAhora(Date.now()), 200)
    return () => clearInterval(t)
  }, [estado])
  useEffect(() => {
    if (estado === 'corriendo') return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [estado, onCerrar])

  const seg = Math.max(0, ((fin ?? ahora) - inicio) / 1000)
  const corriendo = estado === 'corriendo'
  const etapa = estado === 'listo' ? 3 : corriendo ? (seg < 1 ? 0 : seg < 3 ? 1 : 2) : Math.min(2, seg < 1 ? 0 : seg < 3 ? 1 : 2)
  // Se acerca a 95 % sin alcanzarlo: nunca se congela ni promete un final que no ha llegado.
  const pct = estado === 'listo' ? 100 : Math.round(95 * (1 - Math.exp(-seg / 4)))
  const R = 70, C = 2 * Math.PI * R
  const chips: { texto: string; valor?: number; alerta?: boolean }[] = [
    { texto: 'En el censo', valor: resumen?.total_censo },
    { texto: 'Actualizados', valor: resumen?.pacientes_upsert },
    { texto: 'Egresos', valor: resumen?.altas },
    { texto: 'Aislamientos', valor: resumen?.aislamientos },
    { texto: 'Inconsistencias', valor: resumen?.inconsistencias, alerta: true },
  ]

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071a40]/75 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-label="Sincronización del censo" aria-busy={corriendo}
        className="w-full max-w-xl overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-[#123b80] to-brand-light text-white shadow-2xl">
        <div className="flex flex-col items-center gap-5 px-6 pb-5 pt-7 sm:flex-row">
          <div className="relative h-44 w-44 shrink-0">
            <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90" aria-hidden>
              <circle cx="90" cy="90" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="12" />
              <circle cx="90" cy="90" r={R} fill="none" stroke={estado === 'error' ? '#fda4af' : 'url(#gradSync)'} strokeWidth="12" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
              <defs>
                <linearGradient id="gradSync" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#5eead4" /><stop offset="100%" stopColor="#38bdf8" /></linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-[22px] rounded-full bg-white/10 shadow-inner">
              {Array.from({ length: 12 }).map((_, i) => (
                <span key={i} className="absolute left-1/2 top-1 h-2 w-0.5 rounded bg-white/40" style={{ transform: `translateX(-50%) rotate(${i * 30}deg)`, transformOrigin: '50% 63px' }} />
              ))}
              <span className={`absolute bottom-1/2 left-1/2 h-[46px] w-1 -translate-x-1/2 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.9)] ${corriendo ? 'reloj-manecilla' : ''}`} />
              <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300" />
            </div>
            <div className="absolute inset-x-0 bottom-[34px] text-center text-2xl font-bold tabular-nums drop-shadow">{estado === 'error' ? '!' : `${pct}%`}</div>
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-cyan-200 sm:justify-start">
              <span className={corriendo ? 'animate-pulse' : ''}><Svg d={I.base} className="h-3.5 w-3.5" /></span>
              {corriendo ? 'Sincronizando el censo' : estado === 'listo' ? 'Sincronización completada' : 'No se pudo sincronizar'}
            </div>
            <div className="mt-1 text-4xl font-bold tabular-nums">{mmss(Math.floor(seg))}</div>
            <div className="text-xs text-white/60">tiempo {corriendo ? 'transcurrido' : 'total'}</div>
            <p role="status" className="mt-3 min-h-[1.25rem] break-words text-sm text-white/85">
              {corriendo ? MENSAJES[Math.floor(seg / 2) % MENSAJES.length]
                : estado === 'listo' ? 'Los pacientes y sus ubicaciones ya están al día.'
                : error ?? 'Ocurrió un error desconocido.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1 px-6 pb-4">
          {ETAPAS.map((e, i) => {
            const hecho = i < etapa || estado === 'listo'
            const activo = i === etapa && estado !== 'listo'
            const fallo = activo && estado === 'error'
            return (
              <div key={e.texto} className="flex flex-col items-center gap-1 text-center">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full ${fallo ? 'bg-rose-400 text-brand' : hecho ? 'bg-emerald-400 text-brand' : activo ? 'cm-pulse bg-amber-300 text-brand' : 'bg-white/10 text-white/40'}`}>
                  {fallo ? <Svg d={I.error} /> : activo ? <Giro /> : <Svg d={e.icono} />}
                </span>
                <span className={`text-[10px] leading-tight ${hecho || activo ? 'text-white' : 'text-white/40'}`}>{e.texto}</span>
              </div>
            )
          })}
        </div>

        <div className="px-6">
          <div className="relative h-5 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/20">
            <div className={`h-full rounded-full ${estado === 'error' ? 'bg-rose-400' : `termometro-relleno ${corriendo ? '' : 'termometro-quieto'}`}`} style={{ width: `${Math.max(pct, 4)}%`, transition: 'width 0.6s ease' }} />
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-1.5 px-6 pt-4">
          {chips.map((c) => {
            const tieneValor = c.valor != null
            return (
              <span key={c.texto} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                !tieneValor ? (corriendo ? 'animate-pulse bg-amber-300/25 text-amber-100' : 'bg-white/10 text-white/50')
                : c.alerta && c.valor ? 'bg-amber-300/25 text-amber-100' : 'bg-emerald-400/20 text-emerald-100'}`}>
                {corriendo && !tieneValor && <Giro />}
                {c.texto}{tieneValor && <b className="tabular-nums">· {c.valor}</b>}
              </span>
            )
          })}
        </div>

        <div className="flex min-h-[4.5rem] items-center justify-center px-6 py-4">
          {corriendo
            ? <p className="text-center text-xs text-white/60">Puedes seguir esperando aquí; no cierres esta página.</p>
            : <button ref={cerrarRef} onClick={onCerrar} className="rounded-xl bg-white px-6 py-2 text-sm font-semibold text-brand transition hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-cyan-200">Cerrar</button>}
        </div>
      </div>
    </div>,
    document.body,
  )
}

// Ejecuta la sincronización y entrega la vista de progreso lista para renderizar.
export function useSyncCenso() {
  const [corrida, setCorrida] = useState<{ estado: EstadoSync; inicio: number; fin?: number; resumen?: ResumenSync; error?: string } | null>(null)
  const cerrar = useCallback(() => setCorrida(null), [])
  const ejecutar = useCallback(async () => {
    const inicio = Date.now()
    setCorrida({ estado: 'corriendo', inicio })
    const res = await ejecutarSyncCenso()
    setCorrida({ estado: res.ok ? 'listo' : 'error', inicio, fin: Date.now(), resumen: res.resumen, error: res.error })
    return res
  }, [])
  return {
    ejecutar,
    corriendo: corrida?.estado === 'corriendo',
    vista: corrida ? <ProgresoSync {...corrida} onCerrar={cerrar} /> : null,
  }
}
