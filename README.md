# Catálogo — Distribuidora La Previa (Tandil)

Sitio de catálogo hecho con Vite + React + Tailwind CSS v4.

## Desarrollo

```bash
npm install
npm run dev
```

## Actualizar precios (cada vez que exportás de Codelector)

1. Exportá el Excel desde Codelector como siempre.
2. Corré:

   ```bash
   npm run import:excel -- "ruta/al/archivo.xlsx"
   ```

3. Listo — regenera `src/data/products.ts` con los precios y el stock actualizados.

Esto funciona con las columnas que ya trae Codelector: **ID, NOMBRE, PRECIO, STOCK** (COSTO se ignora a propósito, nunca se muestra en el catálogo público).

**Las categorías y las fotos no se pierden entre reimportaciones**, porque quedan asociadas al `ID` del producto (que Codelector mantiene fijo):

- La primera vez que aparece un producto nuevo, el script le adivina una categoría por palabras clave (por ejemplo "helado" → Helados) y te avisa en la consola para que la revises. Si adivinó mal, corregila a mano en `src/data/category-map.json` (es un archivo simple `"id": "categoria"`) y no se va a volver a tocar.
- Categorías disponibles: `cotillon`, `snacks`, `golosinas`, `galletitas`, `helados`, `importados`, `almacen`, `regalos`.

Para probar sin escribir nada todavía, agregá `--dry-run`:

```bash
npm run import:excel -- "ruta/al/archivo.xlsx" --dry-run
```

## Subir fotos de los productos

Con el sitio corriendo (`npm run dev`), abrí en Chrome o Edge:

**http://localhost:5173/admin-fotos.html**

1. Tocá "Elegir carpeta public/productos" y seleccioná esa carpeta dentro del proyecto (una sola vez).
2. Para cada producto, arrastrá una foto encima de la tarjeta (o tocá "Elegir foto" desde el celu/compu).
3. Se guarda al toque con el nombre correcto — no hay que hacer nada más, la próxima vez que abras el sitio ya aparece la foto.

Los productos sin foto muestran un emoji de la categoría como reemplazo, así que no hay apuro: se puede ir cargando de a poco.

> Esta página es una herramienta interna (no la compartas) — funciona solo en Chrome/Edge de escritorio porque usa una función del navegador para guardar archivos directo en la carpeta del proyecto.

## Build para producción

```bash
npm run build
```

Genera la carpeta `dist/` lista para subir a cualquier hosting (Vercel, Netlify, etc.). Al desplegar, subí también la carpeta `public/productos` con las fotos.
