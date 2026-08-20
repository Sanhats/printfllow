# Configuración de Supabase

1. Crear un proyecto en https://supabase.com.
2. Abrir `SQL Editor` y ejecutar todo el contenido de `schema.sql`.
3. Ir a `Storage` → `New bucket` y crear un bucket llamado `print-files`.
4. Mantener el bucket privado.
5. En `Project Settings` → `API`, copiar:
   - `Project URL`
   - `service_role key` (solo para el backend, nunca para el navegador)

Variables para el servidor local:

```powershell
$env:SUPABASE_URL="https://TU-PROJECT-REF.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="TU_SERVICE_ROLE_KEY"
$env:SUPABASE_BUCKET="print-files"
```
