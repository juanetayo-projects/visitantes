# Control de Visitantes — Clínica Santa Bárbara

Aplicación SaaS para el control de ingreso de visitantes (familiares, proveedores y
colaboradores) en la Clínica de Alta Complejidad Santa Bárbara, conectada al censo
hospitalario de GoMedisys.

- **App:** https://juanetayo-projects.github.io/visitantes/
- **Documentación:** [docs/00_INDICE.md](docs/00_INDICE.md) · presentación de la app en
  [docs/08_CARACTERISTICAS_APP.md](docs/08_CARACTERISTICAS_APP.md)

## Stack
- **Frontend:** React + Vite + TypeScript + Tailwind CSS (diseño neumórfico institucional)
- **Backend:** Supabase (PostgreSQL + Auth + RLS + Edge Functions `censo-sync` y `admin-usuarios`)
- **Gráficas:** ECharts · **Exportación:** ExcelJS / pdfmake
- **Sincronización del censo:** pg_cron cada 15 min (+ GitHub Actions de respaldo)
- **Despliegue:** GitHub Pages (push a `main`)
- **Branding:** azul `#0D2D6B` / contraste `#16468E`

## Funcionalidades
- Login institucional, recuperación de contraseña y 6 roles: Administrador, Orientador,
  Coordinador, Cirugía, Hemodinamia y Otro. El orientador elige su sede de trabajo.
- **Inicio:** indicadores del día, accesos rápidos, tendencia con variación frente al
  periodo anterior, pacientes con acompañante / en aislamiento / sin cama (con modal de
  detalle), visitantes por piso y estado de tarjetas.
- **Registrar visita:** familiar (mapa o búsqueda por identificación, verificación en vivo
  con el censo), proveedor (con responsable) y colaborador; horarios, cupos, máximo diario,
  aislamiento y autorizaciones; tarjeta de acceso. "Sin tarjeta" solo en Urgencias.
- **Pacientes sin ubicación:** pacientes del censo que no aparecen en el mapa, con botón
  que abre Registrar con el paciente cargado (`/registrar?doc=…`).
- **Mapa de habitaciones:** ocupación en tiempo real, colores por estado, aislamiento,
  íconos por tipo de ubicación y notas administrativas.
- **Visitas, Histórico, Ingresos sin tarjeta, Notas administrativas, Tarjetas de acceso**
  con barra lateral de indicadores/filtros, conteo circular, encabezados fijos y
  exportación Excel/PDF. El histórico guarda una copia del paciente y la ubicación en
  cada visita y busca en todo el historial (en el servidor).
- **Mapa de calor** por día y hora (Colombia GMT-5, festivos y domingos).
- **Solicitudes de información** de Cirugía, Hemodinamia y Otro, con estados y comentarios.
- **Censo:** sincronización cada 15 min, homologación por ID de unidad + área + cama,
  inconsistencias (vista de administración y vista de consulta para orientadores).
- **Administración:** usuarios, sedes/pisos/ubicaciones, servicios, horarios de visita,
  tarjetas, visitantes, festivos, homologación y sincronización.

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
