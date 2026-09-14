export type Category = {
  /** Stored on every product row and never edited: renaming a section changes
   *  its label, not the value the catalog filed fifteen thousand articles
   *  under. */
  slug: string;
  label: string;
  emoji: string;
  color: string;
  /** The general drawer. It cannot be deleted, because it is where the
   *  products of a deleted section go. */
  protected?: boolean;
};

export type Product = {
  id: string;
  name: string;
  code?: string;
  category: string;
  price: number;
  unit: string;
  emoji: string;
  badge?: "Importado" | "Promo" | "Nuevo";
  image?: string;
  stock?: number;
};
