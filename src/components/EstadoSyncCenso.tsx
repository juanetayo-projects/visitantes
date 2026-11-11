import { useEffect, useState } from 'react'
import { ultimoSyncExitoso } from '../lib/data'

// A partir de este umbral los datos del censo se consideran desactualizados.
const LIMITE_MIN = 120
// Cada cuánto se vuelve a consultar la última sincronización (el sync corre cada 15 min).
const REFRESCO_MS = 2 * 60_000

function antiguedad(min: number): string {
  if (min < 60) return `${min} min`
  if (min < 48 * 60) return `${Math.round(min / 60)} h`
  return `${Math.round(min / 1440)} días`
}

// Aviso de qué tan recientes son los datos del censo que se están mostrando.
export default function EstadoSyncCenso({ soloSiDesactualizado = false }: { soloSiDesactualizado?: boolean }) {
  const [runAt, setRunAt] = useState<string | null | undefined>(undefined)
  const [ahora, setAhora] = useState(() => Date.now())
  // Se re-consulta periódicamente y al volver a la pestaña: antes solo se leía al montar, y una
  // pestaña abierta desde la víspera mostraba «desactualizado hace 14 h» aunque el sync corriera bien.
  useEffect(() => {
    let vivo = true
    // `ahora` fuerza a recalcular la antigüedad aunque la última sincronización no haya cambiado
    // (si el sync se detuviera, el aviso debe aparecer igual).
    const cargar = () => { ultimoSyncExitoso().then((r) => { if (vivo) { setRunAt(r); setAhora(Date.now()) } }).catch(() => {}) }
    const alVolver = () => { if (document.visibilityState === 'visible') cargar() }
    cargar()
    const id = window.setInterval(cargar, REFRESCO_MS)
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('focus', cargar)
    return () => {
      vivo = false
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('focus', cargar)
    }
  }, [])
  if (runAt === undefined) return null

  const min = runAt ? Math.max(0, Math.round((ahora - new Date(runAt).getTime()) / 60_000)) : null
  const desactualizado = min == null || min > LIMITE_MIN
  if (soloSiDesactualizado && !desactualizado) return null

  return (
    <div role="status" className={`mb-4 rounded-lg px-4 py-3 text-sm ${desactualizado ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
      {min == null
        ? <><b>Aún no hay sincronizaciones exitosas con el censo.</b> Las ubicaciones de pacientes pueden no ser reales.</>
        : desactualizado
          ? <><b>Datos del censo desactualizados:</b> la última sincronización exitosa fue hace {antiguedad(min)}. Las ubicaciones del mapa pueden no ser las actuales; avisa al administrador.</>
          : <>Datos del censo actualizados: última sincronización hace {antiguedad(min)}.</>}
    </div>
  )
}
