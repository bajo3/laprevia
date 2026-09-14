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

La actualización agrega productos nuevos, actualiza nombre/código/precio/stock y desactiva los productos importados que ya no aparecen. Los productos agregados manualmente quedan activos hasta elegir "Sacar".

**Lo que una lista de precios nunca toca:** la foto y la sección de cada producto. Ambas quedan atadas al `ID`. El importador no envía la columna `image_key`, así que la base la deja intacta; y antes de escribir, el servidor vuelve a leer la sección guardada de cada producto y la reaplica encima de la importación (`api/products/import.ts`). Un producto que sacás del Excel tampoco se borra: se marca `active = false` y conserva su fila y su foto por si vuelve.

## Secciones del catálogo

Las secciones viven en la base (tabla `categories`) y **se administran desde `/admin`**, sin tocar código ni volver a publicar el sitio. En **Secciones del catálogo → ✏️ Editar secciones** se puede:

- **Crear** una sección nueva (nombre, emoji y color).
- **Renombrar** una existente, o cambiarle el emoji y el color.
- **Reordenar** con las flechas: ese es el orden de los botones del catálogo público.
- **Eliminar** una sección, eligiendo a qué sección pasan sus productos.

**Eliminar una sección no borra ningún producto.** Antes de borrar la fila de la sección, el servidor mueve sus productos a la sección de destino (por defecto, Varios). El orden importa: si el movimiento falla, la sección sigue ahí y se puede reintentar; al revés quedarían productos apuntando a una sección que ya no existe.

Renombrar tampoco reescribe productos. Cada producto guarda el `slug` de su sección (`cotillon`, `bazar-y-limpieza`), que se genera una sola vez al crearla y no cambia nunca; el nombre que se edita es solo el que lee el cliente. Por eso renombrar cuesta una escritura y no quince mil.

`Varios` es el cajón general: ahí cae todo lo que todavía no tiene sección asignada (antes se llamaba "Almacén"). Es la única sección protegida — no se puede eliminar ni sacar del último lugar, porque es adonde van a parar los productos de una sección que se elimina — pero sí se puede renombrar.

Además, en esa misma tarjeta del panel se puede:

- Filtrar por sección para ver solo esos productos.
- Cambiar la sección de un producto con el desplegable de su tarjeta.
- Tildar varias tarjetas y moverlas todas juntas a una sección.
- Usar **Ubicar automáticamente**: revisa lo que quedó en Varios, propone una sección para lo que reconoce por el nombre y muestra el resumen antes de guardar nada. Solo escribe la columna `category`; no toca precios, stock ni fotos.

Lo que se asigna a mano gana siempre: ni la importación ni el clasificador lo pisan.

Las reglas por palabra clave de **Ubicar automáticamente** siguen en `src/data/categorize.ts`, atadas a las secciones con las que nació el catálogo. Una sección creada desde el panel simplemente no tiene reglas: sus productos se ubican a mano o en lote desde las tildes. Una regla que nombra una sección eliminada se ignora sola.

Antes de que existiera la tabla, la lista estaba escrita a mano en tres archivos (frontend, API y migraciones) y `npm run build` corría un script que fallaba si dejaban de coincidir. Ya no hace falta: hay una sola lista y está en la base.

**Para que esto funcione hay que correr `db/migrations/0004_categories_table.sql` una vez.** Hasta entonces el sitio sigue andando igual que siempre, con las once secciones originales servidas desde el código, y el panel lo dice en vez de ofrecer botones que no guardarían nada.

## Fotos y persistencia

Desde cada tarjeta del dashboard se puede subir o cambiar una foto. En producción, las imágenes se guardan en Supabase Storage (bucket `product-images`) y los datos de producto en Supabase (Postgres), a través de funciones serverless en `api/`. El catálogo público solo muestra precio, stock, nombre, código, categoría y foto; `COSTO` queda interno.

Las operaciones de escritura del dashboard requieren la variable de entorno `ADMIN_TOKEN`. El catálogo público no la necesita.

El login del panel exige `ADMIN_USERNAME` y `ADMIN_PASSWORD`. **No hay valores por defecto**: si falta cualquiera de las dos, `/api/admin/login` responde 503 y nadie entra. Antes caía a `admin` / `laprevia`, que es el nombre del sitio y por lo tanto lo primero que alguien probaría, con el token de escritura de todo el catálogo del otro lado.

### Backend (Vercel + Supabase)

El sitio se despliega en Vercel. Las rutas `/api/products*` son funciones serverless (edge) en `api/` que hablan con Supabase usando el `service_role key` — ese key nunca se expone al navegador. Variables de entorno necesarias en Vercel (Project Settings → Environment Variables):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_TOKEN`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

Ninguna variable lleva el prefijo `VITE_`: el frontend nunca habla directo con Supabase, todo pasa por `api/`.

Los productos sin foto muestran un placeholder de categoría y se pueden completar de a poco.

## Build para producción

```bash
npm run build
```

Genera la carpeta `dist/`. Las fotos no van ahí: viven en Supabase Storage y se sirven por `/api/products/:id/image`.

`npm run build` corre, en orden: el chequeo de tipos del frontend, el chequeo de tipos de `api/` y el build de Vite.

No existe más una copia estática del catálogo. Antes se publicaba `catalogo-data.json` (3 MB) como respaldo para cuando la API no respondía, pero solo lo regeneraba un script local que dejó de usarse cuando la importación pasó al panel: se iba desactualizando en silencio y, al activarse, mostraba precios viejos sin avisar. Hoy, si el catálogo no carga, la página lo dice y ofrece WhatsApp.
