import { PageHeader } from '../../components/ui'
import CrudTable from '../../components/CrudTable'

// "13:00" / "13:00:00" → "1:00 p.m."
function ampm(t?: string | null): string {
  if (!t) return ''
  const [hRaw, m] = t.split(':')
  const h = parseInt(hRaw, 10)
  const ap = h < 12 ? 'a.m.' : 'p.m.'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${(m ?? '00').padStart(2, '0')} ${ap}`
}
function ventanas(r: any): string {
  const p = [`${ampm(r.ventana1_inicio)} – ${ampm(r.ventana1_fin)}`]
  if (r.ventana2_inicio && r.ventana2_fin) p.push(`${ampm(r.ventana2_inicio)} – ${ampm(r.ventana2_fin)}`)
  return p.join('  /  ')
}

export default function HorariosVisita() {
  return (
    <div>
      <PageHeader title="Horarios de visita" subtitle="Horario, duración y cantidad de visitas permitidas por servicio (política institucional 6.1). Al registrar una visita fuera de estas condiciones, la app pide autorización." />

      <div className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand">
        El campo <b>«Coincidencia CENSO»</b> es el texto que se busca dentro del servicio que llega del CENSO/ubicación
        (ej. «HOSPITALIZACION 7» coincide con «HOSPITALIZACION 7 PISO»). Déjalo vacío y marca <b>«Aplica a aislamiento»</b>
        para la regla de pacientes aislados, o vacío sin esa marca para un <b>horario general</b>. Menor <b>prioridad</b> = se evalúa primero.
      </div>

      <CrudTable
        tabla="horarios_visita" titulo="Horarios por servicio" orderBy="prioridad"
        subtitulo="El aislamiento tiene prioridad sobre el servicio. «Máx. simultáneo» vacío usa el cupo de la ubicación."
        filtros={[
          { key: 'servicio', label: 'Servicio' },
          { key: 'aplica_aislamiento', label: 'Tipo', opciones: [{ value: 'true', label: 'Regla de aislamiento' }, { value: 'false', label: 'Por servicio' }] },
        ]}
        columnas={[
          { key: 'servicio', label: 'Servicio' },
          { key: 'match_censo', label: 'Coincidencia CENSO', render: (r) => r.aplica_aislamiento ? '🦠 Aislamiento' : (r.match_censo || '— general —') },
          { key: 'ventanas', label: 'Horario', render: (r) => ventanas(r) },
          { key: 'duracion_horas', label: 'Duración (h)' },
          { key: 'max_por_dia', label: 'Máx./día' },
          { key: 'max_simultaneo', label: 'Máx. simult.', render: (r) => r.max_simultaneo ?? 'cupo ubic.' },
          { key: 'prioridad', label: 'Prioridad' },
          { key: 'activo', label: 'Activo' },
        ]}
        campos={[
          { key: 'servicio', label: 'Servicio (etiqueta legible)', type: 'text', required: true },
          { key: 'match_censo', label: 'Coincidencia con servicio del CENSO (vacío = general/aislamiento)', type: 'text' },
          { key: 'aplica_aislamiento', label: 'Aplica a pacientes en aislamiento', type: 'checkbox', default: false },
          { key: 'ventana1_inicio', label: 'Ventana 1 — inicio', type: 'time', required: true },
          { key: 'ventana1_fin', label: 'Ventana 1 — fin', type: 'time', required: true },
          { key: 'ventana2_inicio', label: 'Ventana 2 — inicio (opcional)', type: 'time' },
          { key: 'ventana2_fin', label: 'Ventana 2 — fin (opcional)', type: 'time' },
          { key: 'duracion_horas', label: 'Duración (horas, informativo)', type: 'number', step: 0.5 },
          { key: 'max_por_dia', label: 'Máximo de personas por día', type: 'number', required: true, default: 1 },
          { key: 'max_simultaneo', label: 'Máximo simultáneo (vacío = cupo de la ubicación)', type: 'number' },
          { key: 'prioridad', label: 'Prioridad (menor = primero)', type: 'number', default: 100 },
          { key: 'notas', label: 'Indicaciones adicionales', type: 'text' },
        ]}
      />
    </div>
  )
}
