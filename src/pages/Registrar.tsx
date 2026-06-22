import { useEffect, useState } from 'react'
import { PageHeader, Card, Btn, selectCls, inputCls, Badge, Modal } from '../components/ui'
import MapaHabitaciones from '../components/MapaHabitaciones'
import { useAuth } from '../auth/AuthProvider'
import {
  listSedes, listPisos, listPuertas, listResponsables, listServicios, tarjetasDisponibles,
  buscarVisitante, upsertVisitante, registrarVisita,
} from '../lib/data'
import type { Sede, Piso, Puerta, Responsable, Servicio, Tarjeta, TipoVisitante, OcupacionUbicacion } from '../lib/types'

const TIPOS: { v: TipoVisitante; label: string; icon: string; desc: string }[] = [
  { v: 'familiar', label: 'Familiar', icon: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z', desc: 'Acompañante de un paciente' },
  { v: 'proveedor', label: 'Proveedor', icon: 'M3 7h13v8H3zM16 10h3l2 2v3h-5M5.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM18.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z', desc: 'Acompañado por responsable' },
  { v: 'colaborador', label: 'Colaborador', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', desc: 'Personal interno' },
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
  const [puertaId, setPuertaId] = useState('')
  const [tarjetaId, setTarjetaId] = useState('')
  const [sel, setSel] = useState<OcupacionUbicacion | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'sinPaciente' | 'cupo' | 'tarjeta'; o?: OcupacionUbicacion } | null>(null)

  // Maneja el clic en una habitación del mapa (ajustes 2 y 4)
  function seleccionar(o: OcupacionUbicacion) {
    if (!o.num_ingreso) { setAviso({ tipo: 'sinPaciente' }); return }
    if (o.visitas.length >= o.cupo) { setAviso({ tipo: 'cupo', o }); return }
    setSel(o)
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

  async function lookupCedula() {
    if (!cedula.trim()) return
    const v = await buscarVisitante(cedula)
    if (v) { setNombres(v.nombres_completos); setCelular(v.celular ?? ''); setEmail(v.email ?? ''); setExiste(true) }
    else { setExiste(false) }
  }

  function reset() {
    setTipo(null); setSel(null); setCedula(''); setNombres(''); setCelular(''); setEmail(''); setExiste(false)
    setTipoAcomp('visita'); setPermisoOtros(''); setResponsableId(''); setServicioVisita(''); setTarjetaId('')
  }

  async function guardar() {
    setMsg(null)
    if (!cedula.trim() || !nombres.trim()) { setMsg({ ok: false, texto: 'Cédula y nombres son obligatorios.' }); return }
    if (tipo === 'familiar' && !sel?.num_ingreso) { setMsg({ ok: false, texto: 'Selecciona la habitación del paciente en el mapa.' }); return }
    if (tipo === 'proveedor' && !responsableId) { setMsg({ ok: false, texto: 'Selecciona la persona responsable que acompaña.' }); return }
    if (!tarjetaId) { setAviso({ tipo: 'tarjeta' }); return }
    setGuardando(true)
    try {
      const visitanteId = await upsertVisitante({ cedula, nombres_completos: nombres, celular: celular || null, email: email || null })
      await registrarVisita({
        tipo_visitante: tipo!,
        visitante_id: visitanteId,
        tipo_acompanante: tipo === 'familiar' ? tipoAcomp : null,
        paciente_documento: sel?.num_ingreso ? (sel as any).paciente_documento ?? null : null,
        paciente_nombre: sel?.paciente_nombre ?? null,
        num_ingreso: sel?.num_ingreso ?? null,
        ubicacion_id: sel?.ubicacion_id ?? null,
        ubicacion_etiqueta: sel?.etiqueta ?? null,
        piso_id: tipo === 'familiar' ? pisoId : null,
        aislamiento: sel?.aislamiento ?? null,
        responsable_id: tipo === 'proveedor' ? responsableId : null,
        permiso_alimentos: false,
        permiso_otros: permisoOtros || null,
        servicio_paciente: tipo === 'colaborador' ? servicioVisita || null : sel?.area ?? null,
        sede_id: sedeId || null,
        puerta_id: puertaId || null,
        tarjeta_id: tarjetaId || null,
        registrado_por: perfil?.id ?? null,
      })
      setMsg({ ok: true, texto: `Visita registrada para ${nombres}.` })
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
        <div className="grid gap-3 sm:grid-cols-3">
          {TIPOS.map((t) => (
            <button key={t.v} onClick={() => { reset(); setTipo(t.v) }}
              className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left transition ${tipo === t.v ? 'border-brand bg-brand-50' : 'border-gray-200 hover:border-brand-light'}`}>
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
              </div>
              {pisoId && <MapaHabitaciones pisoId={pisoId} refreshKey={refreshMapa} onSelect={seleccionar} />}
            </Card>
          )}

          {/* Formulario */}
          <Card className={`p-5 ${tipo === 'familiar' ? 'lg:col-span-2' : 'lg:col-span-5'}`}>
            <div className="text-sm font-semibold text-brand mb-3">{tipo === 'familiar' ? '3. Datos del visitante' : '2. Datos del visitante'}</div>

            {tipo === 'familiar' && (
              <div className={`mb-4 rounded-lg border px-3 py-2 text-sm ${sel ? 'border-brand-light bg-brand-50' : 'border-dashed border-gray-300 bg-gray-50 text-gray-500'}`}>
                {sel
                  ? <div>
                      <div className="font-semibold text-brand flex items-center gap-2">Habitación {sel.etiqueta}
                        {sel.aislamiento && <Badge color="red">Aislamiento {sel.aislamiento}</Badge>}
                      </div>
                      <div className="text-gray-700">{sel.paciente_nombre} · # ingreso {sel.num_ingreso}</div>
                      <div className="text-xs text-gray-500">Cupo {sel.visitas.length}/{sel.cupo}{sel.visitas.length >= sel.cupo ? ' — completo' : ''}</div>
                    </div>
                  : 'Selecciona una habitación ocupada en el mapa →'}
              </div>
            )}

            <div className="space-y-3">
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

              {/* Familiar */}
              {tipo === 'familiar' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de acompañante</label>
                    <div className="flex gap-2">
                      {(['permanente', 'visita'] as const).map((t) => (
                        <button key={t} onClick={() => setTipoAcomp(t)}
                          className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm capitalize ${tipoAcomp === t ? 'border-brand bg-brand-50 text-brand font-medium' : 'border-gray-200 text-gray-600'}`}>{t}</button>
                      ))}
                    </div>
                  </div>
                  <input className={inputCls} value={permisoOtros} onChange={(e) => setPermisoOtros(e.target.value)} placeholder="Elementos / permisos autorizados (opcional)" />
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
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Puerta de ingreso</label>
                  <select className={inputCls} value={puertaId} onChange={(e) => setPuertaId(e.target.value)}>
                    {puertas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Tarjeta de acceso *</label>
                  <select className={`${inputCls} ${!tarjetaId ? 'border-rose-300' : ''}`} value={tarjetaId} onChange={(e) => setTarjetaId(e.target.value)}>
                    <option value="">— Selecciona tarjeta —</option>
                    {tarjetas.map((t) => <option key={t.id} value={t.id}>{t.codigo}</option>)}
                  </select>
                  {tarjetas.length === 0 && <p className="text-xs text-amber-600 mt-1">No hay tarjetas disponibles en esta sede.</p>}
                </div>
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

      {/* Ajuste 4: cupo completo (máximo de visitantes alcanzado) */}
      <Modal open={aviso?.tipo === 'cupo'} onClose={() => setAviso(null)} title="Cupo de visitantes completo">
        {aviso?.o && (
          <>
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              La habitación <b>{aviso.o.etiqueta}</b> ({aviso.o.paciente_nombre}) ya alcanzó el máximo de
              <b> {aviso.o.cupo} visitante(s)</b>. No es posible registrar otro hasta que alguno registre su salida.
            </div>
            <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Visitantes actuales</div>
            <div className="mt-1 space-y-2">
              {aviso.o.visitas.map((v) => (
                <div key={v.visita_id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <div>
                    <div className="text-sm font-medium text-gray-800">{v.visitante_nombre}</div>
                    <div className="text-xs text-gray-500">
                      Tarjeta {v.tarjeta_codigo ?? '—'}
                      {v.celular && <> · <a href={`tel:${v.celular}`} className="text-brand-light hover:underline">{v.celular}</a></>}
                    </div>
                  </div>
                  <Badge color={v.tipo_acompanante === 'permanente' ? 'green' : 'amber'}>
                    {v.tipo_acompanante === 'permanente' ? 'Permanente' : 'Visita'}
                  </Badge>
                </div>
              ))}
            </div>
            <div className="mt-4 text-right"><Btn onClick={() => setAviso(null)}>Entendido</Btn></div>
          </>
        )}
      </Modal>
    </div>
  )
}
