# Despliegue e integraciones — Control de Visitantes

## Infraestructura
- **Repo:** https://github.com/juanetayo-projects/visitantes (público)
- **Pages (producción):** https://juanetayo-projects.github.io/visitantes/
- **Supabase:** proyecto `visitantes`, ref `unukkkyvbkfhpvtkjuxd`, región us-east-1.
  ⚠️ Costo: US$10/mes (organización en plan pago).

## CI/CD
`.github/workflows/deploy.yml` compila y publica a GitHub Pages en cada push a `main`.
Variables como **secrets** del repo:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

> Si se cambian los secrets, re-disparar el workflow (Actions → Run workflow) para que el
> bundle de producción incruste los valores.

## Desarrollo local
```bash
npm install
cp .env.example .env.local   # completar URL y anon key
npm run dev                  # http://localhost:5180/visitantes/
npm run build                # verificación de tipos + build
```

## Edge Function
`supabase/functions/admin-usuarios` — crear/eliminar/cambiar contraseña de usuarios
(usa service role; valida rol admin). Desplegada en el proyecto Supabase.

## Integración GoMedisys / CENSO (PENDIENTE de scripts SQL)
Patrón a reutilizar de `mapadecalorurg/scripts/sync/` (Node + `mssql` → Supabase,
disparado por GitHub Actions + cron-job.org cada hora):

1. **GoMedisys (Azure SQL)** → tabla `pacientes_ubicacion`.
   Secrets: `GOMEDISYS_HOST/PORT/DATABASE/USERNAME/PASSWORD` (los mismos de Mapa de Calor).
   El script SQL de ubicación de pacientes lo provee el usuario.
2. **CENSO** → tabla `aislamientos`. Conexión y query a suministrar por el usuario.
3. El sync escribe con `SUPABASE_SERVICE_KEY` (omite RLS). Mapear num_ingreso/ubicación
   a `ubicaciones.id` por etiqueta+piso.
4. Al activar el sync real, **borrar el seed de demostración**:
   ```sql
   delete from visita_eventos; delete from visitas;
   update tarjetas set estado='disponible', visita_id=null;
   delete from aislamientos; delete from pacientes_ubicacion; delete from visitantes;
   ```

## Resend (PENDIENTE)
API key `notificacionprogturnos` para recuperación de contraseña / notificaciones.
Configurar en Supabase Auth (SMTP) y/o Edge Function de envío.

## Pendientes técnicos opcionales
- Code-splitting (bundle ~4.5 MB por pdfmake/exceljs/echarts).
- Verificación del dominio `cacsantabarbara.co` en Resend para entrega de correos.
