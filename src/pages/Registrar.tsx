import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader, Btn } from '../components/ui'
import EstadoSyncCenso from '../components/EstadoSyncCenso'
import { useAuth } from '../auth/AuthProvider'
import { TIPOS, requierePermanente, restriccionEstaActiva, validarRegistro, armarVisita, type TipoAviso, type DatosRegistro } from './registrar/reglas'
import { useCatalogosSede } from './registrar/useCatalogosSede'
import { InicioRegistro, FranjaRegistro, TarjetaPaciente, AvisosPaciente, CamposVisitante, CamposSegunTipo, CamposAcceso, ModalAviso, ModalAutorizacion, ZonaMapa, MarcoFormulario } from './registrar/Piezas'
import {
  listUbicaciones,
  buscarVisitante, upsertVisitante, registrarVisita, ordenarAreas, evaluarRestricciones, buscarPacientePorDocumento, buscarPacienteEnCenso, verificarPacienteCenso, type EvalRestriccion, type VerificacionCenso,
} from '../lib/data'
import type { TipoVisitante, OcupacionUbicacion } from '../lib/types'

export default function Registrar() {
  const { perfil, sedeTrabajo } = useAuth()
  const [tipo, setTipo] = useState<TipoVisitante | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [refreshMapa, setRefreshMapa] = useState(0)

  // catálogos de la sede (sedes, pisos, puertas, tarjetas, responsables, servicios)
  const { sedes, sedeId, setSedeId, pisos, pisoId, setPisoId, puertas, puertaId, setPuertaId, tarjetas, recargarTarjetas, responsables, servicios } =
    useCatalogosSede(sedeTrabajo?.id ?? null)

  // selección
  const [areas, setAreas] = useState<string[]>([])
  const [area, setArea] = useState('')
  const [tarjetaId, setTarjetaId] = useState('')
  const [sel, setSel] = useState<OcupacionUbicacion | null>(null)
  const [aviso, setAviso] = useState<{ tipo: TipoAviso; o?: OcupacionUbicacion } | null>(null)

  // Restricciones (horario / cupo) del paciente seleccionado y datos de autorización excepcional
  const [restric, setRestric] = useState<EvalRestriccion | null>(null)
  const [autorizadoPorId, setAutorizadoPorId] = useState('')
  const [autorizacionObs, setAutorizacionObs] = useState('')

  // Búsqueda de paciente por identificación (cuando no está en el mapa / sin cama)
  const [docPaciente, setDocPaciente] = useState('')
  const [buscandoDoc, setBuscandoDoc] = useState(false)
  const [docMsg, setDocMsg] = useState<string | null>(null)

  // "Sin tarjeta" solo aplica a la sede de Urgencias (no hay ubicación/cama que vincular).
  const esUrgencias = useMemo(() => sedes.find((s) => s.id === sedeId)?.nombre === 'Urgencias', [sedes, sedeId])
  const tiposDisponibles = useMemo(() => TIPOS.filter((t) => t.v !== 'sin_tarjeta' || esUrgencias), [esUrgencias])

  // La puerta de ingreso decide si se pide tarjeta (p.ej. Urgencias/Puerta Pacientes no la exige).
  const puertaSel = useMemo(() => puertas.find((p) => p.id === puertaId), [puertas, puertaId])
  const requiereTarjeta = tipo !== 'sin_tarjeta' && (puertaSel?.requiere_tarjeta ?? true)

  // Verificación de la ubicación contra el censo en vivo. Evita registrar con datos de un
  // paciente que ya cambió de cama o egresó desde la última sincronización.
  const [verif, setVerif] = useState<VerificacionCenso | 'verificando' | null>(null)
  const verifId = useRef(0)
  // Desde "Pacientes sin ubicación": /registrar?doc=… entra como Familiar con el paciente ya buscado y seleccionado.
  const [params, setParams] = useSearchParams()
  // El efecto debe correr solo cuando cambia la URL, pero usar la versión más reciente de estas
  // funciones (que se recrean en cada render). Se guardan en una ref que se actualiza tras cada
  // render: el efecto llama siempre a la última sin tener que re-ejecutarse cuando cambian.
  const abrirDesdeDocumento = (doc: string) => {
    reset(); setTipo('familiar'); setDocPaciente(doc)
    buscarPorIdentificacion(doc)
  }
  const abrirDesdeDocumentoRef = useRef(abrirDesdeDocumento)
  useLayoutEffect(() => { abrirDesdeDocumentoRef.current = abrirDesdeDocumento })
  useEffect(() => {
    const doc = params.get('doc')
    if (!doc) return
    abrirDesdeDocumentoRef.current(doc)
    setParams({}, { replace: true })
  }, [params, setParams])

  // Alto real de la franja fija (una o dos líneas según el ancho): el formulario se fija justo debajo.
  const franjaRef = useRef<HTMLDivElement>(null)
  const [altoFranja, setAltoFranja] = useState(72)
  useEffect(() => {
    const el = franjaRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setAltoFranja(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [tipo])

  // Maneja el clic en una habitación del mapa: valida paciente y evalúa horario/cupos.
  async function seleccionar(o: OcupacionUbicacion) {
    if (!o.num_ingreso) { setAviso({ tipo: 'sinPaciente' }); return }
    setSel(o)
    setRestric(null)
    // Regla de edad: ≥65 o ≤18 ⇒ acompañante permanente
    if (requierePermanente(o.edad)) setTipoAcomp('permanente')
    evaluarRestricciones(o).then(setRestric)
    const id = ++verifId.current
    setVerif('verificando')
    const v = await verificarPacienteCenso(o)
    if (id !== verifId.current) return // el usuario ya eligió a otro paciente
    setVerif(v)
    if (v.estado === 'egreso') {
      setSel(null); setRestric(null); setAviso({ tipo: 'egreso', o }); setRefreshMapa((k) => k + 1)
    } else if (v.ocupacion) {
      setSel(v.ocupacion)
      if (requierePermanente(v.ocupacion.edad)) setTipoAcomp('permanente')
      // El servicio y el aislamiento pueden haber cambiado: el horario aplicable también.
      evaluarRestricciones(v.ocupacion).then((r) => { if (id === verifId.current) setRestric(r) })
      if (v.estado === 'cambio') setRefreshMapa((k) => k + 1)
    }
  }

  // Busca el paciente por número de identificación y lo selecciona aunque no tenga cama.
  // Solo la búsqueda más reciente selecciona paciente: si llegan dos (p.ej. desde
  // «Pacientes sin ubicación» y luego a mano), una respuesta lenta no reemplaza a la última.
  // Se usa un contador y no la limpieza del efecto porque ese efecto se re-ejecuta a sí mismo
  // (setParams({}) cambia `params`), y cancelar ahí descartaría siempre la búsqueda.
  const busquedaId = useRef(0)
  async function buscarPorIdentificacion(valor: string = docPaciente) {
    setDocMsg(null)
    if (!valor.trim()) return
    const id = ++busquedaId.current
    setBuscandoDoc(true)
    try {
      // Si no está en la copia local puede haber ingresado después de la última sincronización.
      const o = await buscarPacientePorDocumento(valor) ?? await buscarPacienteEnCenso(valor)
      if (id !== busquedaId.current) return
      if (!o) { setDocMsg('No se encontró un paciente con esa identificación.'); return }
      seleccionar(o)
    } finally { if (id === busquedaId.current) setBuscandoDoc(false) }
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

  // "Sin tarjeta" deja de aplicar si se cambia a una sede distinta de Urgencias.
  useEffect(() => { if (tipo === 'sin_tarjeta' && !esUrgencias) reset() }, [tipo, esUrgencias])
  // Si la puerta seleccionada deja de requerir tarjeta (o cambia), se limpia la selección previa.
  useEffect(() => { if (!requiereTarjeta) setTarjetaId('') }, [requiereTarjeta])
  useEffect(() => {
    // Al cambiar de piso se descarta la cama elegida en el mapa, pero no un paciente sin ubicación
    // traído por búsqueda (p. ej. desde "Pacientes sin ubicación": los pisos cargan después).
    setArea(''); setSel((s) => (s && s.piso_id && s.piso_id !== pisoId ? null : s))
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
    verifId.current++; setVerif(null)
  }

  const restriccionActiva = restriccionEstaActiva(restric)
  const datos = (): DatosRegistro => ({
    tipo: tipo!, cedula, nombres, celular, email, sel, verif, restric, tipoAcomp, permisoOtros, responsableId, servicioVisita,
    sedeId, puertaId, requiereTarjeta, tarjetaId, hayTarjetas: tarjetas.length > 0, autorizadoPorId, autorizacionObs,
  })

  // Validaciones básicas; si hay restricción de horario/cupo abre el modal de autorización.
  function guardar() {
    setMsg(null)
    const error = validarRegistro(datos())
    if (error && 'msg' in error) { setMsg({ ok: false, texto: error.msg }); return }
    if (error) { setAviso({ tipo: error.aviso, o: error.aviso === 'autorizacion' ? sel ?? undefined : undefined }); return }
    doGuardar()
  }

  // Confirma desde el modal de autorización (ya se eligió el responsable que autoriza).
  function continuarConAutorizacion() {
    if (!autorizadoPorId) return
    setAviso(null)
    doGuardar()
  }

  async function doGuardar() {
    const d = datos()
    const autorizado = restriccionActiva && autorizadoPorId
    setGuardando(true)
    try {
      const visitanteId = await upsertVisitante({ cedula, nombres_completos: nombres, celular: celular || null, email: email || null })
      await registrarVisita(armarVisita(d, visitanteId, perfil?.id ?? null))
      setMsg({ ok: true, texto: `Visita registrada para ${nombres}.${autorizado ? ' (ingreso autorizado excepcionalmente)' : ''}` })
      setRefreshMapa((k) => k + 1)
      recargarTarjetas()
      reset()
    } catch (e: any) {
      setMsg({ ok: false, texto: 'Error al registrar: ' + (e.message ?? e) })
    } finally { setGuardando(false) }
  }

  const elegirTipo = (t: TipoVisitante) => { if (tipo !== t) { reset(); setTipo(t) } }
  const familiar = tipo === 'familiar'
  const verificando = familiar && verif === 'verificando'

  return (
    <div>
      {/* Aquí lo que queda fijo es la franja de sede/piso/búsqueda, no el título */}
      <PageHeader title="Registrar visita" subtitle="Ingreso de visitantes — zona horaria Colombia (GMT-5)" fijo={false} />
      <EstadoSyncCenso soloSiDesactualizado />

      {msg && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{msg.texto}</div>
      )}

      {/* Sin tipo: sede + tipo + fachada. Con un tipo elegido se contraen en una franja fija (debajo del
          header de 56 px): el formulario queda arriba y limpio, con piso y búsqueda siempre a mano. */}
      {!tipo && <InicioRegistro sedes={sedes} sedeId={sedeId} onSede={setSedeId} tipos={tiposDisponibles} esUrgencias={esUrgencias} onTipo={elegirTipo} />}

      {tipo && (
        <>
          <FranjaRegistro franjaRef={franjaRef} tipo={tipo} tipos={tiposDisponibles} onTipo={elegirTipo} onCancelar={reset}
            sedes={sedes} sedeId={sedeId} onSede={setSedeId}
            pisos={pisos} pisoId={pisoId} onPiso={(id) => { setPisoId(id); setSel(null) }}
            areas={areas} area={area} onArea={(a) => { setArea(a); setSel(null) }}
            docPaciente={docPaciente} onDoc={setDocPaciente} onBuscar={() => buscarPorIdentificacion()} buscandoDoc={buscandoDoc} docMsg={docMsg} />

          <div className="grid items-start gap-5 lg:grid-cols-5">
            {/* Mapa (solo familiar): piso, área y búsqueda viven en la franja fija de arriba */}
            {familiar && <ZonaMapa pisoId={pisoId} area={area} refreshKey={refreshMapa} onSelect={seleccionar} />}

            {/* Formulario — resaltado y fijo bajo la franja, para no perderlo al bajar por el mapa */}
            <MarcoFormulario familiar={familiar} altoFranja={altoFranja}>

              {familiar && <>
                <TarjetaPaciente sel={sel} restric={restric} verif={verif} />
                <AvisosPaciente sel={sel} restric={restric} restriccionActiva={restriccionActiva} />
              </>}

              <div className="space-y-3">
                {familiar && <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Datos del visitante</div>}
                <CamposVisitante cedula={cedula} onCedula={setCedula} onBlurCedula={lookupCedula} existe={existe}
                  nombres={nombres} onNombres={setNombres} celular={celular} onCelular={setCelular} email={email} onEmail={setEmail} />
                <CamposSegunTipo tipo={tipo} tipoAcomp={tipoAcomp} onTipoAcomp={setTipoAcomp} permisoOtros={permisoOtros} onPermiso={setPermisoOtros}
                  responsables={responsables} responsableId={responsableId} onResponsable={setResponsableId}
                  servicios={servicios} servicioVisita={servicioVisita} onServicio={setServicioVisita} />
                <CamposAcceso tipo={tipo} puertas={puertas} puertaId={puertaId} onPuerta={setPuertaId} puertaSel={puertaSel}
                  requiereTarjeta={requiereTarjeta} tarjetas={tarjetas} tarjetaId={tarjetaId} onTarjeta={setTarjetaId} />

                <div className="flex gap-2 pt-2">
                  <Btn onClick={guardar} disabled={guardando || verificando} className="flex-1">{textoBotonRegistrar(guardando, verificando)}</Btn>
                  <Btn variant="ghost" onClick={reset}>Cancelar</Btn>
                </div>
              </div>
            </MarcoFormulario>
          </div>
        </>
      )}

      <ModalAviso aviso={aviso} onCerrar={() => setAviso(null)} />
      <ModalAutorizacion abierto={aviso?.tipo === 'autorizacion'} ocupacion={aviso?.o} restric={restric} responsables={responsables}
        autorizadoPorId={autorizadoPorId} onAutoriza={setAutorizadoPorId} obs={autorizacionObs} onObs={setAutorizacionObs}
        guardando={guardando} onContinuar={continuarConAutorizacion} onCerrar={() => setAviso(null)} />
    </div>
  )
}

const textoBotonRegistrar = (guardando: boolean, verificando: boolean) =>
  guardando ? 'Registrando…' : verificando ? 'Verificando ubicación…' : 'Registrar ingreso'
