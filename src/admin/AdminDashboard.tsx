import { useCallback, useEffect, useRef, useState } from "react";
import AdminLogin from "./AdminLogin";
import { compressImage } from "./compress-image";
import * as XLSX from "xlsx";
import categoryMap from "../data/category-map.json";
import { categories } from "../data/catalog-config";
import { fetchAllProducts, fetchBundledCatalog, fetchCatalogPage, normalizeRemoteProduct, PAGE_SIZE } from "../data/catalog-api";
import type { Product } from "../data/products";

type PhotoFilter = "all" | "missing" | "ready";

type ImportPreview = {
  fileName: string;
  products: Product[];
  skipped: number;
};

type ProductDraft = {
  id: string;
  name: string;
  code: string;
  price: string;
  stock: string;
  category: string;
};

const emptyDraft: ProductDraft = {
  id: "",
  name: "",
  code: "",
  price: "",
  stock: "",
  category: "almacen",
};

const emojiByCategory: Record<string, string> = {
  cotillon: "🎉",
  snacks: "🍟",
  golosinas: "🍬",
  galletitas: "🍪",
  helados: "🍦",
  importados: "🌐",
  almacen: "🛒",
  regalos: "🎁",
};

const categoryRules: Array<{ slug: string; words: string[] }> = [
  { slug: "cotillon", words: ["globo", "guirnalda", "vincha", "cotillon", "vela", "piñata", "pinata", "disfraz", "antifaz", "confeti"] },
  { slug: "helados", words: ["helado", "sorbete", "paleta"] },
  { slug: "golosinas", words: ["chocolate", "gomita", "caramelo", "alfajor", "chicle", "turron", "oblea", "chupetin", "bombon"] },
  { slug: "galletitas", words: ["galletita", "galleta", "vainilla"] },
  { slug: "snacks", words: ["papas", "nachos", "mani", "pochoclo", "snack", "chizito"] },
  { slug: "importados", words: ["importado", "coreano", "japones", "chino"] },
  { slug: "regalos", words: ["taza", "peluche", "bijou", "llavero", "regalo", "agenda", "cuaderno", "lapicera"] },
];

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const normalize = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  const raw = String(value ?? "").trim();
  if (!raw) return Number.NaN;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw.replace(/[^\d-]/g, "");
  return Number(normalized);
}

type ApiFailureKind = "unavailable" | "unauthorized" | "server";
type ApiFailure = Error & { kind: ApiFailureKind };

function apiFailure(response: Response): ApiFailure {
  const kind: ApiFailureKind = response.status === 401 || response.status === 403
    ? "unauthorized"
    : response.status === 404 || response.status === 503
      ? "unavailable"
      : "server";
  const message = kind === "unauthorized"
    ? "Tu sesión no es válida. Iniciá sesión de nuevo."
    : kind === "unavailable"
      ? "El backend no está disponible."
      : "El servidor no pudo completar la operación.";
  return Object.assign(new Error(message), { kind });
}

function failureKind(error: unknown): ApiFailureKind | "network" {
  return error instanceof Error && "kind" in error ? (error as ApiFailure).kind : "network";
}

function guessCategory(name: string) {
  const normalized = normalize(name);
  return categoryRules.find((rule) => rule.words.some((word) => normalized.includes(normalize(word))))?.slug ?? "almacen";
}

function productHasPhoto(product: Product, localPhotoUrls: Record<string, string>) {
  return Boolean(product.image || localPhotoUrls[product.id]);
}

function findColumn(row: Record<string, unknown>, candidates: string[]) {
  return Object.keys(row).find((key) => candidates.includes(normalize(key)));
}

function parseExcelFile(buffer: ArrayBuffer, fileName: string, existingProducts: Product[]): ImportPreview {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const firstRow = rows[0] ?? {};
  const idKey = findColumn(firstRow, ["id"]);
  const nameKey = findColumn(firstRow, ["nombre", "producto"]);
  const codeKey = findColumn(firstRow, ["codigo"]);
  const priceKey = findColumn(firstRow, ["precio"]);
  const stockKey = findColumn(firstRow, ["stock"]);

  if (!idKey || !nameKey || !priceKey) {
    throw new Error("El Excel debe incluir las columnas ID, NOMBRE y PRECIO.");
  }

  const existingById = new Map(existingProducts.map((product) => [product.id, product]));
  const parsed: Product[] = [];
  let skipped = 0;

  for (const row of rows) {
    const id = String(row[idKey] ?? "").trim();
    const name = String(row[nameKey] ?? "").trim();
    const price = toNumber(row[priceKey]);
    if (!id || !name || !Number.isFinite(price)) {
      skipped += 1;
      continue;
    }

    const previous = existingById.get(id);
    const codeValue = codeKey ? String(row[codeKey] ?? "").trim() : previous?.code;
    const category = typeof categoryMap[id as keyof typeof categoryMap] === "string"
      ? categoryMap[id as keyof typeof categoryMap]
      : previous?.category ?? guessCategory(name);
    const stock = stockKey ? toNumber(row[stockKey]) : previous?.stock;
    parsed.push({
      id,
      name,
      code: codeValue && normalize(codeValue) !== "nan" ? codeValue : undefined,
      category,
      price: Math.round(price),
      unit: "un",
      emoji: emojiByCategory[category] ?? "🛒",
      image: previous?.image,
      stock: Number.isFinite(stock) ? stock : undefined,
    });
  }

  return { fileName, products: parsed, skipped };
}

const SESSION_KEY = "laprevia-admin-session";

export default function AdminDashboard() {
  const [session, setSession] = useState<string | null>(() => sessionStorage.getItem(SESSION_KEY));
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [photoFilter, setPhotoFilter] = useState<PhotoFilter>("missing");
  const [totalCount, setTotalCount] = useState(0);
  const [withPhotoCount, setWithPhotoCount] = useState(0);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLocalMode, setIsLocalMode] = useState(false);
  const requestId = useRef(0);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "warning" | "error"; text: string } | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [localPhotoUrls, setLocalPhotoUrls] = useState<Record<string, string>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productDraft, setProductDraft] = useState<ProductDraft>(emptyDraft);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  /** Counts come from the server so they describe the whole catalog, not just
   *  the page on screen. */
  const refreshCounts = useCallback(async () => {
    try {
      const [all, ready] = await Promise.all([
        fetchCatalogPage({ limit: 1 }),
        fetchCatalogPage({ limit: 1, photo: "ready" }),
      ]);
      setTotalCount(all.total);
      setWithPhotoCount(ready.total);
    } catch {
      // Counts are informational; a failure here must not block the dashboard.
    }
  }, []);

  const loadPage = useCallback(async () => {
    const id = ++requestId.current;
    setIsCatalogLoading(true);
    try {
      const page = await fetchCatalogPage({
        query: debouncedQuery,
        photo: photoFilter,
        limit: PAGE_SIZE,
      });
      if (id !== requestId.current) return;
      setCatalog(page.products);
      setFilteredTotal(page.total);
      setIsLocalMode(false);
    } catch {
      try {
        const products = await fetchBundledCatalog();
        if (id !== requestId.current) return;
        const normalizedQuery = normalize(debouncedQuery);
        const matches = products.filter((product) => {
          const matchesQuery = !normalizedQuery || normalize(`${product.name} ${product.id} ${product.code ?? ""}`).includes(normalizedQuery);
          const matchesPhoto = photoFilter === "all" || (photoFilter === "ready" ? Boolean(product.image) : !product.image);
          return matchesQuery && matchesPhoto;
        });
        setCatalog(matches.slice(0, PAGE_SIZE));
        setFilteredTotal(matches.length);
        setTotalCount(products.length);
        setWithPhotoCount(products.filter((product) => Boolean(product.image)).length);
        setIsLocalMode(true);
        setNotice({ tone: "warning", text: "Modo local: el backend todavía no está conectado. Las fotos se previsualizan en esta sesión." });
      } catch {
        if (id !== requestId.current) return;
        setNotice({ tone: "error", text: "No se pudo cargar el catálogo." });
      }
    } finally {
      if (id === requestId.current) setIsCatalogLoading(false);
    }
  }, [debouncedQuery, photoFilter]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    void refreshCounts();
  }, [refreshCounts]);

  async function loadMore() {
    if (isLoadingMore || isLocalMode) return;
    setIsLoadingMore(true);
    try {
      const page = await fetchCatalogPage({
        query: debouncedQuery,
        photo: photoFilter,
        offset: catalog.length,
        limit: PAGE_SIZE,
      });
      setCatalog((current) => [...current, ...page.products]);
      setFilteredTotal(page.total);
    } catch {
      // Leave the current page in place so the button can be retried.
    } finally {
      setIsLoadingMore(false);
    }
  }

  const withPhoto = withPhotoCount;
  const withoutPhoto = Math.max(0, totalCount - withPhotoCount);
  const visibleProducts = catalog;

  async function handleExcelChange(file: File | undefined) {
    if (!file) return;
    try {
      // The parser needs every existing row, not just the page on screen, or
      // products outside it would lose their manually-assigned category and
      // their photo on the next import.
      setNotice({ tone: "success", text: "Leyendo el catálogo actual para conservar categorías y fotos…" });
      let existing: Product[] = [];
      try {
        existing = await fetchAllProducts();
      } catch {
        existing = catalog;
      }
      const nextPreview = parseExcelFile(await file.arrayBuffer(), file.name, existing);
      setPreview(nextPreview);
      setNotice({ tone: "success", text: `${nextPreview.products.length.toLocaleString("es-AR")} productos listos para revisar.` });
    } catch (error) {
      setPreview(null);
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "No se pudo leer el Excel." });
    }
  }

  async function confirmImport() {
    if (!preview) return;
    setIsImporting(true);
    try {
      const response = await fetch("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session}` } : {}) },
        body: JSON.stringify({ products: preview.products }),
      });
      if (!response.ok) throw apiFailure(response);
      await Promise.all([loadPage(), refreshCounts()]);
      setPreview(null);
      setNotice({ tone: "success", text: "Importación confirmada. Se actualizaron precios, stock y productos; las fotos existentes se conservaron." });
    } catch (error) {
      const kind = failureKind(error);
      if (kind === "unauthorized") {
        handleLogout();
        setNotice({ tone: "error", text: "Tu sesión venció o la clave cambió. Iniciá sesión de nuevo." });
        return;
      }
      if (kind !== "unavailable" && kind !== "network") {
        setNotice({ tone: "error", text: error instanceof Error ? error.message : "No se pudo guardar la importación." });
        return;
      }
      setCatalog(preview.products);
      setNotice({ tone: "warning", text: "Vista local actualizada, pero falta conectar el backend para guardar esta importación de forma permanente." });
    } finally {
      setIsImporting(false);
    }
  }

  function openCreateProduct() {
    setEditingProduct(null);
    setProductDraft(emptyDraft);
    setIsProductFormOpen(true);
  }

  function openEditProduct(product: Product) {
    setEditingProduct(product);
    setProductDraft({
      id: product.id,
      name: product.name,
      code: product.code ?? "",
      price: String(product.price),
      stock: product.stock === undefined ? "" : String(product.stock),
      category: product.category,
    });
    setIsProductFormOpen(true);
  }

  function closeProductForm() {
    if (isSavingProduct) return;
    setIsProductFormOpen(false);
    setEditingProduct(null);
  }

  async function saveProduct() {
    const name = productDraft.name.trim();
    const price = Number(productDraft.price);
    const stock = productDraft.stock.trim() === "" ? undefined : Number(productDraft.stock);
    if (!name || !Number.isFinite(price) || price < 0 || (stock !== undefined && (!Number.isFinite(stock) || stock < 0))) {
      setNotice({ tone: "error", text: "Completá nombre, precio válido y un stock igual o mayor a cero." });
      return;
    }

    const editingId = editingProduct?.id;
    const body = {
      id: editingId ? undefined : productDraft.id.trim() || undefined,
      name,
      code: productDraft.code.trim() || undefined,
      price: Math.round(price),
      stock: stock === undefined ? undefined : Math.round(stock),
      category: productDraft.category,
    };

    setIsSavingProduct(true);
    try {
      const endpoint = editingId ? `/api/products/${encodeURIComponent(editingId)}` : "/api/products";
      const response = await fetch(endpoint, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session}` } : {}) },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw apiFailure(response);
      const payload = (await response.json()) as { product: Partial<Product> };
      const saved = normalizeRemoteProduct(payload.product);
      setCatalog((current) => editingId
        ? current.map((item) => item.id === editingId ? { ...item, ...saved, image: saved.image ?? item.image } : item)
        : [saved, ...current]);
      setIsProductFormOpen(false);
      setEditingProduct(null);
      setNotice({ tone: "success", text: editingId ? "Producto actualizado." : "Producto agregado al catálogo." });
    } catch (error) {
      const kind = failureKind(error);
      if (kind === "unauthorized") {
        handleLogout();
        setNotice({ tone: "error", text: "Tu sesión venció o la clave cambió. Iniciá sesión de nuevo." });
        return;
      }
      if (kind !== "unavailable" && kind !== "network") {
        setNotice({ tone: "error", text: error instanceof Error ? error.message : "No se pudo guardar el producto." });
        return;
      }
      const localId = editingId ?? body.id ?? `local-${Date.now()}`;
      const localProduct = normalizeRemoteProduct({ ...body, id: localId, image: editingProduct?.image });
      setCatalog((current) => editingId
        ? current.map((item) => item.id === editingId ? { ...item, ...localProduct, image: localProduct.image ?? item.image } : item)
        : [localProduct, ...current]);
      setIsProductFormOpen(false);
      setEditingProduct(null);
      setNotice({ tone: "warning", text: editingId ? "Cambio aplicado en esta sesión; falta conectar el backend para guardarlo permanentemente." : "Producto agregado en esta sesión; falta conectar el backend para guardarlo permanentemente." });
    } finally {
      setIsSavingProduct(false);
    }
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`¿Sacar "${product.name}" del catálogo? Se desactiva, pero conserva su foto e historial.`)) return;
    setDeletingId(product.id);
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(product.id)}`, {
        method: "DELETE",
        headers: session ? { Authorization: `Bearer ${session}` } : {},
      });
      if (!response.ok) throw apiFailure(response);
      setCatalog((current) => current.filter((item) => item.id !== product.id));
      setNotice({ tone: "success", text: "Producto sacado del catálogo. Sus datos y foto quedaron conservados." });
    } catch (error) {
      const kind = failureKind(error);
      if (kind === "unauthorized") {
        handleLogout();
        setNotice({ tone: "error", text: "Tu sesión venció o la clave cambió. Iniciá sesión de nuevo." });
        return;
      }
      if (kind !== "unavailable" && kind !== "network") {
        setNotice({ tone: "error", text: error instanceof Error ? error.message : "No se pudo sacar el producto." });
        return;
      }
      setCatalog((current) => current.filter((item) => item.id !== product.id));
      setNotice({ tone: "warning", text: "Producto ocultado en esta sesión; falta conectar el backend para guardarlo permanentemente." });
    } finally {
      setDeletingId(null);
    }
  }

  async function uploadPhoto(product: Product, original: File | undefined) {
    if (!original) return;
    if (!original.type.startsWith("image/")) {
      setNotice({ tone: "error", text: "Elegí una imagen JPG, PNG o WebP." });
      return;
    }

    setUploadingId(product.id);
    // Phone photos run 2-5 MB. Shrinking before upload keeps the public
    // catalog light, since shoppers load these as small thumbnails.
    const file = await compressImage(original);

    const localUrl = URL.createObjectURL(file);
    setLocalPhotoUrls((current) => ({ ...current, [product.id]: localUrl }));

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/products/${encodeURIComponent(product.id)}/image`, {
        method: "POST",
        headers: session ? { Authorization: `Bearer ${session}` } : {},
        body: formData,
      });
      if (!response.ok) throw apiFailure(response);
      const payload = (await response.json()) as { image?: string };
      setCatalog((current) => current.map((item) => item.id === product.id ? { ...item, image: payload.image } : item));
      setLocalPhotoUrls((current) => {
        URL.revokeObjectURL(current[product.id] ?? localUrl);
        const next = { ...current };
        delete next[product.id];
        return next;
      });
      setNotice({ tone: "success", text: `Foto guardada para ${product.name}.` });
    } catch (error) {
      const kind = failureKind(error);
      if (kind === "unauthorized") {
        handleLogout();
        setNotice({ tone: "error", text: "Tu sesión venció o la clave cambió. Iniciá sesión de nuevo." });
        return;
      }
      if (kind !== "unavailable" && kind !== "network") {
        URL.revokeObjectURL(localUrl);
        setLocalPhotoUrls((current) => {
          const next = { ...current };
          delete next[product.id];
          return next;
        });
        setNotice({ tone: "error", text: error instanceof Error ? error.message : "No se pudo guardar la foto." });
      } else {
        setNotice({ tone: "warning", text: `La foto de ${product.name} quedó en vista previa. Al publicar el backend va a quedar guardada por ID.` });
      }
    } finally {
      setUploadingId(null);
    }
  }

  function handleLogin(token: string) {
    sessionStorage.setItem(SESSION_KEY, token);
    setSession(token);
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
  }

  if (!session) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b-4 border-ink bg-navy text-cream">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-yellow">La Previa · interno</p>
            <h1 className="font-display mt-1 text-3xl sm:text-4xl">Panel de productos</h1>
            <p className="mt-1 max-w-xl text-sm text-cream/65">Actualizá el catálogo con el Excel y completá una foto por producto.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a href="/" className="whitespace-nowrap rounded-full border-2 border-cream/40 px-4 py-2 text-sm font-extrabold transition hover:border-yellow hover:text-yellow">Ver catálogo</a>
            <button
              type="button"
              onClick={handleLogout}
              className="whitespace-nowrap rounded-full border-2 border-cream/40 px-4 py-2 text-sm font-extrabold transition hover:border-pink hover:text-pink"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6 sm:px-8 sm:py-9">
        {/* 2-up on phones: stacked 1-up pushed ~580px of stats above the actual work. */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["Productos activos", totalCount.toLocaleString("es-AR"), "📦", "bg-yellow"],
            ["Con foto", withPhoto.toLocaleString("es-AR"), "📸", "bg-teal text-white"],
            ["Pendientes", withoutPhoto.toLocaleString("es-AR"), "🖼️", "bg-pink text-white"],
            ["Categorías", categories.length.toString(), "🏷️", "bg-violet text-white"],
          ].map(([label, value, emoji, color]) => (
            <article key={label} className={`rounded-3xl border-[3px] border-ink p-4 shadow-[4px_4px_0_var(--color-ink)] sm:p-5 ${color}`}>
              <div className="flex items-start justify-between gap-1">
                <span className="text-[11px] font-extrabold uppercase leading-tight tracking-wider opacity-70 sm:text-sm">{label}</span>
                <span className="shrink-0 text-xl sm:text-2xl">{emoji}</span>
              </div>
              <p className="font-display mt-2 text-3xl sm:text-4xl">{value}</p>
            </article>
          ))}
        </section>

        <section className="mt-6 rounded-3xl border-[3px] border-ink bg-white p-5 shadow-[4px_4px_0_var(--color-ink)] sm:p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-pink">Actualizar inventario</p>
              <h2 className="font-display mt-1 text-2xl">Subí el Excel de Codelector</h2>
              <p className="mt-1 text-sm text-ink/60">La importación usa el ID como clave y conserva las fotos ya cargadas.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="flex cursor-pointer items-center justify-center rounded-full border-[3px] border-ink bg-yellow px-5 py-3 text-center font-extrabold shadow-[3px_3px_0_var(--color-ink)] transition hover:-translate-y-0.5">
                📄 Elegir Excel
                <input type="file" accept=".xlsx,.xls" className="sr-only" onChange={(event) => handleExcelChange(event.target.files?.[0])} />
              </label>
            </div>
          </div>
          {preview && (
            <div className="mt-5 flex flex-col gap-4 rounded-2xl border-2 border-dashed border-teal bg-teal/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-extrabold">{preview.fileName}</p>
                <p className="text-sm text-ink/60">{preview.products.length.toLocaleString("es-AR")} válidos · {preview.skipped} omitidos</p>
              </div>
              <button type="button" onClick={confirmImport} disabled={isImporting} className="rounded-full border-2 border-ink bg-teal px-5 py-2.5 font-extrabold text-white shadow-[3px_3px_0_var(--color-ink)] disabled:opacity-50">
                {isImporting ? "Guardando…" : "Confirmar actualización"}
              </button>
            </div>
          )}
        </section>

        {notice && (
          <div className={`mt-5 rounded-2xl border-2 border-ink px-4 py-3 text-sm font-bold ${notice.tone === "success" ? "bg-teal/15" : notice.tone === "error" ? "bg-pink/15" : "bg-yellow/30"}`} role="status">
            {notice.text}
          </div>
        )}

        <section className="mt-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink/45">Biblioteca de fotos</p>
              <h2 className="font-display mt-1 text-3xl">Elegí una foto para cada producto</h2>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button type="button" onClick={openCreateProduct} className="rounded-full border-[3px] border-ink bg-pink px-4 py-2.5 text-sm font-extrabold text-white shadow-[3px_3px_0_var(--color-ink)] transition hover:-translate-y-0.5">＋ Agregar producto</button>
              <label className="relative">
                <span className="sr-only">Buscar productos</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, ID o código" className="w-full rounded-full border-2 border-ink bg-white px-4 py-2.5 font-semibold outline-none focus:ring-4 focus:ring-pink/20 sm:w-72" />
              </label>
              <div className="flex rounded-full border-2 border-ink bg-white p-1">
                {([["missing", "Sin foto"], ["ready", "Con foto"], ["all", "Todas"]] as const).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setPhotoFilter(value)} className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${photoFilter === value ? "bg-ink text-cream" : "text-ink/55"}`}>{label}</button>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-3 text-sm font-bold text-ink/55">Mostrando {visibleProducts.length.toLocaleString("es-AR")} de {filteredTotal.toLocaleString("es-AR")}</p>

          {isCatalogLoading && (
            <p className="mt-6 text-center text-sm font-bold text-ink/50" role="status">Cargando productos…</p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5">
            {visibleProducts.map((product) => {
              const imageSrc = localPhotoUrls[product.id] ?? product.image;
              return (
                <article key={product.id} className="group relative flex min-w-0 flex-col rounded-3xl border-[3px] border-ink bg-white p-3 shadow-[4px_4px_0_var(--color-ink)] sm:p-4">
                  <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-cream-dark text-4xl sm:text-5xl">
                    {imageSrc ? <img src={imageSrc} alt={product.name} loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <span aria-hidden="true">{product.emoji}</span>}
                    {productHasPhoto(product, localPhotoUrls) && <span className="absolute right-2 top-2 rounded-full border-2 border-ink bg-teal px-2 py-1 text-xs font-black text-white">✓</span>}
                  </div>
                  <p className="mt-3 truncate text-[10px] font-extrabold uppercase tracking-widest text-ink/45">ID {product.id}</p>
                  <h3 className="mt-1 line-clamp-3 min-h-10 break-words font-display text-[13px] leading-tight min-[360px]:text-[15px] sm:text-lg" title={product.name}>{product.name}</h3>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs font-bold text-ink/55"><span>{currency.format(product.price)}</span><span>{product.stock === undefined ? "—" : product.stock <= 0 ? "Sin stock" : `${product.stock} stock`}</span></div>
                  {/* mt-auto keeps the photo/edit actions aligned across a row
                      even when product names wrap to different line counts. */}
                  <label className="mt-auto flex cursor-pointer items-center justify-center rounded-full border-2 border-ink bg-cream px-3 py-2 text-center text-xs font-extrabold transition hover:bg-yellow">
                    {uploadingId === product.id ? "Guardando…" : productHasPhoto(product, localPhotoUrls) ? "Cambiar foto" : "Subir foto"}
                    <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" disabled={uploadingId === product.id} onChange={(event) => uploadPhoto(product, event.target.files?.[0])} />
                  </label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => openEditProduct(product)} className="rounded-full border-2 border-ink bg-white px-2 py-2 text-xs font-extrabold transition hover:bg-yellow">Editar</button>
                    <button type="button" onClick={() => deleteProduct(product)} disabled={deletingId === product.id} className="rounded-full border-2 border-ink bg-ink px-2 py-2 text-xs font-extrabold text-cream transition hover:bg-pink disabled:opacity-50">{deletingId === product.id ? "…" : "Sacar"}</button>
                  </div>
                </article>
              );
            })}
          </div>

          {visibleProducts.length < filteredTotal && (
            <button type="button" onClick={() => void loadMore()} disabled={isLoadingMore} className="mx-auto mt-8 flex rounded-full border-[3px] border-ink bg-yellow px-6 py-3 font-extrabold shadow-[3px_3px_0_var(--color-ink)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">
              {isLoadingMore ? "Cargando…" : "Mostrar más productos"}
            </button>
          )}
        </section>
      </main>

      {isProductFormOpen && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-ink/60 p-0 backdrop-blur-sm sm:items-center sm:p-5">
          <button type="button" aria-label="Cerrar formulario" onClick={closeProductForm} className="absolute inset-0" />
          <section role="dialog" aria-modal="true" aria-labelledby="product-form-title" className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] border-[3px] border-ink bg-cream p-5 shadow-[6px_6px_0_var(--color-ink)] sm:rounded-[2rem] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-pink">Ficha del catálogo</p>
                <h2 id="product-form-title" className="font-display mt-1 text-3xl">{editingProduct ? "Editar producto" : "Agregar producto"}</h2>
                <p className="mt-1 text-sm text-ink/60">Podés cambiar los datos ahora y cargar la foto desde la tarjeta.</p>
              </div>
              <button type="button" onClick={closeProductForm} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-white text-xl font-black" aria-label="Cerrar">×</button>
            </div>

            <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void saveProduct(); }}>
              <label className="sm:col-span-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-ink/55">Nombre</span>
                <input autoFocus value={productDraft.name} onChange={(event) => setProductDraft((current) => ({ ...current, name: event.target.value }))} className="mt-1 w-full rounded-2xl border-2 border-ink bg-white px-4 py-3 font-semibold outline-none focus:ring-4 focus:ring-pink/20" placeholder="Ej. Globos metalizados x10" />
              </label>
              <label>
                <span className="text-xs font-extrabold uppercase tracking-wider text-ink/55">Código</span>
                <input value={productDraft.code} onChange={(event) => setProductDraft((current) => ({ ...current, code: event.target.value }))} className="mt-1 w-full rounded-2xl border-2 border-ink bg-white px-4 py-3 font-semibold outline-none focus:ring-4 focus:ring-pink/20" placeholder="Código de barras" />
              </label>
              <label>
                <span className="text-xs font-extrabold uppercase tracking-wider text-ink/55">ID</span>
                <input value={productDraft.id} disabled={Boolean(editingProduct)} onChange={(event) => setProductDraft((current) => ({ ...current, id: event.target.value }))} className="mt-1 w-full rounded-2xl border-2 border-ink bg-white px-4 py-3 font-semibold outline-none disabled:bg-cream-dark focus:ring-4 focus:ring-pink/20" placeholder="Se genera automáticamente" />
              </label>
              <label>
                <span className="text-xs font-extrabold uppercase tracking-wider text-ink/55">Precio</span>
                <input type="number" min="0" step="1" value={productDraft.price} onChange={(event) => setProductDraft((current) => ({ ...current, price: event.target.value }))} className="mt-1 w-full rounded-2xl border-2 border-ink bg-white px-4 py-3 font-semibold outline-none focus:ring-4 focus:ring-pink/20" placeholder="0" />
              </label>
              <label>
                <span className="text-xs font-extrabold uppercase tracking-wider text-ink/55">Stock</span>
                <input type="number" min="0" step="1" value={productDraft.stock} onChange={(event) => setProductDraft((current) => ({ ...current, stock: event.target.value }))} className="mt-1 w-full rounded-2xl border-2 border-ink bg-white px-4 py-3 font-semibold outline-none focus:ring-4 focus:ring-pink/20" placeholder="0" />
              </label>
              <label>
                <span className="text-xs font-extrabold uppercase tracking-wider text-ink/55">Categoría</span>
                <select value={productDraft.category} onChange={(event) => setProductDraft((current) => ({ ...current, category: event.target.value }))} className="mt-1 w-full rounded-2xl border-2 border-ink bg-white px-4 py-3 font-semibold outline-none focus:ring-4 focus:ring-pink/20">
                  {categories.map((category) => <option key={category.slug} value={category.slug}>{category.label}</option>)}
                </select>
              </label>
              <div className="mt-2 flex flex-col-reverse gap-3 sm:col-span-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeProductForm} className="rounded-full border-2 border-ink bg-white px-5 py-3 font-extrabold">Cancelar</button>
                <button type="submit" disabled={isSavingProduct} className="rounded-full border-[3px] border-ink bg-teal px-5 py-3 font-extrabold text-white shadow-[3px_3px_0_var(--color-ink)] disabled:opacity-50">{isSavingProduct ? "Guardando…" : editingProduct ? "Guardar cambios" : "Agregar al catálogo"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
