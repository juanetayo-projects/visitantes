/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Branding Clínica Santa Bárbara
        brand: {
          DEFAULT: '#0D2D6B', // azul principal
          dark: '#0A2356',
          light: '#16468E',   // azul de contraste
          50: '#EAF0FA',
          100: '#D4E0F2',
        },
      },
      boxShadow: {
        // Bordes sombreados para destacar cards/tablas/filtros (manual de marca)
        card: '0 1px 2px rgba(13,45,107,0.06), 0 8px 24px rgba(13,45,107,0.08)',
        // Neumorfismo: superficies del mismo color que el fondo (#F4F6FB), separadas
        // solo por un par de sombras (clara arriba-izq / oscura abajo-der).
        neu: '9px 9px 18px rgba(163,177,198,0.55), -9px -9px 18px rgba(255,255,255,0.9)',
        'neu-sm': '5px 5px 10px rgba(163,177,198,0.5), -5px -5px 10px rgba(255,255,255,0.9)',
        'neu-xs': '3px 3px 6px rgba(163,177,198,0.45), -3px -3px 6px rgba(255,255,255,0.9)',
        // Variante hundida (inset), para dar sensación de "presionado": campos de formulario y estado activo.
        'neu-inset': 'inset 5px 5px 10px rgba(163,177,198,0.5), inset -5px -5px 10px rgba(255,255,255,0.9)',
        'neu-inset-sm': 'inset 3px 3px 6px rgba(163,177,198,0.45), inset -3px -3px 6px rgba(255,255,255,0.9)',
      },
    },
  },
  plugins: [],
}
