# Arquitectura técnica — Control de Visitantes

## Stack
- **Frontend:** React 18 + Vite 5 + TypeScript + Tailwind CSS 3
- **Backend:** Supabase (PostgreSQL 17 + Auth + RLS + Edge Functions)
- **Gráficas:** ECharts (`echarts-for-react`) — mapa de calor
- **Exportación:** ExcelJS (.xlsx) y pdfmake (.pdf)
- **Despliegue:** GitHub Pages (frontend, vía GitHub Actions) + Supabase (backend)

## Estructura del proyecto
```
visitantes/
├─ public/images/          logos (logo_cacsb2.png, logo_cacsb_blanc.png)
├─ src/
│  ├─ auth/AuthProvider.tsx     sesión + perfil/rol (carga no bloqueante)
│  ├─ components/
│  │  ├─ Layout.tsx             navegación por rol
│  │  ├─ MapaHabitaciones.tsx   ★ mapa visual con tooltips estilo Odoo
│  │  ├─ CrudTable.tsx          CRUD genérico reutilizable (modal)
│  │  └─ ui.tsx                 MetricCard, FilterBar, Modal, Badge, Btn…
│  ├─ lib/
│  │  ├─ supabase.ts            cliente Supabase
│  │  ├─ types.ts               tipos del dominio
│  │  ├─ data.ts                acceso a datos (queries, ocupación, filtros)
│  │  ├─ exportar.ts            Excel/PDF
│  │  └─ festivosColombia.ts    festivos (Computus + Ley Emiliani) + utilidades GMT-5
│  ├─ pages/
│  │  ├─ Dashboard / Registrar / Visitas / Mapa / Estadisticas / Login
│  │  └─ admin/  (Usuarios, Responsables, Ubicaciones, ServiciosCargos,
│  │             Tarjetas, VisitantesAdmin, Festivos)
│  └─ App.tsx                   rutas protegidas
├─ supabase/
│  ├─ migrations/               esquema + RLS + seeds
│  └─ functions/admin-usuarios/ Edge Function gestión de usuarios
├─ scripts/sync/                (pendiente) sync GoMedisys/CENSO
└─ .github/workflows/deploy.yml CI/CD a GitHub Pages
```

## Branding
- Azul principal `#0D2D6B`, contraste `#16468E` (Tailwind: `brand`, `brand-light`).
- Cards/tablas/filtros con sombra (`shadow-card`).

## Seguridad
- **RLS** activo en todas las tablas. Funciones `is_admin()` / `is_staff()` / `current_rol()`
  (security definer) controlan escritura.
- Lectura de catálogos y registros: cualquier usuario autenticado.
- Escritura de visitas/visitantes/tarjetas: staff (admin/orientador).
- Escritura de catálogos y borrados: admin.
- **Edge Function `admin-usuarios`** (service role) para crear/eliminar/cambiar contraseña
  de usuarios; valida que el solicitante sea admin.
- Tablas espejo (`pacientes_ubicacion`, `aislamientos`): lectura autenticada, escritura por
  el sync con service role (omite RLS).

## Componente estrella — MapaHabitaciones
`getOcupacionPiso(pisoId)` compone, por piso: ubicaciones + paciente (espejo GoMedisys) +
aislamiento (espejo CENSO) + visitas activas (con visitante y tarjeta). Estado de cada
celda: `permanente` (verde) · `visita` (ámbar) · `solo` (azul) · `libre` (gris); borde rojo
si hay aislamiento. Tooltip con paciente destacado y bloque de visitantes diferenciado.

> Nota PostgREST: el embed de tarjeta usa `tarjetas!visitas_tarjeta_id_fkey` por la doble
> relación visitas↔tarjetas.
