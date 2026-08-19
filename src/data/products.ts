export type Category = {
  slug: string;
  label: string;
  emoji: string;
  color: string;
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
