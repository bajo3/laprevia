import { useCallback, useEffect, useRef, useState } from "react";
import AdminLogin from "./AdminLogin";
import { compressImage } from "./compress-image";
import categoryMap from "../data/category-map.json";
import { categories, emojiByCategory } from "../data/catalog-config";
import { FALLBACK_CATEGORY, guessCategory, isUnsorted, normalizeCategory } from "../data/categorize";
import {
  fetchAllProducts,
  fetchCatalogPage,
  fetchCategoryCounts,
  moveProductsToCategories,
  normalizeRemoteProduct,
  PAGE_SIZE,
  type CategoryCounts,
  type CategoryMove,
} from "../data/catalog-api";
import type { Product } from "../data/products";

type PhotoFilter = "all" | "missing" | "ready";

type ImportPreview = {
  fileName: string;
  products: Product[];
  skipped: number;
  /** How many rows kept the section they already had in the catalog. Shown
   *  before confirming so it is obvious the import respects the filing. */
  keptCategories: number;
};

/** Result of scanning the general drawer for articles that clearly belong to
 *  a real section. Held until the shop confirms the move. */
type SortPreview = {
  moves: CategoryMove[];
  byCategory: Record<string, number>;
  scanned: number;
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
  category: FALLBACK_CATEGORY,
};

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

function productHasPhoto(product: Product, localPhotoUrls: Record<string, string>) {
  return Boolean(product.image || localPhotoUrls[product.id]);
}

function findColumn(row: Record<string, unknown>, candidates: string[]) {
  return Object.keys(row).find((key) => candidates.includes(normalize(key)));
}

/** SheetJS is a quarter of a megabyte and only matters once someone picks a
 *  file, so it is fetched at that moment rather than shipped with the panel. */
async function parseExcelFile(
  buffer: ArrayBuffer,
  fileName: string,
  existingProducts: Product[],
): Promise<ImportPreview> {
  const XLSX = await import("xlsx");
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
  let keptCategories = 0;

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
    // The section already saved for this product wins over everything else.
    // The seed map and the keyword guess only ever apply to an article the
    // catalog has never seen, so a correction made from the panel is never
    // undone by the next price list. The server enforces this too.
    const seeded = typeof categoryMap[id as keyof typeof categoryMap] === "string"
      ? normalizeCategory(categoryMap[id as keyof typeof categoryMap])
      : FALLBACK_CATEGORY;
    let category: string;
    if (previous) {
      category = normalizeCategory(previous.category);
      keptCategories += 1;
    } else {
      // Most of the seed map predates the new sections and just says "general
      // drawer", which carries no information. Only a seed naming a real
      // section beats the keyword guess.
      category = seeded === FALLBACK_CATEGORY ? guessCategory(name) : seeded;
    }
    const stock = stockKey ? toNumber(row[stockKey]) : previous?.stock;
    parsed.push({
      id,
      name,
      code: codeValue && normalize(codeValue) !== "nan" ? codeValue : undefined,
      category,
      price: Math.round(price),
      unit: "un",
      emoji: emojiByCategory[category] ?? emojiByCategory[FALLBACK_CATEGORY],
      image: previous?.image,
      stock: Number.isFinite(stock) ? stock : undefined,
    });
  }

  return { fileName, products: parsed, skipped, keptCategories };
}

const SESSION_KEY = "laprevia-admin-session";

export default function AdminDashboard() {
  const [session, setSession] = useState<string | null>(() => sessionStorage.getItem(SESSION_KEY));
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [photoFilter, setPhotoFilter] = useState<PhotoFilter>("missing");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [categoryCounts, setCategoryCounts] = useState<CategoryCounts>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkCategory, setBulkCategory] = useState<string>(categories[0].slug);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [isMovingSelection, setIsMovingSelection] = useState(false);
  const [sortPreview, setSortPreview] = useState<SortPreview | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [withPhotoCount, setWithPhotoCount] = useState(0);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
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
        fetchCatalogPage({ limit: 1, fresh: true }),
        fetchCatalogPage({ limit: 1, photo: "ready" }),
      ]);
      setTotalCount(all.total);
      setWithPhotoCount(ready.total);
    } catch {
      // Counts are informational; a failure here must not block the dashboard.
    }
    try {
      setCategoryCounts(await fetchCategoryCounts());
    } catch {
      // Same: the section chips fall back to showing no number.
    }
  }, []);

  /** No offline fallback here either. The panel exists to write to the
   *  database; showing a saved copy of the catalog when the database is
   *  unreachable invited edits that were never going to be saved. */
  const loadPage = useCallback(async () => {
    const id = ++requestId.current;
    setIsCatalogLoading(true);
    try {
      const page = await fetchCatalogPage({
        query: debouncedQuery,
        category: categoryFilter,
        photo: photoFilter,
        limit: PAGE_SIZE,
        fresh: true,
      });
      if (id !== requestId.current) return;
      setCatalog(page.products);
      setFilteredTotal(page.total);
      setHasLoadError(false);
    } catch {
      if (id !== requestId.current) return;
      setCatalog([]);
      setFilteredTotal(0);
      setHasLoadError(true);
      setNotice({ tone: "error", text: "No se pudo cargar el catálogo. Revisá la conexión y probá de nuevo." });
    } finally {
      if (id === requestId.current) setIsCatalogLoading(false);
    }
  }, [categoryFilter, debouncedQuery, photoFilter]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  /** A product that moves out of the section on screen stops being visible,
   *  so keeping it ticked would hide it from the count in the action bar. */
  useEffect(() => {
    setSelectedIds([]);
  }, [categoryFilter, debouncedQuery, photoFilter]);

  useEffect(() => {
    void refreshCounts();
  }, [refreshCounts]);

  async function loadMore() {
    if (isLoadingMore || hasLoadError) return;
    setIsLoadingMore(true);
    try {
      const page = await fetchCatalogPage({
        query: debouncedQuery,
        category: categoryFilter,
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
  const selected = new Set(selectedIds);
  const unsortedCount = categoryCounts[FALLBACK_CATEGORY] ?? 0;

  function toggleSelected(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function selectAllVisible() {
    const visibleIds = visibleProducts.map((product) => product.id);
    const allTicked = visibleIds.every((id) => selected.has(id));
    setSelectedIds(allTicked ? [] : visibleIds);
  }

  /** Shared by the per-card dropdown and the bulk bar. Both write only the
   *  section, so nothing else about the product can change by accident. */
  async function applyMoves(moves: CategoryMove[]): Promise<boolean> {
    if (!moves.length) return false;
    const movedIds = new Set(moves.map((move) => move.id));
    const destination = new Map(moves.map((move) => [move.id, move.category]));

    try {
      const { response, moved, counts } = await moveProductsToCategories(moves, session);
      if (!response.ok) throw apiFailure(response);
      if (Object.keys(counts).length) setCategoryCounts(counts);
      // While a section is being shown, a product that just left it no longer
      // belongs on screen; otherwise it stays put with its new label.
      setCatalog((current) =>
        categoryFilter
          ? current.filter((product) => !movedIds.has(product.id))
          : current.map((product) =>
              movedIds.has(product.id)
                ? normalizeRemoteProduct({ ...product, category: destination.get(product.id) })
                : product,
            ),
      );
      if (categoryFilter) setFilteredTotal((current) => Math.max(0, current - moved));
      setSelectedIds((current) => current.filter((id) => !movedIds.has(id)));
      const target = categories.find((category) => category.slug === moves[0].category);
      setNotice({
        tone: "success",
        text: moves.length === 1
          ? `Listo: ${target?.label ?? moves[0].category} para ese producto.`
          : `${moved.toLocaleString("es-AR")} productos movidos a ${target?.label ?? moves[0].category}.`,
      });
      return true;
    } catch (error) {
      if (failureKind(error) === "unauthorized") {
        handleLogout();
        setNotice({ tone: "error", text: "Tu sesión venció o la clave cambió. Iniciá sesión de nuevo." });
        return false;
      }
      setNotice({ tone: "error", text: "No se pudo cambiar la sección. Probá de nuevo en un momento." });
      return false;
    }
  }

  async function changeProductCategory(product: Product, category: string) {
    if (category === product.category) return;
    setMovingId(product.id);
    try {
      await applyMoves([{ id: product.id, category }]);
    } finally {
      setMovingId(null);
    }
  }

  async function moveSelection() {
    if (!selectedIds.length) return;
    setIsMovingSelection(true);
    try {
      await applyMoves(selectedIds.map((id) => ({ id, category: bulkCategory })));
    } finally {
      setIsMovingSelection(false);
    }
  }

  /** Reads the whole catalog and proposes a section for every article still
   *  sitting in the general drawer. Nothing is written until the shop
   *  confirms, and articles already filed by hand are never touched. */
  async function scanUnsorted() {
    setIsScanning(true);
    setSortPreview(null);
    setNotice({ tone: "success", text: "Revisando el catálogo…" });
    try {
      const all = await fetchAllProducts();
      const moves: CategoryMove[] = [];
      const byCategory: Record<string, number> = {};
      let scanned = 0;
      for (const product of all) {
        if (!isUnsorted(product.category)) continue;
        scanned += 1;
        const category = guessCategory(product.name);
        if (category === FALLBACK_CATEGORY) continue;
        moves.push({ id: product.id, category });
        byCategory[category] = (byCategory[category] ?? 0) + 1;
      }
      setSortPreview({ moves, byCategory, scanned });
      setNotice(
        moves.length
          ? { tone: "success", text: `${moves.length.toLocaleString("es-AR")} de ${scanned.toLocaleString("es-AR")} productos de Varios se pueden ubicar solos. Revisá y confirmá.` }
          : { tone: "warning", text: "No se encontró nada para mover automáticamente. Podés ubicarlos a mano desde las tarjetas." },
      );
    } catch {
      setNotice({ tone: "error", text: "No se pudo leer el catálogo completo para revisarlo." });
    } finally {
      setIsScanning(false);
    }
  }

  async function applySortPreview() {
    if (!sortPreview?.moves.length) return;
    setIsScanning(true);
    try {
      // Sent in slices so a big first sweep does not exceed what one request
      // is allowed to carry.
      const CHUNK = 2000;
      let moved = 0;
      for (let index = 0; index < sortPreview.moves.length; index += CHUNK) {
        const slice = sortPreview.moves.slice(index, index + CHUNK);
        const { response, moved: count, counts } = await moveProductsToCategories(slice, session);
        if (!response.ok) throw apiFailure(response);
        if (Object.keys(counts).length) setCategoryCounts(counts);
        moved += count;
      }
      setSortPreview(null);
      await Promise.all([loadPage(), refreshCounts()]);
      setNotice({ tone: "success", text: `${moved.toLocaleString("es-AR")} productos quedaron ubicados en su sección.` });
    } catch (error) {
      if (failureKind(error) === "unauthorized") {
        handleLogout();
        setNotice({ tone: "error", text: "Tu sesión venció o la clave cambió. Iniciá sesión de nuevo." });
        return;
      }
      setNotice({ tone: "error", text: "No se pudo guardar el reordenamiento." });
    } finally {
      setIsScanning(false);
    }
  }

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
      const nextPreview = await parseExcelFile(await file.arrayBuffer(), file.name, existing);
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
              <p className="mt-1 text-sm text-ink/60">La importación usa el ID como clave: actualiza precios y stock, y <strong>nunca borra las fotos ni la sección</strong> que ya tenía cada producto.</p>
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
                <p className="mt-1 text-sm font-bold text-teal-dark">🔒 {preview.keptCategories.toLocaleString("es-AR")} productos conservan su sección y su foto.</p>
              </div>
              <button type="button" onClick={confirmImport} disabled={isImporting} className="rounded-full border-2 border-ink bg-teal px-5 py-2.5 font-extrabold text-white shadow-[3px_3px_0_var(--color-ink)] disabled:opacity-50">
                {isImporting ? "Guardando…" : "Confirmar actualización"}
              </button>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-3xl border-[3px] border-ink bg-white p-5 shadow-[4px_4px_0_var(--color-ink)] sm:p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-pink">Secciones del catálogo</p>
              <h2 className="font-display mt-1 text-2xl">¿A qué sección va cada producto?</h2>
              <p className="mt-1 max-w-xl text-sm text-ink/60">
                Tocá una sección para ver solo esos productos. Cada tarjeta tiene un desplegable para cambiarla, o tildá varias y movelas todas juntas.
              </p>
              {unsortedCount > 0 && (
                <p className="mt-2 text-sm font-bold text-ink/70">
                  🛒 Quedan {unsortedCount.toLocaleString("es-AR")} productos en Varios esperando su sección.
                </p>
              )}
            </div>
            <button
                type="button"
                onClick={() => void scanUnsorted()}
                disabled={isScanning || hasLoadError}
                className="shrink-0 rounded-full border-[3px] border-ink bg-yellow px-5 py-3 font-extrabold shadow-[3px_3px_0_var(--color-ink)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
              >
                {isScanning ? "Revisando…" : "✨ Ubicar automáticamente"}
              </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategoryFilter(null)}
              aria-pressed={categoryFilter === null}
              className={`rounded-full border-2 border-ink px-3 py-2 text-sm font-extrabold transition ${categoryFilter === null ? "bg-ink text-cream" : "bg-cream text-ink hover:-translate-y-0.5"}`}
            >
              Todas · {totalCount.toLocaleString("es-AR")}
            </button>
            {categories.map((category) => {
              const isActive = categoryFilter === category.slug;
              return (
                <button
                  key={category.slug}
                  type="button"
                  onClick={() => setCategoryFilter(isActive ? null : category.slug)}
                  aria-pressed={isActive}
                  style={isActive ? { backgroundColor: category.color } : undefined}
                  className={`rounded-full border-2 border-ink px-3 py-2 text-sm font-extrabold transition hover:-translate-y-0.5 ${isActive ? "text-white" : "bg-cream text-ink"}`}
                >
                  {category.emoji} {category.label} · {(categoryCounts[category.slug] ?? 0).toLocaleString("es-AR")}
                </button>
              );
            })}
          </div>

          {sortPreview && (
            <div className="mt-5 rounded-2xl border-2 border-dashed border-teal bg-teal/10 p-4">
              <p className="font-extrabold">
                Se revisaron {sortPreview.scanned.toLocaleString("es-AR")} productos de Varios.
              </p>
              {sortPreview.moves.length > 0 ? (
                <>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(sortPreview.byCategory)
                      .sort((a, b) => b[1] - a[1])
                      .map(([slug, count]) => {
                        const category = categories.find((item) => item.slug === slug);
                        return (
                          <li key={slug} className="rounded-full border-2 border-ink bg-white px-3 py-1.5 text-sm font-extrabold">
                            {category?.emoji} {category?.label ?? slug} · {count.toLocaleString("es-AR")}
                          </li>
                        );
                      })}
                  </ul>
                  <p className="mt-3 text-sm text-ink/60">
                    Los {(sortPreview.scanned - sortPreview.moves.length).toLocaleString("es-AR")} restantes quedan en Varios para ubicarlos a mano. Esto no toca precios, stock ni fotos.
                  </p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => void applySortPreview()}
                      disabled={isScanning}
                      className="rounded-full border-2 border-ink bg-teal px-5 py-2.5 font-extrabold text-white shadow-[3px_3px_0_var(--color-ink)] disabled:opacity-50"
                    >
                      {isScanning ? "Guardando…" : `Mover ${sortPreview.moves.length.toLocaleString("es-AR")} productos`}
                    </button>
                    <button type="button" onClick={() => setSortPreview(null)} disabled={isScanning} className="rounded-full border-2 border-ink bg-white px-5 py-2.5 font-extrabold disabled:opacity-50">
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <p className="mt-2 text-sm text-ink/60">No hay nada que se pueda ubicar solo. Movelos a mano desde cada tarjeta.</p>
              )}
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

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={selectAllVisible}
              disabled={!visibleProducts.length}
              className="rounded-full border-2 border-ink bg-white px-3 py-2 text-xs font-extrabold transition hover:bg-yellow disabled:opacity-40"
            >
              {visibleProducts.length > 0 && visibleProducts.every((product) => selected.has(product.id)) ? "Destildar todo" : "Tildar los que se ven"}
            </button>
            {selectedIds.length > 0 && (
              <button type="button" onClick={() => setSelectedIds([])} className="rounded-full border-2 border-ink bg-white px-3 py-2 text-xs font-extrabold transition hover:bg-yellow">
                Limpiar selección
              </button>
            )}
          </div>


          {isCatalogLoading && (
            <p className="mt-6 text-center text-sm font-bold text-ink/50" role="status">Cargando productos…</p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5">
            {visibleProducts.map((product) => {
              const imageSrc = localPhotoUrls[product.id] ?? product.image;
              const isTicked = selected.has(product.id);
              const section = categories.find((category) => category.slug === product.category);
              return (
                <article key={product.id} className={`group relative flex min-w-0 flex-col rounded-3xl border-[3px] bg-white p-3 shadow-[4px_4px_0_var(--color-ink)] sm:p-4 ${isTicked ? "border-pink" : "border-ink"}`}>
                  <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-cream-dark text-4xl sm:text-5xl">
                    {imageSrc ? <img src={imageSrc} alt={product.name} loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <span aria-hidden="true">{product.emoji}</span>}
                    {productHasPhoto(product, localPhotoUrls) && <span className="absolute right-2 top-2 rounded-full border-2 border-ink bg-teal px-2 py-1 text-xs font-black text-white">✓</span>}
                    <label className="absolute left-2 top-2 flex cursor-pointer items-center gap-1 rounded-full border-2 border-ink bg-white px-2 py-1 text-xs font-extrabold">
                      <input
                        type="checkbox"
                        checked={isTicked}
                        onChange={() => toggleSelected(product.id)}
                        className="h-4 w-4 accent-[var(--color-pink)]"
                      />
                      <span className="sr-only">Seleccionar {product.name}</span>
                    </label>
                  </div>
                  <p className="mt-3 truncate text-[10px] font-extrabold uppercase tracking-widest text-ink/45">ID {product.id}</p>
                  <h3 className="mt-1 line-clamp-3 min-h-10 break-words font-display text-[13px] leading-tight min-[360px]:text-[15px] sm:text-lg" title={product.name}>{product.name}</h3>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs font-bold text-ink/55"><span>{currency.format(product.price)}</span><span>{product.stock === undefined ? "—" : product.stock <= 0 ? "Sin stock" : `${product.stock} stock`}</span></div>
                  {/* The section sits with the product, not behind the edit
                      form: filing the catalog is a pass over many cards.
                      mt-auto keeps this action stack aligned across a row even
                      when product names wrap to different line counts. */}
                  <label className="mt-auto block pt-3">
                    <span className="sr-only">Sección de {product.name}</span>
                    <select
                      value={product.category}
                      disabled={movingId === product.id}
                      onChange={(event) => void changeProductCategory(product, event.target.value)}
                      style={{ borderColor: section?.color ?? "var(--color-ink)" }}
                      className="w-full truncate rounded-full border-2 bg-white px-3 py-2 text-xs font-extrabold outline-none focus:ring-4 focus:ring-pink/20 disabled:opacity-50"
                    >
                      {categories.map((category) => (
                        <option key={category.slug} value={category.slug}>
                          {category.emoji} {category.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="mt-2 flex cursor-pointer items-center justify-center rounded-full border-2 border-ink bg-cream px-3 py-2 text-center text-xs font-extrabold transition hover:bg-yellow">
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

      {selectedIds.length > 0 && (
        <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-[110] w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 rounded-3xl border-[3px] border-ink bg-cream p-3 shadow-[5px_5px_0_var(--color-ink)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <p className="shrink-0 px-1 font-extrabold">{selectedIds.length.toLocaleString("es-AR")} seleccionados</p>
            {/* Destination and action share a row on phones so the bar stays
                two lines tall instead of covering a fifth of the screen. */}
            <div className="flex min-w-0 flex-1 gap-2">
              <label className="min-w-0 flex-1">
                <span className="sr-only">Sección de destino</span>
                <select
                  value={bulkCategory}
                  onChange={(event) => setBulkCategory(event.target.value)}
                  className="w-full rounded-full border-2 border-ink bg-white px-3 py-2.5 text-sm font-extrabold outline-none focus:ring-4 focus:ring-pink/20"
                >
                  {categories.map((category) => (
                    <option key={category.slug} value={category.slug}>
                      {category.emoji} {category.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => void moveSelection()}
                disabled={isMovingSelection}
                className="shrink-0 rounded-full border-2 border-ink bg-teal px-5 py-2.5 text-sm font-extrabold text-white shadow-[3px_3px_0_var(--color-ink)] disabled:opacity-50"
              >
                {isMovingSelection ? "Moviendo…" : "Mover"}
              </button>
            </div>
          </div>
        </div>
      )}

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
