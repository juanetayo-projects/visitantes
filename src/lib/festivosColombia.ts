// Calcula los festivos de Colombia para cualquier año.
// Combina: fijos, fijos trasladados al lunes (Ley Emiliani) y los basados en
// la Pascua (algunos también trasladados al lunes).

function pascua(anio: number): Date {
  // Algoritmo de Computus (Pascua gregoriana)
  const a = anio % 19
  const b = Math.floor(anio / 100), c = anio % 100
  const d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(anio, mes - 1, dia)
}

const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const desde = (base: Date, dias: number) => { const d = new Date(base); d.setDate(d.getDate() + dias); return d }
// Traslada al siguiente lunes (Ley Emiliani); si ya es lunes, queda igual.
const aLunes = (d: Date) => desde(d, (8 - d.getDay()) % 7)

export interface FestivoCalc { fecha: string; nombre: string }

export function festivosColombia(anio: number): FestivoCalc[] {
  const p = pascua(anio)
  const fijo = (m: number, d: number) => new Date(anio, m - 1, d)
  const lista: FestivoCalc[] = [
    { fecha: fmt(fijo(1, 1)), nombre: 'Año Nuevo' },
    { fecha: fmt(aLunes(fijo(1, 6))), nombre: 'Reyes Magos' },
    { fecha: fmt(aLunes(fijo(3, 19))), nombre: 'Día de San José' },
    { fecha: fmt(desde(p, -3)), nombre: 'Jueves Santo' },
    { fecha: fmt(desde(p, -2)), nombre: 'Viernes Santo' },
    { fecha: fmt(fijo(5, 1)), nombre: 'Día del Trabajo' },
    { fecha: fmt(aLunes(desde(p, 39))), nombre: 'Ascensión del Señor' },
    { fecha: fmt(aLunes(desde(p, 60))), nombre: 'Corpus Christi' },
    { fecha: fmt(aLunes(desde(p, 68))), nombre: 'Sagrado Corazón' },
    { fecha: fmt(aLunes(fijo(6, 29))), nombre: 'San Pedro y San Pablo' },
    { fecha: fmt(fijo(7, 20)), nombre: 'Día de la Independencia' },
    { fecha: fmt(fijo(8, 7)), nombre: 'Batalla de Boyacá' },
    { fecha: fmt(aLunes(fijo(8, 15))), nombre: 'Asunción de la Virgen' },
    { fecha: fmt(aLunes(fijo(10, 12))), nombre: 'Día de la Raza' },
    { fecha: fmt(aLunes(fijo(11, 1))), nombre: 'Todos los Santos' },
    { fecha: fmt(aLunes(fijo(11, 11))), nombre: 'Independencia de Cartagena' },
    { fecha: fmt(fijo(12, 8)), nombre: 'Inmaculada Concepción' },
    { fecha: fmt(fijo(12, 25)), nombre: 'Navidad' },
  ]
  return lista.sort((a, b) => a.fecha.localeCompare(b.fecha))
}

// Utilidades de zona horaria Colombia (UTC-5, sin horario de verano).
// Devuelve 'YYYY-MM-DD' del día actual en Colombia, sin importar la TZ del navegador.
export function hoyColombia(): string {
  const co = new Date(Date.now() - 5 * 3_600_000)
  return co.toISOString().substring(0, 10)
}

// Devuelve 'HH:MM' (24h) de la hora actual en Colombia.
export function horaColombia(): string {
  const co = new Date(Date.now() - 5 * 3_600_000)
  return co.toISOString().substring(11, 16)
}

// Festivos (incluye domingos) como Set para lookups rápidos en gráficas/heatmap.
export function setFestivos(anioDesde: number, anioHasta: number): Set<string> {
  const s = new Set<string>()
  for (let y = anioDesde; y <= anioHasta; y++) festivosColombia(y).forEach((f) => s.add(f.fecha))
  return s
}

