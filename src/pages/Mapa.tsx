import { useEffect, useMemo, useState } from 'react'
import { PageHeader, Card, Btn, ConLateral, selectCls, inputCls } from '../components/ui'
import MapaHabitaciones from '../components/MapaHabitaciones'
import ModalNotaAdministrativa from '../components/ModalNotaAdministrativa'
import { listSedes, listPisos, listUbicaciones, ordenarAreas, buscarPacientePorDocumento } from '../lib/data'
import type { Sede, Piso, OcupacionUbicacion } from '../lib/types'

export default function Mapa() {
  const [sedes, setSedes] = useState<Sede[]>([])
  const [pisos, setPisos] = useState<Piso[]>([])
  const [areas, setAreas] = useState<string[]>([])
  const [sedeId, setSedeId] = useState('')
  const [pisoId, setPisoId] = useState('')
  const [area, setArea] = useState('')

  // Nota administrativa: contexto (habitación seleccionada o paciente buscado por cédula)
  const [notaFor, setNotaFor] = useState<OcupacionUbicacion | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  // Búsqueda por cédula: para casos sin cama mapeada (p.ej. Urgencias)
  const [doc, setDoc] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [docMsg, setDocMsg] = useState<string | null>(null)

  useEffect(() => { listSedes().then((s) => { setSedes(s); if (s[0]) setSedeId(s[0].id) }) }, [])
  useEffect(() => {
    if (!sedeId) return
    listPisos(sedeId).then((p) => { setPisos(p); setPisoId(p[0]?.id ?? '') })
  }, [sedeId])
  useEffect(() => {
    setArea('')
    if (!pisoId) { setAreas([]); return }
    listUbicaciones(pisoId).then((u) => {
      setAreas(ordenarAreas([...new Set(u.map((x) => x.area).filter((a): a is string => !!a))]))
    })
  }, [pisoId])

  const pisoSel = useMemo(() => pisos.find((p) => p.id === pisoId), [pisos, pisoId])

  function abrirNota(o: OcupacionUbicacion) { setNotaFor(o) }

  async function buscarPorCedula() {
    setDocMsg(null)
    if (!doc.trim()) return
    setBuscando(true)
    try {
      const o = await buscarPacientePorDocumento(doc)
      if (!o) { setDocMsg('No se encontró un paciente con esa identificación.'); return }
      abrirNota(o)
    } finally { setBuscando(false) }
  }

  // El aviso de guardado se muestra a nivel de página (el modal ya se cerró) y se autolimpia.
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 4000)
    return () => clearTimeout(t)
  }, [msg])

  return (
    <div>
      <PageHeader title="Mapa de habitaciones" subtitle="Vista global de ocupación y acompañantes en tiempo real" />

      {msg && <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">{msg}</div>}

      <ConLateral lateral={
        // Filtros sobre la foto de la Torre de Salud: la imagen arriba y los selectores sobre el degradado institucional.
        <section className="relative overflow-hidden rounded-2xl text-white shadow-neu-sm">
          {/* Se recorta la parte baja de la foto (trae el logo impreso, que chocaría con el texto) */}
          <div className="absolute inset-x-0 top-0 h-40 overflow-hidden">
            <img src={`${import.meta.env.BASE_URL}images/torre_salud.png`} alt="Torre de Salud — Clínica Santa Bárbara"
              className="h-[250px] w-full object-cover object-top" />
          </div>
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(13,45,107,0.05)_0,rgba(13,45,107,0.55)_90px,#0D2D6B_160px)]" />
          <div className="relative space-y-3 p-4 pt-32">
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18l-7 9v6l-4 2v-8z" /></svg>
              Ubicación
            </div>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-sky-100">Sede</span>
              <select className={`${selectCls} w-full`} value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
                {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-sky-100">Piso / servicio</span>
              <select className={`${selectCls} w-full`} value={pisoId} onChange={(e) => setPisoId(e.target.value)}>
                {pisos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </label>
            {areas.length > 0 && (
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-sky-100">Área</span>
                <select className={`${selectCls} w-full`} value={area} onChange={(e) => setArea(e.target.value)}>
                  <option value="">Todas las áreas</option>
                  {areas.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
            )}
            <div className="border-t border-white/20 pt-3">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-sky-100">Nota administrativa por cédula</span>
              <p className="mb-2 text-[11px] text-white/70">Para pacientes sin cama asignada.</p>
              <div className="flex gap-2">
                <input className={inputCls} value={doc} placeholder="N° identificación" inputMode="numeric" autoComplete="off" aria-label="Número de identificación del paciente"
                  onChange={(e) => setDoc(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') buscarPorCedula() }} />
                <Btn variant="light" onClick={buscarPorCedula} disabled={buscando}>{buscando ? '…' : 'Buscar'}</Btn>
              </div>
              {docMsg && <p className="mt-1.5 rounded-md bg-rose-500/90 px-2 py-1 text-xs text-white">{docMsg}</p>}
            </div>
          </div>
        </section>
      }>
      <Card hover={false} className="p-5">
        {pisoSel && <div className="mb-4 text-lg font-semibold text-brand">{pisoSel.nombre}{area ? ` · ${area}` : ''}</div>}
        {pisoId
          ? <MapaHabitaciones pisoId={pisoId} area={area || undefined} onSelect={abrirNota} />
          : <div className="py-16 text-center text-gray-400 text-sm">Selecciona un piso</div>}
      </Card>
      </ConLateral>

      {/* Nota administrativa: fecha/hora de la app + comentario libre */}
      <ModalNotaAdministrativa contexto={notaFor} onCerrar={() => setNotaFor(null)}
        onGuardada={() => { setNotaFor(null); setMsg('Nota administrativa guardada.') }} />
    </div>
  )
}
