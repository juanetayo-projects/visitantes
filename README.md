# Control de Visitantes — Clínica Santa Bárbara

Aplicación SaaS para el control de ingreso de visitantes (familiares, proveedores y
colaboradores) en la Clínica de Alta Complejidad Santa Bárbara.

## Stack
- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Auth + RLS)
- **Gráficas:** ECharts (mapa de calor) · ExcelJS / pdfmake (exportación)
- **Despliegue:** GitHub Pages (frontend) + Supabase (backend)
- **Branding:** azul `#0D2D6B` / contraste `#16468E`

## Funcionalidades
- Login institucional + recuperación de contraseña (3 roles: Administrador, Orientador, Coordinador).
- **Mapa de habitaciones** con ocupación en tiempo real, código de color por estado
  (acompañante permanente / visita / paciente solo / libre), aislamiento y **tooltips estilo Odoo**.
- Registro de visitas: familiar (con selección de habitación en el mapa), proveedor (con
  responsable autorizado) y colaborador. Permisos (alimentos/otros) y asignación de tarjeta.
- Snapshot del paciente congelado en cada visita (la habitación se reasigna con el tiempo).
- Ingresos/salidas múltiples por registro + entrega de tarjeta que libera el cupo.
- Dashboard con métricas, listado de visitas con filtros y exportación Excel/PDF.
- Estadísticas con mapa de calor por día y hora (zona horaria Colombia GMT-5, festivos y domingos).

## Integración GoMedisys / CENSO (pendiente de scripts SQL)
Las tablas espejo `pacientes_ubicacion` (ubicación del paciente, desde GoMedisys) y
`aislamientos` (desde CENSO) se alimentan mediante un sync horario
(`scripts/sync/`, patrón GitHub Actions + cron, igual que `mapadecalorurg`).
Mientras llegan los scripts SQL, se usa el seed de demostración
(`supabase/migrations/20260620000003_seed_demo.sql`).

## Desarrollo local
```bash
npm install
cp .env.example .env.local   # completar URL y anon key de Supabase
npm run dev
```

## Variables de entorno
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

(En GitHub se configuran como *secrets* del repositorio para el workflow de Pages.)
