// Trazos SVG (atributo d de <path>) de los íconos de la app.
// Viven aquí y no junto a los componentes: un archivo de componentes que además exporta objetos
// impide que el recargado en caliente de Vite (Fast Refresh) conserve el estado al editar.
import type { TipoUbicacion } from './types'

// Íconos del inicio (accesos, KPIs, paneles).
export const ICONOS = {
  personas: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1a4 4 0 100-8 4 4 0 000 8z',
  entrada: 'M11 16l4-4m0 0l-4-4m4 4H3m8-8h6a2 2 0 012 2v12a2 2 0 01-2 2h-6',
  salida: 'M17 16l4-4m0 0l-4-4m4 4H7m6 8H6a2 2 0 01-2-2V6a2 2 0 012-2h7',
  tarjeta: 'M3 10h18M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  check: 'M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z',
  alerta: 'M12 9v4m0 4h.01M10.3 3.86l-8 14A2 2 0 004 21h16a2 2 0 001.7-3.14l-8-14a2 2 0 00-3.4 0z',
  cama: 'M3 7v10M3 12h15a3 3 0 013 3v2M7 12V9a1 1 0 011-1h6a1 1 0 011 1v3',
  tendencia: 'M3 3v18h18M7 14l3-3 3 3 5-5',
  mapa: 'M9 20l-5-2V6l5 2m0 12l6-2m-6 2V8m6 10l5-2V4l-5 2m0 12V6',
  mas: 'M12 5v14M5 12h14',
  edificio: 'M4 21V5a2 2 0 012-2h8a2 2 0 012 2v16M16 9h2a2 2 0 012 2v10M3 21h18M8 7h4M8 11h4M8 15h4',
}

// Íconos de los paneles de indicadores laterales.
export const ICONOS_IND = {
  total: 'M4 6h16M4 12h16M4 18h16',
  recibido: 'M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4m16 0h-5l-1 2h-4l-1-2H4',
  atendido: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  pendiente: 'M12 7v5l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z',
  calendario: 'M8 3v4m8-4v4M4 11h16M5 7h14a1 1 0 011 1v11a2 2 0 01-2 2H6a2 2 0 01-2-2V8a1 1 0 011-1z',
  pico: 'M3 17l5-5 4 4 8-9',
  alerta: 'M12 9v4m0 4h.01M10.3 3.86l-8 14A2 2 0 004 21h16a2 2 0 001.7-3.14l-8-14a2 2 0 00-3.4 0z',
  personas: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1a4 4 0 100-8 4 4 0 000 8z',
  actualizar: 'M4 4v5h5M20 20v-5h-5M4 9a8 8 0 0114-3M20 15a8 8 0 01-14 3',
  salida: 'M17 16l4-4m0 0l-4-4m4 4H7m6 8H6a2 2 0 01-2-2V6a2 2 0 012-2h7',
  cama: 'M3 7v10M3 12h15a3 3 0 013 3v2M7 12V9a1 1 0 011-1h6a1 1 0 011 1v3',
  base: 'M4 7c0 1.7 3.6 3 8 3s8-1.3 8-3-3.6-3-8-3-8 1.3-8 3zm0 0v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
}

// Ícono por tipo de ubicación, para distinguir de un vistazo habitación, cama, camilla, sillón o cubículo.
export const ICONO_TIPO: Record<TipoUbicacion, { d: string; label: string }> = {
  habitacion: { d: 'M5 21V4a1 1 0 011-1h12a1 1 0 011 1v17M3 21h18M14.5 12.5h.01', label: 'Habitación' },
  cama:       { d: 'M3 7v11M3 13h18v5M21 13v-1a3 3 0 00-3-3h-7v4M6.5 11.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z', label: 'Cama' },
  camilla:    { d: 'M3 9h18M5 9v6h14V9M7 15v3m10-3v3M6 19.5a1 1 0 100-2 1 1 0 000 2zm12 0a1 1 0 100-2 1 1 0 000 2zM3 9V7', label: 'Camilla' },
  sillon:     { d: 'M6 11V7a2 2 0 012-2h8a2 2 0 012 2v4M4 11a2 2 0 012 2v2h12v-2a2 2 0 114 0v4H2v-4a2 2 0 012-2zM5 17v2m14-2v2', label: 'Sillón' },
  cubiculo:   { d: 'M4 4h16v16H4zM12 4v16M4 12h8', label: 'Cubículo' },
  area:       { d: 'M4 6h16M4 12h16M4 18h16', label: 'Área' },
}
