import { useEffect, useState } from 'react'
import { PageHeader, Card, Btn, selectCls, inputCls, textareaCls, Badge, Modal } from '../components/ui'
import MapaHabitaciones from '../components/MapaHabitaciones'
import { useAuth } from '../auth/AuthProvider'
import {
  listSedes, listPisos, listPuertas, listUbicaciones, listResponsables, listServicios, tarjetasDisponibles,
  buscarVisitante, upsertVisitante, registrarVisita, ordenarAreas, evaluarRestricciones, buscarPacientePorDocumento, type EvalRestriccion,
} from '../lib/data'
import { AISLAMIENTO_LABEL } from '../lib/types'
import type { Sede, Piso, Puerta, Responsable, Servicio, Tarjeta, TipoVisitante, OcupacionUbicacion } from '../lib/types'

// Fecha y hora de ingreso en hora Colombia (GMT-5): "25/06 03:14 p.m."
function fechaHoraCO(iso: string | null): string {
  if (!iso) return '—'
  const co = new Date(new Date(iso).getTime() - 5 * 3_600_000)
  const dd = String(co.getUTCDate()).padStart(2, '0')
  const mm = String(co.getUTCMonth() + 1).padStart(2, '0')
  let h = co.getUTCHours(); const min = String(co.getUTCMinutes()).padStart(2, '0')
  const ap = h < 12 ? 'a.m.' : 'p.m.'; h = h % 12 === 0 ? 12 : h % 12
  return `${dd}/${mm} ${h}:${min} ${ap}`
}

// Texto del motivo de autorización a partir de las restricciones detectadas.
function motivoAutorizacion(r: EvalRestriccion | null): string {
  if (!r) return ''
  const p: string[] = []
  if (r.fueraHorario) p.push(`Fuera de horario (${r.ventanas})`)
  if (r.excedeSimultaneo) p.push(`Excede máx. simultáneo (${r.limiteSimultaneo})`)
  if (r.excedeDia) p.push(`Excede máx. por día (${r.maxPorDia})`)
  return p.join('; ')
}

// La regla institucional: pacientes ≥65 o ≤18 años requieren acompañante permanente.
const requierePermanente = (edad: number | null | undefined) => edad != null && (edad >= 65 || edad <= 18)

const TIPOS: { v: TipoVisitante; label: string; icon: string; desc: string }[] = [
  { v: 'familiar', label: 'Familiar', icon: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z', desc: 'Acompañante de un paciente' },
  { v: 'proveedor', label: 'Proveedor', icon: 'M3 7h13v8H3zM16 10h3l2 2v3h-5M5.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM18.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z', desc: 'Acompañado por responsable' },
  { v: 'colaborador', label: 'Colaborador', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', desc: 'Personal interno' },
  { v: 'sin_tarjeta', label: 'Sin tarjeta', icon: 'M12 9v2m0 4h.01M10.3 3.9l-8 14A2 2 0 004 21h16a2 2 0 001.7-3.1l-8-14a2 2 0 00-3.4 0z', desc: 'Familiar sin ubicación/tarjeta asignada' },
]

export default function Registrar() {
  const { perfil } = useAuth()
  const [tipo, setTipo] = useState<TipoVisitante | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [refreshMapa, setRefreshMapa] = useState(0)

  // catálogos
  const [sedes, setSedes] = useState<Sede[]>([])
  const [pisos, setPisos] = useState<Piso[]>([])
  const [puertas, setPuertas] = useState<Puerta[]>([])
  const [responsables, setResponsables] = useState<Responsable[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>([])

  // selección
  const [sedeId, setSedeId] = useState('')
  const [pisoId, setPisoId] = useState('')
  const [areas, setAreas] = useState<string[]>([])
  const [area, setArea] = useState('')
  const [puertaId, setPuertaId] = useState('')
  const [tarjetaId, setTarjetaId] = useState('')
  const [sel, setSel] = useState<OcupacionUbicacion | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'sinPaciente' | 'autorizacion' | 'tarjeta' | 'sinTarjetas'; o?: OcupacionUbicacion } | null>(null)

  // Restricciones (horario / cupo) del paciente seleccionado y datos de autorización excepcional
  const [restric, setRestric] = useState<EvalRestriccion | null>(null)
  const [autorizadoPorId, setAutorizadoPorId] = useState('')
  const [autorizacionObs, setAutorizacionObs] = useState('')

  // Búsqueda de paciente por identificación (cuando no está en el mapa / sin cama)
  const [docPaciente, setDocPaciente] = useState('')
  const [buscandoDoc, setBuscandoDoc] = useState(false)
  const [docMsg, setDocMsg] = useState<string | null>(null)

  // Maneja el clic en una habitación del mapa: valida paciente y evalúa horario/cupos.
  function seleccionar(o: OcupacionUbicacion) {
    if (!o.num_ingreso) { setAviso({ tipo: 'sinPaciente' }); return }
    setSel(o)
    setRestric(null)
    // Regla de edad: ≥65 o ≤18 ⇒ acompañante permanente
    if (requierePermanente(o.edad)) setTipoAcomp('permanente')
    evaluarRestricciones(o).then(setRestric)
  }

  // Busca el paciente por número de identificación y lo selecciona aunque no tenga cama.
  async function buscarPorIdentificacion() {
    setDocMsg(null)
    if (!docPaciente.trim()) return
    setBuscandoDoc(true)
    try {
      const o = await buscarPacientePorDocumento(docPaciente)
      if (!o) { setDocMsg('No se encontró un paciente con esa identificación.'); return }
      seleccionar(o)
    } finally { setBuscandoDoc(false) }
  }

  // visitante
  const [cedula, setCedula] = useState('')
  const [nombres, setNombres] = useState('')
  const [celular, setCelular] = useState('')
  const [email, setEmail] = useState('')
  const [existe, setExiste] = useState(false)

  // específicos
  const [tipoAcomp, setTipoAcomp] = useState<'permanente' | 'visita'>('visita')
  const [permisoOtros, setPermisoOtros] = useState('')
  const [responsableId, setResponsableId] = useState('')
  const [servicioVisita, setServicioVisita] = useState('')

  useEffect(() => { listSedes().then((s) => { setSedes(s); if (s[0]) setSedeId(s[0].id) }) }, [])
  useEffect(() => {
    if (!sedeId) return
    listPisos(sedeId).then((p) => { setPisos(p); setPisoId(p[0]?.id ?? '') })
    listPuertas(sedeId).then((p) => { setPuertas(p); setPuertaId(p[0]?.id ?? '') })
    tarjetasDisponibles(sedeId).then(setTarjetas)
  }, [sedeId])
  useEffect(() => { listResponsables().then(setResponsables); listServicios().then(setServicios) }, [])
  useEffect(() => {
    setArea(''); setSel(null)
    if (!pisoId) { setAreas([]); return }
    listUbicaciones(pisoId).then((u) => setAreas(ordenarAreas([...new Set(u.map((x) => x.area).filter((a): a is string => !!a))])))
  }, [pisoId])

  async function lookupCedula() {
    if (!cedula.trim()) return
    const v = await buscarVisitante(cedula)
    if (v) { setNombres(v.nombres_completos); setCelular(v.celular ?? ''); setEmail(v.email ?? ''); setExiste(true) }
    else { setExiste(false) }
  }

  function reset() {
    setTipo(null); setSel(null); setCedula(''); setNombres(''); setCelular(''); setEmail(''); setExiste(false)
    setTipoAcomp('visita'); setPermisoOtros(''); setResponsableId(''); setServicioVisita(''); setTarjetaId('')
    setRestric(null); setAutorizadoPorId(''); setAutorizacionObs('')
    setDocPaciente(''); setDocMsg('')
  }

  const restriccionActiva = !!restric && (restric.fueraHorario || restric.excedeSimultaneo || restric.excedeDia)

  // Validaciones básicas; si hay restricción de horario/cupo abre el modal de autorización.
  function guardar() {
    setMsg(null)
    if (!cedula.trim() || !nombres.trim()) { setMsg({ ok: false, texto: 'Cédula y nombres son obligatorios.' }); return }
    if (tipo === 'familiar' && !sel?.num_ingreso) { setMsg({ ok: false, texto: 'Selecciona la habitación del paciente en el mapa.' }); return }
    if (tipo === 'proveedor' && !responsableId) { setMsg({ ok: false, texto: 'Selecciona la persona responsable que acompaña.' }); return }
    if (tipo !== 'sin_tarjeta' && !tarjetaId) { setAviso({ tipo: tarjetas.length === 0 ? 'sinTarjetas' : 'tarjeta' }); return }
    // Fuera de horario o excede el cupo ⇒ pedir autorización (permite continuar)
    if (tipo === 'familiar' && restriccionActiva && !autorizadoPorId) { setAviso({ tipo: 'autorizacion', o: sel ?? undefined }); return }
    doGuardar()
  }

  // Confirma desde el modal de autorización (ya se eligió el responsable que autoriza).
  function continuarConAutorizacion() {
    if (!autorizadoPorId) return
    setAviso(null)
    doGuardar()
  }

  async function doGuardar() {
    const autorizado = restriccionActiva && autorizadoPorId
    const motivo = autorizado
      ? motivoAutorizacion(restric) + (autorizacionObs.trim() ? ` — ${autorizacionObs.trim()}` : '')
      : null
    setGuardando(true)
    try {
      const visitanteId = await upsertVisitante({ cedula, nombres_completos: nombres, celular: celular || null, email: email || null })
      await registrarVisita({
        tipo_visitante: tipo!,
        visitante_id: visitanteId,
        tipo_acompanante: (tipo === 'familiar' || tipo === 'sin_tarjeta') ? tipoAcomp : null,
        paciente_documento: sel?.num_ingreso ? (sel as any).paciente_documento ?? null : null,
        paciente_nombre: sel?.paciente_nombre ?? null,
        num_ingreso: sel?.num_ingreso ?? null,
        ubicacion_id: sel?.ubicacion_id || null,
        ubicacion_etiqueta: sel?.etiqueta ?? null,
        piso_id: sel?.piso_id || (tipo === 'familiar' ? pisoId : null),
        aislamiento: sel?.aislamiento ?? null,
        responsable_id: tipo === 'proveedor' ? responsableId : null,
        autorizado_por_id: autorizado ? autorizadoPorId : null,
        autorizacion_motivo: motivo,
        permiso_alimentos: false,
        permiso_otros: permisoOtros || null,
        servicio_paciente: tipo === 'colaborador' ? servicioVisita || null : sel?.servicio ?? sel?.area ?? null,
        sede_id: sedeId || null,
        puerta_id: puertaId || null,
        tarjeta_id: tipo === 'sin_tarjeta' ? null : (tarjetaId || null),
        registrado_por: perfil?.id ?? null,
      })
      setMsg({ ok: true, texto: `Visita registrada para ${nombres}.${autorizado ? ' (ingreso autorizado excepcionalmente)' : ''}` })
      setRefreshMapa((k) => k + 1)
      tarjetasDisponibles(sedeId).then(setTarjetas)
      reset()
    } catch (e: any) {
      setMsg({ ok: false, texto: 'Error al registrar: ' + (e.message ?? e) })
    } finally { setGuardando(false) }
  }

  return (
    <div>
      <PageHeader title="Registrar visita" subtitle="Ingreso de visitantes — zona horaria Colombia (GMT-5)" />

      {msg && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{msg.texto}</div>
      )}

      {/* Paso 1: tipo */}
      <Card className="p-5 mb-5">
        <div className="text-sm font-semibold text-brand mb-3">1. Tipo de visitante</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TIPOS.map((t) => (
            <button key={t.v} onClick={() => { reset(); setTipo(t.v) }}
              className={`flex items-center gap-3 rounded-xl p-3 text-left transition-all duration-150 ${tipo === t.v ? 'bg-brand-50 shadow-neu-inset' : 'bg-white shadow-neu-sm hover:shadow-neu'}`}>
              <span className={`grid h-10 w-10 place-items-center rounded-lg ${tipo === t.v ? 'bg-brand text-white' : 'bg-gray-100 text-brand'}`}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={t.icon} /></svg>
              </span>
              <div>
                <div className="text-sm font-semibold text-gray-800">{t.label}</div>
                <div className="text-xs text-gray-500">{t.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {tipo && (
        <div className="grid gap-5 lg:grid-cols-5">
          {/* Mapa (solo familiar) */}
          {tipo === 'familiar' && (
            <Card className="p-5 lg:col-span-3">
              <div className="text-sm font-semibold text-brand mb-3">2. Selecciona la habitación del paciente</div>
              <div className="flex flex-wrap gap-3 mb-4">
                <select className={selectCls} value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
                  {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
                <select className={selectCls} value={pisoId} onChange={(e) => { setPisoId(e.target.value); setSel(null) }}>
                  {pisos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
                {areas.length > 0 && (
                  <select className={selectCls} value={area} onChange={(e) => { setArea(e.target.value); setSel(null) }}>
                    <option value="">Todas las áreas</option>
                    {areas.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                )}
              </div>
              {/* Búsqueda por identificación: para pacientes sin cama o que no se ven en el mapa */}
              <div className="mb-4 rounded-lg border border-dashed border-brand-light/50 bg-brand-50/40 p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-brand">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.3-4.3M11 19a8 8 0 100-16 8 8 0 000 16z" /></svg>
                  ¿No está en el mapa o sin cama asignada? Búscalo por identificación
                </div>
                <div className="flex gap-2">
                  <input className={inputCls} value={docPaciente} placeholder="N° identificación del paciente"
                    inputMode="numeric" autoComplete="off"
                    onChange={(e) => setDocPaciente(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') buscarPorIdentificacion() }} />
                  <Btn variant="light" onClick={buscarPorIdentificacion} disabled={buscandoDoc}>{buscandoDoc ? 'Buscando…' : 'Buscar'}</Btn>
                </div>
                {docMsg && <p className="mt-1.5 text-xs text-rose-600">{docMsg}</p>}
              </div>

              {pisoId && <MapaHabitaciones pisoId={pisoId} refreshKey={refreshMapa} onSelect={seleccionar} area={area || undefined} />}
            </Card>
          )}

          {/* Formulario — resaltado para que destaque */}
          <Card className={`relative overflow-hidden ring-2 ring-brand-light/30 p-5 ${tipo === 'familiar' ? 'lg:col-span-2' : 'lg:col-span-5 mx-auto w-full max-w-xl'}`}>
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-brand to-brand-light" />
            <div className="mt-1 mb-3 inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              {tipo === 'familiar' ? '3. Registro de la visita' : '2. Datos del visitante'}
            </div>

            {tipo === 'familiar' && (
              <div className={`mb-4 rounded-lg border px-3 py-2.5 text-sm ${sel ? 'border-brand-light bg-brand-50' : 'border-dashed border-gray-300 bg-gray-50 text-gray-500'}`}>
                {sel
                  ? <div>
                      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-brand-light">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        Paciente seleccionado
                      </div>
                      <div className="text-base font-bold leading-tight text-brand">{sel.paciente_nombre}{sel.edad != null ? ` · ${sel.edad} años` : ''}</div>
                      <div className="text-gray-700">{sel.paciente_documento ? <><b>ID</b> {sel.paciente_documento} · </> : ''}# ingreso {sel.num_ingreso} · {sel.etiqueta}
                        {sel.aislamiento && <Badge color="red">Aislamiento {AISLAMIENTO_LABEL[sel.aislamiento]}</Badge>}
                      </div>
                      {(sel.area || sel.servicio) && <div className="text-xs text-brand-light">{[sel.area, sel.servicio].filter(Boolean).join(' · ')}</div>}
                      <div className="text-xs text-gray-500">Cupo {sel.visitas.length}/{restric?.limiteSimultaneo ?? sel.cupo}{restric ? ` · ${restric.visitasHoy} visita(s) hoy` : ''}</div>
                    </div>
                  : 'Selecciona una habitación ocupada en el mapa →'}
              </div>
            )}

            {/* Avisos de regla institucional */}
            {tipo === 'familiar' && sel && requierePermanente(sel.edad) && (
              <div className="mb-3 flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>Paciente de <b>{sel.edad} años</b> ({sel.edad! <= 18 ? 'menor de edad' : 'adulto mayor'}): requiere <b>acompañante permanente</b>.</span>
              </div>
            )}
            {tipo === 'familiar' && restriccionActiva && (
              <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9l-8 14A2 2 0 004 21h16a2 2 0 001.7-3.1l-8-14a2 2 0 00-3.4 0z" /></svg>
                <span>{motivoAutorizacion(restric)}. Al registrar se pedirá <b>autorización</b>.</span>
              </div>
            )}

            <div className="space-y-3">
              {tipo === 'familiar' && <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Datos del visitante</div>}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Cédula *</label>
                  <input className={inputCls} value={cedula} onChange={(e) => setCedula(e.target.value)} onBlur={lookupCedula}
                    placeholder="N° documento" name="doc_visitante" autoComplete="off" autoCorrect="off" spellCheck={false}
                    inputMode="numeric" pattern="[0-9]*" />
                </div>
                <div className="flex items-end">
                  {existe && <Badge color="green">Ya registrado</Badge>}
                </div>
              </div>
              {existe && (
                <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  Visitante ya registrado. Puedes actualizar sus datos; los cambios se guardarán al registrar el ingreso.
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nombres completos *</label>
                <input className={inputCls} value={nombres} onChange={(e) => setNombres(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Celular</label>
                  <input className={inputCls} value={celular} onChange={(e) => setCelular(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Email (opcional)</label>
                  <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>

              {/* Familiar / sin tarjeta */}
              {(tipo === 'familiar' || tipo === 'sin_tarjeta') && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de acompañante</label>
                    <div className="flex gap-2">
                      {(['permanente', 'visita'] as const).map((t) => (
                        <button key={t} onClick={() => setTipoAcomp(t)}
                          className={`flex-1 rounded-lg px-3 py-2 text-sm capitalize transition-all duration-150 ${tipoAcomp === t ? 'bg-brand-50 text-brand font-medium shadow-neu-inset-sm' : 'bg-white text-gray-600 shadow-neu-xs hover:shadow-neu-sm'}`}>{t}</button>
                      ))}
                    </div>
                  </div>
                  <textarea className={textareaCls} rows={3} value={permisoOtros} onChange={(e) => setPermisoOtros(e.target.value)} placeholder="Elementos / permisos autorizados (opcional)" />
                </>
              )}

              {/* Proveedor */}
              {tipo === 'proveedor' && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Acompañante autorizado (responsable) *</label>
                  <select className={inputCls} value={responsableId} onChange={(e) => setResponsableId(e.target.value)}>
                    <option value="">— Selecciona —</option>
                    {responsables.map((r) => <option key={r.id} value={r.id}>{r.nombre_completo} — {r.numero_documento}</option>)}
                  </select>
                  {responsables.length === 0 && <p className="text-xs text-amber-600 mt-1">No hay responsables. Créalos en Administración → Responsables.</p>}
                </div>
              )}

              {/* Colaborador */}
              {tipo === 'colaborador' && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Servicio / motivo</label>
                  <select className={inputCls} value={servicioVisita} onChange={(e) => setServicioVisita(e.target.value)}>
                    <option value="">— Servicio que visita —</option>
                    {servicios.map((s) => <option key={s.id} value={s.nombre}>{s.nombre}</option>)}
                  </select>
                </div>
              )}

              {/* Acceso */}
              <div className={`grid gap-2 pt-1 ${tipo === 'sin_tarjeta' ? '' : 'grid-cols-2'}`}>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Puerta de ingreso</label>
                  <select className={inputCls} value={puertaId} onChange={(e) => setPuertaId(e.target.value)}>
                    {puertas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                {tipo !== 'sin_tarjeta' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Tarjeta de acceso *</label>
                    <select className={`${inputCls} ${!tarjetaId ? 'border-rose-300' : ''}`} value={tarjetaId} onChange={(e) => setTarjetaId(e.target.value)}>
                      <option value="">— Selecciona tarjeta —</option>
                      {tarjetas.map((t) => <option key={t.id} value={t.id}>{t.codigo}</option>)}
                    </select>
                    {tarjetas.length === 0 && <p className="text-xs text-amber-600 mt-1">No hay tarjetas disponibles en esta sede.</p>}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Btn onClick={guardar} disabled={guardando} className="flex-1">{guardando ? 'Registrando…' : 'Registrar ingreso'}</Btn>
                <Btn variant="ghost" onClick={reset}>Cancelar</Btn>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Ajuste 2: clic en habitación sin paciente */}
      <Modal open={aviso?.tipo === 'sinPaciente'} onClose={() => setAviso(null)} title="Habitación sin paciente">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9l-8 14A2 2 0 004 21h16a2 2 0 001.7-3.1l-8-14a2 2 0 00-3.4 0z" /></svg>
          </span>
          <p className="text-sm text-gray-700">
            Esta ubicación <b>no tiene un paciente registrado</b> actualmente, por lo que no es posible
            registrar un visitante familiar aquí. Verifica el número de habitación o selecciona una ocupada.
          </p>
        </div>
        <div className="mt-4 text-right"><Btn onClick={() => setAviso(null)}>Entendido</Btn></div>
      </Modal>

      {/* Sin tarjetas disponibles en la sede */}
      <Modal open={aviso?.tipo === 'sinTarjetas'} onClose={() => setAviso(null)} title="Sin tarjetas de acceso disponibles">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2zM7 15h2" /></svg>
          </span>
          <p className="text-sm text-gray-700">
            No hay <b>tarjetas de acceso disponibles</b> en esta sede en este momento (todas están en uso).
            No es posible registrar el ingreso sin una tarjeta. Por favor <b>solicita al área administrativa
            la compra de más tarjetas</b>, o registra primero la salida de algún visitante para liberar una.
          </p>
        </div>
        <div className="mt-4 text-right"><Btn onClick={() => setAviso(null)}>Entendido</Btn></div>
      </Modal>

      {/* Tarjeta obligatoria */}
      <Modal open={aviso?.tipo === 'tarjeta'} onClose={() => setAviso(null)} title="Falta la tarjeta de acceso">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
          </span>
          <p className="text-sm text-gray-700">
            Debes <b>seleccionar una tarjeta de acceso</b> para registrar el ingreso del visitante.
            Elige una tarjeta disponible en el campo «Tarjeta de acceso».
          </p>
        </div>
        <div className="mt-4 text-right"><Btn onClick={() => setAviso(null)}>Entendido</Btn></div>
      </Modal>

      {/* Fuera de horario / excede cupo → autorización excepcional (permite continuar) */}
      <Modal open={aviso?.tipo === 'autorizacion'} onClose={() => setAviso(null)} title="Ingreso fuera de las condiciones de visita">
        {aviso?.o && restric && (
          <>
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9l-8 14A2 2 0 004 21h16a2 2 0 001.7-3.1l-8-14a2 2 0 00-3.4 0z" /></svg>
              </span>
              <div className="text-sm text-gray-700">
                Este ingreso <b>no cumple</b> las condiciones de visita de <b>{restric.horario?.servicio ?? 'este servicio'}</b>:
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
                  {restric.fueraHorario && <li>Fuera del horario permitido (<b>{restric.ventanas}</b>).</li>}
                  {restric.excedeSimultaneo && <li>Excede el máximo de <b>{restric.limiteSimultaneo}</b> acompañante(s) simultáneo(s).</li>}
                  {restric.excedeDia && <li>Excede el máximo de <b>{restric.maxPorDia}</b> visita(s) por día (ya van {restric.visitasHoy}).</li>}
                </ul>
                {restric.horario?.notas && <div className="mt-1.5 text-xs text-gray-500">{restric.horario.notas}</div>}
                <div className="mt-2">Puedes <b>continuar</b> registrando quién autoriza el ingreso de forma excepcional.</div>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-500 mb-1">Autoriza el ingreso (responsable) *</label>
              <select className={`${inputCls} ${!autorizadoPorId ? 'border-amber-300' : ''}`} value={autorizadoPorId} onChange={(e) => setAutorizadoPorId(e.target.value)}>
                <option value="">— Selecciona quién autoriza —</option>
                {responsables.map((r) => <option key={r.id} value={r.id}>{r.nombre_completo} — {r.numero_documento}</option>)}
              </select>
              {responsables.length === 0 && <p className="text-xs text-amber-600 mt-1">No hay responsables. Créalos en Administración → Responsables.</p>}
              <input className={`${inputCls} mt-2`} value={autorizacionObs} onChange={(e) => setAutorizacionObs(e.target.value)} placeholder="Observación / motivo de la autorización (opcional)" />
            </div>

            {aviso.o.visitas.length > 0 && (
              <>
                <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">Visitantes actuales</div>
                <div className="mt-1 space-y-2">
                  {aviso.o.visitas.map((v) => (
                    <div key={v.visita_id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                      <div>
                        <div className="text-sm font-medium text-gray-800">{v.visitante_nombre}</div>
                        <div className="text-xs text-gray-500">
                          Ingresó {fechaHoraCO(v.hora_ingreso)} · Tarjeta {v.tarjeta_codigo ?? '—'}
                          {v.celular && <> · <a href={`tel:${v.celular}`} className="text-brand-light hover:underline">{v.celular}</a></>}
                        </div>
                      </div>
                      <Badge color={v.tipo_acompanante === 'permanente' ? 'green' : 'amber'}>
                        {v.tipo_acompanante === 'permanente' ? 'Permanente' : 'Visita'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="mt-5 flex gap-2">
              <Btn onClick={continuarConAutorizacion} disabled={!autorizadoPorId || guardando} className="flex-1">
                {guardando ? 'Registrando…' : 'Continuar con autorización'}
              </Btn>
              <Btn variant="ghost" onClick={() => setAviso(null)}>Cancelar</Btn>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
