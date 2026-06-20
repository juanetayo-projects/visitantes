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
      },
    },
  },
  plugins: [],
}
