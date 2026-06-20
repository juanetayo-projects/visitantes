import { useEffect, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { PageHeader, Card, FilterBar, selectCls, MetricCard } from '../components/ui'
import { eventosIngreso } from '../lib/data'
import { setFestivos } from '../lib/festivosColombia'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const HORAS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}h`)

// Convierte ISO → partes en hora Colombia
function partesCO(iso: string) {
  const co = new Date(new Date(iso).getTime() - 5 * 3_600_000)
  const dow = (co.getUTCDay() + 6) % 7 // 0=Lunes … 6=Domingo
  return { fecha: co.toISOString().substring(0, 10), dow, hora: co.getUTCHours() }
}

export default function Estadisticas() {
  const [eventos, setEventos] = useState<{ hora: string }[]>([])
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [loading, setLoading] = useState(true)
  const festivos = useMemo(() => setFestivos(2024, 2027), [])

  useEffect(() => {
    setLoading(true)
    eventosIngreso(desde || undefined, hasta || undefined).then((e) => { setEventos(e); setLoading(false) })
  }, [desde, hasta])

  const { matriz, total, festivosCount, max } = useMemo(() => {
    const m: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
    let fest = 0
    eventos.forEach((ev) => {
      const p = partesCO(ev.hora)
      m[p.dow][p.hora]++
      if (p.dow === 6 || festivos.has(p.fecha)) fest++
    })
    let mx = 0
    const data: [number, number, number][] = []
    for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) { mx = Math.max(mx, m[d][h]); data.push([h, d, m[d][h]]) }
    return { matriz: data, total: eventos.length, festivosCount: fest, max: mx }
  }, [eventos, festivos])

  const option = {
    tooltip: { position: 'top', formatter: (p: any) => `${DIAS[p.value[1]]} · ${HORAS[p.value[0]]}<br/><b>${p.value[2]}</b> ingreso(s)` },
    grid: { height: '70%', top: '8%', left: 70, right: 20 },
    xAxis: { type: 'category', data: HORAS, splitArea: { show: true }, axisLabel: { fontSize: 10 } },
    yAxis: { type: 'category', data: DIAS, splitArea: { show: true } },
    visualMap: { min: 0, max: Math.max(1, max), calculable: true, orient: 'horizontal', left: 'center', bottom: 0,
      inRange: { color: ['#EAF0FA', '#85B7EB', '#16468E', '#0D2D6B'] } },
    series: [{ name: 'Ingresos', type: 'heatmap', data: matriz, label: { show: max <= 30 }, emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(13,45,107,0.4)' } } }],
  }

  return (
    <div>
      <PageHeader title="Estadísticas" subtitle="Flujo de visitantes por día y hora — zona horaria Colombia (GMT-5)" />

      <div className="grid gap-4 sm:grid-cols-3 mb-5">
        <MetricCard label="Total de ingresos" value={total} color="blue" />
        <MetricCard label="En domingos / festivos" value={festivosCount} hint="calendario Colombia" color="amber" />
        <MetricCard label="Pico (día·hora)" value={max} hint="máximo en una celda" color="teal" />
      </div>

      <FilterBar onClear={() => { setDesde(''); setHasta('') }}>
        <div><label className="block text-xs text-gray-500 mb-1">Desde</label><input type="date" className={selectCls} value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
        <div><label className="block text-xs text-gray-500 mb-1">Hasta</label><input type="date" className={selectCls} value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
      </FilterBar>

      <Card className="p-5">
        <div className="text-sm font-semibold text-brand mb-2">Mapa de calor — ingresos por día y hora</div>
        {loading ? <div className="py-16 text-center text-gray-400 text-sm">Cargando…</div>
          : <ReactECharts option={option} style={{ height: 420 }} />}
      </Card>
    </div>
  )
}
