import { useEffect, useRef, useState } from 'react'
import { monitoreoResumen, feedReciente, ocupacionPorPiso, listVisitas, type ResumenMonitoreo, type FeedItem, type PisoOcup, type VisitaListado } from '../lib/data'
import { hoyColombia } from '../lib/festivosColombia'
import HeatmapDiaHora from '../components/HeatmapDiaHora'

const PALETA = ['#0d2444', '#13335c', '#185FA5', '#2f7ccb', '#378ADD', '#6aa6e6', '#85B7EB']
const REFRESCO_MS = 45_000

function horaCO(iso: string) { return new Date(new Date(iso).getTime() - 5 * 3_600_000).toISOString().substring(11, 16) }

function CountUp({ value }: { value: number }) {
  const [n, setN] = useState(0)
  const prev = useRef(0)
  useEffect(() => {
    const from = prev.current, to = value, dur = 800; let s: number | null = null
    let raf = 0
    const step = (t: number) => {
      if (s === null) s = t
      const p = Math.min(1, (t - s) / dur)
      setN(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    prev.current = value
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{n.toLocaleString('es-CO')}</>
}

const PANEL: React.CSSProperties = { background: '#0E2548', border: '1px solid rgba(133,183,235,0.18)', borderRadius: 12 }

function Kpi({ label, value, color, suffix }: { label: string; value: number; color: string; suffix?: string }) {
  return (
    <div style={{ ...PANEL, padding: '10px 14px', borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: 12, color: '#85B7EB' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 500, color: '#fff' }}><CountUp value={value} />{suffix}</div>
    </div>
  )
}

export default function Monitoreo() {
  const [m, setM] = useState<ResumenMonitoreo | null>(null)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [pisos, setPisos] = useState<PisoOcup[]>([])
  const [visitasHeat, setVisitasHeat] = useState<VisitaListado[]>([])
  const [reloj, setReloj] = useState('')
  const [actualizado, setActualizado] = useState('')

  async function cargar() {
    const [me, fe, pi, vh] = await Promise.all([monitoreoResumen(hoyColombia()), feedReciente(14), ocupacionPorPiso(), listVisitas({ estado: '' })])
    setM(me); setFeed(fe); setPisos(pi); setVisitasHeat(vh)
    setActualizado(new Date(Date.now() - 5 * 3_600_000).toISOString().substring(11, 19))
  }
  useEffect(() => { cargar(); const t = setInterval(cargar, REFRESCO_MS); return () => clearInterval(t) }, [])
  useEffect(() => {
    const t = setInterval(() => setReloj(new Date(Date.now() - 5 * 3_600_000).toISOString().substring(11, 19)), 1000)
    return () => clearInterval(t)
  }, [])

  const maxPiso = Math.max(1, ...pisos.map((p) => p.n))

  return (
    <div style={{ background: '#081831', borderRadius: 16, padding: 18, color: '#E6F1FB', minHeight: 'calc(100vh - 110px)' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full" style={{ background: '#16468E', boxShadow: '0 0 12px rgba(56,138,221,.6)' }}>
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1a4 4 0 100-8 4 4 0 000 8z" /></svg>
          </span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>Centro de monitoreo · Visitantes</div>
            <div style={{ fontSize: 12, color: '#85B7EB' }}>Clínica Santa Bárbara</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5" style={{ fontSize: 12, color: '#9FE1CB' }}>
            <span className="cm-blink" style={{ width: 8, height: 8, borderRadius: 9999, background: '#1D9E75' }} /> EN VIVO
          </span>
          <span style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums', color: '#fff' }}>{reloj}</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3">
        <Kpi label="Visitantes dentro" value={m?.activas ?? 0} color="#378ADD" />
        <Kpi label="Ingresos hoy" value={m?.ingresosHoy ?? 0} color="#5DCAA5" />
        <Kpi label="Con acompañante" value={m?.conAcomp ?? 0} color="#97C459" suffix={m ? `/${m.pacientes}` : ''} />
        <Kpi label="En aislamiento" value={m?.aislamiento ?? 0} color="#E24B4A" />
      </div>

      {/* Heatmap + feed */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)' }}>
        <div style={{ ...PANEL, padding: 14 }}>
          <div className="flex items-center justify-between mb-2.5">
            <span style={{ fontSize: 13, fontWeight: 500, color: '#B5D4F4' }}>Mapa de calor · ingresos por día y hora</span>
            <span style={{ fontSize: 11, color: '#5b7aa6' }}>GMT-5 · pasa el mouse para ver registros</span>
          </div>
          <HeatmapDiaHora
            registros={visitasHeat}
            getFecha={(r) => r.created_at}
            dark
            columnas={[
              { header: 'Hora', get: (r) => horaCO(r.created_at) },
              { header: 'Visitante', get: (r) => r.visitante?.nombres_completos ?? '' },
              { header: 'Ubicación', get: (r) => r.ubicacion_etiqueta ?? '' },
              { header: 'Tipo', get: (r) => r.tipo_visitante },
            ]}
          />
          <div className="flex items-center gap-1.5 mt-2" style={{ fontSize: 10, color: '#5b7aa6' }}>
            menos
            <span className="inline-flex gap-0.5">{PALETA.slice(1, 6).map((c) => <i key={c} style={{ width: 12, height: 8, background: c, borderRadius: 2, display: 'inline-block' }} />)}</span>
            más · las celdas pico laten
          </div>
        </div>

        <div style={{ ...PANEL, padding: 14, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#B5D4F4', marginBottom: 8 }}>Registro en vivo</div>
          <div className="flex flex-col gap-2" style={{ maxHeight: 320, overflowY: 'auto' }}>
            {feed.length === 0 ? <div style={{ fontSize: 12, color: '#5b7aa6' }}>Sin movimientos recientes</div>
              : feed.map((f, i) => (
                <div key={i} className="flex items-center gap-2" style={{ borderBottom: '1px solid rgba(133,183,235,0.1)', paddingBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#5b7aa6', fontVariantNumeric: 'tabular-nums' }}>{horaCO(f.hora)}</span>
                  <span style={{ width: 7, height: 7, borderRadius: 9999, flex: 'none', background: f.tipo === 'ingreso' ? '#5DCAA5' : '#F09595' }} />
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 12, color: '#E6F1FB', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.visitante}</span>
                    <span style={{ fontSize: 10, color: '#85B7EB' }}>{f.ubicacion ?? '—'} · {f.tipo === 'ingreso' ? 'entró' : 'salió'}</span>
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Ocupación por piso */}
      <div style={{ ...PANEL, padding: 14, marginTop: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#B5D4F4', marginBottom: 10 }}>Visitantes dentro por piso</div>
        <div className="flex items-end gap-2.5" style={{ height: 96 }}>
          {pisos.length === 0 ? <div style={{ fontSize: 12, color: '#5b7aa6' }}>Sin visitantes activos</div>
            : pisos.map((p) => (
              <div key={p.piso} className="flex flex-col items-center gap-1" style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 12, color: '#fff', fontWeight: 500 }}>{p.n}</span>
                <div style={{ width: '100%', height: Math.round((p.n / maxPiso) * 62), background: '#2f7ccb', borderRadius: '4px 4px 0 0', boxShadow: '0 0 8px rgba(47,124,203,.4)' }} />
                <span style={{ fontSize: 10, color: '#85B7EB', textAlign: 'center' }}>{p.piso.replace(/^Piso /, 'P').replace(' Hospitalización', '').replace(' Urgencias', '')}</span>
              </div>
            ))}
        </div>
      </div>

      <div className="mt-3 text-right" style={{ fontSize: 10, color: '#5b7aa6' }}>Actualizado {actualizado} · refresco automático cada {REFRESCO_MS / 1000}s</div>
    </div>
  )
}
