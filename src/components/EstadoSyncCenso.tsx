import { useEffect, useState } from 'react'
import { ultimoSyncExitoso } from '../lib/data'

// A partir de este umbral los datos del censo se consideran desactualizados.
const LIMITE_MIN = 120

function antiguedad(min: number): string {
  if (min < 60) return `${min} min`
  if (min < 48 * 60) return `${Math.round(min / 60)} h`
  return `${Math.round(min / 1440)} días`
}

// Aviso de qué tan recientes son los datos del censo que se están mostrando.
export default function EstadoSyncCenso({ soloSiDesactualizado = false }: { soloSiDesactualizado?: boolean }) {
  const [runAt, setRunAt] = useState<string | null | undefined>(undefined)
  useEffect(() => { ultimoSyncExitoso().then(setRunAt) }, [])
  if (runAt === undefined) return null

  const min = runAt ? Math.max(0, Math.round((Date.now() - new Date(runAt).getTime()) / 60_000)) : null
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
