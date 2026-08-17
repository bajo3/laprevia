# Catálogo — Distribuidora La Previa (Tandil)

Sitio de catálogo hecho con Vite + React + Tailwind CSS v4.

## Desarrollo

```bash
npm install
npm run dev
```

## Actualizar el catálogo

El Excel de Codelector es la fuente de precios y stock. Desde el dashboard `/admin` se puede:

1. Subir el `.xlsx` actualizado.
2. Revisar cuántas filas son válidas y cuántas se omiten.
3. Confirmar la importación usando `ID` como clave.

La actualización agrega productos nuevos, actualiza nombre/código/precio/stock y desactiva los productos importados que ya no aparecen. Los productos agregados manualmente quedan activos hasta elegir "Sacar". Las fotos quedan asociadas al mismo `ID`, por lo que no se pierden.

También existe el flujo local para regenerar el catálogo estático:

```bash
npm run import:excel -- "ruta/al/archivo.xlsx"
```

## Fotos y persistencia

Desde cada tarjeta del dashboard se puede subir o cambiar una foto. En producción, las imágenes se guardan en Supabase Storage (bucket `product-images`) y los datos de producto en Supabase (Postgres), a través de funciones serverless en `api/`. El catálogo público solo muestra precio, stock, nombre, código, categoría y foto; `COSTO` queda interno.

Las operaciones de escritura del dashboard requieren la variable de entorno `ADMIN_TOKEN`. El catálogo público no la necesita.

### Backend (Vercel + Supabase)

El sitio se despliega en Vercel. Las rutas `/api/products*` son funciones serverless (edge) en `api/` que hablan con Supabase usando el `service_role key` — ese key nunca se expone al navegador. Variables de entorno necesarias en Vercel (Project Settings → Environment Variables):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_TOKEN`

Ninguna variable lleva el prefijo `VITE_`: el frontend nunca habla directo con Supabase, todo pasa por `api/`.

Los productos sin foto muestran un placeholder de categoría y se pueden completar de a poco.

## Build para producción

```bash
npm run build
```

Genera la carpeta `dist/` lista para subir a cualquier hosting (Vercel, Netlify, etc.). Al desplegar, subí también la carpeta `public/productos` con las fotos.

El catálogo completo se publica en `catalogo-data.json` como datos separados del JavaScript inicial para que la primera carga sea más liviana, especialmente en celulares.
