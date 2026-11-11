import type { ReactNode, RefObject } from 'react'
import { Link } from 'react-router-dom'
import { Card, Btn, selectCls, inputCls, textareaCls, Badge, Modal } from '../../components/ui'
import MapaHabitaciones from '../../components/MapaHabitaciones'
import type { EvalRestriccion, VerificacionCenso } from '../../lib/data'
import { AISLAMIENTO_LABEL } from '../../lib/types'
import type { Sede, Piso, Puerta, Responsable, Servicio, Tarjeta, TipoVisitante, OcupacionUbicacion } from '../../lib/types'
import { TIPOS, fechaHoraCO, motivoAutorizacion, requierePermanente, type TipoAviso } from './reglas'

// Piezas visuales de «Registrar visita». La página conserva todo el estado y la lógica del
// registro; estas piezas solo dibujan lo que reciben y avisan de los cambios.

type Tipo = (typeof TIPOS)[number]

const Icono = ({ d, className = 'h-4 w-4' }: { d: string; className?: string }) => (
  <svg className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={d} /></svg>
)
const ICONO_ALERTA = 'M12 9v4m0 4h.01M10.3 3.9l-8 14A2 2 0 004 21h16a2 2 0 001.7-3.1l-8-14a2 2 0 00-3.4 0z'
const ICONO_TARJETA = 'M3 10h18M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z'

// ── Pantalla inicial (sin tipo elegido): sede, tipo de visitante y fachada ──
export function InicioRegistro({ sedes, sedeId, onSede, tipos, esUrgencias, onTipo }: {
  sedes: Sede[]; sedeId: string; onSede: (id: string) => void; tipos: Tipo[]; esUrgencias: boolean; onTipo: (t: TipoVisitante) => void
}) {
  return (
    <div className="mb-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-5">
        {/* Sede: siempre visible — determina si "Sin tarjeta" aplica (solo Urgencias) */}
        <Card className="p-4">
          <div className="flex items-end gap-3">
            <div>
              <label htmlFor="registrar-sede" className="block text-xs font-medium text-gray-500 mb-1">Sede</label>
              <select id="registrar-sede" className={selectCls} value={sedeId} onChange={(e) => onSede(e.target.value)}>
                {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
          </div>
        </Card>

        {/* Paso 1: tipo */}
        <Card className="flex-1 p-5">
          <div className="text-sm font-semibold text-brand mb-3">1. Tipo de visitante</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {tipos.map((t) => (
              <button key={t.v} type="button" onClick={() => onTipo(t.v)}
                className="flex items-center gap-3 rounded-xl bg-white p-3 text-left shadow-neu-sm transition-[background-color,box-shadow] duration-150 hover:bg-brand-50 hover:shadow-neu">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-gray-100 text-brand"><Icono d={t.icon} className="h-5 w-5" /></span>
                <div>
                  <div className="text-sm font-semibold text-gray-800">{t.label}</div>
                  <div className="text-xs text-gray-500">{t.desc}</div>
                </div>
              </button>
            ))}
          </div>
          {!esUrgencias && <p className="mt-2 text-xs text-gray-400">"Sin tarjeta" solo está disponible para la sede Urgencias.</p>}
        </Card>
      </div>

      {/* Fachada de la clínica: no aporta datos, se oculta en pantallas angostas */}
      <div className="relative hidden min-h-[340px] overflow-hidden rounded-2xl shadow-neu-sm lg:block">
        <img src={`${import.meta.env.BASE_URL}images/fachada.jpg`} alt="Fachada de la Clínica Santa Bárbara" className="absolute inset-0 h-full w-full object-cover object-[50%_30%]" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand/70 via-brand/15 to-brand/5" />
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <div className="text-sm font-semibold">Clínica de Alta Complejidad Santa Bárbara</div>
          <div className="text-xs text-white/85">Control de ingreso de visitantes</div>
        </div>
      </div>
    </div>
  )
}

// ── Búsqueda del paciente por identificación (para pacientes sin cama o que no se ven en el mapa) ──
function BuscarPaciente({ docPaciente, onDoc, onBuscar, buscando }: { docPaciente: string; onDoc: (v: string) => void; onBuscar: () => void; buscando: boolean }) {
  return (
    <div className="relative flex min-w-[230px] flex-1 items-center gap-2">
      <svg className="pointer-events-none absolute left-3 h-4 w-4 text-gray-400" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.3-4.3M11 19a8 8 0 100-16 8 8 0 000 16z" /></svg>
      <input className={`${inputCls} py-1.5 pl-9 text-sm`} value={docPaciente} placeholder="¿Sin cama o no está en el mapa? N° identificación"
        aria-label="Buscar paciente por número de identificación" inputMode="numeric" autoComplete="off"
        onChange={(e) => onDoc(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onBuscar() }} />
      <Btn variant="light" onClick={onBuscar} disabled={buscando}>{buscando ? '…' : 'Buscar'}</Btn>
      <Link to="/sin-ubicacion" title="Pacientes del censo que no aparecen en el mapa"
        className="whitespace-nowrap text-xs font-medium text-brand-light hover:underline">Sin ubicación →</Link>
    </div>
  )
}

// ── Franja fija (con un tipo elegido): sede, piso, área, búsqueda y cambio de tipo ──
export function FranjaRegistro({ franjaRef, tipo, tipos, onTipo, onCancelar, sedes, sedeId, onSede, pisos, pisoId, onPiso, areas, area, onArea, docPaciente, onDoc, onBuscar, buscandoDoc, docMsg }: {
  franjaRef: RefObject<HTMLDivElement>; tipo: TipoVisitante; tipos: Tipo[]; onTipo: (t: TipoVisitante) => void; onCancelar: () => void
  sedes: Sede[]; sedeId: string; onSede: (id: string) => void
  pisos: Piso[]; pisoId: string; onPiso: (id: string) => void; areas: string[]; area: string; onArea: (a: string) => void
  docPaciente: string; onDoc: (v: string) => void; onBuscar: () => void; buscandoDoc: boolean; docMsg: string | null
}) {
  const familiar = tipo === 'familiar'
  return (
    <div ref={franjaRef} className="sticky top-[64px] z-[15] mb-5 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-2.5 shadow-neu">
      <img src={`${import.meta.env.BASE_URL}images/fachada.jpg`} alt="" aria-hidden className="hidden h-12 w-16 rounded-xl object-cover object-[50%_30%] sm:block" />
      <label className="flex items-center gap-2 text-xs font-medium text-gray-500">
        Sede
        <select aria-label="Sede" className={`${selectCls} py-1.5 text-sm`} value={sedeId} onChange={(e) => onSede(e.target.value)}>
          {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
      </label>
      {familiar && <>
        <label className="flex items-center gap-2 text-xs font-medium text-gray-500">
          Piso
          <select aria-label="Piso o servicio" className={`${selectCls} py-1.5 text-sm`} value={pisoId} onChange={(e) => onPiso(e.target.value)}>
            {pisos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </label>
        {areas.length > 0 && (
          <select aria-label="Área" className={`${selectCls} py-1.5 text-sm`} value={area} onChange={(e) => onArea(e.target.value)}>
            <option value="">Todas las áreas</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
        <BuscarPaciente docPaciente={docPaciente} onDoc={onDoc} onBuscar={onBuscar} buscando={buscandoDoc} />
      </>}
      <div role="group" aria-label="Tipo de visitante" className="ml-auto flex flex-wrap gap-1 rounded-xl bg-brand-50 p-1">
        {tipos.map((t) => (
          <button key={t.v} type="button" aria-pressed={tipo === t.v} onClick={() => onTipo(t.v)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${tipo === t.v ? 'bg-brand text-white shadow-neu-xs' : 'text-gray-600 hover:bg-white hover:text-brand'}`}>
            <Icono d={t.icon} />
            {t.label}
          </button>
        ))}
      </div>
      <button type="button" onClick={onCancelar} title="Volver a elegir el tipo de visitante" className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:bg-brand-50 hover:text-brand">Cancelar</button>
      {familiar && docMsg && (
        <p className="w-full rounded-lg bg-rose-50 px-3 py-1.5 text-xs text-rose-700">
          {docMsg} <Link to="/sin-ubicacion" className="font-semibold underline">Revisa la lista de pacientes sin ubicación</Link>.
        </p>
      )}
    </div>
  )
}

// ── Resultado de verificar la ubicación del paciente contra el censo en vivo ──
function EstadoVerificacion({ verif }: { verif: VerificacionCenso | 'verificando' | null }) {
  if (!verif) return null
  if (verif === 'verificando') return <div className="mt-1.5 rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600">Verificando la ubicación en el censo…</div>
  if (verif.estado === 'ok') return <div className="mt-1.5 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">✓ Ubicación confirmada en el censo: {verif.ubicacionCenso}</div>
  if (verif.estado === 'cambio') return <div className="mt-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800"><b>La ubicación cambió.</b> La app tenía «{verif.ubicacionAnterior}»; el censo indica hoy: <b>{verif.ubicacionCenso}</b>. Se registrará la ubicación del censo.</div>
  if (verif.estado === 'no_disponible') return <div className="mt-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">No se pudo confirmar en vivo. Esta ubicación es la de la última sincronización: confírmala con el paciente o el servicio.</div>
  return null
}

// ── Paciente elegido en el mapa (o el recordatorio para elegirlo) ──
export function TarjetaPaciente({ sel, restric, verif }: { sel: OcupacionUbicacion | null; restric: EvalRestriccion | null; verif: VerificacionCenso | 'verificando' | null }) {
  if (!sel) {
    return <div className="mb-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2.5 text-sm text-gray-500">Selecciona una habitación ocupada en el mapa →</div>
  }
  const areaServicio = [sel.area, sel.servicio].filter(Boolean).join(' · ')
  return (
    <div className="mb-4 rounded-lg border border-brand-light bg-brand-50 px-3 py-2.5 text-sm">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-brand-light">
        <Icono d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" className="h-3.5 w-3.5" />
        Paciente seleccionado
      </div>
      <div className="text-base font-bold leading-tight text-brand">{sel.paciente_nombre}{sel.edad != null ? ` · ${sel.edad} años` : ''}</div>
      <div className="text-gray-700">{sel.paciente_documento ? <><b>ID</b> {sel.paciente_documento} · </> : ''}# ingreso {sel.num_ingreso} · {sel.etiqueta}
        {sel.aislamiento && <Badge color="red">Aislamiento {AISLAMIENTO_LABEL[sel.aislamiento]}</Badge>}
      </div>
      {areaServicio && <div className="text-xs text-brand-light">{areaServicio}</div>}
      <div className="text-xs text-gray-500">Cupo {sel.visitas.length}/{restric?.limiteSimultaneo ?? sel.cupo}{restric ? ` · ${restric.visitasHoy} visita(s) hoy` : ''}</div>
      <EstadoVerificacion verif={verif} />
    </div>
  )
}

// ── Avisos de regla institucional sobre el paciente elegido ──
export function AvisosPaciente({ sel, restric, restriccionActiva }: { sel: OcupacionUbicacion | null; restric: EvalRestriccion | null; restriccionActiva: boolean }) {
  const permanente = !!sel && requierePermanente(sel.edad)
  return (
    <>
      {permanente && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          <Icono d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" className="h-4 w-4 shrink-0" />
          <span>Paciente de <b>{sel!.edad} años</b> ({sel!.edad! <= 18 ? 'menor de edad' : 'adulto mayor'}): requiere <b>acompañante permanente</b>.</span>
        </div>
      )}
      {restriccionActiva && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <Icono d={ICONO_ALERTA} className="h-4 w-4 shrink-0" />
          <span>{motivoAutorizacion(restric)}. Al registrar se pedirá <b>autorización</b>.</span>
        </div>
      )}
    </>
  )
}

// ── Datos del visitante ──
export function CamposVisitante({ cedula, onCedula, onBlurCedula, existe, nombres, onNombres, celular, onCelular, email, onEmail }: {
  cedula: string; onCedula: (v: string) => void; onBlurCedula: () => void; existe: boolean
  nombres: string; onNombres: (v: string) => void; celular: string; onCelular: (v: string) => void; email: string; onEmail: (v: string) => void
}) {
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <label htmlFor="registrar-cedula" className="block text-xs font-medium text-gray-500 mb-1">Cédula *</label>
          <input id="registrar-cedula" className={inputCls} value={cedula} onChange={(e) => onCedula(e.target.value)} onBlur={onBlurCedula}
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
        <label htmlFor="registrar-nombres-completos" className="block text-xs font-medium text-gray-500 mb-1">Nombres completos *</label>
        <input id="registrar-nombres-completos" className={inputCls} value={nombres} onChange={(e) => onNombres(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="registrar-celular" className="block text-xs font-medium text-gray-500 mb-1">Celular</label>
          <input id="registrar-celular" className={inputCls} value={celular} onChange={(e) => onCelular(e.target.value)} />
        </div>
        <div>
          <label htmlFor="registrar-email-opcional" className="block text-xs font-medium text-gray-500 mb-1">Email (opcional)</label>
          <input id="registrar-email-opcional" className={inputCls} value={email} onChange={(e) => onEmail(e.target.value)} />
        </div>
      </div>
    </>
  )
}

// ── Campos que dependen del tipo de visitante ──
export function CamposSegunTipo({ tipo, tipoAcomp, onTipoAcomp, permisoOtros, onPermiso, responsables, responsableId, onResponsable, servicios, servicioVisita, onServicio }: {
  tipo: TipoVisitante
  tipoAcomp: 'permanente' | 'visita'; onTipoAcomp: (t: 'permanente' | 'visita') => void; permisoOtros: string; onPermiso: (v: string) => void
  responsables: Responsable[]; responsableId: string; onResponsable: (id: string) => void
  servicios: Servicio[]; servicioVisita: string; onServicio: (v: string) => void
}) {
  if (tipo === 'familiar' || tipo === 'sin_tarjeta') {
    return (
      <>
        <div>
          {/* No es un campo sino dos botones excluyentes: título de grupo + aria-pressed,
              así el lector de pantalla anuncia «Tipo de acompañante» y cuál está elegido. */}
          <span id="registrar-tipo-acompanante" className="block text-xs font-medium text-gray-500 mb-1">Tipo de acompañante</span>
          <div className="flex gap-2" role="group" aria-labelledby="registrar-tipo-acompanante">
            {(['permanente', 'visita'] as const).map((t) => (
              <button key={t} type="button" aria-pressed={tipoAcomp === t} onClick={() => onTipoAcomp(t)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm capitalize transition-[background-color,color,box-shadow] duration-150 ${tipoAcomp === t ? 'bg-brand-50 text-brand font-medium shadow-neu-inset-sm' : 'bg-white text-gray-600 shadow-neu-xs hover:shadow-neu-sm'}`}>{t}</button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="registrar-permisos" className="block text-xs font-medium text-gray-500 mb-1">Elementos / permisos autorizados (opcional)</label>
          <textarea id="registrar-permisos" className={textareaCls} rows={3} value={permisoOtros} onChange={(e) => onPermiso(e.target.value)} placeholder="Ej.: termo, cobija, revistas" />
        </div>
      </>
    )
  }
  if (tipo === 'proveedor') {
    return (
      <div>
        <label htmlFor="registrar-acompanante-autorizado-responsable" className="block text-xs font-medium text-gray-500 mb-1">Acompañante autorizado (responsable) *</label>
        <select id="registrar-acompanante-autorizado-responsable" className={inputCls} value={responsableId} onChange={(e) => onResponsable(e.target.value)}>
          <option value="">— Selecciona —</option>
          {responsables.map((r) => <option key={r.id} value={r.id}>{r.nombre_completo} — {r.numero_documento}</option>)}
        </select>
        {responsables.length === 0 && <p className="text-xs text-amber-600 mt-1">No hay responsables. Créalos en Administración → Responsables.</p>}
      </div>
    )
  }
  return (
    <div>
      <label htmlFor="registrar-servicio-motivo" className="block text-xs font-medium text-gray-500 mb-1">Servicio / motivo</label>
      <select id="registrar-servicio-motivo" className={inputCls} value={servicioVisita} onChange={(e) => onServicio(e.target.value)}>
        <option value="">— Servicio que visita —</option>
        {servicios.map((s) => <option key={s.id} value={s.nombre}>{s.nombre}</option>)}
      </select>
    </div>
  )
}

// ── Puerta de ingreso y tarjeta de acceso ──
export function CamposAcceso({ tipo, puertas, puertaId, onPuerta, puertaSel, requiereTarjeta, tarjetas, tarjetaId, onTarjeta }: {
  tipo: TipoVisitante; puertas: Puerta[]; puertaId: string; onPuerta: (id: string) => void; puertaSel: Puerta | undefined
  requiereTarjeta: boolean; tarjetas: Tarjeta[]; tarjetaId: string; onTarjeta: (id: string) => void
}) {
  return (
    <>
      <div className={`grid gap-2 pt-1 ${requiereTarjeta ? 'grid-cols-2' : ''}`}>
        <div>
          <label htmlFor="registrar-puerta-de-ingreso" className="block text-xs font-medium text-gray-500 mb-1">Puerta de ingreso</label>
          <select id="registrar-puerta-de-ingreso" className={inputCls} value={puertaId} onChange={(e) => onPuerta(e.target.value)}>
            {puertas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        {requiereTarjeta && (
          <div>
            <label htmlFor="registrar-tarjeta-de-acceso" className="block text-xs font-medium text-gray-500 mb-1">Tarjeta de acceso *</label>
            <select id="registrar-tarjeta-de-acceso" className={`${inputCls} ${!tarjetaId ? 'border-rose-300' : ''}`} value={tarjetaId} onChange={(e) => onTarjeta(e.target.value)}>
              <option value="">— Selecciona tarjeta —</option>
              {tarjetas.map((t) => <option key={t.id} value={t.id}>{t.codigo}</option>)}
            </select>
            {tarjetas.length === 0 && <p className="text-xs text-amber-600 mt-1">No hay tarjetas disponibles en esta sede.</p>}
          </div>
        )}
      </div>
      {tipo !== 'sin_tarjeta' && !requiereTarjeta && puertaSel && (
        <p className="text-xs text-gray-500">Ingreso sin tarjeta: <b>{puertaSel.nombre}</b> no requiere tarjeta de acceso.</p>
      )}
    </>
  )
}

// ── Avisos simples (un solo botón «Entendido»): antes eran cuatro modales casi iguales ──
const AVISOS: Partial<Record<TipoAviso, { titulo: string; icono: string; tono: string; texto: (o?: OcupacionUbicacion) => JSX.Element }>> = {
  sinPaciente: {
    titulo: 'Habitación sin paciente', icono: ICONO_ALERTA, tono: 'bg-amber-100 text-amber-600',
    texto: () => <>Esta ubicación <b>no tiene un paciente registrado</b> actualmente, por lo que no es posible
      registrar un visitante familiar aquí. Verifica el número de habitación o selecciona una ocupada.</>,
  },
  egreso: {
    titulo: 'El paciente ya no está en el censo', icono: ICONO_ALERTA, tono: 'bg-amber-100 text-amber-600',
    texto: (o) => <><b>{o?.paciente_nombre}</b> (ingreso {o?.num_ingreso}) aparecía en <b>{o?.etiqueta}</b>, pero
      el censo ya no lo reporta: probablemente <b>egresó</b>. No es posible registrar la visita. Verifica con el servicio
      o búscalo por identificación si tiene un ingreso nuevo.</>,
  },
  sinTarjetas: {
    titulo: 'Sin tarjetas de acceso disponibles', icono: ICONO_TARJETA + 'M7 15h2', tono: 'bg-rose-100 text-rose-600',
    texto: () => <>No hay <b>tarjetas de acceso disponibles</b> en esta sede en este momento (todas están en uso).
      No es posible registrar el ingreso sin una tarjeta. Por favor <b>solicita al área administrativa
      la compra de más tarjetas</b>, o registra primero la salida de algún visitante para liberar una.</>,
  },
  tarjeta: {
    titulo: 'Falta la tarjeta de acceso', icono: ICONO_TARJETA, tono: 'bg-amber-100 text-amber-600',
    texto: () => <>Debes <b>seleccionar una tarjeta de acceso</b> para registrar el ingreso del visitante.
      Elige una tarjeta disponible en el campo «Tarjeta de acceso».</>,
  },
}
export function ModalAviso({ aviso, onCerrar }: { aviso: { tipo: TipoAviso; o?: OcupacionUbicacion } | null; onCerrar: () => void }) {
  const def = aviso ? AVISOS[aviso.tipo] : undefined
  return (
    <Modal open={!!def} onClose={onCerrar} title={def?.titulo ?? ''}>
      {def && (
        <>
          <div className="flex items-start gap-3">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${def.tono}`}><Icono d={def.icono} className="h-5 w-5" /></span>
            <p className="text-sm text-gray-700">{def.texto(aviso?.o)}</p>
          </div>
          <div className="mt-4 text-right"><Btn onClick={onCerrar}>Entendido</Btn></div>
        </>
      )}
    </Modal>
  )
}

// ── Fuera de horario / excede cupo → autorización excepcional (permite continuar) ──
function MotivosRestriccion({ restric }: { restric: EvalRestriccion }) {
  return (
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
  )
}

function VisitantesActuales({ visitas }: { visitas: OcupacionUbicacion['visitas'] }) {
  if (visitas.length === 0) return null
  return (
    <>
      <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">Visitantes actuales</div>
      <div className="mt-1 space-y-2">
        {visitas.map((v) => (
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
  )
}

export function ModalAutorizacion({ abierto, ocupacion, restric, responsables, autorizadoPorId, onAutoriza, obs, onObs, guardando, onContinuar, onCerrar }: {
  abierto: boolean; ocupacion?: OcupacionUbicacion; restric: EvalRestriccion | null; responsables: Responsable[]
  autorizadoPorId: string; onAutoriza: (id: string) => void; obs: string; onObs: (v: string) => void
  guardando: boolean; onContinuar: () => void; onCerrar: () => void
}) {
  return (
    <Modal open={abierto} onClose={onCerrar} title="Ingreso fuera de las condiciones de visita">
      {ocupacion && restric && (
        <>
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-600"><Icono d={ICONO_ALERTA} className="h-5 w-5" /></span>
            <MotivosRestriccion restric={restric} />
          </div>

          <div className="mt-4">
            <label htmlFor="registrar-autoriza-el-ingreso-responsable" className="block text-xs font-medium text-gray-500 mb-1">Autoriza el ingreso (responsable) *</label>
            <select id="registrar-autoriza-el-ingreso-responsable" className={`${inputCls} ${!autorizadoPorId ? 'border-amber-300' : ''}`} value={autorizadoPorId} onChange={(e) => onAutoriza(e.target.value)}>
              <option value="">— Selecciona quién autoriza —</option>
              {responsables.map((r) => <option key={r.id} value={r.id}>{r.nombre_completo} — {r.numero_documento}</option>)}
            </select>
            {responsables.length === 0 && <p className="text-xs text-amber-600 mt-1">No hay responsables. Créalos en Administración → Responsables.</p>}
            <label htmlFor="registrar-autorizacion-obs" className="mt-2 block text-xs font-medium text-gray-500 mb-1">Observación / motivo de la autorización (opcional)</label>
            <input id="registrar-autorizacion-obs" className={inputCls} value={obs} onChange={(e) => onObs(e.target.value)} placeholder="Ej.: paciente en fase terminal, autoriza jefe de piso" />
          </div>

          <VisitantesActuales visitas={ocupacion.visitas} />

          <div className="mt-5 flex gap-2">
            <Btn onClick={onContinuar} disabled={!autorizadoPorId || guardando} className="flex-1">
              {guardando ? 'Registrando…' : 'Continuar con autorización'}
            </Btn>
            <Btn variant="ghost" onClick={onCerrar}>Cancelar</Btn>
          </div>
        </>
      )}
    </Modal>
  )
}

// ── Paso 2 (solo familiar): el mapa del piso elegido ──
export function ZonaMapa({ pisoId, area, refreshKey, onSelect }: { pisoId: string; area: string; refreshKey: number; onSelect: (o: OcupacionUbicacion) => void }) {
  return (
    <Card hover={false} className="p-5 lg:col-span-3">
      <div className="text-sm font-semibold text-brand mb-3">2. Selecciona la habitación del paciente</div>
      {pisoId && <MapaHabitaciones pisoId={pisoId} refreshKey={refreshKey} onSelect={onSelect} area={area || undefined} />}
    </Card>
  )
}

// ── Marco del formulario: junto al mapa y fijo bajo la franja (familiar) o centrado (los demás) ──
export function MarcoFormulario({ familiar, altoFranja, children }: { familiar: boolean; altoFranja: number; children: ReactNode }) {
  const fijo = familiar
    ? { className: 'lg:col-span-2 lg:sticky lg:overflow-y-auto', style: { top: 64 + altoFranja + 12, maxHeight: `calc(100vh - ${64 + altoFranja + 28}px)` } }
    : { className: 'lg:col-span-5 mx-auto w-full max-w-xl', style: undefined }
  return (
    <Card hover={false} className={`relative overflow-hidden ring-2 ring-brand-light/30 p-5 ${fijo.className}`} style={fijo.style}>
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-brand to-brand-light" />
      <div className="mt-1 mb-3 inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white">
        <Icono d="M12 4v16m8-8H4" />
        {familiar ? '3. Registro de la visita' : '2. Datos del visitante'}
      </div>
      {children}
    </Card>
  )
}
