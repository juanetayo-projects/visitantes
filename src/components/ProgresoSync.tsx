import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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

// Etapa estimada por el tiempo: 0 enviada, 1 consultando, 2 actualizando, 3 resultados (solo al terminar).
function etapaDe(estado: EstadoSync, seg: number): number {
  if (estado === 'listo') return 3
  return seg < 1 ? 0 : seg < 3 ? 1 : 2
}
// Se acerca a 95 % sin alcanzarlo: nunca se congela ni promete un final que no ha llegado.
const pctDe = (estado: EstadoSync, seg: number) => (estado === 'listo' ? 100 : Math.round(95 * (1 - Math.exp(-seg / 4))))

const TITULO: Record<EstadoSync, string> = { corriendo: 'Sincronizando el censo', listo: 'Sincronización completada', error: 'No se pudo sincronizar' }
function mensajeDe(estado: EstadoSync, seg: number, error?: string): string {
  if (estado === 'corriendo') return MENSAJES[Math.floor(seg / 2) % MENSAJES.length]
  if (estado === 'listo') return 'Los pacientes y sus ubicaciones ya están al día.'
  return error ?? 'Ocurrió un error desconocido.'
}

// ── Piezas de la vista (cada una con una sola responsabilidad) ──

function RelojAvance({ estado, pct }: { estado: EstadoSync; pct: number }) {
  const R = 70, C = 2 * Math.PI * R
  return (
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
        {Array.from({ length: 12 }, (_, h) => h).map((h) => (
          <span key={`marca-${h}`} className="absolute left-1/2 top-1 h-2 w-0.5 rounded bg-white/40" style={{ transform: `translateX(-50%) rotate(${h * 30}deg)`, transformOrigin: '50% 63px' }} />
        ))}
        <span className={`absolute bottom-1/2 left-1/2 h-[46px] w-1 -translate-x-1/2 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.9)] ${estado === 'corriendo' ? 'reloj-manecilla' : ''}`} />
        <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300" />
      </div>
      <div className="absolute inset-x-0 bottom-[34px] text-center text-2xl font-bold tabular-nums drop-shadow">{estado === 'error' ? '!' : `${pct}%`}</div>
    </div>
  )
}

function Etapas({ estado, etapa }: { estado: EstadoSync; etapa: number }) {
  const claseIcono = (fallo: boolean, hecho: boolean, activo: boolean) =>
    fallo ? 'bg-rose-400 text-brand' : hecho ? 'bg-emerald-400 text-brand' : activo ? 'cm-pulse bg-amber-300 text-brand' : 'bg-white/10 text-white/40'
  return (
    <ol className="grid grid-cols-4 gap-1 px-6 pb-4" aria-label="Etapas de la sincronización">
      {ETAPAS.map((e, i) => {
        const hecho = i < etapa || estado === 'listo'
        const activo = i === etapa && estado !== 'listo'
        const fallo = activo && estado === 'error'
        return (
          <li key={e.texto} className="flex flex-col items-center gap-1 text-center" aria-current={activo ? 'step' : undefined}>
            <span className={`flex h-8 w-8 items-center justify-center rounded-full ${claseIcono(fallo, hecho, activo)}`}>
              {fallo ? <Svg d={I.error} /> : activo ? <Giro /> : <Svg d={e.icono} />}
            </span>
            <span className={`text-[10px] leading-tight ${hecho || activo ? 'text-white' : 'text-white/40'}`}>{e.texto}</span>
          </li>
        )
      })}
    </ol>
  )
}

function Termometro({ estado, pct }: { estado: EstadoSync; pct: number }) {
  const relleno = estado === 'error' ? 'bg-rose-400' : `termometro-relleno ${estado === 'corriendo' ? '' : 'termometro-quieto'}`
  return (
    <div className="px-6">
      <div className="relative h-5 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/20">
        <div className={`h-full rounded-full ${relleno}`} style={{ width: `${Math.max(pct, 4)}%`, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}

function Cifras({ resumen, corriendo }: { resumen?: ResumenSync; corriendo: boolean }) {
  const chips: { texto: string; valor?: number; alerta?: boolean }[] = [
    { texto: 'En el censo', valor: resumen?.total_censo },
    { texto: 'Actualizados', valor: resumen?.pacientes_upsert },
    { texto: 'Egresos', valor: resumen?.altas },
    { texto: 'Aislamientos', valor: resumen?.aislamientos },
    { texto: 'Inconsistencias', valor: resumen?.inconsistencias, alerta: true },
  ]
  const clase = (c: (typeof chips)[number]) => {
    if (c.valor == null) return corriendo ? 'animate-pulse bg-amber-300/25 text-amber-100' : 'bg-white/10 text-white/50'
    return c.alerta && c.valor ? 'bg-amber-300/25 text-amber-100' : 'bg-emerald-400/20 text-emerald-100'
  }
  return (
    <div className="flex flex-wrap justify-center gap-1.5 px-6 pt-4">
      {chips.map((c) => (
        <span key={c.texto} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${clase(c)}`}>
          {corriendo && c.valor == null && <Giro />}
          {c.texto}{c.valor != null && <b className="tabular-nums">· {c.valor}</b>}
        </span>
      ))}
    </div>
  )
}

function Acciones({ corriendo, inconsistencias, onCerrar, cerrarRef }: {
  corriendo: boolean; inconsistencias?: number; onCerrar: () => void; cerrarRef: React.RefObject<HTMLButtonElement>
}) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  if (corriendo) return <p className="text-center text-xs text-white/60">Puedes seguir esperando aquí; no cierres esta página.</p>
  const yaEnSync = pathname === '/admin/sync-censo'
  const hay = !!inconsistencias
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {hay && !yaEnSync && (
        <button type="button" onClick={() => { onCerrar(); navigate('/admin/sync-censo') }} className="rounded-xl bg-amber-300 px-5 py-2 text-sm font-semibold text-brand transition hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-cyan-200">Ver las {inconsistencias} inconsistencias</button>
      )}
      <button type="button" ref={cerrarRef} onClick={onCerrar} className="rounded-xl bg-white px-6 py-2 text-sm font-semibold text-brand transition hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-cyan-200">{hay && yaEnSync ? 'Ver las inconsistencias' : 'Cerrar'}</button>
    </div>
  )
}

// Abre el <dialog> nativo como modal (atrapa el foco del teclado y bloquea la página de fondo),
// bloquea el desplazamiento del fondo y, al desmontarse, lo cierra para que el navegador devuelva
// el foco al botón que lo abrió.
function useDialogoModal(ref: React.RefObject<HTMLDialogElement>) {
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (!d.open) d.showModal()
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = overflowPrevio; if (d.open) d.close() }
  }, [ref])
}

export function ProgresoSync({ estado, inicio, fin, resumen, error, onCerrar }: {
  estado: EstadoSync; inicio: number; fin?: number; resumen?: ResumenSync; error?: string; onCerrar: () => void
}) {
  const [ahora, setAhora] = useState(Date.now())
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cerrarRef = useRef<HTMLButtonElement>(null)
  const corriendo = estado === 'corriendo'
  useDialogoModal(dialogRef)
  // Mientras corre, el reloj avanza; al terminar, el foco pasa al botón de cerrar.
  useEffect(() => {
    if (!corriendo) { cerrarRef.current?.focus(); return }
    const t = setInterval(() => setAhora(Date.now()), 200)
    return () => clearInterval(t)
  }, [corriendo])

  const seg = Math.max(0, ((fin ?? ahora) - inicio) / 1000)
  const pct = pctDe(estado, seg)

  return (
    <dialog ref={dialogRef} aria-label="Sincronización del censo" aria-busy={corriendo}
      // Escape: el navegador dispara «cancel». Mientras corre no se puede cerrar; al terminar, sí.
      // Mientras corre no se puede cerrar (como antes). Se frena la tecla misma: Chrome ignora el
      // preventDefault de «cancel» si se repite Escape, pero no si se anula el keydown.
      onKeyDown={(e) => { if (corriendo && e.key === 'Escape') e.preventDefault() }}
      onCancel={(e) => { e.preventDefault(); if (!corriendo) onCerrar() }}
      // Respaldo: si de todas formas se cierra a mitad de camino, se reabre; ya terminado, se descarta.
      onClose={(e) => { if (corriendo) e.currentTarget.showModal(); else onCerrar() }}
      className="m-auto w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-3xl bg-transparent p-0 text-white shadow-2xl backdrop:bg-[#071a40]/75 backdrop:backdrop-blur-sm">
      <div className="bg-gradient-to-br from-brand via-[#123b80] to-brand-light">
        <div className="flex flex-col items-center gap-5 px-6 pb-5 pt-7 sm:flex-row">
          <RelojAvance estado={estado} pct={pct} />
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h2 className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-cyan-200 sm:justify-start">
              <span className={corriendo ? 'animate-pulse' : ''}><Svg d={I.base} className="h-3.5 w-3.5" /></span>
              {TITULO[estado]}
            </h2>
            <div className="mt-1 text-4xl font-bold tabular-nums">{mmss(Math.floor(seg))}</div>
            <div className="text-xs text-white/60">tiempo {corriendo ? 'transcurrido' : 'total'}</div>
            <p role="status" className="mt-3 min-h-[1.25rem] break-words text-sm text-white/85">{mensajeDe(estado, seg, error)}</p>
          </div>
        </div>
        <Etapas estado={estado} etapa={etapaDe(estado, seg)} />
        <Termometro estado={estado} pct={pct} />
        <Cifras resumen={resumen} corriendo={corriendo} />
        <div className="flex min-h-[4.5rem] items-center justify-center px-6 py-4">
          <Acciones corriendo={corriendo} inconsistencias={estado === 'listo' ? resumen?.inconsistencias : undefined} onCerrar={onCerrar} cerrarRef={cerrarRef} />
        </div>
      </div>
    </dialog>
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
